'use client'

// 코디 미리보기(PC·절반·태블릿): 헤더(되돌리기/다시실행) · 스테이지(배경 일러스트 + PreviewModel + 점 위치) ·
// 연출 설정 드로어 · 상시 필드 행 · 북마크 박스.  모바일은 MobileHero.

import clsx from 'clsx'
import Image from 'next/image'
import { useState } from 'react'
import bg from '@/assets/pinkbean-bg.png'
import { DOT_MOVER_IDS } from '@/lib/shopData'
import PreviewModel from '../PreviewModel'
import { useShop } from '../ShopContext'
import { IconBookmark, IconCaretDown, IconDot, IconRedo, IconUndo } from '../ui/Icons'
import { BookmarkBox, RateBubbles } from './PreviewParts'
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
  const dotItem = useDotEquipped()
  const histCls = (on: boolean) => clsx('pb-icon', narrow ? styles.iconBtn : styles.histBtn, on && styles.histOn)

  return (
    <section className={clsx(styles.col, s.bp === 'half' && styles.colHalf, s.bp === 'tablet' && styles.colTablet)}>
      <div className={styles.card}>
        <div className={styles.head}>
          <span className={styles.title}>코디 미리보기</span>
          <div className={styles.hist}>
            <button type="button" onClick={s.undo} title="되돌리기" className={histCls(s.canUndo)}>
              <IconUndo />{!narrow && <span>되돌리기</span>}
            </button>
            <button type="button" onClick={s.redo} title="다시실행" className={histCls(s.canRedo)}>
              <IconRedo />{!narrow && <span>다시실행</span>}
            </button>
          </div>
        </div>

        <div className={styles.stage}>
          <Image src={bg} alt="" fill priority sizes="360px" className={styles.stageImg} />
          <div className={styles.stageTone} />
          <button type="button" onClick={() => { if (dotItem) s.openDot(dotItem) }} title="점 위치 변경" tabIndex={dotItem ? 0 : -1}
            className={clsx('pb-ghost', styles.dotBtn, dotItem && styles.dotBtnOn)}>
            <IconDot />점 위치
          </button>
          <div className={styles.model}><PreviewModel /></div>
          <RateBubbles />
        </div>

        <div className={clsx('pb-drawer', styles.drawer, pvAll && styles.drawerOpen)}>
          <PvGroups group={group} onGroup={setGroup} mobile={false} />
        </div>

        <div className={styles.ctrlRow}>
          <PvInlineFields mobile={false} narrow={narrow} />
          <button type="button" onClick={() => setPvAll((v) => !v)} title={pvAll ? '연출 설정 접기' : '연출 설정 더 보기 (형상 변이 · 귀 · 시선 · 이펙트)'}
            aria-label={pvAll ? '연출 설정 접기' : '연출 설정 더 보기 (형상 변이 · 귀 · 시선 · 이펙트)'} aria-expanded={pvAll}
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

// 모바일 히어로: 배경 일러스트 위 모델 + 되돌리기/다시실행 · 연출 설정 · 점 위치 · 북마크 FAB.
export function MobileHero() {
  const s = useShop()
  const dotItem = useDotEquipped()
  const bmOpen = s.surface?.kind === 'bm' && !s.surfaceClosing
  const n = s.bookmarks.length
  return (
    <div className={styles.hero}>
      <Image src={bg} alt="" fill priority sizes="100vw" className={styles.heroImg} />
      <div className={styles.heroTone} />
      <div className={styles.heroModel}><PreviewModel /></div>
      <RateBubbles />
      <div className={styles.heroHist}>
        <button type="button" onClick={s.undo} title="되돌리기" aria-label="되돌리기" className={clsx(styles.heroIcon, s.canUndo && styles.heroIconOn)}><IconUndo /></button>
        <button type="button" onClick={s.redo} title="다시실행" aria-label="다시실행" className={clsx(styles.heroIcon, s.canRedo && styles.heroIconOn)}><IconRedo /></button>
      </div>
      <div className={styles.heroLeft}>
        <button type="button" onClick={() => s.openSheet('pv')} title="연출 설정" className={styles.pvOpenBtn}>
          연출 설정<IconCaretDown />
        </button>
      </div>
      <div className={styles.heroRight}>
        <button type="button" onClick={() => { if (dotItem) s.openDot(dotItem) }} title="점 위치 변경" aria-label="점 위치 변경" tabIndex={dotItem ? 0 : -1}
          className={clsx(styles.dotBtnM, dotItem && styles.dotBtnMOn)}>
          <IconDot size={15} />
        </button>
        <button type="button" onClick={() => s.openSheet('bm')} title="북마크 간이 가방" aria-label="북마크" className={clsx(styles.fab, bmOpen && styles.fabOn)}>
          <IconBookmark filled={bmOpen} />
          {n > 0 && <span className={styles.fabCount}>{n}</span>}
        </button>
      </div>
    </div>
  )
}
