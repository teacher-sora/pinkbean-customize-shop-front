// 염색/색상 계산 (디자인 재현용 근사). 정본과 동일한 수식.
// ⚠️ CDN 단계에서는 미리보기 근사 대신 src/lib/core/dye.ts 의 정밀 Prism 염색으로 대체.

export const isMixCat = (id: string) => id === 'hair' || id === 'plastic'

export const hx = (h: string) => {
  const s = h.replace('#', '')
  return [0, 2, 4].map((i) => parseInt(s.substr(i, 2), 16))
}

/** 두 색을 비율 t(0~100)로 선형 보간 → rgb() */
export function mixColor(a: string, b: string, t: number) {
  const pa = hx(a), pb = hx(b), w = t / 100
  const c = pa.map((v, i) => Math.round(v + (pb[i] - v) * w))
  return `rgb(${c[0]},${c[1]},${c[2]})`
}

/** 보간 + 아이템별 톤 편차(스프라이트마다 같은 조합도 결과가 다른 성질 시뮬레이션) */
export function mixColorTone(a: string, b: string, t: number, tone: number) {
  const pa = hx(a), pb = hx(b), w = t / 100
  let c = pa.map((v, i) => v + (pb[i] - v) * w)
  c = c.map((v) => (tone >= 0 ? v + (255 - v) * (tone / 100) : v * (1 + tone / 100)))
  return `rgb(${c.map((x) => Math.round(Math.max(0, Math.min(255, x)))).join(',')})`
}

export const itemTone = (idx: number) => (((idx * 53) % 13) - 6) * 5

/** HSV 근사 미리보기(hsl) */
export function hsvColor(h: number, s: number, v: number) {
  const sPct = Math.max(0, Math.min(100, 62 + s * 0.38))
  const lPct = Math.max(12, Math.min(90, 52 + v * 0.38))
  return `hsl(${h}, ${sPct}%, ${lPct}%)`
}

/** 프리셋 카드 파스텔 썸네일(핑크~보라 계열, id 해시 기반) */
export function presetThumb(id: string) {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 100
  const base = 300 + h * 0.6
  return `linear-gradient(155deg, hsl(${base % 360},80%,90%), hsl(${(base + 35) % 360},68%,82%))`
}

export const defMix = () => ({ a: '#2f2b27', b: '#e0503f', ratio: 50 })
export const defHsv = () => ({ h: 0, s: 0, v: 0 })

/** 염색 수치 clamp: 색조 0~359, 채도/명도 -99~+99 */
export const clampDye = (f: string, v: number) => {
  if (isNaN(v)) v = 0
  return f === 'h' ? Math.max(0, Math.min(359, v)) : Math.max(-99, Math.min(99, v))
}
