// 블록으로 쌓은 두 장면.
//  · sky  : 앱 배경 — 메이플 15번가의 거리. 길 한가운데에 서서 양옆의 가게들과 멀리 별 탑을 바라본다.
//  · room : 미리보기 무대 — 15번가 핑크빈 커마샵 안, 석조 건물의 피팅룸. 캐릭터는 가운데 낮은 단 위에 선다.
// 블록 1칸 = 1 단위. add(종류, 가운데 x, y, z, 크기 x, y, z, 빛) — 텍스처는 세계 좌표에 맞춰 이어 붙는다(큰 상자도 16픽셀/칸).

import { tileId } from './voxelAtlas'

export type Add = (tile: string | [string, string], x: number, y: number, z: number, sx?: number, sy?: number, sz?: number, lit?: number) => void

export interface SceneDef {
  eye: [number, number, number]
  look: [number, number, number]
  fov: number                 // 세로 시야각(도)
  fog: [number, number]
  pin?: [number, number, number] // 캐릭터 발이 놓이는 자리(room)
  build: (add: Add) => void
}

// 고정 시드 난수: 장면 모양이 매번 같다
function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const WIN = 2 // 창(밤에 군데군데 켜진다). 1 = 늘 빛나는 등
// 면 하나에 그림 한 장을 꽉 채우는 칸(간판 · 창 · 문 · 등). 나머지는 세계 좌표에 맞춰 이어 붙인다
const FIT = new Set(['glass', 'glow', 'door', 'starSign', 'shirtSign'])

// ───────────────────────── 15번가 거리 ─────────────────────────
function street(add: Add) {
  const r = rng(15)
  // 길과 보도
  add('asphalt', 0, -0.5, -30, 7, 1, 100)
  for (let z = 8; z > -70; z -= 5) add('white', 0, 0.01, z, 0.3, 0.02, 2)
  for (const s of [-1, 1]) {
    add('sidewalk', s * 5.5, -0.35, -30, 4, 1.3, 100)
    add('limeS', s * 3.6, -0.3, -30, 0.3, 1.4, 100) // 연석
  }
  const WALLS = ['wallPink', 'wallMint', 'wallYellow', 'wallCream', 'wallBlue', 'wallLilac', 'brickR', 'brickY']
  const ROOFS = ['roofP', 'roofT', 'roofR', 'roofN']
  const AWN = ['awnR', 'awnT', 'awnP']
  for (const s of [-1, 1]) {
    let z = 10, n = s > 0 ? 0 : 3
    while (z > -62) {
      const d = 6 + Math.floor(r() * 4), w = 8 + Math.floor(r() * 4), floors = 2 + Math.floor(r() * 4), h = 3.6 + floors * 3
      const wall = WALLS[n % WALLS.length], roof = ROOFS[n % ROOFS.length], cx = s * (7.5 + w / 2), cz = z - d / 2, fx = s * 7.5 // fx = 길 쪽 벽면
      add(wall, cx, h / 2, cz, w, h, d)
      add('limeS', cx, 0.3, cz, w + 0.3, 0.6, d + 0.3)                       // 밑단
      add('limeS', cx, 3.5, cz, w + 0.5, 0.35, d + 0.5)                      // 1층 위 돌림띠
      add('limeS', cx, h + 0.2, cz, w + 0.7, 0.4, d + 0.7)                   // 처마
      for (const [px, pz] of [[fx, z], [fx, z - d]] as const) add('limeS', px, h / 2, pz - (pz === z ? 0.25 : -0.25), 0.6, h, 0.6) // 모서리 돌
      // 1층: 큰 진열창 · 문 · 차양
      for (let k = 0.9; k < d - 3.4; k += 2.1) add('glass', fx - s * 0.08, 1.9, z - k - 1, 0.16, 2.2, 1.9, WIN + 0.9)
      add('door', fx - s * 0.1, 1.3, z - d + 1.3, 0.2, 2.6, 1.4)
      add(AWN[n % 3], fx - s * 0.9, 3.25, cz, 1.9, 0.22, d - 1)
      add(AWN[n % 3], fx - s * 1.75, 3.0, cz, 0.2, 0.5, d - 1)
      // 위층 창(길 쪽과 정면)
      for (let f = 0; f < floors; f++) {
        const y = 5.4 + f * 3
        for (let k = 1.6; k < d - 1; k += 2.2) { add('glass', fx - s * 0.08, y, z - k, 0.16, 1.7, 1.2, WIN + r() * 0.99); add('limeS', fx - s * 0.2, y - 1.05, z - k, 0.4, 0.2, 1.5) }
        for (let k = 1.6; k < w - 1; k += 2.4) add('glass', fx + s * k, y, z + 0.08, 1.2, 1.7, 0.16, WIN + r() * 0.99)
      }
      // 세로 간판(전구) 또는 둥근 간판
      if (n % 2) add('bulb', fx - s * 0.6, h * 0.62, z - 0.8, 0.5, Math.min(5, h * 0.4), 0.9, 1)
      else add(n % 4 ? 'starSign' : 'shirtSign', fx - s * 0.35, 5.2, cz, 0.3, 2, 2, 1)
      // 지붕: 층층이 좁아지는 기와 또는 평지붕 + 볼거리
      const kind = n % 3
      if (kind === 0) for (let i = 0; i < 4; i++) add(roof, cx, h + 0.65 + i * 0.5, cz, w + 0.4 - i * (w / 4.4), 0.5, d + 0.6)
      else if (kind === 1) {
        add(roof, cx, h + 0.55, cz, w - 0.6, 0.3, d - 0.6)
        add('dplanks', cx + s * 1, h + 1.6, cz, 0.3, 2, 0.3); add('shirtSign', cx + s * 1, h + 3.6, cz, 0.3, 3.4, 3.4, 1) // 옥상 광고판
        add('bulb', cx + s * 0.9, h + 5.05, cz, 0.4, 0.3, 4.3, 1)
      } else {
        add(roof, cx, h + 0.55, cz, w - 0.6, 0.3, d - 0.6)
        add('dplanks', cx, h + 1.5, cz + 1, 1.8, 1.6, 1.8); add(roof, cx, h + 2.5, cz + 1, 2.2, 0.4, 2.2)              // 물탱크
        add('brickR', cx - s * 2, h + 1.4, cz - 1.5, 0.9, 2, 0.9)                                                    // 굴뚝
      }
      z -= d + 0.8; n++
    }
    // 가로등 · 깃발 · 가로수 · 화단
    for (let lz = 6; lz > -60; lz -= 9) {
      add('iron', s * 4.2, 1.9, lz, 0.22, 3.8, 0.22); add('iron', s * 4.2, 3.95, lz, 0.6, 0.12, 0.6)
      add('glow', s * 4.2, 4.3, lz, 0.5, 0.6, 0.5, 1)
      add('woolPink', s * 4.55, 3.1, lz, 0.5, 1.1, 0.06)
      add('dplanks', s * 4.3, 1.1, lz - 4.5, 0.4, 2.2, 0.4)
      add('leaves', s * 4.3, 3.1, lz - 4.5, 1.8, 1.8, 1.8); add('leaves', s * 4.3, 4.3, lz - 4.5, 1.1, 0.9, 1.1)
      add('limeS', s * 6.6, 0.55, lz - 2, 1.2, 0.5, 2.2); add('flower', s * 6.6, 1.0, lz - 2, 1, 0.5, 2)
    }
  }
  // 길 위의 노란 택시
  add('taxi', 1.7, 0.65, -4, 1.7, 0.8, 3.6); add('taxi', 1.7, 1.3, -4.2, 1.5, 0.6, 1.9)
  add('glass', 1.7, 1.3, -3.22, 1.3, 0.45, 0.06, WIN + 0.9); add('glow', 1.7, 1.75, -4.2, 0.5, 0.25, 0.3, 1)
  for (const [wx, wz] of [[0.9, -2.9], [2.5, -2.9], [0.9, -5.1], [2.5, -5.1]] as const) add('black', wx, 0.3, wz, 0.3, 0.6, 0.6)
  // 길 끝의 별 탑과 그 뒤의 먼 건물
  add('limeS', 0, 3, -70, 16, 6, 12); add('wallBlue', 0, 17, -70, 11, 22, 9); add('limeS', 0, 28.3, -70, 12, 0.6, 10)
  add('wallPink', 0, 33, -70, 7, 9, 6); add('roofN', 0, 38.5, -70, 5, 2, 4.4); add('roofN', 0, 40.5, -70, 3, 2, 2.6); add('gold', 0, 43, -70, 0.5, 3, 0.5)
  add('starSign', 0, 33, -66.9, 4, 4, 0.2, 1)
  for (let y = 9; y < 27; y += 3) for (let x = -4; x <= 4; x += 2) add('glass', x, y, -65.45, 1.2, 1.8, 0.14, WIN + r() * 0.99)
  for (let i = 0; i < 14; i++) { const x = (i - 6.5) * 9 + r() * 4, h = 16 + r() * 26; if (Math.abs(x) > 9) add(['wallBlue', 'wallLilac', 'wallCream'][i % 3], x, h / 2, -86 - r() * 12, 7, h, 7) }
  // 구름과 열기구
  for (let i = 0; i < 9; i++) { const x = -60 + r() * 120, y = 30 + r() * 18, z = -50 - r() * 40; add('white', x, y, z, 7 + r() * 6, 1.4, 4); add('white', x + 1.5, y + 1.2, z, 4, 1.2, 3) }
  for (const [bx, by, bz, t] of [[-13, 24, -34, 'awnR'], [15, 30, -46, 'awnT']] as const) {
    add(t, bx, by, bz, 3, 2, 3); add(t, bx, by + 1.7, bz, 2.2, 1.4, 2.2); add(t, bx, by - 1.5, bz, 2, 1, 2); add('planks', bx, by - 3.4, bz, 0.9, 0.8, 0.9)
  }
}

// ───────────────────────── 커마샵 피팅룸 ─────────────────────────
function room(add: Add) {
  // 바닥: 크림 · 장밋빛 대리석 체크. 앞 끝(z = 3.5)에서 끊기고 아래로 돌 기초가 보인다
  for (let x = -10; x <= 10; x++) for (let z = -5; z <= 3; z++) add((x + z) & 1 ? 'marbleA' : 'marbleB', x, -0.5, z)
  add('limeS', 0, -1.2, 3.62, 21.4, 0.4, 0.35)
  add('cobble', 0, -8, -1, 21, 14, 8.9)
  for (const x of [-7, -3.5, 3.5, 7]) { add('limeD', x, -5, 3.6, 1, 8, 0.4); add('limeS', x, -1.6, 3.7, 1.3, 0.5, 0.5) } // 기초의 버팀벽
  for (const x of [-5.25, 5.25]) { add('iron', x, -2.6, 3.7, 0.12, 0.5, 0.12); add('glow', x, -3.2, 3.7, 0.5, 0.7, 0.5, 1) }
  // 캐릭터가 서는 낮은 단 + 깔개(단에서 바닥 앞 끝까지, 그 아래로 늘어진다)
  add('limeS', 0, 0.125, 0, 5, 0.25, 3)
  add('carpet', 0, 0.27, 0, 2, 0.04, 3); add('carpet', 0, 0.02, 2.5, 2, 0.04, 2); add('carpet', 0, -1.6, 3.82, 2, 3.2, 0.06)
  for (const s of [-1, 1]) add('gold', s * 2.5, 0.2, 1.5, 0.3, 0.4, 0.3)
  // 뒷벽: 석회암 벽돌. 캐릭터 뒤(벽기둥 사이)는 벽돌뿐이다
  add('lime', 0, 5.5, -6, 21, 11, 1)
  add('limeS', 0, 0.45, -5.4, 21, 0.9, 0.2)                                   // 굽도리
  add('limeS', 0, 9.2, -5.25, 21, 0.5, 0.5)                                   // 돌림띠
  for (let x = -10; x <= 10; x += 1) add('limeS', x, 8.8, -5.35, 0.5, 0.3, 0.3) // 까치발 돌
  for (const x of [-8.6, -3.6, 3.6, 8.6]) {                                    // 벽기둥
    add('limeS', x, 4.6, -5.2, 1, 9.2, 0.6); add('limeS', x, 0.4, -5.05, 1.4, 0.8, 0.9); add('limeS', x, 8.5, -5.05, 1.4, 0.5, 0.9)
    add('gold', x, 8.1, -4.88, 0.5, 0.3, 0.1)
  }
  add('starSign', 0, 7.4, -5.42, 1.6, 1.6, 0.16, 1)                           // 가게 문장
  add('gold', 0, 6.35, -5.42, 3.4, 0.12, 0.12)
  // 창(양옆): 돌 테 · 턱 · 꽃 상자, 그 아래 진열장
  for (const s of [-1, 1]) {
    const x = s * 6.1
    add('glass', x, 5.6, -5.45, 2, 3, 0.12, WIN + 0.9)
    add('limeS', x, 7.25, -5.3, 2.6, 0.3, 0.4); add('limeS', x, 3.95, -5.2, 2.8, 0.3, 0.6)
    for (const d of [-1.15, 1.15]) add('limeS', x + d, 5.6, -5.35, 0.3, 3, 0.3)
    add('flower', x, 4.3, -5.05, 2.2, 0.45, 0.4)
    add('shelf', x, 1.9, -5.15, 3, 2, 0.7); add('dplanks', x, 2.95, -5.1, 3.2, 0.14, 0.9)
    add('woolPink', x - 0.7, 3.25, -5.1, 0.7, 0.45, 0.6); add('woolMint', x + 0.6, 3.2, -5.1, 0.6, 0.35, 0.6); add('gold', x - 0.7, 3.5, -5.1, 0.72, 0.08, 0.2)
  }
  // 옆벽과 천장
  for (const s of [-1, 1]) { add('lime', s * 11, 5.5, -1, 1, 11, 9); add('limeS', s * 10.4, 0.45, -1, 0.2, 0.9, 9); add('limeS', s * 10.3, 9.2, -1, 0.4, 0.5, 9) }
  add('limeD', 0, 11.5, -1, 23, 1, 9)
  for (const z of [-3.6, -0.6, 2.4]) add('dplanks', 0, 10.6, z, 21, 0.8, 0.7)   // 들보
  // 매단 등
  for (const [x, z] of [[-3, -2.2], [3, -2.2], [-7, 0.6], [7, 0.6]] as const) {
    add('iron', x, 9.4, z, 0.1, 1.7, 0.1); add('iron', x, 8.5, z, 0.9, 0.14, 0.9); add('glow', x, 8.0, z, 0.7, 0.9, 0.7, 1); add('iron', x, 7.5, z, 0.8, 0.12, 0.8)
  }
  // 왼쪽: 계산대(꽃 화분 · 금 계산기)와 선물 상자
  add('planks', -7.4, 0.65, -2.4, 3.4, 1.3, 1.5); add('dplanks', -7.4, 1.37, -2.4, 3.8, 0.16, 1.9)
  add('pot', -8.4, 1.75, -2.4, 0.6, 0.6, 0.6); add('flower', -8.4, 2.35, -2.4, 0.9, 0.7, 0.9)
  add('gold', -6.6, 1.75, -2.4, 0.9, 0.6, 0.7); add('black', -6.6, 2.1, -2.5, 0.7, 0.14, 0.4)
  add('woolMint', -5.2, 0.45, 0.9, 0.9, 0.9, 0.9); add('woolPink', -5.25, 1.2, 0.9, 0.6, 0.6, 0.6); add('gold', -5.2, 0.45, 0.9, 0.16, 0.92, 0.92)
  // 오른쪽: 위층으로 오르는 돌계단과 쇠 난간
  for (let i = 0; i < 7; i++) {
    add('limeS', 8.6, 0.25 * (i + 1), 2.6 - i, 2.8, 0.5 * (i + 1), 1)
    add('carpet', 8.6, 0.5 * (i + 1) + 0.02, 2.6 - i, 1.4, 0.04, 1)
    add('iron', 7.3, 0.5 * (i + 1) + 0.75, 2.6 - i, 0.1, 1.5, 0.1)
    add('gold', 7.3, 0.5 * (i + 1) + 1.55, 2.6 - i, 0.16, 0.14, 1.05)
  }
  add('limeS', 8.6, 3.75, -4.4, 2.8, 0.5, 1.2); add('door', 8.6, 5.3, -5.42, 1.6, 2.6, 0.14)
  // 화분 나무(벽기둥 앞)
  for (const x of [-3.6, 3.6]) { add('pot', x, 0.45, -4.3, 0.8, 0.9, 0.8); add('dplanks', x, 1.3, -4.3, 0.2, 0.9, 0.2); add('flower', x, 2.3, -4.3, 1.4, 1.4, 1.4); add('leaves', x, 3.2, -4.3, 0.9, 0.6, 0.9) }
}

export const SCENES: Record<'sky' | 'room', SceneDef> = {
  sky: { eye: [0, 6.2, 17], look: [0, 8.5, -30], fov: 60, fog: [34, 105], build: street },
  room: { eye: [-2.6, 3.4, 13], look: [0.2, 2.3, -2], fov: 36, fog: [40, 90], pin: [0, 0.29, 0.4], build: room },
}

// 상자 목록 → 정점 배열. 정점 = 위치(3) · 텍스처 좌표(2) · [칸 번호, 면 밝기, 빛](3). 뒤(-z)를 보는 면은 카메라에 보이지 않아 만들지 않는다.
export function buildMesh(def: SceneDef): { verts: Float32Array; index: Uint32Array } {
  const v: number[] = [], idx: number[] = []
  let n = 0
  const quad = (p: number[][], uv: number[][], tile: number, shade: number, lit: number) => {
    for (let i = 0; i < 4; i++) v.push(p[i][0], p[i][1], p[i][2], uv[i][0], uv[i][1], tile, shade, lit)
    idx.push(n, n + 1, n + 2, n, n + 2, n + 3); n += 4
  }
  const add: Add = (tile, x, y, z, sx = 1, sy = 1, sz = 1, lit = 0) => {
    const side = tileId(typeof tile === 'string' ? tile : tile[0]), top = tileId(typeof tile === 'string' ? tile : tile[1])
    const fit = FIT.has(typeof tile === 'string' ? tile : tile[0]), F = [[0.001, 0.999], [0.999, 0.999], [0.999, 0.001], [0.001, 0.001]]
    const x0 = x - sx / 2, x1 = x + sx / 2, y0 = y - sy / 2, y1 = y + sy / 2, z0 = z - sz / 2, z1 = z + sz / 2
    quad([[x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0]], fit ? F : [[x0, z0], [x0, z1], [x1, z1], [x1, z0]], top, 1, lit)             // 위
    quad([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], fit ? F : [[x0, -y0], [x1, -y0], [x1, -y1], [x0, -y1]], side, 0.86, lit)   // 앞(+z)
    quad([[x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]], fit ? F : [[-z1, -y0], [-z0, -y0], [-z0, -y1], [-z1, -y1]], side, 0.68, lit) // 오른쪽(+x)
    quad([[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]], fit ? F : [[z0, -y0], [z1, -y0], [z1, -y1], [z0, -y1]], side, 0.76, lit)   // 왼쪽(-x)
    quad([[x0, y0, z1], [x0, y0, z0], [x1, y0, z0], [x1, y0, z1]], fit ? F : [[x0, z1], [x0, z0], [x1, z0], [x1, z1]], top, 0.5, lit)           // 아래
  }
  def.build(add)
  return { verts: new Float32Array(v), index: new Uint32Array(idx) }
}
