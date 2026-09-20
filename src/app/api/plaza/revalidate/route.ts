// 광장 목록 캐시 즉시 무효화 — 등록·내리기 직후 브라우저가 부른다(lib/plaza.ts).
//  · 왜 필요한가: 시간 만료만 쓰면 새 글·내린 글이 최대 PLAZA_TTL 동안 남의 화면에 어긋난 채 보인다.
//    반면 좋아요는 여기 부르지 않는다 — 가장 잦아서, 무효화하면 캐시가 사실상 없어진다.
//  · 화면이 튀지는 않는다. 웹은 광장 탭에 **들어올 때만** 목록을 다시 읽는다.
//  · 이 엔드포인트는 캐시만 비운다(데이터를 읽지도 쓰지도 않는다). 그래도 마구 불리면 Supabase 읽기가 늘어나니
//    인스턴스마다 최소 간격을 둔다. 서버리스라 완벽하진 않지만 상한을 만드는 용도로 충분하다.

import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { plazaSchema, plazaTag } from '../shared'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// 실제 쓰기를 건너뛰면 남들 화면에 최대 PLAZA_TTL 동안 안 보인다 → 남용 상한만 남기고 짧게 잡는다.
const MIN_GAP_MS = 1000
const last = new Map<string, number>()

export async function POST(req: NextRequest) {
  const schema = plazaSchema(req.nextUrl.hostname)
  const now = Date.now()
  if (now - (last.get(schema) || 0) < MIN_GAP_MS) return NextResponse.json({ ok: true, skipped: true })
  last.set(schema, now)
  revalidateTag(plazaTag(schema))
  return NextResponse.json({ ok: true })
}
