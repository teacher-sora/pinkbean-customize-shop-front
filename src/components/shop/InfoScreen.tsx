'use client'

import { useEffect, useRef, useState } from 'react'
import { CATS, MIX_PALETTE } from '@/lib/catalog'
import { clampDye } from '@/lib/color'
import { assemble, getFrameLayers, type AssembleInput, type PlacedLayer } from '@/lib/core/assemble'
import { loadMeta, type ItemMeta } from '@/lib/core/data'
import { applyHsb, renderDyedSprite, type HsbParams, type PaletteParams } from '@/lib/core/dye'
import { computeModelPlacement } from '@/lib/core/modelPlacement'
import { loadImage, renderCharacter } from '@/lib/core/render'
import { CAT_TO_SLOT, THUMB_VIEW, isColorLineSkin } from '@/lib/shopData'
import { isStacked } from '@/lib/useBreakpoint'
import { css, swStyle } from '@/lib/style'
import { useShop } from './ShopContext'
import { useLiveRedraw } from './useLiveRedraw'

// 다이얼로그 염색과 동일한 색상 계열 목록(Prism type 0~6).
const FAMILIES = ['전체 색상 계열', '빨간 색상 계열', '노란 색상 계열', '초록 색상 계열', '청록 색상 계열', '파란 색상 계열', '자주 색상 계열']
const defPal = (): PaletteParams => ({ baseColor: 0, mixColor: null, ratio: 50 }) // 믹스 기본 비율 50%
const defHsbP = (): HsbParams => ({ h: 0, s: 0, b: 0, t: 0 })
const hsbActive = (h?: HsbParams) => !!h && (h.h !== 0 || h.s !== 0 || h.b !== 0)

// 채움 비율(스프라이트가 캔버스에서 차지할 큰-변 비율). 원본이 커도 넘치지 않게 맞추고, ≥1배는 정수 스냅으로
// 선명(하드 도트), 축소(<1배)만 부드럽게. 헤어는 합성 bbox 가 커서 "확대 배율"을 안정적으로 더 줄이고, 피부(전신)는
// 조금 키운다. (이 값들은 오직 코디 정보 아이콘에만 쓰이고, 코디 탭/발색표에는 영향 없음.)
const INFO_FRAC = 0.82
const INFO_FRAC_HAIR = 0.55
// 피부는 모델(body+head)로 렌더해 중앙 정렬 — fraction 으로 크기 조절(아이콘=작게, 미리보기=크게).
const SKIN_ICON_FRACTION = 0.72
const SKIN_PREVIEW_FRACTION = 0.52
function drawSprite(canvas: HTMLCanvasElement, src: CanvasImageSource, w: number, h: number, size: number, frac = INFO_FRAC) {
  canvas.width = size; canvas.height = size
  const ctx = canvas.getContext('2d'); if (!ctx) return
  ctx.clearRect(0, 0, size, size)
  if (!w || !h) return
  const avail = size * frac
  let k = Math.min(avail / w, avail / h)
  if (k >= 1) { k = Math.max(1, Math.min(Math.round(k), Math.floor(Math.min(size / w, size / h)) || 1)); ctx.imageSmoothingEnabled = false }
  else ctx.imageSmoothingEnabled = true // 원본이 큰 경우(피부 전신 등) 분수 축소(부드럽게)
  const dw = Math.round(w * k), dh = Math.round(h * k)
  ctx.drawImage(src, Math.round((size - dw) / 2), Math.round((size - dh) / 2), dw, dh)
}

// 아이템 "스프라이트"(발색 반영) — 아이콘/미리보기 공용. 절대 모델 착용 베이크(thumb.png)를 쓰지 않는다.
//  - 헤어/성형(mix): renderDyedSprite 로 모든 부위 합성 + 팔레트 발색(frac 지정 → 넘침 없이 안정 축소).
//  - 그 외(HSB): 아이템 인벤 스프라이트(sprites/{id}/icon.png)에 Prism HSB 를 적용해 그린다(몸 없이 아이템만).
function DyeSprite({ id, thumb, mix, palette, hsb, zmap, grayscale = false, frac = INFO_FRAC }: {
  id: string; thumb?: string | null; mix: boolean; palette?: PaletteParams; hsb?: HsbParams; zmap: string[]; grayscale?: boolean; frac?: number
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  const [meta, setMeta] = useState<ItemMeta | null>(null)
  useEffect(() => {
    if (!mix) { setMeta(null); return }
    let a = true
    loadMeta(id).then((m) => { if (a) setMeta(m) }).catch(() => {})
    return () => { a = false }
  }, [id, mix])
  // 드래그 중에도 렉 없이 바로바로 발색(single-flight + 최신값 수렴).
  useLiveRedraw(async () => {
    const el = ref.current; if (!el) return
    const dev = Math.round((el.clientWidth || 48) * (window.devicePixelRatio || 1))
    if (mix) {
      if (!meta) return
      const base = palette?.baseColor ?? 0, mixC = palette?.mixColor ?? base, ratio = palette?.ratio ?? 0
      await renderDyedSprite(el, meta, base, mixC, base === mixC ? 0 : ratio, THUMB_VIEW, zmap, dev, frac)
    } else {
      const rel = thumb || `sprites/${id}/icon.png` // 아이템 스프라이트(모델 베이크 아님)
      const active = hsbActive(hsb)
      const img = await loadImage(rel, active)
      const src: CanvasImageSource = active ? applyHsb(img, hsb!, rel) : img
      drawSprite(el, src, (src as HTMLCanvasElement).width, (src as HTMLCanvasElement).height, dev, frac)
    }
  }, [meta, id, thumb, mix, palette, hsb, zmap, frac])
  return <canvas ref={ref} style={{ width: '100%', height: '100%', imageRendering: 'pixelated', ...(grayscale ? { filter: 'grayscale(1)' } : {}) }} />
}

// 피부 모델: 코디 탭과 동일한 computeModelPlacement 로 body+head(피부 자체)를 마네킹 중심 기준 중앙에 배치해
// 렌더(드로우 bbox 중앙이 아니라 마네킹 중심 → 오른쪽 치우침 없이 제대로 중앙 정렬). 라인만 HSB 로 염색.
// box(표시 정사각 크기)/fraction(마네킹 높이 비율)로 아이콘(작게)·미리보기(크게) 공용.
function SkinModel({ bodyId, headId, hsb, dyeable, zmap, smap, box, fraction }: {
  bodyId: string; headId: string; hsb: HsbParams; dyeable: boolean; zmap: string[]; smap: Record<string, string>; box: number; fraction: number
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  const [placed, setPlaced] = useState<PlacedLayer[] | null>(null)
  useEffect(() => {
    let alive = true
    ;(async () => {
      const [body, head] = await Promise.all([loadMeta(bodyId), loadMeta(headId)])
      if (!alive) return
      const items: AssembleInput[] = [
        { itemId: body.id, slot: 'body', vslot: null, layers: getFrameLayers(body, THUMB_VIEW) },
        { itemId: head.id, slot: 'head', vslot: null, layers: getFrameLayers(head, THUMB_VIEW) },
      ]
      const { placed: p } = assemble(items, zmap, smap)
      if (alive) setPlaced(p)
    })().catch(() => {})
    return () => { alive = false }
  }, [bodyId, headId, zmap, smap])
  useLiveRedraw(async () => {
    const canvas = ref.current; if (!canvas || !placed) return
    const ov = new Map<string, HTMLCanvasElement>()
    const active = dyeable && hsbActive(hsb)
    if (active) for (const p of placed) { try { ov.set(p.png, applyHsb(await loadImage(p.png, true), hsb, p.png)) } catch (_) {} }
    const dpr = window.devicePixelRatio || 1
    const pl = computeModelPlacement({ divW: box, divH: box, dpr, margin: 1, fraction, snap: true })
    canvas.style.width = pl.canvasCssW + 'px'
    canvas.style.height = pl.canvasCssH + 'px'
    await renderCharacter(canvas, placed, { scale: pl.scale, box: pl.box, anchor: pl.anchor, override: ov })
  }, [placed, hsb, dyeable, box, fraction])
  if (!placed) return <div className="pb-skel" style={{ width: '60%', height: '60%', borderRadius: 10 }} />
  return <canvas ref={ref} style={{ display: 'block', imageRendering: 'pixelated' }} />
}

export default function InfoScreen() {
  const s = useShop()
  const dyeMobile = s.bp === 'mobile' // 모바일: 염색 미리보기 축소 등
  const zmap = s.index?.zmap || []
  const smap = s.index?.smap || {}
  const equippedCount = Object.values(s.equipped).filter(Boolean).length
  const toneEntry = s.index?.base.tones.find((t) => t.tone === s.tone)
  const toneName = toneEntry?.name || `피부 ${s.tone}`
  const toneBody = toneEntry?.body

  const slotList = CATS.map((c) => {
    const slot = CAT_TO_SLOT[c.id]
    const isSkin = c.id === 'skin'
    const isMix = s.isMixSlot(slot) // 헤어/성형만 믹스
    const item = isSkin ? null : s.equipped[slot]
    const on = isSkin ? true : !!item
    const isHidden = !isSkin && !!s.hidden[slot]
    const selected = s.dyeTarget === slot
    const dim = !on || isHidden
    const border = selected ? '2px solid #ec86ac' : on ? (isHidden ? '1px solid #e4dcd2' : '1px solid #f4cfdf') : '1px dashed #e4dcd2'
    const pad = selected ? '8px 10px' : '9px 11px'
    const th = s.hoverToggle === slot
    let bd = isHidden ? '#e0d8ce' : '#f4cfdf', bg = isHidden ? '#f2ece5' : '#fce9f1', col = isHidden ? '#a89e93' : '#d76d9a'
    if (th) { bd = isHidden ? '#c3b9ad' : '#ec86ac'; col = isHidden ? '#8a8075' : '#c85d8a' }
    // 아이콘 = 아이템 "스프라이트"(상대경로). 모델 착용 베이크(thumb.png)는 절대 쓰지 않는다.
    //  - 피부: 톤 body 스프라이트(피부 자체). 그 외: 아이템 인벤 스프라이트(icon.png).
    const spriteId = isSkin ? toneBody : item?.id
    const iconRel = isSkin ? (toneBody ? `sprites/${toneBody}/thumb.png` : '') : item ? (item.icon || `sprites/${item.id}/icon.png`) : ''
    // 이 부위가 실제로 염색되었는지(렌더에 반영되는 기준과 동일): 믹스=기본색(0)에서 벗어났거나 블렌드 사용,
    // HSB=색조·채도·명도 중 하나라도 0 이 아님.
    let dyed = false
    if (isMix) { const p = s.dyePalette[slot]; dyed = !!p && (p.baseColor !== 0 || (p.mixColor != null && p.ratio > 0)) }
    else { const h = s.dyeHsb[slot]; dyed = !!h && (h.h !== 0 || h.s !== 0 || h.b !== 0) }
    return {
      cat: c, slot, isSkin, isMix, item, on, isHidden, spriteId, iconRel, dyed,
      label: c.label,
      name: isSkin ? toneName : on ? (isHidden ? '숨김' : item!.name || item!.id) : '미착용',
      canHide: on && !isSkin,
      cardStyle: `display:flex; align-items:center; gap:10px; padding:${pad}; border-radius:11px; min-width:0; cursor:${on ? 'pointer' : 'default'}; border:${border}; background:${isHidden ? '#f6f2ec' : on ? '#fdf4f8' : '#fbf8f4'}; transition:background .14s ease, border-color .14s ease, opacity .14s ease; opacity:${isHidden ? 0.6 : 1};`,
      thumbStyle: `flex:0 0 auto; width:42px; height:42px; border-radius:8px; display:flex; align-items:center; justify-content:center; overflow:hidden; background:${on && !isHidden ? '#fff' : '#f4efe8'};`,
      nameStyle: `font-size:12px; font-weight:${on && !isHidden ? 600 : 500}; color:${dim ? '#c3b9ad' : '#2a2521'}; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin-top:2px;`,
      toggleLabel: isHidden ? '숨김' : '표시',
      toggleStyle: `flex:0 0 auto; height:24px; padding:0 9px; border-radius:20px; border:1px solid ${bd}; background:${bg}; color:${col}; font-family:inherit; font-size:10px; font-weight:600; cursor:pointer; transition:background .2s ease, color .2s ease, border-color .2s ease;`,
    }
  })

  // ── 하단 염색 패널 대상(slot) ── 다이얼로그와 동일: 헤어/성형=믹스(dyePalette), 그 외=HSB(dyeHsb).
  const target = s.dyeTarget
  const targetCat = target ? CATS.find((c) => CAT_TO_SLOT[c.id] === target) : null
  const mixMode = target ? s.isMixSlot(target) : false
  const isSkinTarget = target === 'skin'
  const eqItem = target && !isSkinTarget ? s.equipped[target] : null
  const pal = (target && s.dyePalette[target]) || defPal()
  const hsbP = (target && s.dyeHsb[target]) || defHsbP()
  const dirty = target ? (mixMode ? !!s.dyePalette[target] : !!s.dyeHsb[target]) : false
  // 미리보기/발색 대상: 피부=현재 톤 body(라인 있는 스프라이트), 그 외=착용 아이템의 "스프라이트"(icon).
  // ⚠️ HSB 는 스프라이트 전체를 리컬러하므로, 모델 착용 베이크(body 포함)가 아니라 아이템 단독 스프라이트를 써야
  // 몸까지 물들지 않는다.
  const previewId = isSkinTarget ? toneBody : eqItem?.id
  const previewThumb = isSkinTarget ? (toneBody ? `sprites/${toneBody}/thumb.png` : undefined) : (eqItem ? (eqItem.icon || `sprites/${eqItem.id}/icon.png`) : undefined)
  const skinDyeable = isSkinTarget ? isColorLineSkin(toneName) : true // 피부는 컬러라인 커스텀만
  const slotLabel = targetCat?.label || target || ''
  const dyeName = isSkinTarget ? toneName : eqItem?.name || slotLabel

  const resetStyle = `height:28px; padding:0 12px; border-radius:8px; font-family:inherit; font-size:11px; font-weight:600; cursor:${dirty ? 'pointer' : 'default'}; border:1px solid ${dirty ? '#e7ded4' : '#efe8e0'}; background:${dirty ? '#faf7f3' : '#fbf8f4'}; color:${dirty ? '#5c534b' : '#c3b9ad'}; transition:border-color .14s ease, color .14s ease, background .14s ease;`
  const numInput = 'width:52px; height:26px; padding:0 6px; border:1px solid #e7ded4; border-radius:6px; background:#faf7f3; font-family:inherit; font-size:12px; font-weight:600; text-align:right; outline:none;'

  const resetDye = () => {
    if (!target) return
    if (mixMode) {
      s.setDyePalette((p) => { const d = { ...p }; delete d[target]; return d })
      s.setDyeEdit((e) => { const n = { ...e }; delete n[target + ':ratio']; return n })
    } else {
      s.setDyeHsb((p) => { const d = { ...p }; delete d[target]; return d })
      s.setDyeEdit((e) => { const n = { ...e };['h', 's', 'b'].forEach((f) => delete n[target + ':' + f]); return n })
    }
  }
  // 믹스(팔레트) 설정: A(baseColor)/B(mixColor)/ratio 는 항상 독립. A 를 바꿀 때 B(현재 표시값)를 명시적으로
  // 고정해, A===B 상태에서 A 만 바꿔도 B 가 따라오지 않게 한다(커플링 제거).
  const setBase = (i: number) => s.setDyePalette((p) => { const cur = p[target!] || defPal(); return { ...p, [target!]: { baseColor: i, mixColor: cur.mixColor ?? cur.baseColor, ratio: cur.ratio } } })
  const setMixC = (i: number) => s.setDyePalette((p) => { const cur = p[target!] || defPal(); return { ...p, [target!]: { ...cur, mixColor: i } } })
  const setRatio = (v: number) => s.setDyePalette((p) => { const cur = p[target!] || defPal(); return { ...p, [target!]: { ...cur, ratio: Math.max(0, Math.min(100, v)) } } })
  // HSB 설정(다이얼로그와 동일). dyeEdit 로 입력 중 문자열 버퍼 유지(빈값 허용).
  const hsbDisp = (f: string, num: number) => (target && s.dyeEdit[target + ':' + f] !== undefined ? s.dyeEdit[target + ':' + f] : String(num))
  const hsbSetNum = (f: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value
    s.setDyeEdit((prev) => ({ ...prev, [target! + ':' + f]: raw }))
    const pv = parseInt(raw, 10)
    if (raw !== '' && !isNaN(pv)) s.setDyeHsb((prev) => ({ ...prev, [target!]: { ...(prev[target!] || defHsbP()), [f]: clampDye(f, pv) } }))
  }
  const hsbBlur = (f: string) => () => s.setDyeEdit((prev) => { const e = { ...prev }; delete e[target! + ':' + f]; return e })
  const hsbSetRange = (f: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = clampDye(f, parseInt(e.target.value, 10))
    s.setDyeEdit((prev) => { const ed = { ...prev }; delete ed[target! + ':' + f]; return ed })
    s.setDyeHsb((prev) => ({ ...prev, [target!]: { ...(prev[target!] || defHsbP()), [f]: v } }))
  }
  const setFamily = (t: number) => s.setDyeHsb((prev) => ({ ...prev, [target!]: { ...(prev[target!] || defHsbP()), t } }))
  // 슬라이더 드래그 동안 우측 미리보기 애니메이션을 잠시 정지(발색 리컬러에 리소스 몰아줌 → 렉 방지). 릴리즈 시 해제.
  const beginDrag = () => {
    s.setDyeInteracting(true)
    const end = () => { s.setDyeInteracting(false); window.removeEventListener('pointerup', end); window.removeEventListener('pointercancel', end) }
    window.addEventListener('pointerup', end)
    window.addEventListener('pointercancel', end)
  }

  const ratioDisp = target && s.dyeEdit[target + ':ratio'] !== undefined ? s.dyeEdit[target + ':ratio'] : String(pal.ratio)

  return (
    <section style={css(`${isStacked(s.bp) ? 'flex:1 1 auto; width:100%' : 'flex:0 0 65%'}; min-width:0; min-height:0; background:#fff; border:1px solid #e7ded4; border-radius:16px; display:flex; flex-direction:column; overflow:hidden;`)}>
      <div style={css('flex:0 0 auto; height:58px; padding:0 22px; display:flex; align-items:center; gap:14px; border-bottom:1px solid #f0e9e1;')}>
        <span style={css('font-size:15px; font-weight:700;')}>코디 정보 · 염색</span>
      </div>

      <div style={css('flex:1 1 auto; min-height:0; display:flex; flex-direction:column;')}>
        <div style={css(`flex:${dyeMobile ? 2 : 3} 1 0; min-height:0; display:flex; flex-direction:column; padding:${dyeMobile ? '12px 14px 8px' : '16px 22px 14px'};`)}>
          <div style={css('flex:0 0 auto; display:flex; align-items:center; justify-content:space-between; margin-bottom:12px;')}>
            <span style={css('font-size:13px; font-weight:700; color:#2a2521;')}>코디 정보</span>
            <span style={css('font-size:12px; color:#a89e93;')}>착용 {equippedCount} / {slotList.length}</span>
          </div>
          <div className="pb-scroll" style={css('flex:1 1 auto; min-height:0; overflow:hidden auto;')}>
            <div style={css(`display:grid; grid-template-columns:repeat(${s.bp === 'mobile' ? 2 : s.bp === 'tablet' ? 3 : 4},minmax(0,1fr)); gap:10px;`)}>
              {slotList.map((sl) => (
                <div key={sl.cat.id} onClick={() => { if (sl.on) s.setDyeTarget(sl.slot) }} style={css(sl.cardStyle)}>
                  <div style={css('position:relative; flex:0 0 auto;')}>
                    <div style={css(sl.thumbStyle)}>
                      {/* 아이콘은 아이템 생김새(스프라이트)만. 헤어/성형은 모든 부위 합성(발색표와 동일). */}
                      {sl.isSkin ? (
                        sl.spriteId && toneEntry?.head ? (
                          <SkinModel bodyId={sl.spriteId} headId={toneEntry.head} hsb={s.dyeHsb['skin'] || defHsbP()} dyeable={isColorLineSkin(toneName)} zmap={zmap} smap={smap} box={42} fraction={SKIN_ICON_FRACTION} />
                        ) : null
                      ) : sl.isMix && sl.item ? (
                        <DyeSprite id={sl.item.id} mix palette={s.dyePalette[sl.slot]} zmap={zmap} grayscale={sl.isHidden} frac={sl.slot === 'hair' ? INFO_FRAC_HAIR : INFO_FRAC} />
                      ) : sl.spriteId ? (
                        <DyeSprite id={sl.spriteId} thumb={sl.iconRel} mix={false} zmap={zmap} grayscale={sl.isHidden} frac={INFO_FRAC} />
                      ) : null}
                    </div>
                    {/* 염색됨 표시 = 썸네일 코너의 은은한 무지개 도트. 믹스(헤어·성형)는 기본이 색 선택이라 표시 생략. */}
                    {sl.dyed && !sl.isMix && (
                      <span title="염색됨" aria-label="염색됨" style={css('position:absolute; right:-3px; bottom:-3px; width:14px; height:14px; border-radius:50%; border:2px solid #fff; background:conic-gradient(from 90deg, #ff8fb0, #ffd36b, #7fd88a, #6bb8ff, #c79bff, #ff8fb0); box-shadow:0 1px 3px rgba(0,0,0,.18);')} />
                    )}
                  </div>
                  <div style={css('flex:1 1 0; min-width:0;')}>
                    <span style={css('font-size:11px; font-weight:600; color:#a89e93;')}>{sl.label}</span>
                    <div style={css(sl.nameStyle)}>{sl.name}</div>
                  </div>
                  {sl.canHide && (
                    <button onClick={(e) => { e.stopPropagation(); s.setHidden((h) => { const n = { ...h }; if (n[sl.slot]) delete n[sl.slot]; else n[sl.slot] = true; return n }) }}
                      onMouseEnter={() => s.setHoverToggle(sl.slot)} onMouseLeave={() => s.setHoverToggle(null)} title="미리보기 표시/숨김" style={css(sl.toggleStyle)}>{sl.toggleLabel}</button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={css('flex:0 0 auto; height:1px; margin:0 22px; background:#efe8e0;')} />

        <div style={css(`flex:${dyeMobile ? 3 : 2} 1 0; min-height:0; display:flex; flex-direction:column; padding:${dyeMobile ? '10px 14px 12px' : '16px 22px 18px'};`)}>
          <div style={css(`flex:0 0 auto; display:flex; align-items:center; gap:8px; justify-content:space-between; margin-bottom:${dyeMobile ? 8 : 12}px;`)}>
            <span style={css('font-size:13px; font-weight:700; color:#2a2521; flex:0 0 auto;')}>염색{target ? (mixMode ? ' · 발색' : ' · HSB') : ''}</span>
            {dyeMobile && target && <span style={css('font-size:12px; font-weight:600; color:#8a8075; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; text-align:right;')}>{slotLabel} · {dyeName}</span>}
          </div>

          {!target ? (
            <div style={css('flex:1 1 auto; min-height:0; border:1px dashed #e4dcd2; border-radius:12px; background:#fbf8f4; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:6px;')}>
              <span style={css('font-size:13px; font-weight:600; color:#8a8075;')}>염색할 아이템을 선택하세요</span>
              <span style={css('font-size:12px; color:#b7ada2;')}>위 코디 정보에서 착용된 부위를 클릭하면 여기서 염색할 수 있어요.</span>
            </div>
          ) : (
            <div style={css(`flex:1 1 auto; min-height:0; display:flex; gap:${dyeMobile ? 0 : 16}px;`)}>
              {/* 미리보기(발색 반영). 모바일은 상단 미리보기 패널이 발색을 실시간 반영하므로 숨겨 컨트롤에 전체폭 양보 */}
              <div style={css(`${dyeMobile ? 'display:none;' : 'display:flex;'} flex:0 0 auto; flex-direction:column; align-items:center; gap:8px; width:120px;`)}>
                <div style={css(`width:${dyeMobile ? 74 : 96}px; height:${dyeMobile ? 74 : 96}px; border-radius:12px; border:1px solid #eee6dc; background:#f7f2ec; display:flex; align-items:center; justify-content:center; overflow:hidden;`)}>
                  {isSkinTarget ? (
                    previewId && toneEntry?.head ? (
                      <SkinModel key={target} bodyId={previewId} headId={toneEntry.head} hsb={hsbP} dyeable={skinDyeable} zmap={zmap} smap={smap} box={dyeMobile ? 74 : 96} fraction={SKIN_PREVIEW_FRACTION} />
                    ) : (
                      <span style={css('font-size:11px; color:#c3b9ad; text-align:center; padding:0 6px;')}>미리보기 없음</span>
                    )
                  ) : previewId ? (
                    // 미리보기는 정상 크기(INFO_FRAC). 확대 배율 축소는 코디 정보 아이콘에만 적용.
                    <DyeSprite key={target} id={previewId} thumb={previewThumb} mix={mixMode} palette={pal} hsb={hsbP} zmap={zmap} frac={INFO_FRAC} />
                  ) : (
                    <span style={css('font-size:11px; color:#c3b9ad; text-align:center; padding:0 6px;')}>미리보기 없음</span>
                  )}
                </div>
                <div style={css('text-align:center;')}>
                  <div style={css('font-size:11px; font-weight:600; color:#a89e93;')}>{slotLabel}</div>
                  <div style={css('font-size:12px; font-weight:600; color:#2a2521; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:120px;')}>{dyeName}</div>
                </div>
              </div>

              <div className="pb-scroll" style={css(`flex:1 1 0; min-width:0; overflow:hidden auto; padding-right:2px; display:flex; flex-direction:column; gap:${dyeMobile ? 12 : 10}px;`)}>
                {isSkinTarget && !skinDyeable ? (
                  <div style={css('flex:1 1 auto; display:flex; align-items:center; justify-content:center; text-align:center; color:#b7ada2; font-size:12px; line-height:1.6; padding:12px;')}>
                    이 피부는 염색할 수 없어요.<br />&quot;컬러라인&quot; 커스텀 피부만 라인 염색이 가능합니다.
                  </div>
                ) : mixMode ? (
                  <>
                    <div>
                      <div style={css('font-size:11px; font-weight:600; color:#a89e93; margin-bottom:8px;')}>색상 A</div>
                      <div style={css('display:flex; flex-wrap:wrap; gap:8px;')}>
                        {MIX_PALETTE.map((sw, i) => (
                          <button key={sw.hex} title={sw.name} onClick={() => setBase(i)} style={css(swStyle(sw.hex, pal.baseColor === i))} />
                        ))}
                      </div>
                    </div>
                    <div>
                      <div style={css('font-size:11px; font-weight:600; color:#a89e93; margin-bottom:8px;')}>색상 B</div>
                      <div style={css('display:flex; flex-wrap:wrap; gap:8px;')}>
                        {MIX_PALETTE.map((sw, i) => (
                          <button key={sw.hex} title={sw.name} onClick={() => setMixC(i)} style={css(swStyle(sw.hex, (pal.mixColor ?? pal.baseColor) === i))} />
                        ))}
                      </div>
                    </div>
                    <div>
                      <div style={css('display:flex; align-items:center; justify-content:space-between; margin-bottom:6px;')}>
                        <span style={css('font-size:11px; font-weight:600; color:#a89e93;')}>혼합 비율 (A ↔ B)</span>
                        <div style={css('display:flex; align-items:center; gap:4px;')}>
                          <input inputMode="numeric" value={ratioDisp}
                            onChange={(e) => { const raw = e.target.value; s.setDyeEdit((prev) => ({ ...prev, [target + ':ratio']: raw })); const pv = parseInt(raw, 10); if (raw !== '' && !isNaN(pv)) setRatio(pv) }}
                            onBlur={() => s.setDyeEdit((prev) => { const e = { ...prev }; delete e[target + ':ratio']; return e })}
                            style={css(numInput + 'color:#d76d9a;')} />
                          <span style={css('font-size:11px; color:#a89e93;')}>%</span>
                        </div>
                      </div>
                      <input type="range" min={0} max={100} value={pal.ratio} onPointerDown={beginDrag} onChange={(e) => setRatio(parseInt(e.target.value, 10) || 0)} style={css('width:100%; accent-color:#ec86ac; cursor:pointer;')} />
                      <div style={css('display:flex; align-items:center; justify-content:space-between; margin-top:4px;')}>
                        <div style={css('display:flex; align-items:center; gap:6px;')}><span style={css(`width:12px; height:12px; border-radius:50%; background:${MIX_PALETTE[pal.baseColor]?.hex};`)} /><span style={css('font-size:10px; color:#a89e93;')}>A {100 - pal.ratio}%</span></div>
                        <div style={css('display:flex; align-items:center; gap:6px;')}><span style={css('font-size:10px; color:#a89e93;')}>B {pal.ratio}%</span><span style={css(`width:12px; height:12px; border-radius:50%; background:${MIX_PALETTE[pal.mixColor ?? pal.baseColor]?.hex};`)} /></div>
                      </div>
                    </div>
                  </>
                ) : (
                  // 한 줄 레이아웃(라벨 | 슬라이더 | 입력)으로 압축 → 세로 넘침(스크롤) 방지.
                  <>
                    <div style={css('display:flex; align-items:center; gap:10px;')}>
                      <span style={css('flex:0 0 46px; font-size:11px; font-weight:600; color:#a89e93;')}>계열</span>
                      <select value={hsbP.t ?? 0} onChange={(e) => setFamily(Number(e.target.value))}
                        style={css('flex:1 1 0; min-width:0; height:30px; padding:0 10px; border:1px solid #e7ded4; border-radius:8px; background:#faf7f3; font-family:inherit; font-size:12px; color:#3d372f; cursor:pointer; outline:none;')}>
                        {FAMILIES.map((f, i) => <option key={i} value={i}>{f}</option>)}
                      </select>
                    </div>
                    {([['색조', 'h', 0, 359], ['채도', 's', -99, 99], ['명도', 'b', -99, 99]] as const).map(([label, f, lo, hi]) => (
                      <div key={f} style={css('display:flex; align-items:center; gap:10px;')}>
                        <span style={css('flex:0 0 46px; font-size:11px; font-weight:600; color:#a89e93;')}>{label}</span>
                        <input type="range" min={lo} max={hi} value={(hsbP as unknown as Record<string, number>)[f]} onPointerDown={beginDrag} onChange={hsbSetRange(f)} style={css('flex:1 1 0; min-width:0; cursor:pointer; accent-color:#ec86ac;')} />
                        <input inputMode="numeric" value={hsbDisp(f, (hsbP as unknown as Record<string, number>)[f])} placeholder="0" onChange={hsbSetNum(f)} onBlur={hsbBlur(f)} style={css(numInput + 'flex:0 0 auto; color:#5c534b;')} />
                      </div>
                    ))}
                  </>
                )}
              </div>
            </div>
          )}
          {/* 다이얼로그 염색처럼 발색표 보기 · 수치 초기화를 우측 하단에 배치. */}
          {target && (
            <div style={css('flex:0 0 auto; display:flex; justify-content:flex-end; align-items:center; gap:8px; padding-top:10px;')}>
              {mixMode && eqItem && (
                <button onClick={() => s.openDye(target, eqItem)} title="발색표(8×8)를 열어 조합을 눈으로 고르기"
                  style={css('height:28px; padding:0 12px; border-radius:8px; border:1px solid #f4cfdf; background:#fce9f1; color:#d76d9a; font-family:inherit; font-size:11px; font-weight:600; cursor:pointer; transition:background .14s ease, border-color .14s ease;')}>염색표 보기</button>
              )}
              <button onClick={resetDye} style={css(resetStyle)}>수치 초기화</button>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
