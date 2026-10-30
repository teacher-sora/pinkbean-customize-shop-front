'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { watchSize } from '@/lib/sizeWatch'
import { useIsoLayoutEffect } from '@/lib/uiState'
import { footOf, type PlacedLayer } from '@/lib/core/assemble'
import { type AnimaRace, type Index } from '@/lib/core/data'
import { canvasBitmap, computeModelPlacement, fitCanvas, MODEL_REF, zoomStepScale } from '@/lib/core/modelPlacement'
import type { ParticleDraw } from '@/lib/core/particle'
import { renderCharacter, type EffectDraw } from '@/lib/core/render'
import { animaNow, animaOnce, composePeek, composeSnapshotCached, snapKey, type SnapComposite } from '@/lib/core/snapRender'
import { modelShotBlob, type ModelShot } from '@/lib/canvasExport'
import { bindImageMenu } from '@/lib/canvasMenu'
import { BASE_TAG, type ChatUi } from '@/lib/core/chatUi'
import { CARD_FRACTION, CARD_MARGIN, CHAT_FILES, ZOOM_WORLD } from '@/lib/shopData'
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

const RETRY_MS = 9000
// 명찰 조각 정보(id → chatUi). 명찰 · 말풍선 목록 파일을 처음 쓸 때 한 번만 받는다.
let tagUis: Promise<Map<string, ChatUi>> | null = null
// 칭호 · 훈장 · 말풍선(deco 일 때만 — 불러오기 창이 가져올 장식을 미리 보여 준다). 부위별 목록을 한 번만 받는다
type DecoEntry = { ui: ChatUi; name: string }
const decoLists = new Map<string, Promise<Map<string, DecoEntry>>>()
const loadDeco = (slot: 'title' | 'medal' | 'chatBalloon') => {
  let p = decoLists.get(slot)
  if (!p) {
    p = fetch(CHAT_FILES[slot]).then((r) => (r.ok ? r.json() : [])).then((l: { id: string; slot: string; name?: string; chatUi?: ChatUi }[]) => new Map(l.filter((x) => x.slot === slot && x.chatUi).map((x) => [x.id, { ui: x.chatUi!, name: x.name ?? '' }]))).catch(() => new Map())
    decoLists.set(slot, p)
  }
  return p
}
const loadTagUis = () => (tagUis ??= fetch(CHAT_FILES.nameTag).then((r) => (r.ok ? r.json() : [])).then((l: { id: string; slot: string; chatUi?: ChatUi }[]) => new Map(l.filter((x) => x.slot === 'nameTag' && x.chatUi).map((x) => [x.id, x.chatUi!]))).catch(() => new Map()))
// 미리 합성(줄을 서지 않고 바로) — 광장 카드에 마우스를 올리거나 누르는 순간 상세의 그림을 먼저 만든다(사용자 지시: 상세가 더 빨리 뜨게).
// 같은 코디를 그리는 쪽(카드 · 상세)은 캐시 · 진행 중 합성을 함께 쓴다(snapRender)
// 끝나면 풀리는 약속을 돌려준다(코디 비교는 떠나는 칸의 정지 그림을 먼저 만들어 두고 칸을 옮긴다 — 옮긴 순간 그 칸에 뼈대가 비치지 않게)
export function warmSnap (snap: Snapshot, index: Index | null | undefined, view?: boolean): Promise<unknown> {
  const ar = animaNow()
  if (!index || !ar) return Promise.resolve()
  const key = snapKey(snap)
  if (composePeek(key, index, ar, view) !== undefined) return Promise.resolve()
  return composeSnapshotCached(key, snap, index, ar, view).catch(() => {})
}
export default function SnapThumb({ snap, fraction = CARD_FRACTION, margin = CARD_MARGIN, priority = 0, view, tagName, baseTag: forceBase, fileName, holdMenu = true, onDrawn, deco, zoom, chatText, defBalloon, fitW, keep, onFloor }: {
  snap: Snapshot; fraction?: number; margin?: number; priority?: number; view?: boolean; tagName?: string; fileName?: string
  // 코디가 바뀌어 다시 합성하는 동안 그리던 그림을 두고, 다 되면 바꾼다(뼈대를 비추지 않는다) — 목록 카드(ItemThumb)와 같은 몸짓.
  // 같은 코디에 연출만 바뀌는 카드(코디 룩북 — 지금 연출을 얹는다)에 쓴다. 다른 코디로 갈아 끼우는 칸에는 쓰지 않는다
  keep?: boolean
  // 그린 발 자리(칸 기준 CSS px) · 배율을 알린다 — 같은 칸의 배경(CardStageBg floor)이 캐릭터와 같은 자리에 깔리게(코디 비교의 칸, PreviewModel 의 setStageFloor 와 같은 계산 — 발 높이도 그 자세의 실제 발 자리)
  onFloor?: (f: { cx: number; footY: number; scale: number }) => void
  fitW?: number // 캐릭터 높이(fraction × 칸 높이)가 칸 폭 × fitW 를 넘지 않게 — 좁고 긴 칸에서 배율이 2배로 뛰어 옆이 잘리지 않게(코디 룩북 카드)
  zoom?: number // 미리보기 배율 단계(1~3)로 그린다 — 코디 비교의 칸들이 고른 칸(PreviewModel)과 같은 도트 크기가 되게(zoomStepScale)
  deco?: boolean // 칭호 · 훈장 · 말풍선도 그린다(불러오기 창 — 가져올 장식 토글이 무엇을 바꾸는지 보이게. 말풍선은 '안녕하세요')
  // 말풍선을 미리보기와 같은 규칙으로(코디 비교의 정지 칸): null = 보낸 말이 없어 말풍선 없음, 글 = 그 칸의 말풍선 반지(없으면 defBalloon)에 그 글
  chatText?: string | null; defBalloon?: ChatUi | null
  onDrawn?: () => void // 캔버스에 다 그렸을 때(액션 상세의 재생 칸이 다 그려진 프레임만 번갈아 보인다)
  baseTag?: boolean // 명찰 반지가 없을 때 기본 명찰을 그릴지(없으면 스냅샷의 연출 설정 pv.baseTag) — 닉네임 불러오기 카드는 늘 켠다(사용자 지시)
  holdMenu?: boolean // false = 터치 길게 누르기로 메뉴를 열지 않는다(프리셋 카드 — 길게 누르기는 끌기다, preset/usePresetDrag)
}) {
  const { index } = useShop()
  const [placed, setPlaced] = useState<PlacedLayer[] | null>(null)
  const placedRef = useRef(placed)
  placedRef.current = placed
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
  const baseTag = tagName != null && !snap.equipped.nameTag && (forceBase ?? !!snap.pv?.baseTag)
  const decoId = (sl: string) => (deco && !snap.hidden?.[sl] ? snap.equipped[sl] : undefined)
  const titleId = decoId('title'), medalId = decoId('medal'), balloonId = chatText === null ? undefined : decoId('chatBalloon')
  const [decoUi, setDecoUi] = useState<{ title?: DecoEntry; medal?: DecoEntry; balloon?: DecoEntry }>({})
  useEffect(() => {
    if (!titleId && !medalId && !balloonId) { setDecoUi({}); return }
    let alive = true
    Promise.all([titleId ? loadDeco('title') : null, medalId ? loadDeco('medal') : null, balloonId ? loadDeco('chatBalloon') : null]).then(([t, m, b]) => {
      if (alive) setDecoUi({ title: titleId ? t?.get(titleId) : undefined, medal: medalId ? m?.get(medalId) : undefined, balloon: balloonId ? b?.get(balloonId) : undefined })
    })
    return () => { alive = false }
  }, [titleId, medalId, balloonId])
  const chat = useMemo(() => {
    const tag = tagName != null ? tagUi ?? (baseTag ? BASE_TAG : undefined) : undefined
    const { title, medal } = decoUi
    const said = deco && typeof chatText === 'string'
    const balloon = chatText === null ? undefined : decoUi.balloon?.ui ?? (said && defBalloon ? defBalloon : undefined)
    if (!tag && !title && !medal && !balloon) return undefined
    return { tag, title, medal, balloon, name: tagName ?? '', text: balloon ? (said ? chatText : '안녕하세요') : '' }
  }, [tagUi, tagName, baseTag, decoUi, deco, chatText, defBalloon])

  const drawnRef = useRef(onDrawn)
  const floorRef = useRef(onFloor)
  floorRef.current = onFloor
  drawnRef.current = onDrawn
  const prioRef = useRef(priority)
  prioRef.current = priority
  const jobRef = useRef<ReturnType<typeof enqueueThumb> | null>(null)
  // 합성이 RETRY_MS 안에 끝나지 않으면(느린 휴대폰 네트워크에서 그림 하나가 멈춘 경우) 다시 줄을 선다 — 새로고침 전까지 빈 칸으로 남지 않게
  const [retry, setRetry] = useState(0)
  // 그리기 전에(layout effect) 캐시를 본다 — 합성해 둔 코디는 첫 페인트부터 그림이라 탭을 오갈 때 뼈대가 깜빡이지 않는다(사용자 지시: 프리셋 탭). 바뀐 코디만 새로 합성한다
  useIsoLayoutEffect(() => {
    if (!index || !animaRaces) return
    let alive = true, got = false
    const done = (r: SnapComposite | null) => {
      got = true
      if (alive && r) { setPlaced(r.placed); setOv(r.overrides); setEffects(r.effects); setParticles(r.particles); setCenter(r.center) }
    }
    // 이미 합성해 둔 코디면 줄(thumbQueue)을 서지 않고 그 자리에서 그린다 — 필터를 오가도 계산이 0 이고
    // 뼈대(스켈레톤)가 한 번 깜빡이지도 않는다.
    const hit = composePeek(key, index, animaRaces, view)
    if (hit !== undefined) { done(hit); return () => { alive = false } }
    if (!keep || !placedRef.current) setPlaced(null)
    const job = enqueueThumb(prioRef.current, () => composeSnapshotCached(key, snap, index, animaRaces, view).then(done))
    jobRef.current = job
    const t = retry < 3 ? setTimeout(() => { if (alive && !got) setRetry((n) => n + 1) }, RETRY_MS) : undefined
    return () => { alive = false; job.cancel(); clearTimeout(t) }
  }, [key, index, animaRaces, view, retry])
  useEffect(() => { jobRef.current?.setPrio(priority) }, [priority])

  // 칸 재기 · 그리기는 페인트 전에 — 합성해 둔 코디는 첫 페인트부터 그림이다(코디 비교 칸이 생기는 순간 빈 칸이 비치지 않게)
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
    const fr = fitW ? Math.min(fraction, (fitW * dims.w) / dims.h) : fraction
    const scale = zoom != null ? zoomStepScale({ fraction: fr, divH: dims.h, dpr: dims.dpr, level: zoom, mults: ZOOM_WORLD }) : undefined
    // view 면 몸통 중심도 미리보기와 같은 값 — 뒷쪽 · 맨몸 사다리 · 밧줄은 등반 자세용 중심(PreviewModel 의 climbCenter)
    const sp = snap.pv, rideOn = !!snap.equipped.riding && !snap.hidden?.riding
    const climb = !!view && (sp?.gaze === 'back' || (!rideOn && (sp?.action === 'ladder' || sp?.action === 'rope')))
    const p = computeModelPlacement({ divW: dims.w, divH: dims.h, dpr: dims.dpr, margin, fraction: fr, scale, snap: true, drop: true,
      ...(climb ? { centerDx: MODEL_REF.previewBackDx, centerDy: MODEL_REF.previewBackDy } : {}) })
    const { bw, bh } = canvasBitmap(p)
    fitCanvas(canvas, wrapRef.current, bw, bh, dims.w, dims.h, dims.dpr)
    if (floorRef.current && wrapRef.current) {
      const rect = wrapRef.current.getBoundingClientRect()
      const leftDev = Math.round((dims.w * dims.dpr - bw) / 2) - ((rect.left * dims.dpr) % 1), topDev = Math.round((dims.h * dims.dpr - bh) / 2) - ((rect.top * dims.dpr) % 1)
      floorRef.current({ cx: (leftDev + bw / 2) / dims.dpr, footY: (topDev + Math.round((p.anchor.y + (footOf(placed)?.y ?? 21)) * p.scale)) / dims.dpr, scale: p.scale })
    }
    // view 면 그 코디의 시선도 따른다(오른쪽 = 좌우 반전 — 미리보기와 같은 규칙. 코디 비교의 정지 칸)
    renderCharacter(canvas, placed, { scale: p.scale, box: p.box, anchor: p.anchor, flip: view && snap.pv?.gaze === 'right', centerX: center === 'x', centerMount: center === 'mount', override: ov, effects, particles, chat, shouldCancel: () => cancelled }).then(() => { if (!cancelled) drawnRef.current?.() }).catch(() => {})
    return () => { cancelled = true }
  }, [placed, ov, effects, particles, center, dims, fraction, fitW, margin, chat, zoom, view, snap.pv?.gaze, snap.pv?.action, snap.equipped.riding, snap.hidden?.riding])

  // 우클릭/롱프레스 이미지 메뉴 바인딩(캔버스는 항상 존재). 복사 이미지는 화면 픽셀이 아니라 **지금 그린 입력**으로
  // 다시 그린다 — 모든 복사가 같은 규칙(lib/canvasExport.modelShotBlob: 그림에 맞춘 상자 · 게임 크기 1배).
  const shotRef = useRef<ModelShot | null>(null)
  shotRef.current = placed ? { placed, override: ov, effects, particles, chat, centerX: center === 'x', centerMount: center === 'mount' } : null
  useEffect(() => {
    const el = canvasRef.current
    if (!el) return
    return bindImageMenu(el, () => (shotRef.current ? modelShotBlob(shotRef.current) : Promise.resolve(null)), fileName || 'pinkbean-cody', undefined, { hold: holdMenu }) // 프리셋 카드는 프리셋 이름(presetFileName)
  }, [fileName, holdMenu])

  return (
    <div ref={wrapRef} style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      {!placed && <div className="pb-skel" style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', width: '58%', height: '58%', borderRadius: 8 }} />}
      <canvas ref={canvasRef} style={{ position: 'absolute', transform: 'translateZ(0)', imageRendering: 'pixelated', display: 'block', backfaceVisibility: 'hidden' }} />
    </div>
  )
}
