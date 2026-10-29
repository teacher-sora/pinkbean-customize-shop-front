import { RELAYOUT_EVENT } from './heroView'
// 모바일: 내용 위에 떠 있는 머리 · 하단 탭 — 유튜브 앱처럼(사용자 지시). 모두 내용을 가리기만 하고 페이지를 밀지 않는다.
//  · 떠 있는 것(position:fixed, 칸 data-pb-track): 맨 위 헤더(data-app-header) · 미리보기(data-hero) · 머리 묶음(data-sticky-top = 분류 줄 data-pb-cat + 목록 머리 줄).
//    접히는 것은 맨 위 헤더와 분류 줄뿐이다. 접히면 헤더가 위로 빠지고 미리보기가 그만큼 올라가며, 분류 줄은 미리보기 뒤로 들어가 목록 머리 줄(보기 설정)이
//    미리보기 바로 아래에 남는다(사용자 지시 — 목록 머리는 늘 보인다).
//  · 하단 탭: 자리 없이 화면 아래에 떠 있다.
//  · 움직임은 손가락 제스처만 본다(사용자 지시 — 바텀 시트를 끌어 내리듯): 손가락을 댄 자리에서 위로 GESTURE 넘게 밀면(내용을 내리는 쪽) 접히고 탭이 숨고,
//    아래로 밀면 펼쳐진다. 한 제스처 안에서 방향을 바꾸면 그 자리부터 다시 센다. 가로로 넘기는 제스처는 세지 않는다. 손을 뗀 뒤의 관성 스크롤 · 끝에서 튕기는 것은
//    보지 않는다(스크롤을 보았더니 튕겨 돌아오는 것을 올림으로 읽어 접힐 틈이 없었다 — 사용자 지적). 마우스 휠은 휠 방향. 위치는 브라우저의 전환(globals.css)이 그린다 —
//    코드는 방향이 바뀌는 순간 html[data-pb-up] · nav[data-pb-navhide] 만 바꾼다. 왜: 스크롤한 만큼 따라 움직이게 했더니(코드가 매 프레임 위치를 적었다)
//    아이폰에서 30프레임처럼 끊겨 보였고, 손을 떼면 끝까지 붙이려 페이지를 밀던 것도 어색했다(사용자 지적).
//  · 스크롤 위치와 상관없다(맨 위 근처는 늘 펼치게 했더니 짧은 페이지에서는 끝에 닿아야만 접혔다).
// 스크롤은 두 가지다. 페이지 스크롤(코디 정보 / 염색 · 가로 목록): 자리 틀(.headerSlotM · .heroSlotM · .barM)이 원래 높이를 잡고, 떠 있는 것은 그 위에 겹친다.
// 목록 칸 안 스크롤(세로 목록 · 광장 · 룩북 · 프리셋 — data-pb-iscroll, html[data-pb-inner]): 페이지는 화면 높이로 서 있고, 칸이 미리보기 자리 바로 아래부터
// 화면 끝까지다. 칸 위 여백(--pb-ipad)이 펼친 머리들의 높이라 맨 위는 가려지지 않는다.
const GESTURE = 8 // 손가락이 같은 방향으로 이만큼(px) 움직이면 그 방향으로 친다(누르기 · 떨림은 치지 않는다)
type Els = { col: HTMLElement; is: HTMLElement | null; hT: HTMLElement | null; hdr: HTMLElement | null; eT: HTMLElement; hero: HTMLElement; bS: HTMLElement | null; bT: HTMLElement | null; bar: HTMLElement | null; nav: HTMLElement | null }
let installed = 0, frozen = false, up = false, navHid = false, tx = 0, ty = 0, ay = 0, touch = false, axis: '' | 'x' | 'y' = ''
let E: Els | null = null, ro: ResizeObserver | null = null, mo: MutationObserver | null = null, roTargets: Element[] = []
const root = () => document.documentElement
const q = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)
const px = (n: number) => `${Math.round(n)}px`
const setTop = (el: HTMLElement | null, v: string) => { if (el && el.style.top !== v) el.style.top = v }
const setVar = (k: string, v: string) => { if (root().style.getPropertyValue(k) !== v) root().style.setProperty(k, v) }
function find(): Els | null {
  const col = q('[data-mobile-col]'), eT = q('[data-pb-track="hero"]'), hero = q('[data-hero]')
  if (!col || !eT || !hero || root().getAttribute('data-pb-view') === 'full') return null // '캐릭터만'은 띄울 것이 없다
  const bT = q('[data-pb-track="bar"]')
  return { col, is: col.querySelector<HTMLElement>('[data-pb-iscroll]'), hT: q('[data-pb-track="hdr"]'), hdr: q('[data-app-header]'), eT, hero, bS: bT?.parentElement ?? null, bT, bar: q('[data-sticky-top]'), nav: q('[data-mobile-col] > nav[data-hero-below]') }
}
// 잰 값(높이 · 자리)으로 떠 있는 것들의 자리를 적는다 — 크기가 바뀔 때만 부른다(매 프레임이 아니다)
function measure() {
  E = find()
  watch()
  if (!E) { unfloat(); return }
  const { col, hT, hdr, eT, hero, bS, bT, bar, is } = E
  const inner = !!is
  const changed = inner !== root().hasAttribute('data-pb-inner')
  if (changed) root().toggleAttribute('data-pb-inner', inner)
  const hH = hdr?.offsetHeight ?? 0, heroH = hero.offsetHeight, bH = bar?.offsetHeight ?? 0
  const cH = bar?.querySelector<HTMLElement>('[data-pb-cat]')?.offsetHeight ?? 0
  if (bS && bar) { const h = px(inner ? 0 : bH); if (bS.style.height !== h) bS.style.height = h } // 페이지 스크롤에서는 자리 틀이 원래 높이를 잡는다
  // 떠 있는 자리 = 펼친 때 자리 틀의 자리(틀 위 기준). 목록 칸 안 스크롤에서는 헤더 · 머리 묶음 자리가 비어 미리보기 바로 아래다
  const y = window.scrollY, colTop = col.getBoundingClientRect().top + y
  setTop(hT, '0px'); setTop(eT, px(hH))
  setTop(bT, px(inner || !bS ? hH + heroH : bS.getBoundingClientRect().top + y - colTop))
  setVar('--pb-cat-h', px(cH)); setVar('--pb-ctrl-h', px(bH - cH)); setVar('--pb-ipad', px(hH + bH))
  root().setAttribute('data-pb-float', '')
  if (changed) relayout() // 자리 틀까지 다 적은 뒤에(먼저 알리면 머리 묶음 자리가 빠진 채로 쟀다)
}
function unfloat() {
  for (const k of ['data-pb-float', 'data-pb-inner', 'data-pb-up']) root().removeAttribute(k)
  E?.nav?.removeAttribute('data-pb-navhide')
  up = false; navHid = false
}
// 들어가고 나올 때 목록 높이를 다시 재게 알린다(ListArea useMobileRows — 틀 최소 높이는 페이지 스크롤 때만 잰다)
const relayout = () => window.dispatchEvent(new Event(RELAYOUT_EVENT))
const fold = (f: boolean) => { if (f !== up) { up = f; root().toggleAttribute('data-pb-up', f) } }
// 접기(true) · 펼치기(false) — 하단 탭도 같은 쪽으로 숨고 나온다
function go(down: boolean) {
  if (!E || frozen) return
  fold(down)
  const nav = E.nav
  if (nav && down !== navHid) { navHid = down; nav.toggleAttribute('data-pb-navhide', down) }
}
const inCol = (t: EventTarget | null) => !!E && t instanceof Node && E.col.contains(t) // 틀 밖(시트 · 다이얼로그)의 제스처는 세지 않는다
const onStart = (e: TouchEvent) => {
  touch = inCol(e.target) && e.touches.length === 1
  if (!touch) return
  const t = e.touches[0]; tx = t.clientX; ty = ay = t.clientY; axis = ''
}
const onMove = (e: TouchEvent) => {
  if (!touch || e.touches.length !== 1) return
  const t = e.touches[0], dx = t.clientX - tx, dy = t.clientY - ty
  if (!axis) { if (Math.max(Math.abs(dx), Math.abs(dy)) < GESTURE) return; axis = Math.abs(dy) > Math.abs(dx) ? 'y' : 'x' } // 처음 움직인 쪽으로 정한다
  if (axis !== 'y') return
  // 기준점 = 지금 상태 쪽으로 가장 멀리 민 자리. 거기서 반대로 GESTURE 만큼 밀면 바뀐다(펼친 채 위로 밀면 접히고, 접힌 채 아래로 밀면 펼쳐진다)
  const y = t.clientY
  if (up) { ay = Math.min(ay, y); if (y - ay >= GESTURE) { go(false); ay = y } }
  else { ay = Math.max(ay, y); if (ay - y >= GESTURE) { go(true); ay = y } }
}
const onEnd = () => { touch = false }
const onWheel = (e: WheelEvent) => { if (!touch && inCol(e.target) && Math.abs(e.deltaY) > Math.abs(e.deltaX) && e.deltaY) go(e.deltaY > 0) }
// 크기가 바뀌면(보기 설정 · 줄 바꿈 · 탭 전환) 다시 잰다
function watch() {
  const next = E ? [E.col, E.hdr, E.hero, E.bar, E.is].filter((el): el is HTMLElement => !!el) : []
  if (next.length === roTargets.length && next.every((el, i) => el === roTargets[i])) return
  ro?.disconnect(); roTargets = next
  for (const el of next) ro?.observe(el)
}
// 탭을 바꾸거나 새 머리 묶음이 붙으면 바로 다시 잰다(그리기 전에 — StickyBarM 의 layout effect)
export const refreshScrollLink = () => { if (installed) measure() }
export function installScrollLink(): () => void {
  if (!installed++) {
    ro = new ResizeObserver(() => measure())
    mo = new MutationObserver(() => measure())
    mo.observe(root(), { attributes: true, attributeFilter: ['data-pb-view'] })
    document.addEventListener('touchstart', onStart, { capture: true, passive: true })
    document.addEventListener('touchmove', onMove, { capture: true, passive: true })
    document.addEventListener('touchend', onEnd, { capture: true, passive: true })
    document.addEventListener('touchcancel', onEnd, { capture: true, passive: true })
    document.addEventListener('wheel', onWheel, { capture: true, passive: true })
    window.addEventListener('resize', refreshScrollLink)
    measure()
  }
  return () => {
    if (--installed) return
    for (const [k, f] of [['touchstart', onStart], ['touchmove', onMove], ['touchend', onEnd], ['touchcancel', onEnd], ['wheel', onWheel]] as const) document.removeEventListener(k, f as EventListener, true)
    window.removeEventListener('resize', refreshScrollLink)
    ro?.disconnect(); mo?.disconnect(); ro = mo = null; roTargets = []
    unfloat()
    E = null
  }
}
// 창(시트 · 다이얼로그)이 떠 있는 동안은 제스처를 세지 않고 그대로 둔다(시트를 끌어 내리는 손가락으로 머리 · 탭이 접히고 펼쳐지지 않게)
export function setScrollFrozen(f: boolean) { frozen = f; if (f) touch = false }
