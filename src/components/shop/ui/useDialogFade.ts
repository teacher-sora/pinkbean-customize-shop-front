'use client'

import { useEffect, useState } from 'react'

// 다이얼로그 등장·퇴장 전환 공용 훅.
// 값(열림 상태)이 사라져도 **바로 언마운트하지 않고** 퇴장 전환을 보여준 뒤 치운다.
//  · 등장은 마운트 후 한 프레임 뒤에 클래스를 벗긴다(전환이 보이려면 시작 상태가 한 번 그려져야 한다).
//  · 퇴장 타이머는 전환보다 길게(320ms — DESIGN_RULES §10.3). 중간에 잘리면 툭 끊긴다.
//  · 스타일은 globals.css 의 `.pb-dlg-mask` / `.pb-dlg-panel` / `.pb-dlg-hidden`(서피스와 같은 값).
export const DIALOG_EXIT_MS = 320

export function useDialogFade<T>(live: T | null | undefined): { shown: T | null; hidden: boolean } {
  const [shown, setShown] = useState<T | null>(live ?? null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (live) {
      setShown(live)
      let r2 = 0
      const r1 = requestAnimationFrame(() => { r2 = requestAnimationFrame(() => setVisible(true)) })
      return () => { cancelAnimationFrame(r1); cancelAnimationFrame(r2) }
    }
    setVisible(false)
    const t = setTimeout(() => setShown(null), DIALOG_EXIT_MS)
    return () => clearTimeout(t)
    // shown 을 의존성에 넣으면 퇴장 도중 타이머가 다시 걸린다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live])

  return { shown, hidden: !visible }
}
