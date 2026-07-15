'use client'

import { useEffect, useLayoutEffect, useState } from 'react'

// SSR 에선 useLayoutEffect 가 경고 → 클라이언트에서만 layout effect 사용(페인트 전 보정용).
const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect

// 반응형 브레이크포인트. 인라인 스타일(css())로는 미디어쿼리가 안 되므로 JS 로 폭을 읽어
// flex-direction / grid 컬럼·행 개수를 전환한다. (디자인 정본은 pc 기준)
export type Breakpoint = 'pc' | 'half' | 'tablet' | 'mobile'

// pc: 풀 데스크탑 / half: 창 절반·작은 노트북 / tablet: 패드 / mobile: 폰
export function bpOf(w: number): Breakpoint {
  if (w >= 1280) return 'pc'
  if (w >= 940) return 'half'
  if (w >= 640) return 'tablet'
  return 'mobile'
}

export function useBreakpoint(): Breakpoint {
  // SSR=pc(하이드레이션 mismatch 없음). 클라이언트에서 useLayoutEffect 로 "페인트 전" 실제 폭으로 보정 →
  // 새로고침 시 pc 로 굳어 보이던 문제 해결. 모바일 사파리는 innerWidth 가 로드 직후 지연될 수 있어 rAF/load 로 재보정.
  const [bp, setBp] = useState<Breakpoint>('pc')
  useIsoLayoutEffect(() => {
    const calc = () => setBp(bpOf(window.innerWidth || document.documentElement.clientWidth))
    calc()
    const raf = requestAnimationFrame(calc) // 레이아웃 정착 후 재보정
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

// 아이템 그리드(코디/검색/프리셋) 브레이크포인트별 컬럼·행. itemsPerPage = cols*rows.
export const GRID: Record<Breakpoint, { cols: number; rows: number }> = {
  pc: { cols: 6, rows: 3 },     // 18
  half: { cols: 4, rows: 3 },   // 12
  tablet: { cols: 3, rows: 3 }, // 9
  mobile: { cols: 2, rows: 3 }, // 6
}

// 좌우 2단(코디+미리보기) 대신 세로 스택으로 전환할 브레이크포인트.
export const isStacked = (bp: Breakpoint) => bp === 'tablet' || bp === 'mobile'
