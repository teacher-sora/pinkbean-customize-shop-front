// 넥슨 Open API 로 받은 코디 → 우리 스냅샷. 닉네임 불러오기(/api/nick + ShopContext)와 코디 룩북 표본 수집(parser looks/)이
// **같은 규칙**을 쓰도록 한곳에 둔다(규칙을 복사하면 둘이 어긋난다). React 상태에 기대지 않는다 — 목록 · 피부 톤은 인자로 받는다.
//  ① 넥슨 원본(cashitem · beauty · item-equipment) → 코디 벌(NexonLook): buildLooks
//  ② 코디 벌 × 프리셋 → 스냅샷: lookToSnapshot

import type { PaletteParams, HsbParams } from '@/lib/core/dye'
import { loadMeta, type ListItem } from '@/lib/core/data'
import { getFrameLayers } from '@/lib/core/assemble'
import { clampDye } from '@/lib/color'
import { DEFAULT_EQUIP, DEFAULT_TONE, DOT_MOVER_IDS, THUMB_VIEW, isDyeableSkin } from '@/lib/shopData'
import type { DotOffsets, Snapshot } from '@/components/shop/ShopContext'

// 출처 표기(넥슨 Open API 이용약관 제6조 ④ — 결과 데이터에 'NEXON Open API'를 이용한 것임을 명시. 문구는 넥슨 안내 그대로).
// 넥슨 데이터를 보여 주는 화면마다 한 줄로 두고, 앱 전체에서 늘 닿는 자리(도움 및 건의함 머리)에도 둔다.
export const NEXON_CREDIT = 'Data based on NEXON Open API'

// ── ① 넥슨 원본 → 코디 벌 ────────────────────────────────────────────────
// ⚠️ 제로 · 엔젤릭버스터는 코디가 **두 벌**이다(제로=알파/베타, 엔버=일반/드레스업).
//    넥슨은 이걸 `additional_*` 접두 필드로 따로 준다(실측 확인):
//      cash_item_equipment_base|_preset_N      ↔ additional_cash_item_equipment_base|_preset_N
//      character_hair|face|skin                ↔ additional_character_hair|face|skin
//    그래서 looks[] 배열로 낸다. 일반 직업은 looks 가 1개, 제로/엔버는 2개.
//    **직업명으로 분기하지 않는다** — additional 에 실제 내용이 있을 때만 2번째를 넣는다(더 견고).

// 캐시 아이템 염색(컬러 프리즘). 넥슨이 색상계열/색조/채도/명도를 그대로 준다 → 내부 HsbParams 와 1:1 대응.
// (염색 안 한 아이템은 null 이다 — 필드 자체가 없는 게 아니다.)
interface RawPrism { color_range?: string | null; hue?: number | null; saturation?: number | null; value?: number | null; black_inclusive_flag?: string | null }
// custom_origin = 프리스타일(사소한 변경점/쩜) 아이템의 점 위치. custom_origin_no 1→첫째 점, 2→둘째 점.
// x/y 는 문자열이며 게임 내부 origin 좌표(= WZ origin 과 같은 프레임). lookToSnapshot 이 오프셋으로 바꾼다.
interface RawCustomOrigin { custom_origin_no: number; x: string; y: string }
interface RawCashItem {
  cash_item_equipment_part: string
  cash_item_equipment_slot: string
  cash_item_name: string
  item_gender: string | null
  cash_item_coloring_prism?: RawPrism | null
  custom_origin?: RawCustomOrigin[] | null
}
interface RawBeautyPart { hair_name?: string; face_name?: string; base_color?: string | null; mix_color?: string | null; mix_rate?: string | null }
// 피부: 컬러라인(커스텀) 피부는 color_style(색상계열)/hue/saturation/brightness 로 염색된다(캐시 프리즘과 동일 개념).
interface RawSkinPart { skin_name?: string; color_style?: string | null; hue?: number | null; saturation?: number | null; brightness?: number | null }
export type NexonRaw = Record<string, unknown>
export type NexonBeautyRaw = Record<string, RawBeautyPart & RawSkinPart>

// prism = 캐시 아이템 염색(컬러 프리즘). blackInclusive = 인게임 '순수 검정 포함'(우리 '테두리 포함', HsbParams.edge).
export type NexonPrism = { colorRange: string | null; hue: number; saturation: number; value: number; blackInclusive?: boolean }
export type NexonCustomOrigin = { no: number; x: number; y: number }
export type NexonItem = { part: string; slot: string; name: string; gender: string | null; prism: NexonPrism | null; customOrigin: NexonCustomOrigin[] | null }
export type NexonBeauty = { name: string; baseColor: string | null; mixColor: string | null; mixRate: string }
// 치장 프리셋 한 벌 = base + preset_n 덮어쓰기(items 는 이미 병합된 결과). active = 지금 게임에서 입고 있는 것.
export type NexonPreset = { key: string; label: string; items: NexonItem[]; active: boolean }
// 넥슨이 주는 코디 1벌. gender 는 코디별로 다를 수 있다 — 제로는 캐릭터 성별이 '기타'로 오고 알파=남/베타=여 이므로
// 이걸 쓰지 않으면 헤어 · 성형의 (남)/(여) 변형이 엉뚱하게 잡힌다.
export type NexonLook = { key: 'normal' | 'additional'; label: string; gender: string | null; presets: NexonPreset[]; hair: NexonBeauty | null; face: NexonBeauty | null; skin: { name: string; prism: NexonPrism | null } | null }
export type NexonLooks = { gender: string | null; charClass: string | null; lookMode: string | null; looks: NexonLook[] }

// 메이플 치장 프리셋 구조(실측):
//   base       = 베이스 코디 전체(예: 11개)
//   preset_1~3 = "덮어쓸 부위만" 담긴 부분 집합(0~4개) — 나머지 부위는 base 로 채워진다
//   preset_no  = 지금 적용 중인 프리셋 번호. None 이면 "해제" = base 를 그대로 입고 있는 상태다.
// 그래서 프리셋 한 벌 = base + preset_n 덮어쓰기. n=0 이면 base 그대로(기본).
function mergeItems(data: NexonRaw, prefix: string, presetNo: number): NexonItem[] {
  const bySlot: Record<string, RawCashItem> = {}
  for (const it of ((data[`${prefix}base`] as RawCashItem[]) || [])) bySlot[it.cash_item_equipment_slot] = it
  if (presetNo) for (const it of ((data[`${prefix}preset_${presetNo}`] as RawCashItem[]) || [])) bySlot[it.cash_item_equipment_slot] = it
  return Object.values(bySlot)
    // 반투명 시리즈(반투명 모자/한벌옷/신발/망토/무기)는 자체 스프라이트가 없이 "그 부위의 일반 장비를 그대로
    // 비쳐 보여주는" 캐시 아이템이다. 그래서 CDN 카탈로그에 없다(빈 카드가 되므로 의도적으로 제외됨).
    // 코디로 불러올 땐 그 부위에 캐시(반투명)가 아니라 **일반 장비가 대신 들어가야** 하므로, 캐시 목록에서 뺀다.
    // → mergeLayers 에서 그 부위의 reg(일반 장비)가 덮이지 않고 그대로 남아 코디 아이템이 된다.
    // (투명=부위를 아무것도 없는 것처럼 비움 / 반투명=부위에 일반 장비를 대신 노출 — 둘은 반대 동작이다.)
    .filter((it) => !it.cash_item_name.includes('반투명'))
    .map((it) => {
      const p = it.cash_item_coloring_prism
      return {
        part: it.cash_item_equipment_part, slot: it.cash_item_equipment_slot,
        name: it.cash_item_name, gender: it.item_gender,
        // 염색 안 했으면 prism=null → 그대로 null 로 넘겨 무시하게 한다.
        prism: p && (p.hue != null || p.saturation != null || p.value != null)
          // black_inclusive_flag '1' = 인게임 '순수 검정 포함'(테두리 포함). 빠뜨리면 불러온 코디의 검은 테두리가 염색되지 않는다.
          ? { colorRange: p.color_range ?? null, hue: p.hue ?? 0, saturation: p.saturation ?? 0, value: p.value ?? 0, blackInclusive: p.black_inclusive_flag === '1' }
          : null,
        // 점 위치(사소한 변경점/쩜): 있으면 no/x/y 로 넘긴다. 없으면 null.
        customOrigin: it.custom_origin && it.custom_origin.length
          ? it.custom_origin.map((c) => ({ no: c.custom_origin_no, x: Number(c.x), y: Number(c.y) }))
          : null,
      }
    })
}

// 일반(비캐시) 장비 = 넥슨 item-equipment. 코디는 캐시뿐 아니라 일반 아이템도 취급하므로(예: 일반 한벌옷
// '클래식 백금슈트'), 아바타에 보이는 일반 장비도 함께 넘겨 캐시 아이템의 "베이스 레이어"로 쓴다.
interface RawRegItem { item_equipment_part?: string; item_equipment_slot?: string; item_name?: string; item_shape_name?: string | null }
// 일반 장비는 두 이름이 서로 다른 뜻이다.
//   item_equipment_part = 아이템 분류(한벌옷 · 차크람 · 헥스시커)
//   item_equipment_slot = 착용 칸(상의 · 무기 · 보조무기)
// 칼리의 옷은 part=한벌옷 · slot=상의 로 온다. slot 을 먼저 보면 한벌옷을 '상의'에서 찾게 돼 매칭이 실패하고
// (우리 카탈로그에서 칼리의 옷은 한벌옷), 한벌옷↔상하의 배타 처리(mergeLayers)도 어긋난다.
// 그래서 **옷 계열은 분류(part)를, 그 밖은 착용 칸(slot)을** 쓴다 — 무기는 분류가 '차크람'처럼 제각각이라 칸이 맞다.
const WEAR_PARTS = new Set(['한벌옷', '상의', '하의', '모자', '얼굴장식', '눈장식', '귀고리', '망토', '장갑', '신발'])
function regularVisible(idata: NexonRaw | null): NexonItem[] {
  const arr = (idata?.item_equipment as RawRegItem[]) || []
  const out: NexonItem[] = []
  for (const it of arr) {
    const p = it.item_equipment_part || '', s = it.item_equipment_slot || ''
    const ring = p === '반지' // 반지는 칸(반지1~4)이 넷이라 칸 이름을 slot 으로 남긴다(mergeLayers 가 칸마다 따로 둔다)
    const part = WEAR_PARTS.has(p) || ring ? p : (s || p)
    // 모루(외형 덮어쓰기)를 쓴 장비는 **보이는 게 `item_shape_name`** 이다(예:
    // '소라사키히나'의 모자가 에테르넬 나이트헬름으로 불러와졌지만 게임에선 브옐 데빌스 혼으로 보인다).
    // 실측(그 캐릭터 장비 25종): 모루를 안 쓴 장비는 shape 가 이름과 **같게** 오고, 모루를 쓴 모자만 달랐다.
    // 우리는 외형만 그리므로 shape 를 먼저 쓴다. 부위(part)는 모루가 같은 분류끼리만 되므로 그대로 둔다.
    const name = it.item_shape_name || it.item_name
    if (!part || !name) continue // 파트명(한벌옷/상의/무기 등)은 NEXON_PART_SLOT 이 화이트리스트로 걸러낸다
    out.push({ part, slot: ring ? s : part, name, gender: null, prism: null, customOrigin: null })
  }
  // 훈장 · 칭호의 외형. 훈장은 외형을 바꾼 이름(medal_shape_changed_name)이 보이는 것이고, 장비 '훈장' 칸보다 앞선다.
  // 칭호는 지금 장비 프리셋의 칭호(title — 외형을 바꿨으면 title_shape_name). 둘 다 치장 프리셋과 무관하게 캐릭터에 하나다
  const medal = idata?.medal_shape as { medal_shape_name?: string | null; medal_shape_changed_name?: string | null } | null | undefined
  const medalName = medal?.medal_shape_changed_name || medal?.medal_shape_name
  if (medalName) { for (let i = out.length - 1; i >= 0; i--) if (out[i].part === '훈장') out.splice(i, 1); out.push({ part: '훈장', slot: '훈장', name: medalName, gender: null, prism: null, customOrigin: null }) }
  const title = idata?.title as { title_name?: string | null; title_shape_name?: string | null } | null | undefined
  const titleName = title?.title_shape_name || title?.title_name
  if (titleName) out.push({ part: '칭호', slot: '칭호', name: titleName, gender: null, prism: null, customOrigin: null })
  return out
}
// 일반(베이스) + 캐시(치장) 병합: 같은 부위는 캐시가 덮는다. 한벌옷↔상의/하의는 배타(치장 레이어 우선).
function mergeLayers(reg: NexonItem[], cash: NexonItem[]): NexonItem[] {
  const byPart: Record<string, NexonItem & { _l?: 'reg' | 'cash' }> = {}
  // 반지는 칸(반지1~4)마다 따로 — 부위로 묶으면 일루전 링 · 명찰 · 말풍선 반지 가운데 마지막 하나만 남았다
  const keyOf = (it: NexonItem) => (it.part === '반지' ? it.slot : it.part)
  for (const it of reg) byPart[keyOf(it)] = { ...it, _l: 'reg' }
  for (const it of cash) byPart[keyOf(it)] = { ...it, _l: 'cash' } // 캐시가 일반을 덮어씀
  const ov = byPart['한벌옷'], top = byPart['상의'], bot = byPart['하의']
  if (ov && (top || bot)) {
    const ovCash = ov._l === 'cash', tbCash = top?._l === 'cash' || bot?._l === 'cash'
    if (ovCash && !tbCash) { delete byPart['상의']; delete byPart['하의'] }        // 캐시 한벌옷 → 일반 상하의 숨김
    else if (!ovCash && tbCash) { delete byPart['한벌옷'] }                          // 캐시 상/하의 → 일반 한벌옷 숨김
    else { delete byPart['상의']; delete byPart['하의'] }                            // 동일 레이어 → 한벌옷 우선
  }
  return Object.values(byPart).map(({ _l, ...r }) => r as NexonItem)
}

const col = (o: RawBeautyPart | null | undefined, nameKey: 'hair_name' | 'face_name'): NexonBeauty | null =>
  o && o[nameKey] ? { name: o[nameKey]!, baseColor: o.base_color ?? null, mixColor: o.mix_color ?? null, mixRate: o.mix_rate ?? '0' } : null

// 제로/엔버는 두 벌의 이름이 다르다. 라벨을 여기서 정해 화면은 그리기만 한다.
function labelsFor(charClass: string | null): [string, string] {
  if (charClass === '제로') return ['알파', '베타']
  if (charClass === '엔젤릭버스터') return ['일반', '드레스업']
  return ['일반', '다른 모드']
}

// ⚠️ 제로는 character_gender 가 '기타'로 온다(실측). 그런데 헤어 · 성형은 이름이 같아도 (남)/(여) 변형이
//    따로 있어서, 성별을 모르면 엉뚱한 변형이 잡힌다 — 제로는 알파/베타가 **헤어 · 성형만** 다르므로 치명적이다.
//    알파=남, 베타=여. (근거: 베타가 쓰는 '매직 엘라 헤어'가 카탈로그에 (여) 로만 존재한다.)
function genderForLook(charClass: string | null, kkey: 'normal' | 'additional', charGender: string | null) {
  if (charClass === '제로') return kkey === 'normal' ? '남' : '여'
  return charGender
}

// 넥슨 세 응답(cashitem-equipment · beauty-equipment · item-equipment) → 코디 벌들. 일반 장비는 없어도 된다.
export function buildLooks(data: NexonRaw, beauty: NexonBeautyRaw | null, itemData: NexonRaw | null): NexonLooks {
  const reg = regularVisible(itemData) // 아바타에 보이는 일반 장비(캐시의 베이스 레이어)
  const charClass = (data.character_class as string) ?? null
  const charGender = (data.character_gender as string) ?? null
  const [labelA, labelB] = labelsFor(charClass)
  const activeNo = Number(data.preset_no) || 0 // None/0 = 해제(= base 착용 중)
  // includeReg=true 면 일반 장비를 베이스 레이어로 병합한다. (additional 코디 노출 여부는 캐시만으로 판정하므로
  //  일반 코디 캐릭터에 2번째 코디가 헛노출되지 않게, additional 은 캐시만으로 먼저 판정 후 include 한다.)
  const look = (kkey: 'normal' | 'additional', label: string, includeReg: boolean): NexonLook => {
    const p = kkey === 'normal' ? 'cash_item_equipment_' : 'additional_cash_item_equipment_'
    const b = kkey === 'normal' ? '' : 'additional_'
    const skinPart = beauty?.[`${b}character_skin`]
    const skinName = skinPart?.skin_name
    const items = (n: number) => (includeReg ? mergeLayers(reg, mergeItems(data, p, n)) : mergeItems(data, p, n))
    // 기본은 항상 준다 — preset_no 가 None 인 캐릭터는 이게 곧 "지금 입고 있는 모습"이다.
    const presets: NexonPreset[] = [{ key: 'base', label: '기본', items: items(0), active: activeNo === 0 }]
    for (const n of [1, 2, 3]) {
      // 빈 프리셋(0개)은 base 와 완전히 같아진다 → 내보내지 않는다(똑같은 걸 고르게 할 이유가 없다).
      // 판정은 '캐시 프리셋'만으로 한다(일반 장비는 프리셋 무관 공통이므로 기준에서 제외).
      if (!((data[`${p}preset_${n}`] as RawCashItem[]) || []).length) continue
      presets.push({ key: String(n), label: `프리셋 ${n}`, items: items(n), active: activeNo === n })
    }
    return {
      key: kkey, label,
      gender: genderForLook(charClass, kkey, charGender), // 코디별 성별(제로는 알파/베타가 다르다)
      presets,
      hair: col(beauty?.[`${b}character_hair`], 'hair_name'),
      face: col(beauty?.[`${b}character_face`], 'face_name'),
      // 피부: 컬러라인 커스텀 피부는 HSB 염색까지 넘긴다(색상계열/색조/채도/명도). 염색 안 했으면 prism=null.
      skin: skinName ? {
        name: skinName,
        prism: skinPart && (skinPart.hue != null || skinPart.saturation != null || skinPart.brightness != null)
          ? { colorRange: skinPart.color_style ?? null, hue: skinPart.hue ?? 0, saturation: skinPart.saturation ?? 0, value: skinPart.brightness ?? 0 }
          : null,
      } : null,
    }
  }
  const looks = [look('normal', labelA, true)]
  // 2번째 코디(제로/엔버) 노출 여부는 **캐시 콘텐츠만으로** 판정(일반 장비를 넣으면 항상 non-empty가 되어
  // 일반 직업에도 헛노출됨). 실제 2번째 코디일 때만 일반 장비를 베이스로 병합해 추가한다.
  const extraCash = look('additional', labelB, false)
  if (extraCash.presets.some((x) => x.items.length) || extraCash.hair || extraCash.face || extraCash.skin) looks.push(look('additional', labelB, true))
  return { gender: charGender, charClass, lookMode: (data.character_look_mode as string) ?? null, looks }
}

// ── ② 코디 벌 → 스냅샷 ─────────────────────────────────────────────────
// 넥슨 캐시아이템 part → 내부 slot. (part 로 매핑: '한벌옷'=longcoat, '상의'=coat 구분)
// 반지(칸 넷)는 일루전 링 · 명찰 · 말풍선 반지 목록을 차례로 찾아 맞는 아이템의 부위로 끼운다(NEXON_RING_SLOTS — 사용자 지시: 사이트가 다루는 부위는 모두 가져온다).
// 훈장 · 칭호는 외형 이름으로 온다(regularVisible).
const NEXON_PART_SLOT: Record<string, string> = {
  '모자': 'cap', '얼굴장식': 'faceAcc', '눈장식': 'eyeAcc', '귀고리': 'earring',
  '망토': 'cape', '장갑': 'glove', '신발': 'shoes', '무기': 'weapon', '방패': 'shield', '보조무기': 'shield',
  '한벌옷': 'longcoat', '상의': 'coat', '하의': 'pants', '헤어': 'hair', '성형': 'face', '반지': 'ring',
  '훈장': 'medal', '칭호': 'title',
}
// 스냅샷이 쓸 수 있는 부위 전부 — 수집 배치가 받아 둘 목록(LookDeps.list)
export const NEXON_SLOTS = [...new Set([...Object.values(NEXON_PART_SLOT), 'nameTag', 'chatBalloon'])]
const NEXON_RING_SLOTS = ['ring', 'nameTag', 'chatBalloon']
// 이름 정규화(성별 접미사 · 공백 제거)로 넥슨 이름 ↔ 내부 리스트 이름 매칭.
export const nrmName = (n: string) => (n || '').replace(/\s*\((여|남)\)\s*$/, '').replace(/\s+/g, ' ').trim()
// 넥슨 색상명 → 내부 믹스 팔레트 인덱스(MIX_PALETTE: 검정0 빨강1 주황2 노랑3 초록4 파랑5 보라6 갈색7).
const COLOR_IDX: Record<string, number> = {
  '검은색': 0, '검정': 0, '빨간색': 1, '빨강': 1, '주황색': 2, '주황': 2, '노란색': 3, '노랑': 3,
  '초록색': 4, '초록': 4, '녹색': 4, '파란색': 5, '파랑': 5, '보라색': 6, '보라': 6, '갈색': 7, '밤색': 7,
}
// 성형(눈) 발색 순서(FACE_PALETTE): 검정0 · 파랑1 · 빨강2 · 초록3 · 갈색4 · 에메랄드5 · 보라6 · 자수정7.
// ★ 헤어와 인덱스 의미가 다르다(갈색: 헤어 7 vs 눈 4 / 파랑: 헤어 5 vs 눈 1). 성형은 반드시
//    이 맵을 써야 갈색 눈이 자수정(7)으로, 파란 눈이 에메랄드(5)로 잘못 들어가지 않는다.
const FACE_COLOR_IDX: Record<string, number> = {
  '검은색': 0, '검정': 0, '파란색': 1, '파랑': 1, '빨간색': 2, '빨강': 2,
  '초록색': 3, '초록': 3, '녹색': 3, '갈색': 4, '밤색': 4, '브라운': 4,
  '에메랄드': 5, '에메랄드색': 5, '보라색': 6, '보라': 6, '자수정': 7, '자수정색': 7,
}
// 헤어 이름의 색 접두어("빨간색 리르하 헤어" → "리르하 헤어") 제거.
const stripColorPrefix = (name: string, color: string | null) => (color && name.startsWith(color) ? name.slice(color.length).trim() : name)

// 넥슨 이름 → 내부 리스트에서 매칭(성별 접미사 있는 경우 캐릭터 성별 우선).
export const matchByName = (list: ListItem[], name: string, gender: string | null): ListItem | null => {
  const target = nrmName(name)
  const ms = list.filter((it) => nrmName(it.name || '') === target)
  if (ms.length <= 1) return ms[0] || null
  const suffix = gender === '남' ? '(남)' : gender === '여' ? '(여)' : null
  if (suffix) { const g = ms.find((it) => (it.name || '').includes(suffix)); if (g) return g }
  return ms[0]
}
// 넥슨 헤어/성형 색상 → 내부 믹스 팔레트(baseColor/mixColor 인덱스 + 비율).
const colorPalette = (b: NexonBeauty, isFace = false): PaletteParams => {
  const idx = isFace ? FACE_COLOR_IDX : COLOR_IDX  // 성형은 눈 색 순서(FACE_PALETTE)로 매핑
  const base = idx[b.baseColor ?? ''] ?? 0
  const mix = b.mixColor ? (idx[b.mixColor] ?? null) : null
  return { baseColor: base, mixColor: mix, ratio: mix != null ? (parseInt(b.mixRate, 10) || 50) : 0 }
}
// 넥슨 색상계열 문자열 → 내부 DYE_FAMILIES 인덱스. 캐시(color_range="파란 색상 계열")와 피부(color_style="파란색 계열")
// 표기가 조금 달라 정확 매칭(indexOf)이 실패한다 → 색 키워드로 견고하게 매핑. (0 전체 · 1 빨강 · 2 노랑 · 3 초록 · 4 청록 · 5 파랑 · 6 자주)
const familyIdx = (name?: string | null): number => {
  const t = name || ''
  if (t.includes('빨')) return 1
  if (t.includes('노')) return 2
  if (t.includes('청')) return 4 // '청록'은 '초'를 포함하지 않으므로 먼저 검사
  if (t.includes('초') || t.includes('녹')) return 3
  if (t.includes('파')) return 5
  if (t.includes('자') || t.includes('보')) return 6
  return 0
}
// 넥슨 컬러 프리즘 → 내부 HSB. color_range/color_style 는 색상계열(t), 나머지는 그대로 대응된다.
// clampDye 와 같은 범위로 자른다(h 0~359, s/b -99~99) — 넥슨 값이 범위를 벗어나도 렌더가 깨지지 않게.
const prismToHsb = (p: NexonPrism): HsbParams => ({
  h: clampDye('h', p.hue), s: clampDye('s', p.saturation), b: clampDye('b', p.value),
  t: familyIdx(p.colorRange),
  ...(p.blackInclusive ? { edge: true } : {}),
})

// 변환이 기대는 바깥 값. 브라우저(ShopContext)와 수집 배치가 각자 채운다.
export interface LookDeps {
  list: (slot: string) => Promise<ListItem[]>      // 그 부위의 접은 목록(foldList — 대표만)
  tones: { tone: number; name?: string }[]         // 색인의 피부 톤(index.base.tones)
  // 헤어 · 성형: 같은 이름의 묶음이 여럿일 때 그림으로 고른다(브라우저만 — lib/lookMatch). 못 가리면 null
  pickBeauty?: (cands: ListItem[], pal: PaletteParams) => Promise<ListItem[] | null>
  missed?: (slot: string, name: string) => void    // 못 찾은 아이템(수집 배치가 매칭률을 잰다)
}
// 헤어 · 성형: 넥슨 이름에는 (남)/(여) 가 없고, 같은 이름의 묶음이 여럿이며 그림도 다를 수 있다(차차 얼굴).
// 후보가 여럿이면 그림으로 고르고(pickBeauty), 가려지지 않으면 이름 규칙(matchByName)으로 돌아간다.
const matchBeauty = async (deps: LookDeps, list: ListItem[], name: string, gender: string | null, pal: PaletteParams): Promise<ListItem | null> => {
  const target = nrmName(name)
  const ms = list.filter((it) => nrmName(it.name || '') === target)
  if (ms.length > 1 && deps.pickBeauty) { const g = await deps.pickBeauty(ms, pal); if (g) return matchByName(g, name, gender) } // 같은 그림끼리는 이름 규칙으로
  return matchByName(list, name, gender)
}
// 넥슨 코디 1벌(= 코디 × 프리셋) → 내부 스냅샷(착용 + 톤 + 염색). 매칭이 0건이면 null(=보여줄 게 없는 코디).
// 헤어/성형/피부는 프리셋과 무관하게 코디(look) 단위로 하나다 → 프리셋만 items 로 갈아끼운다.
export async function lookToSnapshot(look: NexonLook, items: NexonItem[], gender: string | null, deps: LookDeps): Promise<Snapshot | null> {
  const equipped: Record<string, string> = {}
  const dyePalette: Record<string, PaletteParams> = {}
  const dyeHsb: Record<string, HsbParams> = {}
  const dotPos: Record<string, DotOffsets> = {}
  let tone = DEFAULT_TONE
  let matched = 0
  // 헤어(색 접두어 제거 + 염색색상)
  if (look.hair?.name) {
    const pal = colorPalette(look.hair)
    const found = await matchBeauty(deps, await deps.list('hair'), stripColorPrefix(look.hair.name, look.hair.baseColor), gender, pal)
    if (found) { equipped.hair = found.id; dyePalette.hair = pal; matched++ } else deps.missed?.('hair', look.hair.name)
  }
  if (!equipped.hair && DEFAULT_EQUIP.hair) equipped.hair = DEFAULT_EQUIP.hair.id
  // 성형(염색색상)
  if (look.face?.name) {
    const pal = colorPalette(look.face, true)
    const found = await matchBeauty(deps, await deps.list('face'), stripColorPrefix(look.face.name, look.face.baseColor), gender, pal)
    if (found) { equipped.face = found.id; dyePalette.face = pal; matched++ } else deps.missed?.('face', look.face.name)
  }
  if (!equipped.face && DEFAULT_EQUIP.face) equipped.face = DEFAULT_EQUIP.face.id
  // 피부(톤 이름 매칭)
  if (look.skin?.name) {
    const te = deps.tones.find((t) => nrmName(t.name || '') === nrmName(look.skin!.name))
    if (te) {
      tone = te.tone; matched++
      // 컬러라인(커스텀) 피부는 HSB 염색까지 반영 — 안 하면 기본 컬러라인 색으로 들어와 "피부 색이 안 들어온다".
      if (look.skin.prism && isDyeableSkin(te.name)) dyeHsb.skin = prismToHsb(look.skin.prism)
    } else deps.missed?.('skin', look.skin.name)
  }
  // 캐시 아이템(옷 · 모자 · 무기 등) + 그 아이템에 걸린 컬러 프리즘 염색
  for (const it of items) {
    let slot = NEXON_PART_SLOT[it.part]
    if (!slot) continue
    let found: ListItem | null = null
    if (slot === 'ring') {
      for (const rs of NEXON_RING_SLOTS) { if (equipped[rs]) continue; found = matchByName(await deps.list(rs), it.name, it.gender ?? gender); if (found) { slot = rs; break } }
    } else found = matchByName(await deps.list(slot), it.name, it.gender ?? gender)
    if (!found) { deps.missed?.(slot, it.name); continue }
    equipped[slot] = found.id; matched++
    if (it.prism) dyeHsb[slot] = prismToHsb(it.prism)
    // 점 위치(사소한 변경점/쩜): 넥슨 custom_origin(no/x/y) → 우리 오프셋. 그림 규칙 topLeft = brow − origin 이라
    // custom_origin(=게임이 쓰는 origin)으로 그리려면 오프셋 = WZ기본origin − custom_origin. no 1→첫째 점(accessoryEye).
    if (DOT_MOVER_IDS.has(found.id) && it.customOrigin && it.customOrigin.length) {
      const m = await loadMeta(found.id).catch(() => null)
      if (m) {
        const dl = getFrameLayers(m, THUMB_VIEW).filter((l) => /^accessoryEye\d*$/.test(l.name)).sort((a, b) => a.name.localeCompare(b.name))
        const off: DotOffsets = {}
        for (const co of it.customOrigin) {
          const layer = dl[(co.no || 1) - 1]
          if (layer) off[layer.name] = { x: layer.origin.x - co.x, y: layer.origin.y - co.y }
        }
        if (Object.keys(off).length) dotPos[found.id] = off
      }
    }
  }
  if (!matched) return null
  return { equipped, tone, dyePalette, dyeHsb, hidden: {}, dotPos }
}
