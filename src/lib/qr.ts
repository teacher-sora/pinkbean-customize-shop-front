// QR 코드 만들기(바이트 모드, 버전 1~10, 오류 복원 L · M · Q · H) — 코디 프로필 카드의 불러오기 QR(lib/profileCard).
// 라이브러리를 들이지 않고 직접 만든다(사용자 지시 — 자체 QR). 규칙은 ISO/IEC 18004 그대로이고, 그리는 모양(둥근 점 · 둥근 눈)은
// 그리는 쪽이 정한다 — 여기서는 칸이 검은지(dark)와 그 칸이 기능 칸(눈 · 시간 줄 · 정렬 · 형식)인지(fn)만 낸다.
// 공유 링크(https://pinkbean-customize.com/?c=PB-xxxxxxxx, 45바이트)는 Q 에서 버전 4(33 × 33)에 든다.

export type QrEcl = 'L' | 'M' | 'Q' | 'H'
export type Qr = { size: number; dark: boolean[][]; fn: boolean[][]; version: number }

// 버전 1~10 의 블록당 오류 정정 코드어 수와 블록 수(표준 표 — 0번은 비움)
const ECC_PER_BLOCK: Record<QrEcl, number[]> = {
  L: [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18],
  M: [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26],
  Q: [-1, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24],
  H: [-1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28],
}
const BLOCKS: Record<QrEcl, number[]> = {
  L: [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4],
  M: [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5],
  Q: [-1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8],
  H: [-1, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8],
}
const FORMAT_ECL: Record<QrEcl, number> = { L: 1, M: 0, Q: 3, H: 2 }
const MAX_VER = 10

// 데이터 칸 수(기능 칸을 뺀 나머지)
function rawModules (ver: number): number {
  let r = (16 * ver + 128) * ver + 64
  if (ver >= 2) { const n = Math.floor(ver / 7) + 2; r -= (25 * n - 10) * n - 55; if (ver >= 7) r -= 36 }
  return r
}
const dataCodewords = (ver: number, e: QrEcl) => Math.floor(rawModules(ver) / 8) - ECC_PER_BLOCK[e][ver] * BLOCKS[e][ver]

// GF(256) 곱셈과 리드-솔로몬 나머지
function gfMul (x: number, y: number): number {
  let z = 0
  for (let i = 7; i >= 0; i--) { z = (z << 1) ^ ((z >>> 7) * 0x11d); z ^= ((y >>> i) & 1) * x }
  return z & 0xff
}
function rsDivisor (deg: number): number[] {
  const r = new Array(deg).fill(0); r[deg - 1] = 1
  let root = 1
  for (let i = 0; i < deg; i++) {
    for (let j = 0; j < deg; j++) { r[j] = gfMul(r[j], root); if (j + 1 < deg) r[j] ^= r[j + 1] }
    root = gfMul(root, 2)
  }
  return r
}
function rsRemainder (data: number[], div: number[]): number[] {
  const r = new Array(div.length).fill(0)
  for (const b of data) {
    const f = b ^ (r.shift() as number); r.push(0)
    div.forEach((c, i) => { r[i] ^= gfMul(c, f) })
  }
  return r
}

// 글 → 코드어(모드 · 길이 · 데이터 · 끝 · 채움) → 블록마다 오류 정정 → 섞기
function codewords (bytes: Uint8Array, ver: number, e: QrEcl): number[] {
  const cap = dataCodewords(ver, e)
  const bits: number[] = []
  const put = (v: number, n: number) => { for (let i = n - 1; i >= 0; i--) bits.push((v >>> i) & 1) }
  put(0b0100, 4); put(bytes.length, ver < 10 ? 8 : 16)
  for (const b of bytes) put(b, 8)
  put(0, Math.min(4, cap * 8 - bits.length))
  put(0, (8 - (bits.length % 8)) % 8)
  for (let pad = 0xec; bits.length < cap * 8; pad ^= 0xec ^ 0x11) put(pad, 8)
  const data: number[] = []
  for (let i = 0; i < bits.length; i += 8) { let v = 0; for (let j = 0; j < 8; j++) v = (v << 1) | bits[i + j]; data.push(v) }
  const nb = BLOCKS[e][ver], ecLen = ECC_PER_BLOCK[e][ver], raw = Math.floor(rawModules(ver) / 8)
  const nShort = nb - (raw % nb), shortLen = Math.floor(raw / nb)
  const div = rsDivisor(ecLen)
  const blocks: number[][] = []
  for (let i = 0, k = 0; i < nb; i++) {
    const len = shortLen - ecLen + (i < nShort ? 0 : 1)
    const d = data.slice(k, k + len); k += len
    const ec = rsRemainder(d, div)
    if (i < nShort) d.push(0) // 짧은 블록의 자리 맞춤(섞을 때 건너뛴다)
    blocks.push(d.concat(ec))
  }
  const out: number[] = []
  for (let i = 0; i < blocks[0].length; i++) for (let j = 0; j < blocks.length; j++) if (i !== shortLen - ecLen || j >= nShort) out.push(blocks[j][i])
  return out
}

const MASKS: ((x: number, y: number) => boolean)[] = [
  (x, y) => (x + y) % 2 === 0, (_x, y) => y % 2 === 0, (x) => x % 3 === 0, (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0, (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
  (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0, (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
]

export function makeQr (text: string, ecl: QrEcl = 'Q'): Qr | null {
  const bytes = new TextEncoder().encode(text)
  let ver = 1
  while (ver <= MAX_VER && 4 + (ver < 10 ? 8 : 16) + bytes.length * 8 > dataCodewords(ver, ecl) * 8) ver++
  if (ver > MAX_VER) return null
  const size = ver * 4 + 17
  const dark = Array.from({ length: size }, () => new Array<boolean>(size).fill(false))
  const fn = Array.from({ length: size }, () => new Array<boolean>(size).fill(false))
  const set = (x: number, y: number, d: boolean) => { dark[y][x] = d; fn[y][x] = true }

  // 기능 칸: 시간 줄 · 눈 셋 · 정렬 · 형식(자리만) · 버전
  for (let i = 0; i < size; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0) }
  for (const [cx, cy] of [[3, 3], [size - 4, 3], [3, size - 4]]) {
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
      const x = cx + dx, y = cy + dy
      if (x < 0 || y < 0 || x >= size || y >= size) continue
      const d = Math.max(Math.abs(dx), Math.abs(dy))
      set(x, y, d !== 2 && d !== 4)
    }
  }
  if (ver > 1) {
    const n = Math.floor(ver / 7) + 2, step = Math.ceil((ver * 4 + 4) / (n * 2 - 2)) * 2
    const pos = [6]
    for (let i = size - 7; pos.length < n; i -= step) pos.splice(1, 0, i)
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      if ((i === 0 && j === 0) || (i === 0 && j === n - 1) || (i === n - 1 && j === 0)) continue
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) set(pos[i] + dx, pos[j] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1)
    }
  }
  const drawFormat = (mask: number) => {
    const d = (FORMAT_ECL[ecl] << 3) | mask
    let r = d
    for (let i = 0; i < 10; i++) r = (r << 1) ^ ((r >>> 9) * 0x537)
    const bits = ((d << 10) | r) ^ 0x5412
    const b = (i: number) => ((bits >>> i) & 1) === 1
    for (let i = 0; i <= 5; i++) set(8, i, b(i))
    set(8, 7, b(6)); set(8, 8, b(7)); set(7, 8, b(8))
    for (let i = 9; i < 15; i++) set(14 - i, 8, b(i))
    for (let i = 0; i < 8; i++) set(size - 1 - i, 8, b(i))
    for (let i = 8; i < 15; i++) set(8, size - 15 + i, b(i))
    set(8, size - 8, true)
  }
  drawFormat(0)
  if (ver >= 7) {
    let r = ver
    for (let i = 0; i < 12; i++) r = (r << 1) ^ ((r >>> 11) * 0x1f25)
    const bits = (ver << 12) | r
    for (let i = 0; i < 18; i++) { const bit = ((bits >>> i) & 1) === 1, a = size - 11 + (i % 3), c = Math.floor(i / 3); set(a, c, bit); set(c, a, bit) }
  }

  // 데이터: 오른쪽 아래에서 두 칸씩 지그재그
  const cw = codewords(bytes, ver, ecl)
  let bi = 0
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5
    for (let v = 0; v < size; v++) for (let j = 0; j < 2; j++) {
      const x = right - j, up = ((right + 1) & 2) === 0, y = up ? size - 1 - v : v
      if (!fn[y][x] && bi < cw.length * 8) { dark[y][x] = ((cw[bi >>> 3] >>> (7 - (bi & 7))) & 1) === 1; bi++ }
    }
  }

  // 마스크: 여덟 가지를 다 대 보고 벌점이 가장 낮은 것
  const apply = (m: number) => { for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (!fn[y][x] && MASKS[m](x, y)) dark[y][x] = !dark[y][x] }
  let best = 0, bestP = Infinity
  for (let m = 0; m < 8; m++) {
    apply(m); drawFormat(m)
    const p = penalty(dark, size)
    if (p < bestP) { bestP = p; best = m }
    apply(m) // 되돌린다(같은 마스크를 두 번 = 원래대로)
  }
  apply(best); drawFormat(best)
  return { size, dark, fn, version: ver }
}

// 벌점(표준 N1 · N2 · N3 · N4)
function penalty (m: boolean[][], n: number): number {
  let p = 0
  const line = (get: (i: number) => boolean) => {
    let run = 1
    for (let i = 1; i <= n; i++) {
      if (i < n && get(i) === get(i - 1)) { run++; continue }
      if (run >= 5) p += run - 2
      run = 1
    }
    // 눈과 닮은 무늬 1:1:3:1:1(앞뒤 밝은 4칸)
    for (let i = 0; i + 10 < n + 0; i++) {
      const s = [0, 1, 2, 3, 4, 5, 6].map((k) => get(i + k))
      const core = s[0] && !s[1] && s[2] && s[3] && s[4] && !s[5] && s[6]
      if (!core) continue
      const before = i >= 4 && [1, 2, 3, 4].every((k) => !get(i - k))
      const after = i + 10 < n && [7, 8, 9, 10].every((k) => !get(i + k))
      if (before || after) p += 40
    }
  }
  for (let y = 0; y < n; y++) line((i) => m[y][i])
  for (let x = 0; x < n; x++) line((i) => m[i][x])
  for (let y = 0; y < n - 1; y++) for (let x = 0; x < n - 1; x++) { const c = m[y][x]; if (c === m[y][x + 1] && c === m[y + 1][x] && c === m[y + 1][x + 1]) p += 3 }
  let darkN = 0
  for (const row of m) for (const c of row) if (c) darkN++
  p += Math.floor(Math.abs(darkN * 20 - n * n * 10) / (n * n)) * 10
  return p
}
