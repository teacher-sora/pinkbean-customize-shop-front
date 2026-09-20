// 광장 캐시 공용 값. route.ts 는 정해진 export 만 허용해서(빌드 타입 검사) 따로 둔다.

// 좋아요 수가 따라오는 최대 지연. 등록·내리기는 이 값과 무관하게 즉시 반영된다(on-demand 무효화).
export const PLAZA_TTL = 180 // 초
export const POST_LIMIT = 300

// dev 와 운영은 스키마가 다르다 — 호스트로 고른다(lib/plaza.ts 와 같은 규칙).
export const plazaSchema = (host: string) => (/^(www\.)?pinkbean-customize\.com$/.test(host) ? 'public' : 'plaza_dev')
export const plazaTag = (schema: string) => `plaza:${schema}`
