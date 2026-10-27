import { NextResponse, type NextRequest } from 'next/server'
import { buildLooks, type NexonBeautyRaw, type NexonRaw } from '@/lib/nexonLook'

// 넥슨 Open API 프록시(서버 전용). 키(NEXON_API_KEY)를 클라이언트에 노출하지 않고 CORS 도 우회한다.
//  1) /maplestory/v1/id?character_name → ocid
//  2) /maplestory/v1/character/cashitem-equipment?ocid → 착용 캐시 아이템
//  3) /maplestory/v1/character/beauty-equipment?ocid    → 헤어/성형/피부
//  4) /maplestory/v1/character/item-equipment?ocid      → 일반 장비(캐시의 베이스 레이어) · 훈장 외형(medal_shape) · 칭호(title)
// 응답을 코디 벌로 가공하는 규칙은 lib/nexonLook 의 buildLooks(코디 룩북 표본 수집과 같은 규칙 — 제로 · 엔버의 두 벌도 거기서).
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
    const data: NexonRaw = await cr.json()
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
    const beauty: NexonBeautyRaw | null = await br.json().catch(() => null)
    const image: string | null = bi.ok ? ((await bi.json().catch(() => null))?.character_image as string) || null : null
    const itemData: NexonRaw | null = ir.ok ? await ir.json().catch(() => null) : null // 일반 장비는 실패해도 치명적이지 않다
    return NextResponse.json({
      ...buildLooks(data, beauty, itemData),
      image,
    }, {
      headers: { 'Cache-Control': 'no-store' }, // 항상 지금의 코디를 준다 — 캐시하지 않는다
    })
  } catch {
    return NextResponse.json({ error: '불러오기에 실패했어요' }, { status: 500 })
  }
}
