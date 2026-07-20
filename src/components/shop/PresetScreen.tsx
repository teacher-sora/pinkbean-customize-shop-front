'use client'

import { useMemo } from 'react'
import { MOBILE_H, isStacked } from '@/lib/useBreakpoint'
import { css } from '@/lib/style'
import SnapThumb from './SnapThumb'
import { useShop, type Snapshot } from './ShopContext'


export default function PresetScreen() {
  const s = useShop()
  const mob = isStacked(s.bp) // 세로 스택이면 태블릿도 같은 여백 절약 규칙(CodiScreen 주석 참고)
  // 라이브 모델 → Snapshot(선택된 카드가 이걸로 그려진다). 자동저장(100ms)을 기다리지 않고 즉시 반영.
  const liveSnap: Snapshot = useMemo(() => {
    const eq: Record<string, string> = {}
    for (const [slot, it] of Object.entries(s.equipped)) if (it) eq[slot] = it.id
    // pv(연출설정 일부)도 담아야 선택된 프리셋 카드에 형상변이·귀·무기·이펙트가 반영된다(SnapThumb 이 snap.pv 사용).
    return { equipped: eq, tone: s.tone, dyePalette: s.dyePalette, dyeHsb: s.dyeHsb, hidden: s.hidden,
      pv: { form: s.pv.form, ear: s.pv.ear, weapon: s.pv.weapon, wEffect: s.pv.wEffect, cEffect: s.pv.cEffect, capEffect: s.pv.capEffect, zoom: s.pv.zoom } }
  }, [s.equipped, s.tone, s.dyePalette, s.dyeHsb, s.hidden, s.pv])

  return (
    <section style={css(`${mob ? `flex:0 0 auto; width:100%; height:${MOBILE_H.content}` : 'flex:0 0 65%'}; min-width:0; min-height:0; background:#fff; border:1px solid #e7ded4; border-radius:16px; display:flex; flex-direction:column; overflow:hidden;`)}>
      <div style={css(`flex:0 0 auto; height:${mob ? 46 : 58}px; padding:0 ${mob ? 14 : 22}px; display:flex; align-items:center; gap:${mob ? 8 : 14}px; border-bottom:1px solid #f0e9e1;`)}>
        <span style={css(`font-size:${mob ? 14 : 15}px; font-weight:700; flex:0 0 auto; color:#2a2521;`)}>프리셋</span>
        <span style={css('flex:1 1 0; min-width:0; font-size:12px; color:#a89e93; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;')}>{mob ? '변경 시 자동 저장' : '변경 시 선택한 프리셋에 자동 저장 · 새로고침해도 유지'}</span>
      </div>

      <div style={css('flex:1 1 auto; min-height:0; display:flex; flex-direction:column;')}>
        {/* 불러오기 바(코드/닉네임) */}
        <div style={css(`flex:0 0 auto; padding:${mob ? '10px 14px' : '16px 22px'}; display:flex; flex-direction:column; gap:${mob ? 8 : 10}px;`)}>
          {/* 옆 설명 span 이 자리를 먹으면 버튼이 눌려 "공유 코드"가 두 줄로 쪼개진다.
              → 버튼은 0 0 auto + nowrap 로 절대 안 줄고, 설명이 먼저 줄어들거나(모바일) 다음 줄로 내려간다. */}
          <div style={css('display:flex; align-items:center; gap:6px; flex-wrap:wrap;')}>
            {(['nick', 'code'] as const).map((mode) => {
              const isSel = s.importMode === mode
              const th = s.hoverMode === mode && !isSel
              const bd = isSel ? '#ec86ac' : th ? '#eeb2ce' : '#e7ded4'
              const col = isSel || th ? '#d76d9a' : '#8a8075'
              return (
                <button key={mode} onClick={() => s.setImportMode(mode)} onMouseEnter={() => s.setHoverMode(mode)} onMouseLeave={() => s.setHoverMode(null)}
                  style={css(`flex:0 0 auto; white-space:nowrap; height:34px; padding:0 12px; border-radius:8px; cursor:pointer; font-family:inherit; font-size:12px; font-weight:${isSel ? 600 : 500}; border:1px solid ${bd}; background:${isSel ? '#fce9f1' : '#fff'}; color:${col}; transition:background .26s ease, border-color .26s ease, color .26s ease;`)}>{mode === 'code' ? '공유 코드' : '닉네임'}</button>
              )
            })}
            <span style={css(`flex:1 1 ${mob ? '100%' : '160px'}; min-width:0; font-size:11px; color:#b7ada2; ${mob ? '' : 'margin-left:2px;'}`)}>{s.importMode === 'code' ? '불러온 코디는 선택한 프리셋에 덮어써져요' : '메이플 닉네임의 캐시 코디를 선택한 프리셋에 불러와요'}</span>
          </div>
          <div style={css('display:flex; align-items:center; gap:10px;')}>
            <input value={s.nickInput} onChange={(e) => s.setNickInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') s.importFetch() }} disabled={s.importing}
              placeholder={s.importMode === 'code' ? '코디 공유 코드 붙여넣기 (PB1…)' : '캐릭터 닉네임 입력'}
              style={css(`flex:1 1 0; min-width:0; height:38px; padding:0 14px; border:1px solid #e7ded4; border-radius:9px; background:#faf7f3; font-family:inherit; font-size:13px; outline:none; transition:border-color .14s ease; opacity:${s.importing ? 0.6 : 1};`)} />
            <button onClick={s.importFetch} disabled={s.importing} className="pb-h-solid" style={css(`flex:0 0 auto; white-space:nowrap; height:38px; min-width:${mob ? 78 : 96}px; padding:0 ${mob ? 13 : 18}px; display:flex; align-items:center; justify-content:center; gap:8px; border:none; background:linear-gradient(100deg,#ec86ac,#b57bdb); border-radius:9px; font-family:inherit; font-size:13px; font-weight:600; color:#fff; cursor:${s.importing ? 'default' : 'pointer'}; opacity:${s.importing ? 0.85 : 1}; transition:filter .15s ease, transform .15s ease;`)}>
              {s.importing ? (<><span className="pb-spin" />불러오는 중…</>) : '불러오기'}
            </button>
          </div>
        </div>
        <div style={css(`flex:0 0 auto; height:1px; margin:0 ${mob ? 14 : 22}px; background:#f0e9e1;`)} />

        {/* 프리셋 그리드 */}
        <div className="pb-scroll pb-scroll-thin" style={css(`flex:1 1 auto; min-height:0; overflow:hidden auto; overscroll-behavior:contain; padding:${mob ? '12px 14px' : '18px 22px'};`)}>
          <div style={css(`display:grid; grid-template-columns:repeat(${s.bp === 'pc' ? 5 : s.bp === 'half' ? 4 : s.bp === 'tablet' ? 3 : 2},minmax(0,1fr)); gap:12px;`)}>
            {s.presets.map((p) => {
              const on = s.selectedPreset === p.id
              // 선택된 프리셋 카드는 저장본(자동저장 100ms 뒤 반영) 대신 **라이브 모델을 그대로** 그린다.
              // → 염색·착용을 바꾸는 즉시 카드에 반영되고, 우측 미리보기와 100% 같은 모습이 된다.
              const snap = on ? liveSnap : s.presetData[p.id]
              const editing = s.editingPreset === p.id
              return (
                <div key={p.id} className="pb-presetwrap">
                  <div onClick={() => s.selectPreset(p.id)} className="pb-preset" style={css(on ? 'border-color:#ec86ac; background:#fdf4f8; transform:translateY(-5px);' : '')}>
                    <div style={css('position:relative; width:100%; aspect-ratio:3/4; overflow:hidden; background:#f7f2ec; border-radius:12px 12px 0 0;')}>
                      {snap && <SnapThumb snap={snap} />}
                      <span style={css(`position:absolute; top:8px; left:8px; display:inline-flex; align-items:center; gap:4px; height:20px; padding:0 9px; border-radius:20px; background:rgba(255,255,255,0.92); color:#d76d9a; border:1px solid #f4cfdf; font-size:10px; font-weight:600; pointer-events:none; box-shadow:0 2px 8px rgba(214,109,154,.18); transition:opacity .22s ease, transform .22s ease; opacity:${on ? 1 : 0}; transform:translateY(${on ? '0' : '-6px'});`)}>선택됨</span>
                      {/* 액션(초기화·공유) — 카드 호버 시 표시(pb-preset-acts). 초기화(왼쪽)=빨간 휴지통(위험), 공유(오른쪽) */}
                      <div className="pb-preset-acts" style={css('position:absolute; top:7px; right:7px; display:flex; gap:5px;')}>
                        <button onClick={(e) => { e.stopPropagation(); s.resetPreset(p.id) }} title="기본값으로 초기화" style={css('display:flex; align-items:center; justify-content:center; width:26px; height:26px; border:none; border-radius:7px; background:rgba(255,255,255,0.92); cursor:pointer; box-shadow:0 1px 4px rgba(42,37,33,.12);')}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="#e0533e"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" /></svg>
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); s.sharePreset(p) }} title="공유 코드 복사" style={css('width:26px; height:26px; border:none; border-radius:7px; background:rgba(255,255,255,0.92); color:#8a8075; font-family:inherit; font-size:12px; cursor:pointer; box-shadow:0 1px 4px rgba(42,37,33,.12);')}>↗</button>
                      </div>
                    </div>
                    <div style={css('padding:10px 11px 11px;')}>
                      {editing ? (
                        <input autoFocus value={s.editName} onChange={(e) => s.setEditName(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur() } else if (e.key === 'Escape') { s.setEditingPreset(null); s.setEditName('') } }}
                          onBlur={s.commitRename} onClick={(e) => e.stopPropagation()}
                          style={css('width:100%; height:28px; padding:0 8px; border:1.5px solid #ec86ac; border-radius:7px; background:#fff; font-family:inherit; font-size:13px; font-weight:600; color:#2a2521; outline:none;')} />
                      ) : (
                        // 이름 = 클릭하면 바로 변경(연필 아이콘으로 명확히). 카드 선택과 분리(stopPropagation).
                        <button onClick={(e) => s.startRename(p.id, p.name, e)} title="클릭해서 이름 변경" className="pb-preset-name"
                          style={css('display:flex; align-items:center; gap:6px; width:100%; height:28px; padding:0 8px; border:1px solid #f0e9e1; background:#faf7f3; border-radius:7px; cursor:text; text-align:left; font-family:inherit; transition:background .14s ease, border-color .14s ease;')}>
                          <span style={css('flex:1 1 0; font-size:13px; font-weight:600; color:#2a2521; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; min-width:0;')}>{p.name}</span>
                          <span style={css('flex:0 0 auto; color:#c3b9ad; font-size:12px;')}>✎</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}
