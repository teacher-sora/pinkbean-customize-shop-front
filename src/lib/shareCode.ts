// 프리셋(코디) 자체 완결형 공유 코드. 서버 없이 코드 안에 스냅샷 전체가 담겨 붙여넣기만으로 복원된다.
//  - 인코딩: JSON → UTF-8 → base64url, 접두사 PB1 로 식별.
//  - 코드 안에 아이템 id·톤·염색(dyePalette/dyeHsb)·숨김이 모두 들어가므로 서버 조회가 필요 없다.
import type { Snapshot } from '@/components/shop/ShopContext'

const PREFIX = 'PB1'

function b64urlEncode(s: string): string {
  const bytes = new TextEncoder().encode(s)
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
function b64urlDecode(s: string): string {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'))
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

// 코드 길이를 줄이려고 빈 필드는 뺀다(복원 시 기본값으로 채움).
export function encodeShareCode(snap: Snapshot): string {
  const min: Record<string, unknown> = { e: snap.equipped, t: snap.tone }
  if (snap.dyePalette && Object.keys(snap.dyePalette).length) min.p = snap.dyePalette
  if (snap.dyeHsb && Object.keys(snap.dyeHsb).length) min.h = snap.dyeHsb
  if (snap.hidden && Object.keys(snap.hidden).length) min.x = snap.hidden
  if (snap.pv) min.v = snap.pv // 연출설정 일부(형상변이·귀·무기·이펙트·배율)
  return PREFIX + b64urlEncode(JSON.stringify(min))
}

export function decodeShareCode(code: string): Snapshot | null {
  const c = code.trim()
  if (!c.startsWith(PREFIX)) return null
  try {
    const m = JSON.parse(b64urlDecode(c.slice(PREFIX.length))) as Record<string, unknown>
    if (!m || typeof m !== 'object' || typeof m.e !== 'object') return null
    return {
      equipped: (m.e as Snapshot['equipped']) || {},
      tone: typeof m.t === 'number' ? m.t : 0,
      dyePalette: (m.p as Snapshot['dyePalette']) || {},
      dyeHsb: (m.h as Snapshot['dyeHsb']) || {},
      hidden: (m.x as Snapshot['hidden']) || {},
      pv: (m.v as Snapshot['pv']) || undefined, // 구버전 코드엔 없음 → 기본값으로 복원
    }
  } catch {
    return null
  }
}
