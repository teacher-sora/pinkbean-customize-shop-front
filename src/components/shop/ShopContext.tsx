'use client'

/*
 * ShopContext — 상태·핸들러 단일 출처.
 * 코디(부위별 아이템 목록·착용)와 미리보기 합성은 실제 CDN 데이터를 사용한다.
 *   - index/slots/meta 는 src/lib/core/data.ts 로 CDN(https://cdn.pinkbean-customize.com)에서 로드.
 *   - equipped 는 실제 slot → ListItem. 미리보기(PreviewModel)가 이 값을 합성.
 * 시트/다이얼로그는 단일 서피스(surface) 상태 하나로 관리한다.
 */

import { createContext, useCallback, useContext, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { useSelectedLayoutSegment } from 'next/navigation'
import { TAB_PATH, TAB_TITLE, tabOfPath } from '@/lib/tabRoute'
import { nameMatcher } from '@/lib/nameSearch'
import { EGG_ITEMS, isEgg, isEggItem } from '@/lib/easterEgg'
import { CATS, MIX_PALETTE, type Cat, type Preset, type Pv } from '@/lib/catalog'
import { useBreakpoint, type Breakpoint } from '@/lib/useBreakpoint'
import { loadAnima, loadEffectIndex, loadIndex, loadMeta, loadNewItems, loadSlot, type Index, type ListItem, type Vec } from '@/lib/core/data'
import type { ChatUi } from '@/lib/core/chatUi'
import { colorOf, preloadPaletteVariant, variantId, warmDye, type HsbParams, type PaletteParams } from '@/lib/core/dye'
import { conflictSlots } from '@/lib/core/slots'
import { prefetchGlyphs } from '@/lib/core/chatGlyphs'
import { lookToSnapshot, type LookDeps, type NexonLook } from '@/lib/nexonLook'
import { prepareShare, resolveShareCode, uploadShare } from '@/lib/shareCode'
import { backApi } from '@/lib/backApi'
import { GUIDE_DRAWER_EVENT, GUIDE_SETTLE_MS, guideSpot, setPvIntent, type GuideGo } from '@/lib/guide'
import { createPlazaPost, deletePlazaPost, loadLikeCounts, loadPlaza, loadPlazaHead, loadPlazaPulse, plazaConfigured, plazaPin, plazaView, togglePlazaLike,
  PLAZA_CONTEST, PLAZA_FILTERS, type PlazaDraft, type PlazaFilter, type PlazaPost, type PlazaSort } from '@/lib/plaza'
import { plazaSnapshot } from '@/lib/plazaLook'
import { safeBubbles } from '@/lib/safeText'
import { presetFileName } from '@/lib/canvasExport'
import { CAT_TO_SLOT, CHAT_CATS, CHAT_DEFAULT_BALLOON, CHAT_FILES, CHAT_INFO_CATS, CHAT_NEW_FILE, CHAT_NAME_FALLBACK, CHAT_SHOW_MS, CHAT_TAB, type ChatMsg, DEFAULT_EQUIP, defaultPresetName, isDefaultPresetName, DEFAULT_TONE, DOT_MOVER_IDS, EQUIP_SLOTS, SLOT_TO_CAT, THUMB_VIEW, buildView, foldList, slotFile } from '@/lib/shopData'
import { animaOnce, composePeek, composeSnapshotCached, snapKey } from '@/lib/core/snapRender'
import { warmItem } from '@/lib/core/warm'
import { loadLookPixels, pickBySprite } from '@/lib/lookMatch'
import { enqueueThumb } from '@/lib/thumbQueue'
import { confirmTwice } from '@/lib/confirmTwice'
import { setStageBg, stageSelOf, useStageBg } from '@/lib/stageBg'
import { RESTORE_ATTR, SEARCH_KEEP, type PresetOver, dropUiHistory, readUiPref, readUiSession, useIsoLayoutEffect, writeUiPref, writeUiSession } from '@/lib/uiState'

type Dispatch<T> = React.Dispatch<React.SetStateAction<T>>
export type ListMode = 'sprite' | 'model' | 'mymodel' // 보기 방식: 아이템 / 기본 캐릭터 / 내 캐릭터
export type ListDir = 'x' | 'y' // 목록 넘기는 방향: 가로 / 세로
// 성별 필터: 전체 / 여캐가 입을 수 있는 것 / 남캐가 입을 수 있는 것 (공용은 항상 포함)
export type GenderFilter = 'all' | 'f' | 'm'
// 염색 대상은 실제 slot. hair/face(성형)만 믹스 염색, 그 외 HSV.
const isMixSlot = (slot: string) => slot === 'hair' || slot === 'face'
// 여러 부위를 합친 목록 필터(전체·신규·즐겨찾기) — 활성 슬롯이 없어 아이템 자신의 슬롯으로 판단한다.
export const isMultiCat = (cat: string) => cat === 'all' || cat === 'new' || cat === 'fav'

// 프리셋 스냅샷: 착용(slot→itemId) + 톤 + 염색 + 숨김. (공유 코드/영속에 이 형태 그대로 저장)
// 프리셋에 저장하는 연출설정 일부(형상변이·귀·무기모션·이펙트토글·배율). 시선/액션/표정은 "보는 순간의 상태"라 저장 안 함.
// 프리셋에 담기는 연출 설정은 두 갈래다.
//  · 코디에 속하는 연출(PV_LOOK_DEFAULT) = 형상변이·귀·무기모션·이펙트 3종. 저장되고 **카드에도 그대로 그려진다**.
//  · 보기 설정(PV_VIEW_DEFAULT) = 시선·액션·표정·배율. **정보로만** 담아 프리셋을 쓸 때 화면에 되살리고, 카드에는 적용하지 않는다.
// 보기 설정은 광장에 올릴 때 빠진다(lib/plazaLook.plazaSnapshot) → 없을 수 있고, 없으면 지금 보던 값을 유지한다.
export type PvSnap = { form: string; ear: string; weapon: string; wEffect: boolean; cEffect: boolean; capEffect: boolean; floatFx?: boolean; baseTag?: boolean // floatFx = 부유 아이템의 둥둥 뜨기(없으면 켜짐), baseTag = 명찰 반지가 없을 때 기본 명찰(없으면 꺼짐)
  gaze?: string; action?: string; frame?: number; expr?: string; zoom?: number }
export const PV_LOOK_DEFAULT = { form: 'none', ear: 'humanEar', weapon: 'basic', wEffect: true, cEffect: true, capEffect: true, floatFx: true, baseTag: false }
export const PV_VIEW_DEFAULT = { gaze: 'left', action: 'basic', frame: -1, expr: 'default', zoom: 2 }
export const PV_SNAP_DEFAULT: PvSnap = { ...PV_LOOK_DEFAULT, ...PV_VIEW_DEFAULT }
// 점(애교점) 위치 오프셋: 레이어이름(accessoryEye/accessoryEye2) → 월드 오프셋. 사소한 변경점/쩜 전용.
export type DotOffsets = Record<string, Vec>
// 핑크빈이 하는 말 한 마디와, 그 말을 할 때 보고 있는 부위('' = 코디 전체).
export type RateLine = { text: string; slot: string }
// 말에서 부위를 짐작한다(서버가 부위를 주지 않았을 때). 입고 있는 부위만 돌려준다.
const RATE_WORDS: [RegExp, string[]][] = [
  [/헤어|머리카락|머리|앞머리|단발|양갈래|포니테일/, ['hair']], [/모자|리본|머리띠|왕관|헬멧|후드/, ['cap']], [/눈동자|눈빛|눈매|표정|얼굴|성형/, ['face']],
  [/안경|선글라스|눈장식/, ['eyeAcc']], [/얼굴장식|마스크|수염/, ['faceAcc']], [/귀고리|귀걸이/, ['earring']], [/신발|구두|부츠|운동화|슬리퍼/, ['shoes']],
  [/장갑/, ['glove']], [/망토|날개|꼬리/, ['cape']], [/방패/, ['shield']], [/반지|일루전/, ['ring']], [/이펙트/, ['effect']], [/무기|검|칼|지팡이|활|총|창|도끼/, ['weapon']],
  [/치마|바지|하의|스커트|반바지/, ['pants', 'longcoat']], [/원피스|드레스|한벌옷|교복|정장|옷|상의|셔츠|재킷|자켓|코트|티셔츠/, ['longcoat', 'coat']],
]
function rateSlotOf(text: string, equipped: Record<string, ListItem | null>): string {
  for (const [re, slots] of RATE_WORDS) if (re.test(text)) { const hit = slots.find((sl) => equipped[sl]); if (hit) return hit }
  return ''
}

export type Snapshot = { equipped: Record<string, string>; tone: number; dyePalette: Record<string, PaletteParams>; dyeHsb: Record<string, HsbParams>; hidden: Record<string, boolean>; dotPos?: Record<string, DotOffsets>; dyeOff?: Record<string, boolean>; pv?: PvSnap; name?: string
  bg?: string } // bg = 미리보기 배경(lib/stageBg 의 sel) — 프리셋마다 다르다(사용자 지시). 이 브라우저의 값이라 광장 · 공유에는 싣지 않는다. 없으면 피팅룸
// 공유·광장에서 받은 코디는 메타 정보(연출·시선·액션·표정·배율)를 **전부 그 코디의 값**으로 가져온다.
// 담겨 있지 않은 칸은 기본값이다 — 공유 코드는 기본값과 같은 칸을 아예 빼고 싣고(shareCode.minPv), 오래된 광장 글엔
// 보기 설정이 없다. 빠진 칸을 '보던 화면의 값'으로 두면 3배로 보던 중에 가져온 코디가 3배로 저장돼
// 프리셋마다 크기가 제멋대로가 된다.
const withTakenView = (s: Snapshot): Snapshot => ({ ...s, pv: { ...PV_SNAP_DEFAULT, ...Object.fromEntries(Object.entries(s.pv || {}).filter(([, v]) => v !== undefined)) } as PvSnap })

// 단일 서피스(시트·다이얼로그): 연출 설정 · 북마크 · 염색 · 점 위치가 모두 이 하나를 쓴다.
// part = 부위 염색(착용 부위 고르기 → 같은 다이얼로그 안에서 염색/점 위치로 슬라이드), vs = 북마크 코디 비교(PC).
// fromPart = 부위 염색을 거쳐 들어온 dye/dot — 푸터가 '이전'(부위 고르기로 복귀)이 된다.
// plaza = 코디 광장 글 상세. ptake = 그 상세에서 '가져오기'로 넘어간 프리셋 칸 고르기 —
//   다이얼로그를 **그대로 둔 채** 본문만 가로로 슬라이드하고 패널 크기만 바뀐다(상세를 닫고
//   새 다이얼로그를 띄우면 화면이 한 번 끊긴다).
export type SurfaceKind = 'pv' | 'bm' | 'dye' | 'dot' | 'part' | 'bg' | 'plaza' | 'ptake' | 'notice' | 'emo' | 'card'
// take = 'ptake'(공유받은 코디)가 저장할 스냅샷. post 가 함께 있으면 광장 상세를 거쳐 온 것이라 '이전'으로 돌아간다.
export type Surface = { kind: SurfaceKind; item: ListItem | null; fromPart?: boolean; post?: PlazaPost; fromDetail?: boolean; take?: Snapshot }
const PART_SLIDE_SWAP_MS = 90, PART_SLIDE_IN_MS = 110 // 내용 가로 슬라이드: 빠짐 → 90ms 교체 → 110ms 들어옴
const SURFACE_UNMOUNT_MS = 320 // 닫힘 트랜지션(.3s)보다 길게 — 닫힘이 중간에 잘리지 않게

// 비동기로 만든 텍스트(공유 코드 압축이 async)를 클립보드에 안전하게 복사한다.
// 사파리는 await 후 writeText 가 사용자 제스처 밖이라 거부될 수 있어, ClipboardItem 에 Promise(Blob)를 넘겨
// 제스처와 동기적으로 쓰기를 시작하는 방식을 우선 쓴다(크롬/파폭은 writeText 폴백).
function copyAsyncText(make: () => Promise<string>): Promise<void> {
  try {
    if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
      const blob = make().then((t) => new Blob([t], { type: 'text/plain' }))
      return navigator.clipboard.write([new ClipboardItem({ 'text/plain': blob })]).catch(() => {})
    }
  } catch { /* writeText 폴백 */ }
  return make().then((t) => navigator.clipboard?.writeText(t)).then(() => {}).catch(() => {})
}

// ── 프리셋: 100칸, 초깃값은 코디 기본(밤의 레아 헤어·운명의 인도자 얼굴·엘프 피부·금단의 계약). localStorage 영속(서버 없음). ──
// 칸 id 는 'd0'…'d99' 다. 칸 수를 늘려도 앞 칸의 id 는 그대로이고,
// 복원은 저장소에 있는 칸만 읽어 오므로(아래 PRESET_IDS.forEach) 기존 코디·이름은 손대지 않는다. 새 칸만 기본값으로 생긴다.
const PRESET_COUNT = 100 // 사용자 지시(30 → 100). 기기의 localStorage 에만 있고 서버에 오르지 않는다(공유 · 광장 등록 때만)
const PRESET_WARM = 30   // 한가할 때 미리 합성하는 프리셋은 앞의 이만큼(첫 화면을 덮는다) — 100칸 전부면 합성 캐시(120)를 넘어 광장 첫 쪽과 서로 밀어낸다
const PRESET_IDS = Array.from({ length: PRESET_COUNT }, (_, i) => 'd' + i)
// 되돌리기 기록용: 프리셋 이름 전체(id → 이름)와, 기록 한 건을 가르는 상태키(코디 + 선택 프리셋 + 이름).
const namesOf = (ps: Preset[]): Record<string, string> => Object.fromEntries(ps.map((p) => [p.id, p.name]))
// 닉네임으로 불러올 때 따로 끄고 켤 수 있는 장식(불러오기 창)
export const NICK_TAKE_SLOTS = [{ slot: 'title', label: '칭호' }, { slot: 'nameTag', label: '명찰' }, { slot: 'medal', label: '훈장' }, { slot: 'chatBalloon', label: '말풍선' }]
// 되돌리기 기록의 키. 배율(pv.zoom)은 되돌리기 · 다시 실행과 무관한 보기 값이라 뺀다(배율만 바꾼 것은 기록하지 않고, 되돌릴 때도 지금 배율 — applyHistory).
// 미리보기 배경(bg)은 넣는다 — 배경을 바꾼 것도 한 건으로 기록되고 되돌리면 그때의 배경으로(사용자 지시)
const histKey = (snap: Snapshot, sel: string | null, names?: Record<string, string>) => JSON.stringify({ s: snap.pv ? { ...snap, pv: { ...snap.pv, zoom: undefined } } : snap, p: sel, n: names })
// 연출 설정 기본값 — 첫 상태이자 '프리셋 초기화'가 되돌릴 값이다(한곳에서 관리).
// 시선·액션·표정·fps 는 스냅샷에 담기지 않지만, 초기화는 **이것까지 전부** 되돌린다.
const PV_DEFAULT: Pv = {
  action: 'basic', frame: -1, weapon: 'basic', expr: 'default', ear: 'humanEar', form: 'none',
  gaze: 'left', wEffect: true, cEffect: true, capEffect: true, floatFx: true, baseTag: false, fps: 12, zoom: 2,
}
const defaultSnapshot = (): Snapshot => ({
  equipped: Object.fromEntries(Object.entries(DEFAULT_EQUIP).map(([slot, it]) => [slot, it.id])),
  tone: DEFAULT_TONE, dyePalette: {}, dyeHsb: {}, hidden: {}, dotPos: {},
  // 연출 설정도 프리셋마다 따로 각인된다 → 기본 프리셋은 '기본 연출'을 명시해 둔다(빈 값이면 카드마다 해석이 갈린다).
  pv: { form: PV_DEFAULT.form, ear: PV_DEFAULT.ear, weapon: PV_DEFAULT.weapon, wEffect: PV_DEFAULT.wEffect, cEffect: PV_DEFAULT.cEffect, capEffect: PV_DEFAULT.capEffect, floatFx: PV_DEFAULT.floatFx, baseTag: PV_DEFAULT.baseTag, zoom: PV_DEFAULT.zoom },
})
// 키 순서와 무관한 비교용 직렬화(프리셋이 기본값 그대로인지 판별 — "프리셋 n / 20" 카운트).
const canon = (v: unknown): string => {
  if (v === null || typeof v !== 'object') return JSON.stringify(v)
  if (Array.isArray(v)) return `[${v.map(canon).join(',')}]`
  return `{${Object.keys(v as Record<string, unknown>).sort().map((k) => `${JSON.stringify(k)}:${canon((v as Record<string, unknown>)[k])}`).join(',')}}`
}
const snapCoreKey = (s: Snapshot) => canon({ e: s.equipped, t: s.tone, p: s.dyePalette || {}, h: s.dyeHsb || {}, x: s.hidden || {}, d: s.dotPos || {}, o: s.dyeOff || {} })
const DEFAULT_CORE_KEY = snapCoreKey(defaultSnapshot())
// 사용자가 한 번이라도 꾸민 스냅샷인가(기본 코디 그대로면 false) — 광장 등록에서 올릴 프리셋만 추리는 데 쓴다.
export const isCustomSnapshot = (s: Snapshot) => snapCoreKey(s) !== DEFAULT_CORE_KEY
// 대회 '같은 조합' 판정은 lib/plazaLook.ts(정규화·DB 안전망 규칙) + lib/plazaLookPixels.ts(결과 픽셀 비교) — DB 는 0009.
// 이전 기본 헤어(녹셀 헤어 (여) 00071400) 그대로 손대지 않은 저장 프리셋 → 새 기본값(밤의 레아 헤어)으로 이관.
// 조금이라도 바꾼 프리셋(다른 착용·염색·숨김·점 위치)은 사용자 코디라 건드리지 않는다.
// ★ 이관은 **저장소당 한 번만**(v < PRESET_STORE_V 일 때). 매 로드마다 돌리면 기본 코디에 녹셀 헤어만 입힌
//   코디(정당한 사용자 코디)가 새로고침할 때마다 레아 헤어로 되돌아간다.
const LEGACY_DEFAULT_CORE_KEY = (() => { const d = defaultSnapshot(); return snapCoreKey({ ...d, equipped: { ...d.equipped, hair: '00071400' } }) })()
const migrateLegacyDefault = (s: Snapshot): Snapshot => (snapCoreKey(s) === LEGACY_DEFAULT_CORE_KEY ? { ...s, equipped: defaultSnapshot().equipped } : s)
const PRESET_KEY = 'pb_presets_v1'
const FAV_KEY = 'pb_favorites_v1' // 즐겨찾기 아이템 id 목록(localStorage 영속, 서버 없음)
const BOOKMARK_KEY = 'pb_bookmarks_v1' // 북마크(간이 가방) 아이템 — 최대 8개, 즐겨찾기와 별개
const BOOKMARK_MAX = 8
// 연출설정(pv) 전체 영속 — 새로고침 후에도 마지막 상태(무기모션·액션·표정·형상·시선·이펙트·배율)를 그대로 유지.
// 프리셋 스냅샷엔 일부(pv 서브셋)만 담기므로, 전체 pv 는 프리셋과 별개의 전역 키에 저장해 정확히 복원한다.
const PV_KEY = 'pb_pv_v1'
const loadPv = (): Partial<Pv> | null => {
  try { const raw = localStorage.getItem(PV_KEY); if (!raw) return null; const v = JSON.parse(raw); return v && typeof v === 'object' ? v as Partial<Pv> : null } catch { return null }
}
// order = 카드 순서(프리셋 id). 끌어서 옮긴 순서다 — 없거나 빠진 칸은 기본 순서(d0, d1 …)로 뒤에 붙인다
type PresetStore = { data: Record<string, Snapshot>; names: Record<string, string>; sel: string | null; order?: string[]; v?: number }
const presetOrder = (store: PresetStore | null): string[] => {
  const seen = new Set<string>(), out: string[] = []
  for (const id of [...(Array.isArray(store?.order) ? store!.order : []), ...PRESET_IDS]) if (PRESET_IDS.includes(id) && !seen.has(id)) { seen.add(id); out.push(id) }
  return out
}
const PRESET_STORE_V = 2 // 2 = 녹셀→레아 기본 헤어 이관을 마친 저장소
// 저장된 미리보기 배율을 미리 읽는다(없으면 null). 연출 설정(pv)은 목록을 받은 뒤에야 복원되므로, 그 전에 깔리는
// 피팅룸 배경이 이 값으로 크기를 잡는다. 복원 순서와 같다: 전역 연출 설정 → 고른 프리셋에 담긴 값.
export const peekSavedZoom = (): number | null => {
  const z = loadPv()?.zoom
  if (typeof z === 'number') return z
  const store = loadPresetStore()
  const pz = store?.data?.[store.sel && PRESET_IDS.includes(store.sel) ? store.sel : 'd0']?.pv?.zoom
  return typeof pz === 'number' ? pz : null
}
const loadPresetStore = (): PresetStore | null => {
  try { const raw = localStorage.getItem(PRESET_KEY); if (!raw) return null; const s = JSON.parse(raw); return s && s.data ? s : null } catch { return null }
}
// 코디 비교(사용자 지시): 칸 하나하나가 프리셋 목록에 나오지 않는 프리셋이다(id 'cmp…'). 칸을 고르면 그 칸의 코디가 지금 코디가 되어
// 코디 탭 · 염색 · 연출 설정 · 북마크 · 자동 저장 · 되돌리기를 프리셋과 똑같이 쓴다. 저장은 프리셋과 따로(CMP_KEY) — 비교 중에 바꾼 것이 프리셋에 섞이지 않는다.
// ids = 칸 순서(A B C D), on = 비교 중에 닫았는지(새로고침해도 그대로), last = 마지막으로 고른 칸, back = 비교 전에 고르던 프리셋.
// **고른 칸 = 그 프리셋**: 고른 칸을 고치면 back 에도 저장되고, 칸을 바꿔 고르면 그 칸의 코디가 back 이 된다(끄면 back 이 마지막 칸의 코디로 남는다)
export const CMP_MAX = 4
export const CMP_MIN = 2 // 비교는 늘 두 칸 이상(사용자 지시)
const CMP_KEY = 'pb_compare_v1'
export const isCmpId = (id: string | null | undefined): id is string => !!id && id.startsWith('cmp')
type CmpStore = { ids: string[]; data: Record<string, Snapshot>; on: boolean; last: string | null; back: string | null }
const loadCmpStore = (): CmpStore | null => {
  try { const raw = localStorage.getItem(CMP_KEY); if (!raw) return null; const s = JSON.parse(raw); return s && Array.isArray(s.ids) && s.data ? s : null } catch { return null }
}
// 비교 칸의 보기 설정(시선 · 액션 · 프레임 · 표정)은 칸마다 따로 둔다 — 칸을 고르면 그 칸의 설정이 연출 설정 · 목록에 그대로 온다(사용자 지시:
// 목록은 고른 칸에 맞춘다). 배율만 모든 칸이 지금 값을 함께 쓴다 — 같은 크기여야 견줄 수 있다
export const withView = (v: PvSnap | undefined, cur: Pv): PvSnap => ({ ...PV_SNAP_DEFAULT, ...(v || {}), zoom: cur.zoom })
// 불러오기 후보. 다이얼로그 구조 = [코디 탭(제로/엔버만 2개)] + [그 코디의 프리셋 카드들].
export type PresetOption = { key: string; label: string; active: boolean; snap: Snapshot }
export type LookOption = { key: string; label: string; presets: PresetOption[] }
export interface ShopCtx {
  // 데이터
  index: Index | null
  cats: Cat[] // 부위 탭(CATS + dev 에서만 명찰/말풍선 — CHAT_CATS)
  infoCats: Cat[] // 코디 정보 칩(CATS + dev 에서만 명찰 · 말풍선 둘 — CHAT_INFO_CATS)
  chatOn: boolean // 명찰 · 말풍선을 쓸 수 있는가(목록 파일이 있을 때만)
  chatDefault: ChatUi | null // 기본 말풍선(말풍선 반지 없이 보낸 채팅)
  chatName: string // 명찰 이름 = 고른 프리셋 이름
  saveName: string // 이미지 · 움짤 저장 파일 이름(canvasExport.presetFileName)
  chatMsg: ChatMsg | null; sendChat: (m: ChatMsg) => void // 채팅 칸에서 보낸 말 · 이모티콘(CHAT_SHOW_MS 동안)
  catLoading: boolean
  activeList: ListItem[] // 활성 부위의 folded 리스트에 검색·성별 필터 적용(정렬 순서 유지)
  search: string; setSearch: Dispatch<string>
  genderFilter: GenderFilter; setGenderFilter: Dispatch<GenderFilter> // 코디·AI 코디 검색 공용
  // primary/screen
  primary: string; setPrimary: (tab: string) => void
  goHome: () => void // 로고 — 첫 진입 화면(코디 탭 · 전체 · 1페이지)으로
  // AI 코디 검색 — 결과는 하단 부위 바(activeCat)·성별로 필터(결과 집합은 perPage 와 무관)
  aiQ: string; setAiQ: Dispatch<string>
  searchQuery: string | null; runSearch: (q: string) => void; searchResults: ListItem[]; searchLoading: boolean
  // codi
  activeCat: string; setActiveCat: Dispatch<string>
  favorites: Set<string>; toggleFavorite: (id: string) => void
  newIds: Set<string> // 최근 패치 신규 아이템(CDN catalog/new.json) — NEW 라벨·'신규' 필터
  warmForPreview: (item: ListItem) => void // 착용 전 워밍(현재 연출 기준 메타·첫 프레임·이펙트·발색)
  bookmarks: ListItem[]; isBookmarked: (id: string) => boolean; toggleBookmark: (item: ListItem) => void; clearBookmarks: () => void
  listMode: ListMode; setListMode: Dispatch<ListMode>
  bgSel: string // 지금 프리셋의 미리보기 배경(snapshot().bg 와 같은 값)
  listDir: ListDir; setListDir: Dispatch<ListDir> // 목록을 넘기는 방향(가로 · 세로) — 기본 가로
  bindVp: (el: HTMLDivElement | null) => void
  bindTrack: (el: HTMLDivElement | null) => void // 스와이프 중 손가락 따라가기(DOM 직접 갱신)
  snapFrom: number // 스냅 애니메이션 직전 페이지 — 애니메이션 중엔 새 페이지 마운트를 미룬다
  consumeSwipeClick: () => boolean // 스와이프 직후의 카드 클릭은 착용으로 처리하지 않는다
  curIdx: number; pageCount: number
  bp: Breakpoint; cols: number; rows: number; itemsPerPage: number
  // ── 코디 광장 ──
  plazaPosts: PlazaPost[]; plazaList: PlazaPost[]; plazaLoading: boolean; plazaReady: boolean
  plazaFilter: PlazaFilter; setPlazaFilter: Dispatch<PlazaFilter>
  plazaSort: PlazaSort; setPlazaSort: Dispatch<PlazaSort>
  plazaQ: string; setPlazaQ: (v: string) => void
  plazaUpload: boolean; setPlazaUpload: Dispatch<boolean>
  plazaCols: number; plazaRows: number
  openPlazaPost: (post: PlazaPost) => void
  openNotice: () => void
  // 기능 안내의 '열어 보기': 창을 닫고 그 탭 · 창으로 가서 요소를 잠깐 가리킨다(lib/guide)
  guideGo: (g: { go?: GuideGo }) => void
  plazaTakeDirect: (post: PlazaPost) => void
  wearFromSnap: (snap: Snapshot, slots: string[], label?: string) => Promise<void>
  isWornFromSnap: (snap: Snapshot, slot: string, item: ListItem | null) => boolean
  plazaTakeBack: () => void
  resolveSnapItems: (snap: Snapshot) => Promise<Record<string, ListItem | null>>
  plazaLike: (post: PlazaPost) => void
  plazaRemove: (post: PlazaPost) => void
  plazaCopyLink: (post: PlazaPost) => void
  plazaSubmit: (draft: Omit<PlazaDraft, 'shareCode'>) => Promise<boolean>
  plazaSubmitting: boolean
  snapping: boolean
  setIdx: (i: number, snap?: boolean) => void; step: (dir: number) => void
  pageEditing: boolean; pageInput: string
  onPageFocus: (e: React.FocusEvent<HTMLInputElement>) => void
  onPageChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  onPageKey: (e: React.KeyboardEvent<HTMLInputElement>) => void
  commitPage: () => void
  // 착용(실제)
  equipped: Record<string, ListItem | null>
  tone: number
  equipFromCat: (cat: string, item: ListItem) => void // 슬롯 라디오 토글(재클릭 해제)
  equipItem: (item: ListItem) => void                 // 토글 없이 착용(염색 적용 시)
  isEquippedInCat: (cat: string, itemId: string) => boolean
  unequipSlot: (slot: string, label?: string) => void
  hidden: Record<string, boolean>; setHidden: Dispatch<Record<string, boolean>>
  // 염색(slot 키)
  dyeTarget: string | null; setDyeTarget: Dispatch<string | null>
  dyePalette: Record<string, PaletteParams>; setDyePalette: Dispatch<Record<string, PaletteParams>> // hair/face 발색(색인덱스)
  dyeHsb: Record<string, HsbParams>; setDyeHsb: Dispatch<Record<string, HsbParams>> // 그 외 캐시 아이템(Prism HSB)
  // 염색 비활성화(slot 키): 수치는 그대로 두고 렌더에서만 뺀다. 렌더(미리보기·카드·썸네일)는 render* 를 쓴다.
  dyeOff: Record<string, boolean>; toggleDyeOff: (slot: string) => void
  renderPalette: Record<string, PaletteParams>; renderHsb: Record<string, HsbParams>
  isMixSlot: (slot: string) => boolean
  // 단일 서피스(연출 설정 · 북마크 · 염색 · 점 위치)
  surface: Surface | null; surfaceClosing: boolean
  openSheet: (kind: 'pv' | 'bm' | 'part' | 'bg' | 'emo') => void // emo = 채팅 이모티콘(모바일)
  openDye: (item: ListItem) => void
  openCard: () => void // 코디 프로필(공유 카드) 만들기 창
  openDot: (item: ListItem) => void
  closeSurface: () => void
  // 부위 염색: 칩 선택 → 염색/점 위치로(가로 슬라이드), 이전 → 부위 고르기로. partSlide = 본문 translateX(px).
  openPartItem: (item: ListItem) => void; partBack: () => void; partSlide: number
  // 코디 비교: 칸(cmpIds — A B C D) = 프리셋 목록에 없는 프리셋. 비교 중 = 고른 프리셋이 비교 칸(cmpOn). cmpBack = 끝내면 돌아갈 프리셋
  cmpOn: boolean; cmpIds: string[]; cmpBack: string | null
  toggleCompare: () => void; pickCmp: (id: string) => void; addCmp: () => void; removeCmp: (id: string) => void
  // 점(애교점) 위치 오프셋(아이템ID 키 → 레이어이름 → 오프셋)
  dotPos: Record<string, DotOffsets>
  setDot: (itemId: string, layer: string, v: Vec) => void; resetDot: (itemId: string) => void
  // preview
  pv: Pv; setPv: (key: keyof Pv, val: Pv[keyof Pv]) => void
  // presets
  presets: Preset[]; presetData: Record<string, Snapshot>; selectedPreset: string | null
  presetUsed: number
  // 현재 라이브 모델 → 스냅샷. 프리셋 "선택됨" 카드가 저장본 대신 이걸로 그려진다(우측 미리보기와 100% 동일).
  //  ⚠️ 미리보기에 영향 주는 새 상태(점 위치·염색 등)를 추가하면 snapshot()만 갱신하면 프리셋 카드에도 자동 반영된다.
  snapshot: () => Snapshot
  undo: () => void; redo: () => void; canUndo: boolean; canRedo: boolean
  selectPreset: (id: string) => void; sharePreset: (p: Preset) => void; resetPreset: (id: string) => void
  renamePreset: (id: string, name: string) => void
  reorderPresets: (ids: string[]) => void // 카드를 끌어 옮긴 순서(프리셋 id 전부)
  commitPresetName: (id: string, fallback: string) => void // 이름 입력 확정 = 되돌리기 기록 한 건
  nickInput: string; setNickInput: Dispatch<string>
  importFetch: () => void
  importing: boolean
  // 코디 선택(닉네임 불러오기) — 코디 × 치장 프리셋 고르기
  lookPick: { nick: string; options: LookOption[] } | null
  chooseLook: (lookKey: string, presetKey: string) => void; closeLookPick: () => void
  shareCurrentLink: () => void
  applySharedToPreset: (snap: Snapshot, targetId: string) => void
  rateCodi: () => void
  rating: boolean                  // 평가를 받아 오는 중(핑크빈이 살펴보고 있다)
  rateBusy: boolean                // 평가가 진행 중이다(받아 오는 중 + 핑크빈이 말하고 나갈 때까지). 그동안 평가 버튼을 못 누른다
  endRate: () => void              // 핑크빈이 나갔다(preview/PinkbeanRate 가 부른다)
  rateResult: { lines: RateLine[]; nonce: number } | null
  takeRate: () => RateLine[] | null // 아직 안 띄운 평가만 한 번 내준다(두 번째부터는 null)
  // toast
  toast: boolean; toastText: string
  notify: (msg: string) => void
}

const Ctx = createContext<ShopCtx | null>(null)
export const useShop = () => {
  const v = useContext(Ctx)
  if (!v) throw new Error('useShop must be used within <ShopProvider>')
  return v
}

export function ShopProvider({ children }: { children: React.ReactNode }) {
  // ── 데이터 ──
  const [index, setIndex] = useState<Index | null>(null)
  const [lists, setLists] = useState<Record<string, ListItem[]>>({})
  const [dataLoading, setDataLoading] = useState(true)

  // ── UI ──
  // 탭은 주소와 짝이다(lib/tabRoute). 처음 값은 들어온 주소에서 읽고, 바꿀 때는 상태를 먼저 바꾼 뒤 주소를 따라 적는다 —
  // 주소 이동(서버 왕복)으로 화면을 바꾸지 않으므로 탭은 그 자리에서 바로 바뀐다. 뒤로 · 앞으로는 주소를 보고 상태를 맞춘다.
  const segment = useSelectedLayoutSegment()
  const [primary, setPrimaryState] = useState(() => tabOfPath('/' + (segment ?? '')))
  const setPrimary = useCallback((tab: string) => {
    setPrimaryState(tab)
    const path = TAB_PATH[tab]
    try { if (path && window.location.pathname !== path) window.history.pushState(null, '', path + window.location.search) } catch {} // 주소를 못 바꿔도 탭은 바뀐다
  }, [])
  useEffect(() => {
    const onPop = () => setPrimaryState(tabOfPath(window.location.pathname))
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])
  const titled = useRef(false)
  useEffect(() => {
    if (!titled.current) { titled.current = true; return } // 처음 제목은 서버가 낸 것(공유 링크는 프리셋 이름)을 둔다
    document.title = TAB_TITLE[primary] ? `핑크빈 커마샵 - ${TAB_TITLE[primary]}` : '핑크빈 커마샵'
  }, [primary])
  const [searchQuery, setSearchQuery] = useState<string | null>(null) // AI 코디 검색어(null=미검색)
  const [aiQ, setAiQ] = useState('')
  const [activeCat, setActiveCat] = useState('all') // 기본 = 전체(모든 부위 한 리스트)

  // 즐겨찾기: 아이템 id Set. SSR 안전을 위해 빈 값으로 시작 → 클라이언트에서 localStorage 하이드레이트.
  const [favorites, setFavoritesState] = useState<Set<string>>(new Set())
  const [newIds, setNewIds] = useState<Set<string>>(new Set())
  useEffect(() => { loadNewItems().then(setNewIds).catch(() => {}) }, [])
  useEffect(() => { try { const raw = localStorage.getItem(FAV_KEY); if (raw) setFavoritesState(new Set(JSON.parse(raw))) } catch { /* noop */ } }, [])
  const toggleFavorite = useCallback((id: string) => {
    setFavoritesState((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      try { localStorage.setItem(FAV_KEY, JSON.stringify([...next])) } catch { /* noop */ }
      return next
    })
  }, [])

  // 북마크(간이 가방): 아이템을 임시로 담아뒀다가 눌러서 입혀보는 용도. 최대 8개, localStorage 영속.
  // 슬롯 리스트를 다시 받지 않아도 그릴 수 있게 ListItem 을 그대로 저장한다.
  const [bookmarks, setBookmarks] = useState<ListItem[]>([])
  useEffect(() => {
    try { const raw = localStorage.getItem(BOOKMARK_KEY); if (raw) { const v = JSON.parse(raw); if (Array.isArray(v)) setBookmarks(v.slice(0, BOOKMARK_MAX)) } } catch { /* noop */ }
  }, [])
  const saveBookmarks = (next: ListItem[]) => { try { localStorage.setItem(BOOKMARK_KEY, JSON.stringify(next)) } catch { /* noop */ } }

  // 공유 링크 수신: ?n=<이름>&c=<짧은 코드 PB-…|긴 코드> 또는 #c=<code>(해시 형식 링크)로 접속하면 디코드해 '공유받은 코디' 화면(서피스 ptake)을 띄운다.
  //  · 쿼리(?c=)를 쓰는 이유: 모바일 카톡 등 일부 링크파서가 '#' 이후를 하이퍼링크로 인식하지 못한다.
  //  · 창/탭 조율(포커스·자동닫기)은 일부 환경(카톡·모바일 다중탭)에서 불가·불일치라 의도적으로 넣지 않음 — 그냥 이 탭에서 처리.
  useEffect(() => {
    let code: string | null = null
    try {
      code = new URLSearchParams(location.search).get('c')
      if (!code) { const h = location.hash.match(/(?:^#|&)c=([^&]+)/); if (h) code = decodeURIComponent(h[1]) }
    } catch { /* noop */ }
    if (!code) return
    try { history.replaceState(null, '', location.pathname) } catch {} // URL 청소: 새로고침 재적용 방지
    let cancelled = false
    resolveShareCode(code).then((snap) => { if (!cancelled && snap) openShared(snap) }).catch(() => {})
    return () => { cancelled = true }
  }, [])
  const [listMode, setListMode] = useState<ListMode>('model') // 기본=기본 캐릭터(코디는 모델이 기본)
  // 목록 넘기는 방향. 가로 = 지금까지의 넘기기, 세로 = 같은 넘기기를 위아래로(PC · 절반 · 태블릿은 한 쪽씩, 모바일은 목록 안 세로 스크롤 — ListArea).
  const [listDir, setListDir] = useState<ListDir>('x')
  const listDirRef = useRef<ListDir>('x')
  listDirRef.current = listDir
  const [search, setSearch] = useState('')
  const [equipped, setEquipped] = useState<Record<string, ListItem | null>>({})
  const [tone, setTone] = useState(0)
  const [hidden, setHidden] = useState<Record<string, boolean>>({})
  const [dyeTarget, setDyeTarget] = useState<string | null>(null)
  const [dyePalette, setDyePalette] = useState<Record<string, PaletteParams>>({})
  const [dyeHsb, setDyeHsb] = useState<Record<string, HsbParams>>({})
  const [dyeOff, setDyeOff] = useState<Record<string, boolean>>({})
  const toggleDyeOff = useCallback((slot: string) => setDyeOff((p) => { const n = { ...p }; if (n[slot]) delete n[slot]; else n[slot] = true; return n }), [])
  const renderPalette = useMemo(() => { const o: Record<string, PaletteParams> = {}; for (const [k, v] of Object.entries(dyePalette)) if (!dyeOff[k]) o[k] = v; return o }, [dyePalette, dyeOff])
  const renderHsb = useMemo(() => { const o: Record<string, HsbParams> = {}; for (const [k, v] of Object.entries(dyeHsb)) if (!dyeOff[k]) o[k] = v; return o }, [dyeHsb, dyeOff])
  const [surface, setSurface] = useState<Surface | null>(null)
  const surfaceRef = useRef<Surface | null>(null); surfaceRef.current = surface // 콜백에서 지금 열린 서피스를 본다
  const [surfaceClosing, setSurfaceClosing] = useState(false)
  const [partSlide, setPartSlide] = useState(0)
  // 코디 광장: 목록은 한 번 받아 두고 거르기·정렬은 화면에서(검색이 즉시 반응).
  const [plazaPosts, setPlazaPosts] = useState<PlazaPost[]>([])
  const [plazaLoaded, setPlazaLoaded] = useState(false) // 첫 로드가 끝났는지(스켈레톤은 이 전에만)
  const [plazaFilter, setPlazaFilter] = useState<PlazaFilter>('all')
  // 기본은 **최신순**. 인기순은 '좋아요 → 같으면 최신' 이라 초기에는 결과가 최신순과 같으면서,
  // 먼저 좋아요를 받은 글이 1페이지를 계속 차지해 새 글이 묻히는 고착만 만든다.
  // 정렬이 진입 시 한 번 고정이고 좋아요 수는 최대 3분 캐시라 그 고착이 더 오래간다.
  const [plazaSort, setPlazaSort] = useState<PlazaSort>('recent')
  const [plazaGen, setPlazaGen] = useState(0) // 목록을 새로 받아온 횟수 — 정렬을 다시 잡는 기준
  const [plazaQ, setPlazaQState] = useState('')
  const [plazaUpload, setPlazaUpload] = useState(false)
  const [plazaSubmitting, setPlazaSubmitting] = useState(false)
  const [plazaGrid, setPlazaGrid] = useState<{ cols: number; rows: number }>({ cols: 6, rows: 3 })
  const partT = useRef<ReturnType<typeof setTimeout>[]>([])
  const [dotPos, setDotPos] = useState<Record<string, DotOffsets>>({}) // 아이템ID → 점 레이어별 위치 오프셋
  const [pageByCat, setPageByCat] = useState<Record<string, number>>({})
  const [snapping, setSnapping] = useState(false)
  const [snapFrom, setSnapFrom] = useState(0)
  const trackRef = useRef<HTMLDivElement | null>(null)
  const [pageEditing, setPageEditing] = useState(false)
  const [pageInput, setPageInput] = useState('')
  const [pv, setPvState] = useState<Pv>(PV_DEFAULT)
  const [presets, setPresets] = useState<Preset[]>(() => PRESET_IDS.map((id, i) => ({ id, name: defaultPresetName(i) })))
  const stageBg = useStageBg() // 미리보기 배경(lib/stageBg — React 바깥 저장소)
  // 스냅샷 · 자동 저장 · 되돌리기 기록이 보는 배경은 이 상태다. 바깥 저장소는 따로 다시 그려질 수 있어(동기 갱신), 프리셋 적용 · 되돌리기 중에
  // '배경만 먼저 바뀐' 렌더가 끼면 그 중간 상태가 기록 한 건이 된다 → applySnapshot 은 이것을 코디와 같은 묶음으로 바꾸고, 사용자가 고른 배경은 아래 effect 가 옮긴다
  const [bgSel, setBgSel] = useState(stageBg.sel)
  useEffect(() => { setBgSel(stageBg.sel) }, [stageBg.sel])
  const [presetData, setPresetData] = useState<Record<string, Snapshot>>(() => Object.fromEntries(PRESET_IDS.map((id) => [id, defaultSnapshot()])))
  // 처음엔 **아무것도 선택하지 않는다**. 'd0' 으로 시작하면 저장소를 읽기 전 잠깐 1번 칸에
  // '선택됨' 띠지가 붙었다가 실제 프리셋으로 옮겨 간다. 아래 초기 로드에서 채운다.
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null)
  const [cmpIds, setCmpIds] = useState<string[]>([])
  const [cmpBack, setCmpBack] = useState<string | null>(null)
  const cmpLast = useRef<string | null>(null)
  const cmpSeq = useRef(0)
  const cmpOn = isCmpId(selectedPreset)
  const [nickInput, setNickInput] = useState('')
  const [importing, setImporting] = useState(false) // 불러오기 진행 중(로딩 애니메이션)
  // 코디가 2벌인 캐릭터(제로=알파/베타, 엔젤릭버스터=일반/드레스업) → 어느 걸 가져올지 고르는 다이얼로그.
  const [lookPick, setLookPick] = useState<{ nick: string; options: LookOption[] } | null>(null)
  const [toast, setToast] = useState(false)
  const [toastText, setToastText] = useState('')

  const vpElRef = useRef<HTMLDivElement | null>(null)
  const vpRo = useRef<ResizeObserver | null>(null)
  const indexRef = useRef<Index | null>(null)      // 최신 index(리스트 로드/아이템 해석용, 상태 세팅 전에도 사용)
  const applyingRef = useRef(false)                 // 프리셋 적용 중(그 변경은 자동저장 스킵)
  const initedRef = useRef(false)                   // 초기 로드+적용 완료(그 전엔 저장/영속 안 함)
  // 실행취소/다시실행: 코디 상태(equipped/tone/dye/hidden) 스냅샷 히스토리 + 현재 위치.
  // 히스토리 엔트리 = 코디 스냅샷 + 그때 선택돼 있던 프리셋. 되돌리기 시 코디뿐 아니라 "선택 프리셋"도
  // 함께 복원한다 → 프리셋 전환도 되돌리기 대상(1번→2번 후 되돌리기 = 다시 1번 선택 + 그때 코디).
  // 다른 프리셋을 덮어쓴 기록(공유 코디·광장 가져오기)은 over 에 그 프리셋의 전후 내용·이름을 함께 남긴다(uiState.PresetOver).
  // 엔트리마다 그때의 프리셋 이름 전체(names)도 담는다 — 되돌리기는 코디·연출(시선·배율 등)·선택 프리셋·**이름**을
  // 함께 되살린다. 이름을 over(다른 칸 덮어쓰기)에만 두면 가져오기로 바뀐 이름이 되돌아오지 않는 경우가 생기고
  // 이름을 고친 것 자체도 기록되지 않는다. 이름 변경도 기록 한 건이다.
  // 기록은 갈래마다 따로다(사용자 지시): 비교 중이면 고른 칸마다 제 기록, 아니면 하나('main'). 칸을 고르는 것은 기록이 아니다 —
  // 칸을 바꾸면 그 칸의 기록으로 넘어갈 뿐이고, 처음 고른 칸은 그때의 코디가 첫 기록(되돌릴 바닥)이 된다.
  // 갈래마다 최근 50개라 비교 칸 넷을 다 써도 기록은 최대 250개(작은 스냅샷 객체)다. 뺀 칸의 기록은 함께 버린다(removeCmp).
  type Hist = { stack: { snap: Snapshot; sel: string | null; names?: Record<string, string>; over?: PresetOver<Snapshot> }[]; idx: number; last: string | null }
  const histsRef = useRef<Map<string, Hist>>(new Map())
  const histOf = (sel: string | null): Hist => {
    const k = isCmpId(sel) ? sel! : 'main'
    let h = histsRef.current.get(k)
    if (!h) { h = { stack: [], idx: -1, last: null }; histsRef.current.set(k, h) }
    return h
  }
  const histOver = useRef<PresetOver<Snapshot> | null>(null) // 다음 기록에 붙일 덮어쓰기(applySharedToPreset)
  const histExpect = useRef<string | null>(null)    // undo/redo 로 적용 중인 상태키(그 변경은 기록 안 함)
  const [histVer, setHistVer] = useState(0)         // canUndo/canRedo 재계산 트리거
  const saveT = useRef<ReturnType<typeof setTimeout> | null>(null)
  const toastT = useRef<ReturnType<typeof setTimeout> | null>(null)
  const surfT = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pageT = useRef<ReturnType<typeof setTimeout> | null>(null)
  const snapT = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wheel = useRef({ acc: 0, dir: 0, t: 0 }) // 휠 delta 누적 / 제스처 방향 / 마지막 이벤트 시각
  const swipe = useRef({ on: false, id: -1, x0: 0, y0: 0, mode: null as 'x' | 'y' | null, lx: 0, lt: 0, vx: 0, w: 1 })
  const swipeClickUntil = useRef(0)

  // ── 초기 로드: index → 저장된 프리셋(없는 칸은 기본값) 복원 → 선택된 프리셋을 라이브 모델에 적용 ──
  useEffect(() => {
    let alive = true
    // 연출 옵션 데이터(형상변이/이펙트 인덱스)를 미리 캐시 → 선택 시 즉시 적용.
    loadAnima().catch(() => {})
    loadEffectIndex().catch(() => {})
    loadIndex().then(async (idx) => {
      if (!alive) return
      indexRef.current = idx // resolveEquipped/loadSlotFolded 는 상태가 아닌 이 ref 를 쓰므로 setIndex 전에 사용 가능
      // 여러 부위를 한 목록으로 보는 탭(전체 등)이면 모든 부위 목록을 지금 함께 받기 시작한다 — 아래의 프리셋 복원이
      // 착용 부위 목록을 다 받을 때까지 기다렸다 나머지를 보내면 왕복 한 번이 더 든다. loadSlot 이 파일별로 캐시하므로
      // 뒤의 ensureSlot·resolveEquipped 는 같은 요청을 이어받는다.
      if (isMultiCat(activeCatRef.current)) for (const c of CATS) { const f = c.id === 'skin' ? undefined : slotFile(CAT_TO_SLOT[c.id], idx); if (f) loadSlot(f).catch(() => {}) }
      // localStorage 에서 프리셋 복원(저장된 칸은 그대로, 없는 칸만 코디 기본값). 첫 접속 시 d0 자동 선택.
      const store = loadPresetStore()
      const data: Record<string, Snapshot> = {}
      const migrate = !store || (store.v ?? 1) < PRESET_STORE_V
      PRESET_IDS.forEach((id) => { const st = store?.data[id]; data[id] = st ? (migrate ? migrateLegacyDefault(st) : st) : defaultSnapshot() })
      // 이관 끝을 바로 기록한다 — 다음 저장을 기다리면 그 전 새로고침에서 또 돈다.
      if (store && migrate) { try { localStorage.setItem(PRESET_KEY, JSON.stringify({ ...store, data: { ...store.data, ...Object.fromEntries(PRESET_IDS.filter((id) => store.data[id]).map((id) => [id, data[id]])) }, v: PRESET_STORE_V } as PresetStore)) } catch {} }
      const back = (store?.sel && PRESET_IDS.includes(store.sel)) ? store.sel : 'd0'
      // 비교 칸(따로 저장). 비교 중에 닫았으면 그 칸으로 다시 연다
      const cs = loadCmpStore()
      const cids = (cs?.ids ?? []).filter((id) => isCmpId(id) && cs!.data[id]).slice(0, CMP_MAX)
      // 두 칸이 안 되는 저장(예전에 한 칸까지 뺄 수 있었다)은 첫 칸의 복사본으로 채운다
      while (cids.length && cids.length < CMP_MIN) { const id = 'cmp' + Date.now().toString(36) + cids.length; data[id] = cs!.data[cids[0]]; cids.push(id) }
      for (const id of cids) data[id] = data[id] ?? cs!.data[id]
      cmpLast.current = cs?.last && cids.includes(cs.last) ? cs.last : null
      const sel = cs?.on && cmpLast.current ? cmpLast.current : back
      // 선택된 프리셋을 라이브 모델로 해석(필요한 슬롯 리스트 로드). 그 뒤 index/프리셋/모델을 한 배치로 세팅
      // → 적용으로 인한 변경은 자동저장 1회만 발생하고 applyingRef 로 스킵된다.
      const snap = data[sel] || defaultSnapshot()
      applyingRef.current = true
      const eq = await resolveEquipped(snap)
      if (!alive) return
      setIndex(idx)
      setPresetData(data)
      setPresets(presetOrder(store).map((id, i) => ({ id, name: store?.names[id] || defaultPresetName(i) })))
      setEquipped(eq); setTone(snap.tone ?? DEFAULT_TONE)
      setDyePalette({ ...(snap.dyePalette || {}) }); setDyeHsb({ ...(snap.dyeHsb || {}) }); setDyeOff({ ...(snap.dyeOff || {}) }); setHidden({ ...(snap.hidden || {}) })
      setDotPos({ ...(snap.dotPos || {}) })
      setSelectedPreset(sel)
      setCmpIds(cids); setCmpBack(back) // 프리셋 저장소의 sel 은 비교 중에도 돌아갈 프리셋이다(writePresetStore)
      // 연출설정 복원: 저장된 전역 pv 가 있으면 그대로(전체) 복원, 없으면(첫 로드/구유저) 선택 프리셋의 pv 서브셋으로.
      const savedPv = loadPv()
      if (savedPv) setPvState((prev) => ({ ...prev, ...savedPv }))
      else applyPvSnap(snap.pv)
      // 되돌리기 기록은 새로고침하면 비운다(사용자 지시) — 이 화면에서 한 일만 되돌린다. 쌓는 것은 쉰 개까지다.
      dropUiHistory()
      initedRef.current = true
    }).catch((e) => console.error('[shop] index 로드 실패', e))
      .finally(() => { if (alive) setDataLoading(false) })
    return () => { alive = false }
  }, [])

  // 부위 리스트 지연 로드(활성 부위만). loadSlot 은 data.ts 에서 파일별 캐시됨.
  const loadingSlots = useRef<Set<string>>(new Set())
  const ensureSlot = useCallback((slot: string) => {
    if (!index || slot === 'skin') return
    if (lists[slot] !== undefined || loadingSlots.current.has(slot)) return
    // 라이딩은 CDN index 에 없고 프론트 public 에서 서빙(절대경로 → data.ts url() 패스스루) — shopData.slotFile.
    const file = slotFile(slot, index)
    if (!file) { setLists((m) => ({ ...m, [slot]: [] })); return }
    loadingSlots.current.add(slot)
    loadSlot(file)
      .then((l) => setLists((m) => ({ ...m, [slot]: foldList(l) }))) // fold: 헤어/성형=검정 대표 1개, 장비=이름당 1개
      .catch(() => setLists((m) => ({ ...m, [slot]: [] })))
      .finally(() => loadingSlots.current.delete(slot))
  }, [index, lists])
  // 명찰 · 말풍선: 목록 파일이 있을 때만 부위를 더한다. 반지 바로 뒤.
  const [chatOn, setChatOn] = useState(false)
  const [chatDefault, setChatDefault] = useState<ChatUi | null>(null)
  useEffect(() => {
    fetch(CHAT_FILES.nameTag, { method: 'HEAD' }).then((r) => {
      setChatOn(r.ok)
      if (!r.ok) return
      prefetchGlyphs() // 글자 도트는 한가할 때 미리
      fetch(CHAT_DEFAULT_BALLOON).then((x) => (x.ok ? x.json() : null)).then((u: ChatUi | null) => { if (u?.parts) setChatDefault(u) }).catch(() => {})
      // 테스트 서버에 새로 나온 명찰 · 말풍선(본 서버에 없는 것) — NEW 라벨 · '신규' 필터에 더한다
      fetch(CHAT_NEW_FILE).then((x) => (x.ok ? x.json() : null)).then((j: { ids?: string[] } | null) => { if (j?.ids?.length) setNewIds((prev) => new Set([...prev, ...j.ids!])) }).catch(() => {})
    }).catch(() => {})
  }, [])
  const withChat = (extra: Cat[]) => { const i = CATS.findIndex((c) => c.id === 'ring') + 1; return [...CATS.slice(0, i), ...extra, ...CATS.slice(i)] }
  const cats = useMemo(() => (chatOn ? withChat(CHAT_CATS) : CATS), [chatOn])
  const infoCats = useMemo(() => (chatOn ? withChat(CHAT_INFO_CATS) : CATS), [chatOn])

  useEffect(() => {
    // '전체'·'즐겨찾기' 는 모든 부위를 한 리스트로 보여주므로 전 슬롯을 로드한다(각 슬롯은 캐시돼 1회만 받음).
    if (isMultiCat(activeCat)) { for (const c of cats) if (c.id !== 'skin') ensureSlot(CAT_TO_SLOT[c.id]); return }
    if (activeCat !== 'skin') ensureSlot(CAT_TO_SLOT[activeCat])
  }, [activeCat, ensureSlot, cats])

  // 채팅 칸에서 보낸 말 — 게임처럼 잠깐 떴다 사라진다.
  const [chatMsg, setChatMsg] = useState<ChatMsg | null>(null)
  const sendChat = useCallback((m: ChatMsg) => setChatMsg({ ...m, at: performance.now() }), [])
  useEffect(() => { if (!chatMsg) return; const t = setTimeout(() => setChatMsg(null), CHAT_SHOW_MS); return () => clearTimeout(t) }, [chatMsg])

  // 피부(skin) = index.base.tones 를 합성 리스트로. 그 외는 lists[slot].
  const skinList = useMemo<ListItem[]>(() => {
    if (!index) return []
    return index.base.tones.map((t) => ({
      id: t.body, slot: 'skin', isCash: false, grade: 'none', islot: null, vslot: null,
      dyeMode: 'hsb', thumb: `sprites/${t.body}/thumb.png`, headId: t.head, name: t.name || `피부 ${t.tone}`, actions: [],
    }))
  }, [index])
  const listForCat = useCallback((cat: string): ListItem[] => {
    if (cat === 'skin') return skinList
    // '전체' = 모든 부위를 CATS 순서(헤어→방패)로 이어붙인 하나의 리스트. 슬롯 내부 정렬은 그대로 유지.
    if (cat === 'all') return cats.flatMap((c) => (c.id === 'skin' ? skinList : lists[CAT_TO_SLOT[c.id]] || []))
    // '즐겨찾기' = 전 부위(피부 포함)에서 즐겨찾기한 아이템만. CATS 순서 유지. 전 슬롯 로드가 필요(위 ensureSlot).
    if (cat === 'fav') return cats.flatMap((c) => (c.id === 'skin' ? skinList : lists[CAT_TO_SLOT[c.id]] || [])).filter((it) => favorites.has(it.id))
    // '신규' = 최근 패치에서 추가된 아이템만(전 부위, CATS 순서). 헤어/성형은 폴딩 대표 id 로 매칭된다.
    if (cat === 'new') return cats.flatMap((c) => (c.id === 'skin' ? [] : lists[CAT_TO_SLOT[c.id]] || [])).filter((it) => newIds.has(it.id))
    return lists[CAT_TO_SLOT[cat]] || []
  }, [lists, skinList, favorites, newIds, cats])

  // 활성 부위 리스트 로딩중?(index 미로드 또는 해당 slot 미로드)
  const catLoading = dataLoading || (isMultiCat(activeCat)
    ? cats.some((c) => c.id !== 'skin' && lists[CAT_TO_SLOT[c.id]] === undefined)
    : activeCat !== 'skin' && lists[CAT_TO_SLOT[activeCat]] === undefined)

  // 성별 필터. 카탈로그의 gender(0=남 1=여 2=공용)를 쓴다.
  // ⚠️ "여"는 여 전용만이 아니라 **여캐가 입을 수 있는 것**(여 + 공용)이다. 남도 마찬가지.
  //    사람들이 원하는 건 "여자 전용템 목록"이 아니라 "내 캐릭터가 입을 수 있는 것만 보기"다.
  // 코디와 AI 코디 검색이 하단 부위 바·성별 필터를 공유한다.
  const [genderFilter, setGenderFilter] = useState<GenderFilter>('all')
  // gender: 0=남 1=여 2=공용. 공용과 미상(null)은 항상 남긴다 — 걸러서 얻는 게 없고 오히려 빠뜨린다.
  const byGender = useCallback((list: ListItem[], gf: GenderFilter) => {
    if (gf === 'all') return list
    const want = gf === 'f' ? 1 : 0
    return list.filter((it) => it.gender === want || it.gender === 2 || it.gender == null)
  }, [])
  const activeListFull = listForCat(activeCat)
  // 이름 검색: 공백 무시 + 한/영 자판 무관(lib/nameSearch). 입력은 즉시, 필터·리스트 갱신은 지연값으로(타이핑 끊김 방지).
  const deferredSearch = useDeferredValue(search)
  const activeList = useMemo(() => {
    const list = byGender(activeListFull, genderFilter)
    if (isEgg(deferredSearch)) return list.filter((it) => isEggItem(it.id))   // 이스터에그(lib/easterEgg)
    const match = nameMatcher(deferredSearch)
    if (!match) return list
    return list.filter((it) => match(it.name || it.id))
  }, [activeListFull, deferredSearch, byGender, genderFilter])

  // AI 코디 검색 결과 — 백엔드가 준 id 를 슬롯 "원본(비폴딩)" 리스트에서 정확히 해석해 실제 ListItem 으로 보관.
  // 원본 해석이라 스프라이트/라벨/염색이 정확하고, 코디탭과 동일하게 ItemThumb 로 렌더된다.
  const [searchResults, setSearchResults] = useState<ListItem[]>([])
  const [searchLoading, setSearchLoading] = useState(false)

  // ── 보던 자리 기억(새로고침까지만) ──
  // 실수로 새로고침해도 부위·검색어·페이지를 잃지 않는다(탭은 주소가 기억한다). 탭을 닫고 다시 들어오면
  // sessionStorage 가 비어 있으므로 저절로 첫 화면(코디 탭 · 전체 · 1페이지)에서 시작한다.
  //  · 되살리기는 **페인트 전**(layout effect)에 해서 기본 화면이 한 번 스치지 않게 한다.
  //  · 저장은 되살리기가 끝난 뒤에만 한다 — 먼저 돌면 기본값으로 덮어써 버린다.
  const [uiReady, setUiReady] = useState(false)
  useIsoLayoutEffect(() => {
    const u = readUiSession()
    if (typeof u.activeCat === 'string') setActiveCat(u.activeCat)
    if (typeof u.search === 'string') setSearch(u.search)
    if (u.pageByCat && typeof u.pageByCat === 'object') setPageByCat(u.pageByCat)
    // AI 코디 검색은 결과까지 되살린다 — 다시 검색하면 외부 API 왕복이라 느리고 결과가 달라질 수도 있다.
    if (typeof u.aiQ === 'string') setAiQ(u.aiQ)
    if (typeof u.searchQuery === 'string') setSearchQuery(u.searchQuery)
    if (Array.isArray(u.searchResults)) setSearchResults(u.searchResults)
    if (u.plazaFilter && PLAZA_FILTERS.some((f: { id: string }) => f.id === u.plazaFilter)) setPlazaFilter(u.plazaFilter as PlazaFilter)
    if (typeof u.plazaQ === 'string') setPlazaQState(u.plazaQ)
    // 광장 정렬 · 목록을 넘기는 방향은 **영구**다(취향에 가까운 값). 나머지는 전부 새로고침까지만.
    const pref = readUiPref()
    if (pref.plazaSort === 'popular' || pref.plazaSort === 'recent') setPlazaSort(pref.plazaSort)
    if (pref.listMode === 'sprite' || pref.listMode === 'model' || pref.listMode === 'mymodel') setListMode(pref.listMode)
    if (pref.listDir === 'x' || pref.listDir === 'y') { listDirRef.current = pref.listDir; setListDir(pref.listDir) } // 넘기는 방향도 영구(사용자 지시 — 늘 같은 방향)
    setUiReady(true)
  }, [])
  // 뼈대를 거두는 건 **되살린 화면이 실제로 커밋된 뒤**다(uiReady 가 켜진 다음 렌더).
  // 되살리기 effect 안에서 바로 지우면 setState 가 아직 반영되기 전이라 기본 화면이 한 프레임 새어 나간다.
  useIsoLayoutEffect(() => { if (uiReady) document.documentElement.removeAttribute(RESTORE_ATTR) }, [uiReady])
  useEffect(() => {
    if (!uiReady) return
    writeUiSession({
      activeCat, search, pageByCat, plazaFilter, plazaQ,
      aiQ, searchQuery, searchResults: searchResults.slice(0, SEARCH_KEEP),
    })
  }, [uiReady, activeCat, search, pageByCat, plazaFilter, plazaQ, aiQ, searchQuery, searchResults])
  useEffect(() => { if (uiReady) writeUiPref({ plazaSort, listDir, listMode }) }, [uiReady, plazaSort, listDir, listMode])
  const [rateResult, setRateResult] = useState<{ lines: RateLine[]; nonce: number } | null>(null) // 코디 평가(핑크빈이 하는 말)
  // 평가는 **눌러 받은 그 한 번만** 나온다(광장처럼 미리보기가 없는 탭에
  // 갔다 와도 지난 평가가 다시 나오지 않는다). PinkbeanRate 는 미리보기와 함께 언마운트됐다가 다시 붙으면서
  // 남아 있던 rateResult 로 effect 가 또 돈다. 그래서 '띄웠다'는 표시를 **컴포넌트 밖**(여기)에 둔다.
  const rateSeen = useRef(0)
  const rateLive = useRef<{ lines: RateLine[]; nonce: number } | null>(null)
  rateLive.current = rateResult
  const takeRate = useCallback((): RateLine[] | null => {
    const r = rateLive.current
    if (!r || r.nonce <= rateSeen.current) return null
    rateSeen.current = r.nonce
    return r.lines
  }, [])
  const [rating, setRating] = useState(false)
  // 평가는 한 번에 하나만: 누른 때부터 핑크빈이 걸어 나갈 때까지 잠근다. 상태(버튼을 못 누르게)와 ref(함수가 다시 들어오지 못하게) 둘 다 둔다.
  // 핑크빈이 끝을 알리지 못하는 경우(무대가 화면에서 사라짐)에도 풀리도록 한도를 둔다.
  const [rateShow, setRateShow] = useState(false)
  const rateLock = useRef(false), rateLockTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const endRate = useCallback(() => {
    if (rateLockTimer.current) { clearTimeout(rateLockTimer.current); rateLockTimer.current = null }
    rateLock.current = false; setRateShow(false)
  }, [])
  const searchRaw = useRef<Record<string, ListItem[]>>({}) // 슬롯 원본(비폴딩) 리스트 캐시
  // 복제 아이템 → 원본 아이템. 헤어 · 성형의 복제 묶음(dupOf)은 같은 색의 원본, 그 밖의 재출시 복제(dupId)는 원본 id.
  // 같은 그림이라 보이는 것은 같고, 목록에 있는 카드와 맞춰진다.
  const toOriginal = (raw: ListItem[], it: ListItem): ListItem => {
    if (it.dupId) return raw.find((x) => x.id === it.dupId) ?? it
    if (it.dupOf == null) return it
    const vid = variantId(it.dupOf, colorOf(parseInt(it.id, 10), it.slot), it.slot)
    return raw.find((x) => x.id === vid) ?? it
  }
  const loadSlotRaw = useCallback(async (slot: string): Promise<ListItem[]> => {
    if (searchRaw.current[slot]) return searchRaw.current[slot]
    // ⚠️ 라이딩도 여기서 해석된다(shopData.slotFile). CDN index 만 뒤지면 빈 목록이 나오고,
    //    스냅샷 복원(resolveEquipped)이 이걸 쓰는 탓에 프리셋을 다시 고르면 탈것이 사라진다.
    const file = slotFile(slot, indexRef.current)
    if (!file) return []
    try { const r = await loadSlot(file); searchRaw.current[slot] = r; return r } catch { return [] }
  }, [])
  const activeCatRef = useRef(activeCat)
  activeCatRef.current = activeCat
  const skinListRef = useRef(skinList)
  skinListRef.current = skinList
  const runSearch = useCallback(async (query: string) => {
    const t = query.trim(); if (!t) return
    setSearchQuery(t); setSearchLoading(true); setSearchResults([])
    setPageByCat((s) => ({ ...s, ['search:' + activeCatRef.current]: 0 }))
    try {
      if (isEgg(t)) {
        // 이스터에그(lib/easterEgg): 서버에 묻지 않고 정해진 아이템만 돌려준다
        const got = await Promise.all(EGG_ITEMS.map(async (e) => (e.slot === 'skin' ? skinListRef.current : await loadSlotRaw(e.slot)).find((it) => it.id === e.id)))
        setSearchResults(got.filter((x): x is ListItem => !!x))
        return
      }
      const res = await fetch(`${backApi()}/search`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: t, slot: null, topK: 100 }),
      })
      const data = await res.json()
      const hits: { id: string; slot: string }[] = data.results || []
      const slots = Array.from(new Set(hits.map((h) => h.slot)))
      const raws = new Map(await Promise.all(slots.map(async (sl) => [sl, await loadSlotRaw(sl)] as const)))
      const maps = new Map([...raws].map(([sl, raw]) => [sl, new Map(raw.map((it) => [it.id, it]))] as const))
      // 복제 묶음은 원본으로 바꾸고, 그래서 겹친 것은 한 번만 낸다.
      const seen = new Set<string>()
      const list = hits.map((h) => { const it = maps.get(h.slot)?.get(h.id); return it && toOriginal(raws.get(h.slot) || [], it) })
        .filter((x): x is ListItem => !!x && !seen.has(x.id) && !!seen.add(x.id))
      setSearchResults(list)
    } catch { setSearchResults([]) } finally { setSearchLoading(false) }
  }, [loadSlotRaw])

  // ── 반응형 그리드: 뷰포트를 측정해 카드 비율(PC 6×3 ≈ 1.34)에 가장 가까운 열·행 조합을 고른다 ──
  const bp = useBreakpoint()
  const bpRef = useRef(bp)
  bpRef.current = bp
  const primaryRef = useRef(primary)
  primaryRef.current = primary
  const [grid, setGrid] = useState<{ cols: number; rows: number }>({ cols: 6, rows: 3 })
  const measure = useCallback(() => {
    const el = vpElRef.current
    if (!el || !el.clientWidth || !el.clientHeight) return
    const vp = bpRef.current
    const apply = (cols: number, rows: number) => setGrid((g) => (g.cols === cols && g.rows === rows ? g : { cols, rows }))
    // 코디 광장은 열 수가 고정(모바일 2 · 절반/태블릿 3 · PC 6)이고 행만 높이에 맞춰 최대 3줄.
    if (primaryRef.current === 'share') {
      const mob = vp === 'mobile'
      const pcols = mob ? 2 : (vp === 'half' || vp === 'tablet') ? 3 : 6
      const minH = mob ? 132 : 150, gapPx = mob ? 9 : 10
      const avail = el.clientHeight - 20
      const prows = Math.max(1, Math.min(3, Math.floor((avail + gapPx) / (minH + gapPx))))
      setPlazaGrid((g) => (g.cols === pcols && g.rows === prows ? g : { cols: pcols, rows: prows }))
      return
    }
    if (vp === 'mobile') { apply(3, 2); return }
    const gap = 10, pad = 20
    const TARGET = 1.34, MINW = 78, MINH = 96
    const w = el.clientWidth - pad, h = el.clientHeight - pad
    const colRange = vp === 'half' ? [3] : vp === 'tablet' ? [3, 4, 5] : [3, 4, 5, 6]
    const rowRange = [2, 3, 4, 5]
    // TARGET 편차 최소만으로 고르면 화면 높이에 따라 PC 1920×1080 에서 4×2, 절반 창에서 5×4 처럼 크게 흔들린다.
    // 의도 밀도(PC 6×3 · 절반 3×3)를 지키도록: 세로형 비율 범위 [1.12, TARGET×1.3] 안에서 "가장 많이 보이는" 조합,
    // 같은 수면 TARGET 에 가까운 쪽. 범위 안 조합이 없을 때만 편차 최소로 폴백.
    const RMIN = 1.12, RMAX = TARGET * 1.3
    let best: { cols: number; rows: number; dev: number } | null = null
    let near: { cols: number; rows: number; dev: number } | null = null
    for (const cols of colRange) for (const rows of rowRange) {
      const cardW = (w - gap * (cols - 1)) / cols
      const cardH = (h - gap * (rows - 1)) / rows
      if (cardW < MINW || cardH < MINH) continue
      const ratio = cardH / cardW
      if (ratio < RMIN) continue // 카드는 항상 세로로 긴 형태 유지
      const dev = Math.abs(ratio - TARGET) / TARGET
      if (!near || dev < near.dev) near = { cols, rows, dev }
      if (ratio > RMAX) continue
      const n = cols * rows, bn = best ? best.cols * best.rows : 0
      if (!best || n > bn || (n === bn && dev < best.dev)) best = { cols, rows, dev }
    }
    best = best || near
    if (!best) best = { cols: 3, rows: Math.max(1, Math.min(3, Math.floor((h + gap) / (MINH + gap)))), dev: 0 }
    // 최소 카드 높이 가드: 어떤 경로로 골랐든 96px 미만 행은 만들지 않는다(띠지가 아트워크를 덮지 않게).
    const fitRows = Math.max(1, Math.floor((h + gap) / (MINH + gap)))
    if (best.rows > fitRows) best = { ...best, rows: fitRows }
    apply(best.cols, best.rows)
  }, [])
  useEffect(() => { measure() }, [bp, primary, measure])
  const { cols, rows } = grid
  const itemsPerPage = cols * rows

  // ── 페이징 대상: AI 검색 탭이면 검색결과(부위 바·성별 필터), 아니면 활성 부위 리스트 ──
  const searchResultsView = useMemo(() => {
    let out = searchResults
    if (activeCat === 'fav') out = out.filter((it) => favorites.has(it.id))
    else if (activeCat === 'new') out = out.filter((it) => newIds.has(it.id))
    else if (activeCat === CHAT_TAB) out = out.filter((it) => it.slot === 'nameTag' || it.slot === 'chatBalloon') // 명찰/말풍선 탭은 두 부위를 함께 보인다
    else if (activeCat !== 'all') out = out.filter((it) => it.slot === CAT_TO_SLOT[activeCat])
    return byGender(out, genderFilter)
  }, [searchResults, activeCat, favorites, newIds, byGender, genderFilter])
  // 정렬은 **화면에 들어올 때 한 번만** 확정한다 — 좋아요를 누를 때마다 카드가 자리를 바꾸면 보던 곳을 잃는다.
  // 같은 (분류·검색어·정렬·목록 세대) 안에서는 처음 잡은 순서를 그대로 쓰고, 그 사이 새로 생긴 글(내 등록)만 맨 앞에 붙는다.
  const plazaOrder = useRef<{ key: string; ids: string[] }>({ key: '', ids: [] })
  const plazaList = useMemo(() => {
    const view = plazaView(plazaPosts, plazaFilter, plazaQ, plazaSort)
    const key = `${plazaFilter}|${plazaQ}|${plazaSort}|${plazaGen}`
    if (plazaOrder.current.key !== key) {
      plazaOrder.current = { key, ids: view.map((p) => p.id) }
      return view
    }
    const rank = new Map(plazaOrder.current.ids.map((id, i) => [id, i] as const))
    // 새 글이 맨 앞에 붙어도 대회 수상작보다 앞설 수는 없다(plazaPin).
    const out = plazaPin(view.slice().sort((a, b) => (rank.get(a.id) ?? -1) - (rank.get(b.id) ?? -1)), plazaFilter)
    // 새로 들어온 글(내 등록)까지 포함해 다시 고정한다 — 안 그러면 그 글만 좋아요 때마다 자리를 옮긴다.
    plazaOrder.current = { key, ids: out.map((p) => p.id) }
    return out
  }, [plazaPosts, plazaFilter, plazaQ, plazaSort, plazaGen])
  // 프리셋 카드와 광장 첫 쪽을 **탭을 누르기 전에** 미리 합성해 둔다. 합성 결과와 그림이 캐시에 있으면 탭을 누른 순간
  // 카드가 뼈대 없이 그 자리에서 그려진다(SnapThumb 의 composePeek). 첫 화면이 자리를 잡고 한가해진 뒤에, 보이는 카드가
  // 하나도 줄을 서 있지 않을 때만 돈다(lib/thumbQueue 의 낮은 순위). 데이터 절약 모드면 하지 않는다.
  // 광장 첫 쪽: 가장 넓은 화면의 한 쪽(9열 × 3줄 = 27장)을 덮게 30장
  const warmPosts = useMemo(() => plazaList.slice(0, 30).map((p) => p.snapshot), [plazaList])
  useEffect(() => {
    if (!index || dataLoading) return
    if ((navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData) return
    const jobs: { cancel: () => void }[] = []
    const t = window.setTimeout(() => {
      warmDye()   // 염색 연산의 WebAssembly 조각도 한가할 때 받아 둔다(첫 염색부터 빠르게)
      animaOnce().then((races) => {
        const seen = new Set<string>()
        for (const snap of [...presets.slice(0, PRESET_WARM).map((p) => presetData[p.id]).filter(Boolean), ...warmPosts]) {
          const key = snapKey(snap)
          if (seen.has(key) || composePeek(key, index, races) !== undefined) continue
          seen.add(key)
          jobs.push(enqueueThumb(2, () => composeSnapshotCached(key, snap, index, races).then(() => undefined)))
        }
      }).catch(() => {})
    }, 1500)
    return () => { window.clearTimeout(t); for (const j of jobs) j.cancel() }
  }, [index, dataLoading, presetData, presets, warmPosts])
  const pagedList = primary === 'search' ? searchResultsView : activeList
  // 페이지 위치는 탭 × 부위 조합별로 기억한다. ⚠️ 페이지 번호가 아니라 '그 페이지 첫(왼쪽 위) 아이템 순번'을 저장한다 →
  //   화면 비율이 바뀌어 한 페이지 카드 수가 달라져도(PC 6x3 → 절반 3x3) 보던 왼쪽 위 아이템이 든 페이지로 즉시 환산된다
  //   (setIdx 를 거치지 않으니 스냅 전환·스크롤 애니메이션 없이 리스트가 그대로 유지되는 인상).
  const pageKey = primary === 'share' ? 'plaza:' + plazaFilter : primary === 'search' ? 'search:' + activeCat : activeCat

  // ── 페이지네이션 ── (광장은 자기 그리드·목록 길이를 쓴다)
  const isPlazaTab = primary === 'share'
  const perPage = isPlazaTab ? plazaGrid.cols * plazaGrid.rows : itemsPerPage
  const pageCount = Math.max(1, Math.ceil((isPlazaTab ? plazaList.length : pagedList.length) / perPage))
  const maxIndex = pageCount - 1
  const curIdx = Math.max(0, Math.min(maxIndex, Math.floor((pageByCat[pageKey] || 0) / perPage)))

  const live = useRef({ pageKey, maxIndex, curIdx, itemsPerPage: perPage })
  live.current = { pageKey, maxIndex, curIdx, itemsPerPage: perPage }

  const setIdx = useCallback((i: number, snap = true) => {
    const cat = live.current.pageKey
    const v = Math.max(0, Math.min(live.current.maxIndex, i))
    setSnapFrom(live.current.curIdx)
    setPageByCat((s) => ({ ...s, [cat]: v * live.current.itemsPerPage }))
    setSnapping(snap)
    if (snapT.current) clearTimeout(snapT.current)
    if (snap) snapT.current = setTimeout(() => setSnapping(false), 340)
  }, [])
  const step = useCallback((dir: number) => setIdx(live.current.curIdx + dir), [setIdx])

  // 팔레트 염색(헤어/성형)이 걸린 리스트를 볼 때, 현재+다음 페이지 아이템의 발색 변이를 백그라운드 프리로드
  // → 리스트에서 아무 아이템이나 클릭해도 발색이 이미 캐시돼 즉시 반영(HSB 아이템 수준의 체감 속도).
  useEffect(() => {
    if (activeCat === 'skin' || isMultiCat(activeCat)) return
    const slot = CAT_TO_SLOT[activeCat]
    const pal = dyePalette[slot]
    if (!isMixSlot(slot) || !pal) return
    const start = Math.max(0, curIdx) * itemsPerPage
    const items = activeList.slice(start, start + itemsPerPage * 2) // 현재+다음 페이지
    if (!items.length) return
    let cancelled = false
    ;(async () => {
      for (const it of items) {
        if (cancelled) return
        try { const m = await loadMeta(it.id); if (!cancelled) preloadPaletteVariant(m, pal, THUMB_VIEW) } catch {}
      }
    })()
    return () => { cancelled = true }
  }, [activeCat, curIdx, dyePalette, activeList, itemsPerPage])

  // 염색 대상(헤어/성형)을 고르면 그 아이템의 팔레트 전 색상 변이를 미리 로드 → 색 선택·믹스가 즉시 반영.
  useEffect(() => {
    if (!dyeTarget || !isMixSlot(dyeTarget)) return
    const it = equipped[dyeTarget]
    if (!it) return
    let cancelled = false
    loadMeta(it.id).then((m) => {
      if (cancelled || m.colorGroup == null) return
      for (let c = 0; c < MIX_PALETTE.length; c++) preloadPaletteVariant(m, { baseColor: c, mixColor: null, ratio: 0 }, THUMB_VIEW)
    }).catch(() => {})
    return () => { cancelled = true }
  }, [dyeTarget, equipped])

  // ── 리스트 뷰포트 바인딩 ──
  // 휠 1회 = 1페이지(감도 무관·누적 임계). 방향 전환/유휴(220ms) 시 리셋하고 첫 이벤트가 곧바로 1스텝 넘도록 acc 를 시드.
  // ⚠️ live.current.curIdx 는 리렌더 때만 갱신 → 다중 스텝은 반드시 setIdx(curIdx+n) 단일 호출(step 루프 금지).
  const onWheel = useCallback((e: WheelEvent) => {
    // 모바일: 리스트 페이지 내부에 세로 스크롤이 남아 있으면 스크롤을 우선한다.
    if (bpRef.current === 'mobile') {
      if (listDirRef.current === 'y') return // 모바일 세로는 목록 안의 네이티브 세로 스크롤(ListArea)이 담당
      const page = (e.target as HTMLElement | null)?.closest?.('.pb-page') as HTMLElement | null
      if (page && page.scrollHeight - page.clientHeight > 2) {
        const max = page.scrollHeight - page.clientHeight
        const room = e.deltaY < 0 ? page.scrollTop > 0 : page.scrollTop < max - 1
        if (room) return
      }
    }
    e.preventDefault()
    let raw = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY
    if (e.deltaMode === 1) raw *= 16      // line 단위(Firefox) → px 근사
    else if (e.deltaMode === 2) raw *= 100 // page 단위
    if (Math.abs(raw) < 2) return
    const THRESHOLD = 100, CAP = 12
    const now = performance.now(), dir = Math.sign(raw), w = wheel.current
    if (dir !== w.dir || now - w.t > 220) { w.acc = dir * (THRESHOLD - 1); w.dir = dir }
    w.t = now
    w.acc += raw
    let n = Math.trunc(w.acc / THRESHOLD)
    w.acc -= n * THRESHOLD
    n = Math.max(-CAP, Math.min(CAP, n))
    if (n) setIdx(live.current.curIdx + n)
  }, [setIdx])
  // 터치 스와이프 = 손가락을 따라 트랙이 움직이고(React 리렌더 없이 DOM 직접), 놓으면 거리(폭 · 높이 18%)나
  // 속도(0.35px/ms)로 넘길지 정해 같은 곡선으로 스냅. 넘기는 방향(listDir)의 축만 잡고, 다른 축은 touch-action 으로 브라우저 스크롤. 마우스는 제외.
  const onDown = useCallback((e: PointerEvent) => {
    if (e.pointerType === 'mouse' || e.button !== 0) return
    if (bpRef.current === 'mobile') return // 모바일은 네이티브 가로 스크롤(ListArea)이 담당
    const y = listDirRef.current === 'y'
    const w = (y ? vpElRef.current?.clientHeight : vpElRef.current?.clientWidth) || (y ? window.innerHeight : window.innerWidth)
    swipe.current = { on: true, id: e.pointerId, x0: e.clientX, y0: e.clientY, mode: null, lx: y ? e.clientY : e.clientX, lt: e.timeStamp, vx: 0, w }
  }, [])
  const bindTrack = useCallback((el: HTMLDivElement | null) => { trackRef.current = el }, [])
  // 포커스 시 브라우저가 overflow 뷰포트를 강제 스크롤해 페이지가 넘어가 보이는 현상 차단.
  const killVpScroll = useCallback((e: Event) => {
    if (bpRef.current === 'mobile') return // 모바일 뷰포트는 가로 스크롤 컨테이너 자체라 되돌리면 안 된다
    const el = e.currentTarget as HTMLElement; if (el.scrollLeft) el.scrollLeft = 0; if (el.scrollTop) el.scrollTop = 0
  }, [])
  const bindVp = useCallback((el: HTMLDivElement | null) => {
    if (vpElRef.current === el) return
    const prev = vpElRef.current
    if (prev) { prev.removeEventListener('wheel', onWheel); prev.removeEventListener('pointerdown', onDown); prev.removeEventListener('scroll', killVpScroll) }
    if (vpRo.current) { vpRo.current.disconnect(); vpRo.current = null }
    vpElRef.current = el
    if (el) {
      el.addEventListener('wheel', onWheel, { passive: false })
      el.addEventListener('pointerdown', onDown)
      el.addEventListener('scroll', killVpScroll, { passive: true })
      requestAnimationFrame(() => { measure(); requestAnimationFrame(measure) })
      if (typeof ResizeObserver !== 'undefined') { vpRo.current = new ResizeObserver(() => measure()); vpRo.current.observe(el) }
    }
  }, [onWheel, onDown, killVpScroll, measure])
  const consumeSwipeClick = useCallback(() => performance.now() < swipeClickUntil.current, [])

  useEffect(() => {
    const SNAP = 'transform .34s cubic-bezier(.22,.61,.36,1)' // ListArea 트랙 인라인 전환과 동일 문자열
    const onMove = (e: PointerEvent) => {
      const d = swipe.current
      if (!d.on || e.pointerId !== d.id) return
      // 넘기는 축(ax — 세로 넘기기면 y)의 좌표만 쓴다. 방향을 정하기 전 x0 · y0 은 누른 자리, 정한 뒤 x0 · lx 는 그 축의 기준점이다.
      const ax = listDirRef.current, pos = ax === 'y' ? e.clientY : e.clientX
      if (!d.mode) {
        const mx = Math.abs(e.clientX - d.x0), my = Math.abs(e.clientY - d.y0)
        if (mx > 7 || my > 7) {
          d.mode = mx > my ? 'x' : 'y'
          if (d.mode === ax) { d.x0 = pos; d.lx = pos; d.lt = e.timeStamp } // 판정 거리만큼 튀지 않게 기준점 재설정
        }
      }
      if (d.mode !== ax) return
      const dt = e.timeStamp - d.lt
      if (dt > 0) { d.vx = 0.7 * ((pos - d.lx) / dt) + 0.3 * d.vx; d.lx = pos; d.lt = e.timeStamp }
      const el = trackRef.current; if (!el) return
      const { curIdx: i, maxIndex } = live.current
      let off = pos - d.x0
      if ((i === 0 && off > 0) || (i === maxIndex && off < 0)) off *= 0.3 // 첫/끝 페이지는 고무줄 저항
      el.style.transition = 'none'
      el.style.transform = `${ax === 'y' ? 'translateY' : 'translateX'}(calc(${-i * 100}% + ${off}px))`
    }
    const onUp = (e: PointerEvent) => {
      const d = swipe.current
      if (!d.on || e.pointerId !== d.id) return
      d.on = false
      const ax = listDirRef.current
      if (d.mode !== ax) return
      const { curIdx: i, maxIndex } = live.current
      const dx = e.type === 'pointerup' ? (ax === 'y' ? e.clientY : e.clientX) - d.x0 : 0
      const recent = e.timeStamp - d.lt < 100 ? d.vx : 0 // 멈췄다 뗀 경우 속도 무시
      let dir = 0
      if (e.type === 'pointerup') {
        if (dx < -d.w * 0.18 || recent < -0.35) dir = 1
        else if (dx > d.w * 0.18 || recent > 0.35) dir = -1
      }
      const target = Math.max(0, Math.min(maxIndex, i + dir))
      const el = trackRef.current
      if (el) { el.style.transition = SNAP; el.style.transform = `${ax === 'y' ? 'translateY' : 'translateX'}(${-target * 100}%)` }
      if (target !== i) setIdx(target)
      else { setSnapping(true); if (snapT.current) clearTimeout(snapT.current); snapT.current = setTimeout(() => setSnapping(false), 340) }
      swipeClickUntil.current = performance.now() + 350
    }
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA')) return
      if (e.key === 'ArrowLeft') step(-1); else if (e.key === 'ArrowRight') step(1)
      else if (listDirRef.current === 'y' && bpRef.current !== 'mobile' && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) { e.preventDefault(); step(e.key === 'ArrowUp' ? -1 : 1) }
    }
    window.addEventListener('pointermove', onMove); window.addEventListener('pointerup', onUp); window.addEventListener('pointercancel', onUp)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); window.removeEventListener('pointercancel', onUp)
      window.removeEventListener('keydown', onKey)
    }
  }, [step, setIdx])

  // ── 착용 전 워밍: 보이는 리스트 페이지(멈춘 뒤 한가할 때) + 카드 누르는 순간 ──
  const pvRef = useRef(pv); pvRef.current = pv
  const renderPaletteRef = useRef(renderPalette); renderPaletteRef.current = renderPalette
  const warmForPreview = useCallback((item: ListItem) => {
    if (item.slot === 'skin') return
    const { view } = buildView(pvRef.current)
    warmItem(item, view, isMixSlot(item.slot) ? renderPaletteRef.current[item.slot] : undefined)
  }, [])
  useEffect(() => {
    if (snapping) return
    const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection
    if (conn?.saveData) return // 데이터 절약 모드면 미리 받지 않는다
    const start = curIdx * itemsPerPage
    const items = pagedList.slice(start, start + itemsPerPage).filter((it) => it.slot !== 'skin')
    if (!items.length) return
    let alive = true
    const t = setTimeout(async () => {
      for (let i = 0; i < items.length && alive; i += 4) {
        await Promise.all(items.slice(i, i + 4).map((it) => { const { view } = buildView(pvRef.current); return warmItem(it, view, isMixSlot(it.slot) ? renderPaletteRef.current[it.slot] : undefined) }))
        await new Promise((r) => setTimeout(r, 0))
      }
    }, 350) // 페이지를 빠르게 넘기는 중엔 시작하지 않는다
    return () => { alive = false; clearTimeout(t) }
  }, [pagedList, curIdx, itemsPerPage, snapping, pv.action, pv.expr, pv.ear, pv.weapon, pv.gaze])

  // ── 핸들러 ──
  // 액션 · 무기 모션 · 시선을 바꾸면 멈춘 프레임은 재생으로 돌아간다(프레임 수 · 자세가 달라진다). 프레임은 그 뒤에 setPv('frame', n) 으로 고른다
  const setPv = (key: keyof Pv, val: Pv[keyof Pv]) => setPvState((s) => (s[key] === val ? s : { ...s, [key]: val, ...(key === 'action' || key === 'weapon' || key === 'gaze' ? { frame: -1 } : {}) }))
  const notify = useCallback((msg: string) => {
    setToastText(msg); setToast(true)
    if (toastT.current) clearTimeout(toastT.current)
    toastT.current = setTimeout(() => setToast(false), 2200)
  }, [])

  // 착용: skin=톤 변경, 그 외=slot 라디오(재클릭 해제) + islot 충돌 슬롯 자동 해제.
  const equipFromCat = (cat: string, item: ListItem) => {
    if (cat === 'skin') { setTone(index?.base.tones.find((t) => t.body === item.id)?.tone ?? 0); return }
    const slot = cat === CHAT_TAB ? item.slot : CAT_TO_SLOT[cat] // 명찰/말풍선 탭은 두 부위가 섞여 있다 — 아이템의 부위로 끼운다
    setEquipped((prev) => {
      const cur = prev[slot]
      if (cur && cur.id === item.id) return { ...prev, [slot]: null } // 토글 해제
      const next = { ...prev, [slot]: item }
      for (const s of conflictSlots(prev, slot, item)) next[s] = null // islot 충돌 제거
      return next
    })
    // 헤어/성형에 염색이 걸려있으면 새 아이템의 발색 변이 스프라이트를 클릭 즉시 프리로드 → 발색이 더 빨리 반영.
    const pal = dyePalette[slot]
    if (isMixSlot(slot) && pal) loadMeta(item.id).then((m) => preloadPaletteVariant(m, pal, THUMB_VIEW)).catch(() => {})
  }
  const isEquippedInCat = (cat: string, itemId: string) => {
    if (cat === 'skin') return index?.base.tones.find((t) => t.tone === tone)?.body === itemId
    if (cat === CHAT_TAB) return equipped.nameTag?.id === itemId || equipped.chatBalloon?.id === itemId
    return equipped[CAT_TO_SLOT[cat]]?.id === itemId
  }
  // 토글 없이 착용(이미 입고 있으면 그대로) — 염색 다이얼로그 "적용"이 보던 아이템을 입힐 때.
  const equipItem = (item: ListItem) => {
    const cat = SLOT_TO_CAT[item.slot]
    if (!cat || isEquippedInCat(cat, item.id)) return
    equipFromCat(cat, item)
  }
  // 한 부위만 벗는다(코디 정보 칩의 휴지통 — 두 번 눌러야 한다). 염색 값은 그대로 둔다(같은 부위를 다시 입으면 쓰인다 — 목록에서 벗는 것과 같다).
  const unequipSlot = (slot: string, label?: string) => {
    setEquipped((prev) => (prev[slot] ? { ...prev, [slot]: null } : prev))
    setHidden((h) => { if (!h[slot]) return h; const n = { ...h }; delete n[slot]; return n })
    setDyeTarget((t) => (t === slot ? null : t))
    notify(label ? `${label} 부위를 벗었어요` : '부위를 벗었어요')
  }

  // 북마크 담기/해제(토글) · 비우기.
  const isBookmarked = (id: string) => bookmarks.some((b) => b.id === id)
  const toggleBookmark = (item: ListItem) => {
    if (isBookmarked(item.id)) { const next = bookmarks.filter((b) => b.id !== item.id); setBookmarks(next); saveBookmarks(next); return }
    if (bookmarks.length >= BOOKMARK_MAX) { notify('북마크는 8개까지 담을 수 있어요'); return }
    const next = [...bookmarks, item]; setBookmarks(next); saveBookmarks(next)
  }
  const clearBookmarks = () => {
    if (!bookmarks.length) return
    setBookmarks([]); saveBookmarks([])
    notify('북마크를 비웠어요')
  }

  // ── 코디 광장 ──
  const notifyLive = useRef(notify)
  notifyLive.current = notify
  const setPlazaQ = (v: string) => { setPlazaQState(v); setIdx(0, false) }
  // 스켈레톤은 **첫 로드 전에만** 보여준다.
  // '보여줄 글이 있는지'로 판단하면 글이 0개일 때 그 조건이 영원히 거짓이라
  // 들를 때마다 다시 깔려 깜빡인다.
  // 성공이든 실패든 한 번 끝나면 다시는 깔지 않는다 — 빈 목록에는 빈 상태 문구만 남는다.
  const loadedOnce = useRef(false)
  const lastPlazaLoad = useRef(0)
  // 미리 받기와 탭 진입이 겹칠 수 있다. 두 번 받으면 로딩 플래그가 엇갈려 또 깜빡인다 → 한 번만 받는다.
  const plazaInFlight = useRef<Promise<void> | null>(null)
  // 목록은 ISR 캐시라 내가 방금 올리거나 내린 글이 아직 안 담겨 있다 → 내 것만 화면에서 보정한다.
  const myAdded = useRef<PlazaPost[]>([])
  const myRemoved = useRef<Set<string>>(new Set())
  // 방금 누른 좋아요는 목록을 새로 받아도 유지한다 — 누르기 전에 출발한 목록 요청(미리 받기·탭 진입)이 늦게 도착하면
  // 누르기 전 상태로 덮어써 하트가 꺼져 보인다. 1분 동안은 내가 누른 결과를 믿는다.
  const likeLocal = useRef<Map<string, { liked: boolean; likes: number; at: number }>>(new Map())
  // 하트(켜짐/꺼짐)는 1분, **수는 8초**만 내 값을 믿는다.
  //  · 하트는 목록이 아니라 '내 좋아요'(plaza_me)에서 오므로, 늦게 도착한 응답에 꺼지지 않게 넉넉히 잡는다.
  //  · 수는 남들이 계속 누른다. 1분을 붙들고 있으면 그동안 남이 누른 4~5개가 내 화면에만 안 보인다
  //    → 서버 값(직접 조회 6초 · 목록 첫 쪽 10초)이 더 정확해지는 8초 뒤부터는 서버를 따른다.
  const LIKE_HOLD = { flag: 60000, count: 8000 }
  const keepLikes = (list: PlazaPost[]) => {
    const now = Date.now()
    return list.map((p) => {
      const l = likeLocal.current.get(p.id)
      if (!l) return p
      if (now - l.at > LIKE_HOLD.flag) { likeLocal.current.delete(p.id); return p }
      return { ...p, liked: l.liked, ...(now - l.at <= LIKE_HOLD.count ? { likes: l.likes } : {}) }
    })
  }
  const refreshPlaza = useCallback(async (): Promise<void> => {
    if (!plazaConfigured()) return
    if (plazaInFlight.current) return plazaInFlight.current
    const run = (async () => {
      try {
        const merge = (list: PlazaPost[]) => {
          const ids = new Set(list.map((p) => p.id))
          return keepLikes([...myAdded.current.filter((p) => !ids.has(p.id)), ...list].filter((p) => !myRemoved.current.has(p.id)))
        }
        // 글이 많으면 최신 500개가 먼저 온다 → 바로 보여 주고 뼈대를 걷는다(나머지는 뒤이어 합친다).
        let full = false // 전체가 먼저 도착했으면 늦게 온 첫 쪽으로 덮어쓰지 않는다
        const list = await loadPlaza((first) => {
          if (full) return
          setPlazaPosts(merge(first)); setPlazaGen((g) => g + 1); setPlazaLoaded(true)
        })
        full = true
        const ids = new Set(list.map((p) => p.id))
        myAdded.current = myAdded.current.filter((p) => !ids.has(p.id)) // 캐시에 나타났으면 보정 해제
        for (const id of Array.from(myRemoved.current)) if (!ids.has(id)) myRemoved.current.delete(id)
        const merged = keepLikes([...myAdded.current, ...list].filter((p) => !myRemoved.current.has(p.id)))
        setPlazaPosts(merged)
        setPlazaGen((g) => g + 1) // 새로 받아온 목록 = 정렬을 다시 잡는 시점
        lastPlazaLoad.current = Date.now()
      } catch {
        notifyLive.current('광장을 불러오지 못했어요')
        // 실패했으면 다음 진입 때 다시 받는다(아래 20초 건너뛰기는 lastPlazaLoad 를 보므로 걸리지 않는다).
      } finally {
        loadedOnce.current = true
        setPlazaLoaded(true)
      }
    })()
    plazaInFlight.current = run
    try { await run } finally { plazaInFlight.current = null }
  }, [])
  // 탭에 들어올 때 한 번 받아온다(등록·좋아요 뒤에는 그 자리에서 갱신).
  // 탭을 누른 **뒤에** 처음 받기 시작하면 광장만 유독 늦게 뜬다(코디 탭은 이미 받아 둔 카탈로그를 쓴다).
  // 첫 화면이 자리를 잡은 뒤 한가할 때 미리 받아 둔다 — 목록 한 건이라 비용이 거의 없다.
  useEffect(() => {
    if (!plazaConfigured()) return
    type Ric = (cb: () => void, o?: { timeout: number }) => number
    const ric: Ric | undefined = (window as unknown as { requestIdleCallback?: Ric }).requestIdleCallback
    let t = 0
    const run = () => { void refreshPlaza() }
    if (ric) { t = ric(run, { timeout: 4000 }) } else { t = window.setTimeout(run, 1500) }
    return () => { if (ric) (window as unknown as { cancelIdleCallback?: (h: number) => void }).cancelIdleCallback?.(t); else window.clearTimeout(t) }
  }, [refreshPlaza])
  // 탭에 들어올 때 새로 읽는다. 다만 방금 받아 둔 게 있으면 건너뛴다(미리 받기와 겹치지 않게).
  useEffect(() => {
    if (primary !== 'share') return
    if (loadedOnce.current && Date.now() - lastPlazaLoad.current < 20000) return
    void refreshPlaza()
  }, [primary, refreshPlaza])
  useEffect(() => { if (primary !== 'share') setPlazaUpload(false) }, [primary])

  const openPlazaPost = (post: PlazaPost) => openSurface({ kind: 'plaza', item: null, post })
  // 도움 및 건의함 — 탭이 아니라 서피스로 연다(plaza/NoticeBody.tsx).
  const openNotice = () => openSurface({ kind: 'notice', item: null })
  // 공유받은 코디를 프리셋 칸에 저장하는 화면(서피스 ptake) — 공유 링크·코드로 받았을 때도 이 화면이다
  // (저장 화면은 하나다). 칸을 고르면 applySharedToPreset 으로 들어간다.
  const openShared = (snap: Snapshot) => openSurface({ kind: 'ptake', item: null, take: snap })
  const plazaTakeDirect = (post: PlazaPost) => {
    const take: Snapshot = { ...post.snapshot, name: post.name }
    // 상세가 열려 있으면 같은 다이얼로그 안에서 슬라이드로 넘어간다(닫았다 다시 뜨지 않는다).
    if (surfaceRef.current?.kind === 'plaza') { slideTo(1, { kind: 'ptake', item: null, post, take, fromDetail: true }); return }
    // 목록 카드의 가져오기로 바로 연 경우는 돌아갈 상세가 없다 → post 를 넘기지 않아 푸터가 '닫기'가 된다.
    // 저장해도 상세로 넘어가지 않고 그대로 닫힌다.
    openSurface({ kind: 'ptake', item: null, take })
  }
  // 코디 광장 상세의 착용 칩 '입기' 버튼 — 남의 코디에서 그 부위만 지금 코디에 바로 입힌다(사용자 요청 — 코디 전체가 아니라 아이템 하나만).
  // 부위마다 아이템 · 염색(발색 · HSB · 꺼짐) · 점 위치(사소한 변경쩜 같은 dotPos)를 그대로 옮기고, 숨김은 푼다. 피부는 톤과 피부 염색. 겹치는 부위(islot)는 벗는다.
  // 다른 부위와 연출은 건드리지 않는다. 지금 프리셋에 자동 저장되고 되돌리기로 돌아갈 수 있다(보통 착용과 같다).
  const wearFromSnap = async (snap: Snapshot, slots: string[], label?: string) => {
    const eq = await resolveEquipped(snap)
    const pick = <T,>(src: Record<string, T> | undefined) => (prev: Record<string, T>) => {
      const n = { ...prev }
      for (const sl of slots) { if (src?.[sl] !== undefined) n[sl] = src[sl]; else delete n[sl] }
      return n
    }
    const items = slots.filter((sl) => sl !== 'skin' && eq[sl])
    if (slots.includes('skin')) setTone(snap.tone ?? indexRef.current?.base.default ?? DEFAULT_TONE)
    setEquipped((prev) => {
      const next = { ...prev }
      for (const sl of items) {
        for (const c of conflictSlots(next, sl, eq[sl]!)) if (!slots.includes(c)) next[c] = null
        next[sl] = eq[sl]
      }
      return next
    })
    setDyePalette(pick(snap.dyePalette)); setDyeHsb(pick(snap.dyeHsb)); setDyeOff(pick(snap.dyeOff))
    setDotPos((prev) => {
      const n = { ...prev }
      for (const sl of items) { const d = snapDot(snap, sl, eq[sl]!); if (d) n[eq[sl]!.id] = d; else delete n[eq[sl]!.id] }
      return n
    })
    setHidden((h) => { const n = { ...h }; for (const sl of slots) delete n[sl]; return n })
    setDyeTarget(null)
    notify(label ? `${label} 부위를 입었어요` : `${slots.length}개 부위를 입었어요`)
  }
  // 스냅샷의 점 위치는 스냅샷의 아이템 id 로 적혀 있다(복제 묶음을 원본으로 바꿔 읽었으면 바뀐 id 로도 찾는다).
  const snapDot = (snap: Snapshot, slot: string, it: ListItem) => snap.dotPos?.[snap.equipped?.[slot]] ?? snap.dotPos?.[it.id]
  // 그 부위를 **완전히 같게** 입고 있는가 — 아이템 · 염색(발색 · HSB · 꺼짐) · 점 위치 · 보임이 모두 같아야 한다(사용자 지시 —
  // 사소한 변경쩜처럼 같은 아이템이어도 점 위치가 다를 수 있다). 착용 칩의 입기 버튼이 체크로 바뀌는 기준.
  const isWornFromSnap = (snap: Snapshot, slot: string, item: ListItem | null) => {
    const same = (a: unknown, b: unknown) => canon(a ?? null) === canon(b ?? null)
    if (slot === 'skin') return tone === snap.tone && same(dyeHsb.skin, snap.dyeHsb?.skin) && !!dyeOff.skin === !!snap.dyeOff?.skin
    const cur = equipped[slot]
    if (!item || !cur || cur.id !== item.id || hidden[slot]) return false
    return same(dyePalette[slot], snap.dyePalette?.[slot]) && same(dyeHsb[slot], snap.dyeHsb?.[slot])
      && !!dyeOff[slot] === !!snap.dyeOff?.[slot] && same(dotPos[cur.id], snapDot(snap, slot, item))
  }
  // 'ptake' 에서 '이전' — 보던 상세로 되돌아간다(역방향 슬라이드).
  const plazaTakeBack = () => {
    const sf = surfaceRef.current
    if (sf?.kind === 'ptake' && sf.post) slideTo(-1, { kind: 'plaza', item: null, post: sf.post })
  }
  const likePending = useRef<Set<string>>(new Set())
  const plazaLike = (post: PlazaPost) => {
    // 먼저 화면부터 바꾸고(하트는 자주 눌린다) 서버에 반영한다. 서버가 돌려준 실제 상태·수로 다시 맞춘다 —
    // 기기 기준이라 다른 창에서 이미 누른 하트였다면 이번 누름은 '취소'가 된다(supabase/0011).
    const next = !post.liked
    likePending.current.add(post.id)
    likeLocal.current.set(post.id, { liked: next, likes: Math.max(0, post.likes + (next ? 1 : -1)), at: Date.now() })
    setPlazaPosts((list) => list.map((p) => (p.id === post.id ? { ...p, liked: next, likes: Math.max(0, p.likes + (next ? 1 : -1)) } : p)))
    togglePlazaLike(post)
      .then((r) => {
        likeLocal.current.set(post.id, { liked: r.liked, likes: r.likes, at: Date.now() })
        setPlazaPosts((list) => list.map((p) => (p.id === post.id ? { ...p, liked: r.liked, likes: r.likes } : p)))
      })
      .catch((e) => {
        likeLocal.current.delete(post.id)
        setPlazaPosts((list) => list.map((p) => (p.id === post.id ? { ...p, liked: post.liked, likes: post.likes } : p)))
        const msg = e instanceof Error ? e.message : ''
        notify(/마감|내려간/.test(msg) ? msg : '좋아요를 저장하지 못했어요')
      })
      .finally(() => likePending.current.delete(post.id))
  }
  // 남이 누른 좋아요를 몇 초 안에 보이게 — 광장 탭이 보일 때 **화면에 있는 카드(앞뒤 한 쪽 포함) + 열린 상세**만
  // 4초마다 좋아요 수를 새로 받는다(캐시를 거치지 않는 직접 조회). 창이 가려져 있으면 쉰다. 18~54개 id 라 응답이 작다.
  const likeWatch = useRef<string[]>([])
  {
    const ids = new Set<string>()
    if (primary === 'share') for (const p of plazaList.slice(Math.max(0, curIdx - 1) * perPage, (curIdx + 2) * perPage)) ids.add(p.id)
    if (surface?.kind === 'plaza' && surface.post) ids.add(surface.post.id)
    likeWatch.current = Array.from(ids)
  }
  const watching = primary === 'share' || surface?.kind === 'plaza'
  useEffect(() => {
    if (!watching || !plazaConfigured()) return
    let alive = true
    const tick = async () => {
      if (document.hidden || !likeWatch.current.length) return
      const counts = await loadLikeCounts(likeWatch.current)
      if (!alive || !counts.size) return
      setPlazaPosts((list) => {
        let changed = false
        const out = list.map((p) => {
          const n = counts.get(p.id)
          if (n == null || n === p.likes || likePending.current.has(p.id)) return p
          changed = true
          return { ...p, likes: n }
        })
        return changed ? out : list
      })
    }
    // 4초 주기 — 마침 요청이 나가 있는 사이에 남이 누르면 그 응답은 옛 수를 담고 오므로, 실제 최악은 주기의 두 배다.
    // 6초였을 때 실측 9.1초(최악 12초)로 '5~10초' 를 넘길 수 있었다 → 4초(최악 8초). 응답은 54개 id 라도 1KB 안팎이다.
    const t = window.setInterval(() => { void tick() }, 4000)
    return () => { alive = false; window.clearInterval(t) }
  }, [watching])
  // 광장을 **열어 둔 채로도** 남이 올린 글·내린 글이 몇 초 안에 보이게 한다.
  // 목록을 탭에 들어올 때만 받으면, 화면을 켜 두고 기다리는 사람에게는 새 글이 영영 오지 않는다.
  // 5초마다 **맥박만** 본다(lib/plaza.loadPlazaPulse — 글 수 + 최신 글 id, Supabase 직접). 바뀌었을 때만 첫 쪽을 받는다
  // (loadPlazaHead — 엣지 캐시). 캐시 응답에 맥박의 최신 글이 없으면(비우기 실패) 캐시를 비켜 한 번 더 읽는다 → 3~5초 안에 보인다.
  // 좋아요 수는 보이는 카드만 4초마다 따로 받는다(위). 화면 밖 카드의 좋아요는 목록을 다시 받을 때 맞춰진다.
  // ⚠️ plazaGen 은 올리지 않는다 — 올리면 보던 순서가 다시 잡혀 카드가 자리를 옮긴다. 새 글은 맨 앞에 붙는다.
  useEffect(() => {
    if (!watching || !plazaConfigured()) return
    let alive = true
    let seen: string | null = null
    const tick = async () => {
      if (document.hidden) return
      const pulse = await loadPlazaPulse()
      if (!alive || !pulse) return
      if (pulse === seen) return
      seen = pulse // 처음 본 맥박에도 한 번 맞춘다(목록을 받은 뒤 그 사이에 올라온 글) — 대개 캐시 응답이다
      const [total, top] = pulse.split('|')
      let head = await loadPlazaHead()
      if (head && ((top && !head.posts.some((p) => p.id === top)) || String(head.total) !== total)) head = await loadPlazaHead(true)
      if (!alive || !head) return
      setPlazaPosts((list) => {
        const here = new Set(list.map((p) => p.id))
        const add = head.posts.filter((p) => !here.has(p.id) && !myRemoved.current.has(p.id))
        // 첫 쪽이 전체를 담고 있을 때만 '사라진 글'을 지운다. 내가 방금 올린 글은 캐시에 늦게 담기므로 남긴다.
        const live = head.covers ? new Set(head.posts.map((p) => p.id)) : null
        const kept = live ? list.filter((p) => live.has(p.id) || myAdded.current.some((m) => m.id === p.id)) : list
        // 이미 받아 온 응답이니 좋아요 수도 함께 맞춘다 — 화면 밖 카드까지 10초 안에 따라온다(보이는 카드는 6초 직접 조회).
        const counts = new Map(head.posts.map((p) => [p.id, p.likes] as const))
        let moved = false
        const synced = kept.map((p) => {
          const n = counts.get(p.id)
          if (n == null || n === p.likes || likePending.current.has(p.id)) return p
          moved = true
          return { ...p, likes: n }
        })
        if (!add.length && !moved && synced.length === list.length) return list
        return keepLikes([...add, ...synced])
      })
    }
    const t = window.setInterval(() => { void tick() }, 5000)
    return () => { alive = false; window.clearInterval(t) }
  }, [watching])
  const plazaRemove = (post: PlazaPost) => {
    // 3초 안에, 다른 상호작용 없이 연속으로 두 번 눌러야 내린다(lib/confirmTwice).
    if (confirmTwice(`plaza:${post.id}`, '한 번 더 누르면 광장에서 내려요')) {
      deletePlazaPost(post)
        .then(() => {
          myRemoved.current.add(post.id)
          myAdded.current = myAdded.current.filter((p) => p.id !== post.id)
          setPlazaPosts((list) => list.filter((p) => p.id !== post.id))
          notify('등록한 코디를 내렸어요')
        })
        .catch(() => notify('내리지 못했어요. 다시 시도해 주세요'))
    }
  }
  // 광장의 링크 복사도 누를 때마다 지금 규칙으로 만든다 — 글에 적어 둔 공유 코드(share_code)는 등록 때의 카드라,
  // 카드 모양이 바뀐 뒤(ID_SALT)에도 그것을 쓰면 옛 카드가 나간다. 같은 코디는 같은 id 라 링크가 늘어나지 않고, 옛 링크는 그대로 열린다.
  const plazaCopyLink = (post: PlazaPost) => {
    copyShareLink({ ...plazaSnapshot(post.snapshot), name: post.name }, '공유 링크를 복사했어요')
  }
  const plazaSubmit = async (draft: Omit<PlazaDraft, 'shareCode'>): Promise<boolean> => {
    if (plazaSubmitting) return false
    setPlazaSubmitting(true)
    try {
      // 공유 코드도 함께 만들어 둔다 — '링크 복사'와 카톡 카드가 기존 공유 기능을 그대로 쓴다.
      // 숨긴 부위는 광장에서는 없는 아이템이다 — 저장·공유 링크(가져오기·링크 복사) 모두 지운 스냅샷으로.
      const clean = plazaSnapshot(draft.snapshot)
      const named = { ...clean, name: draft.name }
      const prep = await prepareShare(location.origin, named).catch(() => null)
      const post = await createPlazaPost({ ...draft, snapshot: clean, shareCode: prep?.id ?? null })
      if (prep) void uploadShare(prep, named)
      myAdded.current = [post, ...myAdded.current]
      setPlazaPosts((list) => [post, ...list])
      setPlazaUpload(false)
      notify(draft.contest ? `'${draft.name}' 코디를 ${PLAZA_CONTEST}에 등록했어요` : `'${draft.name}' 코디를 광장에 등록했어요`)
      return true
    } catch (e) {
      // DB 가 막은 사유(대회 3개 제한 등)는 그대로 보여준다 — '잠시 후 다시'는 거짓말이 된다.
      const msg = e instanceof Error ? e.message : ''
      // 같은 조합(DB 안전망 0009 트리거 문구)은 같은 안내로.
      const dup = /같은 조합/.test(msg)
      notify(dup ? '같은 조합이 이미 대회에 출품돼 있어요' : /기기당|대회에는|마감|이메일|기기 정보/.test(msg) ? msg : '등록하지 못했어요. 잠시 후 다시 시도해 주세요')
      return false
    } finally { setPlazaSubmitting(false) }
  }

  // ── 단일 서피스 ── 열 때 다른 서피스를 대체, 같은 시트를 다시 누르면 닫는다. 닫힘은 320ms 뒤 언마운트.
  const openSurface = (next: Surface) => {
    if (surfT.current) { clearTimeout(surfT.current); surfT.current = null }
    setSurfaceClosing(false)
    setSurface(next)
  }
  // ✕·마스크·Esc·닫기 모두 즉시 종료(이전으로 가지 않음). 슬라이드 상태도 함께 초기화(다음에 열면 접힌 상태).
  const closeSurface = () => {
    if (!surface || surfaceClosing) return
    for (const t of partT.current) clearTimeout(t)
    partT.current = []
    setSurfaceClosing(true)
    if (surfT.current) clearTimeout(surfT.current)
    surfT.current = setTimeout(() => { surfT.current = null; setSurface(null); setSurfaceClosing(false); setPartSlide(0) }, SURFACE_UNMOUNT_MS)
  }
  // 로고 = 처음 화면으로. 진짜 새로고침은 쓰지 않는다 — 보던 자리를 되살리는
  // sessionStorage 때문에 되레 그 자리로 돌아오고(위 '보던 자리 기억'), 카탈로그를 다시 받느라 느리다.
  // 대신 첫 진입과 같은 값으로 되돌린다: 코디 탭 · 전체 · 1페이지 · 검색어 없음. 저장은 아래 effect 가 따라 쓴다.
  // 코디·프리셋·북마크·즐겨찾기는 건드리지 않는다(진짜 새로고침도 그것들은 그대로다).
  const goHome = () => {
    closeSurface()
    setPrimary('codi')
    setActiveCat('all')
    setSearch('')
    setGenderFilter('all')
    setAiQ(''); setSearchQuery(null); setSearchResults([])
    setPlazaFilter('all'); setPlazaQState('')
    setPageByCat({}) // 부위별로 따로 기억하던 페이지까지 전부 1페이지로
  }
  const openSheet = (kind: 'pv' | 'bm' | 'part' | 'bg' | 'emo') => {
    if (surface?.kind === kind && !surfaceClosing) { closeSurface(); return }
    openSurface({ kind, item: null })
  }
  // 기능 안내의 '열어 보기'(글은 lib/guide 의 guideFor 로 기기에 맞춘 것이 온다). **요청한 것만 바꾼다** — 보던 탭 · 상태는 그대로 두고,
  // 미리보기 기능(tab 'preview')은 미리보기가 없는 코디 광장에서만 코디 탭으로 간다. 창이 닫히는 것을 기다렸다가 탭을 바꾸고(필요할 때만),
  // 창(sheet)이 있으면 연다 — 휴대폰 연출 설정은 고르기 화면(pick) · 칸(group)까지 정해 연다. PC 는 연출 설정이 미리보기 아래
  // 줄이라 창이 없다: 펼칠 칸이면 펼치고(drawer), 아니면 그 요소를 가리키고 필요하면 눌러 연다(spot · click).
  const guideGo = ({ go }: { go?: GuideGo }) => {
    if (!go) return
    closeSurface()
    const tab = go.tab === 'preview' ? (primary === 'share' ? 'codi' : null) : go.tab
    setTimeout(() => {
      if (tab && tab !== primary) setPrimary(tab)
      const sheet = go.sheet && (go.sheet !== 'pv' || bp === 'mobile') ? go.sheet : null
      if (sheet) {
        if (sheet === 'pv') setPvIntent({ pick: go.pick, group: go.group })
        openSurface({ kind: sheet, item: null })
        // 창이 다 오른 뒤 그 줄까지 창 안을 스크롤해 가리킨다(고르기 화면으로 연 것은 그 화면이 곧 목적지라 가리키지 않는다)
        if (go.spot && !go.pick) setTimeout(() => guideSpot(go.spot!), GUIDE_SETTLE_MS)
        return
      }
      if (go.drawer) { setTimeout(() => window.dispatchEvent(new CustomEvent(GUIDE_DRAWER_EVENT, { detail: { group: go.drawer, spot: go.spot } })), 260); return }
      if (go.spot) setTimeout(() => guideSpot(go.spot!, !!go.click), 260)
    }, SURFACE_UNMOUNT_MS + 20)
  }
  const openDye = (item: ListItem) => openSurface({ kind: 'dye', item })
  const openCard = () => openSurface({ kind: 'card', item: null })
  const openDot = (item: ListItem) => openSurface({ kind: 'dot', item })
  // 부위 염색 ↔ 염색/점 위치: 다이얼로그는 그대로 두고 본문만 가로 슬라이드(진입 = 왼쪽으로 빠지고 오른쪽에서 들어옴, 이전 = 반대).
  const slideTo = (dir: 1 | -1, next: Surface) => {
    for (const t of partT.current) clearTimeout(t)
    setPartSlide(-34 * dir)
    partT.current = [
      setTimeout(() => { setSurface(next); setPartSlide(34 * dir) }, PART_SLIDE_SWAP_MS),
      setTimeout(() => setPartSlide(0), PART_SLIDE_IN_MS),
    ]
  }
  const openPartItem = (item: ListItem) => slideTo(1, { kind: DOT_MOVER_IDS.has(item.id) ? 'dot' : 'dye', item, fromPart: true })
  const partBack = () => slideTo(-1, { kind: 'part', item: null })
  // 코디 비교(사용자 지시) — 칸은 프리셋 목록에 없는 프리셋이다(CMP_KEY 주석). 칸 고르기 · 더하기 · 빼기. 고른 칸 = 비교 전 프리셋(CMP_KEY 주석).
  // 처음 열면 지금 코디로 두 칸(A = 지금 코디, B = 그 복사본 — 하나만 바꿔 대 보기 쉽게). 다시 열면 모아 둔 칸 그대로, 마지막에 고른 칸으로.
  const newCmpId = () => 'cmp' + Date.now().toString(36) + (cmpSeq.current++)
  const toggleCompare = () => {
    if (cmpOn) {
      cmpLast.current = selectedPreset
      const back = cmpBack && PRESET_IDS.includes(cmpBack) ? cmpBack : presets[0].id
      switchPreset(back, presetData[back] ?? defaultSnapshot(), 'zoom')
      return
    }
    setCmpBack(selectedPreset)
    if (!cmpIds.length) {
      const cur = snapshot(), a = newCmpId(), b = newCmpId()
      setPresetData((d) => ({ ...d, ...(selectedPreset ? { [selectedPreset]: cur } : {}), [a]: cur, [b]: cur }))
      setCmpIds([a, b])
      setSelectedPreset(a) // 라이브는 이미 이 코디다
      return
    }
    // 다시 켜면 마지막에 고른 칸에 지금 코디(= 지금 프리셋)를 담는다 — 고른 칸이 곧 프리셋이라(아래 주석) 그 칸의 이전 내용은 그때의 프리셋에 이미 있다
    const to = cmpLast.current && cmpIds.includes(cmpLast.current) ? cmpLast.current : cmpIds[0]
    const cur = snapshot()
    setPresetData((d) => ({ ...d, ...(selectedPreset ? { [selectedPreset]: cur } : {}), [to]: cur }))
    histsRef.current.delete(to) // 담은 코디가 그 칸의 새 바닥이다 — 예전 칸 내용으로 되돌려 프리셋을 덮어쓰지 않게
    setSelectedPreset(to) // 라이브는 이미 이 코디다
  }
  const pickCmp = (id: string) => { if (id !== selectedPreset) switchPreset(id, presetData[id] ?? defaultSnapshot(), 'all') }
  // 새 칸 = 지금 고른 칸의 복사본, 바로 그 칸을 고른다(라이브는 그대로)
  const addCmp = () => {
    if (!cmpOn || cmpIds.length >= CMP_MAX) return
    const cur = snapshot(), id = newCmpId()
    setPresetData((d) => ({ ...d, [selectedPreset!]: cur, [id]: cur }))
    setCmpIds((ids) => [...ids, id])
    setSelectedPreset(id)
  }
  // 칸 빼기 — 두 칸은 남긴다(CMP_MIN). 고른 칸을 빼면 그 자리(없으면 앞)의 칸으로. 그 칸의 기록도 버린다(기록은 칸마다 — histsRef)
  const removeCmp = (id: string) => {
    if (cmpIds.length <= CMP_MIN || !cmpIds.includes(id)) return
    const rest = cmpIds.filter((x) => x !== id)
    if (id === selectedPreset) { const to = rest[Math.min(cmpIds.indexOf(id), rest.length - 1)]; switchPreset(to, presetData[to] ?? defaultSnapshot(), 'all') }
    setCmpIds(rest)
    histsRef.current.delete(id)
  }
  // 비교 중에 프리셋 카드를 누르면 고른 칸이 그 프리셋이 된다 — 그 프리셋의 코디를 고른 칸에 불러오고, 이어지는 편집은 그 프리셋에 저장된다.
  // (고른 칸 = 프리셋이라, 칸에 불러오기만 하면 지금 이어진 프리셋을 다른 프리셋으로 덮어쓰게 된다)
  const cmpTake = (id: string) => {
    const src = presetData[id] ?? defaultSnapshot()
    const letter = String.fromCharCode(65 + Math.max(0, cmpIds.indexOf(selectedPreset!)))
    const name = presets.find((p) => p.id === id)?.name ?? ''
    setCmpBack(id)
    applySnapshot({ ...src, pv: withView(src.pv, pv) }, false).then(() => notify(`'${name}' 코디를 ${letter} 칸에 불러왔어요`)).catch(() => {})
  }

  // 현재 라이브 모델 → 스냅샷.
  const snapshot = (): Snapshot => {
    const eq: Record<string, string> = {}
    for (const [s, it] of Object.entries(equipped)) if (it) eq[s] = it.id
    return { equipped: eq, tone, dyePalette: { ...dyePalette }, dyeHsb: { ...dyeHsb }, hidden: { ...hidden }, dotPos: { ...dotPos },
      ...(Object.keys(dyeOff).length ? { dyeOff: { ...dyeOff } } : {}),
      pv: { form: pv.form, ear: pv.ear, weapon: pv.weapon, wEffect: pv.wEffect, cEffect: pv.cEffect, capEffect: pv.capEffect, floatFx: pv.floatFx, baseTag: pv.baseTag,
        // 보기 설정은 **정보로만** 담는다 — 프리셋을 쓸 때 화면을 되살리는 데만 쓰이고 카드에는 그려지지 않는다.
        gaze: pv.gaze, action: pv.action, frame: pv.frame, expr: pv.expr, zoom: pv.zoom }, bg: bgSel }
  }
  // 스냅샷의 연출설정을 라이브 pv 에 반영. 코디에 속하는 연출(형상변이·귀·무기모션·이펙트)은 없으면 기본값으로,
  // 보기 설정(시선·액션·표정·배율)은 **담겨 있을 때만** 되살린다 — 광장 코디나 오래된 프리셋처럼 담기지 않은 것을
  // 적용할 때 보던 화면 설정이 제멋대로 바뀌면 안 된다. fps 는 담지 않는다.
  const applyPvSnap = (v?: PvSnap) => {
    const s = v ?? PV_LOOK_DEFAULT
    setPvState((prev) => ({ ...prev,
      form: s.form, ear: s.ear, weapon: s.weapon, wEffect: s.wEffect, cEffect: s.cEffect, capEffect: s.capEffect ?? true, floatFx: s.floatFx ?? true, baseTag: s.baseTag ?? false,
      gaze: v?.gaze ?? prev.gaze, action: v?.action ?? prev.action, frame: v?.frame ?? (v?.action != null ? -1 : prev.frame), expr: v?.expr ?? prev.expr, zoom: v?.zoom ?? prev.zoom }))
  }
  // 슬롯 리스트를 로드+폴드해서 반환(캐시). 스냅샷의 아이템 id 를 실제 ListItem 으로 해석하기 위해 필요.
  const loadSlotFolded = async (slot: string): Promise<ListItem[]> => {
    const idx = indexRef.current
    // 목록 파일은 slotFile 하나로 고른다(CDN 색인 밖의 일루전 링 · 명찰과 말풍선 · 칭호 · 훈장 · 라이딩 · 이펙트도 — 색인만 보면 반지가 늘 빈 목록이었다)
    const file = slotFile(slot, idx)
    if (!file) return []
    try {
      const folded = foldList(await loadSlot(file)).filter((it) => !CHAT_FILES[slot] || it.slot === slot) // 명찰 · 말풍선은 한 파일에 함께 있다
      setLists((m) => (m[slot] ? m : { ...m, [slot]: folded }))
      return folded
    } catch { return [] }
  }
  // 스냅샷의 equipped(id) → 실제 ListItem 맵(필요한 슬롯 리스트를 로드 후 해석).
  const resolveEquipped = async (snap: Snapshot): Promise<Record<string, ListItem | null>> => {
    const eq: Record<string, ListItem | null> = {}
    for (const sl of EQUIP_SLOTS) eq[sl] = null
    const entries = Object.entries(snap.equipped).filter(([sl, id]) => id && (EQUIP_SLOTS as readonly string[]).includes(sl))
    await Promise.all(entries.map(async ([sl, id]) => {
      // 원본(비폴딩) 리스트에서 정확한 id 로 해석 → 폴딩 대표가 아닌 id(검색/색변형)도 반드시 찾아 유지.
      const raw = await loadSlotRaw(sl)
      const it = raw.find((x) => x.id === id)
      eq[sl] = it ? toOriginal(raw, it) : null
    }))
    return eq
  }
  // 스냅샷을 라이브 모델에 적용. applyingRef 로 이 변경의 자동저장을 스킵(원본 프리셋과 동일하므로).
  // skipAutosave: 프리셋 "적용"은 같은 데이터라 자동저장 스킵. 되돌리기/다시실행은 false →
  // 되돌린 코디가 현재 프리셋에 저장되어 프리셋 카드도 함께 갱신된다.
  // sel: 되돌리기/다시실행이 "선택 프리셋"도 함께 복원할 때 넘긴다(undefined=변경 안 함, null 도 유효값).
  const applySnapshot = async (snap: Snapshot, skipAutosave = true, keepTarget = false, sel: string | null | undefined = undefined): Promise<void> => {
    if (skipAutosave) applyingRef.current = true
    const eq = await resolveEquipped(snap)
    setEquipped(eq)
    setTone(snap.tone ?? indexRef.current?.base.default ?? DEFAULT_TONE)
    setDyePalette({ ...(snap.dyePalette || {}) }); setDyeHsb({ ...(snap.dyeHsb || {}) }); setDyeOff({ ...(snap.dyeOff || {}) }); setHidden({ ...(snap.hidden || {}) })
    setDotPos({ ...(snap.dotPos || {}) })
    applyPvSnap(snap.pv)
    setBgSel(stageSelOf(snap.bg)); setStageBg(snap.bg ?? 'room') // 그 프리셋의 미리보기 배경(담기지 않은 오래된 프리셋 · 받은 코디는 피팅룸)
    if (sel !== undefined) setSelectedPreset(sel)
    // 되돌리기/다시실행은 편집 중이던 아이템 선택(dyeTarget)을 유지(여전히 착용/스킨일 때) → 염색만 되돌아가고 선택은 유지.
    if (keepTarget) setDyeTarget((t) => (t && (t === 'skin' || eq[t]) ? t : null))
    else setDyeTarget(null)
  }
  // 프리셋 선택: 현재 모델을 지금 선택된 프리셋에 즉시 저장(플러시) 후, 새 프리셋을 라이브에 적용. 항상 하나 선택.
  // 비교 중이면 프리셋 카드는 그 코디를 고른 칸에 담는다(cmpTake).
  const selectPreset = (id: string) => {
    if (cmpOn && !isCmpId(id)) { cmpTake(id); return }
    switchPreset(id, presetData[id] ?? defaultSnapshot())
  }
  // keep: 'all' = 비교 칸끼리(withView — 그 칸의 보기 설정, 배율만 지금 값), 'zoom' = 배율만 지금 값(비교를 끝낼 때)
  const switchPreset = (id: string, snap: Snapshot, keep?: 'all' | 'zoom') => {
    if (selectedPreset && selectedPreset !== id) setPresetData((d) => ({ ...d, [selectedPreset]: snapshot() }))
    if (selectedPreset === id) return
    applyingRef.current = true
    resolveEquipped(snap).then((eq) => {
      setEquipped(eq)
      setTone(snap.tone ?? indexRef.current?.base.default ?? DEFAULT_TONE)
      setDyePalette({ ...(snap.dyePalette || {}) }); setDyeHsb({ ...(snap.dyeHsb || {}) }); setDyeOff({ ...(snap.dyeOff || {}) }); setHidden({ ...(snap.hidden || {}) })
      setDotPos({ ...(snap.dotPos || {}) })
      applyPvSnap(keep === 'all' ? withView(snap.pv, pv) : keep === 'zoom' && snap.pv ? { ...snap.pv, zoom: pv.zoom } : snap.pv)
      setBgSel(stageSelOf(snap.bg)); setStageBg(snap.bg ?? 'room') // 그 프리셋의 미리보기 배경
      if (isCmpId(id) && cmpBack) setPresetData((d) => ({ ...d, [cmpBack]: snap })) // 고른 비교 칸 = 프리셋(자동 저장 주석)
      setDyeTarget(null); setSelectedPreset(id)
    }).catch(() => {})
  }
  // 공유받은 코디를 사용자가 고른 프리셋 슬롯에 적용 — 개인 프리셋 하나를 명시적으로 덮어씀 + 선택 + 라이브(되돌리기 가능).
  const applySharedToPreset = (taken: Snapshot, targetId: string) => {
    const snap = withTakenView(taken) // 메타 정보는 받은 코디의 값으로(없는 칸은 기본) — 보던 화면 값을 물려받지 않는다
    // 덮어쓰기 전 그 프리셋(선택돼 있으면 지금 코디)과 이름을 기록에 함께 남긴다 → 되돌리기로 원래 코디·이름까지 돌아온다.
    const prevName = presets.find((p) => p.id === targetId)?.name ?? ''
    histOver.current = {
      id: targetId,
      prev: targetId === selectedPreset ? snapshot() : (presetData[targetId] ?? defaultSnapshot()), prevName,
      next: snap, nextName: snap.name || prevName,
    }
    if (selectedPreset && selectedPreset !== targetId) setPresetData((d) => ({ ...d, [selectedPreset]: snapshot() }))
    setPresetData((d) => ({ ...d, [targetId]: snap }))
    if (snap.name) setPresets((ps) => ps.map((p) => (p.id === targetId ? { ...p, name: snap.name! } : p))) // 공유된 이름까지 그대로
    applyingRef.current = true
    resolveEquipped(snap).then((eq) => {
      setEquipped(eq)
      setTone(snap.tone ?? indexRef.current?.base.default ?? DEFAULT_TONE)
      setDyePalette({ ...(snap.dyePalette || {}) }); setDyeHsb({ ...(snap.dyeHsb || {}) }); setDyeOff({ ...(snap.dyeOff || {}) }); setHidden({ ...(snap.hidden || {}) })
      setDotPos({ ...(snap.dotPos || {}) })
      applyPvSnap(snap.pv)
      setDyeTarget(null); setSelectedPreset(targetId)
    }).catch(() => {})
    // 광장 글을 가져온 경우(post 가 함께 있음)는 그 글의 상세로 되돌아간다 — 다이얼로그를 닫지 않는다.
    // 공유 링크·코드로 받은 경우는 돌아갈 상세가 없으니 그대로 닫는다.
    const sf = surfaceRef.current
    if (sf?.kind === 'ptake') { if (sf.post) slideTo(-1, { kind: 'plaza', item: null, post: sf.post }); else closeSurface() }
    const nm = snap.name || presets.find((p) => p.id === targetId)?.name
    notify(nm ? `공유받은 코디를 '${nm}'에 저장했어요` : '공유받은 코디를 프리셋에 불러왔어요')
  }
  // 넥슨 코디 → 스냅샷(lib/nexonLook — 수집 배치와 같은 규칙). 목록 · 피부 톤 · 헤어와 성형 그림 대조를 여기서 채운다
  const nickDeps = (lookPx: ImageData | null): LookDeps => ({
    list: loadSlotFolded, tones: indexRef.current?.base.tones ?? [],
    ...(lookPx ? { pickBeauty: (cands: ListItem[], pal: PaletteParams) => pickBySprite(lookPx, cands, pal) } : {}),
  })
  // 닉네임 → 코디 후보 목록: 내부 프록시(/api/nick)로 넥슨 착용(캐시아이템 + 헤어/성형/피부)을 받아 내부 아이템에 매칭.
  // 일반 직업은 1벌, 제로/엔젤릭버스터는 2벌이 나온다.
  const importByNick = async (nick: string): Promise<LookOption[] | null> => {
    try {
      // v: 캐시 버스터. 브라우저에 남아 있을 수 있는 잘못된 옛 응답을 다시 쓰지 않게 한다(서버는 읽지 않는다). 응답 형식을 바꾸면 올린다.
      const r = await fetch(`/api/nick?name=${encodeURIComponent(nick)}&v=2`)
      const j = await r.json().catch(() => null)
      if (!r.ok) { notify(j?.error || '불러오기에 실패했어요'); return null }
      const gender: string | null = j?.gender ?? null
      const looks: NexonLook[] = Array.isArray(j?.looks) ? j.looks : []
      // 캐릭터 이미지는 지금 모습(제로 · 엔버는 지금 쓰는 쪽) 하나다. 그 코디의 헤어 · 성형을 고를 때만 쓴다.
      const imgKey = j?.lookMode === '1' ? 'additional' : 'normal'
      const lookPx = typeof j?.image === 'string' ? await loadLookPixels(j.image) : null
      const out: LookOption[] = []
      for (const lk of looks) {
        // 코디별 성별 우선(제로 알파=남/베타=여). 없으면 캐릭터 성별로 폴백.
        const g = lk.gender ?? gender
        const presets: PresetOption[] = []
        for (const pr of lk.presets || []) {
          const snap = await lookToSnapshot(lk, pr.items, g, nickDeps(lk.key === imgKey ? lookPx : null))
          if (snap) presets.push({ key: pr.key, label: pr.label, active: pr.active, snap })
        }
        if (presets.length) out.push({ key: lk.key, label: lk.label, presets })
      }
      if (!out.length) { notify('불러올 수 있는 아이템이 없어요'); return null }
      return out
    } catch { notify('불러오기에 실패했어요'); return null }
  }
  // 불러온 스냅샷을 선택된 프리셋에 덮어쓰고 라이브에 적용.
  const applyImported = async (snap: Snapshot, label: string) => {
    if (!selectedPreset) return
    setPresetData((d) => ({ ...d, [selectedPreset]: snap }))
    setPresets((ps) => ps.map((p) => (p.id === selectedPreset ? { ...p, name: label } : p))) // 넥슨 닉네임으로 이름 변경
    await applySnapshot(snap)
    setNickInput('')
    notify(`'${label}' 코디를 프리셋에 불러왔어요`)
  }
  // 입력이 공유 링크(…/?c=<코드>)나 공유 코드면 그 안의 코디 스냅샷을 꺼낸다. 아니면 null(→ 닉네임으로 취급).
  const extractSharedSnap = async (input: string): Promise<Snapshot | null> => {
    let code = input.trim()
    const m = code.match(/[#?&]c=([^&\s]+)/) // URL 안의 #c= / ?c= / &c=
    if (m) { try { code = decodeURIComponent(m[1]) } catch { code = m[1] } }
    try { return await resolveShareCode(code) } catch { return null }
  }
  const importFetch = async () => {
    if (importing) return
    const val = nickInput.trim()
    if (!val) { notify('닉네임이나 공유 링크를 입력해 주세요'); return }
    // 공유 링크/코드 입력 → 링크로 접속했을 때와 동일하게 '공유받은 코디' 화면을 띄워 어느 프리셋에 넣을지 고르게 한다.
    // 공유 링크·코드면 닉네임으로 넘기지 않는다(못 풀면 '없는 캐릭터'가 아니라 공유 코디 안내). 푸는 동안도 '불러오는 중'.
    const isShare = /[#?&]c=|^PB/.test(val)
    if (isShare) setImporting(true)
    const shared = await extractSharedSnap(val).finally(() => { if (isShare) setImporting(false) })
    if (shared) { openShared(shared); setNickInput(''); return }
    if (isShare) { notify('공유 코디를 찾지 못했어요. 링크를 다시 확인해 주세요'); return }
    if (!selectedPreset) { notify('덮어쓸 프리셋을 먼저 골라 주세요'); return }
    setImporting(true)
    try {
      const opts = await importByNick(val)
      if (!opts) return
      setLookPick({ nick: val, options: opts })
    } finally { setImporting(false) }
  }
  // 다이얼로그에서 코디 × 프리셋을 골랐다 → 그 한 벌을 적용.
  const chooseLook = async (lookKey: string, presetKey: string) => {
    const lp = lookPick
    if (!lp) return
    const opt = lp.options.find((o) => o.key === lookKey)?.presets.find((p) => p.key === presetKey)
    setLookPick(null)
    if (!opt) return
    // 꺼 둔 장식(칭호 · 명찰 · 훈장 · 말풍선 — 프리셋 탭의 '불러올 장식')은 빼고 넣는다(사용자 지시)
    const take = readUiPref().nickTake ?? {}
    const eq = { ...opt.snap.equipped }
    for (const sl of NICK_TAKE_SLOTS) if (take[sl.slot] === false) delete eq[sl.slot]
    await applyImported({ ...opt.snap, equipped: eq }, lp.nick)
  }
  // 공유 링크 복사: 링크는 로컬에서 즉시 만들어 바로 클립보드에 넣고, 카드 이미지·서버 저장은 뒤에서 한다(shareCode).
  const copyShareLink = (snap: Snapshot, done = '프리셋을 복사했어요') => {
    const prep = prepareShare(location.origin, snap)
    void copyAsyncText(() => prep.then((x) => x.url))
    notify(done)
    prep.then((x) => uploadShare(x, snap))
      .then((r) => { if (r === 'stale') notify('사이트가 바뀌었어요. 새로고침한 뒤 다시 복사해 주세요'); else if (r === 'fail') notify('링크 저장에 실패했어요. 다시 복사해 주세요') })
      .catch(() => {})
  }
  // 프리셋 카드의 복사 띠지. 이름까지 담아, 접속하면 '공유받은 코디' 화면이 뜬다.
  const sharePreset = (p: Preset) => {
    const snap = p.id === selectedPreset ? snapshot() : (presetData[p.id] ?? defaultSnapshot())
    copyShareLink({ ...snap, name: p.name })
  }
  // 현재 코디 스냅샷 + 선택된 프리셋 이름(공유 시 이름까지 그대로 전달된다).
  const curSnapNamed = (): Snapshot => ({ ...snapshot(), name: presets.find((p) => p.id === selectedPreset)?.name })
  // 헤더 "프리셋 복사": 현재 코디를 ?c=<code> 로 담은 URL 을 복사. 접속하면 '공유받은 코디' 다이얼로그가 뜬다(위 openShared).
  const shareCurrentLink = () => {
    copyShareLink(curSnapNamed())
  }
  // 핑크빈 코디 평가: 착용 아이템(텍스트)을 백엔드 /rate(qwen-flash + 핑크빈 페르소나)로 보내 짧은 말 두세 마디를 받는다.
  // 받는 동안과 받은 뒤의 연출은 preview/PinkbeanRate 가 한다(핑크빈이 무대로 나와 말한다).
  const rateNonce = useRef(0)
  const rateHistory = useRef<string[]>([]) // 핑크빈이 최근에 한 말(반복 방지용으로 백엔드에 전달)
  const rateSlots = useRef<string[]>([])   // 바로 앞 평가에서 본 부위(이번에는 다른 부위를 보게 한다)
  const rateCodi = async () => {
    if (rating || rateLock.current) return
    rateLock.current = true
    // 미리보기가 화면에 없으면(핑크빈이 나올 무대가 없다) 받는 중임을 토스트로 알리고, 답을 받으면 바로 푼다
    const staged = !!document.querySelector('[data-pb-rate]')
    if (staged) { setRateShow(true); rateLockTimer.current = setTimeout(endRate, 40000) } else notify('핑크빈이 코디를 살펴보고 있어요')
    setRating(true)
    try {
      // id 도 함께 → 백엔드가 그 아이템의 캡션(생김새)을 붙여 "이름"이 아니라 "모습"을 보고 말하게 한다.
      // history(최근 발언) → 같은 코디를 여러 번 눌러도 매번 다른 얘기가 나오게 한다.
      const items = Object.entries(equipped).filter(([, it]) => it).map(([slot, it]) => ({ slot, id: it!.id, name: it!.name || it!.id }))
      const res = await fetch(`${backApi()}/rate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items, tone, history: rateHistory.current, recent_slots: rateSlots.current }) })
      const data = await res.json()
      // 말은 모델이 짓는다 → 성적·폭력적 표현이 섞여 나오는 경우를 화면에 붙이기 직전에 버린다(lib/safeText).
      // 서버에서도 같은 규칙으로 거르지만 백엔드는 따로 배포되므로, 여기서 한 번 더 본다.
      // slots = 말마다 핑크빈이 보고 있는 부위(없거나 비어 있으면 말에서 짐작한다 — rateSlotOf).
      const raw: unknown[] = Array.isArray(data.bubbles) ? data.bubbles : [], slots: unknown[] = Array.isArray(data.slots) ? data.slots : []
      const bubbles = safeBubbles(raw)
      const worn = (sl: unknown) => (typeof sl === 'string' && equipped[sl] ? sl : '')
      const lines = bubbles.map((text) => { const i = raw.findIndex((b) => String(b ?? '').trim() === text); return { text, slot: worn(slots[i]) || rateSlotOf(text, equipped) } })
      rateHistory.current = [...bubbles, ...rateHistory.current].slice(0, 6) // 최근 6개만 기억(거른 뒤 것만)
      rateSlots.current = lines.map((l) => l.slot).filter(Boolean)
      setRateResult({ lines, nonce: ++rateNonce.current })
    } catch {
      setRateResult({ lines: [{ text: '뀨…? 지금은 딴청 부리는 중이야!', slot: '' }], nonce: ++rateNonce.current })
    } finally { setRating(false); if (!staged) endRate() }
  }
  // 프리셋 삭제 = 코디 기본값 + 기본 이름으로 되돌림(칸 수는 고정). 선택된 프리셋이면 라이브 모델도 즉시 적용.
  const resetPreset = (id: string) => {
    const snap = defaultSnapshot()
    const i = presets.findIndex((p) => p.id === id) // 기본 이름은 지금 자리의 번호(코디 N)
    // 지우기 전 내용·이름을 기록에 함께 남긴다 → 되돌리기로 그 칸의 코디·이름이 돌아온다.
    // 보고 있지 않은 칸을 지우면 라이브 코디가 그대로라, 따로 남기지 않으면 기록 자체가 없다.
    const over: PresetOver<Snapshot> = {
      id,
      prev: id === selectedPreset ? snapshot() : (presetData[id] ?? defaultSnapshot()),
      prevName: presets.find((p) => p.id === id)?.name ?? '',
      next: snap, nextName: i >= 0 ? defaultPresetName(i) : '',
    }
    setPresetData((d) => ({ ...d, [id]: snap }))
    if (i >= 0) setPresets((ps) => ps.map((p) => (p.id === id ? { ...p, name: defaultPresetName(i) } : p)))
    // 연출 설정(형상변이·귀·무기모션·이펙트·배율뿐 아니라 시선·액션·표정·fps 까지)도 이 프리셋에 각인돼 있다
    // → 보고 있는 프리셋을 초기화하면 화면의 연출도 전부 기본으로 되돌린다.
    // applySnapshot 은 코디에 속하는 연출만 되돌리므로, 나머지는 여기서 함께 맞춘다.
    if (id === selectedPreset) {
      histOver.current = over // 라이브가 바뀌므로 아래 기록 effect 가 이 over 를 집어간다
      setPvState(PV_DEFAULT); applySnapshot(snap).catch(() => {})
    } else {
      // 라이브는 그대로 → 그 자리에서 직접 기록한다. 바뀐 이름은 아직 상태에 안 들어왔으니 직접 넘긴다.
      pushHistory(over, i >= 0 ? { ...namesOf(presets), [id]: defaultPresetName(i) } : undefined)
    }
    notify('프리셋을 삭제했어요')
  }
  // 프리셋 이름(카드의 인라인 입력). 비운 채로 두면 기본 이름으로 되돌린다(blur 시 호출부가 처리).
  const renamePreset = (id: string, name: string) => setPresets((ps) => ps.map((p) => (p.id === id ? { ...p, name } : p)))
  // 카드 순서를 바꾼다(내용 · 선택은 id 에 붙어 그대로). 이름이 기본 꼴('코디 N')이면 새 자리의 번호로 바꾼다(사용자 지시 —
  // 놓을 때 한 번, 끄는 도중에는 바꾸지 않는다). 사용자가 지은 이름은 그대로. 모르는 id 나 빠진 칸이 있으면 바꾸지 않는다
  const reorderPresets = (ids: string[]) => setPresets((ps) => {
    const by = new Map(ps.map((p) => [p.id, p]))
    if (ids.length !== ps.length || ids.some((id) => !by.has(id)) || new Set(ids).size !== ids.length) return ps
    return ids.map((id, i) => { const p = by.get(id)!; return isDefaultPresetName(p.name) ? { ...p, name: defaultPresetName(i) } : p })
  })
  // 이름 입력을 마쳤을 때(입력창을 벗어날 때) — 비었으면 기본 이름으로 되돌리고, 바뀐 이름을 되돌리기 기록 한 건으로 남긴다.
  // 글자마다 기록하면 되돌리기가 한 글자씩 지워지므로 확정 시점에만 남긴다.
  const commitPresetName = (id: string, fallback: string) => {
    const cur = presets.find((p) => p.id === id)
    if (!cur) return
    const name = cur.name.trim() ? cur.name : fallback
    if (name !== cur.name) renamePreset(id, name)
    pushHistory(null, { ...namesOf(presets), [id]: name })
  }
  const presetUsed = presets.filter((p) => presetData[p.id] && snapCoreKey(presetData[p.id]) !== DEFAULT_CORE_KEY).length

  // 프리셋 · 비교 칸을 각자의 저장소에 쓴다. 프리셋 저장소의 sel 은 비교 중이면 돌아갈 프리셋(새로고침하면 비교 칸은 CMP_KEY 의 last 로 다시 연다)
  const writePresetStore = (data: Record<string, Snapshot>) => {
    try {
      const names: Record<string, string> = {}; for (const p of presets) names[p.id] = p.name
      const real: Record<string, Snapshot> = {}; for (const id of PRESET_IDS) if (data[id]) real[id] = data[id]
      localStorage.setItem(PRESET_KEY, JSON.stringify({ data: real, names, sel: cmpOn ? cmpBack : selectedPreset, order: presets.map((p) => p.id), v: PRESET_STORE_V } as PresetStore))
      const cdata: Record<string, Snapshot> = {}; for (const id of cmpIds) if (data[id]) cdata[id] = data[id]
      localStorage.setItem(CMP_KEY, JSON.stringify({ ids: cmpIds, data: cdata, on: cmpOn, last: cmpOn ? selectedPreset : cmpLast.current, back: cmpBack } as CmpStore))
    } catch {}
  }
  // 자동 저장: 라이브 모델이 바뀔 때마다 선택된 프리셋에 저장(100ms 디바운스). 프리셋 적용으로 인한
  // 변경은 스킵(applyingRef). 프리셋을 "보기만" 할 땐 변화가 없어 저장이 일어나지 않는다.
  useEffect(() => {
    if (applyingRef.current) { applyingRef.current = false; return }
    if (!initedRef.current || !selectedPreset) return
    if (saveT.current) clearTimeout(saveT.current)
    saveT.current = setTimeout(() => {
      const snap = snapshot()
      // presetData 갱신 + localStorage 영속을 한 번(100ms)에 "동시" 처리.
      // 비교 중이면 고른 칸과 비교 전 프리셋(cmpBack)에 함께 저장한다 — 고른 칸 = 프리셋(사용자 지시: 고른 것과 프리셋이 따로 노는 게 더 불편하다)
      setPresetData((d) => {
        const next = { ...d, [selectedPreset]: snap, ...(cmpOn && cmpBack ? { [cmpBack]: snap } : {}) }
        writePresetStore(next)
        return next
      })
    }, 100)
    return () => { if (saveT.current) clearTimeout(saveT.current) }
    // 저장 대상 pv 변경도 자동저장 트리거에 포함해야 새로고침 후 유지된다 — 코디 연출(형상변이·귀·무기모션·이펙트)과
    // 보기 설정(시선·액션·표정·배율) 모두. (fps 만 담지 않는다.)
  }, [equipped, tone, dyePalette, dyeHsb, dyeOff, hidden, dotPos, selectedPreset, presets,
      pv.form, pv.ear, pv.weapon, pv.wEffect, pv.cEffect, pv.capEffect, pv.floatFx, pv.baseTag, pv.zoom, pv.gaze, pv.action, pv.expr, bgSel])

  // 연출설정(pv) 전체를 새로고침 후에도 유지 — 프리셋 스냅샷엔 서브셋만 담기므로 전체 pv 를 별도 키에 영속.
  useEffect(() => {
    if (!initedRef.current) return
    try { localStorage.setItem(PV_KEY, JSON.stringify(pv)) } catch {}
  }, [pv])

  // 실행취소 히스토리: 코디 상태가 바뀔 때마다 "즉시" 스냅샷 기록(부위 빠르게 눌러도 전부 남음).
  // undo/redo 로 적용된 변경(histExpect 일치)은 기록하지 않아 스택이 오염되지 않는다. 최근 50개 유지.
  // 기록 한 건. 보통은 아래 effect 가 라이브 코디 변화를 보고 부르지만, **라이브가 그대로인 변경**
  // (선택하지 않은 프리셋을 초기화)은 그 자리에서 직접 부른다.
  // 그런 기록은 코디·선택 프리셋이 직전과 같고 over 만 다르다 → undo 가 over 로 그 칸을 되살린다.
  // names: 방금 바꿔 아직 상태에 반영되지 않은 이름을 넘길 때(이름 확정 — commitPresetName). 없으면 지금 이름.
  const pushHistory = (over?: PresetOver<Snapshot> | null, namesNow?: Record<string, string>) => {
    if (!initedRef.current) return
    const snap = snapshot()
    const names = namesNow ?? namesOf(presets)
    const j = histKey(snap, selectedPreset, names)
    const h = histOf(selectedPreset)
    if (j === histExpect.current) { histExpect.current = null; h.last = j; return }
    const ov = over ?? histOver.current
    if (j === h.last && !ov) return // 덮어쓰기는 코디가 같아도(이름·다른 프리셋이 바뀜) 기록한다. h.last = 그 갈래의 마지막 상태키(중복 방지)
    histOver.current = null
    h.last = j
    h.stack = h.stack.slice(0, h.idx + 1)
    h.stack.push({ snap, sel: selectedPreset, names, ...(ov ? { over: ov } : {}) })
    if (h.stack.length > 50) h.stack = h.stack.slice(h.stack.length - 50)
    h.idx = h.stack.length - 1
    setHistVer((v) => v + 1)
  }
  useEffect(() => {
    if (!initedRef.current) return // 초기 로드 완료 전엔 기록 안 함 → 첫 기록 = 초기 프리셋(baseline)
    pushHistory()
  }, [equipped, tone, dyePalette, dyeHsb, dyeOff, hidden, dotPos, selectedPreset, bgSel])


  const applyHistory = (e0: { snap: Snapshot; sel: string | null; names?: Record<string, string> }) => {
    // 배율은 지금 그대로(되돌리기와 무관한 값). 배경은 그 기록의 값으로 돌아간다
    const e = e0.snap.pv ? { ...e0, snap: { ...e0.snap, pv: { ...e0.snap.pv, zoom: pv.zoom } } } : e0
    // 이름 전체도 그 시점으로(오래된 기록엔 없으면 지금 이름 유지). 코디가 같아도 이름만 바뀌는 기록이 있다.
    const names = e.names ?? namesOf(presets)
    if (e.names) setPresets((ps) => ps.map((p) => (e.names![p.id] != null ? { ...p, name: e.names![p.id] } : p)))
    const j = histKey(e.snap, e.sel, names)
    histExpect.current = j; histOf(e.sel).last = j
    // 코디·선택 프리셋이 그대로면(이름·연출만 되돌림) 기록 effect 가 돌지 않는다 → 기대값을 남겨 두지 않는다
    // (남아 있으면 나중에 같은 상태로 돌아온 진짜 변경을 기록하지 않고 삼킨다).
    if (e.sel === selectedPreset && snapCoreKey(e.snap) === snapCoreKey(snapshot()) && (e.snap.bg ?? 'room') === bgSel) histExpect.current = null
    // 코디 + 선택 프리셋을 함께 복원. skipAutosave=false → 되돌린 코디가 그 프리셋에 저장된다(비교 칸의 기록은 늘 그 칸이 선택 프리셋이다).
    applySnapshot(e.snap, false, true, e.sel).catch(() => {})
    setHistVer((v) => v + 1)
  }
  void histVer // 재렌더 트리거(canUndo/canRedo 재계산)
  const curHist = histOf(selectedPreset)
  const canUndo = curHist.idx > 0
  const canRedo = curHist.idx < curHist.stack.length - 1
  // 덮어쓴 프리셋을 되살린다(내용 + 이름). 선택 프리셋이면 이어지는 applyHistory 의 자동저장이 같은 값을 쓴다.
  const restoreOver = (o: PresetOver<Snapshot>, back: boolean) => {
    const snap = back ? o.prev : o.next, name = back ? o.prevName : o.nextName
    setPresetData((d) => ({ ...d, [o.id]: snap }))
    if (name) setPresets((ps) => ps.map((p) => (p.id === o.id ? { ...p, name } : p)))
  }
  const undo = () => {
    const h = histOf(selectedPreset)
    if (h.idx <= 0) { notify('되돌릴 변경이 없어요'); return }
    const from = h.stack[h.idx]
    h.idx -= 1
    if (from.over) restoreOver(from.over, true)
    applyHistory(h.stack[h.idx])
  }
  const redo = () => {
    const h = histOf(selectedPreset)
    if (h.idx >= h.stack.length - 1) { notify('다시 실행할 변경이 없어요'); return }
    h.idx += 1
    const to = h.stack[h.idx]
    if (to.over) restoreOver(to.over, false)
    applyHistory(to)
  }

  // 영속: 프리셋 데이터/이름/선택을 localStorage 에 저장(디바운스). 서버 없이 새로고침/재실행에도 유지.
  useEffect(() => {
    if (!initedRef.current) return
    const t = setTimeout(() => writePresetStore(presetData), 100)
    return () => clearTimeout(t)
  }, [presetData, presets, selectedPreset, cmpIds, cmpBack])
  // 오프셋 커밋(아이템ID → 레이어 → Vec) / 초기화(그 아이템 오프셋 전부 제거 = 기본 위치).
  const setDot = (itemId: string, layer: string, v: Vec) =>
    setDotPos((prev) => ({ ...prev, [itemId]: { ...(prev[itemId] || {}), [layer]: v } }))
  const resetDot = (itemId: string) =>
    setDotPos((prev) => { if (!prev[itemId]) return prev; const n = { ...prev }; delete n[itemId]; return n })
  const onPageFocus = (e: React.FocusEvent<HTMLInputElement>) => { setPageEditing(true); setPageInput(String(curIdx + 1)); const el = e.target; requestAnimationFrame(() => el.select()) }
  const onPageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/[^0-9]/g, '').slice(0, 6)
    setPageInput(val)
    if (pageT.current) clearTimeout(pageT.current)
    pageT.current = setTimeout(() => { const n = parseInt(val, 10); if (!isNaN(n)) setIdx(n - 1) }, 150)
  }
  const commitPage = () => { if (pageT.current) clearTimeout(pageT.current); const n = parseInt(pageInput, 10); if (!isNaN(n)) setIdx(n - 1); setPageEditing(false); setPageInput('') }
  const onPageKey = (e: React.KeyboardEvent<HTMLInputElement>) => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur() } else if (e.key === 'Escape') e.currentTarget.blur() }

  const nameSel = cmpOn ? cmpBack : selectedPreset // 비교 중에도 명찰 · 저장 이름은 돌아갈 프리셋의 이름
  const chatName = presets.find((p) => p.id === nameSel)?.name?.trim() || CHAT_NAME_FALLBACK
  // 이미지 · 움짤 저장 이름 = 쓰고 있는 프리셋 이름(비면 그 번호의 코디 N). 프리셋을 고르지 않았으면 명찰과 같은 이름
  const selIdx = presets.findIndex((p) => p.id === nameSel)
  const saveName = selIdx >= 0 ? presetFileName(presets[selIdx].name, selIdx) : CHAT_NAME_FALLBACK
  const value: ShopCtx = {
    index, cats, infoCats, chatOn, chatDefault, chatName, saveName, chatMsg, sendChat, catLoading, activeList, search, setSearch,
    genderFilter, setGenderFilter,
    primary, setPrimary, goHome,
    aiQ, setAiQ, searchQuery, runSearch, searchResults: searchResultsView, searchLoading,
    undo, redo, canUndo, canRedo,
    activeCat, setActiveCat, favorites, toggleFavorite, newIds,
    bookmarks, isBookmarked, toggleBookmark, clearBookmarks,
    warmForPreview, listMode, setListMode, bgSel, listDir, setListDir, bindVp, bindTrack, snapFrom, consumeSwipeClick,
    curIdx, pageCount, snapping, setIdx, step,
    bp, cols, rows, itemsPerPage,
    plazaPosts, plazaList, plazaLoading: plazaConfigured() && !plazaLoaded, plazaReady: plazaConfigured(),
    plazaFilter, setPlazaFilter, plazaSort, setPlazaSort, plazaQ, setPlazaQ, plazaUpload, setPlazaUpload,
    plazaCols: plazaGrid.cols, plazaRows: plazaGrid.rows,
    openPlazaPost, openNotice, guideGo, plazaTakeDirect, wearFromSnap, isWornFromSnap, plazaTakeBack, resolveSnapItems: resolveEquipped,
    plazaLike, plazaRemove, plazaCopyLink, plazaSubmit, plazaSubmitting,
    pageEditing, pageInput, onPageFocus, onPageChange, onPageKey, commitPage,
    equipped, tone, equipFromCat, equipItem, isEquippedInCat, unequipSlot, hidden, setHidden,
    dyeTarget, setDyeTarget, dyePalette, setDyePalette, dyeHsb, setDyeHsb, dyeOff, toggleDyeOff, renderPalette, renderHsb, isMixSlot,
    surface, surfaceClosing, openSheet, openDye, openCard, openDot, closeSurface,
    openPartItem, partBack, partSlide, cmpOn, cmpIds, cmpBack, toggleCompare, pickCmp, addCmp, removeCmp,
    dotPos, setDot, resetDot,
    pv, setPv,
    presets, presetData, selectedPreset, presetUsed, selectPreset, sharePreset, resetPreset, renamePreset, reorderPresets, commitPresetName, snapshot,
    nickInput, setNickInput, importFetch, importing, shareCurrentLink, applySharedToPreset, rateCodi, rating, rateBusy: rating || rateShow, endRate, rateResult, takeRate,
    lookPick, chooseLook, closeLookPick: () => setLookPick(null),
    toast, toastText, notify,
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
