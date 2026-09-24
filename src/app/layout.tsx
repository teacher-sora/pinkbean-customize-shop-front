import type { Metadata, Viewport } from 'next'
import { Analytics } from '@vercel/analytics/next'
import { SpeedInsights } from '@vercel/speed-insights/next'
import './globals.css'
import NoNativeZoom from './NoNativeZoom'
import { SITE_URL } from '@/lib/siteUrl'

const SITE_NAME = '핑크빈 커마샵'
const TITLE = '핑크빈 커마샵'
// 사이트/OG 설명 — 네이버 검색 노출용으로 80자 이내. 웹 코디 + AI 코디 검색을 알리고 키워드(메이플 커마·코디)를 자연스럽게 포함.
const DESC =
  '메이플 커마를 웹에서 바로 미리 해보고, 원하는 코디는 AI 검색으로 찾아봐요. 헤어·성형·염색·프리셋도 한 번에.'
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
  // appleWebApp.capable 이 내보내는 apple-mobile-web-app-capable 은 크롬에서 deprecated 경고가 난다.
  // 표준 이름을 함께 넣어 둔다(사파리는 apple- 쪽만 읽으므로 둘 다 필요).
  other: { 'mobile-web-app-capable': 'yes' },
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
    // max-image-preview:none = 구글 검색결과에 썸네일(임베드 이미지)을 띄우지 않는다.
    // 검색결과 썸네일 크기는 구글이 정해 "화면 가득"이 불가능하므로, 작은 썸네일을 아예 뺀다.
    // ⚠️ 이건 검색결과 전용 신호다 — 아래 openGraph/twitter 의 og:image 는 그대로라
    //    카톡·디스코드·트위터 링크 공유 미리보기 이미지는 유지된다.
    googleBot: { index: true, follow: true, 'max-image-preview': 'none', 'max-snippet': -1, 'max-video-preview': -1 },
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
  viewportFit: 'cover', // 핸드오프 v2 README 지정값
  // 페이지 자체의 핀치/더블탭 확대를 막는다(모바일에서 얼굴 확대 편집 시 화면이 통째로 확대되던 문제).
  // 확대가 필요한 곳은 DotDialog 캔버스뿐이고, 그건 pointer 기반 자체 핀치라 네이티브 확대에 의존하지 않는다.
  // Android(Chrome) 는 이 설정을 존중. iOS Safari 는 무시하므로 NoNativeZoom 이 gesture 이벤트로 보강한다.
  maximumScale: 1,
  userScalable: false,
  colorScheme: 'light',
  themeColor: '#ec86ac',
  // 가상 키보드가 떠도 레이아웃 높이를 줄이지 않는다(키보드는 화면 위에 겹쳐 보이는 영역만 줄이고, 브라우저가 입력칸이 보이게 이동시킨다).
  // 2026-09-21 resizes-content → resizes-visual: 높이가 줄면 문서가 화면보다 길어져 입력 포커스가 마스크 뒤 문서를 스크롤했고,
  // 키보드가 닫힐 때마다 레이아웃이 다시 계산되며 하단 빈 공간·터치 어긋남이 생겼다(사용자 제보·지시). iOS 는 원래 이 방식이다.
  interactiveWidget: 'resizes-visual',
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
        {/*
          새로고침 점멸 방지 — **되살릴 게 실제로 있을 때만** 켠다.

          서버가 만든 HTML 은 언제나 기본값(코디 탭 · 전체 칩 선택 · 빈 목록)이라, 그 화면이 한 번
          그려진 뒤 sessionStorage 값으로 바뀌면 토글이 튀고 목록이 갈린다. 그래서 그런 경우에 한해
          **토글 없는 빈 뼈대**로 시작하고, 되살린 값이 그려질 때 한 번에 채운다.

          판단 기준은 내비게이션 종류(reload)가 아니라 **저장된 값이 기본 화면과 다른가**(dirty)다.
          탭 복제·주소창 재진입도 sessionStorage 를 물려받아 똑같이 되살아나는데, 그건 'reload' 가
          아니라 예전 조건으로는 뼈대 없이 점멸했다. 첫 진입은 저장된 값 자체가 없어 여기서 즉시
          빠져나간다 → SSG 출력이 그대로 쓰인다(연산·지연 0).
          표시를 끄는 건 되살린 화면이 실제로 커밋된 뒤(ShopContext) — 고정 대기 시간은 쓰지 않는다.
        */}
        <script dangerouslySetInnerHTML={{ __html: "try{var r=sessionStorage.getItem('pb_ui_session_v1');if(r&&JSON.parse(r).dirty)document.documentElement.setAttribute('data-pb-csr','1')}catch(e){}" }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }} />
        {/* NEXON Open API Analytics — 넥슨 콘솔 발급 스크립트 그대로. 연동 확인이 SSR HTML 의 태그를 보므로 next/script 대신 원형 태그. */}
        <script type="text/javascript" src="https://openapi.nexon.com/js/analytics.js?app_id=316464" async />
      </head>
      <body><NoNativeZoom />{children}<Analytics /><SpeedInsights /></body>
    </html>
  )
}
