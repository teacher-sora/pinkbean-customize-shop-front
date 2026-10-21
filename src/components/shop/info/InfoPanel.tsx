'use client'

// 코디 정보 · 염색. 18부위 행 그리드. 부위를 누르면 염색/점 위치 서피스를 연다(PC 는 가운데 다이얼로그, 모바일은 바텀 시트).

import clsx from 'clsx'
import { useEffect, useRef, useState } from 'react'
import { CATS } from '@/lib/catalog'
import type { ListItem } from '@/lib/core/data'
import type { HsbParams } from '@/lib/core/dye'
import { CAT_TO_SLOT, DOT_MOVER_IDS, isDyeableSkin, skinDyeFamily } from '@/lib/shopData'
import { isNarrow } from '@/lib/useBreakpoint'
import { useShop } from '../ShopContext'
import { CONFIRM_ATTR, confirmTwice } from '@/lib/confirmTwice'
import { IconEye, IconTrashSolid } from '../ui/Icons'
import { DyeBand, SlotSprite } from './SlotSprite'
import styles from './info.module.css'
import ui from '../ui/ui.module.css'

const hsbActive = (h?: HsbParams) => !!h && (h.h !== 0 || h.s !== 0 || h.b !== 0)

// 피부(톤)를 염색 다이얼로그에 넘길 ListItem 형태로.
export function useSkinItem(): ListItem | null {
  const s = useShop()
  const te = s.index?.base.tones.find((t) => t.tone === s.tone)
  if (!te) return null
  return { id: te.body, slot: 'skin', isCash: false, grade: 'none', islot: null, vslot: null, dyeMode: 'hsb', thumb: `sprites/${te.body}/thumb.png`, headId: te.head, name: te.name || `피부 ${te.tone}`, actions: [] }
}

export default function InfoPanel({ mobile }: { mobile: boolean }) {
  const s = useShop()
  const narrow = isNarrow(s.bp)
  const toneEntry = s.index?.base.tones.find((t) => t.tone === s.tone)
  const toneName = toneEntry?.name || `피부 ${s.tone}`
  const skinItem = useSkinItem()

  // 부위 그리드 열 = min(최대 열, 150px 카드가 들어가는 수)
  const slotsRef = useRef<HTMLDivElement>(null)
  const [infoW, setInfoW] = useState(0)
  useEffect(() => {
    const el = slotsRef.current; if (!el) return
    const m = () => { const w = el.clientWidth; if (w) setInfoW((p) => (p === w ? p : w)) }
    m()
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(m) : null
    ro?.observe(el)
    return () => ro?.disconnect()
  }, [mobile])
  const maxCols = mobile ? 2 : narrow ? 3 : 4
  const fit = infoW > 0 ? Math.floor((infoW - 20 + 8) / (150 + 8)) : maxCols
  const cols = Math.max(1, Math.min(maxCols, fit > 0 ? fit : maxCols))

  const rows = CATS.map((c) => {
    const slot = CAT_TO_SLOT[c.id]
    const isSkin = c.id === 'skin'
    const isMix = s.isMixSlot(slot)
    const item = isSkin ? skinItem : s.equipped[slot] || null
    const on = isSkin ? !!skinItem : !!item
    const hidden = !isSkin && !!s.hidden[slot]
    let dyed = false
    if (isSkin) dyed = isDyeableSkin(toneName) && hsbActive(s.dyeHsb.skin)
    else if (isMix) { const p = s.dyePalette[slot]; dyed = !!p && (p.baseColor !== 0 || (p.mixColor != null && p.ratio > 0)) }
    else dyed = hsbActive(s.dyeHsb[slot])
    return { c, slot, isSkin, isMix, item, on, hidden, dyed, dyeOff: !!s.dyeOff[slot], sel: s.dyeTarget === slot }
  })
  const wornCount = rows.filter((r) => r.on).length

  const pick = (r: typeof rows[number]) => {
    if (!r.on || !r.item) return
    s.setDyeTarget(r.slot)
    // 어느 폭이든 염색 창(서피스 — PC 는 가운데 다이얼로그, 모바일은 바텀 시트)을 연다(사용자 지시). 창 안에서 캐릭터를 크게 보며 바꾼다.
    if (r.isSkin && !isDyeableSkin(toneName)) { s.notify('이 피부는 염색할 수 없어요'); return }
    if (!r.isSkin && r.item.dyeMode === 'none' && !DOT_MOVER_IDS.has(r.item.id)) { s.notify('이 아이템은 염색할 수 없어요'); return }
    if (DOT_MOVER_IDS.has(r.item.id)) s.openDot(r.item); else s.openDye(r.item)
  }

  const grid = (
    <div className={styles.grid} style={{ gridTemplateColumns: `repeat(${cols},minmax(0,1fr))` }}>
      {rows.map((r) => {
        const name = r.on ? (r.hidden ? '숨김' : (r.item!.name || r.item!.id)) : '미착용'
        return (
          <button key={r.c.id} type="button" onClick={() => pick(r)} title={r.on ? `${r.c.label} - ${r.item!.name || r.item!.id}, 눌러서 염색` : `${r.c.label} - 미착용`}
            className={clsx(r.on && 'pb-slotrow', styles.slot, ui.dyeChip, r.on && styles.slotOn, r.hidden && styles.slotHidden, r.sel && styles.slotSel)}>
            <span className={clsx(styles.slotThumb, r.on && !r.hidden && styles.slotThumbOn)}>
              {r.on && r.item ? (
                <span className={clsx(styles.slotSprite, r.hidden && styles.slotSpriteHidden)}>
                  <SlotSprite slot={r.slot} item={r.item} grayscale={r.hidden} />
                </span>
              ) : <span className={styles.slotEmpty} />}
              {r.dyed && <span title={r.dyeOff ? '염색 비활성화됨' : '염색됨'} className={clsx(styles.dyedDot, r.dyeOff && styles.dyedDotOff)} />}
            </span>
            <span className={clsx(styles.slotText, mobile && styles.slotTextM)}>
              <span className={styles.slotPart}>{r.c.label}</span>
              <span className={clsx(styles.slotName, r.on && !r.hidden && styles.slotNameOn)}>{name}</span>
            </span>
            {r.on && !r.isSkin && (
              <span role="button" tabIndex={0} title="미리보기 표시/숨김" aria-label="미리보기 표시/숨김"
                onClick={(e) => { e.stopPropagation(); s.setHidden((h) => { const n = { ...h }; if (n[r.slot]) delete n[r.slot]; else n[r.slot] = true; return n }) }}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); s.setHidden((h) => { const n = { ...h }; if (n[r.slot]) delete n[r.slot]; else n[r.slot] = true; return n }) } }}
                className={clsx(styles.toggle, r.hidden && styles.toggleHidden)}>
                <IconEye hidden={r.hidden} />
              </span>
            )}
            {/* 이 부위만 벗기 — 칩 오른쪽 아래 모서리의 휴지통(이름 줄 끝의 눈 단추와 떨어지게). 두 번 눌러야 한다(lib/confirmTwice, 누른 단추 위에 되묻는 말풍선). 사용자 요청. */}
            {r.on && !r.isSkin && (
              <span role="button" tabIndex={0} title="이 부위 벗기" aria-label={`${r.c.label} 벗기`} {...{ [CONFIRM_ATTR]: `unequip:${r.slot}` }}
                onClick={(e) => { e.stopPropagation(); if (confirmTwice(`unequip:${r.slot}`, '한 번 더 누르면 벗어요')) s.unequipSlot(r.slot, r.c.label) }}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); if (confirmTwice(`unequip:${r.slot}`, '한 번 더 누르면 벗어요')) s.unequipSlot(r.slot, r.c.label) } }}
                className={styles.trash}>
                <IconTrashSolid size={13} />
              </span>
            )}
            <DyeBand state={!r.on ? 'empty' : r.dyed ? 'dyed' : (r.isSkin ? !isDyeableSkin(toneName) : r.item?.dyeMode === 'none') ? 'none' : 'plain'}
              slot={r.slot} palette={s.dyePalette[r.slot]} hsb={s.dyeHsb[r.slot]} off={r.dyeOff} skinFamily={r.isSkin ? skinDyeFamily(toneName) ?? undefined : undefined} />
          </button>
        )
      })}
    </div>
  )

  const chip = (
    <div title="착용한 부위 수" className={clsx(styles.chip, mobile && styles.chipM)}>
      <span className={styles.chipLabel}>착용</span>
      <span className={styles.chipNum}>{wornCount}</span>
      <span className={styles.chipSlash}>/</span>
      <span className={styles.chipLabel}>{CATS.length}</span>
    </div>
  )
  const unequip = <button type="button" data-guide="unequip" onClick={s.unequipAll} title="모든 부위 벗기" className={clsx('pb-ghost', styles.btn, mobile && styles.btnM)}>전체 벗기</button>

  if (mobile) {
    return (
      <>
        <div className={styles.headerM}>{chip}<div className={styles.right}>{unequip}</div></div>
        <div className={styles.hrM} />
        <div className={clsx('pb-scroll', 'pb-norail', 'pb-fade', styles.scrollM)}>
          <div ref={slotsRef}>{grid}</div>
        </div>
      </>
    )
  }
  return (
    <section className={styles.panel}>
      <div className={styles.header}>{chip}<div className={styles.right}>{unequip}</div></div>
      <div className={styles.hr} />
      <div className={clsx('pb-scroll', 'pb-fade', styles.scroll)}>
        <div ref={slotsRef} className={styles.slots}>{grid}</div>
      </div>
    </section>
  )
}
