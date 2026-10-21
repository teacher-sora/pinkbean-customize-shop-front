// Dyeing. Two faithful modes (not a CSS hue-rotate approximation):
//  - palette (hair/eye 성형): blend two color-variant sprites per-pixel at a mix
//    ratio (in-game 혼합염색). Variants are sibling ids (color = id % 10).
//  - hsb (장착 가능 캐시 아이템): per-pixel HSV transform (hue shift, sat/bright scale).
// Results are offscreen canvases keyed/cached by signature.

// Game dye params (faithful to MapleStory). h = 색조 0..359, s = 채도, b = 명도 (both -99..+99,
// 0 = neutral), t = 색상 계열 type 0..6 (0 전체/1 빨강/2 노랑/3 초록/4 청록/5 파랑/6 자주).
// edge = 테두리 포함(인게임 '순수 검정 포함'). 켜면 무채색(검정 · 회색)도 색상 계열과 상관없이 바뀐다 — 무채색은 색조 · 채도가
// 없어 **명도로만, 회색으로만** 바뀐다(명도 +50 → 검정이 119 회색). 흰색은 늘 그대로다.
export interface HsbParams { h: number; s: number; b: number; t?: number; edge?: boolean }
export interface PaletteParams { baseColor: number; mixColor: number | null; ratio: number } // ratio 0..100

import { LRU } from './lru'
const cache = new LRU<HTMLCanvasElement>(400)

// read = 픽셀을 읽을 캔버스다. `willReadFrequently` 로 만들어 픽셀을 메모리에 두게 한다 — 기본(가속) 캔버스는 픽셀이 GPU 에 있어
// getImageData 한 번에 1ms 안팎이 든다(작은 스프라이트에서는 염색 연산보다 길다. 재 보니 68x81 한 장에 0.85ms → 0.02ms).
// 이 캔버스를 다른 캔버스에 그리는 시간은 가속 캔버스와 같다(재 봄). 컨텍스트는 처음 만든 설정으로 굳으므로 뒤에 읽는 쪽도 같은 설정으로 부른다.
const READ: CanvasRenderingContext2DSettings = { willReadFrequently: true }
function toCanvas(img: CanvasImageSource, w: number, h: number, read = false): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = w; c.height = h
  const ctx = c.getContext('2d', read ? READ : undefined)!
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(img, 0, 0)
  return c
}

// ─── 픽셀 연산의 WebAssembly ───────────────────────────────────────────────────────────────
// 아래 두 루프(색조 · 채도 · 명도, 믹스)를 C 로 옮긴 것(wasm/dye.c → dyeWasmBin.ts)을 메인 스레드에서 그대로 부른다.
// 같은 결과를 2.5배쯤 빨리 낸다(wasm/check.cjs 가 바이트까지 같은지 검사한다). **JS 루프가 정본이다**: WASM 이 아직 안 왔거나
// 못 쓰는 브라우저, 자리(cap)보다 큰 그림은 JS 가 맡는다 → 염색 함수는 지금처럼 바로 답하고(동기), 결과가 달라지는 일이 없다.
// 워커로 보내지 않는다: 그림이 작아 왕복이 연산보다 길다(재 보니 메인 스레드 WASM 0.03~0.26ms, 워커 0.09~0.35ms).
// 조각은 염색을 처음 쓸 때 받는다(warmDye). 첫 화면의 묶음에는 들어가지 않는다.
interface DyeWasm { memory: WebAssembly.Memory; a: number; b: number; cap: number; hsb: (p: number, len: number, hue: number, sat: number, bri: number, type: number, edge: number, fine: number) => void; blend: (a: number, b: number, len: number, ratio: number, q4: number) => void }
let wasm: DyeWasm | null = null
let wasmAsked = false
export function warmDye(): void {
  if (wasmAsked || typeof WebAssembly === 'undefined' || typeof window === 'undefined') return
  wasmAsked = true
  import('./dyeWasmBin').then(async ({ DYE_WASM }) => {
    const bytes = Uint8Array.from(atob(DYE_WASM), (ch) => ch.charCodeAt(0))
    const ex = (await WebAssembly.instantiate(bytes, {})).instance.exports as unknown as { memory: WebAssembly.Memory; slotA: () => number; slotB: () => number; cap: () => number; hsb: DyeWasm['hsb']; blend: DyeWasm['blend'] }
    wasm = { memory: ex.memory, a: ex.slotA(), b: ex.slotB(), cap: ex.cap(), hsb: ex.hsb, blend: ex.blend }
  }).catch(() => {})   // 못 받으면 JS 로 계속 간다
}

// ─── Faithful port of MapleStory's dye/recolor (seotbeo/WzComparerR2 AvatarCommon/Prism.cs, 2026-07 "v2") ───
// HSV 공간에서 색조를 돌리고 채도 · 명도를 옮긴다. 픽셀 하나씩 float(32비트)으로 계산한다 — 원본(C#)이 float 라 같은 자리에서
// 같은 값으로 잘리게 Math.fround 로 맞췄다(wasm/dye.c 도 float).
// 2026-10 사용자 지시로 넥슨 캐릭터 이미지와 픽셀로 견줘 바꿨다: 캐시 아이템 28벌 · 1만 5천여 칸에서 옛 공식(v1, HSL + 238 상한)은
// 69%, 이 공식은 89% 가 정확히 같았다(나머지는 다른 아이템에 가린 칸). 특히 명도를 낮춘 염색 · 풀컬러 그림에서 옛 공식이 틀렸다.
// 추측으로 고치지 않는다 — 원본이 바뀌면 원본을 다시 옮긴다.
const fr = Math.fround
const clampN = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v)
// 색상 계열(type) 별 색조 범위 안의 픽셀만 변환.
function checkColorType(type: number, hue: number, sat: number): boolean {
  const h = Math.floor(hue)
  switch (type) {
    case 1: return !((h >= 30 && h <= 330) || sat === 0) // 빨강
    case 2: return !(h < 30 || h > 90)   // 노랑
    case 3: return !(h < 90 || h > 150)  // 초록
    case 4: return !(h < 150 || h > 210) // 청록
    case 5: return !(h < 210 || h > 270) // 파랑
    case 6: return !(h < 270 || h > 330) // 자주
    default: return true                 // 0 전체
  }
}
// 0.985f 이상이면 올리고 아니면 내린다(원본 CustomRound — 문턱은 float 값 그대로). step 17 = 16단계 그림, 1 = 풀컬러 그림 · 이펙트.
const STEP_UP = fr(0.985)
function applyStep(v: number, step: number): number {
  const q = fr(v / step)
  return (q - Math.floor(q) >= STEP_UP ? Math.ceil(q) : Math.floor(q)) * step
}
// 16단계 그림인가(원본은 그림 전체에서 한 번 판단한다). 불투명 칸만 본다 — 반투명 칸은 캔버스의 곱한 알파를 거치며 값이 흔들린다.
function is16Image(a: Uint8ClampedArray): boolean {
  for (let i = 0; i < a.length; i += 4) if (a[i + 3] === 255 && (a[i] % 17 || a[i + 1] % 17 || a[i + 2] % 17)) return false
  return true
}

// Recolor one sprite exactly like the game. UI passes h(0..359), s/b(-99..+99), t(0..6);
// game space is saturation/brightness 1..199 (100 = neutral).
// 이펙트 그림(effects/…)은 16단계로 자르지 않는다(원본 isEffect).
export function applyHsb(img: HTMLImageElement, p: HsbParams, key: string): HTMLCanvasElement {
  const hue = (((p.h | 0) % 360) + 360) % 360
  const saturation = 100 + p.s, brightness = 100 + p.b, type = p.t ?? 0
  const edge = !!p.edge
  const ck = `prism2|${key}|${type}|${hue}|${saturation}|${brightness}|${edge ? 'e' : ''}`
  const hit = cache.get(ck); if (hit) return hit
  const c = toCanvas(img, img.width, img.height, true)
  const ctx = c.getContext('2d', READ)!
  const valid = type >= 0 && type <= 6 && saturation >= 1 && saturation <= 199 && brightness >= 1 && brightness <= 199 &&
    !(hue === 0 && saturation === 100 && brightness === 100)
  if (!valid) { cache.set(ck, c); return c }
  const data = ctx.getImageData(0, 0, c.width, c.height)
  const a = data.data
  const fine = key.includes('effects/') || !is16Image(a)   // true = 1 단위(풀컬러 · 이펙트), false = 17 단위
  warmDye()
  if (wasm && a.length <= wasm.cap) {
    const m = new Uint8Array(wasm.memory.buffer, wasm.a, a.length)
    m.set(a); wasm.hsb(wasm.a, a.length, hue, saturation, brightness, type, edge ? 1 : 0, fine ? 1 : 0); a.set(m)
  } else {
  // [hsb 루프 시작] — wasm/dye.c 의 hsb 와 같은 식이다. 고치면 그쪽도 고친다
  const st = fine ? 1 : 17
  const sk = fr((saturation - 100) / 100), bk = fr((brightness - 100) / 100)
  for (let i = 0; i < a.length; i += 4) {
    const R = a[i], G = a[i + 1], B = a[i + 2]
    if (a[i + 3] === 0 || (R === 255 && G === 255 && B === 255) || (!edge && R === 0 && G === 0 && B === 0)) continue
    const r = fr(R / 255), g = fr(G / 255), b = fr(B / 255)
    const max = Math.max(r, g, b), min = Math.min(r, g, b), d = fr(max - min)
    const v0 = max, s0 = v0 > 0 ? fr(d / v0) : 0
    let h = 0
    if (!(R === G && G === B)) {
      h = r === max ? fr(fr(g - b) / d) : g === max ? fr(2 + fr(fr(b - r) / d)) : fr(4 + fr(fr(r - g) / d))
      h = fr(h * 60); if (h < 0) h = fr(h + 360)
    }
    // 테두리 포함이면 무채색(채도 0 — 검정 · 회색)은 계열을 건너뛰고 바뀐다. 흰색은 늘 그대로.
    if (!(edge && s0 === 0) && !checkColorType(type, h, s0)) continue
    h = fr(fr(h + hue) % 360)
    let ds = 0, dv = 0
    if (saturation < 100) { ds = fr(sk * s0); dv = fr(fr(fr(sk * s0) * v0) / 2) }
    else if (s0 > 0 && v0 < 1) { ds = fr(fr(sk * fr(2 - s0)) * fr(1 - v0)); dv = fr(fr(sk * fr(1 - s0)) * v0) }
    const ts = clampN(fr(s0 + ds), 0, 1), tv = clampN(fr(v0 + dv), 0, 1)
    let ds2 = 0, dv2 = 0
    if (brightness < 100) dv2 = fr(fr(bk * s0) * tv)
    else { ds2 = fr(bk * -ts); dv2 = fr(fr(fr(bk * fr(15 - fr(12 * s0))) / 15) * fr(1 - tv)) }
    const S = clampN(fr(ts + ds2), 0, 1), V = clampN(fr(tv + dv2), 0, 1)
    const cc = fr(V * S), x = fr(cc * fr(1 - Math.abs(fr(fr(fr(h / 60) % 2) - 1)))), m = fr(V - cc)
    let rr = 0, gg = 0, bb = 0
    switch (Math.floor(h / 60)) {
      case 0: rr = cc; gg = x; break
      case 1: rr = x; gg = cc; break
      case 2: gg = cc; bb = x; break
      case 3: gg = x; bb = cc; break
      case 4: bb = cc; rr = x; break
      case 5: bb = x; rr = cc; break
    }
    a[i] = applyStep(fr(fr(rr + m) * 255), st)
    a[i + 1] = applyStep(fr(fr(gg + m) * 255), st)
    a[i + 2] = applyStep(fr(fr(bb + m) * 255), st)
  }
  // [hsb 루프 끝]
  }
  ctx.putImageData(data, 0, 0)
  cache.set(ck, c)
  return c
}

// 피부 염색 HSB — **고른 색상 계열 그대로** 건다. '전체 색상 계열'(t=0)이면 피부 전체가 바뀐다(인게임과 같다).
// 근거: 넥슨 캐릭터 이미지 38명(커스텀 피부 염색 중)과 머리 그림을 픽셀로 맞춰 봤다. 컬러라인 피부를 '전체 색상 계열'로 염색한
// 4명은 전체로 건 것이 가장 잘 맞고(예: 307칸 / 파랑만 264 / 염색 없음 244), '파란색 계열' 사람들은 파랑만 건 것이 맞는다.
// 예전에는 0 을 '고르지 않음'으로 보고 그 피부의 포인트 색 계열(shopData.skinDyeFamily)로 바꿔 걸어, 전체를 골라도 라인만 바뀌었다(건의함).
// family 는 계열 값이 아예 없는 옛 데이터에만 쓴다.
// ⚠️ 커스텀 피부는 **테두리 포함을 쓰지 않는다**. 버튼을 감추는 것만으로는 이미 저장된 값이 남아 그려질 수 있어, 피부로 가는 유일한 길목인 여기서 끈다.
export const skinHsb = (h: HsbParams, family = 5): HsbParams => ({ ...h, t: h.t ?? family, edge: false })

// Blend base sprite toward mix sprite by ratio% (alpha from base). 게임과 같은 식이다 — 넥슨 캐릭터 이미지(믹스염색 12명)와 픽셀로 맞춰 정했다:
//  · 보통 그림: 채널마다 base·(1-t) + mix·t 를 반올림.
//  · **16단계 그림**(두 장의 보이는 칸이 전부 17의 배수 = 게임 안에서 채널당 4비트로 저장된 그림. 예전 헤어 대부분):
//    4비트 값으로 섞고 **내림**한다 → 결과도 17 단위에 머문다. 이렇게 하지 않으면 그 사이 색이 나와 인게임과 미묘하게 다르다
//    (건의함 · 조용한 단발 검노 7030). 맞춘 비율: 16단계 헤어 4명에서 정확히 같은 칸 65~85%(나머지는 모자 · 얼굴에 가린 칸),
//    반올림 섞기는 3% 안팎.
export function is16Step(A: Uint8ClampedArray, B: Uint8ClampedArray): boolean {
  // 불투명 칸만 본다 — 반투명 칸은 캔버스의 곱한 알파를 거치며 17 단위에서 흔들린다(그림 형식은 불투명 칸으로 충분히 가린다).
  for (let i = 0; i < A.length; i += 4) {
    if (A[i + 3] === 255 && (A[i] % 17 || A[i + 1] % 17 || A[i + 2] % 17)) return false
    if (B[i + 3] === 255 && (B[i] % 17 || B[i + 1] % 17 || B[i + 2] % 17)) return false
  }
  return true
}
// A 를 그 자리에서 바꾼다. ratio 는 0..100 정수(믹스 색의 비율).
export function blendPixels(A: Uint8ClampedArray, B: Uint8ClampedArray, ratio: number): void {
  const r = Math.max(0, Math.min(100, Math.round(ratio)))
  const q4 = is16Step(A, B)
  warmDye()
  if (wasm && A.length <= wasm.cap) {
    const m = new Uint8Array(wasm.memory.buffer, wasm.a, A.length)
    m.set(A); new Uint8Array(wasm.memory.buffer, wasm.b, B.length).set(B)
    wasm.blend(wasm.a, wasm.b, A.length, r, q4 ? 1 : 0); A.set(m)
    return
  }
  // [blend 루프 시작] — wasm/dye.c 의 blend 와 같은 식이다. 고치면 그쪽도 고친다
  const t = r / 100
  for (let i = 0; i < A.length; i += 4) {
    if (A[i + 3] === 0) continue
    if (q4) {
      A[i] = 17 * Math.floor(((A[i] / 17) * (100 - r) + (B[i] / 17) * r) / 100)
      A[i + 1] = 17 * Math.floor(((A[i + 1] / 17) * (100 - r) + (B[i + 1] / 17) * r) / 100)
      A[i + 2] = 17 * Math.floor(((A[i + 2] / 17) * (100 - r) + (B[i + 2] / 17) * r) / 100)
    } else {
      A[i] = A[i] * (1 - t) + B[i] * t
      A[i + 1] = A[i + 1] * (1 - t) + B[i + 1] * t
      A[i + 2] = A[i + 2] * (1 - t) + B[i + 2] * t
    }
  }
  // [blend 루프 끝]
}
export function blendPalette(base: HTMLImageElement, mix: HTMLImageElement, ratio: number, key: string): HTMLCanvasElement {
  const ck = `pal|${key}|${ratio}`
  const hit = cache.get(ck); if (hit) return hit
  const w = base.width, h = base.height
  const c = toCanvas(base, w, h, true)
  const ctx = c.getContext('2d', READ)!
  const bd = ctx.getImageData(0, 0, w, h)
  const mc = toCanvas(mix, w, h, true)
  const md = mc.getContext('2d', READ)!.getImageData(0, 0, w, h)
  blendPixels(bd.data, md.data, ratio)
  ctx.putImageData(bd, 0, 0)
  cache.set(ck, c)
  return c
}

// Palette color encoding is slot-aware: hair encodes color in the units digit,
// face in the hundreds digit (must mirror parser 레포의 scripts/derive.cjs).
export function colorOf(id: number, slot: string): number {
  return slot === 'face' ? Math.floor(id / 100) % 10 : id % 10
}
// id of the colorGroup sibling for a given color.
export function variantId(colorGroup: number, color: number, slot: string): string {
  if (slot === 'face') return String(Math.floor(colorGroup / 100) * 1000 + color * 100 + colorGroup % 100).padStart(8, '0')
  return String(colorGroup * 10 + color).padStart(8, '0')
}

import type { ItemMeta, Layer } from './data'
import { frameCount, getFrameLayers, type ViewOpts } from './assemble'
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
  // 모든 레이어(및 믹스의 base/mix)를 병렬 로드 → 순차 fetch 지연 제거(발색이 즉시 보임).
  //  - 단색: 비-CORS(리스트가 받아둔 캐시 재사용). 블렌드: CORS(픽셀리드).
  const placed: P[] = (await Promise.all(layers.map(async (l): Promise<P | null> => {
    try {
      let src: CanvasImageSource
      if (useMix) {
        const [baseImg, mixImg] = await Promise.all([
          loadImage(swapId(l.png, meta.id, baseId), true),
          loadImage(swapId(l.png, meta.id, mixId), true),
        ])
        src = blendPalette(baseImg, mixImg, ratio, `${l.png}:${baseId}:${mixId}`)
      } else {
        src = await loadImage(swapId(l.png, meta.id, baseId), false)
      }
      const w = (src as HTMLImageElement).width, h = (src as HTMLImageElement).height
      const bx = l.map.brow?.x ?? 0, by = l.map.brow?.y ?? 0
      return { src, x: -(l.origin.x + bx), y: -(l.origin.y + by), w, h, z: l.z }
    } catch (_) { return null }
  }))).filter((x): x is P => x !== null)
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
    // 발색표 셀: 셀(디바이스 픽셀)을 최대한 채우는 정수 배율. 배율에 상한을 두면 고해상도 모바일(DPR≈3)
    // 셀에서 스프라이트가 작게 보인다 → 제한 없이, 반올림 배율이 셀을 넘치면 내림 배율로(넘침 없음·선명 유지).
    const pad = Math.max(6, Math.round(size * 0.06))
    const fit = Math.min((size - pad) / bw, (size - pad) / bh)
    scale = Math.max(1, Math.round(fit))
    if (scale * bw > size - pad / 2 || scale * bh > size - pad / 2) scale = Math.max(1, Math.floor(fit))
  } else {
    // 상한 없음 — "최대 2배" 같은 상한은 디바이스 픽셀 기준이라 DPR≈3 모바일에선 CSS 0.67배 수준으로 작게 보인다.
    // ≥1 이면 정수(선명): 반올림 배율이 캔버스 안에 들어가면 그걸, 넘치면 내림. <1 이면 분수(맞춤).
    const avail = size * frac
    const fit = Math.min(avail / bw, avail / bh)
    if (fit < 1) scale = fit
    else {
      scale = Math.round(fit)
      if (scale * bw > size * 0.96 || scale * bh > size * 0.96) scale = Math.max(1, Math.floor(fit))
    }
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
// allFrames: false = 지금 보이는 프레임(0)만 → 즉시 반영용. true = 이 뷰의 전 프레임 → 애니메이션 유지용.
// ⚠️ getFrameLayers(meta, view) 만 부르면 i 가 기본값 0 이다 → 프레임 0 의 png 만 override 에 들어가고,
// 액션 애니메이션의 2번째 프레임부터는 png 가 달라 override 가 없어 원본색으로 그려진다(염색이 풀려 보임).
// 이펙트/피부는 PreviewModel 이 따로 전 프레임을 칠한다.
// backFrame: 이 뷰에 **한 프레임만 뒷모습**인 게 섞여 있다(두손/한손 스윙 마무리 — assemble.isBackFrame).
// 그 프레임에선 머리 부착물이 '뒷' 스프라이트로 바뀌므로 그 png 도 함께 칠해 둬야 그 프레임에서만
// 염색이 풀려 보이지 않는다. 뒷 프레임이 없는 아이템은 빈 배열이라 비용이 없다.
// allFrames 가 숫자면 보이는 프레임(정지 그림) + 그 번호의 프레임 — 발색 드래그로 애니메이션이 그 프레임에 멈춰 있을 때(PreviewModel 1단계).
function viewLayers(meta: ItemMeta, view: ViewOpts, allFrames: boolean | number, backFrame = false): Layer[] {
  if (!allFrames && !backFrame) return getFrameLayers(meta, view)
  const seen = new Set<string>()
  const out: Layer[] = []
  const push = (ls: Layer[]) => { for (const l of ls) if (!seen.has(l.png)) { seen.add(l.png); out.push(l) } }
  if (typeof allFrames === 'number') { push(getFrameLayers(meta, view)); push(getFrameLayers(meta, view, allFrames)) }
  const n = allFrames === true ? Math.max(1, frameCount(meta, view)) : typeof allFrames === 'number' ? 0 : 1
  for (let i = 0; i < n; i++) push(getFrameLayers(meta, view, i))
  if (backFrame) push(getFrameLayers(meta, view, 0, true))
  return out
}

export async function buildOverrides(
  metas: ItemMeta[],
  dye: DyeState,
  view: ViewOpts,
  // ⚠️ 기본은 false(= 보이는 프레임만) — "안전한 기본값"이 아니라 "빠른 기본값"이 맞다.
  // 호출부 대부분(카드 썸네일·염색 다이얼로그·프리셋 카드)은 THUMB_VIEW 로 프레임 0 만 그린다.
  // 그런데 stand1 도 프레임이 여러 개(호흡)라, 기본을 true 로 두면 한 화면 18장 카드가 쓰지도 않을
  // 프레임까지 전부 리컬러하게 된다 → 순수 낭비. 전 프레임이 정말 필요한 곳(PreviewModel 2단계)만 true 를 넘긴다.
  allFrames: boolean | number = false,
  // 이 뷰에 뒷모습 프레임이 섞여 있으면 true — 그 프레임의 '뒷' 스프라이트도 함께 칠한다(viewLayers 주석).
  backFrame = false,
): Promise<Map<string, HTMLCanvasElement>> {
  const out = new Map<string, HTMLCanvasElement>()
  // 아이템(meta) 간에도 병렬 처리 → 여러 팔레트/HSB 아이템이 서로를 기다리지 않는다.
  await Promise.all(metas.map(async (meta) => {
    const layers = viewLayers(meta, view, allFrames, backFrame)
    if (meta.dyeMode === 'palette') {
      const p = dye.palette[meta.slot]
      if (!p || meta.colorGroup == null) return
      const baseId = variantId(meta.colorGroup, p.baseColor, meta.slot)
      const mixId = p.mixColor != null ? variantId(meta.colorGroup, p.mixColor, meta.slot) : null
      const useMix = mixId != null && p.ratio > 0
      const sameAsEquipped = baseId === meta.id && !useMix
      if (sameAsEquipped) return
      // 레이어(및 믹스의 base/mix 두 스프라이트)를 모두 병렬 로드 → 순차 fetch 지연 제거(헤어/성형도 즉시 발색).
      // 단색은 비-CORS(캐시 재사용), 블렌드는 CORS(픽셀리드 필요).
      await Promise.all(layers.map(async (l) => {
        try {
          if (useMix) {
            const [baseImg, mixImg] = await Promise.all([
              loadImage(swapId(l.png, meta.id, baseId), true),
              loadImage(swapId(l.png, meta.id, mixId!), true),
            ])
            out.set(l.png, blendPalette(baseImg, mixImg, p.ratio, `${l.png}:${baseId}:${mixId}`))
          } else {
            // ⚠️ 반드시 CORS(cors=true) 로 로드한다. cors=false 로 로드한 이미지를 toCanvas 로 그리면
            //    override 캔버스가 taint 되고, 그게 렌더 캔버스에 합성되면 우클릭 "이미지 복사"의 toBlob 이
            //    null 을 반환해 복사가 실패한다(색 입힌 헤어/성형/아이템이 있을 때만 재현되던 버그).
            //    loadImage(true) 는 ?cors=1 별도 캐시키를 써서 일반 렌더 캐시를 오염시키지 않는다.
            const baseImg = await loadImage(swapId(l.png, meta.id, baseId), true)
            out.set(l.png, toCanvas(baseImg, baseImg.width, baseImg.height))
          }
        } catch (_) {}
      }))
    } else if (meta.dyeMode === 'hsb') {
      const h = dye.hsb[meta.slot]
      if (!h || (h.h === 0 && h.s === 0 && h.b === 0)) return
      // 레이어 png 를 병렬 로드(CORS) 후 리컬러 → 순차 fetch 지연 제거.
      const loaded = await Promise.all(layers.map((l) => loadImage(l.png, true).then((img) => [l.png, img] as const).catch(() => null)))
      for (const e of loaded) { if (e) { try { out.set(e[0], applyHsb(e[1], h, e[0])) } catch (_) {} } }
    }
  }))
  return out
}

// 헤어/성형에 염색이 걸린 상태로 다른 아이템으로 바꿀 때, 새 아이템의 "발색 변이 스프라이트"를 클릭 즉시 프리로드해
// 두면 dyeOverrides 리컬러가 그 캐시를 곧바로 써서 발색이 더 빨리 반영된다(변이 fetch 를 렌더보다 앞당김).
export function preloadPaletteVariant(meta: ItemMeta, p: PaletteParams, view: ViewOpts): void {
  if (meta.colorGroup == null) return
  const baseId = variantId(meta.colorGroup, p.baseColor, meta.slot)
  const useMix = p.mixColor != null && p.ratio > 0
  const mixId = p.mixColor != null ? variantId(meta.colorGroup, p.mixColor, meta.slot) : null
  for (const l of getFrameLayers(meta, view)) {
    // override 로드가 항상 CORS(cors=true)이므로 프리로드도 CORS 로 맞춰 같은 캐시 엔트리를 데운다.
    loadImage(swapId(l.png, meta.id, baseId), true).catch(() => {})
    if (useMix && mixId) loadImage(swapId(l.png, meta.id, mixId), true).catch(() => {})
  }
}
