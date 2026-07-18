'use client'

/*
 * DisabledSection — 한 섹션(라벨 span + 컨트롤 등)을 통째로 "사용 불가"로 표시하는 래퍼.
 *  - active=true 면 자식 전체를 연하게(opacity) + 클릭 차단(pointer-events:none) 하고,
 *    섹션 중앙을 가로지르는 흰색 선 하나를 얹는다. (예: 라이딩 중 형상 변이 확장 차단)
 *  - active=false 면 자식을 그대로 통과(래핑 오버헤드 없음).
 */

import type { ReactNode } from 'react'

export default function DisabledSection({ active, children }: { active: boolean; children: ReactNode }) {
  if (!active) return <>{children}</>
  return (
    <div style={{ position: 'relative' }}>
      {/* 자식(라벨·버튼 등) 전부 연하게 + 상호작용 차단 */}
      <div style={{ opacity: 0.4, pointerEvents: 'none', userSelect: 'none' }}>{children}</div>
      {/* 섹션 중앙을 가로지르는 흰색 선 하나(양옆 연회색 테두리로 밝은 배경에서도 보이게) */}
      <div
        aria-hidden
        style={{
          position: 'absolute', left: 0, right: 0, top: '50%', height: 2,
          transform: 'translateY(-50%)', background: '#fff',
          boxShadow: '0 0 0 0.5px #e2d8cd', pointerEvents: 'none',
        }}
      />
    </div>
  )
}
