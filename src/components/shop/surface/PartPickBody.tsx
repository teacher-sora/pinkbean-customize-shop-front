'use client'

// 부위 염색 첫 화면(delta §3) — 착용 중이고 염색할 수 있는 부위만 칩으로. 고르면 같은 다이얼로그 안에서
// 염색(헤어·성형 = 발색표, 그 외 HSB) 또는 점 위치 패널로 가로 슬라이드(ShopContext.openPartItem).
// 순서는 CATS(라이딩 제외). 피부는 "컬러라인" 커스텀 피부만, 그 외는 염색 가능 아이템(dyeMode≠none)·점 아이템만 — 눌러도
// 염색할 수 없는 칩은 보여주지 않는다.

import clsx from 'clsx'
import { CATS } from '@/lib/catalog'
import type { ListItem } from '@/lib/core/data'
import { CAT_TO_SLOT, DOT_MOVER_IDS, isDyeableSkin } from '@/lib/shopData'
import { useShop } from '../ShopContext'
import { useSkinItem } from '../info/InfoPanel'
import { SlotSprite, useSlotDyed } from '../info/SlotSprite'
import styles from './surface.module.css'

export default function PartPickBody({ mobile }: { mobile: boolean }) {
  const s = useShop()
  const skinItem = useSkinItem()
  const dyedOf = useSlotDyed()
  const chips: { label: string; slot: string; item: ListItem }[] = []
  for (const c of CATS) {
    if (c.id === 'riding') continue
    const slot = CAT_TO_SLOT[c.id]
    const item = c.id === 'skin' ? skinItem : s.equipped[slot] || null
    if (!item) continue
    const ok = c.id === 'skin' ? isDyeableSkin(item.name) : DOT_MOVER_IDS.has(item.id) || item.dyeMode !== 'none'
    if (ok) chips.push({ label: c.label, slot, item })
  }

  return (
    <div className={clsx('pb-scroll', styles.partBody)}>
      {chips.length === 0 ? (
        <div className={styles.partEmpty}>
          <span className={styles.partEmptyTitle}>염색할 수 있는 부위가 없어요</span>
          <span className={styles.partEmptyHint}>아이템을 먼저 착용해주세요.</span>
        </div>
      ) : (
        <div className={clsx(styles.partGrid, mobile && styles.partGridM)}>
          {chips.map(({ label, slot, item }) => {
            const name = item.name || item.id
            const off = !!s.dyeOff[slot]
            return (
              <button key={slot} type="button" onClick={() => s.openPartItem(item)} title={`${label} · ${name}`} className={clsx('pb-partchip', styles.partChip)}>
                <span className={styles.partThumb}>
                  <span className={styles.partSprite}><SlotSprite slot={slot} item={item} /></span>
                  {dyedOf(slot) && <span title={off ? '염색 비활성화됨' : '염색됨'} className={clsx(styles.partDot, off && styles.partDotOff)} />}
                </span>
                <span className={styles.partText}>
                  <span className={styles.partSlot}>{label}</span>
                  <span className={styles.partName}>{name}</span>
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
