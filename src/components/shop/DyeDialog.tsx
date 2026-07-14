'use client'

import { useEffect, useRef, useState } from 'react'
import { CATS, MIX_PALETTE } from '@/lib/catalog'
import { clampDye } from '@/lib/color'
import { assemble, getFrameLayers, type AssembleInput, type PlacedLayer } from '@/lib/core/assemble'
import { loadEffect, loadEffectIndex, loadMeta, type ItemMeta, type ListItem } from '@/lib/core/data'
import { applyHsb, buildOverrides, renderDyedSprite, type HsbParams } from '@/lib/core/dye'
import { computeModelPlacement } from '@/lib/core/modelPlacement'
import { effectDraws, loadImage, renderCharacter, type EffectDraw } from '@/lib/core/render'
import { CAT_TO_SLOT, THUMB_VIEW } from '@/lib/shopData'
import { css } from '@/lib/style'
import { useShop } from './ShopContext'

const FAMILIES = ['전체 색상 계열', '빨간 색상 계열', '노란 색상 계열', '초록 색상 계열', '청록 색상 계열', '파란 색상 계열', '자주 색상 계열']

// HSB 미리보기: 우측 미리보기/카드와 동일한 computeModelPlacement 공식 사용(마네킹 중앙 고정 + 정수 스냅으로
// 항상 선명). 컨테이너는 고정 348×390. 배율(1x/2x/3x)은 fraction 에 곱하는 월드 배율.
const DIALOG_CANVAS = { w: 348, h: 390 }
const DIALOG_FRACTION = 0.33
const DIALOG_ZOOM: Record<number, number> = { 1: 0.6, 2: 1.0, 3: 1.6 }

// 발색 확인용 셀(헤어/성형): 아이템 자체 스프라이트를 (기본색 × 믹스색) 조합으로 리컬러해 정사각형에 그린다.
function DyeCell({ meta, base, mixC, zmap, selected, onClick }: {
  meta: ItemMeta; base: number; mixC: number; zmap: string[]; selected: boolean; onClick: () => void
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const el = ref.current; if (!el) return
    // 셀 디바이스 픽셀 해상도로 렌더 → 1:1 표시. renderDyedSprite 내부에서 배율을 정수 스냅해 항상 선명.
    const size = Math.round((el.clientWidth || 62) * (window.devicePixelRatio || 1))
    renderDyedSprite(el, meta, base, mixC, base === mixC ? 0 : 50, THUMB_VIEW, zmap, size).catch(() => {})
  }, [meta, base, mixC, zmap])
  return (
    <button onClick={onClick} title={`${MIX_PALETTE[base].name} × ${MIX_PALETTE[mixC].name}`}
      style={css(`position:relative; width:100%; aspect-ratio:1/1; padding:0; border-radius:7px; cursor:pointer; background:#f7f2ec; border:2px solid ${selected ? '#ec86ac' : 'rgba(0,0,0,0.06)'}; overflow:hidden; transition:border-color .12s ease;`)}>
      <canvas ref={ref} style={{ width: '100%', height: '100%', imageRendering: 'pixelated' }} />
    </button>
  )
}

// 그 외(캐시) 아이템 발색 미리보기: 베이스 모델(몸+머리)에 이 아이템을 입힌 뒤 HSB 발색을 실시간 적용.
function DyeModelPreview({ item, hsb, zoom }: { item: ListItem; hsb: HsbParams; zoom: number }) {
  const s = useShop()
  const ref = useRef<HTMLCanvasElement>(null)
  const [placed, setPlaced] = useState<PlacedLayer[] | null>(null)
  const [itemMeta, setItemMeta] = useState<ItemMeta | null>(null)
  const [effs, setEffs] = useState<EffectDraw[]>([]) // 이 아이템의 이펙트(정적 대표 프레임)

  useEffect(() => {
    const idx = s.index; if (!idx) return
    let alive = true
    ;(async () => {
      // 피부(컬러라인) 염색: 오버레이 아이템 없이 이 피부의 body+head 자체를 그린다. 라인만 HSB 로 변한다.
      if (item.slot === 'skin') {
        const [body, head] = await Promise.all([loadMeta(item.id), loadMeta(item.headId!)])
        if (!alive) return
        setItemMeta(null); setEffs([])
        const items: AssembleInput[] = [
          { itemId: body.id, slot: 'body', vslot: null, layers: getFrameLayers(body, THUMB_VIEW) },
          { itemId: head.id, slot: 'head', vslot: null, layers: getFrameLayers(head, THUMB_VIEW) },
        ]
        const { placed: p } = assemble(items, idx.zmap, idx.smap)
        if (alive) setPlaced(p)
        return
      }
      const te = idx.base.tones.find((t) => t.tone === s.tone) || idx.base.tones.find((t) => t.tone === idx.base.default) || idx.base.tones[0]
      const [body, head, im] = await Promise.all([loadMeta(te.body), loadMeta(te.head), loadMeta(item.id)])
      if (!alive) return
      setItemMeta(im)
      const items: AssembleInput[] = [
        { itemId: body.id, slot: 'body', vslot: null, layers: getFrameLayers(body, THUMB_VIEW) },
        { itemId: head.id, slot: 'head', vslot: null, layers: getFrameLayers(head, THUMB_VIEW) },
        { itemId: im.id, slot: im.slot, vslot: im.vslot ?? null, layers: getFrameLayers(im, THUMB_VIEW), invisibleFace: im.invisibleFace },
      ]
      const { placed: p, anchors } = assemble(items, idx.zmap, idx.smap)
      setPlaced(p)
      // 아이템 이펙트(망토/무기 등) — 정적 대표 프레임. 있으면 합성해서 보여준다.
      const bare = String(parseInt(item.id, 10))
      const eidx = await loadEffectIndex().catch(() => new Set<string>())
      if (alive && eidx.has(bare)) {
        const em = await loadEffect(item.id).catch(() => null)
        const bp = p.find((x) => x.name === 'body')
        const foot = bp ? { x: bp.x + bp.origin.x, y: bp.y + bp.origin.y } : { x: 8, y: 21 }
        setEffs(em ? effectDraws(em, THUMB_VIEW.action, { foot, brow: anchors.brow ?? foot }, 0) : [])
      } else if (alive) setEffs([])
    })().catch(() => {})
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.index, s.tone, item.id])

  useEffect(() => {
    const canvas = ref.current; if (!canvas || !placed) return
    const dyed = hsb.h !== 0 || hsb.s !== 0 || hsb.b !== 0
    let cancelled = false
    ;(async () => {
      let ov: Map<string, HTMLCanvasElement>
      if (item.slot === 'skin') {
        // 피부: 그려진 모든 레이어(body/arm/head/ear…)를 HSB 로 리컬러 → 라인만 시각적으로 변한다.
        ov = new Map()
        if (dyed) for (const p of placed) { try { ov.set(p.png, applyHsb(await loadImage(p.png, true), hsb, p.png)) } catch (_) {} }
      } else {
        if (!itemMeta) return
        ov = await buildOverrides([itemMeta], { palette: {}, hsb: { [itemMeta.slot]: hsb } }, THUMB_VIEW)
        // 이펙트도 같은 HSB 로 염색해서 보여준다.
        if (dyed) for (const ed of effs) { try { ov.set(ed.png, applyHsb(await loadImage(ed.png, true), hsb, ed.png)) } catch (_) {} }
      }
      if (cancelled) return
      // 우측 미리보기/카드와 동일 공식: 마네킹 중앙 고정 + 정수 스냅(선명). 배율은 fraction 에 곱.
      const dpr = window.devicePixelRatio || 1
      const pl = computeModelPlacement({ divW: DIALOG_CANVAS.w, divH: DIALOG_CANVAS.h, dpr, margin: 1, fraction: DIALOG_FRACTION, zoomMult: DIALOG_ZOOM[zoom] ?? 1, snap: true })
      canvas.style.width = pl.canvasCssW + 'px'
      canvas.style.height = pl.canvasCssH + 'px'
      renderCharacter(canvas, placed, { scale: pl.scale, box: pl.box, anchor: pl.anchor, override: ov, effects: effs, shouldCancel: () => cancelled }).catch(() => {})
    })()
    return () => { cancelled = true }
  }, [placed, itemMeta, hsb, effs, zoom, item.slot])

  if (!placed) return <div className="pb-skel" style={{ width: '70%', height: '70%', borderRadius: 12 }} />
  // 캔버스 intrinsic = box×scale(320×340). CSS 로 늘리지 않고 그대로(1:1) 보여줘 도트가 깨끗하게 유지된다.
  return <canvas ref={ref} style={{ display: 'block', imageRendering: 'pixelated' }} />
}

export default function DyeDialog() {
  const s = useShop()
  const slot = s.dialogSlot
  const item = s.dialogItem // 염색 버튼을 누른 카드의 아이템(착용과 무관하게 이 아이템으로 표시)
  const mix = slot ? s.isMixSlot(slot) : false
  const [meta, setMeta] = useState<ItemMeta | null>(null) // 믹스 그리드용
  const [sel, setSel] = useState<{ base: number; mix: number }>({ base: 0, mix: 0 })
  const [hsb, setHsb] = useState<HsbParams>({ h: 0, s: 0, b: 0, t: 0 }) // 대기 HSB(적용 전)
  const [raw, setRaw] = useState<{ h: string; s: string; b: string }>({ h: '0', s: '0', b: '0' }) // 입력 문자열(빈값 허용)
  const [dyeZoom, setDyeZoom] = useState(1) // 미리보기 배율(1x/2x/3x), 기본 1x
  const maskDownRef = useRef(false) // 마스크에서 press down 했는지(슬라이더 드래그 후 마스크 release 로 닫히는 것 방지)

  // 헤어/성형: 그 카드 아이템 메타 로드 + 현재 발색으로 선택 초기화.
  useEffect(() => {
    if (!slot || !mix || !item) { setMeta(null); return }
    let alive = true
    loadMeta(item.id).then((m) => { if (alive) setMeta(m) }).catch(() => {})
    const cur = s.dyePalette[slot]
    setSel(cur ? { base: cur.baseColor, mix: cur.mixColor ?? cur.baseColor } : { base: 0, mix: 0 })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slot, item?.id, mix])

  // 그 외 아이템: 현재 HSB 발색으로 초기화 + 배율 리셋.
  useEffect(() => {
    if (!slot || mix) return
    const cur = s.dyeHsb[slot] ?? { h: 0, s: 0, b: 0, t: 0 }
    setHsb(cur)
    setRaw({ h: String(cur.h), s: String(cur.s), b: String(cur.b) })
    setDyeZoom(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slot, item?.id, mix])

  // ESC 로 닫기.
  useEffect(() => {
    if (!slot) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') s.closeDye() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slot])

  if (!slot) return null

  const cat = CATS.find((c) => CAT_TO_SLOT[c.id] === slot)
  const title = item?.name || cat?.label || slot
  const closing = s.dialogClosing
  const zmap = s.index?.zmap || []

  const closeStyle = `height:38px; padding:0 18px; border:1px solid ${s.hoverDlgClose ? '#ec86ac' : '#ddd4ca'}; background:#fff; border-radius:8px; font-family:inherit; font-size:13px; font-weight:500; color:${s.hoverDlgClose ? '#ec86ac' : '#5c534b'}; cursor:pointer; transition:border-color .2s ease, color .2s ease;`
  const applyStyle = `height:38px; padding:0 20px; border:none; background:${s.hoverDlgApply ? '#e07ba0' : '#ec86ac'}; border-radius:8px; font-family:inherit; font-size:13px; font-weight:600; color:#fff; cursor:pointer; transition:background .2s ease;`

  // 표에서 보던 그 아이템을 (미착용이면) 착용시키고 색을 커밋.
  const equipIfNeeded = () => { if (cat && item && s.equipped[slot]?.id !== item.id) s.equipFromCat(cat.id, item) }
  const applyMix = () => {
    equipIfNeeded()
    s.setDyePalette((prev) => ({ ...prev, [slot]: { baseColor: sel.base, mixColor: sel.base === sel.mix ? null : sel.mix, ratio: sel.base === sel.mix ? 0 : 50 } }))
    s.closeDye()
  }
  const applyHsbDye = () => {
    equipIfNeeded()
    s.setDyeHsb((prev) => ({ ...prev, [slot]: hsb }))
    s.closeDye()
  }

  // 수치 직접입력(빈값 허용): raw 는 문자열 그대로, hsb 는 빈값=0(중립)으로 반영.
  const setField = (f: 'h' | 's' | 'b') => (val: string) => {
    if (!/^-?\d*$/.test(val)) return
    setRaw((r) => ({ ...r, [f]: val }))
    const n = val === '' || val === '-' ? 0 : clampDye(f, parseInt(val, 10))
    setHsb((h) => ({ ...h, [f]: n }))
  }
  // (0,0,0) 즉시 초기화(색상 계열도 전체로).
  const resetHsb = () => { setHsb({ h: 0, s: 0, b: 0, t: 0 }); setRaw({ h: '0', s: '0', b: '0' }) }

  const numInput = 'width:60px; height:32px; padding:0 8px; border:1px solid #e7ded4; border-radius:8px; background:#faf7f3; font-family:inherit; font-size:13px; text-align:right; color:#3d372f; outline:none;'
  // 미리보기 배율 알약(1x/2x/3x).
  const zoomPill = (on: boolean) => `min-width:34px; height:26px; padding:0 8px; border:1px solid ${on ? '#ec86ac' : '#e7ded4'}; border-radius:7px; cursor:pointer; font-family:inherit; font-size:12px; font-weight:${on ? 700 : 500}; color:${on ? '#fff' : '#8a8075'}; background:${on ? '#ec86ac' : '#fff'}; transition:background .14s ease, color .14s ease, border-color .14s ease;`

  return (
    <div
      onMouseDown={(e) => { maskDownRef.current = e.target === e.currentTarget }}
      onClick={(e) => { if (maskDownRef.current && e.target === e.currentTarget) s.closeDye() }}
      className={closing ? 'pb-overlay-out' : 'pb-overlay'} style={css('position:fixed; inset:0; z-index:60; background:rgba(42,37,33,0.42); display:flex; align-items:center; justify-content:center; padding:32px;')}>
      <div onClick={(e) => e.stopPropagation()} className={closing ? 'pb-panel-out' : 'pb-panel'} style={css(`width:100%; max-width:${mix ? 680 : 760}px; max-height:88vh; background:#fff; border-radius:18px; display:flex; flex-direction:column; overflow:hidden;`)}>
        <div style={css('flex:0 0 auto; height:60px; padding:0 22px; display:flex; align-items:center; justify-content:space-between; border-bottom:1px solid #f0e9e1;')}>
          <div style={css('display:flex; align-items:baseline; gap:10px;')}>
            <span style={css('font-size:16px; font-weight:700; color:#2a2521;')}>{title}</span>
            <span style={css('font-size:12px; color:#a89e93;')}>염색{mix ? ' · 발색' : ''}</span>
          </div>
          <button onClick={s.closeDye} title="닫기 (Esc)" style={css('width:34px; height:34px; border:1px solid #e7ded4; background:#faf7f3; border-radius:8px; cursor:pointer; font-family:inherit; font-size:15px; color:#8a8075; transition:border-color .14s ease, color .14s ease;')}>✕</button>
        </div>

        <div className="pb-scroll" style={css('flex:1 1 auto; min-height:0; overflow:hidden auto; padding:20px 22px;')}>
          {mix ? (
            !meta ? (
              <div style={css('height:220px; display:flex; align-items:center; justify-content:center; color:#b7ada2; font-size:13px;')}>스프라이트 불러오는 중…</div>
            ) : (
              <div>
                <p style={css('margin:0 0 12px; font-size:12px; color:#a89e93; line-height:1.5; text-align:center;')}>세로 = 기본 색, 가로 = 믹스 색 · 각 칸은 실제 발색(대각선 = 단색, 그 외 50:50 믹스). 고른 뒤 <b style={css('color:#d76d9a;')}>적용</b>.</p>
                <div style={css('display:flex; flex-direction:column; align-items:center; gap:6px;')}>
                  <div style={css('display:grid; grid-template-columns:58px repeat(8, 62px); gap:6px; align-items:end;')}>
                    <div />
                    {MIX_PALETTE.map((col) => (
                      <div key={col.hex} style={css('display:flex; flex-direction:column; align-items:center; gap:2px;')}>
                        <span style={css(`width:13px; height:13px; border-radius:50%; background:${col.hex}; border:1px solid rgba(0,0,0,0.1);`)} />
                        <span style={css('font-size:9px; color:#a89e93; white-space:nowrap;')}>{col.name}</span>
                      </div>
                    ))}
                  </div>
                  {MIX_PALETTE.map((rp, r) => (
                    <div key={rp.hex} style={css('display:grid; grid-template-columns:58px repeat(8, 62px); gap:6px; align-items:center;')}>
                      <div style={css('display:flex; align-items:center; justify-content:flex-end; gap:4px;')}>
                        <span style={css(`width:12px; height:12px; border-radius:50%; background:${rp.hex}; border:1px solid rgba(0,0,0,0.1);`)} />
                        <span style={css('font-size:10px; font-weight:600; color:#8a8075; white-space:nowrap;')}>{rp.name}</span>
                      </div>
                      {MIX_PALETTE.map((cp, c) => (
                        <DyeCell key={cp.hex} meta={meta} base={r} mixC={c} zmap={zmap} selected={sel.base === r && sel.mix === c} onClick={() => setSel({ base: r, mix: c })} />
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            )
          ) : (
            <div style={css('display:flex; gap:24px;')}>
              <div style={css('flex:0 0 auto; width:348px; display:flex; flex-direction:column; align-items:center; gap:8px;')}>
                <div style={css('width:348px; height:390px; border-radius:14px; border:1px solid #eee6dc; background:#f7f2ec; display:flex; align-items:center; justify-content:center; overflow:hidden;')}>
                  {item ? <DyeModelPreview item={item} hsb={hsb} zoom={dyeZoom} /> : null}
                </div>
                <div style={css('display:flex; gap:4px;')}>
                  {[1, 2, 3].map((z) => <button key={z} onClick={() => setDyeZoom(z)} style={css(zoomPill(dyeZoom === z))}>{z}x</button>)}
                </div>
              </div>
              <div style={css('flex:1 1 0; min-width:0; display:flex; flex-direction:column; gap:16px;')}>
                <div>
                  <div style={css('font-size:12px; font-weight:600; color:#a89e93; margin-bottom:6px;')}>색상 계열</div>
                  <select value={hsb.t ?? 0} onChange={(e) => setHsb((h) => ({ ...h, t: Number(e.target.value) }))}
                    style={css('width:100%; height:34px; padding:0 10px; border:1px solid #e7ded4; border-radius:8px; background:#faf7f3; font-family:inherit; font-size:13px; color:#3d372f; cursor:pointer; outline:none;')}>
                    {FAMILIES.map((f, i) => <option key={i} value={i}>{f}</option>)}
                  </select>
                </div>
                {([['색조 (Hue)', 'h', 0, 359], ['채도 (Saturation)', 's', -99, 99], ['명도 (Value)', 'b', -99, 99]] as const).map(([label, f, lo, hi]) => (
                  <div key={f}>
                    <div style={css('display:flex; align-items:center; justify-content:space-between; margin-bottom:6px; gap:10px;')}>
                      <span style={css('font-size:12px; font-weight:600; color:#a89e93;')}>{label}</span>
                      <input inputMode="numeric" value={raw[f]} placeholder="0" onChange={(e) => setField(f)(e.target.value)} style={css(numInput)} />
                    </div>
                    <input type="range" min={lo} max={hi} value={hsb[f]} onChange={(e) => setField(f)(e.target.value)} style={css('width:100%; accent-color:#ec86ac; cursor:pointer;')} />
                  </div>
                ))}
                <div style={css('display:flex; align-items:center; justify-content:space-between; gap:10px;')}>
                  <p style={css('margin:0; font-size:11px; color:#b7ada2; line-height:1.5;')}>값을 비우면 0(원본). 색조 0~359, 채도·명도 −99~+99.</p>
                  <button onClick={resetHsb} title="색조·채도·명도를 0으로 초기화" style={css('flex:0 0 auto; height:30px; padding:0 12px; border:1px solid #e7ded4; border-radius:8px; background:#faf7f3; font-family:inherit; font-size:12px; font-weight:600; color:#8a8075; cursor:pointer; transition:border-color .14s ease, color .14s ease;')}>초기화</button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div style={css('flex:0 0 auto; padding:14px 22px; border-top:1px solid #f0e9e1; display:flex; justify-content:flex-end; gap:8px;')}>
          <button onClick={s.closeDye} onMouseEnter={() => s.setHoverDlgClose(true)} onMouseLeave={() => s.setHoverDlgClose(false)} style={css(closeStyle)}>닫기</button>
          <button onClick={mix ? applyMix : applyHsbDye} onMouseEnter={() => s.setHoverDlgApply(true)} onMouseLeave={() => s.setHoverDlgApply(false)} style={css(applyStyle)}>적용</button>
        </div>
      </div>
    </div>
  )
}
