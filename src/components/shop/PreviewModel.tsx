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
import { isStacked } from '@/lib/useBreakpoint'
import { MOVE_POSTURE_ACTIONS, PREVIEW_FRACTION, PREVIEW_FRACTION_MOBILE, PREVIEW_MARGIN, ZOOM_WORLD, animaLayers, buildView, fixedExpr, frameAtElapsed, frameAtElapsedAlt, isColorLineSkin } from '@/lib/shopData'
import { useShop } from './ShopContext'
import { useLiveRedraw } from './useLiveRedraw'
import styles from './PreviewModel.module.css'

// [dev] 라이딩 중 "앉은 채" 나오는 액션(캐릭터=sit, 재규어가 대신 움직임). 나머지(점프·사다리·밧줄·
// 석궁사격)는 캐릭터가 일어서서 해당 모션을 한다. 메카닉 메탈아머도 동일 규칙.
const RIDING_SEATED = new Set(['basic', 'walk'])

export default function PreviewModel() {
  const { index, equipped, hidden, tone, pv, dyePalette, dyeHsb, dyeInteracting, bp } = useShop()
  // 세로 스택(태블릿+모바일)은 미리보기 영역이 낮고 넓다 → PC 비율(0.25)이면 모델이 콩알만 해진다.
  const fraction = isStacked(bp) ? PREVIEW_FRACTION_MOBILE : PREVIEW_FRACTION
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

  // 표정 얼굴장식(fixedEmotion)을 착용 중이면 표정을 그 값으로 고정한다. 숨김(hidden) 처리된 슬롯은 제외 —
  // 안 보이는 아이템이 표정을 붙잡고 있으면 안 되니까. 연출 설정(pv.expr)은 건드리지 않고 여기서만 덮어쓴다.
  const fixedE = fixedExpr(Object.entries(equipped).filter(([sl]) => !hidden[sl]).map(([, it]) => it), pv.expr)
  const viewInfo = useMemo(() => buildView({ ...pv, expr: fixedE }), [pv.action, pv.weapon, fixedE, pv.ear, pv.gaze])
  const V = viewInfo.view
  const bodyMeta = bodyId ? metas.get(bodyId) : undefined
  const headMeta = headId ? metas.get(headId) : undefined
  const ready = !!(bodyMeta && headMeta)

  // 프레임 "미리 조립"(spec) — 구조 변화(장비/뷰/톤/메타/형상변이)에만 재계산. 프레임 루프에선 재계산 안 함.
  const spec = useMemo(() => {
    if (!ready || !bodyMeta || !headMeta || !index || !bodyId || !headId) return null
    // [dev] 라이딩(탑승) 렌더 규칙(실제 게임 기준):
    //   · 기본/서기/걷기 = "앉은 채"(캐릭터 sit 고정) → 재규어가 대신 걷기/서기 애니메이션, 무기 미출력.
    //   · 전투대기/점프/사다리/밧줄/석궁사격 = 캐릭터가 "일어서서" 해당 모션 → 무기 출력.
    //   V.action 은 이미 resolved WZ 키(walk1/jump/rope/shoot2…)라 재규어 프레임과 그대로 매칭된다(없으면
    //   stand1 폴백). 뒤 시선(back)은 buildView 가 action='rope' 정지 → 재규어 rope(캐릭터 뒤)도 함께 나온다.
    //   방패는 탑승 중 항상 숨김(직업 불일치).
    const ridingItem = equipped['riding']
    const ridingMeta = ridingItem && !hidden['riding'] ? metas.get(ridingItem.id) : undefined
    const riding = !!ridingMeta
    // 뒤 시선(back)은 buildView 가 action='rope' 정지로 만든다 → 캐릭터도 재규어도 줄타기 뒷모습으로. 그래서
    // 뒤 시선일 땐 sit 로 덮지 않는다(안 그러면 캐릭터가 앞/옆 sit 로 나온다).
    // 아이템별 "앉는 액션"(riding.json ridingSeated). 없으면 기본 재규어 세트. 메탈아머는 조종사가 항상 앉음(전부).
    const seatedSet = ridingItem?.ridingSeated?.length ? new Set(ridingItem.ridingSeated) : RIDING_SEATED
    // 뒷쪽 시선은 보통 sit 로 안 덮지만(캐릭터 등반 뒷모습), ridingBackSit(탱크)면 뒤에서도 sit 강제.
    const backOk = pv.gaze !== 'back' || !!ridingItem?.ridingBackSit
    const seated = riding && backOk && seatedSet.has(pv.action) // 앉은 채(캐릭터 sit)
    const charV = seated ? { ...V, action: 'sit' } : V     // 앉는 액션이면 캐릭터는 sit 로 그린다
    // 재규어 액션 키 매핑: 엎드리기(캐릭터 proneStab) → 재규어 'prone'. 나머지는 V.action 그대로 매칭된다.
    const jagV = riding ? { ...V, action: V.action === 'proneStab' ? 'prone' : V.action } : V
    // 클럭: 앉으면 재규어(jagV) 애니메이션이 주체 → 재규어가 클럭. 서면 캐릭터(charV=V) 액션이 클럭.
    const delays = frameDelays((seated ? ridingMeta : bodyMeta) ?? bodyMeta, seated ? jagV : charV)
    const N = Math.max(1, delays.length)
    // stabOffset 기준 navel = stand1 고정(라이딩 포함). 액션 내 navel 드리프트는 "상체 상하 모션"이므로 죽이지
    // 않는다(발은 고정, 상체가 오르내림). 라이딩 가로 정렬은 렌더의 centerXOnly 가 담당(세로는 이 드리프트 유지).
    const refNav = bodyMeta.frames['stand1']?.[0]?.layers?.find((l) => l.name === 'body')?.map?.navel
    // 형상변이(정적 파츠) — 프레임 공통. 공용 헬퍼(리스트 카드와 동일 로직).
    const animaParts = animaLayers(pv.form, animaRaces)
    const frames = Array.from({ length: N }, (_, fi) => {
      const items: AssembleInput[] = [
        // 몸통/머리/코스튬은 charV(앉는 액션이면 sit, 아니면 선택 액션). 탈것만 V(자기 액션으로 애니메이션).
        { itemId: bodyId, slot: 'body', vslot: null, layers: getFrameLayers(bodyMeta, charV, fi) },
        { itemId: headId, slot: 'head', vslot: null, layers: getFrameLayers(headMeta, charV, fi) },
      ]
      for (const [slot, it] of Object.entries(equipped)) {
        if (!it || hidden[slot]) continue
        if (riding && slot === 'shield') continue // 탑승 중 방패 숨김(직업 불일치)
        if (seated && slot === 'weapon') continue  // 앉은 채(기본/서기/걷기)에선 무기 미출력
        const m = metas.get(it.id); if (!m) continue
        const itemV = slot === 'riding' ? jagV : charV // 탈것은 자기(매핑된) 액션, 나머지는 캐릭터 포즈(sit/선택)를 따른다
        let layers = getFrameLayers(m, itemV, fi)
        if (slot === 'weapon' && !pv.wEffect) layers = layers.filter((l) => l.name !== 'effect')
        items.push({ itemId: m.id, slot, vslot: m.vslot ?? null, layers, invisibleFace: m.invisibleFace, name: m.name })
      }
      items.push(...animaParts)
      // navel-only 앵커링은 프레임마다 navel 의 스프라이트 내부 위치가 달라 몸통이 몇 px 흔들린다. 매 프레임
      // stand1 navel 기준으로 보정(stabOffset)해 몸통·옷은 고정되고 팔·다리만 움직이게 한다(maple test 방식).
      // ⚠️ 이 보정을 무효화하지 않도록 렌더는 centerX(navel 재중심) 대신 고정 anchor 를 쓴다.
      const { placed: raw, anchors } = assemble(items, index.zmap, index.smap)
      const curBody = raw.find((p) => p.slot === 'body' && p.name === 'body')
      const curNav = curBody?.map?.navel
      // 캐릭터 stab = 발(origin) 고정, 몸통/사지만 움직임(stand1 navel 기준). 앉은 채(seated)면 stab 없음(안장 위 원위치).
      const stab = refNav && curNav ? { x: curNav.x - refNav.x, y: curNav.y - refNav.y } : { x: 0, y: 0 }
      // ⚠️ stab 은 캐릭터+마운트 "전 레이어에 균일" 적용해야 한다. 예전엔 마운트를 stab 에서 뺐는데, 그러면
      //   centerX/centerMount(캐릭터 navel/마운트 bbox 재중심)에서 stab 만큼 마운트가 어긋난다(카드는 stab 이
      //   없어 안 어긋남 → 미리보기만 왼쪽 치우침). 균일 적용하면 재중심에서 stab 이 상쇄돼 카드와 동일해진다.
      const shift = riding && seated ? { x: 0, y: 0 } : stab
      const placed = shift.x || shift.y ? raw.map((p) => ({ ...p, x: p.x + shift.x, y: p.y + shift.y })) : raw
      const bnav = curBody?.map?.navel
      const foot = { x: (bnav ? -bnav.x : 8) + stab.x, y: (bnav ? -bnav.y : 21) + stab.y }
      const brow = anchors.brow ? { x: anchors.brow.x + stab.x, y: anchors.brow.y + stab.y } : foot
      return { placed, foot, brow }
    })
    // 핑퐁(왕복)은 "캐릭터가 클럭"일 때(전투대기 등 일어선 액션)만. 앉은 채(seated)는 재규어가 클럭이고 4족
    // 보행은 루프여야 뒷발이 되돌아가며 움찔하지 않는다. (전투대기가 중간에 툭 끊기던 건 라이딩 전체를 loop 로
    // 막았기 때문 — seated 아닐 때는 원래대로 왕복시킨다.)
    // 메탈아머(ridingCenterMount)는 메카(마운트)를 중앙정렬, 그 외 라이딩은 캐릭터(navel) 가로 중앙정렬(centerXOnly).
    const centerMount = riding && !!ridingItem?.ridingCenterMount
    return { frames, delays, N, riding, centerMount, animated: !viewInfo.isStatic && N > 1, pingpong: !seated && MOVE_POSTURE_ACTIONS.has(pv.action) }
  }, [ready, bodyMeta, headMeta, index, bodyId, headId, equipped, hidden, metas, animaRaces, pv.form, pv.wEffect, pv.gaze, pv.action, V, viewInfo.isStatic])

  const effList = useMemo(() => {
    const out: EffectMeta[] = []
    for (const [slot, it] of Object.entries(equipped)) {
      if (!it || hidden[slot]) continue
      if (slot === 'cape' && !pv.cEffect) continue
      if (slot === 'weapon' && !pv.wEffect) continue
      if (slot === 'cap' && !pv.capEffect) continue
      const em = effMetas.get(it.id); if (em) out.push(em)
    }
    return out
  }, [equipped, hidden, effMetas, pv.cEffect, pv.wEffect, pv.capEffect])

  // 염색 발색 오버라이드: 착용한 헤어/성형(palette)을 선택 색상으로 리컬러한 레이어 캔버스 맵.
  // renderCharacter 가 png 키로 조회해 원본 대신 그린다. 색/뷰/착용/메타 변화 시에만 재계산(비동기).
  // 발색 슬라이더를 빠르게 드래그해도 렉 없이 바로바로 반영: single-flight(폭주 방지) + 최신값 수렴.
  // 장착 직후 지연 제거: "정지/첫 프레임에 보이는 것"(아이템 레이어 + 이펙트 프레임0 + 피부 프레임0)을 먼저
  // 칠해 즉시 반영하고(장착 시 애니메이션은 프레임0부터 재시작하므로 이게 곧 보이는 프레임), 나머지 전 프레임은
  // 백그라운드로 이어 칠한다(망토 같은 큰 이펙트도 지연 없이 염색돼 보임).
  useLiveRedraw(async () => {
    const dyeable: ItemMeta[] = []
    for (const it of Object.values(equipped)) { if (!it) continue; const m = metas.get(it.id); if (m) dyeable.push(m) }
    // [dev] 라이딩 앉은 액션이면 캐릭터가 sit 로 그려지므로 염색도 sit 프레임 기준으로 계산해야 그 프레임 옷/피부
    //   png 가 칠해진다(안 그러면 선택 액션 png 만 칠해져 sit 옷이 원본색으로 보인다). ⚠️ seated 판정은 spec 과
    //   똑같이 "아이템별 ridingSeated"를 써야 한다(메탈아머는 prone/ladder/rope 도 seated라 상수만 보면 안 칠해짐).
    const dyeRidingIt = equipped['riding']
    const dyeSeatedSet = dyeRidingIt?.ridingSeated?.length ? new Set(dyeRidingIt.ridingSeated) : RIDING_SEATED
    const dyeBackOk = pv.gaze !== 'back' || !!dyeRidingIt?.ridingBackSit
    const dyeSeated = !!dyeRidingIt && !hidden['riding'] && dyeBackOk && dyeSeatedSet.has(pv.action)
    const dyeV = dyeSeated ? { ...V, action: 'sit' } : V
    // ⚠️ 1단계는 반드시 allFrames=false — 보이는 프레임만 칠해 즉시 반영한다(기존과 동일한 비용/체감속도).
    //    전 프레임은 아래 2단계에서 백그라운드로 이어 칠한다. 여기서 전 프레임을 칠하면 장착/드래그가 눈에 띄게 느려진다.
    const ov = await buildOverrides(dyeable, { palette: dyePalette, hsb: dyeHsb }, dyeV, false)
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
          const nf = allFrames ? Math.max(1, frameDelays(meta, dyeV).length) : 1
          for (let fi = 0; fi < nf; fi++) {
            for (const l of getFrameLayers(meta, dyeV, fi)) { if (!seen.has(l.png)) { seen.add(l.png); pngs.push(l.png) } }
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
      // 전 프레임을 칠하는 동안 애니메이션이 돌면 덜 칠해진 프레임이 점멸한다 → 그런 대상이 하나라도 있으면 잠깐 정지.
      // 이펙트뿐 아니라 "염색된 착용 아이템" 자체도 이제 2단계로 칠해지므로(위 buildOverrides allFrames) 함께 본다.
      const willDyeFrames =
        Object.entries(equipped).some(([slot, it]) => { const h = dyeHsb[slot]; return !!it && !!h && (h.h !== 0 || h.s !== 0 || h.b !== 0) }) ||
        (() => { const sh = dyeHsb['skin']; return !!sh && (sh.h !== 0 || sh.s !== 0 || sh.b !== 0) && isColorLineSkin(toneEntry?.name) })()
      if (willDyeFrames) setDyeSettling(true)
      // 아이템(착용 장비)의 나머지 프레임을 여기서 이어 칠한다 — 이게 없으면 액션 애니메이션 2번째 프레임부터
      // override 가 없어 염색이 풀린 원본색으로 보였다(이펙트/피부는 dyeExtras 가 이미 전 프레임을 칠하고 있었다).
      const full = await buildOverrides(dyeable, { palette: dyePalette, hsb: dyeHsb }, dyeV, true)
      for (const [k, v] of full) ov.set(k, v)
      await dyeExtras(true)
      setDyeOverrides(new Map(ov))
      if (willDyeFrames) setDyeSettling(false)
    }
  }, [equipped, metas, effMetas, dyePalette, dyeHsb, V, hidden, pv.gaze, pv.action, bodyMeta, headMeta, toneEntry, dyeInteracting])

  // 명령형 rAF: 프리로드 후 캔버스에 직접 그림(React state 갱신 없음 → 부드럽고 렉 없음).
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !spec || !dims.w || !dims.h) return
    let cancelled = false, raf = 0
    const { frames, delays, animated, pingpong, riding, centerMount } = spec
    const hasEff = effList.length > 0
    // div 크기·dpr·연출배율로 배치 계산: 캔버스는 div×margin(디바이스 해상도), 마네킹은 fraction×divH 고정.
    // 미리보기는 stabOffset 적용 → 뒷쪽은 카드용 back* 대신 stab 보정된 previewBack* 사용(중앙 고정).
    const back = pv.gaze === 'back'
    // 사다리/밧줄(등반) 포즈는 stand1 과 navel↔시각중심 오프셋이 달라 centerDx(stand1 튜닝)로는 오른쪽으로 쏠린다.
    // 뒷쪽 시선(rope 첫프레임)이 previewBack* 로 중앙에 오는 것과 동일하게, 비라이딩 사다리/밧줄도 previewBack* 사용.
    const climbCenter = back || (!riding && (pv.action === 'ladder' || pv.action === 'rope'))
    const pl = computeModelPlacement({ divW: dims.w, divH: dims.h, dpr: dims.dpr, margin: PREVIEW_MARGIN, fraction, zoomMult: ZOOM_WORLD[pv.zoom] ?? 1, centerDx: climbCenter ? MODEL_REF.previewBackDx : MODEL_REF.centerDx, centerDy: climbCenter ? MODEL_REF.previewBackDy : MODEL_REF.centerDy })
    canvas.style.width = pl.canvasCssW + 'px'
    canvas.style.height = pl.canvasCssH + 'px'
    const pngs = new Set<string>()
    frames.forEach((f) => f.placed.forEach((p) => pngs.add(p.png)))
    effList.forEach((em) => Object.values(em.groups).forEach((g) => g.frames.forEach((fr) => pngs.add(fr.png))))
    const draw = (elapsed: number) => {
      if (cancelled) return
      const fi = animated ? (pingpong ? frameAtElapsedAlt : frameAtElapsed)(delays, elapsed) : 0
      const f = frames[Math.min(fi, frames.length - 1)]
      const effects = hasEff ? effList.flatMap((em) => effectDraws(em, V.action, { foot: f.foot, brow: f.brow }, elapsed)) : []
      // 분수 scale = 디바이스 해상도(1:1 표시로 선명). 마네킹 중심을 캔버스 중앙에(anchor 보정) → flip 대칭.
      // renderCharacter 는 CORS(기본)로 로드 → 코디 카드/미리보기/염색이 한 캐시 공유(장착·염색 재fetch 없음).
      // 라이딩은 centerXOnly 로 캐릭터 body navel 을 "가로"만 박스 중앙에 동적 고정 → 포즈(sit/rope/alert) 무관하게
      // 좌우 중앙. 세로(Y)는 애니메이션 드리프트를 살려 발은 고정되고 상체가 오르내린다(허공 울렁임 방지).
      renderCharacter(canvas, f.placed, { scale: pl.scale, box: pl.box, anchor: pl.anchor, flip: viewInfo.flip, centerXOnly: riding && !centerMount, centerMount, override: dyeOverrides, effects, shouldCancel: () => cancelled }).catch(() => {})
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
  }, [spec, effList, viewInfo.flip, V.action, pv.action, pv.gaze, dyeOverrides, dims, pv.zoom, fraction, dyeInteracting, dyeSettling])

  return (
    <div ref={wrapRef} className={styles.wrap}>
      {/* 캔버스는 div 보다 크게(디바이스 해상도) 잡아 절대배치 중앙정렬 → wrap overflow:hidden 으로만 잘린다. */}
      {spec ? <canvas ref={canvasRef} className={styles.canvas} /> : <div className={styles.skeleton} />}
    </div>
  )
}
