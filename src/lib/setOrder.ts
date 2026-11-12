// 목록 순서: 같은 세트의 아이템을 한자리에 모은다(사용자 지시 — '금단의 계약 (여)' 와 '파멸의 계약 (남)', 신규의 포근복닥 가디건 세트처럼
// 같은 세트가 목록에서 멀리 떨어져 있었다). 세트는 **공식 출처나 사용자가 확인한 것만** 묶는다(사용자 지시 — 이름 머리말로 짐작해 묶었더니
// '포근복닥 가디건 세트(남)' 이 '포근포근 비니 + 포근포근 가디건 + 복닥복닥 슈즈' 인 것처럼 이름과 엇갈리는 세트가 틀리게 묶였다).
//  · 묶는 열쇠(앞의 것이 먼저):
//    1. 세트 표(CDN catalog/sets.json — parser scripts/sets-build.py: 공지 본문, 선택권 설명, 옛 캐시 패키지, 사용자 확인 묶음). 목록을 받을 때 아이템에
//       setGroup · setSub 로 붙는다(lib/core/data loadSlot). 남녀 세트는 한 무리이고, 무리 안은 여자 전용 → 남자 전용 → 공용이다(setSub 0 · 1 · 2, 사용자 지시 — 크림슨 데빌처럼 남녀 세트에 함께 든 것이 공용).
//    2. 게임의 세트 번호(setItemID — 마스터라벨 등).
//    3. 끝의 '(남)' · '(여)' 만 다른 같은 이름(같은 부위) — 같은 아이템의 남녀판이다.
//  · 무리는 그 무리에서 가장 앞에 있던 아이템 자리에 모인다. **무리 안 순서(모든 무리가 같은 꼴 — 사용자 지시 2026-11-13)**:
//      ① 앞 공용 — 성별 칸(여자 · 남자 전용) 아이템보다 앞 부위인 공용 아이템(모자 등)
//      ② 여자 전용  ③ 남자 전용
//      ④ 뒤 공용 — 나머지 공용(신발 · 망토 · 무기 등)
//      ⑤ 라이딩(세트 표 무리 — 늘 맨 끝, 사용자 지시)
//    칸 안은 원래 순서(= '전체' 면 부위 순서 — 모자 → … → 한벌옷 → 신발 → 망토 → 무기). 그래서 '여자 → 남자 → 공용'(크림슨 팩트: 여 캡 · 드레스 · 힐 →
//    남 혼 · 슈트 · 로퍼 → 망토 · 무기)과 '모자 → 옷 → 신발 → 무기'가 함께 지켜진다. 예전에는 공용을 늘 뒤에 두어, 모자가 공용인 세트(블리츠 스톰,
//    달곰한 베이커 — 남녀가 나뉜 무리의 절반)가 여 한벌옷 → 남 한벌옷 → 모자 순으로 보였다(사용자 지적).
//    성별 칸 = 세트 표 무리는 setSub(0 여 · 1 남 · 2 공용), 세트 번호 · 남녀판 무리는 아이템 성별.
//    '전체' 는 부위 순서를 바꾸면 세트 안의 순서도 함께 바뀐다. 성별 필터는 이 뒤에 걸러 여자 아이템만 볼 수도 있다.
//  · 한 번 훑는 계산이다(1만 4천 개에 몇 ms). 같은 목록 배열은 결과를 기억한다.
import type { ListItem } from './core/data'

const GENDER_TAIL = /\s*\((남|여)\)\s*$/
const keyOf = (it: ListItem): string | null => {
  if (it.setGroup != null) return `o${it.setGroup}`
  if (it.setItemID) return `s${it.setItemID}`
  const n = it.name
  return n && GENDER_TAIL.test(n) ? `n${it.slot}|${n.replace(GENDER_TAIL, '')}` : null
}

const genderRank = (it: ListItem) => (it.gender === 1 ? 0 : it.gender === 0 ? 1 : 2)
const memo = new WeakMap<ListItem[], ListItem[]>()
export function groupSets (list: ListItem[]): ListItem[] {
  const hit = memo.get(list)
  if (hit) return hit
  const keys = list.map(keyOf)
  const groups = new Map<string, ListItem[]>()
  list.forEach((it, i) => { const k = keys[i]; if (k) { const g = groups.get(k); if (g) g.push(it); else groups.set(k, [it]) } })
  const out: ListItem[] = []
  const done = new Set<string>()
  list.forEach((it, i) => {
    const k = keys[i]
    if (!k) { out.push(it); return }
    if (done.has(k)) return
    done.add(k)
    const g = groups.get(k)!
    if (g.length > 1) {
      // 칸 매기기(머리말의 ① ~ ⑤). g 는 원래 순서라 g 안의 자리가 곧 부위 순서다. sort 는 안정 정렬이라 같은 칸 안은 원래 순서 그대로
      // 라이딩은 늘 세트의 맨 끝이다(사용자 지시 — 부위 줄 순서를 바꿔도. 블루 아카이브 학생 세트의 물구름 호 · 전차 토라마루 · 세이아의 오픈카)
      const sub = k[0] === 'o' ? (x: ListItem) => x.setSub ?? 0 : genderRank
      const at = new Map(g.map((x, j) => [x, j]))
      let firstGendered = Infinity
      g.forEach((x, j) => { if (x.slot !== 'riding' && sub(x) !== 2 && j < firstGendered) firstGendered = j })
      const rank = (x: ListItem) => (k[0] === 'o' && x.slot === 'riding' ? 4 : sub(x) === 0 ? 1 : sub(x) === 1 ? 2 : at.get(x)! < firstGendered ? 0 : 3)
      g.sort((x, y) => rank(x) - rank(y))
    }
    out.push(...g)
  })
  memo.set(list, out)
  return out
}
