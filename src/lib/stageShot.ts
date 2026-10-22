// 움짤 저장의 배경 — 미리보기에 깔린 배경(lib/stageBg)을 움짤 판에 화면과 같은 자리 · 크기로 그린다(클라이언트에서만, 서버를 거치지 않는다).
// 판 = 미리보기 칸(PreviewModel 의 wrap). f = CSS px 하나가 판의 몇 px 인가, s = 게임 1칸이 판의 몇 px 인가(정수).
//  · 피팅룸: 장면(scene/sceneCore)의 무대는 매장 그림(room-main)과 창밖 그림(room-far) 두 장에 시각의 빛과 발밑 그림자만 입힌다 —
//    움직이는 것이 없다(창밖의 느린 흔들림만 있다 — 움짤은 흔들지 않는다, 장면의 '동작 줄이기'와 같다). 그래서 셰이더의 식을 그대로
//    옮겨 그림에 한 번 입힌다(roomLit). 반짝이는 조명의 아주 작은 일렁임(±7%)은 시간에 따라 바뀌어 넣지 않는다.
//  · 캐시샵 배경: StageBg 의 CashStage 와 같다 — 캐릭터와 같은 도트 크기, 바닥 줄을 발에, 가운데를 캐릭터 가운데에. 그림 밖은 위 · 아래 색.
//  · 올린 그림: 배경 칸을 덮게(cover, 가운데). 흰색 · 검은색: 그 색.
import { ROOM } from '@/components/shop/scene/sceneData'
import { SCENE_SRC } from '@/components/shop/scene/sceneSrc'
import { sceneFallback, skyNow } from '@/components/shop/scene/skyTime'
import { STAGE_COLORS } from '@/components/shop/preview/StageBg'
import { CASH_BGS, CASH_BG_GROUND, CASH_BG_H, CASH_BG_W, getStageBg } from './stageBg'
import { getStageFloor } from './stageFloor'

const loadImg = (src: string) => new Promise<HTMLImageElement>((res, rej) => {
  const img = new Image()
  img.onload = () => res(img); img.onerror = rej
  img.src = src
})
const smooth = (e0: number, e1: number, x: number) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t) }

// 무대 그림 한 장(ROOM.w × ROOM.h, 1칸 = 게임 1칸)에 지금 시각의 빛 · 발밑 그림자를 입힌다 — sceneCore 의 QUAD_FS 무대 식(종류 6 창밖 · 7 매장).
async function roomLit (shadow: number): Promise<HTMLCanvasElement> {
  const [far, main] = await Promise.all(SCENE_SRC.room.map(loadImg))
  const st = skyNow(), dim = 1 - 0.3 * st.night
  const amb = st.amb.map((v) => v * dim), lamp = st.lamp
  const c = document.createElement('canvas'); c.width = ROOM.w; c.height = ROOM.h
  const g = c.getContext('2d', { willReadFrequently: true })!
  const layer = (img: HTMLImageElement, lit: (i: number, x: number, y: number, d: Uint8ClampedArray) => void) => {
    const t = document.createElement('canvas'); t.width = ROOM.w; t.height = ROOM.h
    const tg = t.getContext('2d', { willReadFrequently: true })!
    tg.drawImage(img, 0, 0)
    const im = tg.getImageData(0, 0, ROOM.w, ROOM.h), d = im.data
    for (let y = 0; y < ROOM.h; y++) for (let x = 0; x < ROOM.w; x++) { const i = (y * ROOM.w + x) * 4; if (d[i + 3]) lit(i, x + 0.5, y + 0.5, d) }
    tg.putImageData(im, 0, 0)
    g.drawImage(t, 0, 0)
  }
  // 창밖: c * 빛
  layer(far, (i, _x, _y, d) => { for (let k = 0; k < 3; k++) d[i + k] = Math.min(255, d[i + k] * amb[k]) })
  // 매장: c * mix(1, 빛, .3) + 등불, 발밑은 둥근 그림자(가로 반폭 shadow, 세로는 그 .26)
  const fx = ROOM.foot[0], fy = ROOM.foot[1] + 1, lampAdd = [0.03 * lamp, 0.012 * lamp, 0]
  layer(main, (i, x, y, d) => {
    const dx = (x - fx) / shadow, dy = (y - fy) / (shadow * 0.26)
    const sh = 1 - 0.34 * smooth(1, 0.25, Math.hypot(dx, dy))
    for (let k = 0; k < 3; k++) d[i + k] = Math.min(255, ((d[i + k] / 255) * (1 + (amb[k] - 1) * 0.3) + lampAdd[k]) * sh * 255)
  })
  return c
}

// 판(g 의 캔버스 전체)에 지금 배경을 그린다. wrap = 미리보기 칸, f = CSS px → 판 px, s = 게임 1칸 → 판 px.
export async function paintStage (g: CanvasRenderingContext2D, wrap: HTMLElement, f: number, s: number): Promise<void> {
  const bg = getStageBg(), floor = getStageFloor()
  const W = g.canvas.width, H = g.canvas.height
  const wr = wrap.getBoundingClientRect()
  const host = (wrap.closest('[data-pv-stage],[data-hero]') as HTMLElement | null) ?? wrap // 배경이 깔린 칸(미리보기 칸보다 클 수 있다)
  const hr = host.getBoundingClientRect()
  const hx = (hr.left - wr.left) * f, hy = (hr.top - wr.top) * f, hw = hr.width * f, hh = hr.height * f
  const fill = (c: string, x = 0, y = 0, w = W, h = H) => { g.fillStyle = c; g.fillRect(x, y, w, h) }
  // 캐릭터가 서는 자리(판 px). 아직 모르면 장면의 기본 자리(칸 가운데 조금 아래)
  const cx = floor ? floor.cx * f : W / 2, foot = floor ? floor.footY * f : H / 2 + 38.4 * f
  if (bg.sel === 'room') {
    fill(sceneFallback('room'))
    const room = await roomLit(floor?.shadow ?? 13)
    g.imageSmoothingEnabled = false
    g.drawImage(room, Math.round(cx - ROOM.foot[0] * s), Math.round(foot - ROOM.foot[1] * s), ROOM.w * s, ROOM.h * s)
    return
  }
  const cash = CASH_BGS.find((c) => c.id === bg.sel)
  if (cash) {
    fill(cash.top); fill(cash.bottom, 0, hy + hh / 2, W, H)
    const img = await loadImg(cash.src)
    g.imageSmoothingEnabled = false
    g.drawImage(img, Math.round(cx - (CASH_BG_W / 2) * s), Math.round(foot - CASH_BG_GROUND * s), CASH_BG_W * s, CASH_BG_H * s)
    return
  }
  const up = bg.images.find((i) => i.id === bg.sel)
  if (up) {
    const img = await loadImg(up.src)
    const k = Math.max(hw / img.naturalWidth, hh / img.naturalHeight), w = img.naturalWidth * k, h = img.naturalHeight * k
    fill('#ffffff')
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high'
    g.drawImage(img, hx + (hw - w) / 2, hy + (hh - h) / 2, w, h)
    return
  }
  fill(STAGE_COLORS[bg.sel] ?? STAGE_COLORS.white)
}
