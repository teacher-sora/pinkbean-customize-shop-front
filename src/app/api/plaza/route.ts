// 코디 광장 목록 — ISR 캐시(사용자 지시: 새 글·좋아요가 즉각 반영되지 않게, 보고 있는 화면이 흔들리지 않게).
//  · 서버가 Supabase REST 를 읽어 두고 REVALIDATE 초 동안 같은 응답을 준다(모든 사용자 공유).
//  · '내 좋아요'·'내 등록' 판정은 사용자마다 달라 캐시할 수 없다 → 브라우저가 따로 조회해 합친다(lib/plaza.ts).
//  · 쓰기(등록·좋아요·내리기)는 캐시를 건드리지 않는다. 다음 갱신 때 자연히 따라온다.
//  · dev 와 운영은 스키마가 다르다 — 호스트로 고른다(lib/plaza.ts 와 같은 규칙).

import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

const REVALIDATE = 60 // 초
const POST_LIMIT = 300
const schemaFor = (host: string) => (/^(www\.)?pinkbean-customize\.com$/.test(host) ? 'public' : 'plaza_dev')

export async function GET(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return NextResponse.json({ error: 'not configured' }, { status: 503 })

  const schema = schemaFor(req.nextUrl.hostname)
  const q = `${url}/rest/v1/plaza_posts?select=*&order=created_at.desc&limit=${POST_LIMIT}`
  const r = await fetch(q, {
    headers: { apikey: key, 'Accept-Profile': schema },
    next: { revalidate: REVALIDATE },
  }).catch(() => null)
  if (!r || !r.ok) return NextResponse.json({ error: 'upstream' }, { status: 502 })

  const posts = await r.json()
  return NextResponse.json({ posts, revalidate: REVALIDATE }, {
    // 브라우저는 캐시하지 않는다(탭에 들어올 때마다 최신 ISR 결과를 받아야 한다). 공유 캐시만 쓴다.
    headers: { 'cache-control': `public, max-age=0, s-maxage=${REVALIDATE}, stale-while-revalidate=300` },
  })
}
