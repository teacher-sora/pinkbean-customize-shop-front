// 인라인 스타일 유틸.
// 인라인으로 그리는 LookDialog 만 이 css() 를 쓴다. 나머지는 CSS Module 이다.

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
