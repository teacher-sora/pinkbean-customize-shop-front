import { redirect } from 'next/navigation'

// 존재하지 않는 경로(404)는 전부 루트로 돌려보낸다. 이 앱은 실질적으로 단일 페이지(/)라
// 잘못된 링크·옛 경로(예: 제거된 /pb-migrate)로 들어와도 빈 404 대신 홈으로 안내한다.
// 서버 컴포넌트에서 redirect() → HTTP 리다이렉트라 깜빡임 없이 루트로 이동한다.
export default function NotFound() {
  redirect('/')
}
