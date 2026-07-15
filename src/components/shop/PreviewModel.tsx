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
import { applyHsb, buildOverrides } from '@/lib/core/dye'
import { effectDraws, loadImage, preload, renderCharacter } from '@/lib/core/render'
import { MODEL_REF, computeModelPlacement } from '@/lib/core/modelPlacement'
import { MOVE_POSTURE_ACTIONS, PREVIEW_FRACTION, PREVIEW_MARGIN, ZOOM_WORLD, animaSpec, buildView, frameAtElapsed, frameAtElapsedAlt, isColorLineSkin } from '@/lib/shopData'
import { useShop } from './ShopContext'
import { useLiveRedraw } from './useLiveRedraw'
import styles from './PreviewModel.module.css'

export default function PreviewModel() {
  const { index, equipped, hidden, tone, pv, dyePalette, dyeHsb, dyeInteracting } = useShop()
  const [metas, setMetas] = useState<Map<string, ItemMeta>>(new Map())
  const [dyeOverrides, setDyeOverrides] = useState<Map<string, HTMLCanvasElement>>(new Map())
  const [effectIndex, setEffectIndex] = useState<Set<string>>(new Set())
  const [effMetas, setEffMetas] = useState<Map<string, EffectMeta>>(new Map())
  const [animaRaces, setAnimaRaces] = useState<AnimaRace[]>([])
  const [dims, setDims] = useState<{ w: number; h: number; dpr: number }>({ w: 0, h: 0, dpr: 1 })
  const [dyeSettling, setDyeSettling] = useState(false) // 이펙트/피부 전 프레임 염색 중(애니메이션 잠깐 정지 → 점멸 방지)
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // 표시 영역(div) 크기 + dpr 실측. dpr 변경(브라우저 줌/모니터 이동)은 window resize 로도 잡는다.
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
    // 기준 navel(stand1) — 매 프레임 이 값에 맞춰 몸통을 고정(stabOffset)하기 위한 레퍼런스.
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
      // navel-only 앵커링은 프레임마다 navel 의 스프라이트 내부 위치가 달라 몸통이 몇 px 흔들린다. 매 프레임
      // stand1 navel 기준으로 보정(stabOffset)해 몸통·옷은 고정되고 팔·다리만 움직이게 한다(maple test 방식).
      // ⚠️ 이 보정을 무효화하지 않도록 렌더는 centerX(navel 재중심) 대신 고정 anchor 를 쓴다.
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

  // 염색 발색 오버라이드: 착용한 헤어/성형(palette)을 선택 색상으로 리컬러한 레이어 캔버스 맵.
  // renderCharacter 가 png 키로 조회해 원본 대신 그린다. 색/뷰/착용/메타 변화 시에만 재계산(비동기).
  // 발색 슬라이더를 빠르게 드래그해도 렉 없이 바로바로 반영: single-flight(폭주 방지) + 최신값 수렴.
  // 장착 직후 지연 제거: "정지/첫 프레임에 보이는 것"(아이템 레이어 + 이펙트 프레임0 + 피부 프레임0)을 먼저
  // 칠해 즉시 반영하고(장착 시 애니메이션은 프레임0부터 재시작하므로 이게 곧 보이는 프레임), 나머지 전 프레임은
  // 백그라운드로 이어 칠한다(망토 같은 큰 이펙트도 지연 없이 염색돼 보임).
  useLiveRedraw(async () => {
    const dyeable: ItemMeta[] = []
    for (const it of Object.values(equipped)) { if (!it) continue; const m = metas.get(it.id); if (m) dyeable.push(m) }
    const ov = await buildOverrides(dyeable, { palette: dyePalette, hsb: dyeHsb }, V)
    // 이펙트/피부 프레임 염색을 override(ov)에 추가. allFrames=false 면 프레임0만, true 면 전 프레임.
    // ⚠️ 프레임 png 는 반드시 "병렬 로드"(Promise.all)로 받는다 — 순차 fetch(프레임마다 await)면 큰 이펙트(망토)
    //    처럼 프레임이 많을 때 fetch 가 줄줄이 늘어져 매우 느리고 점멸한다. 병렬로 한 번에 받아 즉시 리컬러.
    const dyeExtras = async (allFrames: boolean) => {
      for (const [slot, it] of Object.entries(equipped)) {
        if (!it) continue
        const h = dyeHsb[slot]
        if (!h || (h.h === 0 && h.s === 0 && h.b === 0)) continue
        const em = effMetas.get(it.id); if (!em) continue
        const pngs: string[] = []
        for (const g of Object.values(em.groups)) {
          const frames = allFrames ? g.frames : g.frames.slice(0, 1)
          for (const fr of frames) pngs.push(fr.png)
        }
        const loaded = await Promise.all(pngs.map((p) => loadImage(p, true).then((img) => [p, img] as const).catch(() => null)))
        let n = 0
        for (const e of loaded) {
          if (e) { try { ov.set(e[0], applyHsb(e[1], h, e[0])) } catch (_) {} }
          if (++n % 6 === 0) await new Promise((r) => setTimeout(r, 0)) // applyHsb 동기 루프를 끊어 UI 멈춤 방지
        }
      }
      // 피부(컬러라인 커스텀) 라인 염색: body+head 프레임 png 를 HSB 로 리컬러(피부는 무채색이라 라인만 변한다).
      const skinHsb = dyeHsb['skin']
      if (skinHsb && (skinHsb.h || skinHsb.s || skinHsb.b) && isColorLineSkin(toneEntry?.name) && bodyMeta && headMeta) {
        const pngs: string[] = []
        const seen = new Set<string>()
        for (const meta of [bodyMeta, headMeta]) {
          const nf = allFrames ? Math.max(1, frameDelays(meta, V).length) : 1
          for (let fi = 0; fi < nf; fi++) {
            for (const l of getFrameLayers(meta, V, fi)) { if (!seen.has(l.png)) { seen.add(l.png); pngs.push(l.png) } }
          }
        }
        const loaded = await Promise.all(pngs.map((p) => loadImage(p, true).then((img) => [p, img] as const).catch(() => null)))
        let n = 0
        for (const e of loaded) {
          if (e) { try { ov.set(e[0], applyHsb(e[1], skinHsb, e[0])) } catch (_) {} }
          if (++n % 6 === 0) await new Promise((r) => setTimeout(r, 0))
        }
      }
    }
    // 1) 보이는 프레임(0)만 먼저 → 즉시 반영(장착/드래그 모두 지연 없음).
    await dyeExtras(false)
    setDyeOverrides(new Map(ov))
    // 2) 드래그 중이 아니면 나머지 전 프레임까지 이어서 → 애니메이션에서도 색 유지. 이 동안(전 프레임 염색 중)
    //    이펙트/피부가 있으면 애니메이션을 잠깐 정지해 덜 칠해진 프레임 점멸을 막는다(끝나면 재개).
    if (!dyeInteracting) {
      const willDyeFrames =
        Object.entries(equipped).some(([slot, it]) => { const h = dyeHsb[slot]; return !!it && !!h && (h.h !== 0 || h.s !== 0 || h.b !== 0) && effMetas.has(it.id) }) ||
        (() => { const sh = dyeHsb['skin']; return !!sh && (sh.h !== 0 || sh.s !== 0 || sh.b !== 0) && isColorLineSkin(toneEntry?.name) })()
      if (willDyeFrames) setDyeSettling(true)
      await dyeExtras(true)
      setDyeOverrides(new Map(ov))
      if (willDyeFrames) setDyeSettling(false)
    }
  }, [equipped, metas, effMetas, dyePalette, dyeHsb, V, bodyMeta, headMeta, toneEntry, dyeInteracting])

  // 명령형 rAF: 프리로드 후 캔버스에 직접 그림(React state 갱신 없음 → 부드럽고 렉 없음).
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !spec || !dims.w || !dims.h) return
    let cancelled = false, raf = 0
    const { frames, delays, animated } = spec
    const hasEff = effList.length > 0
    // div 크기·dpr·연출배율로 배치 계산: 캔버스는 div×margin(디바이스 해상도), 마네킹은 fraction×divH 고정.
    // 미리보기는 stabOffset 적용 → 뒷쪽은 카드용 back* 대신 stab 보정된 previewBack* 사용(중앙 고정).
    const back = pv.gaze === 'back'
    const pl = computeModelPlacement({ divW: dims.w, divH: dims.h, dpr: dims.dpr, margin: PREVIEW_MARGIN, fraction: PREVIEW_FRACTION, zoomMult: ZOOM_WORLD[pv.zoom] ?? 1, centerDx: back ? MODEL_REF.previewBackDx : MODEL_REF.centerDx, centerDy: back ? MODEL_REF.previewBackDy : MODEL_REF.centerDy })
    canvas.style.width = pl.canvasCssW + 'px'
    canvas.style.height = pl.canvasCssH + 'px'
    const pngs = new Set<string>()
    frames.forEach((f) => f.placed.forEach((p) => pngs.add(p.png)))
    effList.forEach((em) => Object.values(em.groups).forEach((g) => g.frames.forEach((fr) => pngs.add(fr.png))))
    const draw = (elapsed: number) => {
      if (cancelled) return
      const fi = animated ? (MOVE_POSTURE_ACTIONS.has(pv.action) ? frameAtElapsedAlt : frameAtElapsed)(delays, elapsed) : 0
      const f = frames[Math.min(fi, frames.length - 1)]
      const effects = hasEff ? effList.flatMap((em) => effectDraws(em, V.action, { foot: f.foot, brow: f.brow }, elapsed)) : []
      // 분수 scale = 디바이스 해상도(1:1 표시로 선명). 마네킹 중심을 캔버스 중앙에(anchor 보정) → flip 대칭.
      // renderCharacter 는 CORS(기본)로 로드 → 코디 카드/미리보기/염색이 한 캐시 공유(장착·염색 재fetch 없음).
      renderCharacter(canvas, f.placed, { scale: pl.scale, box: pl.box, anchor: pl.anchor, flip: viewInfo.flip, override: dyeOverrides, effects, shouldCancel: () => cancelled }).catch(() => {})
    }
    // 장착 즉시 합성: 전 프레임 로드를 기다리지 말고 "첫 프레임에 필요한 스프라이트만" 먼저 로드해 바로 그린다.
    const f0 = frames[0]
    const essential = new Set<string>()
    f0?.placed.forEach((p) => essential.add(p.png))
    if (hasEff && f0) effList.flatMap((em) => effectDraws(em, V.action, { foot: f0.foot, brow: f0.brow }, 0)).forEach((d) => essential.add(d.png))
    preload([...essential]).then(() => {
      if (cancelled) return
      draw(0) // 첫 프레임 즉시 합성(장착 지연 제거)
      // 발색 조절 중/전 프레임 염색 중/정지 뷰면 애니메이션 없이 여기서 끝(정지 프레임 유지).
      if (dyeInteracting || dyeSettling || (!animated && !hasEff)) return
      // 나머지 프레임은 백그라운드로 프리로드한 뒤 애니메이션 시작.
      preload([...pngs]).then(() => {
        if (cancelled) return
        const start = performance.now()
        const loop = (now: number) => { draw(now - start); raf = requestAnimationFrame(loop) }
        raf = requestAnimationFrame(loop)
      })
    })
    return () => { cancelled = true; cancelAnimationFrame(raf) }
  }, [spec, effList, viewInfo.flip, V.action, pv.action, pv.gaze, dyeOverrides, dims, pv.zoom, dyeInteracting, dyeSettling])

  return (
    <div ref={wrapRef} className={styles.wrap}>
      {/* 캔버스는 div 보다 크게(디바이스 해상도) 잡아 절대배치 중앙정렬 → wrap overflow:hidden 으로만 잘린다. */}
      {spec ? <canvas ref={canvasRef} className={styles.canvas} /> : <div className={styles.skeleton} />}
    </div>
  )
}
