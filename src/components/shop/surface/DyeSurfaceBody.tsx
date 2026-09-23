'use client'

// 염색 서피스 본문.
//  · 헤어·성형(mix) = **색상 A · 색상 B · 그 둘 사이의 비율**. 그 외 아이템의 HSB 와는 다른 체계다
//    (2026-09-21 사용자 지시 — "헤어와 성형 염색은 두 색을 고르고 비율만 조절하는 게 전부"다).
//    8×8 염색표는 '염색표 보기'로 같은 다이얼로그 안에서 가로 슬라이드로 오간다(크기가 같아 내용만 움직인다).
//    표의 한 칸을 고르면 그 두 색이 1:1 로 들어오며 곧바로 조절 화면으로 돌아온다.
//  · 그 외 = HSB(미리보기 + 색상 계열 + 색조·채도·명도).
// 적용 = 보던 아이템 착용 + 염색 커밋(v2 dlgApply). 카드의 염색 버튼 자체는 착용을 바꾸지 않는다.

import clsx from 'clsx'
import { useCallback, useEffect, useRef, useState } from 'react'
import { MIX_PALETTE, paletteFor } from '@/lib/catalog'
import { clampDye } from '@/lib/color'
import { loadMeta, type ItemMeta, type ListItem } from '@/lib/core/data'
import type { HsbParams, PaletteParams } from '@/lib/core/dye'
import { useShop } from '../ShopContext'
import DyeCellCanvas from '../render/DyeCellCanvas'
import DyeModelPreview from '../render/DyeModelPreview'
import { DyeRow, FamilyDots, Stepper, Swatch } from '../ui/controls'
import { IconCheck, IconReset } from '../ui/Icons'
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
// ⚠️ **콜백 ref** 여야 한다(2026-09-21 사용자 제보 — 염색표에 갔다 오면 미리보기가 빈 칸이 됐다).
//  · 화면이 바뀌면(염색표 ↔ 색 조절) 상자 DOM 자체가 갈린다. useEffect([]) 로 한 번만 붙이면
//    ① 상자가 빠질 때 ResizeObserver 가 **크기 0** 을 보고해 box 가 0 이 되고,
//    ② 돌아와 새 상자가 생겨도 다시 재지 않아 0 인 채로 굳는다 → DyeModelPreview 가 그리기를 멈춘다.
//  · 노드가 바뀔 때마다 다시 재고 다시 관찰한다. 상자가 없어진 순간(el=null)은 마지막 크기를 그대로 둔다.
function useBox() {
  const [box, setBox] = useState({ w: 0, h: 0 })
  const roRef = useRef<ResizeObserver | null>(null)
  const ref = useCallback((el: HTMLDivElement | null) => {
    roRef.current?.disconnect()
    roRef.current = null
    if (!el) return
    const m = () => {
      const w = el.clientWidth, h = el.clientHeight
      if (!w || !h) return // 떼어지는 중의 0 은 무시(그릴 수 없는 크기다)
      setBox((b) => (b.w === w && b.h === h ? b : { w, h }))
    }
    m()
    if (typeof ResizeObserver !== 'undefined') { const ro = new ResizeObserver(m); ro.observe(el); roRef.current = ro }
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
  const [off, setOff] = useState(() => !!s.dyeOff[slot]) // 염색 비활성화(적용 시 커밋) — 일반 아이템과 같다
  // '염색 초기화' = 염색을 지운다(코디 정보 탭의 '수치 초기화'와 같은 뜻 — 원래 색으로 돌아간다).
  // 헤어·성형은 '염색 없음'을 색 조합으로 표현할 수 없어(검정 A·B 도 엄연한 염색이다) 따로 표시해 두고,
  // 색이나 비율을 다시 건드리면 풀린다.
  // 아직 염색하지 않은 아이템은 '지워진' 상태로 연다 — 일반 아이템(HSB)이 0·0·0 으로 열리는 것과 같다.
  const [cleared, setCleared] = useState(() => !s.dyePalette[slot])
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
  const edit = (fn: (c: PaletteParams) => PaletteParams) => { setCleared(false); setPal(fn) }
  const setBase = (i: number) => edit((c) => ({ baseColor: i, mixColor: c.mixColor ?? c.baseColor, ratio: c.ratio }))
  const setMixC = (i: number) => edit((c) => ({ ...c, mixColor: i }))
  const setRatio = (fn: (cur: number) => number) => edit((c) => ({ ...c, ratio: Math.max(0, Math.min(100, fn(c.ratio))) }))
  // 저장 값: A=B 면 단색(mixColor=null)으로 남긴다 — 예전 염색표 선택과 같은 모양이라 대회 중복 판정도 그대로다.
  const commit: PaletteParams = { baseColor: pal.baseColor, mixColor: bIdx === pal.baseColor ? null : bIdx, ratio: pal.ratio }
  const apply = () => {
    s.equipItem(item)
    s.setDyePalette((prev) => {
      if (!cleared) return { ...prev, [slot]: commit }
      const d = { ...prev }; delete d[slot]; return d
    })
    if (!!s.dyeOff[slot] !== off) s.toggleDyeOff(slot)
    s.closeSurface()
    s.notify(`${name} 염색을 적용했어요`)
  }
  const reset = () => { setCleared(true); setPal(DEF_PAL()); setRaw(null) }

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
  // 버튼 줄은 **일반 아이템(HSB)과 같은 모양**이다(2026-09-23 사용자 지시) — 염색표 보기까지 한 줄에 양끝 정렬.
  const actsRow = (big: boolean) => (
    <div className={styles.resetRow}>
      <button type="button" onClick={() => go('table', 1)} title="염색표에서 두 색 고르기"
        className={big ? styles.resetIcon : clsx('pb-ghost', styles.resetBtn)}>염색표 보기</button>
      <button type="button" onClick={() => setOff((v) => !v)} aria-pressed={off} title={off ? '염색 다시 적용' : '수치는 그대로 두고 염색만 끄기'}
        className={clsx(big ? styles.resetIcon : clsx('pb-ghost', styles.resetBtn), styles.tickBtn, off && styles.offOn)}>
        <span className={clsx(styles.tick, off && styles.tickOn)} aria-hidden="true"><IconCheck size={9} /></span>비활성화
      </button>
      {big
        ? <button type="button" onClick={reset} title="염색 초기화" aria-label="염색 초기화" className={styles.resetIcon}><IconReset />초기화</button>
        : <button type="button" onClick={reset} className={clsx('pb-ghost', styles.resetBtn)}>염색 초기화</button>}
    </div>
  )
  const preview = <DyeModelPreview item={item} hsb={NO_HSB} palette={off || cleared ? undefined : commit} zoom={zoom} box={box} />

  const custom = mobile ? (
    <div className={clsx('pb-scroll', styles.hsvM)}>
      <div className={styles.topM}>
        <div ref={ref} className={styles.pvBoxM}>{preview}</div>
        <div className={styles.zoomCol}>{pills}</div>
      </div>
      <div className={styles.rowsCol}>{swatchRows}</div>
      <div className={styles.hr} />
      <div className={clsx('pb-dyecol', styles.rowsCol)}>{ratioRow}</div>
      {actsRow(true)}
    </div>
  ) : (
    <div className={styles.hsvPc}>
      <div className={styles.hsvLeft}>
        <div ref={ref} className={styles.pvBox}>{preview}</div>
        <div className={styles.zoomRow}>{pills}</div>
      </div>
      <div className={clsx('pb-scroll', styles.hsvRight)}>
        <div className={styles.rows}>{swatchRows}</div>
        <div className={styles.hr} />
        <div className={styles.rows}>{ratioRow}</div>
        {actsRow(false)}
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
              onClick={() => { setRaw(null); setCleared(false); setPal({ baseColor: r, mixColor: r === c ? null : c, ratio: 50 }); go('custom', -1) }}
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
  // 수치만 되돌린다 — 색상 계열과 '테두리 포함'은 설정이라 유지한다.
  const reset = () => { setHsb((h) => ({ h: 0, s: 0, b: 0, t: h.t ?? 0, edge: h.edge })); setRaw({}) }
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
  // '테두리 포함'과 같은 체크 네모를 단다 — 켜짐/꺼짐이 한눈에 읽히도록(2026-09-23 사용자 지시).
  const offBtn = (big: boolean) => (
    <button type="button" onClick={() => setOff((v) => !v)} aria-pressed={off} title={off ? '염색 다시 적용' : '수치는 그대로 두고 염색만 끄기'}
      className={clsx(big ? styles.resetIcon : clsx('pb-ghost', styles.resetBtn), styles.tickBtn, off && styles.offOn)}>
      <span className={clsx(styles.tick, off && styles.tickOn)} aria-hidden="true"><IconCheck size={9} /></span>비활성화
    </button>
  )
  const families = <FamilyDots size="lgMin" value={hsb.t ?? 0} onPick={(t) => setHsb((h) => ({ ...h, t }))} />
  // 테두리(순수 검정) 포함 — 명도로만, 회색으로만 바뀐다(lib/core/dye 설명). 그래서 명도가 0 이하면 눌러도
  // 보이는 변화가 없어, 그때만 이유를 알려 준다(버튼은 그대로 눌린다 — 값은 저장돼야 하므로).
  // 자리는 '염색 비활성화 · 염색 초기화'와 **같은 줄**이다(2026-09-23 사용자 지시 — 염색 설정 버튼은 한 줄에 모은다).
  // 단 **커스텀 피부는 제외**한다(같은 날 지시 — 피부에는 이 테두리가 있어선 안 된다). 줄도 예전처럼 오른쪽 정렬이다.
  const isSkin = slot === 'skin'
  const edgeOn = !!hsb.edge
  const edgeBtn = (big: boolean) => (
    <button type="button" onClick={() => setHsb((h) => ({ ...h, edge: !h.edge }))} aria-pressed={edgeOn}
      title={hsb.b > 0 ? '검정 테두리도 함께 밝아져요' : '테두리는 명도를 올려야 밝아져요'}
      className={clsx(big ? styles.resetIcon : clsx('pb-ghost', styles.resetBtn), styles.tickBtn, edgeOn && styles.offOn)}>
      <span className={clsx(styles.tick, edgeOn && styles.tickOn)} aria-hidden="true"><IconCheck size={9} /></span>테두리 포함
    </button>
  )

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
          <div className={clsx(styles.resetRow, isSkin && styles.resetRowEnd)}>
            {!isSkin && edgeBtn(true)}
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
          <div className={clsx(styles.resetRow, isSkin && styles.resetRowEnd)}>
            {!isSkin && edgeBtn(false)}
            {offBtn(false)}
            <button type="button" onClick={reset} className={clsx('pb-ghost', styles.resetBtn)}>염색 초기화</button>
          </div>
        </div>
      </div>
      <SurfaceFooter onApply={apply} />
    </>
  )
}
