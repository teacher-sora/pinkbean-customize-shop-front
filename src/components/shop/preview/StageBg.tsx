'use client'

// 미리보기의 배경(lib/stageBg). 피팅룸이면 배경 장면을, 아니면 고른 색 · 캐시샵 배경 · 올린 그림을 깐다 — 그때는 장면을 띄우지 않는다.
// 코디가 서는 다른 칸(광장 상세 · 광장 등록)도 같은 배경을 깐다. 그 칸들은 still: 피팅룸을 움직이지 않는 그림으로만 둔다.
// 캐시샵 배경은 미리보기에서 캐릭터와 같은 도트 크기(lib/stageFloor 의 정수 배율)로 키우고, 그림의 바닥 줄(CASH_BG_GROUND)을
// 캐릭터가 딛는 줄에, 그림 가운데를 캐릭터 가운데에 맞춘다 — 게임처럼 캐릭터가 땅 위에 선다. 그림 밖은 위 · 아래 끝 색으로 채운다.
// 바닥을 알리지 않는 칸(still)은 칸에 맞춰 채우기만 한다.

import { useEffect, useRef, useState } from 'react'
import { CASH_BGS, CASH_BG_GROUND, CASH_BG_H, CASH_BG_W, getStageBg, stageSelOf, useStageBg, type CashBg } from '@/lib/stageBg'
import { MODEL_DROP, MODEL_REF, zoomStepScale } from '@/lib/core/modelPlacement'
import { ZOOM_WORLD } from '@/lib/shopData'
import { isDarkTheme } from '@/lib/theme'
import { SCENE_SRC } from '../scene/sceneSrc'
import { ROOM } from '../scene/sceneData'
import { getStageFloor, onStageFloor } from '@/lib/stageFloor'
import SceneCanvas from '../scene/SceneCanvas'
import styles from './preview.module.css'

export const STAGE_COLORS: Record<string, string> = { white: '#ffffff', black: '#141210' }
// 시스템 테마(사용자 지시): 라이트면 프리셋 카드 바탕 #f7f2ec, 다크면 다크 카드 색. 화면은 CSS 변수(--pb-sys-bg, globals.css), 그림으로 내보낼 때는 이 값
export const SYS_BG = { light: '#f7f2ec', dark: '#3b3d45' }
export const SYS_BG_CSS = 'var(--pb-sys-bg)'
export const stageColor = (sel: string): string | undefined => sel === 'system' ? (isDarkTheme() ? SYS_BG.dark : SYS_BG.light) : STAGE_COLORS[sel]

// 카드(프리셋 · 광장 상세)의 배경 — 그 칸의 캐릭터(SnapThumb)와 같은 도트 크기 · 같은 발 자리에 깐다(사용자 지시: 카드 캐릭터는 배율 없이 그려지니
// 미리보기와 같은 모습이 되게). 미리보기(PreviewModel 의 setStageFloor)와 같은 식이다:
//  · 배율 = SnapThumb 의 computeModelPlacement(snap: true) — 기기 픽셀 정수 round(fraction × 칸 높이 × dpr ÷ bodyRefH), CSS 1게임px = 배율 ÷ dpr
//  · 발 = 칸 가운데에서 (−centerDy + MODEL_DROP + 21) 게임px 아래, 가로는 칸 가운데
// 그래서 칸 크기를 직접 잰다(칸마다 · 화면마다 반올림이 다르다).
function useBox (ref: React.RefObject<HTMLDivElement | null>) {
  const [b, setB] = useState({ w: 0, h: 0, dpr: 1 })
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const m = () => { const w = el.clientWidth, h = el.clientHeight, dpr = window.devicePixelRatio || 1; setB((p) => (p.w === w && p.h === h && p.dpr === dpr ? p : { w, h, dpr })) }
    m()
    const ro = new ResizeObserver(m); ro.observe(el)
    window.addEventListener('resize', m)
    return () => { ro.disconnect(); window.removeEventListener('resize', m) }
  }, [ref])
  return b
}
const FOOT_FROM_NAVEL = 21 // 배꼽 → 발(게임px) — PreviewModel 의 바닥 줄과 같은 값
type Layer = { src: string; w: number; h: number; fx: number; fy: number } // 그림 크기와 그 안의 발 자리(게임px)
// zoom: 미리보기 배율 단계로 키운다(코디 비교 — SnapThumb 의 zoom 과 같은 배율)
export function CardStageBg({ sel, fraction, zoom }: { sel?: string; fraction: number; zoom?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const box = useBox(ref)
  const v = stageSelOf(sel)
  const cash = CASH_BGS.find((c) => c.id === v)
  const layers: Layer[] = v === 'room' ? SCENE_SRC.room.map((src) => ({ src, w: ROOM.w, h: ROOM.h, fx: ROOM.foot[0], fy: ROOM.foot[1] }))
    : cash ? [{ src: cash.src, w: CASH_BG_W, h: CASH_BG_H, fx: CASH_BG_W / 2, fy: CASH_BG_GROUND }] : []
  const img = !layers.length ? getStageBg().images.find((i) => i.id === v)?.src : undefined
  const fill = v === 'room' ? '#14110f' : cash ? `linear-gradient(to bottom, ${cash.top} 50%, ${cash.bottom} 50%)` : v === 'system' ? SYS_BG_CSS : STAGE_COLORS[v]
  const sc = !box.h ? 0 : zoom != null ? zoomStepScale({ fraction, divH: box.h, dpr: box.dpr, level: zoom, mults: ZOOM_WORLD }) : Math.max(1, Math.round((fraction * box.h * box.dpr) / MODEL_REF.bodyRefH))
  const k = sc / box.dpr
  const fx = box.w / 2, fy = box.h / 2 + (-MODEL_REF.centerDy + MODEL_DROP + FOOT_FROM_NAVEL) * k
  return (
    <div ref={ref} aria-hidden className={styles.stageBg} style={img ? { backgroundImage: `url("${img}")` } : { background: fill }}>
      {k > 0 && layers.map((l) => (
        <img key={l.src} alt="" src={l.src} className={styles.stageCardImg} style={{ left: fx - l.fx * k, top: fy - l.fy * k, width: l.w * k, height: l.h * k }} />
      ))}
    </div>
  )
}

function CashStage({ bg, still }: { bg: CashBg; still?: boolean }) {
  const [floor, setFloor] = useState(getStageFloor)
  useEffect(() => (still ? undefined : onStageFloor(() => setFloor(getStageFloor()))), [still])
  const fill = `linear-gradient(to bottom, ${bg.top} 50%, ${bg.bottom} 50%)`
  if (still || !floor) return <div aria-hidden className={styles.stageBg} style={{ backgroundImage: `url("${bg.src}"), ${fill}`, backgroundSize: 'cover, 100% 100%', backgroundPosition: 'center 70%, 0 0' }} />
  const k = floor.scale / (window.devicePixelRatio || 1) // 게임 1칸 = CSS 몇 px
  const x = floor.cx - (CASH_BG_W / 2) * k, y = floor.footY - CASH_BG_GROUND * k
  return (
    <div aria-hidden className={styles.stageBgCash}
      style={{ backgroundImage: `url("${bg.src}"), ${fill}`, backgroundSize: `${CASH_BG_W * k}px ${CASH_BG_H * k}px, 100% 100%`, backgroundPosition: `${x}px ${y}px, 0 0` }} />
  )
}

export default function StageBg({ still }: { still?: boolean }) {
  const bg = useStageBg()
  if (bg.sel === 'room') return <SceneCanvas kind="room" still={still} />
  const cash = CASH_BGS.find((c) => c.id === bg.sel)
  if (cash) return <CashStage bg={cash} still={still} />
  const img = bg.images.find((i) => i.id === bg.sel)
  return <div aria-hidden className={styles.stageBg} style={img ? { backgroundImage: `url("${img.src}")` } : { background: bg.sel === 'system' ? SYS_BG_CSS : STAGE_COLORS[bg.sel] }} />
}

