// 캐릭터 룩북(날짜마다 바뀐 코디)의 판정: 넥슨 Open API 의 그날 응답 → 그림에 보이는 외형, 두 날 사이에 바뀐 부위.
// 순수 모듈이다 — React · 목록 · 네트워크에 기대지 않는다. 앱과 Node 스크립트(tsx)가 같이 쓴다(ARCHITECTURE 4-5 '룩북 판정').
//
// '바뀐 날' = 넥슨 캐릭터 그림(character_image)이 달라진 날이다. 그림 주소의 해시는 그림에 안 나오는 장비(펜던트 · 기계 심장 ·
// 기능 반지 · 캐시에 가려진 일반 장비)까지 담아 더 자주 바뀌므로 해시를 비교하지 않고, 그림에 나오는 필드만 모아 비교한다.
// 규칙마다 근거는 실측이다(캐릭터 '코디' 2023-12-21 ~ 2026-11-22 의 1,068일 — 그날 넥슨 그림의 픽셀 변화, 메애기 룩북과 대조).
//  · 캐시: 기본(base) → 월드 공유 마스터라벨(flag '1' 일 때) → 프리셋 n(preset_no) 순으로 칸을 덮는다. 마스터라벨이 프리셋
//    위에 있으면 2026-11-08 의 프리셋 모자 염색 변화가 가려졌다(그림은 바뀌었다).
//  · 그림에 나오는 것: 캐시 아이템 이름 · 염색(컬러 프리즘) · 점 위치(custom_origin) · 고정 표정(emotion_name), 헤어 · 성형의
//    이름 · 색 · 섞은 비율, 피부 이름 · 염색, 캐시에 가려지지 않은 일반 장비의 외형(item_shape_name).
//  · 그림에 안 나오는 것(바뀌어도 '바뀐 날'로 세지 않는다 — extra): 반지 칸 전부(명찰 · 말풍선 반지를 바꾼 날도 그림이 같았다),
//    이펙트 염색(2026-07-23 망토의 이펙트 염색만 지운 날 그림이 같았다), 칭호 · 훈장, 그림 주소의 무기 모션(wmotion — 혼자
//    바뀐 2025-10-23 그림이 같았다), 일반 장비의 펜던트 · 벨트 · 반지 · 엠블렘 · 뱃지 · 포켓 · 어깨장식 · 기계 심장.
//  · 제로 · 엔젤릭버스터: 그림은 character_look_mode 가 '1' 이면 additional_* 벌, 아니면 기본 벌이다(엔버 60일 실측 — 늘 기본 벌로
//    보면 그림이 같은 날 14일을 바뀌었다고 셌다). 안 보이는 벌의 변화는 extra 로만 낸다.
//  · 반투명 캐시(그 칸의 일반 장비를 비춰 보임)는 캐시로 치지 않는다 — 일반 장비가 보인다(lib/nexonLook 과 같다).
//  · 한벌옷 ↔ 상의 · 하의 가림은 lib/nexonLook mergeLayers 와 같다(캐시 한벌옷 → 일반 상하의 가림, 캐시 상의/하의 → 일반 한벌옷 가림).
// 넥슨 원본만으로는 알 수 없어 그림과 다를 수 있는 것: 헤어에 가려진 귀고리(2023-12-30 일반 귀고리만 바뀐 날 그림이 같았다),
// 자세 · 그리기 판이 달라 안 보이는 칸. 이런 날은 '바뀐 날'로 센다(원본이 실제로 바뀌었다).

type Raw = Record<string, unknown>
// 그날 넥슨 응답 셋(character/cashitem-equipment · beauty-equipment · item-equipment). 일반 장비는 없어도 된다
export type NexonDay = { cash: Raw | null; beauty: Raw | null; item?: Raw | null }

interface RawPrism { color_range?: string | null; hue?: number | null; saturation?: number | null; value?: number | null; black_inclusive_flag?: string | null }
interface RawCash {
  cash_item_equipment_part: string
  cash_item_equipment_slot: string
  cash_item_name: string
  cash_item_coloring_prism?: RawPrism | null
  cash_item_effect_prism?: RawPrism | null
  custom_origin?: { custom_origin_no: number; x: string; y: string }[] | null
  emotion_name?: string | null
}
interface RawReg { item_equipment_part?: string; item_equipment_slot?: string; item_name?: string; item_shape_name?: string | null }
interface RawBeauty { hair_name?: string; face_name?: string; base_color?: string | null; mix_color?: string | null; mix_rate?: string | null }
interface RawSkin { skin_name?: string; color_style?: string | null; hue?: number | null; saturation?: number | null; brightness?: number | null }

// 염색 값(캐시 컬러 프리즘 · 커스텀 피부). 넥슨 값 그대로 — 미세한 변화(색조 236 → 243)도 그대로 잡힌다
export type LookDye = { range: string | null; hue: number; saturation: number; value: number; black: boolean }
export type LookPart = {
  src: '캐시' | '일반' | '뷰티'
  name: string
  dye?: LookDye                                            // 캐시 염색 · 피부 염색
  color?: { base: string | null; mix: string | null; rate: string } // 헤어 · 성형의 색(섞은 색 · 비율)
  dots?: { no: number; x: number; y: number }[]            // 점 위치(custom_origin)
  emotion?: string                                         // 고정 표정 아이템의 표정
}
// 그날 그림에 보이는 외형. parts = 부위 → 보이는 것, extra = 그림에 안 나오는 값(부위 → 글)
export type DayLook = { mode: 'normal' | 'additional'; parts: Record<string, LookPart>; extra: Record<string, string> }
// 바뀐 부위 하나. what = 무엇이 바뀌었나(아이템 · 염색 · 색 · 점 위치 · 표정), counts = 그림이 바뀌는 변화인가
export type LookChange = { part: string; before: string | null; after: string | null; what: string[]; counts: boolean }
export type LookDiff = { changed: boolean; changes: LookChange[] }

// 그림에 나오는 일반 장비 칸(옷 계열은 분류 — 한벌옷은 slot '상의' 로 온다)
const VISIBLE_REG = new Set(['모자', '얼굴장식', '눈장식', '귀고리', '상의', '하의', '한벌옷', '망토', '장갑', '신발', '무기', '보조무기'])
// 반지 칸의 겉모습 반지(사이트가 다루는 부위 — 일루전 링 · 명찰 · 말풍선). 그림에는 안 나오고 extra 로만 낸다. 이름 규칙이다
const LOOK_RING = /명찰|말풍선|일루전/

const prismOf = (p: RawPrism | null | undefined): LookDye | undefined =>
  p && (p.hue != null || p.saturation != null || p.value != null)
    ? { range: p.color_range ?? null, hue: p.hue ?? 0, saturation: p.saturation ?? 0, value: p.value ?? 0, black: p.black_inclusive_flag === '1' }
    : undefined
const dyeText = (d: LookDye) => `${d.range ?? ''} ${d.hue}/${d.saturation}/${d.value}${d.black ? ' 검정 포함' : ''}`.trim()

// 지금 입은 캐시 칸: 기본 → 월드 공유 마스터라벨 → 프리셋 n
function activeCash(c: Raw, pre: string, shareLabel: boolean): Record<string, RawCash> {
  const by: Record<string, RawCash> = {}
  for (const it of (c[`${pre}base`] as RawCash[]) || []) by[it.cash_item_equipment_slot] = it
  if (shareLabel && c.world_share_master_label_activate_flag === '1') for (const it of (c.world_share_master_label_base as RawCash[]) || []) by[it.cash_item_equipment_slot] = it
  const n = Number(c.preset_no) || 0
  if (n) for (const it of (c[`${pre}preset_${n}`] as RawCash[]) || []) by[it.cash_item_equipment_slot] = it
  return by
}

// 한 벌(기본 또는 additional)의 보이는 부위와 그림에 안 나오는 값
function buildSet(day: NexonDay, add: boolean): { parts: Record<string, LookPart>; extra: Record<string, string> } {
  const c = day.cash as Raw
  const parts: Record<string, LookPart> = {}
  const extra: Record<string, string> = {}
  // 월드 공유 마스터라벨은 기본 벌에만 있다(additional 쪽 필드가 없다)
  for (const [slot, it] of Object.entries(activeCash(c, add ? 'additional_cash_item_equipment_' : 'cash_item_equipment_', !add))) {
    if (slot.startsWith('반지')) { if (LOOK_RING.test(it.cash_item_name)) extra[slot] = it.cash_item_name; continue }
    if (it.cash_item_name.includes('반투명')) continue
    const part = it.cash_item_equipment_part === '한벌옷' ? '한벌옷' : slot
    const p: LookPart = { src: '캐시', name: it.cash_item_name }
    const dye = prismOf(it.cash_item_coloring_prism); if (dye) p.dye = dye
    if (it.custom_origin?.length) p.dots = it.custom_origin.map((o) => ({ no: o.custom_origin_no, x: Number(o.x), y: Number(o.y) })).sort((a, b) => a.no - b.no)
    if (it.emotion_name) p.emotion = it.emotion_name
    parts[part] = p
    const fx = prismOf(it.cash_item_effect_prism); if (fx) extra[`${part} 이펙트 염색`] = dyeText(fx)
  }
  const cashOverall = parts['한벌옷']?.src === '캐시', cashTopBottom = parts['상의']?.src === '캐시' || parts['하의']?.src === '캐시'
  for (const it of ((day.item?.item_equipment as RawReg[]) || [])) {
    const part = it.item_equipment_part === '한벌옷' ? '한벌옷' : it.item_equipment_slot || ''
    const name = it.item_shape_name || it.item_name
    if (!VISIBLE_REG.has(part) || !name || parts[part]) continue
    if ((part === '상의' || part === '하의') && cashOverall) continue
    if (part === '한벌옷' && cashTopBottom) continue
    parts[part] = { src: '일반', name }
  }
  const b = (day.beauty || {}) as Record<string, RawBeauty & RawSkin>
  const bp = add ? 'additional_' : ''
  const hair = b[`${bp}character_hair`], face = b[`${bp}character_face`], skin = b[`${bp}character_skin`]
  // 헤어 이름은 기본 색이 앞에 붙어 온다('빨간색 안개 아린 헤어') — 떼어야 색만 바꾼 날이 '아이템'이 아니라 '색' 변화로 나온다
  const plain = (n: string, c: string | null | undefined) => (c && n.startsWith(c) ? n.slice(c.length).trim() : n)
  if (hair?.hair_name) parts['헤어'] = { src: '뷰티', name: plain(hair.hair_name, hair.base_color), color: { base: hair.base_color ?? null, mix: hair.mix_color ?? null, rate: hair.mix_rate ?? '0' } }
  if (face?.face_name) parts['성형'] = { src: '뷰티', name: plain(face.face_name, face.base_color), color: { base: face.base_color ?? null, mix: face.mix_color ?? null, rate: face.mix_rate ?? '0' } }
  if (skin?.skin_name) {
    const p: LookPart = { src: '뷰티', name: skin.skin_name }
    const dye = prismOf({ color_range: skin.color_style, hue: skin.hue, saturation: skin.saturation, value: skin.brightness }); if (dye) p.dye = dye
    parts['피부'] = p
  }
  return { parts, extra }
}

// 그날 응답 → 보이는 외형. 그날 캐릭터 정보가 없으면(생성 전 · 응답 실패) null — 룩북은 그날을 건너뛴다
export function dayLook(day: NexonDay): DayLook | null {
  if (!day.cash?.character_class || !day.beauty) return null
  const add = day.cash.character_look_mode === '1'
  const shown = buildSet(day, add)
  const extra = { ...shown.extra }
  // 두 벌 캐릭터의 안 보이는 벌 — 바뀌어도 그림은 같다
  const hasOther = Object.keys(day.cash).some((k) => k.startsWith('additional_cash_item_equipment_') && ((day.cash![k] as unknown[]) || []).length)
    || ['hair', 'face', 'skin'].some((k) => (day.beauty as Raw)[`additional_character_${k}`])
  if (hasOther || add) {
    const other = buildSet(day, !add)
    for (const [k, p] of Object.entries(other.parts)) extra[`안 보이는 벌 ${k}`] = partText(p)
    for (const [k, v] of Object.entries(other.extra)) extra[`안 보이는 벌 ${k}`] = v
  }
  const it = day.item as Raw | null | undefined
  const title = it?.title as { title_name?: string | null; title_shape_name?: string | null } | null | undefined
  const medal = it?.medal_shape as { medal_shape_name?: string | null; medal_shape_changed_name?: string | null } | null | undefined
  const t = title?.title_shape_name || title?.title_name; if (t) extra['칭호'] = t
  const m = medal?.medal_shape_changed_name || medal?.medal_shape_name; if (m) extra['훈장'] = m
  return { mode: add ? 'additional' : 'normal', parts: shown.parts, extra }
}

// 사람이 읽는 한 줄: '캐시 신발 이름 (염색 전체 색상 계열 12/-3/40)'
export function partText(p: LookPart): string {
  const tail: string[] = []
  if (p.color) tail.push(`색 ${p.color.base ?? ''}${p.color.mix ? ` + ${p.color.mix} ${p.color.rate}%` : ''}`)
  if (p.dye) tail.push(`염색 ${dyeText(p.dye)}`)
  if (p.dots) tail.push(`점 ${p.dots.map((d) => `${d.no}:${d.x},${d.y}`).join(' ')}`)
  if (p.emotion) tail.push(`표정 ${p.emotion}`)
  return `${p.src === '뷰티' ? '' : `${p.src} `}${p.name}${tail.length ? ` (${tail.join(', ')})` : ''}`
}

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null)
function whatChanged(a: LookPart | undefined, b: LookPart | undefined): string[] {
  if (!a || !b || a.name !== b.name || a.src !== b.src) return ['아이템']
  const w: string[] = []
  if (!same(a.color, b.color)) w.push('색')
  if (!same(a.dye, b.dye)) w.push('염색')
  if (!same(a.dots, b.dots)) w.push('점 위치')
  if (!same(a.emotion, b.emotion)) w.push('표정')
  return w
}

// 두 날의 외형 비교. changed = 그림이 바뀌었나(보이는 부위가 하나라도 다르다). extra 의 변화는 counts=false 로 함께 낸다
export function diffLooks(a: DayLook, b: DayLook): LookDiff {
  const changes: LookChange[] = []
  for (const k of [...new Set([...Object.keys(a.parts), ...Object.keys(b.parts)])]) {
    const x = a.parts[k], y = b.parts[k]
    const what = whatChanged(x, y)
    if (what.length) changes.push({ part: k, before: x ? partText(x) : null, after: y ? partText(y) : null, what, counts: true })
  }
  if (a.mode !== b.mode) changes.push({ part: '보이는 벌', before: a.mode, after: b.mode, what: ['모드'], counts: false })
  for (const k of [...new Set([...Object.keys(a.extra), ...Object.keys(b.extra)])]) {
    if (a.extra[k] !== b.extra[k]) changes.push({ part: k, before: a.extra[k] ?? null, after: b.extra[k] ?? null, what: [k.includes('염색') ? '염색' : '아이템'], counts: false })
  }
  return { changed: changes.some((c) => c.counts), changes }
}

// 날짜 열(오래된 날 → 최근) → 룩북: 첫 날(기준)과 그림이 바뀐 날만. 데이터 없는 날은 건너뛰고 앞의 있는 날과 비교한다
export type LookbookEntry = { date: string; look: DayLook; changes: LookChange[] }
export function lookbook(days: { date: string; raw: NexonDay }[]): LookbookEntry[] {
  const out: LookbookEntry[] = []
  let prev: DayLook | null = null
  for (const d of days) {
    const look = dayLook(d.raw)
    if (!look) continue
    if (!prev) out.push({ date: d.date, look, changes: [] })
    else { const r = diffLooks(prev, look); if (r.changed) out.push({ date: d.date, look, changes: r.changes }) }
    prev = look
  }
  return out
}
