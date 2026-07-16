// Pure character assembly. Single source of truth shared by the main canvas and
// the list thumbnails. Validated against the ground-truth render.
//
// Phase 2: generalized to (action, frame) via getFrameLayers, plus cap/head
// occlusion. Anchor math unchanged:
//  - body `navel` is the root at world (0,0); a layer aligns by a shared named
//    map point: topLeft = worldAnchor - (origin + map[anchor]); it then
//    contributes its other map points so later parts attach.
//  - Paint order follows zmap: higher index = further back -> draw first.
import type { ItemMeta, Layer, Vec, Index, Frame } from './data'
import { buildVisibility, type Equipped } from './occlusion'

export interface PlacedLayer extends Layer {
  x: number
  y: number
  itemId: string
  slot: string
  tintable: boolean
}

export interface AssembleInput {
  itemId: string
  slot: string
  vslot: string | null
  layers: Layer[]
  invisibleFace?: number   // an equipped invisibleFace accessory hides the 성형(face)
  name?: string | null     // 투명(투명 시리즈) 판별용 — 투명 아이템은 아무것도 안 그리므로 가림에서 제외
}

// 투명 시리즈(투명 모자/얼굴장식/장갑…)는 스프라이트가 비어 아무것도 안 그리는데, vslot(가림)만 남으면
// 밑의 헤어/얼굴이 사라지는 구멍이 생긴다 → 이런 아이템은 occlusion/face-hide 에서 제외한다.
const isTransparent = (name?: string | null) => !!name && name.includes('투명')

export interface ViewOpts {
  action: string            // effective action key (resolved: stand1/swingT1/shoot6/…)
  expression: string        // face expression key
  ear: string               // "humanEar"(일반) | "ear"(엘프) | "lefEar"(우든레프) | "highlefEar"(하이레프)
  weaponMotion?: string     // '기본'basic | 'one'한손 | 'two'두손 | 'gun'건 — picks the weapon's stance
}

// Weapons carry an appearance per weapon-type stance code. Pick the stance matching the
// selected 무기모션: 건→49, 두손→40번대, 한손→30번대, 기본→30번대(없으면 첫 스탠스).
function pickWeaponStance(stances: string[], wm?: string): string {
  const nums = stances.map(Number)
  const inRange = (lo: number, hi: number) => { const i = nums.findIndex((n) => n >= lo && n <= hi); return i >= 0 ? stances[i] : undefined }
  const gun = () => { const i = nums.indexOf(49); return i >= 0 ? stances[i] : undefined }
  if (wm === 'gun') return gun() ?? inRange(40, 48) ?? stances[0]
  if (wm === 'two') return inRange(40, 48) ?? stances[0]
  // 한손/기본
  return inRange(30, 39) ?? stances[0]
}

const TINTABLE_SLOTS = new Set(['hair', 'longcoat'])
// Climbing actions face away from the camera — show the back of the head, hide the face.
const BACK_ACTIONS = new Set(['ladder', 'rope'])
// Prone body actions: head-attached items (일부 헤어) carry a dedicated 'prone' frame with
// 엎드림 전용 스프라이트. Use it for these so the hair lies down instead of staying upright.
const PRONE_ACTIONS = new Set(['prone', 'proneStab'])
// The base body's shoot6(총 사격) is an action-ref to shootF; cosmetics usually only carry
// shootF. So when an item lacks the exact action, try this alternate BEFORE falling to stand
// (otherwise the clothing stands while the body shoots → 스프라이트가 어긋남).
const ACTION_FALLBACK: Record<string, string> = { shoot6: 'shootF' }

// Normalize a frames entry to Frame[] (tolerate legacy Layer[] from pre-animation data).
function normFrames(v: any): Frame[] {
  if (!v || !v.length) return []
  return v[0].layers ? (v as Frame[]) : [{ delay: 120, layers: v as Layer[] }]
}

// Resolve the animation frame SEQUENCE for one item in the current view (key selection +
// head ear-filter + face/back hide). Returns [] when the item shows nothing (e.g. face on back).
export function getFrameSeq(meta: ItemMeta, opts: ViewOpts): Frame[] {
  const f = meta.frames as Record<string, any>
  const keys = Object.keys(f)
  const back = BACK_ACTIONS.has(opts.action)
  // Weapon: pick the stance for 무기모션, then the action within it, with graceful fallback.
  if (meta.slot === 'weapon' && meta.stances?.length) {
    const s = pickWeaponStance(meta.stances, opts.weaponMotion)
    const fb = ACTION_FALLBACK[opts.action]
    const cands = [`${s}/${opts.action}`, ...(fb ? [`${s}/${fb}`] : []), `${s}/stand1`, `${s}/stand2`]
    for (const k of cands) if (f[k]) return normFrames(f[k])
    const anyInStance = keys.find((k) => k.startsWith(s + '/'))
    if (anyInStance) return normFrames(f[anyInStance])
    const anyMatch = keys.find((k) => k.endsWith('/' + opts.action)) || keys[0]
    return anyMatch ? normFrames(f[anyMatch]) : []
  }
  let key: string
  if (meta.slot === 'face') {
    if (back) return [] // 뒷모습에서는 얼굴을 그리지 않음
    key = f[opts.expression] ? opts.expression : f['default'] ? 'default' : keys[0]
  } else if (meta.slot === 'head') {
    key = back && (f[opts.action] || f['back']) ? (f[opts.action] ? opts.action : 'back') : f['front'] ? 'front' : keys[0]
  } else if (f['base']) {
    // head-attached non-face (hair/cap/accessories). 등반 시엔 뒷프레임만 — 없으면 숨김.
    if (back) return f['back'] ? normFrames(f['back']) : []
    // 엎드리기: prone 전용 프레임이 있으면 그걸 사용(엎드림 헤어). 없으면 서기(base)로 폴백.
    key = (PRONE_ACTIONS.has(opts.action) && f['prone']) ? 'prone' : 'base'
  } else { // body-attached: exact action → fallback(shoot6→shootF) → stand
    const fb = ACTION_FALLBACK[opts.action]
    key = f[opts.action] ? opts.action : (fb && f[fb]) ? fb : f['stand1'] ? 'stand1' : keys[0]
  }

  let seq = key != null ? normFrames(f[key]) : []
  // 안전망(파서 버그 보정): 재추출로 고친 헤어는 base 에 prone 레이어가 없어 no-op. 아직 안 고친
  // 오염 메타(원본 WZ가 엎드림 스프라이트를 서기 노드에 형제로 담아 'base'에 섞여 들어간 경우)는
  // 여기서 prone 레이어를 걸러 서기+엎드림 겹침을 방지한다. (prone 프레임 선택 시에는 걸러지지 않음.)
  if (key === 'base') seq = seq.map((fr) => ({ delay: fr.delay, layers: fr.layers.filter((l) => !/prone/i.test(l.name)) }))
  if (meta.slot === 'head') seq = seq.map((fr) => ({ delay: fr.delay, layers: fr.layers.filter((l) => l.name === 'head' || l.name === opts.ear) }))
  return seq
}

// Layers of animation frame `i` (clamped to the item's own length). Default 0 = static
// (thumbnails / non-animated contexts). The animator passes the current frame index.
export function getFrameLayers(meta: ItemMeta, opts: ViewOpts, i = 0): Layer[] {
  const seq = getFrameSeq(meta, opts)
  if (!seq.length) return []
  return seq[Math.min(i, seq.length - 1)].layers
}

// Number of animation frames for the current view (drives the master clock = base body).
export function frameCount(meta: ItemMeta, opts: ViewOpts): number {
  return getFrameSeq(meta, opts).length
}
// Per-frame delays (ms) for the current view — used to time the animation loop.
export function frameDelays(meta: ItemMeta, opts: ViewOpts): number[] {
  return getFrameSeq(meta, opts).map((fr) => fr.delay)
}

export function assemble(
  items: AssembleInput[],
  zmap: Index['zmap'],
  smap: Index['smap'],
): { placed: PlacedLayer[]; anchors: Record<string, Vec> } {
  // 투명 아이템은 vslot 을 null 로 취급 → 헤어/얼굴을 가리지 않는다(안 그리는데 가리면 구멍 생김).
  const equipped: Equipped[] = items.map((i) => ({ id: i.itemId, slot: i.slot, vslot: isTransparent(i.name) ? null : i.vslot }))
  const isVisible = buildVisibility(equipped, smap)
  // an equipped invisibleFace accessory (e.g. 신비주의) hides the 성형(face) slot. 단, 투명 아이템은 제외.
  const hideFace = items.some((i) => i.invisibleFace && !isTransparent(i.name))

  const anchors: Record<string, Vec> = { navel: { x: 0, y: 0 } }
  type Pending = Layer & { itemId: string; slot: string; hidden: boolean }
  const remaining: Pending[] = []
  // ⚠️ 가림(occlusion)은 "그리지 않는 것"이지 "골격에서 빼는 것"이 아니다.
  // 숨긴 레이어도 자기 map 앵커(brow/neck/hand…)는 그대로 제공해야 한다.
  // 예: 탈(vslot 에 Hd)은 머리를 숨기는데, 탈 자신이 붙을 brow 앵커를 주는 게 바로 그 머리다.
  // 머리를 아예 빼버리면 brow 가 없어 탈이 앵커를 못 찾고 → 아래 폴백이 몸통 원점(허리)에 그려버린다.
  for (const it of items) {
    const faceHidden = hideFace && it.slot === 'face'
    for (const l of it.layers) {
      remaining.push({ ...l, itemId: it.itemId, slot: it.slot, hidden: faceHidden || !isVisible(it.slot, l.z) })
    }
  }

  const placed: PlacedLayer[] = []
  let progress = true
  while (remaining.length && progress) {
    progress = false
    for (let i = 0; i < remaining.length; i++) {
      const L = remaining[i]
      // Skip null-valued map points: some items (e.g. 카오스 크레센트) declare a
      // map key with no vector — reading L.map[n].x on it throws and crashes the
      // whole assemble (cell stuck on skeleton, click errors the main preview).
      const names = Object.keys(L.map || {}).filter((n) => L.map[n])
      const aname = names.find((n) => anchors[n])
      if (!aname) continue
      const aw = anchors[aname]
      const x = aw.x - (L.origin.x + L.map[aname].x)
      const y = aw.y - (L.origin.y + L.map[aname].y)
      if (!L.hidden) placed.push({ ...L, x, y, tintable: TINTABLE_SLOTS.has(L.slot) }) // 숨긴 건 안 그린다(앵커는 아래에서 제공)
      for (const n of names) {
        if (!anchors[n]) anchors[n] = { x: x + L.origin.x + L.map[n].x, y: y + L.origin.y + L.map[n].y }
      }
      remaining.splice(i, 1)
      i--
      progress = true
    }
  }

  // Layers still unplaced reference only an anchor nothing provides — chiefly the `handMove`-only
  // lHand (전투대기/치유) whose grip is normally supplied by a weapon. WcR2 places such a part's
  // ORIGIN at the skeleton root, which coincides with the body's origin point. Reproduce that so
  // the hand lands at the correct forward position (not clustered on rHand). Truly anchorless
  // layers (all map points null, e.g. 카오스 크레센트) have no valid map key and stay dropped.
  const bodyLayer = placed.find((p) => p.name === 'body')
  if (bodyLayer && remaining.length) {
    const rox = bodyLayer.x + bodyLayer.origin.x
    const roy = bodyLayer.y + bodyLayer.origin.y
    for (const L of remaining) {
      if (L.hidden) continue // 가려진 레이어는 폴백으로도 그리지 않는다
      if (!Object.keys(L.map || {}).some((n) => L.map[n])) continue // no valid anchor at all → drop
      placed.push({ ...L, x: rox - L.origin.x, y: roy - L.origin.y, tintable: TINTABLE_SLOTS.has(L.slot) })
    }
  }

  const zIndex = (z: string) => {
    const i = zmap.indexOf(z)
    return i < 0 ? 9999 : i
  }
  placed.sort((a, b) => zIndex(b.z) - zIndex(a.z))
  // `anchors` holds every resolved named reference point (navel/neck/brow/hand/…) in
  // world coords (navel = 0,0). Item effects use it to pick their attach point by `pos`.
  return { placed, anchors }
}
