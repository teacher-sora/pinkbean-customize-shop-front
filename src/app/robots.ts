import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/siteUrl'

// /robots.txt — 전체 크롤 허용(내부 API 라우트·개발용 뷰어 제외) + 사이트맵 위치.
// ⚠️ 공유 링크(`/?c=…`)는 **막지 않는다**. 그 URL 은 noindex 로 색인에서 빼는데, 크롤을 막으면 구글이
//    noindex 를 읽지 못해 오히려 내용 없이 색인될 수 있다("차단됐지만 색인이 생성됨"). 읽게 두고 빼는 게 맞다.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/api/', '/viewer'] },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  }
}
