// 코디 실제 데이터 연동 헬퍼: 디자인 카테고리 ↔ 실제 slot 매핑, 액션 해석, 애니메이션 프레임 선택,
// 미리보기 고정 박스. 코어(src/lib/core)의 assemble/render/data 위에서 동작한다.

import type { AssembleInput, ViewOpts } from '@/lib/core/assemble'
import type { AnimaRace, ListItem } from '@/lib/core/data'

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
  riding: 'riding', // [dev]
}
export const SLOT_TO_CAT: Record<string, string> = Object.fromEntries(
  Object.entries(CAT_TO_SLOT).map(([c, s]) => [s, c]),
)
// 실제 착용 슬롯(합성 대상). skin 은 톤이라 별도.
export const EQUIP_SLOTS = [
  'hair', 'face', 'cap', 'faceAcc', 'eyeAcc', 'earring',
  'coat', 'longcoat', 'pants', 'shoes', 'glove', 'cape', 'weapon', 'shield',
  'riding', // [dev] 탑승 — 마운트/모프 레이어를 코디처럼 합성
] as const

// 모델 렌더 배치 상수(computeModelPlacement 에 전달). 캔버스는 div×margin(>1)로 div보다 크게 잡아
// 스프라이트는 div overflow 로만 잘린다. 모델(마네킹) 높이 = fraction × divH 로 장비·카드크기 무관 일정.
// 우측 미리보기 배율(연출 설정 1x/2x/3x)은 fraction 에 곱하는 "월드 배율"(예전 CSS transform 방식 대체).
export const ZOOM_WORLD: Record<number, number> = { 1: 0.7, 2: 1.0, 3: 1.4 }
export const PREVIEW_FRACTION = 0.25 // 우측 미리보기 기준 마네킹 높이 비율(× ZOOM_WORLD; 기본 2x=×1.0 → 실효 0.25)
// 모바일은 미리보기 영역이 "낮고 넓다"(세로 스택). PC와 같은 0.25 를 쓰면 200px 높이의 25% = 50px 로
// 모델이 콩알만 해진다 — 세로가 부족한 만큼 비율을 올려 남는 가로 여백을 모델에 쓴다.
export const PREVIEW_FRACTION_MOBILE = 0.5
export const PREVIEW_MARGIN = 1.5    // 우측 미리보기 캔버스 여백 배수
export const CARD_FRACTION = 0.45     // 리스트 카드 마네킹 높이 비율(넉넉한 전체샷; 정수 스냅으로 항상 선명)
export const CARD_MARGIN = 1.4        // 리스트 카드 캔버스 여백 배수

// 리스트 셀 합성 썸네일용 고정 정지 뷰(모델/내모델 모드). 정적이라 셀마다 애니메이션 없음.
export const THUMB_VIEW: ViewOpts = { action: 'stand1', expression: 'default', ear: 'humanEar', weaponMotion: 'basic' }

// 썸네일에도 현재 시선(gaze)을 반영: 뒷쪽=rope(뒷모습), 오른쪽=좌우반전(flip). 액션/표정은 카드 고정(THUMB_VIEW).
// expr/ear/weapon 을 주면 연출설정의 표정·귀·무기모션도 카드에 반영한다(안 주면 THUMB_VIEW 기본값).
export function thumbView(gaze: string, expr?: string, ear?: string, weapon?: string): { view: ViewOpts; flip: boolean } {
  return {
    view: { ...THUMB_VIEW, action: gaze === 'back' ? 'rope' : 'stand1', expression: expr || THUMB_VIEW.expression, ear: ear || THUMB_VIEW.ear, weaponMotion: weapon || THUMB_VIEW.weaponMotion },
    flip: gaze === 'right',
  }
}

/* ── 표정 얼굴장식(info.fixedEmotion) ────────────────────────────────────────
 * `01012877`~`01012901` 25종. 이 아이템들은 **자기 그림이 없다** — 원본 WZ 의 스프라이트가
 * 1×1 완전 투명이고, 표정별 노드는 전부 그 빈 canvas 로의 UOL 링크다(25개 전수 확인).
 * 하는 일은 `info/fixedEmotion` 하나뿐: 착용하면 캐릭터 표정이 그 값으로 **고정**된다.
 * 값은 'smile' 같은 표정 키이거나 'blink/1'(감은눈)·'blink/2'(게슴츠레)처럼 키+프레임 인덱스이며,
 * 파서가 그 프레임을 같은 이름의 메타 키로 뽑아두므로 표정 키로 그대로 쓰면 된다.
 *
 * ⚠️ 연출 설정(pv.expr)은 **절대 바꾸지 않는다.** 사용자가 고른 값은 그대로 두고, 렌더 직전에만 덮어쓴다
 *    → 아이템을 벗으면 원래 고르던 표정으로 저절로 돌아온다(상태 오염 없음).
 */
export const hasFixedExpr = (it?: ListItem | null): boolean => !!it?.fixedEmotion

// 착용 목록에서 표정 고정 아이템을 찾아 표정을 결정한다. 없으면 fallback(=pv.expr / 'default').
// faceAcc 슬롯만 fixedEmotion 을 가지지만, 슬롯을 가정하지 않고 훑는다(카드 미리보기처럼
// "후보 아이템 + 현재 착용"이 섞인 목록도 같은 함수로 처리하기 위함).
export function fixedExpr(items: readonly (ListItem | null | undefined)[], fallback: string): string {
  for (const it of items) if (it?.fixedEmotion) return it.fixedEmotion
  return fallback
}

// 표정 고정 아이템은 **베이스 모델('model')에 올려도 아무것도 안 보인다** — 아이템 그림이 투명이고,
// 베이스 마네킹에는 바뀔 성형(얼굴)이 없기 때문이다. 그래서 '모델' 모드는 **'내 모델'로 승격**한다
// (사용자의 성형이 있어야 표정 변화가 보인다). '내 모델'/'썸네일'은 그대로 둔다.
// (호출부: CodiScreen / SearchScreen 의 effMode. ListMode 는 컴포넌트 쪽 타입이라 여기서 import 하지 않는다.)
export const forceMyModel = (mode: string, it: ListItem): boolean => mode === 'model' && hasFixedExpr(it)

// "컬러라인" 커스텀 피부(커스텀 뽀송/홍조 라벤더 컬러라인)만 염색 가능. 피부 부분은 무채색이고 라인만 채도색
// 이라, 표준 HSB 를 통째로 적용해도 시각적으로 라인만 변한다(실제 메이플 방식과 동일 — 마스크 불필요). 이름 식별.
export const isColorLineSkin = (name?: string): boolean => !!name && name.includes('컬러라인')

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
    // 뒷쪽 = 밧줄(rope) "첫 프레임 정지"(뒷모습). 애니메이션 액션이어도 뒷쪽이면 정지.
    isStatic: pv.action === 'basic' || pv.gaze === 'back',
    flip: pv.gaze === 'right', // 오른쪽 = 좌우 반전(스프라이트 기본은 왼쪽 향)
    baseAction: pv.action,
  }
}

// 렌(node 3/4)은 노드 하나에 Ear·HeadAcc 파츠가 **둘 다** 들어있지만, 게임에서는 '귀'와 '머리장식'이
// **양자택일 폼**이다 → 동시에 그리면 안 된다. (귀를 골랐는데 머리장식까지 같이 나오던 버그)
// 호영(1: 꼬리+귀)·라라(2: 뿔+뿔뒤)는 파츠가 한 벌로 함께 렌더되므로 필터하지 않는다.
const REN_NODES = new Set(['3', '4'])

// 형상변이(anima) 선택 → anima.json 노드/파츠 스펙. 'none'=변이 없음.
export function animaSpec(form: string): { node: string; parts: string[] | null } | null {
  if (!form || form === 'none') return null
  const [node, sub] = form.split(':')
  if (REN_NODES.has(node)) return { node, parts: sub === 'acc' ? ['HeadAcc'] : ['Ear'] }
  return { node, parts: null }
}

// 형상변이 정적 파츠 → 조립 입력(공용: 미리보기·리스트 카드 동일). races 는 loadAnima() 결과.
export function animaLayers(form: string, races: AnimaRace[]): AssembleInput[] {
  const aspec = animaSpec(form)
  if (!aspec) return []
  const race = races.find((r) => r.node === aspec.node)
  if (!race) return []
  const parts = race.parts.filter((p) => !aspec.parts || aspec.parts.includes(p.name))
  return parts.length ? [{ itemId: 'anima', slot: 'anima', vslot: null, layers: parts.map((p) => ({ name: p.name, png: p.png, z: p.z, origin: p.origin, map: p.map })) }] : []
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
