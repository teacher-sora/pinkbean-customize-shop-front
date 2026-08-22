import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { SEO_PAGES, getSeoPage, seoSlugs } from '@/lib/seoPages'

// SEO/AEO 콘텐츠 페이지. 앱 UI 에서 링크하지 않고 sitemap 에만 게재 → 크롤러 전용 진입점.
// 정적 생성(SSG): 빌드 시 모든 slug 를 프리렌더한다.
export const dynamicParams = false
export function generateStaticParams() {
  return seoSlugs().map((slug) => ({ slug }))
}

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://pinkbean-customize.com'

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const p = getSeoPage(params.slug)
  if (!p) return {}
  const path = `/guide/${p.slug}`
  return {
    title: p.title,
    description: p.description,
    keywords: p.keywords,
    alternates: { canonical: path },
    openGraph: { type: 'article', url: `${SITE_URL}${path}`, title: p.title, description: p.description },
    twitter: { card: 'summary_large_image', title: p.title, description: p.description },
  }
}

export default function GuidePage({ params }: { params: { slug: string } }) {
  const p = getSeoPage(params.slug)
  if (!p) notFound()
  const path = `/guide/${p.slug}`
  const others = SEO_PAGES.filter((x) => x.slug !== p.slug)

  // JSON-LD: FAQPage(AEO) + Article + BreadcrumbList. 답변엔진/검색엔진이 구조를 읽는다.
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Article',
        '@id': `${SITE_URL}${path}#article`,
        headline: p.h1,
        description: p.description,
        inLanguage: 'ko-KR',
        datePublished: p.updated,
        dateModified: p.updated,
        keywords: p.keywords.join(', '),
        mainEntityOfPage: `${SITE_URL}${path}`,
        publisher: { '@id': `${SITE_URL}/#org` },
        isPartOf: { '@id': `${SITE_URL}/#website` },
      },
      {
        '@type': 'FAQPage',
        '@id': `${SITE_URL}${path}#faq`,
        mainEntity: p.faq.map((f) => ({
          '@type': 'Question',
          name: f.q,
          acceptedAnswer: { '@type': 'Answer', text: f.a },
        })),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: '핑크빈 커마샵', item: SITE_URL },
          { '@type': 'ListItem', position: 2, name: '가이드', item: `${SITE_URL}/guide` },
          { '@type': 'ListItem', position: 3, name: p.h1, item: `${SITE_URL}${path}` },
        ],
      },
    ],
  }

  return (
    <main style={{ maxWidth: 760, margin: '0 auto', padding: '40px 20px 72px', fontFamily: 'inherit', color: '#2a2521', lineHeight: 1.75 }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <nav aria-label="breadcrumb" style={{ fontSize: 13, color: '#a89e93', marginBottom: 18 }}>
        <a href="/" style={{ color: '#c76fa0', textDecoration: 'none' }}>핑크빈 커마샵</a>
        <span> · </span>
        <a href="/guide" style={{ color: '#c76fa0', textDecoration: 'none' }}>가이드</a>
      </nav>

      <h1 style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-0.02em', margin: '0 0 14px', color: '#c05a94' }}>{p.h1}</h1>
      <p style={{ fontSize: 16, color: '#4a423b', margin: '0 0 28px' }}>{p.lead}</p>

      <a href="/"
        style={{ display: 'inline-block', margin: '0 0 32px', padding: '11px 20px', background: '#ec86ac', color: '#fff', fontWeight: 700, borderRadius: 10, textDecoration: 'none' }}>
        커마샵에서 직접 해보기 →
      </a>

      {p.sections.map((sec) => (
        <section key={sec.h2} style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 10px', color: '#2a2521' }}>{sec.h2}</h2>
          {sec.body.map((para, i) => (
            <p key={i} style={{ margin: '0 0 10px', color: '#4a423b' }}>{para}</p>
          ))}
        </section>
      ))}

      <section style={{ marginTop: 40 }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 16px', color: '#c05a94' }}>자주 묻는 질문</h2>
        {p.faq.map((f) => (
          <div key={f.q} style={{ marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid #f0e9e1' }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 6px', color: '#2a2521' }}>{f.q}</h3>
            <p style={{ margin: 0, color: '#4a423b' }}>{f.a}</p>
          </div>
        ))}
      </section>

      <section style={{ marginTop: 36 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 10px', color: '#8a8075' }}>관련 가이드</h2>
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          {others.map((o) => (
            <li key={o.slug} style={{ marginBottom: 6 }}>
              <a href={`/guide/${o.slug}`} style={{ color: '#c76fa0' }}>{o.h1}</a>
            </li>
          ))}
        </ul>
      </section>

      <p style={{ marginTop: 40 }}>
        <a href="/" style={{ color: '#ec86ac', fontWeight: 700 }}>→ 핑크빈 커마샵으로 이동</a>
      </p>
    </main>
  )
}
