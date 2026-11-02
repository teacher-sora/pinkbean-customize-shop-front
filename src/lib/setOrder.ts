// 목록 순서: 같은 세트의 아이템을 한자리에 모은다(사용자 지시 — '금단의 계약 (여)' 와 '파멸의 계약 (남)', 신규의 '복닥복닥 털실 비니' ·
// '복닥복닥 가디건' · '복닥복닥 슈즈' 처럼 같은 세트가 목록에서 멀리 떨어져 있었다).
//  · 묶는 열쇠(앞의 것이 먼저):
//    1. 게임의 세트 번호(setItemID).
//    2. 세트 번호가 없는 캐시 아이템은 이름의 첫 낱말('[…]' 머리표는 뗀다) — 캐시 세트는 대부분 번호 없이 같은 머리말을 쓴다.
//       그 목록에서 같은 첫 낱말이 TOKEN_MAX 개를 넘거나 색 이름 같은 흔한 낱말이면 세트가 아니라 보고 쓰지 않는다('핑크' 66개, '모험가' 71개).
//    3. 끝의 '(남)' · '(여)' 만 다른 같은 이름(같은 부위).
//  · 무리는 그 무리에서 가장 앞에 있던 아이템 자리에 모이고, 무리 안 순서는 원래 순서(= '전체' 면 부위 순서)를 따른다.
//    그래서 '전체' 는 부위 순서를 바꾸면 세트 안의 순서도 함께 바뀐다. 성별 필터는 이 뒤에 걸러 여자 아이템만 볼 수도 있다.
//  · 한 번 훑는 계산이다(1만 4천 개에 몇 ms). 같은 목록 배열은 결과를 기억한다.
import type { ListItem } from './core/data'

const TOKEN_MAX = 12
const COMMON = new Set(['New', '내', '진', '투명', '블랙', '화이트', '핑크', '블루', '레드', '그린', '옐로우', '퍼플', '브라운', '골드', '실버', '다크', '라이트',
  '흰색', '검은', '검정', '빨간', '빨간색', '파란', '파란색', '노란', '노란색', '하늘색', '분홍색', '초록', '초록색', '갈색', '보라', '보라색', '회색', '주황', '주황색', '큐티', '러블리'])
const GENDER_TAIL = /\s*\((남|여)\)\s*$/
const firstToken = (it: ListItem): string | null => {
  if (!it.isCash || it.setItemID) return null
  const t = (it.name ?? '').replace(/^\[[^\]]*\]\s*/, '').split(' ')
  return t.length > 1 && t[0] && !COMMON.has(t[0]) ? t[0] : null
}
const genderKey = (it: ListItem): string | null => {
  const n = it.name
  return n && GENDER_TAIL.test(n) ? `n${it.slot}|${n.replace(GENDER_TAIL, '')}` : null
}

const memo = new WeakMap<ListItem[], ListItem[]>()
export function groupSets (list: ListItem[]): ListItem[] {
  const hit = memo.get(list)
  if (hit) return hit
  const toks = list.map(firstToken)
  const tokN = new Map<string, number>()
  for (const t of toks) if (t) tokN.set(t, (tokN.get(t) ?? 0) + 1)
  const keys = list.map((it, i) => {
    if (it.setItemID) return `s${it.setItemID}`
    const t = toks[i]
    if (t && tokN.get(t)! > 1 && tokN.get(t)! <= TOKEN_MAX) return `t${t}`
    return genderKey(it)
  })
  const groups = new Map<string, ListItem[]>()
  list.forEach((it, i) => { const k = keys[i]; if (k) { const g = groups.get(k); if (g) g.push(it); else groups.set(k, [it]) } })
  const out: ListItem[] = []
  const done = new Set<string>()
  list.forEach((it, i) => {
    const k = keys[i]
    if (!k) { out.push(it); return }
    if (done.has(k)) return
    done.add(k)
    out.push(...groups.get(k)!)
  })
  memo.set(list, out)
  return out
}
