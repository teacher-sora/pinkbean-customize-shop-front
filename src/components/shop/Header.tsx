'use client'

import { PRIMARIES } from '@/lib/catalog'
import { css } from '@/lib/style'
import { isStacked } from '@/lib/useBreakpoint'
import { useShop } from './ShopContext'

export default function Header() {
  const { primary, setPrimary, hoverPrimary, setHoverPrimary, shareCurrent, rateCodi, bp } = useShop()
  const stacked = isStacked(bp)
  const mobile = bp === 'mobile'

  const tabs = (
    <div style={css(`display:flex; align-items:center; gap:5px; padding:3px; background:#f4ecf3; border-radius:10px; ${stacked ? 'overflow-x:auto; overflow-y:hidden; min-width:0; -webkit-overflow-scrolling:touch;' : ''}`)} className={stacked ? 'pb-scroll-thin' : undefined}>
      {PRIMARIES.map((p) => {
        const on = p.id === primary
        const hov = hoverPrimary === p.id
        let bg = on ? '#ec86ac' : 'transparent', col = on ? '#fff' : '#8a8075'
        if (hov) { if (on) bg = '#e879a4'; else { bg = '#eadff0'; col = '#a15b93' } }
        return (
          <button key={p.id} onClick={() => setPrimary(p.id)} onMouseEnter={() => setHoverPrimary(p.id)} onMouseLeave={() => setHoverPrimary(null)}
            className="pb-tab" data-label={p.label}
            style={css(`flex:0 0 auto; height:34px; padding:0 ${bp === 'mobile' ? 12 : 18}px; border:none; border-radius:8px; cursor:pointer; font-family:inherit; font-size:13px; white-space:nowrap; color:${col}; background:${bg}; transition:background .28s ease, color .28s ease;`)}><span style={{ fontWeight: on ? 600 : 500 }}>{p.label}</span></button>
        )
      })}
    </div>
  )

  const share = (
    <button onClick={shareCurrent} className="pb-h-solid" style={css('flex:0 0 auto; height:36px; padding:0 18px; border:none; background:#ec86ac; border-radius:8px; font-family:inherit; font-size:13px; font-weight:600; color:#fff; cursor:pointer; white-space:nowrap; transition:background .18s ease, transform .18s ease, filter .18s ease;')}>코디 공유</button>
  )

  // 핑크빈 코디 평가 — 핑크빈 컬러(보라+핑크) 체크무늬는 "테두리 프레임"에만, 내부는 연핑크(hover 시 맑게 채움).
  // Qwen 저가 모델 평가는 이후 연결(지금은 스텁).
  const rate = (
    <button onClick={rateCodi} className="pb-rate" title="핑크빈의 코디 평가"
      style={css('flex:0 0 auto; height:36px; padding:3px; border:none; border-radius:9px; cursor:pointer; background-color:#f4a8ca; background-image:linear-gradient(45deg, rgba(165,115,215,.4) 25%, transparent 25%, transparent 75%, rgba(165,115,215,.4) 75%), linear-gradient(45deg, rgba(165,115,215,.4) 25%, transparent 25%, transparent 75%, rgba(165,115,215,.4) 75%); background-size:8px 8px; background-position:0 0, 4px 4px;')}>
      <span className="pb-rate-inner" style={css('display:flex; align-items:center; height:100%; border-radius:6px; background:#fce9f1;')}>
        <span className="pb-rate-fill" />
        <span className="pb-rate-text" style={css(`position:relative; z-index:1; padding:0 ${mobile ? 12 : 15}px; color:#c05a94; font-family:inherit; font-size:13px; font-weight:700; white-space:nowrap;`)}>코디 평가</span>
      </span>
    </button>
  )

  const logo = (
    <div style={css('display:flex; align-items:center; gap:10px; flex:0 0 auto; min-width:0;')}>
      <img src="/logo.png" alt="핑크빈 커마샵 로고" width={30} height={30} loading="eager" decoding="async" style={{ width: 30, height: 30, borderRadius: '50%', objectFit: 'cover', flex: '0 0 auto' }} />
      <div style={css('font-size:19px; font-weight:700; letter-spacing:-0.02em; white-space:nowrap; background:linear-gradient(100deg, #ec86ac, #f0a9c4 55%, #c98fe0); -webkit-background-clip:text; background-clip:text; -webkit-text-fill-color:transparent; color:transparent;')}>핑크빈 커마샵</div>
      {!stacked && <span style={css('font-size:11px; font-weight:700; color:#c76fa0; background:#fbe6f1; padding:3px 9px; border-radius:20px; flex:0 0 auto; letter-spacing:0.02em;')}>V1</span>}
    </div>
  )

  // 좁은 화면: 2행(로고+공유 / 탭 가로 스크롤)
  if (stacked) {
    return (
      <header style={css('flex:0 0 auto; display:flex; flex-direction:column; gap:8px; padding-bottom:2px;')}>
        <div style={css('display:flex; align-items:center; justify-content:space-between; gap:10px;')}>
          {logo}
          <div style={css('display:flex; align-items:center; gap:8px; flex:0 0 auto;')}>{rate}{share}</div>
        </div>
        {tabs}
      </header>
    )
  }

  // 데스크탑/절반: 단일 행
  return (
    <header style={css('flex:0 0 auto; height:56px; display:flex; align-items:center; justify-content:space-between; gap:12px;')}>
      {logo}
      {tabs}
      <div style={css('display:flex; align-items:center; gap:12px; flex:0 0 auto;')}>
        <span style={css('display:flex; align-items:center; gap:6px; font-size:12px; color:#a89e93; white-space:nowrap;')}>
          <span style={css('width:7px; height:7px; border-radius:50%; background:#5ec269;')} />자동 저장됨
        </span>
        {rate}
        {share}
      </div>
    </header>
  )
}
