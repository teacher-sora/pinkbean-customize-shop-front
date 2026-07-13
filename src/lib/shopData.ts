// 코디 실제 데이터 연동 헬퍼: 디자인 카테고리 ↔ 실제 slot 매핑, 액션 해석, 애니메이션 프레임 선택,
// 미리보기 고정 박스. 코어(src/lib/core)의 assemble/render/data 위에서 동작한다.

import type { ViewOpts } from '@/lib/core/assemble'

// 디자인 부위 id → 실제 WZ slot (prototype SLOT_ORDER). skin 은 특수(톤).
export const CAT_TO_SLOT: Record<string, string> = {
  hair: 'hair', plastic: 'face', skin: 'skin', cap: 'cap', faceacc: 'faceAcc',
  eyeacc: 'eyeAcc', earring: 'earring', overall: 'longcoat', top: 'coat', bottom: 'pants',
  shoes: 'shoes', gloves: 'glove', cape: 'cape', weapon: 'weapon', shield: 'shield',
}
export const SLOT_TO_CAT: Record<string, string> = Object.fromEntries(
  Object.entries(CAT_TO_SLOT).map(([c, s]) => [s, c]),
)
// 실제 착용 슬롯(합성 대상). skin 은 톤이라 별도.
export const EQUIP_SLOTS = [
  'hair', 'face', 'cap', 'faceAcc', 'eyeAcc', 'earring',
  'coat', 'longcoat', 'pants', 'shoes', 'glove', 'cape', 'weapon', 'shield',
] as const

// 미리보기 고정 월드 박스 + navel 고정 좌표(= 액션이 바뀌어도 몸이 중앙에 고정).
export const MAIN_BOX = { w: 160, h: 190 }
export const MAIN_ANCHOR = { x: 80, y: 128 }

// 이동/자세 액션(핑퐁 재생 대상).
export const MOVE_POSTURE_ACTIONS = new Set(['basic', 'stand', 'walk', 'alert', 'proneStab', 'sit', 'jump', 'fly', 'ladder', 'rope'])

// 액션 카테고리 + 무기모션 → 실제 base body 프레임 키.
export function resolveAction(a: string, w: string): string {
  const two = w === 'two'
  switch (a) {
    case 'basic': return two ? 'stand2' : 'stand1' // 기본 = 서기 프레임(단, 애니메이션 정지)
    case 'stand': return two ? 'stand2' : 'stand1'
    case 'walk': return two ? 'walk2' : 'walk1'
    default: return a
  }
}

// pv → ViewOpts. gaze==='back' 이면 rope(뒷모습). flip 은 별도(왼/오).
export function buildView(pv: { action: string; weapon: string; expr: string; ear: string; gaze: string }): {
  view: ViewOpts; isStatic: boolean; flip: boolean; baseAction: string
} {
  const effectiveAction = pv.gaze === 'back' ? 'rope' : resolveAction(pv.action, pv.weapon)
  return {
    view: { action: effectiveAction, expression: pv.expr, ear: pv.ear, weaponMotion: pv.weapon },
    isStatic: pv.action === 'basic',
    flip: pv.gaze === 'right', // 오른쪽 = 좌우 반전(스프라이트 기본은 왼쪽 향)
    baseAction: pv.action,
  }
}

// 프레임 타이밍(looping): elapsed(ms) → 프레임 인덱스.
export function frameAtElapsed(delays: number[], elapsed: number): number {
  if (!delays || delays.length <= 1) return 0
  const ds = delays.map((d) => Math.max(20, d || 120))
  const total = ds.reduce((a, b) => a + b, 0)
  let t = ((elapsed % total) + total) % total
  for (let i = 0; i < ds.length; i++) { t -= ds[i]; if (t < 0) return i }
  return ds.length - 1
}
// 핑퐁(무한 왕복): 0→1→…→N-1→N-2→…→1→0 (이동/자세 액션).
export function frameAtElapsedAlt(delays: number[], elapsed: number): number {
  const N = delays?.length ?? 0
  if (N <= 1) return 0
  const ds = delays.map((d) => Math.max(20, d || 120))
  const seq: number[] = []
  for (let i = 0; i < N; i++) seq.push(i)
  for (let i = N - 2; i >= 1; i--) seq.push(i)
  const total = seq.reduce((a, i) => a + ds[i], 0)
  let t = ((elapsed % total) + total) % total
  for (const i of seq) { t -= ds[i]; if (t < 0) return i }
  return 0
}
