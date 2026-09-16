'use client'

// 염색 서피스 본문. 헤어·성형 = 발색표(8×8, 모바일 3열) / 그 외 = HSB(미리보기 + 색상 계열 + 색조·채도·명도).
// 적용 = 보던 아이템 착용 + 염색 커밋(v2 dlgApply). 카드의 염색 버튼 자체는 착용을 바꾸지 않는다.

import clsx from 'clsx'
import { useEffect, useRef, useState } from 'react'
import { MIX_PALETTE, paletteFor } from '@/lib/catalog'
import { clampDye } from '@/lib/color'
import { loadMeta, type ItemMeta, type ListItem } from '@/lib/core/data'
import type { HsbParams } from '@/lib/core/dye'
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

export default function DyeSurfaceBody({ item, mobile }: { item: ListItem; mobile: boolean }) {
  const s = useShop()
  const slot = item.slot
  const mix = s.isMixSlot(slot)
  const name = item.name || item.id
  return mix ? <MixBody item={item} mobile={mobile} name={name} /> : <HsbBody item={item} mobile={mobile} name={name} />
}

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
  useEffect(() => {
    let alive = true
    loadMeta(item.id).then((m) => { if (alive) setMeta(m) }).catch(() => {})
    return () => { alive = false }
  }, [item.id])

  const apply = () => {
    s.equipItem(item)
    s.setDyePalette((prev) => ({ ...prev, [slot]: { baseColor: sel.base, mixColor: sel.base === sel.mix ? null : sel.mix, ratio: sel.base === sel.mix ? 0 : 50 } }))
    s.closeSurface()
    s.notify(`${name} 염색을 적용했어요`)
  }

  return (
    <>
      <div className={clsx('pb-scroll', styles.mixScroll)}>
        <div className={clsx(styles.mixGrid, mobile && styles.mixGridM)}>
          {MIX_PALETTE.map((_, r) => MIX_PALETTE.map((__, c) => {
            const on = sel.base === r && sel.mix === c
            return (
              <button key={`${r}-${c}`} type="button" onClick={() => setSel({ base: r, mix: c })}
                title={r === c ? `${PAL[r].name} (단색)` : `${PAL[r].name} × ${PAL[c].name} (1 : 1)`}
                className={clsx(styles.cell, on && styles.cellOn)}>
                <span className={styles.cellSprite}>{meta ? <DyeCellCanvas meta={meta} base={r} mixC={c} zmap={zmap} /> : null}</span>
                <span className={styles.cellDots}>
                  <span className={styles.cellDot} style={{ ['--c' as string]: PAL[r].hex }} />
                  {r !== c && <span className={styles.cellDot} style={{ ['--c' as string]: PAL[c].hex }} />}
                  {r === c && <span className={styles.cellSolo}>단색</span>}
                </span>
              </button>
            )
          }))}
        </div>
      </div>
      <SurfaceFooter onApply={apply} />
    </>
  )
}

function HsbBody({ item, mobile, name }: { item: ListItem; mobile: boolean; name: string }) {
  const s = useShop()
  const slot = item.slot
  const [hsb, setHsb] = useState<HsbParams>(() => ({ ...(s.dyeHsb[slot] ?? { h: 0, s: 0, b: 0, t: 0 }) }))
  const [raw, setRaw] = useState<Partial<Record<F, string>>>({})
  const [zoom, setZoom] = useState(2)
  const [off, setOff] = useState(() => !!s.dyeOff[slot]) // 염색 비활성화(적용 시 커밋)
  const { ref, box } = useBox()

  const setF = (f: F, fn: (v: number) => number) => setHsb((h) => ({ ...h, [f]: clampDye(f, fn(h[f] ?? 0)) }))
  const clearRaw = (f: F) => setRaw((r) => { if (!(f in r)) return r; const n = { ...r }; delete n[f]; return n })
  const reset = () => { setHsb((h) => ({ h: 0, s: 0, b: 0, t: h.t ?? 0 })); setRaw({}) }
  const apply = () => {
    s.equipItem(item)
    s.setDyeHsb((prev) => ({ ...prev, [slot]: hsb }))
    if (!!s.dyeOff[slot] !== off) s.toggleDyeOff(slot)
    s.closeSurface()
    s.notify(`${name} 염색을 적용했어요`)
  }

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
      <>
        <div className={clsx('pb-scroll', styles.hsvM)}>
          <div className={styles.topM}>
            <div ref={ref} className={styles.pvBoxM}><DyeModelPreview item={item} hsb={pvHsb} zoom={zoom} box={box} /></div>
            <div className={styles.zoomCol}>{zoomPills}</div>
          </div>
          <div className={styles.famRow}>{families}</div>
          <div className={styles.hr} />
          <div className={clsx('pb-dyecol', styles.rowsCol)}>{rows()}</div>
          <div className={styles.resetRow}>
            {offBtn(true)}
            <button type="button" onClick={reset} title="수치 초기화" aria-label="수치 초기화" className={styles.resetIcon}><IconReset />초기화</button>
          </div>
        </div>
        <SurfaceFooter onApply={apply} />
      </>
    )
  }
  return (
    <>
      <div className={styles.hsvPc}>
        <div className={styles.hsvLeft}>
          <div ref={ref} className={styles.pvBox}><DyeModelPreview item={item} hsb={pvHsb} zoom={zoom} box={box} /></div>
          <div className={styles.zoomRow}>{zoomPills}</div>
        </div>
        <div className={clsx('pb-scroll', styles.hsvRight)}>
          <div className={styles.famRow}>{families}</div>
          <div className={styles.hr} />
          <div className={styles.rows}>{rows()}</div>
          <div className={styles.resetRow}>
            {offBtn(false)}
            <button type="button" onClick={reset} className={clsx('pb-ghost', styles.resetBtn)}>염색 초기화</button>
          </div>
        </div>
      </div>
      <SurfaceFooter onApply={apply} />
    </>
  )
}
