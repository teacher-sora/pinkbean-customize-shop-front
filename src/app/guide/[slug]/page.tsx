import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { SEO_PAGES, getSeoPage, seoSlugs } from '@/lib/seoPages'
import { SITE_URL } from '@/lib/siteUrl'
import GuideShell, { GuideList, GuideNote, Lines, OpenShop } from '../GuideShell'
import styles from '../guide.module.css'

// 안내 글 한 편(lib/seoPages). 검색엔진이 읽으라고 둔 글이고 앱 어디에서도 이어지지 않는다(sitemap 으로만 알린다).
// 정적 생성(SSG): 빌드 시 모든 slug 를 프리렌더한다.
export const dynamicParams = false
export function generateStaticParams() {
  return seoSlugs().map((slug) => ({ slug }))
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const p = getSeoPage(params.slug)
  if (!p) return {}
  const path = `/guide/${p.slug}`
  return {
    title: p.title,
    description: p.description,
    keywords: p.keywords,
    alternates: { canonical: path },
    openGraph: { type: 'article', url: `${SITE_URL}${path}`, title: `핑크빈 커마샵 - ${p.title}`, description: p.description },
    twitter: { card: 'summary_large_image', title: `핑크빈 커마샵 - ${p.title}`, description: p.description },
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
    <GuideShell>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <nav aria-label="현재 위치" className={styles.crumb}>
        <a href="/">핑크빈 커마샵</a><span aria-hidden>›</span><a href="/guide">가이드</a><span aria-hidden>›</span><span>{p.h1}</span>
      </nav>
      <h1 className={styles.h1}>{p.h1}</h1>
      <p className={styles.lead}><Lines text={p.lead} /></p>
      <GuideNote />
      <hr className={styles.hr} />

      {p.sections.map((sec) => (
        <section key={sec.h2} className={styles.sec}>
          <h2 className={styles.h2}>{sec.h2}</h2>
          {sec.body.map((para, i) => <p key={i} className={styles.p}><Lines text={para} /></p>)}
        </section>
      ))}
      <hr className={styles.hr} />

      <section className={styles.sec}>
        <h2 className={styles.h2}>자주 묻는 질문</h2>
        <ul className={styles.faq}>
          {p.faq.map((f) => (
            <li key={f.q}>
              <h3 className={styles.q}>{f.q}</h3>
              <p className={styles.a}><Lines text={f.a} /></p>
            </li>
          ))}
        </ul>
      </section>

      <section className={styles.sec}>
        <h2 className={styles.h2}>다른 안내</h2>
        <GuideList pages={others} />
      </section>

      <OpenShop big />
    </GuideShell>
  )
}
