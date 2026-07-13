'use client'

/*
 * PreviewModel — 실제 스프라이트 합성 미리보기(자체완결).
 *  - body/head(피부) + 착용 아이템 + 형상변이(anima) 합성 → renderCharacter
 *  - stabOffset(매 프레임 body navel을 stand1[0] 기준 고정) + centerX(bbox 수평 중앙정렬)로 "중앙 고정"
 *  - 애니메이션은 스프라이트 고유 프레임 딜레이(frameDelays) 그대로 재생(maple test와 동일 속도)
 *  - 뒷쪽(gaze=back)=rope 첫 프레임 정지. 아이템 이펙트(ItemEff) elapsed 애니메이션 합성.
 *  - 로딩 중엔 목업 크기 스켈레톤.
 * ⚠️ 다음 단계: 염색 시각화(dye.buildOverrides).
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { assemble, frameDelays, getFrameLayers, type AssembleInput } from '@/lib/core/assemble'
import { loadAnima, loadEffect, loadEffectIndex, loadMeta, type AnimaRace, type EffectMeta, type ItemMeta } from '@/lib/core/data'
import { effectDraws, renderCharacter, type EffectDraw } from '@/lib/core/render'
import { MAIN_ANCHOR, MAIN_BOX, MOVE_POSTURE_ACTIONS, animaSpec, buildView, frameAtElapsed, frameAtElapsedAlt } from '@/lib/shopData'
import { useShop } from './ShopContext'
import styles from './PreviewModel.module.css'

export default function PreviewModel() {
  const { index, equipped, hidden, tone, pv } = useShop()
  const [metas, setMetas] = useState<Map<string, ItemMeta>>(new Map())
  const [effectIndex, setEffectIndex] = useState<Set<string>>(new Set())
  const [effMetas, setEffMetas] = useState<Map<string, EffectMeta>>(new Map())
  const [animaRaces, setAnimaRaces] = useState<AnimaRace[]>([])
  const [elapsed, setElapsed] = useState(0)
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

  // 애니메이션 마스터 클록 = base body의 프레임별 고유 딜레이(maple test와 동일 속도).
  const masterDelays = useMemo(() => (ready && bodyMeta ? frameDelays(bodyMeta, V) : [120]), [ready, bodyMeta, V])
  const N = Math.max(1, masterDelays.length)
  const animated = ready && !viewInfo.isStatic && N > 1
  const hasEffects = useMemo(() => Object.values(equipped).some((it) => it && effMetas.has(it.id)), [equipped, effMetas])
  const needClock = animated || hasEffects

  useEffect(() => {
    if (!needClock) { setElapsed(0); return }
    let raf = 0, lastEmit = 0
    const start = performance.now()
    const loop = (now: number) => {
      const e = now - start
      if (e - lastEmit >= 33) { lastEmit = e; setElapsed(e) } // ~30fps 갱신
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [needClock, pv.action, pv.weapon, pv.gaze])

  // 이동/자세=핑퐁, 공격/사격=일반 루프. 프레임 딜레이는 스프라이트 고유값.
  const frameIndex = animated
    ? (MOVE_POSTURE_ACTIONS.has(pv.action) ? frameAtElapsedAlt : frameAtElapsed)(masterDelays, elapsed)
    : 0

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
    // 형상변이(anima): 파츠가 각자 map 포인트(꼬리→navel, 귀/뿔→brow)를 가져 assemble이 게임처럼 배치.
    const aspec = animaSpec(pv.form)
    if (aspec) {
      const race = animaRaces.find((r) => r.node === aspec.node)
      if (race) {
        const parts = race.parts.filter((p) => !aspec.parts || aspec.parts.includes(p.name))
        if (parts.length) items.push({ itemId: 'anima', slot: 'anima', vslot: null, layers: parts.map((p) => ({ name: p.name, png: p.png, z: p.z, origin: p.origin, map: p.map })) })
      }
    }
    const { placed: raw, anchors } = assemble(items, index.zmap, index.smap)
    // stabOffset: 현재 프레임 body navel을 stand1[0] 기준으로 이동해 몸을 고정(수직 드리프트 상쇄).
    const refNav = bodyMeta.frames['stand1']?.[0]?.layers?.find((l) => l.name === 'body')?.map?.navel
    const curBody = raw.find((p) => p.slot === 'body' && p.name === 'body')
    const curNav = curBody?.map?.navel
    const stab = refNav && curNav ? { x: curNav.x - refNav.x, y: curNav.y - refNav.y } : { x: 0, y: 0 }
    const placed = stab.x || stab.y ? raw.map((p) => ({ ...p, x: p.x + stab.x, y: p.y + stab.y })) : raw
    const bnav = curBody?.map?.navel
    const foot = { x: (bnav ? -bnav.x : 8) + stab.x, y: (bnav ? -bnav.y : 21) + stab.y }
    const brow = anchors.brow ? { x: anchors.brow.x + stab.x, y: anchors.brow.y + stab.y } : foot
    return { placed, foot, brow }
  }, [ready, bodyMeta, headMeta, index, bodyId, headId, equipped, hidden, metas, animaRaces, pv.form, V, frameIndex, pv.wEffect])

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

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !model || !model.placed.length) return
    let cancelled = false
    renderCharacter(canvas, model.placed, {
      scale: pv.zoom, box: MAIN_BOX, anchor: MAIN_ANCHOR, flip: viewInfo.flip, effects, centerX: true, shouldCancel: () => cancelled,
    }).catch(() => {})
    return () => { cancelled = true }
  }, [model, effects, pv.zoom, viewInfo.flip])

  return (
    <div className={styles.wrap}>
      {ready ? <canvas ref={canvasRef} className={styles.canvas} /> : <div className={styles.skeleton} />}
    </div>
  )
}
