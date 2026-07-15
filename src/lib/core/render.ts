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

// cors=false(기본): 일반 렌더용. crossOrigin 없이 로드(drawImage 는 tainted 라도 OK).
// cors=true: 염색용. getImageData(픽셀리드)가 필요해 CORS 로 로드해야 하는데, Cloudflare 는 Vary:Origin 을
//   사실상 무시하고 캐시한다 → no-Origin 으로 먼저 캐시된 응답(ACAO 없음)이 crossOrigin 요청에도 서빙돼
//   CORS 에러가 난다. 그래서 CORS 용은 별도 쿼리키(?cors=1)로 분리 → 항상 Origin 과 함께 요청되어
//   ACAO 가 포함된 별도 캐시 엔트리를 쓴다(일반 렌더 캐시는 오염되지 않음).
export function loadImage(pngRel: string, cors = false): Promise<HTMLImageElement> {
  const base = spriteUrl(pngRel)
  const src = cors ? base + (base.includes('?') ? '&' : '?') + 'cors=1' : base
  let p = imageCache.get(src)
  if (!p) {
    p = new Promise((resolve, reject) => {
      const img = new Image()
      if (cors) img.crossOrigin = 'anonymous' // src 설정 전에 지정해야 적용됨
      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error(`load ${src}`))
      img.src = src
    })
    imageCache.set(src, p)
  }
  return p
}

export async function preload(pngRels: string[], cors = true): Promise<void> {
  await Promise.all(pngRels.map((r) => loadImage(r, cors).catch(() => null)))
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
  scale?: number              // canvas = box * scale. Integer (1/2/3) for crisp CSS-scaled views; a fractional
                              //   scale is allowed to render the bitmap at the target's DEVICE-pixel resolution
                              //   (thumbnails) so it displays 1:1 with no extra CSS scaling (nearest-neighbor).
  box: { w: number; h: number }      // fixed world-pixel box (canvas = box * scale)
  anchor: { x: number; y: number }   // world-pixel position of navel inside the box
  flip?: boolean                     // gaze left/right (horizontal mirror)
  override?: Map<string, HTMLCanvasElement>  // dyed source per layer png
  backImage?: string                 // sprite drawn BEHIND the body (ultimate fallback: no body & no effect)
  effects?: EffectDraw[]             // item effects (망토 등) composited around the body (each carries ox/oy)
  shouldCancel?: () => boolean       // true once a newer render superseded this one → don't paint stale content
  centerX?: boolean                  // pin the body NAVEL to a fixed box point (center X, anchor.y) in BOTH axes →
                                     //   body never moves regardless of sprite/equipment/effect size (body-based, not bbox)
  cors?: boolean                     // load sprites with CORS(?cors=1). DEFAULT true so ALL canvas renders(코디 카드·
                                     //   미리보기·다이얼로그)와 염색(픽셀리드)이 한 캐시를 공유 → 장착 시 재fetch 없음,
                                     //   염색도 재fetch 없음. (Cloudflare 는 ?cors=1 에 CORS 헤더를 주므로 모두 성공.)
}

// Draw the placed character with the navel pinned to a fixed canvas coordinate.
export async function renderCharacter(
  canvas: HTMLCanvasElement,
  placed: PlacedLayer[],
  opts: RenderOpts,
): Promise<void> {
  const cors = opts.cors ?? true // 기본 CORS → 코디 카드/미리보기/염색이 한 캐시 공유(장착·염색 재fetch 없음)
  const imgs = new Map<string, HTMLImageElement>()
  await Promise.all(placed.map(async (p) => imgs.set(p.png, await loadImage(p.png, cors))))
  // Ultimate fallback only: item has neither a body sprite nor an extracted effect.
  const back = opts.backImage ? await loadImage(opts.backImage, cors).catch(() => null) : null
  // Item effects (망토 등): real Effect/ItemEff sprites composited around the body.
  // A dyed item's effect must recolor too → prefer the dye override canvas for the frame png.
  const effs = opts.effects?.length
    ? (await Promise.all(opts.effects.map(async (e) => ({ e, img: (opts.override?.get(e.png) ?? await loadImage(e.png, cors).catch(() => null)) as CanvasImageSource | null })))).filter((x) => x.img)
    : []

  // Image loads above are async; if a newer render started while we awaited (fast item
  // swaps), bail BEFORE touching the canvas so this stale pass can't overwrite it.
  if (opts.shouldCancel?.()) return

  // 정수 배율이면 확대가 nearest 로 완벽히 선명. 카드/미리보기는 캔버스를 "디바이스 픽셀" 해상도로 맞추려고
  // 분수 배율을 넘긴다(1:1 표시 → CSS 재확대 없음, nearest). dx/dy 는 아래에서 정수 스냅한다.
  const scale = Math.max(0.01, opts.scale ?? 1)
  canvas.width = Math.round(opts.box.w * scale)
  canvas.height = Math.round(opts.box.h * scale)

  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingEnabled = false
  ctx.clearRect(0, 0, canvas.width, canvas.height)

  // 몸통 navel 을 박스의 고정점(중앙 X, anchor.y)에 X·Y 모두 핀 고정한다. 헤어/장비/무기/이펙트가 아무리
  // 커지거나 액션으로 팔·다리가 움직여도 몸통(navel)은 절대 이동하지 않는다. 확대 기준도 합성 스프라이트
  // 전체 bbox 가 아니라 항상 몸통 기준(고정 박스). 이것이 스프라이트를 제외한 모든 모델 뷰의 단일 규칙이다.
  let anchorX = opts.anchor.x, anchorY = opts.anchor.y
  if (opts.centerX && placed.length) {
    const body = placed.find((p) => p.name === 'body') || placed[0]
    const nav = body.map?.navel
    if (nav) {
      anchorX = opts.box.w / 2 - (body.x + body.origin.x + nav.x)
      anchorY = opts.anchor.y - (body.y + body.origin.y + nav.y)
    } else {
      const src = opts.override?.get(body.png) ?? imgs.get(body.png)
      if (src) anchorX += opts.box.w / 2 - (opts.anchor.x + body.x + (src as HTMLImageElement).width / 2)
    }
  }

  ctx.save()
  if (opts.flip) { ctx.translate(canvas.width, 0); ctx.scale(-1, 1) } // mirror about center

  // Effect origin aligns to its chosen character reference point (ox,oy): topLeft = anchor + (ox,oy) - origin.
  const drawEffect = ({ e, img }: { e: EffectDraw; img: CanvasImageSource | null }) => {
    if (!img) return
    const w = (img as HTMLImageElement).width, h = (img as HTMLImageElement).height
    const dx = Math.round((anchorX + e.ox - e.origin.x) * scale)
    const dy = Math.round((anchorY + e.oy - e.origin.y) * scale)
    ctx.drawImage(img, dx, dy, w * scale, h * scale)
  }

  // effects behind the body (z < 0)
  for (const fx of effs) if (fx.e.z < 0) drawEffect(fx)

  if (back) {
    // centered horizontally on the navel, sitting around the upper body / back.
    const dx = Math.round((anchorX - back.width / 2) * scale)
    const dy = Math.round((anchorY - back.height + 6) * scale)
    ctx.drawImage(back, dx, dy, back.width * scale, back.height * scale)
  }

  for (const p of placed) {
    const src = opts.override?.get(p.png) ?? imgs.get(p.png)
    if (!src) continue
    const w = (src as HTMLImageElement).width, h = (src as HTMLImageElement).height
    const dx = Math.round((anchorX + p.x) * scale)
    const dy = Math.round((anchorY + p.y) * scale)
    ctx.drawImage(src, dx, dy, w * scale, h * scale)
  }

  // effects in front of the body (z >= 0)
  for (const fx of effs) if (fx.e.z >= 0) drawEffect(fx)
  ctx.restore()
}
