'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { assemble, getFrameLayers, type AssembleInput, type PlacedLayer } from '@/lib/core/assemble'
import { loadAnima, loadMeta, type AnimaRace, type ItemMeta } from '@/lib/core/data'
import { applyHsb, buildOverrides } from '@/lib/core/dye'
import { computeModelPlacement } from '@/lib/core/modelPlacement'
import { effectDraws, loadImage, renderCharacter, type EffectDraw } from '@/lib/core/render'
import { collectWornEffects } from '@/lib/core/thumbEffects'
import { CARD_FRACTION, CARD_MARGIN, animaLayers, isColorLineSkin, thumbView } from '@/lib/shopData'
import { PV_SNAP_DEFAULT, useShop, type Snapshot } from './ShopContext'

// 스냅샷(착용+톤+염색)을 실제 모델로 합성해 부모 div 중앙에 그린다.
// 코디/미리보기와 동일한 computeModelPlacement 규칙 → 어디서 쓰든 모델 비율이 같다.
// 정지 프레임(stand1) + 염색 + 이펙트(망토 등) 반영 → 이펙트만 있는 망토도 구분된다.
// 프리셋 카드와 닉네임 코디 선택 다이얼로그가 함께 쓴다(같은 그림이어야 하므로 공용).
// 부모는 position:relative + 크기가 있어야 한다(이 컴포넌트는 inset:0 으로 채운다).
export default function SnapThumb({ snap, fraction = CARD_FRACTION, margin = CARD_MARGIN }: {
  snap: Snapshot; fraction?: number; margin?: number
}) {
  const { index } = useShop()
  const [placed, setPlaced] = useState<PlacedLayer[] | null>(null)
  const [ov, setOv] = useState<Map<string, HTMLCanvasElement>>(new Map())
  const [effects, setEffects] = useState<EffectDraw[]>([])
  const [dims, setDims] = useState<{ w: number; h: number; dpr: number }>({ w: 0, h: 0, dpr: 1 })
  const [animaRaces, setAnimaRaces] = useState<AnimaRace[]>([])
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => { loadAnima().then(setAnimaRaces).catch(() => {}) }, [])
  // 프리셋은 "저장된 연출설정(snap.pv)"을 쓴다(형상변이·귀·무기모션·이펙트토글). 시선은 적용 안 함(왼쪽 고정).
  const spv = snap.pv ?? PV_SNAP_DEFAULT
  const key = useMemo(() => JSON.stringify(snap) + `|${animaRaces.length}`, [snap, animaRaces.length])

  useEffect(() => {
    if (!index) return
    let alive = true
    setPlaced(null)
    ;(async () => {
      const te = index.base.tones.find((t) => t.tone === snap.tone) || index.base.tones[0]
      if (!te) return
      const [bodyMeta, headMeta] = await Promise.all([loadMeta(te.body), loadMeta(te.head)])
      const equipMetas: { slot: string; meta: ItemMeta }[] = []
      for (const [slot, id] of Object.entries(snap.equipped)) {
        if (snap.hidden?.[slot] || !id) continue
        const m = await loadMeta(id).catch(() => null)
        if (m) equipMetas.push({ slot, meta: m })
      }
      if (!alive) return
      // 표정 얼굴장식(fixedEmotion)이 프리셋에 들어있으면 그 표정으로 굳는다. 없으면 종전대로 THUMB_VIEW.
      // 프리셋 스냅샷은 id 만 담으므로 표정은 meta 에서 읽는다.
      const snapExpr = equipMetas.find(({ meta }) => meta.fixedEmotion)?.meta.fixedEmotion
      // 시선=왼쪽 고정(gaze='left' → action=stand1, flip 없음) + 저장된 귀/무기모션 반영.
      const TV = thumbView('left', snapExpr, spv.ear, spv.weapon).view
      const items: AssembleInput[] = [
        { itemId: bodyMeta.id, slot: 'body', vslot: null, layers: getFrameLayers(bodyMeta, TV) },
        { itemId: headMeta.id, slot: 'head', vslot: null, layers: getFrameLayers(headMeta, TV) },
        // name 은 투명 아이템 판별에 쓰인다 — 없으면 투명 모자/장식이 헤어·얼굴을 가려 구멍이 생긴다.
        ...equipMetas.map(({ slot, meta }) => ({ itemId: meta.id, slot, vslot: meta.vslot ?? null, layers: getFrameLayers(meta, TV), invisibleFace: meta.invisibleFace, name: meta.name })),
        ...animaLayers(spv.form, animaRaces), // 형상변이 — 프리셋에 저장된 값
      ]
      const { placed: p, anchors } = assemble(items, index.zmap, index.smap)
      // 염색: 착용 아이템(팔레트/HSB) + 컬러라인 피부 라인. (옛 프리셋엔 dye 키가 없을 수 있어 방어)
      const overrides = await buildOverrides(equipMetas.map((e) => e.meta), { palette: snap.dyePalette || {}, hsb: snap.dyeHsb || {} }, TV)
      const skinHsb = (snap.dyeHsb || {})['skin']
      if (skinHsb && (skinHsb.h || skinHsb.s || skinHsb.b) && isColorLineSkin(te.name)) {
        for (const meta of [bodyMeta, headMeta]) for (const l of getFrameLayers(meta, TV)) {
          try { overrides.set(l.png, applyHsb(await loadImage(l.png, true), skinHsb, l.png)) } catch (_) {}
        }
      }
      // 이펙트(망토 등 ItemEff): 착용 아이템의 이펙트를 정지 프레임0으로 합성.
      const curBody = p.find((pl) => pl.slot === 'body' && pl.name === 'body')
      const bnav = curBody?.map?.navel
      const foot = { x: bnav ? -bnav.x : 8, y: bnav ? -bnav.y : 21 }
      const brow = anchors.brow ? { x: anchors.brow.x, y: anchors.brow.y } : foot
      const worn = await collectWornEffects(equipMetas.map(({ slot, meta }) => ({ slot, id: meta.id })), spv, snap.dyeHsb || {}, overrides).catch(() => [])
      const effDraws: EffectDraw[] = worn.flatMap(({ em }) => effectDraws(em, TV.action, { foot, brow }, 0))
      if (alive) { setPlaced(p); setOv(overrides); setEffects(effDraws) }
    })().catch(() => {})
    return () => { alive = false }
  }, [key, index, animaRaces, spv])

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
    canvas.style.width = p.canvasCssW + 'px'
    canvas.style.height = p.canvasCssH + 'px'
    renderCharacter(canvas, placed, { scale: p.scale, box: p.box, anchor: p.anchor, override: ov, effects, shouldCancel: () => cancelled }).catch(() => {})
    return () => { cancelled = true }
  }, [placed, ov, effects, dims, fraction, margin])

  return (
    <div ref={wrapRef} style={{ position: 'absolute', inset: 0 }}>
      {!placed && <div className="pb-skel" style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', width: '58%', height: '58%', borderRadius: 8 }} />}
      <canvas ref={canvasRef} style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%) translateZ(0)', imageRendering: 'pixelated', display: 'block', backfaceVisibility: 'hidden' }} />
    </div>
  )
}
