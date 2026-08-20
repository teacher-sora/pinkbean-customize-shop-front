import { NextResponse, type NextRequest } from 'next/server'

// 넥슨 Open API 프록시(서버 전용). 키(NEXON_API_KEY)를 클라이언트에 노출하지 않고 CORS 도 우회한다.
//  1) /maplestory/v1/id?character_name → ocid
//  2) /maplestory/v1/character/cashitem-equipment?ocid → 착용 캐시 아이템
//  3) /maplestory/v1/character/beauty-equipment?ocid    → 헤어/성형/피부
//
// ⚠️ 제로·엔젤릭버스터는 코디가 **두 벌**이다(제로=알파/베타, 엔버=일반/드레스업).
//    넥슨은 이걸 `additional_*` 접두 필드로 따로 준다(실측 확인):
//      cash_item_equipment_base|_preset_N      ↔ additional_cash_item_equipment_base|_preset_N
//      character_hair|face|skin                ↔ additional_character_hair|face|skin
//    그래서 응답을 looks[] 배열로 준다. 일반 직업은 looks 가 1개, 제로/엔버는 2개.
//    **직업명으로 분기하지 않는다** — additional 에 실제 내용이 있을 때만 2번째를 넣는다(더 견고).
const BASE = 'https://open.api.nexon.com/maplestory/v1'

// 캐시 아이템 염색(컬러 프리즘). 넥슨이 색상계열/색조/채도/명도를 그대로 준다 → 내부 HsbParams 와 1:1 대응.
// (염색 안 한 아이템은 null 이다 — 필드 자체가 없는 게 아니다.)
interface NexonPrism { color_range?: string | null; hue?: number | null; saturation?: number | null; value?: number | null }
interface NexonCashItem {
  cash_item_equipment_part: string
  cash_item_equipment_slot: string
  cash_item_name: string
  item_gender: string | null
  cash_item_coloring_prism?: NexonPrism | null
}
interface NexonBeautyPart { hair_name?: string; face_name?: string; base_color?: string | null; mix_color?: string | null; mix_rate?: string | null }

type Cash = Record<string, unknown>

// 메이플 치장 프리셋 구조(실측):
//   base       = 베이스 코디 전체(예: 11개)
//   preset_1~3 = "덮어쓸 부위만" 담긴 부분 집합(0~4개) — 나머지 부위는 base 로 채워진다
//   preset_no  = 지금 적용 중인 프리셋 번호. None 이면 "해제" = base 를 그대로 입고 있는 상태다.
// 그래서 프리셋 한 벌 = base + preset_n 덮어쓰기. n=0 이면 base 그대로(기본).
function mergeItems(data: Cash, prefix: string, presetNo: number) {
  const bySlot: Record<string, NexonCashItem> = {}
  for (const it of ((data[`${prefix}base`] as NexonCashItem[]) || [])) bySlot[it.cash_item_equipment_slot] = it
  if (presetNo) for (const it of ((data[`${prefix}preset_${presetNo}`] as NexonCashItem[]) || [])) bySlot[it.cash_item_equipment_slot] = it
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
      // 염색 안 했으면 prism=null → 그대로 null 로 넘겨 프론트가 무시하게 한다.
      prism: p && (p.hue != null || p.saturation != null || p.value != null)
        ? { colorRange: p.color_range ?? null, hue: p.hue ?? 0, saturation: p.saturation ?? 0, value: p.value ?? 0 }
        : null,
    }
  })
}

// 일반(비캐시) 장비 = 넥슨 item-equipment. 코디는 캐시뿐 아니라 일반 아이템도 취급하므로(예: 일반 한벌옷
// '클래식 백금슈트'), 아바타에 보이는 일반 장비도 함께 넘겨 캐시 아이템의 "베이스 레이어"로 쓴다.
interface NexonRegItem { item_equipment_part?: string; item_equipment_slot?: string; item_name?: string }
type LookItem = ReturnType<typeof mergeItems>[number]
function regularVisible(idata: Cash | null): LookItem[] {
  const arr = (idata?.item_equipment as NexonRegItem[]) || []
  const out: LookItem[] = []
  for (const it of arr) {
    const part = it.item_equipment_slot || it.item_equipment_part
    if (!part || !it.item_name) continue // 파트명(한벌옷/상의/무기 등)은 프론트 NEXON_PART_SLOT 이 화이트리스트로 걸러낸다
    out.push({ part, slot: part, name: it.item_name, gender: null, prism: null })
  }
  return out
}
// 일반(베이스) + 캐시(치장) 병합: 같은 부위는 캐시가 덮는다. 한벌옷↔상의/하의는 배타(치장 레이어 우선).
function mergeLayers(reg: LookItem[], cash: LookItem[]): LookItem[] {
  const byPart: Record<string, LookItem & { _l?: 'reg' | 'cash' }> = {}
  for (const it of reg) byPart[it.part] = { ...it, _l: 'reg' }
  for (const it of cash) byPart[it.part] = { ...it, _l: 'cash' } // 캐시가 일반을 덮어씀
  const ov = byPart['한벌옷'], top = byPart['상의'], bot = byPart['하의']
  if (ov && (top || bot)) {
    const ovCash = ov._l === 'cash', tbCash = top?._l === 'cash' || bot?._l === 'cash'
    if (ovCash && !tbCash) { delete byPart['상의']; delete byPart['하의'] }        // 캐시 한벌옷 → 일반 상하의 숨김
    else if (!ovCash && tbCash) { delete byPart['한벌옷'] }                          // 캐시 상/하의 → 일반 한벌옷 숨김
    else { delete byPart['상의']; delete byPart['하의'] }                            // 동일 레이어 → 한벌옷 우선
  }
  return Object.values(byPart).map(({ _l, ...r }) => r as LookItem)
}

const col = (o: NexonBeautyPart | null | undefined, nameKey: 'hair_name' | 'face_name') =>
  o && o[nameKey] ? { name: o[nameKey], baseColor: o.base_color ?? null, mixColor: o.mix_color ?? null, mixRate: o.mix_rate ?? '0' } : null

// 제로/엔버는 두 벌의 이름이 다르다. 라벨을 서버에서 정해 프론트는 그리기만 한다.
function labelsFor(charClass: string | null): [string, string] {
  if (charClass === '제로') return ['알파', '베타']
  if (charClass === '엔젤릭버스터') return ['일반', '드레스업']
  return ['일반', '다른 모드']
}

// ⚠️ 제로는 character_gender 가 '기타'로 온다(실측). 그런데 헤어·성형은 이름이 같아도 (남)/(여) 변형이
//    따로 있어서, 성별을 모르면 엉뚱한 변형이 잡힌다 — 제로는 알파/베타가 **헤어·성형만** 다르므로 치명적이다.
//    알파=남, 베타=여. (근거: 베타가 쓰는 '매직 엘라 헤어'가 카탈로그에 (여) 로만 존재한다.)
function genderForLook(charClass: string | null, kkey: 'normal' | 'additional', charGender: string | null) {
  if (charClass === '제로') return kkey === 'normal' ? '남' : '여'
  return charGender
}

export async function GET(req: NextRequest) {
  const name = req.nextUrl.searchParams.get('name')?.trim()
  if (!name) return NextResponse.json({ error: '닉네임을 입력해 주세요' }, { status: 400 })
  const key = process.env.NEXON_API_KEY
  if (!key) return NextResponse.json({ error: 'API 키가 설정되지 않았어요 (NEXON_API_KEY)' }, { status: 500 })
  const headers = { 'x-nxopen-api-key': key }
  try {
    const idr = await fetch(`${BASE}/id?character_name=${encodeURIComponent(name)}`, { headers, cache: 'no-store' })
    if (!idr.ok) return NextResponse.json({ error: '캐릭터를 찾지 못했어요' }, { status: 404 })
    const ocid = (await idr.json())?.ocid
    if (!ocid) return NextResponse.json({ error: '캐릭터를 찾지 못했어요' }, { status: 404 })
    // 캐시 아이템(치장) + 일반 장비(비캐시, 예: 일반 한벌옷) + 뷰티(헤어·성형·피부)를 병렬 조회.
    const [cr, br, ir] = await Promise.all([
      fetch(`${BASE}/character/cashitem-equipment?ocid=${encodeURIComponent(ocid)}`, { headers, cache: 'no-store' }),
      fetch(`${BASE}/character/beauty-equipment?ocid=${encodeURIComponent(ocid)}`, { headers, cache: 'no-store' }),
      fetch(`${BASE}/character/item-equipment?ocid=${encodeURIComponent(ocid)}`, { headers, cache: 'no-store' }),
    ])
    if (!cr.ok) return NextResponse.json({ error: '코디 정보를 불러오지 못했어요' }, { status: 502 })
    const data: Cash = await cr.json()
    const beauty: Record<string, NexonBeautyPart & { skin_name?: string }> | null = br.ok ? await br.json().catch(() => null) : null
    const itemData: Cash | null = ir.ok ? await ir.json().catch(() => null) : null // 실패해도 비치명적(일반 장비만 빠짐)
    const reg = regularVisible(itemData) // 아바타에 보이는 일반 장비(캐시의 베이스 레이어)
    const charClass = (data.character_class as string) ?? null
    const charGender = (data.character_gender as string) ?? null
    const [labelA, labelB] = labelsFor(charClass)

    const activeNo = Number(data.preset_no) || 0 // None/0 = 해제(= base 착용 중)
    // includeReg=true 면 일반 장비를 베이스 레이어로 병합한다. (additional 코디 노출 여부는 캐시만으로 판정하므로
    //  일반 코디 캐릭터에 2번째 코디가 헛노출되지 않게, additional 은 캐시만으로 먼저 판정 후 include 한다.)
    const buildLook = (kkey: 'normal' | 'additional', label: string, includeReg: boolean) => {
      const p = kkey === 'normal' ? 'cash_item_equipment_' : 'additional_cash_item_equipment_'
      const b = kkey === 'normal' ? '' : 'additional_'
      const skinName = beauty?.[`${b}character_skin`]?.skin_name
      const items = (n: number) => (includeReg ? mergeLayers(reg, mergeItems(data, p, n)) : mergeItems(data, p, n))
      // 기본은 항상 준다 — preset_no 가 None 인 캐릭터는 이게 곧 "지금 입고 있는 모습"이다.
      const presets = [{ key: 'base', label: '기본', items: items(0), active: activeNo === 0 }]
      for (const n of [1, 2, 3]) {
        // 빈 프리셋(0개)은 base 와 완전히 같아진다 → 카드로 내보내지 않는다(똑같은 걸 고르게 할 이유가 없다).
        // 판정은 '캐시 프리셋'만으로 한다(일반 장비는 프리셋 무관 공통이므로 기준에서 제외).
        if (!((data[`${p}preset_${n}`] as NexonCashItem[]) || []).length) continue
        presets.push({ key: String(n), label: `프리셋 ${n}`, items: items(n), active: activeNo === n })
      }
      return {
        key: kkey, label,
        gender: genderForLook(charClass, kkey, charGender), // 코디별 성별(제로는 알파/베타가 다르다)
        presets,
        hair: col(beauty?.[`${b}character_hair`], 'hair_name'),
        face: col(beauty?.[`${b}character_face`], 'face_name'),
        skin: skinName ? { name: skinName } : null,
      }
    }
    const looks = [buildLook('normal', labelA, true)]
    // 2번째 코디(제로/엔버) 노출 여부는 **캐시 콘텐츠만으로** 판정(일반 장비를 넣으면 항상 non-empty가 되어
    // 일반 직업에도 헛노출됨). 실제 2번째 코디일 때만 일반 장비를 베이스로 병합해 추가한다.
    const extraCash = buildLook('additional', labelB, false)
    if (extraCash.presets.some((x) => x.items.length) || extraCash.hair || extraCash.face || extraCash.skin) {
      looks.push(buildLook('additional', labelB, true))
    }

    return NextResponse.json({
      gender: (data.character_gender as string) ?? null,
      charClass,
      lookMode: (data.character_look_mode as string) ?? null,
      looks,
    })
  } catch {
    return NextResponse.json({ error: '불러오기에 실패했어요' }, { status: 500 })
  }
}
