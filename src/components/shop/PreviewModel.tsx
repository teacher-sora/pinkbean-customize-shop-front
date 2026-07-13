'use client'

/*
 * PreviewModel — 실제 스프라이트 합성 미리보기(자체완결, 고성능).
 *  - 프레임을 "미리 조립"(spec)해 두고, 이미지 프리로드 후 명령형 rAF 루프로 캔버스에 직접 그린다
 *    → 애니메이션/이펙트 중 React 리렌더 없음(부드럽고 렉 없음).
 *  - navel 고정 + stabOffset + centerX(body navel 중심)로 장비/프레임 무관하게 중앙 고정.
 *  - 아이템 이펙트(ItemEff)와 형상변이(anima) 합성. 뒷쪽=rope 첫 프레임 정지.
 * ⚠️ 다음 단계: 염색 시각화(dye.buildOverrides).
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { assemble, frameDelays, getFrameLayers, type AssembleInput } from '@/lib/core/assemble'
import { loadAnima, loadEffect, loadEffectIndex, loadMeta, type AnimaRace, type EffectMeta, type ItemMeta } from '@/lib/core/data'
import { effectDraws, preload, renderCharacter } from '@/lib/core/render'
import { MAIN_ANCHOR, MAIN_BOX, MOVE_POSTURE_ACTIONS, ZOOM_RENDER_SCALE, animaSpec, buildView, frameAtElapsed, frameAtElapsedAlt } from '@/lib/shopData'
import { useShop } from './ShopContext'
import styles from './PreviewModel.module.css'

export default function PreviewModel() {
  const { index, equipped, hidden, tone, pv } = useShop()
  const [metas, setMetas] = useState<Map<string, ItemMeta>>(new Map())
  const [effectIndex, setEffectIndex] = useState<Set<string>>(new Set())
  const [effMetas, setEffMetas] = useState<Map<string, EffectMeta>>(new Map())
  const [animaRaces, setAnimaRaces] = useState<AnimaRace[]>([])
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const toneEntry = index
    ? index.base.tones.find((t) => t.tone === tone) || index.base.tones.find((t) => t.tone === index.base.default) || index.base.tones[0]
    : null
  const bodyId = toneEntry?.body
  const headId = toneEntry?.head

  useEffect(() => { loadEffectIndex().then(setEffectIndex).catch(() => {}) }, [])
  useEffect(() => { loadAnima().then(setAnimaRaces).catch(() => {}) }, [])
  useEffect(() => {
    if (!index || !bodyId || !headId) return
    const need = new Set<string>([bodyId, headId])
    for (const it of Object.values(equipped)) if (it) need.add(it.id)
    const missing = [...need].filter((id) => !metas.has(id))
    if (!missing.length) return
    let alive = true
    Promise.all(missing.map((id) => loadMeta(id).then((m) => [id, m] as const).catch(() => null))).then((res) => {
      if (!alive) return
      setMetas((prev) => { const n = new Map(prev); for (const r of res) if (r) n.set(r[0], r[1]); return n })
    })
    return () => { alive = false }
  }, [index, bodyId, headId, equipped, metas])
  useEffect(() => {
    if (!effectIndex.size) return
    const missing: string[] = []
    for (const it of Object.values(equipped)) if (it && effectIndex.has(String(parseInt(it.id, 10))) && !effMetas.has(it.id)) missing.push(it.id)
    if (!missing.length) return
    let alive = true
    Promise.all(missing.map((id) => loadEffect(id).then((m) => [id, m] as const).catch(() => null))).then((res) => {
      if (!alive) return
      setEffMetas((prev) => { const n = new Map(prev); for (const r of res) if (r && r[1]) n.set(r[0], r[1]); return n })
    })
    return () => { alive = false }
  }, [equipped, effectIndex, effMetas])

  const viewInfo = useMemo(() => buildView(pv), [pv.action, pv.weapon, pv.expr, pv.ear, pv.gaze])
  const V = viewInfo.view
  const bodyMeta = bodyId ? metas.get(bodyId) : undefined
  const headMeta = headId ? metas.get(headId) : undefined
  const ready = !!(bodyMeta && headMeta)

  // 프레임 "미리 조립"(spec) — 구조 변화(장비/뷰/톤/메타/형상변이)에만 재계산. 프레임 루프에선 재계산 안 함.
  const spec = useMemo(() => {
    if (!ready || !bodyMeta || !headMeta || !index || !bodyId || !headId) return null
    const delays = frameDelays(bodyMeta, V)
    const N = Math.max(1, delays.length)
    const refNav = bodyMeta.frames['stand1']?.[0]?.layers?.find((l) => l.name === 'body')?.map?.navel
    // 형상변이(정적 파츠) — 프레임 공통.
    const animaLayers: AssembleInput[] = (() => {
      const aspec = animaSpec(pv.form)
      if (!aspec) return []
      const race = animaRaces.find((r) => r.node === aspec.node)
      if (!race) return []
      const parts = race.parts.filter((p) => !aspec.parts || aspec.parts.includes(p.name))
      return parts.length ? [{ itemId: 'anima', slot: 'anima', vslot: null, layers: parts.map((p) => ({ name: p.name, png: p.png, z: p.z, origin: p.origin, map: p.map })) }] : []
    })()
    const frames = Array.from({ length: N }, (_, fi) => {
      const items: AssembleInput[] = [
        { itemId: bodyId, slot: 'body', vslot: null, layers: getFrameLayers(bodyMeta, V, fi) },
        { itemId: headId, slot: 'head', vslot: null, layers: getFrameLayers(headMeta, V, fi) },
      ]
      for (const [slot, it] of Object.entries(equipped)) {
        if (!it || hidden[slot]) continue
        const m = metas.get(it.id); if (!m) continue
        let layers = getFrameLayers(m, V, fi)
        if (slot === 'weapon' && !pv.wEffect) layers = layers.filter((l) => l.name !== 'effect')
        items.push({ itemId: m.id, slot, vslot: m.vslot ?? null, layers, invisibleFace: m.invisibleFace })
      }
      items.push(...animaLayers)
      const { placed: raw, anchors } = assemble(items, index.zmap, index.smap)
      const curBody = raw.find((p) => p.slot === 'body' && p.name === 'body')
      const curNav = curBody?.map?.navel
      const stab = refNav && curNav ? { x: curNav.x - refNav.x, y: curNav.y - refNav.y } : { x: 0, y: 0 }
      const placed = stab.x || stab.y ? raw.map((p) => ({ ...p, x: p.x + stab.x, y: p.y + stab.y })) : raw
      const bnav = curBody?.map?.navel
      const foot = { x: (bnav ? -bnav.x : 8) + stab.x, y: (bnav ? -bnav.y : 21) + stab.y }
      const brow = anchors.brow ? { x: anchors.brow.x + stab.x, y: anchors.brow.y + stab.y } : foot
      return { placed, foot, brow }
    })
    return { frames, delays, N, animated: !viewInfo.isStatic && N > 1 }
  }, [ready, bodyMeta, headMeta, index, bodyId, headId, equipped, hidden, metas, animaRaces, pv.form, pv.wEffect, V, viewInfo.isStatic])

  const effList = useMemo(() => {
    const out: EffectMeta[] = []
    for (const [slot, it] of Object.entries(equipped)) {
      if (!it || hidden[slot]) continue
      if (slot === 'cape' && !pv.cEffect) continue
      if (slot === 'weapon' && !pv.wEffect) continue
      const em = effMetas.get(it.id); if (em) out.push(em)
    }
    return out
  }, [equipped, hidden, effMetas, pv.cEffect, pv.wEffect])

  // 명령형 rAF: 프리로드 후 캔버스에 직접 그림(React state 갱신 없음 → 부드럽고 렉 없음).
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !spec) return
    let cancelled = false, raf = 0
    const { frames, delays, animated } = spec
    const hasEff = effList.length > 0
    const pngs = new Set<string>()
    frames.forEach((f) => f.placed.forEach((p) => pngs.add(p.png)))
    effList.forEach((em) => Object.values(em.groups).forEach((g) => g.frames.forEach((fr) => pngs.add(fr.png))))
    const draw = (elapsed: number) => {
      if (cancelled) return
      const fi = animated ? (MOVE_POSTURE_ACTIONS.has(pv.action) ? frameAtElapsedAlt : frameAtElapsed)(delays, elapsed) : 0
      const f = frames[Math.min(fi, frames.length - 1)]
      const effects = hasEff ? effList.flatMap((em) => effectDraws(em, V.action, { foot: f.foot, brow: f.brow }, elapsed)) : []
      renderCharacter(canvas, f.placed, { scale: ZOOM_RENDER_SCALE[pv.zoom] ?? 3, box: MAIN_BOX, anchor: MAIN_ANCHOR, flip: viewInfo.flip, effects, centerX: true, shouldCancel: () => cancelled }).catch(() => {})
    }
    preload([...pngs]).then(() => {
      if (cancelled) return
      if (!animated && !hasEff) { draw(0); return }
      const start = performance.now()
      const loop = (now: number) => { draw(now - start); raf = requestAnimationFrame(loop) }
      raf = requestAnimationFrame(loop)
    })
    return () => { cancelled = true; cancelAnimationFrame(raf) }
  }, [spec, effList, viewInfo.flip, V.action, pv.action, pv.zoom])

  return (
    <div className={styles.wrap}>
      {spec ? <canvas ref={canvasRef} className={styles.canvas} /> : <div className={styles.skeleton} />}
    </div>
  )
}
