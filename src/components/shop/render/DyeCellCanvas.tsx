'use client'

// 발색표 셀 캔버스(재활용 — 기존 DyeDialog 의 DyeCell 렌더 로직 그대로 분리).
// 아이템 자체 스프라이트를 (기본색 × 믹스색) 조합으로 리컬러해 정사각형에 그린다. 셀 크롬은 v2 마크업이 담당.

import { useEffect, useRef } from 'react'
import type { ItemMeta } from '@/lib/core/data'
import { renderDyedSprite } from '@/lib/core/dye'
import { fitCanvas } from '@/lib/core/modelPlacement'
import { THUMB_VIEW } from '@/lib/shopData'

export default function DyeCellCanvas({ meta, base, mixC, zmap }: { meta: ItemMeta; base: number; mixC: number; zmap: string[] }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    const el = ref.current, wrap = wrapRef.current; if (!el || !wrap) return
    // 셀 디바이스 픽셀 해상도로 렌더 → 1:1 표시. renderDyedSprite 내부에서 배율을 정수 스냅해 항상 선명.
    const dpr = window.devicePixelRatio || 1
    const cw = wrap.clientWidth || 62, ch = wrap.clientHeight || cw
    const size = Math.round(Math.min(cw, ch) * dpr)
    renderDyedSprite(el, meta, base, mixC, base === mixC ? 0 : 50, THUMB_VIEW, zmap, size)
      .then(() => fitCanvas(el, wrap, el.width, el.height, cw, ch, dpr)) // CSS 크기 = 비트맵 ÷ dpr, 위치는 디바이스 픽셀 반올림
      .catch(() => {})
  }, [meta, base, mixC, zmap])
  return (
    <span ref={wrapRef} style={{ position: 'relative', display: 'block', width: '100%', height: '100%' }}>
      <canvas ref={ref} style={{ position: 'absolute', display: 'block', imageRendering: 'pixelated' }} />
    </span>
  )
}
