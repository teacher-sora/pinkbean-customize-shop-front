'use client'

/*
 * PreviewModel — 실제 스프라이트 합성 미리보기(자체완결).
 *  - 착용 아이템 + 피부(body/head) 메타를 CDN에서 로드
 *  - pv(액션/무기모션/표정/귀/시선/fps/배율)로 프레임 시퀀스를 골라 assemble → renderCharacter
 *  - navel 을 고정 박스의 고정 좌표에 못박아 액션이 바뀌어도 몸이 "중앙 고정"
 *  - 메타/이미지 로딩 중엔 목업과 동일 크기의 스켈레톤
 * ⚠️ 다음 단계: 염색 시각화(dye.buildOverrides) · 아이템 이펙트 · 형상변이 합성.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { assemble, frameCount, getFrameLayers, type AssembleInput } from '@/lib/core/assemble'
import { loadMeta, type ItemMeta } from '@/lib/core/data'
import { renderCharacter } from '@/lib/core/render'
import { MAIN_ANCHOR, MAIN_BOX, MOVE_POSTURE_ACTIONS, buildView, frameAtElapsed, frameAtElapsedAlt } from '@/lib/shopData'
import { useShop } from './ShopContext'
import styles from './PreviewModel.module.css'

export default function PreviewModel() {
  const { index, equipped, tone, pv } = useShop()
  const [metas, setMetas] = useState<Map<string, ItemMeta>>(new Map())
  const [frameIndex, setFrameIndex] = useState(0)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // 현재 톤의 body/head id
  const toneEntry = index
    ? index.base.tones.find((t) => t.tone === tone) || index.base.tones.find((t) => t.tone === index.base.default) || index.base.tones[0]
    : null
  const bodyId = toneEntry?.body
  const headId = toneEntry?.head

  // 필요한 메타 로드(base + 착용)
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

  const viewInfo = useMemo(() => buildView(pv), [pv.action, pv.weapon, pv.expr, pv.ear, pv.gaze])
  const V = viewInfo.view

  const bodyMeta = bodyId ? metas.get(bodyId) : undefined
  const headMeta = headId ? metas.get(headId) : undefined
  const ready = !!(bodyMeta && headMeta)

  const N = ready && bodyMeta ? Math.max(1, frameCount(bodyMeta, V)) : 1
  const animated = ready && !viewInfo.isStatic && N > 1

  // 애니메이션: fps 균일 간격으로 프레임 스텝(이동/자세=핑퐁, 그 외=루프).
  useEffect(() => {
    if (!animated) { setFrameIndex(0); return }
    const delays = Array(N).fill(1000 / Math.max(1, pv.fps))
    const stepper = MOVE_POSTURE_ACTIONS.has(pv.action) ? frameAtElapsedAlt : frameAtElapsed
    let raf = 0, cur = -1
    const start = performance.now()
    const loop = (now: number) => {
      const fi = stepper(delays, now - start)
      if (fi !== cur) { cur = fi; setFrameIndex(fi) }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [animated, N, pv.fps, pv.action])

  // 조립: body + head + 착용 아이템 → placed(navel 기준 배치)
  const placed = useMemo(() => {
    if (!ready || !bodyMeta || !headMeta || !index || !bodyId || !headId) return []
    const items: AssembleInput[] = [
      { itemId: bodyId, slot: 'body', vslot: null, layers: getFrameLayers(bodyMeta, V, frameIndex) },
      { itemId: headId, slot: 'head', vslot: null, layers: getFrameLayers(headMeta, V, frameIndex) },
    ]
    for (const [slot, it] of Object.entries(equipped)) {
      if (!it) continue
      const m = metas.get(it.id); if (!m) continue
      let layers = getFrameLayers(m, V, frameIndex)
      if (slot === 'weapon' && !pv.wEffect) layers = layers.filter((l) => l.name !== 'effect')
      items.push({ itemId: m.id, slot, vslot: m.vslot ?? null, layers, invisibleFace: m.invisibleFace })
    }
    return assemble(items, index.zmap, index.smap).placed
  }, [ready, bodyMeta, headMeta, index, bodyId, headId, equipped, metas, V, frameIndex, pv.wEffect])

  // 렌더: navel 고정 → 중앙 고정. 오래된 async 렌더는 취소 가드로 무시.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !placed.length) return
    let cancelled = false
    renderCharacter(canvas, placed, {
      scale: pv.zoom, box: MAIN_BOX, anchor: MAIN_ANCHOR, flip: viewInfo.flip, shouldCancel: () => cancelled,
    }).catch(() => {})
    return () => { cancelled = true }
  }, [placed, pv.zoom, viewInfo.flip])

  return (
    <div className={styles.wrap}>
      {ready ? <canvas ref={canvasRef} className={styles.canvas} /> : <div className={styles.skeleton} />}
    </div>
  )
}
