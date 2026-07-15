import type { Metadata, Viewport } from 'next'
import './globals.css'

// 배포 도메인(Vercel 연결 예정). 다른 도메인/프리뷰면 NEXT_PUBLIC_SITE_URL 로 덮어씀.
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://pinkbean-customize.com'
const SITE_NAME = '핑크빈 커마샵'
const TITLE = '핑크빈 커마샵 — 메이플스토리 코디 미리보기'
const DESC =
  '메이플스토리 캐릭터의 외형(코디)을 웹에서 미리 꾸며보세요. 헤어·성형·모자·한벌옷·무기 등 부위별 아이템 착용, 염색(발색), 프리셋 저장·공유, AI 코디 검색까지 설치 없이 바로.'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: TITLE, template: `%s · ${SITE_NAME}` },
  description: DESC,
  applicationName: SITE_NAME,
  keywords: [
    '메이플스토리', '메이플 커마', '커마샵', '커마', '코디', '외형', '코디 미리보기',
    '메이플 코디', '염색', '발색', '헤어', '성형', '프리셋', '코디 공유', 'AI 코디 검색',
    '핑크빈', 'MapleStory', 'cosmetic', 'avatar', 'character customization',
  ],
  authors: [{ name: SITE_NAME }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  category: 'game',
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    url: SITE_URL,
    siteName: SITE_NAME,
    title: TITLE,
    description: DESC,
    locale: 'ko_KR',
    // 이미지는 app/opengraph-image.(png|jpg) 파일 규칙으로 자동 연결됨(파일만 추가하면 됨).
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESC,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1, 'max-video-preview': -1 },
  },
  formatDetection: { telephone: false, email: false, address: false },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  colorScheme: 'light',
  themeColor: '#ec86ac',
}

// 검색엔진 리치 결과용 구조화 데이터(schema.org). 무료 웹 게임 도구로 표기.
const JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: SITE_NAME,
  alternateName: 'Pinkbean Customize',
  url: SITE_URL,
  description: DESC,
  applicationCategory: 'GameApplication',
  operatingSystem: 'Web',
  inLanguage: 'ko-KR',
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'KRW' },
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
        {/* 이미지 CDN 미리 연결(초기 로딩 체감 개선) */}
        <link rel="preconnect" href="https://cdn.pinkbean-customize.com" crossOrigin="" />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }} />
      </head>
      <body>{children}</body>
    </html>
  )
}
