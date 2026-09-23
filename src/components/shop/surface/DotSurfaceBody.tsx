'use client'

// 점 위치 서피스 본문(사소한 변경점 / 사소한 변경쩜 전용). 편집 캔버스·상호작용은 기존 로직(useDotEditor) 재활용,
// 둘레(도구·확대 게이지·색상 계열·색조/채도/명도·초기화·푸터)는 v2 마크업.

import clsx from 'clsx'
import { useEffect, useRef, useState } from 'react'
import type { ListItem } from '@/lib/core/data'
import { useShop } from '../ShopContext'
import { useDotEditor, ZMAX, ZMIN } from '../render/useDotEditor'
import { IconCheck } from '../ui/Icons'
import { DyeRow, FamilyDots, Stepper } from '../ui/controls'
import { SurfaceFooter } from './Surface'
import styles from './surface.module.css'

type F = 'h' | 's' | 'b'
const RANGE: Record<F, [number, number]> = { h: [0, 359], s: [-99, 99], b: [-99, 99] }

export default function DotSurfaceBody({ item, mobile }: { item: ListItem; mobile: boolean }) {
  const s = useShop()
  const areaRef = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState({ w: 0, h: 0 })
  useEffect(() => {
    const el = areaRef.current; if (!el) return
    const m = () => setBox((b) => (b.w === el.clientWidth && b.h === el.clientHeight ? b : { w: el.clientWidth, h: el.clientHeight }))
    m()
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(m) : null
    ro?.observe(el)
    return () => ro?.disconnect()
  }, [])
  const [off, setOff] = useState(() => !!s.dyeOff[item.slot]) // 염색 비활성화(적용 시 커밋)
  const ed = useDotEditor(item, box, off)
  const name = item.name || item.id
  const multi = ed.dotCount > 1

  const apply = () => {
    s.setDyeHsb((prev) => ({ ...prev, [item.slot]: ed.hsb }))
    if (!!s.dyeOff[item.slot] !== off) s.toggleDyeOff(item.slot)
    s.resetDot(item.id)
    for (const nm of Object.keys(ed.local)) s.setDot(item.id, nm, ed.local[nm])
    s.closeSurface()
    s.notify(`${name} 점 위치를 적용했어요`)
  }

  const tools = [{ v: 'move' as const, l: '이동' }, ...Array.from({ length: ed.dotCount }, (_, i) => ({ v: i, l: multi ? `점 ${i + 1}` : '점' }))].map((t) => {
    const on = ed.tool === t.v
    return <button key={String(t.v)} type="button" onClick={() => ed.setTool(t.v)} className={clsx(!on && 'pb-soft', styles.tool, on && styles.toolOn)}>{t.l}</button>
  })
  const zoomPct = Math.round(((ed.zoom - ZMIN) / (ZMAX - ZMIN)) * 100)

  return (
    <>
      <div className={clsx('pb-scroll', styles.dotBody, mobile && styles.dotBodyM)}>
        <div className={clsx(styles.dotLeft, mobile && styles.dotLeftM)}>
          {!mobile && <div className={styles.tools}>{tools}</div>}
          <div className={styles.canvasRow}>
            <div ref={areaRef} data-no-sheet-drag className={clsx(styles.canvasArea, mobile && styles.canvasAreaM, typeof ed.tool === 'number' && styles.canvasAreaDot)}>
              {ed.parts
                ? <canvas ref={ed.canvasRef} onPointerDown={ed.onDown} onPointerMove={ed.onMove} onPointerUp={ed.onUp} onPointerCancel={ed.onUp} className={styles.canvas} />
                : <div className={clsx('pb-skel', styles.canvasSkel)} />}
              {/* 선택된 점 위치는 드래그마다 바뀌는 즉시 값이라 인라인 */}
              {ed.activeHandle && <div className={styles.ring} style={{ left: ed.activeHandle.cx, top: ed.activeHandle.cy }} />}
            </div>
            {mobile && <div className={styles.toolsSide}>{tools}</div>}
          </div>
          <div className={styles.zoomLine}>
            <div title="확대 정도 (휠로 조절)" className={styles.gauge}>
              <div className={styles.gaugeBar}><div className={styles.gaugeFill} style={{ width: `${zoomPct}%` }} /></div>
              <span className={styles.gaugeLabel}>{`${ed.zoom.toFixed(1)}x`}</span>
            </div>
            <button type="button" onClick={() => ed.setLocal({})} title="점 위치 초기화" className={styles.posReset}>위치 초기화</button>
          </div>
        </div>

        <div className={clsx(styles.dotRight, mobile && styles.dotRightM)}>
          <div className={styles.famRow}><FamilyDots size="lg" value={ed.hsb.t ?? 0} onPick={ed.setFamily} /></div>
          <div className={styles.hr} />
          <div className={clsx('pb-dyecol', styles.rowsCol)}>
            {(['h', 's', 'b'] as F[]).map((f) => {
              const label = ({ h: '색조', s: '채도', b: '명도' } as const)[f]
              const [lo, hi] = RANGE[f]
              return (
                <DyeRow key={f} label={label} track={f === 'b' ? 'v' : f} min={lo} max={hi} value={ed.hsb[f]}
                  onRange={(v) => ed.setField(f, String(v))}
                  stepper={<Stepper label={label} size="lg" placeholder="0" valueStr={ed.raw[f]}
                    onNum={(v) => ed.setField(f, v)} onStep={(d) => ed.bump(f, d)}
                    decOff={ed.hsb[f] <= lo} incOff={ed.hsb[f] >= hi} />} />
              )
            })}
          </div>
          <div className={styles.resetRow}>
            {/* 테두리(순수 검정) 포함 — 염색 다이얼로그와 같은 값·같은 줄(2026-09-23 사용자 지시). */}
            <button type="button" onClick={ed.toggleEdge} aria-pressed={!!ed.hsb.edge}
              title={ed.hsb.b > 0 ? '검정 테두리도 함께 밝아져요' : '테두리는 명도를 올려야 밝아져요'}
              className={clsx(styles.resetBtn, styles.tickBtn, ed.hsb.edge && styles.offOn)}>
              <span className={clsx(styles.tick, ed.hsb.edge && styles.tickOn)} aria-hidden="true"><IconCheck size={9} /></span>테두리 포함
            </button>
            <button type="button" onClick={() => setOff((v) => !v)} aria-pressed={off} title={off ? '염색 다시 적용' : '수치는 그대로 두고 염색만 끄기'}
              className={clsx(styles.resetBtn, styles.tickBtn, off && styles.offOn)}>
              <span className={clsx(styles.tick, off && styles.tickOn)} aria-hidden="true"><IconCheck size={9} /></span>비활성화
            </button>
            <button type="button" onClick={ed.resetHsb} title="염색 초기화" className={styles.resetBtn}>염색 초기화</button>
          </div>
        </div>
      </div>
      <SurfaceFooter onApply={apply} />
    </>
  )
}
