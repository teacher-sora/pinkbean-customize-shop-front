// 코디 실제 데이터 연동 헬퍼: 디자인 카테고리 ↔ 실제 slot 매핑, 액션 해석, 애니메이션 프레임 선택,
// 미리보기 고정 박스. 코어(src/lib/core)의 assemble/render/data 위에서 동작한다.

import type { ViewOpts } from '@/lib/core/assemble'
import type { ListItem } from '@/lib/core/data'

// 시각적 중복 폴딩(HANDOFF.md / 프로토타입 규칙):
//  - 헤어/성형(colorGroup 있음): 그룹당 1개, 대표 = 그룹 내 최저 id(= 검정 color 0). 나머지 색은
//    CDN에서 안 받고, 웹의 "염색" 기능이 유저 설정으로 색을 계산한다.
//  - 장비(colorGroup 없음): 이름당 1개(남/여·재출시 동명·동일외형 중복 제거), 대표 = 최저 id.
export function foldList(l: ListItem[]): ListItem[] {
  if (!l.length) return l
  const hasColor = l[0].colorGroup != null
  const keyOf = (it: ListItem) => (hasColor ? `g${it.colorGroup}` : `n${it.name ?? it.id}`)
  const rep = new Map<string, ListItem>()
  for (const it of l) {
    const k = keyOf(it); const cur = rep.get(k)
    if (!cur) { rep.set(k, it); continue }
    if (parseInt(it.id, 10) < parseInt(cur.id, 10)) rep.set(k, it)
  }
  const seen = new Set<string>(); const out: ListItem[] = []
  for (const it of l) {
    const k = keyOf(it); if (seen.has(k)) continue
    if (it.id !== rep.get(k)!.id) continue // 대표 위치에서만 출력 → 최저 id 기준 정렬 유지
    seen.add(k); out.push(rep.get(k)!)
  }
  return out
}

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

// 초기 진입 시 기본 착용(빈 모델 방지). 슬롯 리스트를 미로드해도 되도록 최소 ListItem 으로 하드코딩.
// 헤어/성형은 검정 대표(color 0) id. 실제 부위 리스트를 열면 folded 대표와 id가 일치해 선택 표시됨.
export const DEFAULT_TONE = 12 // 엘프 피부
export const DEFAULT_EQUIP: Record<string, ListItem> = {
  hair: { id: '00071400', slot: 'hair', isCash: false, grade: 'none', islot: null, vslot: null, dyeMode: 'palette', colorGroup: 7140, color: 0, name: '녹셀 헤어 (여)', actions: [] },
  face: { id: '00022060', slot: 'face', isCash: false, grade: 'none', islot: null, vslot: null, dyeMode: 'palette', colorGroup: 2260, name: '운명의 인도자 얼굴', actions: [] },
  longcoat: { id: '01051917', slot: 'longcoat', isCash: true, grade: 'cash', islot: 'MaPn', vslot: null, dyeMode: 'none', name: '금단의 계약 (여)', actions: [] },
}

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
