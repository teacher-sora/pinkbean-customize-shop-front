import { NextResponse, type NextRequest } from 'next/server'

// 넥슨 Open API 프록시(서버 전용). 키(NEXON_API_KEY)를 클라이언트에 노출하지 않고 CORS 도 우회한다.
//  1) /maplestory/v1/id?character_name → ocid
//  2) /maplestory/v1/character/cashitem-equipment?ocid → 착용 캐시 아이템
//  3) /maplestory/v1/character/beauty-equipment?ocid    → 헤어/성형/피부
//  4) /maplestory/v1/character/item-equipment?ocid      → 일반 장비(캐시의 베이스 레이어) · 훈장 외형(medal_shape) · 칭호(title)
//
// ⚠️ 제로·엔젤릭버스터는 코디가 **두 벌**이다(제로=알파/베타, 엔버=일반/드레스업).
//    넥슨은 이걸 `additional_*` 접두 필드로 따로 준다(실측 확인):
//      cash_item_equipment_base|_preset_N      ↔ additional_cash_item_equipment_base|_preset_N
//      character_hair|face|skin                ↔ additional_character_hair|face|skin
//    그래서 응답을 looks[] 배열로 준다. 일반 직업은 looks 가 1개, 제로/엔버는 2개.
//    **직업명으로 분기하지 않는다** — additional 에 실제 내용이 있을 때만 2번째를 넣는다(더 견고).
const BASE = 'https://open.api.nexon.com/maplestory/v1'

// ocid(닉네임→고유 id)는 안 변한다 → 메모리에 캐시해 날짜별 조회에서 매번 /id 재요청(넥슨 콜 1회)을 없앤다.
const ocidCache = new Map<string, { ocid: string; t: number }>()
const OCID_TTL = 60 * 60 * 1000

const RATE = { error: '요청이 많아요. 잠시 후 다시 시도해 주세요' } // 429는 "캐릭터 못 찾음"이 아니다 — 구분해서 알린다

// ── 레이트리밋 서킷브레이커 ──
// 넥슨은 분당 1000회 제한이고, 초과하면 remaining 이 음수로 내려가며 **때릴수록 페널티가 커져 회복이 안 된다.**
// 그래서 429 를 받으면 그 뒤 일정 시간 동안 넥슨 호출을 "아예 하지 않고" 즉시 429 로 돌려보낸다 → 넥슨이 쉬면서 회복.
// 429 를 재시도하지 않는다 — 재시도는 홍수를 키우고 락을 연장시킨다.
let cooldownUntil = 0

// 넥슨 요청 제한(공식): 개발 키 = 5건/초·1000건/일, 서비스 키 = 500건/초·2천만건/일.
// 개발 키로 로컬 테스트하면 5/초를 넘겨 429가 난다 → .env.local 에 NEXON_MIN_GAP_MS(예: 220)를 주면
// 넥슨 호출을 그 간격으로 직렬화해 5/초 밑으로 유지한다(서비스 키/프로덕션은 미설정 → 지연 0, 전속력).
const MIN_GAP = Number(process.env.NEXON_MIN_GAP_MS) || 0
let nextSlot = 0
async function gate() {
  if (MIN_GAP <= 0) return
  const now = Date.now()
  const at = Math.max(now, nextSlot)
  nextSlot = at + MIN_GAP
  if (at > now) await new Promise((r) => setTimeout(r, at - now))
}

// 5xx(일시적 게이트웨이 오류)만 잠깐 재시도. 429 는 재시도하지 않고 쿨다운을 건다(음수 remaining/Retry-After 만큼 더 길게).
async function fetchNexon(url: string, init: RequestInit): Promise<Response> {
  for (let i = 0; i < 3; i++) {
    await gate()
    const r = await fetch(url, init)
    if (r.ok) return r
    if (r.status === 429) {
      const rem = Number(r.headers.get('x-ratelimit-remaining'))
      const ra = Number(r.headers.get('retry-after'))
      const base = ra > 0 ? Math.min(ra * 1000, 60000) : 12000
      const penalty = Number.isFinite(rem) && rem < 0 ? Math.min(-rem, 90) * 1000 : 0
      cooldownUntil = Date.now() + base + penalty
      return r
    }
    if (r.status < 500) return r
    if (i < 2) await new Promise((res) => setTimeout(res, 250 * (i + 1)))
    else return r
  }
  return fetch(url, init)
}

// 캐시 아이템 염색(컬러 프리즘). 넥슨이 색상계열/색조/채도/명도를 그대로 준다 → 내부 HsbParams 와 1:1 대응.
// (염색 안 한 아이템은 null 이다 — 필드 자체가 없는 게 아니다.)
interface NexonPrism { color_range?: string | null; hue?: number | null; saturation?: number | null; value?: number | null; black_inclusive_flag?: string | null }
// custom_origin = 프리스타일(사소한 변경점/쩜) 아이템의 점 위치. custom_origin_no 1→첫째 점, 2→둘째 점.
// x/y 는 문자열이며 게임 내부 origin 좌표(= WZ origin 과 같은 프레임). 프론트에서 오프셋으로 변환한다.
interface NexonCustomOrigin { custom_origin_no: number; x: string; y: string }
interface NexonCashItem {
  cash_item_equipment_part: string
  cash_item_equipment_slot: string
  cash_item_name: string
  item_gender: string | null
  cash_item_coloring_prism?: NexonPrism | null
  custom_origin?: NexonCustomOrigin[] | null
}
interface NexonBeautyPart { hair_name?: string; face_name?: string; base_color?: string | null; mix_color?: string | null; mix_rate?: string | null }
// 피부: 컬러라인(커스텀) 피부는 color_style(색상계열)/hue/saturation/brightness 로 염색된다(캐시 프리즘과 동일 개념).
interface NexonSkinPart { skin_name?: string; color_style?: string | null; hue?: number | null; saturation?: number | null; brightness?: number | null }

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
interface NexonRegItem { item_equipment_part?: string; item_equipment_slot?: string; item_name?: string; item_shape_name?: string | null }
type LookItem = ReturnType<typeof mergeItems>[number]
// 일반 장비는 두 이름이 서로 다른 뜻이다.
//   item_equipment_part = 아이템 분류(한벌옷 · 차크람 · 헥스시커)
//   item_equipment_slot = 착용 칸(상의 · 무기 · 보조무기)
// 칼리의 옷은 part=한벌옷 · slot=상의 로 온다. slot 을 먼저 보면 한벌옷을 '상의'에서 찾게 돼 매칭이 실패하고
// (우리 카탈로그에서 칼리의 옷은 한벌옷), 한벌옷↔상하의 배타 처리(mergeLayers)도 어긋난다.
// 그래서 **옷 계열은 분류(part)를, 그 밖은 착용 칸(slot)을** 쓴다 — 무기는 분류가 '차크람'처럼 제각각이라 칸이 맞다.
const WEAR_PARTS = new Set(['한벌옷', '상의', '하의', '모자', '얼굴장식', '눈장식', '귀고리', '망토', '장갑', '신발'])
function regularVisible(idata: Cash | null): LookItem[] {
  const arr = (idata?.item_equipment as NexonRegItem[]) || []
  const out: LookItem[] = []
  for (const it of arr) {
    const p = it.item_equipment_part || '', s = it.item_equipment_slot || ''
    const ring = p === '반지' // 반지는 칸(반지1~4)이 넷이라 칸 이름을 slot 으로 남긴다(mergeLayers 가 칸마다 따로 둔다)
    const part = WEAR_PARTS.has(p) || ring ? p : (s || p)
    // 모루(외형 덮어쓰기)를 쓴 장비는 **보이는 게 `item_shape_name`** 이다(예:
    // '소라사키히나'의 모자가 에테르넬 나이트헬름으로 불러와졌지만 게임에선 브옐 데빌스 혼으로 보인다).
    // 실측(그 캐릭터 장비 25종): 모루를 안 쓴 장비는 shape 가 이름과 **같게** 오고, 모루를 쓴 모자만 달랐다.
    // 우리는 외형만 그리므로 shape 를 먼저 쓴다. 부위(part)는 모루가 같은 분류끼리만 되므로 그대로 둔다.
    const name = it.item_shape_name || it.item_name
    if (!part || !name) continue // 파트명(한벌옷/상의/무기 등)은 프론트 NEXON_PART_SLOT 이 화이트리스트로 걸러낸다
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
function mergeLayers(reg: LookItem[], cash: LookItem[]): LookItem[] {
  const byPart: Record<string, LookItem & { _l?: 'reg' | 'cash' }> = {}
  // 반지는 칸(반지1~4)마다 따로 — 부위로 묶으면 일루전 링 · 명찰 · 말풍선 반지 가운데 마지막 하나만 남았다
  const keyOf = (it: LookItem) => (it.part === '반지' ? it.slot : it.part)
  for (const it of reg) byPart[keyOf(it)] = { ...it, _l: 'reg' }
  for (const it of cash) byPart[keyOf(it)] = { ...it, _l: 'cash' } // 캐시가 일반을 덮어씀
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

// 넥슨 실패 응답 → 우리 응답. 점검(OPENAPI00010 게임 점검 / 00011 API 점검)은 400 으로 오는데, 이걸 일반 실패(502·404)로
// 뭉뚱그리면 "코디 정보를 불러오지 못했어요"만 떠 원인을 알 수 없다 → 503 + 점검 안내.
const MAINT = { error: '메이플 점검 중이라 불러올 수 없어요' }
async function nexonFail(r: Response, fallback: { error: string }, status: number) {
  const name = await r.clone().json().then((j) => j?.error?.name as string | undefined).catch(() => undefined)
  if (name === 'OPENAPI00010' || name === 'OPENAPI00011') return NextResponse.json(MAINT, { status: 503 })
  return NextResponse.json(fallback, { status })
}

export async function GET(req: NextRequest) {
  const name = req.nextUrl.searchParams.get('name')?.trim()
  if (!name) return NextResponse.json({ error: '닉네임을 입력해 주세요' }, { status: 400 })
  const key = process.env.NEXON_API_KEY
  if (!key) return NextResponse.json({ error: '지금은 불러올 수 없어요' }, { status: 500 })
  const headers = { 'x-nxopen-api-key': key }
  // 쿨다운 중이면 넥슨을 아예 부르지 않고 즉시 429 → 넥슨이 쉬면서 레이트리밋이 회복된다(락 연장 방지).
  if (Date.now() < cooldownUntil) {
    return NextResponse.json(RATE, { status: 429, headers: { 'Retry-After': String(Math.max(1, Math.ceil((cooldownUntil - Date.now()) / 1000))) } })
  }
  // 클라이언트가 요청을 취소(다이얼로그 닫힘 등)하면 넥슨 조회도 함께 끊는다.
  const init: RequestInit = { headers, cache: 'no-store', signal: req.signal }
  try {
    let ocid = ''
    const cached = ocidCache.get(name)
    if (cached && Date.now() - cached.t < OCID_TTL) ocid = cached.ocid
    else {
      const idr = await fetchNexon(`${BASE}/id?character_name=${encodeURIComponent(name)}`, init)
      if (idr.status === 429) return NextResponse.json(RATE, { status: 429 })
      if (!idr.ok) return nexonFail(idr, { error: '캐릭터를 찾지 못했어요' }, 404)
      ocid = (await idr.json())?.ocid || ''
      if (!ocid) return NextResponse.json({ error: '캐릭터를 찾지 못했어요' }, { status: 404 })
      ocidCache.set(name, { ocid, t: Date.now() })
    }
    // 캐시 아이템(치장)을 "먼저" 게이트로 조회 — 레이트리밋이면 이 1콜에서 바로 멈춘다(뒤 조회를 안 쏴 회복이 빨라짐).
    const cr = await fetchNexon(`${BASE}/character/cashitem-equipment?ocid=${encodeURIComponent(ocid)}`, init)
    if (cr.status === 429) return NextResponse.json(RATE, { status: 429 })
    if (!cr.ok) return nexonFail(cr, { error: '코디 정보를 불러오지 못했어요' }, 502)
    const data: Cash = await cr.json()
    // 통과했으면 뷰티와 일반 장비를 병렬로.
    // 기본 정보는 캐릭터 이미지 주소 하나 때문에 받는다 — 이름이 같은 헤어·성형을 그림으로 가려낸다(lib/lookMatch). 실패해도 된다.
    const [br, ir, bi] = await Promise.all([
      fetchNexon(`${BASE}/character/beauty-equipment?ocid=${encodeURIComponent(ocid)}`, init),
      fetchNexon(`${BASE}/character/item-equipment?ocid=${encodeURIComponent(ocid)}`, init),
      fetchNexon(`${BASE}/character/basic?ocid=${encodeURIComponent(ocid)}`, init),
    ])
    // ⚠️ 뷰티(헤어·성형·피부)는 "필수"다. 여기서 실패한 걸 무시하고 진행하면 헤어가 null → 기본(검은) 머리로 잘못
    //    렌더된다(예: 레이트리밋으로 뷰티만 429일 때 8/23 미리보기가 검은머리로 나오던 버그). 실패면 통째로 실패시킨다.
    if (br.status === 429) return NextResponse.json(RATE, { status: 429 })
    if (!br.ok) return nexonFail(br, { error: '코디 정보를 불러오지 못했어요' }, 502)
    const beauty: Record<string, NexonBeautyPart & NexonSkinPart> | null = await br.json().catch(() => null)
    const image: string | null = bi.ok ? ((await bi.json().catch(() => null))?.character_image as string) || null : null
    const itemData: Cash | null = ir.ok ? await ir.json().catch(() => null) : null // 일반 장비는 실패해도 치명적이지 않다
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
      const skinPart = beauty?.[`${b}character_skin`]
      const skinName = skinPart?.skin_name
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
        // 피부: 컬러라인 커스텀 피부는 HSB 염색까지 넘긴다(색상계열/색조/채도/명도). 염색 안 했으면 prism=null.
        skin: skinName ? {
          name: skinName,
          prism: skinPart && (skinPart.hue != null || skinPart.saturation != null || skinPart.brightness != null)
            ? { colorRange: skinPart.color_style ?? null, hue: skinPart.hue ?? 0, saturation: skinPart.saturation ?? 0, value: skinPart.brightness ?? 0 }
            : null,
        } : null,
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
      image,
      looks,
    }, {
      headers: { 'Cache-Control': 'no-store' }, // 항상 지금의 코디를 준다 — 캐시하지 않는다
    })
  } catch {
    return NextResponse.json({ error: '불러오기에 실패했어요' }, { status: 500 })
  }
}
