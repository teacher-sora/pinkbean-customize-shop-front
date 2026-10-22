'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { type PlacedLayer } from '@/lib/core/assemble'
import { type AnimaRace } from '@/lib/core/data'
import { canvasBitmap, computeModelPlacement, fitCanvas } from '@/lib/core/modelPlacement'
import type { ParticleDraw } from '@/lib/core/particle'
import { renderCharacter, type EffectDraw } from '@/lib/core/render'
import { animaNow, animaOnce, composePeek, composeSnapshotCached, snapKey, type SnapComposite } from '@/lib/core/snapRender'
import { modelShotBlob, type ModelShot } from '@/lib/canvasExport'
import { bindImageMenu } from '@/lib/canvasMenu'
import { BASE_TAG, type ChatUi } from '@/lib/core/chatUi'
import { CARD_FRACTION, CARD_MARGIN, CHAT_FILES } from '@/lib/shopData'
import { enqueueThumb } from '@/lib/thumbQueue'
import { useShop, type Snapshot } from './ShopContext'

// 스냅샷(착용+톤+염색)을 실제 모델로 합성해 부모 div 중앙에 그린다.
// 코디/미리보기와 동일한 computeModelPlacement 규칙 → 어디서 쓰든 모델 비율이 같다.
// 정지 프레임(stand1) + 염색 + 이펙트(망토 등) 반영 → 이펙트만 있는 망토도 구분된다.
// 프리셋 카드와 닉네임 코디 선택 다이얼로그가 함께 쓴다(같은 그림이어야 하므로 공용).
// 부모는 position:relative + 크기가 있어야 한다(이 컴포넌트는 inset:0 으로 채운다).
// priority: 0 = 보이는 것(곧바로), 1 이상 = 화면 밖 미리 그리기(보이는 것이 다 끝난 뒤) — lib/thumbQueue.
// view: 스냅샷의 연출 설정(액션·표정)까지 그려 준다 — 연출 설정 고르기의 작은 미리보기 전용.
// tagName: 끼운 명찰(칸이 비었으면 그 프리셋의 기본 명찰 — pv.baseTag)을 이 이름으로 함께 그린다 — 프리셋 카드만(프리셋 이름, 사용자 지시). 말풍선은 그리지 않는다.

// 명찰 조각 정보(id → chatUi). 명찰 · 말풍선 목록 파일을 처음 쓸 때 한 번만 받는다.
let tagUis: Promise<Map<string, ChatUi>> | null = null
const loadTagUis = () => (tagUis ??= fetch(CHAT_FILES.nameTag).then((r) => (r.ok ? r.json() : [])).then((l: { id: string; slot: string; chatUi?: ChatUi }[]) => new Map(l.filter((x) => x.slot === 'nameTag' && x.chatUi).map((x) => [x.id, x.chatUi!]))).catch(() => new Map()))
export default function SnapThumb({ snap, fraction = CARD_FRACTION, margin = CARD_MARGIN, priority = 0, view, tagName }: {
  snap: Snapshot; fraction?: number; margin?: number; priority?: number; view?: boolean; tagName?: string
}) {
  const { index } = useShop()
  const [placed, setPlaced] = useState<PlacedLayer[] | null>(null)
  const [ov, setOv] = useState<Map<string, HTMLCanvasElement>>(new Map())
  const [effects, setEffects] = useState<EffectDraw[]>([])
  const [particles, setParticles] = useState<ParticleDraw[] | undefined>(undefined)
  // 라이딩 카드의 가로 정렬 기준(합성기가 정해 준다) — 부위 카드(ItemThumb)·미리보기와 같은 규칙.
  const [center, setCenter] = useState<'x' | 'mount' | undefined>(undefined)
  const [dims, setDims] = useState<{ w: number; h: number; dpr: number }>({ w: 0, h: 0, dpr: 1 })
  // 형상변이 목록은 **이미 받아 뒀으면 그 값으로 시작**한다. 빈 배열로 한 번 그린 뒤 목록이 도착해 다시 그리면
  // 카드마다 합성이 두 번 돈다(광장 필터를 오갈 때 느려지는 원인).
  const [animaRaces, setAnimaRaces] = useState<AnimaRace[] | null>(animaNow)
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => { if (!animaRaces) animaOnce().then(setAnimaRaces).catch(() => {}) }, [animaRaces])
  const key = useMemo(() => snapKey(snap), [snap])
  // 프리셋 카드의 명찰: 끼웠고 숨기지 않았을 때만
  const tagId = tagName != null && !snap.hidden?.nameTag ? snap.equipped.nameTag : undefined
  const [tagUi, setTagUi] = useState<ChatUi | undefined>(undefined)
  useEffect(() => {
    if (!tagId) { setTagUi(undefined); return }
    let alive = true
    loadTagUis().then((m) => { if (alive) setTagUi(m.get(tagId)) })
    return () => { alive = false }
  }, [tagId])
  const baseTag = tagName != null && !snap.equipped.nameTag && !!snap.pv?.baseTag
  const chat = useMemo(() => { const tag = tagUi ?? (baseTag ? BASE_TAG : undefined); return tag && tagName != null ? { tag, name: tagName, text: '' } : undefined }, [tagUi, tagName, baseTag])

  const prioRef = useRef(priority)
  prioRef.current = priority
  const jobRef = useRef<ReturnType<typeof enqueueThumb> | null>(null)
  useEffect(() => {
    if (!index || !animaRaces) return
    let alive = true
    const done = (r: SnapComposite | null) => {
      if (alive && r) { setPlaced(r.placed); setOv(r.overrides); setEffects(r.effects); setParticles(r.particles); setCenter(r.center) }
    }
    // 이미 합성해 둔 코디면 줄(thumbQueue)을 서지 않고 그 자리에서 그린다 — 필터를 오가도 계산이 0 이고
    // 뼈대(스켈레톤)가 한 번 깜빡이지도 않는다.
    const hit = composePeek(key, index, animaRaces, view)
    if (hit !== undefined) { done(hit); return () => { alive = false } }
    setPlaced(null)
    const job = enqueueThumb(prioRef.current, () => composeSnapshotCached(key, snap, index, animaRaces, view).then(done))
    jobRef.current = job
    return () => { alive = false; job.cancel() }
  }, [key, index, animaRaces, view])
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
    const p = computeModelPlacement({ divW: dims.w, divH: dims.h, dpr: dims.dpr, margin, fraction, snap: true, drop: true })
    const { bw, bh } = canvasBitmap(p)
    fitCanvas(canvas, wrapRef.current, bw, bh, dims.w, dims.h, dims.dpr)
    renderCharacter(canvas, placed, { scale: p.scale, box: p.box, anchor: p.anchor, centerX: center === 'x', centerMount: center === 'mount', override: ov, effects, particles, chat, shouldCancel: () => cancelled }).catch(() => {})
    return () => { cancelled = true }
  }, [placed, ov, effects, particles, center, dims, fraction, margin, chat])

  // 우클릭/롱프레스 이미지 메뉴 바인딩(캔버스는 항상 존재). 복사 이미지는 화면 픽셀이 아니라 **지금 그린 입력**으로
  // 다시 그린다 — 모든 복사가 같은 규칙(lib/canvasExport.modelShotBlob: 그림에 맞춘 상자 · 게임 크기 1배).
  const shotRef = useRef<ModelShot | null>(null)
  shotRef.current = placed ? { placed, override: ov, effects, particles, chat, centerX: center === 'x', centerMount: center === 'mount' } : null
  useEffect(() => {
    const el = canvasRef.current
    if (!el) return
    return bindImageMenu(el, () => (shotRef.current ? modelShotBlob(shotRef.current) : Promise.resolve(null)), 'pinkbean-cody')
  }, [])

  return (
    <div ref={wrapRef} style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      {!placed && <div className="pb-skel" style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', width: '58%', height: '58%', borderRadius: 8 }} />}
      <canvas ref={canvasRef} style={{ position: 'absolute', transform: 'translateZ(0)', imageRendering: 'pixelated', display: 'block', backfaceVisibility: 'hidden' }} />
    </div>
  )
}
