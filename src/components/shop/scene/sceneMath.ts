// 지나가는 것들을 흩어 놓는 계산. 화면(DOM)도 그림도 쓰지 않는다 — 장면(sceneCore, 워커에서 돈다)과 움직이지 않는 그림(sceneSrc)이 함께 쓴다.

// n 개를 [lo, hi] 에 고루 흩되 순서는 섞는다(서로 겹치지 않으면서 볼 때마다 다르게).
export function spread(n: number, lo: number, hi: number): number[] {
  const slot = Array.from({ length: n }, (_, i) => i)
  for (let i = n - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [slot[i], slot[j]] = [slot[j], slot[i]] }
  return slot.map((k) => lo + ((k + 0.15 + 0.7 * Math.random()) / n) * (hi - lo))
}

// 멈춘 채로 놓을 때 몇 개를 놓을지: 보이는 폭이 좁으면 덜 놓는다(좁은 화면에 다 놓으면 붐빈다).
// 하늘의 것(열기구 · 헬리콥터)과 걷는 이 모두 300px 에 하나꼴, 적어도 둘. 폭 1800 이상이면 전부 놓인다.
export const stillCount = (total: number, width: number) => Math.min(total, Math.max(2, Math.floor(width / 300)))
// 0..n-1 가운데 keep 개를 아무렇게나 고른다.
export function pickSome(n: number, keep: number): Set<number> {
  const idx = Array.from({ length: n }, (_, i) => i)
  for (let i = n - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]] }
  return new Set(idx.slice(0, keep))
}

// 지나가는 것들의 움직임 범위. 종류 0 열기구 · 1 헬리콥터 · 2 걷는 이: 빠르기(그림 칸/초) · 화면에서 사라진 뒤 쉬는 시간(초) · 나타날 때마다 높이를 바꾸는 폭(칸).
// 열기구는 핑크빈 열기구가 기준이고 주황버섯은 그 0.75배, 슈피겔만은 1.25배다(mult). 걷는 이는 핑크빈이 느리고(mult 0.75) 아이돌이 빠르다.
// 장면(sceneCore)과 WebGL 없이 움직이는 쪽(SceneMovers)이 같은 값을 쓴다.
export const MOVE = [
  { speed: [4.2, 6], gap: [4, 26], jit: 26 },
  { speed: [9, 16], gap: [14, 60], jit: 24 },
  { speed: [26, 42], gap: [25, 95], jit: 0 },   // 걷는 이는 여섯이라 저마다 오래 쉰다 — 거리에 한둘만 보이게
]
export const PAUSE = { chance: 0.5, sec: [3, 6] }    // 걷는 이가 도중에 멈춰 서는 비율과 시간
export const rnd = (r: number[]) => r[0] + Math.random() * (r[1] - r[0])
// 걷는 그림을 넘기는 빠르기(초당 장수): 여덟 장짜리(핑크빈)는 8.33, 넉 장짜리(아이돌)는 5
export const walkFps = (frames: number) => (frames > 4 ? 8.33 : 5)
// 열기구 · 헬리콥터가 위아래로 떠는 폭(칸)과 한 번 오르내리는 시간(초)
export const BOB = [{ amp: 5, sec: 6.283 / 0.55 }, { amp: 2.5, sec: 6.283 / 1.3 }]
