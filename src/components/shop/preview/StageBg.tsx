'use client'

// 미리보기의 배경(lib/stageBg). 피팅룸이면 배경 장면을, 아니면 고른 색 · 캐시샵 배경 · 올린 그림을 깐다 — 그때는 장면을 띄우지 않는다.
// 코디가 서는 다른 칸(광장 상세 · 광장 등록 · VS)도 같은 배경을 깐다. 그 칸들은 still: 피팅룸을 움직이지 않는 그림으로만 둔다.
// 캐시샵 배경은 미리보기에서 캐릭터와 같은 도트 크기(lib/stageFloor 의 정수 배율)로 키우고, 그림의 바닥 줄(CASH_BG_GROUND)을
// 캐릭터가 딛는 줄에, 그림 가운데를 캐릭터 가운데에 맞춘다 — 게임처럼 캐릭터가 땅 위에 선다. 그림 밖은 위 · 아래 끝 색으로 채운다.
// 바닥을 알리지 않는 칸(still)은 칸에 맞춰 채우기만 한다.

import { useEffect, useState } from 'react'
import { CASH_BGS, CASH_BG_GROUND, CASH_BG_H, CASH_BG_W, useStageBg, type CashBg } from '@/lib/stageBg'
import { getStageFloor, onStageFloor } from '@/lib/stageFloor'
import SceneCanvas from '../scene/SceneCanvas'
import styles from './preview.module.css'

export const STAGE_COLORS: Record<string, string> = { white: '#ffffff', black: '#141210' }

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
  return <div aria-hidden className={styles.stageBg} style={img ? { backgroundImage: `url("${img.src}")` } : { background: STAGE_COLORS[bg.sel] }} />
}
