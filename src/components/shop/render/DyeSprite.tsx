'use client'

// 아이템 스프라이트 캔버스(재활용 — 기존 InfoScreen 에서 로직 그대로 분리).
//  - DyeSprite: 발색 반영 아이템 스프라이트(헤어/성형은 모든 부위 합성 = 염색표와 동일, 그 외는 인벤 스프라이트 + HSB)
//  - SkinModel: 피부(body+head)를 마네킹 중심 기준으로 합성

import { useEffect, useRef, useState } from 'react'
import { assemble, getFrameLayers, type AssembleInput, type PlacedLayer } from '@/lib/core/assemble'
import { loadMeta, type ItemMeta } from '@/lib/core/data'
import { applyHsb, renderDyedSprite, skinLineHsb, type HsbParams, type PaletteParams } from '@/lib/core/dye'
import { canvasBitmap, computeModelPlacement, fitCanvas } from '@/lib/core/modelPlacement'
import { loadImage, renderCharacter } from '@/lib/core/render'
import { THUMB_VIEW } from '@/lib/shopData'
import { useLiveRedraw } from '../useLiveRedraw'

const hsbActive = (h?: HsbParams) => !!h && (h.h !== 0 || h.s !== 0 || h.b !== 0)

// 채움 비율(스프라이트가 칸에서 차지할 큰-변 비율). 원본이 커도 넘치지 않게 맞추고, 확대는 정수배만
// (하드 도트), 축소(<1배)만 부드럽게. 헤어도 bbox 기준으로 맞추므로 같은 채움 비율을 쓴다
// (예전 0.55 는 배율 상한이 있던 시절 보정이라 모바일에서 헤어가 캔버스에 비해 너무 작게 보였다).
export const INFO_FRAC = 0.82
export const INFO_FRAC_HAIR = 0.82
// 리스트 카드의 헤어·성형(합성 스프라이트)이 칸에서 차지할 큰-변 비율. 코디 정보 탭(INFO_FRAC_HAIR)보다
// 작다 — 카드에서는 "큐링 헤어 정도"가 적당하다는 사용자 판단(2026-09-21).
export const CARD_FRAC_HAIR = 0.68
// 헤어·성형은 화면 픽셀보다 촘촘하게 그린 뒤 그만큼 줄여서 보여 준다(아래 useLiveRedraw 주석).
// 어느 기기에서나 캔버스 해상도가 칸의 4배가 되도록 DPR 로 나눈다(DPR1=4배·DPR2=2배·DPR4=1배).
const oversampleFor = (dpr: number) => Math.max(1, Math.round(4 / dpr))
// 피부는 모델(body+head)로 렌더해 중앙 정렬 — fraction 으로 크기 조절(아이콘=작게, 미리보기=크게).
export const SKIN_ICON_FRACTION = 0.72
export const SKIN_PREVIEW_FRACTION = 0.52
// 아이콘 그리기 — 칸에 맞춰 **정수 배율**로만 키운다(사용자 지시 2026-09-20).
//  - 캔버스를 칸 크기로 잡고 그 안에 그리면(예전) 반올림 때문에 채움 비율을 넘고, 캔버스 픽셀 수가
//    화면 픽셀과 어긋나(DPR 1.25·1.5) 도트가 뭉개졌다 — VS 칩에서 특히 심했다.
//  - 지금은 캔버스 자체가 "그린 그림 크기"다: 화면 배율 = floor(칸 맞춤 배율) 정수, 캔버스 픽셀 = 그 × DPR,
//    CSS 크기·위치는 fitCanvas 가 화면 픽셀 격자에 맞춘다(모든 미리보기 공통 규칙).
//  - 원본이 칸보다 큰 경우(피부 전신 베이크 등)만 분수 축소(부드럽게).
function drawSprite(canvas: HTMLCanvasElement, src: CanvasImageSource, w: number, h: number, boxW: number, boxH: number, frac = INFO_FRAC, dpr = 1) {
  const ctx = canvas.getContext('2d'); if (!ctx) return
  if (!w || !h || !boxW || !boxH) { canvas.width = 0; canvas.height = 0; return }
  const fit = Math.min((boxW * frac) / w, (boxH * frac) / h) // 칸(CSS) 안에 들어가는 배율
  // 화면 배율은 정수(1·2·3…)라 어느 기기에서도 같은 크기로 보이고, 캔버스 픽셀 배율(정수 × DPR)은 화면 픽셀 격자에 맞는다.
  const zoom = fit >= 1 ? Math.max(1, Math.round(Math.floor(fit) * dpr)) : fit * dpr
  const dw = Math.max(1, Math.round(w * zoom)), dh = Math.max(1, Math.round(h * zoom))
  canvas.width = dw; canvas.height = dh // 크기를 바꾸면 컨텍스트 상태가 초기화되므로 스무딩은 그 뒤에 설정
  ctx.imageSmoothingEnabled = fit < 1
  ctx.drawImage(src, 0, 0, dw, dh)
}

// 아이템 "스프라이트"(발색 반영) — 아이콘/미리보기 공용. 절대 모델 착용 베이크(thumb.png)를 쓰지 않는다.
//  - 헤어/성형(mix): renderDyedSprite 로 모든 부위 합성 + 팔레트 발색(frac 지정 → 넘침 없이 안정 축소).
//  - 그 외(HSB): 아이템 인벤 스프라이트(sprites/{id}/icon.png)에 Prism HSB 를 적용해 그린다(몸 없이 아이템만).
export function DyeSprite({ id, thumb, mix, palette, hsb, zmap, grayscale = false, frac = INFO_FRAC }: {
  id: string; thumb?: string | null; mix: boolean; palette?: PaletteParams; hsb?: HsbParams; zmap: string[]; grayscale?: boolean; frac?: number
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  const boxRef = useRef<HTMLSpanElement>(null)
  const [meta, setMeta] = useState<ItemMeta | null>(null)
  const [box, setBox] = useState({ w: 0, h: 0 })
  useEffect(() => {
    if (!mix) { setMeta(null); return }
    let a = true
    loadMeta(id).then((m) => { if (a) setMeta(m) }).catch(() => {})
    return () => { a = false }
  }, [id, mix])
  // 칸 크기를 재고, 바뀌면(다이얼로그 전환·화면 회전 등) 그 크기로 다시 그린다 — 예전엔 처음 잰 크기로만 그려
  // 나중에 커진 칸에서는 CSS 가 캔버스를 늘려 도트가 깨졌다. 캔버스는 그림 크기로 줄어드므로 바깥 칸을 잰다.
  useEffect(() => {
    const el = boxRef.current
    if (!el) return
    const measure = () => setBox((p) => (p.w === el.clientWidth && p.h === el.clientHeight ? p : { w: el.clientWidth, h: el.clientHeight }))
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  // 드래그 중에도 렉 없이 바로바로 발색(single-flight + 최신값 수렴).
  useLiveRedraw(async () => {
    const el = ref.current; if (!el) return
    const dpr = window.devicePixelRatio || 1
    const boxW = box.w || 48, boxH = box.h || box.w || 48 // CSS 픽셀(칸)
    let over = 1
    if (mix) {
      if (!meta) return
      const base = palette?.baseColor ?? 0, mixC = palette?.mixColor ?? base, ratio = palette?.ratio ?? 0
      // 0.25 단계 배율(2026-09-21 사용자 지시 — 카드마다 헤어 크기가 널뛰었다).
      // 정수 배율만 쓰면 칸에 맞는 배율이 1.6배여도 1배로 내려가(2배는 칸을 넘친다) 칸의 절반만 찼다.
      // 그래서 **칸의 4배 해상도로 정수 배율로 그린 뒤 화면에는 정확히 1/4 로** 보여 준다(정수배 축소라
      // 도트가 뭉개지지 않는다). 쓸 수 있는 배율이 0.25·0.5·0.75… 로 촘촘해져 크기가 고르게 모인다.
      over = oversampleFor(dpr)
      await renderDyedSprite(el, meta, base, mixC, base === mixC ? 0 : ratio, THUMB_VIEW, zmap, Math.round(Math.min(boxW, boxH) * dpr) * over, frac)
    } else {
      const rel = thumb || `sprites/${id}/icon.png` // 아이템 스프라이트(모델 베이크 아님)
      const active = hsbActive(hsb)
      const img = await loadImage(rel, active)
      const src: CanvasImageSource = active ? applyHsb(img, hsb!, rel) : img
      drawSprite(el, src, (src as HTMLCanvasElement).width, (src as HTMLCanvasElement).height, boxW, boxH, frac, dpr)
    }
    fitCanvas(el, boxRef.current, el.width / over, el.height / over, boxW, boxH, dpr)
  }, [meta, id, thumb, mix, palette, hsb, zmap, frac, box.w, box.h])
  // 바깥 span = 칸(크기 측정 기준), 캔버스 = 그린 그림 크기로 화면 픽셀 격자에 맞춰 가운데(fitCanvas).
  return (
    <span ref={boxRef} style={{ position: 'relative', display: 'block', width: '100%', height: '100%' }}>
      <canvas ref={ref} style={{ position: 'absolute', display: 'block', imageRendering: 'pixelated', ...(grayscale ? { filter: 'grayscale(1)' } : {}) }} />
    </span>
  )
}

// 피부 모델: 코디 탭과 동일한 computeModelPlacement 로 body+head(피부 자체)를 마네킹 중심 기준 중앙에 배치해
// 렌더(드로우 bbox 중앙이 아니라 마네킹 중심 → 오른쪽 치우침 없이 제대로 중앙 정렬). 라인만 HSB 로 염색.
// box(표시 정사각 크기)/fraction(마네킹 높이 비율)로 아이콘(작게)·미리보기(크게) 공용.
export function SkinModel({ bodyId, headId, hsb, dyeable, zmap, smap, box, fraction }: {
  bodyId: string; headId: string; hsb: HsbParams; dyeable: boolean; zmap: string[]; smap: Record<string, string>; box: number; fraction: number
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLSpanElement>(null)
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
    if (active) for (const p of placed) { try { ov.set(p.png, applyHsb(await loadImage(p.png, true), skinLineHsb(hsb!), p.png)) } catch (_) {} }
    const dpr = window.devicePixelRatio || 1
    const pl = computeModelPlacement({ divW: box, divH: box, dpr, margin: 1, fraction, snap: true })
    await renderCharacter(canvas, placed, { scale: pl.scale, box: pl.box, anchor: pl.anchor, override: ov })
    const { bw, bh } = canvasBitmap(pl)
    fitCanvas(canvas, wrapRef.current, bw, bh, box, box, dpr)
  }, [placed, hsb, dyeable, box, fraction])
  if (!placed) return <div className="pb-skel" style={{ width: '60%', height: '60%', borderRadius: 10 }} />
  return (
    <span ref={wrapRef} style={{ position: 'relative', display: 'block', width: '100%', height: '100%' }}>
      <canvas ref={ref} style={{ position: 'absolute', display: 'block', imageRendering: 'pixelated' }} />
    </span>
  )
}
