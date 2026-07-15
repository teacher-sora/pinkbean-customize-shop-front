import type { MetadataRoute } from 'next'

// /manifest.webmanifest — PWA(설치형) 메타. 검색/모바일 신뢰도 및 설치 경험용.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: '핑크빈 커마샵 — 메이플스토리 코디 미리보기',
    short_name: '핑크빈 커마샵',
    description: '메이플스토리 캐릭터 외형(코디)을 웹에서 미리보기 · 착용 · 염색 · 프리셋 · AI 코디 검색.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#fbf4f8',
    theme_color: '#ec86ac',
    lang: 'ko',
    dir: 'ltr',
    orientation: 'any',
    categories: ['games', 'entertainment'],
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
