'use client'

import clsx from 'clsx'
import { useEffect, useState } from 'react'
import { css } from '@/lib/style'
import { isStacked } from '@/lib/useBreakpoint'
import SnapThumb from './SnapThumb'
import { useShop } from './ShopContext'
import { useDialogFade } from './ui/useDialogFade'
import { useMaskClose } from './ui/useMaskClose'

// 닉네임으로 불러올 때 "어느 코디의 · 어느 프리셋을 가져올지" 고르는 다이얼로그(현행 요소 유지).
// ⚠️ 시점(날짜) 변경 기능은 제거했다 — 추후 더 탄탄히 구축해 다시 추가 예정. 항상 최신(현재) 코디를 가져온다.

export default function LookDialog() {
  const s = useShop()
  // 닫힐 때도 전환이 보이도록 값이 사라진 뒤에도 잠깐 더 그린다(서피스·공유 받기와 같은 방식).
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lp])

  const close = (after?: () => void) => { if (after) after(); else s.closeLookPick() }

  const mask = useMaskClose(() => close()) // 마스크에서 누르고 마스크에서 뗐을 때만 닫힘

  // Esc 닫기.
  useEffect(() => {
    if (!lp) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lp])

  // ← →: 다이얼로그가 열려 있으면 캡처해서 뒤 화면(코디 리스트)이 같이 넘어가지 않게 막는다.
  useEffect(() => {
    if (!lp) return
    const onKeyCap = (e: KeyboardEvent) => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') e.stopImmediatePropagation() }
    window.addEventListener('keydown', onKeyCap, true)
    return () => window.removeEventListener('keydown', onKeyCap, true)
  }, [lp])

  if (!lp) return null
  const look = lp.options.find((o) => o.key === lookKey) ?? lp.options[0]
  if (!look) return null
  const multiLook = lp.options.length > 1
  const presetCols = Math.min(look.presets.length, cols)

  const closeBtn = (
    <button onClick={() => close()} title="닫기 (Esc)"
      style={css('flex:0 0 auto; width:34px; height:34px; border:1px solid #e7ded4; background:#faf7f3; border-radius:8px; cursor:pointer; font-family:inherit; font-size:15px; color:#8a8075; transition:border-color .14s ease, color .14s ease;')}>✕</button>
  )

  return (
    <div {...mask} className={clsx('pb-dlg-mask', hidden && 'pb-dlg-hidden')}
      style={css(`position:fixed; inset:0; z-index:60; background:rgba(42,37,33,0.42); display:flex; align-items:center; justify-content:center; padding:${stacked ? 14 : 32}px;`)}>
      <div onClick={(e) => e.stopPropagation()} className={clsx('pb-dlg-panel', hidden && 'pb-dlg-hidden')}
        style={css('width:100%; max-width:560px; height:min(620px, 88svh); background:#fff; border-radius:18px; display:flex; flex-direction:column; overflow:hidden;')}>
        <div style={css('display:flex; flex-direction:column; min-height:0; flex:1 1 auto;')}>
          <div style={css('flex:0 0 auto; padding:18px 22px 0; display:flex; align-items:flex-start; justify-content:space-between; gap:12px;')}>
            <div style={css('display:flex; flex-direction:column; gap:4px; min-width:0;')}>
              <span style={css('font-size:15px; font-weight:700; color:#2a2521;')}>가져올 코디 선택</span>
              <span style={css('font-size:12px; color:#a89e93; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;')}>
                {multiLook ? `'${lp.nick}' 은(는) 코디가 두 벌이에요 · 프리셋을 골라 주세요` : `'${lp.nick}' 의 치장 프리셋을 골라 주세요`}
              </span>
            </div>
            {closeBtn}
          </div>

          {multiLook && (
            <div style={css('flex:0 0 auto; padding:12px 22px 0;')}>
              <div style={css('display:flex; align-items:center; gap:4px; padding:3px; background:#f4ecf3; border-radius:10px;')}>
                {lp.options.map((o) => {
                  const on = o.key === look.key
                  return (
                    <button key={o.key} onClick={() => setLookKey(o.key)}
                      style={css(`flex:1 1 auto; height:32px; padding:0 12px; border:none; border-radius:8px; cursor:pointer; font-family:inherit; font-size:13px; font-weight:${on ? 600 : 500}; white-space:nowrap; color:${on ? '#fff' : '#8a8075'}; background:${on ? '#ec86ac' : 'transparent'}; transition:background .22s ease, color .22s ease;`)}>{o.label}</button>
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
                  style={css(`display:flex; flex-direction:column; align-items:stretch; height:100%; min-height:0; gap:0; padding:0; border-radius:12px; cursor:pointer; overflow:hidden; font-family:inherit; background:#faf7f3; border:2px solid ${on ? '#ec86ac' : '#e7ded4'}; transition:border-color .14s ease, transform .14s ease; transform:translateY(${on ? -2 : 0}px);`)}>
                  <div style={css('position:relative; flex:1 1 0; min-height:0; width:100%; background:#f7f2ec; overflow:hidden;')}>
                    <SnapThumb snap={p.snap} />
                    {p.active && (
                      <span style={css('position:absolute; top:7px; left:7px; height:20px; padding:0 8px; display:inline-flex; align-items:center; border-radius:20px; background:rgba(255,255,255,0.94); border:1px solid #f4cfdf; color:#d76d9a; font-size:10px; font-weight:600; white-space:nowrap; box-shadow:0 2px 8px rgba(214,109,154,.18);')}>착용 중</span>
                    )}
                  </div>
                  <span style={css(`flex:0 0 auto; padding:8px; font-size:13px; font-weight:600; text-align:center; color:${on ? '#d76d9a' : '#6e645c'}; background:#fff; border-top:1px solid #f0e9e1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; transition:color .14s ease;`)}>{p.label}</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
