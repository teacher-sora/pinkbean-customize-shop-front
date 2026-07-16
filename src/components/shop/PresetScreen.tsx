'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { assemble, getFrameLayers, type AssembleInput, type PlacedLayer } from '@/lib/core/assemble'
import { loadEffect, loadEffectIndex, loadMeta, type ItemMeta } from '@/lib/core/data'
import { applyHsb, buildOverrides } from '@/lib/core/dye'
import { computeModelPlacement } from '@/lib/core/modelPlacement'
import { effectDraws, loadImage, renderCharacter, type EffectDraw } from '@/lib/core/render'
import { CARD_FRACTION, CARD_MARGIN, THUMB_VIEW, isColorLineSkin } from '@/lib/shopData'
import { isStacked } from '@/lib/useBreakpoint'
import { css } from '@/lib/style'
import { useShop, type Snapshot } from './ShopContext'

// 프리셋 카드 썸네일: 스냅샷(착용+톤+염색)을 실제 모델로 합성해 카드에 중앙 배치(코디/미리보기와 동일한
// computeModelPlacement 규칙). 정지 프레임(stand1) + 염색 + 이펙트(망토 등) 반영 → 이펙트만 있는 망토도 구분된다.
function PresetThumb({ snap }: { snap: Snapshot }) {
  const { index } = useShop()
  const [placed, setPlaced] = useState<PlacedLayer[] | null>(null)
  const [ov, setOv] = useState<Map<string, HTMLCanvasElement>>(new Map())
  const [effects, setEffects] = useState<EffectDraw[]>([])
  const [dims, setDims] = useState<{ w: number; h: number; dpr: number }>({ w: 0, h: 0, dpr: 1 })
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const key = useMemo(() => JSON.stringify(snap), [snap]) // 스냅샷 변하면 재합성

  useEffect(() => {
    if (!index) return
    let alive = true
    setPlaced(null)
    ;(async () => {
      const te = index.base.tones.find((t) => t.tone === snap.tone) || index.base.tones[0]
      if (!te) return
      const [bodyMeta, headMeta] = await Promise.all([loadMeta(te.body), loadMeta(te.head)])
      const equipMetas: { slot: string; meta: ItemMeta }[] = []
      for (const [slot, id] of Object.entries(snap.equipped)) {
        if (snap.hidden?.[slot] || !id) continue
        const m = await loadMeta(id).catch(() => null)
        if (m) equipMetas.push({ slot, meta: m })
      }
      if (!alive) return
      const items: AssembleInput[] = [
        { itemId: bodyMeta.id, slot: 'body', vslot: null, layers: getFrameLayers(bodyMeta, THUMB_VIEW) },
        { itemId: headMeta.id, slot: 'head', vslot: null, layers: getFrameLayers(headMeta, THUMB_VIEW) },
        // name 은 투명 아이템 판별에 쓰인다 — 없으면 투명 모자/장식이 헤어·얼굴을 가려 구멍이 생긴다.
        ...equipMetas.map(({ slot, meta }) => ({ itemId: meta.id, slot, vslot: meta.vslot ?? null, layers: getFrameLayers(meta, THUMB_VIEW), invisibleFace: meta.invisibleFace, name: meta.name })),
      ]
      const { placed: p, anchors } = assemble(items, index.zmap, index.smap)
      // 염색: 착용 아이템(팔레트/HSB) + 컬러라인 피부 라인. (옛 프리셋엔 dye 키가 없을 수 있어 방어)
      const overrides = await buildOverrides(equipMetas.map((e) => e.meta), { palette: snap.dyePalette || {}, hsb: snap.dyeHsb || {} }, THUMB_VIEW)
      const skinHsb = (snap.dyeHsb || {})['skin']
      if (skinHsb && (skinHsb.h || skinHsb.s || skinHsb.b) && isColorLineSkin(te.name)) {
        for (const meta of [bodyMeta, headMeta]) for (const l of getFrameLayers(meta, THUMB_VIEW)) {
          try { overrides.set(l.png, applyHsb(await loadImage(l.png, true), skinHsb, l.png)) } catch (_) {}
        }
      }
      // 이펙트(망토 등 ItemEff): 착용 아이템의 이펙트를 정지 프레임0으로 합성 → 이펙트만 있는 망토도 카드에서 구분된다.
      const curBody = p.find((pl) => pl.slot === 'body' && pl.name === 'body')
      const bnav = curBody?.map?.navel
      const foot = { x: bnav ? -bnav.x : 8, y: bnav ? -bnav.y : 21 }
      const brow = anchors.brow ? { x: anchors.brow.x, y: anchors.brow.y } : foot
      const effIdx = await loadEffectIndex().catch(() => new Set<string>())
      const effDraws: EffectDraw[] = []
      for (const { meta } of equipMetas) {
        if (!effIdx.has(String(parseInt(meta.id, 10)))) continue
        const em = await loadEffect(meta.id).catch(() => null)
        if (em) effDraws.push(...effectDraws(em, THUMB_VIEW.action, { foot, brow }, 0))
      }
      if (alive) { setPlaced(p); setOv(overrides); setEffects(effDraws) }
    })().catch(() => {})
    return () => { alive = false }
  }, [key, index])

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const measure = () => {
      const w = el.clientWidth, h = el.clientHeight, dpr = window.devicePixelRatio || 1
      if (w > 0 && h > 0) setDims((d) => (d.w === w && d.h === h && d.dpr === dpr ? d : { w, h, dpr }))
    }
    measure()
    const ro = new ResizeObserver(measure); ro.observe(el)
    window.addEventListener('resize', measure)
    return () => { ro.disconnect(); window.removeEventListener('resize', measure) }
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !placed || !dims.w || !dims.h) return
    let cancelled = false
    const p = computeModelPlacement({ divW: dims.w, divH: dims.h, dpr: dims.dpr, margin: CARD_MARGIN, fraction: CARD_FRACTION, snap: true })
    canvas.style.width = p.canvasCssW + 'px'
    canvas.style.height = p.canvasCssH + 'px'
    renderCharacter(canvas, placed, { scale: p.scale, box: p.box, anchor: p.anchor, override: ov, effects, shouldCancel: () => cancelled }).catch(() => {})
    return () => { cancelled = true }
  }, [placed, ov, effects, dims])

  return (
    <div ref={wrapRef} style={{ position: 'absolute', inset: 0 }}>
      {!placed && <div className="pb-skel" style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', width: '58%', height: '58%', borderRadius: 8 }} />}
      <canvas ref={canvasRef} style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%) translateZ(0)', imageRendering: 'pixelated', display: 'block', backfaceVisibility: 'hidden' }} />
    </div>
  )
}

export default function PresetScreen() {
  const s = useShop()
  // 라이브 모델 → Snapshot(선택된 카드가 이걸로 그려진다). 자동저장(100ms)을 기다리지 않고 즉시 반영.
  const liveSnap: Snapshot = useMemo(() => {
    const eq: Record<string, string> = {}
    for (const [slot, it] of Object.entries(s.equipped)) if (it) eq[slot] = it.id
    return { equipped: eq, tone: s.tone, dyePalette: s.dyePalette, dyeHsb: s.dyeHsb, hidden: s.hidden }
  }, [s.equipped, s.tone, s.dyePalette, s.dyeHsb, s.hidden])

  return (
    <section style={css(`${isStacked(s.bp) ? 'flex:1 1 auto; width:100%' : 'flex:0 0 65%'}; min-width:0; min-height:0; background:#fff; border:1px solid #e7ded4; border-radius:16px; display:flex; flex-direction:column; overflow:hidden;`)}>
      <div style={css('flex:0 0 auto; height:58px; padding:0 22px; display:flex; align-items:center; gap:14px; border-bottom:1px solid #f0e9e1;')}>
        <span style={css('font-size:15px; font-weight:700;')}>프리셋</span>
        <span style={css('font-size:12px; color:#a89e93;')}>변경 시 선택한 프리셋에 자동 저장 · 새로고침해도 유지</span>
      </div>

      <div style={css('flex:1 1 auto; min-height:0; display:flex; flex-direction:column;')}>
        {/* 불러오기 바(코드/닉네임) */}
        <div style={css('flex:0 0 auto; padding:16px 22px; display:flex; flex-direction:column; gap:10px;')}>
          <div style={css('display:flex; align-items:center; gap:6px;')}>
            {(['nick', 'code'] as const).map((mode) => {
              const isSel = s.importMode === mode
              const th = s.hoverMode === mode && !isSel
              const bd = isSel ? '#ec86ac' : th ? '#eeb2ce' : '#e7ded4'
              const col = isSel || th ? '#d76d9a' : '#8a8075'
              return (
                <button key={mode} onClick={() => s.setImportMode(mode)} onMouseEnter={() => s.setHoverMode(mode)} onMouseLeave={() => s.setHoverMode(null)}
                  style={css(`height:34px; padding:0 12px; border-radius:8px; cursor:pointer; font-family:inherit; font-size:12px; font-weight:${isSel ? 600 : 500}; border:1px solid ${bd}; background:${isSel ? '#fce9f1' : '#fff'}; color:${col}; transition:background .26s ease, border-color .26s ease, color .26s ease;`)}>{mode === 'code' ? '공유 코드' : '닉네임'}</button>
              )
            })}
            <span style={css('font-size:11px; color:#b7ada2; margin-left:2px;')}>{s.importMode === 'code' ? '불러온 코디는 선택한 프리셋에 덮어써져요' : '메이플 닉네임의 캐시 코디를 선택한 프리셋에 불러와요'}</span>
          </div>
          <div style={css('display:flex; align-items:center; gap:10px;')}>
            <input value={s.nickInput} onChange={(e) => s.setNickInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') s.importFetch() }} disabled={s.importing}
              placeholder={s.importMode === 'code' ? '코디 공유 코드 붙여넣기 (PB1…)' : '캐릭터 닉네임 입력'}
              style={css(`flex:1 1 0; min-width:0; height:38px; padding:0 14px; border:1px solid #e7ded4; border-radius:9px; background:#faf7f3; font-family:inherit; font-size:13px; outline:none; transition:border-color .14s ease; opacity:${s.importing ? 0.6 : 1};`)} />
            <button onClick={s.importFetch} disabled={s.importing} className="pb-h-solid" style={css(`flex:0 0 auto; height:38px; min-width:96px; padding:0 18px; display:flex; align-items:center; justify-content:center; gap:8px; border:none; background:linear-gradient(100deg,#ec86ac,#b57bdb); border-radius:9px; font-family:inherit; font-size:13px; font-weight:600; color:#fff; cursor:${s.importing ? 'default' : 'pointer'}; opacity:${s.importing ? 0.85 : 1}; transition:filter .15s ease, transform .15s ease;`)}>
              {s.importing ? (<><span className="pb-spin" />불러오는 중…</>) : '불러오기'}
            </button>
          </div>
        </div>
        <div style={css('flex:0 0 auto; height:1px; margin:0 22px; background:#f0e9e1;')} />

        {/* 프리셋 그리드 */}
        <div className="pb-scroll pb-scroll-thin" style={css('flex:1 1 auto; min-height:0; overflow:hidden auto; padding:18px 22px;')}>
          <div style={css(`display:grid; grid-template-columns:repeat(${s.bp === 'pc' ? 5 : s.bp === 'half' ? 4 : s.bp === 'tablet' ? 3 : 2},minmax(0,1fr)); gap:12px;`)}>
            {s.presets.map((p) => {
              const on = s.selectedPreset === p.id
              // 선택된 프리셋 카드는 저장본(자동저장 100ms 뒤 반영) 대신 **라이브 모델을 그대로** 그린다.
              // → 염색·착용을 바꾸는 즉시 카드에 반영되고, 우측 미리보기와 100% 같은 모습이 된다.
              const snap = on ? liveSnap : s.presetData[p.id]
              const editing = s.editingPreset === p.id
              return (
                <div key={p.id} className="pb-presetwrap">
                  <div onClick={() => s.selectPreset(p.id)} className="pb-preset" style={css(on ? 'border-color:#ec86ac; background:#fdf4f8; transform:translateY(-5px);' : '')}>
                    <div style={css('position:relative; width:100%; aspect-ratio:3/4; overflow:hidden; background:#f7f2ec; border-radius:12px 12px 0 0;')}>
                      {snap && <PresetThumb snap={snap} />}
                      <span style={css(`position:absolute; top:8px; left:8px; display:inline-flex; align-items:center; gap:4px; height:20px; padding:0 9px; border-radius:20px; background:rgba(255,255,255,0.92); color:#d76d9a; border:1px solid #f4cfdf; font-size:10px; font-weight:600; pointer-events:none; box-shadow:0 2px 8px rgba(214,109,154,.18); transition:opacity .22s ease, transform .22s ease; opacity:${on ? 1 : 0}; transform:translateY(${on ? '0' : '-6px'});`)}>선택됨</span>
                      {/* 액션(초기화·공유) — 카드 호버 시 표시(pb-preset-acts). 초기화(왼쪽)=빨간 휴지통(위험), 공유(오른쪽) */}
                      <div className="pb-preset-acts" style={css('position:absolute; top:7px; right:7px; display:flex; gap:5px;')}>
                        <button onClick={(e) => { e.stopPropagation(); s.resetPreset(p.id) }} title="기본값으로 초기화" style={css('display:flex; align-items:center; justify-content:center; width:26px; height:26px; border:none; border-radius:7px; background:rgba(255,255,255,0.92); cursor:pointer; box-shadow:0 1px 4px rgba(42,37,33,.12);')}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="#e0533e"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" /></svg>
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); s.sharePreset(p) }} title="공유 코드 복사" style={css('width:26px; height:26px; border:none; border-radius:7px; background:rgba(255,255,255,0.92); color:#8a8075; font-family:inherit; font-size:12px; cursor:pointer; box-shadow:0 1px 4px rgba(42,37,33,.12);')}>↗</button>
                      </div>
                    </div>
                    <div style={css('padding:10px 11px 11px;')}>
                      {editing ? (
                        <input autoFocus value={s.editName} onChange={(e) => s.setEditName(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur() } else if (e.key === 'Escape') { s.setEditingPreset(null); s.setEditName('') } }}
                          onBlur={s.commitRename} onClick={(e) => e.stopPropagation()}
                          style={css('width:100%; height:28px; padding:0 8px; border:1.5px solid #ec86ac; border-radius:7px; background:#fff; font-family:inherit; font-size:13px; font-weight:600; color:#2a2521; outline:none;')} />
                      ) : (
                        // 이름 = 클릭하면 바로 변경(연필 아이콘으로 명확히). 카드 선택과 분리(stopPropagation).
                        <button onClick={(e) => s.startRename(p.id, p.name, e)} title="클릭해서 이름 변경" className="pb-preset-name"
                          style={css('display:flex; align-items:center; gap:6px; width:100%; height:28px; padding:0 8px; border:1px solid #f0e9e1; background:#faf7f3; border-radius:7px; cursor:text; text-align:left; font-family:inherit; transition:background .14s ease, border-color .14s ease;')}>
                          <span style={css('flex:1 1 0; font-size:13px; font-weight:600; color:#2a2521; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; min-width:0;')}>{p.name}</span>
                          <span style={css('flex:0 0 auto; color:#c3b9ad; font-size:12px;')}>✎</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}
