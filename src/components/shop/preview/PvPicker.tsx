'use client'

// 연출 설정 고르기(액션 · 무기 모션 · 표정) — 이름만 늘어선 목록 대신 **3열 격자 + 작은 미리보기**로 고른다
// (2026-09-24 사용자 지시: "코디 광장 프리셋 고르는 것처럼 넓게 펼치고 어떤 느낌인지 보여 달라").
//  · 액션 · 무기 모션 = **지금 입고 있는 코디**를 그 동작·자세로 작게 그린다. 카드·광장과 같은 합성기(SnapThumb)를
//    쓰되 view 모드로 불러 스냅샷에 담긴 액션·무기 모션을 반영한다. 베이스 마네킹이 아니라 실제 코디인 이유:
//    무기 모션은 든 무기가 있어야 차이가 보이고, 지금 보고 있는 미리보기의 스프라이트가 이미 캐시에 있어 더 빠르다.
//  · 표정 = 표정 얼굴장식 25종의 **아이콘**(표정마다 다른 얼굴 그림, catalog.PV_EXPR_ICONS). 모델을 25번 그리는
//    것보다 훨씬 가볍고 작게 봐도 표정이 또렷하다. 짝이 없는 '기본'·'눈깜빡'은 이름만 보여 준다.
//
// 펼치는 방식은 폭에 따라 다르다.
//  · PC·태블릿 = 버튼 옆 팝오버(3열 × 2줄 + 다음 줄 살짝 — 스크롤이 있다는 신호). 미리보기를 적당히만 가린다.
//  · 모바일 = 시트를 **가로로 슬라이드**해 시트 안의 다음 화면으로 간다(부위 염색 → 염색과 같은 몸짓, PvSheetBody).
//    좁은 화면에서 시트 위에 팝오버를 또 띄우면 층이 겹쳐 보여, 이미 쓰고 있는 전환을 그대로 쓴다.

import clsx from 'clsx'
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { PV_EXPR_ICONS, type Opt } from '@/lib/catalog'
import { spriteUrl } from '@/lib/core/data'
import { useShop, type Snapshot } from '../ShopContext'
import SnapThumb from '../SnapThumb'
import ui from '../ui/ui.module.css'
import styles from './preview.module.css'

type Pos = { left: number; maxH: number; top: number | null; bottom: number | null }
type Group = { group: string; items: Opt[] }

const PANEL_W = 292 // 3열 × 88px + 간격 6 × 2 + 패딩 8 × 2
const EDGE = 8      // 화면 가장자리 여백

export type PvField = 'action' | 'weapon' | 'expr'
type GridProps = {
  field: PvField
  options: Opt[]
  groups?: Group[]
  value: string
  onChange: (v: string) => void
  disabledValues?: Set<string>
  disabledTitle?: string
}

// ── 격자 본체(팝오버 · 모바일 화면 공용) ──────────────────────────────────────
export function PvGrid({ field, options, groups, value, onChange, disabledValues, disabledTitle, eager = 6 }: GridProps & { eager?: number }) {
  const s = useShop()
  // 지금 코디는 **열 때 한 번만** 뜬다 — 렌더마다 새 스냅샷을 만들면 칸마다 합성이 다시 돈다.
  const [base] = useState<Snapshot>(() => s.snapshot())

  // 칸마다 쓸 스냅샷: 지금 코디 + 그 액션/무기 모션. 표정은 아이콘이라 스냅샷이 필요 없다.
  const snaps = useMemo(() => {
    if (field === 'expr') return null
    const m = new Map<string, Snapshot>()
    for (const o of options) m.set(o.v, { ...base, pv: { ...(base.pv || ({} as NonNullable<Snapshot['pv']>)), [field]: o.v } })
    return m
  }, [base, field, options])

  // 짝이 되는 얼굴장식이 없는 '기본'·'눈깜빡'은 그림 없이 이름만 가운데 둔다.
  // (성형 아이템에는 아이콘이 없고, 표정별 얼굴 스프라이트는 눈·입만 떠 있어 그대로 두면 오히려 못 알아본다 — 2026-09-24 확인.)
  const iconOf = (v: string) => {
    if (field !== 'expr') return undefined
    const id = PV_EXPR_ICONS[v]
    return id ? spriteUrl(`sprites/${id}/icon.png`) : undefined
  }
  // 고른 값이 스크롤 아래에 있으면 열자마자 보이게 한다.
  const onCurrentCell = (el: HTMLButtonElement | null) => { if (el) el.scrollIntoView({ block: 'nearest' }) }

  const cells = (list: Opt[], from: number) => list.map((o, i) => {
    const on = o.v === value
    const dis = !!disabledValues?.has(o.v)
    const icon = iconOf(o.v)
    const snap = snaps?.get(o.v)
    return (
      <button key={o.v} ref={on ? onCurrentCell : undefined} type="button" role="option" aria-selected={on} aria-disabled={dis || undefined}
        title={dis ? disabledTitle : (field === 'expr' && !icon ? `${o.l} — 짝이 되는 표정 아이템이 없어 그림은 없어요` : o.l)}
        onClick={() => { if (dis) return; onChange(o.v) }}
        className={clsx(styles.pvCell, on && styles.pvCellOn, dis && styles.pvCellOff)}>
        {icon || snap ? (
          <>
            <span className={styles.pvCellArt}>
              {icon
                ? <img src={icon} alt="" width={46} height={58} className={styles.pvCellIcon} />
                : <SnapThumb snap={snap!} fraction={0.62} priority={from + i < eager ? 0 : 1} view />}
            </span>
            <span className={styles.pvCellName}>{o.l}</span>
          </>
        ) : <span className={styles.pvCellPlain}>{o.l}</span>}
      </button>
    )
  })

  // 그룹(액션 3묶음)은 격자 안에 제목 줄을 끼워 넣는다 — 칸 순서는 이어지므로 먼저 그릴 칸을 그룹과 무관하게 센다.
  let seen = 0
  return (
    <div className={styles.pvGrid}>
      {groups
        ? groups.map((g) => {
          const from = seen
          seen += g.items.length
          return (
            <div key={g.group} className={styles.pvGroup}>
              <span className={styles.pvGroupName}>{g.group}</span>
              {cells(g.items, from)}
            </div>
          )
        })
        : cells(options, 0)}
    </div>
  )
}

// ── 버튼 + 팝오버(PC · 태블릿) ────────────────────────────────────────────────
export default function PvPicker({ field, options, groups, value, onChange, variant, narrow, title, ariaLabel, shortLabel, isDefault, disabledValues, disabledTitle, onOpenPage }: GridProps & {
  variant: 'row' | 'rowM' | 'field' | 'fieldM'
  narrow?: boolean
  title?: string
  ariaLabel: string
  shortLabel?: string
  isDefault?: boolean
  onOpenPage?: () => void // 주면 팝오버 대신 시트 안 화면으로 넘긴다(모바일)
}) {
  const [pos, setPos] = useState<Pos | null>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const open = !!pos
  const current = (options.find((o) => o.v === value) || options[0] || { l: '' }).l

  const toggle = () => {
    if (onOpenPage) { onOpenPage(); return }
    if (open) { setPos(null); return }
    const el = btnRef.current; if (!el) return
    const r = el.getBoundingClientRect(), GAP = 6, CAP = 250 // 3열 × 2줄 + 다음 줄 살짝(스크롤이 있다는 신호)
    const below = window.innerHeight - r.bottom - GAP, above = r.top - GAP
    const up = below < Math.min(CAP, above)
    const maxH = Math.max(150, Math.min(CAP, (up ? above : below) - EDGE))
    const left = Math.max(EDGE, Math.min(Math.round(r.left), window.innerWidth - PANEL_W - EDGE))
    setPos({ left, maxH: Math.round(maxH), top: up ? null : Math.round(r.bottom + GAP), bottom: up ? Math.round(window.innerHeight - r.top + GAP) : null })
  }

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node
      if (btnRef.current?.contains(t) || panelRef.current?.contains(t)) return
      setPos(null)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopImmediatePropagation(); setPos(null) } }
    window.addEventListener('pointerdown', onDown, true)
    window.addEventListener('keydown', onKey, true)
    return () => { window.removeEventListener('pointerdown', onDown, true); window.removeEventListener('keydown', onKey, true) }
  }, [open])

  const isField = variant === 'field' || variant === 'fieldM'
  const cls = clsx('pb-ddbtn',
    variant === 'row' && ui.ddRow, variant === 'rowM' && ui.ddRowM,
    variant === 'field' && ui.ddField, variant === 'field' && narrow && ui.ddFieldNarrow,
    variant === 'fieldM' && ui.ddFieldM, open && ui.ddOpen)

  return (
    <>
      <button ref={btnRef} type="button" onClick={toggle} title={title ?? ariaLabel} aria-label={ariaLabel} aria-expanded={open} className={cls}>
        {isField
          ? <span className={clsx(ui.ddFieldText, isDefault && ui.ddFieldTextDef)}>{isDefault ? shortLabel : current}</span>
          : <span className={ui.ddRowText}>{current}</span>}
        <span className={clsx(ui.caret, open && ui.caretOpen)}>▾</span>
      </button>
      {open && typeof document !== 'undefined' && createPortal(
        <div ref={panelRef} role="listbox" aria-label={ariaLabel} className={clsx('pb-scroll', 'pb-scroll-thin', styles.pvPanel)}
          style={{ left: pos!.left, width: PANEL_W, maxHeight: pos!.maxH, top: pos!.top ?? undefined, bottom: pos!.bottom ?? undefined }}>
          <PvGrid field={field} options={options} groups={groups} value={value} disabledValues={disabledValues} disabledTitle={disabledTitle}
            onChange={(v) => { onChange(v); setPos(null) }} />
        </div>,
        document.body,
      )}
    </>
  )
}
