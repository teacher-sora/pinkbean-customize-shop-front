'use client'

// 코디 광장 목록 — 코디 탭과 같은 패널 골격(헤더 · 구분선 · 페이지 뷰포트 · 힌트 바)을 쓰되 데이터만 광장 글이다.
//  PC(절반·태블릿) : 정렬 드롭다운 + (페이지 칩 · 검색) 한 줄. 등록 폼은 오른쪽 컬럼에 상주한다(PlazaUpload).
//  모바일          : 정렬+검색 / 페이지 칩+등록 두 줄. 등록을 누르면 목록 자리에서 폼으로 바뀐다.
// 그리드 열·행은 ShopContext 한 곳에서만 계산한다(perPage 와 렌더 그리드가 어긋나면 페이지 수가 틀어진다).

import clsx from 'clsx'
import { useCallback, useEffect, useLayoutEffect, useRef } from 'react'
import { isNarrow } from '@/lib/useBreakpoint'
import { PLAZA_CONTEST, PLAZA_CONTEST_PERIOD, PLAZA_OPEN, type PlazaSort } from '@/lib/plaza'
import { useShop } from '../ShopContext'
import Dropdown from '../ui/Dropdown'
import { IconChevronLeft, IconChevronRight, IconCloseSmall, IconPlus, IconSearch } from '../ui/Icons'
import PlazaCard from './PlazaCard'
import PlazaUpload from './PlazaUpload'
import styles from './plaza.module.css'

const SORTS = [{ v: 'popular', l: '인기순' }, { v: 'recent', l: '최신순' }]

export default function PlazaPanel({ mobile }: { mobile: boolean }) {
  const s = useShop()
  const narrow = isNarrow(s.bp)
  const list = s.plazaList
  const per = s.plazaCols * s.plazaRows
  const gap = mobile ? 9 : 10

  // 뷰포트는 코디 리스트와 같은 훅을 쓴다(측정·휠·스와이프). 탭이 하나만 떠 있으므로 충돌하지 않는다.
  const vpRef = useRef<HTMLDivElement | null>(null)
  const bindVp = s.bindVp
  const setVp = useCallback((el: HTMLDivElement | null) => { vpRef.current = el; bindVp(el) }, [bindVp])

  // 모바일: 가로 스크롤 ↔ 페이지 인덱스 양방향 동기화(광장 뷰포트에도 따로 연결해야 인덱스가 멈추지 않는다).
  const live = useRef({ idx: s.curIdx, setIdx: s.setIdx, cols: s.plazaCols })
  live.current = { idx: s.curIdx, setIdx: s.setIdx, cols: s.plazaCols }
  useEffect(() => {
    const vp = vpRef.current
    if (!mobile || !vp) return
    let raf = 0
    const onScroll = () => {
      if (raf) return
      raf = requestAnimationFrame(() => {
        raf = 0
        const w = vp.clientWidth; if (!w) return
        const c = live.current.cols
        const i = Math.floor(Math.round(vp.scrollLeft / (w / c)) / c)
        if (i !== live.current.idx) live.current.setIdx(i, false)
      })
    }
    vp.addEventListener('scroll', onScroll, { passive: true })
    return () => { vp.removeEventListener('scroll', onScroll); cancelAnimationFrame(raf) }
  }, [mobile])
  const scrollKey = `plaza|${s.plazaFilter}|${s.plazaQ}|${s.plazaSort}`
  const lastKey = useRef(scrollKey)
  const scrolledOnce = useRef(false)
  useLayoutEffect(() => {
    const vp = vpRef.current
    if (!mobile || !vp) return
    const w = vp.clientWidth; if (!w) return
    const jump = lastKey.current !== scrollKey || !scrolledOnce.current
    lastKey.current = scrollKey
    scrolledOnce.current = true
    const c = live.current.cols
    if (Math.floor(Math.round(vp.scrollLeft / (w / c)) / c) === s.curIdx && !jump) return
    const target = s.curIdx * w
    const smooth = !jump
    // ⚠️ 트랙 폭은 `pageCount * 100cqw`(컨테이너 쿼리 단위)라, 페이지 수가 늘어난 **그 커밋의 layout effect
    //    시점엔 아직 한 페이지 폭**이다. 그때 scrollTo 를 부르면 브라우저가 목표를 최대 스크롤(=0)로 깎는다
    //    → 인덱스는 6 인데 스크롤은 0 이라 페이지 DOM(현재 ±1) 이 화면 밖에 있어 **빈 리스트**가 보였다
    //    (2026-09-21 실측: scrollTo({left:1880}) 호출 4회 모두 scrollWidth-clientWidth = 0).
    //    트랙이 다 자랄 때까지 프레임을 넘겨 다시 시도한다(조건이 맞는 즉시 끝난다).
    let raf = 0
    let left = 120 // 폭주 방지용 상한(≈2초). 대기 시간이 아니라 안전장치다 — 조건이 맞는 즉시 빠져나간다.
    const go = () => {
      raf = 0
      if (!vp.isConnected) return
      // 트랙이 목표까지 자랐으면 이동. 아직이면 다음 프레임에 다시 본다(보통 1~3프레임).
      if (vp.scrollWidth - vp.clientWidth < target && left-- > 0) { raf = requestAnimationFrame(go); return }
      const max = Math.max(0, vp.scrollWidth - vp.clientWidth)
      vp.scrollTo({ left: Math.min(target, max), behavior: smooth ? 'smooth' : ('instant' as ScrollBehavior) })
    }
    go()
    return () => { if (raf) cancelAnimationFrame(raf) }
  }, [mobile, s.curIdx, scrollKey, s.pageCount])

  const pageChip = (
    <div className={mobile ? styles.pageChipM : styles.pageChip}>
      {!mobile && (
        <>
          <span title="이 분류의 코디 수" className={styles.count}>{`${list.length}개`}</span>
          <span className={styles.chipDiv} />
        </>
      )}
      <button type="button" onClick={() => s.step(-1)} title="이전 페이지" aria-label="이전 페이지" className={clsx('pb-arrow', styles.arrow, s.curIdx > 0 && styles.arrowOn)}><IconChevronLeft /></button>
      <input value={s.pageEditing ? s.pageInput : `${s.curIdx + 1}`} onFocus={s.onPageFocus} onChange={s.onPageChange} onKeyDown={s.onPageKey} onBlur={s.commitPage}
        inputMode="numeric" aria-label="현재 페이지" className={clsx('pb-input', 'pb-pageinput', styles.pageInput)} />
      <span className={styles.slash}>/</span>
      <span className={styles.total}>{s.pageCount}</span>
      <button type="button" onClick={() => s.step(1)} title="다음 페이지" aria-label="다음 페이지" className={clsx('pb-arrow', styles.arrow, s.curIdx < s.pageCount - 1 && styles.arrowOn)}><IconChevronRight /></button>
    </div>
  )

  const sortDd = (
    <div className={mobile ? styles.sortWrapM : clsx(styles.sortWrap, narrow && styles.sortWrapNarrow)}>
      <Dropdown variant="row" options={SORTS} value={s.plazaSort} onChange={(v) => { s.setPlazaSort(v as PlazaSort); s.setIdx(0, false) }} ariaLabel="정렬" title="정렬" />
    </div>
  )
  const search = (
    <input value={s.plazaQ} onChange={(e) => s.setPlazaQ(e.target.value)} placeholder={mobile ? '이름 · 태그' : '이름 · 태그 검색'}
      aria-label="코디 검색" className={clsx('pb-input', mobile ? styles.searchInputM : styles.searchInput)} />
  )

  const empty = !s.plazaLoading && list.length === 0
  const searching = !!s.plazaQ.trim()
  const emptyTitle = searching ? '검색 결과가 없어요'
    : s.plazaFilter === 'contest' ? '대회 출품 코디가 없어요'
      : s.plazaFilter === 'mine' ? '등록한 코디가 없어요'
        : s.plazaFilter === 'liked' ? '찜한 코디가 없어요' : '아직 등록된 코디가 없어요'
  const emptyHint = searching ? '다른 이름 · 설명 · 태그로 찾아주세요.'
    : s.plazaFilter === 'contest' ? `${PLAZA_CONTEST} 출품작이 아직 없어요.`
      : s.plazaFilter === 'mine' ? '내 프리셋의 코디를 등록해보세요.'
        : s.plazaFilter === 'liked' ? '마음에 드는 코디에 하트를 눌러주세요.'
    : `${PLAZA_OPEN}에 올라온 게 아직 없어요. 첫 코디를 올려보세요.`

  const gridStyle = { gridTemplateColumns: `repeat(${s.plazaCols},minmax(0,1fr))`, gridTemplateRows: `repeat(${s.plazaRows},minmax(0,1fr))`, gap: `${gap}px` }
  const pages: { pi: number; items: typeof list }[] = []
  for (let pi = Math.max(0, s.curIdx - 1); pi <= Math.min(s.pageCount - 1, s.curIdx + 1); pi++) pages.push({ pi, items: list.slice(pi * per, pi * per + per) })

  const viewport = (
    <div ref={setVp} className={clsx(styles.viewport, mobile && 'pb-norail', mobile && styles.viewportM)}>
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
            ? { width: `calc(${s.pageCount} * 100cqw)` }
            : { transform: `translateX(${-s.curIdx * 100}%)`, transition: s.snapping ? 'transform .34s cubic-bezier(.22,.61,.36,1)' : 'none' }}>
          {pages.map(({ pi, items }) => (
            <div key={pi} className={clsx('pb-page', mobile ? styles.pageM : styles.page)} style={{ left: mobile ? `calc(${pi} * 100cqw)` : `${pi * 100}%` }}>
              {(!s.snapping || pi === s.curIdx || Math.abs(pi - s.snapFrom) <= 1) && (
                <div className={styles.grid} style={gridStyle}>
                  {items.map((post) => <PlazaCard key={post.id} post={post} mobile={mobile} />)}
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
        <div className={styles.controlsM}>
          <div className={styles.rowM1}>
            {sortDd}
            <div className={styles.searchWrapM}><IconSearch className={styles.searchIconM} />{search}</div>
          </div>
          <div className={styles.rowM2}>
            {pageChip}
            <button type="button" onClick={() => s.setPlazaUpload(!s.plazaUpload)} title="내 코디 등록" className={styles.upBtn}>
              {s.plazaUpload ? <IconCloseSmall /> : <IconPlus />}{s.plazaUpload ? '닫기' : '등록'}
            </button>
          </div>
        </div>
        <div className={styles.hrM} />
        {s.plazaUpload ? <PlazaUpload mobile /> : viewport}
      </>
    )
  }
  return (
    <section className={styles.panel}>
      <div className={styles.header}>
        {sortDd}
        <div className={styles.groupB}>
          {pageChip}
          <div className={styles.searchWrap}><IconSearch className={styles.searchIcon} />{search}</div>
        </div>
      </div>
      <div className={styles.hr} />
      {viewport}
      <div className={clsx('pb-hintbar', styles.hintBar)}>
        {/* 대회 필터에서는 조작 안내 대신 대회 기간을 알린다(사용자 지시 — 규칙 안내는 기간이면 충분). */}
        <span className={styles.hintText}>{s.plazaFilter === 'contest'
          ? `${PLAZA_CONTEST} · ${PLAZA_CONTEST_PERIOD ?? '기간은 곧 안내돼요'}`
          : '스크롤 · 스와이프 · ← → 로 페이지를 넘겨요'}</span>
      </div>
    </section>
  )
}
