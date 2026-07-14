'use client'

/*
 * ItemThumb — 아이템 리스트 셀의 3가지 표시 모드.
 *  - sprite  : 아이템 아이콘/스프라이트 이미지(가장 가벼움)
 *  - model   : 베이스 몸통+머리에 이 아이템을 올린 미니 합성
 *  - mymodel : 현재 내 착용(해당 슬롯 제외)에 이 아이템을 올린 미니 합성
 * 이 아이템에 이펙트가 있으면(effects/index.json) 함께 합성한다. centerX 로 sprite 처럼 정중앙 정렬.
 */

import { useEffect, useRef, useState } from 'react'
import { assemble, getFrameLayers, type AssembleInput, type PlacedLayer } from '@/lib/core/assemble'
import { loadEffect, loadEffectIndex, loadMeta, spriteUrl, type ListItem } from '@/lib/core/data'
import { MODEL_REF, computeModelPlacement } from '@/lib/core/modelPlacement'
import { effectDraws, renderCharacter, type EffectDraw } from '@/lib/core/render'
import { CARD_FRACTION, CARD_MARGIN, thumbView } from '@/lib/shopData'
import type { ListMode } from './ShopContext'

// 모델/내모델 썸네일: computeModelPlacement 로 셀(div) 크기·dpr 에 맞춰 캔버스를 셀보다 크게(디바이스
// 픽셀 해상도) 만들고, 마네킹을 셀 중앙에 고정 비율로 그린다. 캔버스는 셀 위에 절대배치 중앙정렬 →
// 셀 overflow:hidden 으로만 잘린다. 셀 크기와 무관하게 모델은 항상 같은 비율, 도트는 디바이스 픽셀 nearest.

const TARGET_FRAC = 0.82 // 스프라이트 큰 변을 셀 짧은변의 이 비율로 정규화(값↑=더 크게)

function Sprite({ item }: { item: ListItem }) {
  const sources: string[] = []
  if (item.icon) sources.push(spriteUrl(item.icon))
  if (item.thumb) sources.push(spriteUrl(item.thumb))
  sources.push(spriteUrl(`sprites/${item.id}/thumb.png`))
  const [idx, setIdx] = useState(0)
  const wrapRef = useRef<HTMLDivElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  useEffect(() => { setIdx(0) }, [item.id])

  // 아이템 스프라이트는 원본 크기가 천차만별 → "셀 채우기(fit)"로 잡으면 크기가 제각각이 된다. 대신 각
  // 스프라이트의 큰 변을 목표 크기(셀 짧은변 × TARGET_FRAC)에 가깝게 만드는 "정수 배율"을 골라 원본 크기와
  // 무관하게 비슷한 크기로 정규화하고, 정수 배율(nearest)이라 도트 선명도는 유지. (정수 특성상 target 근처로
  // 군집; 셀보다 큰 원본은 1배로 두어 넘침만 overflow:hidden 으로 클립.)
  const fitIcon = () => {
    const wrap = wrapRef.current, img = imgRef.current
    if (!wrap || !img || !img.naturalWidth || !wrap.clientWidth) return
    const cw = wrap.clientWidth, ch = wrap.clientHeight
    const nw = img.naturalWidth, nh = img.naturalHeight
    const target = TARGET_FRAC * Math.min(cw, ch)          // 큰 변을 이 크기에 맞춤(정규화 목표)
    const fitK = Math.min(cw / nw, ch / nh)                // 셀에 들어가는 최대 배율
    let k = Math.round(target / Math.max(nw, nh))          // 목표에 가장 가까운 정수 배율
    k = Math.max(1, Math.min(k, Math.floor(fitK) || 1))    // 셀 초과 방지(원본이 셀보다 크면 1배)
    img.style.width = nw * k + 'px'
    img.style.height = nh * k + 'px'
  }
  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap) return
    const ro = new ResizeObserver(fitIcon); ro.observe(wrap)
    window.addEventListener('resize', fitIcon)
    return () => { ro.disconnect(); window.removeEventListener('resize', fitIcon) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (idx >= sources.length) return null
  return (
    <div ref={wrapRef} style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
      <img ref={imgRef} src={sources[idx]} alt={item.name || item.id} loading="lazy" decoding="async" draggable={false}
        onLoad={fitIcon} onError={() => setIdx((i) => i + 1)}
        style={{ imageRendering: 'pixelated', display: 'block', transform: 'translateZ(0)', backfaceVisibility: 'hidden' }} />
    </div>
  )
}

interface ModelProps {
  item: ListItem; gaze: string; ctxItems: AssembleInput[]; ctxKey: string
  zmap: string[]; smap: Record<string, string>; skinHeadId?: string
}
function ModelThumb({ item, gaze, ctxItems, ctxKey, zmap, smap, skinHeadId }: ModelProps) {
  const [placed, setPlaced] = useState<PlacedLayer[] | null>(null)
  const [effs, setEffs] = useState<EffectDraw[]>([])
  const [dims, setDims] = useState<{ w: number; h: number; dpr: number }>({ w: 0, h: 0, dpr: 1 })
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { view, flip } = thumbView(gaze) // 시선(왼/오/뒷) 반영

  useEffect(() => {
    let alive = true
    setPlaced(null); setEffs([])
    ;(async () => {
      let self: AssembleInput[]
      if (item.slot === 'skin' && skinHeadId) {
        const [body, head] = await Promise.all([loadMeta(item.id), loadMeta(skinHeadId)])
        self = [
          { itemId: head.id, slot: 'head', vslot: null, layers: getFrameLayers(head, view) },
          { itemId: body.id, slot: 'body', vslot: null, layers: getFrameLayers(body, view) },
        ]
      } else {
        const m = await loadMeta(item.id)
        self = [{ itemId: m.id, slot: m.slot, vslot: m.vslot ?? null, layers: getFrameLayers(m, view), invisibleFace: m.invisibleFace }]
      }
      if (!alive) return
      const { placed: p, anchors } = assemble([...ctxItems, ...self], zmap, smap)
      setPlaced(p)
      // 이 아이템 자체의 이펙트(망토 등) — 정적 대표 프레임.
      if (item.slot !== 'skin') {
        const bare = String(parseInt(item.id, 10))
        const eidx = await loadEffectIndex().catch(() => new Set<string>())
        if (alive && eidx.has(bare)) {
          const em = await loadEffect(item.id).catch(() => null)
          if (em && alive) {
            const bp = p.find((x) => x.name === 'body')
            const foot = bp ? { x: bp.x + bp.origin.x, y: bp.y + bp.origin.y } : { x: 8, y: 21 }
            setEffs(effectDraws(em, view.action, { foot, brow: anchors.brow ?? foot }, 0))
          }
        }
      }
    })().catch(() => {})
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id, ctxKey, skinHeadId, gaze])

  // 셀(div) 표시크기 + dpr 실측. dpr 변경(브라우저 줌/모니터 이동)은 window resize 로도 잡는다.
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const measure = () => {
      const w = el.clientWidth, h = el.clientHeight, dpr = window.devicePixelRatio || 1
      if (w > 0 && h > 0) setDims((d) => (d.w === w && d.h === h && d.dpr === dpr ? d : { w, h, dpr }))
    }
    measure()
    const ro = new ResizeObserver(measure); ro.observe(el)
    window.addEventListener('resize', measure)
    return () => { ro.disconnect(); window.removeEventListener('resize', measure) }
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !placed || !dims.w || !dims.h) return
    let cancelled = false
    const back = gaze === 'back'
    // snap: 배율을 정수로 스냅해 카드 도트가 항상 완전히 선명(모든 카드 동일, 화면 크기별로만 살짝 다름).
    const p = computeModelPlacement({ divW: dims.w, divH: dims.h, dpr: dims.dpr, margin: CARD_MARGIN, fraction: CARD_FRACTION, snap: true, centerDx: back ? MODEL_REF.backDx : MODEL_REF.centerDx, centerDy: back ? MODEL_REF.backDy : MODEL_REF.centerDy })
    canvas.style.width = p.canvasCssW + 'px'
    canvas.style.height = p.canvasCssH + 'px'
    // 마네킹 중심을 셀 중앙에 고정(anchor 보정). flip=오른쪽 시선. 분수 scale=디바이스 해상도.
    renderCharacter(canvas, placed, { scale: p.scale, box: p.box, anchor: p.anchor, flip, effects: effs, shouldCancel: () => cancelled }).catch(() => {})
    return () => { cancelled = true }
  }, [placed, effs, flip, dims, gaze])

  return (
    <div ref={wrapRef} style={{ position: 'absolute', inset: 0 }}>
      {!placed && <div className="pb-skel" style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', width: '62%', height: '62%', borderRadius: 8 }} />}
      {/* 셀보다 큰 캔버스를 절대배치 중앙정렬 → 셀 overflow:hidden 으로만 잘린다. */}
      <canvas ref={canvasRef} style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%) translateZ(0)', imageRendering: 'pixelated', display: 'block', backfaceVisibility: 'hidden' }} />
    </div>
  )
}

export default function ItemThumb(props: {
  item: ListItem; mode: ListMode; gaze: string; ctxItems: AssembleInput[]; ctxKey: string
  zmap: string[]; smap: Record<string, string>; skinHeadId?: string
}) {
  if (props.mode === 'sprite') return <Sprite item={props.item} />
  return <ModelThumb item={props.item} gaze={props.gaze} ctxItems={props.ctxItems} ctxKey={props.ctxKey} zmap={props.zmap} smap={props.smap} skinHeadId={props.skinHeadId} />
}
