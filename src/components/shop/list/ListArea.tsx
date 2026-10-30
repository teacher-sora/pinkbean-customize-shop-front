'use client'

// 코디 · AI 코디 검색 리스트 영역. 두 탭은 같은 헤더/페이지 구조를 공유하고 데이터만 다르다.
//  PC(절반·태블릿 포함) = 패널(section) + 헤더 + 뷰포트 + 힌트 바 / 모바일 = 컨트롤 2줄 + 뷰포트.

import clsx from 'clsx'
import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { ListItem } from '@/lib/core/data'
import { ITEM_KINDS, MOBILE_GRID } from '@/lib/shopData'
import { useShop, type GenderFilter, type ListMode, type ListDir } from '../ShopContext'
import { Seg, type SegOpt } from '../ui/controls'
import { IconCaretDown, IconChevronLeft, IconChevronRight, IconSearch, IconDirX, IconDirY } from '../ui/Icons'
import { CatTabsM, StickyBarM } from '../nav/BottomNav'
import ItemCard, { catOf } from './ItemCard'
import { useCodiThumbs, useSearchThumbs, type ThumbApi } from './thumbCtx'
import styles from './list.module.css'
import { heroBaseProbe, lvhProbe, RELAYOUT_EVENT } from '@/lib/heroView'

const VIEW_MODES: SegOpt<ListMode>[] = [
  { v: 'sprite', l: '아이템', t: '아이템 그림만 보기' },
  { v: 'model', l: '마네킹', t: '마네킹에 입힌 모습' },
  { v: 'mymodel', l: '내 캐릭터', t: '내 캐릭터에 입힌 모습' },
]
export const GENDERS: SegOpt<GenderFilter>[] = [
  { v: 'all', l: '전체', t: '모든 아이템' },
  { v: 'f', l: '여', t: '여자 캐릭터가 입을 수 있는 것' },
  { v: 'm', l: '남', t: '남자 캐릭터가 입을 수 있는 것' },
]
// 넘기는 방향 — 기본 가로. 세로여도 PC · 절반 · 태블릿은 한 쪽씩 넘기고, 모바일은 목록 안에서 세로로 스크롤한다(넘기는 방향만 바뀐다).
export const DIRS: SegOpt<ListDir>[] = [
  { v: 'x', l: '가로로 넘기기', t: '가로로 넘겨 보기', icon: <IconDirX /> },
  { v: 'y', l: '세로로 넘기기', t: '세로로 넘겨 보기', icon: <IconDirY /> },
]
// 보이는 순서대로 적는다. keep = 자리가 좁아 줄일 때 남기는 순서(작을수록 끝까지 남는다) — 모바일은 둘, 좁은 화면은 셋만 보인다
const AI_EXAMPLES = [{ q: '동물 귀', keep: 2 }, { q: '한벌옷 스타킹', keep: 0 }, { q: '귀여운 얼굴', keep: 3 }, { q: '단발 헤어', keep: 1 }]

// 모바일 뷰포트의 스크롤 위치 → 쪽 번호(쪽 = MOBILE_GRID 열 × 줄). 가로는 열 = 폭/열 수, 세로는 줄 = 높이/줄 수 단위로 반올림한 뒤 쪽으로. 크기가 없으면 -1.
const scrollIdx = (vp: HTMLElement, y: boolean) => {
  const w = y ? vp.clientHeight : vp.clientWidth; if (!w) return -1
  const n = y ? MOBILE_GRID.rows : MOBILE_GRID.cols
  return Math.floor(Math.round((y ? vp.scrollTop : vp.scrollLeft) / (w / n)) / n)
}

// 한번 정해 두고 쓰는 보기 값들(목록 = 보기 · 성별 · 방향 · 필터 — 어느 폭이든, 코디 룩북 · 광장 = 모바일 · 절반 · 태블릿)을 버튼 하나에 접어 둔다.
// 누르면 버튼 아래에 묶음들이 펼쳐진다. 왜: 늘 펼쳐 두느라 목록 머리가 두 줄이었다(쪽 번호 · 검색은 매번 쓰는 것이라 그대로 내놓는다).
// 버튼에는 무엇을 정하는 곳인지 적는다('연출 설정'처럼 — 지금 값만 적으면 무엇을 하는 버튼인지 알 수 없다는 지적). 펼친 칸은 바깥을 누르거나 Esc 로 닫는다 — 값을 골라도 닫지 않는다(이어서 고를 수 있게).
// 같은 부품을 코디 룩북 머리도 쓴다(combo/ComboPanel — 사용자 지시: 같은 역할은 부품 하나)
// 묶음 = 하나 고르기(Seg). set = 거르는 중(목록 '필터'를 전체가 아닌 것으로 골랐다) — 버튼도 켜진 모양이라 닫혀 있어도 거르는 중인 걸 안다
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type FilterGroup = { label: string; title: string; opts: SegOpt<any>[]; value: string; onPick: (v: any) => void; set?: boolean }
export function FilterM({ groups, mobile, guide }: { mobile: boolean; groups: FilterGroup[]; guide?: string }) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement | null>(null)
  // 바깥을 누르면 닫기만 한다 — 그 누름이 아래 카드로 넘어가 아이템이 입혀지면 안 된다. 화면 전체 덮개를 두었더니 그보다 위에 붙은 헤더 · 미리보기를 누를 때는
  // 닫히지 않아(모바일 — 헤더 · 미리보기가 머리 묶음보다 위에 붙는다) 문서 전체의 누름을 먼저 받아 가로챈다
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopImmediatePropagation(); setOpen(false) } }
    const onClick = (e: MouseEvent) => { if (root.current?.contains(e.target as Node)) return; e.preventDefault(); e.stopPropagation(); setOpen(false) }
    window.addEventListener('keydown', onKey, true)
    window.addEventListener('click', onClick, true)
    return () => { window.removeEventListener('keydown', onKey, true); window.removeEventListener('click', onClick, true) }
  }, [open])
  const now = groups.map((g) => g.opts.find((o) => o.v === g.value)?.l ?? '').join(', ')
  const set = groups.some((g) => g.set)
  return (
    <div ref={root} className={styles.filterM}>
      <button type="button" data-guide={guide} onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label={`보기 설정: ${now}`} className={clsx('pb-ddbtn', styles.filterBtnM, !mobile && styles.filterBtnPc, (open || set) && styles.filterBtnOn, set && styles.filterBtnSet)}>
        <span className={styles.filterText}>보기 설정</span>
        <IconCaretDown className={clsx(styles.filterCaret, open && styles.filterCaretOn)} />
      </button>
      {/* 늘 붙여 두고 보임만 바꾼다 — 닫힐 때도 전환이 보이게 */}
      <div role="group" aria-label={groups.map((g) => g.label).join(' · ')} aria-hidden={!open} className={clsx(styles.filterPop, open && styles.filterPopOn)}>
        {groups.map((g) => (
          <Fragment key={g.label}>
            <span className={styles.filterLabel}>{g.label}</span>
            <Seg variant="mobileFlex" title={g.title} opts={g.opts} value={g.value} onPick={g.onPick} />
          </Fragment>
        ))}
      </div>
    </div>
  )
}

// 모바일 목록 칸의 높이(--pb-min-h — 페이지 컬럼 높이). 목록은 칸 안에서 세로로 스크롤하지 않고 페이지 스크롤로 내려 본다.
//  · 맞춤: 페이지를 끝까지 내리면 붙은 미리보기(히어로 sticky) 바로 아래부터 화면 끝까지가 목록 칸이다 = 큰 화면 높이(100lvh — 툴바가 접힌,
//    내려 볼 때의 높이. 접히지 않는 브라우저는 작은 높이와 같다) − 미리보기(기본 보기 높이) − 목록 칸 아래(하단 탭 자리는 빼고 잰다). 붙은 머리 묶음은 내리는 동안 숨어 빼지 않는다(StickyBarM).
//    그래서 탭 자리 바로 위까지 내리면 미리보기를 보면서 3줄이 모두 보이고(사용자 지시), 더 내려 탭 자리에 닿으면 탭이 나온다(BottomNav useHideOnScroll).
//    부위 · 보기 설정 줄은 붙이지 않는다 — 부위를 바꿀 때는 목록에서 눈을 떼므로 살짝 올려 고르면 된다(사용자와 정한 흐름).
//  · 바닥: 화면이 낮아(작은 폰 · 미리보기 크게) 맞춤 칸이 너무 작으면 카드 그림 칸 ≥ 폭 × ratio + 카드 아래(이름 줄 · [북마크 · 염색] 막대 · 여백) foot 로
//    받친다. 그때는 3줄이 한 화면에 다 들지 않고 페이지가 더 길어진다.
//  그 외 요소 높이(chrome)는 컬럼 − 뷰포트로 실측 → 컬럼이 늘어도 chrome 은 그대로라 값이 수렴한다.
// ⚠️ 목록은 언마운트(염색 · 프리셋 탭 이동) 때 값을 지우지 않는다 — 지우면 페이지가 100vh 로 줄어 스크롤 위치가 끌려 올라가고
//    하단 공백이 남았다. 마지막 계산값을 유지해 탭을 오가도 페이지 높이가 그대로다. restore 면(코디 룩북 — 목록보다 길 수 있다) 떠날 때 붙기 전 값으로 되돌린다.
// 0.6 = 맞춤 칸의 바닥. 툴바가 접히지 않는 앱 안 브라우저(390 × 664)에서도 3줄이 든다(그림 칸 76px)
export const CARD_RATIO_M = 0.6
export const CARD_FOOT_M = 61 // 카드 아래 = 이름 줄 + [북마크 · 염색] 막대 28 + 여백(코디 룩북 · 광장 카드의 바닥도 이 값)
// 맞춤에 쓰는 미리보기 높이 = 기본 보기의 높이(heroBaseProbe — 13 Pro 216 기준으로 화면에 맞춘다). '크게'로 바꿔도 카드는 그대로이고 보이는 줄만 준다 —
// 실제 높이로 맞추면 카드가 86px 까지 눌려 캐릭터가 아주 작았다
export const LIST_COL_GAP_M = 6 // 목록 격자의 열 간격(list.module.css .gridM 과 같은 값 — 카드 폭을 조금 넓힌다)
// 목록의 높이 — 코디 탭 · AI 코디 검색 목록 · 프리셋
export const useListMinHeight = (vpRef: React.RefObject<HTMLDivElement | null>, mobile: boolean) => useMobileRows(vpRef, mobile, MOBILE_GRID.cols, CARD_RATIO_M, MOBILE_GRID.rows, false, CARD_FOOT_M, 0, 0, LIST_COL_GAP_M)
// extra = 바닥 계산에서 목록 칸 밖에 더 잡아 둘 높이, inset = 카드 폭을 잴 때 칸 폭에서 더 뺄 값(코디 광장 — 광장 목록 칸은 좌우 여백 7 이 없어 그만큼 넓다)
export function useMobileRows(vpRef: React.RefObject<HTMLDivElement | null>, mobile: boolean, cols: number, ratio: number, rows = 2, restore = false, foot = 0, extra = 0, inset = 0, colGap = 10) {
  useEffect(() => {
    if (!mobile) return
    const vp0 = vpRef.current
    const col = vp0?.closest('[data-mobile-col]') as HTMLElement | null
    if (!vp0 || !col) return
    const before = col.style.getPropertyValue('--pb-min-h')
    const hero = col.querySelector<HTMLElement>('[data-hero]')
    const lvh = lvhProbe(), base = heroBaseProbe()
    const PAD_X = 10, PAD_Y = 16, GAP = 10 // 페이지 패딩 좌우 5px(열 간격과 페이지 경계 간격을 맞춤)
    const m = () => {
      const vp = vpRef.current?.isConnected ? vpRef.current : vp0 // 넘기는 방향을 바꾸면 칸이 새로 붙을 수 있다 — 지금 칸을 잰다
      // 칸 밖 높이 = 틀 위 끝에서 칸 위 끝까지 + 칸 뒤에 붙은 요소들(룩북 출처 줄). 하단 탭은 떠 있어 세지 않는다.
      // 틀 높이에서 칸 높이를 빼 재면 앞 탭이 남긴 틀 높이의 빈자리까지 들어가 그대로 남았다(코디 정보에서 페이지가 172px 내려갔다)
      let below = 0
      for (let el = vp.nextElementSibling; el; el = el.nextElementSibling) if (el instanceof HTMLElement && el.getClientRects().length && !el.matches('nav[data-hero-below]')) below += el.offsetHeight
      const chrome = vp.getBoundingClientRect().top - col.getBoundingClientRect().top + below
      const cardW = (vp.clientWidth - inset - PAD_X - colGap * (cols - 1)) / cols
      const floor = extra + PAD_Y + GAP * (rows - 1) + rows * (cardW * ratio + foot)
      // 맞춤: 페이지를 헤더 높이만큼 내리면 미리보기가 화면 맨 위에 오고, 미리보기 + 머리 묶음 바로 아래부터 화면 끝까지가 목록 칸이다(큰 화면 높이 100lvh — 툴바가 접힌).
      // 미리보기와 칸 사이에 놓이는 것(머리 묶음 · 룩북의 자주 쓴 염색 줄)과 칸 아래의 것(출처 줄)도 뺀다. 하단 탭은 떠 있어 빼지 않는다(내리는 동안 숨는다).
      // 맞춤이 있으면 바닥(floor — 그림 칸 비율)보다 맞춤이 먼저다: 어느 기기든 페이지는 맨 위 헤더 높이만큼만 내려간다(사용자 지시). 낮은 화면은 카드가 그만큼 낮아진다
      let fit = 0
      if (hero && document.documentElement.getAttribute('data-pb-view') !== 'full') {
        // 칸 아래 것(below)은 칸 뒤에 붙은 요소들의 높이다 — 틀 끝까지의 거리로 재면 앞 탭이 남긴 빈자리까지 빠져 칸이 짧아졌다(코디 정보 126px)
        fit = lvh.offsetHeight - base.offsetHeight - (vp.getBoundingClientRect().top - hero.getBoundingClientRect().bottom) - below
      }
      const h = fit > 0 ? Math.floor(fit) : Math.ceil(floor) // 맞춤은 내림 — 올리면 소수점 몫만큼 페이지가 헤더보다 1px 더 내려갔다
      const need = Math.floor(chrome + h) + 'px' // 내림 — 칸 위 높이(미리보기)의 소수점 몫까지 올리면 1px 더 내려갔다
      if (col.style.getPropertyValue('--pb-min-h') !== need) col.style.setProperty('--pb-min-h', need)
      const page = h + 'px' // 한 쪽 높이 — 세로 넘기기에서 목록 칸 안에 쪽을 쌓을 때(usePagerY)
      if (col.style.getPropertyValue('--pb-page-h') !== page) col.style.setProperty('--pb-page-h', page)
    }
    m()
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(m) : null
    ro?.observe(col); ro?.observe(vp0); ro?.observe(lvh); ro?.observe(base)
    // 칸 위아래에 함께 놓이는 것(머리 묶음 · 룩북 염색 줄 · 출처 줄)이 붙고 빠지거나 크기가 바뀌면 다시 잰다 — 칸 크기는 그대로라 위 감시가 모른다
    const sibs = () => { for (const el of vp0.parentElement?.children ?? []) if (el !== vp0) ro?.observe(el) }
    sibs()
    const mo = vp0.parentElement ? new MutationObserver(() => { sibs(); m() }) : null
    if (mo && vp0.parentElement) mo.observe(vp0.parentElement, { childList: true })
    window.addEventListener(RELAYOUT_EVENT, m) // 보기를 바꿔 칸이 자리만 옮겨 갔을 때 — 틀 높이가 그대로라 ResizeObserver 가 모른다
    return () => { ro?.disconnect(); mo?.disconnect(); window.removeEventListener(RELAYOUT_EVENT, m); if (restore) { if (before) col.style.setProperty('--pb-min-h', before); else col.style.removeProperty('--pb-min-h') } }
  }, [vpRef, mobile, cols, ratio, rows, restore, foot, extra, inset, colGap])
}

// 모바일 세로 넘기기: 목록 칸 안 스크롤(사용자 지시 — 페이지 하나로 합쳤더니 목록을 스크롤할 수 없었고 페이지가 쪽 수만큼 길어졌다). 쪽은 한 쪽 높이(--pb-page-h,
// useMobileRows — 칸 높이와 같다)로 쌓인다. 칸 끝에 닿으면 페이지가 이어서 스크롤한다.
// 스크롤 위치 ↔ 쪽 번호: 쪽 i 의 자리 = 그 쪽 위 끝이 칸 위 끝에 오는 스크롤. 줄 단위로 반올림해 센다(가로와 같다)
export function usePagerY(vpRef: React.RefObject<HTMLDivElement | null>, on: boolean, idx: number, setIdx: (i: number, anim?: boolean) => void, pageCount: number, key: string, rows: number = MOBILE_GRID.rows) {
  const live = useRef({ idx, setIdx, pageCount, rows })
  live.current = { idx, setIdx, pageCount, rows }
  const geo = useCallback(() => {
    const vp = vpRef.current, tr = vp?.querySelector<HTMLElement>('[data-pb-pages]')
    if (!vp || !tr) return null
    const ph = parseFloat(getComputedStyle(vp).getPropertyValue('--pb-page-h'))
    if (!ph) return null
    return { vp, off: tr.offsetTop, ph } // off = 쪽들 위의 것(룩북의 자주 쓴 염색 줄)
  }, [vpRef])
  const at = (g: { vp: HTMLElement; off: number; ph: number }) => {
    const { pageCount: n, rows: r } = live.current
    return Math.max(0, Math.min(n - 1, Math.floor(Math.round((g.vp.scrollTop - g.off) / (g.ph / r)) / r)))
  }
  useEffect(() => {
    const vp = vpRef.current
    if (!on || !vp) return
    let raf = 0
    const f = () => { raf = 0; const g = geo(); if (!g) return; const i = at(g); if (i !== live.current.idx) live.current.setIdx(i, false) }
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(f) }
    vp.addEventListener('scroll', onScroll, { passive: true })
    return () => { vp.removeEventListener('scroll', onScroll); if (raf) cancelAnimationFrame(raf) }
  }, [on, geo, vpRef])
  // 쪽 번호가 스크롤 밖에서 바뀌면(번호 입력 · 부위 · 검색을 바꿔 첫 쪽으로) 그 쪽 자리로 옮긴다. 멀거나 목록이 바뀌었으면 바로, 가까우면 부드럽게
  const lastKey = useRef(key)
  useLayoutEffect(() => {
    if (!on) return
    const jump = lastKey.current !== key
    lastKey.current = key
    const g = geo(); if (!g) return
    if (at(g) === idx && !(jump && idx === 0)) return
    const to = idx === 0 ? 0 : g.off + idx * g.ph
    g.vp.scrollTo({ top: to, behavior: jump || Math.abs(g.vp.scrollTop - to) > g.ph * 3 ? ('instant' as ScrollBehavior) : 'smooth' })
  }, [on, idx, key, pageCount, geo])
}

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
  const narrow = s.listNarrow
  const vpRef = useRef<HTMLDivElement | null>(null)
  const bindVp = s.bindVp
  const setVp = useCallback((el: HTMLDivElement | null) => { vpRef.current = el; bindVp(el) }, [bindVp])
  useListMinHeight(vpRef, mobile) // 모바일: 붙은 미리보기 아래에 3줄이 다 들어가는 높이(위 주석)
  // ── 모바일: 네이티브 자유 스크롤(스냅 없음, 스크롤바 숨김) ↔ 페이지 인덱스 동기화. 가로면 가로, 세로면 세로(쪽 = MOBILE_GRID 열 × 줄) ──
  //  세로: 쪽 높이 = 뷰포트 높이(100cqh), 줄 = 높이/2 — 스크롤 → 인덱스는 줄 = round(스크롤/(높이/2)), 쪽 = floor(줄/2).
  //  페이지 좌우 패딩 5px + 뷰포트 좌우 7px 들임 → 열 간격 = 페이지 경계 간격 = 10px 이라 열 위치가 정확히 폭/열 수의 배수.
  //  스크롤 → 인덱스: 열 = round(스크롤/(폭/열 수)), 페이지 = floor(열/열 수).
  //  인덱스 → 스크롤: 화살표·페이지 입력 등으로 인덱스가 바뀌어 스크롤 위치와 어긋날 때만 이동(같으면 아무것도 안 함 →
  //  사용자 스크롤·프로그램 스크롤이 서로 싸우지 않는다). 부위·탭이 바뀌면 애니메이션 없이 즉시.
  //  가상화 유지: 트랙 폭만 페이지 수만큼 잡고, 페이지 DOM 은 현재 ±1 만 만든다(아래 pages).
  const dirY = s.listDir === 'y'
  const live = useRef({ idx: s.curIdx, setIdx: s.setIdx })
  live.current = { idx: s.curIdx, setIdx: s.setIdx }
  useEffect(() => {
    const vp = vpRef.current
    if (!mobile || !vp || dirY) return // 세로는 usePagerY
    let raf = 0
    const onScroll = () => {
      if (raf) return
      raf = requestAnimationFrame(() => {
        raf = 0
        const i = scrollIdx(vp, dirY); if (i < 0) return
        if (i !== live.current.idx) live.current.setIdx(i, false)
      })
    }
    vp.addEventListener('scroll', onScroll, { passive: true })
    return () => { vp.removeEventListener('scroll', onScroll); cancelAnimationFrame(raf) }
  }, [mobile, dirY])
  const scrollKey = `${s.primary}|${s.activeCat}|${isAi ? s.searchQuery : ''}|${s.listDir}`
  const lastScrollKey = useRef(scrollKey)
  const scrolledOnce = useRef(false)
  useLayoutEffect(() => {
    const vp = vpRef.current
    if (!mobile || !vp || dirY) return
    const w = dirY ? vp.clientHeight : vp.clientWidth; if (!w) return
    // 첫 마운트(예: 태블릿 → 모바일 폭 전환)도 즉시 이동 — 보던 위치가 스크롤 애니메이션 없이 유지돼 보이게. 방향을 바꿔도 즉시.
    const jump = lastScrollKey.current !== scrollKey || !scrolledOnce.current
    lastScrollKey.current = scrollKey
    scrolledOnce.current = true
    if (scrollIdx(vp, dirY) === s.curIdx && !jump) return
    const target = s.curIdx * w
    const smooth = !(jump || Math.abs((dirY ? vp.scrollTop : vp.scrollLeft) - target) > w * 3)
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
  usePagerY(vpRef, mobile && dirY, s.curIdx, s.setIdx, s.pageCount, scrollKey)
  const hero = isAi && s.searchQuery === null && !loading
  const noSprite = thumbs.noSprite
  const viewOpts = VIEW_MODES.map((m) => (m.v === 'sprite' && noSprite
    ? { ...m, disabled: true, disabledTitle: '피부는 아이템 보기를 지원하지 않아요' }
    : m))
  const filterGroups: FilterGroup[] = [
    { label: '보기', title: '아이템을 무엇에 입혀서 볼지', opts: viewOpts, value: thumbs.mode, onPick: s.setListMode },
    { label: '성별', title: '성별', opts: GENDERS, value: s.genderFilter, onPick: s.setGenderFilter },
    { label: '방향', title: '넘기는 방향', opts: DIRS, value: s.listDir, onPick: s.setListDir },
    { label: '필터', title: '아이템 거르기', opts: ITEM_KINDS, value: s.kindFilter, onPick: s.setKindFilter, set: s.kindFilter !== 'all' },
  ]
  const runAi = (q?: string) => { const t = (q ?? s.aiQ).trim(); if (!t) return; if (q !== undefined) s.setAiQ(q); s.runSearch(t) }

  const pageChip = (
    <div className={mobile ? styles.pageChipM : clsx(styles.pageChip, narrow && styles.pageChipNarrow)}>
      {!mobile && !narrow && (
        <>
          <span title="이 부위, 조건의 아이템 수" className={styles.count}>{`${list.length.toLocaleString()}개`}</span>
          <span className={styles.chipDiv} />
        </>
      )}
      {/* 모바일에는 화살표를 두지 않는다 — 쪽은 목록을 옆으로 밀어 넘기고, 멀리 갈 때는 번호를 적는다 */}
      {!mobile && <button type="button" onClick={() => s.step(-1)} disabled={s.curIdx <= 0} title="이전 페이지 (←)" aria-label="이전 페이지" className={clsx('pb-arrow', styles.arrow, s.curIdx > 0 && styles.arrowOn)}><IconChevronLeft /></button>}
      <input value={s.pageEditing ? s.pageInput : `${s.curIdx + 1}`} onFocus={s.onPageFocus} onChange={s.onPageChange} onKeyDown={s.onPageKey} onBlur={s.commitPage}
        inputMode="numeric" aria-label="현재 페이지" title={mobile ? undefined : '번호를 입력해 이동'} className={clsx('pb-input', 'pb-pageinput', styles.pageInput)} />
      <span className={mobile ? styles.slashM : styles.slash}>/</span>
      <span className={styles.total}>{s.pageCount}</span>
      {!mobile && <button type="button" onClick={() => s.step(1)} disabled={s.curIdx >= s.pageCount - 1} title="다음 페이지 (→)" aria-label="다음 페이지" className={clsx('pb-arrow', styles.arrow, s.curIdx < s.pageCount - 1 && styles.arrowOn)}><IconChevronRight /></button>}
    </div>
  )
  const searchInput = isAi ? (
    <input data-guide="ai" value={s.aiQ} onChange={(e) => s.setAiQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') runAi() }} placeholder="생김새 검색"
      className={clsx('pb-input', mobile ? styles.searchInputM : styles.searchInput)} />
  ) : (
    <input value={s.search} onChange={(e) => s.setSearch(e.target.value)} placeholder="아이템 검색"
      className={clsx('pb-input', mobile ? styles.searchInputM : styles.searchInput)} />
  )

  const controls = mobile ? (
    // 한 줄: 보기와 성별(접어 둔 버튼) · 쪽 번호 · 검색. 높이는 프리셋 · 코디 정보의 머리와 같다(48)
    <div className={styles.controlsM}>
      <FilterM mobile guide="listdir" groups={filterGroups} />
      {pageChip}
      <div className={styles.searchWrapM}>
        <IconSearch className={styles.searchIconM} />
        {searchInput}
      </div>
    </div>
  ) : (
    <div className={styles.header}>
      {/* 보기 · 성별 · 방향 · 필터는 어느 폭이든 '보기 설정' 하나에 접어 둔다(사용자 지시) */}
      <FilterM mobile={false} guide="listdir" groups={filterGroups} />
      <div className={styles.groupB}>
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
  // 트랙 안 절대 위치(가로 left · 세로 top = 인덱스×100%)라 translateX · translateY 이동 · 스냅은 그대로다.
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
    <div ref={setVp} className={clsx(styles.viewport, dirY && styles.viewportY, mobile && 'pb-norail', mobile && (dirY ? styles.viewportMY : styles.viewportM))}>
      {hero ? (
        <div className={mobile ? styles.heroM : styles.hero}>
          <span className={clsx(styles.heroTitle, mobile && styles.heroTitleM)}>코디 생김새로 검색</span>
          <div className={mobile ? styles.heroRowM : styles.heroRow}>
            <input data-guide="ai" value={s.aiQ} onChange={(e) => s.setAiQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') runAi() }} placeholder="예: 동물 귀 모자" aria-label="생김새 묘사"
              className={clsx('pb-input', styles.heroInput, mobile && styles.heroInputM)} />
            <button type="button" onClick={() => runAi()} className={clsx('pb-solid', styles.heroBtn, mobile && styles.heroBtnM)}>
              <IconSearch size={mobile ? 14 : 15} bold />찾기
            </button>
          </div>
          <div className={mobile ? clsx('pb-norail', 'pb-fade', styles.chipsM) : styles.chips}>
            {AI_EXAMPLES.filter((e) => e.keep < (mobile ? 2 : narrow ? 3 : 4)).map(({ q }) => (
              <button key={q} type="button" onClick={() => runAi(q)} className={clsx('pb-soft', styles.chip)}>{q}</button>
            ))}
          </div>
          <span className={mobile ? styles.betaM : styles.beta}>원하는 코디 생김새를 적어보아요</span>
        </div>
      ) : loading ? skeletons : emptyTitle ? (
        <div className={mobile ? styles.emptyM : styles.empty}>
          <span className={mobile ? styles.emptyTitleM : styles.emptyTitle}>{emptyTitle}</span>
          <span className={mobile ? styles.emptyHintM : styles.emptyHint}>{emptyHint}</span>
        </div>
      ) : (
        // 트랙 위치·전환은 즉시 반영 값이라 인라인(스와이프 중엔 ShopContext 가 DOM 직접 갱신). 셀은 현재 페이지 ±1 만
        // 마운트하되, 스냅 애니메이션 중에는 새로 창에 들어온 페이지 마운트를 미뤄(캔버스 합성 부하) 전환이 끊기지 않게 한다.
        <div ref={mobile ? undefined : s.bindTrack} data-pb-pages className={styles.track}
          style={mobile
            ? (dirY ? { height: `calc(${s.pageCount} * var(--pb-page-h))` } : { width: `calc(${s.pageCount} * 100cqw)` }) // 모바일: 길이만 페이지 수만큼(페이지 DOM 은 ±1)
            : { transform: `${dirY ? 'translateY' : 'translateX'}(${-s.curIdx * 100}%)`, transition: s.snapping ? 'transform .34s cubic-bezier(.22,.61,.36,1)' : 'none' }}>
          {pages.map(({ pi, items }) => (
            <div key={pi} className={clsx('pb-page', mobile && 'pb-scroll pb-norail', mobile ? (dirY ? styles.pageMY : styles.pageM) : styles.page)}
              style={dirY ? { top: mobile ? `calc(${pi} * var(--pb-page-h))` : `${pi * 100}%` } : { left: mobile ? `calc(${pi} * 100cqw)` : `${pi * 100}%` }}>
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
        <StickyBarM><CatTabsM />{controls}<div className={styles.hrM} /></StickyBarM>
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
        <span className={styles.hintText}>{dirY ? '스크롤, 스와이프, ↑ ↓ 로 페이지를 넘겨요' : '스크롤, 스와이프, ← → 로 페이지를 넘겨요'}</span>
      </div>
    </section>
  )
}
