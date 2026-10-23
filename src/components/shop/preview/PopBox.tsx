'use client'

// 팝박스 — 연출 설정 고르기(액션 · 무기 모션 · 표정) · 채팅 이모티콘 · 코디 프로필의 액션 · 이모티콘이 **함께 쓰는 하나의 창**(사용자 지시 — 같은 디자인은 하나로).
// 버튼에 매달리지 않고 넓은 영역(미리보기 · 꾸미기 칸) 안쪽 아래에서 올라온다. 가로는 그 영역 가득(안쪽 INSET), 높이는 고정 POP_H(영역이 낮으면 그만큼).
//  · 뜨고 질 때 같은 곡선으로 translateY + 투명도(등장 .22s · 퇴장 .18s — 양방향). 높이는 바꾸지 않는다.
//  · 바깥을 누르거나 Esc 로 닫힌다(Esc 는 창만 닫고 밑의 다이얼로그까지 닫지 않는다).
//  · 아래 줄(PopFoot) = [이전](한 단계 들어갔을 때) [닫기]. 고르면 고른 쪽이 닫는다 — 고르기는 한 번에 끝난다.
// 안의 화면 바꾸기(목록 → 상세)는 innerSlide 의 가로 슬라이드다.

import clsx from 'clsx'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import styles from './preview.module.css'

export const POP_H = 330  // 3열 × 2줄 남짓 + 아래 줄
export const POP_INSET = 10 // 영역 안쪽 여백 — 이만큼은 늘 영역 테두리와 떨어진다
const OUT_MS = 180          // 닫힘 전환이 끝난 뒤 떼어낸다

export type PopPos = { left: number; bottom: number; w: number; h: number }
// 영역(r) 안쪽 아래에 붙는 자리. top = 창이 넘지 않을 위 끝(없으면 영역 위 끝)
export function popIn (r: { left: number; width: number; top: number; bottom: number }, bottomEdge = r.bottom - POP_INSET, top = r.top + POP_INSET): PopPos {
  return { left: Math.round(r.left) + POP_INSET, w: Math.max(200, Math.round(r.width) - POP_INSET * 2), bottom: Math.round(window.innerHeight - bottomEdge), h: Math.max(150, Math.min(POP_H, Math.round(bottomEdge - top))) }
}

// 열기 · 닫기(퇴장 전환을 기다렸다 떼어낸다). pos = 열린 자리(null = 닫힘)
export function usePop () {
  const [pos, setPos] = useState<PopPos | null>(null)
  const [shown, setShown] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const open = (p: PopPos) => { if (timer.current) clearTimeout(timer.current); setPos(p) }
  const close = () => { setShown(false); if (timer.current) clearTimeout(timer.current); timer.current = setTimeout(() => setPos(null), OUT_MS) }
  useEffect(() => {
    if (!pos) return
    let r2 = 0
    const r1 = requestAnimationFrame(() => { r2 = requestAnimationFrame(() => setShown(true)) }) // 등장 전환이 보이도록 붙인 뒤 한 프레임 뒤에 켠다
    return () => { cancelAnimationFrame(r1); cancelAnimationFrame(r2) }
  }, [pos])
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])
  return { pos, shown, isOpen: !!pos && shown, open, close }
}

// 창. keep = 바깥으로 치지 않을 요소(창을 연 버튼 등)
export function PopBox ({ pop, label, keep, children }: { pop: ReturnType<typeof usePop>; label: string; keep?: React.RefObject<HTMLElement | null>[]; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const on = !!pop.pos
  useEffect(() => {
    if (!on) return
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node
      if (ref.current?.contains(t) || keep?.some((k) => k.current?.contains(t))) return
      pop.close()
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopImmediatePropagation(); pop.close() } }
    window.addEventListener('pointerdown', onDown, true)
    window.addEventListener('keydown', onKey, true)
    return () => { window.removeEventListener('pointerdown', onDown, true); window.removeEventListener('keydown', onKey, true) }
  }, [on]) // eslint-disable-line react-hooks/exhaustive-deps -- 열려 있는 동안 한 번
  if (!pop.pos || typeof document === 'undefined') return null
  const p = pop.pos
  return createPortal(
    <div ref={ref} role="dialog" aria-label={label} className={clsx(styles.pvPanel, pop.shown && styles.pvPanelOn)} style={{ left: p.left, bottom: p.bottom, width: p.w, height: p.h }}>
      {children}
    </div>,
    document.body,
  )
}

// 창 안의 스크롤 칸(격자)
export function PopScroll ({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={clsx('pb-scroll', 'pb-gutter', 'pb-fade', styles.popScroll, className)}>{children}</div>
}

// 아래 줄: [이전] [닫기]
export function PopFoot ({ onBack, onClose }: { onBack?: () => void; onClose: () => void }) {
  return (
    <div className={styles.pvFoot}>
      {onBack && <button type="button" onClick={onBack} className={clsx('pb-ghost', styles.pvFootBtn)}>이전</button>}
      <button type="button" onClick={onClose} className={clsx('pb-ghost', styles.pvFootBtn)}>닫기</button>
    </div>
  )
}
