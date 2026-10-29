// 모바일: 스크롤에 붙어 숨고 나오는 것들 — 유튜브 앱의 위 머리처럼(사용자 지시): 스크롤과 같은 속도로 따라 움직이고, 숨을수록 흐려지며,
// 중간에서 손을 떼면 마지막으로 움직인 방향으로 끝까지 붙는다(그만큼 페이지 스크롤도 함께 밀린다).
//  · 위쪽 묶음 = 맨 위 헤더(data-app-header) · 미리보기(data-hero) · 머리 묶음(data-sticky-top — 부위 · 분류 줄 + 목록 머리).
//    숨김량 Z(0 ~ 헤더 + 머리 묶음 높이): 내리면 먼저 헤더가 미리보기와 함께 올라가고, 이어서 머리 묶음이 미리보기 뒤로 들어간다.
//    올리면 머리 묶음이 먼저, 더 올리면 헤더까지 나온다. 미리보기는 늘 화면에 남는다.
//  · 하단 탭: 내릴 때만 내린 만큼 따라 숨고, 조금이라도 올리면 바로 나온다(navMove). 페이지 · 목록 칸 끝에서는 나온다.
// ⚠️ 위치는 코드가 매 프레임 적지 않는다 — 브라우저의 sticky 가 스크롤과 같은 프레임에 직접 놓는다(사용자 지적: 코드로 적으면 아이폰에서 한 프레임씩 늦어 떨렸다).
//    Z = clamp(s − A, 0, Zmax) (s = 틀 기준 스크롤). 기준점 A 하나만 코드가 들고 있고, 각 요소는 'A 에서 끝나는 칸' 안의 sticky 라 그 식대로 놓인다.
//      헤더: 칸(틀 위 ~ A + 헤더 높이) 안의 sticky top 0 → 위치 = min(0, A − s)
//      미리보기: 칸 안의 sticky 틀(top 헤더 높이) 안의 sticky top 0 → 위치 = clamp(A + 헤더 − s, 0, 헤더)
//      머리 묶음: 같은 꼴(top 제자리, 안쪽 top = 미리보기 뒤로 다 들어간 자리)
//    A 는 '다 나옴(A ≥ s)' 이나 '다 숨음(A ≤ s − Zmax)' 에 머물 때만 s 쪽으로 당긴다 — 그때 화면은 그대로라 언제 적어도 티가 나지 않는다.
//    중간(움직이는 중)에는 아무것도 쓰지 않는다. 흐려짐은 스크롤 타임라인 애니메이션(A 로 구간만 적는다)이라 이것도 브라우저가 그린다.
//    스크롤 타임라인이 없는 브라우저만 흐려짐을 코드로 적는다. 하단 탭은 내용과 반대로 움직여 sticky 로 안 되므로 코드가 transform 으로 적는다.
// 칸 · 틀은 각 자리 틀 안의 data-pb-track · data-pb-wrap(globals.css). 연결 중에만 html[data-pb-link] 로 켠다(그 전엔 제자리 그대로).
// 목록 안 스크롤(세로로 넘기는 목록 · 광장 · 룩북 · 프리셋 — data-pb-iscroll, html[data-pb-inner]): 페이지는 화면 높이로 서 있고 목록 칸만 스크롤한다
//  (사용자 지시 — 페이지 하나로 합쳤더니 목록을 스크롤할 수 없었고 페이지가 쪽 수만큼 길어졌다). 헤더 · 미리보기 · 머리 묶음 · 하단 탭은 칸 위에 떠
//  (position:fixed) 칸 안 스크롤한 만큼 같은 식(Z)으로 숨고 나온다. 칸 위 · 아래 여백(--pb-ipad · --pb-ipadb)이 떠 있는 것들의 높이라 맨 위 · 맨 끝은 가려지지 않는다.
//  칸 끝까지 내리면 하단 탭이 나온다. 이때만 위치를 코드로 적는다(칸 안 스크롤에는 sticky 로 붙을 것이 없다 — 떠 있는 것들은 내용 위를 지나갈 뿐이라 떨리지 않는다).
const SNAP_IDLE = 90 // 손을 떼고 스크롤이 이만큼 멈추면 끝까지 붙인다(ms)
const DIR_MIN = 2 // 이보다 작은 움직임은 방향으로 치지 않는다(손가락 떨림)
const BAND = 160 // A 가 머무는 구간 밖으로 이만큼 벌어지면 당긴다(방향이 바뀌면 바로)
type Els = { col: HTMLElement; is: HTMLElement | null; hT: HTMLElement | null; hdr: HTMLElement | null; eT: HTMLElement; eW: HTMLElement; hero: HTMLElement; bS: HTMLElement | null; bT: HTMLElement | null; bW: HTMLElement | null; bar: HTMLElement | null; nav: HTMLElement | null }
const D = { colTop: 0, hH: 0, heroH: 0, bH: 0, slot: 0, nH: 0, room: 0, keep: false, Zmax: 0, max: 0 }
let inner = false, st0 = 0, Zi = 0, N = 0, up = 0, navRestOn = false, navT = 0, installed = 0, frozen = false, last = 0, A = 0, dir = 0, pullDir = 0, touching = false, idle = 0, snapping = false, raf = 0
let E: Els | null = null, ro: ResizeObserver | null = null, mo: MutationObserver | null = null, roTargets: Element[] = []
const timeline = typeof CSS !== 'undefined' && CSS.supports('animation-timeline: scroll()') && CSS.supports('animation-range: 0px 1px')
const root = () => document.documentElement
const pos = () => Math.min(Math.max(0, window.scrollY), Math.max(0, root().scrollHeight - window.innerHeight))
const q = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)
const px = (n: number) => `${Math.round(n)}px`
const set = (el: HTMLElement | null, k: 'height' | 'top' | 'animation-range' | 'opacity' | 'transform', v: string) => { if (el && el.style.getPropertyValue(k) !== v) el.style.setProperty(k, v) }
const keepBar = (bar: HTMLElement | null) => !!bar && (bar.matches(':focus-within') || !!bar.querySelector('[aria-expanded="true"]'))
function find(): Els | null {
  const col = q('[data-mobile-col]'), eT = q('[data-pb-track="hero"]'), eW = eT?.querySelector<HTMLElement>('[data-pb-wrap]'), hero = q('[data-hero]')
  if (!col || !eT || !eW || !hero || root().getAttribute('data-pb-view') === 'full') return null // '캐릭터만'은 붙일 것이 없다
  const hT = q('[data-pb-track="hdr"]'), bT = q('[data-pb-track="bar"]')
  return { col, is: col.querySelector<HTMLElement>('[data-pb-iscroll]'), hT, hdr: q('[data-app-header]'), eT, eW, hero, bS: bT?.parentElement ?? null, bT, bW: bT?.querySelector<HTMLElement>('[data-pb-wrap]') ?? null, bar: q('[data-sticky-top]'), nav: q('[data-mobile-col] > nav[data-hero-below]') }
}
// 칸은 틀 위에서 시작한다 — 위치 기준(가장 가까운 position 조상)이 틀이 아니어도 맞게 그만큼 올린다
function trackTop(t: HTMLElement | null, colTop: number, y: number) {
  const p = t?.offsetParent as HTMLElement | null
  if (t && p) set(t, 'top', px(colTop - (p.getBoundingClientRect().top + y)))
}
// 잰 값(높이 · 자리)으로 칸 · 틀을 적는다 — 크기가 바뀔 때만 부른다(매 프레임이 아니다)
function measure() {
  E = find()
  watch()
  if (!E || !E.is) leaveInner()
  if (!E) { root().removeAttribute('data-pb-link'); return }
  if (E.is) { measureInner(E, E.is); return }
  const { col, hT, hdr, eT, hero, bS, bT, bar, nav } = E, y = window.scrollY
  const colTop = col.getBoundingClientRect().top + y
  D.colTop = colTop
  D.hH = hdr?.offsetHeight ?? 0
  D.heroH = hero.offsetHeight
  D.bH = bar?.offsetHeight ?? 0
  if (bS && bar) set(bS, 'height', px(D.bH)) // 자리 틀이 원래 높이를 잡아 둔다(안의 내용은 칸에 떠 있다)
  D.slot = bS ? bS.getBoundingClientRect().top + y - colTop : 0
  D.nH = nav?.offsetHeight ?? 0
  D.max = Math.max(0, root().scrollHeight - window.innerHeight)
  D.room = Math.max(400, window.innerHeight) // 안쪽 sticky 가 바닥에 머무를 여유(A 를 당기는 BAND 보다 넉넉히)
  D.keep = keepBar(bar)
  for (const t of [hT, eT, bT]) trackTop(t, colTop, y)
  write()
  root().setAttribute('data-pb-link', '')
}
// ── 목록 안 스크롤 ──
function measureInner(e: Els, is: HTMLElement) {
  root().removeAttribute('data-pb-link')
  const { hdr, hero, bar, nav, hT, eT, bT } = e
  D.hH = hdr?.offsetHeight ?? 0; D.heroH = hero.offsetHeight; D.bH = bar?.offsetHeight ?? 0; D.nH = nav?.offsetHeight ?? 0
  D.keep = keepBar(bar)
  D.Zmax = D.hH + (bar && !D.keep ? D.bH : 0)
  set(hT, 'top', '0px'); set(eT, 'top', px(D.hH)); set(bT, 'top', px(D.hH + D.heroH))
  const r = root().style
  if (r.getPropertyValue('--pb-ipad') !== px(D.hH + D.bH)) r.setProperty('--pb-ipad', px(D.hH + D.bH))
  if (r.getPropertyValue('--pb-ipadb') !== px(D.nH)) r.setProperty('--pb-ipadb', px(D.nH))
  if (!inner) { inner = true; Zi = 0; st0 = is.scrollTop; root().setAttribute('data-pb-inner', '') }
  paintInner()
}
function leaveInner() {
  if (!inner) return
  inner = false; Zi = 0
  root().removeAttribute('data-pb-inner'); root().style.removeProperty('--pb-ipad'); root().style.removeProperty('--pb-ipadb')
  if (E) for (const el of [E.hT, E.eT, E.bT, E.hdr, E.bar, E.nav]) if (el) for (const k of ['transform', 'opacity', 'transition']) el.style.removeProperty(k)
}
const tr = (v: number) => (v ? `translate3d(0, ${v.toFixed(1)}px, 0)` : '')
const op = (f: number) => (f >= 1 ? '' : Math.max(0, f).toFixed(3))
const stOf = (is: HTMLElement) => Math.min(Math.max(0, is.scrollTop), Math.max(0, is.scrollHeight - is.clientHeight))
function paintInner() {
  if (!E || !E.is) return
  const { hT, eT, bT, hdr, bar } = E, { hH, Zmax } = D
  Zi = Math.min(Math.max(0, Zi), Math.min(Zmax, stOf(E.is)))
  const hO = Math.min(Zi, hH), bO = Zi - hO
  set(hT, 'transform', tr(-hO)); set(eT, 'transform', tr(-hO)); set(bT, 'transform', tr(-Zi))
  set(hdr, 'opacity', op(hH ? 1 - hO / hH : 1))
  if (bar) set(bar, 'opacity', op(Zmax > hH ? 1 - bO / (Zmax - hH) : 1))
}
function tickInner() {
  raf = 0
  if (!E || !E.is || frozen) return
  const st = stOf(E.is), d = st - st0
  st0 = st
  if (Math.abs(d) >= DIR_MIN) dir = Math.sign(d)
  const keep = keepBar(E.bar)
  if (keep !== D.keep) { D.keep = keep; D.Zmax = D.hH + (E.bar && !keep ? D.bH : 0) }
  Zi += d
  paintInner()
  // 칸 끝에 닿으면 하단 탭이 나온다(사용자 지시 — 끝까지 내려도 나오지 않았다)
  navMove(d, st >= E.is.scrollHeight - E.is.clientHeight - 1 && E.is.scrollHeight > E.is.clientHeight + 1, Infinity)
}
function write() {
  if (!E) return
  const { hT, hdr, eT, eW, bT, bW, bar } = E, { hH, heroH, bH, slot, room, keep } = D
  D.Zmax = hH + (bar && !keep ? Math.max(0, slot + bH - heroH - hH) : 0)
  A = Math.min(Math.max(0, A), Math.max(0, pos() - D.colTop))
  set(hT, 'height', px(A + hH))
  set(eT, 'height', px(A + hH + heroH + room)); set(eW, 'top', px(hH)); set(eW, 'height', px(heroH + room))
  if (bT && bW && bar) {
    set(bT, 'height', px(A + slot + bH + room)); set(bW, 'top', px(slot)); set(bW, 'height', px(bH + room))
    set(bar, 'top', px(keep ? heroH : heroH - bH)) // 숨지 않을 때는 미리보기 바로 아래에서 멈춘다
  }
  navMove(0, false, D.max - pos())
  if (!timeline) { paint(); return }
  const y0 = D.colTop + A, barOn = D.Zmax > hH
  set(hdr, 'animation-range', `${px(y0)} ${px(y0 + Math.max(1, hH))}`)
  if (bar) set(bar, 'animation-range', barOn ? `${px(y0 + hH)} ${px(y0 + D.Zmax)}` : '10000000px 10000001px') // 숨지 않으면 구간을 멀리 빼 늘 보인다
}
// 하단 탭(사용자 지시): 내릴 때만 내린 만큼 따라 숨고, 조금이라도 올리면 바로 짧게 미끄러져 나온다. 위 머리와는 따로 움직인다
//  (머리 묶음의 숨김량을 따르게 했더니 짧은 페이지에서는 끝까지 내려도 반쯤 흐린 채 걸려 있다가 끝에서 갑자기 튀어나왔다 — 사용자 지적).
//  페이지 끝(gap = 끝까지 남은 스크롤): 탭 자리가 보이기 시작할 때 탭이 다 숨어 있으면 탭을 제자리(일반 배치)로 돌린다 — 그 순간 두 자리가 같고,
//  이후 내용과 함께 올라와 끝에서 화면 아래 끝에 붙는다. 반쯤 숨은 채 닿으면 그냥 다 나온다. 제자리에서 올리면 지금 자리에서 미끄러져 나온다
function navMove(d: number, show: boolean, gap: number) {
  const nav = E?.nav, nH = D.nH
  if (!nav || !nH) return
  let anim = false
  if (d < 0) up -= d; else if (d > 0) up = 0
  if (show || up >= DIR_MIN) { if (N > 0 || navRestOn) anim = true; N = 0; up = 0 }
  else if (d > 0) N = Math.min(nH, N + d)
  let rest = false
  if (gap < N) { if (N >= nH) rest = true; else { N = 0; anim = true } }
  if (rest !== navRestOn) {
    navRestOn = rest
    if (rest) nav.setAttribute('data-pb-navrest', '')
    else { nav.removeAttribute('data-pb-navrest'); nav.style.transition = 'none'; nav.style.transform = tr(Math.max(0, Math.min(nH, gap))); void nav.offsetHeight }
  }
  if (anim) { nav.style.transition = 'transform .18s cubic-bezier(.45,0,.55,1), opacity .18s ease'; window.clearTimeout(navT); navT = window.setTimeout(() => nav.style.removeProperty('transition'), 200) }
  set(nav, 'transform', rest ? '' : tr(N)); set(nav, 'opacity', rest ? '' : op(1 - N / nH))
}
// 스크롤 타임라인이 없을 때만: 흐려짐을 코드로 적는다
function paint() {
  if (!E) return
  const { hdr, bar } = E, { hH, Zmax } = D
  const Z = Math.min(Math.max(0, pos() - D.colTop - A), Zmax), hO = Math.min(Z, hH), bO = Z - hO
  set(hdr, 'opacity', op(hH ? 1 - hO / hH : 1))
  if (bar) set(bar, 'opacity', op(Zmax > hH ? 1 - bO / (Zmax - hH) : 1))
}
function tick() {
  raf = 0
  if (!E || frozen) return
  const y = pos(), d = y - last
  last = y
  if (Math.abs(d) >= DIR_MIN) dir = Math.sign(d)
  const keep = keepBar(E.bar)
  if (keep !== D.keep) { D.keep = keep; write() }
  // A 를 머무는 구간 [s − Zmax, s] 쪽으로 당긴다 — 다 나왔거나 다 숨은 동안만 벌어지므로 화면은 그대로다
  const s = y - D.colTop, nA = Math.min(Math.max(A, Math.max(0, s - D.Zmax)), Math.max(0, s))
  if (nA !== A && (Math.abs(nA - A) > BAND || (dir && dir !== pullDir))) { A = nA; pullDir = dir; write() }
  navMove(d, false, D.max - y)
  if (!timeline) paint()
}
// 손을 떼고 멈추면 중간에 걸친 것을 끝까지 붙인다 — 마지막으로 움직인 방향으로(조금만 움직여도 끝까지). 페이지 스크롤로 민다
function snap() {
  if (touching || frozen || snapping || !E) return
  const is = inner ? E.is : null
  const y = is ? stOf(is) : pos(), { hH, Zmax } = D
  const Z = is ? Zi : Math.min(Math.max(0, y - D.colTop - A), Zmax)
  let target = Z
  if (Z > 0 && Z < hH) target = dir > 0 ? hH : 0
  else if (Z > hH && Z < Zmax) target = dir > 0 ? Zmax : hH
  if (target === Z) return
  const max = is ? is.scrollHeight - is.clientHeight : root().scrollHeight - window.innerHeight
  const by = Math.max(-y, Math.min(max - y, target - Z))
  if (by) { snapping = true; (is ?? window).scrollBy({ top: by, behavior: 'smooth' }); setTimeout(() => { snapping = false }, 400) }
}
const armSnap = () => { window.clearTimeout(idle); idle = window.setTimeout(snap, SNAP_IDLE) }
const onScroll = () => { if (frozen || inner) return; if (!raf) raf = requestAnimationFrame(tick); armSnap() }
// 목록 칸 안 스크롤(문서에서 가로채 받는다 — 칸이 바뀌어도 다시 붙일 것이 없다)
const onInner = (e: Event) => { if (frozen || !inner || !E?.is || e.target !== E.is) return; if (!raf) raf = requestAnimationFrame(tickInner); armSnap() }
const onDown = () => { touching = true; window.clearTimeout(idle) }
// 머리 묶음에 포커스가 들어오고 나가거나 펼친 칸이 열리고 닫히면 숨김 여부(keep)를 다시 본다 — 스크롤이 없어도
const onFocus = () => { if (!raf) raf = requestAnimationFrame(inner ? tickInner : tick) }
const onUp = () => { touching = false; armSnap() }
// 크기가 바뀌면(보기 설정 · 줄 바꿈 · 탭 전환) 다시 잰다
function watch() {
  const next = E ? [E.col, E.hdr, E.hero, E.bar, E.nav, E.is].filter((el): el is HTMLElement => !!el) : []
  if (next.length === roTargets.length && next.every((el, i) => el === roTargets[i])) return
  ro?.disconnect(); roTargets = next
  for (const el of next) ro?.observe(el)
}
// 탭을 바꾸거나 새 머리 묶음이 붙으면 바로 다시 잰다(그리기 전에 — StickyBarM 의 layout effect)
export const refreshScrollLink = () => { if (installed) measure() }
export function installScrollLink(): () => void {
  if (!installed++) {
    last = pos(); A = 0; dir = 0; pullDir = 0
    ro = new ResizeObserver(() => measure())
    mo = new MutationObserver(() => measure())
    mo.observe(root(), { attributes: true, attributeFilter: ['data-pb-view'] })
    window.addEventListener('scroll', onScroll, { passive: true })
    document.addEventListener('scroll', onInner, { capture: true, passive: true })
    window.addEventListener('resize', refreshScrollLink)
    window.addEventListener('touchstart', onDown, { passive: true })
    window.addEventListener('touchend', onUp, { passive: true })
    window.addEventListener('touchcancel', onUp, { passive: true })
    for (const t of ['focusin', 'focusout', 'click'] as const) document.addEventListener(t, onFocus, true)
    measure()
  }
  return () => {
    if (--installed) return
    window.removeEventListener('scroll', onScroll); document.removeEventListener('scroll', onInner, true); window.removeEventListener('resize', refreshScrollLink)
    window.removeEventListener('touchstart', onDown); window.removeEventListener('touchend', onUp); window.removeEventListener('touchcancel', onUp)
    for (const t of ['focusin', 'focusout', 'click'] as const) document.removeEventListener(t, onFocus, true)
    window.clearTimeout(idle); if (raf) cancelAnimationFrame(raf); raf = 0
    ro?.disconnect(); mo?.disconnect(); ro = mo = null; roTargets = []
    leaveInner(); root().removeAttribute('data-pb-link'); root().removeAttribute('data-pb-freeze')
    if (E) { for (const el of [E.hdr, E.bar, E.nav]) if (el) for (const k of ['opacity', 'transform', 'animation-range']) el.style.removeProperty(k); E.nav?.removeAttribute('data-pb-navrest'); N = 0; up = 0; navRestOn = false }
    E = null
  }
}
// 창(시트 · 다이얼로그)이 떠 있는 동안은 스크롤을 보지 않고 그대로 둔다. 시트는 뒤 페이지를 position:fixed 로 고정해 스크롤이 0 이 됐다가
// 닫을 때 제자리로 돌아가는데, 그것을 '맨 위로 올림' · '내림'으로 읽어 탭이 나타났다 사라졌다(연출 설정 — 사용자 지적). 풀리면 지금 위치에서 다시 센다.
// 흐려짐 · 하단 탭 애니메이션도 그동안 멈춘다(html[data-pb-freeze]). sticky 는 고정된 페이지에서도 같은 자리에 놓인다.
export function setScrollFrozen(f: boolean) {
  if (f === frozen) return
  frozen = f
  if (f) root().setAttribute('data-pb-freeze', '')
  else { root().removeAttribute('data-pb-freeze'); last = pos(); if (E?.is) st0 = stOf(E.is) }
}
