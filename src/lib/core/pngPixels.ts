// 그림 파일(PNG)을 직접 풀어 원본 픽셀을 얻는다 — 캔버스 읽기(getImageData)를 **믿을 수 없는 브라우저에서만** 쓴다(core/dye).
// 왜: 추적 방지(Brave · 강화 모드의 Firefox · Safari 의 사생활 보호)는 캔버스에서 읽는 값을 조금씩 흔든다. 염색은 값을 정확히 비교한다
// (테두리 포함 = 순수 검정 0,0,0 만 / 17단계 그림 판별) — 흔들린 픽셀은 규칙에서 빠져 '테두리가 부분적으로만 하얗게' 됐다(건의함).
// 보통 브라우저는 읽기가 정확하므로 예전 그대로(캔버스 읽기 — 추가로 받는 것도 기다리는 것도 없다). 흔드는 브라우저는 그림을 받을 때
// 바이트를 함께 쥐고(render.loadImage — 받는 횟수는 같다) 한가할 때 미리 푼다. 캐시에서 다시 받는 길은 환경마다 흔들려(헤드리스 크롬에서
// 캐시 적중에도 장당 80ms 안팎) 바이트가 없을 때만 쓴다.
// 압축은 브라우저 내장(DecompressionStream)으로 푼다 — 없으면 null(캔버스로 읽는다).
const SIG = [137, 80, 78, 71, 13, 10, 26, 10]

async function inflate (data: Uint8Array): Promise<Uint8Array> {
  const ds = new DecompressionStream('deflate')
  const buf = await new Response(new Blob([data as BlobPart]).stream().pipeThrough(ds)).arrayBuffer()
  return new Uint8Array(buf)
}

// RGBA 8비트로 푼 픽셀(길이 w*h*4). 지원하지 않는 형식(인터레이스 · 16비트)이면 null.
export async function decodePng (bytes: Uint8Array): Promise<{ w: number; h: number; data: Uint8ClampedArray } | null> {
  if (typeof DecompressionStream === 'undefined' || bytes.length < 33 || SIG.some((v, i) => bytes[i] !== v)) return null
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let w = 0, h = 0, depth = 0, type = 0, interlace = 0
  let plte: Uint8Array | null = null, trns: Uint8Array | null = null
  const idat: Uint8Array[] = []
  for (let o = 8; o + 8 <= bytes.length;) {
    const len = dv.getUint32(o), name = String.fromCharCode(bytes[o + 4], bytes[o + 5], bytes[o + 6], bytes[o + 7])
    const body = bytes.subarray(o + 8, o + 8 + len)
    if (name === 'IHDR') { w = dv.getUint32(o + 8); h = dv.getUint32(o + 12); depth = body[8]; type = body[9]; interlace = body[12] }
    else if (name === 'PLTE') plte = body
    else if (name === 'tRNS') trns = body
    else if (name === 'IDAT') idat.push(body)
    else if (name === 'IEND') break
    o += 12 + len
  }
  if (!w || !h || interlace || depth === 16) return null
  const ch = type === 6 ? 4 : type === 2 ? 3 : type === 4 ? 2 : 1 // 3(팔레트) · 0(회색)은 한 칸
  const bpp = Math.max(1, (ch * depth) >> 3)                       // 필터가 쓰는 한 픽셀 바이트 수
  const stride = Math.ceil((w * ch * depth) / 8)
  let total = 0; for (const p of idat) total += p.length
  const z = new Uint8Array(total); let k = 0; for (const p of idat) { z.set(p, k); k += p.length }
  const raw = await inflate(z)
  if (raw.length < h * (stride + 1)) return null
  // 줄마다 필터를 되돌린다(None · Sub · Up · Average · Paeth).
  const px = new Uint8Array(h * stride)
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], src = y * (stride + 1) + 1, dst = y * stride, up = dst - stride
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? px[dst + x - bpp] : 0, b = y ? px[up + x] : 0, c = y && x >= bpp ? px[up + x - bpp] : 0
      let v = raw[src + x]
      if (f === 1) v += a
      else if (f === 2) v += b
      else if (f === 3) v += (a + b) >> 1
      else if (f === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c }
      px[dst + x] = v
    }
  }
  const out = new Uint8ClampedArray(w * h * 4)
  const sample = (row: number, i: number) => {
    if (depth === 8) return px[row + i]
    const bit = i * depth, byte = px[row + (bit >> 3)]
    return (byte >> (8 - depth - (bit & 7))) & ((1 << depth) - 1)
  }
  for (let y = 0; y < h; y++) {
    const row = y * stride
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4
      if (type === 6) { const s = row + x * 4; out[o] = px[s]; out[o + 1] = px[s + 1]; out[o + 2] = px[s + 2]; out[o + 3] = px[s + 3] }
      else if (type === 2) { const s = row + x * 3; out[o] = px[s]; out[o + 1] = px[s + 1]; out[o + 2] = px[s + 2]; out[o + 3] = trns && trns.length >= 6 && px[s] === trns[1] && px[s + 1] === trns[3] && px[s + 2] === trns[5] ? 0 : 255 }
      else if (type === 3) { const i = sample(row, x); if (!plte) return null; out[o] = plte[i * 3]; out[o + 1] = plte[i * 3 + 1]; out[o + 2] = plte[i * 3 + 2]; out[o + 3] = trns && i < trns.length ? trns[i] : 255 }
      else if (type === 4) { const s = row + x * 2; out[o] = out[o + 1] = out[o + 2] = px[s]; out[o + 3] = px[s + 1] }
      else { const v = sample(row, x) * (255 / ((1 << depth) - 1)); out[o] = out[o + 1] = out[o + 2] = v; out[o + 3] = trns && trns.length >= 2 && sample(row, x) === ((trns[0] << 8) | trns[1]) ? 0 : 255 }
    }
  }
  return { w, h, data: out }
}

// 캔버스 읽기가 정확한가 — 정해 둔 무늬(순수 검정 · 흰색 · 여러 색, 불투명)를 그려 읽어 한 칸이라도 다르면 흔드는 브라우저다.
// 처음 한 번만 잰다(0.1ms 안팎). Brave 는 이름으로도 안다(navigator.brave).
let readOk: boolean | null = null
export function canvasReadExact (): boolean {
  if (readOk !== null) return readOk
  try {
    if ((navigator as unknown as { brave?: unknown }).brave) return (readOk = false)
    const W = 32, src = new Uint8ClampedArray(W * W * 4)
    for (let i = 0; i < W * W; i++) { const v = (i * 37) % 256; src[i * 4] = i % 3 ? v : 0; src[i * 4 + 1] = i % 5 ? 255 - v : 0; src[i * 4 + 2] = i % 7 ? (v * 3) % 256 : 0; src[i * 4 + 3] = 255 }
    const c = document.createElement('canvas'); c.width = c.height = W
    const g = c.getContext('2d', { willReadFrequently: true })!
    g.putImageData(new ImageData(src, W, W), 0, 0)
    const back = g.getImageData(0, 0, W, W).data
    readOk = true
    for (let i = 0; i < back.length; i++) if (back[i] !== src[i]) { readOk = false; break }
  } catch { readOk = false }
  return readOk
}

// 그림 요소 → 원본 픽셀. 한 번 푼 것은 그림마다 기억한다.
// 흔드는 브라우저에서는 loadImage 가 그림을 받을 때 파일 바이트를 함께 쥐어 둔다(rememberBytes) — 다시 받지 않는다.
// 쥔 바이트는 한가할 때 미리 푼다(requestIdleCallback, 한 번에 시간이 남는 만큼만) — 장착 · 염색 적용 · 광장과 프리셋 카드에서
// 염색할 때는 이미 풀려 있어 기다리지 않는다. 바이트가 없는 그림(드물다)만 캐시에서 다시 받는다.
const pixels = new WeakMap<HTMLImageElement, Uint8ClampedArray | null>()
const pending = new WeakMap<HTMLImageElement, Promise<void>>()
const bytesOf = new WeakMap<HTMLImageElement, Uint8Array>()
const idle: HTMLImageElement[] = []
let idleOn = false
type Ric = (cb: (d: { timeRemaining: () => number }) => void, o?: { timeout: number }) => number
function pump () {
  if (idleOn || !idle.length) return
  idleOn = true
  const ric = (window as unknown as { requestIdleCallback?: Ric }).requestIdleCallback
  const run = async (d?: { timeRemaining: () => number }) => {
    // 한가한 시간이 남는 동안 몇 장씩 푼다(한 장 0.3ms 안팎). 한가한 때가 오지 않아도 2초 안에는 돈다.
    while (idle.length && (!d || d.timeRemaining() > 4)) {
      const batch = idle.splice(0, 8)
      await Promise.all(batch.map((img) => ensurePixels(img)))
      if (!d) break
    }
    idleOn = false
    if (idle.length) pump()
  }
  if (ric) ric((d) => { void run(d) }, { timeout: 2000 }); else setTimeout(() => { void run() }, 16)
}
export function rememberBytes (img: HTMLImageElement, bytes: Uint8Array): void {
  bytesOf.set(img, bytes)
  idle.push(img)
  pump()
}
export function ensurePixels (img: HTMLImageElement): Promise<void> {
  if (pixels.has(img)) return Promise.resolve()
  let p = pending.get(img)
  if (!p) {
    const held = bytesOf.get(img)
    const bytes = held ? Promise.resolve(held) : fetch(img.currentSrc || img.src, { mode: 'cors', credentials: 'same-origin' })
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error('fetch')))).then((b) => new Uint8Array(b))
    p = bytes
      .then((b) => decodePng(b))
      .then((d) => { pixels.set(img, d && d.w === img.naturalWidth && d.h === img.naturalHeight ? d.data : null); bytesOf.delete(img) })
      .catch(() => { pixels.set(img, null) })
    pending.set(img, p)
  }
  return p
}
// 풀어 둔 원본 픽셀(복사본). 아직 없거나 풀지 못한 형식이면 null — 부르는 쪽이 캔버스로 읽는다.
export function exactPixels (img: HTMLImageElement): Uint8ClampedArray | null {
  const d = pixels.get(img)
  return d ? new Uint8ClampedArray(d) : null
}
