'use client'

// 염색 서피스 본문.
//  · 헤어·성형(mix) = **색상 A · 색상 B · 그 둘 사이의 비율**. 그 외 아이템의 HSB 와는 다른 체계다
//    (2026-09-21 사용자 지시 — "헤어와 성형 염색은 두 색을 고르고 비율만 조절하는 게 전부"다).
//    8×8 염색표는 '염색표 보기'로 같은 다이얼로그 안에서 가로 슬라이드로 오간다(크기가 같아 내용만 움직인다).
//    표의 한 칸을 고르면 그 두 색이 1:1 로 들어오며 곧바로 조절 화면으로 돌아온다.
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
import { DyeRow, FamilyDots, Stepper, Swatch } from '../ui/controls'
import { IconReset } from '../ui/Icons'
import { SurfaceFooter } from './Surface'
import styles from './surface.module.css'

type F = 'h' | 's' | 'b'
const TRACK: Record<F, 'h' | 's' | 'v'> = { h: 'h', s: 's', b: 'v' }
const RANGE: Record<F, [number, number]> = { h: [0, 359], s: [-99, 99], b: [-99, 99] }
const NO_HSB: HsbParams = { h: 0, s: 0, b: 0, t: 0 } // 헤어·성형은 HSB 를 쓰지 않는다
const DEF_PAL = (): PaletteParams => ({ baseColor: 0, mixColor: null, ratio: 50 }) // 코디 정보 탭과 같은 기본값
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

// 같은 다이얼로그 안에서 화면만 바꾸는 슬라이드(색 조절 ↔ 염색표).
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

// 배율 알약(1x·2x·3x) — 두 본문이 함께 쓴다.
function useZoomPills() {
  const [zoom, setZoom] = useState(2)
  const pills = [1, 2, 3].map((z) => (
    <button key={z} type="button" onClick={() => setZoom(z)} className={clsx(zoom === z ? 'pb-solid' : 'pb-soft', styles.zoom, zoom === z && styles.zoomOn)}>{z}x</button>
  ))
  return { zoom, pills }
}

export default function DyeSurfaceBody({ item, mobile }: { item: ListItem; mobile: boolean }) {
  const s = useShop()
  const name = item.name || item.id
  return s.isMixSlot(item.slot)
    ? <MixBody item={item} mobile={mobile} name={name} />
    : <HsbBody item={item} mobile={mobile} name={name} />
}

// ── 헤어·성형: 색상 A · 색상 B · 비율 ↔ 염색표 ─────────────────────────────
function MixBody({ item, mobile, name }: { item: ListItem; mobile: boolean; name: string }) {
  const s = useShop()
  const slot = item.slot
  const PAL = paletteFor(slot) // 성형=FACE_PALETTE 표기, 헤어=MIX_PALETTE. 발색 로직은 동일.
  const zmap = s.index?.zmap || []
  const [meta, setMeta] = useState<ItemMeta | null>(null)
  const [pal, setPal] = useState<PaletteParams>(() => ({ ...(s.dyePalette[slot] ?? DEF_PAL()) }))
  const [raw, setRaw] = useState<string | null>(null) // 비율 입력 중 문자열 버퍼(빈값 허용)
  const { zoom, pills } = useZoomPills()
  const { ref, box } = useBox()
  const { view, go, style } = useInnerSlide<'custom' | 'table'>('custom')

  useEffect(() => {
    let alive = true
    loadMeta(item.id).then((m) => { if (alive) setMeta(m) }).catch(() => {})
    return () => { alive = false }
  }, [item.id])

  const bIdx = pal.mixColor ?? pal.baseColor // 화면에 보이는 '색상 B'(A 와 같으면 단색)
  // A·B·비율은 서로 독립 — A 를 바꿀 때 B(현재 표시값)를 명시적으로 고정해 따라오지 않게 한다(코디 정보 탭과 같은 규칙).
  const setBase = (i: number) => setPal((c) => ({ baseColor: i, mixColor: c.mixColor ?? c.baseColor, ratio: c.ratio }))
  const setMixC = (i: number) => setPal((c) => ({ ...c, mixColor: i }))
  const setRatio = (fn: (cur: number) => number) => setPal((c) => ({ ...c, ratio: Math.max(0, Math.min(100, fn(c.ratio))) }))
  // 저장 값: A=B 면 단색(mixColor=null)으로 남긴다 — 예전 염색표 선택과 같은 모양이라 대회 중복 판정도 그대로다.
  const commit: PaletteParams = { baseColor: pal.baseColor, mixColor: bIdx === pal.baseColor ? null : bIdx, ratio: pal.ratio }
  const apply = () => {
    s.equipItem(item)
    s.setDyePalette((prev) => ({ ...prev, [slot]: commit }))
    s.closeSurface()
    s.notify(`${name} 염색을 적용했어요`)
  }

  const swatchRows = (
    <>
      <div className={styles.swRow}>
        <span className={styles.swLabel}>색상 A</span>
        <div className={styles.swList}>{PAL.map((p, i) => <Swatch key={i} hex={p.hex} name={p.name} on={pal.baseColor === i} onPick={() => setBase(i)} />)}</div>
      </div>
      <div className={styles.swRow}>
        <span className={styles.swLabel}>색상 B</span>
        <div className={styles.swList}>{PAL.map((p, i) => <Swatch key={i} hex={p.hex} name={p.name} on={bIdx === i} onPick={() => setMixC(i)} />)}</div>
      </div>
    </>
  )
  const ratioRow = (
    <DyeRow label="비율" track="s" min={0} max={100} value={pal.ratio}
      onRange={(v) => { setRaw(null); setRatio(() => v) }}
      stepper={<Stepper label="혼합 비율" size="lg" valueStr={raw ?? String(pal.ratio)}
        onNum={(v) => { if (!/^\d*$/.test(v)) return; setRaw(v); if (v !== '') setRatio(() => parseInt(v, 10)) }}
        onBlur={() => setRaw(null)}
        onStep={(d) => { setRaw(null); setRatio((cur) => cur + d) }}
        decOff={pal.ratio <= 0} incOff={pal.ratio >= 100} />} />
  )
  const tableBtn = (
    <button type="button" onClick={() => go('table', 1)} title="염색표에서 두 색 고르기"
      className={clsx('pb-ghost', styles.tableBtn)}>
      <span className={styles.tableDots}>
        <span className={styles.cellDot} style={{ ['--c' as string]: PAL[pal.baseColor].hex }} />
        {bIdx !== pal.baseColor && <span className={styles.cellDot} style={{ ['--c' as string]: PAL[bIdx].hex }} />}
      </span>
      염색표 보기
    </button>
  )
  const preview = <DyeModelPreview item={item} hsb={NO_HSB} palette={commit} zoom={zoom} box={box} />

  const custom = mobile ? (
    <div className={clsx('pb-scroll', styles.hsvM)}>
      <div className={styles.topM}>
        <div ref={ref} className={styles.pvBoxM}>{preview}</div>
        <div className={styles.zoomCol}>{pills}</div>
      </div>
      <div className={styles.tableRow}>{tableBtn}</div>
      <div className={styles.hr} />
      <div className={styles.rowsCol}>{swatchRows}</div>
      <div className={styles.hr} />
      <div className={clsx('pb-dyecol', styles.rowsCol)}>{ratioRow}</div>
    </div>
  ) : (
    <div className={styles.hsvPc}>
      <div className={styles.hsvLeft}>
        <div ref={ref} className={styles.pvBox}>{preview}</div>
        <div className={styles.zoomRow}>{pills}</div>
      </div>
      <div className={clsx('pb-scroll', styles.hsvRight)}>
        <div className={styles.tableRow}>{tableBtn}</div>
        <div className={styles.hr} />
        <div className={styles.rows}>{swatchRows}</div>
        <div className={styles.hr} />
        <div className={styles.rows}>{ratioRow}</div>
      </div>
    </div>
  )

  const table = (
    <div className={clsx('pb-scroll', styles.mixScroll)}>
      <div className={clsx(styles.mixGrid, mobile && styles.mixGridM)}>
        {MIX_PALETTE.map((_, r) => MIX_PALETTE.map((__, c) => {
          const on = pal.baseColor === r && bIdx === c
          return (
            <button key={`${r}-${c}`} type="button"
              onClick={() => { setRaw(null); setPal({ baseColor: r, mixColor: r === c ? null : c, ratio: 50 }); go('custom', -1) }}
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
      <div className={styles.innerSlide} style={style}>{view === 'table' ? table : custom}</div>
      {view === 'table'
        ? <SurfaceFooter onApply={apply} onBack={() => go('custom', -1)} />
        : <SurfaceFooter onApply={apply} />}
    </>
  )
}

// ── 그 외 아이템: HSB ──────────────────────────────────────────────────────
function HsbBody({ item, mobile, name }: { item: ListItem; mobile: boolean; name: string }) {
  const s = useShop()
  const slot = item.slot
  const [hsb, setHsb] = useState<HsbParams>(() => ({ ...(s.dyeHsb[slot] ?? { h: 0, s: 0, b: 0, t: 0 }) }))
  const [raw, setRaw] = useState<Partial<Record<F, string>>>({})
  const { zoom, pills } = useZoomPills()
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
            <div className={styles.zoomCol}>{pills}</div>
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
          <div className={styles.zoomRow}>{pills}</div>
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
