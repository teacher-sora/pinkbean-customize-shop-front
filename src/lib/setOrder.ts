// 목록 순서: 같은 세트의 아이템을 한자리에 모은다(사용자 지시 — '금단의 계약 (여)' 와 '파멸의 계약 (남)' 처럼 성별로 갈린 같은 세트가
// 목록에서 멀리 떨어져 있었다. 실측: 같은 부위 안 남녀 세트 283개, 둘 사이가 보통 145칸).
//  · 묶는 열쇠: 게임의 세트 번호(setItemID). 없으면 끝의 '(남)' · '(여)' 만 다른 같은 이름(같은 부위).
//  · 무리는 그 무리에서 가장 앞에 있던 아이템 자리에 모이고, 무리 안 순서는 원래 순서(= '전체' 면 부위 순서)를 따른다.
//    그래서 '전체' 는 부위 순서를 바꾸면 세트 안의 순서도 함께 바뀐다. 성별 필터는 이 뒤에 걸러 여자 아이템만 볼 수도 있다.
//  · 한 번 훑는 계산이다(1만 4천 개에 몇 ms). 같은 목록 배열은 결과를 기억한다.
import type { ListItem } from './core/data'

const GENDER_TAIL = /\s*\((남|여)\)\s*$/
function setKey (it: ListItem): string | null {
  if (it.setItemID) return `s${it.setItemID}`
  const n = it.name
  if (!n || !GENDER_TAIL.test(n)) return null
  return `n${it.slot}|${n.replace(GENDER_TAIL, '')}`
}

const memo = new WeakMap<ListItem[], ListItem[]>()
export function groupSets (list: ListItem[]): ListItem[] {
  const hit = memo.get(list)
  if (hit) return hit
  const groups = new Map<string, ListItem[]>()
  const keys = list.map(setKey)
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
