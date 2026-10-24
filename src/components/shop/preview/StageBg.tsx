'use client'

// 미리보기의 배경(lib/stageBg). 피팅룸이면 배경 장면을, 아니면 고른 색 · 캐시샵 배경 · 올린 그림을 깐다 — 그때는 장면을 띄우지 않는다.
// 코디가 서는 다른 칸(광장 상세 · 광장 등록 · VS)도 같은 배경을 깐다. 그 칸들은 still: 피팅룸을 움직이지 않는 그림으로만 둔다.
// 캐시샵 배경은 미리보기에서 캐릭터와 같은 도트 크기(lib/stageFloor 의 정수 배율)로 키우고, 그림의 바닥 줄(CASH_BG_GROUND)을
// 캐릭터가 딛는 줄에, 그림 가운데를 캐릭터 가운데에 맞춘다 — 게임처럼 캐릭터가 땅 위에 선다. 그림 밖은 위 · 아래 끝 색으로 채운다.
// 바닥을 알리지 않는 칸(still)은 칸에 맞춰 채우기만 한다.

import { useEffect, useState } from 'react'
import { CASH_BGS, CASH_BG_GROUND, CASH_BG_H, CASH_BG_W, getStageBg, stageSelOf, useStageBg, type CashBg } from '@/lib/stageBg'
import { MODEL_REF } from '@/lib/core/modelPlacement'
import { SCENE_SRC } from '../scene/sceneSrc'
import { getStageFloor, onStageFloor } from '@/lib/stageFloor'
import SceneCanvas from '../scene/SceneCanvas'
import styles from './preview.module.css'

export const STAGE_COLORS: Record<string, string> = { white: '#ffffff', black: '#141210' }
// 시스템 테마(사용자 지시): 라이트면 프리셋 카드 바탕 #f7f2ec, 다크면 다크 카드 색. 화면은 CSS 변수(--pb-sys-bg, globals.css), 그림으로 내보낼 때는 이 값
export const SYS_BG = { light: '#f7f2ec', dark: '#2a2622' }
export const SYS_BG_CSS = 'var(--pb-sys-bg)'
export const stageColor = (sel: string): string | undefined => sel === 'system'
  ? (typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches ? SYS_BG.dark : SYS_BG.light)
  : STAGE_COLORS[sel]

// 프리셋 카드의 배경(사용자 지시: 프리셋마다 미리보기 배경). 카드 캐릭터는 배율 없이 fraction(마네킹 높이 ÷ 칸 높이)으로만 그려지므로
// 캐시샵 배경은 그 크기에 맞춰 키운다 — 게임 1px = fraction × 칸 높이 ÷ bodyRefH. 그림의 바닥 줄은 캐릭터 발(배꼽 + 21px,
// 배꼽 = 칸 가운데 − centerDy)에, 그림 가운데는 배꼽에. 모두 칸 높이에 대한 비율이라 칸 크기가 바뀌어도 맞는다.
const FOOT_FROM_NAVEL = 21
export function CardStageBg({ sel, fraction }: { sel?: string; fraction: number }) {
  const v = stageSelOf(sel)
  if (v === 'room') return <div aria-hidden className={styles.stageBg} style={{ backgroundImage: `url("${SCENE_SRC.room[1]}")` }} />
  const cash = CASH_BGS.find((c) => c.id === v)
  if (cash) {
    const k = fraction / MODEL_REF.bodyRefH // 칸 높이 1 에 대한 게임 1px
    const top = 0.5 + (-MODEL_REF.centerDy + FOOT_FROM_NAVEL - CASH_BG_GROUND) * k
    return (
      <div aria-hidden className={styles.stageBg} style={{ background: `linear-gradient(to bottom, ${cash.top} 50%, ${cash.bottom} 50%)` }}>
        <img alt="" src={cash.src} className={styles.stageCardImg}
          style={{ height: `${CASH_BG_H * k * 100}%`, top: `${top * 100}%`, transform: `translateX(-${((CASH_BG_W / 2 + MODEL_REF.centerDx) / CASH_BG_W) * 100}%)` }} />
      </div>
    )
  }
  const img = getStageBg().images.find((i) => i.id === v)?.src
  return <div aria-hidden className={styles.stageBg} style={img ? { backgroundImage: `url("${img}")` } : { background: v === 'system' ? SYS_BG_CSS : STAGE_COLORS[v] }} />
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

