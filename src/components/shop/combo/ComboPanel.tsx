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
import { COMBO_SKIP, LOOK_CHUNK, lookPv, withCardPv, countLabel, loadLookCounts, lookChunk, useLookCount, type LookDye, type LookGender, type LookPage, type LookRow } from '@/lib/looks'
import { NEXON_CREDIT } from '@/lib/nexonLook'
import { CARD_FRACTION_M, MOBILE_GRID, SLOT_TO_CAT, skinDyeFamily } from '@/lib/shopData'
import SnapThumb, { warmSnap } from '../SnapThumb'
import { enqueueThumb } from '@/lib/thumbQueue'
import { useShop, type Snapshot } from '../ShopContext'
import { DyeBand, LookSprite } from '../info/SlotSprite'
import { CARD_RATIO_M, DIRS, FilterM, GENDERS, useMobileRows, type FilterGroup } from '../list/ListArea'
import { WornItems } from '../plaza/PlazaDetailBody'
import { Seg } from '../ui/controls'
import { useWheelRail } from '../ui/useWheelRail'
import { ChipAct } from '../ui/ChipAct'
import { IconChevronLeft, IconChevronRight, IconSearch, IconTakeDown, IconVaultAdd } from '../ui/Icons'
import { DYE_VAULT_MAX, dyeSaveKey, useDyeVault, type DyeSave } from '@/lib/dyeVault'
import list from '../list/list.module.css'
import surf from '../surface/surface.module.css'
import ui from '../ui/ui.module.css'
import styles from './combo.module.css'

const FRACTION = 0.4, FRACTION_M = CARD_FRACTION_M // 모바일은 목록 · 광장 카드와 같은 비율
const FIT_W = 0.55 // 카드 그림(PC): 캐릭터 높이 ≤ 칸 폭 × 0.55 — 칸이 좁고 길면 1배, 폭이 넉넉할 때만 2배(SnapThumb fitW).
// 모바일은 걸지 않는다 — 코디 탭 목록 카드와 같은 크기로 보이게(사용자 지시, 기기 픽셀 기준 정수 배율이라 옆이 잘릴 만큼 뛰지 않는다)
// 모바일 카드 최소 높이 = 폭 × 목록 카드 그림 칸 비율(CARD_RATIO_M) — 캐릭터가 코디 탭 목록과 같은 크기가 된다
const mobileRatio = (cols: number) => (cols >= 3 ? CARD_RATIO_M : 1.05)
// 모바일에서 목록 칸 밖에 코디 조합만 더 있는 줄(자주 쓴 염색 묶음 · 구분선 · 출처 줄 — data-combo-extra)의 높이. 코디 광장의 다른 분류가 이만큼
// 페이지를 더 잡아 분류를 바꿔도 아래가 밀리지 않는다(사용자 지시, PlazaPanel). 패널이 그려지면 잰 값으로 바꾼다(처음 값 = 실측 — 염색 묶음 82 + 위아래 여백 16 + 구분선 1 + 출처 위 구분선 1 + 출처 줄 26)
let extraM = 126
export const comboExtraM = () => extraM
function useExtraM(ref: React.RefObject<HTMLDivElement | null>, mobile: boolean) {
  useLayoutEffect(() => {
    const col = ref.current?.closest('[data-mobile-col]')
    if (!mobile || !col) return
    const h = [...col.querySelectorAll<HTMLElement>('[data-combo-extra]')].reduce((n, el) => { const cs = getComputedStyle(el); return n + el.getBoundingClientRect().height + parseFloat(cs.marginTop) + parseFloat(cs.marginBottom) }, 0)
    if (h > 0) extraM = Math.round(h)
  })
}

export default function ComboPanel({ mobile, host }: { mobile: boolean; host: 'codi' | 'plaza' }) {
  const s = useShop()
  const item = s.comboItem
  // 보던 상세는 ShopContext 가 기억한다(탭을 오가도 그대로 — 아이템을 바꾸면 비운다)
  const detail = s.comboDetail, setDetail = s.setComboDetail
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
    : detail ? <ComboDetail key={detail.i} row={detail} mobile={mobile} />
      : <ComboList key={`${item.id}|${s.comboGender}`} item={item} mobile={mobile} host={host} onOpen={setDetail} />
  // 머리는 패널이 **한 번만** 그린다 — 목록 · 빈 화면 · 상세는 그 아래 내용만 바꾼다. 그래서 목록 ↔ 상세를 오가도 아이템 칩(그림 캔버스)이 같은 자리에
  // 그대로 남아 다시 그려지지 않는다(사용자 지적 — 상세로 넘어갈 때 칩 그림이 움찔했다. 화면마다 머리를 따로 그리면 칩이 새로 붙는다)
  const head = <><ComboHead item={item} mobile={mobile} host={host} detail={item ? detail : null} onBack={() => setDetail(null)} /><div className={mobile ? list.hrM : list.hr} /></>
  // 열고 닫기 · 상세 오가기 · 탭 오가기 모두 움직임 없이 바로 바뀐다(사용자 지시 — 탭을 바꾸듯)
  if (mobile) return <>{head}{body}</>
  return <section className={list.panel}>{head}{body}</section>
}

// 머리 왼쪽: 코디 탭은 [←] + 아이템 칩. 좁은 폭(절반 · 태블릿) · 모바일은 칩이 그림만이다(사용자 지시 — 이름이 눌려 안 보였다.
// 목록의 '아이템' 보기와 같은 그림이고, 이름은 title · 광장은 찾기 칸의 안내 글로도 보인다). 넓은 PC 만 이름까지
// onBack = 상세에서 코디 목록으로(상세는 광장에서도 [←] 이 있다). [←] 이 생기고 없어져도 칩은 같은 자리(두 번째 칸)라 다시 그려지지 않는다
function HeadItem({ item, mobile, host, onBack }: { item: ListItem | null; mobile: boolean; host: 'codi' | 'plaza'; onBack?: () => void }) {
  const s = useShop()
  return (
    <div className={styles.headItem}>
      {onBack ? (
        <button type="button" onClick={onBack} title="코디 목록으로 (Esc)" aria-label="코디 목록으로" className={clsx('pb-soft', styles.back, mobile && styles.backM)}><IconChevronLeft /></button>
      ) : host === 'codi' ? (
        <button type="button" onClick={s.closeCombo} title="목록으로 (Esc)" aria-label="목록으로" className={clsx('pb-soft', styles.back, mobile && styles.backM)}><IconChevronLeft /></button>
      ) : null}
      <ItemTag item={item} mobile={mobile} thumbOnly={mobile || s.listNarrow} />
    </div>
  )
}
// 아이템 칩 — 목록 머리 · 상세 머리가 같은 칩이고 **보이는 것도 같다**(사용자 지시: 같은 칩, 어디서는 그림만 · 어디서는 이름까지면 보기 불편하다).
// 넓은 PC = 그림 + 이름(폭 190 고정 — 이름 길이 · 고르기 전후와 상관없다, 이름은 말줄임), 좁은 폭 · 모바일 = 그림만(이름은 title)
function ItemTag({ item, mobile, thumbOnly }: { item: ListItem | null; mobile: boolean; thumbOnly?: boolean }) {
  const s = useShop()
  return (
    // 고르기 전에도 같은 칸을 비워 둔다(사용자 지시 — 머리는 늘 같은 구성, 고른 뒤에 요소가 생기지 않게)
    <span className={clsx(styles.itemTag, mobile && styles.itemTagM, thumbOnly ? styles.itemTagThumb : styles.itemTagFixed)} title={item ? item.name || item.id : '아이템을 고르면 여기에 보여요'}>
      <span className={clsx('pb-chipthumb', styles.itemThumb, mobile && styles.itemThumbM)}>{item && <LookSprite slot={item.slot} item={item.slot === 'skin' ? null : item} tone={s.index?.base.tones.find((t) => t.body === item.id)?.tone ?? s.tone} />}</span>
      {!thumbOnly && <span className={styles.itemText}>
        <span className={clsx(styles.itemName, mobile && styles.itemNameM, !item && styles.itemNameNone)}>{item ? item.name || item.id : '아이템'}</span>
      </span>}
    </span>
  )
}

// 광장의 코디 조합: 이름으로 아이템을 찾는다(모든 부위 + 피부). 표본에 있는 것만, 코디가 많은 순으로 8개
// 칸은 목록 머리의 검색 칸과 같은 부품 · 같은 폭이다(list.searchWrap · searchWrapNarrow · searchWrapM — 사용자 지시: 같은 자리 · 같은 크기)
function ItemFinder({ mobile, now }: { mobile: boolean; now: ListItem | null }) {
  const s = useShop()
  const narrow = s.listNarrow
  const [q, setQ] = useState('')
  const [hits, setHits] = useState<{ it: ListItem; n: number }[]>([])
  const [open, setOpen] = useState(false)
  const counts = useCountsMap()
  useEffect(() => {
    let alive = true
    const t = setTimeout(() => {
      s.searchItems(q).then((r) => {
        if (!alive) return
        const h = r.filter((it) => !COMBO_SKIP.has(it.slot)).map((it) => ({ it, n: counts[it.id] ?? 0 })).filter((x) => x.n > 0).sort((a, b) => b.n - a.n).slice(0, 8)
        setHits(h)
        if (h[0]) s.warmCombo(h[0].it.id) // 맨 위 결과는 Enter 로도 고르므로 바로 받아 둔다
      }).catch(() => {})
    }, 160)
    return () => { alive = false; clearTimeout(t) }
  }, [q, counts])
  const pick = (it: ListItem) => { s.pickCombo(it); setQ(''); setOpen(false) }
  // 결과 줄에 120ms 머물거나 닿는 순간 그 아이템의 첫 쪽을 받아 둔다(목록 카드의 '코디' 칩과 같은 warmCombo)
  const hover = useRef(0)
  useEffect(() => () => window.clearTimeout(hover.current), [])
  return (
    <div className={mobile ? list.searchWrapM : clsx(list.searchWrap, narrow && list.searchWrapNarrow)}>
      <IconSearch className={mobile ? list.searchIconM : list.searchIcon} />
      <input value={q} onChange={(e) => { setQ(e.target.value); setOpen(true) }} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={(e) => { if (e.key === 'Enter' && hits[0]) pick(hits[0].it); if (e.key === 'Escape') { e.stopPropagation(); setOpen(false) } }}
        placeholder={now ? now.name || now.id : '아이템 이름으로 찾기'} aria-label="아이템 찾기" className={clsx('pb-input', mobile ? list.searchInputM : list.searchInput)} />
      {open && q.trim() && (
        <div className={styles.finderPop} role="listbox">
          {hits.length ? hits.map(({ it, n }) => (
            <button key={it.id} type="button" role="option" aria-selected={false} onMouseDown={(e) => e.preventDefault()} onClick={() => pick(it)} className={styles.finderRow}
              onPointerEnter={(e) => { if (e.pointerType !== 'mouse') return; window.clearTimeout(hover.current); hover.current = window.setTimeout(() => s.warmCombo(it.id), 120) }}
              onPointerLeave={() => window.clearTimeout(hover.current)} onPointerDown={(e) => { if (e.pointerType !== 'mouse') s.warmCombo(it.id) }}>
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

// 아이템을 고르기 전에도 고른 뒤와 같은 자리를 잡는다(밀림 금지 — 모바일은 페이지 높이가 내용으로 정해진다):
// 자주 쓴 염색 묶음 자리(보이지 않는 같은 칸) + 목록과 같은 최소 높이(useMobileRows)
function ComboEmpty({ mobile }: { mobile: boolean }) {
  const vpRef = useRef<HTMLDivElement | null>(null)
  useMobileRows(vpRef, mobile, MOBILE_GRID.cols, mobileRatio(MOBILE_GRID.cols), 2, true) // 고른 뒤와 같은 격자(코디 조합 모바일 = 3열)
  useExtraM(vpRef, mobile)
  return (
    <>
      {mobile && <>
        <div aria-hidden data-combo-extra className={clsx(styles.dyes, styles.dyesM, styles.hold)} style={{ '--dye-n': 3 } as React.CSSProperties}><DyeSkels n={3} mobile /></div>
        <div aria-hidden data-combo-extra className={clsx(styles.dyesSep, styles.dyesSepM, styles.hold)} />
      </>}
      <div ref={vpRef} className={clsx(list.viewport, mobile && list.viewportM, styles.emptyWrap)}>{/* 모바일 목록 칸과 같은 좌우 여백 — 최소 높이를 같은 칸 폭으로 잰다 */}
        <div className={mobile ? list.emptyM : list.empty}>
          <span className={mobile ? list.emptyTitleM : list.emptyTitle}>아이템을 골라 주세요</span>
          <span className={mobile ? list.emptyHintM : list.emptyHint}>그 아이템을 입은 실제 유저 코디와 자주 쓴 염색이 보여요.</span>
        </div>
      </div>
      <Credit mobile={mobile} />
    </>
  )
}

// 힌트 바: (PC) 넘기는 법 + 출처(넥슨 Open API 이용약관 제6조 ④ — 늘 보인다). 기준 날짜는 두지 않는다(사용자 지시)
function Credit({ mobile, hint }: { mobile: boolean; hint?: string }) {
  // 모바일은 목록과 출처 사이를 구분선으로 가른다(PC 는 힌트 바의 윗선)
  return (
    <>
      {mobile && <div data-combo-extra className={list.hrM} />}
      <div data-combo-extra={mobile || undefined} className={clsx(mobile ? styles.creditM : clsx('pb-hintbar', list.hintBar), styles.credit)}>
        {hint && !mobile && <span className={list.hintText}>{hint}</span>}
        <span className={list.hintText}>{NEXON_CREDIT}</span>
      </div>
    </>
  )
}

// 머리 — 코디 탭 · AI 코디 검색 목록 머리와 같은 구성 · 자리(사용자 지시 — 탭만 바뀌고 기능이 같으니 같은 위치 · 같은 크기):
// 왼쪽 = [←](코디 탭) · 아이템 칸 · 성별 · 넘기는 방향(좁은 폭 · 모바일은 [보기 설정]에 접는다 — 같은 부품 FilterM),
// 오른쪽 = 쪽 칩 · 찾기 칸(광장). 아이템을 고르기 전에도 같은 칸이 다 있다 — 쪽 칩은 0벌 · 1 / 1.
// 상세(detail)면 오른쪽이 [전부 입기] · [프리셋에 저장]이고 왼쪽은 [←] · 아이템 칩(같은 칩이 그대로 남는다 — ComboPanel)
function ComboHead({ item, mobile, host, detail, onBack }: { item: ListItem | null; mobile: boolean; host: 'codi' | 'plaza'; detail: LookRow | null; onBack: () => void }) {
  const s = useShop()
  const paged = !!item
  const total = s.comboTotalKnown ? s.comboTotal : null
  const narrow = s.listNarrow
  const dirY = s.listDir === 'y'
  const cur = paged ? s.curIdx : 0, pageCount = paged ? s.pageCount : 1
  const pageChip = (
    <div className={mobile ? clsx(list.pageChipM, styles.pageEndM) : clsx(list.pageChip, narrow && list.pageChipNarrow)}>
      {!mobile && !narrow && (
        <>
          <span title="이 아이템을 입은 코디 수" className={clsx(list.count, styles.countFix)}>{paged && total == null ? ' ' : `${(total ?? 0).toLocaleString()}벌`}</span>
          <span className={list.chipDiv} />
        </>
      )}
      {!mobile && <button type="button" onClick={() => s.step(-1)} disabled={!paged || cur <= 0} title={dirY ? '이전 페이지 (↑)' : '이전 페이지 (←)'} aria-label="이전 페이지" className={clsx('pb-arrow', list.arrow, paged && cur > 0 && list.arrowOn)}><IconChevronLeft /></button>}
      {paged
        ? <input value={s.pageEditing ? s.pageInput : `${cur + 1}`} onFocus={s.onPageFocus} onChange={s.onPageChange} onKeyDown={s.onPageKey} onBlur={s.commitPage}
            inputMode="numeric" aria-label="현재 페이지" title={mobile ? undefined : '번호를 입력해 이동'} className={clsx('pb-input', 'pb-pageinput', list.pageInput)} />
        : <input value="1" readOnly tabIndex={-1} aria-label="현재 페이지" title="아이템을 고르면 넘길 수 있어요" className={clsx('pb-input', 'pb-pageinput', list.pageInput)} />}
      <span className={mobile ? list.slashM : list.slash}>/</span>
      <span className={list.total}>{pageCount.toLocaleString()}</span>
      {!mobile && <button type="button" onClick={() => s.step(1)} disabled={!paged || cur >= pageCount - 1} title={dirY ? '다음 페이지 (↓)' : '다음 페이지 (→)'} aria-label="다음 페이지" className={clsx('pb-arrow', list.arrow, paged && cur < pageCount - 1 && list.arrowOn)}><IconChevronRight /></button>}
    </div>
  )
  const filterGroups: FilterGroup[] = [
    { label: '성별', title: '코디의 성별(입은 아이템으로 나눈다)', opts: GENDERS, value: s.comboGender, onPick: s.setComboGender },
    { label: '방향', title: '넘기는 방향', opts: DIRS, value: s.listDir, onPick: s.setListDir },
  ]
  const finder = host === 'plaza' && <ItemFinder mobile={mobile} now={mobile || narrow ? item : null} />
  const back = detail ? onBack : undefined
  if (mobile) {
    return (
      <div className={list.controlsM}>
        <HeadItem item={item} mobile host={host} onBack={back} />
        {detail ? <DetailActs row={detail} mobile /> : <>
          <FilterM mobile groups={filterGroups} />
          {pageChip}
          {finder}
        </>}
      </div>
    )
  }
  if (detail) {
    return (
      <div className={list.header}>
        <div className={list.groupA}><HeadItem item={item} mobile={false} host={host} onBack={back} /></div>
        <div className={list.groupB}><DetailActs row={detail} mobile={false} /></div>
      </div>
    )
  }
  return (
    <div className={list.header}>
      <div className={list.groupA}>
        <HeadItem item={item} mobile={false} host={host} />
        {narrow ? <FilterM mobile={false} groups={filterGroups} /> : <>
          <Seg title="코디의 성별(입은 아이템으로 나눈다)" opts={GENDERS} value={s.comboGender} onPick={s.setComboGender} />
          {/* 넘기는 방향 — 아이콘 칸(공용 30 × 24)을 이 머리의 다른 칸과 같은 높이로 키운다(PC 34, 사용자 지시) */}
          <div className={styles.dirSeg}><Seg title="넘기는 방향" opts={DIRS} value={s.listDir} onPick={s.setListDir} /></div>
        </>}
      </div>
      <div className={clsx(list.groupB, styles.groupBFit)}>
        {pageChip}
        {finder}
      </div>
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
  const g: LookGender = s.comboGender === 'all' ? 'a' : s.comboGender // 패널은 성별마다 새로 붙는다(ComboPanel 의 key)

  // 첫 묶음 = 코디 수 · 자주 쓴 염색 — 받은 코디 수로 쪽 넘김의 쪽 수가 정해진다
  const setComboTotal = s.setComboTotal
  useEffect(() => {
    let alive = true
    setFailed(false)
    lookChunk(item.id, 0, g).then((d) => {
      if (!alive) return
      setFirst(d); setChunks((m) => ({ ...m, 0: d.looks }))
      setComboTotal(`${item.id}|${s.comboGender}`, d.total)
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
      lookChunk(item.id, c, g).then((d) => { if (alive) setChunks((m) => (m[c] ? m : { ...m, [c]: d.looks })) }).catch(() => {})
    }
    return () => { alive = false }
  }, [cur, first, pageCount, per, item.id])
  // 다음다음 쪽은 한가할 때 미리 합성해 둔다 — 프리셋 탭과 같은 방식(ShopContext PRESET_WARM: 그림 줄의 가장 낮은 순위 2, 보이는 카드가 줄을 서 있지 않을 때만).
  // 지금 쪽 ±1 은 이미 카드로 붙어 있다(우선순위 0 · 1). 넘기면 다시 건다
  const cardPv = s.cardPv, index = s.index
  useEffect(() => {
    if (!index || !per || s.snapping) return
    const rows = pageRows(cur + 2)
    if (!rows?.length) return
    const jobs = rows.map((r) => enqueueThumb(2, () => warmSnap(withCardPv(r.s, cardPv), index, true).then(() => undefined)))
    return () => { for (const j of jobs) j.cancel() }
  }, [cur, chunks, per, cardPv, index, s.snapping])
  // 쪽 p 의 코디(그 쪽이 걸친 묶음이 다 왔을 때만)
  const pageRows = (p: number): LookRow[] | null => {
    if (total == null) return null // 첫 묶음 전 — 스켈레톤
    const a = p * per, b = Math.min(total ?? 0, a + per), out: LookRow[] = []
    for (let i = a; i < b; i++) { const c = chunks[Math.floor(i / LOOK_CHUNK)]; if (!c) return null; const r = c[i % LOOK_CHUNK]; if (r) out.push(r) }
    return out
  }

  // 뷰포트 = 목록의 것(측정 · 휠 · 끌기). 모바일은 브라우저 스크롤 ↔ 쪽 번호를 서로 맞춘다(ListArea 와 같다)
  const vpRef = useRef<HTMLDivElement | null>(null)
  const bindVp = s.bindVp
  const setVp = useCallback((el: HTMLDivElement | null) => { vpRef.current = el; bindVp(el) }, [bindVp])
  // 모바일은 늘 두 줄 이상(사용자 지시 — 빠른 파악). 칸이 모자라면 목록처럼 페이지를 늘려 화면 스크롤로 흡수한다(같은 훅). 2열(광장)은 카드가 넓어 낮게 잡는다
  useMobileRows(vpRef, mobile, cols, mobileRatio(cols), 2, true)
  useExtraM(vpRef, mobile)
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

  // 자주 쓴 염색: 받기 전에는 같은 칸 수의 스켈레톤으로 자리를 잡아 둔다(받은 뒤 목록이 밀리지 않게 — 표본에 있는 아이템은 거의 다 염색 기록이 있다)
  const dyes = first?.dyes ?? []
  const looks = useLookCount(item.id)
  const dyeSkel = !first && !failed && looks > 0
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
      {/* 머리와 내용은 구분선으로 가르고, 자주 쓴 염색은 내용 쪽의 한 묶음이다(사용자 지시 — 머리에 바로 붙어 보이면 안 된다) */}
      {(dyes.length > 0 || dyeSkel) && <><DyeRow item={item} dyes={dyes} mobile={mobile} /><div data-combo-extra className={clsx(styles.dyesSep, mobile && styles.dyesSepM)} /></>}
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
  // 10위까지 담고, 한 번에 보이는 칸은 넓은 PC 5 · 좁은 폭(절반 · 태블릿) · 모바일 3 — 나머지는 가로로 민다(사용자 지시: 칸이 좁으면 염색 띠의 테두리 고리 자리가 모자란다).
  // 줄은 하단 부위 줄 · 염색 보관함과 같은 가로 줄(pb-norail · pb-fade 흐림 · 화살표, 마우스 휠은 가로 — useWheelRail)
  const n = mobile || s.listNarrow ? 3 : 5
  const rail = useWheelRail<HTMLDivElement>()
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
  // 보관함 담기(그 아이템의 염색 보관함 — lib/dyeVault). 담긴 값이면 체크(착용 칩의 '입고 있어요'와 같은 꼴)
  const vault = useDyeVault(item.id)
  const saved = new Set(vault.list.map(dyeSaveKey))
  const full = vault.list.length >= DYE_VAULT_MAX
  const asSave = (d: LookDye): DyeSave => (d.kind === 'palette' ? { pal: d.v } : { hsb: d.v })
  return (
    // 묶음(바탕 · 테두리 · 안쪽 여백)이 곧 가로 스크롤 칸이다 — 흐림이 칩이 아니라 묶음의 끝(안쪽 여백까지)에 붙는다(pinkbean-design: 칸의 안쪽 여백까지 덮는다, 염색 보관함과 같다)
    <div ref={rail} data-combo-extra className={clsx('pb-norail', 'pb-fade', styles.dyes, mobile && styles.dyesM)} style={{ '--dye-n': n } as React.CSSProperties}>
        {!dyes.length && <DyeSkels n={n} mobile={mobile} />}
        {dyes.map((d, i) => {
          const on = live(d)
          const has = saved.has(dyeSaveKey(asSave(d)))
          return (
            // 칩 = 입기(면 어디를 눌러도), 띠 위 오른쪽 작은 단추 = 보관함에 담기 — 착용 칩(WornItems)의 입기 단추와 같은 부품 · 자리(사용자 지시).
            // 안에 단추가 있어 칩은 button 이 아니라 role=button(단추 안에 단추를 둘 수 없다)
            <div key={i} role="button" tabIndex={0} onClick={() => apply(d)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); apply(d) } }}
              aria-pressed={on} title={`${d.n.toLocaleString()}명이 쓴 염색 입기`}
              className={clsx(surf.partChip, ui.dyeChip, styles.dyeChip, mobile && styles.dyeChipM, on && styles.dyeChipOn)}>
              <span className={clsx('pb-chipthumb', surf.partThumb, mobile && styles.dyeThumbM)}>
                <span className={surf.partSprite}>
                  <LookSprite slot={item.slot} item={skin ? null : item} tone={te?.tone ?? s.tone} palette={d.kind === 'palette' ? d.v : undefined} hsb={d.kind === 'hsb' ? d.v : undefined} />
                </span>
              </span>
              <span className={clsx(surf.partText, mobile && styles.dyeTextM)}>
                <span className={surf.partSlot}>{i + 1}위</span>
                <span className={surf.partName}>{d.n.toLocaleString()}명</span>
              </span>
              <ChipAct done={has} doneTitle="보관함에 있어요" icon={<IconVaultAdd size={12} />} disabled={full} label="염색 보관함에 담기"
                title={full ? `보관함은 ${DYE_VAULT_MAX}개까지예요` : '이 염색을 보관함에 담기'} onClick={() => { vault.put(asSave(d)); s.notify('염색 보관함에 담았어요') }} />
              <DyeBand state="dyed" slot={key} palette={d.kind === 'palette' ? d.v : undefined} hsb={d.kind === 'hsb' ? d.v : undefined} skinFamily={skin ? skinDyeFamily(te?.name) ?? undefined : undefined} />
            </div>
          )
        })}
    </div>
  )
}
// 받기 전 칩 — 받은 칩과 같은 구조 · 크기(글자 자리만 흐린 막대)
function DyeSkels({ n, mobile }: { n: number; mobile: boolean }) {
  return Array.from({ length: n }, (_, i) => (
    <span key={i} aria-hidden className={clsx(surf.partChip, ui.dyeChip, styles.dyeChip, mobile && styles.dyeChipM, styles.dyeSkel)}>
      <span className={clsx('pb-skel', surf.partThumb, mobile && styles.dyeThumbM)} />
      <span className={clsx(surf.partText, mobile && styles.dyeTextM)}>
        <span className={clsx('pb-skel', surf.partSlot, styles.skelText)}>{i + 1}위</span>
        <span className={clsx('pb-skel', surf.partName, styles.skelText)}>000명</span>
      </span>
      <DyeBand state="empty" slot="hair" />
    </span>
  ))
}
const sortKeys = (o: object) => Object.fromEntries(Object.entries(o).sort(([a], [b]) => a.localeCompare(b)))

function LookCard({ row, mobile, prio, onOpen }: { row: LookRow; mobile: boolean; prio: number; onOpen: (r: LookRow) => void }) {
  const s = useShop()
  const shown = useMemo(() => withCardPv(row.s, s.cardPv), [row.s, s.cardPv])
  // 미리 받기: 마우스를 올리면 상세의 큰 그림을 줄 없이 합성(warmSnap — 광장 카드와 같다), 120ms 머물면 [전부 입기]에 쓸 것(warmWear — 아이템 찾기 ·
  // 미리보기의 그림 첫 장)까지 받는다(목록 카드의 '코디' 칩과 같은 머무름). 터치는 닿는 순간 받는다. 그래서 상세를 열자마자 [전부 입기]를 눌러도 기다리지 않는다
  const hover = useRef(0)
  useEffect(() => () => window.clearTimeout(hover.current), [])
  const enter = (e: React.PointerEvent) => {
    warmSnap(shown, s.index, true)
    if (e.pointerType !== 'mouse') return
    window.clearTimeout(hover.current); hover.current = window.setTimeout(() => s.warmWear(row.s), 120)
  }
  const down = (e: React.PointerEvent) => { if (e.pointerType !== 'mouse') s.warmWear(row.s) }
  return (
    <div onClick={() => { if (!s.consumeSwipeClick()) onOpen(row) }} onPointerEnter={enter} onPointerLeave={() => window.clearTimeout(hover.current)} onPointerDown={down} title="코디 자세히 보기" className="pb-presetwrap" style={{ cursor: 'pointer' }}>
      <div className={clsx('pb-preset', styles.card)}>
        {/* 연출이 바뀌면 그리던 그림을 두고 새 그림이 되면 바꾼다(keep — 코디 탭 목록 카드와 같다, 뼈대를 비추지 않는다) */}
        <div className={styles.thumb}><SnapThumb snap={shown} view keep fraction={mobile ? FRACTION_M : FRACTION} fitW={mobile ? undefined : FIT_W} priority={prio} /></div>
      </div>
    </div>
  )
}

// ── 상세: 큰 그림 + 부위별 착용(부위만 골라 입기) + 전부 입기 · 프리셋에 저장 ──────────
// 머리 오른쪽의 두 버튼(머리는 ComboPanel 이 그린다 — ComboHead 의 detail)
function DetailActs({ row, mobile }: { row: LookRow; mobile: boolean }) {
  const s = useShop()
  const snap = row.s
  // [전부 입기] = 광장 가져오기와 같은 길(applySharedToPreset — 지금 프리셋에, 되돌리기 한 건). 연출은 **지금 연출 그대로**, 귀 · 형상 변이만 그 코디의 것이다
  // (lib/looks lookPv, 사용자 지시 — 남이 올린 설정이 아니라 코디만 가져온다. 카드 · 상세 그림도 같은 연출이라 본 그대로 입는다).
  // 이름은 지금 프리셋 이름 그대로(이름 없이 넘긴다)
  const look = (): Snapshot => ({ ...snap, name: undefined, pv: lookPv(snap, s.snapshot().pv!) })
  const wearAll = () => { if (s.selectedPreset) s.applySharedToPreset(look(), s.selectedPreset, '이 코디를 전부 입었어요') }
  return (
    <div className={styles.detailActs}>
      <button type="button" onClick={wearAll} title="이 코디를 지금 프리셋에 전부 입기(되돌리기 가능)" className={clsx('pb-soft', styles.actBtn, mobile && styles.actBtnM)}>전부 입기</button>
      <button type="button" onClick={() => s.takeCombo(look())} title="이 코디를 내 프리셋에 저장" className={clsx('pb-solid', styles.actBtn, mobile && styles.actBtnM, styles.actSolid)}><IconTakeDown size={13} />프리셋에 저장</button>
    </div>
  )
}
function ComboDetail({ row, mobile }: { row: LookRow; mobile: boolean }) {
  const s = useShop()
  const snap = row.s
  const warmWear = s.warmWear
  const shown = useMemo(() => withCardPv(snap, s.cardPv), [snap, s.cardPv])
  useEffect(() => { warmWear(snap, true) }, [snap]) // [전부 입기]가 바로 반영되게 받아 두고 염색까지 칠해 둔다(누르기 직전)
  return (
    <>
      {/* 절반 · 태블릿은 패널이 좁아 그림 옆에 두면 착용 칸이 170px 남짓이라 칩이 53px 이었다 — 모바일처럼 위아래로 쌓는다 */}
      <div className={clsx(styles.detail, mobile ? clsx('pb-norail', styles.detailM) : clsx('pb-scroll', s.listNarrow && styles.detailM))}>
        <div className={clsx(styles.stage, (mobile || s.listNarrow) && styles.stageM)}><SnapThumb snap={shown} view keep fraction={mobile ? 0.5 : 0.46} priority={-1} /></div>
        <div className={styles.worn}><WornItems snap={snap} postId={`look:${row.i}`} mobile={mobile || s.listNarrow} flat />{/* 쌓은 배치(절반 · 태블릿)는 모바일처럼 2열 — 3열이면 이름이 잘렸다 */}</div>
      </div>
      <Credit mobile={mobile} />
    </>
  )
}
