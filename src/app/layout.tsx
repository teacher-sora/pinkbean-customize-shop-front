import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '핑크빈 커마샵',
  description: '메이플스토리 스타일 코디(외형) 세팅 서비스 — 부위별 아이템 착용 · 염색 · 프리셋.',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        {/* Wanted Sans (Variable, OFL) — the design handoff's specified typeface. */}
        <link rel="preconnect" href="https://cdn.jsdelivr.net" />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/wanteddev/wanted-sans@v1.0.3/packages/wanted-sans/fonts/webfonts/variable/complete/WantedSansVariable.min.css"
        />
      </head>
      <body>{children}</body>
    </html>
  )
}
