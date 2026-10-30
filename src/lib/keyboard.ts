// 휴대폰 가상 키패드 — 하단 탭처럼 화면을 덮기만 한다(사용자 지시: 키패드 때문에 보이는 화면이 줄고 페이지 스크롤 · 높이가 바뀌는 것이 싫다).
//  · 기본(interactive-widget=resizes-visual)은 키패드만큼 보이는 화면(visual viewport)이 줄어, 그만큼 페이지를 더 내릴 수 있게 됐다.
//    viewport 의 interactive-widget=overlays-content(app/NoFocusZoom)와 VirtualKeyboard API 의 overlaysContent 로 화면 크기를 그대로 둔다 —
//    크로미움(크롬 · 삼성 인터넷 · 엣지)과 안드로이드 파이어폭스. 키패드 높이는 API 의 boundingRect 로 읽어 html 의 --pb-kb-h 에 적는다.
//  · 덮이니 가려지면 안 되는 것만 따로: 창(시트 · 다이얼로그) 층은 키패드 위까지로 줄인다(surface .layer — 페이지는 그대로),
//    페이지 안 입력칸이 키패드 아래에 들면 그만큼만 페이지를 내린다(스크롤 위치만 — 높이는 그대로).
//  · 아이폰(사파리 · iOS 의 모든 브라우저 — 웹킷)에는 이 설정이 없어 키패드가 보이는 화면을 줄인다(웹에서 막을 수 없다). 그래서 페이지 안 입력칸이
//    포커스를 가진 동안 문서를 지금 위치 그대로 고정하고(lib/bodyLock — 시트와 같은 잠금) 키패드가 닫히면 같은 자리로 푼다: 페이지가 짧아 키패드만큼
//    더 내려가 흰 빈 공간이 보이거나, 내린 채 닫으면 튕기거나, 보이는 것과 누르는 자리가 어긋나던 것(사용자 지적)을 막는다. 위치를 코드로 당기지 않는다 —
//    사파리가 같은 순간 스스로 위치를 고쳐 서로 부딪혔다. 목록 칸 안 스크롤은 그대로 된다. 창(시트) 안 입력칸은 시트가 이미 잠가 둔다.
import { lockBody } from './bodyLock'
type VK = EventTarget & { overlaysContent: boolean; boundingRect: DOMRect }
const vk = (): VK | null => (typeof navigator !== 'undefined' && 'virtualKeyboard' in navigator ? (navigator as unknown as { virtualKeyboard: VK }).virtualKeyboard : null)
const kbRect = () => { const r = vk()?.boundingRect; return r && r.height > 0 ? r : null }
const editable = (el: EventTarget | null): el is HTMLElement => el instanceof HTMLElement && (el.isContentEditable || el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && !/^(button|submit|reset|checkbox|radio|range|color|file|image|hidden)$/i.test((el as HTMLInputElement).type)))
// 덮기 설정이 없는 터치 기기(아이폰): 페이지 안 입력칸이 포커스를 가진 동안 문서를 고정한다
function installFocusLock(): () => void {
  if (!window.matchMedia('(pointer: coarse)').matches) return () => {}
  let unlock: (() => void) | null = null
  const page = (el: EventTarget | null) => editable(el) && !el.closest('[data-pb-layer]')
  const on = (e: FocusEvent) => { if (!unlock && page(e.target)) unlock = lockBody() }
  // 다른 입력칸으로 옮겨 가는 중이면(focusout 다음 focusin) 풀지 않는다
  const off = () => setTimeout(() => { if (unlock && !page(document.activeElement)) { unlock(); unlock = null } }, 0)
  document.addEventListener('focusin', on, true)
  document.addEventListener('focusout', off, true)
  return () => { document.removeEventListener('focusin', on, true); document.removeEventListener('focusout', off, true); unlock?.(); unlock = null }
}
export function installKeyboardOverlay(): () => void {
  const k = vk()
  if (!k) return installFocusLock()
  k.overlaysContent = true
  const root = document.documentElement
  const reveal = () => {
    const r = kbRect(), el = document.activeElement
    if (!r || !(el instanceof HTMLElement) || el.closest('[data-pb-layer]')) return // 창 안은 층이 키패드 위로 줄어 그대로 보인다
    const over = el.getBoundingClientRect().bottom + 8 - r.top
    if (over > 0) window.scrollBy({ top: over, behavior: 'instant' as ScrollBehavior })
  }
  const geo = () => {
    const r = kbRect(), h = `${r ? Math.round(r.height) : 0}px`
    if (root.style.getPropertyValue('--pb-kb-h') !== h) root.style.setProperty('--pb-kb-h', h)
    if (r) reveal()
  }
  k.addEventListener('geometrychange', geo)
  return () => { k.removeEventListener('geometrychange', geo); k.overlaysContent = false; root.style.removeProperty('--pb-kb-h') }
}
// 지금 보이는 화면의 아래 끝(창 좌표) — 키패드가 덮고 있으면 키패드 위 끝, 줄였으면(아이폰) 줄어든 화면 끝
export function visibleBottom(): number {
  const r = kbRect()
  if (r) return r.top
  const v = window.visualViewport
  return v ? v.offsetTop + v.height : window.innerHeight
}
// 떠 있는 칸(고르기 목록)의 최대 높이를 보이는 화면 아래 끝까지로 맞추고, 키패드 · 화면이 바뀌면 다시 맞춘다. 끝내는 함수를 돌려준다
export function fitAboveKeyboard(ref: React.RefObject<HTMLElement | null>, gap = 8): () => void {
  const fit = () => {
    const el = ref.current
    if (!el) return
    const h = `${Math.max(88, Math.floor(visibleBottom() - el.getBoundingClientRect().top - gap))}px`
    if (el.style.maxHeight !== h) el.style.maxHeight = h
  }
  fit()
  const v = window.visualViewport, k = vk()
  v?.addEventListener('resize', fit); v?.addEventListener('scroll', fit); k?.addEventListener('geometrychange', fit); window.addEventListener('scroll', fit, { passive: true })
  return () => { v?.removeEventListener('resize', fit); v?.removeEventListener('scroll', fit); k?.removeEventListener('geometrychange', fit); window.removeEventListener('scroll', fit) }
}
