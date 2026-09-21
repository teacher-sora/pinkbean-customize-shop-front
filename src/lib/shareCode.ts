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

// 짧은 코드 = sha256(긴 코드) → base62 앞 8자. 서버(/api/share)와 **같은 식**이라 브라우저에서 미리 계산해 즉시 복사할 수 있다.
const B62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'
const ID_SALT = 'c4|' // app/api/share/route.ts 와 동일해야 함
async function shortIdOf(long: string): Promise<string | null> {
  try {
    if (!globalThis.crypto?.subtle) return null
    const h = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ID_SALT + long)))
    let n = BigInt(0)
    for (const x of h) n = (n << BigInt(8)) | BigInt(x)
    let out = ''
    while (n > BigInt(0)) { out = B62[Number(n % BigInt(62))] + out; n /= BigInt(62) }
    return 'PB-' + out.padStart(12, '0').slice(0, 8)
  } catch { return null }
}

// 이 기기에서 만든 짧은 코드 → 긴 코드(2026-09-21). 복사 직후 같은 기기의 불러오기 칸에 붙여 넣으면 서버 저장보다 먼저 올 수 있다
// (사용자 제보: '없는 코디'). 내가 만든 코드는 서버를 거치지 않고 바로 푼다. 최근 30개만 localStorage 에 둔다.
const LOCAL_KEY = 'pb_share_local'
const localCodes = new Map<string, string>()
function rememberLocal(id: string, long: string) {
  localCodes.set(id, long)
  try {
    const m = JSON.parse(localStorage.getItem(LOCAL_KEY) || '{}') as Record<string, string>
    delete m[id]; m[id] = long
    const keys = Object.keys(m); for (const k of keys.slice(0, Math.max(0, keys.length - 30))) delete m[k]
    localStorage.setItem(LOCAL_KEY, JSON.stringify(m))
  } catch { /* 저장 불가 — 메모리만 */ }
}
function localLong(id: string): string | null {
  const hit = localCodes.get(id)
  if (hit) return hit
  try { const v = (JSON.parse(localStorage.getItem(LOCAL_KEY) || '{}') as Record<string, string>)[id]; return typeof v === 'string' ? v : null } catch { return null }
}

// 짧은 코드 → 긴 코드. 이 기기에서 만든 것 → CDN(캐시·빠름) → API(R2 직접). 다른 기기에서 복사 직후 붙여 넣으면 저장이
// 아직 진행 중일 수 있어 API 를 잠깐(최대 ~6초) 다시 본다 — dev 실측: 첫 저장 응답이 콜드 스타트로 ~2초. CDN 은 브라우저 캐시를 거치지 않는다(아직 없던 때의 응답을 굳히지 않게).
async function expandShortCode(id: string): Promise<string | null> {
  const mine = localLong(id)
  if (mine) return mine
  // dev 는 저장 경로가 다르다(`share-dev/`) — api/share · app/share/page.tsx 와 규칙이 같아야 한다.
  const prefix = typeof window !== 'undefined' && /^(www\.)?pinkbean-customize\.com$/.test(location.hostname) ? 'share' : 'share-dev'
  const api = `/api/share?id=${encodeURIComponent(id)}`
  for (const wait of [0, 600, 800, 1000, 1500, 2000]) {
    if (wait) await new Promise((res) => setTimeout(res, wait))
    for (const url of wait ? [api] : [`${DATA_BASE}/${prefix}/${id}`, api]) {
      try {
        const r = await fetch(url, { cache: 'no-store' })
        if (r.ok) { const t = (await r.text()).trim(); if (t.startsWith('PB')) return t }
      } catch { /* 다음 경로 */ }
    }
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

// 공유 링크: https://…/?c=<짧은 코드>&n=<프리셋 이름>
//  · 복사는 즉시: 긴 코드 인코딩 + 짧은 코드 해시(둘 다 로컬, 수 ms)만으로 URL 을 만들어 클립보드에 넣고,
//    카드 이미지 렌더·서버 저장(uploadShare)은 그 뒤 백그라운드로 한다(예전엔 이미지 렌더+업로드를 기다려 복사가 수 초 늦었다).
//  · c 를 **앞에** 둔다. 카카오톡 링크 인식이 한글에서 끊겨(`?n=요시노…` → `/?n=` 까지만 링크) 코드가 빠진 홈 카드가 떴다.
//    n 은 받는 사람이 어떤 코디인지 보게 하는 표시용(실제 이름은 코드 안). 공백은 '+', 쿼리를 깨는 문자(& # % + ?)만 인코딩.
//  · 짧은 코드를 못 만들면(구형 브라우저) 긴 코드. 긴 코드가 '-'/'_' 로 끝나고 뒤에 아무것도 없으면 카톡이 끝 '_' 를 떼므로 '&e=1'.
export type SharePrep = { url: string; long: string; id: string | null }
export async function prepareShare(origin: string, snap: Snapshot): Promise<SharePrep> {
  const long = await encodeShareCode(snap)
  const id = await shortIdOf(long)
  const code = id || long
  if (id) rememberLocal(id, long)
  const name = snap.name?.trim()
  const n = name ? `&n=${name.replace(/[&#%+?]/g, (ch) => encodeURIComponent(ch)).replace(/\s+/g, '+')}` : ''
  const tail = !n && /[-_]$/.test(code) ? '&e=1' : ''
  return { url: `${origin}/?c=${code}${n}${tail}`, long, id }
}

// 백그라운드 저장: 카드 이미지(프리셋 캐릭터)를 그려 긴 코드와 함께 올린다. 서버가 돌려준 id 가 로컬 계산과 다르면
// (해시 충돌로 더 긴 id 발급 — 사실상 없음) 복사된 링크가 틀리므로 false.
// 저장은 두 번이다(2026-09-21). ① 코드만 **곧바로** — 링크·불러오기는 이것만 있으면 된다.
// ② 카드 이미지는 렌더(수백 ms~수 초)가 끝나는 대로 따로 — 서버는 코드가 이미 있으면 이미지만 붙인다(없을 때만 저장).
// 예전엔 ①이 이미지 렌더를 기다려, 복사 직후 붙여 넣으면 '없는 코디'가 떴다. 카톡 카드 쪽은 공유 페이지 메타가 이미지를 최대 5초 기다린다.
async function postShare(long: string, image?: string | null): Promise<string | null | false> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await fetch('/api/share', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code: long, ...(image ? { image } : {}) }) })
      if (r.ok) return (await r.json())?.id ?? null
      if (r.status === 400) return false
    } catch { /* 재시도 */ }
    await new Promise((res) => setTimeout(res, 600 * (attempt + 1)))
  }
  return null
}
export async function uploadShare(prep: SharePrep, snap: Snapshot): Promise<boolean> {
  if (!prep.id) return true // 긴 코드 링크는 저장할 게 없다
  const image = renderShareImage(snap).catch(() => null) // 코드 저장과 동시에 그리기 시작
  const id = await postShare(prep.long)
  if (id !== prep.id) return false
  const img = await image
  if (img) void postShare(prep.long, img)
  return true
}
