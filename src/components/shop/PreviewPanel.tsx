'use client'

import { useEffect, useRef, useState } from 'react'
import { PV_ACTION_GROUPS, PV_ACTIONS_FLAT, PV_EARS, PV_EXPRS, PV_FORMS, PV_GAZES, PV_WEAPONS, type Opt, type Pv } from '@/lib/catalog'
import { css, pillStyle, PV_LABEL, ROW_BETWEEN, switchKnob, switchTrack } from '@/lib/style'
import { useShop } from './ShopContext'
import { isStacked } from '@/lib/useBreakpoint'
import PreviewModel from './PreviewModel'
import Dropdown from './Dropdown'

export default function PreviewPanel() {
  const s = useShop()
  const { pv } = s
  const contentHeavy = s.primary === 'info' || s.primary === 'preset' // 정보/프리셋 탭은 내용이 많아 모바일에서 미리보기를 작게
  const curAction = PV_ACTIONS_FLAT.find((a) => a.v === pv.action) || PV_ACTIONS_FLAT[0]
  const pvCaption = `${curAction.l} · ${(PV_EXPRS.find((x) => x.v === pv.expr) || { l: '' }).l}`

  const pvBarStyle = `flex:0 0 auto; width:100%; height:46px; padding:0 22px; border:none; border-top:1px solid #f0e9e1; background:${s.pvOpen ? '#faf7f3' : '#fff'}; display:flex; align-items:center; justify-content:space-between; gap:12px; cursor:pointer; font-family:inherit; transition:background .16s ease;`
  const pvCaretStyle = `font-size:11px; color:#a89e93; transition:transform .2s ease; transform:rotate(${s.pvOpen ? '180deg' : '0deg'}); flex:0 0 auto;`

  const hMobile = s.bp === 'mobile' // 모바일=아이콘만
  const histBtn = (on: boolean) => `display:flex; align-items:center; gap:5px; height:32px; padding:0 ${hMobile ? 9 : 11}px; border-radius:9px; border:1px solid ${on ? '#eeb2ce' : '#efe8e0'}; background:${on ? '#fff' : '#faf7f3'}; color:${on ? '#d76d9a' : '#cabfb4'}; font-family:inherit; font-size:12px; font-weight:600; cursor:${on ? 'pointer' : 'default'}; white-space:nowrap; transition:border-color .14s ease, color .14s ease, background .14s ease;`

  // 핑크빈 코디 평가 말풍선 — 평가가 오면 캐릭터 주변 랜덤 위치에 2~3개를 페이드업→3초 유지→페이드다운.
  const [bubbles, setBubbles] = useState<{ id: number; text: string; top: number; left: number; delay: number }[]>([])
  const bubbleId = useRef(0)
  useEffect(() => {
    const r = s.rateResult
    if (!r || !r.bubbles.length) return
    // 캐릭터(미리보기 중앙)를 피해 "반지(링) 모양"으로 배치 — 중앙엔 안 생기고 주변에 걸치듯. 인덱스별로 원주에 분산.
    const arr = r.bubbles.slice(0, 3)
    const base = Math.random() * Math.PI * 2
    const spawned = arr.map((text, i) => {
      const angle = base + (i / arr.length) * Math.PI * 2 + (Math.random() - 0.5) * 0.7
      const rx = 32 + Math.random() * 10, ry = 28 + Math.random() * 10
      const left = Math.max(2, Math.min(66, 48 + Math.cos(angle) * rx))
      const top = Math.max(3, Math.min(60, 44 + Math.sin(angle) * ry))
      return { id: ++bubbleId.current, text, top, left, delay: i * 1.3 } // 일정 간격으로 천천히 하나씩
    })
    setBubbles((b) => [...b, ...spawned])
    const ids = new Set(spawned.map((x) => x.id))
    const t = setTimeout(() => setBubbles((b) => b.filter((x) => !ids.has(x.id))), 3600 + (spawned.length - 1) * 1300 + 300)
    return () => clearTimeout(t)
  }, [s.rateResult])

  const pill = (list: Opt[], key: keyof Pv) =>
    list.map((o) => {
      const sel = pv[key] === o.v
      const hov = s.hoverPill === key + ':' + o.v && !sel
      return (
        <button key={o.v} onClick={() => s.setPv(key, o.v)} onMouseEnter={() => s.setHoverPill(key + ':' + o.v)} onMouseLeave={() => s.setHoverPill(null)} style={css(pillStyle(sel, hov))}>{o.l}</button>
      )
    })

  return (
    <section style={css(`${isStacked(s.bp) ? 'flex:0 0 ' + (s.bp === 'mobile' ? (contentHeavy ? '34%' : '40%') : (contentHeavy ? '38%' : '44%')) + '; width:100%; min-height:0' : 'flex:0 0 calc(35% - 20px)'}; min-width:0; background:#fff; border:1px solid #e7ded4; border-radius:16px; display:flex; flex-direction:column; overflow:hidden;`)}>
      <div style={css('flex:0 0 auto; height:58px; padding:0 16px 0 22px; display:flex; align-items:center; justify-content:space-between; gap:8px; border-bottom:1px solid #f0e9e1;')}>
        <span style={css('font-size:15px; font-weight:700; flex:0 0 auto;')}>코디 미리보기</span>
        {/* 실행취소/다시실행: 최근 코디 변경(아이템·염색·프리셋 적용 등)을 되돌리거나 다시 적용 */}
        <div style={css('display:flex; align-items:center; gap:6px; flex:0 0 auto;')}>
          <button onClick={s.undo} disabled={!s.canUndo} title="되돌리기 (최근 코디 변경 취소)" aria-label="되돌리기" className="pb-h-ghost" style={css(histBtn(s.canUndo))}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 14 4 9l5-5" /><path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5 5.5 5.5 0 0 1-5.5 5.5H11" /></svg>
            {!hMobile && <span>되돌리기</span>}
          </button>
          <button onClick={s.redo} disabled={!s.canRedo} title="다시실행 (되돌린 변경 재적용)" aria-label="다시실행" className="pb-h-ghost" style={css(histBtn(s.canRedo))}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 14l5-5-5-5" /><path d="M20 9H9.5A5.5 5.5 0 0 0 4 14.5 5.5 5.5 0 0 0 9.5 20H13" /></svg>
            {!hMobile && <span>다시실행</span>}
          </button>
        </div>
      </div>
      <div style={css('flex:1 1 40%; min-height:96px; display:flex; align-items:center; justify-content:center; overflow:hidden; position:relative; background:radial-gradient(circle at 50% 42%, #fdf3f7 0%, #f9f5f0 60%);')}>
        <PreviewModel />
        {bubbles.map((b) => (
          <div key={b.id} className="pb-bubble" style={{ top: `${b.top}%`, left: `${b.left}%`, animation: `pbBubbleFloat 3.6s ease ${b.delay}s both` }}>{b.text}</div>
        ))}
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
                  return <button key={z} onClick={() => s.setPv('zoom', z)} onMouseEnter={() => s.setHoverPill('zoom:' + z)} onMouseLeave={() => s.setHoverPill(null)} style={css(pillStyle(sel, hov))}>{z}x</button>
                })}
              </div>
            </div>
            <div style={css(ROW_BETWEEN)}>
              <span style={css(PV_LABEL)}>무기 모션</span>
              <Dropdown value={pv.weapon} onChange={(v) => s.setPv('weapon', v)} options={PV_WEAPONS} />
            </div>
            <div style={css(ROW_BETWEEN)}>
              <span style={css(PV_LABEL)}>액션</span>
              <Dropdown value={pv.action} onChange={(v) => s.setPv('action', v)} groups={PV_ACTION_GROUPS} />
            </div>
            <div style={css(ROW_BETWEEN)}>
              <span style={css(PV_LABEL)}>표정</span>
              <Dropdown value={pv.expr} onChange={(v) => s.setPv('expr', v)} options={PV_EXPRS} />
            </div>
            <div style={css(ROW_BETWEEN)}>
              <span style={css(PV_LABEL)}>형상 변이</span>
              <Dropdown value={pv.form} onChange={(v) => s.setPv('form', v)} options={PV_FORMS} />
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

    </section>
  )
}
