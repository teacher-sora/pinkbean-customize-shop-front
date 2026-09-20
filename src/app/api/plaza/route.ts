// 코디 광장 목록 — 하이브리드 ISR(2026-09-20 재설계).
//  · '보고 있는 화면이 흔들리지 않는다'는 건 **캐시가 아니라 클라이언트 재조회 시점**이 정한다.
//    웹은 광장 탭에 들어올 때만 목록을 다시 읽는다(ShopContext.refreshPlaza) → 캐시를 언제 비우든 화면은 안 튄다.
//    그래서 캐시는 순수하게 "Supabase 읽기를 줄이고 첫 그림을 빠르게" 하는 용도로만 잡는다.
//  · 등록·내리기는 **on-demand 무효화**(/api/plaza/revalidate) — 다음에 들어오는 사람에게 바로 보인다.
//  · 좋아요는 무효화하지 않는다(가장 잦고, 정렬은 진입 시 한 번 고정이라 분 단위 지연이 무해하다) → 시간 만료로만 따라온다.
//  · '내 좋아요'·'내 등록' 판정은 사용자마다 달라 캐시할 수 없다 → 브라우저가 따로 조회해 합친다(lib/plaza.ts).
//  · dev 와 운영은 스키마가 다르다 — 호스트로 고른다(lib/plaza.ts 와 같은 규칙). 태그도 스키마별로 나눈다.

import { NextRequest, NextResponse } from 'next/server'
import { PLAZA_TTL, POST_LIMIT, plazaSchema, plazaTag } from './shared'

export const runtime = 'nodejs'
// ⚠️ 반드시 요청마다 실행돼야 한다. 이걸 빼면 Next 가 이 라우트를 **빌드 시점에 프리렌더**해 버리고,
// 그때의 호스트(운영 도메인이 아님)로 스키마가 굳어 운영이 dev 데이터를 내보낸다.
// 2026-09-20 빌드 산출물에서 실제로 확인: .next/.../plaza.meta 의 캐시 태그가 'plaza:plaza_dev' 로 박혔다.
// 대신 위쪽 upstream fetch 가 태그 붙은 데이터 캐시를 써서 Supabase 읽기는 그대로 아낀다.
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return NextResponse.json({ error: 'not configured' }, { status: 503 })

  const schema = plazaSchema(req.nextUrl.hostname)
  const q = `${url}/rest/v1/plaza_posts?select=*&order=created_at.desc&limit=${POST_LIMIT}`
  const r = await fetch(q, {
    headers: { apikey: key, 'Accept-Profile': schema },
    next: { revalidate: PLAZA_TTL, tags: [plazaTag(schema)] },
  }).catch(() => null)
  if (!r || !r.ok) return NextResponse.json({ error: 'upstream' }, { status: 502 })

  const posts = await r.json()
  return NextResponse.json({ posts, revalidate: PLAZA_TTL }, {
    // 엣지 캐시는 **짧게만** 건다. 길게 걸면 on-demand 무효화가 이 층에 막혀 등록이 바로 안 보인다.
    // 여기 s-maxage 는 동시 진입 몰림을 막는 용도이고, 실제 절약은 위의 데이터 캐시(tags)가 한다.
    // 브라우저는 캐시하지 않는다(탭에 들어올 때마다 최신 결과를 받아야 한다).
    headers: { 'cache-control': 'public, max-age=0, s-maxage=10, stale-while-revalidate=60' },
  })
}
