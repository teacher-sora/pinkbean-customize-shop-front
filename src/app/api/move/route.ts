// 프리셋 옮기기(사용자 지시 — 한 기기의 프리셋 여러 개를 다른 기기로 한 번에). Cloudflare R2(CDN 버킷) `move/`(dev 는 `move-dev/`)에 둔다.
//  · 묶음 = { v: 1, items: [{ n: 프리셋 이름, c: 긴 공유 코드(PB2…) }] } — 코디마다 공유 링크와 같은 코드라 받는 쪽은 그대로 풀어 쓴다(lib/shareCode).
//  · POST { bundle }            → { code, ttl } : 5자리 숫자 코드(5분 — 지나면 버린다. 그래서 다섯 자리로도 겹치지 않는다). 같은 번호가 아직 살아 있으면 다른 번호
//  · GET ?code=12345            → 묶음 : 지났거나 없으면 404
//  · POST { bundle, id, token? } → { id, token } : 아이디로 둔다(간단한 계정 — 겹치면 409). 처음 만든 기기가 받은 token 이 있어야 고쳐 쓴다
//  · GET ?id=이름               → 묶음 : 아이디로 받기(누구나 — 아이디만 알면 받는다)
//  · GET ?check=이름            → { taken } : 아이디가 이미 있는지
//  · DELETE { id, token }       → { ok } : 만든 기기가 아이디를 지운다 — 곧바로 다른 사람이 그 아이디를 쓸 수 있다. 이미 없으면 지운 것으로 본다
// 저장소 접근은 lib/server/r2.ts.
import { inflateRawSync } from 'zlib'
import { randomBytes } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { r2, r2Configured as configured, sha256 } from '@/lib/server/r2'

export const runtime = 'nodejs'

const TTL = 5 * 60 * 1000 // 코드가 살아 있는 시간(사용자 지시 — 5분 뒤 말소, 보내기 창에 남은 시간이 보인다)
const MAX_ITEMS = 100, MAX_CODE = 8000, MAX_NAME = 40
const CODE_RE = /^\d{5}$/
// 아이디: 2~16자, 한글 · 영문 · 숫자 · _ · -, 숫자만은 안 된다(5자리 코드와 갈리게)
const ID_RE = /^(?!\d+$)[0-9A-Za-z가-힣_-]{2,16}$/
// dev 와 운영을 섞지 않는다(공유 코드와 같은 규칙 — app/api/share)
const prefix = (host: string) => (/^(www\.)?pinkbean-customize\.com$/.test(host) ? 'move' : 'move-dev')

type Bundle = { v: 1; items: { n: string; c: string }[] }
function validLong(code: string): boolean {
  if (typeof code !== 'string' || code.length > MAX_CODE || !/^PB2[A-Za-z0-9_-]+$/.test(code)) return false
  try { const m = JSON.parse(inflateRawSync(Buffer.from(code.slice(3), 'base64url')).toString('utf8')); return !!m && typeof m === 'object' && typeof m.e === 'object' } catch { return false }
}
function cleanBundle(b: unknown): Bundle | null {
  const items = (b as Bundle | null)?.items
  if (!Array.isArray(items) || !items.length || items.length > MAX_ITEMS) return null
  const out: Bundle['items'] = []
  for (const it of items) {
    if (!it || !validLong(it.c)) return null
    out.push({ n: typeof it.n === 'string' ? it.n.slice(0, MAX_NAME) : '', c: it.c })
  }
  return { v: 1, items: out }
}
const read = async (key: string): Promise<{ t: number; h?: string; d: Bundle } | null | 'err'> => {
  const r = await r2('GET', key)
  if (r.status === 404) return null
  if (!r.ok) return 'err'
  try { return JSON.parse(await r.text()) } catch { return null }
}
const put = (key: string, v: unknown) => r2('PUT', key, JSON.stringify(v), 'application/json')
const idKey = (p: string, id: string) => `${p}/u/${id.toLowerCase()}`

export async function GET(req: NextRequest) {
  if (!configured()) return NextResponse.json({ error: 'not configured' }, { status: 503 })
  const p = prefix(req.nextUrl.hostname), q = req.nextUrl.searchParams
  const code = q.get('code'), id = q.get('id'), check = q.get('check')
  if (check != null) {
    if (!ID_RE.test(check)) return NextResponse.json({ error: 'bad id' }, { status: 400 })
    const got = await read(idKey(p, check))
    return got === 'err' ? NextResponse.json({ error: 'storage error' }, { status: 502 }) : NextResponse.json({ taken: !!got })
  }
  const key = code && CODE_RE.test(code) ? `${p}/c/${code}` : id && ID_RE.test(id) ? idKey(p, id) : null
  if (!key) return NextResponse.json({ error: 'bad request' }, { status: 400 })
  const got = await read(key)
  if (got === 'err') return NextResponse.json({ error: 'storage error' }, { status: 502 })
  if (!got || (code && Date.now() - got.t > TTL)) return NextResponse.json({ error: 'not found' }, { status: 404 })
  return NextResponse.json(got.d, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(req: NextRequest) {
  if (!configured()) return NextResponse.json({ error: 'not configured' }, { status: 503 })
  const p = prefix(req.nextUrl.hostname)
  let body: { bundle?: unknown; id?: unknown; token?: unknown } = {}
  try { body = await req.json() } catch { /* noop */ }
  const d = cleanBundle(body.bundle)
  if (!d) return NextResponse.json({ error: 'invalid bundle' }, { status: 400 })
  // 아이디로 두기
  if (body.id != null) {
    const id = String(body.id)
    if (!ID_RE.test(id)) return NextResponse.json({ error: 'bad id' }, { status: 400 })
    const key = idKey(p, id), got = await read(key)
    if (got === 'err') return NextResponse.json({ error: 'storage error' }, { status: 502 })
    const token = typeof body.token === 'string' ? body.token : ''
    if (got && got.h !== sha256(token)) return NextResponse.json({ error: 'taken' }, { status: 409 })
    const tk = got ? token : randomBytes(18).toString('base64url')
    if (!(await put(key, { t: Date.now(), h: sha256(tk), d })).ok) return NextResponse.json({ error: 'storage error' }, { status: 502 })
    return NextResponse.json({ id, token: tk })
  }
  // 5자리 코드 — 살아 있는 번호와 겹치면 다시 뽑는다
  for (let k = 0; k < 8; k++) {
    const code = String(10000 + (randomBytes(4).readUInt32BE(0) % 90000)), key = `${p}/c/${code}`
    const got = await read(key)
    if (got === 'err') return NextResponse.json({ error: 'storage error' }, { status: 502 })
    if (got && Date.now() - got.t <= TTL) continue
    if (!(await put(key, { t: Date.now(), d })).ok) return NextResponse.json({ error: 'storage error' }, { status: 502 })
    return NextResponse.json({ code, ttl: TTL })
  }
  return NextResponse.json({ error: 'busy' }, { status: 503 })
}

export async function DELETE(req: NextRequest) {
  if (!configured()) return NextResponse.json({ error: 'not configured' }, { status: 503 })
  const p = prefix(req.nextUrl.hostname)
  let body: { id?: unknown; token?: unknown } = {}
  try { body = await req.json() } catch { /* noop */ }
  const id = String(body.id ?? ''), token = typeof body.token === 'string' ? body.token : ''
  if (!ID_RE.test(id)) return NextResponse.json({ error: 'bad id' }, { status: 400 })
  const key = idKey(p, id), got = await read(key)
  if (got === 'err') return NextResponse.json({ error: 'storage error' }, { status: 502 })
  if (!got) return NextResponse.json({ ok: true })
  if (got.h !== sha256(token)) return NextResponse.json({ error: 'not yours' }, { status: 403 })
  const r = await r2('DELETE', key)
  if (!r.ok && r.status !== 404) return NextResponse.json({ error: 'storage error' }, { status: 502 })
  return NextResponse.json({ ok: true })
}
