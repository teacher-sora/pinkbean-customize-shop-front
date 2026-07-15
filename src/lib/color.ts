// 색상 유틸(프리셋 썸네일 + 염색 수치 clamp). 실제 염색은 src/lib/core/dye.ts 의 정밀 Prism 로직 사용.

/** 프리셋 카드 파스텔 썸네일(핑크~보라 계열, id 해시 기반) */
export function presetThumb(id: string) {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 100
  const base = 300 + h * 0.6
  return `linear-gradient(155deg, hsl(${base % 360},80%,90%), hsl(${(base + 35) % 360},68%,82%))`
}

/** 염색 수치 clamp: 색조 0~359, 채도/명도 -99~+99 */
export const clampDye = (f: string, v: number) => {
  if (isNaN(v)) v = 0
  return f === 'h' ? Math.max(0, Math.min(359, v)) : Math.max(-99, Math.min(99, v))
}
