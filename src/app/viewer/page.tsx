import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import Viewer from './Viewer'

// 개발용 화면 뷰어 — 로컬과 dev 도메인에서만 열린다(운영 도메인에서는 404).
export const metadata: Metadata = { title: '화면 뷰어', robots: { index: false, follow: false } }
export const dynamic = 'force-dynamic'

export default function Page() {
  const host = headers().get('host') ?? ''
  const allowed = host.startsWith('localhost') || host.startsWith('127.0.0.1') || host.startsWith('dev.') || host.endsWith('.vercel.app')
  if (!allowed) notFound()
  return <Viewer />
}
