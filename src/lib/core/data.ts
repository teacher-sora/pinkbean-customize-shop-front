// Static data access. Everything is fetched from DATA_BASE — the Cloudflare R2/CDN bucket
// (bucket contents live at the bucket root, e.g. <cdn>/index.json). NEXT_PUBLIC_DATA_BASE
// overrides the base. Index is split per slot for virtualization.
import type { ParticleDesc, ParticleSpot } from './particle'
export const DATA_BASE =
  process.env.NEXT_PUBLIC_DATA_BASE ?? 'https://cdn.pinkbean-customize.com'

export type Vec = { x: number; y: number }

export interface Layer {
  name: string
  png: string
  z: string
  origin: Vec
  map: Record<string, Vec>
  // 원본에 앵커(map)가 없는 캔버스 — 뼈대의 어느 점에도 붙지 않고 캐릭터 원점(발)에 origin 을 맞춘다(이펙트 프레임과
  // 같은 좌표계). 추출기가 머리부착 아이템의 액션 프레임에서만 단다(extract.cjs extractFrame). z 가 정수일 수 있다.
  root?: boolean
  // 일루전(반지 부위의 일루전 링 · 이펙트 부위의 내 뒤에 나)의 표지 레이어 — 그림이 없다(png ''). assemble 이 읽어 캐릭터를
  // 키우거나 바꾸고, 그리는 목록에서는 뺀다. 프레임마다 다를 수 있는 값(거대한 몸의 headorigin = origin)도 이 레이어에 둔다.
  illusion?: Illusion
}

// 일루전의 종류(parser scripts/ring-build.py · cashfx-build.py 가 쓴다).
//   bigHead   = 머리 쪽 부위를 scale 배(거대한 머리)            bigBody = 몸 · 옷 · 신발 · 장갑 · 망토를 scale 배, 머리는 그대로(거대한 몸)
//   transform = 캐릭터 대신 반지의 그림(변신 링)                  clone   = 지금 캐릭터를 scale 배로 키워 offset 만큼 비켜 뒤에(내 뒤에 나)
// hideEffect · hideWeapon = 착용 아이템의 이펙트 · 무기와 방패를 그리지 않는다(원본 info.hideEffect · illusionequip).
export interface Illusion { kind: 'bigHead' | 'bigBody' | 'transform' | 'clone'; scale?: number; offset?: Vec; hideEffect?: boolean; hideWeapon?: boolean }

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
  gender?: number             // 0=남 1=여 2=공용
  label?: 'master' | 'special' // external grade badge (마라벨/스라벨); none = undefined
  invisibleFace?: number      // info.invisibleFace: 착용 시 성형(face)을 가림
  illusion?: Illusion         // 일루전 링 · 내 뒤에 나(프레임의 표지 레이어와 같은 값 — 그리기 밖에서 이펙트 · 박자를 정할 때 쓴다)
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
  ridingActions?: string[]    // 라이딩 아이템: 허용 연출 액션(UI값). 없으면 기본 재규어 세트.
  ridingSeated?: string[]     // 라이딩 아이템: 캐릭터가 앉는(sit) 액션(UI값). 메탈아머는 전부 앉음.
  ridingCenterMount?: boolean // 라이딩 아이템: 캐릭터가 아니라 마운트(메카)를 중앙정렬(메탈아머).
  ridingBackSit?: boolean     // 라이딩 아이템: 뒷쪽 시선에도 캐릭터 sit 강제(탱크: 뒤=줄타기 프레임+앉은 조종사).
  metaUrl?: string            // 라이딩 아이템: 프론트 public 의 meta.json 경로(CDN 밖)
  dupOf?: number              // 헤어 · 성형: 같은 그림 · 같은 이름의 원본 색 묶음(이 묶음은 복제다 — loadBeautyDups)
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
// see parser 레포의 scripts/extract-effects.cjs. `repFrame` indexes the representative static frame.
// 캐시 이펙트(이펙트 부위, parser scripts/cashfx-build.py)도 같은 모양이고, 몇 가지가 더 붙는다.
//   frame.z  = 프레임마다 다른 앞뒤(없으면 묶음의 z).
//   앞뒤: 캐시 이펙트는 pos 가 있으면 캐릭터 뒤(음수), pos 가 없으면 원본 z 그대로(0 이상 = 모든 레이어 앞) — parser 가 정해 쓴다. 이펙트끼리는 z 순서(render).
//   trail    = 여러 겹이 캐릭터를 따라다니는 이펙트의 묶음들(반짝반짝 스타). 함께 그린다.
//   cycle    = 묶음을 ms 마다 차례로 돌린다(사원증의 카드 세 장).
//   extra    = 두 번째 층(effect2). 함께 그린다.
export interface EffectFrame { png: string; origin: Vec; delay: number; z?: number }
export interface EffectGroup { z: number; pos: number; repFrame: number; frames: EffectFrame[] }
export interface EffectMeta {
  id: string
  fixed: number
  z: number
  repGroup: string
  groups: Record<string, EffectGroup>
  trail?: string[]
  cycle?: { groups: string[]; ms: number }
  extra?: EffectMeta
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
  // 절대경로(/riding/…)·완전URL 은 그대로(프론트 public 서빙 — 라이딩 데이터가 CDN 밖에서 로드되게).
  if (/^(https?:)?\//.test(rel)) return rel
  const base = DATA_BASE.replace(/\/+$/, '')
  const seg = base.split('/').filter(Boolean).pop() || '' // e.g. "data"
  let r = rel.replace(/^\/+/, '')
  if (seg && r.startsWith(seg + '/')) r = r.slice(seg.length + 1) // drop leading "data/"
  let out = `${base}/${r}`
  while (seg && out.includes(`/${seg}/${seg}/`)) out = out.replace(`/${seg}/${seg}/`, `/${seg}/`)
  return out
}

// 목록·카탈로그 JSON 은 **새로고침하면 반드시 최신**이어야 한다.
// CDN 은 `max-age=60, stale-while-revalidate=86400` 이라, 60초가 지나면 브라우저가 **옛 사본을 그대로 쓰고**
// 갱신은 뒤에서 한다 → 패치나 신규 아이템이 새로고침 한 번으로는 안 나오고 그 다음 번에야 나온다.
// `no-cache` 는 "캐시는 두되 매번 서버에 물어본다"라서, 안 바뀌었으면 304(본문 없음)로 끝난다 — 크기가 아니라
// 왕복 한 번만 더 드는 값이다. 스프라이트(png)와 아이템별 meta 는 그대로 둔다(개수가 많고 id 가 바뀌면 경로도 바뀐다).
const FRESH: RequestInit = { cache: 'no-cache' }

// 앱 코드가 도착하기 전에 미리 받기 시작한 것(app/(shop)/layout 의 BOOT 스크립트)을 한 번 가져다 쓴다. 없으면 null.
// 실패한 약속일 수 있으므로 쓰는 쪽이 평소의 요청으로 되받는다(pre).
function boot<T>(rel: string): Promise<T> | null {
  const b = typeof window === 'undefined' ? undefined : (window as unknown as { __pbBoot?: Record<string, Promise<unknown>> }).__pbBoot
  const p = b?.[rel]
  if (!p) return null
  delete b![rel]
  return p as Promise<T>
}
const pre = <T,>(rel: string, load: () => Promise<T>): Promise<T> => { const p = boot<T>(rel); return p ? p.catch(load) : load() }

// 최근 패치 신규 아이템 id(파서 stringwz-merge 가 패치마다 catalog/new.json 을 교체). 없거나 실패하면 빈 집합.
let newItemsPromise: Promise<Set<string>> | null = null
export function loadNewItems(): Promise<Set<string>> {
  if (!newItemsPromise) {
    newItemsPromise = pre<{ ids?: string[] }>('catalog/new.json', () => fetch(url('catalog/new.json'), FRESH).then((r) => (r.ok ? r.json() : { ids: [] })))
      .then((j: { ids?: string[] }) => new Set(j.ids || []))
      .catch(() => new Set<string>())
  }
  return newItemsPromise
}

export async function loadIndex(): Promise<Index> {
  return pre<Index>('index.json', async () => {
    const r = await fetch(url('index.json'), FRESH)
    if (!r.ok) throw new Error(`index.json ${r.status}`)
    return r.json()
  })
}
// 원본 WZ 의 자리 코드(islot·vslot)가 **남의 부위로** 들어간 아이템 보정. 리스트·단건 어디로 들어와도 같은
// 값이 되도록 여기 한 곳에서 고친다(islot = 인벤 충돌로 다른 부위를 **벗기고**, vslot = 가림으로 **숨긴다**).
//  · 예: 쿨썸머 보드(무기인데 islot·vslot 이 MaPn) — 장착하면 한벌옷이 사라진다.
//  · 전수 조사(14슬롯 32,693개): 같은 꼴이 21개 더 있다 —
//      신발 '투명 신발'·장갑 '투명 장갑'·망토 '투명 망토'/'숟가락X포크 망토'/'메이플 갤럭시 망토' = Cp(모자),
//      신발 '유피테르 슈즈' 등 5개 = MaPn, 한벌옷 '커플/솔로부대 전투복' 등 6개 = Sr(망토), 무기 5개 = MaPn.
//    이들은 하나같이 **islot 과 vslot 이 똑같이 남의 코드**다(원본이 통째로 잘못 들어간 꼴).
//  · 반대로 '정당한 가림'은 islot 이 제 부위이고 vslot 만 남을 가린다 — 모자 vslot=CpH1H5(헤어 가림),
//    얼굴장식 '오만의 원죄' vslot=CpH1H5, 장갑 vslot=GlGw(장갑 레이어), 헤어 vslot=H1H2…(앞/뒷머리).
//    그래서 **islot 이 제 부위일 때는 vslot 을 건드리지 않는다**.
//  · 겸용도 정당하다: 양손무기 WpSi, 포스실드류 무기 Si(방패 칸 장착), 전신 인형탈 모자 HrCp,
//    상하의를 함께 차지하는 상의·하의 MaPn.
const OK_ISLOT: Record<string, string[]> = {
  hair: ['Hr'], face: ['Fc'], cap: ['Cp', 'HrCp'], faceAcc: ['Af'], eyeAcc: ['Ay'], earring: ['Ae'],
  coat: ['Ma', 'MaPn'], longcoat: ['MaPn'], pants: ['Pn', 'MaPn'], shoes: ['So'], glove: ['Gv'],
  cape: ['Sr'], weapon: ['Wp', 'WpSi', 'Si'], shield: ['Si'],
}
const BASE_ISLOT: Record<string, string> = {
  hair: 'Hr', face: 'Fc', cap: 'Cp', faceAcc: 'Af', eyeAcc: 'Ay', earring: 'Ae',
  coat: 'Ma', longcoat: 'MaPn', pants: 'Pn', shoes: 'So', glove: 'Gv', cape: 'Sr', weapon: 'Wp', shield: 'Si',
}
function fixSlotCodes<T extends { slot?: string; islot?: string | null; vslot?: string | null }>(it: T): T {
  const slot = it.slot || ''
  const ok = OK_ISLOT[slot]
  if (!ok || !it.islot || ok.includes(it.islot)) return it
  const base = BASE_ISLOT[slot]
  return { ...it, islot: base, vslot: base } // islot 이 통째로 남의 코드 = vslot 도 같은 값이라 함께 되돌린다
}

// 원본의 아이콘이 다른 물건 그림인 아이템 → 같은 이름의 올바른 아이콘으로 바꿔 끼운다.
//  · 투명 방패 01092056: 원본 아이콘이 투명 장갑 그림이다. 같은 이름의 01092067 은 방패 그림이다(둘 다 입으면 아무것도 안 보인다).
//    목록은 같은 이름 가운데 가장 낮은 id 를 대표로 쓰므로(foldList) 장갑 그림이 방패 칸에 떴다.
const ICON_FIX: Record<string, string> = { '01092056': 'sprites/01092067/icon.png' }
const fixIcon = <T extends { id: string; icon?: string | null }>(it: T): T => (ICON_FIX[it.id] ? { ...it, icon: ICON_FIX[it.id] } : it)

// 라이딩(프론트 public) 아이템의 meta 경로를 id→url 로 등록. 슬롯 로드 시 채워지고 loadMeta 가 이걸 우선 쓴다.
const ridingMetaUrl = new Map<string, string>()

// 헤어 · 성형의 복제 묶음 표(parser scripts/beauty-dups.py → CDN catalog/beauty-dups.json) = { slot: { 복제 colorGroup: 원본 colorGroup } }.
// 넥슨은 같은 그림을 반대 성별 id 로 다시 냈고, (남)/(여) 는 id 규칙으로 붙어 복제는 이름의 성별이 그림과 반대다
// (차차 얼굴 (여) 54036 = 남자 그림 50037). 목록에서 빼고(foldList), 저장된 코디의 복제 id 는 원본으로 읽는다(ShopContext).
// 목록에서 지우지 않고 표시만 하는 것은 그 id 로 저장된 프리셋 · 광장 글이 비지 않게 하려는 것이다. 없거나 실패하면 빈 표.
type BeautyDups = Record<string, Record<string, number>>
let beautyDupsPromise: Promise<BeautyDups> | null = null
export function loadBeautyDups(): Promise<BeautyDups> {
  if (!beautyDupsPromise) {
    beautyDupsPromise = pre<BeautyDups>('catalog/beauty-dups.json', () => fetch(url('catalog/beauty-dups.json'), FRESH).then((r) => (r.ok ? r.json() : {})))
      .catch(() => ({}))
  }
  return beautyDupsPromise
}
const slotCache = new Map<string, Promise<ListItem[]>>()
export function loadSlot(file: string): Promise<ListItem[]> {
  let p = slotCache.get(file)
  if (!p) {
    p = pre<ListItem[]>(file, () => fetch(url(file), FRESH).then((r) => r.json())).then((items: ListItem[]) => {
      for (const it of items) { const mu = (it as { metaUrl?: string }).metaUrl; if (mu) ridingMetaUrl.set(it.id, mu) }
      return items.map((it) => fixIcon(fixSlotCodes(it)))
    }).then(async (items) => {
      const first = items[0]
      if (!first || (first.slot !== 'hair' && first.slot !== 'face') || first.colorGroup == null) return items
      const dup = (await loadBeautyDups())[first.slot] || {}
      return items.map((it) => (it.colorGroup != null && dup[it.colorGroup] != null ? { ...it, dupOf: dup[it.colorGroup] } : it))
    })
    slotCache.set(file, p)
  }
  return p
}
const metaCache = new Map<string, Promise<ItemMeta>>()
export function loadMeta(id: string): Promise<ItemMeta> {
  let p = metaCache.get(id)
  // ⚠️ 실패한 결과는 캐시에 남기지 않는다. 라이딩 meta 는 목록(riding.json)이 경로를 등록해 줘야 찾을 수 있는데,
  //    그 전에 한 번 부르면 CDN 404 로 실패한다 — 실패까지 캐시하면 목록이 온 뒤에도 영영 안 나온다.
  if (!p) {
    const rel = ridingMetaUrl.get(id) ?? `meta/${id}.json`
    p = pre<ItemMeta>(rel, () => fetch(url(rel)).then((r) => r.json())).then(fixSlotCodes)
    p.catch(() => { if (metaCache.get(id) === p) metaCache.delete(id) })
    metaCache.set(id, p)
  }
  return p
}

// --- item effects (Effect/ItemEff.wz) ---
// 이펙트 부위(캐시 이펙트)의 목록. 목록의 아이템은 모두 이펙트가 있으므로 이 목록이 곧 그 색인이다 —
// effects/index.json(parser extract-effects 가 다시 쓴다)에 섞지 않고 여기서 합친다.
export const CASHFX_FILE = 'cashfx/list.json'
// 반지 부위(일루전 링)의 목록 — CDN rings/(parser scripts/ring-build.py). 카탈로그 index 밖이라 slotFile 이 고른다.
export const RING_FILE = 'rings/list.json'
let effectIndexPromise: Promise<Set<string>> | null = null
// Set of item ids (non-padded, as stored in ItemEff) that have an extracted effect.
export function loadEffectIndex(): Promise<Set<string>> {
  if (!effectIndexPromise) {
    effectIndexPromise = Promise.all([
      pre<string[]>('effects/index.json', () => fetch(url('effects/index.json'), FRESH).then((r) => (r.ok ? r.json() : []))).catch(() => [] as string[]),
      loadSlot(CASHFX_FILE).catch(() => [] as ListItem[]),
    ]).then(([ids, fx]) => new Set([...ids, ...fx.map((it) => String(parseInt(it.id, 10)))]))
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

// --- 파티클(제네시스 무기의 붉은 파장 등 — parser scripts/extract-particles.cjs → CDN particles/) ---
// index = { 8자리 id: { 동작 키(stand1 · 30/stand1 …): [{ name, z, origin }] } }. 규칙 · 그림은 particles/<이름>.json.
let particleIndexPromise: Promise<Record<string, Record<string, ParticleSpot[]>>> | null = null
export function loadParticleIndex(): Promise<Record<string, Record<string, ParticleSpot[]>>> {
  if (!particleIndexPromise) particleIndexPromise = fetch(url('particles/index.json'), FRESH).then((r) => (r.ok ? r.json() : {})).catch(() => ({}))
  return particleIndexPromise
}
const particleCache = new Map<string, Promise<ParticleDesc | null>>()
export function loadParticle(name: string): Promise<ParticleDesc | null> {
  let p = particleCache.get(name)
  if (!p) { p = fetch(url(`particles/${name}.json`)).then((r) => (r.ok ? r.json() : null)).catch(() => null); particleCache.set(name, p) }
  return p
}
// 부유 아이템(별빛 걸음 · 이펙트 수면안대 등 — parser scripts/float-items.cjs → CDN effects/float.json, { 8자리 id: 값 }).
// 서기 때 원래의 흔들림에 위아래로 둥둥 뜨는 움직임을 더한다(PreviewModel).
let floatPromise: Promise<Record<string, number>> | null = null
export function loadFloatItems(): Promise<Record<string, number>> {
  if (!floatPromise) floatPromise = fetch(url('effects/float.json'), FRESH).then((r) => (r.ok ? r.json() : {})).catch(() => ({}))
  return floatPromise
}
// 무기가 '제 프레임으로 움직이는' 서기 동작(parser scripts/weapon-motion.py → CDN weapons/motion.json).
// 값 = { 동작 키: { 도는 레이어 이름: 프레임마다 [dx, dy] } } — 몸이 멈춘 '기본'에서 이 레이어만 프레임대로 돌리고(보정만큼 옮겨),
// 나머지 레이어(손에 든 무기 본체)는 첫 프레임 그림에 고정한다. 이펙트는 보정 0(원본대로 움직인다), 조각이 든 본체는 큰 덩어리를 제자리에 두는 보정.
export type WeaponMotion = Record<string, Record<string, Record<string, [number, number][]>>>
let weaponMotionPromise: Promise<WeaponMotion> | null = null
export function loadWeaponMotion(): Promise<WeaponMotion> {
  if (!weaponMotionPromise) weaponMotionPromise = fetch(url('weapons/motion.json'), FRESH).then((r) => (r.ok ? r.json() : {})).catch(() => ({}))
  return weaponMotionPromise
}

// 형상변이(Anima race) appearance parts (parser 레포의 scripts/extract-anima.cjs → CDN anima.json).
export interface AnimaPart { name: string; png: string; origin: Vec; map: Record<string, Vec>; z: string; islot: string | null; w: number; h: number }
export interface AnimaRace { node: string; name: string; parts: AnimaPart[] }
let animaPromise: Promise<AnimaRace[]> | null = null
export function loadAnima(): Promise<AnimaRace[]> {
  if (!animaPromise) animaPromise = pre<AnimaRace[]>('anima.json', () => fetch(url('anima.json'), FRESH).then((r) => (r.ok ? r.json() : []))).catch(() => [] as AnimaRace[])
  return animaPromise
}

export const spriteUrl = (pngRel: string) => url(pngRel)

// WZ-extracted grade badge icon (master/special/cash); 404 → text fallback in UI.
export const badgeUrl = (kind: string) => url(`badges/${kind}.png`)
