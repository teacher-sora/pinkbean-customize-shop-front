'use client'

/*
 * MiniCalendar — 네이티브 <input type="date"> 대신 쓰는 자체 달력.
 *  - 트리거(날짜 텍스트) 클릭 → portal 팝오버가 양방향 페이드로 열리고 닫힌다(pb-collapse / -out).
 *  - [min, max] 범위 밖 날짜는 비활성. 선택 시 onPick(YYYY-MM-DD) 후 닫힘.
 *  - 다이얼로그 overflow:hidden 에 안 잘리도록 portal(document.body)+position:fixed.
 */

import clsx from 'clsx'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { css } from '@/lib/style'

const WD = ['일', '월', '화', '수', '목', '금', '토']
const CLOSE_MS = 170
const pad2 = (n: number) => String(n).padStart(2, '0')
const ymOf = (d: string) => d.slice(0, 7)
const prevYm = (ym: string) => { const y = +ym.slice(0, 4), m = +ym.slice(5, 7); return m === 1 ? `${y - 1}-12` : `${y}-${pad2(m - 1)}` }
const nextYm = (ym: string) => { const y = +ym.slice(0, 4), m = +ym.slice(5, 7); return m === 12 ? `${y + 1}-01` : `${y}-${pad2(m + 1)}` }

export default function MiniCalendar({ value, min, max, today, onPick, width = 168 }: {
  value: string; min: string; max: string; today: string; onPick: (d: string) => void; width?: number
}) {
  const [open, setOpen] = useState(false)
  const [closing, setClosing] = useState(false)
  const [ym, setYm] = useState(ymOf(value))
  const [pos, setPos] = useState<{ left: number; width: number; top?: number; bottom?: number } | null>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const popRef = useRef<HTMLDivElement>(null)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wheelRef = useRef({ acc: 0, dir: 0, t: 0 })
  const swipeRef = useRef({ x: 0, y: 0, active: false })
  const justSwiped = useRef(false)
  const active = open && !closing
  const CAL_W = 264

  const addMonths = (ym: string, n: number) => { let y = +ym.slice(0, 4), m = +ym.slice(5, 7) - 1 + n; y += Math.floor(m / 12); m = ((m % 12) + 12) % 12; return `${y}-${pad2(m + 1)}` }
  const moveMonths = (n: number) => setYm((cur) => { const t = addMonths(cur, n); const lo = ymOf(min), hi = ymOf(max); return t < lo ? lo : t > hi ? hi : t })
  const stepMonth = (dir: 1 | -1) => moveMonths(dir)

  const clearTimer = () => { if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null } }
  const finish = () => { clearTimer(); setClosing(false); setOpen(false) }
  const animateClose = () => { if (closeTimer.current) return; setClosing(true); closeTimer.current = setTimeout(finish, CLOSE_MS) }
  useEffect(() => () => clearTimer(), [])

  const openCal = () => {
    clearTimer(); setClosing(false); setYm(ymOf(value))
    const r = btnRef.current?.getBoundingClientRect()
    if (r) {
      const GAP = 6, CAL_H = 320
      const below = window.innerHeight - r.bottom - GAP
      const up = below < CAL_H && r.top - GAP > below
      const left = Math.min(Math.max(8, r.left), window.innerWidth - CAL_W - 8)
      setPos(up ? { left, width: CAL_W, bottom: window.innerHeight - r.top + GAP } : { left, width: CAL_W, top: r.bottom + GAP })
    }
    setOpen(true)
  }

  useEffect(() => {
    if (!open) return
    const onDoc = (e: PointerEvent) => {
      const t = e.target as Node
      if (btnRef.current?.contains(t) || popRef.current?.contains(t)) return
      animateClose()
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopImmediatePropagation(); animateClose() } }
    const onScroll = (e: Event) => { const t = e.target as Node | undefined; if (t && popRef.current?.contains(t)) return; finish() }
    window.addEventListener('pointerdown', onDoc, true)
    window.addEventListener('keydown', onKey, true)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', finish)
    return () => {
      window.removeEventListener('pointerdown', onDoc, true)
      window.removeEventListener('keydown', onKey, true)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', finish)
    }
  }, [open])

  // 팝오버 위에서 휠 → 달 넘기기. 딜레이 없이 아이템 flicking 리스트와 동일한 방식(누적 임계 + 유휴/방향전환 시드).
  //  세게 굴리면 여러 달, 살살 굴리면 한 달 — 오직 굴린 힘으로 조절.
  useEffect(() => {
    if (!open) return
    const pop = popRef.current
    if (!pop) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      let raw = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY
      if (e.deltaMode === 1) raw *= 16
      else if (e.deltaMode === 2) raw *= 260
      if (Math.abs(raw) < 2) return
      const TH = 100, CAP = 6, now = performance.now(), dir = Math.sign(raw), w = wheelRef.current
      if (dir !== w.dir || now - w.t > 200) { w.acc = dir * (TH - 1); w.dir = dir } // 유휴/방향전환 시 첫 입력이 곧바로 1스텝
      w.t = now
      w.acc += raw
      let n = Math.trunc(w.acc / TH)
      w.acc -= n * TH
      n = Math.max(-CAP, Math.min(CAP, n))
      if (n) moveMonths(n)
    }
    pop.addEventListener('wheel', onWheel, { passive: false })
    return () => pop.removeEventListener('wheel', onWheel)
  }, [open, min, max])

  const y = +ym.slice(0, 4), m = +ym.slice(5, 7)
  const startDow = new Date(Date.UTC(y, m - 1, 1)).getUTCDay()
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate()
  const minYm = ymOf(min), maxYm = ymOf(max)
  const cells: (number | null)[] = []
  for (let i = 0; i < 42; i++) { const d = i - startDow + 1; cells.push(d >= 1 && d <= daysInMonth ? d : null) }

  const pick = (dateStr: string) => { animateClose(); onPick(dateStr) }

  // 모바일 스와이프로 달 넘기기(터치/펜만 — 마우스는 휠). 좌=다음달, 우=이전달. 스와이프면 그 탭의 날짜선택은 무시.
  const onSwipeDown = (e: React.PointerEvent) => { if (e.pointerType !== 'mouse') swipeRef.current = { x: e.clientX, y: e.clientY, active: true } }
  const onSwipeUp = (e: React.PointerEvent) => {
    const s = swipeRef.current
    if (!s.active) return
    s.active = false
    const dx = e.clientX - s.x, dy = e.clientY - s.y
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
      justSwiped.current = true
      setTimeout(() => { justSwiped.current = false }, 0)
      stepMonth(dx < 0 ? 1 : -1)
    }
  }

  const navBtn = (dir: -1 | 1, disabled: boolean) => (
    <button disabled={disabled} onClick={() => setYm(dir < 0 ? prevYm(ym) : nextYm(ym))}
      style={css(`width:28px; height:28px; display:flex; align-items:center; justify-content:center; border:1px solid #eee6dc; border-radius:7px; background:#faf7f3; cursor:${disabled ? 'default' : 'pointer'}; font-family:inherit; font-size:13px; color:${disabled ? '#d8cfc4' : '#8a8075'};`)}>{dir < 0 ? '‹' : '›'}</button>
  )

  return (
    <>
      <button ref={btnRef} onClick={() => (active ? animateClose() : openCal())}
        style={{ ...css(`flex:0 0 ${width}px; height:32px; padding:0 11px; display:flex; align-items:center; justify-content:space-between; gap:8px; border:1px solid ${active ? '#eeb2ce' : '#e7ded4'}; border-radius:8px; background:${active ? '#fdf4f8' : '#faf7f3'}; font-family:inherit; font-size:13px; color:#3d372f; cursor:pointer; font-variant-numeric:tabular-nums; transition:border-color .16s ease, background .16s ease;`) }}>
        <span>{value}</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#a89e93" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>
      </button>
      {open && pos && typeof document !== 'undefined' && createPortal(
        <div ref={popRef} onPointerDown={onSwipeDown} onPointerUp={onSwipeUp} className={clsx(closing ? 'pb-collapse-out' : 'pb-collapse')}
          style={{ ...css('position:fixed; z-index:210; padding:12px; background:#fff; border:1px solid #eee0e8; border-radius:12px; box-shadow:0 12px 30px rgba(42,37,33,.16); touch-action:none; user-select:none;'), top: pos.top, bottom: pos.bottom, left: pos.left, width: CAL_W }}>
          <div style={css('display:flex; align-items:center; justify-content:space-between; margin-bottom:8px;')}>
            {navBtn(-1, ym <= minYm)}
            <span style={css('font-size:13px; font-weight:700; color:#2a2521; font-variant-numeric:tabular-nums;')}>{y}년 {m}월</span>
            {navBtn(1, ym >= maxYm)}
          </div>
          <div style={css('display:grid; grid-template-columns:repeat(7,1fr); gap:2px; margin-bottom:4px;')}>
            {WD.map((w, i) => (
              <span key={w} style={css(`text-align:center; font-size:10.5px; font-weight:600; color:${i === 0 ? '#e08aa0' : i === 6 ? '#8ba6d6' : '#b7ada2'};`)}>{w}</span>
            ))}
          </div>
          <div style={css('display:grid; grid-template-columns:repeat(7,1fr); gap:2px;')}>
            {cells.map((d, i) => {
              if (d === null) return <span key={i} />
              const ds = `${ym}-${pad2(d)}`
              const dis = ds < min || ds > max
              const sel = ds === value
              const isToday = ds === today
              const dow = i % 7
              const col = sel ? '#fff' : dis ? '#d8cfc4' : dow === 0 ? '#e08aa0' : dow === 6 ? '#8ba6d6' : '#4b443c'
              return (
                <button key={i} disabled={dis} onClick={() => { if (justSwiped.current) return; pick(ds) }}
                  style={css(`height:30px; display:flex; align-items:center; justify-content:center; border:none; border-radius:7px; cursor:${dis ? 'default' : 'pointer'}; font-family:inherit; font-size:12.5px; font-weight:${sel || isToday ? 700 : 500}; font-variant-numeric:tabular-nums; color:${col}; background:${sel ? '#ec86ac' : isToday ? '#fce9f1' : 'transparent'}; transition:background .12s ease;`)}>{d}</button>
              )
            })}
          </div>
          <div style={css('display:flex; justify-content:flex-end; margin-top:8px;')}>
            <button onClick={() => pick(today)} style={css('height:28px; padding:0 12px; border:1px solid #eee6dc; border-radius:7px; background:#faf7f3; font-family:inherit; font-size:12px; font-weight:600; color:#8a8075; cursor:pointer;')}>오늘</button>
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}
