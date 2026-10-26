'use client'

import clsx from 'clsx'
import { useEffect, useState } from 'react'
import { css } from '@/lib/style'
import { NEXON_CREDIT } from '@/lib/nexonLook'
import { isStacked } from '@/lib/useBreakpoint'
import SnapThumb from './SnapThumb'
import { NICK_TAKE_SLOTS, useShop, type Snapshot } from './ShopContext'
import { readUiPref, writeUiPref } from '@/lib/uiState'
import pst from './preset/preset.module.css'
import { useDialogFade } from './ui/useDialogFade'
import { useMaskClose } from './ui/useMaskClose'

// 닉네임으로 불러올 때 "어느 코디의 · 어느 프리셋을 가져올지" 고르는 다이얼로그.
// 항상 최신(현재) 코디를 가져온다 — 시점(날짜) 선택은 없다.

export default function LookDialog() {
  const s = useShop()
  // 닫힐 때도 전환이 보이도록 값이 사라진 뒤에도 잠깐 더 그린다(서피스와 같은 방식).
  const { shown: lp, hidden } = useDialogFade(s.lookPick)
  const stacked = isStacked(s.bp)
  const cols = stacked ? 2 : 3

  const [hover, setHover] = useState<string | null>(null)
  const [lookKey, setLookKey] = useState<string | null>(null)

  // 코디 탭 기본 선택(제로/엔버).
  useEffect(() => {
    if (!lp) { setLookKey(null); return }
    if (!lp.options.some((o) => o.key === lookKey)) {
      const pref = lp.options.find((o) => o.key === 'additional') ?? lp.options[0]
      setLookKey(pref?.key ?? null)
    }
  }, [lp])

  const close = (after?: () => void) => { if (after) after(); else s.closeLookPick() }

  const mask = useMaskClose(() => close()) // 마스크에서 누르고 마스크에서 뗐을 때만 닫힘

  // Esc 닫기.
  useEffect(() => {
    if (!lp) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [lp])

  // ← →: 다이얼로그가 열려 있으면 캡처해서 뒤 화면(코디 리스트)이 같이 넘어가지 않게 막는다.
  useEffect(() => {
    if (!lp) return
    const onKeyCap = (e: KeyboardEvent) => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') e.stopImmediatePropagation() }
    window.addEventListener('keydown', onKeyCap, true)
    return () => window.removeEventListener('keydown', onKeyCap, true)
  }, [lp])

  // 가져올 장식 — 고른 값은 늘 유지(lib/uiState 의 UiPref.nickTake)
  const [take, setTake] = useState<Record<string, boolean>>({})
  useEffect(() => { if (lp) setTake(readUiPref().nickTake ?? {}) }, [lp])
  const takeSnap = (sn: Snapshot): Snapshot => { const eq = { ...sn.equipped }; for (const t of NICK_TAKE_SLOTS) if (take[t.slot] === false) delete eq[t.slot]; return { ...sn, equipped: eq } }
  const flip = (slot: string) => setTake((t) => { const n = { ...t, [slot]: t[slot] === false }; writeUiPref({ nickTake: n }); return n })

  if (!lp) return null
  const look = lp.options.find((o) => o.key === lookKey) ?? lp.options[0]
  if (!look) return null
  const multiLook = lp.options.length > 1
  const presetCols = Math.min(look.presets.length, cols)

  const closeBtn = (
    <button onClick={() => close()} title="닫기 (Esc)"
      style={css('flex:0 0 auto; width:34px; height:34px; border: 1px solid #e7ded4; border: 1px solid light-dark(#e7ded4, #4b4e57); background: #faf7f3; background: light-dark(#faf7f3, #373940); border-radius:6px; cursor:pointer; font-family:inherit; font-size:15px; color: #8a8075; color: light-dark(#8a8075, #9fa2aa); transition:border-color .14s ease, color .14s ease;')}>✕</button>
  )

  return (
    <div {...mask} className={clsx('pb-dlg-mask', hidden && 'pb-dlg-hidden')}
      style={css(`position:fixed; inset:0; z-index:60; background: rgba(42,37,33,0.42); background: light-dark(rgba(42,37,33,0.42), rgba(14, 15, 17, 0.483)); display:flex; align-items:center; justify-content:center; padding:${stacked ? 14 : 32}px;`)}>
      <div onClick={(e) => e.stopPropagation()} className={clsx('pb-dlg-panel', hidden && 'pb-dlg-hidden')}
        style={css('width:100%; max-width:560px; height:min(620px, 88svh); background: #fff; background: light-dark(#fff, #303238); border-radius:12px; display:flex; flex-direction:column; overflow:hidden;')}>
        <div style={css('display:flex; flex-direction:column; min-height:0; flex:1 1 auto;')}>
          <div style={css('flex:0 0 auto; padding:18px 22px 0; display:flex; align-items:flex-start; justify-content:space-between; gap:12px;')}>
            <div style={css('display:flex; flex-direction:column; gap:4px; min-width:0;')}>
              <span style={css('font-size:15px; font-weight:700; color: #2a2521; color: light-dark(#2a2521, #d4d5d8);')}>가져올 코디 선택</span>
              <span style={css('font-size:12px; color: #a89e93; color: light-dark(#a89e93, #8e919a); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;')}>
                {multiLook ? `'${lp.nick}' 은(는) 코디가 두 벌이에요, 프리셋을 골라 주세요` : `'${lp.nick}' 의 치장 프리셋을 골라 주세요`}
              </span>
            </div>
            {closeBtn}
          </div>

          {/* 가져올 장식(간이 — 사용자 지시: 디자인은 나중에 확정). 꺼 둔 것은 빼고 프리셋에 넣는다(ShopContext.chooseLook) */}
          <div style={css('flex:0 0 auto; padding:12px 22px 0;')}>
            <div className={pst.takeRow}>
              {NICK_TAKE_SLOTS.map((t) => {
                const on = take[t.slot] !== false
                return <button key={t.slot} type="button" aria-pressed={on} onClick={() => flip(t.slot)} title={on ? `${t.label} 가져오기 (누르면 빼기)` : `${t.label} 빼기 (누르면 가져오기)`} className={clsx(pst.takePill, on && pst.takePillOn)}>{t.label}</button>
              })}
            </div>
          </div>

          {multiLook && (
            <div style={css('flex:0 0 auto; padding:12px 22px 0;')}>
              <div style={css('display:flex; align-items:center; gap:4px; padding:3px; background: #f4ecf3; background: light-dark(#f4ecf3, #563752); border-radius:8px;')}>
                {lp.options.map((o) => {
                  const on = o.key === look.key
                  return (
                    <button key={o.key} onClick={() => setLookKey(o.key)}
                      style={css(`flex:1 1 auto; height:32px; padding:0 12px; border:none; border-radius:6px; cursor:pointer; font-family:inherit; font-size:13px; font-weight:${on ? 600 : 500}; white-space:nowrap; color:${on ? 'light-dark(#fff, #303238)' : 'light-dark(#8a8075, #9fa2aa)'}; background:${on ? 'light-dark(#ec86ac, #d15785)' : 'transparent'}; transition:background .22s ease, color .22s ease;`)}>{o.label}</button>
                  )
                })}
              </div>
            </div>
          )}

          {/* 고정 높이 행으로 채워 스크롤이 생기지 않게(패딩이 hover 리프트도 흡수). */}
          <div style={css(`flex:1 1 auto; min-height:0; overflow:hidden; padding:14px 22px; display:grid; grid-template-columns:repeat(${presetCols}, 1fr); grid-auto-rows:${stacked ? 200 : 218}px; align-content:start; gap:14px;`)}>
            {look.presets.map((p) => {
              const hk = `${look.key}:${p.key}`
              const on = hover === hk
              return (
                <button key={hk} onClick={() => close(() => s.chooseLook(look.key, p.key))}
                  onMouseEnter={() => setHover(hk)} onMouseLeave={() => setHover(null)}
                  style={css(`display:flex; flex-direction:column; align-items:stretch; height:100%; min-height:0; gap:0; padding:0; border-radius:8px; cursor:pointer; overflow:hidden; font-family:inherit; background:light-dark(#faf7f3, #303238); border:2px solid ${on ? 'light-dark(#ec86ac, #d15785)' : 'light-dark(#e7ded4, #4b4e57)'}; transition:border-color .14s ease, transform .14s ease; transform:translateY(${on ? -2 : 0}px);`)}>
                  <div style={css('position:relative; flex:1 1 0; min-height:0; width:100%; background: #f7f2ec; background: light-dark(#f7f2ec, #3b3d45); overflow:hidden;')}>
                    {/* 프리셋 카드처럼 명찰을 닉네임으로(명찰 반지가 없으면 기본 명찰 — 사용자 지시) */}
                    <SnapThumb snap={takeSnap(p.snap)} tagName={lp.nick} baseTag={take.nameTag !== false} deco /> {/* 가져올 장식 토글을 미리보기에도(꺼 둔 것은 빼고 그린다 — 사용자 지시) */}
                    {p.active && (
                      <span style={css('position:absolute; top:7px; left:7px; height:20px; padding:0 8px; display:inline-flex; align-items:center; border-radius:20px; background: rgba(255,255,255,0.94); background: light-dark(rgba(255,255,255,0.94), rgba(48, 50, 56, 0.94)); border: 1px solid #f8e0ea; border: 1px solid light-dark(#f8e0ea, #5a3947); color: #d76d9a; color: light-dark(#d76d9a, #d293ae); font-size:10px; font-weight:600; white-space:nowrap; box-shadow: 0 2px 8px rgba(214,109,154,.18); box-shadow: 0 2px 8px light-dark(rgba(214,109,154,.18), rgba(164, 62, 106, 0.18));')}>착용 중</span>
                    )}
                  </div>
                  <span style={css(`flex:0 0 auto; padding:8px; font-size:13px; font-weight:600; text-align:center; color:${on ? 'light-dark(#d76d9a, #b94a79)' : 'light-dark(#6e645c, #aeb1b8)'}; background:light-dark(#fff, #303238); border-top:1px solid light-dark(#f0e9e1, #3e4048); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; transition:color .14s ease;`)}>{p.label}</span>
                </button>
              )
            })}
          </div>
          {/* 출처 표기(넥슨 Open API 이용약관 제6조 ④, lib/nexonLook) */}
          <span style={css('flex:0 0 auto; padding:0 22px 14px; font-size:11px; color: #b7ada2; color: light-dark(#b7ada2, #858893); text-align:right;')}>{NEXON_CREDIT}</span>
        </div>
      </div>
    </div>
  )
}
