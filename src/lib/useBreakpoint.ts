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
  // 모바일은 2행. 3행이면 세로 스택에서 카드 높이가 ~67px 로 무너지고 미리보기도 같이 눌린다.
  // 페이지 수는 늘지만 인덱스(페이지 입력) 시스템이 있어 탐색에는 영향 없음.
  mobile: { cols: 2, rows: 2 }, // 4
}

// 좌우 2단(코디+미리보기) 대신 세로 스택으로 전환할 브레이크포인트.
export const isStacked = (bp: Breakpoint) => bp === 'tablet' || bp === 'mobile'

// ⚠️ "모바일 규칙"의 적용 범위는 mobile 이 아니라 isStacked(= tablet + mobile)다.
// 세로 스택인 순간 리스트와 미리보기가 높이를 나눠 갖게 되므로, 눌리는 문제는 태블릿(640~939)도 똑같다.
// 세로 스택 섹션 높이(문서 스크롤 전제 — globals.css 의 max-width:939.98px 블록 참고).
// dvh 비율과 px 하한 중 큰 값(max) → 작은 폰(SE, 667px)에서도 카드가 절대 안 무너진다.
// 비율이 실효 지배값인 점에 주의: SE 에서 62dvh=413px 라 px 하한만 올리면 아무 효과가 없다 → 둘 다 올린다.
// 합이 100dvh 를 넘는 만큼 문서 스크롤이 생기고, 다 내리면 리스트+미리보기가 화면을 꽉 채운다.
// 미리보기는 모델 크기를 사용자가 확정 → 건드리지 않는다.
export const MOBILE_H = {
  list: 'max(66dvh, 400px)',     // 코디
  search: 'max(70dvh, 452px)',   // AI 검색: 검색 입력 행이 하나 더 있다
  content: 'max(68dvh, 424px)',  // 코디 정보·염색 / 프리셋(내부 스크롤)
  preview: 'max(38dvh, 244px)',
} as const
