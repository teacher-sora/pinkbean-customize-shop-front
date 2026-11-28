// 아이템 코디 룩북 페이지(/lookbook/<id>)와 사이트맵이 쓰는 서버 쪽 데이터 — 검색엔진이 아이템 이름으로 이 사이트를 찾게 한다(사용자 지시).
//  · 아이템 하나 = CDN meta/<id>.json(이름 · 부위 · 성별 — 작아서 요청마다 받아도 된다, 하루 캐시)
//  · 코디 수 = 코디 룩북 색인 looks/v2/index.json(약 160KB, 한 시간 캐시) — 화면의 '코디 N' 칩과 같은 값
//  · 페이지 목록(사이트맵) = 장비 부위 목록 14개를 앱과 같은 규칙으로 접은 대표(shopData.foldList — 헤어 · 성형은 색 변형 묶음당 하나)
//    가운데 캐시 아이템이거나 표본에 있는 것. 목록 파일은 합쳐 15MB 라 사이트맵을 만들 때(하루 한 번)만 받는다.
import { DATA_BASE, type ListItem } from '@/lib/core/data'
import { foldList } from '@/lib/shopData'

const CDN = DATA_BASE.replace(/\/+$/, '')
const DAY = 86400
// 코디 룩북이 다루는 장비 부위(CDN 색인 index.json 의 slots 와 같다). 훈장 · 칭호는 룩북이 없다(lib/looks COMBO_SKIP)
export const LOOKBOOK_SLOTS = ['hair', 'face', 'cap', 'faceAcc', 'eyeAcc', 'earring', 'coat', 'longcoat', 'pants', 'shoes', 'glove', 'cape', 'weapon', 'shield']
export const LOOKBOOK_ID = /^\d{8}$/

async function cdnJson<T>(rel: string, revalidate: number): Promise<T | null> {
  try {
    const r = await fetch(`${CDN}/${rel}`, { next: { revalidate } })
    return r.ok ? ((await r.json()) as T) : null
  } catch { return null }
}

export type LookbookItem = { id: string; name: string; slot: string; gender?: number; isCash?: boolean }
// 아이템 하나(페이지의 제목 · 설명 · 요약). 없거나 룩북 부위가 아니면 null
export async function lookbookItem(id: string): Promise<LookbookItem | null> {
  if (!LOOKBOOK_ID.test(id)) return null
  const m = await cdnJson<LookbookItem>(`meta/${id}.json`, DAY)
  return m && m.name && LOOKBOOK_SLOTS.includes(m.slot) ? { id, name: m.name, slot: m.slot, gender: m.gender, isCash: m.isCash } : null
}

type LookIndex = { build?: string; meta?: { looks: number; built: string }; items: Record<string, number[]> }
// entries = 아이템마다 [코디 수, 큰 파일 번호, 시작 바이트, 머리 길이, 첫 쪽 길이](lib/looks 의 색인과 같다), build = 지금 판 — 페이지가 첫 조각을 미리 받게 한다
export async function lookbookIndex(): Promise<{ counts: Record<string, number>; built: string | null; build: string | null; entries: Record<string, number[]> }> {
  const ix = await cdnJson<LookIndex>('looks/v2/index.json', 3600)
  const entries = ix?.items ?? {}
  return { counts: Object.fromEntries(Object.entries(entries).map(([id, e]) => [id, e[0]])), built: ix?.meta?.built ?? null, build: ix?.build ?? null, entries }
}

// 사이트맵에 올릴 아이템 id(부위 순서, 부위 안은 목록 순서)
export async function lookbookIds(): Promise<string[]> {
  const [{ counts }, lists] = await Promise.all([
    lookbookIndex(),
    // 목록 파일은 2MB 를 넘는 것이 있어 fetch 캐시에 담기지 않는다(경고만) — 사이트맵 자체가 하루 캐시라 하루 한 번 받는다
    Promise.all(LOOKBOOK_SLOTS.map((s) => cdnJson<ListItem[]>(`slots/${s}.json`, DAY).then((l) => l ?? []))),
  ])
  return lists.flatMap((l) => foldList(l).filter((it) => it.isCash || (counts[it.id] ?? 0) > 0).map((it) => it.id))
}
