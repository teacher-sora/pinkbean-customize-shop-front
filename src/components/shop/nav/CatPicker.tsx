'use client'

// 카테고리 펼치기 — 부위 줄 오른쪽 끝의 버튼(사용자 지시: 카테고리가 많아져 옆으로 넘기기만으로는 멀다). 가로 스크롤은 그대로 두고 하나 더 생긴 길이다.
//  · 연출 설정 고르기와 같은 팝박스(preview/PopBox)다 — PC · 태블릿은 줄 위로 올라오고, 모바일은 줄 아래로 내려온다. 고르면 바로 닫힌다.
//  · 머리의 [순서 변경]을 켜면 프리셋과 같은 끌기(usePresetDrag)로 순서를 바꾼다. 바뀐 순서는 부위 줄에 그대로 반영되고 기기에 저장된다(ShopContext catBar).
//  · 전체 · 신규 · 즐겨찾기는 늘 1, 2, 3번이다 — 순서 변경 중에는 흐려지고 자물쇠가 붙어 집을 수 없다.

import clsx from 'clsx'
import { useEffect, useRef, useState } from 'react'
import { useShop } from '../ShopContext'
import { PopBox, PopScroll, popNear, usePop } from '../preview/PopBox'
import { usePresetDrag } from '../preset/usePresetDrag'
import { IconCaretDown, IconLock, IconReorder } from '../ui/Icons'
import styles from './nav.module.css'

export const CAT_FIXED = [{ id: 'all', label: '전체' }, { id: 'new', label: '신규' }, { id: 'fav', label: '즐겨찾기' }]
const CAT_HEAD_H = 44, CAT_ROW_H = 40, CAT_PAD = 24 // 창 높이 = 머리 + 줄 수 × 칸 + 위아래 여백(칸이 적으면 창도 낮다)
const CAT_W_PC = 760, CAT_CELL_PC = 102, CAT_COLS_M = 4

function CatPickBody({ mobile, on, onPick, close }: { mobile: boolean; on: string; onPick: (id: string) => void; close: () => void }) {
  const s = useShop()
  const [sorting, setSorting] = useState(false)
  const gridRef = useRef<HTMLDivElement>(null), boxRef = useRef<HTMLDivElement>(null)
  const dnd = usePresetDrag(sorting, s.catBar.map((c) => c.id), gridRef, boxRef, s.reorderCats, styles.catDragging, 'cat')
  const pick = (id: string) => { if (sorting || dnd.swallowClick()) return; onPick(id); close() }
  return (
    <>
      <div className={styles.catHead}>
        <span className={styles.catTitle}>카테고리</span>
        <button type="button" onClick={() => setSorting((v) => !v)} aria-pressed={sorting} title={sorting ? '순서 변경 끝내기' : '끌어서 순서 바꾸기'} className={clsx(styles.catSort, sorting && styles.catSortOn)}>
          <IconReorder size={14} />
          <span className={styles.catSortLabel}>
            <span aria-hidden={sorting || undefined} style={sorting ? { visibility: 'hidden' } : undefined}>순서 변경</span>
            <span aria-hidden={!sorting || undefined} style={sorting ? undefined : { visibility: 'hidden' }}>완료</span>
          </span>
        </button>
      </div>
      <PopScroll boxRef={boxRef}>
        <div ref={gridRef} className={clsx(styles.catGrid, mobile && styles.catGridM)}>
          {CAT_FIXED.map((c) => (
            <button key={c.id} type="button" disabled={sorting} onClick={() => pick(c.id)} title={sorting ? '이 칸은 순서를 바꿀 수 없어요' : c.label}
              className={clsx(styles.catCell, on === c.id && styles.catCellOn, sorting && styles.catCellLock)}>
              {sorting && <IconLock size={11} />}<span className={styles.catCellName}>{c.label}</span>
            </button>
          ))}
          {s.catBar.map((c) => (
            <div key={c.id} role="button" tabIndex={0} data-preset-id={c.id} title={c.label} onClick={() => pick(c.id)} onPointerDown={(e) => dnd.onPointerDown(e, c.id)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(c.id) } }}
              className={clsx(styles.catCell, on === c.id && styles.catCellOn, sorting && styles.catCellMove)}>
              <span className={styles.catCellName}>{c.label}</span>
            </div>
          ))}
        </div>
      </PopScroll>
    </>
  )
}

// 줄 오른쪽 끝의 버튼 + 창. 모바일은 아래로, PC · 태블릿은 위로 펼쳐지므로 화살표도 그 방향을 가리킨다
export function CatExpand({ mobile, on, onPick }: { mobile: boolean; on: string; onPick: (id: string) => void }) {
  const s = useShop()
  const pop = usePop()
  const btnRef = useRef<HTMLButtonElement>(null)
  const open = !!pop.pos
  useEffect(() => { if (s.surface && open) pop.close() }, [s.surface]) // eslint-disable-line react-hooks/exhaustive-deps -- 다른 창이 뜨면 닫는다
  const toggle = () => {
    if (open) { pop.close(); return }
    const b = btnRef.current?.getBoundingClientRect(); if (!b) return
    const screen = { left: 0, width: window.innerWidth, top: 0, bottom: window.innerHeight }
    const main = mobile ? null : document.querySelector('main[data-pb-body]')?.getBoundingClientRect()
    const p = popNear(b, main ?? screen)
    const w = mobile ? p.w : Math.min(p.w, CAT_W_PC)
    const cols = mobile ? CAT_COLS_M : Math.max(3, Math.floor((w - CAT_PAD) / CAT_CELL_PC))
    const rows = Math.ceil((CAT_FIXED.length + s.catBar.length) / cols)
    pop.open({ ...p, w, left: mobile ? p.left : Math.max(p.left, Math.round(b.right - w)), h: Math.min(p.h, CAT_HEAD_H + rows * CAT_ROW_H + CAT_PAD) })
  }
  return (
    <>
      <button ref={btnRef} type="button" data-guide="cats" onClick={toggle} aria-expanded={open} aria-label="카테고리 펼치기" title="카테고리 펼치기"
        className={clsx(styles.catExpand, mobile && styles.catExpandM, !mobile && styles.catExpandUp, open && styles.catExpandOpen)}>
        <IconCaretDown size={12} />
      </button>
      <PopBox pop={pop} label="카테고리" keep={[btnRef]}>
        <CatPickBody mobile={mobile} on={on} onPick={onPick} close={pop.close} />
      </PopBox>
    </>
  )
}
