'use client'

// 커스텀 드롭다운(v2 dd/ddVals) — OS select 금지. 메뉴는 버튼 위치를 재서 fixed 로 띄운다(위/아래 자동, 최대 220px).
// 바깥 누름·Esc 로 닫힘. Esc 는 캡처 단계에서 먼저 받아 시트/다이얼로그가 함께 닫히지 않게 한다.

import clsx from 'clsx'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Opt } from '@/lib/catalog'
import styles from './ui.module.css'

type Pos = { left: number; width: number; maxH: number; top: number | null; bottom: number | null }

export default function Dropdown({ options, value, onChange, variant, title, ariaLabel, shortLabel, isDefault, narrow, disabledValues, disabledTitle, blocked, blockedTitle }: {
  options: Opt[]; value: string; onChange: (v: string) => void
  variant: 'row' | 'rowM' | 'field' | 'fieldM'
  title?: string; ariaLabel: string
  shortLabel?: string; isDefault?: boolean // field: 기본값이면 설정 이름, 바꾸면 값
  narrow?: boolean
  disabledValues?: Set<string>; disabledTitle?: string
  blocked?: boolean; blockedTitle?: string // 전체 비활성(라이딩 중 형상 변이 등)
}) {
  const [pos, setPos] = useState<Pos | null>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const open = !!pos
  const current = (options.find((o) => o.v === value) || options[0] || { l: '' }).l

  const toggle = () => {
    if (blocked) return
    if (open) { setPos(null); return }
    const el = btnRef.current; if (!el) return
    const r = el.getBoundingClientRect(), GAP = 5, CAP = 220
    const below = window.innerHeight - r.bottom - GAP, above = r.top - GAP
    const up = below < Math.min(CAP, above)
    const maxH = Math.min(CAP, (up ? above : below) - 8)
    setPos({ left: Math.round(r.left), width: Math.max(120, Math.round(r.width)), maxH: Math.max(90, Math.round(maxH)), top: up ? null : Math.round(r.bottom + GAP), bottom: up ? Math.round(window.innerHeight - r.top + GAP) : null })
  }

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node
      if (btnRef.current?.contains(t) || menuRef.current?.contains(t)) return
      setPos(null)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopImmediatePropagation(); setPos(null) } }
    window.addEventListener('pointerdown', onDown, true)
    window.addEventListener('keydown', onKey, true)
    return () => { window.removeEventListener('pointerdown', onDown, true); window.removeEventListener('keydown', onKey, true) }
  }, [open])

  const isField = variant === 'field' || variant === 'fieldM'
  const cls = clsx('pb-ddbtn',
    variant === 'row' && styles.ddRow, variant === 'rowM' && styles.ddRowM,
    variant === 'field' && styles.ddField, variant === 'field' && narrow && styles.ddFieldNarrow,
    variant === 'fieldM' && styles.ddFieldM,
    open && styles.ddOpen, blocked && styles.ddDisabled)

  return (
    <>
      <button ref={btnRef} type="button" onClick={toggle} title={blocked ? blockedTitle : (title ?? ariaLabel)} aria-label={ariaLabel} aria-expanded={open} aria-disabled={blocked || undefined} className={cls}>
        {isField
          ? <span className={clsx(styles.ddFieldText, isDefault && styles.ddFieldTextDef)}>{isDefault ? shortLabel : current}</span>
          : <span className={styles.ddRowText}>{current}</span>}
        <span className={clsx(styles.caret, open && styles.caretOpen)}>▾</span>
      </button>
      {open && typeof document !== 'undefined' && createPortal(
        <div ref={menuRef} role="listbox" aria-label={ariaLabel} className={clsx('pb-scroll', 'pb-ddmenu', styles.ddMenu)}
          style={{ left: pos!.left, width: pos!.width, maxHeight: pos!.maxH, top: pos!.top ?? undefined, bottom: pos!.bottom ?? undefined }}>
          {options.map((o) => {
            const dis = !!disabledValues?.has(o.v)
            const on = o.v === value
            return (
              <button key={o.v} type="button" role="option" aria-selected={on} aria-disabled={dis || undefined} title={dis ? disabledTitle : undefined}
                onClick={() => { if (dis) return; onChange(o.v); setPos(null) }}
                className={clsx('pb-ddrow', styles.ddItem, on && styles.ddItemOn, dis && styles.ddItemDisabled)}>{o.l}</button>
            )
          })}
        </div>,
        document.body,
      )}
    </>
  )
}
