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

interface NexonCashItem {
  cash_item_equipment_part: string
  cash_item_equipment_slot: string
  cash_item_name: string
  item_gender: string | null
}
interface NexonBeautyPart { hair_name?: string; face_name?: string; base_color?: string | null; mix_color?: string | null; mix_rate?: string | null }

type Cash = Record<string, unknown>

// base 착용 + 활성 프리셋(preset_no)을 슬롯별로 병합(프리셋이 base 를 덮어씀).
function mergeItems(data: Cash, prefix: string) {
  const bySlot: Record<string, NexonCashItem> = {}
  for (const it of ((data[`${prefix}base`] as NexonCashItem[]) || [])) bySlot[it.cash_item_equipment_slot] = it
  const pno = data.preset_no
  if (pno) for (const it of ((data[`${prefix}preset_${pno}`] as NexonCashItem[]) || [])) bySlot[it.cash_item_equipment_slot] = it
  return Object.values(bySlot).map((it) => ({
    part: it.cash_item_equipment_part, slot: it.cash_item_equipment_slot,
    name: it.cash_item_name, gender: it.item_gender,
  }))
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
    // 캐시 아이템(옷·모자 등) + 뷰티(헤어·성형·피부)를 병렬 조회.
    const [cr, br] = await Promise.all([
      fetch(`${BASE}/character/cashitem-equipment?ocid=${encodeURIComponent(ocid)}`, { headers, cache: 'no-store' }),
      fetch(`${BASE}/character/beauty-equipment?ocid=${encodeURIComponent(ocid)}`, { headers, cache: 'no-store' }),
    ])
    if (!cr.ok) return NextResponse.json({ error: '코디 정보를 불러오지 못했어요' }, { status: 502 })
    const data: Cash = await cr.json()
    const beauty: Record<string, NexonBeautyPart & { skin_name?: string }> | null = br.ok ? await br.json().catch(() => null) : null
    const charClass = (data.character_class as string) ?? null
    const charGender = (data.character_gender as string) ?? null
    const [labelA, labelB] = labelsFor(charClass)

    const buildLook = (kkey: 'normal' | 'additional', label: string) => {
      const p = kkey === 'normal' ? 'cash_item_equipment_' : 'additional_cash_item_equipment_'
      const b = kkey === 'normal' ? '' : 'additional_'
      const skinName = beauty?.[`${b}character_skin`]?.skin_name
      return {
        key: kkey, label,
        gender: genderForLook(charClass, kkey, charGender), // 코디별 성별(제로는 알파/베타가 다르다)
        items: mergeItems(data, p),
        hair: col(beauty?.[`${b}character_hair`], 'hair_name'),
        face: col(beauty?.[`${b}character_face`], 'face_name'),
        skin: skinName ? { name: skinName } : null,
      }
    }
    const looks = [buildLook('normal', labelA)]
    const extra = buildLook('additional', labelB)
    // 내용이 있을 때만 2번째 코디를 노출(일반 직업은 additional 자체가 없다).
    if (extra.items.length || extra.hair || extra.face || extra.skin) looks.push(extra)

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
