// 코디 광장 목록 — 대상별로 **정적 캐시**되는 라우트(2026-09-21 재설계).
//
// 왜 경로에 target 을 두는가:
//  · 호스트를 읽어 스키마를 고르면 요청마다 실행돼야 해서(force-dynamic) 엣지 캐시를 직접 관리해야 했고,
//    손으로 쓴 cache-control 로 만든 엣지 항목은 revalidateTag 가 지우지 못한다
//    → 글을 올려도 **남들에게는 최대 10초** 늦게 보였다(2026-09-21 실측 9.7초).
//  · 반대로 호스트를 읽지 않으면 Next 가 이 라우트를 빌드 때 구워 버리는데, 그러면 그때의 호스트로
//    스키마가 굳는다(운영이 dev 데이터를 내보낼 뻔했다).
//  → 경로로 고르면 둘 다 해결된다. 요청을 읽지 않으므로 정적으로 캐시되고, 그 캐시는 Next 가 관리하므로
//    revalidateTag 가 **엣지까지** 즉시 비운다. 스키마는 경로에 박혀 있어 호스트와 무관하다.
//
// 어느 쪽을 부를지는 브라우저가 호스트를 보고 정한다(lib/plaza.ts — 쓰기 경로와 같은 규칙).

import { NextResponse } from 'next/server'
import { PLAZA_TARGETS, PLAZA_TTL, fetchPage, isTarget, plazaTag, schemaOf } from '../shared'

export const revalidate = 180          // = PLAZA_TTL (여기는 리터럴만 허용된다)
export const dynamicParams = false     // prod·dev 말고는 404

export function generateStaticParams() {
  return PLAZA_TARGETS.map((target) => ({ target }))
}

// 첫 쪽(최신 500개) + 전체 개수. 나머지 쪽은 [page]/route.ts.
export async function GET(_req: Request, { params }: { params: { target: string } }) {
  if (!isTarget(params.target)) return NextResponse.json({ error: 'bad target' }, { status: 404 })
  const schema = schemaOf(params.target)
  const r = await fetchPage(0, schema, { next: { revalidate: PLAZA_TTL, tags: [plazaTag(schema)] } })
  if (r.status !== 200) return NextResponse.json({ error: r.status === 503 ? 'not configured' : 'upstream' }, { status: r.status })
  // cache-control 을 직접 쓰지 않는다 — 쓰는 순간 엣지 항목이 Next 의 무효화와 끊어진다.
  return NextResponse.json({ ...r.body, revalidate: PLAZA_TTL })
}
