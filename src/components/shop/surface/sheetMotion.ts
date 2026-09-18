// 모바일 시트 모션 공용 값 + 북마크 시트 VS 확장/접힘(FLIP).
//
// VS 확장은 높이 전환(시트 376↔624 + 비교 영역 0↔248 두 겹)이 매 프레임 레이아웃을 다시 계산해 버벅였다.
// 그래서 레이아웃은 한 번에 바꾸고 움직임은 transform 만 쓴다(합성 단계에서만 돌아 가로 스크롤처럼 매끄럽다).
//  - 펼침: 측정(전) → vsOn 커밋(높이 즉시 변경) → 측정(후) → 패널·북마크 목록·푸터를 "전" 위치로 되돌려 놓고 0 으로 전환.
//    패널이 위로 올라가며 헤더와 비교 캔버스가 목록 밑에서 드러나고, 목록·푸터는 제자리에 머문다.
//  - 접힘: 반대로 transform 으로 먼저 접힌 모습까지 옮긴 뒤(펼친 레이아웃 그대로 — 캔버스가 끝까지 보인다) vsOn 커밋 + 즉시 정리.
//    (먼저 커밋하면 패널이 작아져 목록·푸터가 패널 밖으로 밀려 잘린다.)
//  - 목록·푸터는 불투명 배경 + z-index 로 비교 영역을 덮는다. 시트 본문은 스크롤 가능(뷰포트가 줄면 스크롤).

import { useEffect, useLayoutEffect, useRef } from 'react'
import { useShop } from '../ShopContext'

export const SHEET_MS = 300
export const SHEET_EASE = `transform ${SHEET_MS / 1000}s cubic-bezier(.45,0,.55,1)`
export const BM_SHEET_H = { base: 376, vs: 624 } // 북마크 시트 높이(접힘·VS 펼침), 실제 값은 max-height 85% 로 잘린다
export const VS_WRAP_H = 248

type Els = { body: HTMLElement; list: HTMLElement; panel: HTMLElement; foot: HTMLElement }
const topOf = (el: Element) => el.getBoundingClientRect().top

export function useVsFlip() {
  const s = useShop()
  const bodyRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const pend = useRef<{ p: number; l: number; f: number } | null>(null)
  const busy = useRef(false)
  const prevOn = useRef(s.vsOn)
  const timers = useRef<number[]>([])
  const closing = useRef(s.surfaceClosing)
  closing.current = s.surfaceClosing

  const els = (): Els | null => {
    const body = bodyRef.current, list = listRef.current
    const panel = body?.closest<HTMLElement>('[role="dialog"]') ?? null
    const foot = panel?.querySelector<HTMLElement>('[data-sheet-foot]') ?? null
    return body && list && panel && foot ? { body, list, panel, foot } : null
  }
  const put = (el: HTMLElement, y: number, animate: boolean) => {
    el.style.transition = animate ? SHEET_EASE : 'none'
    el.style.transform = `translateY(${y}px)`
  }
  // 전환 흔적 정리. 패널 transform·transition 은 React 인라인 값과 같게 되돌린다(닫히는 중이면 건드리지 않음).
  const settle = (e: Els) => {
    for (const el of [e.list, e.foot]) { el.style.transition = 'none'; el.style.transform = '' }
    if (!closing.current) { e.panel.style.transition = 'none'; e.panel.style.transform = 'translateY(0px)' }
    e.panel.getBoundingClientRect()
    e.panel.style.transition = SHEET_EASE // 닫히는 중이면 React 가 넣은 translateY(100%) 를 이 곡선으로 마저 내려간다
    for (const el of [e.list, e.foot]) el.style.transition = ''
    busy.current = false
  }
  const play = (e: Els, from: number[], to: number[], done: () => void) => {
    busy.current = true
    put(e.panel, from[0], false); put(e.list, from[1], false); put(e.foot, from[2], false)
    e.panel.getBoundingClientRect()
    requestAnimationFrame(() => {
      if (closing.current) { settle(e); return }
      put(e.panel, to[0], true); put(e.list, to[1], true); put(e.foot, to[2], true)
      timers.current.push(window.setTimeout(done, SHEET_MS + 30))
    })
  }

  const toggle = () => {
    if (busy.current) return
    const e = els()
    if (!s.vsOn) {
      if (e && s.bookmarks.length) pend.current = { p: topOf(e.panel), l: topOf(e.list), f: topOf(e.foot) }
      s.toggleVs()
      return
    }
    if (!e) { s.toggleVs(); return }
    // 접힌 뒤 위치를 미리 계산(시트는 오버레이 바닥에 붙는다, 높이 = min(376, 오버레이 85%)).
    const overlay = e.panel.parentElement as HTMLElement
    const ob = overlay.getBoundingClientRect().bottom
    const pr = e.panel.getBoundingClientRect()
    const hc = Math.min(BM_SHEET_H.base, overlay.clientHeight * 0.85)
    const d = pr.height - hc
    const lTo = ob - hc + (topOf(e.body) - pr.top) - 1 // 목록 = 본문 맨 위(margin-top -1px)
    const fTo = ob - e.foot.offsetHeight
    play(e, [0, 0, 0], [d, lTo - topOf(e.list) - d, fTo - topOf(e.foot) - d], () => s.toggleVs())
  }

  // vsOn 이 바뀐 커밋 직후(페인트 전). 첫 마운트(시트 등장 전환 중)는 건드리지 않는다.
  useLayoutEffect(() => {
    if (prevOn.current === s.vsOn) return
    prevOn.current = s.vsOn
    const e = els()
    if (!e) return
    e.body.scrollTop = 0
    const f0 = pend.current
    pend.current = null
    if (s.vsOn && f0) {
      const dp = f0.p - topOf(e.panel)
      play(e, [dp, f0.l - topOf(e.list) - dp, f0.f - topOf(e.foot) - dp], [0, 0, 0], () => settle(e))
    } else settle(e)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.vsOn])
  useEffect(() => () => { timers.current.forEach(clearTimeout) }, [])

  return { bodyRef, listRef, toggle }
}
