'use client'

/*
 * Dropdown — 네이티브 <select> 대체 커스텀 드롭다운.
 *  - options(Opt[]) 또는 groups({group,items}[]) 지원(액션은 그룹).
 *  - 메뉴는 portal(document.body) + position:fixed 로 띄워 아코디언/스크롤 overflow에 안 잘림.
 *  - 커스텀 스크롤바(pb-scroll). 바깥클릭/Esc/스크롤 시 닫힘.
 */

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Opt } from '@/lib/catalog'
import { css } from '@/lib/style'

interface Props {
  value: string
  onChange: (v: string) => void
  options?: Opt[]
  groups?: { group: string; items: Opt[] }[]
  width?: number
  disabled?: Set<string> // 선택 불가 항목(연하게 + 취소선, 클릭 무시) — 라이딩 중 불가 액션
  blocked?: boolean      // 컨트롤 전체 비활성(버튼 연하게 + 열리지 않음) — 라이딩 중 형상변이 확장 차단
}

const CLOSE_MS = 180 // 닫힘 애니메이션 길이(.pb-collapse-out 와 일치)

export default function Dropdown({ value, onChange, options, groups, width = 190, disabled, blocked }: Props) {
  const [open, setOpen] = useState(false)
  const [closing, setClosing] = useState(false) // 닫힘 애니메이션 재생 중(언마운트 지연)
  const [pos, setPos] = useState<{ left: number; width: number; top?: number; bottom?: number; maxH: number } | null>(null)
  const [hov, setHov] = useState<string | null>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const flat = groups ? groups.flatMap((g) => g.items) : options || []
  const cur = flat.find((o) => o.v === value) || flat[0]
  const active = open && !closing

  const clearTimer = () => { if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null } }
  const finishClose = () => { clearTimer(); setClosing(false); setOpen(false) } // 즉시 닫기(스크롤/리사이즈: 위치 어긋남)
  const animateClose = () => { if (closeTimer.current) return; setClosing(true); closeTimer.current = setTimeout(finishClose, CLOSE_MS) } // exit 재생 후 언마운트
  useEffect(() => () => clearTimer(), [])

  const openMenu = () => {
    clearTimer(); setClosing(false)
    const r = btnRef.current?.getBoundingClientRect()
    if (r) {
      const GAP = 6, MARGIN = 10, CAP = 264
      const below = window.innerHeight - r.bottom - GAP
      const above = r.top - GAP
      // 아래 공간이 부족하고 위가 더 넓으면 위로 펼침(형상 변이 등 하단 항목이 잘리지 않도록).
      const up = below < Math.min(CAP, above) && above > below
      const maxH = Math.min(CAP, (up ? above : below) - MARGIN)
      setPos(up
        ? { left: r.left, width: r.width, bottom: window.innerHeight - r.top + GAP, maxH }
        : { left: r.left, width: r.width, top: r.bottom + GAP, maxH })
    }
    setOpen(true)
  }

  useEffect(() => {
    if (!open) return
    const onDoc = (e: PointerEvent) => {
      const t = e.target as Node
      if (btnRef.current?.contains(t) || menuRef.current?.contains(t)) return
      animateClose()
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') animateClose() }
    // 바깥(페이지/패널) 스크롤이면 닫되(고정 포지션 메뉴가 어긋나므로), 메뉴 자체 스크롤은 무시.
    // 스크롤/리사이즈는 위치가 어긋나므로 애니메이션 없이 즉시 닫는다.
    const close = (e?: Event) => {
      const t = e?.target as Node | undefined
      if (t && menuRef.current?.contains(t)) return
      finishClose()
    }
    window.addEventListener('pointerdown', onDoc, true)
    window.addEventListener('keydown', onKey)
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      window.removeEventListener('pointerdown', onDoc, true)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [open])

  // 열릴 때 선택된 항목이 메뉴 가운데로 오도록 스크롤(최상단 고정 방지).
  useEffect(() => {
    if (!open) return
    const menu = menuRef.current; if (!menu) return
    const sel = menu.querySelector('[data-sel="1"]') as HTMLElement | null
    if (sel) menu.scrollTop = sel.offsetTop - menu.clientHeight / 2 + sel.offsetHeight / 2
  }, [open, pos])

  const btn = `width:100%; height:34px; padding:0 11px; display:flex; align-items:center; justify-content:space-between; gap:8px; border:1px solid ${active ? '#eeb2ce' : '#e7ded4'}; border-radius:8px; background:${active ? '#fdf4f8' : '#faf7f3'}; font-family:inherit; font-size:13px; color:#3d372f; cursor:pointer; transition:border-color .18s ease, background .18s ease;`

  const optBtn = (o: Opt) => {
    const dis = !!disabled?.has(o.v)
    if (dis) {
      // 선택 불가: 연하게 + 취소선. 클릭/호버 반응 없음(라이딩 중 불가 액션·형상변이).
      return (
        <span key={o.v} style={css('display:block; width:100%; text-align:left; height:30px; line-height:30px; padding:0 9px; border-radius:6px; font-size:12.5px; font-weight:500; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; color:#c7bdb2; text-decoration:line-through; text-decoration-color:#dcd3c8; opacity:.7; cursor:default;')}>{o.l}</span>
      )
    }
    const on = o.v === value, h = hov === o.v && !on
    return (
      <button key={o.v} data-sel={on ? '1' : undefined} onClick={() => { onChange(o.v); animateClose() }} onMouseEnter={() => setHov(o.v)} onMouseLeave={() => setHov(null)}
        style={css(`display:block; width:100%; text-align:left; height:30px; padding:0 9px; border:none; border-radius:6px; cursor:pointer; font-family:inherit; font-size:12.5px; font-weight:${on ? 600 : 500}; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; color:${on ? '#d76d9a' : h ? '#3d372f' : '#5c534b'}; background:${on ? '#fce9f1' : h ? '#f7f0f3' : 'transparent'}; transition:background .12s ease, color .12s ease;`)}>{o.l}</button>
    )
  }

  return (
    <div style={{ ...css('position:relative;'), flex: `0 0 ${width}px` }}>
      <button ref={btnRef} disabled={blocked} onClick={() => { if (blocked) return; active ? animateClose() : openMenu() }} style={css(btn + (blocked ? ' opacity:.5; cursor:not-allowed; text-decoration:line-through; text-decoration-color:#dcd3c8;' : ''))}>
        <span style={css('white-space:nowrap; overflow:hidden; text-overflow:ellipsis;')}>{cur?.l}</span>
        <span style={css(`font-size:10px; color:#a89e93; transition:transform .18s ease; transform:rotate(${active ? '180deg' : '0deg'});`)}>▾</span>
      </button>
      {open && pos && typeof document !== 'undefined' && createPortal(
        <div ref={menuRef} className={`pb-scroll pb-scroll-thin ${closing ? 'pb-collapse-out' : 'pb-collapse'}`}
          style={{ ...css('position:fixed; z-index:200; overflow:hidden auto; padding:5px; background:#fff; border:1px solid #eee0e8; border-radius:10px; box-shadow:0 12px 30px rgba(42,37,33,.16);'), top: pos.top, bottom: pos.bottom, left: pos.left, width: pos.width, maxHeight: pos.maxH }}>
          {groups
            ? groups.map((g) => (
                <div key={g.group}>
                  <div style={css('padding:6px 9px 3px; font-size:10px; font-weight:700; color:#c1abb6; letter-spacing:.02em;')}>{g.group}</div>
                  {g.items.map(optBtn)}
                </div>
              ))
            : (options || []).map(optBtn)}
        </div>,
        document.body,
      )}
    </div>
  )
}
