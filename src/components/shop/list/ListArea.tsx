'use client'

// 코디 · AI 코디 검색 리스트 영역. 두 탭은 같은 헤더/페이지 구조를 공유하고 데이터만 다르다.
//  PC(절반·태블릿 포함) = 패널(section) + 헤더 + 뷰포트 + 힌트 바 / 모바일 = 컨트롤 2줄 + 뷰포트.

import clsx from 'clsx'
import { useCallback, useEffect, useLayoutEffect, useRef } from 'react'
import type { ListItem } from '@/lib/core/data'
import { isNarrow } from '@/lib/useBreakpoint'
import { useShop, type GenderFilter, type ListMode } from '../ShopContext'
import { Seg, type SegOpt } from '../ui/controls'
import { IconChevronLeft, IconChevronRight, IconSearch, IconSearchBold } from '../ui/Icons'
import ItemCard, { catOf } from './ItemCard'
import { useCodiThumbs, useSearchThumbs, type ThumbApi } from './thumbCtx'
import styles from './list.module.css'

const VIEW_MODES: SegOpt<ListMode>[] = [
  { v: 'sprite', l: '아이템', t: '아이템 그림만 보기' },
  { v: 'model', l: '기본 캐릭터', t: '기본 캐릭터에 입힌 모습' },
  { v: 'mymodel', l: '내 캐릭터', t: '내 캐릭터에 입힌 모습' },
]
const GENDERS: SegOpt<GenderFilter>[] = [
  { v: 'all', l: '전체', t: '모든 아이템' },
  { v: 'f', l: '여', t: '여자 캐릭터가 입을 수 있는 것' },
  { v: 'm', l: '남', t: '남자 캐릭터가 입을 수 있는 것' },
]
const AI_EXAMPLES = ['동물 귀 모자', '분홍 단발 헤어', '검은 정장 한벌옷', '반짝이는 날개 망토']

export default function ListArea({ mobile }: { mobile: boolean }) {
  const { primary } = useShop()
  return primary === 'search' ? <SearchList mobile={mobile} /> : <CodiList mobile={mobile} />
}

function CodiList({ mobile }: { mobile: boolean }) {
  const s = useShop()
  const list = s.activeList
  const thumbs = useCodiThumbs(list)
  const isFav = s.activeCat === 'fav'
  const isNew = s.activeCat === 'new'
  const empty = !s.catLoading && list.length === 0
  return (
    <ListFrame mobile={mobile} thumbs={thumbs} isAi={false}
      list={list} loading={s.catLoading}
      emptyTitle={empty ? (isFav ? '즐겨찾기한 아이템이 없어요' : isNew && !s.search ? '신규 아이템이 없어요' : '검색 결과가 없어요') : null}
      emptyHint={isFav ? '카드 오른쪽 위 별 띠지를 눌러 즐겨찾기에 모아둬요.' : isNew && !s.search ? '업데이트로 새 아이템이 추가되면 여기에 모여요.' : '다른 이름이나 필터로 찾아주세요.'} />
  )
}

function SearchList({ mobile }: { mobile: boolean }) {
  const s = useShop()
  const list = s.searchResults
  const thumbs = useSearchThumbs(list)
  const empty = list.length === 0 && !s.searchLoading && s.searchQuery !== null
  return (
    <ListFrame mobile={mobile} thumbs={thumbs} isAi
      list={list} loading={s.searchLoading}
      emptyTitle={empty ? '찾은 아이템이 없어요' : null} emptyHint="다른 표현으로 다시 찾아주세요." />
  )
}

function ListFrame({ mobile, thumbs, isAi, list, loading, emptyTitle, emptyHint }: {
  mobile: boolean; thumbs: ThumbApi; isAi: boolean; list: ListItem[]; loading: boolean; emptyTitle: string | null; emptyHint: string
}) {
  const s = useShop()
  const narrow = isNarrow(s.bp)
  // 모바일: 카드가 세로형(높이/폭 ≥ CARD_MIN_RATIO)으로 2줄 들어갈 최소 뷰포트 높이를 보장한다. 부족하면 페이지 컬럼
  // 높이(--pb-min-h)를 늘려 페이지 스크롤로 흡수(리스트 안 세로 스크롤은 만들지 않음). 그 외 요소 높이(chrome)는
  // 컬럼 − 뷰포트로 실측 → 컬럼이 늘어도 chrome 은 그대로라 값이 수렴한다.
  const vpRef = useRef<HTMLDivElement | null>(null)
  const bindVp = s.bindVp
  const setVp = useCallback((el: HTMLDivElement | null) => { vpRef.current = el; bindVp(el) }, [bindVp])
  useEffect(() => {
    if (!mobile) return
    const vp = vpRef.current
    const col = vp?.closest('[data-mobile-col]') as HTMLElement | null
    if (!vp || !col) return
    const CARD_MIN_RATIO = 1.34, PAD_X = 10, PAD_Y = 16, GAP = 10 // 페이지 패딩 좌우 5px(열 스냅 정렬용)
    const m = () => {
      const chrome = col.clientHeight - vp.clientHeight
      const cardW = (vp.clientWidth - PAD_X - GAP * 2) / 3
      const need = Math.ceil(chrome + PAD_Y + GAP + 2 * cardW * CARD_MIN_RATIO) + 'px'
      if (col.style.getPropertyValue('--pb-min-h') !== need) col.style.setProperty('--pb-min-h', need)
    }
    m()
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(m) : null
    ro?.observe(col); ro?.observe(vp)
    return () => { ro?.disconnect(); col.style.removeProperty('--pb-min-h') }
  }, [mobile])
  // ── 모바일: 네이티브 가로 스크롤(overflow-x + 페이지 스냅, 스크롤바 숨김) ↔ 페이지 인덱스 동기화 ──
  //  스냅 단위 = 카드 한 열(1×2). 페이지 좌우 패딩 5px + 뷰포트 좌우 7px 들임 → 열 간격 = 페이지 경계 간격 = 10px 이라
  //  열 스냅 위치가 정확히 폭/3 배수(페이지 = 3열). 스크롤 → 인덱스: 열 = round(스크롤/(폭/3)), 페이지 = floor(열/3).
  //  인덱스 → 스크롤: 화살표·페이지 입력 등으로 인덱스가 바뀌어 스크롤 위치와 어긋날 때만 이동(같으면 아무것도 안 함 →
  //  사용자 스크롤·프로그램 스크롤이 서로 싸우지 않는다). 부위·탭이 바뀌면 애니메이션 없이 즉시.
  //  가상화 유지: 트랙 폭만 페이지 수만큼 잡고, 페이지 DOM 은 현재 ±1 만 만든다(아래 pages).
  const live = useRef({ idx: s.curIdx, setIdx: s.setIdx })
  live.current = { idx: s.curIdx, setIdx: s.setIdx }
  useEffect(() => {
    const vp = vpRef.current
    if (!mobile || !vp) return
    let raf = 0
    const onScroll = () => {
      if (raf) return
      raf = requestAnimationFrame(() => {
        raf = 0
        const w = vp.clientWidth; if (!w) return
        const i = Math.floor(Math.round(vp.scrollLeft / (w / 3)) / 3)
        if (i !== live.current.idx) live.current.setIdx(i, false)
      })
    }
    vp.addEventListener('scroll', onScroll, { passive: true })
    return () => { vp.removeEventListener('scroll', onScroll); cancelAnimationFrame(raf) }
  }, [mobile])
  const scrollKey = `${s.primary}|${s.activeCat}|${isAi ? s.searchQuery : ''}`
  const lastScrollKey = useRef(scrollKey)
  useLayoutEffect(() => {
    const vp = vpRef.current
    if (!mobile || !vp) return
    const w = vp.clientWidth; if (!w) return
    const jump = lastScrollKey.current !== scrollKey
    lastScrollKey.current = scrollKey
    if (Math.floor(Math.round(vp.scrollLeft / (w / 3)) / 3) === s.curIdx && !jump) return
    if (jump || Math.abs(vp.scrollLeft - s.curIdx * w) > w * 3) vp.scrollTo({ left: s.curIdx * w, behavior: 'instant' as ScrollBehavior })
    else vp.scrollTo({ left: s.curIdx * w, behavior: 'smooth' })
  }, [mobile, s.curIdx, scrollKey, s.pageCount])
  const hero = isAi && s.searchQuery === null && !loading
  const noSprite = thumbs.noSprite
  const viewOpts = VIEW_MODES.map((m) => (m.v === 'sprite' && noSprite
    ? { ...m, disabled: true, disabledTitle: '피부는 아이템 보기를 지원하지 않아요' }
    : m))
  const runAi = (q?: string) => { const t = (q ?? s.aiQ).trim(); if (!t) return; if (q !== undefined) s.setAiQ(q); s.runSearch(t) }

  const pageChip = (
    <div className={mobile ? styles.pageChipM : styles.pageChip}>
      {!mobile && (
        <>
          <span title="이 부위·조건의 아이템 수" className={styles.count}>{`${list.length.toLocaleString()}개`}</span>
          <span className={styles.chipDiv} />
        </>
      )}
      <button type="button" onClick={() => s.step(-1)} title={mobile ? '이전 페이지' : '이전 페이지 (←)'} aria-label="이전 페이지" className={clsx('pb-arrow', styles.arrow, s.curIdx > 0 && styles.arrowOn)}><IconChevronLeft /></button>
      <input value={s.pageEditing ? s.pageInput : `${s.curIdx + 1}`} onFocus={s.onPageFocus} onChange={s.onPageChange} onKeyDown={s.onPageKey} onBlur={s.commitPage}
        inputMode="numeric" aria-label="현재 페이지" title={mobile ? undefined : '번호를 입력해 이동'} className={clsx('pb-input', 'pb-pageinput', styles.pageInput)} />
      <span className={mobile ? styles.slashM : styles.slash}>/</span>
      <span className={styles.total}>{s.pageCount}</span>
      <button type="button" onClick={() => s.step(1)} title={mobile ? '다음 페이지' : '다음 페이지 (→)'} aria-label="다음 페이지" className={clsx('pb-arrow', styles.arrow, s.curIdx < s.pageCount - 1 && styles.arrowOn)}><IconChevronRight /></button>
    </div>
  )
  const searchInput = isAi ? (
    <input value={s.aiQ} onChange={(e) => s.setAiQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') runAi() }} placeholder="생김새로 검색"
      className={clsx('pb-input', mobile ? styles.searchInputM : styles.searchInput)} />
  ) : (
    <input value={s.search} onChange={(e) => { s.setSearch(e.target.value); s.setIdx(0) }} placeholder="아이템 검색"
      className={clsx('pb-input', mobile ? styles.searchInputM : styles.searchInput)} />
  )

  const controls = mobile ? (
    <div className={styles.controlsM}>
      <div className={styles.rowM}>
        <Seg variant="mobileFlex" title="아이템을 무엇에 입혀서 볼지" opts={viewOpts} value={thumbs.mode} onPick={s.setListMode} />
        <Seg variant="mobileFit" title="성별" opts={GENDERS} value={s.genderFilter} onPick={s.setGenderFilter} />
      </div>
      <div className={styles.rowM}>
        {pageChip}
        <div className={styles.searchWrapM}>
          <IconSearch className={styles.searchIconM} />
          {searchInput}
        </div>
      </div>
    </div>
  ) : (
    <div className={styles.header}>
      <div className={styles.groupA}>
        <Seg title="아이템을 무엇에 입혀서 볼지" opts={viewOpts} value={thumbs.mode} onPick={s.setListMode} />
        <Seg title="성별" opts={GENDERS} value={s.genderFilter} onPick={s.setGenderFilter} />
      </div>
      <div className={clsx(styles.groupB, narrow && styles.groupBWrap)}>
        {pageChip}
        <div className={clsx(styles.searchWrap, narrow && styles.searchWrapNarrow)}>
          <IconSearch className={styles.searchIcon} />
          {searchInput}
        </div>
      </div>
    </div>
  )

  const per = s.itemsPerPage
  // 페이지 div 는 현재 ±1 만 만든다(전체 페이지 수만큼 만들면 검색어 입력마다 수천 개를 다시 그려 지연). 각 페이지는
  // 트랙 안 절대 위치(left = 인덱스×100%)라 translateX 이동·스냅은 그대로다.
  const pages: { pi: number; items: ListItem[] }[] = []
  for (let pi = Math.max(0, s.curIdx - 1); pi <= Math.min(s.pageCount - 1, s.curIdx + 1); pi++) pages.push({ pi, items: list.slice(pi * per, pi * per + per) })
  const gridStyle = mobile ? undefined : { gridTemplateColumns: `repeat(${s.cols},minmax(0,1fr))`, gridTemplateRows: `repeat(${s.rows},minmax(0,1fr))` }
  const skeletons = (
    <div className={mobile ? styles.loadWrapM : styles.loadWrap}>
      <div className={mobile ? styles.gridM : styles.grid} style={gridStyle}>
        {Array.from({ length: per }, (_, i) => <div key={i} className={clsx('pb-skel', styles.skel, mobile && styles.skelM)} />)}
      </div>
    </div>
  )

  const viewport = (
    <div ref={setVp} className={clsx(styles.viewport, mobile && 'pb-norail', mobile && styles.viewportM)}>
      {hero ? (
        <div className={mobile ? styles.heroM : styles.hero}>
          <span className={clsx(styles.heroTitle, mobile && styles.heroTitleM)}>코디 생김새로 검색</span>
          <div className={mobile ? styles.heroRowM : styles.heroRow}>
            <input value={s.aiQ} onChange={(e) => s.setAiQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') runAi() }} placeholder="예: 동물 귀 모자" aria-label="생김새 묘사"
              className={clsx('pb-input', styles.heroInput, mobile && styles.heroInputM)} />
            <button type="button" onClick={() => runAi()} className={clsx('pb-solid', styles.heroBtn, mobile && styles.heroBtnM)}>
              <IconSearchBold size={mobile ? 14 : 15} />찾기
            </button>
          </div>
          <div className={mobile ? clsx('pb-norail', styles.chipsM) : styles.chips}>
            {AI_EXAMPLES.slice(0, mobile ? 2 : narrow ? 3 : 4).map((q) => (
              <button key={q} type="button" onClick={() => runAi(q)} className={clsx('pb-soft', styles.chip)}>{q}</button>
            ))}
          </div>
          <span className={mobile ? styles.betaM : styles.beta}>아직 베타 기능이라 결과가 정확하지 않을 수 있어요!</span>
        </div>
      ) : loading ? skeletons : emptyTitle ? (
        <div className={mobile ? styles.emptyM : styles.empty}>
          <span className={mobile ? styles.emptyTitleM : styles.emptyTitle}>{emptyTitle}</span>
          <span className={mobile ? styles.emptyHintM : styles.emptyHint}>{emptyHint}</span>
        </div>
      ) : (
        // 트랙 위치·전환은 즉시 반영 값이라 인라인(스와이프 중엔 ShopContext 가 DOM 직접 갱신). 셀은 현재 페이지 ±1 만
        // 마운트하되, 스냅 애니메이션 중에는 새로 창에 들어온 페이지 마운트를 미뤄(캔버스 합성 부하) 전환이 끊기지 않게 한다.
        <div ref={mobile ? undefined : s.bindTrack} className={styles.track}
          style={mobile
            ? { width: `calc(${s.pageCount} * 100cqw)` } // 모바일: 스크롤 폭만 페이지 수만큼(페이지 DOM 은 ±1)
            : { transform: `translateX(${-s.curIdx * 100}%)`, transition: s.snapping ? 'transform .34s cubic-bezier(.22,.61,.36,1)' : 'none' }}>
          {pages.map(({ pi, items }) => (
            <div key={pi} className={clsx('pb-page', mobile && 'pb-scroll pb-norail', mobile ? styles.pageM : styles.page)} style={{ left: mobile ? `calc(${pi} * 100cqw)` : `${pi * 100}%` }}>
              {(!s.snapping || pi === s.curIdx || Math.abs(pi - s.snapFrom) <= 1) && (
                <div className={mobile ? styles.gridM : styles.grid} style={gridStyle}>
                  {items.map((it) => (
                    <ItemCard key={it.id} item={it} cat={catOf(it, isAi ? 'all' : s.activeCat)} mode={thumbs.effMode(it)} ctx={thumbs.ctxFor(it)} mobile={mobile} />
                  ))}
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
        {controls}
        <div className={styles.hrM} />
        {viewport}
      </>
    )
  }
  return (
    <section className={styles.panel}>
      {controls}
      <div className={styles.hr} />
      {viewport}
      <div className={clsx('pb-hintbar', styles.hintBar)}>
        <span className={styles.hintText}>스크롤 · 스와이프 · ← → 로 페이지를 넘겨요</span>
      </div>
    </section>
  )
}
