import { redirect } from 'next/navigation'

// 존재하지 않는 경로(404)는 전부 루트로 돌려보낸다. 이 앱은 실질적으로 단일 페이지(/)라
// 잘못된 링크·없어진 경로로 들어와도 빈 404 대신 홈으로 안내한다.
// 응답 상태는 404 그대로이고, 브라우저가 곧바로 루트로 옮겨 간다.
export default function NotFound() {
  redirect('/')
}
