// 배경 장면의 그림(src/assets/scene — 빌드할 때 사이트의 정적 파일로 묶인다. 주소에 해시가 붙어 캐시가 알아서 맞는다).
// WebGL 장면(sceneGl)과 그 아래에 깔리는 <img>(SceneCanvas)가 같은 주소를 쓴다 → 한 번만 받는다.
import roomFar from '@/assets/scene/room-far.webp'
import roomMain from '@/assets/scene/room-main.webp'
import streetStill from '@/assets/background/street-still.webp'
import streetAir from '@/assets/scene/street-air.webp'
import streetBack from '@/assets/scene/street-back.webp'
import streetFar from '@/assets/scene/street-far.webp'
import streetGlow from '@/assets/scene/street-glow.webp'
import streetMain from '@/assets/scene/street-main.webp'
import streetTower from '@/assets/scene/street-tower.webp'
import { ROOM, STREET } from './sceneData'

// 자리 번호가 곧 텍스처 번호다(sceneGl 의 part()).
export const SCENE_SRC = {
  sky: [streetAir, streetFar, streetMain, streetGlow, streetTower, streetBack].map((m) => m.src),
  room: [roomFar, roomMain].map((m) => m.src),
}

// 폴백 배경(assets/background): WebGL 을 못 쓰는 기기에서 건물 그림 위에 얹는 한 장 — 구름 · 열기구 · 헬리콥터 · 걷는 이를 자리를 정해 놓아 둔 것.
// 건물에 가리는 부분은 미리 지워져 있어 맨 위에 그대로 얹으면 층이 맞는다(parser/scripts/scene-build.cjs). 장면 전체 크기(STREET.w × h)다.
export const STILL_OVER = streetStill.src

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
