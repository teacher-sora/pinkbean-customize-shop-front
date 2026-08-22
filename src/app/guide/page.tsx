import type { Metadata } from 'next'
import { SEO_PAGES } from '@/lib/seoPages'

// /guide — 콘텐츠 페이지 인덱스(크롤러 허브). 앱 UI 에서 링크하지 않고 sitemap 에만 게재한다.
export const metadata: Metadata = {
  title: '메이플 커마·코디 가이드 — 핑크빈 커마샵',
  description: '메이플 커마, 메이플 코디, 메이플스토리 드레스룸 등 캐릭터 외형 미리보기 관련 가이드 모음.',
  keywords: ['메이플 커마', '메이플 코디', '메이플스토리', '커마샵 가이드'],
  alternates: { canonical: '/guide' },
}

export default function GuideIndex() {
  return (
    <main style={{ maxWidth: 760, margin: '0 auto', padding: '40px 20px 72px', fontFamily: 'inherit', color: '#2a2521', lineHeight: 1.75 }}>
      <nav aria-label="breadcrumb" style={{ fontSize: 13, color: '#a89e93', marginBottom: 18 }}>
        <a href="/" style={{ color: '#c76fa0', textDecoration: 'none' }}>핑크빈 커마샵</a>
      </nav>
      <h1 style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-0.02em', margin: '0 0 14px', color: '#c05a94' }}>메이플 커마·코디 가이드</h1>
      <p style={{ fontSize: 16, color: '#4a423b', margin: '0 0 28px' }}>
        메이플스토리 캐릭터 커마·코디·드레스룸에 대한 안내입니다. 핑크빈 커마샵은 게임 없이 웹에서 무료로 캐릭터 외형을 미리보기 하는 도구입니다.
      </p>
      <a href="/" style={{ display: 'inline-block', margin: '0 0 32px', padding: '11px 20px', background: '#ec86ac', color: '#fff', fontWeight: 700, borderRadius: 10, textDecoration: 'none' }}>
        커마샵에서 직접 해보기 →
      </a>
      <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
        {SEO_PAGES.map((p) => (
          <li key={p.slug} style={{ marginBottom: 18, paddingBottom: 18, borderBottom: '1px solid #f0e9e1' }}>
            <a href={`/guide/${p.slug}`} style={{ fontSize: 19, fontWeight: 700, color: '#c76fa0', textDecoration: 'none' }}>{p.h1}</a>
            <p style={{ margin: '6px 0 0', color: '#6e645c', fontSize: 14 }}>{p.description}</p>
          </li>
        ))}
      </ul>
    </main>
  )
}
