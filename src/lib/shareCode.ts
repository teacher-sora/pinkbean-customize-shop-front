// 프리셋(코디) 자체 완결형 공유 코드. 서버 없이 코드 안에 스냅샷 전체가 담겨 붙여넣기만으로 복원된다.
//  - 기본(PB2): JSON → deflate-raw(네이티브 CompressionStream) → base64url. 무압축보다 크게 짧다.
//  - 폴백/레거시(PB1): JSON → base64url. CompressionStream 미지원 브라우저 + 옛 공유 링크 호환.
//  - 코드 안에 아이템 id·톤·염색·숨김·연출설정이 들어가므로 서버 조회가 필요 없다.
//  - 링크는 해시(#c=)가 아니라 쿼리(?c=)에 담는다 — 모바일 카톡 등 일부 링크파서가 '#' 이후를 링크로 인식하지 못해서다.
import type { Snapshot, PvSnap } from '@/components/shop/ShopContext'
import { PV_SNAP_DEFAULT } from '@/components/shop/ShopContext'
import { DATA_BASE } from '@/lib/core/data'
import { renderShareImage } from '@/lib/shareImage'

const PREFIX_PLAIN = 'PB1'   // base64url(JSON)          — 레거시/폴백
const PREFIX_DEFLATE = 'PB2' // base64url(deflate-raw(JSON)) — 기본(짧음)

function bytesToB64url(bytes: Uint8Array): string {
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
function b64urlToBytes(s: string): Uint8Array {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(bin, (c) => c.charCodeAt(0))
}

async function deflateRaw(bytes: Uint8Array): Promise<Uint8Array | null> {
  if (typeof CompressionStream === 'undefined') return null
  try {
    const cs = new CompressionStream('deflate-raw')
    const writer = cs.writable.getWriter(); void writer.write(bytes); void writer.close()
    return new Uint8Array(await new Response(cs.readable).arrayBuffer())
  } catch { return null }
}
async function inflateRaw(bytes: Uint8Array): Promise<Uint8Array | null> {
  if (typeof DecompressionStream === 'undefined') return null
  try {
    const ds = new DecompressionStream('deflate-raw')
    const writer = ds.writable.getWriter(); void writer.write(bytes); void writer.close()
    return new Uint8Array(await new Response(ds.readable).arrayBuffer())
  } catch { return null }
}

// pv(연출설정)는 대부분 기본값이므로 기본과 다른 필드만 남긴다(전부 기본이면 통째로 생략). — 코드 길이 절약.
function minPv(pv?: PvSnap): Partial<PvSnap> | undefined {
  if (!pv) return undefined
  const out: Partial<PvSnap> = {}
  for (const k of Object.keys(PV_SNAP_DEFAULT) as (keyof PvSnap)[]) {
    if (pv[k] !== PV_SNAP_DEFAULT[k]) (out as Record<string, unknown>)[k] = pv[k]
  }
  return Object.keys(out).length ? out : undefined
}

// 빈 필드는 빼고(복원 시 기본값으로 채움) 최소 객체로 만든다.
function buildMin(snap: Snapshot): Record<string, unknown> {
  const min: Record<string, unknown> = { e: snap.equipped, t: snap.tone }
  if (snap.dyePalette && Object.keys(snap.dyePalette).length) min.p = snap.dyePalette
  if (snap.dyeHsb && Object.keys(snap.dyeHsb).length) min.h = snap.dyeHsb
  if (snap.hidden && Object.keys(snap.hidden).length) min.x = snap.hidden
  if (snap.dotPos && Object.keys(snap.dotPos).length) min.d = snap.dotPos
  if (snap.dyeOff && Object.keys(snap.dyeOff).length) min.o = snap.dyeOff
  const v = minPv(snap.pv)
  if (v) min.v = v
  if (snap.name) min.n = snap.name
  return min
}

function reviveMin(m: Record<string, unknown>): Snapshot | null {
  if (!m || typeof m !== 'object' || typeof m.e !== 'object') return null
  const v = m.v as Partial<PvSnap> | undefined
  return {
    equipped: (m.e as Snapshot['equipped']) || {},
    tone: typeof m.t === 'number' ? m.t : 0,
    dyePalette: (m.p as Snapshot['dyePalette']) || {},
    dyeHsb: (m.h as Snapshot['dyeHsb']) || {},
    hidden: (m.x as Snapshot['hidden']) || {},
    dotPos: (m.d as Snapshot['dotPos']) || {},
    ...(m.o && typeof m.o === 'object' ? { dyeOff: m.o as Record<string, boolean> } : {}),
    // PB2 는 부분 pv, 레거시 PB1 은 전체 pv — 둘 다 기본값 위에 얹으면 정확히 복원된다.
    pv: v ? { ...PV_SNAP_DEFAULT, ...v } : undefined,
    name: typeof m.n === 'string' ? m.n : undefined,
  }
}

export async function encodeShareCode(snap: Snapshot): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(buildMin(snap)))
  const deflated = await deflateRaw(bytes)
  if (deflated && deflated.length < bytes.length) return PREFIX_DEFLATE + bytesToB64url(deflated)
  return PREFIX_PLAIN + bytesToB64url(bytes)
}

export async function decodeShareCode(code: string): Promise<Snapshot | null> {
  const c = code.trim()
  try {
    if (c.startsWith(PREFIX_DEFLATE)) {
      const inf = await inflateRaw(b64urlToBytes(c.slice(PREFIX_DEFLATE.length)))
      if (!inf) return null
      return reviveMin(JSON.parse(new TextDecoder().decode(inf)))
    }
    if (c.startsWith(PREFIX_PLAIN)) {
      return reviveMin(JSON.parse(new TextDecoder().decode(b64urlToBytes(c.slice(PREFIX_PLAIN.length)))))
    }
    return null
  } catch { return null }
}

// ── 짧은 공유 코드(PB-xxxxxxxx) ─────────────────────────────────────────────
// 긴 코드는 서버(/api/share → R2 `share/<id>`)에 영구 저장하고 링크엔 짧은 id 만 싣는다. '-' 는 닉네임에 못 쓰는 문자라
// 불러오기 입력칸에서 닉네임과 헷갈리지 않는다. 저장이 실패하면(오프라인·서버 미설정) 긴 코드 링크로 폴백한다.
export const SHORT_CODE_RE = /^PB-[0-9A-Za-z]{8,12}$/

async function shortenShareCode(long: string, image: string | null): Promise<string | null> {
  try {
    const r = await fetch('/api/share', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code: long, ...(image ? { image } : {}) }) })
    if (!r.ok) return null
    const id = (await r.json())?.id
    return typeof id === 'string' && SHORT_CODE_RE.test(id) ? id : null
  } catch { return null }
}

// 짧은 코드 → 긴 코드. CDN(캐시·빠름)을 먼저, 안 되면 API(R2 직접) 폴백.
async function expandShortCode(id: string): Promise<string | null> {
  const tries = [`${DATA_BASE}/share/${id}`, `/api/share?id=${encodeURIComponent(id)}`]
  for (const url of tries) {
    try {
      const r = await fetch(url)
      if (r.ok) { const t = (await r.text()).trim(); if (t.startsWith('PB')) return t }
    } catch { /* 다음 경로 */ }
  }
  return null
}

// 짧은/긴 코드 모두 받아 스냅샷으로.
export async function resolveShareCode(code: string): Promise<Snapshot | null> {
  const c = code.trim()
  if (SHORT_CODE_RE.test(c)) {
    const long = await expandShortCode(c)
    return long ? decodeShareCode(long) : null
  }
  return decodeShareCode(c)
}

// 공유 링크: https://…/?n=<프리셋 이름>&c=<짧은 코드>
//  · 이름(n)은 받는 사람이 어떤 코디인지 링크만 보고 알게 하려는 표시용이다(실제 이름은 코드 안에 있음).
//    공백은 '+', 쿼리를 깨는 문자(& # % + ?)만 인코딩해 한글은 읽히는 그대로 둔다.
//  · c 를 맨 끝에 둔다. 폴백인 긴 코드는 base64url 이라 '-'/'_' 로 끝날 수 있는데, 카톡 링크 파서가 끝의 '_' 를 링크에서
//    떼어내 미리보기 카드가 안 뜬다 → 그럴 땐 끝에 '&e=1' 을 붙여 링크가 영숫자로 끝나게 한다.
export async function buildShareUrl(origin: string, snap: Snapshot): Promise<string> {
  // 코드 인코딩과 미리보기 카드 이미지(프리셋 캐릭터) 렌더를 병렬로. 이미지는 코드와 함께 올려 og:image 가 된다.
  const [long, image] = await Promise.all([encodeShareCode(snap), renderShareImage(snap)])
  const code = (await shortenShareCode(long, image)) || long
  const name = snap.name?.trim()
  const n = name ? `n=${name.replace(/[&#%+?]/g, (ch) => encodeURIComponent(ch)).replace(/\s+/g, '+')}&` : ''
  return `${origin}/?${n}c=${code}${/[-_]$/.test(code) ? '&e=1' : ''}`
}
