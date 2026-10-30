import { RELAYOUT_EVENT } from './heroView'
// 모바일 목록 '넓게 보기'와 하단 탭 — 손가락 제스처 방향으로 켜고 끈다(사용자 지시).
//  · 목록 화면(목록 칸 data-pb-list 가 있는 탭 — 코디 · AI 코디 검색 목록, 광장, 룩북, 프리셋)은 페이지가 스크롤하지 않는다(html[data-pb-fix]: 틀이 화면에 딱 붙는다).
//    세로 목록은 목록 칸 안에서만 스크롤하고, 가로 목록은 좌우로만 넘긴다. 목록 칸 높이 = 넓게 보기에서 미리보기 + 목록 머리 줄 아래 화면 끝까지(ListArea useMobileRows).
//  · 처음에는 맨 위 헤더 · 미리보기 · 분류 줄 · 목록 머리 · 목록이 차례로 놓이고 하단 탭이 떠 있다 — 목록 칸이 넓게 보기 높이라 셋째 줄이 아래에 걸쳐 보인다.
//  · 넓게 보기(html[data-pb-compact]): 헤더 · 미리보기가 헤더 높이만큼, 그 아래 전부(분류 줄 · 목록 머리 · 목록)가 헤더 + 분류 줄만큼 함께 올라간다 —
//    분류 줄은 미리보기 뒤로 들어가 흐려지고, 목록이 통째로 올라와 화면 끝에 3줄이 딱 맞는다. 가리는 것이 없다. 하단 탭도 숨는다.
//    움직임은 브라우저의 전환(globals.css)이고, 코드는 표시 하나만 바꾼다.
//  · 제스처: 손가락을 댄 자리(touchstart)에서 세로로 GESTURE 넘게 밀면(touchmove) 그쪽으로 — 위로 밀면 넓게 보기 · 탭 숨김, 아래로 밀면 되돌림.
//    한 제스처 안에서 방향을 바꾸면 가장 멀리 민 자리부터 다시 센다. 처음 움직인 쪽이 가로면(목록 좌우 넘기기) 세지 않는다.
//    세로 목록이든 가로 목록이든, 목록 중간 어디서든 아래로 한 번 쓸면 바로 다시 나온다. 마우스 휠은 휠 방향.
//  · 왜: 머리를 내용 위에 띄워 가리게 하거나 손가락 · 스크롤을 따라 위치를 적게 했더니, 아이폰에서 떨리고 빈 띠가 보이고 쪽 넘김이 어긋났다(사용자 지적 — 폐기).
// 코디 정보 / 염색처럼 목록 칸이 없는 탭은 페이지 하나로 스크롤하고(머리도 내용과 함께 지나간다) 하단 탭만 같은 제스처로 숨고 나온다.
const GESTURE = 8 // 손가락이 같은 방향으로 이만큼(px) 움직이면 그 방향으로 친다(누르기 · 떨림은 치지 않는다)
let installed = 0, frozen = false, compact = false, tx = 0, ty = 0, ay = 0, touch = false, flipped = false, axis: '' | 'x' | 'y' = ''
let col: HTMLElement | null = null, nav: HTMLElement | null = null, ro: ResizeObserver | null = null, mo: MutationObserver | null = null, roTargets: Element[] = []
const root = () => document.documentElement
const q = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)
const setVar = (k: string, v: string) => { if (root().style.getPropertyValue(k) !== v) root().style.setProperty(k, v) }
// 목록 화면인지, 분류 줄 높이를 잰다 — 탭 · 방향 · 크기가 바뀔 때만 부른다(매 프레임이 아니다)
function measure() {
  col = q('[data-mobile-col]'); nav = q('[data-mobile-col] > nav[data-hero-below]')
  const on = !!col && root().getAttribute('data-pb-view') !== 'full' // '캐릭터만'은 붙이지 않는다
  root().toggleAttribute('data-pb-nav', on)
  const fix = on && !!col?.querySelector('[data-pb-list]')
  const cat = col?.querySelector<HTMLElement>('[data-sticky-top] [data-pb-cat]')
  const catH = `${cat?.offsetHeight ?? 0}px`, changed = fix !== root().hasAttribute('data-pb-fix') || catH !== root().style.getPropertyValue('--pb-cat-h')
  setVar('--pb-cat-h', catH)
  if (fix !== root().hasAttribute('data-pb-fix')) {
    root().toggleAttribute('data-pb-fix', fix)
    if (fix && window.scrollY) window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior }) // 페이지가 내려간 채 남지 않게
  }
  if (!on) set(false)
  else root().toggleAttribute('data-pb-compact', compact && fix)
  watch(cat ?? null)
  if (changed) window.dispatchEvent(new Event(RELAYOUT_EVENT)) // 목록 칸 높이를 다시 재게(ListArea useMobileRows)
}
// 넓게 보기(목록 화면에서만) · 하단 탭 숨김을 함께 켜고 끈다
function set(c: boolean) {
  compact = c
  root().toggleAttribute('data-pb-compact', c && root().hasAttribute('data-pb-fix'))
  nav?.toggleAttribute('data-pb-navhide', c)
}
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
  // 기준점 = 지금 상태 쪽으로 가장 멀리 민 자리. 거기서 반대로 GESTURE 넘게 밀면 바뀐다(손가락이 위로 = 넓게 보기)
  if (compact) { ay = Math.min(ay, y); if (y - ay >= GESTURE) { set(false); ay = y; flipped = true } }
  else { ay = Math.max(ay, y); if (ay - y >= GESTURE) { set(true); ay = y; flipped = true } }
}
// 빠르게 튕기면 움직임이 한두 번만 오거나 브라우저가 중간에 가져가(touchcancel) 위에서 못 셀 때가 있다 — 뗀 자리로 한 번 더 본다
const onEnd = (e: TouchEvent) => {
  const t = e.changedTouches[0]
  if (touch && !flipped && t && axis !== 'x') {
    const dx = t.clientX - tx, dy = t.clientY - ty
    if (Math.abs(dy) >= GESTURE && Math.abs(dy) > Math.abs(dx) && dy < 0 !== compact) set(dy < 0)
  }
  touch = false
}
const onWheel = (e: WheelEvent) => { if (!frozen && inCol(e.target) && Math.abs(e.deltaY) > Math.abs(e.deltaX) && e.deltaY) set(e.deltaY > 0) }
// 분류 줄 크기가 바뀌면(탭 전환으로 줄이 바뀜) 다시 잰다
function watch(cat: HTMLElement | null) {
  const next = [col, cat].filter((el): el is HTMLElement => !!el)
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
    set(false)
    for (const k of ['data-pb-nav', 'data-pb-fix', 'data-pb-compact']) root().removeAttribute(k)
    col = nav = null
  }
}
// 창(시트 · 다이얼로그)이 떠 있는 동안은 제스처를 세지 않고 그대로 둔다(시트를 끄는 손가락으로 머리 · 탭이 바뀌지 않게)
export function setScrollFrozen(f: boolean) { frozen = f; if (f) touch = false }
