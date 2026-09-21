// 광장 목록의 둘째 쪽부터(500개씩) — 첫 쪽과 같은 태그로 캐시되어 등록·내리기 때 함께 비워진다(../route.ts 주석 참고).
import { NextResponse } from 'next/server'
import { PLAZA_TTL, fetchPage, isTarget, plazaTag, schemaOf } from '../../shared'

export const revalidate = 180          // = PLAZA_TTL
export const dynamicParams = true      // 쪽 번호는 요청 때 정해진다

export function generateStaticParams() {
  return []
}

export async function GET(_req: Request, { params }: { params: { target: string; page: string } }) {
  const page = Number(params.page)
  if (!isTarget(params.target) || !/^[1-9]\d{0,3}$/.test(params.page)) return NextResponse.json({ error: 'bad page' }, { status: 404 })
  const schema = schemaOf(params.target)
  const r = await fetchPage(page, schema, { next: { revalidate: PLAZA_TTL, tags: [plazaTag(schema)] } })
  if (r.status !== 200) return NextResponse.json({ error: 'upstream' }, { status: r.status })
  return NextResponse.json({ ...r.body, revalidate: PLAZA_TTL })
}
