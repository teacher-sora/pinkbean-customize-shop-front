import type { MetadataRoute } from 'next'
import { SEO_PAGES } from '@/lib/seoPages'
import { SITE_URL } from '@/lib/siteUrl'

// /sitemap.xml — 앱(루트) + 안내 글(/guide · /guide/*). 앱의 탭 주소(/plaza 등)는 대표 주소가 루트라 넣지 않는다.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: SITE_URL, lastModified: new Date(), changeFrequency: 'weekly', priority: 1 },
    { url: `${SITE_URL}/guide`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    ...SEO_PAGES.map((p) => ({
      url: `${SITE_URL}/guide/${p.slug}`,
      lastModified: new Date(p.updated),
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    })),
  ]
}
