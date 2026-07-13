// 인라인 스타일 유틸 + 공유 스타일 빌더.
// 이 프로젝트는 디자인 정본이 상태 기반(hover/선택/열림) 인라인 스타일을 쓰므로,
// 정본의 CSS 문자열을 그대로 넘겨 React.CSSProperties 로 변환하는 css() 를 사용한다.

function toCamel(prop: string): string {
  if (prop.startsWith('--')) return prop // CSS custom property: 그대로
  const lead = prop.startsWith('-')
  const parts = prop.split('-').filter(Boolean)
  return parts
    .map((p, i) => (i === 0 && !lead ? p : p.charAt(0).toUpperCase() + p.slice(1)))
    .join('')
}

/** "prop:val; prop:val" CSS 문자열 → React 스타일 객체 */
export function css(s: string): React.CSSProperties {
  const o: Record<string, string> = {}
  s.split(';').forEach((decl) => {
    const i = decl.indexOf(':')
    if (i === -1) return
    const key = decl.slice(0, i).trim()
    const val = decl.slice(i + 1).trim()
    if (key) o[toCamel(key)] = val
  })
  return o as React.CSSProperties
}

/* ── 공유 스타일 빌더/스니펫 ─────────────────────────────────────────────── */
export function pillStyle(sel: boolean, hov: boolean) {
  const bd = sel ? '#ec86ac' : hov ? '#eeb2ce' : '#e7ded4'
  const col = sel ? '#d76d9a' : hov ? '#d76d9a' : '#8a8075'
  return `height:30px; padding:0 12px; border-radius:8px; cursor:pointer; font-family:inherit; font-size:12px; font-weight:${sel ? 600 : 500}; border:1px solid ${bd}; background:${sel ? '#fce9f1' : '#fff'}; color:${col}; transition:background .26s ease, border-color .26s ease, color .26s ease;`
}
export const swStyle = (hex: string, on: boolean) =>
  `width:30px; height:30px; border-radius:50%; cursor:pointer; background:${hex}; border:2px solid ${on ? '#2a2521' : 'rgba(0,0,0,0.08)'}; box-shadow:${on ? '0 0 0 2px #fff inset' : 'none'}; transition:transform .12s ease;`
export const switchTrack = (on: boolean) =>
  `position:relative; width:42px; height:24px; border-radius:20px; border:none; cursor:pointer; padding:0; background:${on ? '#ec86ac' : '#e0d8ce'}; transition:background .18s ease;`
export const switchKnob = (on: boolean) =>
  `position:absolute; top:3px; left:${on ? '21px' : '3px'}; width:18px; height:18px; border-radius:50%; background:#fff; transition:left .18s cubic-bezier(.22,.61,.36,1);`

// 미리보기 연출 패널 공용 스니펫
export const SEL_STYLE = 'flex:0 0 190px; height:34px; padding:0 30px 0 11px; border:1px solid #e7ded4; border-radius:8px; background-color:#faf7f3; font-family:inherit; font-size:13px; color:#3d372f; cursor:pointer; outline:none;'
export const ROW_BETWEEN = 'display:flex; align-items:center; justify-content:space-between; gap:12px;'
export const PV_LABEL = 'font-size:12px; font-weight:600; color:#8a8075;'
