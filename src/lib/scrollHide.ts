// 모바일 하단 탭 — 자리 없이 화면 아래에 떠 있고, 목록이 움직이는 동안만 잠깐 숨었다가 멈추면 다시 나온다(사용자 지시 — 탭을 숨기는 까닭은 목록을 깔끔하게 보려는 것이다).
//  · 목록 = 쪽을 넘기는 스크롤 칸(data-pb-list — 코디 · AI 검색 · 룩북 · 광장 · 프리셋 · 코디 정보). 가로든 세로든 그 칸의 스크롤만 본다. 페이지 스크롤 · 분류 줄은 보지 않는다.
//  · 손가락 · 휠로 움직인 때만 친다(armed) — 쪽 위치를 되살리거나 번호로 건너뛰는 코드 스크롤에는 숨지 않는다. 손을 뗀 뒤의 관성은 스크롤이 이어지는 동안 그대로 친다.
//  · 손을 뗀 뒤 관성이 잦아들어 속도가 SLOW_SPEED 아래로 떨어지면 다 멈추기 전에 나온다(사용자 지시 — 완전히 멈출 때까지 기다리면 늦다). 끝까지 스크롤이 없으면 STOP_MS 뒤에 나온다.
//  · 손가락이 닿아 있는 동안은 움직이지 않아도 나오지 않는다(사용자 지시 — 붙잡고 보는 중이다). 뗀 뒤에 위 규칙을 탄다.
//  · 위 손가락 규칙은 안드로이드 등 터치가 오는 환경의 것이다. 아이폰은 관성을 끊는 터치를 웹에 알리지 않아(WebKit 이 일부러 막는다 — touchstart · touchmove · touchend · pointerdown 모두 오지 않는다)
//    터치를 보지 않고 스크롤만 본다(사용자 지시): 움직이면 숨고, SLOW_SPEED 아래로 느려지거나 멈추면 나온다. 붙잡아 두는 것은 없다.
//  · 페이지가 맨 아래면 숨기지 않는다 — 틀 아래에 탭 높이만큼 여백이 있어(ListArea useMobileRows 의 --pb-nav-h) 탭이 아무것도 가리지 않는다.
//  · 움직임은 브라우저의 전환(globals.css nav[data-pb-navhide])이고, 코드는 표시 하나만 바꾼다. 페이지는 늘 브라우저 기본대로 스크롤한다.
//  · 새로고침하면 맨 위에서 시작한다(history.scrollRestoration manual): 내려 둔 위치를 툴바가 보이는 채로 되살리면 목록이 어긋났고, 그 상태로 키패드를 여닫으면
//    보이는 것과 누르는 자리가 어긋났다(사용자 지적).
const STOP_MS = 160 // 스크롤이 이만큼 없으면 멈춘 것
const SLOW_SPEED = 0.3 // 손을 뗀 뒤 이 속도(px/ms) 아래면 거의 멈춘 것 — 나오는 때를 앞당기거나 늦추는 값
const isIOS = () => /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) // 아이폰의 크롬도 WebKit 이다. 안드로이드는 터치가 와서 해당 없다
let installed = 0, frozen = false, hidden = false, mo: MutationObserver | null = null
let armed = false, finger = false, viaTouch = false, stopT: ReturnType<typeof setTimeout> | undefined
let lastEl: Element | null = null, lastPos = 0, lastT = 0, speed = Infinity // 이벤트 사이 속도의 평균(한 번 튀는 값에 나오지 않게)
let ios = false
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
const atBottom = () => window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2
// 손을 뗀 뒤 나온다 — 여기서 끝이라 남은 관성은 다시 숨기지 않는다
function show() { clearTimeout(stopT); set(false); armed = false }
// 멈춤을 기다린다 — 스크롤이 이어지면 다시 잰다. 손가락이 닿아 있으면 기다리지 않는다(뗄 때 end 가 다시 부른다)
function wait() {
  clearTimeout(stopT)
  if (!finger) stopT = setTimeout(show, STOP_MS)
}
function begin(t: EventTarget | null) { if (!ios && !frozen && inCol(t)) { clearTimeout(stopT); armed = finger = true } }
function end() { if (finger) { finger = false; wait() } }
// 손동작을 손가락 신호와 포인터 신호 둘 다로 받는다 — 개발자 도구의 휴대폰 보기에서 마우스로 끌면 포인터 신호만 온다. 실기기는 손가락 신호가 끝까지 온다
const onStart = (e: TouchEvent) => { viaTouch = true; begin(e.target) }
const onEnd = (e: TouchEvent) => { if (e.touches.length) return; viaTouch = false; end() }
const onPDown = (e: PointerEvent) => { if (!viaTouch && e.isPrimary) begin(e.target) }
const onPUp = () => { if (!viaTouch) end() }
const onWheel = (e: WheelEvent) => { if (!ios && !frozen && inCol(e.target)) { armed = true; wait() } }
const onScroll = (e: Event) => {
  if (!(armed || ios) || frozen || !(e.target instanceof Element) || !e.target.matches('[data-pb-list]')) return
  const el = e.target, pos = el.scrollLeft + el.scrollTop, dt = e.timeStamp - lastT
  const now = el === lastEl && dt > 0 && dt < 100 ? Math.abs(pos - lastPos) / dt : Infinity
  speed = speed === Infinity || now === Infinity ? now : (speed + now) / 2
  lastEl = el; lastPos = pos; lastT = e.timeStamp
  if (ios && speed === Infinity) return // 잴 수 없는 한 번(첫 스크롤 · 코드로 건너뜀)은 움직임으로 치지 않는다
  if (!finger && speed < SLOW_SPEED) { show(); return }
  if (!atBottom()) set(true)
  wait()
}
export function installScrollLink(): () => void {
  if (!installed++) {
    ios = isIOS()
    mo = new MutationObserver(() => measure())
    mo.observe(root(), { attributes: true, attributeFilter: ['data-pb-view'] })
    document.addEventListener('touchstart', onStart, { capture: true, passive: true })
    document.addEventListener('touchend', onEnd, { capture: true, passive: true })
    document.addEventListener('touchcancel', onEnd, { capture: true, passive: true })
    document.addEventListener('pointerdown', onPDown, { capture: true, passive: true })
    document.addEventListener('pointerup', onPUp, { capture: true, passive: true })
    document.addEventListener('pointercancel', onPUp, { capture: true, passive: true })
    document.addEventListener('wheel', onWheel, { capture: true, passive: true })
    document.addEventListener('scroll', onScroll, { capture: true, passive: true }) // 스크롤은 거품이 오르지 않아 잡는 단계에서 듣는다
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual'
    if (window.scrollY) window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior }) // 브라우저가 이미 되살린 위치도 맨 위로(처음 한 번)
    measure()
  }
  return () => {
    if (--installed) return
    for (const [k, f] of [['touchstart', onStart], ['touchend', onEnd], ['touchcancel', onEnd], ['pointerdown', onPDown], ['pointerup', onPUp], ['pointercancel', onPUp], ['wheel', onWheel], ['scroll', onScroll]] as const) document.removeEventListener(k, f as EventListener, true)
    mo?.disconnect(); mo = null
    clearTimeout(stopT)
    set(false)
    root().removeAttribute('data-pb-nav')
  }
}
// 창(시트 · 다이얼로그)이 떠 있는 동안은 움직임을 세지 않는다(시트를 끄는 손가락으로 탭이 바뀌지 않게)
export function setScrollFrozen(f: boolean) { frozen = f; if (f) { armed = finger = false; clearTimeout(stopT); set(false) } }
