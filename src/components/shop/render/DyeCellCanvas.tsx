'use client'

// 발색표 셀 캔버스(재활용 — 기존 DyeDialog 의 DyeCell 렌더 로직 그대로 분리).
// 아이템 자체 스프라이트를 (기본색 × 믹스색) 조합으로 리컬러해 정사각형에 그린다. 셀 크롬은 v2 마크업이 담당.

import { useEffect, useRef } from 'react'
import type { ItemMeta } from '@/lib/core/data'
import { renderDyedSprite } from '@/lib/core/dye'
import { THUMB_VIEW } from '@/lib/shopData'

export default function DyeCellCanvas({ meta, base, mixC, zmap }: { meta: ItemMeta; base: number; mixC: number; zmap: string[] }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const el = ref.current; if (!el) return
    // 셀 디바이스 픽셀 해상도로 렌더 → 1:1 표시. renderDyedSprite 내부에서 배율을 정수 스냅해 항상 선명.
    const size = Math.round((el.clientWidth || 62) * (window.devicePixelRatio || 1))
    renderDyedSprite(el, meta, base, mixC, base === mixC ? 0 : 50, THUMB_VIEW, zmap, size).catch(() => {})
  }, [meta, base, mixC, zmap])
  return <canvas ref={ref} style={{ display: 'block', width: '100%', height: '100%', imageRendering: 'pixelated' }} />
}
