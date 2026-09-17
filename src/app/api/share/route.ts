// 짧은 공유 코드(PB-xxxxxxxx) ↔ 긴 공유 코드(PB2…) 저장소. Cloudflare R2(CDN 버킷) `share/<id>` 에 영구 저장한다.
//  · POST { code, image? } → { id } : 긴 코드를 검증(압축 해제 + JSON)한 뒤 저장. image(base64 JPEG)는 링크 미리보기 카드(og:image)용
//                                `share/<id>.jpg` 로 함께 저장(없던 경우에만). id = sha256(코드) → base62 앞 8자(같은 코디 = 같은 id).
//                                같은 id 에 다른 코드가 이미 있으면(해시 충돌) 9~12자로 늘린다.
//  · GET ?id=PB-xxxxxxxx → 긴 코드(text) : CDN 직접 조회가 실패했을 때의 폴백(클라이언트는 CDN 을 먼저 읽는다).
// 필요한 환경변수(서버 전용): R2_ENDPOINT(https://<account>.r2.cloudflarestorage.com), R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET(선택).
import { createHash, createHmac } from 'crypto'
import { inflateRawSync } from 'zlib'
import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

const ENDPOINT = (process.env.R2_ENDPOINT || '').replace(/\/+$/, '')
const KEY_ID = process.env.R2_ACCESS_KEY_ID || ''
const SECRET = process.env.R2_SECRET_ACCESS_KEY || ''
const BUCKET = process.env.R2_BUCKET || 'pinkbean-customize-shop'
const MAX_CODE = 8000
const SHORT_RE = /^PB-[0-9A-Za-z]{8,12}$/

const sha256 = (d: string | Buffer) => createHash('sha256').update(d).digest('hex')
const hmac = (k: Buffer | string, d: string) => createHmac('sha256', k).update(d).digest()

// AWS SigV4(S3 호환, region=auto) — 의존성 없이 PUT/GET 한 건씩만 서명한다.
async function r2(method: 'GET' | 'HEAD' | 'PUT', key: string, body?: string | Buffer, contentType = 'text/plain; charset=utf-8'): Promise<Response> {
  const url = new URL(`${ENDPOINT}/${BUCKET}/${key}`)
  const now = new Date()
  const amzDate = now.toISOString().replace(/[-:]|\.\d{3}/g, '')
  const day = amzDate.slice(0, 8)
  const payloadHash = sha256(body ?? '')
  const headers: Record<string, string> = { host: url.host, 'x-amz-content-sha256': payloadHash, 'x-amz-date': amzDate }
  if (method === 'PUT') {
    headers['content-type'] = contentType
    headers['cache-control'] = 'public, max-age=31536000, immutable'
  }
  const names = Object.keys(headers).sort()
  const canonical = [method, url.pathname, '', ...names.map((n) => `${n}:${headers[n]}`), '', names.join(';'), payloadHash].join('\n')
  const scope = `${day}/auto/s3/aws4_request`
  const toSign = ['AWS4-HMAC-SHA256', amzDate, scope, sha256(canonical)].join('\n')
  const kSign = hmac(hmac(hmac(hmac('AWS4' + SECRET, day), 'auto'), 's3'), 'aws4_request')
  const auth = `AWS4-HMAC-SHA256 Credential=${KEY_ID}/${scope}, SignedHeaders=${names.join(';')}, Signature=${createHmac('sha256', kSign).update(toSign).digest('hex')}`
  const { host: _host, ...send } = headers
  return fetch(url, { method, headers: { ...send, authorization: auth }, body: body as BodyInit | undefined, cache: 'no-store' })
}

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

const configured = () => !!(ENDPOINT && KEY_ID && SECRET)

// 링크 미리보기 이미지 저장 — 이미 있으면 건너뛴다(카톡 등은 URL 별로 미리보기를 캐시하므로 처음 것이 기준).
// JPEG 시그니처·크기(≤2MB)만 확인. 실패해도 코드 저장은 성공으로 둔다(카드는 기본 이미지로 폴백).
async function putImage(id: string, b64: string): Promise<void> {
  if (!b64) return
  try {
    const buf = Buffer.from(b64, 'base64')
    if (buf.length < 100 || buf.length > 2_000_000 || buf[0] !== 0xff || buf[1] !== 0xd8) return
    const key = `share/${id}.jpg`
    if ((await r2('HEAD', key)).ok) return
    await r2('PUT', key, buf, 'image/jpeg')
  } catch { /* noop */ }
}

export async function POST(req: NextRequest) {
  if (!configured()) return NextResponse.json({ error: 'not configured' }, { status: 503 })
  let code = '', image = ''
  try { const b = await req.json(); code = String(b?.code || '').trim(); image = typeof b?.image === 'string' ? b.image : '' } catch { /* noop */ }
  if (!validLong(code)) return NextResponse.json({ error: 'invalid code' }, { status: 400 })
  const digest = base62(sha256(code))
  for (let len = 8; len <= 12; len++) {
    const id = 'PB-' + digest.slice(0, len)
    const key = `share/${id}`
    const got = await r2('GET', key)
    if (got.ok) {
      if ((await got.text()) === code) { await putImage(id, image); return NextResponse.json({ id }) }
      continue // 충돌 → 한 글자 더 긴 id
    }
    if (got.status !== 404) return NextResponse.json({ error: 'storage error' }, { status: 502 })
    const put = await r2('PUT', key, code)
    if (!put.ok) return NextResponse.json({ error: 'storage error' }, { status: 502 })
    await putImage(id, image)
    return NextResponse.json({ id })
  }
  return NextResponse.json({ error: 'collision' }, { status: 500 })
}

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')?.trim() || ''
  if (!SHORT_RE.test(id)) return NextResponse.json({ error: 'invalid id' }, { status: 400 })
  if (!configured()) return NextResponse.json({ error: 'not configured' }, { status: 503 })
  const got = await r2('GET', `share/${id}`)
  if (!got.ok) return NextResponse.json({ error: 'not found' }, { status: got.status === 404 ? 404 : 502 })
  return new NextResponse(await got.text(), { headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'public, max-age=31536000, immutable' } })
}
