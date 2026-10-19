// AI 코디 검색 · 코디 평가 · 기능 안내 서버(back 레포, Fly.io). 운영과 dev 가 따로 있다 — 고르는 기준은 광장(lib/plaza 의 plazaTarget)처럼 **호스트**다:
// 운영 도메인이면 운영 서버, 그 밖(dev 사이트 · 로컬)이면 dev 서버(back 의 dev 브랜치가 자동 배포된다).
// 주소는 환경변수로 덮어쓸 수 있다(운영 NEXT_PUBLIC_SEARCH_API, dev NEXT_PUBLIC_SEARCH_API_DEV).
const SEARCH_API_PROD = process.env.NEXT_PUBLIC_SEARCH_API || 'https://pinkbean-customize-shop-back.fly.dev'
const SEARCH_API_DEV = process.env.NEXT_PUBLIC_SEARCH_API_DEV || 'https://pinkbean-customize-shop-back-dev.fly.dev'
export const backApi = () => (typeof window !== 'undefined' && /^(www\.)?pinkbean-customize\.com$/.test(window.location.hostname) ? SEARCH_API_PROD : SEARCH_API_DEV)
