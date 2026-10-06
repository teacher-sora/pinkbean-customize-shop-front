// 미리보기 캐릭터가 딛고 선 자리. PreviewModel 이 그릴 때마다 알리고, 배경 장면(scene/sceneGl)이 받아
// 바닥선과 도트 크기를 캐릭터에 맞춘다 — 그래야 캐릭터가 바닥 위에 서 있고 배경 도트가 캐릭터 도트와 같은 크기다.

export interface StageFloor {
  wrap: HTMLElement // 아래 좌표의 기준(PreviewModel 표시 영역)
  cx: number        // 캐릭터 가로 중심(CSS px)
  footY: number     // 발이 닿는 높이(CSS px)
  scale: number     // 게임 픽셀 1칸 = 디바이스 픽셀 몇 칸(정수)
  shadow: number    // 발밑 그림자 반폭(게임 픽셀)
}

let cur: StageFloor | null = null
const subs = new Set<() => void>()

export const getStageFloor = () => cur
export function setStageFloor(f: StageFloor) {
  if (cur && cur.wrap === f.wrap && cur.cx === f.cx && cur.footY === f.footY && cur.scale === f.scale && cur.shadow === f.shadow) return
  cur = f
  subs.forEach((fn) => fn())
}
export function onStageFloor(fn: () => void) {
  subs.add(fn)
  return () => { subs.delete(fn) }
}
