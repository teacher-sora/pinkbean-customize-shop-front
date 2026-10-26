'use client'

// 코디 조합 — 넥슨 랭킹 캐릭터의 실제 코디 표본에서 아이템 하나를 입은 코디와 자주 쓴 염색을 본다(lib/looks).
//  · 코디 탭: 목록 카드의 '코디 N' 칩으로 열면 목록 자리가 이 패널이 된다(PinkbeanShop). 미리보기는 그대로라 칩 · 입기를 바로 본다.
//    닫으면(← · Esc) 보던 목록 쪽으로 돌아간다 — 목록 상태는 ShopContext 에 그대로 있다.
//  · 코디 광장의 '코디 조합' 분류: 같은 패널이 광장 목록 자리에 들어가고, 머리의 검색 칸으로 아이템을 고른다.
// 목록은 쪽 단위로 받고(back POST /looks) 세로로 이어 스크롤한다 — 쪽 번호로 멀리 갈 수 있고, 지금 쪽 ±1 만 카드로 그린다
// (나머지는 같은 높이의 빈 칸이라 스크롤 길이가 그대로다). 카드를 누르면 패널 안에서 상세로 넘어간다(부위만 골라 입기 · 프리셋에 저장).

import clsx from 'clsx'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ListItem } from '@/lib/core/data'
import { countLabel, fetchLooks, loadLookCounts, loadLookMeta, type LookDye, type LookMeta, type LookPage, type LookRow } from '@/lib/looks'
import { NEXON_CREDIT } from '@/lib/nexonLook'
import { SLOT_TO_CAT, skinDyeFamily } from '@/lib/shopData'
import { isNarrow } from '@/lib/useBreakpoint'
import SnapThumb, { warmSnap } from '../SnapThumb'
import { useShop } from '../ShopContext'
import { DyeBand, LookSprite } from '../info/SlotSprite'
import { WornItems } from '../plaza/PlazaDetailBody'
import { IconChevronLeft, IconSearch, IconTakeDown } from '../ui/Icons'
import list from '../list/list.module.css'
import surf from '../surface/surface.module.css'
import ui from '../ui/ui.module.css'
import styles from './combo.module.css'

const GAP = 10
const CARD_MIN = 168 // PC 카드 최소 폭 — 열 수는 폭에서 고른다(광장 카드와 비슷한 크기)
const CARD_RATIO = 1.32 // 카드 높이 ÷ 폭(그림 + 아래 한 줄)
const FRACTION = 0.4, FRACTION_M = 0.5

// 쪽 크기: PC 는 칸 폭 · 높이에서 열 · 줄을 고르고, 모바일은 목록과 같은 3열 × 2줄
function useGrid(mobile: boolean) {
  const [box, setBox] = useState({ w: 0, h: 0 })
  const ro = useRef<ResizeObserver | null>(null)
  const ref = useCallback((el: HTMLDivElement | null) => {
    ro.current?.disconnect()
    if (!el) return
    const m = () => setBox((b) => (b.w === el.clientWidth && b.h === el.clientHeight ? b : { w: el.clientWidth, h: el.clientHeight }))
    m()
    ro.current = new ResizeObserver(m)
    ro.current.observe(el)
  }, [])
  const pad = mobile ? 5 : 8
  const cols = mobile ? 3 : Math.max(3, Math.min(7, Math.floor((box.w - pad * 2 + GAP) / (CARD_MIN + GAP))))
  const cardW = (box.w - pad * 2 - (cols - 1) * GAP) / cols
  const rows = mobile ? 2 : Math.max(1, Math.min(4, Math.floor((box.h - pad * 2 + GAP) / (cardW * CARD_RATIO + GAP))))
  return { ref, w: box.w, h: box.h, cols, rows, size: Math.min(60, cols * rows), pad }
}

export default function ComboPanel({ mobile, host }: { mobile: boolean; host: 'codi' | 'plaza' }) {
  const s = useShop()
  const item = s.comboItem
  const [detail, setDetail] = useState<LookRow | null>(null)
  useEffect(() => { setDetail(null) }, [item?.id])
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

// 머리 왼쪽: 코디 탭은 [←] + 아이템, 광장은 아이템 찾기 칸
function HeadItem({ item, mobile, host, total }: { item: ListItem | null; mobile: boolean; host: 'codi' | 'plaza'; total: number | null }) {
  const s = useShop()
  return (
    <div className={styles.headItem}>
      {host === 'codi' && (
        <button type="button" onClick={s.closeCombo} title="목록으로 (Esc)" aria-label="목록으로" className={clsx('pb-soft', styles.back, mobile && styles.backM)}><IconChevronLeft /></button>
      )}
      {item && (
        <span className={styles.itemTag} title={item.name || item.id}>
          <span className={clsx('pb-chipthumb', styles.itemThumb, mobile && styles.itemThumbM)}><LookSprite slot={item.slot} item={item.slot === 'skin' ? null : item} tone={s.index?.base.tones.find((t) => t.body === item.id)?.tone ?? s.tone} /></span>
          <span className={styles.itemText}>
            <span className={clsx(styles.itemName, mobile && styles.itemNameM)}>{item.name || item.id}</span>
            <span className={styles.itemSub}>{total == null ? ' ' : `코디 ${total.toLocaleString()}벌`}</span>
          </span>
        </span>
      )}
      {host === 'plaza' && <ItemFinder mobile={mobile} />}
    </div>
  )
}

// 광장의 코디 조합: 이름으로 아이템을 찾는다(모든 부위 + 피부). 표본에 있는 것만, 코디가 많은 순으로 8개
function ItemFinder({ mobile }: { mobile: boolean }) {
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
        setHits(r.map((it) => ({ it, n: counts[it.id] ?? 0 })).filter((x) => x.n > 0).sort((a, b) => b.n - a.n).slice(0, 8))
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
        placeholder="아이템 이름으로 찾기" aria-label="아이템 찾기" className={clsx('pb-input', list.searchInput)} />
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

function Credit({ mobile }: { mobile: boolean }) {
  const [meta, setMeta] = useState<LookMeta | null>(null)
  useEffect(() => { loadLookMeta().then(setMeta).catch(() => {}) }, [])
  const when = meta?.to ? `${meta.to.replace(/-/g, '.')} 기준` : ''
  return (
    <div className={clsx(mobile ? styles.creditM : list.hintBar, styles.credit)}>
      {when && <span className={list.hintText}>{when}</span>}
      <span className={list.hintText}>{NEXON_CREDIT}</span>
    </div>
  )
}

// ── 목록 ──────────────────────────────────────────────────────────
function ComboList({ item, mobile, host, onOpen }: { item: ListItem; mobile: boolean; host: 'codi' | 'plaza'; onOpen: (r: LookRow) => void }) {
  const s = useShop()
  const ids = useMemo(() => [item.id], [item.id])
  const g = useGrid(mobile)
  const [pagesData, setPagesData] = useState<Record<number, LookPage>>({})
  const [first, setFirst] = useState<LookPage | null>(null)
  const [failed, setFailed] = useState(false)
  const [cur, setCur] = useState(0)
  const vpRef = useRef<HTMLDivElement | null>(null)
  const setVp = useCallback((el: HTMLDivElement | null) => { vpRef.current = el; g.ref(el) }, [g.ref])
  const size = g.size
  const pageH = g.h
  const total = first?.total ?? null
  const pageCount = total == null ? 1 : Math.max(1, Math.ceil(total / size))

  // 첫 쪽(총수 · 자주 쓴 염색) — 쪽 크기가 정해진 뒤에 받는다. 쪽 크기가 바뀌면(창 크기) 받은 쪽을 버린다
  useEffect(() => {
    if (!g.w || !g.h) return
    let alive = true
    setPagesData({}); setFailed(false)
    fetchLooks(ids, 0, size).then((d) => { if (!alive) return; setFirst((f) => (f && f.dyes && !d.dyes ? { ...d, dyes: f.dyes } : d)); setPagesData((m) => ({ ...m, 0: d })) })
      .catch(() => { if (alive) setFailed(true) })
    return () => { alive = false }
  }, [ids, size, g.w > 0 && g.h > 0])
  // 지금 쪽 ±1 과 다음 쪽 하나를 더 받아 둔다(넘기면 바로 그려지게)
  useEffect(() => {
    if (!first?.ready) return
    let alive = true
    for (let p = Math.max(0, cur - 1); p <= Math.min(pageCount - 1, cur + 2); p++) {
      if (pagesData[p]) continue
      fetchLooks(ids, p, size).then((d) => { if (alive) setPagesData((m) => (m[p] ? m : { ...m, [p]: d })) }).catch(() => {})
    }
    return () => { alive = false }
  }, [cur, first, pageCount, size])

  // 스크롤 → 지금 쪽
  useEffect(() => {
    const vp = vpRef.current
    if (!vp || !pageH) return
    let raf = 0
    const on = () => { if (raf) return; raf = requestAnimationFrame(() => { raf = 0; setCur(Math.max(0, Math.min(pageCount - 1, Math.round(vp.scrollTop / pageH)))) }) }
    vp.addEventListener('scroll', on, { passive: true })
    return () => { vp.removeEventListener('scroll', on); cancelAnimationFrame(raf) }
  }, [pageH, pageCount])
  const go = (p: number) => {
    const vp = vpRef.current
    if (!vp) return
    const to = Math.max(0, Math.min(pageCount - 1, p))
    vp.scrollTo({ top: to * pageH, behavior: Math.abs(to - cur) > 2 ? ('instant' as ScrollBehavior) : 'smooth' })
  }
  // 방향키 · 페이지 키로 한 쪽씩(입력 칸에서는 그대로)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (s.surface || (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA'))) return
      const d = e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === 'ArrowRight' ? 1 : e.key === 'ArrowUp' || e.key === 'PageUp' || e.key === 'ArrowLeft' ? -1 : 0
      if (!d) return
      e.preventDefault(); go(cur + d)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })
  // 쪽 번호 칸 — 목록 머리와 같은 부품(번호를 적어 멀리 간다)
  const [pageInput, setPageInput] = useState<string | null>(null)
  const commitPage = () => { if (pageInput != null) { const n = parseInt(pageInput, 10); if (n > 0) go(n - 1) } setPageInput(null) }
  const pageChip = (
    <div className={mobile ? list.pageChipM : list.pageChip}>
      <input value={pageInput ?? `${cur + 1}`} onFocus={() => setPageInput(`${cur + 1}`)} onChange={(e) => setPageInput(e.target.value.replace(/\D/g, ''))}
        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} onBlur={commitPage}
        inputMode="numeric" aria-label="현재 페이지" title={mobile ? undefined : '번호를 입력해 이동'} className={clsx('pb-input', 'pb-pageinput', list.pageInput)} />
      <span className={mobile ? list.slashM : list.slash}>/</span>
      <span className={list.total}>{pageCount.toLocaleString()}</span>
    </div>
  )

  const dyes = first?.dyes ?? []
  const pages: number[] = []
  for (let p = Math.max(0, cur - 1); p <= Math.min(pageCount - 1, cur + 1); p++) pages.push(p)
  const gridStyle = { gridTemplateColumns: `repeat(${g.cols},minmax(0,1fr))`, gridTemplateRows: `repeat(${g.rows},minmax(0,1fr))`, gap: `${GAP}px` }

  return (
    <>
      <div className={mobile ? list.controlsM : list.header}>
        <HeadItem item={item} mobile={mobile} host={host} total={total} />
        {pageChip}
      </div>
      {dyes.length > 0 && <DyeRow item={item} dyes={dyes} mobile={mobile} />}
      <div className={mobile ? list.hrM : list.hr} />
      <div ref={setVp} className={clsx(styles.viewport, mobile ? clsx('pb-norail', styles.viewportM) : 'pb-scroll')}>
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
          <div className={styles.track} style={{ height: pageCount * pageH }}>
            {pageH > 0 && pages.map((p) => {
              const d = pagesData[p]
              return (
                <div key={p} className={styles.page} style={{ top: p * pageH, height: pageH, padding: g.pad }}>
                  <div className={styles.grid} style={gridStyle}>
                    {d ? d.looks.map((r) => <LookCard key={r.i} row={r} mobile={mobile} prio={p === cur ? 0 : 1} onOpen={onOpen} />)
                      : Array.from({ length: size }, (_, i) => <div key={i} className={clsx('pb-skel', styles.skel)} />)}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
      <Credit mobile={mobile} />
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
    <div onClick={() => onOpen(row)} onPointerEnter={() => warmSnap(row.s, s.index)} title={`${row.n.toLocaleString()}명이 입은 코디`} className="pb-presetwrap" style={{ cursor: 'pointer' }}>
      <div className={clsx('pb-preset', styles.card)}>
        <div className={styles.thumb}><SnapThumb snap={row.s} fraction={mobile ? FRACTION_M : FRACTION} priority={prio} /></div>
        <div className={clsx(styles.meta, mobile && styles.metaM)}>{row.n.toLocaleString()}명</div>
      </div>
    </div>
  )
}

// ── 상세: 큰 그림 + 부위별 착용(부위만 골라 입기) + 전부 입기 · 프리셋에 저장 ──────────
function ComboDetail({ row, item, mobile, onBack }: { row: LookRow; item: ListItem; mobile: boolean; onBack: () => void }) {
  const s = useShop()
  const snap = row.s
  const slots = useMemo(() => ['skin', ...Object.keys(snap.equipped)], [snap])
  return (
    <>
      <div className={mobile ? list.controlsM : list.header}>
        <div className={styles.headItem}>
          <button type="button" onClick={onBack} title="코디 목록으로 (Esc)" aria-label="코디 목록으로" className={clsx('pb-soft', styles.back, mobile && styles.backM)}><IconChevronLeft /></button>
          <span className={styles.itemText}>
            <span className={clsx(styles.itemName, mobile && styles.itemNameM)}>{item.name || item.id} 코디</span>
            <span className={styles.itemSub}>{row.n.toLocaleString()}명이 입었어요</span>
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
