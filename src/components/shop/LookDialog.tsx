'use client'

import { useEffect, useState } from 'react'
import { css } from '@/lib/style'
import { isStacked } from '@/lib/useBreakpoint'
import SnapThumb from './SnapThumb'
import { useShop } from './ShopContext'

// 닉네임으로 불러올 때 "어느 코디의 어느 프리셋을 가져올지" 고르는 다이얼로그.
//  · 위: 코디 탭 — 제로(알파/베타)·엔젤릭버스터(일반/드레스업)처럼 코디가 두 벌인 경우에만 나온다.
//    기본 선택은 additional 쪽(제로=베타, 엔버=드레스업) — 사람들이 주로 보는 모습이라 그쪽을 먼저 띄운다.
//  · 아래: 그 코디의 치장 프리셋 카드(기본 + 프리셋 1~3 중 내용이 있는 것만).
//    메이플 구조상 프리셋은 base 를 덮어쓴 결과라, 각 카드가 곧 완성된 한 벌이다.
// 모든 카드는 실제 모델 합성(SnapThumb)이라 염색·이펙트까지 보이는 그대로 고를 수 있다.
export default function LookDialog() {
  const s = useShop()
  const [hover, setHover] = useState<string | null>(null)
  const [lookKey, setLookKey] = useState<string | null>(null)
  const lp = s.lookPick
  const stacked = isStacked(s.bp)

  // 코디 탭 기본 선택: additional(제로=베타 / 엔버=드레스업)이 있으면 그쪽, 없으면 첫 번째.
  useEffect(() => {
    if (!lp) { setLookKey(null); return }
    const pref = lp.options.find((o) => o.key === 'additional') ?? lp.options[0]
    setLookKey(pref?.key ?? null)
  }, [lp])

  // Esc 로 닫기(다른 다이얼로그와 동일한 조작감).
  useEffect(() => {
    if (!lp) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') s.closeLookPick() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [lp, s])

  if (!lp) return null
  const look = lp.options.find((o) => o.key === lookKey) ?? lp.options[0]
  if (!look) return null
  const multiLook = lp.options.length > 1
  const cols = Math.min(look.presets.length, stacked ? 2 : 3)

  return (
    <div onClick={(e) => { if (e.target === e.currentTarget) s.closeLookPick() }} className="pb-overlay"
      style={css(`position:fixed; inset:0; z-index:60; background:rgba(42,37,33,0.42); display:flex; align-items:center; justify-content:center; padding:${stacked ? 14 : 32}px;`)}>
      <div onClick={(e) => e.stopPropagation()} className="pb-panel"
        style={css('width:100%; max-width:560px; max-height:88svh; background:#fff; border-radius:18px; display:flex; flex-direction:column; overflow:hidden;')}>

        <div style={css('flex:0 0 auto; padding:18px 22px 0; display:flex; align-items:flex-start; justify-content:space-between; gap:12px;')}>
          <div style={css('display:flex; flex-direction:column; gap:4px; min-width:0;')}>
            <span style={css('font-size:15px; font-weight:700; color:#2a2521;')}>가져올 코디 선택</span>
            <span style={css('font-size:12px; color:#a89e93; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;')}>
              {multiLook ? `'${lp.nick}' 은(는) 코디가 두 벌이에요 · 프리셋을 골라 주세요` : `'${lp.nick}' 의 치장 프리셋을 골라 주세요`}
            </span>
          </div>
          <button onClick={s.closeLookPick} title="닫기 (Esc)"
            style={css('flex:0 0 auto; width:34px; height:34px; border:1px solid #e7ded4; background:#faf7f3; border-radius:8px; cursor:pointer; font-family:inherit; font-size:15px; color:#8a8075; transition:border-color .14s ease, color .14s ease;')}>✕</button>
        </div>

        {/* 코디 탭 — 두 벌일 때만. 한 벌이면 고를 게 없으니 아예 그리지 않는다. */}
        {multiLook && (
          <div style={css('flex:0 0 auto; padding:14px 22px 0;')}>
            <div style={css('display:flex; align-items:center; gap:4px; padding:3px; background:#f4ecf3; border-radius:10px;')}>
              {lp.options.map((o) => {
                const on = o.key === look.key
                return (
                  <button key={o.key} onClick={() => setLookKey(o.key)} className={on ? 'pb-h-solid' : 'pb-h-soft'}
                    style={css(`flex:1 1 auto; height:32px; padding:0 12px; border:none; border-radius:8px; cursor:pointer; font-family:inherit; font-size:13px; font-weight:${on ? 600 : 500}; white-space:nowrap; color:${on ? '#fff' : '#8a8075'}; background:${on ? '#ec86ac' : 'transparent'}; transition:background .22s ease, color .22s ease;`)}>{o.label}</button>
                )
              })}
            </div>
          </div>
        )}

        <div style={css(`flex:1 1 auto; min-height:0; overflow-y:auto; overscroll-behavior:contain; padding:14px 22px 22px; display:grid; grid-template-columns:repeat(${cols}, 1fr); gap:12px;`)}>
          {look.presets.map((p) => {
            const hk = `${look.key}:${p.key}`
            const on = hover === hk
            return (
              <button key={hk} onClick={() => s.chooseLook(look.key, p.key)}
                onMouseEnter={() => setHover(hk)} onMouseLeave={() => setHover(null)}
                style={css(`display:flex; flex-direction:column; align-items:stretch; gap:0; padding:0; border-radius:12px; cursor:pointer; overflow:hidden; font-family:inherit; background:#faf7f3; border:2px solid ${on ? '#ec86ac' : '#e7ded4'}; transition:border-color .14s ease, transform .14s ease; transform:translateY(${on ? -2 : 0}px);`)}>
                {/* 실제 모델 합성(염색·이펙트 포함) — 프리셋 카드와 동일한 그림 */}
                <div style={css('position:relative; width:100%; aspect-ratio:3/4; background:#f7f2ec;')}>
                  <SnapThumb snap={p.snap} />
                  {/* 게임에서 지금 입고 있는 프리셋 표시 — 어느 게 "내 모습"인지 바로 알 수 있게 */}
                  {p.active && (
                    <span style={css('position:absolute; top:7px; left:7px; height:20px; padding:0 8px; display:inline-flex; align-items:center; border-radius:20px; background:rgba(255,255,255,0.94); border:1px solid #f4cfdf; color:#d76d9a; font-size:10px; font-weight:600; white-space:nowrap; box-shadow:0 2px 8px rgba(214,109,154,.18);')}>착용 중</span>
                  )}
                </div>
                <span style={css(`flex:0 0 auto; padding:9px 8px; font-size:13px; font-weight:600; color:${on ? '#d76d9a' : '#6e645c'}; background:#fff; border-top:1px solid #f0e9e1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; transition:color .14s ease;`)}>{p.label}</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
