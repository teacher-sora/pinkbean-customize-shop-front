import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import AnalyzeClient from '@/components/analyze/AnalyzeClient'

// 직접 URL(/analyze)로만 접근하는 실험용 페이지 — 네비 미노출 + 검색엔진 색인 제외.
export const metadata: Metadata = {
  title: '코디 역분석 (프로토타입)',
  robots: { index: false, follow: false },
}

// ⏸ 코디 역분석 프로토타입 일시 중단(2026-09-15). 접근 시 404 로 막는다.
//    재개하려면 아래 notFound() 한 줄만 제거하면 된다(AnalyzeClient/matcher 코드는 그대로 보존).
const PAUSED = true

export default function AnalyzePage() {
  if (PAUSED) notFound()
  return <AnalyzeClient />
}
