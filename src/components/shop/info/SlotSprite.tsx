'use client'

// 부위 슬롯 썸네일(34px 칸 안) — 코디 정보 탭 슬롯과 부위 염색 칩이 같은 그림을 쓴다.
// 피부 = 몸+머리 모델(컬러라인만 라인 염색), 헤어·성형 = 몸 없는 전 파츠 발색 합성, 그 외 = 아이템 아이콘 HSB 염색.
// 렌더는 render*(염색 비활성화 반영) 값을 쓴다.
// LookSprite 는 같은 그림을 **지금 코디가 아닌 스냅샷**(광장 글의 착용 아이템)으로 그린다 — 값만 받는 순수 부품.

import clsx from 'clsx'
import { DYE_FAMILIES, paletteFor } from '@/lib/catalog'
import type { ListItem } from '@/lib/core/data'
import type { HsbParams, PaletteParams } from '@/lib/core/dye'
import { isDyeableSkin, skinDyeFamily } from '@/lib/shopData'
import { useShop } from '../ShopContext'
import { DyeSprite, INFO_FRAC, INFO_FRAC_HAIR, SKIN_ICON_FRACTION, SkinModel } from '../render/DyeSprite'
import ui from '../ui/ui.module.css'

const defHsb = (): HsbParams => ({ h: 0, s: 0, b: 0, t: 0 })
const hsbActive = (h?: HsbParams) => !!h && (h.h !== 0 || h.s !== 0 || h.b !== 0)
const isMix = (slot: string) => slot === 'hair' || slot === 'face'

// palette·hsb 는 염색 비활성화를 이미 뺀 값(render*)을 넘긴다.
export function LookSprite({ slot, item, tone, palette, hsb, grayscale }: {
  slot: string; item: ListItem | null; tone: number; palette?: PaletteParams; hsb?: HsbParams; grayscale?: boolean
}) {
  const s = useShop()
  const zmap = s.index?.zmap || []
  const smap = s.index?.smap || {}
  if (slot === 'skin') {
    const te = s.index?.base.tones.find((t) => t.tone === tone)
    return te ? <SkinModel bodyId={te.body} headId={te.head} hsb={hsb || defHsb()} dyeable={isDyeableSkin(te.name)} family={skinDyeFamily(te.name)} zmap={zmap} smap={smap} box={34} fraction={SKIN_ICON_FRACTION} /> : null
  }
  if (!item) return null
  if (isMix(slot)) return <DyeSprite id={item.id} mix palette={palette} zmap={zmap} grayscale={grayscale} frac={slot === 'hair' ? INFO_FRAC_HAIR : INFO_FRAC} />
  // 염색 불가(일반 메소 아이템 등)는 슬롯에 남은 수치를 쓰지 않는다 — 실제 렌더(buildOverrides)와 같은 기준.
  const dyeableItem = item.dyeMode !== 'none'
  return <DyeSprite id={item.id} thumb={item.icon || `sprites/${item.id}/icon.png`} mix={false} hsb={dyeableItem ? hsb : undefined} zmap={zmap} grayscale={grayscale} frac={INFO_FRAC} />
}

export function SlotSprite({ slot, item, grayscale }: { slot: string; item: ListItem; grayscale?: boolean }) {
  const s = useShop()
  return <LookSprite slot={slot} item={item} tone={s.tone} palette={s.renderPalette[slot]} hsb={s.renderHsb[slot]} grayscale={grayscale} />
}

// 부위에 염색 수치가 걸려 있는지(비활성화 여부와 무관 — 표시 점은 비활성화면 무채색).
// 염색 불가 아이템은 수치가 남아 있어도 '염색됨'이 아니다(실제로 칠해지지 않는다).
export function lookDyed(slot: string, item: ListItem | null, toneName: string | undefined, palette?: PaletteParams, hsb?: HsbParams): boolean {
  if (slot === 'skin') return isDyeableSkin(toneName) && hsbActive(hsb)
  if (isMix(slot)) return !!palette && (palette.baseColor !== 0 || (palette.mixColor != null && palette.ratio > 0))
  if (item?.dyeMode === 'none') return false
  return hsbActive(hsb)
}

// 칩 윗줄(부위 이름 줄) 오른쪽의 염색 값(사용자 요청 — 광장 코디의 염색을 보고 따라 할 수 있게). 칩이 좁아(글자 칸 70~90px) 낱말 없이 쓴다.
//  헤어 · 성형: [베이스 색 점] 비율 [믹스 색 점] 비율 — 섞지 않았으면 베이스 점 하나.
//  그 밖: [색상 계열 점] 색조 채도 명도(인게임 염색 창의 순서). 테두리 포함이면 점에 진한 테두리를 두른다.
// 누르는 요소가 아니다(창을 열지 않는다) — 낱말로 된 전체 값은 title(올려 두면 보이는 글)에 둔다. off = 염색 꺼짐(흐리게).
const signed = (v: number) => (v > 0 ? `+${v}` : `${v}`)
export function DyeTag({ slot, palette, hsb, off, skinFamily }: { slot: string; palette?: PaletteParams; hsb?: HsbParams; off?: boolean; skinFamily?: number }) {
  if (isMix(slot)) {
    if (!palette) return null
    const pal = paletteFor(slot)
    const base = pal[palette.baseColor], mixed = palette.mixColor != null && palette.mixColor !== palette.baseColor && palette.ratio > 0
    const mix = mixed ? pal[palette.mixColor!] : null
    const title = mix ? `${base?.name} ${100 - palette.ratio}, ${mix.name} ${palette.ratio}` : `${base?.name}`
    return (
      <span title={title} className={clsx(ui.dyeTag, off && ui.dyeTagOff)}>
        <span className={ui.dyeTagDot} style={{ background: base?.hex }} />{mix && <>{100 - palette.ratio}<span className={ui.dyeTagDot} style={{ background: mix.hex }} />{palette.ratio}</>}
        {!mix && base?.name}
      </span>
    )
  }
  if (!hsb) return null
  const t = hsb.t ?? skinFamily ?? 0
  const hue = [ui.hue0, ui.hue1, ui.hue2, ui.hue3, ui.hue4, ui.hue5, ui.hue6][t] ?? ui.hue0
  const edge = !!hsb.edge && slot !== 'skin'
  const title = `${DYE_FAMILIES[t]}, 색조 ${hsb.h}, 채도 ${signed(hsb.s)}, 명도 ${signed(hsb.b)}${edge ? ', 테두리 포함' : ''}`
  return (
    <span title={title} className={clsx(ui.dyeTag, off && ui.dyeTagOff)}>
      <span className={clsx(ui.dyeTagDot, hue, edge && ui.dyeTagEdge)} />{hsb.h} {signed(hsb.s)} {signed(hsb.b)}
    </span>
  )
}

export function useSlotDyed() {
  const s = useShop()
  const toneName = s.index?.base.tones.find((t) => t.tone === s.tone)?.name
  return (slot: string): boolean => lookDyed(slot, s.equipped[slot] || null, toneName, s.dyePalette[slot], s.dyeHsb[slot])
}
