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
