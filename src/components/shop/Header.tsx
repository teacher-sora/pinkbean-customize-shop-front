'use client'

import { PRIMARIES } from '@/lib/catalog'
import { css } from '@/lib/style'
import { useShop } from './ShopContext'

export default function Header() {
  const { primary, setPrimary, hoverPrimary, setHoverPrimary, shareCurrent } = useShop()
  return (
    <header style={css('flex:0 0 auto; height:56px; display:flex; align-items:center; justify-content:space-between;')}>
      <div style={css('display:flex; align-items:center; gap:10px;')}>
        <img src="/pinkbean.png" alt="핑크빈 커마샵 로고" width={30} height={30} style={{ width: 30, height: 30, borderRadius: '50%', objectFit: 'cover', flex: '0 0 auto' }} />
        <div style={css('font-size:19px; font-weight:700; letter-spacing:-0.02em; background:linear-gradient(100deg, #ec86ac, #f0a9c4 55%, #c98fe0); -webkit-background-clip:text; background-clip:text; -webkit-text-fill-color:transparent; color:transparent;')}>핑크빈 커마샵</div>
        <span style={css('font-size:11px; font-weight:500; color:#9a8f84; background:#e9e2da; padding:3px 8px; border-radius:20px;')}>BETA</span>
      </div>
      <div style={css('display:flex; align-items:center; gap:5px; padding:3px; background:#f4ecf3; border-radius:10px;')}>
        {PRIMARIES.map((p) => {
          const on = p.id === primary
          const hov = hoverPrimary === p.id
          let bg = on ? '#ec86ac' : 'transparent', col = on ? '#fff' : '#8a8075'
          if (hov) { if (on) bg = '#e879a4'; else { bg = '#eadff0'; col = '#a15b93' } }
          return (
            <button key={p.id} onClick={() => setPrimary(p.id)} onMouseEnter={() => setHoverPrimary(p.id)} onMouseLeave={() => setHoverPrimary(null)}
              style={css(`flex:0 0 auto; height:34px; padding:0 18px; border:none; border-radius:8px; cursor:pointer; font-family:inherit; font-size:13px; font-weight:${on ? 600 : 500}; color:${col}; background:${bg}; transition:background .28s ease, color .28s ease;`)}>{p.label}</button>
          )
        })}
      </div>
      <div style={css('display:flex; align-items:center; gap:12px;')}>
        <span style={css('display:flex; align-items:center; gap:6px; font-size:12px; color:#a89e93;')}>
          <span style={css('width:7px; height:7px; border-radius:50%; background:#5ec269;')} />자동 저장됨
        </span>
        <button onClick={shareCurrent} style={css('height:36px; padding:0 18px; border:none; background:#ec86ac; border-radius:8px; font-family:inherit; font-size:13px; font-weight:600; color:#fff; cursor:pointer; transition:background .18s ease, transform .18s ease;')}>코디 공유</button>
      </div>
    </header>
  )
}
