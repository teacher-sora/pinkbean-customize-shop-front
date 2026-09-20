// 방금 글을 올리거나 내린 사람 전용 — 캐시를 통째로 비켜 읽는다(lib/plaza.ts 가 쓰기 뒤 30초만 부른다).
// 무효화가 퍼지기 전에 새로고침해도 자기 글이 보여야 한다. 한 사람이 잠깐 더 읽는 것뿐이라
// 나머지 전부의 캐시(=속도)에는 영향이 없다.

import { NextResponse } from 'next/server'
import { isTarget, plazaQuery, schemaOf } from '../../shared'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(_req: Request, { params }: { params: { target: string } }) {
  if (!isTarget(params.target)) return NextResponse.json({ error: 'bad target' }, { status: 404 })
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return NextResponse.json({ error: 'not configured' }, { status: 503 })

  const r = await fetch(plazaQuery(url), {
    headers: { apikey: key, 'Accept-Profile': schemaOf(params.target) },
    cache: 'no-store',
  }).catch(() => null)
  if (!r || !r.ok) return NextResponse.json({ error: 'upstream' }, { status: 502 })
  return NextResponse.json({ posts: await r.json(), revalidate: 0 }, {
    headers: { 'cache-control': 'private, no-store' },
  })
}
