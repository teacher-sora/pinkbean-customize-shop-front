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
import { loadEffect, loadEffectIndex, loadMeta, spriteUrl, type ItemMeta, type ListItem } from '@/lib/core/data'
import { buildOverrides, type DyeState } from '@/lib/core/dye'
import { MODEL_REF, computeModelPlacement } from '@/lib/core/modelPlacement'
import { effectDraws, renderCharacter, type EffectDraw } from '@/lib/core/render'
import { effectEnabled, type WornEff } from '@/lib/core/thumbEffects'
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
  override?: Map<string, HTMLCanvasElement> // 내 모델: 배경(내 착용) 염색 오버라이드(이펙트 염색 포함)
  ctxEffs?: WornEff[]                       // 내 모델: 배경(내 착용)의 이펙트 — 망토 오라 등
  pvEff?: { wEffect: boolean; cEffect: boolean } // 연출 토글(꺼진 이펙트는 카드에서도 안 보인다)
  ctxExpr?: string                          // 배경(ctxItems)에 이미 구워진 표정
  faceMeta?: ItemMeta | null                // 배경의 성형 메타 — 표정 얼굴장식 카드가 얼굴을 다시 그릴 때 필요
  dye?: DyeState                            // 내 모델: 얼굴을 다시 그리면 그 표정으로 염색도 다시 구워야 한다
  ear?: string; weapon?: string             // 연출설정 귀/무기모션 — self 아이템도 배경과 동일 뷰로 그림
  isMy?: boolean                            // "내 모델" 카드 여부. 아이템 자체 이펙트(연출)는 내 모델에만 그린다.
}
function ModelThumb({ item, gaze, ctxItems, ctxKey, zmap, smap, skinHeadId, override, ctxEffs, pvEff, ctxExpr, faceMeta, dye, ear, weapon }: ModelProps) {
  const [placed, setPlaced] = useState<PlacedLayer[] | null>(null)
  const [effs, setEffs] = useState<EffectDraw[]>([])
  const [ovr, setOvr] = useState<Map<string, HTMLCanvasElement> | undefined>(override)
  const [dims, setDims] = useState<{ w: number; h: number; dpr: number }>({ w: 0, h: 0, dpr: 1 })
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  // 표정 얼굴장식이면 이 카드만 그 표정으로 본다(연출 설정·다른 카드에는 영향 없음).
  const cardExpr = item.fixedEmotion || ctxExpr
  const { view, flip } = thumbView(gaze, cardExpr, ear, weapon) // 시선(왼/오/뒷) + 표정 + 귀/무기 반영

  useEffect(() => {
    let alive = true
    setPlaced(null); setEffs([]); setOvr(override)
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
        self = [{ itemId: m.id, slot: m.slot, vslot: m.vslot ?? null, layers: getFrameLayers(m, view), invisibleFace: m.invisibleFace, name: m.name }]
      }
      if (!alive) return
      // 표정 얼굴장식 카드: 배경에 구워진 얼굴은 ctxExpr(내 현재 표정) 기준이라, 이 카드가 보여줄
      // 표정으로 **얼굴만 다시 그린다**. 이때 염색 override 는 png 경로가 키라서 표정이 바뀌면
      // 통째로 빗나간다 → 그 표정 기준으로 얼굴 염색을 다시 굽고 배경 override 위에 덮어쓴다.
      // (안 하면 표정 얼굴장식 카드에서만 얼굴 염색이 풀려 보인다.)
      let bg = ctxItems
      if (cardExpr !== ctxExpr && faceMeta) {
        bg = ctxItems.map((ci) => (ci.slot === 'face' ? { ...ci, layers: getFrameLayers(faceMeta, view) } : ci))
        if (dye) {
          const faceOvr = await buildOverrides([faceMeta], dye, view).catch(() => new Map<string, HTMLCanvasElement>())
          if (!alive) return
          if (faceOvr.size) setOvr(new Map([...(override ?? new Map()), ...faceOvr]))
        }
      }
      // [dev] 라이딩(탈것) 카드 = 탑승 장착샷 (미리보기 규칙과 동일하게 리스트에도 반영).
      //   · 방패는 탑승 중 숨김. 무기는 앉은 채(비-back)에선 숨김.
      //   · 앞/옆(비-back)=캐릭터 sit 재합성. 뒤 시선=보통 rope 뒷모습(캐릭터·마운트 줄타기)이지만,
      //     ridingBackSit(탱크)면 뒤에서도 sit(앉은 조종사) — 미리보기와 동일.
      if (item.slot === 'riding') {
        const back = gaze === 'back'
        const sitCard = !back || !!item.ridingBackSit
        bg = bg.filter((ci) => ci.slot !== 'shield' && !(ci.slot === 'weapon' && !back))
        if (sitCard) {
          const sitView = { ...view, action: 'sit' }
          bg = await Promise.all(bg.map(async (ci) => { try { const m = await loadMeta(ci.itemId); return { ...ci, layers: getFrameLayers(m, sitView) } } catch { return ci } }))
          if (!alive) return
        }
      }
      // 내 모델: 후보 아이템과 "같은 슬롯"은 배경(내 착용)에서 빼야 그 부위가 후보로 대체된 장착샷이 된다.
      //   (특정 부위 탭은 CodiScreen 이 이미 제외하지만 '전체' 탭·검색은 카드마다 슬롯이 달라 여기서 처리.)
      const bgF = item.slot === 'skin' ? bg : bg.filter((ci) => ci.slot !== item.slot)
      const { placed: p, anchors } = assemble([...bgF, ...self], zmap, smap)
      setPlaced(p)
      // 이펙트(망토 오라 등) = 배경(내 착용)의 것 + 이 아이템 자신의 것. 둘 다 같은 앵커로 배치한다.
      const bp = p.find((x) => x.name === 'body')
      const foot = bp ? { x: bp.x + bp.origin.x, y: bp.y + bp.origin.y } : { x: 8, y: 21 }
      const anch = { foot, brow: anchors.brow ?? foot }
      const draws: EffectDraw[] = []
      for (const { em } of ctxEffs || []) draws.push(...effectDraws(em, view.action, anch, 0))
      // 이 아이템 "자신의" 이펙트(망토 오라 등)는 아이템 모습의 일부 → 모델·내 모델 모두 그린다(연출 토글은 적용).
      //   ('내 모델/프리셋만' 규칙은 배경=내 착용 아이템들의 이펙트(ctxEffs) 얘기고, 그건 모델엔 배경이 없어 자연히 없다.)
      if (item.slot !== 'skin' && (!pvEff || effectEnabled(item.slot, pvEff))) {
        const bare = String(parseInt(item.id, 10))
        const eidx = await loadEffectIndex().catch(() => new Set<string>())
        if (alive && eidx.has(bare)) {
          const em = await loadEffect(item.id).catch(() => null)
          if (em) draws.push(...effectDraws(em, view.action, anch, 0))
        }
      }
      if (alive) setEffs(draws)
    })().catch(() => {})
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id, ctxKey, skinHeadId, gaze, ctxEffs, pvEff, cardExpr, faceMeta, override, ear, weapon])

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
    const cm = item.slot === 'riding' && !!item.ridingCenterMount // 메탈아머는 메카(마운트) 중앙정렬
    renderCharacter(canvas, placed, { scale: p.scale, box: p.box, anchor: p.anchor, flip, centerX: item.slot === 'riding' && !cm, centerMount: cm, override: ovr, effects: effs, shouldCancel: () => cancelled }).catch(() => {})
    return () => { cancelled = true }
  }, [placed, effs, flip, dims, gaze, ovr])

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
  override?: Map<string, HTMLCanvasElement>
  ctxEffs?: WornEff[]
  pvEff?: { wEffect: boolean; cEffect: boolean }
  ctxExpr?: string
  faceMeta?: ItemMeta | null
  dye?: DyeState
  ear?: string; weapon?: string; isMy?: boolean
}) {
  if (props.mode === 'sprite') return <Sprite item={props.item} />
  return <ModelThumb item={props.item} gaze={props.gaze} ctxItems={props.ctxItems} ctxKey={props.ctxKey} override={props.override} ctxEffs={props.ctxEffs} pvEff={props.pvEff} zmap={props.zmap} smap={props.smap} skinHeadId={props.skinHeadId} ctxExpr={props.ctxExpr} faceMeta={props.faceMeta} dye={props.dye} ear={props.ear} weapon={props.weapon} isMy={props.isMy} />
}
