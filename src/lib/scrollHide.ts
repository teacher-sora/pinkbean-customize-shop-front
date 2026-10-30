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
let touch = false, sx = 0, sy = 0, ky = 0, dir = 0, across = false, viaTouch = false // viaTouch = 지금 손동작이 손가락 신호로 시작했는지(그러면 포인터 신호는 시작 · 끝에 쓰지 않는다)
const root = () => document.documentElement
// 진단 기록(dev 주소에서 ?navlog 로 켠다, ?navlog=0 으로 끈다 — 브라우저에 기억). 신호 · 걸러진 까닭 · 판단을 콘솔에 한 줄씩, window.__pbNavLog 에도 쌓는다.
// 운영 주소에서는 켜지지 않는다. 사용자가 직접 조작한 기록으로 실기기에서만 나는 문제를 짚으려고 둔다
const LOG = (() => {
  if (typeof window === 'undefined' || !/^(dev\.|localhost|127\.)/.test(location.hostname)) return false
  try {
    const q = new URLSearchParams(location.search).get('navlog')
    if (q !== null) localStorage.setItem('pb-navlog', q === '0' ? '' : '1')
    return localStorage.getItem('pb-navlog') === '1'
  } catch { return false }
})()
const t0 = typeof performance !== 'undefined' ? performance.now() : 0
const log = (what: string) => {
  if (!LOG) return
  const line = `${Math.round(performance.now() - t0)}ms ${what} | 방향 ${dir} 꺾인점 ${Math.round(ky)} 숨김 ${hidden} 손동작 ${touch} 터치로 ${viaTouch} 가로 ${across}`
  const w = window as unknown as { __pbNavLog?: string[] }
  ;(w.__pbNavLog ??= []).push(line)
  console.log('[하단탭]', line)
}
const navEl = () => document.querySelector<HTMLElement>('[data-mobile-col] > nav[data-hero-below]') // 늘 지금 것을 찾는다(탭을 바꿔 다시 붙어도)
function measure() {
  const on = !!document.querySelector('[data-mobile-col]') && root().getAttribute('data-pb-view') !== 'full' // '캐릭터만'은 탭이 제자리에 있다
  root().toggleAttribute('data-pb-nav', on)
  set(on && hidden)
}
function set(h: boolean) {
  if (h !== hidden) log(h ? '→ 숨김' : '→ 나옴')
  hidden = h
  const nav = navEl()
  if (nav && nav.hasAttribute('data-pb-navhide') !== h) nav.toggleAttribute('data-pb-navhide', h)
}
// 틀 밖(시트 · 다이얼로그 — 몸 밖에 붙는 것)의 손가락은 세지 않는다
const inCol = (t: EventTarget | null) => t instanceof Element && !!t.closest('[data-mobile-col]')
// 손동작 하나를 손가락 신호(touch)와 포인터 신호(pointer) 둘 다로 받는다 — 개발자 도구의 휴대폰 보기에서 마우스로 끌면 포인터 신호만 오고,
// 실기기는 브라우저가 스크롤을 넘겨받으면 포인터 신호가 끊긴다(pointercancel). 먼저 온 쪽으로 시작하고, 어느 쪽이 오든 같은 점 기록에 적는다
function begin(x: number, y: number, target: EventTarget | null, via: string) {
  touch = !frozen && inCol(target)
  if (!touch) { log(`${via} 시작 무시(${frozen ? '창이 떠 있음' : '틀 밖'}) y ${Math.round(y)}`); return }
  sx = x; sy = ky = y; dir = 0; across = false
  log(`${via} 시작 y ${Math.round(y)}`)
}
function move(x: number, y: number, via: string) {
  if (!touch) { log(`${via} 움직임 무시(손동작 없음) y ${Math.round(y)}`); return }
  log(`${via} 움직임 y ${Math.round(y)}`)
  const dx = Math.abs(x - sx), dy = Math.abs(y - sy)
  if (!across && dir === 0 && dx >= START_X && dx > dy) { across = true; set(true); ky = y } // 가로로 시작 — 어느 쪽이든 숨는다
  track(y, across ? STEP_X : STEP)
}
function end(y: number | null, via: string) {
  log(`${via} 끝 y ${y == null ? '-' : Math.round(y)}`)
  if (touch && y != null && dir === 0) track(y, across ? STEP_X : STEP) // 이 손동작에서 아직 방향이 정해지지 않았을 때만(정해진 것을 끝에서 뒤집지 않는다)
  touch = false
}
// 세로 한 점을 적는다: 지금 방향으로 가면 꺾인 점이 따라가고, 반대로 step 넘게 가면 방향을 바꾸며 친다
function track(y: number, step: number) {
  if (dir < 0 && y < ky) { ky = y; return } // 위로 가는 중 — 꺾인 점이 따라간다
  if (dir > 0 && y > ky) { ky = y; return }
  const d = y - ky
  if (Math.abs(d) < step || (d < 0 ? -1 : 1) === dir) return
  dir = d < 0 ? -1 : 1; ky = y; set(dir < 0) // 처음 정해졌거나 꺾었다
}
let pid = -1 // 지금 손동작의 포인터 번호
const onStart = (e: TouchEvent) => { if (e.touches.length !== 1) { log(`touch 시작 무시(손가락 ${e.touches.length}개)`); touch = false; return } const t = e.touches[0]; viaTouch = true; begin(t.clientX, t.clientY, e.target, 'touch') }
const onMove = (e: TouchEvent) => { if (e.touches.length === 1) move(e.touches[0].clientX, e.touches[0].clientY, 'touch'); else log(`touch 움직임 무시(손가락 ${e.touches.length}개)`) }
const onEnd = (e: TouchEvent) => { viaTouch = false; end(e.changedTouches[0]?.clientY ?? null, e.type === 'touchcancel' ? 'touch 취소' : 'touch') }
const onPDown = (e: PointerEvent) => { if (!e.isPrimary || (e.pointerType === 'mouse' && e.button !== 0)) return; pid = e.pointerId; if (!viaTouch) begin(e.clientX, e.clientY, e.target, `pointer(${e.pointerType})`); else log('pointer 시작(터치로 이미 시작)') }
const onPMove = (e: PointerEvent) => { if (e.pointerId === pid && e.buttons) move(e.clientX, e.clientY, 'pointer') }
const onPUp = (e: PointerEvent) => { if (e.pointerId !== pid) return; pid = -1; if (!viaTouch) end(e.type === 'pointerup' ? e.clientY : null, e.type === 'pointercancel' ? 'pointer 취소' : 'pointer'); else log(`${e.type === 'pointercancel' ? 'pointer 취소' : 'pointer 끝'}(터치가 이어 받음)`) }
const onWheel = (e: WheelEvent) => { if (!frozen && inCol(e.target) && Math.abs(e.deltaY) > Math.abs(e.deltaX) && e.deltaY) { log(`휠 ${Math.round(e.deltaY)}`); set(e.deltaY > 0) } }
export function installScrollLink(): () => void {
  if (!installed++) {
    mo = new MutationObserver(() => measure())
    mo.observe(root(), { attributes: true, attributeFilter: ['data-pb-view'] })
    document.addEventListener('touchstart', onStart, { capture: true, passive: true })
    document.addEventListener('touchmove', onMove, { capture: true, passive: true })
    document.addEventListener('touchend', onEnd, { capture: true, passive: true })
    document.addEventListener('touchcancel', onEnd, { capture: true, passive: true })
    document.addEventListener('pointerdown', onPDown, { capture: true, passive: true })
    document.addEventListener('pointermove', onPMove, { capture: true, passive: true })
    document.addEventListener('pointerup', onPUp, { capture: true, passive: true })
    document.addEventListener('pointercancel', onPUp, { capture: true, passive: true })
    document.addEventListener('wheel', onWheel, { capture: true, passive: true })
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual'
    if (window.scrollY) window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior }) // 브라우저가 이미 되살린 위치도 맨 위로(처음 한 번)
    measure()
  }
  return () => {
    if (--installed) return
    for (const [k, f] of [['touchstart', onStart], ['touchmove', onMove], ['touchend', onEnd], ['touchcancel', onEnd], ['pointerdown', onPDown], ['pointermove', onPMove], ['pointerup', onPUp], ['pointercancel', onPUp], ['wheel', onWheel]] as const) document.removeEventListener(k, f as EventListener, true)
    mo?.disconnect(); mo = null
    set(false)
    root().removeAttribute('data-pb-nav')
  }
}
// 창(시트 · 다이얼로그)이 떠 있는 동안은 제스처를 세지 않고 그대로 둔다(시트를 끄는 손가락으로 탭이 바뀌지 않게)
export function setScrollFrozen(f: boolean) { frozen = f; if (f) touch = false }
