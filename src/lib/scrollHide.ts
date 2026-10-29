// 모바일: 스크롤한 만큼 따라 숨고 나오는 것들(사용자 지시 — 유튜브 모바일의 위 머리처럼, 정해진 시간의 전환이 아니라 스크롤 양에 붙어서).
//  · 위쪽 묶음 = 맨 위 헤더(data-app-header) · 미리보기(data-hero) · 붙은 머리 묶음(data-sticky-top — 부위 · 분류 줄 + 목록 머리). 셋 다 화면 위에 붙어 있다.
//    내린 만큼 '숨김량' Z 가 쌓여(0 ~ 헤더 + 머리 묶음 높이) 먼저 헤더가 미리보기와 함께 올라가고, 이어서 머리 묶음이 미리보기 뒤로 들어간다.
//    올리면 Z 가 줄어 머리 묶음이 먼저, 더 올리면 헤더까지 나온다 — 어디서든 조금만 올리면 부위 · 보기 설정 · 쪽이, 더 올리면 헤더가 손에 닿는다.
//    Z 는 지금 스크롤 양을 넘지 않는다(맨 위 근처에서는 제자리에 있는 것과 같다). 미리보기는 늘 화면에 남는다.
//  · 하단 탭: 내린 만큼 아래로 숨고(0 ~ 탭 높이) 올린 만큼 나온다. 페이지 끝에서는 탭 자리가 내용과 함께 올라와 보인다(자리가 보이는 만큼은 숨기지 않는다 —
//    숨기면 빈 자리가 비어 보인다). 따로 '바닥에 닿으면 나오기'는 없다(사용자 지시).
// 위치는 transform 으로 매 프레임 직접 적는다(전환 없음 — 스크롤과 같은 속도라 빈 틈이 생기지 않는다. 정해진 시간의 전환은 스크롤보다 먼저 움직여
// 머리가 있던 자리가 비어 보였다 — 사용자 지적). 스크롤 위치는 페이지 범위 안으로 잘라 읽는다(아이폰이 끝에서 튕기며 되돌아오는 것을 움직임으로 읽지 않게).
let installed = 0, frozen = false, last = 0, Z = 0, N = 0, raf = 0, mo: MutationObserver | null = null
const pos = () => Math.min(Math.max(0, window.scrollY), Math.max(0, document.documentElement.scrollHeight - window.innerHeight))
const q = (sel: string) => document.querySelector<HTMLElement>(sel)
const tr = (el: HTMLElement | null, y: number) => { if (!el) return; const v = y ? `translate3d(0, ${y}px, 0)` : ''; if (el.style.transform !== v) el.style.transform = v }
function frame(useDelta: boolean) {
  raf = 0
  const y = pos(), d = useDelta ? y - last : 0
  last = y
  const hdr = q('[data-app-header]'), hero = q('[data-hero]'), bar = q('[data-sticky-top]'), nav = q('[data-mobile-col] > nav[data-hero-below]')
  const linked = !!hero && getComputedStyle(hero).position === 'sticky' // '캐릭터만' 보기는 붙이지 않는다(페이지가 스크롤되지 않는다)
  const hH = linked ? hdr?.offsetHeight ?? 0 : 0, bH = linked ? bar?.offsetHeight ?? 0 : 0
  // 머리 묶음 안에 입력이 잡혀 있거나 펼친 칸(보기 설정)이 열려 있으면 묶음은 숨기지 않는다(자판이 뜨거나 고르려고 화면이 움직여도 남는다)
  const keep = !!bar && (bar.matches(':focus-within') || !!bar.querySelector('[aria-expanded="true"]'))
  Z = Math.min(Math.max(0, Z + d), Math.min(hH + (keep ? 0 : bH), y))
  const hO = Math.min(Z, hH)
  tr(hdr, -hO); tr(hero, -hO); tr(bar, -Z)
  if (nav) {
    const nH = nav.offsetHeight, shown = Math.min(Math.max(0, y + window.innerHeight - (document.documentElement.scrollHeight - nH)), nH)
    N = Math.min(Math.max(0, N + d), nH - shown)
    tr(nav, N)
  }
}
const onScroll = () => { if (!frozen && !raf) raf = requestAnimationFrame(() => frame(true)) }
// 탭을 바꾸면 새 머리 묶음이 붙는다 — 지금 숨김량을 바로 적는다(움직임 없이)
const refresh = () => { if (!raf) raf = requestAnimationFrame(() => frame(false)) }
export function installScrollLink(): () => void {
  if (!installed++) {
    last = pos(); Z = 0; N = 0
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', refresh)
    const col = q('[data-mobile-col]')
    if (col && typeof MutationObserver !== 'undefined') { mo = new MutationObserver(refresh); mo.observe(col, { childList: true, subtree: true }) }
  }
  return () => {
    if (--installed) return
    window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', refresh)
    mo?.disconnect(); mo = null
    if (raf) cancelAnimationFrame(raf); raf = 0
    for (const s of ['[data-app-header]', '[data-hero]', '[data-sticky-top]', '[data-mobile-col] > nav[data-hero-below]']) tr(q(s), 0)
  }
}
// 창(시트 · 다이얼로그)이 떠 있는 동안은 스크롤을 보지 않고 그대로 둔다. 시트는 뒤 페이지를 position:fixed 로 고정해 스크롤이 0 이 됐다가
// 닫을 때 제자리로 돌아가는데, 그것을 '맨 위로 올림' · '내림'으로 읽어 탭이 나타났다 사라졌다(연출 설정 — 사용자 지적). 풀리면 지금 위치에서 다시 센다.
export function setScrollFrozen(f: boolean) {
  if (f === frozen) return
  frozen = f
  if (!f) last = pos()
}
