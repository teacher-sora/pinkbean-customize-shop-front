// 그림 파일(PNG)을 직접 풀어 원본 픽셀을 얻는다 — 캔버스에 그려 읽지(getImageData) 않는다. 염색(core/dye)이 쓴다.
// 왜: 캔버스에서 읽은 값은 브라우저마다 다르다. 추적 방지(Brave · 강화 모드의 Firefox · Safari 의 사생활 보호)가 읽는 값을
// 조금씩 흔들고, 반투명 픽셀은 브라우저가 알파를 곱해 두었다 되돌리며 반올림이 달라진다. 염색은 값을 정확히 비교한다
// (테두리 포함 = 순수 검정 0,0,0 만 / 17단계 그림 판별) — 흔들린 픽셀은 규칙에서 빠져 '테두리가 부분적으로만 하얗게' 됐다(건의함).
// 파일을 직접 풀면 어느 브라우저에서나 같은 값이다. 압축은 브라우저 내장(DecompressionStream)으로 푼다 — 없으면 null(캔버스로 읽는다).
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

// 그림 요소 → 원본 픽셀. 그림이 이미 받아져 있어 fetch 는 브라우저 캐시에서 나온다. 한 번 푼 것은 그림마다 기억한다.
const pixels = new WeakMap<HTMLImageElement, Uint8ClampedArray | null>()
const pending = new WeakMap<HTMLImageElement, Promise<void>>()
export function ensurePixels (img: HTMLImageElement): Promise<void> {
  if (pixels.has(img)) return Promise.resolve()
  let p = pending.get(img)
  if (!p) {
    p = fetch(img.currentSrc || img.src, { mode: 'cors', credentials: 'same-origin' })
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error('fetch'))))
      .then((b) => decodePng(new Uint8Array(b)))
      .then((d) => { pixels.set(img, d && d.w === img.naturalWidth && d.h === img.naturalHeight ? d.data : null) })
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
