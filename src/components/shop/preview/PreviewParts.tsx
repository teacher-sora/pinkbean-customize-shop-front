'use client'

// 미리보기 영역 부품: 북마크 스프라이트 · 북마크 박스(PC) · 북마크 시트 본문(모바일) · 연출 설정 시트 본문(모바일).

import clsx from 'clsx'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { CONFIRM_ATTR, confirmTwice } from '@/lib/confirmTwice'
import type { ListItem } from '@/lib/core/data'
import { takePvIntent } from '@/lib/guide'
import { SLOT_TO_CAT } from '@/lib/shopData'
import { CMP_MIN, useShop } from '../ShopContext'
import { Seg, type SegOpt } from '../ui/controls'
import { IconTrashSolid } from '../ui/Icons'
import { useCmpLeave } from './PreviewStage'
import { DyeSprite } from '../render/DyeSprite'
import { glideTo, place, release } from '../surface/glide'
import { useInnerSlide, SWAP_MS } from '../surface/innerSlide'
import { SHEET_EASE, SHEET_MS } from '../surface/sheetMotion'
import { SurfaceFooter } from '../surface/Surface'
import { PvGroups, PvInlineFields, pvFieldOf, pvGroupsOf, usePvFields, type PvGroup } from './pvControls'
import { PvGrid, type PvField } from './PvPicker'
import { ActionFrameGrid, actionInfo, useActionInfo, warmActionFrames } from './ActionFrames'
import { PV_ACTIONS_FLAT } from '@/lib/catalog'
import preset from '../preset/preset.module.css'
import styles from './preview.module.css'

const BOOKMARK_FRAC = 0.9

// 북마크 썸네일: 아이템 스프라이트(헤어·성형은 염색표처럼 몸 없이 모든 파츠 합성, 무염색).
export function BookmarkSprite({ item }: { item: ListItem }) {
  const s = useShop()
  const zmap = s.index?.zmap || []
  // 북마크 칸은 작아서 채움 비율을 조금 더 높인다(캔버스 대비 아이콘이 작게 보이지 않게).
  if (item.slot === 'hair' || item.slot === 'face') return <DyeSprite id={item.id} mix zmap={zmap} frac={BOOKMARK_FRAC} />
  if (item.slot === 'skin') return <DyeSprite id={item.id} thumb={`sprites/${item.id}/thumb.png`} mix={false} zmap={zmap} frac={BOOKMARK_FRAC} />
  return <DyeSprite id={item.id} thumb={item.icon || `sprites/${item.id}/icon.png`} mix={false} zmap={zmap} frac={BOOKMARK_FRAC} />
}

const wornOf = (s: ReturnType<typeof useShop>, it: ListItem) => s.isEquippedInCat(SLOT_TO_CAT[it.slot], it.id)

// 북마크 [비우기] — 두 번 눌러야 비운다(lib/confirmTwice — 누른 단추 위에 되묻는 말풍선, 사용자 지시). PC · 모바일 같은 단추
function ClearBookmarks({ n }: { n: number }) {
  const s = useShop()
  return (
    <button type="button" onClick={() => { if (confirmTwice('bm:clear', '한 번 더 누르면 북마크를 비워요')) s.clearBookmarks() }} disabled={n === 0} {...{ [CONFIRM_ATTR]: 'bm:clear' }}
      title={n ? '북마크 전체 비우기' : '비울 북마크가 없어요'} className={clsx('pb-ghost', styles.clear, n > 0 && styles.clearOn)}>비우기</button>
  )
}

function PinCount({ n }: { n: number }) {
  return <span className={clsx(styles.count, n > 0 && styles.countOn)}>{n}</span>
}

// 비교 칸 빼기 — 프리셋 카드와 같은 휴지통 띠지(사용자 지시 — 같은 부품: preset.module.css 의 .del · hover 는 pb-presetacts). 칸마다 오른쪽 위.
// 두 칸뿐이면 빼지 않고 초기화한다(남은 칸의 코디로 — ShopContext removeCmp), 두 번 눌러야 한다(lib/confirmTwice)
export function CmpDel({ id, slim }: { id: string; slim?: boolean }) {
  const s = useShop()
  const reset = s.cmpIds.length <= CMP_MIN
  const label = reset ? '이 칸 초기화' : '이 칸 빼기'
  return (
    <button type="button" title={reset ? '이 칸을 옆 칸과 같은 코디로 초기화' : label} aria-label={label} {...{ [CONFIRM_ATTR]: `cmp:x:${id}` }}
      onClick={(e) => { e.stopPropagation(); if (confirmTwice(`cmp:x:${id}`, reset ? '한 번 더 누르면 이 칸을 초기화해요' : '한 번 더 누르면 이 칸을 빼요')) s.removeCmp(id) }}
      className={clsx('pb-presetacts', preset.del, slim && preset.delM, styles.cmpDel)}><IconTrashSolid size={11} /></button>
  )
}

// PC: 미리보기 아래 칸 — 북마크 8칸 + 머리 줄 오른쪽의 탭 [북마크] [비교](사용자 지시: 모드처럼 — 열 폭이 바뀌어도 늘 같은 자리라 오른쪽, [비우기]는 왼쪽).
// 비교 탭을 고르면 코디 비교가 켜지고(미리보기가 칸 판으로), 북마크 탭으로 돌아오면 꺼진다. 비교 탭의 본문은 지금은 빈 자리다(사용자 지시 — 북마크 줄과 같은 높이, [비우기]도 자리만 남긴다).
// 슬롯을 누르면 입혀보기, ✕ 로 해제. ✕ · 비우기는 두 번 눌러야 지운다(lib/confirmTwice).
// 칸 높이는 탭과 상관없이 같다 — 비교 중에 열이 넓어져도 줄 높이는 비교 전 열 폭으로 잰 값(preview.module.css 의 --pin-col).
const BOX_TABS: SegOpt<'bm' | 'cmp'>[] = [{ v: 'bm', l: '북마크', t: '북마크한 아이템' }, { v: 'cmp', l: '비교', t: '여러 코디를 나란히 놓고 비교하기' }]
export function BookmarkBox() {
  const s = useShop()
  const n = s.bookmarks.length
  const leave = useCmpLeave()
  const tab = s.cmpOn ? 'cmp' : 'bm'
  const pick = (v: 'bm' | 'cmp') => { if (v === tab) return; if (v === 'cmp') leave(s.toggleCompare); else s.toggleCompare() }
  return (
    <div data-guide="bm" className={clsx('pb-pinbox', styles.pinbox)}>
      <div className={clsx(styles.pinHead, tab === 'cmp' && styles.pinHeadCmp)}>
        <span className={styles.pinActs} style={tab === 'cmp' ? { visibility: 'hidden' } : undefined} aria-hidden={tab === 'cmp' || undefined}><PinCount n={n} /><ClearBookmarks n={n} /></span>
        <span data-guide="vs" className={styles.pinTabs}><Seg opts={BOX_TABS} value={tab} onPick={pick} /></span>
      </div>
      {tab === 'cmp' ? <div aria-hidden className={styles.pinBlank} /> : (
      <div className={styles.pinGrid}>
        {Array.from({ length: 8 }, (_, i) => {
          const it = s.bookmarks[i]
          if (!it) return <div key={i} title="북마크한 아이템이 여기에 담겨요" className={clsx('pb-slot', styles.slot)} />
          const worn = wornOf(s, it)
          const name = it.name || it.id
          return (
            <div key={it.id} onClick={() => s.equipFromCat(SLOT_TO_CAT[it.slot], it)} title={`${name} — ${worn ? '현재 장착 중' : '눌러서 입혀보기'}`}
              className={clsx('pb-slot', styles.slot, styles.slotFilled, worn && styles.slotWorn)}>
              <div className={styles.slotSprite}><BookmarkSprite item={it} /></div>
              <button type="button" onClick={(e) => { e.stopPropagation(); if (confirmTwice(`bm:x:${it.id}`, '한 번 더 누르면 북마크에서 빼요')) s.toggleBookmark(it) }} title="북마크 해제" aria-label="북마크 해제"
                {...{ [CONFIRM_ATTR]: `bm:x:${it.id}` }} className={clsx('pb-slot-x', styles.slotX)}>✕</button>
            </div>
          )
        })}
      </div>
      )}
    </div>
  )
}

// 모바일: 북마크 시트 본문. 북마크 줄(비우기) → 4×2 = 항상 8칸 예약(빈칸 점선). 칩을 누르면 입히고 닫는다.
// 북마크 줄의 윗선은 상시 유지하고 margin-top:-1px 로 헤더 밑선과 정확히 겹친다.
// 본문은 스크롤 가능(브라우저 내비게이션 바가 올라와 시트가 줄어도 잘리지 않게).
export function BookmarkSheetBody() {
  const s = useShop()
  const n = s.bookmarks.length
  return (
    <div className={clsx('pb-scroll', 'pb-fade', styles.sheetBody)}>
      <div className={styles.bmList}>
      <div className={styles.bmRow}>
        <span className={styles.bmTitle}>북마크<PinCount n={n} /></span>
        <span className={styles.pinActs}>
          <ClearBookmarks n={n} />
        </span>
      </div>
      <div className={styles.bmBody}>
        <div className={styles.bmGrid}>
          {Array.from({ length: 8 }, (_, i) => {
            const it = s.bookmarks[i]
            if (!it) return <div key={i} title="북마크한 아이템이 여기에 담겨요" className={styles.chipEmpty} />
            const worn = wornOf(s, it)
            const name = it.name || it.id
            const pick = () => { s.equipFromCat(SLOT_TO_CAT[it.slot], it); s.closeSurface() }
            return (
              <button key={it.id} type="button" onClick={pick} title={`${name} — ${worn ? '장착 중' : '눌러서 입혀보기'}`}
                className={clsx(styles.chip, worn && styles.chipWorn)}>
                <span className={styles.chipSprite}><BookmarkSprite item={it} /></span>
                <span role="button" tabIndex={0} title="북마크 해제" aria-label="북마크 해제" className={styles.chipX} {...{ [CONFIRM_ATTR]: `bm:x:${it.id}` }}
                  onClick={(e) => { e.stopPropagation(); if (confirmTwice(`bm:x:${it.id}`, '한 번 더 누르면 북마크에서 빼요')) s.toggleBookmark(it) }}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); if (confirmTwice(`bm:x:${it.id}`, '한 번 더 누르면 북마크에서 빼요')) s.toggleBookmark(it) } }}>✕</span>
              </button>
            )
          })}
        </div>
      </div>
      </div>
    </div>
  )
}

// 모바일: 연출 설정 시트 본문. 닫기는 공용 푸터가 맡는다.
// 액션 · 무기 모션 · 표정을 누르면 **시트 안에서 가로로 슬라이드**해 3열 격자 고르기 화면으로 간다
// (부위 염색 → 염색과 같은 몸짓 — 좁은 화면에 시트 위 팝오버를 겹치지 않으려고).
// 푸터는 고르는 중에는 '이전'이라 한 단계만 돌아온다.
export function PvSheetBody() {
  // 기능 안내의 '열어 보기'로 열렸으면 그 칸 · 고르기 화면(표정 등)으로 바로 연다(lib/guide 의 setPvIntent)
  const [intent] = useState(takePvIntent)
  const [group, setGroup] = useState<PvGroup>(intent?.group ?? 'char')
  const [pick, setPick] = useState<PvField | null>(intent?.pick ?? null)
  const { view, go, style } = useInnerSlide<'main' | 'pick' | 'frames'>(intent?.pick ? 'pick' : 'main')
  // 액션 상세(재생 · 자세 — ActionFrames): 자세가 여럿인 액션은 이 화면으로 한 번 더 넘어가기만 하고(미리보기는 아직 그대로 — 시트에 가려 보이지 않는다),
  // 여기서 고르면 그 액션 · 자세로 바꾸고 설정으로 돌아간다. 자세가 하나뿐이면 바로 바꾸고 돌아간다(다른 고르기와 같다 — 고르기는 한 번에 끝난다)
  const s = useShop()
  const [detail, setDetail] = useState<string | null>(null)
  const listScroll = useRef<number | null>(null) // 상세로 들어갈 때의 고르기 격자 스크롤 좌표 — [이전]으로 돌아오면 그대로 되돌린다(고르기를 새로 열면 비운다)
  const detailInfo = useActionInfo(detail)
  // 액션 상세 칸의 기준 코디 — 고르기 화면을 열 때마다 지금 코디로 다시 잡는다(시트는 열린 채 모션 · 아이템을 바꿀 수 있다 — 처음 것을 쥐고 있으면
  // 칸 수는 새 모션, 그림은 옛 모션으로 합성돼 어긋났다. 사용자 제보: 모션을 건으로 바꾼 뒤 상세가 다 뜨지 않았다)
  const [frameBase, setFrameBase] = useState(() => s.snapshot())
  const fields = usePvFields()
  const picked = pick ? fields.find((f) => pvFieldOf(f) === pick && f.key !== 'zoom') : undefined
  // 격자는 **시트가 다 오른 뒤에** 붙인다(움직임이 끝나고 조금 더 뒤). 움직이는 도중에 칸 31개를 마운트하면
  //  · 메인 스레드가 붙들려 끊겨 보이고,
  //  · 마운트가 컨텍스트를 건드려 리액트가 시트 패널을 다시 그리면서 **진행 중이던 transform 을 0 으로 덮어써**
  //    시트가 목표 위치로 툭 튄다.
  const [gridOn, setGridOn] = useState(false)
  const gridTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (intent?.pick) gridTimer.current = setTimeout(() => setGridOn(true), SHEET_MS + 40)   // 고르기 화면으로 열렸으면 시트가 다 오른 뒤에
    return () => { if (gridTimer.current) clearTimeout(gridTimer.current) }
  }, [])
  const open = (k: PvField) => {
    setFrameBase(s.snapshot())
    listScroll.current = null
    setPick(k); go('pick', 1)
    setGridOn(false)
    if (gridTimer.current) clearTimeout(gridTimer.current)
    gridTimer.current = setTimeout(() => setGridOn(true), SHEET_MS + 40)
  }
  const back = () => {
    go('main', -1)
    setGridOn(false)
    if (gridTimer.current) clearTimeout(gridTimer.current)
    setTimeout(() => setPick(null), SWAP_MS)
  }

  // 화면(설정 ↔ 고르기)이 바뀌면 시트 높이도 바뀐다.
  //  · 설정 화면 = **내용 높이 그대로**. 내용 블록(mainRef)을 직접 재는 게 핵심이다 — 스크롤 상자를 재면
  //    `scrollHeight` 가 상자 높이보다 작아지지 않아 고르기(460px)에서 돌아와도 460 으로 굳고(되돌아가지 않음),
  //    애니메이션 중 다시 재는 되먹임이 생겨 높이가 매 프레임 재시작돼 툭툭 끊긴다.
  //  · 고르기 화면 = 화면의 62%(최대 460px) — 격자는 그 안에서 스크롤한다.
  // 움직임은 **높이 전환이 아니라 FLIP**이다: 높이는 한 번에 바꾸고(레이아웃 1회), 보이는 움직임은
  // 패널·푸터의 translateY 로만 한다(합성 단계라 매끄럽고, 도중에 다시 눌러도 glide 가 지금 위치·속도를 이어받는다).
  const wrapRef = useRef<HTMLDivElement>(null)
  const mainRef = useRef<HTMLDivElement>(null)
  const [mainH, setMainH] = useState<number | null>(null)
  useEffect(() => {
    const el = mainRef.current
    if (!el || view !== 'main') return
    const m = () => { const h = Math.round(el.getBoundingClientRect().height); if (h) setMainH((p) => (p === h ? p : h)) }
    m()
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(m) : null
    ro?.observe(el)
    return () => ro?.disconnect()
  }, [view, group])
  // ⚠️ 고르기 높이는 **열기 전에 이미 정해져 있어야** 한다. 열고 나서 효과에서 고치면 높이가 두 번 커밋되고
  //    두 번째 FLIP 이 첫 번째 움직임을 끊어 먹어 '툭' 뛰어 보인다.
  const pickOf = () => Math.round(Math.min(460, (typeof window === 'undefined' ? 700 : window.innerHeight) * 0.62))
  const [pickH, setPickH] = useState(pickOf)
  useEffect(() => {
    const m = () => setPickH(pickOf())
    window.addEventListener('resize', m)
    return () => window.removeEventListener('resize', m)
  }, [])
  const want = view === 'pick' || view === 'frames' ? pickH : mainH
  // 실제로 시트에 걸리는 높이. **늘 때와 줄 때 순서가 다르다**.
  //  · 늘 때  = 레이아웃 먼저 바꾸고 → 직전 모습으로 되돌려 놓은 뒤 0 으로 미끄러진다.
  //  · 줄 때  = 큰 레이아웃 그대로 두고 먼저 미끄러진 뒤 → 다 내려간 자리에서 레이아웃을 줄인다.
  //    (먼저 줄이면 패널 아랫변이 화면 안으로 들어와 푸터가 붕 뜨고 아래에 빈 칸이 생긴다.)
  const [appliedH, setAppliedH] = useState<number | null>(null)
  const shrinkTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const els = () => {
    const panel = wrapRef.current?.closest<HTMLElement>('[role="dialog"]') ?? null
    const foot = panel?.querySelector<HTMLElement>('[data-sheet-foot]') ?? null
    return panel && foot ? { panel, foot } : null
  }
  // 전환 흔적 정리 — 패널은 **전환 없이** 제자리로 되돌린 뒤 원래 곡선을 다시 물린다
  // (그냥 되돌리면 시트가 한 번 더 미끄러진다: 실측 632 → 447 로 0.3초 더 움직였다).
  const settle = (panel: HTMLElement, foot: HTMLElement) => {
    release([foot])
    panel.style.transition = 'none'
    panel.style.transform = 'translateY(0px)'
    panel.getBoundingClientRect()
    panel.style.transition = SHEET_EASE
  }
  useLayoutEffect(() => {
    if (want == null) return
    const from = appliedH
    if (from == null) { setAppliedH(want); return } // 첫 값은 그냥 앉힌다
    if (from === want) return
    const e = els(); const wrap = wrapRef.current
    if (!e || !wrap) { setAppliedH(want); return }
    if (shrinkTimer.current) clearTimeout(shrinkTimer.current)
    if (want > from) {
      // 늘 때: 높이를 **같은 프레임에** 바꾸고(리액트 상태도 곧 같은 값) 직전 모습으로 되돌린 뒤 0 으로 미끄러진다.
      wrap.style.height = `${want}px`
      const d = want - from
      place([[e.panel, d], [e.foot, -d]])
      const ms = glideTo([[e.panel, 0], [e.foot, 0]])
      setAppliedH(want)
      shrinkTimer.current = setTimeout(() => settle(e.panel, e.foot), ms + 20)
    } else {
      // 줄 때: 큰 레이아웃 그대로 패널을 |d| 만큼 내리고(윗변이 새 자리로) 푸터는 제자리에 붙들어 둔다.
      const d = from - want
      const ms = glideTo([[e.panel, d], [e.foot, -d]])
      shrinkTimer.current = setTimeout(() => { wrap.style.height = `${want}px`; setAppliedH(want); settle(e.panel, e.foot) }, ms)
    }
  }, [want])
  useEffect(() => () => { if (shrinkTimer.current) clearTimeout(shrinkTimer.current) }, [])
  const h = appliedH

  return (
    <>
      <div ref={wrapRef} className={styles.sheetWrap} style={h ? { height: h } : undefined}>
      <div className={clsx('pb-scroll', 'pb-fade', styles.sheetBody, styles.sheetSlide)} style={style}>
        {view === 'frames' && detail ? (
          <div className={styles.pickPage}>
            <div className={styles.pickHead}>{PV_ACTIONS_FLAT.find((a) => a.v === detail)?.l ?? '액션'}</div>
            <div className={clsx('pb-scroll', 'pb-scroll-thin', 'pb-fade', styles.pickScroll)}>
              <ActionFrameGrid action={detail} info={detailInfo} value={s.pv.action === detail ? s.pv.frame : -2} base={frameBase}
                onPick={(f) => { s.setPv('action', detail); s.setPv('frame', f); back() }} />
            </div>
          </div>
        ) : view === 'pick' && picked ? (
          <div className={styles.pickPage}>
            <div className={styles.pickHead}>{picked.title}<span className={styles.pickHint}>{picked.hint}</span></div>
            <div className={clsx('pb-scroll', 'pb-scroll-thin', 'pb-fade', styles.pickScroll)}>
              {gridOn && (
                <PvGrid field={pvFieldOf(picked)} options={picked.options} groups={pvGroupsOf(picked)} value={picked.value}
                  disabledValues={picked.disabled} disabledTitle="라이딩 중에는 사용할 수 없어요" scrollMemo={listScroll}
                  onWarm={pvFieldOf(picked) === 'action' ? (v) => warmActionFrames(s, frameBase, v) : undefined}
                  onChange={(v) => {
                    if (pvFieldOf(picked) !== 'action') { picked.set(v); back(); return }
                    void actionInfo(s, v).then((i) => { if (i.delays.length > 1) { setDetail(v); go('frames', 1) } else { picked.set(v); back() } })
                  }} />
              )}
            </div>
          </div>
        ) : (
          <div ref={mainRef}>
            <PvGroups group={group} onGroup={setGroup} mobile />
            <div className={styles.gridM}>
              <PvInlineFields mobile narrow={false} onPick={open} />
            </div>
          </div>
        )}
      </div>
      </div>
      <SurfaceFooter onBack={view === 'frames' ? () => go('pick', -1) : view === 'pick' ? back : undefined} />
    </>
  )
}
