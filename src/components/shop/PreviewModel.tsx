'use client'

/*
 * PreviewModel — 실제 스프라이트 합성 미리보기(자체완결).
 *  - 착용 아이템 + 피부(body/head) 메타 로드 → assemble → renderCharacter
 *  - navel 고정 + stabOffset(매 프레임 body navel을 stand1[0] 기준으로 고정)으로 액션 중 "중앙 고정"
 *    (navel만 고정하면 프레임마다 몇 px 흔들리는 드리프트를 상쇄)
 *  - 아이템 이펙트(ItemEff 오버레이: 망토 등)를 elapsed 로 애니메이션해 합성. 무기 공격/점프
 *    이펙트는 무기 프레임의 'effect' 레이어(무기 이펙트 토글).
 *  - 로딩 중엔 목업 크기 스켈레톤.
 * ⚠️ 다음 단계: 염색 시각화(dye.buildOverrides) · 형상변이 합성.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { assemble, frameCount, getFrameLayers, type AssembleInput } from '@/lib/core/assemble'
import { loadEffect, loadEffectIndex, loadMeta, type EffectMeta, type ItemMeta } from '@/lib/core/data'
import { effectDraws, renderCharacter, type EffectDraw } from '@/lib/core/render'
import { MAIN_ANCHOR, MAIN_BOX, MOVE_POSTURE_ACTIONS, buildView, frameAtElapsed, frameAtElapsedAlt } from '@/lib/shopData'
import { useShop } from './ShopContext'
import styles from './PreviewModel.module.css'

export default function PreviewModel() {
  const { index, equipped, hidden, tone, pv } = useShop()
  const [metas, setMetas] = useState<Map<string, ItemMeta>>(new Map())
  const [effectIndex, setEffectIndex] = useState<Set<string>>(new Set())
  const [effMetas, setEffMetas] = useState<Map<string, EffectMeta>>(new Map())
  const [elapsed, setElapsed] = useState(0)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const toneEntry = index
    ? index.base.tones.find((t) => t.tone === tone) || index.base.tones.find((t) => t.tone === index.base.default) || index.base.tones[0]
    : null
  const bodyId = toneEntry?.body
  const headId = toneEntry?.head

  // 이펙트 인덱스(1회) + 착용 메타 로드
  useEffect(() => { loadEffectIndex().then(setEffectIndex).catch(() => {}) }, [])
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
  // 착용 아이템 중 이펙트 보유분의 EffectMeta 로드
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

  const N = ready && bodyMeta ? Math.max(1, frameCount(bodyMeta, V)) : 1
  const animated = ready && !viewInfo.isStatic && N > 1
  const hasEffects = useMemo(() => Object.values(equipped).some((it) => it && effMetas.has(it.id)), [equipped, effMetas])
  const needClock = animated || hasEffects

  // elapsed 클록(애니메이션 body 또는 이펙트가 있을 때)
  useEffect(() => {
    if (!needClock) { setElapsed(0); return }
    let raf = 0, lastEmit = 0
    const start = performance.now()
    const loop = (now: number) => {
      const e = now - start
      if (e - lastEmit >= 33) { lastEmit = e; setElapsed(e) } // ~30fps
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [needClock, N, pv.fps, pv.action])

  const frameIndex = animated
    ? (MOVE_POSTURE_ACTIONS.has(pv.action) ? frameAtElapsedAlt : frameAtElapsed)(Array(N).fill(1000 / Math.max(1, pv.fps)), elapsed)
    : 0

  // 조립 + stabOffset(드리프트 상쇄) + 이펙트 앵커(foot/brow)
  const model = useMemo(() => {
    if (!ready || !bodyMeta || !headMeta || !index || !bodyId || !headId) return null
    const items: AssembleInput[] = [
      { itemId: bodyId, slot: 'body', vslot: null, layers: getFrameLayers(bodyMeta, V, frameIndex) },
      { itemId: headId, slot: 'head', vslot: null, layers: getFrameLayers(headMeta, V, frameIndex) },
    ]
    for (const [slot, it] of Object.entries(equipped)) {
      if (!it || hidden[slot]) continue
      const m = metas.get(it.id); if (!m) continue
      let layers = getFrameLayers(m, V, frameIndex)
      if (slot === 'weapon' && !pv.wEffect) layers = layers.filter((l) => l.name !== 'effect')
      items.push({ itemId: m.id, slot, vslot: m.vslot ?? null, layers, invisibleFace: m.invisibleFace })
    }
    const { placed: raw, anchors } = assemble(items, index.zmap, index.smap)
    // stabOffset: 현재 프레임 body navel을 stand1[0] 기준으로 이동시켜 몸을 고정.
    const refNav = bodyMeta.frames['stand1']?.[0]?.layers?.find((l) => l.name === 'body')?.map?.navel
    const curBody = raw.find((p) => p.slot === 'body' && p.name === 'body')
    const curNav = curBody?.map?.navel
    const stab = refNav && curNav ? { x: curNav.x - refNav.x, y: curNav.y - refNav.y } : { x: 0, y: 0 }
    const placed = stab.x || stab.y ? raw.map((p) => ({ ...p, x: p.x + stab.x, y: p.y + stab.y })) : raw
    const bnav = curBody?.map?.navel
    const foot = { x: (bnav ? -bnav.x : 8) + stab.x, y: (bnav ? -bnav.y : 21) + stab.y }
    const brow = anchors.brow ? { x: anchors.brow.x + stab.x, y: anchors.brow.y + stab.y } : foot
    return { placed, foot, brow }
  }, [ready, bodyMeta, headMeta, index, bodyId, headId, equipped, hidden, metas, V, frameIndex, pv.wEffect])

  // 아이템 이펙트(ItemEff 오버레이). 망토=cEffect, 무기=wEffect 토글. elapsed 로 프레임 선택.
  const effects: EffectDraw[] = useMemo(() => {
    if (!model) return []
    const out: EffectDraw[] = []
    for (const [slot, it] of Object.entries(equipped)) {
      if (!it || hidden[slot]) continue
      if (slot === 'cape' && !pv.cEffect) continue
      if (slot === 'weapon' && !pv.wEffect) continue
      const em = effMetas.get(it.id)
      if (em) out.push(...effectDraws(em, V.action, { foot: model.foot, brow: model.brow }, elapsed))
    }
    return out
  }, [model, equipped, hidden, effMetas, V.action, elapsed, pv.cEffect, pv.wEffect])

  // 렌더: navel(+stab) 고정 → 중앙 고정. 오래된 async 렌더는 취소 가드.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !model || !model.placed.length) return
    let cancelled = false
    renderCharacter(canvas, model.placed, {
      scale: pv.zoom, box: MAIN_BOX, anchor: MAIN_ANCHOR, flip: viewInfo.flip, effects, shouldCancel: () => cancelled,
    }).catch(() => {})
    return () => { cancelled = true }
  }, [model, effects, pv.zoom, viewInfo.flip])

  return (
    <div className={styles.wrap}>
      {ready ? <canvas ref={canvasRef} className={styles.canvas} /> : <div className={styles.skeleton} />}
    </div>
  )
}
