// 정적 카탈로그 데이터 + 공유 타입.
// 부위/팔레트/상수는 디자인 정본 값. 연출 옵션(액션·무기모션·표정·귀·형상변이)은
// maple test 프로토타입의 "실제 데이터"에 맞춘 값이다(아래 각 항목 주석의 소스 표기 참고).

export type Cat = { id: string; label: string }
export type Opt = { v: string; l: string }

export type Preset = { id: string; name: string }
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

/* ── 연출 설정 옵션 (실제 데이터 기준) ─────────────────────────────────────────
 * 소스 구분:
 *  - 액션/무기모션/표정/귀 = Character.wz 고유 열거형(프로토타입 web/app/page.tsx). 정적 상수 재활용.
 *  - 형상변이 = CDN anima.json(node 1~4)에서 유도된 결과. 지금은 정적, CDN 단계에서 loadAnima()로 대체.
 */

// 무기 모션 = 캐시가 제공하는 4종. 근접 자세(stand1↔stand2)와 스윙/찌르기의 O(한손)/T(두손) 변형을 결정.
export const PV_WEAPONS: Opt[] = [
  { v: 'basic', l: '기본' },
  { v: 'one', l: '한손' },
  { v: 'two', l: '두손' },
  { v: 'gun', l: '건' },
]

// 액션 = WZ 프레임 키 그대로, 3그룹 분류(이동/자세 · 근접 공격 · 사격).
export const PV_ACTION_GROUPS: { group: string; items: Opt[] }[] = [
  {
    group: '이동/자세',
    items: [
      { v: 'basic', l: '기본' }, { v: 'stand', l: '서기' }, { v: 'walk', l: '걷기' },
      { v: 'alert', l: '전투 대기' }, { v: 'proneStab', l: '엎드리기' }, { v: 'sit', l: '앉기' },
      { v: 'jump', l: '점프' }, { v: 'fly', l: '날기' }, { v: 'ladder', l: '사다리' }, { v: 'rope', l: '밧줄' },
    ],
  },
  {
    group: '근접 공격',
    items: [
      { v: 'swingO1', l: '한손 스윙1' }, { v: 'swingO2', l: '한손 스윙2' }, { v: 'swingO3', l: '한손 스윙3' }, { v: 'swingOF', l: '한손 스윙(마무리)' },
      { v: 'swingT1', l: '두손 스윙1' }, { v: 'swingT2', l: '두손 스윙2' }, { v: 'swingT3', l: '두손 스윙3' }, { v: 'swingTF', l: '두손 스윙(마무리)' },
      { v: 'swingP1', l: '폴암 스윙1' }, { v: 'swingP2', l: '폴암 스윙2' }, { v: 'swingPF', l: '폴암 스윙(마무리)' },
      { v: 'stabO1', l: '한손 찌르기1' }, { v: 'stabO2', l: '한손 찌르기2' }, { v: 'stabOF', l: '한손 찌르기(마무리)' },
      { v: 'stabT1', l: '두손 찌르기1' }, { v: 'stabT2', l: '두손 찌르기2' }, { v: 'stabTF', l: '두손 찌르기(마무리)' },
    ],
  },
  {
    group: '사격',
    items: [
      { v: 'shoot1', l: '활 사격' }, { v: 'shoot2', l: '석궁 사격' }, { v: 'shoot6', l: '총 사격' }, { v: 'shootF', l: '사격(마무리)' },
    ],
  },
]
export const PV_ACTIONS_FLAT: Opt[] = PV_ACTION_GROUPS.flatMap((g) => g.items)
// 'basic'(기본)만 정지 프레임 — 나머지는 애니메이션(fps 슬라이더 노출 대상).
export const isAnimatedAction = (v: string) => v !== 'basic'

// 표정 = Face.wz 표정 키 전수(30종).
export const PV_EXPRS: Opt[] = [
  { v: 'default', l: '기본' }, { v: 'blink', l: '눈깜빡' }, { v: 'hit', l: '피격' }, { v: 'wink', l: '윙크' },
  { v: 'glitter', l: '초롱초롱' }, { v: 'smile', l: '미소' }, { v: 'troubled', l: '난처' }, { v: 'cry', l: '울음' },
  { v: 'angry', l: '화남' }, { v: 'bewildered', l: '당황' }, { v: 'stunned', l: '멍함' }, { v: 'vomit', l: '구역질' },
  { v: 'oops', l: '앗차' }, { v: 'cheers', l: '건배' }, { v: 'cheer', l: '환호' }, { v: 'chu', l: '뽀뽀' },
  { v: 'pain', l: '고통' }, { v: 'despair', l: '절망' }, { v: 'love', l: '하트' }, { v: 'shine', l: '반짝' },
  { v: 'blaze', l: '이글이글' }, { v: 'hum', l: '흥얼' }, { v: 'bowing', l: '인사' }, { v: 'hot', l: '더위' },
  { v: 'dam', l: '피해' }, { v: 'qBlue', l: '우울' }, { v: 'pers', l: '집중' }, { v: 'wound', l: '상처' },
  { v: 'hate', l: '싫음' }, { v: 'rage', l: '분노' }, { v: 'sad', l: '슬픔' },
]

// 귀 = Character.wz 4종. 키: humanEar/ear/lefEar/highlefEar.
export const PV_EARS: Opt[] = [
  { v: 'humanEar', l: '기본' },
  { v: 'ear', l: '엘프' },
  { v: 'lefEar', l: '우든 레프' },
  { v: 'highlefEar', l: '하이 레프' },
]

// 형상변이 = CDN anima.json(node 1~4) 유도 결과. 'none'=변이 없음(기본).
// node3/4(렌)만 귀 · 머리장식(HeadAcc만) 2종으로 분기. key 는 anima node 스킴을 그대로 유지해 CDN 연동을 쉽게.
// ⚠️ CDN 단계에서 loadAnima() 결과로 대체 예정.
export const PV_FORMS: Opt[] = [
  { v: 'none', l: '기본' },
  { v: '1', l: '호영' },
  { v: '2', l: '라라' },
  { v: '3', l: '렌 (여, 귀)' },
  { v: '3:acc', l: '렌 (여, 머리장식)' },
  { v: '4', l: '렌 (남, 귀)' },
  { v: '4:acc', l: '렌 (남, 머리장식)' },
]

// 시선(캐릭터 향) = 왼쪽 · 오른쪽 · 뒷쪽 3종. 메이플 아바타는 측면 프로필이라 '정면'은 없다.
//  - 왼쪽/오른쪽 = 좌우 방향(플립).
//  - 뒷쪽 = 줄타기(rope) 액션의 "첫 프레임"으로 고정(정지)해서 보여주는 뒷모습.
//    ⚠️ CDN/캔버스 합성 단계 구현 규칙: gaze==='back' 이면 action=rope · frame=0 · 애니메이션 정지로 렌더.
export const PV_GAZES: Opt[] = [
  { v: 'left', l: '왼쪽' },
  { v: 'right', l: '오른쪽' },
  { v: 'back', l: '뒷쪽' },
]

export const ITEMS_PER_PAGE = 18
export const ITEM_COUNT = 60 // 플레이스홀더. CDN 단계에서 부위별 실제 개수로 교체.
