// 코디 실제 데이터 연동 헬퍼: 디자인 카테고리 ↔ 실제 slot 매핑, 액션 해석, 애니메이션 프레임 선택,
// 미리보기 고정 박스. 코어(src/lib/core)의 assemble/render/data 위에서 동작한다.

import type { AssembleInput, ViewOpts } from '@/lib/core/assemble'
import { BASE_TAG, type ChatDraw, type ChatEmo, type ChatUi } from '@/lib/core/chatUi'
import { CASHFX_FILE, RING_FILE, type AnimaRace, type ItemMeta, type ListItem, type SlotSummary } from '@/lib/core/data'
import type { Cat } from '@/lib/catalog'

// 시각적 중복 폴딩:
//  - 헤어/성형(colorGroup 있음): 그룹당 1개, 대표 = 그룹 내 최저 id(= 검정 color 0). 나머지 색은
//    CDN에서 안 받고, 웹의 "염색" 기능이 유저 설정으로 색을 계산한다.
//  - 장비(colorGroup 없음): 이름당 1개(남/여·재출시 동명·동일외형 중복 제거), 대표 = 최저 id.
export function foldList(l: ListItem[]): ListItem[] {
  if (!l.length) return l
  const hasColor = l[0].colorGroup != null
  // 장비는 이름 + 라벨로 묶는다 — 스페셜 라벨과 일반 아이템은 이름이 같아도 그림이 다른 다른 아이템이다(양머리 수건 01002447 · 01004689, 사용자 제보).
  // 명찰 · 말풍선 · 훈장 · 칭호는 그림(아틀라스)까지 — 이름이 같아도 그림이 다른 훈장 14 · 칭호 5가 있다
  const keyOf = (it: ListItem) => (hasColor ? `g${it.colorGroup}` : `n${it.name ?? it.id}|${it.label ?? ''}|${it.chatUi?.atlas ?? ''}`)
  const rep = new Map<string, ListItem>()
  for (const it of l) {
    if (it.dupOf != null || it.dupId) continue // 복제(헤어 · 성형의 복제 묶음, 그 밖의 재출시 복제)는 목록에 내지 않는다(원본이 같은 그림으로 있다 — data.ts loadBeautyDups · loadItemDups)
    const k = keyOf(it); const cur = rep.get(k)
    if (!cur) { rep.set(k, it); continue }
    if (parseInt(it.id, 10) < parseInt(cur.id, 10)) rep.set(k, it)
  }
  const seen = new Set<string>(); const out: ListItem[] = []
  for (const it of l) {
    if (it.dupOf != null || it.dupId) continue
    const k = keyOf(it); if (seen.has(k)) continue
    if (it.id !== rep.get(k)!.id) continue // 대표 위치에서만 출력 → 최저 id 기준 정렬 유지
    seen.add(k); out.push(rep.get(k)!)
  }
  return pairSizes(out)
}

// 크기만 다른 짝(일루전 링의 'X (L)' — 같은 그림을 크게)은 나란히 둔다 — 큰 것이 먼저(왼쪽), 일반 크기 'X' 가 바로 뒤(사용자 지시 — 명찰 · 말풍선 세트처럼).
// 짝은 둘 가운데 먼저(최신순) 나오는 자리에 선다. 이름이 정확히 같은 일반 크기가 없으면 그대로 둔다.
const BIG = /\s*\(L\)$/
function pairSizes(l: ListItem[]): ListItem[] {
  const base = new Map<string, ListItem>()
  for (const it of l) if (it.name && !BIG.test(it.name)) base.set(it.name, it)
  const big = new Map<string, ListItem>() // 일반 크기 id → (L)
  for (const it of l) { const b = it.name && BIG.test(it.name) ? base.get(it.name.replace(BIG, '')) : undefined; if (b) big.set(b.id, it) }
  if (!big.size) return l
  const out: ListItem[] = [], done = new Set<string>()
  for (const it of l) {
    if (done.has(it.id)) continue
    const b = it.name && BIG.test(it.name) ? base.get(it.name.replace(BIG, '')) : undefined
    const pair = b && big.get(b.id) === it ? [it, b] : [...(big.has(it.id) ? [big.get(it.id)!] : []), it]
    for (const x of pair) if (!done.has(x.id)) { done.add(x.id); out.push(x) }
  }
  return out
}

// 화면의 부위 id(CATS) → 실제 WZ slot. skin 은 특수(톤).
export const CAT_TO_SLOT: Record<string, string> = {
  hair: 'hair', plastic: 'face', skin: 'skin', cap: 'cap', faceacc: 'faceAcc',
  eyeacc: 'eyeAcc', earring: 'earring', overall: 'longcoat', top: 'coat', bottom: 'pants',
  shoes: 'shoes', gloves: 'glove', cape: 'cape', weapon: 'weapon', shield: 'shield',
  ring: 'ring', effect: 'effect', riding: 'riding',
  nametag: 'nameTag', balloon: 'chatBalloon', chatring: 'chatRing', // 부위 탭은 명찰/말풍선 하나(chatring), 코디 정보 칩은 둘(CHAT_INFO_CATS)
  title: 'title', medal: 'medal', // 칭호 · 훈장(부위 탭 · 코디 정보 칩 모두 하나씩)
}
export const SLOT_TO_CAT: Record<string, string> = {
  ...Object.fromEntries(Object.entries(CAT_TO_SLOT).map(([c, s]) => [s, c])),
  nameTag: 'chatring', chatBalloon: 'chatring', // 명찰 · 말풍선 아이템은 한 탭에서 고른다
}
// 실제 착용 슬롯(합성 대상). skin 은 톤이라 별도.
export const EQUIP_SLOTS = [
  'hair', 'face', 'cap', 'faceAcc', 'eyeAcc', 'earring',
  'coat', 'longcoat', 'pants', 'shoes', 'glove', 'cape', 'weapon', 'shield',
  'ring', // 일루전 링 — 그릴 레이어 대신 표지 레이어(Layer.illusion)로 캐릭터를 키우거나 바꾼다(assemble.applyIllusion)
  'effect', // 캐시 이펙트 — 그릴 레이어가 없고(빈 meta) 이펙트(effects/<id>.json)만 그린다
  'riding', // 탑승 — 마운트/모프 레이어를 코디처럼 합성
  'nameTag', 'chatBalloon', // 명찰 · 말풍선(그릴 레이어 없이 core/chatUi 가 덧그린다)
  'title', 'medal', // 칭호 · 훈장(명찰과 같다 — 칭호는 머리 위, 훈장은 명찰 아래)
] as const

/* ── 라이딩(탑승) 공통 규칙 ───────────────────────────────────────────────
 * 라이딩만 **두 가지가 다르다**.
 *  1) 목록·메타가 CDN 카탈로그(index.slots) 밖, 프론트 public 에 있다 → 슬롯 파일을 따로 골라야 한다.
 *     부위 탭(ensureSlot)뿐 아니라 스냅샷 복원(loadSlotRaw)도 이 규칙을 써야 한다. 아니면 프리셋을
 *     다시 고르거나 광장 코디를 가져오면 라이딩만 빈 목록에서 조회돼 조용히 사라진다(그 상태가 자동저장까지 된다).
 *  2) 캐릭터가 **앉는다**. 앉는 액션·정렬 기준은 아이템마다 다르다(riding.json).
 *     미리보기(PreviewModel)·부위 카드(ItemThumb)뿐 아니라 스냅샷 합성기(core/snapRender)도 알아야 한다.
 *     아니면 프리셋·광장 카드만 선 채로 탑승한 그림이 나온다.
 *  → 두 규칙을 여기 한곳에 둔다. 라이딩을 그리는 곳은 반드시 이 헬퍼를 쓴다. */
export const RIDING_FILE = '/riding/riding.json'
export const RIDING_ACTIONS_DEFAULT = new Set(['basic', 'walk', 'jump', 'ladder', 'rope', 'shoot2']) // 재규어 기준
export const RIDING_SEATED_DEFAULT = new Set(['basic', 'walk']) // 캐릭터가 앉는(sit) 액션
type RidingOpts = { ridingActions?: string[]; ridingSeated?: string[] } | null | undefined
export const ridingActionSet = (it: RidingOpts) => (it?.ridingActions?.length ? new Set(it.ridingActions) : RIDING_ACTIONS_DEFAULT)
export const ridingSeatedSet = (it: RidingOpts) => (it?.ridingSeated?.length ? new Set(it.ridingSeated) : RIDING_SEATED_DEFAULT)
// 슬롯 → 목록 파일. 라이딩(프론트 public)과 반지 · 이펙트(CDN rings/ · cashfx/ — 카탈로그 index 밖)만 갈라지는 지점이 **여기 하나**다.
export const slotFile = (slot: string, index?: { slots: SlotSummary[] } | null): string | undefined =>
  CHAT_FILES[slot] ?? (slot === 'riding' ? RIDING_FILE : slot === 'ring' ? RING_FILE : slot === 'effect' ? CASHFX_FILE : index?.slots.find((s) => s.slot === slot)?.file)

/* ── 명찰 · 말풍선 반지 ──────────────────────────────────────
 * 데이터는 front public/chatui(본 서버에서 뽑은 명찰 · 말풍선 603 · 칭호 431 · 훈장 853 · 채팅 이모티콘 141 — parser 의 chatui-build.py 가 통째로 다시 쓴다).
 * 부위는 그 목록 파일이 실제로 있을 때만 나온다(ShopContext 의 cats · infoCats).
 * 부위 탭은 하나(명찰/말풍선 — 같은 이름의 명찰과 말풍선이 나란히, 세트 순서)이고 코디 정보 칩은 둘이다(따로 끼고 벗는다).
 * 그리기는 core/chatUi(renderCharacter 의 chat). 명찰 이름 = 고른 프리셋 이름, 말풍선 = 미리보기 아래 채팅 칸(preview/ChatBar)에서
 * (말풍선 반지를 끼지 않았거나 숨겼으면 기본 말풍선 — 게임의 흰 말풍선, CHAT_DEFAULT_BALLOON. 명찰은 끼었을 때, 또는 칸이 비었고
 *  연출 설정 > 캐릭터의 기본 명찰(pv.baseTag, 기본 꺼짐)을 켰을 때 — 사용자 지시)
 * 보낸 말 · 이모티콘이 CHAT_SHOW_MS 동안 떴다 사라진다(게임 값을 찾지 못해 사용자가 정했다). */
export const CHAT_TAB = 'chatring'
// 칭호 · 훈장은 명찰/말풍선 바로 뒤(이펙트 앞 — 사용자 지시). 목록은 명찰 · 말풍선과 따로 받는다(그 탭을 열 때만)
const TAG_CATS: Cat[] = [{ id: 'title', label: '칭호' }, { id: 'medal', label: '훈장' }]
export const CHAT_CATS: Cat[] = [{ id: CHAT_TAB, label: '명찰 / 말풍선' }, ...TAG_CATS] // '/' 양옆은 가는 공백(U+2009 — 보통 공백보다 좁게, 사용자 지시)
export const CHAT_INFO_CATS: Cat[] = [{ id: 'nametag', label: '명찰' }, { id: 'balloon', label: '말풍선' }, ...TAG_CATS]
const CHAT_LIST = '/chatui/list.json'
export const CHAT_FILES: Record<string, string> = { nameTag: CHAT_LIST, chatBalloon: CHAT_LIST, chatRing: CHAT_LIST, title: '/chatui/title.json', medal: '/chatui/medal.json' }
// 그릴 레이어 없이 core/chatUi 가 덧그리는 부위(meta 가 CDN 에 없다)
export const CHAT_SLOTS = new Set(['nameTag', 'chatBalloon', 'title', 'medal'])
export const CHAT_EMO_FILE = '/chatui/emoticons.json'
export const CHAT_DEFAULT_BALLOON = '/chatui/default-balloon.json' // UI.wz ChatBalloon.img/0(parser chatui-build)
export const CHAT_NEW_FILE = '/chatui/new.json' // 테스트 서버에만 있는(본 서버에 없는) 명찰 · 말풍선 id — NEW 라벨
export interface ChatState { name: string; text: string; emo?: ChatEmo }
export interface ChatMsg { text: string; emo?: ChatEmo; at?: number } // at = 보낸 시각(performance.now — 움직이는 이모티콘의 시계)
export const defaultPresetName = (i: number) => `코디 ${i + 1}` // 프리셋 기본 이름(비우면 이것으로 돌아간다)
// 기본 이름 꼴('코디 N')인가 — 순서를 바꾸면 이 이름은 새 자리의 번호로 따라간다(ShopContext.reorderPresets)
export const isDefaultPresetName = (name: string) => /^코디 \d+$/.test(name.trim())
export const CHAT_NAME_FALLBACK = '핑크빈' // 프리셋을 고르지 않았거나 이름을 비웠을 때 명찰 이름(사용자 지시)
export const CHAT_CARD: ChatState = { name: '핑크빈', text: '커마샵' } // 목록 카드의 명찰 이름 · 말풍선 말(고정 — 사용자 지시)
export const CHAT_TEXT_MAX = 70  // 말 글자 수
export const CHAT_SHOW_MS = 10000 // 보낸 말풍선이 떠 있는 시간(사용자 지시 — 10초)
// 착용 중인(숨기지 않은) 명찰 · 말풍선 → 그릴 것. 목록 아이템이 조각 정보를 들고 있고, 없으면 meta 에서 읽는다.
// 말풍선은 보낸 말(msg)이 떠 있는 동안만 그린다.
// 칭호 · 훈장은 끼었고 숨기지 않았으면 늘 그린다(글자 = 그 아이템 이름).
export function chatDrawOf (equipped: Record<string, ListItem | null | undefined>, hidden: Record<string, boolean>, name: string, msg: ChatMsg | null, metas?: Map<string, ItemMeta>, defBalloon?: ChatUi | null, baseTag?: boolean): ChatDraw | undefined {
  const ui = (slot: string) => { const it = equipped[slot]; return !it || hidden[slot] ? undefined : it.chatUi ?? metas?.get(it.id)?.chatUi }
  const label = (slot: string) => { const u = ui(slot); return u ? { ui: u, name: equipped[slot]!.name ?? '' } : undefined }
  // 명찰: 반지를 끼었으면 그 명찰(숨겼으면 없음), 칸이 비었으면 연출 설정의 '기본 명찰'(pv.baseTag)이 켜졌을 때만 기본 명찰
  const tag = ui('nameTag') ?? (!equipped.nameTag && baseTag ? BASE_TAG : undefined), balloon = msg ? ui('chatBalloon') ?? defBalloon ?? undefined : undefined
  const title = label('title'), medal = label('medal')
  return tag || balloon || title || medal ? { tag, balloon, title, medal, name, text: msg?.text ?? '', emo: msg?.emo, t0: msg?.at } : undefined
}

// 모델 렌더 배치 상수(computeModelPlacement 에 전달). 캔버스는 div×margin(>1)로 div보다 크게 잡아
// 스프라이트는 div overflow 로만 잘린다. 모델(마네킹) 높이 = fraction × divH 로 장비·카드크기 무관 일정.
// 우측 미리보기 배율(연출 설정 1x/2x/3x)은 fraction 에 곱하는 "월드 배율".
export const ZOOM_WORLD: Record<number, number> = { 1: 0.7, 2: 1.0, 3: 1.4 }
export const PREVIEW_FRACTION = 0.25 // 우측 미리보기 기준 마네킹 높이 비율(× ZOOM_WORLD; 기본 2x=×1.0 → 실효 0.25)
// 모바일은 미리보기 영역이 "낮고 넓다"(세로 스택). PC와 같은 0.25 를 쓰면 200px 높이의 25% = 50px 로
// 모델이 콩알만 해진다 — 세로가 부족한 만큼 비율을 올려 남는 가로 여백을 모델에 쓴다.
export const PREVIEW_FRACTION_MOBILE = 0.5
export const PREVIEW_MARGIN = 1.5    // 우측 미리보기 캔버스 여백 배수
export const CARD_FRACTION = 0.45     // 리스트 카드 마네킹 높이 비율(넉넉한 전체샷; 정수 스냅으로 항상 선명)
// 모바일 카드의 마네킹 높이 비율 — **모든 모바일 카드가 같은 값**(사용자 지시: 목록 · AI 코디 검색 · 코디 룩북 · 프리셋 · 광장).
// 목표 높이일 뿐 실제 배율은 정수로 반올림된다(modelPlacement snap — 기기 px 정수 배율이라 도트가 뭉개지지 않는다)
export const CARD_FRACTION_M = 0.475
// 모바일 카드의 캐릭터 높이 ≤ 그림 칸 폭 × 0.8 — 키 큰 화면(412 × 915)에서 그림 칸이 길어 캐릭터가 칸 폭보다 컸다(SnapThumb · ItemThumb fitW)
export const CARD_FIT_W_M = 0.8
// 모바일 격자 = 3열 × 3줄 — 모든 모바일 카드 목록이 같다(사용자 지시: 코디 탭 · AI 코디 검색 목록, 코디 룩북, 프리셋, 광장).
// 4열은 카드 폭이 좁아 무기 · 망토가 잘렸고, 3열 2줄(6개)은 한 번에 보이는 것이 적었다. 3줄이라 페이지가 길어지는 만큼 미리보기(히어로)를
// 화면 위에 붙여 둔다(preview.module.css .hero sticky) — 목록을 내려 보면서도 캐릭터가 바뀌는 것이 보인다(사용자 지시)
export const MOBILE_GRID = { cols: 3, rows: 3 }
// 목록의 '필터'(사용자 지시 — 라디오, 하나만 고른다. 'all' = 전부). 보기 설정 안 보기 · 성별 · 방향과 같은 버튼(Seg)이다.
// 마라벨 = 장비의 마스터라벨 + 세트에 딸린 헤어 · 성형 · 얼굴장식(catalog/labels.json, 라이딩은 넣지 않는다). 콜라보는 뺐다(사용자 지시 — 원본 표시가 맞지 않다).
// 일반 = 라벨이 없는 전부(콜라보 · 캐시 · 메소 · 피부 — 컬러라인 피부처럼 가르기 어려운 것이 있어 하나로 합쳤다). 부티크는 원본에 가를 표시가 없어 없다
export const ITEM_KINDS: { v: string; l: string; t: string; test?: (it: ListItem) => boolean }[] = [
  { v: 'all', l: '전체', t: '전부 보기' },
  { v: 'master', l: '마라벨', t: '마스터라벨(세트의 헤어 · 성형 · 얼굴장식 포함)', test: (it) => it.label === 'master' },
  { v: 'special', l: '스라벨', t: '스페셜라벨', test: (it) => it.label === 'special' },
  { v: 'normal', l: '일반', t: '라벨이 없는 아이템', test: (it) => !it.label },
]
export const CARD_MARGIN = 1.4        // 리스트 카드 캔버스 여백 배수

// 리스트 셀 합성 썸네일용 고정 정지 뷰(모델/내모델 모드). 정적이라 셀마다 애니메이션 없음.
export const THUMB_VIEW: ViewOpts = { action: 'stand1', expression: 'default', ear: 'humanEar', weaponMotion: 'basic' }

// 점(애교점) 위치를 직접 옮길 수 있는 눈장식(eyeAcc) 아이템 — 사소한 변경점(1점)/변경쩜(2점).
// 이 아이템들만 "점 위치" 편집 다이얼로그를 열 수 있다(고정판 매력만점/매력만쩜은 제외).
// 편집 대상 = 아이템 자기 점 레이어(accessoryEye = 점1, accessoryEye2 = 점2).
export const DOT_MOVER_IDS = new Set(['01022395', '01022396'])

// 썸네일에도 현재 시선(gaze)을 반영: 뒷쪽=rope(뒷모습), 오른쪽=좌우반전(flip). 액션/표정은 카드 고정(THUMB_VIEW).
// expr/ear/weapon 을 주면 연출설정의 표정·귀·무기모션도 카드에 반영한다(안 주면 THUMB_VIEW 기본값).
// stance=true('내 캐릭터' 카드) 면 무기모션에 맞는 서기 자세(두손=stand2)도 미리보기와 같게 잡는다.
export function thumbView(gaze: string, expr?: string, ear?: string, weapon?: string, stance?: boolean): { view: ViewOpts; flip: boolean } {
  return {
    view: { ...THUMB_VIEW, action: gaze === 'back' ? 'rope' : stance ? resolveAction('basic', weapon || 'basic') : 'stand1', expression: expr || THUMB_VIEW.expression, ear: ear || THUMB_VIEW.ear, weaponMotion: weapon || THUMB_VIEW.weaponMotion },
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
// (호출부: list/thumbCtx. ListMode 는 컴포넌트 쪽 타입이라 여기서 import 하지 않는다.)
export const forceMyModel = (mode: string, it: ListItem): boolean => mode === 'model' && hasFixedExpr(it)

// "컬러라인" 커스텀 피부(커스텀 뽀송/홍조 라벤더 컬러라인)만 염색 가능. 피부 부분은 무채색이고 라인만 채도색
// 이라, 표준 HSB 를 통째로 적용해도 시각적으로 라인만 변한다(실제 메이플 방식과 동일 — 마스크 불필요). 이름 식별.
// 염색되는 피부와 그 **포인트 색 계열**(계열 값이 없는 옛 데이터에만 쓴다 — 지금은 고른 계열을 그대로 건다, dye.skinHsb).
// 인게임처럼 '커스텀' 피부만 염색되고, 염색은 그 피부가 가진 포인트 색에만 걸린다. 계열을 직접 고르면 그 계열로 걸린다.
// 근거 — 피부별 머리 스프라이트의 색 분포 실측(불투명 1474px 기준, 색 계열 구간은 dye.checkColorType 과 동일):
//   · 뽀송·홍조 라벤더 컬러라인: 순청 (0,0,255) 252px = 파랑 17%(라인)              → 파랑(5)
//   · 블루 팬더: (0,51,119) 등 파랑 16%(무늬)                                       → 파랑(5)
//   · 비비드 컬러: 전부 파랑 100%                                                   → 파랑(5)
//   · 좀비: (141,217,207) 등 청록 81%(피부 전체)                                    → 청록(4)
//   · 삼색 냥이: (255,187,51) 등 노랑 42%(무늬)                                     → 노랑(2)
//   · 홍조 피치: 빨강 29% 뿐 — 기본 피부(엘프 빨강 39%)와 같은 구조라 포인트 색이 없다 → 빨강(1, 피부 음영)
// 인게임 확인(메애기 드레스룸): 비비드·블루 팬더·컬러라인 2종이 명도에 따라 변한다 = 실측대로 모두 파랑 계열이다.
const SKIN_DYE_FAMILY: [RegExp, number][] = [
  [/컬러라인/, 5], [/비비드/, 5], [/블루\s*팬더/, 5],
  [/좀비/, 4], [/삼색\s*냥이/, 2], [/홍조\s*피치/, 1],
]
export const skinDyeFamily = (name?: string): number | null => {
  if (!name || !name.includes('커스텀')) return null // 기본 피부(크림·태닝·엘프…)는 인게임에서도 염색되지 않는다
  for (const [re, t] of SKIN_DYE_FAMILY) if (re.test(name)) return t
  return 5 // 아직 표에 없는 커스텀 피부 — 지금까지의 기본값(파랑)
}
export const isDyeableSkin = (name?: string): boolean => skinDyeFamily(name) !== null

// 초기 진입 시 기본 착용(빈 모델 방지). 슬롯 리스트를 미로드해도 되도록 최소 ListItem 으로 하드코딩.
// 헤어/성형은 검정 대표(color 0) id. 실제 부위 리스트를 열면 folded 대표와 id가 일치해 선택 표시됨.
export const DEFAULT_TONE = 12 // 엘프 피부
export const DEFAULT_EQUIP: Record<string, ListItem> = {
  hair: { id: '00071540', slot: 'hair', isCash: false, grade: 'none', islot: null, vslot: null, dyeMode: 'palette', colorGroup: 7154, color: 0, name: '밤의 레아 헤어 (여)', actions: [] },
  face: { id: '00022060', slot: 'face', isCash: false, grade: 'none', islot: null, vslot: null, dyeMode: 'palette', colorGroup: 2260, name: '운명의 인도자 얼굴', actions: [] },
  longcoat: { id: '01051917', slot: 'longcoat', isCash: true, grade: 'cash', islot: 'MaPn', vslot: null, dyeMode: 'none', name: '금단의 계약 (여)', actions: [] },
}

// 이동/자세 액션 중 **핑퐁(왕복) 재생** 대상. 서기·전투 대기처럼 '숨 쉬는' 동작은 0→…→N-1→…→0 으로 오가야
// 자연스럽다(끝에서 처음으로 튀지 않는다).
// ⚠️ **걷기는 뺀다**.
//    walk1/walk2 는 네 프레임(각 180ms)이 **한 바퀴 도는 걸음**이라 왕복시키면 가운데 두 프레임이 한 주기에
//    두 번 나오고 다리가 앞뒤로 되돌아가 절뚝이는 걸음이 된다. 게임처럼 0→1→2→3→0 으로 **반복**한다.
export const MOVE_POSTURE_ACTIONS = new Set(['basic', 'stand', 'alert', 'proneStab', 'sit', 'jump', 'fly', 'ladder', 'rope'])

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
// 한 바퀴 길이(ms) — frameAtElapsed(핑퐁이면 frameAtElapsedAlt)가 처음으로 돌아오기까지. 돌지 않으면 0.
export function frameCycleMs(delays: number[], pingpong = false): number {
  const N = delays?.length ?? 0
  if (N <= 1) return 0
  const ds = delays.map((d) => Math.max(20, d || 120))
  return pingpong ? ds.reduce((a, d, i) => a + (i === 0 || i === N - 1 ? d : 2 * d), 0) : ds.reduce((a, b) => a + b, 0)
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
