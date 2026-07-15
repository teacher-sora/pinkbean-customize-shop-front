// 염색 수치 clamp. 실제 염색은 src/lib/core/dye.ts 의 정밀 Prism 로직 사용.

/** 염색 수치 clamp: 색조 0~359, 채도/명도 -99~+99 */
export const clampDye = (f: string, v: number) => {
  if (isNaN(v)) v = 0
  return f === 'h' ? Math.max(0, Math.min(359, v)) : Math.max(-99, Math.min(99, v))
}
