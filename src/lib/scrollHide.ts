// 모바일 하단 탭 — 자리 없이 화면 아래에 떠 있고, 손가락 제스처 방향으로 숨고 나온다(사용자 지시 — 유튜브 앱 아래 탭처럼).
//  · 손가락을 댄 자리(touchstart)에서 세로로 GESTURE 넘게 밀면(touchmove) 그쪽으로 — 위로 밀면 숨고, 아래로 밀면 나온다.
//    한 제스처 안에서 방향을 바꾸면 가장 멀리 민 자리부터 다시 센다. 처음 움직인 쪽이 가로면(목록 좌우 넘기기) 세지 않는다.
//    빠르게 튕겨 움직임이 한두 번만 오면 손을 뗄 때 댄 자리와 뗀 자리를 한 번 더 본다. 마우스 휠은 휠 방향.
//  · 움직임은 브라우저의 전환(globals.css nav[data-pb-navhide])이고, 코드는 표시 하나만 바꾼다. 스크롤 양 · 페이지 끝은 보지 않는다.
//  · 페이지는 늘 브라우저 기본대로 스크롤한다(튕김 · 당겨서 새로고침 그대로). 헤더 · 미리보기 · 분류 줄을 접던 것은 폐기(사용자 지시 — 답답했다).
const GESTURE = 8 // 손가락이 같은 방향으로 이만큼(px) 움직이면 그 방향으로 친다(누르기 · 떨림은 치지 않는다)
let installed = 0, frozen = false, hidden = false, tx = 0, ty = 0, ay = 0, touch = false, flipped = false, axis: '' | 'x' | 'y' = ''
let col: HTMLElement | null = null, nav: HTMLElement | null = null, mo: MutationObserver | null = null
const root = () => document.documentElement
// 하단 탭을 찾고 붙일지 정한다 — 붙을 때 · 보기를 바꿀 때만 부른다(매 프레임이 아니다)
function measure() {
  col = document.querySelector<HTMLElement>('[data-mobile-col]'); nav = document.querySelector<HTMLElement>('[data-mobile-col] > nav[data-hero-below]')
  const on = !!col && root().getAttribute('data-pb-view') !== 'full' // '캐릭터만'은 탭이 제자리에 있다
  root().toggleAttribute('data-pb-nav', on)
  set(on && hidden)
}
function set(h: boolean) { hidden = h; nav?.toggleAttribute('data-pb-navhide', h) }
const inCol = (t: EventTarget | null) => !!col && t instanceof Node && col.contains(t) // 틀 밖(시트 · 다이얼로그)의 제스처는 세지 않는다
const onStart = (e: TouchEvent) => {
  touch = !frozen && inCol(e.target) && e.touches.length === 1
  if (!touch) return
  const t = e.touches[0]; tx = t.clientX; ty = ay = t.clientY; axis = ''; flipped = false
}
const onMove = (e: TouchEvent) => {
  if (!touch || e.touches.length !== 1) return
  const t = e.touches[0], y = t.clientY, dx = t.clientX - tx, dy = y - ty
  if (!axis) { if (Math.max(Math.abs(dx), Math.abs(dy)) < GESTURE) return; axis = Math.abs(dy) > Math.abs(dx) ? 'y' : 'x' } // 처음 움직인 쪽으로 정한다
  if (axis !== 'y') return
  // 기준점 = 지금 상태 쪽으로 가장 멀리 민 자리. 거기서 반대로 GESTURE 넘게 밀면 바뀐다(손가락이 위로 = 숨김)
  if (hidden) { ay = Math.min(ay, y); if (y - ay >= GESTURE) { set(false); ay = y; flipped = true } }
  else { ay = Math.max(ay, y); if (ay - y >= GESTURE) { set(true); ay = y; flipped = true } }
}
const onEnd = (e: TouchEvent) => {
  const t = e.changedTouches[0]
  if (touch && !flipped && t && axis !== 'x') {
    const dx = t.clientX - tx, dy = t.clientY - ty
    if (Math.abs(dy) >= GESTURE && Math.abs(dy) > Math.abs(dx) && dy < 0 !== hidden) set(dy < 0)
  }
  touch = false
}
const onWheel = (e: WheelEvent) => { if (!frozen && inCol(e.target) && Math.abs(e.deltaY) > Math.abs(e.deltaX) && e.deltaY) set(e.deltaY > 0) }
// 탭을 바꿔 하단 탭이 새로 붙으면 다시 찾는다
export const refreshScrollLink = () => { if (installed) measure() }
export function installScrollLink(): () => void {
  if (!installed++) {
    mo = new MutationObserver(() => measure())
    mo.observe(root(), { attributes: true, attributeFilter: ['data-pb-view'] })
    document.addEventListener('touchstart', onStart, { capture: true, passive: true })
    document.addEventListener('touchmove', onMove, { capture: true, passive: true })
    document.addEventListener('touchend', onEnd, { capture: true, passive: true })
    document.addEventListener('touchcancel', onEnd, { capture: true, passive: true })
    document.addEventListener('wheel', onWheel, { capture: true, passive: true })
    measure()
  }
  return () => {
    if (--installed) return
    for (const [k, f] of [['touchstart', onStart], ['touchmove', onMove], ['touchend', onEnd], ['touchcancel', onEnd], ['wheel', onWheel]] as const) document.removeEventListener(k, f as EventListener, true)
    mo?.disconnect(); mo = null
    set(false)
    root().removeAttribute('data-pb-nav')
    col = nav = null
  }
}
// 창(시트 · 다이얼로그)이 떠 있는 동안은 제스처를 세지 않고 그대로 둔다(시트를 끄는 손가락으로 탭이 바뀌지 않게)
export function setScrollFrozen(f: boolean) { frozen = f; if (f) touch = false }
