// 배경 장면의 그림(public/scene). WebGL 장면(sceneGl)과 그 아래에 깔리는 <img>(SceneCanvas)가 같은 주소를 쓴다 → 한 번만 받는다.
// 주소가 고정이라 그림이 바뀌면 판 번호(SCENE_V — scene-build 가 적는다)가 바뀌어 새로 받는다(next.config 가 /scene 을 오래 캐시한다).
import { ROOM, SCENE_V, STREET } from './sceneData'

const u = (n: string) => `/scene/${n}.webp?v=${SCENE_V}`
// 자리 번호가 곧 텍스처 번호다(sceneGl 의 part()).
export const SCENE_SRC = {
  sky: ['street-air', 'street-far', 'street-main', 'street-glow', 'street-tower'].map(u),
  room: ['room-far', 'room-main'].map(u),
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
