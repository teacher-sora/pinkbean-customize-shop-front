import type { Metadata } from 'next'
import Dashboard from './Dashboard'

// 운영자 화면. 주소로만 들어온다(앱 어디에도 링크가 없고, robots.txt 에도 적지 않는다 — 적으면 주소를 알리는 셈이다). 검색에는 잡히지 않게 한다.
export const metadata: Metadata = { title: '대시보드', robots: { index: false, follow: false } }

export default function Page() {
  return <Dashboard />
}
