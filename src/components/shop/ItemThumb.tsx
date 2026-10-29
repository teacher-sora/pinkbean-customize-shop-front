'use client'

/*
 * ItemThumb — 아이템 리스트 셀의 3가지 표시 모드.
 *  - sprite  : 아이템 아이콘/스프라이트 이미지(가장 가벼움). 헤어는 몸 없이 모든 파츠 합성(염색표와 동일)
 *  - model   : 베이스 몸통+머리에 이 아이템을 올린 미니 합성
 *  - mymodel : 현재 내 착용(해당 슬롯 제외)에 이 아이템을 올린 미니 합성
 *  명찰 · 말풍선 · 칭호 · 훈장은 model · mymodel 에서 몸 없이 그 아이템만 그린다(ChatThumb) — 몸에 달면 말풍선이 카드 위로 넘친다.
 * 이 아이템에 이펙트가 있으면(effects/index.json) 함께 합성한다. centerX 로 sprite 처럼 정중앙 정렬.
 */

import { useEffect, useRef, useState } from 'react'
import { watchSize } from '@/lib/sizeWatch'
import { useIsoLayoutEffect } from '@/lib/uiState'
import { assemble, dropWeaponEffects, footOf, getFrameLayers, ringIllusion, weaponPose, type AssembleInput, type PlacedLayer } from '@/lib/core/assemble'
import { loadEffect, loadEffectIndex, loadMeta, loadParticle, loadParticleIndex, spriteUrl, type ItemMeta, type ListItem } from '@/lib/core/data'
import { buildOverrides, type DyeState } from '@/lib/core/dye'
import { MODEL_REF, canvasBitmap, computeModelPlacement, fitCanvas } from '@/lib/core/modelPlacement'
import { placeParticles, spotsFor, stillSim, type ParticleDesc, type ParticleDraw } from '@/lib/core/particle'
import { effectDraws, renderCharacter, type EffectDraw } from '@/lib/core/render'
import { modelShotBlob, type ModelShot } from '@/lib/canvasExport'
import { bindImageMenu } from '@/lib/canvasMenu'
import { effectEnabled, type WornEff } from '@/lib/core/thumbEffects'
import { chatPreview } from '@/lib/core/chatUi'
import { CARD_FIT_W_M, CARD_FRACTION, CARD_LIFT_M, CARD_MARGIN, thumbView, type ChatState } from '@/lib/shopData'
import type { ListMode } from './ShopContext'
import { CARD_FRAC_HAIR, DyeSprite } from './render/DyeSprite'

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
    // 배율은 **디바이스 픽셀** 정수로 고른다(CSS 정수면 DPR≈3 모바일에서 셀이 남아도 한 단계 작게 멈췄다).
    // 표시 크기 = 원본 × k / dpr → 화면 픽셀에 정수배로 맞아 선명.
    const dpr = window.devicePixelRatio || 1
    const cw = wrap.clientWidth * dpr, ch = wrap.clientHeight * dpr
    const nw = img.naturalWidth, nh = img.naturalHeight
    const target = TARGET_FRAC * Math.min(cw, ch)          // 큰 변을 이 크기에 맞춤(정규화 목표)
    const fitK = Math.min(cw / nw, ch / nh)                // 셀에 들어가는 최대 배율
    // 배율 단계. 정수만 쓰면 1배↔2배 계단이 그대로 크기
    // 차이가 된다(칸의 50% vs 96%). 화면 픽셀이 촘촘한 기기(DPR≥2)에서는 **0.5 단계**까지 쓴다 —
    // 디바이스 픽셀로는 여전히 정수(1.5×2=3)라 도트가 깨지지 않으면서 크기가 고르게 모인다.
    const q = dpr >= 2 ? 2 : 1
    let k = Math.round((target / Math.max(nw, nh)) * q) / q  // 목표에 가장 가까운 배율 단계
    k = Math.max(1 / q, Math.min(k, Math.floor(fitK * q) / q || 1 / q)) // 셀 초과 방지(원본이 셀보다 크면 최소 단계)
    img.style.width = (nw * k) / dpr + 'px'
    img.style.height = (nh * k) / dpr + 'px'
  }
  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap) return
    const ro = new ResizeObserver(fitIcon); ro.observe(wrap)
    window.addEventListener('resize', fitIcon)
    return () => { ro.disconnect(); window.removeEventListener('resize', fitIcon) }
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

// 헤어 '아이템' 보기: 셀 짧은 변 기준 정사각 캔버스에 헤어 전 파츠를 몸 없이 합성(무염색 = 대표색).
function HairSprite({ item, zmap }: { item: ListItem; zmap: string[] }) {
  return (
    <div className="pb-hairsprite">
      <div className="pb-hairsprite-box"><DyeSprite id={item.id} mix zmap={zmap} frac={CARD_FRAC_HAIR} /></div>
    </div>
  )
}

// ── 다 만든 카드 그림을 기억한다(사용자 지시: 목록이 점멸하며 흔들리지 않게) ──
// 목록 폭이 바뀌면(코디 비교를 켜고 끌 때 등) 한 쪽의 칸 수가 바뀌어 카드가 다른 쪽(key=쪽 번호)으로 옮겨 가며 새로 만들어진다.
// 새로 만든 카드는 비동기 합성이 끝날 때까지 뼈대를 보여 목록 전체가 깜빡였다(실측: 끌 때 보이는 카드 28장 모두 뼈대).
// 같은 입력이면 기억해 둔 결과로 **첫 페인트부터** 그린다 — 칸 크기 재기와 그리기도 페인트 전(layout effect)에 한다.
// 입력의 객체(배경 이펙트 · 염색 등)는 내용이 아니라 같은 객체인지로 가른다(목록이 같은 값이면 같은 객체를 넘긴다).
const THUMB_CACHE_MAX = 600
const objIds = new WeakMap<object, number>()
let nextObj = 0
const oid = (o: object | null | undefined) => { if (!o) return 0; let v = objIds.get(o); if (v == null) { v = ++nextObj; objIds.set(o, v) } return v }
function memo<T>(m: Map<string, T>, k: string, v: T) {
  m.delete(k); m.set(k, v)
  if (m.size > THUMB_CACHE_MAX) m.delete(m.keys().next().value as string)
}
type ModelDone = { placed: PlacedLayer[]; effs: EffectDraw[]; parts: ParticleDraw[]; ovr: Map<string, HTMLCanvasElement> | undefined }
const modelDone = new Map<string, ModelDone>()
const chatDone = new Map<string, HTMLCanvasElement>()

// 명찰 · 말풍선 · 칭호 · 훈장 카드: 몸 없이 그 아이템만 카드 가운데에. 칭호 · 훈장의 글자는 그 아이템 이름. 배율은 정수(디바이스 픽셀 기준) — 게임 크기(CSS 1px = 게임 1px)를 넘지 않고,
// 카드 안쪽 CHAT_FIT 에 다 들어오지 않으면 들어오는 단계까지 줄인다(카드마다 크기가 들쭉날쭉하지 않게 키우지는 않는다).
// 디바이스 픽셀 1:1 로도 넘치면(배율 1 화면의 넓은 말풍선) 카드에 맞춰 부드럽게 줄인다 — 잘려서 생김새를 못 보는 것보다 낫다(사용자 지시).
const CHAT_FIT = 0.9
function ChatThumb({ item, chat }: { item: ListItem; chat: ChatState }) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const kind = item.chatUi?.kind
  const name = kind === 'medal' || kind === 'nick' ? item.name ?? '' : chat.name
  const ckey = `${item.id}|${oid(item.chatUi)}|${name}|${chat.text}`
  const [bmp, setBmp] = useState<HTMLCanvasElement | null>(() => chatDone.get(ckey) ?? null)
  const [dims, setDims] = useState<{ w: number; h: number; dpr: number }>({ w: 0, h: 0, dpr: 1 })
  useEffect(() => {
    const hit = chatDone.get(ckey)
    if (hit) { setBmp(hit); return }
    let alive = true
    setBmp(null)
    if (item.chatUi) chatPreview(item.chatUi, { name, text: chat.text }).then((c) => { memo(chatDone, ckey, c); if (alive) setBmp(c) }).catch(() => {})
    return () => { alive = false }
  }, [ckey]) // eslint-disable-line react-hooks/exhaustive-deps
  useIsoLayoutEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const measure = () => {
      const w = el.clientWidth, h = el.clientHeight, dpr = window.devicePixelRatio || 1
      if (w > 0 && h > 0) setDims((d) => (d.w === w && d.h === h && d.dpr === dpr ? d : { w, h, dpr }))
    }
    measure()
    // 칸 크기가 바뀌면 그리기 전에 바로 반영한다 — 감지기 하나에 묶어 한 번에(lib/sizeWatch)
    const off = watchSize(el, measure)
    window.addEventListener('resize', measure)
    return () => { off(); window.removeEventListener('resize', measure) }
  }, [])
  useIsoLayoutEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !bmp || !dims.w) return
    const fit = Math.min((dims.w * dims.dpr * CHAT_FIT) / bmp.width, (dims.h * dims.dpr * CHAT_FIT) / bmp.height)
    const k = fit >= 1 ? Math.min(Math.floor(dims.dpr) || 1, Math.floor(fit)) : fit
    const bw = Math.round(bmp.width * k), bh = Math.round(bmp.height * k)
    canvas.width = bw; canvas.height = bh
    const g = canvas.getContext('2d')!
    g.imageSmoothingEnabled = k < 1
    g.imageSmoothingQuality = 'high'
    g.drawImage(bmp, 0, 0, bw, bh)
    fitCanvas(canvas, wrapRef.current, bw, bh, dims.w, dims.h, dims.dpr)
  }, [bmp, dims])
  useEffect(() => {
    const el = canvasRef.current
    if (!el) return
    return bindImageMenu(el, () => (bmp ? new Promise<Blob | null>((ok) => bmp.toBlob(ok, 'image/png')) : Promise.resolve(null)), `pinkbean-${item.name || item.id}`)
  }, [bmp, item.name, item.id])
  return (
    <div ref={wrapRef} style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      {!bmp && <div className="pb-skel" style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', width: '62%', height: '28%', borderRadius: 8 }} />}
      <canvas ref={canvasRef} style={{ position: 'absolute', transform: 'translateZ(0)', imageRendering: 'pixelated', display: 'block', backfaceVisibility: 'hidden' }} />
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
  dotOffsets?: Record<string, { x: number; y: number }> // 내 모델: 후보가 변경점/변경쩜이면 내가 옮긴 점 위치
  stance?: boolean                          // 배경이 무기모션 자세(두손=stand2)로 구워졌으면 후보 아이템도 같은 자세로
  fraction?: number                         // 마네킹 높이 비율(없으면 CARD_FRACTION — 모바일 목록은 CARD_FRACTION_M)
  fitW?: number                             // 마네킹 높이 ≤ 칸 폭 × fitW(모바일 목록 CARD_FIT_W_M — SnapThumb 의 fitW 와 같다)
  ctxAction?: string                        // 배경이 내 무기 때문에 다른 자세로 구워졌으면 그 액션(thumbCtx.action) — 후보도 같은 자세로
}
function ModelThumb({ item, gaze, ctxItems, ctxKey, zmap, smap, skinHeadId, override, ctxEffs, pvEff, ctxExpr, faceMeta, dye, ear, weapon, stance, ctxAction, dotOffsets, fraction = CARD_FRACTION, fitW }: ModelProps) {
  // 합성 입력 전부(아래 합성 effect 의 의존과 같다) — 같으면 기억해 둔 그림을 쓴다
  const mkey = [item.id, ctxKey, skinHeadId, gaze, item.fixedEmotion || ctxExpr, ear, weapon, stance, ctxAction, oid(ctxEffs), pvEff ? `${+pvEff.wEffect}${+pvEff.cEffect}` : "", oid(faceMeta), oid(override), oid(dotOffsets)].join('|')
  const [placed, setPlaced] = useState<PlacedLayer[] | null>(() => modelDone.get(mkey)?.placed ?? null)
  const [effs, setEffs] = useState<EffectDraw[]>(() => modelDone.get(mkey)?.effs ?? [])
  const [parts, setParts] = useState<ParticleDraw[]>(() => modelDone.get(mkey)?.parts ?? [])
  const [ovr, setOvr] = useState<Map<string, HTMLCanvasElement> | undefined>(() => (modelDone.has(mkey) ? modelDone.get(mkey)!.ovr : override))
  const [dims, setDims] = useState<{ w: number; h: number; dpr: number }>({ w: 0, h: 0, dpr: 1 })
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const shotRef = useRef<ModelShot | null>(null)
  // 표정 얼굴장식이면 이 카드만 그 표정으로 본다(연출 설정·다른 카드에는 영향 없음).
  const cardExpr = item.fixedEmotion || ctxExpr
  const tv = thumbView(gaze, cardExpr, ear, weapon, stance) // 시선(왼/오/뒷) + 표정 + 귀/무기 반영
  const flip = tv.flip
  const ctxView = ctxAction && gaze !== 'back' ? { ...tv.view, action: ctxAction } : tv.view // 배경과 같은 자세

  useEffect(() => {
    const hit = modelDone.get(mkey)
    if (hit) { setPlaced(hit.placed); setEffs(hit.effs); setParts(hit.parts); setOvr(hit.ovr); return }
    let alive = true
    let doneOvr = override
    setPlaced(null); setEffs([]); setOvr(override)
    ;(async () => {
      let self: AssembleInput[]
      let selfMeta: ItemMeta | null = null
      // 이 카드가 무기면 서기 자세는 그 무기가 정한다(두손 전용 무기 → stand2, assemble.weaponPose).
      // 배경(몸·머리·내 착용)은 ctxView 자세로 구워져 있으므로, 자세가 바뀌면 아래에서 배경도 같은 자세로 다시 잡는다.
      let view = ctxView
      if (item.slot === 'weapon') { const wm = await loadMeta(item.id); if (!alive) return; view = weaponPose(wm, ctxView) }
      if (item.slot === 'skin' && skinHeadId) {
        const [body, head] = await Promise.all([loadMeta(item.id), loadMeta(skinHeadId)])
        self = [
          { itemId: head.id, slot: 'head', vslot: null, layers: getFrameLayers(head, view) },
          { itemId: body.id, slot: 'body', vslot: null, layers: getFrameLayers(body, view) },
        ]
      } else {
        const m = await loadMeta(item.id)
        selfMeta = m
        self = [{ itemId: m.id, slot: m.slot, vslot: m.vslot ?? null, layers: getFrameLayers(m, view), invisibleFace: m.invisibleFace, name: m.name, dotOffsets }]
      }
      if (!alive) return
      // 후보 아이템 자신도 "내가 고른 색"으로 물들여 보여준다 — 단, 헤어·성형만(내 모델에서만 dye 전달됨).
      //   이 둘은 전체 영역이 팔레트 변이(같은 색 인덱스)라 다른 헤어/성형에 그대로 적용해도 자연스럽다.
      //   다른 부위는 부분 발색/HSB(아이템마다 다르게 발색)라 후보엔 적용하지 않는다(배경 override 로만 반영).
      let selfOvr: Map<string, HTMLCanvasElement> | null = null
      if (dye && selfMeta && (item.slot === 'hair' || item.slot === 'face')) {
        selfOvr = await buildOverrides([selfMeta], dye, view).catch(() => null)
        if (!alive) return
      }
      // 표정 얼굴장식 카드: 배경에 구워진 얼굴은 ctxExpr(내 현재 표정) 기준이라, 이 카드가 보여줄
      // 표정으로 **얼굴만 다시 그린다**. 이때 염색 override 는 png 경로가 키라서 표정이 바뀌면
      // 통째로 빗나간다 → 그 표정 기준으로 얼굴 염색을 다시 굽고 배경 override 위에 덮어쓴다.
      // (안 하면 표정 얼굴장식 카드에서만 얼굴 염색이 풀려 보인다.)
      let bg = ctxItems
      if (view !== ctxView) {
        bg = await Promise.all(bg.map(async (ci) => { try { const m = await loadMeta(ci.itemId); return { ...ci, layers: getFrameLayers(m, view) } } catch { return ci } }))
        if (!alive) return
      }
      let faceOvr: Map<string, HTMLCanvasElement> | null = null
      if (cardExpr !== ctxExpr && faceMeta) {
        bg = bg.map((ci) => (ci.slot === 'face' ? { ...ci, layers: getFrameLayers(faceMeta, view) } : ci))
        if (dye) {
          faceOvr = await buildOverrides([faceMeta], dye, view).catch(() => null)
          if (!alive) return
        }
      }
      // 배경 염색(override) 위에 표정-재구운 얼굴(faceOvr) + 후보 헤어/성형 발색(selfOvr)을 덮어쓴다.
      if ((selfOvr && selfOvr.size) || (faceOvr && faceOvr.size)) {
        doneOvr = new Map<string, HTMLCanvasElement>([...(override ?? new Map()), ...(faceOvr ?? new Map()), ...(selfOvr ?? new Map())])
        setOvr(doneOvr)
      }
      // 라이딩(탈것) 카드 = 탑승 장착샷 (미리보기 규칙과 동일하게 리스트에도 반영).
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
      //   (특정 부위 탭은 목록 쪽(list/thumbCtx)이 이미 제외하지만 '전체' 탭·검색은 카드마다 슬롯이 달라 여기서 처리.)
      const bgF = item.slot === 'skin' ? bg : bg.filter((ci) => ci.slot !== item.slot)
      // 무기 이펙트를 끄면 무기(후보든 내 착용이든)의 이펙트 레이어도 뺀다 — 미리보기와 같은 규칙.
      const wOn = !pvEff || pvEff.wEffect
      const { placed: p, anchors } = assemble([...bgF, ...self].map((ci) => ({ ...ci, layers: dropWeaponEffects(ci.slot, ci.layers, wOn) })), zmap, smap)
      setPlaced(p)
      // 이펙트(망토 오라 등) = 배경(내 착용)의 것 + 이 아이템 자신의 것. 둘 다 같은 앵커로 배치한다.
      const foot = footOf(p) ?? { x: 8, y: 21 }
      const anch = { foot, brow: anchors.brow ?? foot }
      const draws: EffectDraw[] = []
      // 거대한 몸 · 변신 링은 착용 아이템의 이펙트를 그리지 않는다(원본 hideEffect) — 미리보기 · 프리셋 카드와 같은 규칙.
      const noFx = !!ringIllusion([...bgF, ...self])?.hideEffect
      if (!noFx) for (const { em } of ctxEffs || []) draws.push(...effectDraws(em, view.action, anch, 0))
      // 이 아이템 "자신의" 이펙트(망토 오라 등)는 아이템 모습의 일부 → 모델·내 모델 모두 그린다(연출 토글은 적용).
      //   ('내 모델/프리셋만' 규칙은 배경=내 착용 아이템들의 이펙트(ctxEffs) 얘기고, 그건 모델엔 배경이 없어 자연히 없다.)
      if (!noFx && item.slot !== 'skin' && (!pvEff || effectEnabled(item.slot, pvEff))) {
        const bare = String(parseInt(item.id, 10))
        const eidx = await loadEffectIndex().catch(() => new Set<string>())
        if (alive && eidx.has(bare)) {
          const em = await loadEffect(item.id).catch(() => null)
          if (em) draws.push(...effectDraws(em, view.action, anch, 0))
        }
      }
      // 이 아이템 자신의 파티클(제네시스 무기의 붉은 파장 등) — 다 퍼진 한 장. 무기 이펙트를 끄면 없다.
      let parts: ParticleDraw[] = []
      if (!noFx && !ringIllusion([...bgF, ...self])?.hideWeapon && (!pvEff || effectEnabled(item.slot, pvEff))) {
        const pIdx = await loadParticleIndex()
        const spots = spotsFor(pIdx[item.id], view.action)
        if (spots.length) {
          const descs = new Map<string, ParticleDesc>()
          for (const d of await Promise.all([...new Set(spots.map((x) => x.name))].map((n) => loadParticle(n)))) if (d) descs.set(d.name, d)
          parts = placeParticles(spots, descs, foot, (d) => stillSim(d))
        }
      }
      memo(modelDone, mkey, { placed: p, effs: draws, parts, ovr: doneOvr })
      if (alive) { setEffs(draws); setParts(parts) }
    })().catch(() => {})
    return () => { alive = false }
  }, [mkey]) // eslint-disable-line react-hooks/exhaustive-deps -- 입력 전부가 mkey 에 들어 있다(연출 설정은 객체가 아니라 이펙트 켜짐 값으로)

  // 셀(div) 표시크기 + dpr 실측. dpr 변경(브라우저 줌/모니터 이동)은 window resize 로도 잡는다. 페인트 전에 재고 그린다(머리의 기억 주석)
  useIsoLayoutEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const measure = () => {
      const w = el.clientWidth, h = el.clientHeight, dpr = window.devicePixelRatio || 1
      if (w > 0 && h > 0) setDims((d) => (d.w === w && d.h === h && d.dpr === dpr ? d : { w, h, dpr }))
    }
    measure()
    // 칸 크기가 바뀌면 그리기 전에 바로 반영한다 — 감지기 하나에 묶어 한 번에(lib/sizeWatch)
    const off = watchSize(el, measure)
    window.addEventListener('resize', measure)
    return () => { off(); window.removeEventListener('resize', measure) }
  }, [])

  useIsoLayoutEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !placed || !dims.w || !dims.h) return
    let cancelled = false
    const back = gaze === 'back'
    // snap: 배율을 정수로 스냅해 카드 도트가 항상 완전히 선명(모든 카드 동일, 화면 크기별로만 살짝 다름).
    const fr = fitW ? Math.min(fraction, (fitW * dims.w) / dims.h) : fraction
    const lift = fitW === CARD_FIT_W_M ? { ...CARD_LIFT_M, maxW: fitW * dims.w } : undefined // 모바일 카드(한 단계 올리기 — shopData.CARD_LIFT_M)
    const p = computeModelPlacement({ divW: dims.w, divH: dims.h, dpr: dims.dpr, margin: CARD_MARGIN, fraction: fr, snap: true, lift, centerDx: back ? MODEL_REF.backDx : MODEL_REF.centerDx, centerDy: back ? MODEL_REF.backDy : MODEL_REF.centerDy, drop: true })
    // 캔버스를 화면 픽셀 격자에 맞춰 가운데(미리보기와 같은 규칙 — translate(-50%) 는 소수 px 라 도트가 뭉갠다).
    const { bw, bh } = canvasBitmap(p)
    fitCanvas(canvas, wrapRef.current, bw, bh, dims.w, dims.h, dims.dpr)
    // 마네킹 중심을 셀 중앙에 고정(anchor 보정). flip=오른쪽 시선. 분수 scale=디바이스 해상도.
    const cm = item.slot === 'riding' && !!item.ridingCenterMount // 메탈아머는 메카(마운트) 중앙정렬
    renderCharacter(canvas, placed, { scale: p.scale, box: p.box, anchor: p.anchor, flip, centerX: item.slot === 'riding' && !cm, centerMount: cm, override: ovr, effects: effs, particles: parts, shouldCancel: () => cancelled }).catch(() => {})
    // 우클릭 복사용 입력 — 화면과 같은 값(중심 오프셋·반전·라이딩 정렬)으로 다시 그린다(lib/canvasExport.modelShotBlob).
    shotRef.current = { placed, override: ovr ?? undefined, effects: effs, particles: parts, flip, centerX: item.slot === 'riding' && !cm, centerMount: cm, centerDx: back ? MODEL_REF.backDx : MODEL_REF.centerDx, centerDy: back ? MODEL_REF.backDy : MODEL_REF.centerDy }
    return () => { cancelled = true }
  }, [placed, effs, parts, flip, dims, gaze, ovr, fraction, fitW])

  // 우클릭/롱프레스 이미지 메뉴 바인딩(캔버스는 항상 존재). item 바뀌면 파일명 갱신 위해 재바인딩.
  useEffect(() => {
    const el = canvasRef.current
    if (!el) return
    return bindImageMenu(el, () => (shotRef.current ? modelShotBlob(shotRef.current) : Promise.resolve(null)), `pinkbean-${item.name || item.id}`)
  }, [item.name, item.id])

  return (
    <div ref={wrapRef} style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      {!placed && <div className="pb-skel" style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', width: '62%', height: '62%', borderRadius: 8 }} />}
      {/* 셀보다 큰 캔버스를 절대배치 중앙정렬 → 셀 overflow:hidden 으로만 잘린다. */}
      {/* 우클릭/롱프레스 → 복사/저장 메뉴(bindImageMenu, 위 effect). 그 시점에만 같은 입력으로 다시 그린다. */}
      <canvas ref={canvasRef} style={{ position: 'absolute', transform: 'translateZ(0)', imageRendering: 'pixelated', display: 'block', backfaceVisibility: 'hidden' }} />
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
  ear?: string; weapon?: string; isMy?: boolean; stance?: boolean; ctxAction?: string
  dotOffsets?: Record<string, { x: number; y: number }>
  chat?: ChatState
  fraction?: number; fitW?: number
}) {
  if (props.mode !== 'sprite' && props.item.chatUi && props.chat) return <ChatThumb item={props.item} chat={props.chat} />
  if (props.mode === 'sprite') return props.item.slot === 'hair' ? <HairSprite item={props.item} zmap={props.zmap} /> : <Sprite item={props.item} />
  return <ModelThumb item={props.item} gaze={props.gaze} ctxItems={props.ctxItems} ctxKey={props.ctxKey} override={props.override} ctxEffs={props.ctxEffs} pvEff={props.pvEff} zmap={props.zmap} smap={props.smap} skinHeadId={props.skinHeadId} ctxExpr={props.ctxExpr} faceMeta={props.faceMeta} dye={props.dye} ear={props.ear} weapon={props.weapon} isMy={props.isMy} stance={props.stance} ctxAction={props.ctxAction} dotOffsets={props.dotOffsets} fraction={props.fraction} fitW={props.fitW} />
}
