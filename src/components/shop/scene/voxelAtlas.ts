// 블록 텍스처. 16×16 칸을 코드로 직접 찍어 한 장(아틀라스)으로 만든다 — 내려받을 그림이 없어 첫 로드가 빠르다.
// 메이플 15번가의 재질로 잡았다: 크림빛 석회암, 파스텔 벽, 기와, 줄무늬 차양, 금 장식, 등불.

export const TILE = 16
export const COLS = 8

type RGB = [number, number, number]
type Painter = (x: number, y: number) => RGB

const hex = (h: number): RGB => [(h >> 16) & 255, (h >> 8) & 255, h & 255]
const mul = (c: RGB, k: number): RGB => [c[0] * k, c[1] * k, c[2] * k]
const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
function rnd(x: number, y: number, s: number) {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 2147483647)) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}
const m = (a: number, n: number) => ((a % n) + n) % n
// 얼룩진 면: 바탕색에 칸마다 작은 밝기 차
const speck = (c: RGB, x: number, y: number, s: number, amt = 0.1) => mul(c, 1 - amt / 2 + amt * rnd(x, y, s))

// 벽돌 쌓기: rows 줄, 벽돌 폭 bw. 줄눈은 어둡고 벽돌 윗줄은 밝다
const bricks = (c: RGB, rh: number, bw: number, s: number, mortar = 0.62): Painter => (x, y) => {
  const row = Math.floor(y / rh), bx = m(x + (row % 2 ? bw / 2 : 0), bw), by = m(y, rh)
  if (by === rh - 1 || bx === bw - 1) return mul(c, mortar)
  const tone = 0.9 + 0.2 * rnd(Math.floor((x + (row % 2 ? bw / 2 : 0)) / bw), row, s)
  return speck(mul(c, tone * (by === 0 ? 1.1 : bx === 0 ? 1.05 : 1)), x, y, s, 0.07)
}
const planks = (c: RGB, s: number): Painter => (x, y) => {
  const row = Math.floor(y / 4), by = y % 4, seam = m(x + row * 5, 16) === 0
  if (by === 3 || seam) return mul(c, 0.6)
  return mul(c, (by === 0 ? 1.12 : 1) * (0.92 + 0.16 * rnd(Math.floor((x + row * 5) / 3), row, s)) * (rnd(x, y, s) < 0.08 ? 0.86 : 1))
}
const siding = (c: RGB, s: number): Painter => (x, y) => speck(mul(c, y % 4 === 3 ? 0.84 : y % 4 === 0 ? 1.06 : 1), x, y, s, 0.06)
const shingles = (c: RGB, s: number): Painter => (x, y) => {
  const row = Math.floor(y / 4), by = y % 4, bx = m(x + (row % 2 ? 2 : 0), 4)
  if (by === 3) return mul(c, 0.62)
  if (bx === 3 && by > 0) return mul(c, 0.74)
  return speck(mul(c, by === 0 ? 1.14 : 0.96 + 0.1 * rnd(Math.floor((x + (row % 2 ? 2 : 0)) / 4), row, s)), x, y, s, 0.06)
}
const stripes = (a: RGB, b: RGB): Painter => (x, y) => mul(m(x, 8) < 4 ? a : b, y === 15 ? 0.7 : y === 0 ? 1.08 : 1 - y * 0.012)
const bevel = (c: RGB, s: number, amt = 0.08): Painter => (x, y) => speck(mul(c, x === 0 || y === 0 ? 1.14 : x === 15 || y === 15 ? 0.7 : 1), x, y, s, amt)
const wool = (c: RGB, s: number): Painter => (x, y) => speck(mul(c, (x + y) % 4 === 0 ? 0.93 : 1), x, y, s, 0.08)
// 둥근 돌: 흩어 놓은 점 가운데 가장 가까운 것끼리 묶는다
const cobble = (c: RGB, s: number): Painter => {
  const pts: [number, number][] = []
  for (let i = 0; i < 9; i++) pts.push([(i % 3) * 5.33 + 1 + rnd(i, 1, s) * 3.4, Math.floor(i / 3) * 5.33 + 1 + rnd(i, 2, s) * 3.4])
  return (x, y) => {
    let f1 = 99, f2 = 99, id = 0
    pts.forEach(([px, py], i) => {
      const dx = Math.min(Math.abs(x - px), 16 - Math.abs(x - px)), dy = Math.min(Math.abs(y - py), 16 - Math.abs(y - py)), d = Math.hypot(dx, dy)
      if (d < f1) { f2 = f1; f1 = d; id = i } else if (d < f2) f2 = d
    })
    if (f2 - f1 < 1.1) return mul(c, 0.55)
    return speck(mul(c, 0.86 + 0.26 * rnd(id, 7, s)), x, y, s, 0.08)
  }
}
const star = (x: number, y: number, r: number) => { // 별 안쪽인가(가운데 7.5, 7.5)
  const dx = x - 7.5, dy = y - 8, a = Math.atan2(dx, -dy), d = Math.hypot(dx, dy)
  return d < r * (0.55 + 0.45 * Math.pow(Math.abs(Math.cos(a * 2.5)), 1.6))
}

const LIME = hex(0xecdab8)
const DEFS: Record<string, Painter> = {
  lime: bricks(LIME, 8, 16, 1),
  limeS: bevel(hex(0xf1e3c6), 2, 0.07),
  limeD: bricks(hex(0xc9b594), 8, 16, 3),
  cobble: cobble(hex(0xcabda6), 4),
  marbleA: bevel(hex(0xf6ead8), 5, 0.05),
  marbleB: bevel(hex(0xe7b9c6), 6, 0.05),
  planks: planks(hex(0xd9a03c), 7),
  dplanks: planks(hex(0x8a5530), 8),
  roofP: shingles(hex(0x7d5bbd), 9),
  roofT: shingles(hex(0x3f9d8c), 10),
  roofR: shingles(hex(0xd9584a), 11),
  roofN: shingles(hex(0x4a5a8a), 12),
  wallPink: siding(hex(0xf29ab8), 13),
  wallMint: siding(hex(0x8fd3c0), 14),
  wallYellow: siding(hex(0xf6dd8a), 15),
  wallCream: siding(hex(0xfbeed6), 16),
  wallBlue: siding(hex(0x8fb4e6), 17),
  wallLilac: siding(hex(0xc3a8e6), 18),
  brickR: bricks(hex(0xd0604e), 4, 8, 19, 0.7),
  brickY: bricks(hex(0xe6c07a), 4, 8, 20, 0.72),
  awnR: stripes(hex(0xe8554a), hex(0xfdf3e3)),
  awnT: stripes(hex(0x3fa894), hex(0xfdf3e3)),
  awnP: stripes(hex(0xee6f9f), hex(0xfdf3e3)),
  leaves: (x, y) => { const r = rnd(x, y, 21); return r < 0.16 ? hex(0x2f6f3a) : mul(hex(0x5fae58), 0.82 + 0.36 * rnd(x >> 1, y >> 1, 22)) },
  flower: (x, y) => { const r = rnd(x >> 1, y >> 1, 23); return r < 0.2 ? hex(0xf06a9c) : r < 0.27 ? hex(0xfff0de) : mul(hex(0x5fae58), 0.84 + 0.3 * rnd(x, y, 24)) },
  gold: bevel(hex(0xedbb45), 25, 0.1),
  iron: bevel(hex(0x4a4652), 26, 0.1),
  carpet: (x, y) => (x < 2 || x > 13 ? mul(hex(0xedbb45), y % 2 ? 1 : 0.9) : speck(hex(0xd4486e), x, y, 27, 0.08)),
  asphalt: (x, y) => speck(hex(0x4d4a5a), x, y, 28, 0.14),
  sidewalk: (x, y) => speck(mul(hex(0xd8d0c4), x % 8 === 7 || y % 8 === 7 ? 0.74 : x % 8 === 0 || y % 8 === 0 ? 1.06 : 1), x, y, 29, 0.07),
  white: wool(hex(0xffffff), 30),
  woolPink: wool(hex(0xf07aa8), 31),
  woolMint: wool(hex(0x9fe0cc), 32),
  taxi: (x, y) => (y >= 6 && y <= 8 ? ((x >> 1) + (y >> 1 & 1)) % 2 ? hex(0x2b2b33) : hex(0xfdf3e3) : bevel(hex(0xf6c531), 33, 0.06)(x, y)),
  black: bevel(hex(0x2b2b33), 34, 0.1),
  pot: bevel(hex(0xc9763a), 35, 0.08),
  door: (x, y) => { const f = x < 2 || x > 13 || y < 2; if (f) return mul(hex(0x6b3d1f), 1); if (y < 9 && x > 3 && x < 12) return mix(hex(0x6fa8dc), hex(0xcfeafc), (9 - y) / 9); return mul(hex(0xa8632f), x === 8 ? 0.7 : 0.9 + 0.2 * rnd(x, 0, 36)) },
  shelf: (x, y) => { // 진열장: 나무 칸마다 색색의 상자
    const cy = y % 8, cx = x % 8
    if (cy === 7 || x === 0 || x === 15 || y === 0) return mul(hex(0x8a5530), cy === 7 ? 1.1 : 0.8)
    const c = [0xf07aa8, 0x9fe0cc, 0xf6dd8a, 0xc3a8e6][(Math.floor(x / 8) + Math.floor(y / 8) * 2 + (cx > 3 ? 1 : 0)) % 4]
    if (cy < 2) return mul(hex(0x6b3d1f), 0.7)
    return mul(hex(c), cx === 3 || cx === 7 ? 0.7 : cy === 2 ? 1.12 : 1)
  },
  starSign: (x, y) => (star(x, y, 6.5) ? mul(hex(0xffd95e), 1.02 - y * 0.012) : x === 0 || y === 0 || x === 15 || y === 15 ? hex(0xedbb45) : speck(hex(0x5b3a6e), x, y, 37, 0.08)),
  shirtSign: (x, y) => { // 분홍 티셔츠 간판
    const dx = Math.abs(x - 7.5)
    const body = y >= 5 && y <= 13 && dx < 4, slv = y >= 3 && y <= 7 && dx < 7 - (y - 3) * 0.2 && dx >= 2.5, neck = y >= 3 && y < 5 && dx < 4 && dx > 1.5
    if (x === 0 || y === 0 || x === 15 || y === 15) return hex(0xedbb45)
    return body || slv || neck ? mul(hex(0xee6f9f), 1.05 - (x - 4) * 0.02) : speck(hex(0xfff1dc), x, y, 38, 0.05)
  },
  // ── 스스로 빛나는 칸(여기부터 끝까지) ──
  glass: (x, y) => { // 창: 흰 테 + 유리. 밤에는 불이 켜진다(셰이더)
    if (x === 0 || y === 0 || x === 15 || y === 15) return hex(0xfbf1e0)
    if (x === 1 || y === 1 || x === 14 || y === 14 || x === 7 || x === 8 || y === 8) return hex(0x5a4a66)
    const k = m(x + y, 12)
    return mix(mix(hex(0x6fa8dc), hex(0xcfeafc), (15 - y) / 15), [255, 255, 255], k < 2 ? 0.55 : 0)
  },
  glow: (x, y) => { const d = Math.hypot(x - 7.5, y - 7.5) / 10; return x === 0 || y === 0 || x === 15 || y === 15 || x === 7 || x === 8 ? hex(0x4a4038) : mix(hex(0xfff6d2), hex(0xffc95e), d) },
  bulb: (x, y) => { const d = Math.hypot(m(x, 8) - 3.5, m(y, 8) - 3.5); return d < 2.6 ? mix(hex(0xfffbe0), hex(0xffd95e), d / 2.6) : hex(0x3d3743) },
}

export const TILES = Object.keys(DEFS)
export const tileId = (name: string) => Math.max(0, TILES.indexOf(name))
export const FIRST_LIT = TILES.indexOf('glass')
export const ROWS = Math.ceil(TILES.length / COLS)

export function paintAtlas(): { data: Uint8Array; width: number; height: number } {
  const width = COLS * TILE, height = ROWS * TILE, data = new Uint8Array(width * height * 4)
  TILES.forEach((name, i) => {
    const ox = (i % COLS) * TILE, oy = Math.floor(i / COLS) * TILE, p = DEFS[name]
    for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
      const c = p(x, y), o = ((oy + y) * width + ox + x) * 4
      data[o] = Math.min(255, Math.max(0, c[0])); data[o + 1] = Math.min(255, Math.max(0, c[1])); data[o + 2] = Math.min(255, Math.max(0, c[2])); data[o + 3] = 255
    }
  })
  return { data, width, height }
}
