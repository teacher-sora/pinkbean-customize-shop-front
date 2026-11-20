// 화면 크기 — 레이아웃 판단(폭별 모드 · 창 폭 · 미리보기 높이 · 떠 있는 칸 자리)은 모두 이것으로 읽는다.
// 핀치 확대는 화면 크기 변경이 아니다(사용자 지시 — 아이패드에서 확대하면 UI 배열이 바뀌고, 원래 크기로 줄여도 새로고침 전에는 돌아오지 않았다).
// iOS · iPadOS 사파리는 확대하면 innerWidth · innerHeight 가 '보이는 영역'(visual viewport)의 크기로 줄어든다. 그래서 확대 중
// (visualViewport.scale > 1)에는 확대와 상관없는 레이아웃 뷰포트(documentElement.clientWidth · clientHeight)를 쓴다.
// 확대하지 않은 화면에서는 지금까지와 같은 값이다(innerWidth · innerHeight). CSS 미디어 쿼리 · svh 는 원래 확대와 상관없다.
const zoomed = () => (window.visualViewport?.scale ?? 1) > 1.001
export const viewW = (): number => {
  const de = document.documentElement
  return (zoomed() ? de.clientWidth : window.innerWidth) || de.clientWidth
}
export const viewH = (): number => {
  const de = document.documentElement
  return (zoomed() ? de.clientHeight : window.innerHeight) || de.clientHeight
}
