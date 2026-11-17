import type { MetadataRoute } from 'next'
import { SEO_PAGES } from '@/lib/seoPages'
import { SITE_URL } from '@/lib/siteUrl'
import { lookbookIds, lookbookIndex } from '@/lib/server/lookbook'

// /sitemap.xml: 앱(루트) + 안내 글(/guide, /guide/*) + 아이템 코디 룩북(/lookbook/<id>).
// 안내 글은 앱에서 이어지지 않으므로 여기가 검색엔진에 알리는 유일한 길이다. 아이템 코디 룩북도 검색엔진이 아이템 이름으로 찾게 하려고 모두 싣는다
// (캐시 아이템이거나 실제 코디 표본에 있는 것 — lib/server/lookbook, 약 1만 3천 개. 한 파일 5만 개 제한 안이다).
// 앱의 탭 주소(/plaza 등)는 대표 주소가 루트라 넣지 않는다. 하루마다 다시 만든다(목록 파일을 받는 일이 무겁다).
export const revalidate = 86400

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [ids, { built }] = await Promise.all([lookbookIds().catch(() => [] as string[]), lookbookIndex()])
  const lookMod = built ? new Date(built) : new Date()
  return [
    { url: SITE_URL, lastModified: new Date(), changeFrequency: 'weekly', priority: 1 },
    { url: `${SITE_URL}/guide`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    ...SEO_PAGES.map((p) => ({
      url: `${SITE_URL}/guide/${p.slug}`,
      lastModified: new Date(p.updated),
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    })),
    ...ids.map((id) => ({ url: `${SITE_URL}/lookbook/${id}`, lastModified: lookMod, changeFrequency: 'weekly' as const, priority: 0.6 })),
  ]
}
