'use client'

// 염색 서피스 본문.
//  · 헤어·성형(mix) = **커스텀 염색 + 염색표**, 두 화면을 같은 다이얼로그 안에서 가로 슬라이드로 오간다
//    (2026-09-21 사용자 지시 — 발색표만 있어 커스텀이 안 된다는 제보). 크기가 같으므로 내용만 움직인다.
//    · 커스텀 = 그 외 아이템과 똑같은 미리보기 + 색 계열 + 색조·채도·명도. 바탕색은 염색표에서 고른 색이다.
//    · 염색표 = 예전 8×8(모바일 3열) 그대로. 고르면 바로 커스텀 화면으로 돌아온다(적용은 한 번만).
//  · 그 외 = HSB(미리보기 + 색상 계열 + 색조·채도·명도).
// 적용 = 보던 아이템 착용 + 염색 커밋(v2 dlgApply). 카드의 염색 버튼 자체는 착용을 바꾸지 않는다.

import clsx from 'clsx'
import { useEffect, useRef, useState } from 'react'
import { MIX_PALETTE, paletteFor } from '@/lib/catalog'
import { clampDye } from '@/lib/color'
import { loadMeta, type ItemMeta, type ListItem } from '@/lib/core/data'
import type { HsbParams, PaletteParams } from '@/lib/core/dye'
import { useShop } from '../ShopContext'
import DyeCellCanvas from '../render/DyeCellCanvas'
import DyeModelPreview from '../render/DyeModelPreview'
import { DyeRow, FamilyDots, Stepper } from '../ui/controls'
import { IconReset } from '../ui/Icons'
import { SurfaceFooter } from './Surface'
import styles from './surface.module.css'

type F = 'h' | 's' | 'b'
const TRACK: Record<F, 'h' | 's' | 'v'> = { h: 'h', s: 's', b: 'v' }
const RANGE: Record<F, [number, number]> = { h: [0, 359], s: [-99, 99], b: [-99, 99] }
// 본문 가로 슬라이드 — 서피스의 부위 염색 전환과 **같은 값**(ShopContext PART_SLIDE_*)이라 몸짓이 하나로 읽힌다.
const SLIDE_PX = 34, SWAP_MS = 90, IN_MS = 110

// 표시 영역 크기 측정(미리보기 캔버스 박스).
function useBox() {
  const ref = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState({ w: 0, h: 0 })
  useEffect(() => {
    const el = ref.current; if (!el) return
    const m = () => setBox((b) => (b.w === el.clientWidth && b.h === el.clientHeight ? b : { w: el.clientWidth, h: el.clientHeight }))
    m()
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(m) : null
    ro?.observe(el)
    return () => ro?.disconnect()
  }, [])
  return { ref, box }
}

// 같은 다이얼로그 안에서 화면만 바꾸는 슬라이드(커스텀 ↔ 염색표).
function useInnerSlide<T>(initial: T) {
  const [view, setView] = useState<T>(initial)
  const [slide, setSlide] = useState(0)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  useEffect(() => () => { for (const t of timers.current) clearTimeout(t) }, [])
  const go = (next: T, dir: 1 | -1) => {
    for (const t of timers.current) clearTimeout(t)
    setSlide(-SLIDE_PX * dir)
    timers.current = [
      setTimeout(() => { setView(next); setSlide(SLIDE_PX * dir) }, SWAP_MS),
      setTimeout(() => setSlide(0), IN_MS),
    ]
  }
  const style: React.CSSProperties = { transform: `translateX(${slide}px)`, opacity: slide ? 0 : 1 }
  return { view, go, style }
}

export default function DyeSurfaceBody({ item, mobile }: { item: ListItem; mobile: boolean }) {
  const s = useShop()
  const mix = s.isMixSlot(item.slot)
  const name = item.name || item.id
  return mix ? <MixBody item={item} mobile={mobile} name={name} /> : <HsbBody item={item} mobile={mobile} name={name} />
}

// ── 헤어·성형: 커스텀 염색 ↔ 염색표 ──────────────────────────────────────────
function MixBody({ item, mobile, name }: { item: ListItem; mobile: boolean; name: string }) {
  const s = useShop()
  const slot = item.slot
  const PAL = paletteFor(slot) // 성형=FACE_PALETTE 표기, 헤어=MIX_PALETTE. 발색 로직은 동일.
  const zmap = s.index?.zmap || []
  const [meta, setMeta] = useState<ItemMeta | null>(null)
  const [sel, setSel] = useState<{ base: number; mix: number }>(() => {
    const cur = s.dyePalette[slot]
    return cur ? { base: cur.baseColor, mix: cur.mixColor ?? cur.baseColor } : { base: 0, mix: 0 }
  })
  const [hsb, setHsb] = useState<HsbParams>(() => ({ ...(s.dyeHsb[slot] ?? { h: 0, s: 0, b: 0, t: 0 }) }))
  const [off, setOff] = useState(() => !!s.dyeOff[slot])
  const { view, go, style } = useInnerSlide<'custom' | 'table'>('custom')

  useEffect(() => {
    let alive = true
    loadMeta(item.id).then((m) => { if (alive) setMeta(m) }).catch(() => {})
    return () => { alive = false }
  }, [item.id])

  const palette: PaletteParams = { baseColor: sel.base, mixColor: sel.base === sel.mix ? null : sel.mix, ratio: sel.base === sel.mix ? 0 : 50 }
  const apply = () => {
    s.equipItem(item)
    s.setDyePalette((prev) => ({ ...prev, [slot]: palette }))
    s.setDyeHsb((prev) => ({ ...prev, [slot]: hsb }))
    if (!!s.dyeOff[slot] !== off) s.toggleDyeOff(slot)
    s.closeSurface()
    s.notify(`${name} 염색을 적용했어요`)
  }

  const table = (
    <div className={clsx('pb-scroll', styles.mixScroll)}>
      <div className={clsx(styles.mixGrid, mobile && styles.mixGridM)}>
        {MIX_PALETTE.map((_, r) => MIX_PALETTE.map((__, c) => {
          const on = sel.base === r && sel.mix === c
          return (
            <button key={`${r}-${c}`} type="button" onClick={() => { setSel({ base: r, mix: c }); go('custom', -1) }}
              title={r === c ? `${PAL[r].name} (단색)` : `${PAL[r].name} × ${PAL[c].name} (1 : 1)`}
              className={clsx(styles.cell, on && styles.cellOn)}>
              <span className={styles.cellSprite}>{meta ? <DyeCellCanvas meta={meta} base={r} mixC={c} zmap={zmap} /> : null}</span>
              <span className={styles.cellDots}>
                <span className={styles.cellDot} style={{ ['--c' as string]: PAL[r].hex }} />
                {r !== c && <span className={styles.cellDot} style={{ ['--c' as string]: PAL[c].hex }} />}
              </span>
            </button>
          )
        }))}
      </div>
    </div>
  )

  return (
    <>
      <div className={styles.innerSlide} style={style}>
        {view === 'table'
          ? table
          : <CustomPane item={item} mobile={mobile} hsb={hsb} setHsb={setHsb} off={off} setOff={setOff}
              palette={off ? undefined : palette}
              swatches={
                <button type="button" onClick={() => go('table', 1)} title="발색표에서 바탕색 고르기"
                  className={clsx('pb-ghost', styles.tableBtn)}>
                  <span className={styles.tableDots}>
                    <span className={styles.cellDot} style={{ ['--c' as string]: PAL[sel.base].hex }} />
                    {sel.base !== sel.mix && <span className={styles.cellDot} style={{ ['--c' as string]: PAL[sel.mix].hex }} />}
                  </span>
                  염색표 보기
                </button>
              } />}
      </div>
      {view === 'table'
        ? <SurfaceFooter onApply={apply} onBack={() => go('custom', -1)} />
        : <SurfaceFooter onApply={apply} />}
    </>
  )
}

// ── 커스텀 염색 화면(헤어·성형·그 외 공용) ─────────────────────────────────
function CustomPane({ item, mobile, hsb, setHsb, off, setOff, palette, swatches }: {
  item: ListItem; mobile: boolean
  hsb: HsbParams; setHsb: React.Dispatch<React.SetStateAction<HsbParams>>
  off: boolean; setOff: React.Dispatch<React.SetStateAction<boolean>>
  palette?: PaletteParams
  swatches?: React.ReactNode   // 헤어·성형만: 바탕색 표시 + '염색표 보기'
}) {
  const [raw, setRaw] = useState<Partial<Record<F, string>>>({})
  const [zoom, setZoom] = useState(2)
  const { ref, box } = useBox()

  const setF = (f: F, fn: (v: number) => number) => setHsb((h) => ({ ...h, [f]: clampDye(f, fn(h[f] ?? 0)) }))
  const clearRaw = (f: F) => setRaw((r) => { if (!(f in r)) return r; const n = { ...r }; delete n[f]; return n })
  const reset = () => { setHsb((h) => ({ h: 0, s: 0, b: 0, t: h.t ?? 0 })); setRaw({}) }

  const rows = () => (['h', 's', 'b'] as F[]).map((f) => {
    const label = ({ h: '색조', s: '채도', b: '명도' } as const)[f]
    const [lo, hi] = RANGE[f]
    return (
      <DyeRow key={f} label={label} track={TRACK[f]} min={lo} max={hi} value={hsb[f]}
        onRange={(v) => { clearRaw(f); setF(f, () => v) }}
        stepper={<Stepper label={label} size="lg" placeholder="0" valueStr={raw[f] ?? String(hsb[f])}
          onNum={(v) => { if (!/^-?\d*$/.test(v)) return; setRaw((r) => ({ ...r, [f]: v })); setF(f, () => (v === '' || v === '-' ? 0 : parseInt(v, 10))) }}
          onBlur={() => clearRaw(f)}
          onStep={(d) => { clearRaw(f); setF(f, (cur) => cur + d) }}
          decOff={hsb[f] <= lo} incOff={hsb[f] >= hi} />} />
    )
  })
  const zoomPills = [1, 2, 3].map((z) => (
    <button key={z} type="button" onClick={() => setZoom(z)} className={clsx(zoom === z ? 'pb-solid' : 'pb-soft', styles.zoom, zoom === z && styles.zoomOn)}>{z}x</button>
  ))
  const pvHsb = off ? { h: 0, s: 0, b: 0, t: hsb.t ?? 0 } : hsb
  const offBtn = (big: boolean) => (
    <button type="button" onClick={() => setOff((v) => !v)} aria-pressed={off} title={off ? '염색 다시 적용' : '수치는 그대로 두고 염색만 끄기'}
      className={clsx(big ? styles.resetIcon : clsx('pb-ghost', styles.resetBtn), off && styles.offOn)}>염색 비활성화</button>
  )
  const families = <FamilyDots size="lgMin" value={hsb.t ?? 0} onPick={(t) => setHsb((h) => ({ ...h, t }))} />

  if (mobile) {
    return (
      <div className={clsx('pb-scroll', styles.hsvM)}>
        <div className={styles.topM}>
          <div ref={ref} className={styles.pvBoxM}><DyeModelPreview item={item} hsb={pvHsb} palette={palette} zoom={zoom} box={box} /></div>
          <div className={styles.zoomCol}>{zoomPills}</div>
        </div>
        {swatches && <div className={styles.tableRow}>{swatches}</div>}
        <div className={styles.famRow}>{families}</div>
        <div className={styles.hr} />
        <div className={clsx('pb-dyecol', styles.rowsCol)}>{rows()}</div>
        <div className={styles.resetRow}>
          {offBtn(true)}
          <button type="button" onClick={reset} title="수치 초기화" aria-label="수치 초기화" className={styles.resetIcon}><IconReset />초기화</button>
        </div>
      </div>
    )
  }
  return (
    <div className={styles.hsvPc}>
      <div className={styles.hsvLeft}>
        <div ref={ref} className={styles.pvBox}><DyeModelPreview item={item} hsb={pvHsb} palette={palette} zoom={zoom} box={box} /></div>
        <div className={styles.zoomRow}>{zoomPills}</div>
      </div>
      <div className={clsx('pb-scroll', styles.hsvRight)}>
        {swatches && <div className={styles.tableRow}>{swatches}</div>}
        <div className={styles.famRow}>{families}</div>
        <div className={styles.hr} />
        <div className={styles.rows}>{rows()}</div>
        <div className={styles.resetRow}>
          {offBtn(false)}
          <button type="button" onClick={reset} className={clsx('pb-ghost', styles.resetBtn)}>염색 초기화</button>
        </div>
      </div>
    </div>
  )
}

// ── 그 외 아이템: HSB 만 ────────────────────────────────────────────────────
function HsbBody({ item, mobile, name }: { item: ListItem; mobile: boolean; name: string }) {
  const s = useShop()
  const slot = item.slot
  const [hsb, setHsb] = useState<HsbParams>(() => ({ ...(s.dyeHsb[slot] ?? { h: 0, s: 0, b: 0, t: 0 }) }))
  const [off, setOff] = useState(() => !!s.dyeOff[slot]) // 염색 비활성화(적용 시 커밋)
  const apply = () => {
    s.equipItem(item)
    s.setDyeHsb((prev) => ({ ...prev, [slot]: hsb }))
    if (!!s.dyeOff[slot] !== off) s.toggleDyeOff(slot)
    s.closeSurface()
    s.notify(`${name} 염색을 적용했어요`)
  }
  return (
    <>
      <CustomPane item={item} mobile={mobile} hsb={hsb} setHsb={setHsb} off={off} setOff={setOff} />
      <SurfaceFooter onApply={apply} />
    </>
  )
}
