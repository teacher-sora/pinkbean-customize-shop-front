'use client'

// 다이얼로그 마스크 닫기 규칙: 누름(pointerdown)과 뗌(pointerup)이 둘 다 마스크일 때만 닫는다.
//  - click 으로 판정하면 마스크에서 눌러 패널에서 떼도(또는 반대) click 대상이 공통 조상인 마스크가 되어 닫힌다.
//  - 터치는 누른 요소로 포인터가 암묵 캡처돼 pointerup 의 target 이 항상 마스크 → 실제 뗀 위치의 요소로 확인한다.
//  - 8px 넘게 움직였으면(끌기) 닫지 않는다. ignore() 가 true 면(예: 시트 드래그 직후) 닫지 않는다.

import { useRef } from 'react'

export function useMaskClose(onClose: () => void, ignore?: () => boolean) {
  const down = useRef<{ x: number; y: number } | null>(null)
  return {
    onPointerDown: (e: React.PointerEvent<HTMLElement>) => {
      down.current = e.target === e.currentTarget && e.button === 0 ? { x: e.clientX, y: e.clientY } : null
    },
    onPointerUp: (e: React.PointerEvent<HTMLElement>) => {
      const d = down.current
      down.current = null
      if (!d || document.elementFromPoint(e.clientX, e.clientY) !== e.currentTarget) return
      if (Math.abs(e.clientX - d.x) > 8 || Math.abs(e.clientY - d.y) > 8) return
      if (ignore?.()) return
      onClose()
    },
    onPointerCancel: () => { down.current = null },
  }
}
