'use client'

import Background from '@/components/shop/frame/Background'
import { useBreakpoint } from '@/lib/useBreakpoint'

// 안내 페이지의 배경: 앱과 같은 배경 장면(모바일은 앱처럼 띄우지 않는다).
export default function GuideScene() {
  return <Background mobile={useBreakpoint() === 'mobile'} />
}
