'use client'

import { useEffect, useLayoutEffect, useState } from 'react'

// SSR 에선 useLayoutEffect 가 경고 → 클라이언트에서만 layout effect 사용(페인트 전 보정용).
const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect

// 레이아웃 모드(핸드오프 v2): 화면 폭 + 입력 기기로 분기한다.
//   모바일 ≤ 520px · PC ≥ 1200px · 그 사이 = 절반(마우스, 창을 절반만 쓸 때) / 태블릿(터치 기기)
//   v2 에서 태블릿은 pb-touch 모드(터치 전용)라, 마우스 기기의 1920 모니터 절반 창(≈960px)은 '절반'이다.
// ⚠️ hover/터치 UI 는 폭이 아니라 기기 입력((hover:hover) and (pointer:fine))으로 CSS 가 분기한다.
export type Breakpoint = 'pc' | 'half' | 'tablet' | 'mobile'

export function bpOf(w: number, touch: boolean): Breakpoint {
  if (w <= 520) return 'mobile'
  if (w >= 1200) return 'pc'
  return touch && w > 860 ? 'tablet' : 'half'
}
const isTouchDevice = () => {
  if (typeof window === 'undefined') return false
  // 개발 뷰어(/viewer)가 iframe 에 pbtouch=1 을 붙여 태블릿(터치) 모드를 재현한다.
  // iframe 은 폭만 바꿀 수 있고 pointer:coarse 를 만들 수 없어서, 이 한 가지만 쿼리로 강제한다.
  if (window.location.search.includes('pbtouch=1')) return true
  return !!window.matchMedia && window.matchMedia('(hover: none), (pointer: coarse)').matches
}

export function useBreakpoint(): Breakpoint {
  // SSR=pc(하이드레이션 mismatch 없음). 클라이언트에서 페인트 전 실제 폭으로 보정 + 모바일 사파리 지연 대비 rAF/load 재보정.
  const [bp, setBp] = useState<Breakpoint>('pc')
  useIsoLayoutEffect(() => {
    const calc = () => setBp(bpOf(window.innerWidth || document.documentElement.clientWidth, isTouchDevice()))
    calc()
    const raf = requestAnimationFrame(calc)
    window.addEventListener('resize', calc)
    window.addEventListener('orientationchange', calc)
    window.addEventListener('load', calc)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', calc)
      window.removeEventListener('orientationchange', calc)
      window.removeEventListener('load', calc)
    }
  }, [])
  return bp
}

// 세로 적층(모바일) 레이아웃 여부. 절반·태블릿은 PC 와 같은 2분할이다.
export const isStacked = (bp: Breakpoint) => bp === 'mobile'
// 2분할 좁은 모드(절반·태블릿) — v2 의 narrow.
export const isNarrow = (bp: Breakpoint) => bp === 'half' || bp === 'tablet'
