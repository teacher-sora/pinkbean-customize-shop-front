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
import type { ShareBand } from '@/lib/profileCard'

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

// 칩 아래 띠의 염색 값(사용자 요청 — 광장 코디의 염색을 보고 따라 할 수 있게). 코디 광장 상세의 착용 칩 · 코디 정보 칩이 쓴다.
// 띠는 칩 폭 전체를 같은 폭의 칸으로 나눠 쓴다(사용자 지시 — 왼쪽에 몰지 않는다, 칸은 언제나 같은 폭).
// 모든 칩에 띠가 있어 높이가 같다(염색하지 않았으면 '염색 없음', 염색할 수 없으면 '염색 불가', 비었으면 빈 띠).
//  헤어 · 성형: [색 점] 색 이름 비율 — 섞었으면 베이스 · 믹스 두 칸.
//  그 밖: [색상 계열 점] 색 · 채 · 명 세 칸(인게임 염색 창의 색조 · 채도 · 명도 순서). 테두리 포함이면 색상 계열 점에 검은 고리를 두른다
//  (사용자 지시 — '테두리' 칸을 따로 두면 칸 폭이 어긋난다).
// 누르는 요소가 아니다(창을 열지 않는다). 낱말로 된 전체 값은 title. off = 염색 꺼짐(흐리게).
const signed = (v: number) => (v > 0 ? `+${v}` : `${v}`)
export type DyeBandState = 'dyed' | 'plain' | 'none' | 'empty'
export function DyeBand({ state, slot, palette, hsb, off, skinFamily }: {
  state: DyeBandState; slot: string; palette?: PaletteParams; hsb?: HsbParams; off?: boolean; skinFamily?: number
}) {
  const muted = (t: string) => <span className={clsx(ui.dyeBand, ui.dyeBandMuted)}><span className={ui.dyeBandCell}>{t || ' '}</span></span>
  if (state !== 'dyed') return muted(state === 'plain' ? '염색 없음' : state === 'none' ? '염색 불가' : '')
  const k = (t: string) => <span className={ui.dyeBandKey}>{t}</span>
  const dot = (cls?: string, hex?: string) => <span className={clsx(ui.dyeBandDot, cls)} style={hex ? { background: hex } : undefined} />
  if (isMix(slot) && palette) {
    const pal = paletteFor(slot)
    const base = pal[palette.baseColor], mixed = palette.mixColor != null && palette.mixColor !== palette.baseColor && palette.ratio > 0
    const mix = mixed ? pal[palette.mixColor!] : null
    const title = mix ? `베이스 ${base?.name} ${100 - palette.ratio}, 믹스 ${mix.name} ${palette.ratio}` : `${base?.name}`
    return (
      <span title={title} className={clsx(ui.dyeBand, off && ui.dyeBandOff)}>
        <span className={ui.dyeBandCell}>{dot(undefined, base?.hex)}{k(base?.name ?? '')}{mix ? 100 - palette.ratio : null}</span>
        {mix && <span className={ui.dyeBandCell}>{dot(undefined, mix.hex)}{k(mix.name)}{palette.ratio}</span>}
      </span>
    )
  }
  if (!hsb) return muted('염색 없음')
  const t = hsb.t ?? skinFamily ?? 0
  const hue = [ui.hue0, ui.hue1, ui.hue2, ui.hue3, ui.hue4, ui.hue5, ui.hue6][t] ?? ui.hue0
  const edge = !!hsb.edge && slot !== 'skin'
  const title = `${DYE_FAMILIES[t]}, 색조 ${hsb.h}, 채도 ${signed(hsb.s)}, 명도 ${signed(hsb.b)}${edge ? ', 테두리 포함' : ''}`
  return (
    <span title={title} className={clsx(ui.dyeBand, off && ui.dyeBandOff)}>
      <span className={ui.dyeBandCell}>{dot(clsx(hue, edge && ui.dyeBandDotEdge))}{k('색')}{hsb.h}</span>
      <span className={ui.dyeBandCell}>{k('채')}{signed(hsb.s)}</span>
      <span className={ui.dyeBandCell}>{k('명')}{signed(hsb.b)}</span>
    </span>
  )
}

// 같은 띠를 그림(코디 프로필 — lib/profileCard)에 그릴 값으로. 화면의 DyeBand 와 같은 규칙이다
const HUE_DOT = ['all', 'hsl(0,68%,60%)', 'hsl(48,68%,60%)', 'hsl(120,68%,60%)', 'hsl(174,68%,60%)', 'hsl(220,68%,60%)', 'hsl(300,68%,60%)']
export function dyeBandData (state: DyeBandState, slot: string, palette?: PaletteParams, hsb?: HsbParams, skinFamily?: number): ShareBand {
  if (state !== 'dyed') return { muted: state === 'plain' ? '염색 없음' : state === 'none' ? '염색 불가' : '' }
  if (isMix(slot) && palette) {
    const pal = paletteFor(slot)
    const base = pal[palette.baseColor], mixed = palette.mixColor != null && palette.mixColor !== palette.baseColor && palette.ratio > 0
    const mix = mixed ? pal[palette.mixColor!] : null
    return { cells: [{ dot: base?.hex, key: base?.name ?? '', val: mix ? String(100 - palette.ratio) : '' }, ...(mix ? [{ dot: mix.hex, key: mix.name, val: String(palette.ratio) }] : [])] }
  }
  if (!hsb) return { muted: '염색 없음' }
  const t = hsb.t ?? skinFamily ?? 0
  return { cells: [{ dot: HUE_DOT[t] ?? 'all', key: '색', val: String(hsb.h) }, { key: '채', val: signed(hsb.s) }, { key: '명', val: signed(hsb.b) }] }
}

export function useSlotDyed() {
  const s = useShop()
  const toneName = s.index?.base.tones.find((t) => t.tone === s.tone)?.name
  return (slot: string): boolean => lookDyed(slot, s.equipped[slot] || null, toneName, s.dyePalette[slot], s.dyeHsb[slot])
}
