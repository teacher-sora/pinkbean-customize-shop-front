'use client'

// 코디 광장 목록 — 코디 탭과 같은 패널 골격(헤더 · 구분선 · 페이지 뷰포트 · 힌트 바)을 쓰되 데이터만 광장 글이다.
//  PC(절반·태블릿) : 정렬 드롭다운 + (페이지 칩 · 검색) 한 줄. 등록 폼은 오른쪽 컬럼에 상주한다(PlazaUpload).
//  모바일          : 정렬+검색 / 페이지 칩+등록 두 줄. 등록을 누르면 목록 자리에서 폼으로 바뀐다.
// 그리드 열·행은 ShopContext 한 곳에서만 계산한다(perPage 와 렌더 그리드가 어긋나면 페이지 수가 틀어진다).

import clsx from 'clsx'
import EmptyState from '../frame/EmptyState'
import SearchBox, { searchInputClass } from '../frame/SearchBox'
import PageChip from '../frame/PageChip'
import { useCallback, useRef } from 'react'
import { PLAZA_CONTEST, PLAZA_CONTEST_PERIOD, PLAZA_OPEN, plazaContestClosed, type PlazaSort } from '@/lib/plaza'
import { useShop } from '../ShopContext'
import Dropdown from '../ui/Dropdown'
import { CARD_FOOT_M, CARD_RATIO_M, DIRS, FilterM, useMobileRows, usePagerX, usePagerY, type FilterGroup } from '../list/ListArea'
import { PlazaTabsM, StickyBarM } from '../nav/BottomNav'
import { MOBILE_GRID } from '@/lib/shopData'
import { Seg, type SegOpt } from '../ui/controls'
import { IconClose, IconPlus } from '../ui/Icons'
import ClearField from '../ui/ClearField'
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
  useMobileRows(vpRef, mobile, MOBILE_GRID.cols, CARD_RATIO_M, MOBILE_GRID.rows, true, CARD_FOOT_M, 0, 10) // 10 = 목록 칸의 좌우 여백(list.viewportM 5 × 2) — 광장 칸에는 없어 그만큼 넓다

  // 모바일: 가로 스크롤 ↔ 페이지 인덱스 양방향 동기화(광장 뷰포트에도 따로 연결해야 인덱스가 멈추지 않는다).
  // 넘기는 방향은 목록과 같은 설정(ShopContext listDir — 사용자 지시: 광장에도). 세로면 PC 는 트랙이 위아래로, 모바일은 세로 스크롤 칸(한 쪽 = 한 화면 높이)
  const dirY = s.listDir === 'y'
  const scrollKey = `plaza|${s.plazaFilter}|${s.plazaQ}|${s.plazaSort}|${s.listDir}`
  usePagerX(vpRef, mobile && !dirY, s.curIdx, s.setIdx, s.pageCount, scrollKey, s.plazaCols, s.plazaRows, false)
  usePagerY(vpRef, mobile && dirY, s.curIdx, s.setIdx, s.pageCount, scrollKey, s.plazaRows)

  const pageChip = (
    <PageChip mobile={mobile} tight count={`${list.length}개`} countTitle="이 분류의 코디 수" cur={s.curIdx} pageCount={s.pageCount} onStep={s.step} prevTitle="이전 페이지" nextTitle="다음 페이지" />
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
    <ClearField onClear={() => s.setPlazaQ('')}>
      <input value={s.plazaQ} onChange={(e) => s.setPlazaQ(e.target.value)} placeholder="이름, 태그 검색"
        aria-label="코디 검색" className={searchInputClass(mobile)} />
    </ClearField>
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
    <div ref={setVp} data-pb-list={dirY ? 'y' : 'x'} className={clsx(styles.viewport, dirY && styles.viewportY, mobile && 'pb-norail', mobile && (dirY ? styles.viewportMY : styles.viewportM))}>
      {s.plazaLoading ? (
        <div className={mobile ? styles.pageM : styles.page} style={{ left: 0 }}>
          <div className={styles.grid} style={gridStyle}>
            {Array.from({ length: per }, (_, i) => <div key={i} className={clsx('pb-skel', styles.skel)} />)}
          </div>
        </div>
      ) : !s.plazaReady ? (
        <EmptyState size={mobile ? 'plazaM' : 'plaza'} title="광장을 준비하고 있어요" hint="잠시 뒤에 다시 들러주세요." />
      ) : empty ? (
        <EmptyState size={mobile ? 'plazaM' : 'plaza'} title={emptyTitle} hint={emptyHint} />
      ) : (
        <div ref={mobile ? undefined : s.bindTrack} data-pb-pages className={styles.track}
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
          <SearchBox mobile plaza>{search}</SearchBox>
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
          <SearchBox mobile={false} plaza>{search}</SearchBox>
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
