// 모바일 하단 탭 — 자리 없이 화면 아래에 떠 있고, 손가락 제스처 방향으로 숨고 나온다(사용자 지시 — 유튜브 앱 아래 탭처럼).
//  · 손가락이 닿아 있는 동안 화면 기준 위치(clientY)를 움직임마다 적고, 마지막으로 방향을 바꾼 자리(꺾인 점)에서 STEP 넘게 가면 그 방향으로 친다 —
//    위로 = 숨김, 아래로 = 나옴. 같은 방향으로 가는 동안 꺾인 점은 손가락을 따라가므로, 휘저으면 방향이 바뀔 때마다 그대로 반응한다.
//  · 가로로 움직이기 시작하면(목록 좌우 넘기기 · 분류 줄 끌기) 어느 쪽이든 숨는다. 그 뒤의 세로 흔들림은 더 크게(STEP_X) 움직여야 친다.
//  · 손을 뗄 때 아직 방향이 정해지지 않았으면 뗀 점을 한 번 더 본다(빠르게 튕겨 움직임이 한두 번만 온 때). 마우스 휠은 휠 방향.
//  · 왜: 처음 움직인 쪽이 조금이라도 가로면 그 손동작 전체를 버리고, 틀 · 탭을 처음 한 번만 찾아 두어 휘저어도 반응이 없을 때가 많았다(사용자 지적).
//  · 스크롤은 보지 않는다 — 실제 스크롤 방향도 보게 했더니 손을 뗀 뒤 페이지 끝에서 튕겨 돌아오는 것을 '내려옴'으로 읽어, 숨기자마자 다시 나왔다(사용자 지적).
//  · 움직임은 브라우저의 전환(globals.css nav[data-pb-navhide])이고, 코드는 표시 하나만 바꾼다. 페이지는 늘 브라우저 기본대로 스크롤한다.
//  · 새로고침하면 맨 위에서 시작한다(history.scrollRestoration manual): 내려 둔 위치를 툴바가 보이는 채로 되살리면 헤더 높이보다 더 내려가 목록이 보기 설정 밑으로
//    들어갔고, 그 상태로 키패드를 여닫으면 보이는 것과 누르는 자리가 어긋났다(사용자 지적).
const STEP = 10 // 꺾인 점에서 이만큼(px) 가면 그 방향으로 친다(누르기 · 떨림은 치지 않는다)
const STEP_X = 28 // 가로로 시작한 손동작에서 세로로 치려면
const START_X = 10 // 가로로 이만큼 가고 세로보다 크면 가로로 시작한 것
let installed = 0, frozen = false, hidden = false, mo: MutationObserver | null = null
let touch = false, sx = 0, sy = 0, ky = 0, dir = 0, across = false
const root = () => document.documentElement
const navEl = () => document.querySelector<HTMLElement>('[data-mobile-col] > nav[data-hero-below]') // 늘 지금 것을 찾는다(탭을 바꿔 다시 붙어도)
function measure() {
  const on = !!document.querySelector('[data-mobile-col]') && root().getAttribute('data-pb-view') !== 'full' // '캐릭터만'은 탭이 제자리에 있다
  root().toggleAttribute('data-pb-nav', on)
  set(on && hidden)
}
function set(h: boolean) {
  hidden = h
  const nav = navEl()
  if (nav && nav.hasAttribute('data-pb-navhide') !== h) nav.toggleAttribute('data-pb-navhide', h)
}
// 틀 밖(시트 · 다이얼로그 — 몸 밖에 붙는 것)의 손가락은 세지 않는다
const inCol = (t: EventTarget | null) => t instanceof Element && !!t.closest('[data-mobile-col]')
const onStart = (e: TouchEvent) => {
  touch = !frozen && e.touches.length === 1 && inCol(e.target)
  if (!touch) return
  const t = e.touches[0]; sx = t.clientX; sy = ky = t.clientY; dir = 0; across = false
}
// 세로 한 점을 적는다: 지금 방향으로 가면 꺾인 점이 따라가고, 반대로 step 넘게 가면 방향을 바꾸며 친다
function track(y: number, step: number) {
  if (dir < 0 && y < ky) { ky = y; return } // 위로 가는 중 — 꺾인 점이 따라간다
  if (dir > 0 && y > ky) { ky = y; return }
  const d = y - ky
  if (Math.abs(d) < step || (d < 0 ? -1 : 1) === dir) return
  dir = d < 0 ? -1 : 1; ky = y; set(dir < 0) // 처음 정해졌거나 꺾었다
}
const onMove = (e: TouchEvent) => {
  if (!touch || e.touches.length !== 1) return
  const t = e.touches[0], dx = Math.abs(t.clientX - sx), dy = Math.abs(t.clientY - sy)
  if (!across && dir === 0 && dx >= START_X && dx > dy) { across = true; set(true); ky = t.clientY } // 가로로 시작 — 어느 쪽이든 숨는다
  track(t.clientY, across ? STEP_X : STEP)
}
const onEnd = (e: TouchEvent) => {
  const t = e.changedTouches[0]
  if (touch && t && dir === 0) track(t.clientY, across ? STEP_X : STEP) // 이 손동작에서 아직 방향이 정해지지 않았을 때만(정해진 것을 끝에서 뒤집지 않는다)
  touch = false
}
const onWheel = (e: WheelEvent) => { if (!frozen && inCol(e.target) && Math.abs(e.deltaY) > Math.abs(e.deltaX) && e.deltaY) set(e.deltaY > 0) }
export function installScrollLink(): () => void {
  if (!installed++) {
    mo = new MutationObserver(() => measure())
    mo.observe(root(), { attributes: true, attributeFilter: ['data-pb-view'] })
    document.addEventListener('touchstart', onStart, { capture: true, passive: true })
    document.addEventListener('touchmove', onMove, { capture: true, passive: true })
    document.addEventListener('touchend', onEnd, { capture: true, passive: true })
    document.addEventListener('touchcancel', onEnd, { capture: true, passive: true })
    document.addEventListener('wheel', onWheel, { capture: true, passive: true })
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual'
    if (window.scrollY) window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior }) // 브라우저가 이미 되살린 위치도 맨 위로(처음 한 번)
    measure()
  }
  return () => {
    if (--installed) return
    for (const [k, f] of [['touchstart', onStart], ['touchmove', onMove], ['touchend', onEnd], ['touchcancel', onEnd], ['wheel', onWheel]] as const) document.removeEventListener(k, f as EventListener, true)
    mo?.disconnect(); mo = null
    set(false)
    root().removeAttribute('data-pb-nav')
  }
}
// 창(시트 · 다이얼로그)이 떠 있는 동안은 제스처를 세지 않고 그대로 둔다(시트를 끄는 손가락으로 탭이 바뀌지 않게)
export function setScrollFrozen(f: boolean) { frozen = f; if (f) touch = false }
