// Canvas compositing for assembled characters. Pure client-side; once sprites
// are preloaded, rendering (main canvas + every thumbnail) does zero network IO.
//
// The character is NOT bbox-centered. Instead the body navel
// (world 0,0) is nailed to a FIXED canvas coordinate inside a fixed world box,
// so the body never shifts when hair/hats/weapons change extent. All scaling is
// integer (x1/x2/x3) with smoothing off and integer pixel snapping -> crisp dots.
import { drawChat, prepareChat, type ChatDraw } from './chatUi'
import { drawParticles, type ParticleDraw } from './particle'
import { spriteUrl, type EffectGroup, type EffectMeta, type Vec } from './data'
import type { PlacedLayer } from './assemble'
import { LRU } from './lru'
import { canvasReadExact, rememberBytes } from './pngPixels'

const imageCache = new LRU<Promise<HTMLImageElement>>(1200)

// cors=false(기본): 일반 렌더용. crossOrigin 없이 로드(drawImage 는 tainted 라도 OK).
// cors=true: 염색용. getImageData(픽셀리드)가 필요해 CORS 로 로드해야 하는데, Cloudflare 는 Vary:Origin 을
//   사실상 무시하고 캐시한다 → no-Origin 으로 먼저 캐시된 응답(ACAO 없음)이 crossOrigin 요청에도 서빙돼
//   CORS 에러가 난다. 그래서 CORS 용은 별도 쿼리키(?cors=1)로 분리 → 항상 Origin 과 함께 요청되어
//   ACAO 가 포함된 별도 캐시 엔트리를 쓴다(일반 렌더 캐시는 오염되지 않음).
export function loadImage(pngRel: string, cors = false): Promise<HTMLImageElement> {
  if (!pngRel) return Promise.reject(new Error('no png')) // 일루전 표지 레이어(png '')는 받을 그림이 없다
  const base = spriteUrl(pngRel)
  const src = cors ? base + (base.includes('?') ? '&' : '?') + 'cors=1' : base
  let p = imageCache.get(src)
  if (!p) {
    const plain = () => new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image()
      if (cors) img.crossOrigin = 'anonymous' // src 설정 전에 지정해야 적용됨
      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error(`load ${src}`))
      img.src = src
    })
    // 캔버스 읽기를 흔드는 브라우저(core/pngPixels)는 파일을 받아 바이트를 쥔 채 그 바이트로 그림을 만든다 — 염색이 쓸 원본 픽셀을
    // 다시 받지 않고 한가할 때 풀어 둔다. 받는 횟수는 같고, 그림은 같은 출처(blob)라 캔버스가 더럽혀지지 않는다. 보통 브라우저는 예전 그대로.
    const held = () => fetch(src, { mode: 'cors', credentials: 'same-origin' })
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(`load ${src}`))))
      .then((buf) => new Promise<HTMLImageElement>((resolve, reject) => {
        const bytes = new Uint8Array(buf), url = URL.createObjectURL(new Blob([bytes], { type: 'image/png' }))
        const img = new Image()
        img.onload = () => { URL.revokeObjectURL(url); rememberBytes(img, bytes); resolve(img) }
        img.onerror = () => { URL.revokeObjectURL(url); reject(new Error(`load ${src}`)) }
        img.src = url
      }))
    const once = cors && !canvasReadExact() ? held : plain
    // 한 번 실패하면 잠깐 뒤 한 번 더 받는다. 그래도 실패하면 캐시에서 뺀다 — 실패한 Promise 를 캐시에 남기면
    // 순간적인 네트워크 끊김 한 번으로 그 그림이 든 코디가 새로고침 전까지 계속 빈 칸이 됐다(닉네임 불러오기의 빈 '기본' 카드).
    const made: Promise<HTMLImageElement> = once()
      .catch(() => new Promise((r) => setTimeout(r, 400)).then(once))
      .catch((e) => { if (imageCache.peek(src) === made) imageCache.delete(src); throw e })
    p = made
    imageCache.set(src, p)
  }
  return p
}

// A single item-effect frame to composite (representative static frame). `z < 0` draws
// behind the body, `z >= 0` in front. The effect's `origin` is aligned to a character
// reference point (ox, oy) in world coords (navel = 0,0): topLeft = anchor + (ox,oy) - origin.
export interface EffectDraw { png: string; origin: { x: number; y: number }; z: number; ox: number; oy: number }

// Character reference points an effect can attach to (world coords; navel = (0,0)).
// foot = body sprite origin (-navel); brow = resolved head brow anchor.
export interface EffectAnchors { foot: Vec; brow: Vec; navel?: Vec }

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
// 캐시 이펙트(이펙트 부위)는 pos 4 도 쓴다 — 허리(배꼽)에 붙는다(호영 꼬리). pos 3 은 발과 같다(땅 위 동반자).
function groupDraw(g: EffectGroup | undefined, anchors: EffectAnchors, elapsed: number): EffectDraw | null {
  if (!g || !g.frames.length) return null
  // animate: pick the frame for the current time (single frame → static rep frame).
  const idx = g.frames.length > 1 ? frameAtElapsed(g.frames.map((f) => f.delay), elapsed) : g.repFrame
  const fr = g.frames[idx] || g.frames[g.repFrame] || g.frames[0]
  const pt = g.pos === 1 ? anchors.brow : g.pos === 4 ? (anchors.navel ?? { x: 0, y: 0 }) : anchors.foot
  return { png: fr.png, origin: fr.origin, z: fr.z ?? g.z, ox: pt.x, oy: pt.y }
}
// 이펙트의 모든 묶음(두 번째 층 extra 까지) — 그림을 미리 받거나 염색할 때 빠뜨리지 않게 한 곳에서 모은다.
// extra 를 빠뜨리면 미리보기가 그 그림을 기다리느라 첫 프레임에 멈췄다(체인지 버닝: 루시드 이펙트).
export function effectGroups(meta: EffectMeta | null | undefined): EffectGroup[] {
  if (!meta) return []
  return [...Object.values(meta.groups), ...effectGroups(meta.extra)]
}
export function effectDraws(meta: EffectMeta | null | undefined, action: string, anchors: EffectAnchors, elapsed = 0): EffectDraw[] {
  if (!meta) return []
  const out: EffectDraw[] = []
  if (meta.cycle?.groups.length) {
    // 묶음을 차례로 돌린다(사원증 카드). 정지 화면(elapsed 0)은 첫 묶음.
    const k = Math.floor(Math.max(0, elapsed) / meta.cycle.ms) % meta.cycle.groups.length
    const d = groupDraw(meta.groups[meta.cycle.groups[k]], anchors, elapsed); if (d) out.push(d)
  } else if (meta.trail?.length) {
    // 따라다니는 겹들 — 멈춰 서 있으면 모두 캐릭터 자리로 모인다.
    for (const key of meta.trail) { const d = groupDraw(meta.groups[key], anchors, elapsed); if (d) out.push(d) }
  } else {
    const d = groupDraw(meta.groups[action] || meta.groups['default'] || meta.groups[meta.repGroup], anchors, elapsed); if (d) out.push(d)
  }
  if (meta.extra) out.push(...effectDraws(meta.extra, action, anchors, elapsed))
  return out
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
  particles?: ParticleDraw[]         // 파티클(제네시스 무기 등) — 입자는 sim 이 들고, 그림은 desc.tex.png. z 음수 = 캐릭터 뒤
  chat?: ChatDraw                    // 명찰 · 말풍선(dev 전용, core/chatUi) — 모든 것 위에, 시선과 무관하게 뒤집지 않고 그린다
  shouldCancel?: () => boolean       // true once a newer render superseded this one → don't paint stale content
  centerX?: boolean                  // pin the body NAVEL to a fixed box point (center X, anchor.y) in BOTH axes →
                                     //   body never moves regardless of sprite/equipment/effect size (body-based, not bbox)
  centerXOnly?: boolean              // 가로(X)만 body navel 로 동적 중앙정렬, 세로(Y)는 anchor.y 그대로 → navel 이
                                     //   프레임마다 상하로 "드리프트"할 수 있다(전투대기 등에서 다리 고정·상체 상하 모션 유지).
                                     //   라이딩처럼 포즈별 가로 폭이 달라 X 정렬은 필요하지만 Y 는 애니메이션대로 둬야 할 때.
  centerMount?: boolean              // 캐릭터가 아니라 "마운트(mount* 레이어)"의 실제 스프라이트 bbox 가로중심을 캔버스
                                     //   중앙에 둔다(메탈아머처럼 메카가 주 비주얼일 때 — 조종사 중앙정렬하면 메카가 치우침).
  cors?: boolean                     // load sprites with CORS(?cors=1). DEFAULT true so ALL canvas renders(코디 카드·
                                     //   미리보기·다이얼로그)와 염색(픽셀리드)이 한 캐시를 공유 → 장착 시 재fetch 없음,
                                     //   염색도 재fetch 없음. (Cloudflare 는 ?cors=1 에 CORS 헤더를 주므로 모두 성공.)
}

// 그림의 맨 아래 불투명 줄(0부터, 비었으면 -1). 그림마다 한 번만 잰다. 픽셀을 못 읽으면(taint) 그림 높이로 본다.
const bottomCache = new WeakMap<object, number>()
function opaqueBottom (src: HTMLImageElement | HTMLCanvasElement): number {
  const hit = bottomCache.get(src)
  if (hit !== undefined) return hit
  let b = src.height - 1
  try {
    const c = document.createElement('canvas')
    c.width = src.width; c.height = src.height
    const g = c.getContext('2d', { willReadFrequently: true })!
    g.drawImage(src, 0, 0)
    const d = g.getImageData(0, 0, c.width, c.height).data
    b = -1
    for (let y = c.height - 1; y >= 0 && b < 0; y--) {
      // 진한 칸(알파 200 이상)만 본다 — 별빛 걸음처럼 발밑에 옅은 빛이 번진 신발은 그 빛이 복제에서 3배로 더 내려가 복제의 발이 떴다.
      for (let x = 0; x < c.width; x++) if (d[(y * c.width + x) * 4 + 3] >= 200) { b = y; break }
    }
  } catch { /* 그림 높이 그대로 */ }
  bottomCache.set(src, b)
  return b
}

// Draw the placed character with the navel pinned to a fixed canvas coordinate.
export async function renderCharacter(
  canvas: HTMLCanvasElement,
  placed: PlacedLayer[],
  opts: RenderOpts,
): Promise<void> {
  const cors = opts.cors ?? true // 기본 CORS → 코디 카드/미리보기/염색이 한 캐시 공유(장착·염색 재fetch 없음)
  const imgs = new Map<string, HTMLImageElement>()
  // 레이어 그림 하나를 못 받았다고 캐릭터 전체를 비우지 않는다 — 그 레이어만 빠진다(아래 그리기가 없는 것을 건너뛴다).
  await Promise.all(placed.map(async (p) => { const img = await loadImage(p.png, cors).catch(() => null); if (img) imgs.set(p.png, img) }))
  // Ultimate fallback only: item has neither a body sprite nor an extracted effect.
  const back = opts.backImage ? await loadImage(opts.backImage, cors).catch(() => null) : null
  // Item effects (망토 등): real Effect/ItemEff sprites composited around the body.
  // A dyed item's effect must recolor too → prefer the dye override canvas for the frame png.
  const effs = opts.effects?.length
    ? (await Promise.all(opts.effects.map(async (e) => ({ e, img: (opts.override?.get(e.png) ?? await loadImage(e.png, cors).catch(() => null)) as CanvasImageSource | null })))).filter((x) => x.img)
    : []
  const parts = opts.particles?.length
    ? (await Promise.all(opts.particles.map(async (p) => ({ p, img: await loadImage(p.sim.desc.tex.png, cors).catch(() => null) })))).filter((x) => x.img)
    : []
  // 이펙트끼리는 z 순서로 쌓는다(작을수록 뒤) — 캐시 이펙트는 원본 z 를 그대로 쓴다(parser cashfx-build.layer_z). 같은 z 는 들어온 순서.
  effs.sort((a, b) => a.e.z - b.e.z)

  // Image loads above are async; if a newer render started while we awaited (fast item
  // swaps), bail BEFORE touching the canvas so this stale pass can't overwrite it.
  const chat = await prepareChat(opts.chat).catch(() => [])
  if (opts.shouldCancel?.()) return

  // 정수 배율이면 확대가 nearest 로 완벽히 선명. 카드/미리보기는 캔버스를 "디바이스 픽셀" 해상도로 맞추려고
  // 분수 배율을 넘긴다(1:1 표시 → CSS 재확대 없음, nearest). dx/dy 는 아래에서 정수 스냅한다.
  const scale = Math.max(0.01, opts.scale ?? 1)
  // 크기가 같으면 재할당하지 않는다 — width 대입은 같은 값이어도 비트맵을 새로 잡아(GPU 캔버스 재할당) 애니메이션·
  // 착용 변경 중 한 프레임 비거나 세로줄이 찢겨 보였다. 같은 크기면 clearRect 만으로 충분.
  const cw = Math.round(opts.box.w * scale), ch = Math.round(opts.box.h * scale)
  if (canvas.width !== cw) canvas.width = cw
  if (canvas.height !== ch) canvas.height = ch

  const ctx = canvas.getContext('2d')!
  ctx.setTransform(1, 0, 0, 1, 0, 0) // 재할당을 건너뛰므로 이전 상태가 남지 않게 초기화
  ctx.imageSmoothingEnabled = false
  ctx.clearRect(0, 0, canvas.width, canvas.height)

  // 몸통 navel 을 박스의 고정점(중앙 X, anchor.y)에 X·Y 모두 핀 고정한다. 헤어/장비/무기/이펙트가 아무리
  // 커지거나 액션으로 팔·다리가 움직여도 몸통(navel)은 절대 이동하지 않는다. 확대 기준도 합성 스프라이트
  // 전체 bbox 가 아니라 항상 몸통 기준(고정 박스). 이것이 스프라이트를 제외한 모든 모델 뷰의 단일 규칙이다.
  let anchorX = opts.anchor.x, anchorY = opts.anchor.y
  if (opts.centerMount && placed.length) {
    // 마운트(mount* 레이어)의 실제 스프라이트 가로 bbox 중심을 캔버스 중앙에. 스프라이트 폭은 로드된 이미지에서.
    let minX = Infinity, maxX = -Infinity
    for (const p of placed) {
      if (!p.name.startsWith('mount') || p.slot === 'clone') continue
      const src = opts.override?.get(p.png) ?? imgs.get(p.png)
      const w = (src as HTMLImageElement | HTMLCanvasElement | undefined)?.width ?? 0
      if (p.x < minX) minX = p.x
      if (p.x + w > maxX) maxX = p.x + w
    }
    if (minX < maxX) anchorX = opts.box.w / 2 - (minX + maxX) / 2
  } else if ((opts.centerX || opts.centerXOnly) && placed.length) {
    // 내 뒤에 나의 복제(slot 'clone')는 몸이 아니다. 일루전으로 키운 몸은 배율(k)만큼 navel 도 멀어진다.
    const body = placed.find((p) => p.slot === 'body' && p.name === 'body') || placed.find((p) => p.name === 'body' && p.slot !== 'clone') || placed[0]
    const nav = body.map?.navel
    const k = body.scale ?? 1
    if (nav) {
      anchorX = opts.box.w / 2 - (body.x + (body.origin.x + nav.x) * k)
      // Y 핀은 centerX 만. centerXOnly 는 anchor.y 유지 → navel 이 프레임마다 상하 드리프트(상체 상하 모션, 다리 고정).
      if (opts.centerX) anchorY = opts.anchor.y - (body.y + (body.origin.y + nav.y) * k)
    } else {
      const src = opts.override?.get(body.png) ?? imgs.get(body.png)
      if (src) anchorX += opts.box.w / 2 - (opts.anchor.x + body.x + (src as HTMLImageElement).width * k / 2)
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

  const drawPart = ({ p, img }: { p: ParticleDraw; img: HTMLImageElement | null }) => {
    if (img) drawParticles(ctx, p.sim, img, (anchorX + p.ox) * scale, (anchorY + p.oy) * scale, scale)
  }
  // 파티클은 그 z 의 이펙트보다 먼저(더 뒤에) 깐다 — 제네시스의 파장은 캐릭터 · 망토 이펙트 뒤다.
  for (const x of parts) if (x.p.z < 0) drawPart(x)

  // effects behind the body (z < 0)
  for (const fx of effs) if (fx.e.z < 0) drawEffect(fx)

  // 내 뒤에 나: 복제(slot 'clone')의 발 맨 아래 픽셀을 본체의 발 맨 아래 픽셀과 같은 줄에 세운다(사용자 지시 — 모든 경우, 게임과 같다).
  // assemble 은 발(몸 그림의 origin)을 기준으로 키우므로, 발보다 아래로 내려온 픽셀(신발 · 옷자락 · 탈것)은 복제에서 배율만큼 더
  // 내려간다 — 거대한 몸은 그 부분이 이미 3배라 크게 어긋났다. 그림 크기를 아는 여기서 그 차이만큼 복제를 올린다.
  // 견주는 것은 **땅에 닿는 것**(몸 · 신발, 탈것을 탔으면 탈것, 변신이면 변신 그림)만이다 — 모든 레이어의 맨 아래를 견주면 발보다 아래로
  // 내려온 무기 · 망토 · 긴 머리를 맞추게 되어, 그것이 3배로 더 내려간 복제의 발이 위로 떴다.
  let cloneDy = 0
  if (placed.some((p) => p.slot === 'clone')) {
    const ground = (slot: string | undefined, name: string) => slot === 'body' || slot === 'shoes' || slot === 'ring' || (slot === 'riding' && name.startsWith('mount'))
    const hasGround = placed.some((p) => p.slot !== 'clone' && ground(p.slot, p.name))
    let self = -Infinity, twin = -Infinity
    for (const p of placed) {
      if (hasGround && !ground(p.slot === 'clone' ? p.twinOf : p.slot, p.name)) continue
      const src = opts.override?.get(p.png) ?? imgs.get(p.png)
      if (!src) continue
      const ob = opaqueBottom(src)
      if (ob < 0) continue
      const y = p.y + (ob + 1) * (p.scale ?? 1)
      if (p.slot === 'clone') twin = Math.max(twin, y)
      else self = Math.max(self, y)
    }
    if (Number.isFinite(self) && Number.isFinite(twin)) cloneDy = self - twin
  }

  if (back) {
    // centered horizontally on the navel, sitting around the upper body / back.
    const dx = Math.round((anchorX - back.width / 2) * scale)
    const dy = Math.round((anchorY - back.height + 6) * scale)
    ctx.drawImage(back, dx, dy, back.width * scale, back.height * scale)
  }

  for (const p of placed) {
    const src = opts.override?.get(p.png) ?? imgs.get(p.png)
    if (!src) continue
    const k = p.scale ?? 1 // 일루전으로 키운 레이어(assemble.applyIllusion)
    const w = (src as HTMLImageElement).width * k, h = (src as HTMLImageElement).height * k
    const dx = Math.round((anchorX + p.x) * scale)
    const dy = Math.round((anchorY + p.y + (p.slot === 'clone' ? cloneDy : 0)) * scale)
    ctx.drawImage(src, dx, dy, w * scale, h * scale)
  }

  // effects in front of the body (z >= 0)
  for (const fx of effs) if (fx.e.z >= 0) drawEffect(fx)
  for (const x of parts) if (x.p.z >= 0) drawPart(x)
  ctx.restore()
  drawChat(ctx, chat, placed, { anchorX, anchorY, scale, flip: opts.flip, width: canvas.width })
}
