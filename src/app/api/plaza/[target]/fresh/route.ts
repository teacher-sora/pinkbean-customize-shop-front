// 방금 글을 올리거나 내린 사람 전용 — 캐시를 통째로 비켜 읽는다(lib/plaza.ts 가 쓰기 뒤 30초만 부른다).
// 무효화가 퍼지기 전에 새로고침해도 자기 글이 보여야 한다. 한 사람이 잠깐 더 읽는 것뿐이라
// 나머지 전부의 캐시(=속도)에는 영향이 없다.

import { NextRequest, NextResponse } from 'next/server'
import { fetchPage, isTarget, schemaOf } from '../../shared'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ?p=쪽 번호(0부터) — 캐시 라우트와 같은 모양으로 나눠 준다.
export async function GET(req: NextRequest, { params }: { params: { target: string } }) {
  if (!isTarget(params.target)) return NextResponse.json({ error: 'bad target' }, { status: 404 })
  const page = Math.max(0, Math.min(9999, Number(req.nextUrl.searchParams.get('p')) || 0))
  const r = await fetchPage(page, schemaOf(params.target), { cache: 'no-store' })
  if (r.status !== 200) return NextResponse.json({ error: 'upstream' }, { status: r.status })
  return NextResponse.json({ ...r.body, revalidate: 0 }, { headers: { 'cache-control': 'private, no-store' } })
}
