'use client'

import { CATS, MIX_PALETTE } from '@/lib/catalog'
import { clampDye, defHsv, defMix, hsvColor, isMixCat, itemTone, mixColorTone } from '@/lib/color'
import { css } from '@/lib/style'
import { useShop } from './ShopContext'

export default function DyeDialog() {
  const s = useShop()
  const dk = s.dialogKey
  if (!dk) return null

  const dcid = dk.split('-')[0], didx = parseInt(dk.split('-')[1], 10)
  const dcat = CATS.find((c) => c.id === dcid)
  const title = `${dcat ? dcat.label : ''} 아이템 ${didx + 1}`
  const closing = s.dialogClosing
  const equipHere = () =>
    s.setEquipped((prev) => {
      const eq = { ...prev }
      Object.keys(eq).forEach((k) => { if (k.startsWith(dcid + '-')) delete eq[k] })
      eq[dk] = true
      return eq
    })
  const onApply = () => { equipHere(); s.closeDye() }
  const mix = isMixCat(dcid)

  const closeStyle = `height:38px; padding:0 18px; border:1px solid ${s.hoverDlgClose ? '#ec86ac' : '#ddd4ca'}; background:#fff; border-radius:8px; font-family:inherit; font-size:13px; font-weight:500; color:${s.hoverDlgClose ? '#ec86ac' : '#5c534b'}; cursor:pointer; transition:border-color .2s ease, color .2s ease;`
  const applyStyle = `height:38px; padding:0 20px; border:none; background:${s.hoverDlgApply ? '#e07ba0' : '#ec86ac'}; border-radius:8px; font-family:inherit; font-size:13px; font-weight:600; color:#fff; cursor:pointer; transition:background .2s ease;`

  const m = s.dyeMix[dk] || defMix()
  const tone = itemTone(didx)
  const hv = s.dyeHsv[dk] || defHsv()
  const setH = (f: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = clampDye(f, parseInt(e.target.value, 10))
    s.setDyeHsv((prev) => ({ ...prev, [dk]: { ...(prev[dk] || defHsv()), [f]: v } }))
  }

  return (
    <div onClick={s.closeDye} className={closing ? 'pb-overlay-out' : 'pb-overlay'} style={css('position:fixed; inset:0; z-index:60; background:rgba(42,37,33,0.42); display:flex; align-items:center; justify-content:center; padding:32px;')}>
      <div onClick={(e) => e.stopPropagation()} className={closing ? 'pb-panel-out' : 'pb-panel'} style={css('width:100%; max-width:720px; max-height:88vh; background:#fff; border-radius:18px; display:flex; flex-direction:column; overflow:hidden;')}>
        <div style={css('flex:0 0 auto; height:60px; padding:0 22px; display:flex; align-items:center; justify-content:space-between; border-bottom:1px solid #f0e9e1;')}>
          <div style={css('display:flex; align-items:baseline; gap:10px;')}>
            <span style={css('font-size:16px; font-weight:700; color:#2a2521;')}>{title}</span>
            <span style={css('font-size:12px; color:#a89e93;')}>염색</span>
          </div>
          <button onClick={s.closeDye} style={css('width:34px; height:34px; border:1px solid #e7ded4; background:#faf7f3; border-radius:8px; cursor:pointer; font-family:inherit; font-size:15px; color:#8a8075; transition:border-color .14s ease, color .14s ease;')}>✕</button>
        </div>

        <div className="pb-scroll" style={css('flex:1 1 auto; min-height:0; overflow:hidden auto; padding:20px 22px;')}>
          {mix ? (
            <div style={css('display:flex; gap:22px;')}>
              <div style={css('flex:0 0 auto; display:flex; flex-direction:column; align-items:center; gap:10px; width:120px;')}>
                <div style={css(`width:120px; height:120px; border-radius:14px; border:1px solid #eee6dc; background:${mixColorTone(m.a, m.b, m.ratio, tone)};`)} />
                <span style={css('font-size:11px; color:#b7ada2; text-align:center;')}>50 : 50 미리보기</span>
              </div>
              <div style={css('flex:1 1 0; min-width:0; overflow-x:auto;')}>
                <div style={css('display:flex; gap:6px; margin-bottom:6px;')}>
                  <div style={css('flex:0 0 66px;')} />
                  <div style={css('flex:1 1 0; display:grid; grid-template-columns:repeat(8,1fr); gap:6px;')}>
                    {MIX_PALETTE.map((col) => (
                      <div key={col.hex} style={css('display:flex; flex-direction:column; align-items:center; gap:3px;')}>
                        <span style={css(`width:14px; height:14px; border-radius:50%; background:${col.hex}; border:1px solid rgba(0,0,0,0.1);`)} />
                        <span style={css('font-size:9px; color:#a89e93;')}>{col.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
                {MIX_PALETTE.map((rp) => (
                  <div key={rp.hex} style={css('display:flex; gap:6px; align-items:center; margin-bottom:6px;')}>
                    <div style={css('flex:0 0 66px; display:flex; align-items:center; gap:5px;')}>
                      <span style={css(`width:14px; height:14px; border-radius:50%; background:${rp.hex}; border:1px solid rgba(0,0,0,0.1);`)} />
                      <span style={css('font-size:10px; font-weight:600; color:#8a8075;')}>{rp.name}</span>
                    </div>
                    <div style={css('flex:1 1 0; display:grid; grid-template-columns:repeat(8,1fr); gap:6px;')}>
                      {MIX_PALETTE.map((cp) => {
                        const sel = m.a === rp.hex && m.b === cp.hex
                        return <button key={cp.hex} onClick={() => s.setDyeMix((prev) => ({ ...prev, [dk]: { a: rp.hex, b: cp.hex, ratio: 50 } }))}
                          style={css(`width:100%; aspect-ratio:1/1; border-radius:7px; cursor:pointer; padding:0; background:${mixColorTone(rp.hex, cp.hex, 50, tone)}; border:2px solid ${sel ? '#ec86ac' : 'rgba(0,0,0,0.06)'}; transition:transform .1s ease;`)} />
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={css('display:flex; gap:22px;')}>
              <div style={css('flex:0 0 auto; display:flex; flex-direction:column; align-items:center; gap:10px; width:120px;')}>
                <div style={css(`width:120px; height:120px; border-radius:14px; border:1px solid #eee6dc; background:${hsvColor(hv.h, hv.s, hv.v)};`)} />
                <span style={css('font-size:12px; font-weight:600; color:#2a2521;')}>{dcat ? dcat.label : ''}</span>
              </div>
              <div style={css('flex:1 1 0; min-width:0; display:flex; flex-direction:column; gap:16px;')}>
                {([['색조 (Hue)', 'h', 0, 359, String(hv.h)], ['채도 (Saturation)', 's', -99, 99, (hv.s > 0 ? '+' : '') + hv.s], ['명도 (Value)', 'v', -99, 99, (hv.v > 0 ? '+' : '') + hv.v]] as const).map(([label, f, lo, hi, disp]) => (
                  <div key={f}>
                    <div style={css('display:flex; align-items:center; justify-content:space-between; margin-bottom:6px;')}>
                      <span style={css('font-size:12px; font-weight:600; color:#a89e93;')}>{label}</span>
                      <span style={css('font-size:12px; font-weight:600; color:#5c534b;')}>{disp}</span>
                    </div>
                    <input type="range" min={lo} max={hi} value={(hv as any)[f]} onChange={setH(f)} style={css('width:100%; accent-color:#ec86ac; cursor:pointer;')} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div style={css('flex:0 0 auto; padding:14px 22px; border-top:1px solid #f0e9e1; display:flex; justify-content:flex-end; gap:8px;')}>
          <button onClick={s.closeDye} onMouseEnter={() => s.setHoverDlgClose(true)} onMouseLeave={() => s.setHoverDlgClose(false)} style={css(closeStyle)}>닫기</button>
          <button onClick={onApply} onMouseEnter={() => s.setHoverDlgApply(true)} onMouseLeave={() => s.setHoverDlgApply(false)} style={css(applyStyle)}>착용 · 적용</button>
        </div>
      </div>
    </div>
  )
}
