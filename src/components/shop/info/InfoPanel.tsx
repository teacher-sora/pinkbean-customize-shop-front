'use client'

// 코디 정보 · 염색. 16부위 행 그리드 + (PC) 하단 인라인 염색. 모바일은 부위를 누르면 염색/점 위치 서피스를 연다.

import clsx from 'clsx'
import { useEffect, useRef, useState } from 'react'
import { CATS, paletteFor } from '@/lib/catalog'
import { clampDye } from '@/lib/color'
import type { ListItem } from '@/lib/core/data'
import type { HsbParams, PaletteParams } from '@/lib/core/dye'
import { CAT_TO_SLOT, DOT_MOVER_IDS, isDyeableSkin, skinDyeFamily } from '@/lib/shopData'
import { isNarrow } from '@/lib/useBreakpoint'
import { useShop } from '../ShopContext'
import { DyeSprite, INFO_FRAC, SKIN_PREVIEW_FRACTION, SkinModel } from '../render/DyeSprite'
import { DyeRow, FamilyDots, Stepper, Swatch } from '../ui/controls'
import { IconCheck, IconEye } from '../ui/Icons'
import { SlotSprite } from './SlotSprite'
import styles from './info.module.css'

const defPal = (): PaletteParams => ({ baseColor: 0, mixColor: null, ratio: 50 }) // 믹스 기본 비율 50%
const defHsb = (): HsbParams => ({ h: 0, s: 0, b: 0, t: 0 })
const hsbActive = (h?: HsbParams) => !!h && (h.h !== 0 || h.s !== 0 || h.b !== 0)

// 피부(톤)를 염색 다이얼로그에 넘길 ListItem 형태로.
export function useSkinItem(): ListItem | null {
  const s = useShop()
  const te = s.index?.base.tones.find((t) => t.tone === s.tone)
  if (!te) return null
  return { id: te.body, slot: 'skin', isCash: false, grade: 'none', islot: null, vslot: null, dyeMode: 'hsb', thumb: `sprites/${te.body}/thumb.png`, headId: te.head, name: te.name || `피부 ${te.tone}`, actions: [] }
}

export default function InfoPanel({ mobile }: { mobile: boolean }) {
  const s = useShop()
  const narrow = isNarrow(s.bp)
  const toneEntry = s.index?.base.tones.find((t) => t.tone === s.tone)
  const toneName = toneEntry?.name || `피부 ${s.tone}`
  const skinItem = useSkinItem()

  // 부위 그리드 열 = min(최대 열, 150px 카드가 들어가는 수)
  const slotsRef = useRef<HTMLDivElement>(null)
  const [infoW, setInfoW] = useState(0)
  useEffect(() => {
    const el = slotsRef.current; if (!el) return
    const m = () => { const w = el.clientWidth; if (w) setInfoW((p) => (p === w ? p : w)) }
    m()
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(m) : null
    ro?.observe(el)
    return () => ro?.disconnect()
  }, [mobile])
  const maxCols = mobile ? 2 : narrow ? 3 : 4
  const fit = infoW > 0 ? Math.floor((infoW - 20 + 8) / (150 + 8)) : maxCols
  const cols = Math.max(1, Math.min(maxCols, fit > 0 ? fit : maxCols))

  const rows = CATS.map((c) => {
    const slot = CAT_TO_SLOT[c.id]
    const isSkin = c.id === 'skin'
    const isMix = s.isMixSlot(slot)
    const item = isSkin ? skinItem : s.equipped[slot] || null
    const on = isSkin ? !!skinItem : !!item
    const hidden = !isSkin && !!s.hidden[slot]
    let dyed = false
    if (isSkin) dyed = isDyeableSkin(toneName) && hsbActive(s.dyeHsb.skin)
    else if (isMix) { const p = s.dyePalette[slot]; dyed = !!p && (p.baseColor !== 0 || (p.mixColor != null && p.ratio > 0)) }
    else dyed = hsbActive(s.dyeHsb[slot])
    return { c, slot, isSkin, isMix, item, on, hidden, dyed, dyeOff: !!s.dyeOff[slot], sel: s.dyeTarget === slot }
  })
  const wornCount = rows.filter((r) => r.on).length

  const pick = (r: typeof rows[number]) => {
    if (!r.on || !r.item) return
    s.setDyeTarget(r.slot)
    if (!mobile) return
    if (r.isSkin && !isDyeableSkin(toneName)) { s.notify('이 피부는 염색할 수 없어요'); return }
    if (DOT_MOVER_IDS.has(r.item.id)) s.openDot(r.item); else s.openDye(r.item)
  }

  const grid = (
    <div className={styles.grid} style={{ gridTemplateColumns: `repeat(${cols},minmax(0,1fr))` }}>
      {rows.map((r) => {
        const name = r.on ? (r.hidden ? '숨김' : (r.item!.name || r.item!.id)) : '미착용'
        return (
          <button key={r.c.id} type="button" onClick={() => pick(r)} title={r.on ? `${r.c.label} · ${r.item!.name || r.item!.id} — 눌러서 염색` : `${r.c.label} — 미착용`}
            className={clsx(r.on && 'pb-slotrow', styles.slot, r.on && styles.slotOn, r.hidden && styles.slotHidden, r.sel && styles.slotSel)}>
            <span className={clsx(styles.slotThumb, r.on && !r.hidden && styles.slotThumbOn)}>
              {r.on && r.item ? (
                <span className={clsx(styles.slotSprite, r.hidden && styles.slotSpriteHidden)}>
                  <SlotSprite slot={r.slot} item={r.item} grayscale={r.hidden} />
                </span>
              ) : <span className={styles.slotEmpty} />}
              {r.dyed && <span title={r.dyeOff ? '염색 비활성화됨' : '염색됨'} className={clsx(styles.dyedDot, r.dyeOff && styles.dyedDotOff)} />}
            </span>
            <span className={clsx(styles.slotText, mobile && styles.slotTextM)}>
              <span className={styles.slotPart}>{r.c.label}</span>
              <span className={clsx(styles.slotName, r.on && !r.hidden && styles.slotNameOn)}>{name}</span>
            </span>
            {r.on && !r.isSkin && (
              <span role="button" tabIndex={0} title="미리보기 표시/숨김" aria-label="미리보기 표시/숨김"
                onClick={(e) => { e.stopPropagation(); s.setHidden((h) => { const n = { ...h }; if (n[r.slot]) delete n[r.slot]; else n[r.slot] = true; return n }) }}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); s.setHidden((h) => { const n = { ...h }; if (n[r.slot]) delete n[r.slot]; else n[r.slot] = true; return n }) } }}
                className={clsx(styles.toggle, r.hidden && styles.toggleHidden)}>
                <IconEye hidden={r.hidden} />
              </span>
            )}
          </button>
        )
      })}
    </div>
  )

  const chip = (
    <div title="착용한 부위 수" className={clsx(styles.chip, mobile && styles.chipM)}>
      <span className={styles.chipLabel}>착용</span>
      <span className={styles.chipNum}>{wornCount}</span>
      <span className={styles.chipSlash}>/</span>
      <span className={styles.chipLabel}>{CATS.length}</span>
    </div>
  )
  const unequip = <button type="button" onClick={s.unequipAll} title="모든 부위 벗기" className={clsx('pb-ghost', styles.btn, mobile && styles.btnM)}>전체 벗기</button>

  if (mobile) {
    return (
      <>
        <div className={styles.headerM}>{chip}<div className={styles.right}>{unequip}</div></div>
        <div className={styles.hrM} />
        <div className={clsx('pb-scroll', 'pb-norail', styles.scrollM)}>
          <div ref={slotsRef}>{grid}</div>
        </div>
      </>
    )
  }
  return (
    <section className={styles.panel}>
      <div className={styles.header}>{chip}<div className={styles.right}>{unequip}</div></div>
      <div className={styles.hr} />
      <div className={clsx('pb-scroll', styles.scroll)}>
        <div ref={slotsRef} className={styles.slots}>{grid}</div>
        <div className={styles.dyeWrap}>
          <div className={styles.dyeHr} />
          <InlineDye infoW={infoW} narrow={narrow} skinItem={skinItem} toneName={toneName} />
        </div>
      </div>
    </section>
  )
}

function InlineDye({ infoW, narrow, skinItem, toneName }: { infoW: number; narrow: boolean; skinItem: ListItem | null; toneName: string }) {
  const s = useShop()
  const zmap = s.index?.zmap || []
  const smap = s.index?.smap || {}
  const target = s.dyeTarget
  const isSkin = target === 'skin'
  const it = !target ? null : isSkin ? skinItem : s.equipped[target] || null
  const mix = !!target && s.isMixSlot(target)
  const PAL = paletteFor(target) // 성형=FACE_PALETTE 표기, 헤어=MIX_PALETTE. 발색 로직은 동일.
  const cat = target ? CATS.find((c) => CAT_TO_SLOT[c.id] === target) : null
  const compact = narrow || infoW < 560
  // 카드 3개(최소 90px)와 염색 박스(미리보기+컨트롤 482+패딩)가 함께 들어갈 폭일 때만 카드 배치
  const boxNeed = (compact ? 96 : 116) + 7 + 482 + 24 + 12
  const cardsFit = !!it && (infoW - 32 - boxNeed - 14) >= 75

  // 입력 중 문자열 버퍼(빈값·'-' 허용). 슬라이더/스테퍼로 바꾸면 버퍼를 비워 실제 값을 보인다.
  const [raw, setRaw] = useState<Record<string, string>>({})
  const clearRaw = (k: string) => setRaw((r) => { if (!(k in r)) return r; const n = { ...r }; delete n[k]; return n })
  // 슬라이더 드래그 동안 미리보기 애니메이션 일시정지(발색 리컬러에 리소스 몰아줌). 릴리즈 시 해제.
  const beginDrag = () => {
    s.setDyeInteracting(true)
    const end = () => { s.setDyeInteracting(false); window.removeEventListener('pointerup', end); window.removeEventListener('pointercancel', end) }
    window.addEventListener('pointerup', end)
    window.addEventListener('pointercancel', end)
  }

  const areaCls = clsx(styles.dyeArea, cardsFit && styles.dyeAreaFit)
  if (!it || !target) {
    return (
      <div className={areaCls}>
        <div className={styles.dyeOff}>
          <span className={styles.dyeOffTitle}>염색할 아이템을 선택해주세요</span>
          <span className={styles.dyeOffHint}>위 코디 정보에서 착용된 부위를 누르면 염색할 수 있어요</span>
        </div>
      </div>
    )
  }
  if (isSkin && !isDyeableSkin(toneName)) {
    return (
      <div className={areaCls}>
        <div className={styles.dyeOff}>
          <span className={styles.dyeOffTitle}>이 피부는 염색할 수 없어요</span>
          <span className={styles.dyeOffHint}>&quot;컬러라인&quot; 커스텀 피부만 라인 염색이 가능해요</span>
        </div>
      </div>
    )
  }

  const pal = s.dyePalette[target] || defPal()
  const hsb = s.dyeHsb[target] || defHsb()
  const setPal = (patch: (cur: PaletteParams) => PaletteParams) => s.setDyePalette((p) => ({ ...p, [target]: patch(p[target] || defPal()) }))
  // A(baseColor)/B(mixColor)/ratio 는 항상 독립 — A 를 바꿀 때 B(현재 표시값)를 명시적으로 고정해 따라오지 않게 한다.
  const setBase = (i: number) => setPal((cur) => ({ baseColor: i, mixColor: cur.mixColor ?? cur.baseColor, ratio: cur.ratio }))
  const setMixC = (i: number) => setPal((cur) => ({ ...cur, mixColor: i }))
  const setHsbF = (f: 'h' | 's' | 'b', fn: (v: number) => number) => s.setDyeHsb((p) => { const cur = p[target] || defHsb(); return { ...p, [target]: { ...cur, [f]: clampDye(f, fn(cur[f] ?? 0)) } } })
  const resetDye = () => {
    if (mix) s.setDyePalette((p) => { const d = { ...p }; delete d[target]; return d })
    else s.setDyeHsb((p) => { const d = { ...p }; delete d[target]; return d })
    setRaw({})
  }
  const isDot = DOT_MOVER_IDS.has(it.id)
  const off = !!s.dyeOff[target]
  // 염색 비활성화 토글 — 문구는 고정, 눌림 상태(aria-pressed + 강조 스타일)로만 구분. 수치는 유지된다.
  const offBtn = (
    <button type="button" onClick={() => s.toggleDyeOff(target)} aria-pressed={off} title={off ? '염색 다시 적용' : '수치는 그대로 두고 염색만 끄기'}
      className={clsx('pb-ghost', styles.btn, off && styles.btnOn)}>염색 비활성화</button>
  )
  // 테두리(순수 검정) 포함 — 염색 다이얼로그와 같은 값(dyeHsb.edge)을 여기서도 켜고 끈다.
  // 검정은 채도가 0이라 색조·채도는 수학적으로 무효고 **명도로만 회색으로** 밝아진다(lib/core/dye).
  const edgeOn = !!s.dyeHsb[target]?.edge
  const edgeBtn = (
    <button type="button" aria-pressed={edgeOn}
      onClick={() => s.setDyeHsb((p) => ({ ...p, [target]: { ...(p[target] || defHsb()), edge: !p[target]?.edge } }))}
      title={(s.dyeHsb[target]?.b ?? 0) > 0 ? '검정 테두리도 함께 밝아져요' : '테두리는 명도를 올려야 밝아져요'}
      className={clsx('pb-ghost', styles.btn, styles.tickBtn, edgeOn && styles.btnOn)}>
      <span className={clsx(styles.tick, edgeOn && styles.tickOn)} aria-hidden="true"><IconCheck size={9} /></span>테두리 포함
    </button>
  )
  const box = compact ? 72 : 88

  return (
    <div className={areaCls}>
      {cardsFit && (
        <div className={styles.sideCards}>
          <div className={styles.sideCard} /><div className={styles.sideCard} /><div className={styles.sideCard} />
        </div>
      )}
      <div className={clsx(styles.dyeBody, cardsFit && styles.dyeBodyFit)}>
        <div className={clsx(styles.pvCol, compact && styles.pvColCompact)}>
          <div className={clsx(styles.pvBox, compact && styles.pvBoxCompact)}>
            {isSkin
              ? <SkinModel key={target} bodyId={it.id} headId={it.headId!} hsb={off ? defHsb() : hsb} dyeable family={skinDyeFamily(toneName)} zmap={zmap} smap={smap} box={box} fraction={SKIN_PREVIEW_FRACTION} />
              : <DyeSprite key={target} id={it.id} thumb={it.icon || `sprites/${it.id}/icon.png`} mix={mix} palette={off ? undefined : pal} hsb={off ? undefined : hsb} zmap={zmap} frac={INFO_FRAC} />}
          </div>
          <div className={styles.pvText}>
            <div className={styles.pvPart}>{cat?.label || ''}</div>
            <div className={styles.pvName}>{it.name || it.id}</div>
          </div>
        </div>
        <div className={styles.divider} />
        <div className={clsx('pb-dyecol', styles.ctrlCol, cardsFit && styles.ctrlColFit)}>
          {mix ? (
            <>
              <div className={styles.group}>
                <div className={styles.swRow}>
                  <span className={styles.swLabel}>색상 A</span>
                  <div className={styles.swList}>{PAL.map((p, i) => <Swatch key={i} hex={p.hex} name={p.name} on={pal.baseColor === i} onPick={() => setBase(i)} />)}</div>
                </div>
                <div className={styles.swRow}>
                  <span className={styles.swLabel}>색상 B</span>
                  <div className={styles.swList}>{PAL.map((p, i) => <Swatch key={i} hex={p.hex} name={p.name} on={(pal.mixColor ?? pal.baseColor) === i} onPick={() => setMixC(i)} />)}</div>
                </div>
                <div className={styles.groupHr} />
              </div>
              <div className={styles.group}>
                <DyeRow label="비율" track="s" min={0} max={100} value={pal.ratio} onDragStart={beginDrag}
                  onRange={(v) => { clearRaw('ratio'); setPal((cur) => ({ ...cur, ratio: Math.max(0, Math.min(100, v)) })) }}
                  stepper={<Stepper label="혼합 비율" size="sm" valueStr={raw.ratio ?? String(pal.ratio)}
                    onNum={(v) => { if (!/^\d*$/.test(v)) return; setRaw((r) => ({ ...r, ratio: v })); if (v !== '') setPal((cur) => ({ ...cur, ratio: Math.max(0, Math.min(100, parseInt(v, 10))) })) }}
                    onBlur={() => clearRaw('ratio')}
                    onStep={(d) => { clearRaw('ratio'); setPal((cur) => ({ ...cur, ratio: Math.max(0, Math.min(100, cur.ratio + d)) })) }}
                    decOff={pal.ratio <= 0} incOff={pal.ratio >= 100} />} />
                {/* 헤어·성형은 여기까지다 — 색 A·B 와 그 사이 비율이 전부이고 HSB(색조·채도·명도)는 쓰지 않는다
                    (2026-09-21 사용자 지시: 한때 얹었던 커스텀 HSB 를 걷어냈다). */}
                <div className={styles.acts}>
                  <button type="button" onClick={() => s.openDye(it)} title="발색표 보기" className={clsx('pb-ghost', styles.btn)}>염색표 보기</button>
                  {offBtn}
                  <button type="button" onClick={resetDye} title="이 아이템 염색 초기화" className={clsx('pb-ghost', styles.btn)}>수치 초기화</button>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className={styles.group}>
                <div className={styles.famRow}>
                  <FamilyDots size="sm" value={hsb.t ?? 0} onPick={(t) => s.setDyeHsb((p) => ({ ...p, [target]: { ...(p[target] || defHsb()), t } }))} />
                </div>
                <div className={styles.groupHr} />
              </div>
              <div className={styles.group}>
                {([['색조', 'h', 'h', 0, 359], ['채도', 's', 's', -99, 99], ['명도', 'b', 'v', -99, 99]] as const).map(([label, f, track, lo, hi]) => (
                  <DyeRow key={f} label={label} track={track} min={lo} max={hi} value={hsb[f]} onDragStart={beginDrag}
                    onRange={(v) => { clearRaw(f); setHsbF(f, () => v) }}
                    stepper={<Stepper label={label} size="sm" valueStr={raw[f] ?? String(hsb[f])}
                      onNum={(v) => { if (!/^-?\d*$/.test(v)) return; setRaw((r) => ({ ...r, [f]: v })); setHsbF(f, () => (v === '' || v === '-' ? 0 : parseInt(v, 10))) }}
                      onBlur={() => clearRaw(f)}
                      onStep={(d) => { clearRaw(f); setHsbF(f, (cur) => cur + d) }}
                      decOff={hsb[f] <= lo} incOff={hsb[f] >= hi} />} />
                ))}
                <div className={styles.acts}>
                  {isDot && <button type="button" onClick={() => s.openDot(it)} title="점 위치 조절" className={clsx('pb-ghost', styles.btn)}>점 위치</button>}
                  {edgeBtn}
                  {offBtn}
                  <button type="button" onClick={resetDye} title="이 아이템 염색 초기화" className={clsx('pb-ghost', styles.btn)}>수치 초기화</button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
