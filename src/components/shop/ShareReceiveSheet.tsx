'use client'

import { css } from '@/lib/style'
import { isStacked } from '@/lib/useBreakpoint'
import SnapThumb from './SnapThumb'
import { useShop } from './ShopContext'

// 공유 링크(#c=…)로 접속하면 뜨는 '코디 받기' 시트.
// 설계: 링크 접속 = 이미 "확인·소유" 의사 → 슬롯 선택을 앞에 둬 단계 최소화(뒤로 뺀 저장이 오히려 병목).
//  - 상단: 공유 코디 미리보기(고르기 전 확인)
//  - 하단: 내 프리셋 20슬롯 썸네일(무엇을 덮는지 보임) → 탭 1번에 그 슬롯에 즉시 적용 + 선택(라이브). 되돌리기 가능.
//  - 아무 슬롯도 안 고르고 닫으면 개인 프리셋은 그대로(안전).
export default function ShareReceiveSheet() {
  const s = useShop()
  const snap = s.sharedIncoming
  if (!snap) return null
  const mob = isStacked(s.bp)
  const cols = s.bp === 'pc' ? 5 : s.bp === 'half' ? 4 : s.bp === 'tablet' ? 3 : 2

  return (
    <div onClick={s.dismissShared} style={css('position:fixed; inset:0; z-index:60; display:flex; align-items:center; justify-content:center; padding:16px; background:rgba(42,37,33,0.45);')}>
      <div onClick={(e) => e.stopPropagation()} style={css(`width:100%; max-width:${mob ? 520 : 720}px; max-height:88vh; background:#fff; border:1px solid #e7ded4; border-radius:16px; display:flex; flex-direction:column; overflow:hidden; box-shadow:0 20px 60px rgba(42,37,33,.22);`)}>
        <div style={css('flex:0 0 auto; padding:15px 20px; display:flex; align-items:center; gap:12px; border-bottom:1px solid #f0e9e1;')}>
          <span style={css('font-size:15px; font-weight:700; color:#2a2521; flex:0 0 auto;')}>공유받은 코디</span>
          <span style={css('flex:1 1 0; min-width:0; font-size:12px; color:#a89e93; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;')}>{mob ? '저장할 프리셋을 골라주세요' : '저장할 프리셋을 고르면 바로 적용돼요 · 되돌리기 가능'}</span>
          <button onClick={s.dismissShared} title="닫기" aria-label="닫기" style={css('flex:0 0 auto; width:28px; height:28px; border:none; border-radius:8px; background:#f4ecf3; color:#8a8075; font-size:17px; line-height:1; cursor:pointer;')}>×</button>
        </div>

        <div className="pb-scroll pb-scroll-thin" style={css('flex:1 1 auto; min-height:0; overflow:hidden auto; padding:18px 20px 20px;')}>
          {/* 공유 코디 미리보기 — 고르기 전 확인 */}
          <div style={css('display:flex; justify-content:center; margin-bottom:16px;')}>
            <div style={css('position:relative; width:128px; aspect-ratio:3/4; border-radius:12px; overflow:hidden; background:#f7f2ec; border:1px solid #f0e9e1;')}>
              <SnapThumb snap={snap} />
            </div>
          </div>

          <div style={css('font-size:13px; font-weight:600; color:#7a7066; margin-bottom:10px;')}>어느 프리셋에 저장할까요?</div>
          <div style={css(`display:grid; grid-template-columns:repeat(${cols},minmax(0,1fr)); gap:12px;`)}>
            {s.presets.map((p) => {
              const cur = s.presetData[p.id]
              return (
                <div key={p.id} className="pb-presetwrap">
                  <div onClick={() => s.applySharedToPreset(snap, p.id)} className="pb-preset" title={`'${p.name}'에 저장`}>
                    <div style={css('position:relative; width:100%; aspect-ratio:3/4; overflow:hidden; background:#f7f2ec; border-radius:12px 12px 0 0;')}>
                      {cur && <SnapThumb snap={cur} />}
                    </div>
                    <div style={css('padding:8px 10px 9px; text-align:center;')}>
                      <div style={css('font-size:12px; font-weight:600; color:#2a2521; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;')}>{p.name}</div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
