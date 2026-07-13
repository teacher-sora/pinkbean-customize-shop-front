'use client'

import { CATS, MIX_PALETTE } from '@/lib/catalog'
import { clampDye, defHsv, defMix, hsvColor, mixColor } from '@/lib/color'
import { spriteUrl } from '@/lib/core/data'
import { CAT_TO_SLOT } from '@/lib/shopData'
import { css, swStyle } from '@/lib/style'
import { useShop } from './ShopContext'

export default function InfoScreen() {
  const s = useShop()
  const equippedCount = Object.values(s.equipped).filter(Boolean).length
  const toneName = s.index?.base.tones.find((t) => t.tone === s.tone)?.name || `피부 ${s.tone}`
  const toneBody = s.index?.base.tones.find((t) => t.tone === s.tone)?.body

  const slotList = CATS.map((c) => {
    const slot = CAT_TO_SLOT[c.id]
    const isSkin = c.id === 'skin'
    const item = isSkin ? null : s.equipped[slot]
    const on = isSkin ? true : !!item
    const key = slot
    const isHidden = !isSkin && !!s.hidden[key]
    const selected = s.dyeTarget === key
    const dim = !on || isHidden
    const border = selected ? '2px solid #ec86ac' : on ? (isHidden ? '1px solid #e4dcd2' : '1px solid #f4cfdf') : '1px dashed #e4dcd2'
    const pad = selected ? '8px 10px' : '9px 11px'
    const th = s.hoverToggle === key
    let bd = isHidden ? '#e0d8ce' : '#f4cfdf', bg = isHidden ? '#f2ece5' : '#fce9f1', col = isHidden ? '#a89e93' : '#d76d9a'
    if (th) { bd = isHidden ? '#c3b9ad' : '#ec86ac'; col = isHidden ? '#8a8075' : '#c85d8a' }
    const thumb = isSkin ? (toneBody ? spriteUrl(`sprites/${toneBody}/thumb.png`) : '') : item ? spriteUrl(item.thumb || `sprites/${item.id}/thumb.png`) : ''
    return {
      cat: c, slot, isSkin, on, isHidden,
      label: c.label,
      name: isSkin ? toneName : on ? (isHidden ? '숨김' : item!.name || item!.id) : '미착용',
      thumb,
      canHide: on && !isSkin,
      cardStyle: `display:flex; align-items:center; gap:10px; padding:${pad}; border-radius:11px; min-width:0; cursor:${on ? 'pointer' : 'default'}; border:${border}; background:${isHidden ? '#f6f2ec' : on ? '#fdf4f8' : '#fbf8f4'}; transition:background .14s ease, border-color .14s ease, opacity .14s ease; opacity:${isHidden ? 0.6 : 1};`,
      thumbStyle: `flex:0 0 auto; width:42px; height:42px; border-radius:8px; display:flex; align-items:center; justify-content:center; overflow:hidden; background:${on && !isHidden ? '#fff' : '#f4efe8'}; ${isHidden ? 'filter:grayscale(1);' : ''}`,
      nameStyle: `font-size:12px; font-weight:${on && !isHidden ? 600 : 500}; color:${dim ? '#c3b9ad' : '#2a2521'}; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin-top:2px;`,
      toggleLabel: isHidden ? '숨김' : '표시',
      toggleStyle: `flex:0 0 auto; height:24px; padding:0 9px; border-radius:20px; border:1px solid ${bd}; background:${bg}; color:${col}; font-family:inherit; font-size:10px; font-weight:600; cursor:pointer; transition:background .2s ease, color .2s ease, border-color .2s ease;`,
    }
  })

  // 하단 염색 패널 대상(slot)
  const target = s.dyeTarget
  const dyeInfo = (() => {
    if (!target) return null
    const cat = CATS.find((c) => CAT_TO_SLOT[c.id] === target)
    const mixMode = s.isMixSlot(target)
    const dirty = mixMode ? !!s.dyeMix[target] : !!s.dyeHsv[target]
    const slotLabel = cat?.label || target
    const eq = s.equipped[target]
    const name = eq?.name || slotLabel
    const resetStyle = `height:28px; padding:0 12px; border-radius:8px; font-family:inherit; font-size:11px; font-weight:600; cursor:${dirty ? 'pointer' : 'default'}; border:1px solid ${dirty ? '#e7ded4' : '#efe8e0'}; background:${dirty ? '#faf7f3' : '#fbf8f4'}; color:${dirty ? '#5c534b' : '#c3b9ad'}; transition:border-color .14s ease, color .14s ease, background .14s ease;`
    if (mixMode) return { mixMode: true as const, slotLabel, name, resetStyle, key: target, m: s.dyeMix[target] || defMix() }
    return { mixMode: false as const, slotLabel, name, resetStyle, key: target, hv: s.dyeHsv[target] || defHsv() }
  })()

  const hsvDisp = (key: string, f: string, num: number) => (s.dyeEdit[key + ':' + f] !== undefined ? s.dyeEdit[key + ':' + f] : String(num))
  const hsvOnNum = (key: string, f: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value
    s.setDyeEdit((prev) => ({ ...prev, [key + ':' + f]: raw }))
    const pv = parseInt(raw, 10)
    if (raw !== '' && !isNaN(pv)) s.setDyeHsv((prev) => ({ ...prev, [key]: { ...(prev[key] || defHsv()), [f]: clampDye(f, pv) } }))
  }
  const hsvOnBlur = (key: string, f: string) => () => s.setDyeEdit((prev) => { const e = { ...prev }; delete e[key + ':' + f]; return e })
  const hsvOnRange = (key: string, f: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = clampDye(f, parseInt(e.target.value, 10))
    s.setDyeEdit((prev) => { const ed = { ...prev }; delete ed[key + ':' + f]; return ed })
    s.setDyeHsv((prev) => ({ ...prev, [key]: { ...(prev[key] || defHsv()), [f]: v } }))
  }

  return (
    <section style={css('flex:0 0 65%; min-width:0; background:#fff; border:1px solid #e7ded4; border-radius:16px; display:flex; flex-direction:column; overflow:hidden;')}>
      <div style={css('flex:0 0 auto; height:58px; padding:0 22px; display:flex; align-items:center; gap:14px; border-bottom:1px solid #f0e9e1;')}>
        <span style={css('font-size:15px; font-weight:700;')}>코디 정보 · 염색</span>
      </div>

      <div style={css('flex:1 1 auto; min-height:0; display:flex; flex-direction:column;')}>
        <div style={css('flex:3 1 0; min-height:0; display:flex; flex-direction:column; padding:16px 22px 14px;')}>
          <div style={css('flex:0 0 auto; display:flex; align-items:center; justify-content:space-between; margin-bottom:12px;')}>
            <span style={css('font-size:13px; font-weight:700; color:#2a2521;')}>코디 정보</span>
            <span style={css('font-size:12px; color:#a89e93;')}>착용 {equippedCount} / {slotList.length}</span>
          </div>
          <div className="pb-scroll" style={css('flex:1 1 auto; min-height:0; overflow:hidden auto;')}>
            <div style={css('display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:10px;')}>
              {slotList.map((sl) => (
                <div key={sl.cat.id} onClick={() => { if (sl.on) s.setDyeTarget(sl.slot) }} style={css(sl.cardStyle)}>
                  <div style={css(sl.thumbStyle)}>
                    {sl.thumb && <img src={sl.thumb} alt="" onError={(e) => { e.currentTarget.style.visibility = 'hidden' }} style={{ maxWidth: '100%', maxHeight: '100%', imageRendering: 'pixelated', objectFit: 'contain' }} />}
                  </div>
                  <div style={css('flex:1 1 0; min-width:0;')}>
                    <div style={css('font-size:11px; font-weight:600; color:#a89e93;')}>{sl.label}</div>
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

        <div style={css('flex:2 1 0; min-height:0; display:flex; flex-direction:column; padding:16px 22px 18px;')}>
          <div style={css('flex:0 0 auto; display:flex; align-items:center; justify-content:space-between; margin-bottom:12px;')}>
            <span style={css('font-size:13px; font-weight:700; color:#2a2521;')}>염색</span>
            {dyeInfo && (
              <button onClick={() => {
                const k = dyeInfo.key
                if (dyeInfo.mixMode) { s.setDyeMix((prev) => { const d = { ...prev }; delete d[k]; return d }); s.setDyeEdit((prev) => { const e = { ...prev }; delete e[k + ':ratio']; return e }) }
                else { s.setDyeHsv((prev) => { const d = { ...prev }; delete d[k]; return d }); s.setDyeEdit((prev) => { const e = { ...prev };['h', 's', 'v'].forEach((f) => delete e[k + ':' + f]); return e }) }
              }} style={css(dyeInfo.resetStyle)}>수치 초기화</button>
            )}
          </div>
          {dyeInfo ? (
            <div style={css('flex:1 1 auto; min-height:0; display:flex; gap:16px;')}>
              <div style={css('flex:0 0 auto; display:flex; flex-direction:column; align-items:center; gap:8px; width:120px;')}>
                <div style={css(`width:88px; height:88px; border-radius:12px; border:1px solid #eee6dc; background:${dyeInfo.mixMode ? mixColor(dyeInfo.m.a, dyeInfo.m.b, dyeInfo.m.ratio) : hsvColor(dyeInfo.hv.h, dyeInfo.hv.s, dyeInfo.hv.v)};`)} />
                <div style={css('text-align:center;')}>
                  <div style={css('font-size:11px; font-weight:600; color:#a89e93;')}>{dyeInfo.slotLabel}</div>
                  <div style={css('font-size:12px; font-weight:600; color:#2a2521; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:120px;')}>{dyeInfo.name}</div>
                </div>
              </div>
              <div className="pb-scroll" style={css('flex:1 1 0; min-width:0; overflow:hidden auto; padding-right:2px; display:flex; flex-direction:column; gap:14px;')}>
                {dyeInfo.mixMode ? (
                  <>
                    <div>
                      <div style={css('font-size:11px; font-weight:600; color:#a89e93; margin-bottom:8px;')}>색상 A</div>
                      <div style={css('display:flex; flex-wrap:wrap; gap:8px;')}>
                        {MIX_PALETTE.map((sw) => (
                          <button key={sw.hex} title={sw.name} onClick={() => s.setDyeMix((prev) => ({ ...prev, [dyeInfo.key]: { ...(prev[dyeInfo.key] || defMix()), a: sw.hex } }))} style={css(swStyle(sw.hex, dyeInfo.m.a === sw.hex))} />
                        ))}
                      </div>
                    </div>
                    <div>
                      <div style={css('font-size:11px; font-weight:600; color:#a89e93; margin-bottom:8px;')}>색상 B</div>
                      <div style={css('display:flex; flex-wrap:wrap; gap:8px;')}>
                        {MIX_PALETTE.map((sw) => (
                          <button key={sw.hex} title={sw.name} onClick={() => s.setDyeMix((prev) => ({ ...prev, [dyeInfo.key]: { ...(prev[dyeInfo.key] || defMix()), b: sw.hex } }))} style={css(swStyle(sw.hex, dyeInfo.m.b === sw.hex))} />
                        ))}
                      </div>
                    </div>
                    <div>
                      <div style={css('display:flex; align-items:center; justify-content:space-between; margin-bottom:6px;')}>
                        <span style={css('font-size:11px; font-weight:600; color:#a89e93;')}>혼합 비율</span>
                        <div style={css('display:flex; align-items:center; gap:4px;')}>
                          <input type="number" min={0} max={100}
                            value={s.dyeEdit[dyeInfo.key + ':ratio'] !== undefined ? s.dyeEdit[dyeInfo.key + ':ratio'] : String(dyeInfo.m.ratio)}
                            onChange={(e) => { const raw = e.target.value; s.setDyeEdit((prev) => ({ ...prev, [dyeInfo.key + ':ratio']: raw })); const pv = parseInt(raw, 10); if (raw !== '' && !isNaN(pv)) s.setDyeMix((prev) => ({ ...prev, [dyeInfo.key]: { ...(prev[dyeInfo.key] || defMix()), ratio: Math.max(0, Math.min(100, pv)) } })) }}
                            onBlur={() => s.setDyeEdit((prev) => { const e = { ...prev }; delete e[dyeInfo.key + ':ratio']; return e })}
                            style={css('width:52px; height:26px; padding:0 6px; border:1px solid #e7ded4; border-radius:6px; background:#faf7f3; font-family:inherit; font-size:12px; font-weight:600; text-align:right; color:#d76d9a; outline:none;')} />
                          <span style={css('font-size:11px; color:#a89e93;')}>%</span>
                        </div>
                      </div>
                      <input type="range" min={0} max={100} value={dyeInfo.m.ratio}
                        onChange={(e) => { const v = Math.max(0, Math.min(100, parseInt(e.target.value, 10) || 0)); s.setDyeEdit((prev) => { const ed = { ...prev }; delete ed[dyeInfo.key + ':ratio']; return ed }); s.setDyeMix((prev) => ({ ...prev, [dyeInfo.key]: { ...(prev[dyeInfo.key] || defMix()), ratio: v } })) }}
                        style={css('width:100%; accent-color:#ec86ac; cursor:pointer;')} />
                      <div style={css('display:flex; align-items:center; justify-content:space-between; margin-top:4px;')}>
                        <div style={css('display:flex; align-items:center; gap:6px;')}><span style={css(`width:12px; height:12px; border-radius:50%; background:${dyeInfo.m.a};`)} /><span style={css('font-size:10px; color:#a89e93;')}>A</span></div>
                        <div style={css('display:flex; align-items:center; gap:6px;')}><span style={css('font-size:10px; color:#a89e93;')}>B</span><span style={css(`width:12px; height:12px; border-radius:50%; background:${dyeInfo.m.b};`)} /></div>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    {([['색조 (Hue)', 'h', 0, 359], ['채도 (Saturation)', 's', -99, 99], ['명도 (Value)', 'v', -99, 99]] as const).map(([label, f, lo, hi]) => (
                      <div key={f}>
                        <div style={css('display:flex; align-items:center; justify-content:space-between; margin-bottom:6px;')}>
                          <span style={css('font-size:11px; font-weight:600; color:#a89e93;')}>{label}</span>
                          <input type="number" min={lo} max={hi} value={hsvDisp(dyeInfo.key, f, (dyeInfo.hv as any)[f])} onChange={hsvOnNum(dyeInfo.key, f)} onBlur={hsvOnBlur(dyeInfo.key, f)}
                            style={css('width:52px; height:26px; padding:0 6px; border:1px solid #e7ded4; border-radius:6px; background:#faf7f3; font-family:inherit; font-size:12px; font-weight:600; text-align:right; color:#5c534b; outline:none;')} />
                        </div>
                        <input type="range" min={lo} max={hi} value={(dyeInfo.hv as any)[f]} onChange={hsvOnRange(dyeInfo.key, f)} style={css('width:100%; cursor:pointer; accent-color:#ec86ac;')} />
                      </div>
                    ))}
                  </>
                )}
              </div>
            </div>
          ) : (
            <div style={css('flex:1 1 auto; min-height:0; border:1px dashed #e4dcd2; border-radius:12px; background:#fbf8f4; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:6px;')}>
              <span style={css('font-size:13px; font-weight:600; color:#8a8075;')}>염색할 아이템을 선택하세요</span>
              <span style={css('font-size:12px; color:#b7ada2;')}>위 코디 정보에서 착용된 부위를 클릭하면 여기서 염색할 수 있어요.</span>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
