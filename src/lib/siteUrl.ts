// 사이트 정본 주소 한 곳. canonical · og:url · sitemap · robots.txt · JSON-LD 가 전부 이걸 쓴다.
//
// ⚠️ **www 는 정본이 아니다**(2026-08-20 결정 — 유저 데이터가 apex origin 의 localStorage 에 있다).
//    실제 서버도 `www.pinkbean-customize.com` → `pinkbean-customize.com` 으로 308 리디렉션한다.
//    그런데 배포 환경변수 `NEXT_PUBLIC_SITE_URL` 이 www 로 들어가 있어서(실측 2026-09-24)
//    canonical · sitemap · robots.txt 가 **리디렉션되는 주소**를 가리키고 있었다. 그러면
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
