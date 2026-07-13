// 정적 카탈로그 데이터 + 공유 타입. (정본 design_handoff 와 동일한 값)
// 데이터 변경/추가는 이 파일만 건드리면 된다. CDN 단계에서 mock 개수/목록이 실제 데이터로 대체됨.

export type Cat = { id: string; label: string }
export type Opt = { v: string; l: string }
export type ActionOpt = { v: string; l: string; anim: boolean }

export type Mix = { a: string; b: string; ratio: number }
export type Hsv = { h: number; s: number; v: number }
export type Preset = { id: string; name: string }
export type Snapshot = {
  equipped: Record<string, boolean>
  dyeMix: Record<string, Mix>
  dyeHsv: Record<string, Hsv>
  hidden: Record<string, boolean>
}
export type Pv = {
  action: string; weapon: string; expr: string; ear: string; form: string; gaze: string
  wEffect: boolean; cEffect: boolean; fps: number; zoom: number
}

// 부위(고정 순서 15): 헤어, 성형, 피부, 모자, 얼굴장식, 눈장식, 귀고리, 한벌옷, 상의, 하의, 신발, 장갑, 망토, 무기, 방패
export const CATS: Cat[] = [
  { id: 'hair', label: '헤어' },
  { id: 'plastic', label: '성형' },
  { id: 'skin', label: '피부' },
  { id: 'cap', label: '모자' },
  { id: 'faceacc', label: '얼굴장식' },
  { id: 'eyeacc', label: '눈장식' },
  { id: 'earring', label: '귀고리' },
  { id: 'overall', label: '한벌옷' },
  { id: 'top', label: '상의' },
  { id: 'bottom', label: '하의' },
  { id: 'shoes', label: '신발' },
  { id: 'gloves', label: '장갑' },
  { id: 'cape', label: '망토' },
  { id: 'weapon', label: '무기' },
  { id: 'shield', label: '방패' },
]

export const PRIMARIES = [
  { id: 'codi', label: '코디' },
  { id: 'info', label: '코디 정보 · 염색' },
  { id: 'preset', label: '프리셋' },
]

// 믹스 염색 8색 팔레트
export const MIX_PALETTE = [
  { name: '검정', hex: '#2f2b27' },
  { name: '빨강', hex: '#e0503f' },
  { name: '주황', hex: '#e8944a' },
  { name: '노랑', hex: '#eccb4e' },
  { name: '초록', hex: '#5fb867' },
  { name: '파랑', hex: '#4f86dd' },
  { name: '보라', hex: '#9463c9' },
  { name: '갈색', hex: '#96704c' },
]

export const PV_ACTIONS: ActionOpt[] = [
  { v: 'stand', l: '서 있기', anim: false },
  { v: 'walk', l: '걷기', anim: true },
  { v: 'sit', l: '앉기', anim: false },
  { v: 'jump', l: '점프', anim: true },
  { v: 'prone', l: '엎드리기', anim: false },
  { v: 'ladder', l: '사다리 오르기', anim: true },
  { v: 'fly', l: '날기', anim: true },
  { v: 'alert', l: '경계', anim: true },
  { v: 'heal', l: '회복', anim: true },
  { v: 'dead', l: '쓰러지기', anim: false },
]
export const PV_WEAPONS: Opt[] = [
  { v: 'none', l: '동작 없음' },
  { v: 'swingO1', l: '스윙 O1' },
  { v: 'swingO2', l: '스윙 O2' },
  { v: 'swingO3', l: '스윙 O3' },
  { v: 'swingP1', l: '스윙 P1' },
  { v: 'swingP2', l: '스윙 P2' },
  { v: 'swingT1', l: '스윙 T1' },
  { v: 'stabO1', l: '찌르기 O1' },
  { v: 'stabO2', l: '찌르기 O2' },
  { v: 'stabT1', l: '찌르기 T1' },
  { v: 'shoot1', l: '슛 1' },
  { v: 'shoot2', l: '슛 2' },
  { v: 'magic1', l: '매직 1' },
  { v: 'magic2', l: '매직 2' },
]
export const PV_EXPRS: Opt[] = [
  { v: 'default', l: '기본' },
  { v: 'smile', l: '미소' },
  { v: 'wink', l: '윙크' },
  { v: 'glare', l: '째려봄' },
  { v: 'cry', l: '슬픔' },
  { v: 'angry', l: '분노' },
  { v: 'surprise', l: '놀람' },
  { v: 'love', l: '하트' },
  { v: 'close', l: '눈 감기' },
  { v: 'vomit', l: '오징어' },
  { v: 'cheer', l: '씩씩' },
  { v: 'despair', l: '근심' },
]
export const PV_EARS: Opt[] = [
  { v: 'default', l: '기본' },
  { v: 'elf', l: '요정 귀' },
  { v: 'sharp', l: '뾰족 귀' },
  { v: 'fold', l: '접힌 귀' },
]
export const PV_FORMS: Opt[] = [
  { v: 'human', l: '기본' },
  { v: 'wolf', l: '늑대' },
  { v: 'cat', l: '고양이' },
  { v: 'ghost', l: '유령' },
  { v: 'mini', l: '미니' },
  { v: 'statue', l: '조각상' },
]
export const PV_GAZES: Opt[] = [
  { v: 'center', l: '정면' },
  { v: 'left', l: '왼쪽' },
  { v: 'right', l: '오른쪽' },
]

export const ITEMS_PER_PAGE = 18
export const ITEM_COUNT = 60 // 플레이스홀더. CDN 단계에서 부위별 실제 개수로 교체.
