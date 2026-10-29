'use client'

// 코디 광장 목록 — 코디 탭과 같은 패널 골격(헤더 · 구분선 · 페이지 뷰포트 · 힌트 바)을 쓰되 데이터만 광장 글이다.
//  PC(절반·태블릿) : 정렬 드롭다운 + (페이지 칩 · 검색) 한 줄. 등록 폼은 오른쪽 컬럼에 상주한다(PlazaUpload).
//  모바일          : 정렬+검색 / 페이지 칩+등록 두 줄. 등록을 누르면 목록 자리에서 폼으로 바뀐다.
// 그리드 열·행은 ShopContext 한 곳에서만 계산한다(perPage 와 렌더 그리드가 어긋나면 페이지 수가 틀어진다).

import clsx from 'clsx'
import { useCallback, useEffect, useLayoutEffect, useRef } from 'react'
import { PLAZA_CONTEST, PLAZA_CONTEST_PERIOD, PLAZA_OPEN, plazaContestClosed, type PlazaSort } from '@/lib/plaza'
import { useShop } from '../ShopContext'
import Dropdown from '../ui/Dropdown'
import { CARD_FOOT_M, CARD_RATIO_M, DIRS, FilterM, useMobileRows, useWindowPagerY, type FilterGroup } from '../list/ListArea'
import { PlazaTabsM, StickyBarM } from '../nav/BottomNav'
import { MOBILE_GRID } from '@/lib/shopData'
import { Seg, type SegOpt } from '../ui/controls'
import { IconChevronLeft, IconChevronRight, IconClose, IconPlus, IconSearch } from '../ui/Icons'
import PlazaCard from './PlazaCard'
import PlazaUpload from './PlazaUpload'
import styles from './plaza.module.css'

const SORTS: SegOpt<PlazaSort>[] = [{ v: 'popular', l: '인기순' }, { v: 'recent', l: '최신순' }]

export default function PlazaPanel({ mobile }: { mobile: boolean }) {
  const s = useShop()
  const narrow = s.listNarrow
  const list = s.plazaList
  const per = s.plazaCols * s.plazaRows
  const gap = mobile ? 9 : 10

  // 뷰포트는 코디 리스트와 같은 훅을 쓴다(측정·휠·스와이프). 탭이 하나만 떠 있으므로 충돌하지 않는다.
  const vpRef = useRef<HTMLDivElement | null>(null)
  const bindVp = s.bindVp
  const setVp = useCallback((el: HTMLDivElement | null) => { vpRef.current = el; bindVp(el) }, [bindVp])
  // 모바일은 목록과 같은 높이 규칙(붙은 미리보기 아래에 3줄 — ListArea useMobileRows). 코디 룩북 분류는 그 분류에만 있는 줄(자주 쓴 염색 · 출처)만큼
  // 페이지가 더 길지만, 분류 줄이 보일 만큼 올린 자리는 어느 분류든 페이지 안이라 분류를 바꿔도 화면이 끌려가지 않는다
  useMobileRows(vpRef, mobile, MOBILE_GRID.cols, CARD_RATIO_M, MOBILE_GRID.rows, true, CARD_FOOT_M, 0, 14) // 14 = 코디 룩북 목록 칸의 좌우 여백(list.viewportM 7 × 2)

  // 모바일: 가로 스크롤 ↔ 페이지 인덱스 양방향 동기화(광장 뷰포트에도 따로 연결해야 인덱스가 멈추지 않는다).
  // 넘기는 방향은 목록과 같은 설정(ShopContext listDir — 사용자 지시: 광장에도). 세로면 PC 는 트랙이 위아래로, 모바일은 세로 스크롤 칸(한 쪽 = 한 화면 높이)
  const dirY = s.listDir === 'y'
  const live = useRef({ idx: s.curIdx, setIdx: s.setIdx, cols: s.plazaCols, rows: s.plazaRows, y: dirY })
  live.current = { idx: s.curIdx, setIdx: s.setIdx, cols: s.plazaCols, rows: s.plazaRows, y: dirY }
  useEffect(() => {
    const vp = vpRef.current
    if (!mobile || !vp || dirY) return // 세로는 페이지 스크롤(ListArea useWindowPagerY)
    let raf = 0
    const onScroll = () => {
      if (raf) return
      raf = requestAnimationFrame(() => {
        raf = 0
        const y = live.current.y, w = y ? vp.clientHeight : vp.clientWidth; if (!w) return
        const c = y ? live.current.rows : live.current.cols
        const i = Math.floor(Math.round((y ? vp.scrollTop : vp.scrollLeft) / (w / c)) / c)
        if (i !== live.current.idx) live.current.setIdx(i, false)
      })
    }
    vp.addEventListener('scroll', onScroll, { passive: true })
    return () => { vp.removeEventListener('scroll', onScroll); cancelAnimationFrame(raf) }
  }, [mobile, dirY])
  const scrollKey = `plaza|${s.plazaFilter}|${s.plazaQ}|${s.plazaSort}|${s.listDir}`
  const lastKey = useRef(scrollKey)
  const scrolledOnce = useRef(false)
  useLayoutEffect(() => {
    const vp = vpRef.current
    if (!mobile || !vp || dirY) return
    const w = dirY ? vp.clientHeight : vp.clientWidth; if (!w) return
    const jump = lastKey.current !== scrollKey || !scrolledOnce.current
    lastKey.current = scrollKey
    scrolledOnce.current = true
    const c = dirY ? live.current.rows : live.current.cols
    if (Math.floor(Math.round((dirY ? vp.scrollTop : vp.scrollLeft) / (w / c)) / c) === s.curIdx && !jump) return
    const target = s.curIdx * w
    const smooth = !jump
    // ⚠️ 트랙 폭은 `pageCount * 100cqw`(컨테이너 쿼리 단위)라, 페이지 수가 늘어난 **그 커밋의 layout effect
    //    시점엔 아직 한 페이지 폭**이다. 그때 scrollTo 를 부르면 브라우저가 목표를 최대 스크롤(=0)로 깎는다
    //    → 인덱스는 6 인데 스크롤은 0 이라 페이지 DOM(현재 ±1) 이 화면 밖에 있어 **빈 리스트**가 보인다.
    //    트랙이 다 자랄 때까지 프레임을 넘겨 다시 시도한다(조건이 맞는 즉시 끝난다).
    let raf = 0
    let left = 120 // 폭주 방지용 상한(≈2초). 대기 시간이 아니라 안전장치다 — 조건이 맞는 즉시 빠져나간다.
    const go = () => {
      raf = 0
      if (!vp.isConnected) return
      // 트랙이 목표까지 자랐으면 이동. 아직이면 다음 프레임에 다시 본다(보통 1~3프레임).
      const room = dirY ? vp.scrollHeight - vp.clientHeight : vp.scrollWidth - vp.clientWidth
      if (room < target && left-- > 0) { raf = requestAnimationFrame(go); return }
      const to = Math.min(target, Math.max(0, room))
      vp.scrollTo({ ...(dirY ? { top: to, left: 0 } : { left: to, top: 0 }), behavior: smooth ? 'smooth' : ('instant' as ScrollBehavior) })
    }
    go()
    return () => { if (raf) cancelAnimationFrame(raf) }
  }, [mobile, s.curIdx, scrollKey, s.pageCount, dirY])
  useWindowPagerY(vpRef, mobile && dirY, s.curIdx, s.setIdx, s.pageCount, scrollKey, s.plazaRows)

  const pageChip = (
    <div className={mobile ? styles.pageChipM : styles.pageChip}>
      {!mobile && (
        <>
          <span title="이 분류의 코디 수" className={styles.count}>{`${list.length}개`}</span>
          <span className={styles.chipDiv} />
        </>
      )}
      {/* 모바일에는 화살표를 두지 않는다(목록과 같다) — 옆으로 밀어 넘기고, 멀리 갈 때는 번호를 적는다 */}
      {!mobile && <button type="button" onClick={() => s.step(-1)} disabled={s.curIdx <= 0} title="이전 페이지" aria-label="이전 페이지" className={clsx('pb-arrow', styles.arrow, s.curIdx > 0 && styles.arrowOn)}><IconChevronLeft /></button>}
      <input value={s.pageEditing ? s.pageInput : `${s.curIdx + 1}`} onFocus={s.onPageFocus} onChange={s.onPageChange} onKeyDown={s.onPageKey} onBlur={s.commitPage}
        inputMode="numeric" aria-label="현재 페이지" className={clsx('pb-input', 'pb-pageinput', styles.pageInput)} />
      <span className={styles.slash}>/</span>
      <span className={styles.total}>{s.pageCount}</span>
      {!mobile && <button type="button" onClick={() => s.step(1)} disabled={s.curIdx >= s.pageCount - 1} title="다음 페이지" aria-label="다음 페이지" className={clsx('pb-arrow', styles.arrow, s.curIdx < s.pageCount - 1 && styles.arrowOn)}><IconChevronRight /></button>}
    </div>
  )

  const sortDd = (
    <div className={mobile ? styles.sortWrapM : clsx(styles.sortWrap, narrow && styles.sortWrapNarrow)}>
      <Dropdown variant="row" options={SORTS} value={s.plazaSort} onChange={(v) => { s.setPlazaSort(v as PlazaSort); s.setIdx(0, false) }} ariaLabel="정렬" title="정렬" />
    </div>
  )
  // 정렬 · 방향: 넓은 PC 는 [정렬] 옆에 방향을 펼치고, 좁은 폭 · 모바일은 [보기 설정] 하나에 접는다(목록 머리와 같은 규칙 · 같은 부품 FilterM —
  // 사용자 지시: 이미 꽉 찬 머리에 칸을 더하지 않는다)
  const fold = mobile || narrow
  const filterGroups: FilterGroup[] = [
    { label: '정렬', title: '정렬', opts: SORTS, value: s.plazaSort, onPick: (v: PlazaSort) => { s.setPlazaSort(v); s.setIdx(0, false) } },
    { label: '방향', title: '넘기는 방향', opts: DIRS, value: s.listDir, onPick: s.setListDir },
  ]
  const viewCtl = fold ? <FilterM mobile={mobile} groups={filterGroups} /> : <>{sortDd}<Seg title="넘기는 방향" opts={DIRS} value={s.listDir} onPick={s.setListDir} /></>
  const search = (
    <input value={s.plazaQ} onChange={(e) => s.setPlazaQ(e.target.value)} placeholder="이름, 태그 검색"
      aria-label="코디 검색" className={clsx('pb-input', mobile ? styles.searchInputM : styles.searchInput)} />
  )

  const empty = !s.plazaLoading && list.length === 0
  const searching = !!s.plazaQ.trim()
  const emptyTitle = searching ? '검색 결과가 없어요'
    : s.plazaFilter === 'contest' ? '대회 출품 코디가 없어요'
      : s.plazaFilter === 'mine' ? '등록한 코디가 없어요'
        : s.plazaFilter === 'liked' ? '찜한 코디가 없어요' : '아직 등록된 코디가 없어요'
  const emptyHint = searching ? '다른 이름, 설명, 태그로 찾아주세요.'
    : s.plazaFilter === 'contest' ? `${PLAZA_CONTEST} 출품작이 아직 없어요.`
      : s.plazaFilter === 'mine' ? '내 프리셋의 코디를 등록해보세요.'
        : s.plazaFilter === 'liked' ? '마음에 드는 코디에 하트를 눌러주세요.'
    : `${PLAZA_OPEN}에 올라온 게 아직 없어요. 첫 코디를 올려보세요.`

  const gridStyle = { gridTemplateColumns: `repeat(${s.plazaCols},minmax(0,1fr))`, gridTemplateRows: `repeat(${s.plazaRows},minmax(0,1fr))`, gap: `${gap}px` }
  const pages: { pi: number; items: typeof list }[] = []
  for (let pi = Math.max(0, s.curIdx - 1); pi <= Math.min(s.pageCount - 1, s.curIdx + 1); pi++) pages.push({ pi, items: list.slice(pi * per, pi * per + per) })

  const viewport = (
    <div ref={setVp} className={clsx(styles.viewport, dirY && styles.viewportY, mobile && 'pb-norail', mobile && (dirY ? styles.viewportMY : styles.viewportM))}
      style={mobile && dirY ? { height: `calc(${Math.max(1, s.pageCount)} * var(--pb-page-h))` } : undefined}>
      {s.plazaLoading ? (
        <div className={mobile ? styles.pageM : styles.page} style={{ left: 0 }}>
          <div className={styles.grid} style={gridStyle}>
            {Array.from({ length: per }, (_, i) => <div key={i} className={clsx('pb-skel', styles.skel)} />)}
          </div>
        </div>
      ) : !s.plazaReady ? (
        <div className={clsx(styles.empty, mobile && styles.emptyM)}>
          <span className={styles.emptyTitle}>광장을 준비하고 있어요</span>
          <span className={styles.emptyHint}>잠시 뒤에 다시 들러주세요.</span>
        </div>
      ) : empty ? (
        <div className={clsx(styles.empty, mobile && styles.emptyM)}>
          <span className={styles.emptyTitle}>{emptyTitle}</span>
          <span className={styles.emptyHint}>{emptyHint}</span>
        </div>
      ) : (
        <div ref={mobile ? undefined : s.bindTrack} className={styles.track}
          style={mobile
            ? (dirY ? { height: `calc(${s.pageCount} * var(--pb-page-h))` } : { width: `calc(${s.pageCount} * 100cqw)` })
            : { transform: `${dirY ? 'translateY' : 'translateX'}(${-s.curIdx * 100}%)`, transition: s.snapping ? 'transform .34s cubic-bezier(.22,.61,.36,1)' : 'none' }}>
          {pages.map(({ pi, items }) => (
            <div key={pi} className={clsx('pb-page', mobile ? (dirY ? styles.pageMY : styles.pageM) : styles.page)}
              style={dirY ? { top: mobile ? `calc(${pi} * var(--pb-page-h))` : `${pi * 100}%`, left: 0 } : { left: mobile ? `calc(${pi} * 100cqw)` : `${pi * 100}%` }}>
              {(!s.snapping || pi === s.curIdx || Math.abs(pi - s.snapFrom) <= 1) && (
                <div className={styles.grid} style={gridStyle}>
                  {/* 보이는 쪽을 먼저 그리고 앞뒤 쪽은 그다음(lib/thumbQueue) */}
                  {items.map((post) => <PlazaCard key={post.id} post={post} mobile={mobile} priority={pi === s.curIdx ? 0 : 1} />)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )

  if (mobile) {
    return (
      <>
        <StickyBarM>
        {/* 광장 분류는 코디 탭의 부위처럼 미리보기와 목록 머리 사이(사용자 지시) — 머리와 한 묶음으로 붙는다 */}
        <PlazaTabsM />
        {/* 한 줄(다른 탭의 머리와 같은 높이 48): 정렬 · 쪽 번호 · 검색 · 등록 */}
        <div className={styles.controlsM}>
          {viewCtl}
          {pageChip}
          <div className={styles.searchWrapM}><IconSearch className={styles.searchIconM} />{search}</div>
          <button type="button" onClick={() => s.setPlazaUpload(!s.plazaUpload)} title={s.plazaUpload ? '닫기' : '내 코디 등록'} aria-label={s.plazaUpload ? '닫기' : '내 코디 등록'} className={styles.upBtn}>
            {s.plazaUpload ? <IconClose /> : <IconPlus />}
          </button>
        </div>
        <div className={styles.hrM} />
        </StickyBarM>
        {s.plazaUpload ? <PlazaUpload mobile /> : viewport}
      </>
    )
  }
  return (
    <section className={styles.panel}>
      <div className={styles.header}>
        {viewCtl}
        <div className={styles.groupB}>
          {pageChip}
          <div className={styles.searchWrap}><IconSearch className={styles.searchIcon} />{search}</div>
        </div>
      </div>
      <div className={styles.hr} />
      {viewport}
      <div className={clsx('pb-hintbar', styles.hintBar)}>
        {/* 대회 필터에서는 조작 안내 대신 대회 기간을 알린다(규칙 안내는 기간이면 충분). */}
        <span className={styles.hintText}>{s.plazaFilter === 'contest'
          ? `${PLAZA_CONTEST} | ${plazaContestClosed() ? '마감됐어요' : PLAZA_CONTEST_PERIOD ?? '기간은 곧 안내돼요'}`
          : dirY ? '스크롤, 스와이프, ↑ ↓ 로 페이지를 넘겨요' : '스크롤, 스와이프, ← → 로 페이지를 넘겨요'}</span>
      </div>
    </section>
  )
}
