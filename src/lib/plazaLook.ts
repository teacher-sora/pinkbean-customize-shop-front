// 대회 '같은 조합' 판정 — 2026-09-21 재설계(사용자 지시: 결과가 같은 색이면 같은 조합, 명백히 다른 느낌이면 다른 조합).
//
// 판정은 두 겹이다.
//  A. 정규화(여기, 순수 함수) — 화면에 보이는 결과가 같은 스냅샷을 같은 모양으로 만든다.
//     · 숨긴 부위 = 착용하지 않은 것(광장 등록 때 아예 지운다 — plazaSnapshot), 염색을 끈 부위 = 염색 없음.
//     · 팔레트(헤어·성형) = 결과 색의 **비율 분포** { 색: 비율 }. A=B 면 한 색 100%, 비율 0 이면 A 100%, 비율 100 이면 B 100%,
//       (A,B,r) 과 (B,A,100−r) 은 같은 분포. 염색하지 않았으면 착용 아이템 자신의 색 100%.
//     · HSB = 색조 0~359 · 채도 · 명도 · 색 계열 t. 셋 다 0 이면 염색 없음(t 무시).
//     · 점 위치 · 연출(액션·표정·이펙트)은 보지 않는다(같은 코디를 점만 옮겨 다시 올리는 걸 막는다).
//  B. 결과 비교
//     · 브라우저(plazaLookPixels.ts): 실제 착용 스프라이트에 게임과 같은 염색 공식(Prism·팔레트 블렌드)을 두 설정으로
//       적용하고 **같은 위치의 픽셀끼리** 색 차이(CIE ΔE)를 잰다. 눈에 띄게 다른 픽셀이 일정 비율 이상일 때만 '다른 부위'.
//       색 계열 t 로 일부 색만 바꾼 경우도, 검은 옷에 색조를 돌려 거의 안 바뀐 경우도 결과대로 판정된다.
//     · DB(supabase/0009): 스프라이트가 없어 픽셀을 못 본다 → **좁은 안전망**만 둔다(paramSame): 정규화가 같고 팔레트 분포 차
//       ≤ 10%, HSB 수치 차 ≤ 2. 이건 픽셀 판정에서도 반드시 '같다'로 나오는 범위라, 브라우저가 통과시킨 등록을 DB 가 잘못
//       막는 일은 없다. 브라우저를 거치지 않은 요청도 이 범위의 복제는 막는다.
// ⚠️ normLook · paramSame 은 supabase/0009 의 plaza_look_norm · plaza_look_param_same 과 **같은 규칙**이어야 한다.

import { colorOf, type HsbParams, type PaletteParams } from './core/dye'

export type LookSnap = {
  equipped?: Record<string, string>; tone?: number
  dyePalette?: Record<string, PaletteParams>; dyeHsb?: Record<string, HsbParams>
  hidden?: Record<string, boolean>; dyeOff?: Record<string, boolean>
}
export type HsbN = { h: number; s: number; b: number; t: number }
export type NormSlot = { id: string; pal?: Record<number, number>; hsb?: HsbN | null }
export type NormLook = { tone: number; skin: HsbN | null; slots: Record<string, NormSlot> }

// 광장에 올리는 스냅샷 — 숨긴 부위는 **없는 아이템**으로 지운다(2026-09-21 사용자 지시).
// 광장(자유·대회 모두)에서만 그렇다: 등록 · 상세의 착용 아이템 · 링크 복사 · 가져오기가 모두 이 스냅샷을 쓴다.
// 프리셋 · 공유 링크 · 코디 화면에서는 여전히 '착용했지만 숨긴' 아이템이다.
// 시선·액션·표정·배율은 **보는 사람의 설정**이지 코디가 아니다 — 광장에 올리지도, 가져올 때 바꾸지도 않는다
// (2026-09-21 사용자 지시). 프리셋에는 그대로 담겨(ShopContext.snapshot) 프리셋을 쓸 때 화면이 되살아난다.
type PvView = { gaze?: string; action?: string; expr?: string; zoom?: number }
const VIEW_KEYS: (keyof PvView)[] = ['gaze', 'action', 'expr', 'zoom']
const dropView = <P extends PvView>(pv: P | undefined): P | undefined => {
  if (!pv || !VIEW_KEYS.some((k) => pv[k] !== undefined)) return pv
  const o = { ...pv }; for (const k of VIEW_KEYS) delete o[k]; return o
}

export function plazaSnapshot<T extends LookSnap & { dotPos?: Record<string, unknown>; pv?: PvView }>(s: T): T {
  const pv = dropView(s.pv)
  const hid = Object.keys(s.hidden || {}).filter((k) => s.hidden![k] && s.equipped?.[k])
  if (!hid.length) return pv === s.pv ? s : { ...s, pv }
  const drop = <V,>(m: Record<string, V> | undefined, keys: string[]) => { if (!m) return m; const o = { ...m }; for (const k of keys) delete o[k]; return o }
  const ids = hid.map((k) => s.equipped![k])
  return {
    ...s,
    ...(pv === s.pv ? {} : { pv }),
    equipped: drop(s.equipped, hid), hidden: drop(s.hidden, hid),
    dyePalette: drop(s.dyePalette, hid), dyeHsb: drop(s.dyeHsb, hid), dyeOff: drop(s.dyeOff, hid),
    ...(s.dotPos ? { dotPos: drop(s.dotPos, ids) } : {}),
  }
}

export const MIX_SLOTS = new Set(['hair', 'face'])
export const PARAM_TOL = { pal: 0.1, h: 2, s: 2, b: 2 } // DB 안전망(좁게)

export function normHsb(h?: HsbParams | null): HsbN | null {
  if (!h) return null
  const hh = ((Math.round(h.h || 0) % 360) + 360) % 360, s = Math.round(h.s || 0), b = Math.round(h.b || 0)
  return hh === 0 && s === 0 && b === 0 ? null : { h: hh, s, b, t: h.t ?? 0 }
}
// 팔레트 → 결과 색 분포. 믹스는 픽셀마다 base→mix 로 ratio% 섞는다(dye.blendPalette).
export function palDist(p: PaletteParams | undefined, own: number): Record<number, number> {
  if (!p) return { [own]: 1 }
  const r = p.mixColor != null && p.mixColor !== p.baseColor ? Math.max(0, Math.min(100, p.ratio ?? 0)) / 100 : 0
  const out: Record<number, number> = {}
  if (1 - r > 0) out[p.baseColor] = (out[p.baseColor] || 0) + (1 - r)
  if (r > 0) out[p.mixColor!] = (out[p.mixColor!] || 0) + r
  return out
}
export const palGap = (a: Record<number, number>, b: Record<number, number>) => {
  let d = 0
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) d += Math.abs((a[+k] || 0) - (b[+k] || 0))
  return d / 2 // 0 = 같은 색, 1 = 완전히 다른 색
}

export function normLook(s: LookSnap): NormLook {
  const slots: Record<string, NormSlot> = {}
  for (const [slot, id] of Object.entries(s.equipped || {})) {
    if (!id || slot === 'skin' || s.hidden?.[slot]) continue
    const off = !!s.dyeOff?.[slot]
    if (MIX_SLOTS.has(slot)) {
      // 헤어·성형도 커스텀 염색(HSB)을 받는다(2026-09-21) → 발색표 색 + 그 위의 HSB 가 함께 조합을 이룬다.
      // ⚠️ HSB 가 없을 땐 **키를 아예 넣지 않는다** — 넣으면 정규화 JSON 모양이 바뀌어 예전에 저장된
      //    look_key 와 달라진다(대회 중복 색인이 어긋난다). 커스텀을 쓴 글만 모양이 늘어난다.
      const h = off ? null : normHsb(s.dyeHsb?.[slot])
      slots[slot] = { id, pal: palDist(off ? undefined : s.dyePalette?.[slot], colorOf(Number(id), slot)), ...(h ? { hsb: h } : {}) }
    } else slots[slot] = { id, hsb: off ? null : normHsb(s.dyeHsb?.[slot]) }
  }
  return { tone: s.tone ?? 0, skin: s.dyeOff?.skin ? null : normHsb(s.dyeHsb?.skin), slots }
}

// 착용 아이템·피부가 같은가(이게 다르면 다른 조합 — 비교 대상 거르기).
export const lookItems = (n: NormLook) =>
  `${n.tone}|${Object.keys(n.slots).sort().map((k) => `${k}:${n.slots[k].id}`).join(',')}`

const hueGap = (a: number, b: number) => { const d = Math.abs(a - b) % 360; return Math.min(d, 360 - d) }
export function hsbParamSame(a: HsbN | null | undefined, b: HsbN | null | undefined): boolean {
  if (!a && !b) return true
  // 한쪽이 염색 없음이면 다른 쪽 수치를 0 과 비교(색 계열 무관 — 수치가 0 에 가까우면 어느 계열이든 거의 그대로).
  if (!a) a = { h: 0, s: 0, b: 0, t: b!.t }
  if (!b) b = { h: 0, s: 0, b: 0, t: a.t }
  return a.t === b.t && hueGap(a.h, b.h) <= PARAM_TOL.h && Math.abs(a.s - b.s) <= PARAM_TOL.s && Math.abs(a.b - b.b) <= PARAM_TOL.b
}
// DB 안전망과 같은 규칙(좁게). 착용이 같다는 전제에서 모든 부위의 염색이 사실상 같은가.
export function paramSame(a: NormLook, b: NormLook): boolean {
  if (lookItems(a) !== lookItems(b)) return false
  if (!hsbParamSame(a.skin, b.skin)) return false
  for (const k of Object.keys(a.slots)) {
    const x = a.slots[k], y = b.slots[k]
    // 헤어·성형은 발색표 색(pal)과 커스텀(hsb)을 **둘 다** 본다. 그 외는 hsb 만.
    if (x.pal && palGap(x.pal, y.pal || {}) > PARAM_TOL.pal) return false
    if (!hsbParamSame(x.hsb, y.hsb)) return false
  }
  return true
}
