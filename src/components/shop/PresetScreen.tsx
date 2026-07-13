'use client'

import { presetThumb } from '@/lib/color'
import { css } from '@/lib/style'
import { useShop } from './ShopContext'

export default function PresetScreen() {
  const s = useShop()
  const liveCount = Object.keys(s.equipped).length

  const presetCards = s.presets.map((p) => {
    const on = s.selectedPreset === p.id
    const cnt = on ? liveCount : s.presetData[p.id] ? Object.keys(s.presetData[p.id].equipped || {}).length : 0
    return {
      p, on, editing: s.editingPreset === p.id,
      countLabel: cnt > 0 ? `${cnt}종 착용` : '비어 있음',
      cardStyle: on ? 'border-color:#ec86ac; background:#fdf4f8; transform:translateY(-5px);' : '',
      thumbStyle: `position:relative; width:100%; aspect-ratio:3/4; background:${presetThumb(p.id)};`,
      selBadgeStyle: `position:absolute; top:8px; left:8px; display:inline-flex; align-items:center; gap:4px; height:20px; padding:0 9px; border-radius:20px; background:rgba(255,255,255,0.92); color:#d76d9a; border:1px solid #f4cfdf; font-size:10px; font-weight:600; pointer-events:none; box-shadow:0 2px 8px rgba(214,109,154,.18); transition:opacity .22s ease, transform .22s ease; opacity:${on ? 1 : 0}; transform:translateY(${on ? '0' : '-6px'});`,
    }
  })

  return (
    <section style={css('flex:0 0 65%; min-width:0; background:#fff; border:1px solid #e7ded4; border-radius:16px; display:flex; flex-direction:column; overflow:hidden;')}>
      <div style={css('flex:0 0 auto; height:58px; padding:0 22px; display:flex; align-items:center; gap:14px; border-bottom:1px solid #f0e9e1;')}>
        <span style={css('font-size:15px; font-weight:700;')}>프리셋</span>
      </div>

      <div style={css('flex:1 1 auto; min-height:0; display:flex; flex-direction:column;')}>
        {/* 임포트 바 */}
        <div style={css('flex:0 0 auto; padding:16px 22px; display:flex; flex-direction:column; gap:10px;')}>
          <div style={css('display:flex; align-items:center; gap:6px;')}>
            {(['nick', 'code'] as const).map((mode) => {
              const isSel = s.importMode === mode
              const th = s.hoverMode === mode && !isSel
              const bd = isSel ? '#ec86ac' : th ? '#eeb2ce' : '#e7ded4'
              const col = isSel ? '#d76d9a' : th ? '#d76d9a' : '#8a8075'
              return (
                <button key={mode} onClick={() => s.setImportMode(mode)} onMouseEnter={() => s.setHoverMode(mode)} onMouseLeave={() => s.setHoverMode(null)}
                  style={css(`height:34px; padding:0 12px; border-radius:8px; cursor:pointer; font-family:inherit; font-size:12px; font-weight:${isSel ? 600 : 500}; border:1px solid ${bd}; background:${isSel ? '#fce9f1' : '#fff'}; color:${col}; transition:background .26s ease, border-color .26s ease, color .26s ease;`)}>{mode === 'nick' ? '닉네임' : '코드'}</button>
              )
            })}
            <span style={css('font-size:11px; color:#b7ada2; margin-left:2px;')}>불러온 코디는 선택한 프리셋에 덮어써져요</span>
          </div>
          <div style={css('display:flex; align-items:center; gap:10px;')}>
            <input value={s.nickInput} onChange={(e) => s.setNickInput(e.target.value)} placeholder={s.importMode === 'code' ? '코디 공유 코드 입력 (예: PB-3F9AK2)' : '캐릭터 닉네임 입력'}
              style={css('flex:1 1 0; min-width:0; height:38px; padding:0 14px; border:1px solid #e7ded4; border-radius:9px; background:#faf7f3; font-family:inherit; font-size:13px; outline:none; transition:border-color .14s ease;')} />
            <button onClick={s.importFetch} style={css('flex:0 0 auto; height:38px; padding:0 18px; border:none; background:linear-gradient(100deg,#ec86ac,#b57bdb); border-radius:9px; font-family:inherit; font-size:13px; font-weight:600; color:#fff; cursor:pointer; transition:filter .15s ease, transform .15s ease;')}>불러오기</button>
          </div>
        </div>
        <div style={css('flex:0 0 auto; height:1px; margin:0 22px; background:#f0e9e1;')} />

        {/* 프리셋 그리드 */}
        <div className="pb-scroll pb-scroll-thin" style={css('flex:1 1 auto; min-height:0; overflow:hidden auto; padding:18px 22px;')}>
          <div style={css('display:grid; grid-template-columns:repeat(5,minmax(0,1fr)); gap:12px;')}>
            {presetCards.map((pc) => (
              <div key={pc.p.id} className="pb-presetwrap">
                <div onClick={() => s.selectPreset(pc.p.id)} className="pb-preset" style={css(pc.cardStyle)}>
                  <div style={css(pc.thumbStyle)}>
                    <span style={css(pc.selBadgeStyle)}>선택됨</span>
                    <button onClick={(e) => { e.stopPropagation(); s.sharePreset(pc.p) }} title="공유 링크 복사" style={css('position:absolute; top:7px; right:7px; width:24px; height:24px; border:none; border-radius:7px; background:rgba(255,255,255,0.85); color:#8a8075; font-family:inherit; font-size:11px; font-weight:600; cursor:pointer; transition:background .14s ease, color .14s ease;')}>↗</button>
                  </div>
                  <div style={css('padding:10px 11px 11px; display:flex; flex-direction:column; gap:3px;')}>
                    {pc.editing ? (
                      <input autoFocus value={s.editName} onChange={(e) => s.setEditName(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur() } else if (e.key === 'Escape') { s.setEditingPreset(null); s.setEditName('') } }}
                        onBlur={s.commitRename} onClick={(e) => e.stopPropagation()}
                        style={css('width:100%; height:26px; padding:0 8px; border:1.5px solid #ec86ac; border-radius:6px; background:#fff; font-family:inherit; font-size:13px; font-weight:600; color:#2a2521; outline:none;')} />
                    ) : (
                      <div style={css('display:flex; align-items:center; gap:5px;')}>
                        <span style={css('font-size:13px; font-weight:600; color:#2a2521; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; min-width:0;')}>{pc.p.name}</span>
                        <button onClick={(e) => s.startRename(pc.p.id, pc.p.name, e)} title="이름 변경" style={css('flex:0 0 auto; width:22px; height:22px; border:none; border-radius:6px; background:transparent; color:#c3b9ad; font-family:inherit; font-size:12px; cursor:pointer; transition:background .14s ease, color .14s ease;')}>✎</button>
                      </div>
                    )}
                    <span style={css('font-size:11px; color:#a89e93;')}>{pc.countLabel}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
