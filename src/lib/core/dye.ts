// Dyeing. Two faithful modes (not a CSS hue-rotate approximation):
//  - palette (hair/eye 성형): blend two color-variant sprites per-pixel at a mix
//    ratio (in-game 혼합염색). Variants are sibling ids (color = id % 10).
//  - hsb (장착 가능 캐시 아이템): per-pixel HSV transform (hue shift, sat/bright scale).
// Results are offscreen canvases keyed/cached by signature.

// Game dye params (faithful to MapleStory). h = 색조 0..359, s = 채도, b = 명도 (both -99..+99,
// 0 = neutral), t = 색상 계열 type 0..6 (0 전체/1 빨강/2 노랑/3 초록/4 청록/5 파랑/6 자주).
export interface HsbParams { h: number; s: number; b: number; t?: number }
export interface PaletteParams { baseColor: number; mixColor: number | null; ratio: number } // ratio 0..100

import { LRU } from './lru'
const cache = new LRU<HTMLCanvasElement>(400)

function toCanvas(img: CanvasImageSource, w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = w; c.height = h
  const ctx = c.getContext('2d')!
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(img, 0, 0)
  return c
}

// ─── Faithful port of MapleStory's dye/recolor (WcR2 AvatarCommon/Prism.cs) ───────────────
// RGB↔HSL, per-color-family hue gate, exact 채도/명도 math, 16-bit color stepping(÷17), 238 cap.
interface Rgb { r: number; g: number; b: number; gap: number; min: number; max: number; gray: boolean }
interface Hsv { h: number; s: number; v: number } // v = HSL lightness

function setHsvFromRgb(rgb: Rgb, hsv: Hsv): void {
  const r = rgb.r / 255, g = rgb.g / 255, b = rgb.b / 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min
  rgb.gap = d * 255; rgb.max = max * 255; rgb.min = min * 255; rgb.gray = max === min
  hsv.v = (max + min) / 2
  hsv.s = hsv.v > 0 && hsv.v < 1 ? d / (1 - Math.abs(2 * hsv.v - 1)) : 0
  if (rgb.r === rgb.g && rgb.g === rgb.b) hsv.h = 0
  else {
    if (r === max) hsv.h = (g - b) / d
    else if (g === max) hsv.h = 2 + (b - r) / d
    else hsv.h = 4 + (r - g) / d
    hsv.h *= 60; if (hsv.h < 0) hsv.h += 360
  }
}
const customRound = (v: number, t: number) => (v - Math.floor(v) >= t ? Math.ceil(v) : Math.floor(v))
const applyStep = (v: number, step = 17, threshold = 0.985) => customRound(v / step, threshold) * step
function setRgbFromHsv(rgb: Rgb, hsv: Hsv, step: boolean, doRounding = true): void {
  let r = 0, g = 0, b = 0
  const c = (1 - Math.abs(2 * hsv.v - 1)) * hsv.s
  const x = c * (1 - Math.abs(((hsv.h / 60) % 2) - 1))
  const m = hsv.v - c / 2
  switch (Math.floor(hsv.h / 60)) {
    case 0: r = c; g = x; break
    case 1: r = x; g = c; break
    case 2: g = c; b = x; break
    case 3: g = x; b = c; break
    case 4: b = c; r = x; break
    case 5: b = x; r = c; break
  }
  if (doRounding) {
    rgb.r = applyStep((r + m) * 255, step ? 1 : 17)
    rgb.g = applyStep((g + m) * 255, step ? 1 : 17)
    rgb.b = applyStep((b + m) * 255, step ? 1 : 17)
  } else { rgb.r = (r + m) * 255; rgb.g = (g + m) * 255; rgb.b = (b + m) * 255 }
}
function calcBrightness(rgb: Rgb, brightness: number): [number, number, number] {
  const color = [rgb.r, rgb.g, rgb.b]
  const max = Math.max(...color), min = Math.min(...color)
  const gray = rgb.gray, gap = rgb.gap
  const add: [number, number, number] = [0, 0, 0]
  if (brightness < 100) {
    if (gray) return add
    const adjustedGap = (gap / rgb.max) * max
    for (let i = 0; i < 3; i++) {
      const c = color[i]
      if (c <= 0) { add[i] = -255; continue }
      add[i] = min === 0 ? (c * (brightness - 100)) / 100 : (adjustedGap * (brightness - 100)) / 100
    }
  } else {
    for (let i = 0; i < 3; i++) {
      const c = color[i]
      if (max === 255 || gray) add[i] = ((255 - c) * (brightness - 100)) / 100
      else {
        const amount = ((255 - max) * (15 - (12 * gap) / (rgb.min + gap))) / 15 + max
        add[i] = ((amount - c) * (brightness - 100)) / 100
      }
    }
  }
  return add
}
// 색상 계열(type) 별 색조 범위 안의 픽셀만 변환.
function checkColorType(type: number, hsv: Hsv): boolean {
  const hue = Math.floor(hsv.h)
  switch (type) {
    case 1: return !((hue >= 30 && hue <= 330) || hsv.s === 0) // 빨강
    case 2: return !(hue < 30 || hue > 90)   // 노랑
    case 3: return !(hue < 90 || hue > 150)  // 초록
    case 4: return !(hue < 150 || hue > 210) // 청록
    case 5: return !(hue < 210 || hue > 270) // 파랑
    case 6: return !(hue < 270 || hue > 330) // 자주
    default: return true                     // 0 전체
  }
}
const clampN = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v)

// Recolor one sprite exactly like the game. UI passes h(0..359), s/b(-99..+99), t(0..6);
// game space is saturation/brightness 1..199 (100 = neutral).
export function applyHsb(img: HTMLImageElement, p: HsbParams, key: string): HTMLCanvasElement {
  const hue = (((p.h | 0) % 360) + 360) % 360
  const saturation = 100 + p.s, brightness = 100 + p.b, type = p.t ?? 0
  const ck = `prism|${key}|${type}|${hue}|${saturation}|${brightness}`
  const hit = cache.get(ck); if (hit) return hit
  const c = toCanvas(img, img.width, img.height)
  const ctx = c.getContext('2d')!
  const valid = type >= 0 && type <= 6 && saturation >= 1 && saturation <= 199 && brightness >= 1 && brightness <= 199 &&
    !(hue === 0 && saturation === 100 && brightness === 100)
  if (!valid) { cache.set(ck, c); return c }
  const data = ctx.getImageData(0, 0, c.width, c.height)
  const a = data.data
  for (let i = 0; i < a.length; i += 4) {
    const alpha = a[i + 3]
    const rgb: Rgb = { r: a[i], g: a[i + 1], b: a[i + 2], gap: 0, min: 0, max: 0, gray: false }
    const hsv: Hsv = { h: 0, s: 0, v: 0 }
    setHsvFromRgb(rgb, hsv)
    let convert = checkColorType(type, hsv)
    if ((a[i] === 0 && a[i + 1] === 0 && a[i + 2] === 0) || (a[i] === 255 && a[i + 1] === 255 && a[i + 2] === 255) || alpha === 0) convert = false
    if (convert) {
      const not16 = a[i] % 17 !== 0 || a[i + 1] % 17 !== 0 || a[i + 2] % 17 !== 0
      if (hue > 0) { hsv.h = (hsv.h + hue) % 360; setRgbFromHsv(rgb, hsv, not16) }
      const breakUpper = [not16 || rgb.r > 238, not16 || rgb.g > 238, not16 || rgb.b > 238]
      if (saturation !== 100 && hsv.s !== 0) {
        hsv.s = saturation > 100 ? clampN(hsv.s + (saturation - 100) / 100, 0, 1) : (hsv.s * saturation) / 100
        setRgbFromHsv(rgb, hsv, false, false)
      }
      const add = brightness !== 100 ? calcBrightness(rgb, brightness) : [0, 0, 0]
      rgb.r = clampN(rgb.r + add[0], 0, breakUpper[0] ? 255 : 238)
      rgb.g = clampN(rgb.g + add[1], 0, breakUpper[1] ? 255 : 238)
      rgb.b = clampN(rgb.b + add[2], 0, breakUpper[2] ? 255 : 238)
      if (!not16) { rgb.r = applyStep(rgb.r); rgb.g = applyStep(rgb.g); rgb.b = applyStep(rgb.b) }
    }
    a[i] = rgb.r; a[i + 1] = rgb.g; a[i + 2] = rgb.b
  }
  ctx.putImageData(data, 0, 0)
  cache.set(ck, c)
  return c
}

// Blend base sprite toward mix sprite by ratio% (per-pixel lerp on RGB; alpha from base).
export function blendPalette(base: HTMLImageElement, mix: HTMLImageElement, ratio: number, key: string): HTMLCanvasElement {
  const ck = `pal|${key}|${ratio}`
  const hit = cache.get(ck); if (hit) return hit
  const w = base.width, h = base.height
  const c = toCanvas(base, w, h)
  const ctx = c.getContext('2d')!
  const bd = ctx.getImageData(0, 0, w, h)
  const mc = toCanvas(mix, w, h)
  const md = mc.getContext('2d')!.getImageData(0, 0, w, h)
  const t = Math.max(0, Math.min(100, ratio)) / 100
  const A = bd.data, B = md.data
  for (let i = 0; i < A.length; i += 4) {
    if (A[i + 3] === 0) continue
    A[i] = A[i] * (1 - t) + B[i] * t
    A[i + 1] = A[i + 1] * (1 - t) + B[i + 1] * t
    A[i + 2] = A[i + 2] * (1 - t) + B[i + 2] * t
  }
  ctx.putImageData(bd, 0, 0)
  cache.set(ck, c)
  return c
}

// Palette color encoding is slot-aware: hair encodes color in the units digit,
// face in the hundreds digit (must mirror scripts/derive.cjs).
export function colorOf(id: number, slot: string): number {
  return slot === 'face' ? Math.floor(id / 100) % 10 : id % 10
}
// id of the colorGroup sibling for a given color.
export function variantId(colorGroup: number, color: number, slot: string): string {
  if (slot === 'face') return String(Math.floor(colorGroup / 100) * 1000 + color * 100 + colorGroup % 100).padStart(8, '0')
  return String(colorGroup * 10 + color).padStart(8, '0')
}

export const PALETTE_8 = ['검정', '빨강', '주황', '노랑', '초록', '파랑', '보라', '갈색']

import type { ItemMeta } from './data'
import { getFrameLayers, type ViewOpts } from './assemble'
import { loadImage } from './render'

export interface DyeState {
  palette: Record<string, PaletteParams | undefined> // by slot (hair/face)
  hsb: Record<string, HsbParams | undefined>          // by slot (cash items)
}

const swapId = (png: string, oldId: string, newId: string) => png.replace(`sprites/${oldId}/`, `sprites/${newId}/`)

// Draw an item's OWN sprite (no body/model) recolored to a (base×mix) color combo, centered in a
// square canvas — for the dye dialog swatch grid (발색 확인용). Layers are its head-attached sprites
// (hair: hairOverHead/hair/hairBelowBody, face: face), all anchored to 'brow'; we place them in
// brow-space, z-sort, then fit-contain into `size`. base===mix (or ratio 0) = pure color.
export async function renderDyedSprite(
  canvas: HTMLCanvasElement,
  meta: ItemMeta,
  base: number,
  mix: number,
  ratio: number,
  view: ViewOpts,
  zmap: string[],
  size = 60,
  frac?: number, // 채움 비율(지정 시 분수-맞춤: 원본이 커도 넘치지 않게 축소). 미지정=기존(발색표) 동작.
): Promise<void> {
  if (meta.colorGroup == null) return
  const layers = getFrameLayers(meta, view)
  if (!layers.length) return
  const cg = meta.colorGroup, slot = meta.slot
  const useMix = mix !== base && ratio > 0
  const baseId = variantId(cg, base, slot), mixId = variantId(cg, mix, slot)
  type P = { src: CanvasImageSource; x: number; y: number; w: number; h: number; z: string }
  const placed: P[] = []
  for (const l of layers) {
    try {
      // 단색(블렌드 X)은 getImageData 불필요 → 비-CORS 로 로드해 리스트가 이미 받아둔 캐시를 재사용.
      // 블렌드할 때만 픽셀리드가 필요하므로 CORS(?cors=1)로 받는다.
      const baseImg = await loadImage(swapId(l.png, meta.id, baseId), useMix)
      const src: CanvasImageSource = useMix
        ? blendPalette(baseImg, await loadImage(swapId(l.png, meta.id, mixId), true), ratio, `${l.png}:${baseId}:${mixId}`)
        : baseImg
      const w = (src as HTMLImageElement).width, h = (src as HTMLImageElement).height
      const bx = l.map.brow?.x ?? 0, by = l.map.brow?.y ?? 0
      placed.push({ src, x: -(l.origin.x + bx), y: -(l.origin.y + by), w, h, z: l.z })
    } catch (_) {}
  }
  if (!placed.length) return
  const zi = (z: string) => { const i = zmap.indexOf(z); return i < 0 ? 9999 : i }
  placed.sort((a, b) => zi(b.z) - zi(a.z)) // 먼 레이어(zmap 큰 값) 먼저 그림
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const p of placed) { minX = Math.min(minX, p.x); minY = Math.min(minY, p.y); maxX = Math.max(maxX, p.x + p.w); maxY = Math.max(maxY, p.y + p.h) }
  const bw = maxX - minX, bh = maxY - minY
  // fit-contain(작은 성형은 최대 2배까지 확대) 후 정수로 스냅 → nearest 확대가 완벽히 선명(하드 도트).
  // size 는 셀의 디바이스 픽셀 해상도로 넘어오므로 1:1 표시와 합쳐져 CSS 재확대가 없다.
  //  - frac 미지정(발색표): 기존 로직. round 특성상 작은 캔버스에선 오버플로 가능(발색표 셀은 커서 무해).
  //  - frac 지정(코디정보): avail=size*frac 에 맞추되, 원본이 크면 분수 배율로 축소(넘침 없음, 안정적).
  let scale: number
  if (frac == null) {
    scale = Math.max(1, Math.round(Math.min(2, (size - 6) / bw, (size - 6) / bh)))
  } else {
    const avail = size * frac
    const fit = Math.min(2, avail / bw, avail / bh)
    scale = fit >= 1 ? Math.floor(fit) : fit // ≥1: 정수(선명), <1: 분수(맞춤)
  }
  canvas.width = size; canvas.height = size
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingEnabled = scale < 1 // 축소(분수)만 부드럽게, 정수 확대는 nearest(선명)
  ctx.clearRect(0, 0, size, size)
  const offX = (size - bw * scale) / 2 - minX * scale
  const offY = (size - bh * scale) / 2 - minY * scale
  for (const p of placed) ctx.drawImage(p.src, Math.round(p.x * scale + offX), Math.round(p.y * scale + offY), Math.round(p.w * scale), Math.round(p.h * scale))
}

// Build per-layer dyed source overrides (png path -> canvas) for equipped items.
export async function buildOverrides(
  metas: ItemMeta[],
  dye: DyeState,
  view: ViewOpts,
): Promise<Map<string, HTMLCanvasElement>> {
  const out = new Map<string, HTMLCanvasElement>()
  for (const meta of metas) {
    const layers = getFrameLayers(meta, view)
    if (meta.dyeMode === 'palette') {
      const p = dye.palette[meta.slot]
      if (!p || meta.colorGroup == null) continue
      const baseId = variantId(meta.colorGroup, p.baseColor, meta.slot)
      const mixId = p.mixColor != null ? variantId(meta.colorGroup, p.mixColor, meta.slot) : null
      const useMix = mixId != null && p.ratio > 0
      const sameAsEquipped = baseId === meta.id && !useMix
      if (sameAsEquipped) continue
      for (const l of layers) {
        try {
          // 단색은 비-CORS(캐시 재사용), 블렌드는 CORS(픽셀리드 필요).
          const baseImg = await loadImage(swapId(l.png, meta.id, baseId), useMix)
          if (useMix) {
            const mixImg = await loadImage(swapId(l.png, meta.id, mixId!), true)
            out.set(l.png, blendPalette(baseImg, mixImg, p.ratio, `${l.png}:${baseId}:${mixId}`))
          } else {
            out.set(l.png, toCanvas(baseImg, baseImg.width, baseImg.height))
          }
        } catch (_) {}
      }
    } else if (meta.dyeMode === 'hsb') {
      const h = dye.hsb[meta.slot]
      if (!h || (h.h === 0 && h.s === 0 && h.b === 0)) continue
      // 레이어 png 를 병렬 로드(CORS) 후 리컬러 → 순차 fetch 지연 제거.
      const loaded = await Promise.all(layers.map((l) => loadImage(l.png, true).then((img) => [l.png, img] as const).catch(() => null)))
      for (const e of loaded) { if (e) { try { out.set(e[0], applyHsb(e[1], h, e[0])) } catch (_) {} } }
    }
  }
  return out
}
