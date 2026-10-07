// 배경 장면의 그림(src/assets/scene — 빌드할 때 사이트의 정적 파일로 묶인다. 주소에 해시가 붙어 캐시가 알아서 맞는다).
// WebGL 장면(sceneGl)과 그 아래에 깔리는 <img>(SceneCanvas)가 같은 주소를 쓴다 → 한 번만 받는다.
import roomFar from '@/assets/scene/room-far.webp'
import roomMain from '@/assets/scene/room-main.webp'
import streetAir from '@/assets/scene/street-air.webp'
import streetCloud from '@/assets/scene/street-cloud.webp'
import streetFar from '@/assets/scene/street-far.webp'
import streetGlow from '@/assets/scene/street-glow.webp'
import streetMain from '@/assets/scene/street-main.webp'
import streetTower from '@/assets/scene/street-tower.webp'
import { ROOM, STREET } from './sceneData'

// 자리 번호가 곧 텍스처 번호다(sceneGl 의 part()).
export const SCENE_SRC = {
  sky: [streetAir, streetFar, streetMain, streetGlow, streetTower, streetCloud].map((m) => m.src),
  room: [roomFar, roomMain].map((m) => m.src),
}

// WebGL 없이도 보이는 층: 움직이지 않는 그림을 장면과 같은 자리에 <img> 로 깐다(아래에 적은 순서대로 쌓는다).
// 거리는 화면 아래 가운데에, 무대는 캐릭터가 서는 자리(발)를 칸 가운데 조금 아래에 맞춘다.
export interface StillLayer { i: number; w: number; h: number; style: { left: string; top?: string; bottom?: string } }
const lift = STREET.h - (STREET.far.y + STREET.far.h)
const roomAt = { left: `calc(50% - ${ROOM.foot[0]}px)`, top: `calc(50% + ${38 - ROOM.foot[1]}px)` }
export const STILL: Record<'sky' | 'room', StillLayer[]> = {
  sky: [
    { i: 1, w: STREET.w, h: STREET.far.h, style: { left: `calc(50% - ${STREET.w / 2}px)`, bottom: `${lift}px` } },
    { i: 4, w: STREET.tower.w, h: STREET.tower.h, style: { left: `calc(50% + ${STREET.tower.x - STREET.w / 2}px)`, bottom: `${STREET.h - (STREET.tower.y + STREET.tower.h)}px` } },
    { i: 2, w: STREET.w, h: STREET.main.h, style: { left: `calc(50% - ${STREET.w / 2}px)`, bottom: '0px' } },
  ],
  room: [
    { i: 0, w: ROOM.w, h: ROOM.h, style: roomAt },
    { i: 1, w: ROOM.w, h: ROOM.h, style: roomAt },
  ],
}

// n 개를 [lo, hi] 에 고루 흩되 순서는 섞는다(서로 겹치지 않으면서 볼 때마다 다르게).
export function spread(n: number, lo: number, hi: number): number[] {
  const slot = Array.from({ length: n }, (_, i) => i)
  for (let i = n - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [slot[i], slot[j]] = [slot[j], slot[i]] }
  return slot.map((k) => lo + ((k + 0.15 + 0.7 * Math.random()) / n) * (hi - lo))
}

// WebGL 을 못 쓰는 기기에서: 지나가는 것들(구름 · 열기구 · 헬리콥터 · 걷는 이)을 움직이지 않는 그림으로 놓는다.
// 구름은 제자리에, 나머지는 화면에 보이는 폭 안에 고루 흩어 놓고 저마다 가는 쪽을 뽑아 그쪽을 보게 한다.
// 자리와 보는 쪽의 규칙은 장면(sceneGl 의 mesh)과 같다. layer = 쌓는 자리: 0 먼 빌딩 뒤 · 1 탑과 거리 사이 · 2 거리 앞.
export interface StillSprite { key: string; layer: 0 | 1 | 2; cloud?: boolean; ax: number; ay: number; w: number; h: number; x: number; y: number; scale: number; flip: boolean }
const HELI = { up: 150, size: 0.75 }   // sceneGl 의 HELI_UP · HELI_SIZE 와 같은 값
export function stillSprites(viewW: number): StillSprite[] {
  const out: StillSprite[] = [], seen = new Set<string>()
  const lo = STREET.w / 2 - viewW / 2, hi = STREET.w / 2 + viewW / 2
  type Row = { layer: 0 | 1 | 2; group: number; ax: number; ay: number; w: number; h: number; y: number; scale: number; face: number; jit: number }
  const rows: Row[] = []
  let helis = 0
  STREET.sprites.forEach(([k, ax, ay, w, h, x, y, extra, b], i) => {
    if (k === 0) { out.push({ key: 'c' + i, layer: 0, cloud: true, ax, ay, w, h, x, y, scale: 1, flip: false }); return }
    if (k === 11) return                       // 열기구의 밤 그림은 장면에서만 쓴다
    const art = `${ax},${ay}`
    if (seen.has(art)) return                  // 같은 그림은 하나만
    seen.add(art)
    if (k === 1) rows.push({ layer: b >= 0 ? 1 : 0, group: 0, ax, ay, w, h, y, scale: 1, face: extra < 0 ? -1 : b >= 0 ? 1 : 0, jit: 26 })
    else if (k === 2) rows.push({ layer: 0, group: 0, ax, ay, w, h, y: y - HELI.up, scale: HELI.size, face: helis++ ? -1 : 1, jit: 24 })
    else rows.push({ layer: 2, group: 2, ax, ay, w, h, y, scale: 1, face: k === 9 ? 1 : -1, jit: 0 })   // 걷는 이: 첫 장(서 있는 모습)
  })
  for (const g of [0, 2]) {   // 하늘의 것들(열기구 · 헬리콥터)끼리, 걷는 이들끼리 겹치지 않게 흩는다
    const list = rows.filter((r) => r.group === g), xs = spread(list.length, lo, hi)
    list.forEach((r, i) => {
      const half = (r.w * r.scale) / 2, cx = Math.min(hi - half, Math.max(lo + half, xs[i])), dir = Math.random() < 0.5 ? -1 : 1
      out.push({ key: `m${g}-${i}`, layer: r.layer, ax: r.ax, ay: r.ay, w: r.w, h: r.h, x: Math.round(cx - half), y: Math.round(r.y + (Math.random() * 2 - 1) * r.jit), scale: r.scale, flip: r.face !== 0 && dir !== r.face })
    })
  }
  return out
}
