// 아이템 이름 검색(필터링) 매처.
//  - 공백 무시: "꼬마 버블리" ↔ "꼬마버블리"
//  - 한/영 자판(두벌식) 무관: 한글을 키 입력 순서(ko2en)로 풀어 비교 → "Rhakqjqmf"(한/영 전환 안 하고 친 것),
//    조합 중인 "꼬마버블ㄹ", 영문 이름을 한글 자판으로 친 경우까지 같은 규칙으로 잡힌다.
//  - 대소문자: Shift 없이 친 영문 자판("rhakqjqmf")도 잡도록, 검색어에 대문자가 없으면 소문자 비교를 한 번 더 한다.

const CHO = ['r', 'R', 's', 'e', 'E', 'f', 'a', 'q', 'Q', 't', 'T', 'd', 'w', 'W', 'c', 'z', 'x', 'v', 'g']
const JUNG = ['k', 'o', 'i', 'O', 'j', 'p', 'u', 'P', 'h', 'hk', 'ho', 'hl', 'y', 'n', 'nj', 'np', 'nl', 'b', 'm', 'ml', 'l']
const JONG = ['', 'r', 'R', 'rt', 's', 'sw', 'sg', 'e', 'f', 'fr', 'fa', 'fq', 'ft', 'fx', 'fv', 'fg', 'a', 'q', 'qt', 't', 'T', 'd', 'w', 'c', 'z', 'x', 'v', 'g']
// 호환 자모 ㄱ(U+3131)~ㅎ(U+314E) 자음 30개 + ㅏ(U+314F)~ㅣ(U+3163) 모음 21개
const COMPAT_CONS = ['r', 'R', 'rt', 's', 'sw', 'sg', 'e', 'E', 'f', 'fr', 'fa', 'fq', 'ft', 'fx', 'fv', 'fg', 'a', 'q', 'Q', 'qt', 't', 'T', 'd', 'w', 'W', 'c', 'z', 'x', 'v', 'g']

// 한글 → 두벌식 키 입력 문자열(공백 제거). 한글이 아닌 문자는 그대로.
export function ko2en(text: string): string {
  let out = ''
  for (const ch of text) {
    const c = ch.charCodeAt(0)
    if (/\s/.test(ch)) continue
    if (c >= 0xac00 && c <= 0xd7a3) {
      const n = c - 0xac00
      out += CHO[Math.floor(n / 588)] + JUNG[Math.floor((n % 588) / 28)] + JONG[n % 28]
    } else if (c >= 0x3131 && c <= 0x314e) out += COMPAT_CONS[c - 0x3131]
    else if (c >= 0x314f && c <= 0x3163) out += JUNG[c - 0x314f]
    else out += ch
  }
  return out
}

const keyCache = new Map<string, { exact: string; lower: string }>()
function keysOf(name: string) {
  let k = keyCache.get(name)
  if (!k) { const exact = ko2en(name); k = { exact, lower: exact.toLowerCase() }; keyCache.set(name, k) }
  return k
}

// 검색어 → 이름 판정 함수. 빈 검색어면 null(필터 없음).
export function nameMatcher(query: string): ((name: string) => boolean) | null {
  const q = ko2en(query)
  if (!q) return null
  // 영문 자판으로 치면서 대문자(Shift)를 안 쳤으면 쌍자음·ㅒ·ㅖ 구분 없이도 매칭. 한글로 친 검색어는 제외("고마"≠"꼬마").
  const loose = q === q.toLowerCase() && !/[ㄱ-ㆎ가-힣]/.test(query) ? q : null
  const ql = q.toLowerCase()
  return (name: string) => {
    const k = keysOf(name)
    if (k.exact.includes(q)) return true
    if (loose !== null && k.lower.includes(loose)) return true
    return /[a-z]/i.test(q) && !/[^\x00-\x7f]/.test(name) && k.lower.includes(ql) // 순수 영문 이름은 대소문자 무시
  }
}
