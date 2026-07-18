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

export async function loadIndex(): Promise<Index> {
  const r = await fetch(url('index.json'))
  if (!r.ok) throw new Error(`index.json ${r.status}`)
  return r.json()
}
// 라이딩(dev 로컬) 아이템의 meta 경로를 id→url 로 등록. 슬롯 로드 시 채워지고 loadMeta 가 이걸 우선 쓴다.
const ridingMetaUrl = new Map<string, string>()
const slotCache = new Map<string, Promise<ListItem[]>>()
export function loadSlot(file: string): Promise<ListItem[]> {
  let p = slotCache.get(file)
  if (!p) {
    p = fetch(url(file)).then((r) => r.json()).then((items: ListItem[]) => {
      for (const it of items) { const mu = (it as { metaUrl?: string }).metaUrl; if (mu) ridingMetaUrl.set(it.id, mu) }
      return items
    })
    slotCache.set(file, p)
  }
  return p
}
const metaCache = new Map<string, Promise<ItemMeta>>()
export function loadMeta(id: string): Promise<ItemMeta> {
  let p = metaCache.get(id)
  if (!p) { p = fetch(url(ridingMetaUrl.get(id) ?? `meta/${id}.json`)).then((r) => r.json()); metaCache.set(id, p) }
  return p
}

// --- item effects (Effect/ItemEff.wz) ---
let effectIndexPromise: Promise<Set<string>> | null = null
// Set of item ids (non-padded, as stored in ItemEff) that have an extracted effect.
export function loadEffectIndex(): Promise<Set<string>> {
  if (!effectIndexPromise) {
    effectIndexPromise = fetch(url('effects/index.json'))
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
  if (!animaPromise) animaPromise = fetch(url('anima.json')).then((r) => (r.ok ? r.json() : [])).catch(() => [] as AnimaRace[])
  return animaPromise
}

export const spriteUrl = (pngRel: string) => url(pngRel)

// Deterministic path to the baked applied-look thumbnail (scripts/bake.cjs).
export const bakedThumbUrl = (id: string) => url(`sprites/${id}/thumb.png`)

// WZ-extracted grade badge icon (master/special/cash); 404 → text fallback in UI.
export const badgeUrl = (kind: string) => url(`badges/${kind}.png`)
