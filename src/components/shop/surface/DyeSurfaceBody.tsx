'use client'

// 염색 서피스 본문.
//  · 헤어·성형(mix) = **베이스 · 믹스 색과 믹스의 비율**. 그 외 아이템의 HSB 와는 다른 체계다.
//    8×8 염색표는 '염색표 보기'로 같은 다이얼로그 안에서 가로 슬라이드로 오간다(크기가 같아 내용만 움직인다).
//    표의 한 칸을 고르면 그 두 색이 1:1 로 들어오며 곧바로 조절 화면으로 돌아온다.
//  · 그 외 = HSB(미리보기 + 색상 계열 + 색조·채도·명도).
// 적용 = 보던 아이템 착용 + 염색 커밋. 카드의 염색 버튼 자체는 착용을 바꾸지 않는다.

import clsx from 'clsx'
import { useEffect, useState } from 'react'
import { MIX_PALETTE, paletteFor } from '@/lib/catalog'
import { clampDye } from '@/lib/color'
import { loadMeta, type ItemMeta, type ListItem } from '@/lib/core/data'
import type { HsbParams, PaletteParams } from '@/lib/core/dye'
import { useShop, type ListMode } from '../ShopContext'
import DyeCellCanvas from '../render/DyeCellCanvas'
import DyeModelPreview from '../render/DyeModelPreview'
import { DyeRow, FamilyDots, MixRatio, MixSwatches, Stepper } from '../ui/controls'
import { IconCheck, IconReset, IconViewModel } from '../ui/Icons'
import DyeVault from './DyeVault'
import { useInnerSlide } from './innerSlide'
import { SurfaceFooter } from './Surface'
import styles from './surface.module.css'

type F = 'h' | 's' | 'b'
const TRACK: Record<F, 'h' | 's' | 'v'> = { h: 'h', s: 's', b: 'v' }
const RANGE: Record<F, [number, number]> = { h: [0, 359], s: [-99, 99], b: [-99, 99] }
const NO_HSB: HsbParams = { h: 0, s: 0, b: 0, t: 0 } // 헤어·성형은 HSB 를 쓰지 않는다
const DEF_PAL = (): PaletteParams => ({ baseColor: 0, mixColor: null, ratio: 50 }) // 코디 정보 탭과 같은 기본값

// 보기 모델(아이템 · 기본 캐릭터 · 내 캐릭터)과 배율(1x·2x·3x) 알약 — 두 본문이 함께 쓴다.
// 보기 모델은 내 캐릭터가 기본이다(사용자 지시). 피부는 '아이템' 그림이 곧 피부라 목록처럼 '아이템'을 잠근다.
// pills = 보기 모델 묶음 + 배율 묶음. PC 는 미리보기 아래 한 줄에 나란히, 모바일은 미리보기 오른쪽 세로줄 아래에 배율, 그 위에 간격을 두고 보기 모델(styles.zoomCol).
const VIEW_MODELS: { v: ListMode; l: string }[] = [
  { v: 'sprite', l: '아이템' },
  { v: 'model', l: '기본 캐릭터' },
  { v: 'mymodel', l: '내 캐릭터' },
]
function useViewPills(skin: boolean) {
  const [zoom, setZoom] = useState(2)
  const [model, setModel] = useState<ListMode>('mymodel')
  const on = (v: boolean) => clsx(v ? 'pb-solid' : 'pb-soft', styles.zoom, v && styles.zoomOn)
  const pills = (
    <>
      <div className={styles.pillGroup} role="group" aria-label="보기 모델">
        {VIEW_MODELS.map(({ v, l }) => {
          const locked = skin && v === 'sprite'
          return (
            <button key={v} type="button" onClick={() => setModel(v)} disabled={locked} aria-pressed={model === v} aria-label={l}
              title={locked ? '피부는 아이템 그림이 캐릭터예요' : l} className={clsx(on(model === v), styles.viewPill)}>
              <IconViewModel mode={v} />
            </button>
          )
        })}
      </div>
      <div className={styles.pillGroup} role="group" aria-label="배율">
        {[1, 2, 3].map((z) => (
          <button key={z} type="button" onClick={() => setZoom(z)} aria-pressed={zoom === z} className={on(zoom === z)}>{z}x</button>
        ))}
      </div>
    </>
  )
  return { zoom, model, pills }
}

export default function DyeSurfaceBody({ item, mobile }: { item: ListItem; mobile: boolean }) {
  const s = useShop()
  const name = item.name || item.id
  return s.isMixSlot(item.slot)
    ? <MixBody item={item} mobile={mobile} name={name} />
    : <HsbBody item={item} mobile={mobile} name={name} />
}

// ── 헤어·성형: 베이스 · 믹스 · 비율 ↔ 염색표 ─────────────────────────────
function MixBody({ item, mobile, name }: { item: ListItem; mobile: boolean; name: string }) {
  const s = useShop()
  const slot = item.slot
  const PAL = paletteFor(slot) // 성형=FACE_PALETTE 표기, 헤어=MIX_PALETTE. 발색 로직은 동일.
  const zmap = s.index?.zmap || []
  const [meta, setMeta] = useState<ItemMeta | null>(null)
  const [pal, setPal] = useState<PaletteParams>(() => ({ ...(s.dyePalette[slot] ?? DEF_PAL()) }))
  const [off, setOff] = useState(() => !!s.dyeOff[slot]) // 염색 비활성화(적용 시 커밋) — 일반 아이템과 같다
  // '염색 초기화' = 염색을 지운다(코디 정보 탭의 '수치 초기화'와 같은 뜻 — 원래 색으로 돌아간다).
  // 헤어·성형은 '염색 없음'을 색 조합으로 표현할 수 없어(검정 A·B 도 엄연한 염색이다) 따로 표시해 두고,
  // 색이나 비율을 다시 건드리면 풀린다.
  // 아직 염색하지 않은 아이템은 '지워진' 상태로 연다 — 일반 아이템(HSB)이 0·0·0 으로 열리는 것과 같다.
  const [cleared, setCleared] = useState(() => !s.dyePalette[slot])
  const { zoom, model, pills } = useViewPills(false)
  const { view, go, style } = useInnerSlide<'custom' | 'table'>('custom')

  useEffect(() => {
    let alive = true
    loadMeta(item.id).then((m) => { if (alive) setMeta(m) }).catch(() => {})
    return () => { alive = false }
  }, [item.id])

  const bIdx = pal.mixColor ?? pal.baseColor // 화면에 보이는 '믹스'(베이스와 같으면 단색)
  // 베이스 · 믹스 · 비율은 서로 독립 — 베이스를 바꿀 때 믹스(현재 표시값)를 명시적으로 고정해 따라오지 않게 한다(코디 정보 탭과 같은 규칙).
  const edit = (fn: (c: PaletteParams) => PaletteParams) => { setCleared(false); setPal(fn) }
  const setBase = (i: number) => edit((c) => ({ baseColor: i, mixColor: c.mixColor ?? c.baseColor, ratio: c.ratio }))
  const setMixC = (i: number) => edit((c) => ({ ...c, mixColor: i }))
  const setRatio = (fn: (cur: number) => number) => edit((c) => ({ ...c, ratio: Math.max(0, Math.min(100, fn(c.ratio))) }))
  // 저장 값: A=B 면 단색(mixColor=null)으로 남긴다 — 염색표에서 한 색을 고른 것과 같은 모양이라 대회 중복 판정도 그대로다.
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
  const reset = () => { setCleared(true); setPal(DEF_PAL()) }

  // 일반 아이템(색 계열 줄 / 가로선 / 조절 줄)과 같은 구조 — 가로선은 바깥 칸의 형제로, 그 칸의 간격으로 나뉜다
  const swatchRows = <MixSwatches pal={PAL} base={pal.baseColor} mix={bIdx} onBase={setBase} onMix={setMixC} />
  const ratioRows = <MixRatio pal={PAL} base={pal.baseColor} mix={bIdx} ratio={pal.ratio} onRatio={(v) => setRatio(() => v)} />
  // 버튼 줄은 **일반 아이템(HSB)과 같은 모양**이다 — 염색표 보기까지 한 줄에 양끝 정렬.
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
  const preview = <DyeModelPreview item={item} hsb={NO_HSB} palette={off || cleared ? undefined : commit} zoom={zoom} model={model} />
  // 염색 보관함 — 고르면 그 색 조합이 조절 칸으로 들어온다(적용은 [적용])
  const vault = <DyeVault item={item} mobile={mobile} current={{ pal: commit }} onPick={(d) => { if ('pal' in d) { setCleared(false); setPal({ ...d.pal }) } }} />

  const custom = mobile ? (
    <div className={clsx('pb-scroll', 'pb-fade', styles.hsvM)}>
      <div className={styles.topM}>
        <div className={styles.pvBoxM}>{preview}</div>
        <div className={styles.zoomCol}>{pills}</div>
      </div>
      <div className={styles.rowsCol}>{swatchRows}</div>
      <div className={styles.hr} />
      <div className={styles.rowsCol}>{ratioRows}</div>
      {actsRow(true)}
      {vault}
    </div>
  ) : (
    <div className={styles.hsvPc}>
      <div className={styles.hsvLeft}>
        <div className={styles.pvBox}>{preview}</div>
        <div className={styles.zoomRow}>{pills}</div>
      </div>
      <div className={clsx('pb-scroll', 'pb-fade', styles.hsvRight)}>
        <div className={styles.rows}>{swatchRows}</div>
        <div className={styles.hr} />
        <div className={styles.rows}>{ratioRows}</div>
        {actsRow(false)}
        {vault}
      </div>
    </div>
  )

  const table = (
    <div className={clsx('pb-scroll', 'pb-fade', styles.mixScroll)}>
      <div className={clsx(styles.mixGrid, mobile && styles.mixGridM)}>
        {MIX_PALETTE.map((_, r) => MIX_PALETTE.map((__, c) => {
          const on = pal.baseColor === r && bIdx === c
          return (
            <button key={`${r}-${c}`} type="button"
              onClick={() => { setCleared(false); setPal({ baseColor: r, mixColor: r === c ? null : c, ratio: 50 }); go('custom', -1) }}
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
  const { zoom, model, pills } = useViewPills(slot === 'skin')
  const [off, setOff] = useState(() => !!s.dyeOff[slot]) // 염색 비활성화(적용 시 커밋)

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
        stepper={<Stepper label={label} placeholder="0" valueStr={raw[f] ?? String(hsb[f])}
          onNum={(v) => { if (!/^-?\d*$/.test(v)) return; setRaw((r) => ({ ...r, [f]: v })); setF(f, () => (v === '' || v === '-' ? 0 : parseInt(v, 10))) }}
          onBlur={() => clearRaw(f)}
          onStep={(d) => { clearRaw(f); setF(f, (cur) => cur + d) }}
          decOff={hsb[f] <= lo} incOff={hsb[f] >= hi} />} />
    )
  })
  const pvHsb = off ? { h: 0, s: 0, b: 0, t: hsb.t ?? 0 } : hsb
  // '테두리 포함'과 같은 체크 네모를 단다 — 켜짐/꺼짐이 한눈에 읽히도록.
  const offBtn = (big: boolean) => (
    <button type="button" onClick={() => setOff((v) => !v)} aria-pressed={off} title={off ? '염색 다시 적용' : '수치는 그대로 두고 염색만 끄기'}
      className={clsx(big ? styles.resetIcon : clsx('pb-ghost', styles.resetBtn), styles.tickBtn, off && styles.offOn)}>
      <span className={clsx(styles.tick, off && styles.tickOn)} aria-hidden="true"><IconCheck size={9} /></span>비활성화
    </button>
  )
  // 염색 보관함 — 고르면 그 값이 조절 칸으로 들어온다(적용은 [적용])
  const vault = <DyeVault item={item} mobile={mobile} current={{ hsb }} onPick={(d) => { if ('hsb' in d) { setHsb({ ...d.hsb }); setRaw({}) } }} />
  const families = <FamilyDots noShrink value={hsb.t ?? 0} onPick={(t) => setHsb((h) => ({ ...h, t }))} />
  // 테두리(순수 검정) 포함 — 명도로만, 회색으로만 바뀐다(lib/core/dye 설명). 그래서 명도가 0 이하면 눌러도
  // 보이는 변화가 없어, 그때만 이유를 알려 준다(버튼은 그대로 눌린다 — 값은 저장돼야 하므로).
  // 자리는 '염색 비활성화 · 염색 초기화'와 **같은 줄**이다(염색 설정 버튼은 한 줄에 모은다).
  // 단 **커스텀 피부는 제외**한다(피부에는 이 테두리가 있어선 안 된다). 그때는 줄을 오른쪽 정렬로 둔다.
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
        <div className={clsx('pb-scroll', 'pb-fade', styles.hsvM)}>
          <div className={styles.topM}>
            <div className={styles.pvBoxM}><DyeModelPreview item={item} hsb={pvHsb} zoom={zoom} model={model} /></div>
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
          {vault}
        </div>
        <SurfaceFooter onApply={apply} />
      </>
    )
  }
  return (
    <>
      <div className={styles.hsvPc}>
        <div className={styles.hsvLeft}>
          <div className={styles.pvBox}><DyeModelPreview item={item} hsb={pvHsb} zoom={zoom} model={model} /></div>
          <div className={styles.zoomRow}>{pills}</div>
        </div>
        <div className={clsx('pb-scroll', 'pb-fade', styles.hsvRight)}>
          <div className={styles.famRow}>{families}</div>
          <div className={styles.hr} />
          <div className={styles.rows}>{rows()}</div>
          <div className={clsx(styles.resetRow, isSkin && styles.resetRowEnd)}>
            {!isSkin && edgeBtn(false)}
            {offBtn(false)}
            <button type="button" onClick={reset} className={clsx('pb-ghost', styles.resetBtn)}>염색 초기화</button>
          </div>
          {vault}
        </div>
      </div>
      <SurfaceFooter onApply={apply} />
    </>
  )
}
