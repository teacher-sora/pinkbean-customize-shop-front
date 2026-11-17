// 사이트 정본 주소 한 곳. canonical · og:url · sitemap · robots.txt · JSON-LD 가 전부 이걸 쓴다.
//
// ⚠️ **www 는 정본이 아니다**(유저 데이터가 apex origin 의 localStorage 에 있다).
//    실제 서버도 `www.pinkbean-customize.com` → `pinkbean-customize.com` 으로 308 리디렉션한다.
//    배포 환경변수 `NEXT_PUBLIC_SITE_URL` 이 www 로 들어가 있으면
//    canonical · sitemap · robots.txt 가 **리디렉션되는 주소**를 가리킨다. 그러면
//      · canonical 이 자기 자신을 가리키지 않아 구글이 무시하고 스스로 정본을 고르고,
//      · sitemap 의 모든 URL 이 "페이지에 리디렉션이 있음"으로 잡힌다.
//    환경변수가 www 로 오더라도 여기서 한 번 깎아 낸다 — 정본은 코드가 쥔다.
const RAW = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://pinkbean-customize.com'

const normalize = (u: string) => {
  try {
    const url = new URL(u)
    url.hostname = url.hostname.replace(/^www\./, '')
    return url.origin // 경로·쿼리·끝 슬래시를 떼어 낸 순수 origin
  } catch {
    return 'https://pinkbean-customize.com'
  }
}

export const SITE_URL = normalize(RAW)

export const SITE_NAME = '핑크빈 커마샵'
// 기본 og:image — 넓은 임베드 이미지(Vercel Blob CDN). 카톡/디스코드/트위터/구글 미리보기에 쓴다(레이아웃 · 아이템 코디 룩북 페이지)
export const DEFAULT_OG = { url: 'https://qg2tk4czk48x6wl4.public.blob.vercel-storage.com/pinkbean_embed.png', width: 1536, height: 1024, alt: `${SITE_NAME} 미리보기`, type: 'image/png' }
