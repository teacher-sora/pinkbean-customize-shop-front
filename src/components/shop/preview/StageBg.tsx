'use client'

// 미리보기의 배경(lib/stageBg). 피팅룸이면 배경 장면을, 아니면 고른 색이나 올린 그림을 깐다 — 그때는 장면을 띄우지 않는다.
// 코디가 서는 다른 칸(광장 상세 · 광장 등록 · VS)도 같은 배경을 깐다. 그 칸들은 still: 피팅룸을 움직이지 않는 그림으로만 둔다.

import { useStageBg } from '@/lib/stageBg'
import SceneCanvas from '../scene/SceneCanvas'
import styles from './preview.module.css'

export const STAGE_COLORS: Record<string, string> = { white: '#ffffff', black: '#141210' }

export default function StageBg({ still }: { still?: boolean }) {
  const bg = useStageBg()
  if (bg.sel === 'room') return <SceneCanvas kind="room" still={still} />
  const img = bg.images.find((i) => i.id === bg.sel)
  return <div aria-hidden className={styles.stageBg} style={img ? { backgroundImage: `url("${img.src}")` } : { background: STAGE_COLORS[bg.sel] }} />
}
