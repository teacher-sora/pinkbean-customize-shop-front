'use client'

import { css } from '@/lib/style'
import { useShop } from './ShopContext'

export default function Toast() {
  const { toast, toastText } = useShop()
  const style = `position:fixed; bottom:32px; left:50%; z-index:70; display:flex; align-items:center; gap:8px; padding:12px 22px 12px 18px; background:linear-gradient(100deg,#ec86ac,#b57bdb); color:#fff; border-radius:999px; font-size:13px; font-weight:600; box-shadow:0 10px 28px rgba(180,123,219,.38); pointer-events:none; transition:opacity .28s ease, transform .28s cubic-bezier(.22,.61,.36,1); opacity:${toast ? 1 : 0}; transform:translate(-50%, ${toast ? '0' : '12px'});`
  return (
    <div style={css(style)}>
      <span style={css('width:8px; height:8px; border-radius:50%; background:#fff; box-shadow:0 0 0 3px rgba(255,255,255,.35);')} />
      {toastText}
    </div>
  )
}
