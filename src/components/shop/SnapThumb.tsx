'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { type PlacedLayer } from '@/lib/core/assemble'
import { type AnimaRace } from '@/lib/core/data'
import { canvasBitmap, computeModelPlacement, fitCanvas } from '@/lib/core/modelPlacement'
import { renderCharacter, type EffectDraw } from '@/lib/core/render'
import { animaNow, animaOnce, composePeek, composeSnapshotCached, snapKey } from '@/lib/core/snapRender'
import { canvasToSquareBlob } from '@/lib/canvasExport'
import { bindImageMenu } from '@/lib/canvasMenu'
import { CARD_FRACTION, CARD_MARGIN } from '@/lib/shopData'
import { enqueueThumb } from '@/lib/thumbQueue'
import { useShop, type Snapshot } from './ShopContext'

// 스냅샷(착용+톤+염색)을 실제 모델로 합성해 부모 div 중앙에 그린다.
// 코디/미리보기와 동일한 computeModelPlacement 규칙 → 어디서 쓰든 모델 비율이 같다.
// 정지 프레임(stand1) + 염색 + 이펙트(망토 등) 반영 → 이펙트만 있는 망토도 구분된다.
// 프리셋 카드와 닉네임 코디 선택 다이얼로그가 함께 쓴다(같은 그림이어야 하므로 공용).
// 부모는 position:relative + 크기가 있어야 한다(이 컴포넌트는 inset:0 으로 채운다).
// priority: 0 = 보이는 것(곧바로), 1 이상 = 화면 밖 미리 그리기(보이는 것이 다 끝난 뒤) — lib/thumbQueue.
export default function SnapThumb({ snap, fraction = CARD_FRACTION, margin = CARD_MARGIN, priority = 0 }: {
  snap: Snapshot; fraction?: number; margin?: number; priority?: number
}) {
  const { index } = useShop()
  const [placed, setPlaced] = useState<PlacedLayer[] | null>(null)
  const [ov, setOv] = useState<Map<string, HTMLCanvasElement>>(new Map())
  const [effects, setEffects] = useState<EffectDraw[]>([])
  const [dims, setDims] = useState<{ w: number; h: number; dpr: number }>({ w: 0, h: 0, dpr: 1 })
  // 형상변이 목록은 **이미 받아 뒀으면 그 값으로 시작**한다. 빈 배열로 한 번 그린 뒤 목록이 도착해 다시 그리면
  // 카드마다 합성이 두 번 돌았다(2026-09-22 — 광장 필터를 오갈 때 느려진 원인 중 하나).
  const [animaRaces, setAnimaRaces] = useState<AnimaRace[] | null>(animaNow)
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => { if (!animaRaces) animaOnce().then(setAnimaRaces).catch(() => {}) }, [animaRaces])
  const key = useMemo(() => snapKey(snap), [snap])

  const prioRef = useRef(priority)
  prioRef.current = priority
  const jobRef = useRef<ReturnType<typeof enqueueThumb> | null>(null)
  useEffect(() => {
    if (!index || !animaRaces) return
    let alive = true
    const done = (r: { placed: PlacedLayer[]; overrides: Map<string, HTMLCanvasElement>; effects: EffectDraw[] } | null) => {
      if (alive && r) { setPlaced(r.placed); setOv(r.overrides); setEffects(r.effects) }
    }
    // 이미 합성해 둔 코디면 줄(thumbQueue)을 서지 않고 그 자리에서 그린다 — 필터를 오가도 계산이 0 이고
    // 뼈대(스켈레톤)가 한 번 깜빡이지도 않는다.
    const hit = composePeek(key, index, animaRaces)
    if (hit !== undefined) { done(hit); return () => { alive = false } }
    setPlaced(null)
    const job = enqueueThumb(prioRef.current, () => composeSnapshotCached(key, snap, index, animaRaces).then(done))
    jobRef.current = job
    return () => { alive = false; job.cancel() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, index, animaRaces])
  useEffect(() => { jobRef.current?.setPrio(priority) }, [priority])

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
    const p = computeModelPlacement({ divW: dims.w, divH: dims.h, dpr: dims.dpr, margin, fraction, snap: true })
    const { bw, bh } = canvasBitmap(p)
    fitCanvas(canvas, wrapRef.current, bw, bh, dims.w, dims.h, dims.dpr)
    renderCharacter(canvas, placed, { scale: p.scale, box: p.box, anchor: p.anchor, override: ov, effects, shouldCancel: () => cancelled }).catch(() => {})
    return () => { cancelled = true }
  }, [placed, ov, effects, dims, fraction, margin])

  // 우클릭/롱프레스 이미지 메뉴 바인딩(캔버스는 항상 존재).
  useEffect(() => {
    const el = canvasRef.current
    if (!el) return
    return bindImageMenu(el, () => canvasToSquareBlob(el), 'pinkbean-cody')
  }, [])

  return (
    <div ref={wrapRef} style={{ position: 'absolute', inset: 0 }}>
      {!placed && <div className="pb-skel" style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', width: '58%', height: '58%', borderRadius: 8 }} />}
      <canvas ref={canvasRef} style={{ position: 'absolute', transform: 'translateZ(0)', imageRendering: 'pixelated', display: 'block', backfaceVisibility: 'hidden' }} />
    </div>
  )
}
