'use client'

// 다이얼로그/시트 **안에서 화면만 바꾸는 가로 슬라이드**. 서피스의 부위 염색 전환과 같은 값이라 몸짓이 하나로 읽힌다
// (빠짐 → 90ms 교체 → 110ms 들어옴, −34px). 염색 다이얼로그(색 조절 ↔ 염색표)와 연출 설정 시트(설정 ↔ 고르기)가 함께 쓴다.

import { useEffect, useRef, useState } from 'react'

export const SLIDE_PX = 34, SWAP_MS = 90, IN_MS = 110

export function useInnerSlide<T>(initial: T) {
  const [view, setView] = useState<T>(initial)
  const [slide, setSlide] = useState(0)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  useEffect(() => () => { for (const t of timers.current) clearTimeout(t) }, [])
  const go = (next: T, dir: 1 | -1) => {
    for (const t of timers.current) clearTimeout(t)
    setSlide(-SLIDE_PX * dir)
    timers.current = [
      setTimeout(() => { setView(next); setSlide(SLIDE_PX * dir) }, SWAP_MS),
      setTimeout(() => setSlide(0), IN_MS),
    ]
  }
  const style: React.CSSProperties = { transform: `translateX(${slide}px)`, opacity: slide ? 0 : 1 }
  return { view, go, style }
}
