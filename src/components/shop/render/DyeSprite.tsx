'use client'

// 아이템 스프라이트 캔버스(재활용 — 기존 InfoScreen 에서 로직 그대로 분리).
//  - DyeSprite: 발색 반영 아이템 스프라이트(헤어/성형은 모든 부위 합성 = 염색표와 동일, 그 외는 인벤 스프라이트 + HSB)
//  - SkinModel: 피부(body+head)를 마네킹 중심 기준으로 합성

import { useEffect, useRef, useState } from 'react'
import { assemble, getFrameLayers, type AssembleInput, type PlacedLayer } from '@/lib/core/assemble'
import { loadMeta, type ItemMeta } from '@/lib/core/data'
import { applyHsb, renderDyedSprite, type HsbParams, type PaletteParams } from '@/lib/core/dye'
import { computeModelPlacement } from '@/lib/core/modelPlacement'
import { loadImage, renderCharacter } from '@/lib/core/render'
import { THUMB_VIEW } from '@/lib/shopData'
import { useLiveRedraw } from '../useLiveRedraw'

const hsbActive = (h?: HsbParams) => !!h && (h.h !== 0 || h.s !== 0 || h.b !== 0)

// 채움 비율(스프라이트가 캔버스에서 차지할 큰-변 비율). 원본이 커도 넘치지 않게 맞추고, ≥1배는 정수 스냅으로
// 선명(하드 도트), 축소(<1배)만 부드럽게. 헤어도 bbox 기준으로 맞추므로 같은 채움 비율을 쓴다
// (예전 0.55 는 배율 상한이 있던 시절 보정이라 모바일에서 헤어가 캔버스에 비해 너무 작게 보였다).
export const INFO_FRAC = 0.82
export const INFO_FRAC_HAIR = 0.82
// 피부는 모델(body+head)로 렌더해 중앙 정렬 — fraction 으로 크기 조절(아이콘=작게, 미리보기=크게).
export const SKIN_ICON_FRACTION = 0.72
export const SKIN_PREVIEW_FRACTION = 0.52
function drawSprite(canvas: HTMLCanvasElement, src: CanvasImageSource, w: number, h: number, size: number, frac = INFO_FRAC) {
  canvas.width = size; canvas.height = size
  const ctx = canvas.getContext('2d'); if (!ctx) return
  ctx.clearRect(0, 0, size, size)
  if (!w || !h) return
  const avail = size * frac
  let k = Math.min(avail / w, avail / h)
  if (k >= 1) { k = Math.max(1, Math.min(Math.round(k), Math.floor(Math.min(size / w, size / h)) || 1)); ctx.imageSmoothingEnabled = false }
  else ctx.imageSmoothingEnabled = true // 원본이 큰 경우(피부 전신 등) 분수 축소(부드럽게)
  const dw = Math.round(w * k), dh = Math.round(h * k)
  ctx.drawImage(src, Math.round((size - dw) / 2), Math.round((size - dh) / 2), dw, dh)
}

// 아이템 "스프라이트"(발색 반영) — 아이콘/미리보기 공용. 절대 모델 착용 베이크(thumb.png)를 쓰지 않는다.
//  - 헤어/성형(mix): renderDyedSprite 로 모든 부위 합성 + 팔레트 발색(frac 지정 → 넘침 없이 안정 축소).
//  - 그 외(HSB): 아이템 인벤 스프라이트(sprites/{id}/icon.png)에 Prism HSB 를 적용해 그린다(몸 없이 아이템만).
export function DyeSprite({ id, thumb, mix, palette, hsb, zmap, grayscale = false, frac = INFO_FRAC }: {
  id: string; thumb?: string | null; mix: boolean; palette?: PaletteParams; hsb?: HsbParams; zmap: string[]; grayscale?: boolean; frac?: number
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  const [meta, setMeta] = useState<ItemMeta | null>(null)
  useEffect(() => {
    if (!mix) { setMeta(null); return }
    let a = true
    loadMeta(id).then((m) => { if (a) setMeta(m) }).catch(() => {})
    return () => { a = false }
  }, [id, mix])
  // 드래그 중에도 렉 없이 바로바로 발색(single-flight + 최신값 수렴).
  useLiveRedraw(async () => {
    const el = ref.current; if (!el) return
    const dev = Math.round((el.clientWidth || 48) * (window.devicePixelRatio || 1))
    if (mix) {
      if (!meta) return
      const base = palette?.baseColor ?? 0, mixC = palette?.mixColor ?? base, ratio = palette?.ratio ?? 0
      await renderDyedSprite(el, meta, base, mixC, base === mixC ? 0 : ratio, THUMB_VIEW, zmap, dev, frac)
    } else {
      const rel = thumb || `sprites/${id}/icon.png` // 아이템 스프라이트(모델 베이크 아님)
      const active = hsbActive(hsb)
      const img = await loadImage(rel, active)
      const src: CanvasImageSource = active ? applyHsb(img, hsb!, rel) : img
      drawSprite(el, src, (src as HTMLCanvasElement).width, (src as HTMLCanvasElement).height, dev, frac)
    }
  }, [meta, id, thumb, mix, palette, hsb, zmap, frac])
  return <canvas ref={ref} style={{ width: '100%', height: '100%', imageRendering: 'pixelated', ...(grayscale ? { filter: 'grayscale(1)' } : {}) }} />
}

// 피부 모델: 코디 탭과 동일한 computeModelPlacement 로 body+head(피부 자체)를 마네킹 중심 기준 중앙에 배치해
// 렌더(드로우 bbox 중앙이 아니라 마네킹 중심 → 오른쪽 치우침 없이 제대로 중앙 정렬). 라인만 HSB 로 염색.
// box(표시 정사각 크기)/fraction(마네킹 높이 비율)로 아이콘(작게)·미리보기(크게) 공용.
export function SkinModel({ bodyId, headId, hsb, dyeable, zmap, smap, box, fraction }: {
  bodyId: string; headId: string; hsb: HsbParams; dyeable: boolean; zmap: string[]; smap: Record<string, string>; box: number; fraction: number
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  const [placed, setPlaced] = useState<PlacedLayer[] | null>(null)
  useEffect(() => {
    let alive = true
    ;(async () => {
      const [body, head] = await Promise.all([loadMeta(bodyId), loadMeta(headId)])
      if (!alive) return
      const items: AssembleInput[] = [
        { itemId: body.id, slot: 'body', vslot: null, layers: getFrameLayers(body, THUMB_VIEW) },
        { itemId: head.id, slot: 'head', vslot: null, layers: getFrameLayers(head, THUMB_VIEW) },
      ]
      const { placed: p } = assemble(items, zmap, smap)
      if (alive) setPlaced(p)
    })().catch(() => {})
    return () => { alive = false }
  }, [bodyId, headId, zmap, smap])
  useLiveRedraw(async () => {
    const canvas = ref.current; if (!canvas || !placed) return
    const ov = new Map<string, HTMLCanvasElement>()
    const active = dyeable && hsbActive(hsb)
    if (active) for (const p of placed) { try { ov.set(p.png, applyHsb(await loadImage(p.png, true), hsb, p.png)) } catch (_) {} }
    const dpr = window.devicePixelRatio || 1
    const pl = computeModelPlacement({ divW: box, divH: box, dpr, margin: 1, fraction, snap: true })
    canvas.style.width = pl.canvasCssW + 'px'
    canvas.style.height = pl.canvasCssH + 'px'
    await renderCharacter(canvas, placed, { scale: pl.scale, box: pl.box, anchor: pl.anchor, override: ov })
  }, [placed, hsb, dyeable, box, fraction])
  if (!placed) return <div className="pb-skel" style={{ width: '60%', height: '60%', borderRadius: 10 }} />
  return <canvas ref={ref} style={{ display: 'block', imageRendering: 'pixelated' }} />
}
