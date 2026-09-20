// 광장 캐시 공용 값. route.ts 는 정해진 export 만 허용해서(빌드 타입 검사) 따로 둔다.

// 좋아요 수가 따라오는 최대 지연. 등록·내리기는 이 값과 무관하게 즉시 반영된다(on-demand 무효화).
export const PLAZA_TTL = 180 // 초
export const POST_LIMIT = 300

// 운영과 dev 는 스키마가 다르다. **경로**로 고른다 — 호스트로 고르면 빌드 시점에 굳어 버린다(아래 주석 참고).
export type PlazaTarget = 'prod' | 'dev'
export const PLAZA_TARGETS: PlazaTarget[] = ['prod', 'dev']
export const isTarget = (v: string): v is PlazaTarget => v === 'prod' || v === 'dev'
export const schemaOf = (t: PlazaTarget) => (t === 'prod' ? 'public' : 'plaza_dev')
export const plazaTag = (schema: string) => `plaza:${schema}`

export function plazaQuery(url: string) {
  return `${url}/rest/v1/plaza_posts?select=*&order=created_at.desc&limit=${POST_LIMIT}`
}
