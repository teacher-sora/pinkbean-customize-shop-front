'use client'

// 가져온 코디를 넣을 프리셋 칸 고르기 — 20칸(PC 5열 · 모바일 3열). 고르면 그 칸을 덮어쓰고 시트가 닫힌다.
// 덮어쓰기·이름·염색·점 위치 반영은 공유 받기와 같은 경로(applySharedToPreset)를 그대로 쓴다.

import clsx from 'clsx'
import SnapThumb from '../SnapThumb'
import { useShop } from '../ShopContext'
import styles from './plaza.module.css'

const SLOT_FRACTION = 0.44

export default function PlazaTakeBody({ mobile }: { mobile: boolean }) {
  const s = useShop()
  return (
    <div className={clsx('pb-scroll', styles.takeBody)}>
      <div className={clsx(styles.takeGrid, mobile && styles.takeGridM)}>
        {s.presets.map((p) => {
          const snap = p.id === s.selectedPreset ? s.snapshot() : s.presetData[p.id]
          return (
            <button key={p.id} type="button" onClick={() => s.plazaTakeInto(p.id)} title={`${p.name} — ${snap ? '덮어쓰기' : '비어 있음'}`} className={styles.slot}>
              <span className={clsx(styles.slotThumb, !snap && styles.slotEmpty)}>{snap && <SnapThumb snap={snap} fraction={SLOT_FRACTION} />}</span>
              <span className={styles.slotName}>{p.name}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
