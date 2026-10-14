'use client'

// 미리보기의 배경(lib/stageBg). 피팅룸이면 배경 장면을, 아니면 고른 색이나 올린 그림을 깐다 — 그때는 장면을 띄우지 않는다.

import { useStageBg } from '@/lib/stageBg'
import SceneCanvas from '../scene/SceneCanvas'
import styles from './preview.module.css'

export const STAGE_COLORS: Record<string, string> = { white: '#ffffff', black: '#141210' }

export default function StageBg() {
  const bg = useStageBg()
  if (bg.sel === 'room') return <SceneCanvas kind="room" />
  const img = bg.images.find((i) => i.id === bg.sel)
  return <div aria-hidden data-stage-bg className={styles.stageBg} style={img ? { backgroundImage: `url("${img.src}")`, backgroundPosition: `${img.x ?? 50}% ${img.y ?? 50}%` } : { background: STAGE_COLORS[bg.sel] }} />
}
