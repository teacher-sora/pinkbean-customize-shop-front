import type { MetadataRoute } from 'next'
import { SEO_PAGES } from '@/lib/seoPages'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://pinkbean-customize.com'

// /sitemap.xml — 앱은 단일 페이지(루트) + 크롤러 전용 콘텐츠 페이지(/guide/*).
// 콘텐츠 페이지는 앱 UI 에서 링크하지 않으므로(유저 미노출) sitemap 이 유일한 색인 경로다.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: SITE_URL, lastModified: new Date(), changeFrequency: 'weekly', priority: 1 },
    { url: `${SITE_URL}/guide`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },
    ...SEO_PAGES.map((p) => ({
      url: `${SITE_URL}/guide/${p.slug}`,
      lastModified: new Date(p.updated),
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    })),
  ]
}
