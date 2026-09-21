// 광장 캐시 공용 값. route.ts 는 정해진 export 만 허용해서(빌드 타입 검사) 따로 둔다.

// 좋아요 수가 따라오는 최대 지연. 등록·내리기는 이 값과 무관하게 즉시 반영된다(on-demand 무효화).
export const PLAZA_TTL = 180 // 초
// 목록은 **전부** 보낸다(2026-09-21 사용자 지시 — 예전엔 최근 300개만 받아 오래된 대회 출품작이 목록에서 사라질 수 있었다).
// 한 응답에 다 담으면 Vercel 함수 응답 한도(4.5MB)·데이터 캐시 항목 한도(2MB)에 걸리므로 500개씩 나눠 따로 캐시한다
// (카드 한 장 ≈ 1~1.5KB → 한 쪽 ≈ 0.75MB). 첫 쪽이 전체 개수를 알려 주면 브라우저가 나머지 쪽을 한꺼번에 받는다.
export const PAGE_SIZE = 500
const COLS = 'id,created_at,owner,name,description,tags,snapshot,share_code,image_path,contest,like_count,contest_no,image_view'

// 운영과 dev 는 스키마가 다르다. **경로**로 고른다 — 호스트로 고르면 빌드 시점에 굳어 버린다(아래 주석 참고).
export type PlazaTarget = 'prod' | 'dev'
export const PLAZA_TARGETS: PlazaTarget[] = ['prod', 'dev']
export const isTarget = (v: string): v is PlazaTarget => v === 'prod' || v === 'dev'
export const schemaOf = (t: PlazaTarget) => (t === 'prod' ? 'public' : 'plaza_dev')
export const plazaTag = (schema: string) => `plaza:${schema}`

// 한 쪽 받기. 순서는 created_at·id 로 못 박는다(같은 시각이 여러 개여도 쪽 경계가 흔들리지 않게).
export async function fetchPage(page: number, schema: string, init: RequestInit & { next?: { revalidate?: number; tags?: string[] } }) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return { status: 503 as const }
  const r = await fetch(`${url}/rest/v1/plaza_posts?select=${COLS}&order=created_at.desc,id.desc&offset=${page * PAGE_SIZE}&limit=${PAGE_SIZE}`, {
    ...init,
    headers: { apikey: key, 'Accept-Profile': schema, Prefer: 'count=exact' },
  }).catch(() => null)
  if (!r || !r.ok) return { status: 502 as const }
  const total = Number((r.headers.get('content-range') || '').split('/')[1]) || 0
  return { status: 200 as const, body: { posts: await r.json(), total, page, pageSize: PAGE_SIZE } }
}
