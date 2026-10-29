'use client'

// 코디 미리보기(PC·절반·태블릿): 헤더(좌 부위 염색 · 배경 / 우 되돌리기 · 다시실행) · 스테이지(피팅룸 장면 + PreviewModel + 점 위치) ·
// 연출 설정 드로어 · 상시 필드 행 · 북마크 박스.  모바일은 MobileHero.
// 무대(캐릭터 · 배경)는 PreviewStage — 코디 비교 중에는 2×2 칸이 되고 열이 넓어진다(목록은 그만큼 좁아져 열 수가 준다). 켜고 끄기는 아래 칸의 [비교] 탭.

import clsx from 'clsx'
import { useCallback, useEffect, useRef, useState } from 'react'
import { heroViewNow, readCmpView, setHeroView, type HeroView } from '@/lib/heroView'
import { useIsoLayoutEffect } from '@/lib/uiState'
import { GUIDE_DRAWER_EVENT, GUIDE_SETTLE_MS, guideSpot } from '@/lib/guide'
import { DOT_MOVER_IDS } from '@/lib/shopData'
import ChatBar from './ChatBar'
import { useShop } from '../ShopContext'
import { IconBookmark, IconBubble, IconCaretDown, IconCompare, IconDot, IconDrop, IconRedo, IconScene, IconUndo } from '../ui/Icons'
import PreviewStage, { useCmpLeave } from './PreviewStage'
import { BookmarkBox } from './PreviewParts'
import { PvGroups, PvInlineFields, type PvGroup } from './pvControls'
import styles from './preview.module.css'

function useDotEquipped() {
  const s = useShop()
  const eye = s.equipped['eyeAcc']
  return eye && DOT_MOVER_IDS.has(eye.id) ? eye : null
}

export default function PreviewColumn() {
  const s = useShop()
  const narrow = s.bp === 'half' || s.bp === 'tablet'
  const [pvAll, setPvAll] = useState(false)
  const [group, setGroup] = useState<PvGroup>('char')
  // 기능 안내의 '열어 보기'(형상 변이 · 이펙트 · 기본 명찰): 연출 설정을 펼치고 그 칸을 고른 뒤 가리킨다.
  // spot 이 있으면 펼침과 칸 전환이 끝난 뒤 그 줄까지 칸 안을 스크롤해 가리킨다(guideSpot 의 reveal)
  useEffect(() => {
    const on = (e: Event) => {
      const { group: g, spot } = (e as CustomEvent<{ group: PvGroup; spot?: string }>).detail
      setPvAll(true); setGroup(g)
      window.setTimeout(() => guideSpot('pvall'), 60)
      if (spot) window.setTimeout(() => guideSpot(spot), GUIDE_SETTLE_MS)
    }
    window.addEventListener(GUIDE_DRAWER_EVENT, on)
    return () => window.removeEventListener(GUIDE_DRAWER_EVENT, on)
  }, [])
  const histCls = (on: boolean) => clsx('pb-icon', styles.iconBtn, on && styles.histOn)
  const partOpen = s.surface?.kind === 'part' && !s.surfaceClosing
  const bgOpen = s.surface?.kind === 'bg' && !s.surfaceClosing

  return (
    <section className={clsx(styles.col, s.bp === 'half' && styles.colHalf, s.bp === 'tablet' && styles.colTablet, s.cmpOn && styles.colCmp)}>
      <div className={styles.card}>
        <div className={styles.head}>
          {/* 꾸미는 도구 둘(부위 염색 · 배경)은 어느 폭에서나 이름을 적어 나란히 둔다 — 아이콘만 두면 있는 줄 모르고 지나친다.
              되돌리기 · 다시실행은 그림만으로 통하는 것이라 아이콘으로 줄여 그 자리를 내준다. */}
          <div className={styles.tools}>
            <button type="button" onClick={() => s.openSheet('part')} title="부위를 골라 염색하기" aria-label="부위 염색"
              className={clsx('pb-ddbtn', styles.partBtn, partOpen && styles.partBtnOn)}>
              <IconDrop size={14} /><span>부위 염색</span>
            </button>
            <button type="button" onClick={() => s.openSheet('bg')} title="미리보기 배경 바꾸기" aria-label="미리보기 배경"
              className={clsx('pb-ddbtn', styles.partBtn, bgOpen && styles.partBtnOn)}>
              <IconScene size={14} /><span>배경</span>
            </button>
          </div>
          <div data-guide="undo" className={styles.hist}>
            <button type="button" onClick={s.undo} disabled={!s.canUndo} title={s.canUndo ? '되돌리기' : '되돌릴 것이 없어요'} aria-label="되돌리기" className={histCls(s.canUndo)}><IconUndo /></button>
            <button type="button" onClick={s.redo} disabled={!s.canRedo} title={s.canRedo ? '다시실행' : '다시 실행할 것이 없어요'} aria-label="다시실행" className={histCls(s.canRedo)}><IconRedo /></button>
          </div>
        </div>

        {/* data-pv-stage: 연출 설정 고르기(PvPicker)가 이 영역 안 가운데에 뜬다 — 미리보기 밖으로 나가지 않게. */}
        <PreviewStage mobile={false} />

        <div className={clsx('pb-drawer', styles.drawer, pvAll && styles.drawerOpen)}>
          {/* 채팅 칸 — 늘 있다(말풍선 반지가 없으면 기본 흰 말풍선). 드로어 윗변에 붙어 함께 오르내린다(접히면 아래 줄 바로 위) */}
          {s.chatOn && (
            <div className={clsx(styles.chatDock, !pvAll && styles.chatDockDown)}>
              <ChatBar mobile={false} show />
            </div>
          )}
          <PvGroups group={group} onGroup={setGroup} mobile={false} />
        </div>

        <div data-guide="pv" className={styles.ctrlRow}>
          <PvInlineFields mobile={false} narrow={narrow} />
          <button type="button" onClick={() => setPvAll((v) => !v)} title={pvAll ? '연출 설정 접기' : '연출 설정 더 보기 (형상 변이, 귀, 시선, 이펙트)'}
            aria-label={pvAll ? '연출 설정 접기' : '연출 설정 더 보기 (형상 변이, 귀, 시선, 이펙트)'} aria-expanded={pvAll} data-guide="pvall"
            className={clsx('pb-soft', styles.pvAll, narrow && styles.pvAllNarrow, pvAll && styles.pvAllOn)}>
            <span className={styles.pvAllText}>연출 설정</span>
            <IconCaretDown className={clsx(styles.pvCaret, pvAll && styles.pvCaretOn)} />
          </button>
        </div>
      </div>
      <BookmarkBox />
    </section>
  )
}

// 모바일 히어로: 피팅룸 장면 위 모델 + 되돌리기/다시실행 · 연출 설정 · 우하단 [점 위치][부위 염색][북마크].
// 코디 비교는 오른쪽 아래 [비교] 버튼으로 켜고 끈다 — 히어로 높이는 그대로, 위 · 아래 버튼 줄 사이를 비교 칸이 채운다(PreviewStage).
export function MobileHero() {
  const s = useShop()
  // 비교를 켜면 비교 때의 보기로(처음은 '크게' — lib/heroView readCmpView), 끄면 켜기 전 보기로 돌아간다
  const viewBefore = useRef<HeroView>('base')
  useIsoLayoutEffect(() => {
    if (!s.cmpOn) return
    viewBefore.current = heroViewNow()
    setHeroView(readCmpView())
    return () => setHeroView(viewBefore.current)
  }, [s.cmpOn])
  const dotItem = useDotEquipped()
  const bmOpen = s.surface?.kind === 'bm' && !s.surfaceClosing
  const partOpen = s.surface?.kind === 'part' && !s.surfaceClosing
  const bgOpen = s.surface?.kind === 'bg' && !s.surfaceClosing
  const n = s.bookmarks.length
  const leave = useCmpLeave()
  // 채팅 칸(명찰 · 말풍선): 아래 줄의 말풍선 버튼으로 올린다. 버튼은 늘 있다(말풍선 반지가 없으면 기본 흰 말풍선 — 사용자 지시)
  const canChat = s.chatOn
  const [chat, setChat] = useState(false)
  const chatUp = chat && canChat
  const closeChat = useCallback(() => setChat(false), [])
  return (
    <div data-hero className={clsx(styles.hero, s.cmpOn && styles.heroCmp)}>
      <PreviewStage mobile />
      <div data-guide="undo" className={styles.heroHist}>
        <button type="button" onClick={s.undo} disabled={!s.canUndo} title="되돌리기" aria-label="되돌리기" className={clsx(styles.heroIcon, s.canUndo && styles.heroIconOn)}><IconUndo /></button>
        <button type="button" onClick={s.redo} disabled={!s.canRedo} title="다시실행" aria-label="다시실행" className={clsx(styles.heroIcon, s.canRedo && styles.heroIconOn)}><IconRedo /></button>
      </div>
      <div className={clsx(styles.heroLeft, chatUp && styles.heroBarOff)}>
        <button type="button" onClick={() => s.openSheet('pv')} title="연출 설정" data-guide="pv" className={styles.pvOpenBtn}>
          연출<span className={styles.pvOpenMore}> 설정</span><IconCaretDown />
        </button>
        <button type="button" onClick={() => s.openSheet('bg')} title="미리보기 배경 바꾸기" aria-label="미리보기 배경" className={clsx(styles.pvOpenBtn, styles.pvOpenIcon, bgOpen && styles.pvOpenBtnOn)}>
          <IconScene size={15} />
        </button>
        {canChat && (
          <button type="button" data-guide="chat" onClick={() => setChat(true)} title="말풍선 띄우기" aria-label="채팅" aria-expanded={chatUp} className={clsx(styles.pvOpenBtn, styles.pvOpenIcon)}>
            <IconBubble size={15} />
          </button>
        )}
      </div>
      {s.chatOn && <ChatBar mobile show={chatUp} onClose={closeChat} />}
      <div className={clsx(styles.heroRight, chatUp && styles.heroBarOff)}>
        <button type="button" onClick={() => { if (dotItem) s.openDot(dotItem) }} disabled={!dotItem} title="점 위치 변경" aria-label="점 위치 변경" data-guide="dot"
          className={clsx(styles.dotBtnM, dotItem && styles.dotBtnMOn)}>
          <IconDot size={15} />
        </button>
        <button type="button" onClick={() => s.openSheet('part')} title="부위를 골라 염색하기" aria-label="부위 염색" className={clsx(styles.fab, styles.partFab, partOpen && styles.fabOn)}>
          <IconDrop size={16} />
        </button>
        <button type="button" data-guide="vs" onClick={() => (s.cmpOn ? s.toggleCompare() : leave(s.toggleCompare))} aria-pressed={s.cmpOn} title={s.cmpOn ? '코디 비교 끄기' : '여러 코디를 나란히 놓고 비교하기'} aria-label="코디 비교"
          className={clsx(styles.fab, styles.partFab, s.cmpOn && styles.fabOn)}>
          <IconCompare />
        </button>
        <button type="button" onClick={() => s.openSheet('bm')} title="북마크 간이 가방" aria-label="북마크" className={clsx(styles.fab, bmOpen && styles.fabOn)}>
          <IconBookmark filled={bmOpen} />
          {n > 0 && <span className={styles.fabCount}>{n}</span>}
        </button>
      </div>
    </div>
  )
}
