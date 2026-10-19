'use client'

/*
 * NoFocusZoom — 모바일에서 입력칸에 포커스할 때 브라우저가 화면을 확대하는 것만 막는다. 손가락(핀치) 확대는 그대로 둔다.
 * 입력 글자(13px)는 키우지 않는다(사용자 지시). 확대했다 되돌리는 것이 아니라, 포커스 확대가 계산될 때 이미 더 키울 수 없게 둔다.
 *  - iOS(Safari · iOS 의 모든 브라우저): 글자가 16px 보다 작으면 포커스 때 확대한다. viewport 의 maximum-scale=1 이 이것을 막고,
 *    손가락 확대에는 쓰이지 않는다(iOS 10 부터 접근성 때문에 무시). 그래서 iOS 는 maximum-scale=1 을 늘 둔다.
 *  - 그 밖(Android Chrome · 삼성 인터넷): 작은 글자 칸에 포커스하면 읽을 만한 배율로 확대한다. maximum-scale 은 손가락 확대까지 막으므로
 *    늘 둘 수 없다 → 입력칸을 누르는 순간(pointerdown)과 포커스(focusin — 코드로 준 포커스 포함)에 maximum-scale 을 **지금 배율**로 잠근다.
 *    확대는 키패드가 뜬 뒤 계산되므로 그때는 이미 잠겨 있고, 지금 배율과 같아 손가락으로 확대해 둔 화면도 그대로다. 포커스가 빠지면 푼다.
 *  - 두 번 탭 확대는 globals.css 의 `touch-action: manipulation` 이 막는다(손가락 확대는 통과).
 */

import { useEffect } from 'react'

const BASE = 'width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-visual'
const isEditable = (el: EventTarget | null): boolean => {
  if (!(el instanceof HTMLElement)) return false
  if (el.isContentEditable || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') return true
  if (el.tagName !== 'INPUT') return false
  return !/^(button|submit|reset|checkbox|radio|range|color|file|image|hidden)$/i.test((el as HTMLInputElement).type)
}

export default function NoFocusZoom() {
  useEffect(() => {
    const meta = document.querySelector<HTMLMetaElement>('meta[name="viewport"]')
    if (!meta) return
    // iPadOS 는 데스크톱 Safari 로 자신을 알린다 — 터치 지원으로 가른다.
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
    const set = (max: string | null) => { const c = max ? `${BASE}, maximum-scale=${max}` : BASE; if (meta.content !== c) meta.content = c }
    if (ios) { set('1'); return }
    let locked = false
    const lock = (e: Event) => {
      if (!isEditable(e.target)) return
      const s = window.visualViewport?.scale ?? 1
      set(String(Math.max(1, Math.round(s * 1000) / 1000)))
      locked = true
    }
    const unlock = () => {
      // 다른 입력칸으로 옮겨 가는 중이면(focusout 다음 focusin) 풀지 않는다.
      setTimeout(() => { if (locked && !isEditable(document.activeElement)) { set(null); locked = false } }, 0)
    }
    // 눌렀지만 포커스가 가지 않은 경우(스크롤로 끝남)도 푼다.
    const settle = () => setTimeout(() => { if (locked && !isEditable(document.activeElement)) { set(null); locked = false } }, 400)
    document.addEventListener('pointerdown', lock, true)
    document.addEventListener('focusin', lock, true)
    document.addEventListener('focusout', unlock, true)
    document.addEventListener('pointerup', settle, true)
    document.addEventListener('pointercancel', settle, true)
    return () => {
      document.removeEventListener('pointerdown', lock, true)
      document.removeEventListener('focusin', lock, true)
      document.removeEventListener('focusout', unlock, true)
      document.removeEventListener('pointerup', settle, true)
      document.removeEventListener('pointercancel', settle, true)
    }
  }, [])

  return null
}
