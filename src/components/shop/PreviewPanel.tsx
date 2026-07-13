'use client'

import { PV_ACTION_GROUPS, PV_ACTIONS_FLAT, PV_EARS, PV_EXPRS, PV_FORMS, PV_GAZES, PV_WEAPONS, type Opt, type Pv } from '@/lib/catalog'
import { css, pillStyle, PV_LABEL, ROW_BETWEEN, SEL_STYLE, switchKnob, switchTrack } from '@/lib/style'
import { useShop } from './ShopContext'
import PreviewModel from './PreviewModel'

export default function PreviewPanel() {
  const s = useShop()
  const { pv } = s
  const equippedCount = Object.keys(s.equipped).length
  const curAction = PV_ACTIONS_FLAT.find((a) => a.v === pv.action) || PV_ACTIONS_FLAT[0]
  const pvCaption = `${curAction.l} · ${(PV_EXPRS.find((x) => x.v === pv.expr) || { l: '' }).l}`

  const pvBarStyle = `flex:0 0 auto; width:100%; height:46px; padding:0 22px; border:none; border-top:1px solid #f0e9e1; background:${s.pvOpen ? '#faf7f3' : '#fff'}; display:flex; align-items:center; justify-content:space-between; gap:12px; cursor:pointer; font-family:inherit; transition:background .16s ease;`
  const pvCaretStyle = `font-size:11px; color:#a89e93; transition:transform .2s ease; transform:rotate(${s.pvOpen ? '180deg' : '0deg'}); flex:0 0 auto;`

  const pill = (list: Opt[], key: keyof Pv) =>
    list.map((o) => {
      const sel = pv[key] === o.v
      const hov = s.hoverPill === key + ':' + o.v && !sel
      return (
        <button key={o.v} onClick={() => s.setPv(key, o.v)} onMouseEnter={() => s.setHoverPill(key + ':' + o.v)} onMouseLeave={() => s.setHoverPill(null)} style={css(pillStyle(sel, hov))}>{o.l}</button>
      )
    })

  return (
    <section style={css('flex:0 0 calc(35% - 20px); min-width:0; background:#fff; border:1px solid #e7ded4; border-radius:16px; display:flex; flex-direction:column; overflow:hidden;')}>
      <div style={css('flex:0 0 auto; height:58px; padding:0 22px; display:flex; align-items:center; justify-content:space-between; border-bottom:1px solid #f0e9e1;')}>
        <span style={css('font-size:15px; font-weight:700;')}>코디 미리보기</span>
      </div>
      <div style={css('flex:1 1 40%; min-height:96px; display:flex; align-items:center; justify-content:center; padding:16px; overflow:hidden; position:relative; background:radial-gradient(circle at 50% 42%, #fdf3f7 0%, #f9f5f0 60%);')}>
        <PreviewModel />
      </div>

      <button onClick={() => s.setPvOpen(!s.pvOpen)} style={css(pvBarStyle)}>
        <span style={css('font-size:13px; font-weight:600; color:#5c534b;')}>연출 설정</span>
        <span style={css('display:flex; align-items:center; gap:8px; min-width:0;')}>
          <span style={css('font-size:11px; color:#a89e93; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;')}>{pvCaption}</span>
          <span style={css(pvCaretStyle)}>▾</span>
        </span>
      </button>

      <div className={s.pvOpen ? 'pb-acc pb-acc-open' : 'pb-acc'} style={css('flex:0 0 auto;')}>
        <div>
          <div className="pb-scroll" style={css('max-height:300px; overflow:hidden auto; padding:14px 22px; border-top:1px solid #f0e9e1; display:flex; flex-direction:column; gap:11px;')}>
            <div style={css(ROW_BETWEEN)}>
              <span style={css('font-size:12px; font-weight:600; color:#8a8075; flex:0 0 auto;')}>배율</span>
              <div style={css('display:flex; gap:5px; flex-wrap:wrap; justify-content:flex-end;')}>
                {[1, 2, 3].map((z) => {
                  const sel = pv.zoom === z, hov = s.hoverPill === 'zoom:' + z && !sel
                  return <button key={z} onClick={() => s.setPv('zoom', z)} onMouseEnter={() => s.setHoverPill('zoom:' + z)} onMouseLeave={() => s.setHoverPill(null)} style={css(pillStyle(sel, hov))}>{z}배</button>
                })}
              </div>
            </div>
            <div style={css(ROW_BETWEEN)}>
              <span style={css(PV_LABEL)}>액션</span>
              <select value={pv.action} onChange={(e) => s.setPv('action', e.target.value)} className="pb-select" style={css(SEL_STYLE)}>
                {PV_ACTION_GROUPS.map((g) => (
                  <optgroup key={g.group} label={g.group}>
                    {g.items.map((a) => <option key={a.v} value={a.v}>{a.l}</option>)}
                  </optgroup>
                ))}
              </select>
            </div>
            <div style={css(ROW_BETWEEN)}>
              <span style={css(PV_LABEL)}>무기 모션</span>
              <select value={pv.weapon} onChange={(e) => s.setPv('weapon', e.target.value)} className="pb-select" style={css(SEL_STYLE)}>
                {PV_WEAPONS.map((w) => <option key={w.v} value={w.v}>{w.l}</option>)}
              </select>
            </div>
            <div style={css(ROW_BETWEEN)}>
              <span style={css(PV_LABEL)}>표정</span>
              <select value={pv.expr} onChange={(e) => s.setPv('expr', e.target.value)} className="pb-select" style={css(SEL_STYLE)}>
                {PV_EXPRS.map((x) => <option key={x.v} value={x.v}>{x.l}</option>)}
              </select>
            </div>
            <div style={css(ROW_BETWEEN)}>
              <span style={css(PV_LABEL)}>형상 변이</span>
              <select value={pv.form} onChange={(e) => s.setPv('form', e.target.value)} className="pb-select" style={css(SEL_STYLE)}>
                {PV_FORMS.map((f) => <option key={f.v} value={f.v}>{f.l}</option>)}
              </select>
            </div>
            <div style={css(ROW_BETWEEN)}>
              <span style={css('font-size:12px; font-weight:600; color:#8a8075; flex:0 0 auto;')}>귀</span>
              <div style={css('display:flex; gap:6px; flex-wrap:wrap; justify-content:flex-end;')}>{pill(PV_EARS, 'ear')}</div>
            </div>
            <div style={css(ROW_BETWEEN)}>
              <span style={css('font-size:12px; font-weight:600; color:#8a8075; flex:0 0 auto;')}>시선</span>
              <div style={css('display:flex; gap:6px; justify-content:flex-end;')}>{pill(PV_GAZES, 'gaze')}</div>
            </div>
            <div style={css('height:1px; background:#f0e9e1; margin:2px 0;')} />
            <div style={css('display:flex; align-items:center; justify-content:space-between;')}>
              <span style={css(PV_LABEL)}>무기 이펙트</span>
              <button onClick={() => s.setPv('wEffect', !pv.wEffect)} style={css(switchTrack(pv.wEffect))}><span style={css(switchKnob(pv.wEffect))} /></button>
            </div>
            <div style={css('display:flex; align-items:center; justify-content:space-between;')}>
              <span style={css(PV_LABEL)}>망토 이펙트</span>
              <button onClick={() => s.setPv('cEffect', !pv.cEffect)} style={css(switchTrack(pv.cEffect))}><span style={css(switchKnob(pv.cEffect))} /></button>
            </div>
          </div>
        </div>
      </div>

      <div style={css('flex:0 0 auto; padding:14px 22px; border-top:1px solid #f0e9e1; display:flex; justify-content:space-between; align-items:center;')}>
        <span style={css('font-size:12px; color:#a89e93;')}>착용 아이템 {equippedCount}개</span>
      </div>
    </section>
  )
}
