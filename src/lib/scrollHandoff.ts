// 모바일: 페이지 안의 세로 스크롤 칸(data-handoff — 코디 정보 칸, 세로로 넘기는 목록 · 광장 · 코디 룩북 · 프리셋)이 위 · 아래 끝에 닿으면
// 같은 손가락 움직임으로 페이지가 이어서 움직인다(사용자 지시 — 칸이 끝나도 튕기기만 해서 페이지를 내리려면 칸 밖을 찾아 다시 끌어야 했다).
// 브라우저는 한 번 잡은 칸이 끝나도 같은 손짓 동안 페이지로 넘기지 않아서(스크롤 붙잡기) 끝에 닿은 뒤의 움직임만큼 직접 페이지를 옮긴다.
// 칸은 overscroll-behavior: contain 을 그대로 둔다 — 브라우저가 따로 넘기면 두 번 움직인다. 가로 손짓 · 두 손가락은 건드리지 않는다.
const SLOP = 6 // 이만큼 움직인 뒤 방향을 정한다(살짝 누른 것 · 가로 넘기기와 가르려고)

export function installScrollHandoff(): () => void {
  let el: HTMLElement | null = null, x = 0, y = 0, axis: 'y' | 'x' | null = null
  const start = (e: TouchEvent) => {
    el = e.touches.length === 1 ? (e.target as Element | null)?.closest?.<HTMLElement>('[data-handoff]') ?? null : null
    if (!el) return
    const oy = getComputedStyle(el).overflowY
    if (oy !== 'auto' && oy !== 'scroll') { el = null; return }
    x = e.touches[0].clientX; y = e.touches[0].clientY; axis = null
  }
  const move = (e: TouchEvent) => {
    if (!el || e.touches.length !== 1) return
    const t = e.touches[0], dx = x - t.clientX, dy = y - t.clientY
    if (!axis) {
      if (Math.abs(dx) < SLOP && Math.abs(dy) < SLOP) return
      axis = Math.abs(dy) > Math.abs(dx) ? 'y' : 'x'
    }
    x = t.clientX; y = t.clientY
    if (axis !== 'y') return
    const max = el.scrollHeight - el.clientHeight
    if ((dy > 0 && el.scrollTop >= max - 1) || (dy < 0 && el.scrollTop <= 0)) window.scrollBy(0, dy)
  }
  const end = () => { el = null }
  document.addEventListener('touchstart', start, { passive: true })
  document.addEventListener('touchmove', move, { passive: true })
  document.addEventListener('touchend', end, { passive: true })
  document.addEventListener('touchcancel', end, { passive: true })
  return () => {
    document.removeEventListener('touchstart', start)
    document.removeEventListener('touchmove', move)
    document.removeEventListener('touchend', end)
    document.removeEventListener('touchcancel', end)
  }
}
