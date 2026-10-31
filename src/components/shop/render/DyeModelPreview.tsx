'use client'

// 염색 미리보기. 보기 모델(model)은 목록의 보기 방식과 같은 세 가지다.
//  - mymodel(기본): 지금 착용한 코디(숨긴 부위 제외, 그 염색 포함)에 이 아이템을 입힌다. 피부는 내 착용을 이 피부에 입힌다.
//  - model: 기본 피부 마네킹에 이 아이템만 입힌다(아이템 카드의 마네킹과 같다). 형상 변이 · 귀는 내 캐릭터에만.
//  - sprite: 마네킹(model 과 같다)에서 몸 · 머리만 뺀 아이템 그림(PreviewModel bare — 사용자 지시). 그림의 가운데를 상자 가운데에 두고,
//    애니메이션 · 발색 조절 중 멈춤은 다른 보기와 같다. 피부는 '아이템'을 잠근다. 염색 보관함 칸은 그대로 아이콘 스프라이트(LookSprite).
// 캐릭터 보기는 우측 미리보기(PreviewModel)를 그대로 쓴다 — 연출 설정의 액션 · 표정 · 무기 모션 · 이펙트 토글과
// 애니메이션이 미리보기와 똑같이 나온다(사용자 지시). 착용 · 피부 · 염색 · 배율만 이 창의 값으로 바꿔 넘긴다.

import { useEffect, useMemo, useState } from 'react'
import type { ListItem } from '@/lib/core/data'
import type { HsbParams, PaletteParams } from '@/lib/core/dye'
import { conflictSlots } from '@/lib/core/slots'
import { DEFAULT_TONE } from '@/lib/shopData'
import PreviewModel, { type PreviewSource } from '../PreviewModel'
import { useShop, type ListMode } from '../ShopContext'

// 마네킹 높이 비율. 모바일 시트처럼 낮은 상자(≈150~260px)에선 높이의 1/3이면 캐릭터가 50px 안팎으로 작다 → 낮은 상자는 비율을 올린다.
const fractionFor = (h: number) => (h < 300 ? 0.5 : 0.33)
const DIALOG_ZOOM: Record<number, number> = { 1: 0.6, 2: 1.0, 3: 1.6 }
// '아이템' 보기는 몸이 빠져 그림이 작다 — 마네킹 기준 높이를 키워 아이템이 크게 보이게
const bareFraction = (h: number) => (h < 300 ? 0.8 : 0.6)
// 발색을 바꾸는 동안은 애니메이션을 멈추고 보이는 프레임만 칠한다(우측 미리보기의 dyeInteracting 과 같다). 손을 떼고 이만큼 지나면 다시 돈다.
const SETTLE_MS = 260

type Props = { item: ListItem; hsb: HsbParams; palette?: PaletteParams; zoom: number; model: ListMode }

export default function DyeModelPreview({ item, hsb, palette, zoom, model }: Props) {
  const s = useShop()
  const isSkin = item.slot === 'skin'
  const mix = s.isMixSlot(item.slot)
  const mine = model === 'mymodel'
  const bare = model === 'sprite' && !isSkin

  // 발색 조절 중 표시: 값이 바뀌면 켜고, 잠시 조용하면 끈다.
  const dyeSig = JSON.stringify([hsb, palette ?? null])
  const [interacting, setInteracting] = useState(false)
  const [firstSig] = useState(dyeSig)
  useEffect(() => {
    if (dyeSig === firstSig) return
    setInteracting(true)
    const t = setTimeout(() => setInteracting(false), SETTLE_MS)
    return () => clearTimeout(t)
  }, [dyeSig, firstSig])

  const src = useMemo((): PreviewSource | null => {
    const idx = s.index
    if (!idx) return null
    const skinTone = isSkin ? idx.base.tones.find((t) => t.body === item.id)?.tone : undefined
    const tone = skinTone ?? (mine ? s.shownTone : DEFAULT_TONE)
    // 착용: 내 캐릭터는 지금 코디에 이 아이템을 입힌다(장착과 같은 규칙 — 겹치는 부위는 벗긴다).
    const equipped: Record<string, ListItem | null> = {}
    if (mine) for (const [sl, it] of Object.entries(s.equipped)) if (it) equipped[sl] = it
    const hidden: Record<string, boolean> = mine ? { ...s.hidden } : {}
    if (isSkin) delete hidden.skin // 피부를 염색하는 창은 피부가 보여야 한다
    if (!isSkin) {
      for (const c of conflictSlots(equipped, item.slot, item)) delete equipped[c]
      equipped[item.slot] = item
      delete hidden[item.slot]
    }
    // 염색: 내 착용의 염색 위에 이 아이템(또는 피부)의 지금 값을 얹는다.
    const pal: Record<string, PaletteParams> = mine ? { ...s.renderPalette } : {}
    const hs: Record<string, HsbParams> = mine ? { ...s.renderHsb } : {}
    const key = isSkin ? 'skin' : item.slot
    delete pal[key]; delete hs[key]
    if (mix) { if (palette) pal[key] = palette } else hs[key] = hsb
    return {
      equipped, hidden, tone, palette: pal, hsb: hs, dotPos: mine ? s.dotPos : {},
      pv: mine ? { ...s.pv, zoom } : { ...s.pv, zoom, form: 'none', ear: 'humanEar', ...(bare ? { baseTag: false } : {}) },
      interacting, zoomMults: DIALOG_ZOOM, fraction: bare ? bareFraction : fractionFor, bare,
    }
  }, [s.index, s.shownTone, s.equipped, s.hidden, s.renderPalette, s.renderHsb, s.dotPos, s.pv, item, isSkin, mix, mine, bare, hsb, palette, zoom, interacting])

  if (!src) return <div className="pb-skel" style={{ width: '70%', height: '70%', borderRadius: 8 }} />
  return <PreviewModel src={src} />
}
