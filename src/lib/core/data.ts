// Static data access. Everything is fetched from DATA_BASE so swapping between the
// local `public/data` mirror and the Cloudflare R2/CDN bucket is a one-line change.
// Default now points at the R2 CDN (bucket contents live at the bucket root, i.e.
// public/data/index.json → <cdn>/index.json). Set NEXT_PUBLIC_DATA_BASE=/data to
// fall back to the local mirror. Index is split per slot for virtualization.
export const DATA_BASE =
  process.env.NEXT_PUBLIC_DATA_BASE ?? 'https://cdn.pinkbean-customize.com'

// One-time confirmation (browser only) that assets are served from the CDN, not
// the local public/data mirror.
if (typeof window !== 'undefined') {
  const source = /^https?:\/\//.test(DATA_BASE) ? 'CDN' : 'local public/data'
  console.log(`[data] serving assets from ${source}: ${DATA_BASE}`)
}

export type Vec = { x: number; y: number }

export interface Layer {
  name: string
  png: string
  z: string
  origin: Vec
  map: Record<string, Vec>
}

// One animation frame: its display duration (ms) + the layers to draw.
export interface Frame { delay: number; layers: Layer[] }

export type DyeMode = 'palette' | 'hsb' | 'none'

export interface ItemMeta {
  id: string
  slot: string
  isCash?: boolean
  grade?: 'master' | 'special' | 'cash' | 'none'
  islot?: string | null
  vslot?: string | null
  dyeMode?: DyeMode
  color?: number
  colorGroup?: number
  colorVariants?: string[]
  thumb?: string | null
  // Phase-4 anchors / Phase-0 injection slots (all optional; populated by extract).
  icon?: string | null        // info.iconRaw path — fast placeholder/fallback
  setItemID?: number          // set-item grouping
  reqLevel?: number
  sn?: number                 // Commodity serial (~release order), when matched
  name?: string               // Korean name (PKG2 join) + (남)/(여) gender suffix
  gender?: number             // 0=남 1=여 2=공용 (id-rule, v8)
  label?: 'master' | 'special' // external grade badge (마라벨/스라벨); none = undefined
  invisibleFace?: number      // info.invisibleFace: 착용 시 성형(face)을 가림
  fixedEmotion?: string       // info.fixedEmotion: 착용 시 표정을 이 값으로 고정(표정 얼굴장식 25종)
  stances?: string[]          // weapon only: available weapon-type stance codes (30s한손/40s두손/49건)
  // frameKey → animation frames. (Legacy data may still be Layer[]; assemble.ts normalizes.)
  frames: Record<string, Frame[]>
}

// lightweight per-slot list entry (for virtualization/search/filter)
export interface ListItem {
  id: string
  slot: string
  isCash: boolean
  grade: 'master' | 'special' | 'cash' | 'none'
  islot: string | null
  vslot: string | null
  dyeMode: DyeMode
  color?: number
  colorGroup?: number
  thumb?: string | null
  icon?: string | null
  setItemID?: number
  reqLevel?: number
  sn?: number
  name?: string
  gender?: number
  label?: 'master' | 'special'
  invisibleFace?: number
  fixedEmotion?: string       // 표정 얼굴장식: 'smile' 같은 표정 키 또는 'blink/1' 처럼 키+프레임 인덱스
  headId?: string             // skin-only: paired head id for live compositing
  actions: string[]
  ridingActions?: string[]    // [dev] 라이딩 아이템: 허용 연출 액션(UI값). 없으면 기본 재규어 세트.
  ridingSeated?: string[]     // [dev] 라이딩 아이템: 캐릭터가 앉는(sit) 액션(UI값). 메탈아머는 전부 앉음.
  ridingCenterMount?: boolean // [dev] 라이딩 아이템: 캐릭터가 아니라 마운트(메카)를 중앙정렬(메탈아머).
  ridingBackSit?: boolean     // [dev] 라이딩 아이템: 뒷쪽 시선에도 캐릭터 sit 강제(탱크: 뒤=줄타기 프레임+앉은 조종사).
  metaUrl?: string            // [dev] 라이딩 아이템: 로컬 meta.json 경로(CDN 밖)
}

export interface SlotSummary {
  slot: string
  islot: string | null
  count: number
  file: string
  dye: 'palette' | 'cashHsb' | 'none'
  attach: 'head' | 'body'
}

// Item effect (Effect/ItemEff.wz). Drawn as an overlay behind/in front of the body;
// see scripts/extract-effects.cjs. `repFrame` indexes the representative static frame.
export interface EffectFrame { png: string; origin: Vec; delay: number }
export interface EffectGroup { z: number; pos: number; repFrame: number; frames: EffectFrame[] }
export interface EffectMeta {
  id: string
  fixed: number
  z: number
  repGroup: string
  groups: Record<string, EffectGroup>
}

export interface Index {
  version: number
  zmap: string[]
  smap: Record<string, string>
  slots: SlotSummary[]
  base: { tones: { tone: number; body: string; head: string; name?: string }[]; default: number }
}

// Build a data URL, defensively: strip leading slashes and a redundant leading base
// segment from `rel`, and self-heal a doubled base ("/data/data/…") from a misconfigured
// NEXT_PUBLIC_DATA_BASE, so a stray prefix can never yield "/data/data/sprites/…".
const url = (rel: string) => {
  // 절대경로(/riding/…)·완전URL 은 그대로(dev 로컬 public 서빙 — 라이딩 데이터가 CDN 밖에서 로드되게).
  if (/^(https?:)?\//.test(rel)) return rel
  const base = DATA_BASE.replace(/\/+$/, '')
  const seg = base.split('/').filter(Boolean).pop() || '' // e.g. "data"
  let r = rel.replace(/^\/+/, '')
  if (seg && r.startsWith(seg + '/')) r = r.slice(seg.length + 1) // drop leading "data/"
  let out = `${base}/${r}`
  while (seg && out.includes(`/${seg}/${seg}/`)) out = out.replace(`/${seg}/${seg}/`, `/${seg}/`)
  return out
}

// 목록·카탈로그 JSON 은 **새로고침하면 반드시 최신**이어야 한다(2026-09-21 사용자 지시).
// CDN 은 `max-age=60, stale-while-revalidate=86400` 이라, 60초가 지나면 브라우저가 **옛 사본을 그대로 쓰고**
// 갱신은 뒤에서 한다 → 패치나 신규 아이템이 새로고침 한 번으로는 안 나오고 그 다음 번에야 나왔다.
// `no-cache` 는 "캐시는 두되 매번 서버에 물어본다"라서, 안 바뀌었으면 304(본문 없음)로 끝난다 — 크기가 아니라
// 왕복 한 번만 더 드는 값이다. 스프라이트(png)와 아이템별 meta 는 그대로 둔다(개수가 많고 id 가 바뀌면 경로도 바뀐다).
const FRESH: RequestInit = { cache: 'no-cache' }

// 최근 패치 신규 아이템 id(파서 stringwz-merge 가 패치마다 catalog/new.json 을 교체). 없거나 실패하면 빈 집합.
let newItemsPromise: Promise<Set<string>> | null = null
export function loadNewItems(): Promise<Set<string>> {
  if (!newItemsPromise) {
    newItemsPromise = fetch(url('catalog/new.json'), FRESH)
      .then((r) => (r.ok ? r.json() : { ids: [] }))
      .then((j: { ids?: string[] }) => new Set(j.ids || []))
      .catch(() => new Set<string>())
  }
  return newItemsPromise
}

export async function loadIndex(): Promise<Index> {
  const r = await fetch(url('index.json'), FRESH)
  if (!r.ok) throw new Error(`index.json ${r.status}`)
  return r.json()
}
// 원본 WZ 의 자리 코드(islot·vslot)가 잘못 들어간 무기 보정 — 리스트·단건 어디로 들어와도 같은 값이 되도록
// 여기 한 곳에서 고친다(islot = 인벤 충돌로 옷을 **벗기고**, vslot = 가림으로 옷을 **숨긴다** — 둘 다 걸린다).
//  · 계기: 2026-09-21 건의함 "쿨썸머 보드 << 장착하면 한벌옷이 사라집니다".
//  · 실측: weapon 3942개 중 자리 코드가 Wp 계열이 아닌 건 MaPn(한벌옷) 5개뿐 — 쿨썸머 보드(01702849) ·
//    파스텔 로즈 · 비치발리볼 · 생선의 지배자 · 애교 폭발 멍뭉이. 전부 손에 드는 캐시 무기(아이콘 확인)라
//    몸을 덮지 않는다. 나머지는 Wp(3197) · WpSi(673, 양손) · Si(67) 로 정상이다.
//  · 그래서 무기의 자리 코드는 Wp 계열만 인정하고, 그 밖의 값은 Wp 로 본다.
const WEAPON_SLOT_CODES = new Set(['Wp', 'WpSi', 'Si'])
function fixWeaponSlotCodes<T extends { slot?: string; islot?: string | null; vslot?: string | null }>(it: T): T {
  if (it.slot !== 'weapon') return it
  const bad = (c?: string | null) => !!c && !WEAPON_SLOT_CODES.has(c)
  if (!bad(it.islot) && !bad(it.vslot)) return it
  return { ...it, islot: bad(it.islot) ? 'Wp' : it.islot, vslot: bad(it.vslot) ? 'Wp' : it.vslot }
}

// 라이딩(dev 로컬) 아이템의 meta 경로를 id→url 로 등록. 슬롯 로드 시 채워지고 loadMeta 가 이걸 우선 쓴다.
const ridingMetaUrl = new Map<string, string>()
const slotCache = new Map<string, Promise<ListItem[]>>()
export function loadSlot(file: string): Promise<ListItem[]> {
  let p = slotCache.get(file)
  if (!p) {
    p = fetch(url(file), FRESH).then((r) => r.json()).then((items: ListItem[]) => {
      for (const it of items) { const mu = (it as { metaUrl?: string }).metaUrl; if (mu) ridingMetaUrl.set(it.id, mu) }
      return items.map(fixWeaponSlotCodes)
    })
    slotCache.set(file, p)
  }
  return p
}
const metaCache = new Map<string, Promise<ItemMeta>>()
export function loadMeta(id: string): Promise<ItemMeta> {
  let p = metaCache.get(id)
  if (!p) { p = fetch(url(ridingMetaUrl.get(id) ?? `meta/${id}.json`)).then((r) => r.json()).then(fixWeaponSlotCodes); metaCache.set(id, p) }
  return p
}

// --- item effects (Effect/ItemEff.wz) ---
let effectIndexPromise: Promise<Set<string>> | null = null
// Set of item ids (non-padded, as stored in ItemEff) that have an extracted effect.
export function loadEffectIndex(): Promise<Set<string>> {
  if (!effectIndexPromise) {
    effectIndexPromise = fetch(url('effects/index.json'), FRESH)
      .then((r) => (r.ok ? r.json() : []))
      .then((ids: string[]) => new Set(ids))
      .catch(() => new Set<string>())
  }
  return effectIndexPromise
}
const effectCache = new Map<string, Promise<EffectMeta | null>>()
// id may be padded (meta id "01104029") or bare ("1104029"); effects are keyed bare.
export function loadEffect(id: string): Promise<EffectMeta | null> {
  const bare = String(parseInt(id, 10))
  let p = effectCache.get(bare)
  if (!p) {
    p = fetch(url(`effects/${bare}.json`)).then((r) => (r.ok ? r.json() : null)).catch(() => null)
    effectCache.set(bare, p)
  }
  return p
}

// 형상변이(Anima race) appearance parts (scripts/extract-anima.cjs → data/anima.json).
export interface AnimaPart { name: string; png: string; origin: Vec; map: Record<string, Vec>; z: string; islot: string | null; w: number; h: number }
export interface AnimaRace { node: string; name: string; parts: AnimaPart[] }
let animaPromise: Promise<AnimaRace[]> | null = null
export function loadAnima(): Promise<AnimaRace[]> {
  if (!animaPromise) animaPromise = fetch(url('anima.json'), FRESH).then((r) => (r.ok ? r.json() : [])).catch(() => [] as AnimaRace[])
  return animaPromise
}

export const spriteUrl = (pngRel: string) => url(pngRel)

// Deterministic path to the baked applied-look thumbnail (scripts/bake.cjs).
export const bakedThumbUrl = (id: string) => url(`sprites/${id}/thumb.png`)

// WZ-extracted grade badge icon (master/special/cash); 404 → text fallback in UI.
export const badgeUrl = (kind: string) => url(`badges/${kind}.png`)
