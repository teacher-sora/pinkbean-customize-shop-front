// 휴대폰 가상 키패드 — 화면 위에 붙은 머리 묶음(data-sticky-top — 목록 검색 · 쪽 번호 · 룩북 아이템 찾기) 안 입력칸을 쓰는 동안 키패드가 화면을 줄이지 않고 덮게 한다(사용자 지시: 키패드를 열면 페이지 스크롤이 늘어났다).
//  · 기본(viewport interactive-widget=resizes-visual)은 키패드만큼 보이는 화면(visual viewport)이 줄어, 그만큼 페이지를 더 내릴 수 있게 된다.
//    VirtualKeyboard API(크롬 · 삼성 인터넷 등 크로미움)의 overlaysContent 를 켜면 화면 크기가 그대로라 스크롤이 늘지 않는다 — 대신 키패드 높이는 이 API 로 읽는다.
//  · 그 밖의 입력칸(코디 정보의 칸 · 시트 · 다이얼로그)은 켜지 않는다 — 화면 아래쪽 입력칸은 키패드가 줄인 화면 위로 올라와야 보인다.
//  · 아이폰(사파리 · iOS 의 모든 브라우저)에는 이 API 가 없어 키패드가 보이는 화면을 줄인다(막을 수 없다). 그때는 visualViewport 로 잰다.
type VK = EventTarget & { overlaysContent: boolean; boundingRect: DOMRect }
const vk = (): VK | null => (typeof navigator !== 'undefined' && 'virtualKeyboard' in navigator ? (navigator as unknown as { virtualKeyboard: VK }).virtualKeyboard : null)
const editable = (el: EventTarget | null) => el instanceof HTMLElement && (el.isContentEditable || el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && !/^(button|submit|reset|checkbox|radio|range|color|file|image|hidden)$/i.test((el as HTMLInputElement).type)))
const top = (el: HTMLElement) => !!el.closest('[data-mobile-col] [data-sticky-top]')
export function installKeyboardOverlay(): () => void {
  const k = vk()
  if (!k) return () => {}
  const on = (e: Event) => { if (editable(e.target) && top(e.target as HTMLElement)) k.overlaysContent = true }
  const off = () => setTimeout(() => { if (!editable(document.activeElement) || !top(document.activeElement as HTMLElement)) k.overlaysContent = false }, 0)
  document.addEventListener('pointerdown', on, true) // 누르는 순간 — 키패드가 뜨기 전에 켠다(코드로 준 포커스는 focusin)
  document.addEventListener('focusin', on, true)
  document.addEventListener('focusout', off, true)
  return () => { document.removeEventListener('pointerdown', on, true); document.removeEventListener('focusin', on, true); document.removeEventListener('focusout', off, true); k.overlaysContent = false }
}
// 지금 보이는 화면의 아래 끝(창 좌표) — 키패드가 덮고 있으면 키패드 위 끝, 줄였으면 줄어든 화면 끝
export function visibleBottom(): number {
  const r = vk()?.overlaysContent ? vk()!.boundingRect : null
  if (r && r.height > 0) return r.top
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
