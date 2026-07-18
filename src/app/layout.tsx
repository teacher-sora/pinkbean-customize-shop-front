import type { Metadata, Viewport } from 'next'
import './globals.css'

// 배포 도메인(Vercel 연결 예정). 다른 도메인/프리뷰면 NEXT_PUBLIC_SITE_URL 로 덮어씀.
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://pinkbean-customize.com'
const SITE_NAME = '핑크빈 커마샵'
const TITLE = '핑크빈 커마샵'
// 사이트/OG 설명 — 네이버 검색 노출용으로 80자 이내(핑크빈 말투). 검색 키워드(메이플 커마·코디)를 자연스럽게 포함.
const DESC =
  '메이플 커마를 웹에서 미리 뿅! 헤어·성형·염색·한벌옷·무기 입혀보고 프리셋 저장·공유까지, 핑크빈이랑 코디해요.'
// og:image — 넓은 임베드 이미지(Vercel Blob CDN). 카톡/디스코드/트위터/구글 미리보기에 사용.
const OG_IMAGE = 'https://qg2tk4czk48x6wl4.public.blob.vercel-storage.com/pinkbean_embed.png'
const OG_W = 1536, OG_H = 1024

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: TITLE, template: `%s · ${SITE_NAME}` },
  description: DESC,
  applicationName: SITE_NAME,
  keywords: [
    '메이플스토리', '메이플 커마', '커마샵', '커마', '코디', '외형', '코디 미리보기',
    '메이플 코디', '메이플 코디 미리보기', '메이플 외형', '메이플 드레스룸', '드레스룸', '메이플 커마 사이트',
    '염색', '발색', '헤어', '성형', '프리셋', '코디 공유', 'AI 코디 검색', '핑크빈', '핑크빈 커마샵',
    'MapleStory', 'MapleStory cosmetic', 'MapleStory dressroom', 'avatar', 'character customization',
  ],
  authors: [{ name: SITE_NAME, url: SITE_URL }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  category: 'game',
  alternates: { canonical: '/', languages: { 'ko-KR': '/' } },
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: SITE_NAME, statusBarStyle: 'default' },
  openGraph: {
    type: 'website',
    url: SITE_URL,
    siteName: SITE_NAME,
    title: TITLE,
    description: DESC,
    locale: 'ko_KR',
    images: [{ url: OG_IMAGE, width: OG_W, height: OG_H, alt: `${SITE_NAME} 미리보기`, type: 'image/png' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESC,
    images: [OG_IMAGE],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1, 'max-video-preview': -1 },
  },
  formatDetection: { telephone: false, email: false, address: false },
  // 검색엔진 소유확인(선택) — Vercel 환경변수로 주입. Google Search Console / 네이버 서치어드바이저.
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION || undefined,
    other: process.env.NEXT_PUBLIC_NAVER_SITE_VERIFICATION
      ? { 'naver-site-verification': process.env.NEXT_PUBLIC_NAVER_SITE_VERIFICATION }
      : {},
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  colorScheme: 'light',
  themeColor: '#ec86ac',
  // 가상 키보드가 뜰 때 100dvh 를 줄여 레이아웃을 다시 맞춘다(입력창 포커스 시 하단이 가려지지 않게).
  interactiveWidget: 'resizes-content',
}

// 검색엔진 리치 결과용 구조화 데이터(schema.org) — WebSite/Organization/WebApplication 그래프.
const JSON_LD = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebSite',
      '@id': `${SITE_URL}/#website`,
      url: SITE_URL,
      name: SITE_NAME,
      alternateName: ['메이플 커마', '메이플 코디', '메이플 드레스룸', '핑크빈 커마샵'],
      description: DESC,
      // 구조화 데이터의 keywords 는 meta keywords(구글이 무시)와 달리 검색엔진이 읽는 유효 신호.
      keywords: '메이플 커마, 메이플 코디, 메이플 드레스룸, 커마샵, 코디 미리보기, 염색, 프리셋, 핑크빈 커마샵',
      inLanguage: 'ko-KR',
      publisher: { '@id': `${SITE_URL}/#org` },
    },
    {
      '@type': 'Organization',
      '@id': `${SITE_URL}/#org`,
      name: SITE_NAME,
      alternateName: 'Pinkbean Customize',
      url: SITE_URL,
      logo: { '@type': 'ImageObject', url: `${SITE_URL}/logo.png`, width: 90, height: 90 },
      image: OG_IMAGE,
    },
    {
      '@type': 'WebApplication',
      '@id': `${SITE_URL}/#app`,
      name: SITE_NAME,
      alternateName: 'Pinkbean Customize',
      url: SITE_URL,
      description: DESC,
      applicationCategory: 'GameApplication',
      operatingSystem: 'Web',
      browserRequirements: 'Requires JavaScript',
      inLanguage: 'ko-KR',
      isAccessibleForFree: true,
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'KRW' },
      featureList: ['아이템 착용 미리보기', '염색(발색)', '프리셋 저장·공유', 'AI 코디 검색', '핑크빈 코디 평가'],
      screenshot: OG_IMAGE,
      publisher: { '@id': `${SITE_URL}/#org` },
    },
  ],
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
