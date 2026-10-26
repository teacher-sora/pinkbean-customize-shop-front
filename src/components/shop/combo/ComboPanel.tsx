'use client'

// 코디 조합 — 넥슨 랭킹 캐릭터의 실제 코디 표본에서 아이템 하나를 입은 코디와 자주 쓴 염색을 본다(lib/looks).
//  · 코디 탭: 목록 카드의 '코디 N' 칩으로 열면 목록 자리가 이 패널이 된다(PinkbeanShop). 미리보기는 그대로라 칩 · 입기를 바로 본다.
//    닫으면(← · Esc) 보던 목록 쪽으로 돌아간다 — 목록 상태는 ShopContext 에 그대로 있다.
//  · 코디 광장의 '코디 조합' 분류: 같은 패널이 광장 목록 자리에 들어가고, 머리의 검색 칸으로 아이템을 고른다.
// 목록은 코디 탭 · AI 코디 검색 목록과 같다(사용자 지시): 쪽 넘김 · 휠 · 끌기 · 방향키 · 쪽 번호는 ShopContext 의 쪽 넘김을 그대로 쓰고
// (쪽 크기 = 그 자리의 격자, 쪽 수 = 그 아이템의 코디 수), 머리에서 넘기는 방향(가로 · 세로)을 고른다. 쪽은 back POST /looks 로 받고
// 지금 쪽 ±1 만 카드로 그린다. 순서는 꾸민 코디(캐시 아이템) · 랭킹 상위가 먼저다(parser looks/build.ts).
// 카드를 누르면 패널 안에서 상세로 넘어간다(부위만 골라 입기 · 프리셋에 저장).

import clsx from 'clsx'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { ListItem } from '@/lib/core/data'
import { COMBO_SKIP, LOOK_CHUNK, countLabel, loadLookCounts, loadLookMeta, lookChunk, type LookDye, type LookMeta, type LookPage, type LookRow } from '@/lib/looks'
import { NEXON_CREDIT } from '@/lib/nexonLook'
import { SLOT_TO_CAT, skinDyeFamily } from '@/lib/shopData'
import { isNarrow } from '@/lib/useBreakpoint'
import SnapThumb, { warmSnap } from '../SnapThumb'
import { useShop } from '../ShopContext'
import { DyeBand, LookSprite } from '../info/SlotSprite'
import { DIRS } from '../list/ListArea'
import { WornItems } from '../plaza/PlazaDetailBody'
import { Seg } from '../ui/controls'
import { IconChevronLeft, IconChevronRight, IconSearch, IconTakeDown } from '../ui/Icons'
import list from '../list/list.module.css'
import surf from '../surface/surface.module.css'
import ui from '../ui/ui.module.css'
import styles from './combo.module.css'

const FRACTION = 0.4, FRACTION_M = 0.5

export default function ComboPanel({ mobile, host }: { mobile: boolean; host: 'codi' | 'plaza' }) {
  const s = useShop()
  const item = s.comboItem
  const [detail, setDetail] = useState<LookRow | null>(null)
  useEffect(() => { setDetail(null) }, [item?.id])
  const holdPager = s.holdPager
  useEffect(() => { holdPager(!!detail); return () => holdPager(false) }, [detail, holdPager])
  // Esc: 상세 → 목록, 목록 → 패널 닫기(코디 탭). 창(서피스)이 떠 있으면 그 창의 몫이다
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || s.surface) return
      if (detail) { setDetail(null); return }
      if (host === 'codi') s.closeCombo()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [detail, host, s.surface, s.closeCombo])

  const body = !item ? <ComboEmpty mobile={mobile} />
    : detail ? <ComboDetail key={detail.i} row={detail} item={item} mobile={mobile} onBack={() => setDetail(null)} />
      : <ComboList key={item.id} item={item} mobile={mobile} host={host} onOpen={setDetail} />
  if (mobile) return <div className={styles.rootM}>{body}</div>
  return <section className={clsx(list.panel, styles.root)}>{body}</section>
}

// 머리 왼쪽: 코디 탭은 [←] + 아이템, 광장은 아이템 + 아이템 찾기 칸. 모바일 광장은 자리가 좁아 아이템을 그림만 두고
// 이름은 찾기 칸의 안내 글로 보인다(찾기 칸이 돋보기만 남을 만큼 좁아졌다)
function HeadItem({ item, mobile, host, total }: { item: ListItem | null; mobile: boolean; host: 'codi' | 'plaza'; total: number | null }) {
  const s = useShop()
  const showSub = mobile || isNarrow(s.bp) // 넓은 PC 는 쪽 칩 왼쪽에 코디 수가 있다
  const thumbOnly = mobile && host === 'plaza'
  return (
    <div className={styles.headItem}>
      {host === 'codi' && (
        <button type="button" onClick={s.closeCombo} title="목록으로 (Esc)" aria-label="목록으로" className={clsx('pb-soft', styles.back, mobile && styles.backM)}><IconChevronLeft /></button>
      )}
      {item && (
        <span className={styles.itemTag} title={item.name || item.id}>
          <span className={clsx('pb-chipthumb', styles.itemThumb, mobile && styles.itemThumbM)}><LookSprite slot={item.slot} item={item.slot === 'skin' ? null : item} tone={s.index?.base.tones.find((t) => t.body === item.id)?.tone ?? s.tone} /></span>
          {!thumbOnly && <span className={styles.itemText}>
            <span className={clsx(styles.itemName, mobile && styles.itemNameM)}>{item.name || item.id}</span>
            {showSub && <span className={styles.itemSub}>{total == null ? ' ' : `코디 ${total.toLocaleString()}벌`}</span>}
          </span>}
        </span>
      )}
      {host === 'plaza' && <ItemFinder mobile={mobile} now={thumbOnly ? item : null} />}
    </div>
  )
}

// 광장의 코디 조합: 이름으로 아이템을 찾는다(모든 부위 + 피부). 표본에 있는 것만, 코디가 많은 순으로 8개
function ItemFinder({ mobile, now }: { mobile: boolean; now: ListItem | null }) {
  const s = useShop()
  const [q, setQ] = useState('')
  const [hits, setHits] = useState<{ it: ListItem; n: number }[]>([])
  const [open, setOpen] = useState(false)
  const counts = useCountsMap()
  useEffect(() => {
    let alive = true
    const t = setTimeout(() => {
      s.searchItems(q).then((r) => {
        if (!alive) return
        setHits(r.filter((it) => !COMBO_SKIP.has(it.slot)).map((it) => ({ it, n: counts[it.id] ?? 0 })).filter((x) => x.n > 0).sort((a, b) => b.n - a.n).slice(0, 8))
      }).catch(() => {})
    }, 160)
    return () => { alive = false; clearTimeout(t) }
  }, [q, counts])
  const pick = (it: ListItem) => { s.pickCombo(it); setQ(''); setOpen(false) }
  return (
    <div className={clsx(list.searchWrap, styles.finder, mobile && styles.finderM)}>
      <IconSearch className={list.searchIcon} />
      <input value={q} onChange={(e) => { setQ(e.target.value); setOpen(true) }} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={(e) => { if (e.key === 'Enter' && hits[0]) pick(hits[0].it); if (e.key === 'Escape') { e.stopPropagation(); setOpen(false) } }}
        placeholder={now ? now.name || now.id : '아이템 이름으로 찾기'} aria-label="아이템 찾기" className={clsx('pb-input', list.searchInput)} />
      {open && q.trim() && (
        <div className={styles.finderPop} role="listbox">
          {hits.length ? hits.map(({ it, n }) => (
            <button key={it.id} type="button" role="option" aria-selected={false} onMouseDown={(e) => e.preventDefault()} onClick={() => pick(it)} className={styles.finderRow}>
              <span className={clsx('pb-chipthumb', styles.finderThumb)}><LookSprite slot={it.slot} item={it.slot === 'skin' ? null : it} tone={s.index?.base.tones.find((t) => t.body === it.id)?.tone ?? s.tone} /></span>
              <span className={styles.finderName}>{it.name || it.id}</span>
              <span className={styles.finderN}>코디 {countLabel(n)}</span>
            </button>
          )) : <span className={styles.finderNone}>표본에 없는 아이템이에요</span>}
        </div>
      )}
    </div>
  )
}
// 아이템 찾기에서 쓸 코디 수 표(카드 칩과 같은 counts.json — lib/looks 가 한 번 받아 둔 것)
function useCountsMap(): Record<string, number> {
  const [m, setM] = useState<Record<string, number>>({})
  useEffect(() => { loadLookCounts().then(setM).catch(() => {}) }, [])
  return m
}

function ComboEmpty({ mobile }: { mobile: boolean }) {
  return (
    <>
      <div className={mobile ? list.controlsM : list.header}><HeadItem item={null} mobile={mobile} host="plaza" total={null} /></div>
      <div className={mobile ? list.hrM : list.hr} />
      <div className={clsx(list.viewport, styles.emptyWrap)}>
        <div className={mobile ? list.emptyM : list.empty}>
          <span className={mobile ? list.emptyTitleM : list.emptyTitle}>아이템을 골라 주세요</span>
          <span className={mobile ? list.emptyHintM : list.emptyHint}>그 아이템을 입은 실제 유저 코디와 자주 쓴 염색이 보여요.</span>
        </div>
      </div>
      <Credit mobile={mobile} />
    </>
  )
}

// 힌트 바: (PC) 넘기는 법 + 기준 날짜(넓은 PC) + 출처(넥슨 Open API 이용약관 제6조 ④ — 늘 보인다)
function Credit({ mobile, hint }: { mobile: boolean; hint?: string }) {
  const s = useShop()
  const [meta, setMeta] = useState<LookMeta | null>(null)
  useEffect(() => { loadLookMeta().then(setMeta).catch(() => {}) }, [])
  const when = meta?.to && !isNarrow(s.bp) ? `${meta.to.replace(/-/g, '.')} 기준` : ''
  return (
    <div className={clsx(mobile ? styles.creditM : clsx('pb-hintbar', list.hintBar), styles.credit)}>
      {hint && !mobile && <span className={list.hintText}>{hint}</span>}
      {when && <span className={list.hintText}>{when}</span>}
      <span className={list.hintText}>{NEXON_CREDIT}</span>
    </div>
  )
}

// ── 목록 ──────────────────────────────────────────────────────────
// 모바일 스크롤 위치 → 쪽 번호. 쪽 = cols × rows, 쪽 안 여백 5 + 칸 사이 10 이라 열(줄)이 정확히 폭/cols(높이/rows)마다 이어진다(목록과 같은 규칙)
const scrollIdx = (vp: HTMLElement, y: boolean, cols: number, rows: number) => {
  const w = y ? vp.clientHeight : vp.clientWidth; if (!w) return -1
  const n = y ? rows : cols
  return Math.floor(Math.round((y ? vp.scrollTop : vp.scrollLeft) / (w / n)) / n)
}

function ComboList({ item, mobile, host, onOpen }: { item: ListItem; mobile: boolean; host: 'codi' | 'plaza'; onOpen: (r: LookRow) => void }) {
  const s = useShop()
  const narrow = isNarrow(s.bp)
  const cols = host === 'plaza' ? s.plazaCols : s.cols
  const rows = host === 'plaza' ? s.plazaRows : s.rows
  const per = cols * rows
  const dirY = s.listDir === 'y'
  // 받기는 60벌 묶음(lib/looks lookChunk — 쪽 크기와 상관없다. 칩에서 미리 받은 첫 묶음을 그대로 쓴다), 쪽은 그 묶음에서 잘라 낸다
  const [chunks, setChunks] = useState<Record<number, LookRow[]>>({})
  const [first, setFirst] = useState<LookPage | null>(null)
  const [failed, setFailed] = useState(false)
  const total = first?.total ?? null
  const cur = s.curIdx, pageCount = s.pageCount

  // 첫 묶음 = 코디 수 · 자주 쓴 염색 — 받은 코디 수로 쪽 넘김의 쪽 수가 정해진다
  const setComboTotal = s.setComboTotal
  useEffect(() => {
    let alive = true
    setFailed(false)
    lookChunk(item.id, 0).then((d) => {
      if (!alive) return
      setFirst(d); setChunks((m) => ({ ...m, 0: d.looks }))
      setComboTotal(item.id, d.total)
    }).catch(() => { if (alive) setFailed(true) })
    return () => { alive = false }
  }, [item.id, setComboTotal])
  // 지금 쪽 −1 ~ +2 쪽이 걸친 묶음을 받아 둔다(넘기면 바로 그려지게)
  useEffect(() => {
    if (!first?.ready || !per) return
    let alive = true
    const c0 = Math.floor(Math.max(0, cur - 1) * per / LOOK_CHUNK)
    const c1 = Math.floor((Math.min(pageCount - 1, cur + 2) * per + per - 1) / LOOK_CHUNK)
    for (let c = c0; c <= c1; c++) {
      if (chunks[c] || c * LOOK_CHUNK >= first.total) continue
      lookChunk(item.id, c).then((d) => { if (alive) setChunks((m) => (m[c] ? m : { ...m, [c]: d.looks })) }).catch(() => {})
    }
    return () => { alive = false }
  }, [cur, first, pageCount, per, item.id])
  // 쪽 p 의 코디(그 쪽이 걸친 묶음이 다 왔을 때만)
  const pageRows = (p: number): LookRow[] | null => {
    const a = p * per, b = Math.min(total ?? 0, a + per), out: LookRow[] = []
    for (let i = a; i < b; i++) { const c = chunks[Math.floor(i / LOOK_CHUNK)]; if (!c) return null; const r = c[i % LOOK_CHUNK]; if (r) out.push(r) }
    return out
  }

  // 뷰포트 = 목록의 것(측정 · 휠 · 끌기). 모바일은 브라우저 스크롤 ↔ 쪽 번호를 서로 맞춘다(ListArea 와 같다)
  const vpRef = useRef<HTMLDivElement | null>(null)
  const bindVp = s.bindVp
  const setVp = useCallback((el: HTMLDivElement | null) => { vpRef.current = el; bindVp(el) }, [bindVp])
  const live = useRef({ idx: cur, setIdx: s.setIdx, cols, rows })
  live.current = { idx: cur, setIdx: s.setIdx, cols, rows }
  useEffect(() => {
    const vp = vpRef.current
    if (!mobile || !vp) return
    let raf = 0
    const onScroll = () => {
      if (raf) return
      raf = requestAnimationFrame(() => {
        raf = 0
        const i = scrollIdx(vp, dirY, live.current.cols, live.current.rows); if (i < 0) return
        if (i !== live.current.idx) live.current.setIdx(i, false)
      })
    }
    vp.addEventListener('scroll', onScroll, { passive: true })
    return () => { vp.removeEventListener('scroll', onScroll); cancelAnimationFrame(raf) }
  }, [mobile, dirY])
  const scrollKey = `combo|${item.id}|${s.listDir}`
  const lastKey = useRef(scrollKey)
  const scrolledOnce = useRef(false)
  useLayoutEffect(() => {
    const vp = vpRef.current
    if (!mobile || !vp) return
    const w = dirY ? vp.clientHeight : vp.clientWidth; if (!w) return
    const jump = lastKey.current !== scrollKey || !scrolledOnce.current
    lastKey.current = scrollKey
    scrolledOnce.current = true
    if (scrollIdx(vp, dirY, cols, rows) === cur && !jump) return
    const target = cur * w
    const smooth = !(jump || Math.abs((dirY ? vp.scrollTop : vp.scrollLeft) - target) > w * 3)
    // 트랙 길이가 쪽 수만큼 자랄 때까지 프레임을 넘겨 다시 본다(ListArea 의 같은 자리 주석)
    let raf = 0, left = 120
    const go = () => {
      raf = 0
      if (!vp.isConnected) return
      const room = dirY ? vp.scrollHeight - vp.clientHeight : vp.scrollWidth - vp.clientWidth
      if (room < target && left-- > 0) { raf = requestAnimationFrame(go); return }
      const to = Math.min(target, Math.max(0, room))
      vp.scrollTo({ ...(dirY ? { top: to, left: 0 } : { left: to, top: 0 }), behavior: smooth ? 'smooth' : ('instant' as ScrollBehavior) })
    }
    go()
    return () => { if (raf) cancelAnimationFrame(raf) }
  }, [mobile, cur, scrollKey, pageCount, dirY, cols, rows])

  // 쪽 칩 — 목록 머리와 같은 부품(넓은 PC 는 코디 수 · 화살표까지)
  const pageChip = (
    <div className={mobile ? list.pageChipM : clsx(list.pageChip, narrow && list.pageChipNarrow)}>
      {!mobile && !narrow && (
        <>
          <span title="이 아이템을 입은 코디 수" className={list.count}>{total == null ? ' ' : `${total.toLocaleString()}벌`}</span>
          <span className={list.chipDiv} />
        </>
      )}
      {!mobile && <button type="button" onClick={() => s.step(-1)} disabled={cur <= 0} title={dirY ? '이전 페이지 (↑)' : '이전 페이지 (←)'} aria-label="이전 페이지" className={clsx('pb-arrow', list.arrow, cur > 0 && list.arrowOn)}><IconChevronLeft /></button>}
      <input value={s.pageEditing ? s.pageInput : `${cur + 1}`} onFocus={s.onPageFocus} onChange={s.onPageChange} onKeyDown={s.onPageKey} onBlur={s.commitPage}
        inputMode="numeric" aria-label="현재 페이지" title={mobile ? undefined : '번호를 입력해 이동'} className={clsx('pb-input', 'pb-pageinput', list.pageInput)} />
      <span className={mobile ? list.slashM : list.slash}>/</span>
      <span className={list.total}>{pageCount.toLocaleString()}</span>
      {!mobile && <button type="button" onClick={() => s.step(1)} disabled={cur >= pageCount - 1} title={dirY ? '다음 페이지 (↓)' : '다음 페이지 (→)'} aria-label="다음 페이지" className={clsx('pb-arrow', list.arrow, cur < pageCount - 1 && list.arrowOn)}><IconChevronRight /></button>}
    </div>
  )
  const dirSeg = <Seg variant={mobile ? 'mobileFit' : 'pc'} title="넘기는 방향" opts={DIRS} value={s.listDir} onPick={s.setListDir} />

  const dyes = first?.dyes ?? []
  const pages: number[] = []
  for (let p = Math.max(0, cur - 1); p <= Math.min(pageCount - 1, cur + 1); p++) pages.push(p)
  const gridStyle = { gridTemplateColumns: `repeat(${cols},minmax(0,1fr))`, gridTemplateRows: `repeat(${rows},minmax(0,1fr))` }
  const cards = (p: number) => {
    const d = pageRows(p)
    return d ? d.map((r) => <LookCard key={r.i} row={r} mobile={mobile} prio={p === cur ? 0 : 1} onOpen={onOpen} />)
      : Array.from({ length: Math.min(per, Math.max(0, (total ?? per) - p * per)) }, (_, i) => <div key={i} className={clsx('pb-skel', list.skel, mobile && list.skelM)} />)
  }

  const viewport = (
    <div ref={setVp} className={clsx(list.viewport, dirY && list.viewportY, mobile && 'pb-norail', mobile && (dirY ? list.viewportMY : list.viewportM))}>
      {failed || (first && !first.ready) ? (
        <div className={mobile ? list.emptyM : list.empty}>
          <span className={mobile ? list.emptyTitleM : list.emptyTitle}>코디를 불러오지 못했어요</span>
          <span className={mobile ? list.emptyHintM : list.emptyHint}>잠시 뒤에 다시 열어 주세요.</span>
        </div>
      ) : first && first.total === 0 ? (
        <div className={mobile ? list.emptyM : list.empty}>
          <span className={mobile ? list.emptyTitleM : list.emptyTitle}>이 아이템을 입은 코디가 없어요</span>
          <span className={mobile ? list.emptyHintM : list.emptyHint}>표본에 아직 없는 아이템이에요.</span>
        </div>
      ) : (
        <div ref={mobile ? undefined : s.bindTrack} className={list.track}
          style={mobile
            ? (dirY ? { height: `calc(${pageCount} * 100cqh)` } : { width: `calc(${pageCount} * 100cqw)` })
            : { transform: `${dirY ? 'translateY' : 'translateX'}(${-cur * 100}%)`, transition: s.snapping ? 'transform .34s cubic-bezier(.22,.61,.36,1)' : 'none' }}>
          {pages.map((p) => (
            <div key={p} className={clsx('pb-page', mobile ? (dirY ? list.pageMY : list.pageM) : list.page)}
              style={dirY ? { top: mobile ? `calc(${p} * 100cqh)` : `${p * 100}%` } : { left: mobile ? `calc(${p} * 100cqw)` : `${p * 100}%` }}>
              {(!s.snapping || p === cur || Math.abs(p - s.snapFrom) <= 1) && (
                <div className={list.grid} style={gridStyle}>{cards(p)}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )

  return (
    <>
      <div className={mobile ? list.controlsM : list.header}>
        <HeadItem item={item} mobile={mobile} host={host} total={total} />
        {dirSeg}
        {pageChip}
      </div>
      <div className={mobile ? list.hrM : list.hr} />
      {/* 머리와 내용은 구분선으로 가르고, 자주 쓴 염색은 내용 쪽의 한 묶음이다(사용자 지시 — 머리에 바로 붙어 보이면 안 된다) */}
      {dyes.length > 0 && <DyeRow item={item} dyes={dyes} mobile={mobile} />}
      {viewport}
      <Credit mobile={mobile} hint={dirY ? '스크롤, 스와이프, ↑ ↓ 로 페이지를 넘겨요' : '스크롤, 스와이프, ← → 로 페이지를 넘겨요'} />
    </>
  )
}

// 자주 쓴 염색 — 누르면 그 아이템을 입고 그 염색이 들어간다(되돌리기 한 건). 지금 그 염색이면 칩이 켜져 있다
function DyeRow({ item, dyes, mobile }: { item: ListItem; dyes: LookDye[]; mobile: boolean }) {
  const s = useShop()
  const skin = item.slot === 'skin'
  const te = skin ? s.index?.base.tones.find((t) => t.body === item.id) : undefined
  const key = skin ? 'skin' : item.slot
  const slide = mobile || isNarrow(s.bp) // 좁은 폭(절반 · 태블릿 · 모바일)은 여섯 칸이 한 줄에 들지 않는다 — 옆으로 민다
  const live = (d: LookDye) => {
    const worn = skin ? te?.tone === s.tone : s.isEquippedInCat(SLOT_TO_CAT[item.slot], item.id)
    if (!worn) return false
    const cur = d.kind === 'palette' ? s.dyePalette[key] : s.dyeHsb[key]
    return !!cur && JSON.stringify(sortKeys(cur)) === JSON.stringify(sortKeys(d.v))
  }
  const apply = (d: LookDye) => {
    s.equipItem(item)
    if (d.kind === 'palette') s.setDyePalette({ ...s.dyePalette, [key]: d.v })
    else s.setDyeHsb({ ...s.dyeHsb, [key]: d.v })
    s.notify(`${item.name || '아이템'}에 자주 쓴 염색을 입혔어요`)
  }
  return (
    <div className={clsx(styles.dyes, slide && 'pb-norail', slide && styles.dyesSlide, mobile && styles.dyesM)}>
      <span className={clsx(styles.dyesLabel, mobile && styles.dyesLabelM)}>자주 쓴<br />염색</span>
      <div className={clsx(styles.dyeChips, slide && styles.dyeChipsM)}>
        {dyes.map((d, i) => {
          const on = live(d)
          return (
            <button key={i} type="button" onClick={() => apply(d)} aria-pressed={on} title={`${d.n.toLocaleString()}명이 쓴 염색 입기`}
              className={clsx(surf.partChip, ui.dyeChip, styles.dyeChip, on && styles.dyeChipOn)}>
              <span className={clsx('pb-chipthumb', surf.partThumb)}>
                <span className={surf.partSprite}>
                  <LookSprite slot={item.slot} item={skin ? null : item} tone={te?.tone ?? s.tone} palette={d.kind === 'palette' ? d.v : undefined} hsb={d.kind === 'hsb' ? d.v : undefined} />
                </span>
              </span>
              <span className={surf.partText}>
                <span className={surf.partSlot}>{i + 1}위</span>
                <span className={surf.partName}>{d.n.toLocaleString()}명</span>
              </span>
              <DyeBand state="dyed" slot={key} palette={d.kind === 'palette' ? d.v : undefined} hsb={d.kind === 'hsb' ? d.v : undefined} skinFamily={skin ? skinDyeFamily(te?.name) ?? undefined : undefined} />
            </button>
          )
        })}
      </div>
    </div>
  )
}
const sortKeys = (o: object) => Object.fromEntries(Object.entries(o).sort(([a], [b]) => a.localeCompare(b)))

function LookCard({ row, mobile, prio, onOpen }: { row: LookRow; mobile: boolean; prio: number; onOpen: (r: LookRow) => void }) {
  const s = useShop()
  return (
    <div onClick={() => { if (!s.consumeSwipeClick()) onOpen(row) }} onPointerEnter={() => warmSnap(row.s, s.index)} title="코디 자세히 보기" className="pb-presetwrap" style={{ cursor: 'pointer' }}>
      <div className={clsx('pb-preset', styles.card)}>
        <div className={styles.thumb}><SnapThumb snap={row.s} fraction={mobile ? FRACTION_M : FRACTION} priority={prio} /></div>
      </div>
    </div>
  )
}

// ── 상세: 큰 그림 + 부위별 착용(부위만 골라 입기) + 전부 입기 · 프리셋에 저장 ──────────
function ComboDetail({ row, item, mobile, onBack }: { row: LookRow; item: ListItem; mobile: boolean; onBack: () => void }) {
  const s = useShop()
  const snap = row.s
  const slots = useMemo(() => ['skin', ...Object.keys(snap.equipped)], [snap])
  const warmWear = s.warmWear
  useEffect(() => { warmWear(snap) }, [snap]) // [전부 입기]가 바로 반영되게 받아 둔다
  return (
    <>
      <div className={mobile ? list.controlsM : list.header}>
        <div className={styles.headItem}>
          <button type="button" onClick={onBack} title="코디 목록으로 (Esc)" aria-label="코디 목록으로" className={clsx('pb-soft', styles.back, mobile && styles.backM)}><IconChevronLeft /></button>
          <span className={styles.itemText}>
            <span className={clsx(styles.itemName, mobile && styles.itemNameM)}>{item.name || item.id} 코디</span>
          </span>
        </div>
        <div className={styles.detailActs}>
          <button type="button" onClick={() => { s.wearFromSnap(snap, slots).catch(() => {}) }} title="이 코디를 지금 코디에 전부 입기" className={clsx('pb-soft', styles.actBtn)}>전부 입기</button>
          <button type="button" onClick={() => s.takeCombo({ ...snap, name: `${item.name || ''} 코디`.trim() })} title="이 코디를 내 프리셋에 저장" className={clsx('pb-solid', styles.actBtn, styles.actSolid)}><IconTakeDown size={13} />프리셋에 저장</button>
        </div>
      </div>
      <div className={mobile ? list.hrM : list.hr} />
      <div className={clsx(styles.detail, mobile ? clsx('pb-norail', styles.detailM) : 'pb-scroll')}>
        <div className={clsx(styles.stage, mobile && styles.stageM)}><SnapThumb snap={snap} fraction={mobile ? 0.5 : 0.46} view={false} priority={-1} /></div>
        <div className={styles.worn}><WornItems snap={snap} postId={`look:${row.i}`} mobile={mobile} /></div>
      </div>
      <Credit mobile={mobile} />
    </>
  )
}
