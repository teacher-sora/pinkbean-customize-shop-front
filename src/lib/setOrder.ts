// 목록 순서: 같은 세트의 아이템을 한자리에 모은다(사용자 지시 — '금단의 계약 (여)' 와 '파멸의 계약 (남)', 신규의 '복닥복닥 털실 비니' ·
// '복닥복닥 가디건' · '복닥복닥 슈즈' 처럼 같은 세트가 목록에서 멀리 떨어져 있었다).
//  · 묶는 열쇠(앞의 것이 먼저):
//    1. 게임의 세트 번호(setItemID).
//    2. 세트 번호가 없는 캐시 아이템은 이름의 첫 낱말('[…]' 머리표는 뗀다) — 캐시 세트는 대부분 번호 없이 같은 머리말을 쓴다.
//       그 목록에서 같은 첫 낱말이 TOKEN_MAX 개를 넘거나 색 이름 같은 흔한 낱말이면 세트가 아니라 보고 쓰지 않는다('핑크' 66개, '모험가' 71개).
//       머리말이 다른 남녀 짝 세트('포근포근 털실 비니' ↔ '복닥복닥 털실 비니', '진심진료' ↔ '극약처방' — 마스터라벨의 '금단의 계약' ↔
//       '파멸의 계약' 처럼 이름만 살짝 다르다)는 setLinks 가 한 무리로 잇는다: 두 머리말이 두 부위 이상에서 같은 뒷이름을 갖고, 그중
//       한 쌍이라도 아이템 번호가 LINK_ID_GAP 안으로 붙어 있으면(함께 등록됐다 — 남녀 공용 모자는 짝끼리 번호가 붙는다) 같은 세트다.
//       흔한 머리말(전 부위 TOKEN_MAX 개 초과)은 잇지 않고, 양쪽 묶음의 절반 이상이 뒷이름으로 맞고 짝이 하나로 정해지는 두 머리말끼리만 잇는다.
//    3. 끝의 '(남)' · '(여)' 만 다른 같은 이름(같은 부위).
//  · 무리는 그 무리에서 가장 앞에 있던 아이템 자리에 모이고, 무리 안 순서는 원래 순서(= '전체' 면 부위 순서)를 따른다.
//    그래서 '전체' 는 부위 순서를 바꾸면 세트 안의 순서도 함께 바뀐다. 성별 필터는 이 뒤에 걸러 여자 아이템만 볼 수도 있다.
//  · 한 번 훑는 계산이다(1만 4천 개에 몇 ms). 같은 목록 배열은 결과를 기억한다.
import type { ListItem } from './core/data'

const TOKEN_MAX = 12
const LINK_ID_GAP = 3
const SPOT_WIDE = 60
const COMMON = new Set(['New', '내', '진', '투명', '블랙', '화이트', '핑크', '블루', '레드', '그린', '옐로우', '퍼플', '브라운', '골드', '실버', '다크', '라이트',
  '흰색', '검은', '검정', '빨간', '빨간색', '파란', '파란색', '노란', '노란색', '하늘색', '분홍색', '초록', '초록색', '갈색', '보라', '보라색', '회색', '주황', '주황색', '노랑', '하늘', '파랑', '빨강', '검정색', '빨강색', '파랑색', '노랑색', '분홍', '큐티', '러블리', '와일드'])
const GENDER_TAIL = /\s*\((남|여)\)\s*$/
const firstToken = (it: ListItem): string | null => {
  if (!it.isCash || it.setItemID || it.slot === 'hair' || it.slot === 'face') return null // 헤어 · 성형은 이름 짓는 법이 달라 머리말이 같아도 세트가 아니다
  const t = (it.name ?? '').replace(/^\[[^\]]*\]\s*/, '').split(' ')
  return t.length > 1 && t[0] && !COMMON.has(t[0]) ? t[0] : null
}
const splitName = (it: ListItem): [string, string] | null => {
  const t = firstToken(it)
  if (!t) return null
  const rest = (it.name ?? '').replace(/^\[[^\]]*\]\s*/, '').slice(t.length).replace(GENDER_TAIL, '').trim()
  return rest ? [t, rest] : null
}

// 머리말 → 그 무리의 대표 머리말(이을 것이 없으면 빈 표). 전 부위 목록(전체)으로 한 번 만들어 부위 하나짜리 목록에도 쓴다
export type SetLinks = Map<string, string>
export function setLinks (list: ListItem[]): SetLinks {
  // 세트 머리말로 볼 만한 것(전 부위에서 TOKEN_MAX 개 이하)만 잇는다 — '핑크빈' · '황금' 같은 흔한 머리말이 서로 이어지지 않게
  const tokN = new Map<string, number>()
  for (const it of list) { const t = firstToken(it); if (t) tokN.set(t, (tokN.get(t) ?? 0) + 1) }
  // (부위, 뒷이름) → 그 자리의 [머리말, 번호, 아이템]
  const spots = new Map<string, [string, number, string][]>()
  for (const it of list) {
    const sp = splitName(it)
    if (!sp || tokN.get(sp[0])! > TOKEN_MAX) continue
    const k = `${it.slot}|${sp[1]}`
    const a = spots.get(k)
    const e: [string, number, string] = [sp[0], parseInt(it.id, 10), it.id]
    if (a) a.push(e); else spots.set(k, [e])
  }
  // 머리말 쌍마다 뒷이름이 같은 부위 수와 번호가 붙은 쌍이 있는지
  const pairs = new Map<string, { slots: Set<string>; near: boolean; a: Set<string>; b: Set<string> }>()
  for (const [k, a] of spots) {
    if (a.length < 2) continue
    const slot = k.slice(0, k.indexOf('|'))
    // 흔한 뒷이름('모자' 158개)은 번호가 붙은 쌍만 본다 — 모든 쌍을 보면 계산이 대부분 여기서 든다
    const wide = a.length > SPOT_WIDE
    if (wide) a.sort((x, y) => x[1] - y[1])
    for (let i = 0; i < a.length; i++) for (let j = i + 1; j < a.length; j++) {
      if (wide && a[j][1] - a[i][1] > LINK_ID_GAP) break
      const [x, y] = a[i][0] < a[j][0] ? [a[i], a[j]] : [a[j], a[i]]
      if (x[0] === y[0]) continue
      const pk = `${x[0]}\u0000${y[0]}`
      const p = pairs.get(pk) ?? { slots: new Set<string>(), near: false, a: new Set<string>(), b: new Set<string>() }
      p.slots.add(slot); p.a.add(x[2]); p.b.add(y[2])
      if (Math.abs(x[1] - y[1]) <= LINK_ID_GAP) p.near = true
      pairs.set(pk, p)
    }
  }
  // 짝은 둘씩만 잇는다(남녀 한 쌍) — 셋 이상이 꼬리를 물면 엉뚱한 묶음이 커진다. 근거가 여럿인 머리말은 짝을 정하지 않는다
  const cand = new Map<string, string[]>()
  for (const [pk, p] of pairs) {
    if (p.slots.size < 2 || !p.near) continue
    const [a, b] = pk.split('\u0000')
    // 양쪽 모두 머리말 묶음의 절반 이상이 짝과 뒷이름이 맞아야 한다 — '로즈' · '크리스탈' 처럼 한두 개만 겹치는 흔한 머리말은 세트 짝이 아니다
    if (p.a.size * 2 < tokN.get(a)! || p.b.size * 2 < tokN.get(b)!) continue
    for (const [x, y] of [[a, b], [b, a]]) { const c = cand.get(x); if (c) c.push(y); else cand.set(x, [y]) }
  }
  const out: SetLinks = new Map()
  for (const [a, c] of cand) {
    if (c.length !== 1) continue
    const b = c[0]
    if (cand.get(b)?.length !== 1) continue
    out.set(a, a < b ? a : b)
  }
  return out
}
const genderKey = (it: ListItem): string | null => {
  const n = it.name
  return n && GENDER_TAIL.test(n) ? `n${it.slot}|${n.replace(GENDER_TAIL, '')}` : null
}

const memo = new WeakMap<ListItem[], { links: SetLinks | undefined; out: ListItem[] }>()
export function groupSets (list: ListItem[], links?: SetLinks): ListItem[] {
  const hit = memo.get(list)
  if (hit && hit.links === links) return hit.out
  const toks = list.map((it) => { const t = firstToken(it); return t && links ? links.get(t) ?? t : t })
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
  memo.set(list, { links, out })
  return out
}
