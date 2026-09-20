'use client'

// 부위 슬롯 썸네일(34px 칸 안) — 코디 정보 탭 슬롯과 부위 염색 칩이 같은 그림을 쓴다.
// 피부 = 몸+머리 모델(컬러라인만 라인 염색), 헤어·성형 = 몸 없는 전 파츠 발색 합성, 그 외 = 아이템 아이콘 HSB 염색.
// 렌더는 render*(염색 비활성화 반영) 값을 쓴다.

import type { ListItem } from '@/lib/core/data'
import type { HsbParams } from '@/lib/core/dye'
import { isColorLineSkin } from '@/lib/shopData'
import { useShop } from '../ShopContext'
import { DyeSprite, INFO_FRAC, INFO_FRAC_HAIR, SKIN_ICON_FRACTION, SkinModel } from '../render/DyeSprite'

const defHsb = (): HsbParams => ({ h: 0, s: 0, b: 0, t: 0 })
const hsbActive = (h?: HsbParams) => !!h && (h.h !== 0 || h.s !== 0 || h.b !== 0)

export function SlotSprite({ slot, item, grayscale }: { slot: string; item: ListItem; grayscale?: boolean }) {
  const s = useShop()
  const zmap = s.index?.zmap || []
  const smap = s.index?.smap || {}
  if (slot === 'skin') {
    const te = s.index?.base.tones.find((t) => t.tone === s.tone)
    return te ? <SkinModel bodyId={te.body} headId={te.head} hsb={s.renderHsb.skin || defHsb()} dyeable={isColorLineSkin(te.name)} zmap={zmap} smap={smap} box={34} fraction={SKIN_ICON_FRACTION} /> : null
  }
  if (s.isMixSlot(slot)) return <DyeSprite id={item.id} mix palette={s.renderPalette[slot]} zmap={zmap} grayscale={grayscale} frac={slot === 'hair' ? INFO_FRAC_HAIR : INFO_FRAC} />
  // 염색 불가(일반 메소 아이템 등)는 슬롯에 남은 수치를 쓰지 않는다 — 실제 렌더(buildOverrides)와 같은 기준.
  const dyeableItem = item.dyeMode !== 'none'
  return <DyeSprite id={item.id} thumb={item.icon || `sprites/${item.id}/icon.png`} mix={false} hsb={dyeableItem ? s.renderHsb[slot] : undefined} zmap={zmap} grayscale={grayscale} frac={INFO_FRAC} />
}

// 부위에 염색 수치가 걸려 있는지(비활성화 여부와 무관 — 표시 점은 비활성화면 무채색).
// 염색 불가 아이템은 수치가 남아 있어도 '염색됨'이 아니다(실제로 칠해지지 않는다).
export function useSlotDyed() {
  const s = useShop()
  const toneName = s.index?.base.tones.find((t) => t.tone === s.tone)?.name
  return (slot: string): boolean => {
    if (slot === 'skin') return isColorLineSkin(toneName) && hsbActive(s.dyeHsb.skin)
    if (s.isMixSlot(slot)) { const p = s.dyePalette[slot]; return !!p && (p.baseColor !== 0 || (p.mixColor != null && p.ratio > 0)) }
    if (s.equipped[slot]?.dyeMode === 'none') return false
    return hsbActive(s.dyeHsb[slot])
  }
}
