// 정적 카탈로그 데이터 + 공유 타입.
// 연출 옵션(액션·무기모션·표정·귀·형상변이)은
// 게임의 실제 데이터에 맞춘 값이다(아래 각 항목 주석의 소스 표기 참고).

export type Cat = { id: string; label: string }
export type Opt = { v: string; l: string }

export type Preset = { id: string; name: string }
export type Pv = {
  action: string; weapon: string; expr: string; ear: string; form: string; gaze: string
  frame: number // 액션을 멈출 프레임(그 액션의 몇 번째 자세, 0부터). -1 = 재생(사용자 건의 — 서기의 세 번째 자세로 멈추기 등)
  wEffect: boolean; cEffect: boolean; capEffect: boolean; floatFx: boolean; baseTag: boolean; fps: number; zoom: number
}

// dev 사이트(dev 브랜치 배포 · 로컬)인가 — 빌드 때 정해진다(next.config 의 NEXT_PUBLIC_SITE_ENV = Vercel 의 VERCEL_ENV). 운영 빌드만 'production'.
// 왜: 핫픽스마다 dev 를 곧바로 main 에 병합하므로(CLAUDE.md), 운영에 아직 내지 않을 부위는 dev 에 두되 운영 빌드에서는 빠져야 한다.
export const DEV_SITE = process.env.NEXT_PUBLIC_SITE_ENV !== 'production'
// dev 사이트에서만 보이는 부위 — 운영에 낼 때 여기서 뺀다
const DEV_ONLY_CATS = new Set<string>(['pet', 'android', 'soul'])
// 운영 반영 요청이 와도 운영에 내지 않는 부위 — 사용자가 이 부위를 운영에 내라고 따로 말할 때만 뺀다(사용자 지시 2026-11-12: 의자는 고칠 것이 많다.
// 다른 dev 전용 부위를 운영에 낼 때 의자를 함께 빼지 않도록 표를 나눴다 — 그 요청에 의자 언급이 없어도 의자는 남긴다)
const DEV_HOLD_CATS = new Set<string>(['chair'])

// 부위(고정 순서 22): 헤어, 성형, 피부, 모자, 얼굴장식, 눈장식, 귀고리, 한벌옷, 상의, 하의, 신발, 장갑, 망토, 무기, 방패, 펫, 안드로이드, 반지, 이펙트, 소울, 라이딩, 의자
// (명찰 / 말풍선 · 칭호 · 훈장은 반지 바로 뒤에 끼운다 — ShopContext withChat)
const ALL_CATS: Cat[] = [
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
  { id: 'pet', label: '펫' }, // 펫 — 캐릭터 옆에 서는 펫의 서기 애니메이션(이펙트로 그린다 — 자리는 render.PET_DX), 염색 불가, AI검색 제외
  { id: 'android', label: '안드로이드' }, // 안드로이드 — 그림이 없는 두 번째 캐릭터(외형 = 피부 · 헤어 · 성형 · 옷)를 캐릭터 옆에 세운다(core/android), 염색 불가, AI검색 제외
  { id: 'ring', label: '일루전링' }, // 일루전 링(변신 · 거대한 머리 · 거대한 몸) — 명찰 · 말풍선 반지는 따로(CHAT_CATS). 염색 불가
  { id: 'effect', label: '이펙트' }, // 캐시 이펙트(내가 바로 스타 등) — 장비와 따로 켜는 꾸밈. 레이어 없이 이펙트만 그린다, 염색 불가
  { id: 'soul', label: '소울' }, // 소울 — 무기에 부여한 소울이 캐릭터 뒤에 띄우는 문장 이펙트(블루 아카이브 소울 스킨). 레이어 없이 이펙트만 그린다, 염색 불가, AI검색 제외
  { id: 'riding', label: '라이딩' }, // 탑승(재규어/메탈아머) — 정적 코디 아이템, AI검색 제외
  { id: 'chair', label: '의자' }, // 의자(블루 아카이브 의자만 — 사용자 지시) — 끼면 캐릭터가 앉고 의자 그림(이펙트)이 발밑에 붙는다. 라이딩과 함께 끼지 않는다, 염색 불가, AI검색 제외
]
export const CATS: Cat[] = ALL_CATS.filter((c) => DEV_SITE || !(DEV_ONLY_CATS.has(c.id) || DEV_HOLD_CATS.has(c.id)))

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

// 성형(눈) 전용 표기 — 발색 로직/색변형 인덱스는 동일하고 "표시되는 색 이름/색상"만 인게임 눈 색 순서로.
// 순서: 검정·파랑·빨강·초록·갈색·에메랄드·보라·자수정 (MIX_PALETTE 와 길이 동일 = 8).
export const FACE_PALETTE = [
  { name: '검정', hex: '#2f2b27' },
  { name: '파랑', hex: '#4f86dd' },
  { name: '빨강', hex: '#e0503f' },
  { name: '초록', hex: '#5fb867' },
  { name: '갈색', hex: '#96704c' },
  { name: '에메랄드', hex: '#1fb39a' },
  { name: '보라', hex: '#9463c9' },
  { name: '자수정', hex: '#d488ce' },
]

// 슬롯별 발색 표기 팔레트: 성형=FACE_PALETTE, 그 외(헤어)=MIX_PALETTE.
export const paletteFor = (slot?: string | null) => (slot === 'face' ? FACE_PALETTE : MIX_PALETTE)

/* ── 연출 설정 옵션 (실제 데이터 기준) ─────────────────────────────────────────
 * 소스 구분:
 *  - 액션/무기모션/표정/귀 = Character.wz 고유 열거형. 정적 상수.
 *  - 형상변이 = CDN anima.json(node 1~4)에서 유도된 결과. 여기 목록은 정적 상수다.
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

// 표정 — 이름은 **표정 얼굴장식 25종의 아이템 이름 그대로** 쓴다.
// 임의로 지은 이름(미소/화남/멍함…)은 아이템과 짝이 맞지 않는다. '게슴츠레'(blink/2)·'감은눈'(blink/1)도 넣고,
// 데이터에 없는 키(cheer·pers·wound·hate·rage·sad)는 넣지 않는다 — 골라도 기본 표정이 나온다.
// 근거(실측): 성형 메타의 표정 프레임 키는 아래 27종이 표준이다(성형 40종 중 39종이 정확히 일치).
//   각 이름은 그 표정을 고정하는 얼굴장식(info.fixedEmotion)에서 가져왔다. 'blink'(눈깜빡)만 짝이 되는 아이템이 없다.
// ⚠️ 순서는 **가나다순**이고 '기본'이 맨 위다(빠르게 찾으려고). 아래 sort 가 그 규칙을 지킨다.
// ⚠️ '눈깜빡'(blink)은 **넣지 않는다**(골라도 아무 변화가 없다). blink 는 눈을 감았다 뜨는
//    **애니메이션**이고 우리가 쓰는 건 그 **첫 프레임(눈 뜬 얼굴)** 이라 '기본'과 그림이 같다. 실측: 성형 60종을
//    고르게 뽑아 `default` 와 `blink` 의 png 를 해시 대조 — 60/60 완전히 같았다. 감은 얼굴은 `blink/1`(감은눈),
//    반쯤 감은 얼굴은 `blink/2`(게슴츠레)로 이미 목록에 있다.
const EXPRS_NAMED: Opt[] = [
  { v: 'blink/1', l: '감은눈' }, { v: 'blink/2', l: '게슴츠레' }, { v: 'stunned', l: '곤란' },
  { v: 'cheers', l: '꺄오' }, { v: 'bowing', l: '꾸벅꾸벅' }, { v: 'troubled', l: '난처' },
  { v: 'pain', l: '눈물찍' }, { v: 'bewildered', l: '당황' },
  { v: 'dam', l: '메롱' }, { v: 'shine', l: '반짝반짝' }, { v: 'angry', l: '분노' },
  { v: 'chu', l: '뽀뽀' }, { v: 'love', l: '뿅' }, { v: 'hot', l: '앗뜨거' },
  { v: 'vomit', l: '울렁울렁' }, { v: 'cry', l: '울음' }, { v: 'smile', l: '웃음' },
  { v: 'wink', l: '윙크' }, { v: 'qBlue', l: '창백' }, { v: 'glitter', l: '초롱초롱' },
  { v: 'hit', l: '피격' }, { v: 'oops', l: '허걱허걱' }, { v: 'blaze', l: '활활' },
  { v: 'despair', l: '후하후하' }, { v: 'hum', l: '흐음' },
]
export const PV_EXPRS: Opt[] = [
  { v: 'default', l: '기본' },
  ...[...EXPRS_NAMED].sort((a, b) => a.l.localeCompare(b.l, 'ko')),
]

// 표정 → 그 표정을 고정하는 얼굴장식 아이템 id(01012877~01012901 25종).
// 연출 설정에서 표정을 **아이콘으로 고르기** 위한 것이다 — 아이템 그림은 투명이지만(shopData 의 표정 얼굴장식 주석)
// **아이콘은 표정마다 다른 얼굴 그림**이라 그대로 쓸 수 있다(25개 아이콘 해시 전수 대조: 모두 다름).
// '기본'과 '눈깜빡'은 짝이 되는 아이템이 없어 빠져 있다(그 두 칸은 이름만 보여 준다).
export const PV_EXPR_ICONS: Record<string, string> = {
  'blink/1': '01012899', 'blink/2': '01012900', stunned: '01012882', cheers: '01012885', bowing: '01012895',
  troubled: '01012878', pain: '01012888', bewildered: '01012881', dam: '01012897', shine: '01012891',
  angry: '01012880', chu: '01012886', love: '01012892', hot: '01012896', vomit: '01012883',
  cry: '01012879', smile: '01012877', wink: '01012887', qBlue: '01012898', glitter: '01012889',
  hit: '01012901', oops: '01012884', blaze: '01012890', despair: '01012893', hum: '01012894',
}

// 귀 = Character.wz 4종. 키: humanEar/ear/lefEar/highlefEar.
export const PV_EARS: Opt[] = [
  { v: 'humanEar', l: '기본' },
  { v: 'ear', l: '엘프' },
  { v: 'lefEar', l: '우든 레프' },
  { v: 'highlefEar', l: '하이 레프' },
]

// 형상변이 = CDN anima.json(node 1~4) 유도 결과. 'none'=변이 없음(기본).
// node3/4(렌)만 귀 · 머리장식 2종으로 분기 — 게임에서 둘은 **양자택일**이라 각각 Ear/HeadAcc 만 그린다(animaSpec).
// key 는 anima node 스킴을 그대로 유지해 CDN 연동을 쉽게.
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

// 염색 색상 계열(Prism type 0~6). 인덱스 = HsbParams.t.
// 넥슨 API 의 cash_item_coloring_prism.color_range 가 이 문자열과 동일하게 온다 → 그대로 indexOf 로 매핑한다.
export const DYE_FAMILIES = ['전체 색상 계열', '빨간 색상 계열', '노란 색상 계열', '초록 색상 계열', '청록 색상 계열', '파란 색상 계열', '자주 색상 계열']
