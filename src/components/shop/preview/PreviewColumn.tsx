'use client'

// 코디 미리보기(PC·절반·태블릿): 헤더(좌 부위 염색 · 배경 / 우 되돌리기 · 다시실행) · 스테이지(피팅룸 장면 + PreviewModel + 점 위치) ·
// 연출 설정 드로어 · 상시 필드 행 · 북마크 박스.  모바일은 MobileHero.

import clsx from 'clsx'
import { useEffect, useState } from 'react'
import { saveImage } from '@/lib/canvasExport'
import { GUIDE_DRAWER_EVENT, guideSpot } from '@/lib/guide'
import { useHeroView } from '@/lib/heroView'
import { DOT_MOVER_IDS } from '@/lib/shopData'
import PreviewModel, { previewShot } from '../PreviewModel'
import plaza from '../plaza/plaza.module.css'
import { useShop } from '../ShopContext'
import { IconBookmark, IconBubble, IconCaretDown, IconDot, IconDrop, IconLinkCopy, IconRedo, IconScene, IconTakeDown, IconUndo } from '../ui/Icons'
import PinkbeanRate from './PinkbeanRate'
import { BookmarkBox } from './PreviewParts'
import { PvGroups, PvInlineFields, type PvGroup } from './pvControls'
import StageBg from './StageBg'
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
  // 기능 안내의 '열어 보기'(형상 변이 · 이펙트): 연출 설정을 펼치고 그 칸을 고른 뒤 가리킨다
  useEffect(() => {
    const on = (e: Event) => {
      const g = (e as CustomEvent<PvGroup>).detail
      setPvAll(true); setGroup(g)
      window.setTimeout(() => guideSpot('pvall'), 60)
    }
    window.addEventListener(GUIDE_DRAWER_EVENT, on)
    return () => window.removeEventListener(GUIDE_DRAWER_EVENT, on)
  }, [])
  const dotItem = useDotEquipped()
  const histCls = (on: boolean) => clsx('pb-icon', styles.iconBtn, on && styles.histOn)
  const partOpen = s.surface?.kind === 'part' && !s.surfaceClosing
  const bgOpen = s.surface?.kind === 'bg' && !s.surfaceClosing
  const chatOpen = s.surface?.kind === 'chat' && !s.surfaceClosing

  return (
    <section className={clsx(styles.col, s.bp === 'half' && styles.colHalf, s.bp === 'tablet' && styles.colTablet)}>
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
            {/* 명찰 이름 · 말풍선 대사(dev 전용 — 명찰 · 말풍선 데이터가 있을 때만) */}
            {s.chatOn && (
              <button type="button" onClick={s.openChatEdit} title="명찰 이름과 말풍선 대사 바꾸기" aria-label="이름/대사"
                className={clsx('pb-ddbtn', styles.partBtn, chatOpen && styles.partBtnOn)}>
                <IconBubble size={14} /><span>이름/대사</span>
              </button>
            )}
          </div>
          <div data-guide="undo" className={styles.hist}>
            <button type="button" onClick={s.undo} disabled={!s.canUndo} title={s.canUndo ? '되돌리기' : '되돌릴 것이 없어요'} aria-label="되돌리기" className={histCls(s.canUndo)}><IconUndo /></button>
            <button type="button" onClick={s.redo} disabled={!s.canRedo} title={s.canRedo ? '다시실행' : '다시 실행할 것이 없어요'} aria-label="다시실행" className={histCls(s.canRedo)}><IconRedo /></button>
          </div>
        </div>

        {/* data-pv-stage: 연출 설정 고르기(PvPicker)가 이 영역 안 가운데에 뜬다 — 미리보기 밖으로 나가지 않게. */}
        <div data-pv-stage className={styles.stage}>
          <StageBg />
          <button type="button" onClick={() => { if (dotItem) s.openDot(dotItem) }} disabled={!dotItem} title="점 위치 변경" data-guide="dot"
            className={clsx('pb-ghost', styles.dotBtn, dotItem && styles.dotBtnOn)}>
            <IconDot />점 위치
          </button>
          <PinkbeanRate />
          <div className={styles.model}><PreviewModel /></div>
        </div>

        <div className={clsx('pb-drawer', styles.drawer, pvAll && styles.drawerOpen)}>
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
export function MobileHero() {
  const s = useShop()
  const dotItem = useDotEquipped()
  const bmOpen = s.surface?.kind === 'bm' && !s.surfaceClosing
  const partOpen = s.surface?.kind === 'part' && !s.surfaceClosing
  const bgOpen = s.surface?.kind === 'bg' && !s.surfaceClosing
  const chatOpen = s.surface?.kind === 'chat' && !s.surfaceClosing
  const n = s.bookmarks.length
  // 크게 · 캐릭터만일 때 왼쪽 위에 이미지 저장 · 링크 복사(코디 광장 카드의 레일과 같은 버튼). 기본 크기에서는 걷는다
  const big = useHeroView() !== 'base'
  const save = async () => { const r = await saveImage(previewShot, 'pinkbean-cody'); if (r === 'saved') s.notify('이미지를 저장했어요'); else if (r === 'error') s.notify('이미지 저장에 실패했어요') }
  return (
    <div data-hero className={styles.hero}>
      <StageBg />
      <PinkbeanRate />
      <div className={styles.heroModel}><PreviewModel /></div>
      <div aria-hidden={!big} className={clsx(plaza.rail, styles.heroRail, big && styles.heroRailOn)}>
        <button type="button" onClick={() => void save()} tabIndex={big ? 0 : -1} title="캐릭터 이미지 저장" aria-label="이미지 저장" className={plaza.railBtn}><IconTakeDown /></button>
        <button type="button" onClick={s.shareCurrentLink} tabIndex={big ? 0 : -1} title="현재 프리셋 공유 링크 복사" aria-label="링크 복사" className={plaza.railBtn}><IconLinkCopy /></button>
      </div>
      <div data-guide="undo" className={styles.heroHist}>
        <button type="button" onClick={s.undo} disabled={!s.canUndo} title="되돌리기" aria-label="되돌리기" className={clsx(styles.heroIcon, s.canUndo && styles.heroIconOn)}><IconUndo /></button>
        <button type="button" onClick={s.redo} disabled={!s.canRedo} title="다시실행" aria-label="다시실행" className={clsx(styles.heroIcon, s.canRedo && styles.heroIconOn)}><IconRedo /></button>
      </div>
      <div className={styles.heroLeft}>
        <button type="button" onClick={() => s.openSheet('pv')} title="연출 설정" data-guide="pv" className={styles.pvOpenBtn}>
          연출 설정<IconCaretDown />
        </button>
        <button type="button" onClick={() => s.openSheet('bg')} title="미리보기 배경 바꾸기" aria-label="미리보기 배경" className={clsx(styles.pvOpenBtn, styles.pvOpenIcon, bgOpen && styles.pvOpenBtnOn)}>
          <IconScene size={15} />
        </button>
        {/* 명찰 이름 · 말풍선 대사(dev 전용) — 배경 옆, 같은 생김새의 아이콘 버튼 */}
        {s.chatOn && (
          <button type="button" onClick={s.openChatEdit} title="명찰 이름과 말풍선 대사 바꾸기" aria-label="이름/대사" className={clsx(styles.pvOpenBtn, styles.pvOpenIcon, chatOpen && styles.pvOpenBtnOn)}>
            <IconBubble size={15} />
          </button>
        )}
      </div>
      <div className={styles.heroRight}>
        <button type="button" onClick={() => { if (dotItem) s.openDot(dotItem) }} disabled={!dotItem} title="점 위치 변경" aria-label="점 위치 변경" data-guide="dot"
          className={clsx(styles.dotBtnM, dotItem && styles.dotBtnMOn)}>
          <IconDot size={15} />
        </button>
        <button type="button" onClick={() => s.openSheet('part')} title="부위를 골라 염색하기" aria-label="부위 염색" className={clsx(styles.fab, styles.partFab, partOpen && styles.fabOn)}>
          <IconDrop size={16} />
        </button>
        <button type="button" onClick={() => s.openSheet('bm')} title="북마크 간이 가방" aria-label="북마크" className={clsx(styles.fab, bmOpen && styles.fabOn)}>
          <IconBookmark filled={bmOpen} />
          {n > 0 && <span className={styles.fabCount}>{n}</span>}
        </button>
      </div>
    </div>
  )
}
