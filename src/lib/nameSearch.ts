// 아이템 이름 검색(필터링) 매처.
//  - 공백 무시: "꼬마 버블리" ↔ "꼬마버블리"
//  - 한/영 자판 무관(en2ko): 영문 자판으로 친 검색어("Rhakqjqmf")를 두벌식으로 조합해 한글("꼬마버블리")로 바꿔 비교한다.
//  - ⚠️ 비교는 **음절 단위**다. 예전엔 이름까지 키 입력열(ko2en)로 풀어 비교해서 음절 경계를 넘는 오탐이 났다
//    ("가방" = rkqkd 가 "모험가 바이퍼" = …rkqkdl… 에 걸림, 2026-09-17 제보) → ko2en 제거.
//  - 조합 중인 마지막 글자는 느슨하게: "가ㅂ"·"가바"(→ 가방 입력 도중)는 "가방"에 걸린다(받침 넘김 완화는 안 함, 아래 참고).
//  - Shift 없이 친 영문 자판("rhakqjqmf")은 쌍자음·ㅒ·ㅖ 구분 없이 비교한다. 한글로 친 검색어는 정확히("고마"≠"꼬마").
//  - 영문이 섞인 이름("BTS", "007 가방")은 원문 대소문자 무시 비교도 함께 한다.

const CHO_KEYS = 'rRseEfaqQtTdwWczxvg'
const CHO_JAMO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ'
const JUNG_JAMO = 'ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ'
const JONG_JAMO = ['', 'ㄱ', 'ㄲ', 'ㄳ', 'ㄴ', 'ㄵ', 'ㄶ', 'ㄷ', 'ㄹ', 'ㄺ', 'ㄻ', 'ㄼ', 'ㄽ', 'ㄾ', 'ㄿ', 'ㅀ', 'ㅁ', 'ㅂ', 'ㅄ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ']
const VOWEL_KEYS: Record<string, string> = { k: 'ㅏ', o: 'ㅐ', i: 'ㅑ', O: 'ㅒ', j: 'ㅓ', p: 'ㅔ', u: 'ㅕ', P: 'ㅖ', h: 'ㅗ', y: 'ㅛ', n: 'ㅜ', b: 'ㅠ', m: 'ㅡ', l: 'ㅣ' }
const CONS_KEYS: Record<string, string> = Object.fromEntries([...CHO_KEYS].map((k, i) => [k, CHO_JAMO[i]]))
// 영문 대문자는 쌍자음/ㅒㅖ 외엔 소문자와 같은 키
for (const k of 'ABCDFGHIJKLMNSUVXYZ') { const l = k.toLowerCase(); if (CONS_KEYS[l]) CONS_KEYS[k] = CONS_KEYS[l]; else if (VOWEL_KEYS[l]) VOWEL_KEYS[k] = VOWEL_KEYS[l] }
const JUNG_COMBO: Record<string, string> = { 'ㅗㅏ': 'ㅘ', 'ㅗㅐ': 'ㅙ', 'ㅗㅣ': 'ㅚ', 'ㅜㅓ': 'ㅝ', 'ㅜㅔ': 'ㅞ', 'ㅜㅣ': 'ㅟ', 'ㅡㅣ': 'ㅢ' }
const JONG_COMBO: Record<string, string> = { 'ㄱㅅ': 'ㄳ', 'ㄴㅈ': 'ㄵ', 'ㄴㅎ': 'ㄶ', 'ㄹㄱ': 'ㄺ', 'ㄹㅁ': 'ㄻ', 'ㄹㅂ': 'ㄼ', 'ㄹㅅ': 'ㄽ', 'ㄹㅌ': 'ㄾ', 'ㄹㅍ': 'ㄿ', 'ㄹㅎ': 'ㅀ', 'ㅂㅅ': 'ㅄ' }
const JONG_SPLIT: Record<string, [string, string]> = Object.fromEntries(Object.entries(JONG_COMBO).map(([k, v]) => [v, [k[0], k[1]]]))

const syl = (cho: string, jung: string, jong = '') =>
  String.fromCharCode(0xac00 + CHO_JAMO.indexOf(cho) * 588 + JUNG_JAMO.indexOf(jung) * 28 + JONG_JAMO.indexOf(jong))

// 영문 자판 키 입력열 → 두벌식 조합 한글. 한글 키가 아닌 문자(숫자·기호)는 그대로 둔다.
export function en2ko(text: string): string {
  let out = ''
  let cho = '', jung = '', jong = ''
  const flush = () => {
    if (cho && jung) out += syl(cho, jung, jong)
    else out += cho + jung + jong
    cho = ''; jung = ''; jong = ''
  }
  for (const ch of text) {
    const v = VOWEL_KEYS[ch], c = CONS_KEYS[ch]
    if (v) {
      if (jong) {
        // 종성을 다음 음절 초성으로 넘긴다(겹받침이면 뒤 자음만).
        const split = JONG_SPLIT[jong]
        const moved = split ? split[1] : jong
        if (split) jong = split[0]; else jong = ''
        flush(); cho = moved; jung = v
      } else if (cho && !jung) jung = v
      else if (jung && JUNG_COMBO[jung + v]) jung = JUNG_COMBO[jung + v]
      else { flush(); jung = v }
    } else if (c) {
      if (cho && jung && !jong) {
        if (JONG_JAMO.includes(c)) jong = c; else { flush(); cho = c }
      } else if (jong && JONG_COMBO[jong + c]) jong = JONG_COMBO[jong + c]
      else { flush(); cho = c }
    } else { flush(); out += ch }
  }
  flush()
  return out
}

type Parts = { cho: number; jung: number; jong: number } | null
const partsOf = (ch: string): Parts => {
  const c = ch.charCodeAt(0) - 0xac00
  return c >= 0 && c <= 11171 ? { cho: Math.floor(c / 588), jung: Math.floor((c % 588) / 28), jong: c % 28 } : null
}

// Shift 없이 친 검색어용 정규화: 쌍자음 → 홑자음, ㅒ→ㅐ, ㅖ→ㅔ (이름·검색어 양쪽에 적용).
const LOOSE_CHO: Record<string, string> = { 'ㄲ': 'ㄱ', 'ㄸ': 'ㄷ', 'ㅃ': 'ㅂ', 'ㅆ': 'ㅅ', 'ㅉ': 'ㅈ' }
const LOOSE_JUNG: Record<string, string> = { 'ㅒ': 'ㅐ', 'ㅖ': 'ㅔ' }
const LOOSE_JONG: Record<string, string> = { 'ㄲ': 'ㄱ', 'ㅆ': 'ㅅ' }
function loosen(s: string): string {
  let out = ''
  for (const ch of s) {
    const p = partsOf(ch)
    if (p) {
      const cho = CHO_JAMO[p.cho], jung = JUNG_JAMO[p.jung], jong = JONG_JAMO[p.jong]
      out += syl(LOOSE_CHO[cho] || cho, LOOSE_JUNG[jung] || jung, LOOSE_JONG[jong] || jong)
    } else out += LOOSE_CHO[ch] || LOOSE_JUNG[ch] || ch
  }
  return out
}

// 조합 중인 마지막 글자 q 가 이름의 글자 n 과 맞는가.
function lastMatches(q: string, n: string | undefined): boolean {
  if (n === undefined) return false
  if (q === n) return true
  const pn = partsOf(n)
  if (!pn) return false
  const ci = CHO_JAMO.indexOf(q)
  if (ci >= 0) return pn.cho === ci // "가ㅂ" → "가방"
  const pq = partsOf(q)
  if (!pq || pq.cho !== pn.cho || pq.jung !== pn.jung) return false
  // ⚠️ 받침을 다음 글자 초성으로 넘겨 보는 완화("갑"→"가ㅂ…")는 하지 않는다 — "가방"이 "모험가 바이퍼"(가바ㅇ)에 걸린다.
  return pq.jong === 0 // "가바" → "가방"
}

function includesLoose(name: string, q: string): boolean {
  if (!q) return false
  const head = q.slice(0, -1), last = q[q.length - 1]
  for (let i = name.indexOf(head); i >= 0 && i + head.length < name.length; i = name.indexOf(head, i + 1)) {
    if (lastMatches(last, name[i + head.length])) return true
  }
  return false
}

const stripCache = new Map<string, { exact: string; loose: string; lower: string }>()
function keysOf(name: string) {
  let k = stripCache.get(name)
  if (!k) { const exact = name.replace(/\s+/g, ''); k = { exact, loose: loosen(exact), lower: exact.toLowerCase() }; stripCache.set(name, k) }
  return k
}

// 검색어 → 이름 판정 함수. 빈 검색어면 null(필터 없음).
export function nameMatcher(query: string): ((name: string) => boolean) | null {
  const raw = query.replace(/\s+/g, '')
  if (!raw) return null
  const latin = /[a-z]/i.test(raw)
  const ko = latin ? en2ko(raw) : raw
  // Shift 를 안 친 영문 자판 입력이면 쌍자음·ㅒ·ㅖ 구분 없이. 한글로 친 검색어는 정확히.
  const loose = latin && raw === raw.toLowerCase() ? loosen(ko) : null
  const lowerRaw = raw.toLowerCase()
  return (name: string) => {
    const k = keysOf(name)
    if (includesLoose(k.exact, ko)) return true
    if (loose !== null && includesLoose(k.loose, loose)) return true
    return latin && k.lower.includes(lowerRaw) // 영문이 들어간 이름("BTS")은 원문 대소문자 무시
  }
}
