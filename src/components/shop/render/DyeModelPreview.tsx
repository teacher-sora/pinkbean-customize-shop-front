'use client'

// 염색(HSB) 미리보기 캔버스(재활용 — 기존 DyeDialog 의 DyeModelPreview 로직 그대로 분리).
// 베이스 모델(몸+머리)에 이 아이템을 입힌 뒤 HSB 발색을 실시간 적용. box 는 표시 영역 크기(측정값).

import { useEffect, useRef, useState } from 'react'
import { assemble, getFrameLayers, type AssembleInput, type PlacedLayer } from '@/lib/core/assemble'
import { loadEffect, loadEffectIndex, loadMeta, type ItemMeta, type ListItem } from '@/lib/core/data'
import { applyHsb, buildOverrides, type HsbParams } from '@/lib/core/dye'
import { computeModelPlacement, zoomStepScale } from '@/lib/core/modelPlacement'
import { effectDraws, loadImage, renderCharacter, type EffectDraw } from '@/lib/core/render'
import { canvasToSquareBlob } from '@/lib/canvasExport'
import { bindImageMenu } from '@/lib/canvasMenu'
import { THUMB_VIEW } from '@/lib/shopData'
import { useShop } from '../ShopContext'
import { useLiveRedraw } from '../useLiveRedraw'

// 우측 미리보기/카드와 동일한 computeModelPlacement 공식 사용(마네킹 중앙 고정 + 정수 스냅으로 항상 선명).
// 배율(1x/2x/3x)은 fraction 에 곱하는 월드 배율.
const DIALOG_FRACTION = 0.33
// 모바일 시트처럼 낮은 미리보기 상자(≈150~260px)에선 높이의 1/3이면 캐릭터가 50px 안팎으로 작다 → 낮은 상자는 비율을 올린다.
const fractionFor = (h: number) => (h < 300 ? 0.5 : DIALOG_FRACTION)
const DIALOG_ZOOM: Record<number, number> = { 1: 0.6, 2: 1.0, 3: 1.6 }

export default function DyeModelPreview({ item, hsb, zoom, box }: { item: ListItem; hsb: HsbParams; zoom: number; box: { w: number; h: number } }) {
  const s = useShop()
  const ref = useRef<HTMLCanvasElement>(null)
  const [placed, setPlaced] = useState<PlacedLayer[] | null>(null)
  const [itemMeta, setItemMeta] = useState<ItemMeta | null>(null)
  const [effs, setEffs] = useState<EffectDraw[]>([]) // 이 아이템의 이펙트(정적 대표 프레임)

  useEffect(() => {
    const idx = s.index; if (!idx) return
    let alive = true
    ;(async () => {
      // 피부(컬러라인) 염색: 오버레이 아이템 없이 이 피부의 body+head 자체를 그린다. 라인만 HSB 로 변한다.
      if (item.slot === 'skin') {
        const [body, head] = await Promise.all([loadMeta(item.id), loadMeta(item.headId!)])
        if (!alive) return
        setItemMeta(null); setEffs([])
        const items: AssembleInput[] = [
          { itemId: body.id, slot: 'body', vslot: null, layers: getFrameLayers(body, THUMB_VIEW) },
          { itemId: head.id, slot: 'head', vslot: null, layers: getFrameLayers(head, THUMB_VIEW) },
        ]
        const { placed: p } = assemble(items, idx.zmap, idx.smap)
        if (alive) setPlaced(p)
        return
      }
      const te = idx.base.tones.find((t) => t.tone === s.tone) || idx.base.tones.find((t) => t.tone === idx.base.default) || idx.base.tones[0]
      const [body, head, im] = await Promise.all([loadMeta(te.body), loadMeta(te.head), loadMeta(item.id)])
      if (!alive) return
      setItemMeta(im)
      const items: AssembleInput[] = [
        { itemId: body.id, slot: 'body', vslot: null, layers: getFrameLayers(body, THUMB_VIEW) },
        { itemId: head.id, slot: 'head', vslot: null, layers: getFrameLayers(head, THUMB_VIEW) },
        { itemId: im.id, slot: im.slot, vslot: im.vslot ?? null, layers: getFrameLayers(im, THUMB_VIEW), invisibleFace: im.invisibleFace, name: im.name },
      ]
      const { placed: p, anchors } = assemble(items, idx.zmap, idx.smap)
      setPlaced(p)
      // 아이템 이펙트(망토/무기 등) — 정적 대표 프레임. 있으면 합성해서 보여준다.
      const bare = String(parseInt(item.id, 10))
      const eidx = await loadEffectIndex().catch(() => new Set<string>())
      if (alive && eidx.has(bare)) {
        const em = await loadEffect(item.id).catch(() => null)
        const bp = p.find((x) => x.name === 'body')
        const foot = bp ? { x: bp.x + bp.origin.x, y: bp.y + bp.origin.y } : { x: 8, y: 21 }
        setEffs(em ? effectDraws(em, THUMB_VIEW.action, { foot, brow: anchors.brow ?? foot }, 0) : [])
      } else if (alive) setEffs([])
    })().catch(() => {})
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.index, s.tone, item.id])

  // 슬라이더 드래그 중에도 렉 없이 바로바로 발색(single-flight + 최신값 수렴).
  useLiveRedraw(async () => {
    const canvas = ref.current; if (!canvas || !placed || !box.w || !box.h) return
    const dyed = hsb.h !== 0 || hsb.s !== 0 || hsb.b !== 0
    let ov: Map<string, HTMLCanvasElement>
    if (item.slot === 'skin') {
      // 피부: 그려진 모든 레이어(body/arm/head/ear…)를 HSB 로 리컬러 → 라인만 시각적으로 변한다.
      ov = new Map()
      if (dyed) for (const p of placed) { try { ov.set(p.png, applyHsb(await loadImage(p.png, true), hsb, p.png)) } catch (_) {} }
    } else {
      if (!itemMeta) return
      ov = await buildOverrides([itemMeta], { palette: {}, hsb: { [itemMeta.slot]: hsb } }, THUMB_VIEW)
      // 이펙트도 같은 HSB 로 염색해서 보여준다.
      if (dyed) for (const ed of effs) { try { ov.set(ed.png, applyHsb(await loadImage(ed.png, true), hsb, ed.png)) } catch (_) {} }
    }
    // 우측 미리보기/카드와 동일 공식: 마네킹 중앙 고정 + 정수 스냅(선명). 배율은 fraction 에 곱.
    const dpr = window.devicePixelRatio || 1
    const pl = computeModelPlacement({ divW: box.w, divH: box.h, dpr, margin: 1, fraction: fractionFor(box.h), scale: zoomStepScale({ fraction: fractionFor(box.h), divH: box.h, dpr, level: zoom, mults: DIALOG_ZOOM }), snap: true })
    canvas.style.width = pl.canvasCssW + 'px'
    canvas.style.height = pl.canvasCssH + 'px'
    await renderCharacter(canvas, placed, { scale: pl.scale, box: pl.box, anchor: pl.anchor, override: ov, effects: effs })
  }, [placed, itemMeta, hsb, effs, zoom, item.slot, box.w, box.h])

  // 우클릭/롱프레스 이미지 메뉴 바인딩.
  useEffect(() => {
    const el = ref.current
    if (!el || !placed) return
    return bindImageMenu(el, () => canvasToSquareBlob(el), `pinkbean-${item.name || item.id}`)
  }, [placed, item.name, item.id])

  if (!placed) return <div className="pb-skel" style={{ width: '70%', height: '70%', borderRadius: 12 }} />
  // 캔버스 intrinsic = box×scale. CSS 로 늘리지 않고 그대로(1:1) 보여줘 도트가 깨끗하게 유지된다.
  return <canvas ref={ref} style={{ display: 'block', imageRendering: 'pixelated' }} />
}
