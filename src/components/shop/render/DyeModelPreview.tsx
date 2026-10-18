'use client'

// 염색 미리보기. box 는 표시 영역 크기(측정값).
// 보기 모델(model)은 목록의 보기 방식과 같은 세 가지다.
//  - mymodel(기본): 지금 착용한 코디(같은 부위·숨긴 부위 제외, 그 염색·이펙트 포함)에 이 아이템을 입힌다. 피부는 내 착용을 이 피부에 입힌다.
//  - model: 엘프 마네킹에 이 아이템만 입힌다(아이템 카드의 기본 캐릭터와 같다).
//  - sprite: 몸 없이 아이템 그림만(DyeSprite — 헤어·성형은 모든 파츠 합성, 그 외는 아이콘). 피부는 피부만 그린다.

import { useEffect, useRef, useState } from 'react'
import { assemble, dropWeaponEffects, getFrameLayers, type AssembleInput, type PlacedLayer } from '@/lib/core/assemble'
import { loadEffect, loadEffectIndex, loadMeta, type ItemMeta, type ListItem } from '@/lib/core/data'
import { applyHsb, buildOverrides, skinHsb as skinHsbFor, type HsbParams, type PaletteParams } from '@/lib/core/dye'
import { canvasBitmap, computeModelPlacement, fitCanvas, zoomStepScale } from '@/lib/core/modelPlacement'
import { effectDraws, loadImage, renderCharacter, type EffectDraw } from '@/lib/core/render'
import { collectWornEffects } from '@/lib/core/thumbEffects'
import { modelShotBlob, type ModelShot } from '@/lib/canvasExport'
import { bindImageMenu } from '@/lib/canvasMenu'
import { DEFAULT_TONE, THUMB_VIEW, skinDyeFamily } from '@/lib/shopData'
import { useShop, type ListMode } from '../ShopContext'
import { useLiveRedraw } from '../useLiveRedraw'
import { DyeSprite } from './DyeSprite'

// 우측 미리보기/카드와 동일한 computeModelPlacement 공식 사용(마네킹 중앙 고정 + 정수 스냅으로 항상 선명).
// 배율(1x/2x/3x)은 fraction 에 곱하는 월드 배율.
const DIALOG_FRACTION = 0.33
// 모바일 시트처럼 낮은 미리보기 상자(≈150~260px)에선 높이의 1/3이면 캐릭터가 50px 안팎으로 작다 → 낮은 상자는 비율을 올린다.
const fractionFor = (h: number) => (h < 300 ? 0.5 : DIALOG_FRACTION)
const DIALOG_ZOOM: Record<number, number> = { 1: 0.6, 2: 1.0, 3: 1.6 }
// '아이템' 보기의 배율 = 그림이 칸에서 차지하는 큰-변 비율.
const SPRITE_FRAC: Record<number, number> = { 1: 0.25, 2: 0.4, 3: 0.6 }

type Props = { item: ListItem; hsb: HsbParams; palette?: PaletteParams; zoom: number; box: { w: number; h: number }; model: ListMode }
type Bg = { ov: Map<string, HTMLCanvasElement>; effs: EffectDraw[] } // 내 착용의 염색(override)과 이펙트
const NO_BG: Bg = { ov: new Map(), effs: [] }

// palette = 헤어·성형(발색표) 선택. 있으면 그 색을 바탕으로 깔고 그 위에 커스텀 HSB 를 입힌다
// (lib/core/dye.buildOverrides 와 같은 순서 — 미리보기와 실제 모델이 같은 색이어야 한다).
export default function DyeModelPreview(props: Props) {
  const s = useShop()
  const { item, hsb, palette, zoom, model } = props
  if (model === 'sprite' && item.slot !== 'skin') {
    const mix = s.isMixSlot(item.slot)
    return <DyeSprite id={item.id} thumb={item.icon || `sprites/${item.id}/icon.png`} mix={mix} palette={mix ? palette : undefined} hsb={mix ? undefined : hsb} zmap={s.index?.zmap || []} frac={SPRITE_FRAC[zoom] ?? SPRITE_FRAC[2]} />
  }
  return <DyeModelCanvas {...props} />
}

function DyeModelCanvas({ item, hsb, palette, zoom, box, model }: Props) {
  const s = useShop()
  const ref = useRef<HTMLCanvasElement>(null)
  const shotRef = useRef<ModelShot | null>(null)
  const [placed, setPlaced] = useState<PlacedLayer[] | null>(null)
  const [itemMeta, setItemMeta] = useState<ItemMeta | null>(null)
  const [effs, setEffs] = useState<EffectDraw[]>([]) // 이 아이템의 이펙트(정적 대표 프레임)
  const [bg, setBg] = useState<Bg>(NO_BG)
  const mine = model === 'mymodel'

  useEffect(() => {
    const idx = s.index; if (!idx) return
    let alive = true
    ;(async () => {
      const isSkin = item.slot === 'skin'
      // 몸·머리: 피부 염색이면 그 피부, 내 캐릭터면 지금 피부, 기본 캐릭터면 엘프(아이템 카드의 기본 캐릭터와 같다 — 사용자 지시).
      const te = idx.base.tones.find((t) => t.tone === (mine ? s.tone : DEFAULT_TONE)) || idx.base.tones.find((t) => t.tone === idx.base.default) || idx.base.tones[0]
      const worn = mine ? (Object.entries(s.equipped).filter(([sl, it]) => it && sl !== item.slot && !s.hidden[sl]) as [string, ListItem][]) : []
      const [body, head, im, ...wm] = await Promise.all([
        loadMeta(isSkin ? item.id : te.body),
        loadMeta(isSkin ? item.headId! : te.head),
        isSkin ? Promise.resolve(null) : loadMeta(item.id),
        ...worn.map(([, it]) => loadMeta(it.id).catch(() => null)),
      ])
      if (!alive) return
      const wornMetas: [string, ItemMeta][] = []
      worn.forEach(([sl], i) => { const m = wm[i]; if (m) wornMetas.push([sl, m]) })
      const items: AssembleInput[] = [
        { itemId: body.id, slot: 'body', vslot: null, layers: getFrameLayers(body, THUMB_VIEW) },
        { itemId: head.id, slot: 'head', vslot: null, layers: getFrameLayers(head, THUMB_VIEW) },
        ...wornMetas.map(([sl, m]): AssembleInput => ({ itemId: m.id, slot: sl, vslot: m.vslot ?? null, layers: dropWeaponEffects(sl, getFrameLayers(m, THUMB_VIEW), s.pv.wEffect), invisibleFace: m.invisibleFace, name: m.name, dotOffsets: s.dotPos[m.id] })),
      ]
      if (im) items.push({ itemId: im.id, slot: im.slot, vslot: im.vslot ?? null, layers: getFrameLayers(im, THUMB_VIEW), invisibleFace: im.invisibleFace, name: im.name })
      const { placed: p, anchors } = assemble(items, idx.zmap, idx.smap)
      const bp = p.find((x) => x.name === 'body')
      const foot = bp ? { x: bp.x + bp.origin.x, y: bp.y + bp.origin.y } : { x: 8, y: 21 }
      const anch = { foot, brow: anchors.brow ?? foot }
      // 내 착용의 염색과 이펙트(연출 토글을 따른다) — 목록의 '내 캐릭터' 카드와 같은 규칙.
      let next = NO_BG
      if (wornMetas.length) {
        const ov = await buildOverrides(wornMetas.map(([, m]) => m), { palette: s.renderPalette, hsb: s.renderHsb }, THUMB_VIEW).catch(() => new Map<string, HTMLCanvasElement>())
        const we = await collectWornEffects(worn.map(([sl, it]) => ({ slot: sl, id: it.id, dyeable: it.dyeMode !== 'none' })), s.pv, s.renderHsb, ov).catch(() => [])
        next = { ov, effs: we.flatMap(({ em }) => effectDraws(em, THUMB_VIEW.action, anch, 0)) }
      }
      if (!alive) return
      // 아이템 이펙트(망토/무기 등) — 정적 대표 프레임. 있으면 합성해서 보여준다.
      let own: EffectDraw[] = []
      if (im && (await loadEffectIndex().catch(() => new Set<string>())).has(String(parseInt(item.id, 10)))) {
        const em = await loadEffect(item.id).catch(() => null)
        own = em ? effectDraws(em, THUMB_VIEW.action, anch, 0) : []
      }
      if (!alive) return
      setItemMeta(im); setBg(next); setEffs(own); setPlaced(p)
    })().catch(() => {})
    return () => { alive = false }
  }, [s.index, item.id, item.slot, item.headId, mine, s.tone, s.equipped, s.hidden, s.renderPalette, s.renderHsb, s.dotPos, s.pv])

  // 슬라이더 드래그 중에도 렉 없이 바로바로 발색(single-flight + 최신값 수렴).
  useLiveRedraw(async () => {
    const canvas = ref.current; if (!canvas || !placed || !box.w || !box.h) return
    const dyed = hsb.h !== 0 || hsb.s !== 0 || hsb.b !== 0
    // 내 착용의 염색을 깔고 그 위에 이 아이템의 염색을 덮는다.
    const ov = new Map(bg.ov)
    if (item.slot === 'skin') {
      // 피부: 몸·머리 레이어(body/arm/head/ear…)만 HSB 로 리컬러 → 라인만 시각적으로 변한다(내 착용 아이템은 그대로).
      if (dyed) for (const p of placed) {
        if (p.slot !== 'body' && p.slot !== 'head') continue
        try { ov.set(p.png, applyHsb(await loadImage(p.png, true), skinHsbFor(hsb, skinDyeFamily(item.name) ?? 5), p.png)) } catch (_) {}
      }
    } else {
      if (!itemMeta) return
      const own = await buildOverrides([itemMeta], { palette: palette ? { [itemMeta.slot]: palette } : {}, hsb: { [itemMeta.slot]: hsb } }, THUMB_VIEW)
      for (const [k, v] of own) ov.set(k, v)
      // 이펙트도 같은 HSB 로 염색해서 보여준다.
      if (dyed) for (const ed of effs) { try { ov.set(ed.png, applyHsb(await loadImage(ed.png, true), hsb, ed.png)) } catch (_) {} }
    }
    const allEffs = bg.effs.length ? [...bg.effs, ...effs] : effs
    // 우측 미리보기/카드와 동일 공식: 마네킹 중앙 고정 + 정수 스냅(선명). 배율은 fraction 에 곱.
    const dpr = window.devicePixelRatio || 1
    const pl = computeModelPlacement({ divW: box.w, divH: box.h, dpr, margin: 1, fraction: fractionFor(box.h), scale: zoomStepScale({ fraction: fractionFor(box.h), divH: box.h, dpr, level: zoom, mults: DIALOG_ZOOM }), snap: true, drop: true })
    const { bw, bh } = canvasBitmap(pl)
    fitCanvas(canvas, canvas.parentElement, bw, bh, box.w, box.h, dpr)
    await renderCharacter(canvas, placed, { scale: pl.scale, box: pl.box, anchor: pl.anchor, override: ov, effects: allEffs })
    shotRef.current = { placed, override: ov, effects: allEffs } // 우클릭 복사용 입력(지금 그린 염색 그대로)
  }, [placed, itemMeta, bg, hsb, palette, effs, zoom, item.slot, box.w, box.h])

  // 우클릭/롱프레스 이미지 메뉴 바인딩.
  useEffect(() => {
    const el = ref.current
    if (!el || !placed) return
    return bindImageMenu(el, () => (shotRef.current ? modelShotBlob(shotRef.current) : Promise.resolve(null)), `pinkbean-${item.name || item.id}`)
  }, [placed, item.name, item.id])

  if (!placed) return <div className="pb-skel" style={{ width: '70%', height: '70%', borderRadius: 8 }} />
  // 캔버스 intrinsic = box×scale. CSS 로 늘리지 않고(1:1) 화면 픽셀 격자에 맞춰 배치(fitCanvas).
  return (
    <span style={{ position: 'relative', width: '100%', height: '100%', display: 'block', overflow: 'hidden' }}>
      <canvas ref={ref} style={{ position: 'absolute', display: 'block', imageRendering: 'pixelated' }} />
    </span>
  )
}
