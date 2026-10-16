// 닉네임 불러오기: 넥슨 캐릭터 이미지 중계. 헤어·성형을 그림으로 가려낼 때(lib/lookMatch) 픽셀을 읽어야 해서
// 같은 출처로 받는다. 넥슨의 캐릭터 이미지 주소만 받는다(다른 곳을 대신 받아 주는 통로가 되지 않게).
import { NextResponse, type NextRequest } from 'next/server'

const PREFIX = 'https://open.api.nexon.com/static/maplestory/character/look/'

export async function GET(req: NextRequest) {
  const u = req.nextUrl.searchParams.get('u') || ''
  if (!u.startsWith(PREFIX) || u.includes('..')) return NextResponse.json({ error: 'bad url' }, { status: 400 })
  // 서기, 기본 표정, 맨손 동작 — 성형의 기본 그림(default)과 같은 얼굴이 나온다.
  const base = u.split('?')[0]
  try {
    const r = await fetch(`${base}?action=A00&emotion=E00&wmotion=W00`, { cache: 'no-store', signal: req.signal })
    if (!r.ok || !(r.headers.get('content-type') || '').startsWith('image/')) return NextResponse.json({ error: 'fail' }, { status: 502 })
    return new NextResponse(await r.arrayBuffer(), { headers: { 'Content-Type': 'image/png', 'Cache-Control': 'no-store' } })
  } catch {
    return NextResponse.json({ error: 'fail' }, { status: 502 })
  }
}
