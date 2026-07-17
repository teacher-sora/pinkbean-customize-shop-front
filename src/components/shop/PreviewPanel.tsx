'use client'

import { useEffect, useRef, useState } from 'react'
import { PV_ACTION_GROUPS, PV_ACTIONS_FLAT, PV_EARS, PV_EXPRS, PV_FORMS, PV_GAZES, PV_WEAPONS, type Opt, type Pv } from '@/lib/catalog'
import { css, pillStyle, PV_LABEL, ROW_BETWEEN, switchKnob, switchTrack } from '@/lib/style'
import { useShop } from './ShopContext'
import { MOBILE_H, isStacked } from '@/lib/useBreakpoint'
import PreviewModel from './PreviewModel'
import Dropdown from './Dropdown'

export default function PreviewPanel() {
  const s = useShop()
  const { pv } = s
  const contentHeavy = s.primary === 'info' || s.primary === 'preset' // 정보/프리셋 탭은 내용이 많아 모바일에서 미리보기를 작게
  // 세로 스택(태블릿 포함) = 고정 높이 패널 → 아코디언이 잘린다. 바텀시트/여백 절약 규칙을 여기 전부 건다.
  const mob = isStacked(s.bp)
  const curAction = PV_ACTIONS_FLAT.find((a) => a.v === pv.action) || PV_ACTIONS_FLAT[0]
  const pvCaption = `${curAction.l} · ${(PV_EXPRS.find((x) => x.v === pv.expr) || { l: '' }).l}`

  const pvBarStyle = `flex:0 0 auto; width:100%; height:${s.bp === 'mobile' ? 40 : 46}px; padding:0 ${s.bp === 'mobile' ? 14 : 22}px; border:none; border-top:1px solid #f0e9e1; background:${s.pvOpen ? '#faf7f3' : '#fff'}; display:flex; align-items:center; justify-content:space-between; gap:12px; cursor:pointer; font-family:inherit; transition:background .16s ease;`
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

  // ── 모바일 바텀시트: 열기/닫기 양방향 트랜지션 + 아무 데나 잡고 아래로 스와이프해 닫기 ──
  const [sheetIn, setSheetIn] = useState(false)   // false = translateY(100%) (아래), true = 0 (올라옴)
  const [dragY, setDragY] = useState(0)
  const [dragging, setDragging] = useState(false)
  const sheetScrollRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef({ id: -1, y0: 0, armed: false, moved: false, t0: 0 })
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 마운트 직후 한 프레임 뒤 in → 아래에서 위로 올라오는 트랜지션. 언마운트 시 초기화.
  useEffect(() => {
    if (!(mob && s.pvOpen)) return
    setDragY(0)
    const r = requestAnimationFrame(() => setSheetIn(true))
    return () => { cancelAnimationFrame(r); setSheetIn(false) }
  }, [mob, s.pvOpen])
  useEffect(() => () => { if (closeTimer.current) clearTimeout(closeTimer.current) }, [])

  // 시트가 떠 있는 동안 문서 스크롤 잠금 — 모바일은 body 스크롤이 열려 있어(globals.css) 잠그지 않으면
  // 시트를 아래로 끌 때 뒤 페이지가 같이 밀린다. 스크롤 위치는 그대로 두고 overflow 만 막는다.
  useEffect(() => {
    if (!(mob && s.pvOpen)) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [mob, s.pvOpen])

  // 닫기 = 여는 것의 역방향(아래로 내려가며 사라짐) → 끝나면 언마운트. 마스크 클릭·스와이프 공용.
  const closeSheet = () => {
    if (closeTimer.current) return
    setDragging(false); setSheetIn(false)
    closeTimer.current = setTimeout(() => { closeTimer.current = null; s.setPvOpen(false) }, 260)
  }
  const onSheetDown = (e: React.PointerEvent) => {
    if (closeTimer.current) return
    const sc = sheetScrollRef.current
    // 스크롤 영역이 맨 위에 있을 때만 "아래로 끌어 닫기"를 무장 → 목록 스크롤과 충돌하지 않는다.
    dragRef.current = { id: e.pointerId, y0: e.clientY, armed: !sc || sc.scrollTop <= 0, moved: false, t0: performance.now() }
  }
  // 6px 은 너무 예민해서, 위로 스크롤할 때 손가락이 처음 몇 px 아래로 흔들리는 것만으로 드래그가 붙잡혀
  // 시트가 움찔하고(그 뒤 dy 가 음수로 가며 0 으로 복귀) 스크롤도 뺏겼다 → 문턱을 키우고 방향을 잠근다.
  const DRAG_START = 14
  const onSheetMove = (e: React.PointerEvent) => {
    const d = dragRef.current
    if (d.id !== e.pointerId || !d.armed) return
    const dy = e.clientY - d.y0
    if (!d.moved) {
      // 문턱을 넘기 전에 위로 조금이라도 움직였으면 = 스크롤 의도 → 이 제스처는 영구히 포기한다.
      if (dy < -2) { d.armed = false; return }
      if (dy < DRAG_START) return
      d.moved = true; setDragging(true)
      try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId) } catch {}
    }
    setDragY(Math.max(0, dy - DRAG_START)) // 문턱만큼 빼서 잡히는 순간 툭 튀지 않게
  }
  const onSheetUp = (e: React.PointerEvent) => {
    const d = dragRef.current
    if (d.id !== e.pointerId) return
    d.id = -1
    if (!d.moved) return
    const dy = Math.max(0, e.clientY - d.y0 - DRAG_START)
    const v = dy / Math.max(1, performance.now() - d.t0) // px/ms — 짧고 빠르게 튕겨도 닫히게
    setDragging(false)
    if (dy > 90 || v > 0.5) closeSheet(); else setDragY(0)
  }
  const onSheetCancel = () => { dragRef.current.id = -1; setDragging(false); setDragY(0) }

  // 연출 설정 본문 — PC/태블릿은 아코디언 안에, 모바일은 바텀시트 안에 그대로 재사용한다.
  const pvBody = (
    // ⚠️ touch-action 은 조상까지 함께 적용된다 — 시트 루트에 none 을 걸면 여기 pan-y 를 줘도 안쪽 스크롤이
    // 통째로 막힌다(표정/액션 목록이 안 움직이던 원인). 루트도 pan-y 로 두고, 드래그 여부는 JS 가 판정한다.
    // 맨 위(scrollTop 0)에서 아래로 미는 건 브라우저가 스크롤할 게 없어(overscroll-behavior:contain) 우리에게 온다.
    <div ref={mob ? sheetScrollRef : undefined} className="pb-scroll" style={css(`max-height:${mob ? 'none' : '300px'}; ${mob ? 'flex:1 1 auto; overscroll-behavior:contain; touch-action:pan-y;' : ''} overflow:hidden auto; padding:14px 22px ${mob ? '18px' : '14px'}; ${mob ? '' : 'border-top:1px solid #f0e9e1;'} display:flex; flex-direction:column; gap:11px;`)}>
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
        <div style={css('display:flex; gap:6px; flex-wrap:wrap; justify-content:flex-end;')}>{pill(PV_GAZES, 'gaze')}</div>
      </div>
      <div style={css('height:1px; background:#f0e9e1; margin:2px 0;')} />
      <div style={css('display:flex; align-items:center; justify-content:space-between; gap:12px;')}>
        <span style={css(PV_LABEL)}>무기 이펙트</span>
        <button onClick={() => s.setPv('wEffect', !pv.wEffect)} style={css(switchTrack(pv.wEffect))}><span style={css(switchKnob(pv.wEffect))} /></button>
      </div>
      <div style={css('display:flex; align-items:center; justify-content:space-between; gap:12px;')}>
        <span style={css(PV_LABEL)}>망토 이펙트</span>
        <button onClick={() => s.setPv('cEffect', !pv.cEffect)} style={css(switchTrack(pv.cEffect))}><span style={css(switchKnob(pv.cEffect))} /></button>
      </div>
    </div>
  )

  return (
    <>
    <section style={css(`${mob ? `flex:0 0 auto; width:100%; height:${MOBILE_H.preview}` : 'flex:0 0 calc(35% - 20px)'}; min-width:0; background:#fff; border:1px solid #e7ded4; border-radius:16px; display:flex; flex-direction:column; overflow:hidden;`)}>
      <div style={css(`flex:0 0 auto; height:${mob ? 40 : 58}px; padding:0 ${mob ? '9px 0 14px' : '16px 0 22px'}; display:flex; align-items:center; justify-content:space-between; gap:8px; border-bottom:1px solid #f0e9e1;`)}>
        <span style={css(`font-size:${mob ? 14 : 15}px; font-weight:700; flex:0 0 auto; color:#2a2521;`)}>코디 미리보기</span>
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

      {/* PC/태블릿: 인라인 아코디언. 모바일은 아래 바텀시트로 뺀다(고정 높이 패널 안에서 아코디언이 잘리던 문제). */}
      {!mob && (
        <div className={s.pvOpen ? 'pb-acc pb-acc-open' : 'pb-acc'} style={css('flex:0 0 auto;')}>
          <div>{pvBody}</div>
        </div>
      )}
    </section>

    {/* 모바일 연출 설정 = 바텀시트. 미리보기/리스트 높이를 전혀 뺏지 않고 최대 74svh 까지 펼쳐진다.
        (dvh 가 아니라 svh — 툴바가 접히고 펴질 때 시트 높이가 따라 변하면 안 된다.)
        닫기 버튼 없음 — 마스크 탭 또는 아무 데나 잡고 아래로 스와이프(둘 다 같은 역방향 트랜지션). */}
    {mob && s.pvOpen && (
      <>
        <div onClick={closeSheet} style={css(`position:fixed; inset:0; z-index:55; background:rgba(42,37,33,.34); opacity:${sheetIn ? Math.max(0, 1 - dragY / 260) : 0}; transition:${dragging ? 'none' : 'opacity .26s ease'};`)} />
        <div role="dialog" aria-label="연출 설정"
          onPointerDown={onSheetDown} onPointerMove={onSheetMove} onPointerUp={onSheetUp} onPointerCancel={onSheetCancel}
          style={css(`position:fixed; left:0; right:0; bottom:0; z-index:56; display:flex; flex-direction:column; max-height:74svh; background:#fff; border-top:1px solid #e7ded4; border-radius:18px 18px 0 0; box-shadow:0 -12px 34px rgba(42,37,33,.18); padding-bottom:env(safe-area-inset-bottom); touch-action:pan-y; transform:translateY(${sheetIn ? dragY + 'px' : '100%'}); transition:${dragging ? 'none' : 'transform .26s cubic-bezier(.22,.61,.36,1)'};`)}>
          <div style={css('flex:0 0 auto; display:flex; justify-content:center; padding:9px 0 3px;')}>
            <span style={css('width:38px; height:4px; border-radius:4px; background:#e2d8cd;')} />
          </div>
          <div style={css('flex:0 0 auto; height:42px; padding:0 22px; display:flex; align-items:center; justify-content:space-between; gap:10px; border-bottom:1px solid #f0e9e1;')}>
            <span style={css('font-size:14px; font-weight:700; color:#3d372f; flex:0 0 auto;')}>연출 설정</span>
            <span style={css('flex:1 1 auto; min-width:0; text-align:right; font-size:11px; color:#a89e93; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;')}>{pvCaption}</span>
          </div>
          {pvBody}
        </div>
      </>
    )}
    </>
  )
}
