// Canvas compositing for assembled characters. Pure client-side; once sprites
// are preloaded, rendering (main canvas + every thumbnail) does zero network IO.
//
// Phase 2 (A2 + C): the character is NOT bbox-centered. Instead the body navel
// (world 0,0) is nailed to a FIXED canvas coordinate inside a fixed world box,
// so the body never shifts when hair/hats/weapons change extent. All scaling is
// integer (x1/x2/x3) with smoothing off and integer pixel snapping -> crisp dots.
import { spriteUrl, type EffectMeta, type Vec } from './data'
import type { PlacedLayer } from './assemble'
import { LRU } from './lru'

const imageCache = new LRU<Promise<HTMLImageElement>>(1200)

export function loadImage(pngRel: string): Promise<HTMLImageElement> {
  const src = spriteUrl(pngRel)
  let p = imageCache.get(src)
  if (!p) {
    p = new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error(`load ${src}`))
      img.src = src
    })
    imageCache.set(src, p)
  }
  return p
}

export async function preload(pngRels: string[]): Promise<void> {
  await Promise.all(pngRels.map((r) => loadImage(r).catch(() => null)))
}

export interface Tints {
  hair?: number      // hue rotation in degrees; undefined = default color
  longcoat?: number
}

// A single item-effect frame to composite (representative static frame). `z < 0` draws
// behind the body, `z >= 0` in front. The effect's `origin` is aligned to a character
// reference point (ox, oy) in world coords (navel = 0,0): topLeft = anchor + (ox,oy) - origin.
export interface EffectDraw { png: string; origin: { x: number; y: number }; z: number; ox: number; oy: number }

// Character reference points an effect can attach to (world coords; navel = (0,0)).
// foot = body sprite origin (-navel); brow = resolved head brow anchor.
export interface EffectAnchors { foot: Vec; brow: Vec }

// Pick the STATIC representative effect frame for a given action (falls back to the
// `default` group, then repGroup). One frame only — effects never animate.
// Attach point is data-driven by the effect group's `pos` (Effect/ItemEff.wz):
//   pos === 1 → brow (head);  else (pos 0 / absent) → foot.
// Verified against the game across all 959 standing effects (pos ∈ {none,0,1};
// none/0 → foot, 1 → brow). No per-effect offset. (Other actions may carry pos 2/3 —
// map those when those actions are added.)
// Which frame is showing at `elapsed` ms given per-frame delays (looping). elapsed=0 → frame 0.
function frameAtElapsed(delays: number[], elapsed: number): number {
  if (!delays || delays.length <= 1) return 0
  const ds = delays.map((d) => Math.max(20, d || 100))
  const total = ds.reduce((a, b) => a + b, 0)
  let t = ((elapsed % total) + total) % total
  for (let i = 0; i < ds.length; i++) { t -= ds[i]; if (t < 0) return i }
  return ds.length - 1
}
export function effectDraws(meta: EffectMeta | null | undefined, action: string, anchors: EffectAnchors, elapsed = 0): EffectDraw[] {
  if (!meta) return []
  const g = meta.groups[action] || meta.groups['default'] || meta.groups[meta.repGroup]
  if (!g || !g.frames.length) return []
  // animate: pick the frame for the current time (single frame → static rep frame).
  const idx = g.frames.length > 1 ? frameAtElapsed(g.frames.map((f) => f.delay), elapsed) : g.repFrame
  const fr = g.frames[idx] || g.frames[g.repFrame] || g.frames[0]
  const pt = g.pos === 1 ? anchors.brow : anchors.foot
  return [{ png: fr.png, origin: fr.origin, z: g.z, ox: pt.x, oy: pt.y }]
}

export interface RenderOpts {
  scale?: number              // INTEGER only (1/2/3)
  box: { w: number; h: number }      // fixed world-pixel box (canvas = box * scale)
  anchor: { x: number; y: number }   // world-pixel position of navel inside the box
  flip?: boolean                     // gaze left/right (horizontal mirror)
  override?: Map<string, HTMLCanvasElement>  // dyed source per layer png
  backImage?: string                 // sprite drawn BEHIND the body (ultimate fallback: no body & no effect)
  effects?: EffectDraw[]             // item effects (망토 등) composited around the body (each carries ox/oy)
  shouldCancel?: () => boolean       // true once a newer render superseded this one → don't paint stale content
  centerX?: boolean                  // center the drawn character bbox horizontally in the box (matches sprite centering)
}

// Draw the placed character with the navel pinned to a fixed canvas coordinate.
export async function renderCharacter(
  canvas: HTMLCanvasElement,
  placed: PlacedLayer[],
  opts: RenderOpts,
): Promise<void> {
  const imgs = new Map<string, HTMLImageElement>()
  await Promise.all(placed.map(async (p) => imgs.set(p.png, await loadImage(p.png))))
  // Ultimate fallback only: item has neither a body sprite nor an extracted effect.
  const back = opts.backImage ? await loadImage(opts.backImage).catch(() => null) : null
  // Item effects (망토 등): real Effect/ItemEff sprites composited around the body.
  const effs = opts.effects?.length
    ? (await Promise.all(opts.effects.map(async (e) => ({ e, img: await loadImage(e.png).catch(() => null) })))).filter((x) => x.img)
    : []

  // Image loads above are async; if a newer render started while we awaited (fast item
  // swaps), bail BEFORE touching the canvas so this stale pass can't overwrite it.
  if (opts.shouldCancel?.()) return

  const scale = Math.max(1, Math.round(opts.scale ?? 1)) // integer only
  canvas.width = opts.box.w * scale
  canvas.height = opts.box.h * scale

  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingEnabled = false
  ctx.clearRect(0, 0, canvas.width, canvas.height)

  // Horizontal centering: shift the whole character so its drawn bbox is centered in the box
  // (matches how the sprite thumbnail is centered by its own bbox). Vertical stays navel-anchored.
  let anchorX = opts.anchor.x
  if (opts.centerX && placed.length) {
    let minL = Infinity, maxR = -Infinity
    for (const p of placed) {
      const src = opts.override?.get(p.png) ?? imgs.get(p.png)
      if (!src) continue
      const w = (src as HTMLImageElement).width
      const L = opts.anchor.x + p.x
      if (L < minL) minL = L
      if (L + w > maxR) maxR = L + w
    }
    if (minL < maxR) anchorX += opts.box.w / 2 - (minL + maxR) / 2
  }

  ctx.save()
  if (opts.flip) { ctx.translate(canvas.width, 0); ctx.scale(-1, 1) } // mirror about center

  // Effect origin aligns to its chosen character reference point (ox,oy): topLeft = anchor + (ox,oy) - origin.
  const drawEffect = ({ e, img }: { e: EffectDraw; img: HTMLImageElement | null }) => {
    if (!img) return
    const dx = Math.round((anchorX + e.ox - e.origin.x) * scale)
    const dy = Math.round((opts.anchor.y + e.oy - e.origin.y) * scale)
    ctx.drawImage(img, dx, dy, img.width * scale, img.height * scale)
  }

  // effects behind the body (z < 0)
  for (const fx of effs) if (fx.e.z < 0) drawEffect(fx)

  if (back) {
    // centered horizontally on the navel, sitting around the upper body / back.
    const dx = Math.round((anchorX - back.width / 2) * scale)
    const dy = Math.round((opts.anchor.y - back.height + 6) * scale)
    ctx.drawImage(back, dx, dy, back.width * scale, back.height * scale)
  }

  for (const p of placed) {
    const src = opts.override?.get(p.png) ?? imgs.get(p.png)
    if (!src) continue
    const w = (src as HTMLImageElement).width, h = (src as HTMLImageElement).height
    const dx = Math.round((anchorX + p.x) * scale)
    const dy = Math.round((opts.anchor.y + p.y) * scale)
    ctx.drawImage(src, dx, dy, w * scale, h * scale)
  }

  // effects in front of the body (z >= 0)
  for (const fx of effs) if (fx.e.z >= 0) drawEffect(fx)
  ctx.restore()
}
