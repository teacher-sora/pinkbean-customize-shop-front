import type { Metadata } from 'next'
import { SEO_PAGES } from '@/lib/seoPages'
import { SITE_URL } from '@/lib/siteUrl'
import GuideShell, { GuideList, GuideNote, OpenShop } from './GuideShell'
import styles from './guide.module.css'

// /guide: 안내 글 모음. 검색엔진이 읽으라고 둔 글이고 앱 어디에서도 이어지지 않는다(sitemap 으로만 알린다).
const TITLE = '메이플 코디/커마 가이드'
const DESC = '메이플 코디, 메이플 커마, 염색, 헤어, 성형, 드레스룸까지 메이플스토리 캐릭터 외형을 웹에서 무료로 미리 맞춰 보는 방법을 모았습니다.'
export const metadata: Metadata = {
  title: TITLE,
  description: DESC,
  keywords: ['메이플 코디', '메이플 커마', '메이플 염색', '메이플 헤어', '메이플 성형', '메이플 드레스룸', '메이플 코디 추천'],
  alternates: { canonical: '/guide' },
  openGraph: { type: 'website', url: `${SITE_URL}/guide`, title: `핑크빈 커마샵 - ${TITLE}`, description: DESC },
}

const JSON_LD = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'CollectionPage',
      '@id': `${SITE_URL}/guide#page`,
      url: `${SITE_URL}/guide`,
      name: TITLE,
      description: DESC,
      inLanguage: 'ko-KR',
      isPartOf: { '@id': `${SITE_URL}/#website` },
      mainEntity: {
        '@type': 'ItemList',
        itemListElement: SEO_PAGES.map((p, i) => ({ '@type': 'ListItem', position: i + 1, name: p.h1, url: `${SITE_URL}/guide/${p.slug}` })),
      },
    },
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: '핑크빈 커마샵', item: SITE_URL },
        { '@type': 'ListItem', position: 2, name: '가이드', item: `${SITE_URL}/guide` },
      ],
    },
  ],
}

export default function GuideIndex() {
  return (
    <GuideShell>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }} />
      <nav aria-label="현재 위치" className={styles.crumb}>
        <a href="/">핑크빈 커마샵</a><span aria-hidden>›</span><span>가이드</span>
      </nav>
      <h1 className={styles.h1}>{TITLE}</h1>
      <p className={styles.lead}>
        핑크빈 커마샵은 메이플스토리 캐릭터의 코디와 커마를 게임 접속 없이 웹에서 무료로 미리 맞춰 보는 도구입니다.<br />
        무엇을 할 수 있는지 주제별로 정리했습니다.
      </p>
      <GuideNote />
      <hr className={styles.hr} />
      <GuideList pages={SEO_PAGES} />
      <OpenShop big />
    </GuideShell>
  )
}
