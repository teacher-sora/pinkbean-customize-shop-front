// 프리셋(코디) 자체 완결형 공유 코드. 서버 없이 코드 안에 스냅샷 전체가 담겨 붙여넣기만으로 복원된다.
//  - 기본(PB2): JSON → deflate-raw(네이티브 CompressionStream) → base64url. 무압축보다 크게 짧다.
//  - 폴백/레거시(PB1): JSON → base64url. CompressionStream 미지원 브라우저 + 옛 공유 링크 호환.
//  - 코드 안에 아이템 id·톤·염색·숨김·연출설정이 들어가므로 서버 조회가 필요 없다.
//  - 링크는 해시(#c=)가 아니라 쿼리(?c=)에 담는다 — 모바일 카톡 등 일부 링크파서가 '#' 이후를 링크로 인식하지 못해서다.
import type { Snapshot, PvSnap } from '@/components/shop/ShopContext'
import { PV_SNAP_DEFAULT } from '@/components/shop/ShopContext'

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
