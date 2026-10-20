// 광장 캐시 공용 값. route.ts 는 정해진 export 만 허용해서(빌드 타입 검사) 따로 둔다.

// 첫 쪽(최신 500개) = 새 글이 들어오는 쪽. **5분** 캐시한다. 등록·내리기는 revalidateTag 로 즉시 비운다.
// 그 호출이 실패해도(올린 사람이 창을 닫는 등) 늦지 않는다 — 열어 둔 광장은 맥박(lib/plaza.loadPlazaPulse, Supabase 직접)이
// 최신 글을 알고 있어, 캐시 응답에 그 글이 없으면 캐시를 비켜(fresh) 읽는다.
// 왜 5분: 10초였을 때 재생성(응답 ≈ 200KB)이 Vercel 무료 한도의 Fast Origin Transfer · ISR 읽기를 거의 다 썼다(2026-10).
export const PLAZA_HEAD_TTL = 300 // 초
// 둘째 쪽부터(오래된 글)는 내용이 거의 바뀌지 않는다 — 길게 잡는다. 좋아요 수는 화면에 보이는 카드만 따로 4초마다 받는다.
export const PLAZA_TTL = 180 // 초
// 목록은 **전부** 보낸다(일부만 받으면 오래된 대회 출품작이 목록에서 사라진다).
// 한 응답에 다 담으면 Vercel 함수 응답 한도(4.5MB)·데이터 캐시 항목 한도(2MB)에 걸리므로 500개씩 나눠 따로 캐시한다
// (카드 한 장 ≈ 1~1.5KB → 한 쪽 ≈ 0.75MB). 첫 쪽이 전체 개수를 알려 주면 브라우저가 나머지 쪽을 한꺼번에 받는다.
export const PAGE_SIZE = 500
// plaza_awards(kind,seq) = 대회 수상(supabase/0014). post_id 가 기본키라 글마다 객체 하나(없으면 null)로 딸려 온다.
const COLS = 'id,created_at,owner,name,description,tags,snapshot,share_code,image_path,contest,like_count,contest_no,image_view,plaza_awards(kind,seq)'

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
