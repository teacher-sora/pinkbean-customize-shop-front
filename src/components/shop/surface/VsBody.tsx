'use client'

// 북마크 VS(코디 비교, delta §4). 왼쪽 = 현재 코디, 오른쪽 = 고른 북마크 아이템을 끼운 코디(ShopContext.swapSnapshot).
// 두 칸은 미리보기와 같은 배경(center 78% + 톤) 위에 SnapThumb 으로 실제 캔버스를 그린다(delta 의 점선 목업 자리).
//  - PC: 코디 비교 다이얼로그 본문(VsBody) — 비교 행 + '비교할 북마크 아이템' 칩 줄(8열), 푸터는 닫기만.
//  - 모바일: 북마크 시트 안에서 VsPanes 만 확장 영역(고정 236px)에 쓴다(PreviewParts.BookmarkSheetBody).

import clsx from 'clsx'
import Image from 'next/image'
import { useMemo } from 'react'
import bg from '@/assets/pinkbean-bg.png'
import SnapThumb from '../SnapThumb'
import { useShop, type Snapshot } from '../ShopContext'
import { BookmarkSprite } from '../preview/PreviewParts'
import styles from './surface.module.css'

const VS_FRACTION = 0.4 // 비교 칸 마네킹 높이 비율(칸이 미리보기보다 작아 더 크게)

function Pane({ label, name, snap, mobile }: { label: string; name: string; snap: Snapshot | null; mobile: boolean }) {
  return (
    <div className={clsx(styles.vsPane, mobile && styles.vsPaneM)}>
      <div className={clsx(styles.vsLabelRow, mobile && styles.vsLabelRowM)}>
        <span className={clsx(styles.vsLabel, mobile && styles.vsLabelM)}>{label}</span>
        <span className={clsx(styles.vsName, mobile && styles.vsNameM)}>{name}</span>
      </div>
      <div className={styles.vsStage}>
        <Image src={bg} alt="" fill sizes="440px" className={styles.vsStageImg} />
        <div className={styles.vsStageTone} />
        {snap && <SnapThumb snap={snap} fraction={VS_FRACTION} />}
      </div>
    </div>
  )
}

export function VsPanes({ mobile }: { mobile: boolean }) {
  const s = useShop()
  const cur = useMemo(() => s.snapshot(), // eslint-disable-next-line react-hooks/exhaustive-deps
    [s.equipped, s.tone, s.dyePalette, s.dyeHsb, s.hidden, s.dotPos, s.dyeOff, s.pv])
  const pick = s.bookmarks.find((b) => b.id === s.vsPick) || s.bookmarks[0] || null
  const swapped = useMemo(() => (pick ? s.swapSnapshot(pick) : null), // eslint-disable-next-line react-hooks/exhaustive-deps
    [pick?.id, cur])
  return (
    <div className={clsx(styles.vsRow, mobile && styles.vsRowM)}>
      <Pane label="현재 코디" name="적용 중" snap={cur} mobile={mobile} />
      <Pane label="북마크" name={pick ? pick.name || pick.id : '비어 있음'} snap={swapped} mobile={mobile} />
    </div>
  )
}

export default function VsBody({ mobile }: { mobile: boolean }) {
  const s = useShop()
  const pickId = s.bookmarks.some((b) => b.id === s.vsPick) ? s.vsPick : s.bookmarks[0]?.id
  return (
    <div className={styles.vsBody}>
      <VsPanes mobile={false} />
      <div className={styles.vsHr} />
      <div className={styles.vsPick}>
        <div className={styles.vsPickLabel}>비교할 북마크 아이템</div>
        <div className={clsx(styles.vsChips, mobile && styles.vsChipsM)}>
          {s.bookmarks.map((it) => (
            <button key={it.id} type="button" onClick={() => s.setVsPick(it.id)} title={`${it.name || it.id} — 오른쪽에 끼워보기`}
              className={clsx(styles.vsChip, it.id === pickId && styles.vsChipOn)}>
              <span className={styles.vsChipSprite}><BookmarkSprite item={it} /></span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
