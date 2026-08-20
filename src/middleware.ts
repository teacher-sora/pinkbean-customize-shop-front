import { NextResponse, type NextRequest } from 'next/server'

// 도메인 정규화 = apex(pinkbean-customize.com) → www 로 308.
// 예전엔 Vercel 도메인 설정의 리다이렉트로 처리했는데, 그러면 apex 가 아무 콘텐츠도 안 서빙해서
// 프리셋 이관 브리지(/__migrate)를 apex origin 으로 띄울 수 없었다(→ 옛 프리셋을 못 읽음).
// 그래서 정규화를 앱 레벨(여기)로 옮기고, /pb-migrate 만 예외로 두어 apex 에서 그대로 서빙되게 한다.
// ⚠️ 이게 동작하려면 Vercel 에서 apex 를 "리다이렉트"가 아니라 이 프로젝트에 **서빙**하도록 붙여야 한다.
const APEX_HOSTS = new Set(['pinkbean-customize.com', 'pinkbean-customize.com:443'])
const WWW_HOST = 'www.pinkbean-customize.com'

export function middleware(req: NextRequest) {
  const host = (req.headers.get('host') || '').toLowerCase()
  if (APEX_HOSTS.has(host) && !req.nextUrl.pathname.startsWith('/pb-migrate')) {
    const url = req.nextUrl.clone()
    url.protocol = 'https:'
    url.host = WWW_HOST
    url.port = ''
    return NextResponse.redirect(url, 308)
  }
  return NextResponse.next()
}

// 정적 자산·이미지·파일(확장자 포함)은 건너뛴다. /__migrate 등 일반 경로만 매칭.
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)'],
}
