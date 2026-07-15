import { NextResponse, type NextRequest } from 'next/server'

// 넥슨 Open API 프록시(서버 전용). 키(NEXON_API_KEY)를 클라이언트에 노출하지 않고 CORS 도 우회한다.
//  1) /maplestory/v1/id?character_name → ocid
//  2) /maplestory/v1/character/cashitem-equipment?ocid → 착용 캐시 아이템
// 응답: { gender, items:[{ part, slot, name, gender }] } (base + 활성 프리셋 병합, 슬롯별 최신값).
const BASE = 'https://open.api.nexon.com/maplestory/v1'

interface NexonCashItem {
  cash_item_equipment_part: string
  cash_item_equipment_slot: string
  cash_item_name: string
  item_gender: string | null
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
    const data = await cr.json()
    // base 착용 + 활성 프리셋(preset_no)을 슬롯별로 병합(프리셋이 base 를 덮어씀).
    const bySlot: Record<string, NexonCashItem> = {}
    for (const it of (data.cash_item_equipment_base || []) as NexonCashItem[]) bySlot[it.cash_item_equipment_slot] = it
    const pno = data.preset_no
    if (pno) for (const it of (data[`cash_item_equipment_preset_${pno}`] || []) as NexonCashItem[]) bySlot[it.cash_item_equipment_slot] = it
    const items = Object.values(bySlot).map((it) => ({ part: it.cash_item_equipment_part, slot: it.cash_item_equipment_slot, name: it.cash_item_name, gender: it.item_gender }))
    // 뷰티(헤어/성형/피부) — 헤어/성형은 base_color/mix_color(염색), 피부는 톤 이름.
    const beauty = br.ok ? await br.json().catch(() => null) : null
    const col = (o: { hair_name?: string; face_name?: string; base_color?: string | null; mix_color?: string | null; mix_rate?: string | null } | null | undefined, nameKey: 'hair_name' | 'face_name') =>
      o && o[nameKey] ? { name: o[nameKey], baseColor: o.base_color ?? null, mixColor: o.mix_color ?? null, mixRate: o.mix_rate ?? '0' } : null
    return NextResponse.json({
      gender: data.character_gender ?? null,
      items,
      hair: col(beauty?.character_hair, 'hair_name'),
      face: col(beauty?.character_face, 'face_name'),
      skin: beauty?.character_skin?.skin_name ? { name: beauty.character_skin.skin_name } : null,
    })
  } catch {
    return NextResponse.json({ error: '불러오기에 실패했어요' }, { status: 500 })
  }
}
