// 공유 링크(/?c=<코드>)만 /share 로 rewrite — 링크 미리보기 메타(og:title·image)를 프리셋 기준으로 만들기 위해서다.
// 주소창 URL 은 그대로라 클라이언트의 ?c= 수신 로직은 변함없고, 코드 없는 홈(/)은 정적 페이지로 남는다.
import { NextResponse, type NextRequest } from 'next/server'

export function middleware(req: NextRequest) {
  if (!req.nextUrl.searchParams.get('c')) return NextResponse.next()
  const url = req.nextUrl.clone()
  url.pathname = '/share'
  return NextResponse.rewrite(url)
}

export const config = { matcher: '/' }
