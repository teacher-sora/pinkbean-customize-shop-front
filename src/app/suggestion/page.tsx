import type { Metadata } from 'next'
import Suggestion from './Suggestion'

// 운영자용 건의함. 주소로만 들어온다(앱 어디에도 링크가 없다) — 검색에 잡히지 않게 한다.
export const metadata: Metadata = { title: '건의함 관리', robots: { index: false, follow: false } }

export default function Page() {
  return <Suggestion />
}
