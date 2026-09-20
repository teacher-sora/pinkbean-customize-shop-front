// 짧은 공유 코드(PB-xxxxxxxx) ↔ 긴 공유 코드(PB2…) 저장소. Cloudflare R2(CDN 버킷) `share/<id>`(dev 는 `share-dev/<id>`) 에 영구 저장한다.
//  · POST { code, image? } → { id } : 긴 코드를 검증(압축 해제 + JSON)한 뒤 저장. image(base64 JPEG)는 링크 미리보기 카드(og:image)용
//                                `share/<id>.jpg` 로 함께 저장(없던 경우에만). id = sha256(코드) → base62 앞 8자(같은 코디 = 같은 id).
//                                같은 id 에 다른 코드가 이미 있으면(해시 충돌) 9~12자로 늘린다.
//  · GET ?id=PB-xxxxxxxx → 긴 코드(text) : CDN 직접 조회가 실패했을 때의 폴백(클라이언트는 CDN 을 먼저 읽는다).
// 저장소 접근은 lib/server/r2.ts(환경변수 설명 포함).
import { inflateRawSync } from 'zlib'
import { NextRequest, NextResponse } from 'next/server'
import { r2, r2Configured as configured, sha256 } from '@/lib/server/r2'

export const runtime = 'nodejs'

const MAX_CODE = 8000
// id 해시 솔트 — 카톡 등은 URL 별로 카드를 영구 캐시하므로, 카드 모양을 바꿔 전부 새로 만들 땐 솔트를 올려 URL 자체를 바꾼다.
// ⚠️ lib/shareCode.ts 의 ID_SALT 와 반드시 같아야 한다(브라우저가 같은 id 를 미리 계산해 즉시 복사).
const ID_SALT = 'c4|'
const SHORT_RE = /^PB-[0-9A-Za-z]{8,12}$/

// dev 와 운영의 공유 코드를 섞지 않는다 — 저장 경로 자체를 나눈다(dev 실험 링크가 운영에 남지 않게).
// dev 쪽은 `share-dev/` 하나만 지우면 통째로 정리된다. ⚠️ lib/shareCode.ts · app/share/page.tsx 와 규칙이 같아야 한다.
const sharePrefix = (host: string) => (/^(www\.)?pinkbean-customize\.com$/.test(host) ? 'share' : 'share-dev')

const B62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'
function base62(hex: string): string {
  let n = BigInt('0x' + hex), out = ''
  while (n > 0n) { out = B62[Number(n % 62n)] + out; n /= 62n }
  return out.padStart(12, '0')
}

// 긴 코드가 실제로 복원 가능한 코디인지(쓰레기 저장 방지).
function validLong(code: string): boolean {
  if (code.length > MAX_CODE || !/^PB[12][A-Za-z0-9_-]+$/.test(code)) return false
  try {
    const bytes = Buffer.from(code.slice(3), 'base64url')
    const json = code.startsWith('PB2') ? inflateRawSync(bytes).toString('utf8') : bytes.toString('utf8')
    const m = JSON.parse(json)
    return !!m && typeof m === 'object' && typeof m.e === 'object'
  } catch { return false }
}

// 링크 미리보기 이미지 저장 — 이미 있으면 건너뛴다(카톡 등은 URL 별로 미리보기를 캐시하므로 처음 것이 기준).
// JPEG 시그니처·크기(≤2MB)만 확인. 실패해도 코드 저장은 성공으로 둔다(카드는 기본 이미지로 폴백).
async function putImage(prefix: string, id: string, b64: string): Promise<void> {
  if (!b64) return
  try {
    const buf = Buffer.from(b64, 'base64')
    if (buf.length < 100 || buf.length > 2_000_000 || buf[0] !== 0xff || buf[1] !== 0xd8) return
    const key = `${prefix}/${id}.jpg`
    if ((await r2('HEAD', key)).ok) return
    await r2('PUT', key, buf, 'image/jpeg')
  } catch { /* noop */ }
}

export async function POST(req: NextRequest) {
  if (!configured()) return NextResponse.json({ error: 'not configured' }, { status: 503 })
  let code = '', image = ''
  try { const b = await req.json(); code = String(b?.code || '').trim(); image = typeof b?.image === 'string' ? b.image : '' } catch { /* noop */ }
  if (!validLong(code)) return NextResponse.json({ error: 'invalid code' }, { status: 400 })
  const prefix = sharePrefix(req.nextUrl.hostname)
  const digest = base62(sha256(ID_SALT + code))
  for (let len = 8; len <= 12; len++) {
    const id = 'PB-' + digest.slice(0, len)
    const key = `${prefix}/${id}`
    const got = await r2('GET', key)
    if (got.ok) {
      if ((await got.text()) === code) { await putImage(prefix, id, image); return NextResponse.json({ id }) }
      continue // 충돌 → 한 글자 더 긴 id
    }
    if (got.status !== 404) return NextResponse.json({ error: 'storage error' }, { status: 502 })
    // 코드를 **먼저** 올린다(2026-09-20 변경) — 링크는 복사 즉시 열 수 있어야 한다.
    // 예전엔 이미지를 먼저 올렸는데, 1200×630 JPEG 업로드가 끝날 때까지 코드가 없어서 방금 복사한 링크로 들어가면
    // '코디를 찾을 수 없어요' 가 떴다(사용자 제보). 카드 이미지는 공유 페이지 메타가 따로 기다린다.
    const put = await r2('PUT', key, code)
    if (!put.ok) return NextResponse.json({ error: 'storage error' }, { status: 502 })
    await putImage(prefix, id, image)
    return NextResponse.json({ id })
  }
  return NextResponse.json({ error: 'collision' }, { status: 500 })
}

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')?.trim() || ''
  if (!SHORT_RE.test(id)) return NextResponse.json({ error: 'invalid id' }, { status: 400 })
  if (!configured()) return NextResponse.json({ error: 'not configured' }, { status: 503 })
  const got = await r2('GET', `${sharePrefix(req.nextUrl.hostname)}/${id}`)
  if (!got.ok) return NextResponse.json({ error: 'not found' }, { status: got.status === 404 ? 404 : 502 })
  return new NextResponse(await got.text(), { headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'public, max-age=31536000, immutable' } })
}
