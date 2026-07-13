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
}

export default function Dropdown({ value, onChange, options, groups, width = 190 }: Props) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null)
  const [hov, setHov] = useState<string | null>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const flat = groups ? groups.flatMap((g) => g.items) : options || []
  const cur = flat.find((o) => o.v === value) || flat[0]

  const openMenu = () => {
    const r = btnRef.current?.getBoundingClientRect()
    if (r) setPos({ top: r.bottom + 6, left: r.left, width: r.width })
    setOpen(true)
  }

  useEffect(() => {
    if (!open) return
    const onDoc = (e: PointerEvent) => {
      const t = e.target as Node
      if (btnRef.current?.contains(t) || menuRef.current?.contains(t)) return
      setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    const close = () => setOpen(false)
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

  const btn = `width:100%; height:34px; padding:0 11px; display:flex; align-items:center; justify-content:space-between; gap:8px; border:1px solid ${open ? '#eeb2ce' : '#e7ded4'}; border-radius:8px; background:${open ? '#fdf4f8' : '#faf7f3'}; font-family:inherit; font-size:13px; color:#3d372f; cursor:pointer; transition:border-color .18s ease, background .18s ease;`

  const optBtn = (o: Opt) => {
    const on = o.v === value, h = hov === o.v && !on
    return (
      <button key={o.v} onClick={() => { onChange(o.v); setOpen(false) }} onMouseEnter={() => setHov(o.v)} onMouseLeave={() => setHov(null)}
        style={css(`display:block; width:100%; text-align:left; height:30px; padding:0 9px; border:none; border-radius:6px; cursor:pointer; font-family:inherit; font-size:12.5px; font-weight:${on ? 600 : 500}; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; color:${on ? '#d76d9a' : h ? '#3d372f' : '#5c534b'}; background:${on ? '#fce9f1' : h ? '#f7f0f3' : 'transparent'}; transition:background .12s ease, color .12s ease;`)}>{o.l}</button>
    )
  }

  return (
    <div style={{ ...css('position:relative;'), flex: `0 0 ${width}px` }}>
      <button ref={btnRef} onClick={() => (open ? setOpen(false) : openMenu())} style={css(btn)}>
        <span style={css('white-space:nowrap; overflow:hidden; text-overflow:ellipsis;')}>{cur?.l}</span>
        <span style={css(`font-size:10px; color:#a89e93; transition:transform .18s ease; transform:rotate(${open ? '180deg' : '0deg'});`)}>▾</span>
      </button>
      {open && pos && typeof document !== 'undefined' && createPortal(
        <div ref={menuRef} className="pb-scroll pb-scroll-thin pb-collapse"
          style={{ ...css('position:fixed; z-index:200; max-height:264px; overflow:hidden auto; padding:5px; background:#fff; border:1px solid #eee0e8; border-radius:10px; box-shadow:0 12px 30px rgba(42,37,33,.16);'), top: pos.top, left: pos.left, width: pos.width }}>
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
