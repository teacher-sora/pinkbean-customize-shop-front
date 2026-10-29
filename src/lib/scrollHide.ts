// 모바일: 스크롤에 붙어 숨고 나오는 것들 — 유튜브 앱의 위 머리처럼(사용자 지시): 스크롤과 같은 속도로 따라 움직이고, 숨을수록 흐려지며,
// 중간에서 손을 떼면 마지막으로 움직인 방향으로 끝까지 붙는다(그만큼 페이지 스크롤도 함께 밀린다).
//  · 위쪽 묶음 = 맨 위 헤더(data-app-header) · 미리보기(data-hero) · 머리 묶음(data-sticky-top — 부위 · 분류 줄 + 목록 머리).
//    내린 만큼 '숨김량' Z 가 쌓여(0 ~ 헤더 + 머리 묶음 높이) 먼저 헤더가 미리보기와 함께 올라가고, 이어서 머리 묶음이 미리보기 뒤로 들어간다.
//    올리면 머리 묶음이 먼저, 더 올리면 헤더까지 나온다. Z 는 지금 스크롤 양을 넘지 않는다(맨 위 근처는 제자리와 같다). 미리보기는 늘 화면에 남는다.
//  · 하단 탭: 내린 만큼 아래로 숨고 올린 만큼 나온다(0 ~ 탭 높이). 페이지 끝에서는 탭 자리가 내용과 함께 올라와 보인다(그만큼은 숨기지 않는다).
// ⚠️ 움직이는 동안 위쪽 묶음은 페이지에 그 자리 그대로 박아 둔다(position:absolute — 브라우저가 내용과 함께 스크롤해 100% 같은 속도).
//    다 나왔거나 다 숨었거나 멈춰 있는 것은 화면에 고정한다(position:fixed). 바꾸는 것은 상태가 바뀌는 순간뿐이다.
//    예전처럼 매 프레임 transform 을 적으면 아이폰은 화면이 먼저 스크롤되고 코드가 한 프레임 늦게 따라와 툭툭 끊겼다(사용자 지적).
//    하단 탭은 내용과 반대로 움직여야 해서 transform 으로 적는다. 자리(빈 칸)는 각자의 틀이 원래 높이로 잡아 둔다(아래가 밀리지 않게).
// 스크롤 위치는 페이지 범위 안으로 잘라 읽는다(아이폰이 끝에서 튕기며 되돌아오는 것을 움직임으로 읽지 않게).
const SNAP_IDLE = 90 // 손을 떼고 스크롤이 이만큼 멈추면 끝까지 붙인다(ms)
const DIR_MIN = 2 // 이보다 작은 움직임은 방향으로 치지 않는다(손가락 떨림)
type Mode = { m: 'fixed' | 'abs' | ''; top: number }
let installed = 0, frozen = false, last = 0, Z = 0, N = 0, raf = 0, dir = 0, touching = false, idle = 0, snapping = false
const modes = new WeakMap<HTMLElement, Mode>()
const pos = () => Math.min(Math.max(0, window.scrollY), Math.max(0, document.documentElement.scrollHeight - window.innerHeight))
const q = (sel: string) => document.querySelector<HTMLElement>(sel)
const els = () => ({ col: q('[data-mobile-col]'), hdr: q('[data-app-header]'), hero: q('[data-hero]'), bar: q('[data-sticky-top]'), nav: q('[data-mobile-col] > nav[data-hero-below]') })
const linkedNow = () => document.documentElement.getAttribute('data-pb-view') !== 'full' // '캐릭터만'은 페이지가 스크롤되지 않는다
// 위치 적기: 움직이는 중이면 페이지 좌표(abs, 문서 기준 top)로, 아니면 화면 좌표(fixed)로. 같으면 아무것도 쓰지 않는다
function place(el: HTMLElement | null, v: number, moving: boolean, colTop: number, y: number, z: number) {
  if (!el) return
  const want: Mode = moving ? { m: 'abs', top: Math.round(y + v - colTop) } : { m: 'fixed', top: Math.round(v) }
  const cur = modes.get(el)
  if (cur && cur.m === want.m && cur.top === want.top) return
  modes.set(el, want)
  Object.assign(el.style, { position: want.m === 'abs' ? 'absolute' : 'fixed', top: `${want.top}px`, left: '0', right: '0', zIndex: String(z) })
}
function clear(el: HTMLElement | null) {
  if (!el || !modes.get(el)?.m) return
  modes.set(el, { m: '', top: 0 })
  Object.assign(el.style, { position: '', top: '', left: '', right: '', zIndex: '', opacity: '' })
}
const fade = (el: HTMLElement | null, a: number) => { if (!el) return; const v = a >= 1 ? '' : String(Math.max(0, a).toFixed(3)); if (el.style.opacity !== v) el.style.opacity = v }
function frame(useDelta: boolean) {
  raf = 0
  const { col, hdr, hero, bar, nav } = els()
  const y = pos(), d = useDelta ? y - last : 0
  last = y
  if (Math.abs(d) >= DIR_MIN) dir = Math.sign(d)
  if (!col || !hero || !linkedNow()) { for (const el of [hdr, hero, bar]) clear(el); if (nav) { nav.style.transform = ''; fade(nav, 1) } return }
  const hH = hdr?.offsetHeight ?? 0, heroH = hero.offsetHeight
  // 머리 묶음 안에 입력이 잡혀 있거나 펼친 칸(보기 설정)이 열려 있으면 묶음은 숨기지 않는다(자판이 뜨거나 고르려고 화면이 움직여도 남는다)
  const keep = !!bar && (bar.matches(':focus-within') || !!bar.querySelector('[aria-expanded="true"]'))
  const bH = bar && !keep ? bar.offsetHeight : 0
  const prev = Z
  Z = Math.min(Math.max(0, Z + d), Math.min(hH + bH, y))
  const hO = Math.min(Z, hH), bO = Z - hO, pH = Math.min(prev, hH)
  const colTop = col.getBoundingClientRect().top + y
  // 헤더 · 미리보기는 헤더 숨김량(hO)이 바뀌는 동안, 머리 묶음은 전체 숨김량(Z)이 바뀌는 동안 움직인다
  const movingTop = hO !== pH, movingBar = Z !== prev
  place(hdr, -hO, movingTop, colTop, y, 32); fade(hdr, hH ? 1 - hO / hH : 1)
  place(hero, hH - hO, movingTop, colTop, y, 31)
  if (bar) {
    const slot = bar.parentElement
    if (slot && slot.style.height !== `${bar.offsetHeight}px`) slot.style.height = `${bar.offsetHeight}px` // 틀이 원래 높이를 잡아 둔다
    place(bar, hH - hO + heroH - bO, movingBar, colTop, y, 30); fade(bar, bH ? 1 - bO / bH : 1)
  }
  if (nav) {
    const nH = nav.offsetHeight, shown = Math.min(Math.max(0, y + window.innerHeight - (document.documentElement.scrollHeight - nH)), nH)
    N = Math.min(Math.max(0, N + d), nH - shown)
    const v = N ? `translate3d(0, ${N}px, 0)` : ''
    if (nav.style.transform !== v) nav.style.transform = v
    fade(nav, nH ? 1 - N / nH : 1)
  }
}
// 손을 떼고 멈추면 중간에 걸친 것을 끝까지 붙인다 — 마지막으로 움직인 방향으로(감도 — 사용자 지시: 조금만 움직여도 끝까지). 위쪽 묶음은 페이지 스크롤로 민다
function snap() {
  if (touching || frozen || snapping || !linkedNow()) return
  const { hdr, bar, nav } = els()
  const hH = hdr?.offsetHeight ?? 0, bH = bar?.offsetHeight ?? 0, y = pos()
  const hO = Math.min(Z, hH)
  let target = Z
  if (hO > 0 && hO < hH) target = dir > 0 ? hH : 0
  else if (Z > hH && Z < hH + bH) target = dir > 0 ? hH + bH : hH
  if (target !== Z) {
    const max = document.documentElement.scrollHeight - window.innerHeight
    const by = Math.max(-y, Math.min(max - y, target - Z))
    if (by) { snapping = true; window.scrollBy({ top: by, behavior: 'smooth' }); setTimeout(() => { snapping = false }, 400) }
  }
  if (nav) {
    const nH = nav.offsetHeight
    if (N > 0 && N < nH) {
      N = dir > 0 ? nH : 0
      nav.style.transition = 'transform .18s cubic-bezier(.45,0,.55,1), opacity .18s ease'
      nav.style.transform = N ? `translate3d(0, ${N}px, 0)` : ''; fade(nav, N ? 0 : 1)
      setTimeout(() => { nav.style.transition = '' }, 200)
    }
  }
}
const armSnap = () => { window.clearTimeout(idle); idle = window.setTimeout(snap, SNAP_IDLE) }
const onScroll = () => { if (frozen) return; if (!raf) raf = requestAnimationFrame(() => frame(true)); armSnap() }
const onDown = () => { touching = true; window.clearTimeout(idle) }
const onUp = () => { touching = false; armSnap() }
// 탭을 바꾸거나 새 머리 묶음이 붙으면 지금 숨김량대로 바로 적는다(움직임 없이)
export const refreshScrollLink = () => { if (installed) frame(false) }
export function installScrollLink(): () => void {
  if (!installed++) {
    last = pos(); Z = 0; N = 0
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', refreshScrollLink)
    window.addEventListener('touchstart', onDown, { passive: true })
    window.addEventListener('touchend', onUp, { passive: true })
    window.addEventListener('touchcancel', onUp, { passive: true })
    frame(false)
  }
  return () => {
    if (--installed) return
    window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', refreshScrollLink)
    window.removeEventListener('touchstart', onDown); window.removeEventListener('touchend', onUp); window.removeEventListener('touchcancel', onUp)
    window.clearTimeout(idle); if (raf) cancelAnimationFrame(raf); raf = 0
    const { hdr, hero, bar, nav } = els()
    for (const el of [hdr, hero, bar]) clear(el)
    if (bar?.parentElement) bar.parentElement.style.height = ''
    if (nav) { nav.style.transform = ''; fade(nav, 1) }
  }
}
// 창(시트 · 다이얼로그)이 떠 있는 동안은 스크롤을 보지 않고 그대로 둔다. 시트는 뒤 페이지를 position:fixed 로 고정해 스크롤이 0 이 됐다가
// 닫을 때 제자리로 돌아가는데, 그것을 '맨 위로 올림' · '내림'으로 읽어 탭이 나타났다 사라졌다(연출 설정 — 사용자 지적). 풀리면 지금 위치에서 다시 센다.
export function setScrollFrozen(f: boolean) {
  if (f === frozen) return
  frozen = f
  if (!f) last = pos()
}
