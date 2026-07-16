'use client'

import { useEffect, useState } from 'react'
import { css } from '@/lib/style'
import { isStacked } from '@/lib/useBreakpoint'
import SnapThumb from './SnapThumb'
import { useShop } from './ShopContext'

// 코디가 두 벌인 캐릭터(제로=알파/베타, 엔젤릭버스터=일반/드레스업)를 닉네임으로 불러올 때,
// 두 코디를 나란히 그려 놓고 클릭으로 고르게 하는 가벼운 다이얼로그.
// 두 벌 다 실제 모델로 합성(SnapThumb)하므로 프리셋 카드와 같은 그림이 나온다 → 보고 고를 수 있다.
export default function LookDialog() {
  const s = useShop()
  const [hover, setHover] = useState<string | null>(null)
  const lp = s.lookPick
  const stacked = isStacked(s.bp)

  // Esc 로 닫기(다른 다이얼로그와 동일한 조작감).
  useEffect(() => {
    if (!lp) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') s.closeLookPick() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [lp, s])

  if (!lp) return null

  return (
    <div onClick={(e) => { if (e.target === e.currentTarget) s.closeLookPick() }} className="pb-overlay"
      style={css(`position:fixed; inset:0; z-index:60; background:rgba(42,37,33,0.42); display:flex; align-items:center; justify-content:center; padding:${stacked ? 14 : 32}px;`)}>
      <div onClick={(e) => e.stopPropagation()} className="pb-panel"
        style={css('width:100%; max-width:520px; max-height:88vh; background:#fff; border-radius:18px; display:flex; flex-direction:column; overflow:hidden;')}>

        <div style={css('flex:0 0 auto; padding:18px 22px 0; display:flex; align-items:flex-start; justify-content:space-between; gap:12px;')}>
          <div style={css('display:flex; flex-direction:column; gap:4px;')}>
            <span style={css('font-size:15px; font-weight:700;')}>가져올 코디 선택</span>
            <span style={css('font-size:12px; color:#a89e93;')}>{`'${lp.nick}' 은(는) 코디가 두 벌이에요`}</span>
          </div>
          <button onClick={s.closeLookPick} title="닫기 (Esc)"
            style={css('flex:0 0 auto; width:34px; height:34px; border:1px solid #e7ded4; background:#faf7f3; border-radius:8px; cursor:pointer; font-family:inherit; font-size:15px; color:#8a8075; transition:border-color .14s ease, color .14s ease;')}>✕</button>
        </div>

        <div style={css(`flex:1 1 auto; min-height:0; overflow-y:auto; padding:16px 22px 22px; display:grid; grid-template-columns:repeat(${Math.min(lp.options.length, 2)}, 1fr); gap:12px;`)}>
          {lp.options.map((o) => {
            const on = hover === o.key
            return (
              <button key={o.key} onClick={() => s.chooseLook(o.key)}
                onMouseEnter={() => setHover(o.key)} onMouseLeave={() => setHover(null)}
                style={css(`display:flex; flex-direction:column; align-items:stretch; gap:0; padding:0; border-radius:12px; cursor:pointer; overflow:hidden; font-family:inherit; background:#faf7f3; border:2px solid ${on ? '#ec86ac' : '#e7ded4'}; transition:border-color .14s ease, transform .14s ease; transform:translateY(${on ? -2 : 0}px);`)}>
                {/* 실제 모델 합성(염색·이펙트 포함) — 프리셋 카드와 동일한 그림 */}
                <div style={css('position:relative; width:100%; aspect-ratio:3/4; background:#f7f2ec;')}>
                  <SnapThumb snap={o.snap} />
                </div>
                <span style={css(`flex:0 0 auto; padding:9px 8px; font-size:13px; font-weight:600; color:${on ? '#d76d9a' : '#6e645c'}; background:#fff; border-top:1px solid #f0e9e1; transition:color .14s ease;`)}>{o.label}</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
