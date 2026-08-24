'use client'

/*
 * NoNativeZoom — 페이지 전체의 "네이티브" 확대(브라우저 핀치/더블탭 줌)를 막는다.
 *  - iOS Safari 는 viewport 의 maximum-scale/user-scalable=no 를 무시하므로 gesture 이벤트로 직접 막는다.
 *  - DotDialog 캔버스의 두 손가락 확대는 pointer 기반 자체 구현이라 네이티브 gesture 와 무관 → 그대로 동작.
 *    (여기서 gesturestart 를 막아도 pointerdown/move 는 계속 발생하므로 캔버스 핀치엔 영향 없음.)
 *  - 더블탭 확대는 globals.css 의 `touch-action: manipulation` 이 담당(탭/스크롤은 그대로 통과).
 */

import { useEffect } from 'react'

export default function NoNativeZoom() {
  useEffect(() => {
    // iOS Safari 두 손가락 핀치(네이티브 gesture). 막아도 캔버스의 pointer 핀치는 계속 동작.
    const stopGesture = (e: Event) => e.preventDefault()
    document.addEventListener('gesturestart', stopGesture, { passive: false })
    document.addEventListener('gesturechange', stopGesture, { passive: false })
    document.addEventListener('gestureend', stopGesture, { passive: false })
    return () => {
      document.removeEventListener('gesturestart', stopGesture)
      document.removeEventListener('gesturechange', stopGesture)
      document.removeEventListener('gestureend', stopGesture)
    }
  }, [])

  return null
}
