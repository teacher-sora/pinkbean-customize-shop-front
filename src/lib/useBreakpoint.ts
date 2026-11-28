'use client'

import { useEffect, useLayoutEffect, useState } from 'react'
import { viewW } from './viewport'

// SSR 에선 useLayoutEffect 가 경고 → 클라이언트에서만 layout effect 사용(페인트 전 보정용).
const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect

// 레이아웃 모드: 화면 폭 + 입력 기기로 분기한다. 폭은 lib/viewport 로 읽는다 — 핀치 확대는 화면 크기 변경이 아니다(사용자 지시).
//   모바일 ≤ 520px · PC ≥ 1200px · 그 사이 = 절반(마우스, 창을 절반만 쓸 때) / 태블릿(터치 기기)
//   태블릿은 터치 기기 전용이다 — 마우스 기기의 1920 모니터 절반 창(≈960px)은 '절반'이다.
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
  // 뷰어는 dev 전용이므로 운영 도메인에서는 이 쿼리를 무시한다(파일은 병합돼도 동작하지 않게).
  if (window.location.search.includes('pbtouch=1') && !/^(www\.)?pinkbean-customize\.com$/.test(location.hostname)) return true
  return !!window.matchMedia && window.matchMedia('(hover: none), (pointer: coarse)').matches
}

// 지금 폭 구분(훅 밖에서 한 번 읽을 때 — 훅과 같은 계산)
export const currentBp = (): Breakpoint => bpOf(viewW(), isTouchDevice())
export function useBreakpoint(): Breakpoint {
  // SSR=pc(하이드레이션 mismatch 없음). 클라이언트에서 페인트 전 실제 폭으로 보정 + 모바일 사파리 지연 대비 rAF/load 재보정.
  const [bp, setBp] = useState<Breakpoint>('pc')
  useIsoLayoutEffect(() => {
    const calc = () => setBp(bpOf(viewW(), isTouchDevice()))
    const vv = window.visualViewport // 확대를 풀 때도 다시 잰다(확대 중에 바뀐 값이 남지 않게)
    calc()
    const raf = requestAnimationFrame(calc)
    window.addEventListener('resize', calc)
    window.addEventListener('orientationchange', calc)
    window.addEventListener('load', calc)
    vv?.addEventListener('resize', calc)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', calc)
      window.removeEventListener('orientationchange', calc)
      window.removeEventListener('load', calc)
      vv?.removeEventListener('resize', calc)
    }
  }, [])
  return bp
}

// 세로 적층(모바일) 레이아웃 여부. 절반·태블릿은 PC 와 같은 2분할이다.
export const isStacked = (bp: Breakpoint) => bp === 'mobile'
// 2분할 좁은 모드(절반·태블릿).
export const isNarrow = (bp: Breakpoint) => bp === 'half' || bp === 'tablet'

// 창 폭이 min 이상인지(matchMedia — 넘나들 때만 다시 그린다). SSR 은 true
export function useMinWidth(min: number): boolean {
  const [ok, setOk] = useState(true)
  useIsoLayoutEffect(() => {
    const mq = window.matchMedia(`(min-width: ${min}px)`)
    const on = () => setOk(mq.matches)
    on(); mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [min])
  return ok
}
