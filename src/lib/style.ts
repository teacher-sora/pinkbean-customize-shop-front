// 인라인 스타일 유틸.
// 인라인으로 그리는 LookDialog 와, 색을 인라인으로 주는 몇 곳(FeedbackThread 의 답글 줄 · Icons 의 연필)만 이 css() 를 쓴다. 나머지는 CSS Module 이다.

function toCamel(prop: string): string {
  if (prop.startsWith('--')) return prop // CSS custom property: 그대로
  const lead = prop.startsWith('-')
  const parts = prop.split('-').filter(Boolean)
  return parts
    .map((p, i) => (i === 0 && !lead ? p : p.charAt(0).toUpperCase() + p.slice(1)))
    .join('')
}

// light-dark(라이트, 다크) → CSS 변수 토글. CSS 파일은 빌드(postcss.config.js 의 @csstools 플러그인)가 바꾸고, 인라인은 PostCSS 를
// 거치지 않아 여기서 같은 방식으로 바꾼다 — light-dark 를 모르는 옛 브라우저에서도 같은 색 · 같은 다크 모드로.
// 토글: 다크면 --csstools-color-scheme--light 가 빈 값(globals.css 의 color-scheme 을 플러그인이 바꾼 것)이라 '--ld-N: 다크' 가 살고,
// 라이트면 그 변수가 없어 --ld-N 이 무효 → var(--ld-N, 라이트) 의 라이트로 떨어진다.
function lightDark(val: string, o: Record<string, string>): string {
  let out = ''
  let i = 0
  for (;;) {
    const k = val.indexOf('light-dark(', i)
    if (k < 0) return out + val.slice(i)
    let j = k + 11
    let depth = 0
    let comma = -1
    for (; j < val.length; j++) {
      const c = val[j]
      if (c === '(') depth++
      else if (c === ')') { if (depth === 0) break; depth-- }
      else if (c === ',' && depth === 0 && comma < 0) comma = j
    }
    const name = `--ld-${Object.keys(o).filter((key) => key.startsWith('--ld-')).length}`
    o[name] = `var(--csstools-color-scheme--light) ${val.slice(comma + 1, j).trim()}`
    out += `${val.slice(i, k)}var(${name}, ${val.slice(k + 11, comma).trim()})`
    i = j + 1
  }
}

/** "prop:val; prop:val" CSS 문자열 → React 스타일 객체 */
export function css(s: string): React.CSSProperties {
  const o: Record<string, string> = {}
  s.split(';').forEach((decl) => {
    const i = decl.indexOf(':')
    if (i === -1) return
    const key = decl.slice(0, i).trim()
    const val = decl.slice(i + 1).trim()
    if (key) o[toCamel(key)] = val.includes('light-dark(') ? lightDark(val, o) : val
  })
  return o as React.CSSProperties
}
