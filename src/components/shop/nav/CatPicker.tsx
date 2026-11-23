'use client'

// 카테고리 펼치기 — 부위 줄 오른쪽 끝의 버튼(사용자 지시: 카테고리가 많아져 옆으로 넘기기만으로는 멀다). 가로 스크롤은 그대로 두고 하나 더 생긴 길이다.
//  · 연출 설정 고르기와 같은 팝박스(preview/PopBox)다 — PC · 태블릿은 줄 위로 올라오고, 모바일은 줄 아래로 내려온다. 고르면 바로 닫힌다.
//  · 머리의 [순서 변경]을 켜면 프리셋과 같은 끌기(usePresetDrag)로 순서를 바꾼다. 바뀐 순서는 부위 줄에 그대로 반영되고 기기에 저장된다(ShopContext catBar).
//  · 순서 변경 중에는 [초기화]가 그 왼쪽에 나온다 — 두 번 눌러야 처음 순서로 돌아간다(lib/confirmTwice).
//  · 전체 · 신규 · 즐겨찾기는 늘 1, 2, 3번이다 — 순서 변경 중에는 흐려지고 자물쇠가 붙어 집을 수 없다.

import clsx from 'clsx'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { CONFIRM_ATTR, confirmTwice } from '@/lib/confirmTwice'
import { useShop } from '../ShopContext'
import { POP_GAP, PopBox, popNear, usePop, type PopPos } from '../preview/PopBox'
import { usePresetDrag } from '../preset/usePresetDrag'
import { IconCaretDown, IconCat, IconLock, IconReorder, IconReset } from '../ui/Icons'
import styles from './nav.module.css'
import { viewH, viewW } from '@/lib/viewport'
import { holdNavHidden } from '@/lib/scrollHide'

export const CAT_FIXED = [{ id: 'all', label: '전체' }, { id: 'new', label: '신규' }, { id: 'fav', label: '즐겨찾기' }]
const CAT_SIDE_M = 12 // 모바일 카드의 좌우 끝 = 목록 칸 여백 5(.viewportM) + 쪽 여백 7(.pageM). 창의 좌우 끝을 카드에 맞춘다
// 칸마다 부위 아이콘(ui/Icons IconCat — 메이플 메뉴 같은 꽉 찬 실루엣) (사용자 지시). PC 는 아이콘 · 글자를 왼쪽에 붙여 모든 칸의 아이콘이 같은 자리(사용자 지시 — 가운데 정렬은 글자 길이마다 아이콘 자리가 달랐다), 모바일은 칸이 좁아 글자 위(아이콘 16, 칸 높이 42)
// PC 창 폭을 칸 폭이 정수가 되게 깎는다 — 칸 폭이 소수면 아이콘이 픽셀 사이에 걸려 번졌다. 칸 최소 폭 · 간격 · 테두리 + 안쪽 여백은 nav.module.css 의 catGrid · catPop 값
const CAT_MIN = 96, CAT_GAP = 6, CAT_CHROME = 18
const snapW = (max: number) => { const cols = Math.max(1, Math.floor((max - CAT_CHROME + CAT_GAP) / (CAT_MIN + CAT_GAP))); const cell = Math.floor((max - CAT_CHROME - CAT_GAP * (cols - 1)) / cols); return cell * cols + CAT_GAP * (cols - 1) + CAT_CHROME }
const CAT_W_PC = 800 // 칸 왼쪽에 아이콘 자리를 두느라 760 은 긴 이름(명찰 / 말풍선)이 잘렸다
// 모바일 아래 탭 줄이 제자리에 있을 때의 윗변(숨어 있어도 제자리 기준). 탭 줄이 떠 있지 않은 보기('캐릭터만')는 지금 자리
const navRestTop = () => {
  const nav = document.querySelector<HTMLElement>('[data-pb-tabnav]')
  if (!nav) return viewH()
  return document.documentElement.hasAttribute('data-pb-nav') ? viewH() - nav.offsetHeight : nav.getBoundingClientRect().top
}

function CatPickBody({ mobile, on, onPick, close }: { mobile: boolean; on: string; onPick: (id: string) => void; close: () => void }) {
  const s = useShop()
  const [sorting, setSorting] = useState(false)
  const gridRef = useRef<HTMLDivElement>(null), boxRef = useRef<HTMLDivElement>(null)
  const dnd = usePresetDrag(sorting, s.catBar.map((c) => c.id), gridRef, boxRef, s.reorderCats, styles.catDragging, 'cat')
  const pick = (id: string) => { if (sorting || dnd.swallowClick()) return; onPick(id); close() }
  const ico = clsx(styles.catCellIco, mobile && styles.catCellIcoM)
  return (
    <>
      <div className={styles.catHead}>
        <span className={styles.catTitle}>카테고리</span>
        <div className={styles.catHeadBtns}>
          {sorting && (
            <button type="button" onClick={() => { if (confirmTwice('cat:reset', '한 번 더 누르면 처음 순서로 돌아가요')) s.reorderCats([]) }} {...{ [CONFIRM_ATTR]: 'cat:reset' }} title="처음 순서로 (두 번 누르기)" className={styles.catSort}>
              <IconReset />초기화
            </button>
          )}
          <button type="button" onClick={() => setSorting((v) => !v)} aria-pressed={sorting} title={sorting ? '순서 변경 끝내기' : '끌어서 순서 바꾸기'} className={clsx(styles.catSort, sorting && styles.catSortOn)}>
            <IconReorder size={14} />
            <span className={styles.catSortLabel}>
              <span aria-hidden={sorting || undefined} style={sorting ? { visibility: 'hidden' } : undefined}>순서 변경</span>
              <span aria-hidden={!sorting || undefined} style={sorting ? undefined : { visibility: 'hidden' }}>완료</span>
            </span>
          </button>
        </div>
      </div>
      <div ref={boxRef} className={clsx('pb-scroll', 'pb-fade', styles.catBody)}>
        <div ref={gridRef} className={clsx(styles.catGrid, mobile && styles.catGridM, mobile && styles.catGridIcoM)}>
          {CAT_FIXED.map((c) => (
            <button key={c.id} type="button" disabled={sorting} onClick={() => pick(c.id)} title={sorting ? '이 칸은 순서를 바꿀 수 없어요' : c.label}
              className={clsx(styles.catCell, ico, on === c.id && styles.catCellOn, sorting && styles.catCellLock)}>
              {sorting ? <IconLock size={11} /> : <IconCat id={c.id} size={mobile ? 16 : 18} />}<span className={styles.catCellName}>{c.label}</span>
            </button>
          ))}
          {s.catBar.map((c) => (
            <div key={c.id} role="button" tabIndex={0} data-preset-id={c.id} title={c.label} onClick={() => pick(c.id)} onPointerDown={(e) => dnd.onPointerDown(e, c.id)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(c.id) } }}
              className={clsx(styles.catCell, ico, on === c.id && styles.catCellOn, sorting && styles.catCellMove)}>
              <IconCat id={c.id} size={mobile ? 16 : 18} /><span className={styles.catCellName}>{c.label}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

// 줄 오른쪽 끝의 버튼 + 창. 모바일은 아래로, PC · 태블릿은 위로 펼쳐지므로 화살표도 그 방향을 가리킨다
export function CatExpand({ mobile, on, onPick }: { mobile: boolean; on: string; onPick: (id: string) => void }) {
  const s = useShop()
  const pop = usePop()
  const btnRef = useRef<HTMLButtonElement>(null)
  const open = pop.isOpen // 닫는 전환이 끝나기를 기다리지 않는다 — 화살표는 누른 즉시 돈다
  useEffect(() => { if (s.surface && open) pop.close() }, [s.surface]) // eslint-disable-line react-hooks/exhaustive-deps -- 다른 창이 뜨면 닫는다
  // 모바일 자리(사용자 지시): 위 끝 = 부위 줄 아래 + 틈, 높이는 내용을 따르되 상한 = 화면 아래 - 틈(탭 줄 자리까지).
  // 내용이 탭 줄 윗변 - 틈 안에 들어오면 탭 줄은 그대로, 넘치면 탭 줄을 잠시 내리고 그 자리까지 쓴다(그린 뒤 재서 정한다 — 아래 useLayoutEffect).
  // 페이지 스크롤에 따라 부위 줄 자리가 달라 쓸 수 있는 높이도 달라진다 — 열 때 재고, 열린 동안 스크롤 · 화면 높이가 바뀌면 다시 잰다
  const placeM = (): PopPos | null => {
    const b = btnRef.current?.getBoundingClientRect(); if (!b) return null
    const p = popNear(b, { left: 0, width: viewW(), top: 0, bottom: viewH() })
    const side = { left: CAT_SIDE_M, w: viewW() - CAT_SIDE_M * 2, fit: true }
    if (p.dir !== 'down' || p.top == null) return { ...p, ...side }
    return { ...p, ...side, h: Math.max(150, Math.floor(viewH() - POP_GAP - p.top)) }
  }
  useLayoutEffect(() => {
    const p = pop.pos
    if (!mobile || !p || p.dir !== 'down' || p.top == null) return
    const el = document.querySelector<HTMLElement>(`.${styles.catPop}`)
    if (el) holdNavHidden(p.top + el.offsetHeight > navRestTop() - POP_GAP)
  }, [mobile, pop.pos])
  useEffect(() => { if (!pop.shown) holdNavHidden(false) }, [pop.shown]) // 닫히기 시작하면 탭 줄이 함께 돌아온다
  useEffect(() => () => holdNavHidden(false), [])
  const live = useRef({ pop, placeM }); live.current = { pop, placeM }
  useEffect(() => {
    if (!mobile || !pop.shown) return
    let raf = 0
    const re = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const { pop: cur, placeM: place } = live.current, q = place()
        if (cur.isOpen && q && (q.top !== cur.pos?.top || q.h !== cur.pos?.h)) cur.open(q)
      })
    }
    const vv = window.visualViewport
    window.addEventListener('scroll', re, { passive: true }); window.addEventListener('resize', re); vv?.addEventListener('resize', re)
    return () => { cancelAnimationFrame(raf); window.removeEventListener('scroll', re); window.removeEventListener('resize', re); vv?.removeEventListener('resize', re) }
  }, [mobile, pop.shown])
  const toggle = () => {
    if (open) { pop.close(); return }
    const b = btnRef.current?.getBoundingClientRect(); if (!b) return
    const screen = { left: 0, width: viewW(), top: 0, bottom: viewH() }
    const main = mobile ? null : document.querySelector('main[data-pb-body]')?.getBoundingClientRect()
    const p = popNear(b, main ?? screen)
    // 높이는 내용을 따른다. PC 는 창 아래 끝을 목록 아래 끝에, 오른쪽 끝을 부위 줄 끝에, 모바일은 좌우 끝을 카드 끝에 맞춘다
    if (mobile) { const q = placeM(); if (q) pop.open(q); return }
    const edge = btnRef.current?.parentElement?.getBoundingClientRect().right ?? b.right // 창 오른쪽 끝 = 부위 줄 오른쪽 끝
    const right = Math.round(edge), max = Math.min(right - p.left, CAT_W_PC)
    const w = snapW(max)
    pop.open({ ...p, w, left: right - w, bottom: main ? Math.round(viewH() - main.bottom) : p.bottom, fit: true })
  }
  return (
    <>
      <button ref={btnRef} type="button" data-guide="cats" onClick={toggle} aria-expanded={open} aria-label="카테고리 펼치기" title="카테고리 펼치기"
        className={clsx(styles.catExpand, mobile && styles.catExpandM, !mobile && styles.catExpandUp, open && styles.catExpandOpen)}>
        <IconCaretDown size={12} />
      </button>
      <PopBox pop={pop} label="카테고리" keep={[btnRef]} className={styles.catPop}>
        <CatPickBody mobile={mobile} on={on} onPick={onPick} close={pop.close} />
      </PopBox>
    </>
  )
}
