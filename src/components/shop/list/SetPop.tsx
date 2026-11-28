'use client'

// 세트 보기(사용자 지시 — 아이템을 보다가 그 세트를 검색 칸 없이 바로, 이름과 그림만 미니멀하게. 세트 칸을 누르면 그 아이템을 입거나 벗는다).
//  · 카드 그림 칸 왼쪽 위의 '세트 N' 칩(코디 칩과 같은 꼴)이 입구다 — 세트에 든 아이템에만 붙는다(구성 맵을 받은 뒤).
//  · PC: 칩에 마우스를 올리면 카드 옆에 창이 뜬다(누를 필요가 없다 — 사용자 지시). 마우스가 그 카드나 창 위에 있는 동안 열려 있고, 둘 다 벗어나면 닫힌다.
//        카드 어디서나 뜨면 빠르게 훑을 때 방해라, 여는 곳은 칩 하나다. 창 크기가 바뀌거나 목록이 움직이면 닫는다.
//  · 모바일: 칩을 누르면 아래 시트(서피스 'set' — 내용 높이만큼이라 입히는 동안 미리보기가 보인다).
//  · 칸 = 그림(북마크 칸과 같은 BookmarkSprite) + 이름. 입고 있는 아이템은 분홍(북마크 칸의 '착용 중'과 같은 색). 누르면 카드를 누른 것과 같이 입고 벗는다(equipFromCat).
//  · 구성 맵은 목록이 뜬 뒤 한가할 때 한 번 받는다(lib/core/data loadSetMembers — 압축 62KB).
import clsx from 'clsx'
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { loadSetMembers, setOf, type ListItem, type SetEntry, type SetMember, type SetMembers } from '@/lib/core/data'
import { SLOT_TO_CAT } from '@/lib/shopData'
import { viewH, viewW } from '@/lib/viewport'
import { useShop, type Snapshot } from '../ShopContext'
import { PopBox, usePop } from '../preview/PopBox'
import { BookmarkSprite } from '../preview/PreviewParts'
import { IconCat } from '../ui/Icons'
import styles from './list.module.css'

// ── 구성 맵: 한가할 때 한 번 받고, 받으면 칩들이 다시 그린다 ──
let table: SetMembers | null = null, asked = false
const subs = new Set<() => void>()
const sub = (f: () => void) => {
  subs.add(f)
  if (!asked) {
    asked = true
    const go = () => loadSetMembers().then((t) => { table = t; subs.forEach((g) => g()) })
    if ('requestIdleCallback' in window) requestIdleCallback(go, { timeout: 2500 }); else setTimeout(go, 300)
  }
  return () => { subs.delete(f) }
}
export const useSetTable = () => useSyncExternalStore(sub, () => table, () => null)
export const setEntryOf = (it: { id: string; slot: string }): SetEntry | null => { const e = table ? setOf(table, it) : null; return e && e.members.length > 1 ? e : null }

// 헤어는 끝자리, 성형은 백의 자리가 색 — 같은 색 묶음이면 같은 아이템
const colorBase = (id: string, slot: string) => { const step = slot === 'hair' ? 1 : slot === 'face' ? 100 : 0; if (!step) return id; const n = Number(id); return String(n - (Math.floor(n / step) % 10) * step) }

// 세트 칸 목록(PC 창 · 모바일 시트가 같이 쓴다)
export function SetList({ entry, mobile }: { entry: SetEntry; mobile: boolean }) {
  const s = useShop()
  const wear = async (m: SetMember) => {
    const eq = await s.resolveSnapItems({ equipped: { [m.slot]: m.id } } as unknown as Snapshot)
    const it = eq[m.slot]
    if (it) s.equipFromCat(SLOT_TO_CAT[m.slot], it); else s.notify('이 아이템을 찾지 못했어요')
  }
  return (
    <div className={clsx(styles.setGrid, mobile && styles.setGridM)}>
      {entry.members.map((m) => {
        const w = s.equipped[m.slot], on = !!w && colorBase(w.id, m.slot) === colorBase(m.id, m.slot)
        return (
          <button key={m.id} type="button" onClick={() => wear(m)} title={`${m.name} — ${on ? '눌러서 벗기' : '눌러서 입혀보기'}`} aria-pressed={on} className={clsx(styles.setCell, on && styles.setCellOn)}>
            <span className={styles.setSprite}><BookmarkSprite item={{ id: m.id, slot: m.slot, name: m.name, icon: m.icon || undefined } as ListItem} /></span>
            <span className={styles.setName}>{m.name}</span>
          </button>
        )
      })}
    </div>
  )
}

// ── 카드의 칩 ──
export function SetChip({ item, mobile }: { item: ListItem; mobile: boolean }) {
  const s = useShop()
  useSetTable()
  const entry = setEntryOf(item)
  const ref = useRef<HTMLButtonElement>(null)
  const t = useRef(0)
  if (!entry) return null
  const enter = (e: React.PointerEvent) => { if (e.pointerType !== 'mouse') return; window.clearTimeout(t.current); t.current = window.setTimeout(() => { if (ref.current) hoverOpen(item, entry, ref.current) }, 90) }
  const leave = () => window.clearTimeout(t.current)
  const click = (e: React.MouseEvent) => { e.stopPropagation(); if (s.consumeSwipeClick()) return; if (mobile) s.openSetSheet(item); else if (ref.current) hoverOpen(item, entry, ref.current) }
  return (
    <button ref={ref} type="button" onClick={click} onPointerEnter={enter} onPointerLeave={leave} title={`${entry.name} ${entry.members.length}개`} aria-label={`세트 ${entry.members.length}개 보기`}
      className={clsx(styles.setChip, mobile && styles.setChipM, s.newIds.has(item.id) && styles.setChipLow)}>
      {mobile ? <><IconCat id="all" size={10} />{entry.members.length}</> : `세트 ${entry.members.length}`}
    </button>
  )
}

// ── PC 창: 칩에 올리면 카드 옆에 ──
type Open = { item: ListItem; entry: SetEntry; chip: HTMLElement; card: HTMLElement }
let req: Open | null = null
const reqSubs = new Set<() => void>()
function hoverOpen(item: ListItem, entry: SetEntry, chip: HTMLElement) {
  const card = chip.closest<HTMLElement>('.pb-cardwrap') ?? chip
  if (req && req.item.id === item.id && req.card === card) return
  req = { item, entry, chip, card }; reqSubs.forEach((f) => f())
}
const closeHover = () => { if (req) { req = null; reqSubs.forEach((f) => f()) } }
const SET_W = 380
export function SetHoverHost() {
  const cur = useSyncExternalStore((f) => { reqSubs.add(f); return () => { reqSubs.delete(f) } }, () => req, () => null)
  const pop = usePop()
  const [shown, setShown] = useState<Open | null>(null)
  const live = useRef(pop); live.current = pop
  useEffect(() => {
    if (!cur) { live.current.close(); return }
    const r = cur.card.getBoundingClientRect(), vw = viewW(), vh = viewH()
    const left = r.right + 8 + SET_W <= vw - 8 ? Math.round(r.right + 8) : Math.round(Math.max(8, r.left - 8 - SET_W))
    const rows = Math.ceil(cur.entry.members.length / 2), est = 41 + 16 + rows * 48 + (rows - 1) * 6
    const top = Math.round(Math.max(8, Math.min(r.top, vh - 8 - Math.min(est, vh - 16))))
    setShown(cur)
    live.current.open({ left, w: SET_W, dir: 'down', top, h: vh - 8 - top, fit: true })
  }, [cur])
  // 마우스가 그 카드나 창 위에 있는 동안만 — 둘 다 벗어나면 잠깐 뒤 닫는다. 창 크기 · 목록 스크롤에는 바로 닫는다
  useEffect(() => {
    if (!cur) return
    let t = 0
    const inside = (n: EventTarget | null) => n instanceof Node && (cur.card.contains(n) || !!document.querySelector(`.${styles.setPop}`)?.contains(n))
    const move = (e: PointerEvent) => { if (e.pointerType !== 'mouse') return; if (inside(e.target)) { window.clearTimeout(t); t = 0 } else if (!t) t = window.setTimeout(closeHover, 140) }
    const out = (e: MouseEvent) => { if (!e.relatedTarget) closeHover() } // 창 밖으로
    const scroll = (e: Event) => { if (!(e.target instanceof Node && document.querySelector(`.${styles.setPop}`)?.contains(e.target))) closeHover() }
    document.addEventListener('pointermove', move, { passive: true })
    document.addEventListener('mouseout', out)
    window.addEventListener('resize', closeHover)
    window.addEventListener('scroll', scroll, { capture: true, passive: true })
    return () => { window.clearTimeout(t); document.removeEventListener('pointermove', move); document.removeEventListener('mouseout', out); window.removeEventListener('resize', closeHover); window.removeEventListener('scroll', scroll, { capture: true } as EventListenerOptions) }
  }, [cur])
  // 바깥 누름 · Esc 로 창이 닫히면(PopBox) 열린 표시도 지운다 — 같은 카드의 칩에서 다시 열 수 있게
  const was = useRef(false)
  useEffect(() => { if (pop.isOpen) was.current = true; else if (was.current) { was.current = false; closeHover() } }, [pop.isOpen])
  useEffect(() => () => closeHover(), [])
  if (!shown) return null
  return (
    <PopBox pop={pop} label="세트" keep={[{ current: shown.card }]} className={styles.setPop}>
      <SetHead entry={shown.entry} />
      <div className={clsx('pb-scroll', 'pb-fade', styles.setBody)}><SetList entry={shown.entry} mobile={false} /></div>
    </PopBox>
  )
}
const SetHead = ({ entry }: { entry: SetEntry }) => (
  <div className={styles.setHead}><span className={styles.setTitle}>{entry.name}</span><span className={styles.setCount}>{entry.members.length}개</span></div>
)

// ── 모바일 시트 본문(서피스 'set') ──
export function SetSheetBody({ item }: { item: ListItem }) {
  useSetTable()
  const entry = setEntryOf(item)
  if (!entry) return null
  return <div className={clsx('pb-scroll', 'pb-fade', styles.setSheet)}><SetList entry={entry} mobile /></div>
}
