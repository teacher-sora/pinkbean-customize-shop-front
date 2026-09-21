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
import { glideTo, place, release } from './glide'

export const SHEET_MS = 300
export const SHEET_EASE = `transform ${SHEET_MS / 1000}s cubic-bezier(.45,0,.55,1)`
export const BM_SHEET_H = { base: 376, vs: 624 } // 북마크 시트 높이(접힘·VS 펼침), 실제 값은 max-height 85% 로 잘린다
export const VS_WRAP_H = 248

type Els = { body: HTMLElement; list: HTMLElement; panel: HTMLElement; foot: HTMLElement }
const topOf = (el: Element) => el.getBoundingClientRect().top
// 지금 화면에 그려진 translateY(전환 도중이면 중간값).
const tyOf = (el: Element) => { const t = getComputedStyle(el).transform; return !t || t === 'none' ? 0 : new DOMMatrixReadOnly(t).m42 }

// 2026-09-21: 전환 도중에도 다시 누를 수 있다(사용자 지시 — 한 동작이 끝나야 다음 동작을 받던 busy 잠금 제거).
// 움직임은 glide.ts(되돌릴 때 지금 위치·속도를 이어받는 CSS transition)로 한다.
//  - 접는 중(vsOn 은 아직 true) 다시 누름 → 커밋 타이머 취소, 셋 다 0 으로(펼친 모습으로 되돌아감).
//  - 펼치는 중 다시 누름 → 접힘 목표를 **레이아웃 위치**(지금 걸린 transform 을 뺀 값) 기준으로 계산해 그리로.
export function useVsFlip() {
  const s = useShop()
  const bodyRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const pend = useRef<{ p: number; l: number; f: number } | null>(null)
  const phase = useRef<'idle' | 'opening' | 'closing'>('idle')
  const prevOn = useRef(s.vsOn)
  const timer = useRef(0)
  const raf = useRef(0)
  const closing = useRef(s.surfaceClosing)
  closing.current = s.surfaceClosing

  const els = (): Els | null => {
    const body = bodyRef.current, list = listRef.current
    const panel = body?.closest<HTMLElement>('[role="dialog"]') ?? null
    const foot = panel?.querySelector<HTMLElement>('[data-sheet-foot]') ?? null
    return body && list && panel && foot ? { body, list, panel, foot } : null
  }
  const stop = () => { clearTimeout(timer.current); cancelAnimationFrame(raf.current) }
  // 전환 흔적 정리. 패널 transform·transition 은 React 인라인 값과 같게 되돌린다(닫히는 중이면 건드리지 않음).
  const settle = (e: Els) => {
    stop()
    release([e.list, e.foot])
    if (!closing.current) { e.panel.style.transition = 'none'; e.panel.style.transform = 'translateY(0px)' }
    e.panel.getBoundingClientRect()
    e.panel.style.transition = SHEET_EASE // 닫히는 중이면 React 가 넣은 translateY(100%) 를 이 곡선으로 마저 내려간다
    phase.current = 'idle'
  }
  // 목표로 이동(진행 중이면 지금 위치·속도에서 이어 간다). done 은 도착 뒤.
  const glide = (e: Els, to: number[], done: () => void) => {
    stop()
    const ms = glideTo([[e.panel, to[0]], [e.list, to[1]], [e.foot, to[2]]])
    timer.current = window.setTimeout(done, ms + 30)
  }

  const collapse = (e: Els) => {
    // 접힌 뒤 위치를 미리 계산(시트는 오버레이 바닥에 붙는다, 높이 = min(376, 오버레이 85%)).
    // 위치는 **레이아웃 기준** — 펼치는 도중이면 걸려 있는 transform 을 빼야 목표가 틀어지지 않는다.
    const overlay = e.panel.parentElement as HTMLElement
    const ob = overlay.getBoundingClientRect().bottom
    const pr = e.panel.getBoundingClientRect()
    const pty = tyOf(e.panel)
    const hc = Math.min(BM_SHEET_H.base, overlay.clientHeight * 0.85)
    const d = pr.height - hc
    const lTo = ob - hc + (topOf(e.body) - pr.top) - 1 // 목록 = 본문 맨 위(margin-top -1px)
    const fTo = ob - e.foot.offsetHeight
    const lTop = topOf(e.list) - tyOf(e.list) - pty, fTop = topOf(e.foot) - tyOf(e.foot) - pty
    phase.current = 'closing'
    glide(e, [d, lTo - lTop - d, fTo - fTop - d], () => s.toggleVs())
  }

  const toggle = () => {
    const e = els()
    if (phase.current === 'closing') { // 접는 중 → 되돌려 펼친 모습으로
      if (!e) return
      phase.current = 'opening'
      glide(e, [0, 0, 0], () => settle(e))
      return
    }
    if (!s.vsOn) {
      if (e && s.bookmarks.length) pend.current = { p: topOf(e.panel), l: topOf(e.list), f: topOf(e.foot) }
      s.toggleVs()
      return
    }
    if (!e) { s.toggleVs(); return }
    collapse(e) // 펼친 상태 또는 펼치는 중
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
      // 펼침: 패널·목록·푸터를 "전" 위치에 놓고 다음 프레임에 0 으로.
      stop()
      // ⚠️ 세 값을 **모두 잰 다음** 옮긴다 — 패널을 먼저 옮기고 목록·푸터를 재면 패널 이동분이 섞여
      //    목록·푸터가 첫 프레임에 튀고 패널을 따라 요동친다(2026-09-21 이 순서를 바꿨다가 모바일 VS 가 깨졌다).
      const dp = f0.p - topOf(e.panel), dl = f0.l - topOf(e.list) - dp, df = f0.f - topOf(e.foot) - dp
      place([[e.panel, dp], [e.list, dl], [e.foot, df]])
      e.panel.getBoundingClientRect()
      phase.current = 'opening'
      raf.current = requestAnimationFrame(() => {
        if (closing.current) { settle(e); return }
        glide(e, [0, 0, 0], () => settle(e))
      })
    } else settle(e)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.vsOn])
  useEffect(() => () => stop(), [])

  return { bodyRef, listRef, toggle }
}
