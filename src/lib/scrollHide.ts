import { RELAYOUT_EVENT } from './heroView'
// 모바일: 내용 위에 떠 있는 머리 · 하단 탭 — 유튜브 앱처럼(사용자 지시). 모두 내용을 가리기만 하고 페이지를 밀지 않는다.
//  · 떠 있는 것(position:fixed, 칸 data-pb-track): 맨 위 헤더(data-app-header) · 미리보기(data-hero) · 머리 묶음(data-sticky-top = 분류 줄 data-pb-cat + 목록 머리 줄).
//    접히는 것은 맨 위 헤더와 분류 줄뿐이다. 접히면 헤더가 위로 빠지고 미리보기가 그만큼 올라가며, 분류 줄은 미리보기 뒤로 들어가 목록 머리 줄(보기 설정)이
//    미리보기 바로 아래에 남는다(사용자 지시 — 목록 머리는 늘 보인다).
//  · 하단 탭: 자리 없이 화면 아래에 떠 있다.
//  · 헤더 · 분류 줄은 바텀 시트처럼 손가락을 그대로 따라 접히고 펼쳐진다(사용자 지시): 세로 제스처 동안 손가락이 움직인 만큼 접힌 양 F(0 ~ 헤더 + 분류 줄)가
//    바뀌고, 손을 떼면 그 제스처에서 SNAP 넘게 움직였으면 그쪽 끝까지, 아니면 제자리로 전환(html[data-pb-anim])을 타고 간다. 끄는 동안에는 전환 없이 바로 적는다
//    (떠 있는 것만 움직여 내용과 겨루지 않는다 — 스크롤을 따라 적던 때는 아이폰에서 30프레임처럼 끊겼다).
//  · 하단 탭은 방향만 본다: 같은 제스처에서 위로 GESTURE 넘게 밀면 숨고 아래로 밀면 나온다. 움직임은 탭 제 전환(nav[data-pb-navhide]).
//  · 처음 움직인 쪽이 가로면(목록 좌우 넘기기) 세지 않는다. 손을 뗀 뒤의 관성 스크롤 · 끝에서 튕기는 것은 보지 않는다(스크롤을 보았더니 튕겨 돌아오는 것을
//    올림으로 읽어 접힐 틈이 없었다 — 사용자 지적). 마우스 휠은 휠 방향으로 끝까지.
//  · 스크롤 위치와 상관없다(맨 위 근처는 늘 펼치게 했더니 짧은 페이지에서는 끝에 닿아야만 접혔다).
// 스크롤은 두 가지다. 페이지 스크롤(코디 정보 / 염색 · 가로 목록): 자리 틀(.headerSlotM · .heroSlotM · .barM)이 원래 높이를 잡고, 떠 있는 것은 그 위에 겹친다.
// 목록 칸 안 스크롤(세로 목록 · 광장 · 룩북 · 프리셋 — data-pb-iscroll, html[data-pb-inner]): 페이지는 화면 높이로 서 있고, 칸이 미리보기 자리 바로 아래부터
// 화면 끝까지다. 칸 위 여백(--pb-ipad)이 펼친 머리들의 높이라 맨 위는 가려지지 않는다.
const GESTURE = 8 // 손가락이 이만큼(px) 움직여야 제스처로 친다(누르기 · 떨림은 치지 않는다). 하단 탭도 같은 쪽으로 이만큼 밀면 바뀐다
const SNAP = 0.3 // 손을 뗄 때 접힌 양의 이 비율 넘게 움직였으면 그쪽 끝까지 간다(바텀 시트처럼)
const ANIM = 260 // 끝까지 가는 전환 시간(ms, globals.css 와 같은 값 + 여유)
type Els = { col: HTMLElement; is: HTMLElement | null; hT: HTMLElement | null; hdr: HTMLElement | null; eT: HTMLElement; hero: HTMLElement; bS: HTMLElement | null; bT: HTMLElement | null; bar: HTMLElement | null; cat: HTMLElement | null; nav: HTMLElement | null }
const D = { hH: 0, cH: 0, max: 0 }
let installed = 0, frozen = false, F = 0, up = false, navHid = false, tx = 0, ty = 0, ny = 0, fy = 0, ly = 0, sy = 0, F0 = 0, touch = false, drag = false, axis: '' | 'x' | 'y' = '', animT = 0
let E: Els | null = null, ro: ResizeObserver | null = null, mo: MutationObserver | null = null, roTargets: Element[] = []
const root = () => document.documentElement
const q = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)
const px = (n: number) => `${Math.round(n)}px`
const setTop = (el: HTMLElement | null, v: string) => { if (el && el.style.top !== v) el.style.top = v }
const setVar = (k: string, v: string) => { if (root().style.getPropertyValue(k) !== v) root().style.setProperty(k, v) }
const setSt = (el: HTMLElement | null, k: 'translate' | 'opacity' | 'pointer-events', v: string) => { if (el && el.style.getPropertyValue(k) !== v) el.style.setProperty(k, v) }
function find(): Els | null {
  const col = q('[data-mobile-col]'), eT = q('[data-pb-track="hero"]'), hero = q('[data-hero]')
  if (!col || !eT || !hero || root().getAttribute('data-pb-view') === 'full') return null // '캐릭터만'은 띄울 것이 없다
  const bT = q('[data-pb-track="bar"]'), bar = q('[data-sticky-top]')
  return { col, is: col.querySelector<HTMLElement>('[data-pb-iscroll]'), hT: q('[data-pb-track="hdr"]'), hdr: q('[data-app-header]'), eT, hero, bS: bT?.parentElement ?? null, bT, bar, cat: bar?.querySelector<HTMLElement>('[data-pb-cat]') ?? null, nav: q('[data-mobile-col] > nav[data-hero-below]') }
}
// 잰 값(높이 · 자리)으로 떠 있는 것들의 자리를 적는다 — 크기가 바뀔 때만 부른다(매 프레임이 아니다)
function measure() {
  E = find()
  watch()
  if (!E) { unfloat(); return }
  const { col, hT, hdr, eT, hero, bS, bT, bar, cat, is } = E
  const inner = !!is
  const changed = inner !== root().hasAttribute('data-pb-inner')
  if (changed) root().toggleAttribute('data-pb-inner', inner)
  if (changed && inner && window.scrollY) window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior }) // 페이지가 내려간 채 남지 않게
  const hH = hdr?.offsetHeight ?? 0, heroH = hero.offsetHeight, bH = bar?.offsetHeight ?? 0, cH = cat?.offsetHeight ?? 0
  D.hH = hH; D.cH = cH; D.max = hH + cH
  if (bS && bar) { const h = px(inner ? 0 : bH); if (bS.style.height !== h) bS.style.height = h } // 페이지 스크롤에서는 자리 틀이 원래 높이를 잡는다
  // 떠 있는 자리 = 펼친 때 자리 틀의 자리(틀 위 기준). 목록 칸 안 스크롤에서는 헤더 · 머리 묶음 자리가 비어 미리보기 바로 아래다
  const y = window.scrollY, colTop = col.getBoundingClientRect().top + y
  setTop(hT, '0px'); setTop(eT, px(hH))
  setTop(bT, px(inner || !bS ? hH + heroH : bS.getBoundingClientRect().top + y - colTop))
  setVar('--pb-ctrl-h', px(bH - cH)); setVar('--pb-ipad', px(hH + bH))
  root().setAttribute('data-pb-float', '')
  if (!drag) apply(up ? D.max : 0, false)
  if (changed) relayout() // 자리 틀까지 다 적은 뒤에(먼저 알리면 머리 묶음 자리가 빠진 채로 쟀다)
}
function unfloat() {
  for (const k of ['data-pb-float', 'data-pb-inner', 'data-pb-anim']) root().removeAttribute(k)
  if (E) for (const el of [E.hT, E.eT, E.bT, E.hdr, E.cat]) if (el) for (const k of ['translate', 'opacity', 'pointer-events']) el.style.removeProperty(k)
  E?.nav?.removeAttribute('data-pb-navhide')
  F = 0; up = false; navHid = false; drag = false
}
// 들어가고 나올 때 목록 높이를 다시 재게 알린다(ListArea useMobileRows — 틀 최소 높이는 페이지 스크롤 때만 잰다)
const relayout = () => window.dispatchEvent(new Event(RELAYOUT_EVENT))
// 접힌 양 f 를 적는다: 헤더 · 미리보기는 헤더 높이까지, 머리 묶음은 끝까지 올라간다(분류 줄이 미리보기 뒤로 들어간다). anim = 끝까지 가는 전환을 탄다
function apply(f: number, anim: boolean) {
  if (!E) return
  F = Math.min(Math.max(0, f), D.max)
  window.clearTimeout(animT)
  if (anim) { root().setAttribute('data-pb-anim', ''); animT = window.setTimeout(() => root().removeAttribute('data-pb-anim'), ANIM) }
  else root().removeAttribute('data-pb-anim')
  const hO = Math.min(F, D.hH), cO = F - hO
  const t = (v: number) => (v ? `0 ${(-v).toFixed(1)}px` : '')
  setSt(E.hT, 'translate', t(hO)); setSt(E.eT, 'translate', t(hO)); setSt(E.bT, 'translate', t(F))
  const op = (a: number) => (a >= 1 ? '' : Math.max(0, a).toFixed(3))
  setSt(E.hdr, 'opacity', op(D.hH ? 1 - hO / D.hH : 1)); setSt(E.hdr, 'pointer-events', hO >= D.hH && D.hH ? 'none' : '')
  setSt(E.cat, 'opacity', op(D.cH ? 1 - cO / D.cH : 1)); setSt(E.cat, 'pointer-events', cO >= D.cH && D.cH ? 'none' : '')
}
// 전환 중에 다시 잡으면 지금 그려진 자리에서 이어 끈다
function liveF() {
  if (!E?.bT || !root().hasAttribute('data-pb-anim')) return F
  const v = parseFloat(getComputedStyle(E.bT).translate.split(' ')[1] ?? '0')
  return Number.isFinite(v) ? -v : F
}
function navTo(hide: boolean) {
  const nav = E?.nav
  if (nav && hide !== navHid) { navHid = hide; nav.toggleAttribute('data-pb-navhide', hide) }
}
const scrollNow = () => (E?.is ? E.is.scrollTop : window.scrollY)
const inCol = (t: EventTarget | null) => !!E && t instanceof Node && E.col.contains(t) // 틀 밖(시트 · 다이얼로그)의 제스처는 세지 않는다
const onStart = (e: TouchEvent) => {
  touch = !frozen && inCol(e.target) && e.touches.length === 1
  if (!touch) return
  const t = e.touches[0]; tx = t.clientX; ty = ny = t.clientY; axis = ''; drag = false
}
const onMove = (e: TouchEvent) => {
  if (!touch || !E || e.touches.length !== 1) return
  const t = e.touches[0], y = t.clientY, dx = t.clientX - tx, dy = y - ty
  if (!axis) { if (Math.max(Math.abs(dx), Math.abs(dy)) < GESTURE) return; axis = Math.abs(dy) > Math.abs(dx) ? 'y' : 'x' } // 처음 움직인 쪽으로 정한다
  if (axis !== 'y') return
  if (!drag) { drag = true; F0 = liveF(); fy = y }
  ly = y; sy = scrollNow()
  apply(F0 - (y - fy), false) // 손가락이 위로 = 접힌다
  // 하단 탭: 지금 상태 쪽으로 가장 멀리 민 자리에서 반대로 GESTURE 넘게 밀면 바뀐다
  if (navHid) { ny = Math.min(ny, y); if (y - ny >= GESTURE) { navTo(false); ny = y } }
  else { ny = Math.max(ny, y); if (ny - y >= GESTURE) { navTo(true); ny = y } }
}
// 끄는 동안 손가락 이동 이벤트가 드물게 와도(스크롤 중에 이벤트를 띄엄띄엄 보내는 브라우저) 끊기지 않게: 내용이 스크롤한 만큼 손가락도 움직인 것으로 보고 따라간다
const onScroll = (e: Event) => {
  if (!drag || !E || (E.is ? e.target !== E.is : e.target !== document)) return
  apply(F0 - (ly - (scrollNow() - sy) - fy), false)
}
const onEnd = () => {
  touch = false
  if (!drag) return
  drag = false
  const moved = F - F0, far = D.max * SNAP
  const to = moved >= far ? D.max : moved <= -far ? 0 : F0 >= D.max / 2 ? D.max : 0 // 조금만 움직였으면 잡았던 쪽으로 돌아간다
  up = to > 0
  apply(to, true)
}
const onWheel = (e: WheelEvent) => {
  if (touch || frozen || !inCol(e.target) || Math.abs(e.deltaY) <= Math.abs(e.deltaX) || !e.deltaY) return
  up = e.deltaY > 0; apply(up ? D.max : 0, true); navTo(up)
}
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
    document.addEventListener('scroll', onScroll, { capture: true, passive: true })
    window.addEventListener('resize', refreshScrollLink)
    measure()
  }
  return () => {
    if (--installed) return
    for (const [k, f] of [['touchstart', onStart], ['touchmove', onMove], ['touchend', onEnd], ['touchcancel', onEnd], ['wheel', onWheel], ['scroll', onScroll]] as const) document.removeEventListener(k, f as EventListener, true)
    window.removeEventListener('resize', refreshScrollLink)
    ro?.disconnect(); mo?.disconnect(); ro = mo = null; roTargets = []
    unfloat()
    E = null
  }
}
// 창(시트 · 다이얼로그)이 떠 있는 동안은 제스처를 세지 않고 그대로 둔다(시트를 끌어 내리는 손가락으로 머리 · 탭이 접히고 펼쳐지지 않게)
export function setScrollFrozen(f: boolean) { frozen = f; if (f && drag) onEnd(); if (f) touch = false }
