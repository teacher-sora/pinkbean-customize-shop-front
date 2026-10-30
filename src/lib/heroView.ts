// 모바일 미리보기(히어로)의 크기 — 기본 · 크게 · 캐릭터만. 모바일 헤더의 보기 버튼 셋이 고른다(frame/AppHeader).
//  · 표시는 <html data-pb-view> 속성 하나다. 히어로 높이는 CSS(preview.module.css)가 이 속성을 보고 정한다.
//  · **전환 없이 바로 바뀐다.** 보기를 바꾸는 것은 시점을 바꾸는 일이라 누르는 즉시 그 화면이어야 한다(사용자 지시).
//    목록을 미끄러지게 했더니 커진 미리보기와 내려가는 목록이 잠깐 겹쳐 보였다.
//  · 캐릭터만: 아래에 있는 것들(목록 · 프리셋 · 하단 탭)의 높이를 지금 값으로 묶어 두고 히어로를 화면 끝까지 키운다 →
//    그것들은 줄어들지 않고 화면 아래로 밀려난다(틀이 overflow:hidden 이라 보이지 않는다). 되돌아오면 묶은 것을 푼다.
//  · 평소 보기는 저장하지 않는다(새로 열면 기본). 비교 중의 보기만 따로 기억한다(처음은 '크게' — readCmpView). 모바일이 아니게 되면(폭이 넓어지면) 속성을 뗀다(AppHeader).
import { useSyncExternalStore } from 'react'

export type HeroView = 'base' | 'wide' | 'full'
export const RELAYOUT_EVENT = 'pb-relayout' // 칸이 크기는 그대로 자리만 옮겨 갔을 때(보기 바꾸기)
let view: HeroView = 'base'
const subs = new Set<() => void>()
const subscribe = (fn: () => void) => { subs.add(fn); return () => { subs.delete(fn) } }
export const useHeroView = () => useSyncExternalStore(subscribe, () => view, () => 'base' as HeroView)

// 히어로 아래의 것들: 패널 슬롯(display:contents) 안의 히어로 뒤 요소들 + 하단 탭
function below(): HTMLElement[] {
  const col = document.querySelector<HTMLElement>('[data-mobile-col]')
  if (!col) return []
  const hero = col.querySelector('[data-hero]')
  // 가장자리 흐림 층(.pb-fadeov — 칸 바로 뒤에 붙는다)은 빼고 묶는다. 묶으면 층이 옛 자리에 굳어 보기를 바꿔도 남아 있었다.
  const inPanel = [...col.querySelectorAll<HTMLElement>('[data-pb-panel] > *')].filter((el) => el !== hero && !(hero && el.contains(hero)) && !el.classList.contains('pb-fadeov'))
  const rest = [...col.querySelectorAll<HTMLElement>(':scope > [data-hero-below]')]
  return [...inPanel, ...rest].filter((el) => el.getClientRects().length)
}

export function setHeroView(next: HeroView) {
  if (next === view) return
  const prev = view
  // 캐릭터만은 화면 높이로 묶이므로 페이지를 내려 둔 채였으면 맨 위로(재기 전에)
  if (next === 'full' && window.scrollY) window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
  const els = below()
  if (next === 'full') for (const el of els) { el.style.height = `${el.offsetHeight}px`; el.style.flex = '0 0 auto' }
  if (prev === 'full') for (const el of els) { el.style.height = ''; el.style.flex = '' }
  document.documentElement.setAttribute('data-pb-view', next)
  view = next
  subs.forEach((fn) => fn())
  // 칸들이 크기는 그대로 자리만 옮겨 가므로 흐림 층에 다시 재라고 알린다(ui/useScrollFade)
  requestAnimationFrame(() => window.dispatchEvent(new Event(RELAYOUT_EVENT)))
}

// 비교 중의 보기(사용자 지시): 고른 적이 없으면 '크게'(한 줄 넷은 칸이 작다), 비교 중에 고르면 기억한다(기기에만 — localStorage)
const CMP_VIEW_KEY = 'pb-cmp-view'
export function readCmpView(): HeroView {
  try { const v = localStorage.getItem(CMP_VIEW_KEY); if (v === 'base' || v === 'wide' || v === 'full') return v } catch {}
  return 'wide'
}
export function saveCmpView(v: HeroView) { try { localStorage.setItem(CMP_VIEW_KEY, v) } catch {} }
export const heroViewNow = () => view

// 모바일이 아니게 되면 기본으로(속성을 떼고 묶은 높이를 푼다)
export function resetHeroView() {
  if (view === 'base') return
  for (const el of below()) { el.style.height = ''; el.style.flex = '' }
  document.documentElement.removeAttribute('data-pb-view')
  view = 'base'
  subs.forEach((fn) => fn())
  requestAnimationFrame(() => window.dispatchEvent(new Event(RELAYOUT_EVENT)))
}

// 재는 막대(보이지 않는다) — CSS 로 정한 높이를 px 로 읽는다. 목록 칸 맞춤(ListArea useMobileRows) · 미리보기 캐릭터 크기(PreviewModel)가 쓴다
const probes: Record<string, HTMLDivElement> = {}
function probe(css: string): HTMLDivElement {
  let el = probes[css]
  if (!el || !el.isConnected) {
    el = document.createElement('div')
    el.setAttribute('aria-hidden', 'true')
    el.style.cssText = `position:fixed;top:0;left:0;width:0;visibility:hidden;pointer-events:none;${css}`
    document.body.appendChild(el)
    probes[css] = el
  }
  return el
}
// 큰 화면 높이(100lvh — 툴바가 접힌, 내려 볼 때의 높이. 모르는 브라우저는 100vh)
export const lvhProbe = () => probe('height:100vh;height:100lvh')
// 미리보기 기본 높이(globals.css --pb-hero-base — 13 Pro 216 기준으로 화면에 맞춘다). '크게'여도 기본 보기의 높이
export const heroBaseProbe = () => probe('height:var(--pb-hero-base)')
