import type { MetadataRoute } from 'next'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://pinkbean-customize.com'

// /sitemap.xml — 단일 페이지 앱(SPA)이라 루트 1개. 라우트가 늘면 여기에 추가.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: SITE_URL, lastModified: new Date(), changeFrequency: 'weekly', priority: 1 },
  ]
}
