// 모바일 미리보기(히어로)의 크기 — 기본 · 크게 · 캐릭터만. 모바일 헤더의 보기 버튼 셋이 고른다(frame/AppHeader).
//  · 표시는 <html data-pb-view> 속성 하나다. 히어로 높이는 CSS(preview.module.css)가 이 속성을 보고 정한다.
//    캐릭터 배율은 칸 높이를 따라가므로(PreviewModel 의 zoomStepScale) 칸이 커지면 캐릭터도 커진다.
//  · 높이를 전환하지 않는다(디자인 규칙): 배치는 한 번에 바꾸고, 히어로 아래에 있는 것(목록 · 프리셋 · 하단 탭)만
//    바뀌기 전 자리에서 새 자리로 translateY 로 미끄러진다(surface/glide — FLIP).
//  · 캐릭터만: 아래에 있는 것들의 높이를 지금 값으로 묶어 두고 히어로를 화면 끝까지 키운다 → 그것들은 화면 아래로 밀려
//    미끄러져 나간다(틀이 overflow:hidden 이라 보이지 않는다). 되돌아오면 묶은 것을 풀고 아래에서 올라온다.
//  · 저장하지 않는다. 새로 열면 기본이다. 모바일이 아니게 되면(폭이 넓어지면) 속성을 뗀다(AppHeader).
import { useSyncExternalStore } from 'react'
import { glideTo, place } from '@/components/shop/surface/glide'

export type HeroView = 'base' | 'wide' | 'full'
let view: HeroView = 'base'
const subs = new Set<() => void>()
const subscribe = (fn: () => void) => { subs.add(fn); return () => { subs.delete(fn) } }
export const useHeroView = () => useSyncExternalStore(subscribe, () => view, () => 'base' as HeroView)

// 히어로 아래에서 함께 움직이는 것들: 패널 슬롯(display:contents) 안의 히어로 뒤 요소들 + 하단 탭
function below(): HTMLElement[] {
  const col = document.querySelector<HTMLElement>('[data-mobile-col]')
  if (!col) return []
  const hero = col.querySelector('[data-hero]')
  const inPanel = [...col.querySelectorAll<HTMLElement>('[data-pb-panel] > *')].filter((el) => el !== hero)
  const rest = [...col.querySelectorAll<HTMLElement>(':scope > [data-hero-below]')]
  return [...inPanel, ...rest].filter((el) => el.getClientRects().length)
}

let endT = 0
export function setHeroView(next: HeroView) {
  if (next === view) return
  const prev = view
  const els = below()
  const before = els.map((el) => el.getBoundingClientRect().top)
  // 캐릭터만으로 갈 때: 지금 높이로 묶어 둔다(히어로가 커져도 줄어들지 않고 밀려난다)
  if (next === 'full') for (const el of els) { el.style.height = `${el.offsetHeight}px`; el.style.flex = '0 0 auto' }
  if (prev === 'full') for (const el of els) { el.style.height = ''; el.style.flex = '' }
  document.documentElement.setAttribute('data-pb-view', next)
  view = next
  subs.forEach((fn) => fn())
  const after = els.map((el) => el.getBoundingClientRect().top)
  // 움직이는 동안 히어로 위로 지나가므로 바탕을 칠한다(평소엔 틀의 흰 바탕이 비친다)
  for (const el of els) { el.style.position = 'relative'; el.style.zIndex = '1'; el.style.background = '#fff' }
  place(els.map((el, i) => [el, before[i] - after[i]] as [HTMLElement, number]))
  const end = glideTo(els.map((el) => [el, 0] as [HTMLElement, number]))
  window.clearTimeout(endT)
  endT = window.setTimeout(() => {
    for (const el of els) { el.style.transform = ''; el.style.transition = ''; el.style.position = ''; el.style.zIndex = ''; el.style.background = '' }
  }, end + 40)
}

// 모바일이 아니게 되면 기본으로(속성을 떼고 묶은 높이를 푼다) — 움직임 없이
export function resetHeroView() {
  if (view === 'base') return
  window.clearTimeout(endT)
  for (const el of below()) { el.style.height = ''; el.style.flex = ''; el.style.transform = ''; el.style.transition = ''; el.style.position = ''; el.style.zIndex = ''; el.style.background = '' }
  document.documentElement.removeAttribute('data-pb-view')
  view = 'base'
  subs.forEach((fn) => fn())
}
