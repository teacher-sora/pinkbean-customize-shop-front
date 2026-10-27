// 코디 조합 — 넥슨 랭킹 캐릭터의 실제 코디 표본(parser looks/build.ts 가 만들어 CDN looks/v2 에 올린다). 서버 없이 CDN 에서 바로 받는다.
//  · index.json(고정 경로, 60초 캐시) = 지금 판 · 표본 정보 · 아이템마다 [코디 수, 큰 파일 번호, 시작 바이트, 머리 길이, 첫 쪽 길이].
//    목록 카드의 '코디 N' 도 이 색인에서 읽는다. 한 번 받아 메모리에 둔다.
//  · <판>/s<k>.bin(판마다 새 이름, 1년 캐시) = 아이템마다 [머리][전체 쪽들][여 쪽들][남 쪽들]. 머리 · 쪽은 각각 gzip 한 JSON —
//    범위 요청(Range)으로 그 조각만 받아 DecompressionStream 으로 푼다. 처음 열 때는 머리 + 첫 쪽을 요청 한 번에 받는다.
//  · 쪽 = 60벌(LOOK_CHUNK). 패널은 이 묶음을 그 자리의 격자 크기로 잘라 쓴다(combo/ComboPanel).
import { useSyncExternalStore } from 'react'
import { DATA_BASE } from '@/lib/core/data'
import { LRU } from '@/lib/core/lru'
import type { HsbParams, PaletteParams } from '@/lib/core/dye'
import type { PvSnap, Snapshot } from '@/components/shop/ShopContext'

// i 번호(꾸민 코디 · 랭킹 상위가 먼저 — parser build.ts), sk 피부 카드 id(톤의 몸 id), s 스냅샷
export type LookRow = { i: number; sk: string | null; s: Snapshot }
// 자주 쓴 염색 — 헤어 · 성형은 믹스(palette), 그 밖과 피부는 HSB. n = 그 염색으로 입은 사람 수
export type LookDye = { kind: 'palette'; v: PaletteParams; n: number } | { kind: 'hsb'; v: HsbParams; n: number }
export type LookPage = { ready: boolean; total: number; page: number; size: number; looks: LookRow[]; dyes?: LookDye[] }
export type LookMeta = { looks: number; chars: number; from: string; to: string; built: string }
// 성별 — 전체 · 여 · 남(코디의 성별은 입은 아이템의 성별을 가중치로 센 것 — 한벌옷이 가장 무겁다, parser build.ts)
export type LookGender = 'a' | 'f' | 'm'

const BASE = `${DATA_BASE}/looks/v2`

// 아직 dev 에서만 연다(사용자 지시 — 운영에는 아직 올리지 않았다). 고르는 기준은 backApi 와 같은 호스트다. 서버 그림에서는 늘 꺼져 있고
// 브라우저에서만 켜진다(useComboLive) — 운영은 칩 · 광장 탭이 아예 없다.
export const comboLive = () => typeof window !== 'undefined' && !/^(www\.)?pinkbean-customize\.com$/.test(window.location.hostname)
const noSub = () => () => {}
export const useComboLive = () => useSyncExternalStore(noSub, comboLive, () => false)

// ── 색인 ────────────────────────────────────────────────────────────
type Entry = [number, number, number, number, number] // 코디 수, 큰 파일 번호, 시작 바이트, 머리 길이, 첫 쪽 길이
type LookIndex = { v: number; build: string; meta: LookMeta; items: Record<string, Entry> }
let index: LookIndex | null = null
let indexP: Promise<LookIndex | null> | null = null
const subs = new Set<() => void>()
function loadIndex(): Promise<LookIndex | null> {
  if (!indexP) indexP = fetch(`${BASE}/index.json`).then((r) => (r.ok ? r.json() as Promise<LookIndex> : null)).catch(() => null)
    .then((ix) => { index = ix; subs.forEach((f) => f()); return ix })
  return indexP
}
const subscribe = (f: () => void) => { subs.add(f); if (comboLive()) void loadIndex(); return () => { subs.delete(f) } }
// 그 아이템이 든 코디 수(표본에 없으면 0). 처음 부르면 색인을 받기 시작하고, 받으면 다시 그린다
export function useLookCount(id: string): number {
  return useSyncExternalStore(subscribe, () => index?.items[id]?.[0] ?? 0, () => 0)
}
// 코디 수 표 전체(광장의 아이템 찾기가 많은 순으로 고른다)
export const loadLookCounts = (): Promise<Record<string, number>> => loadIndex().then((ix) => Object.fromEntries(Object.entries(ix?.items ?? {}).map(([id, e]) => [id, e[0]])))
// 표본 정보(기준 날짜)
export const loadLookMeta = (): Promise<LookMeta | null> => loadIndex().then((ix) => ix?.meta ?? null)
// 칩 글자: 1,234 → 1.2천, 12,345 → 1.2만(칸이 좁다)
export function countLabel(n: number): string {
  if (n < 1000) return String(n)
  if (n < 10000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}천`
  return `${(n / 10000).toFixed(1).replace(/\.0$/, '')}만`
}

// ── 조각 받기 ───────────────────────────────────────────────────────
// 범위 요청. 혹시 서버가 범위를 무시하고 파일 전체(200)를 주면 그 부분만 잘라 쓴다
async function range(url: string, from: number, len: number): Promise<Uint8Array> {
  const r = await fetch(url, { headers: { Range: `bytes=${from}-${from + len - 1}` } })
  if (!r.ok) throw new Error(String(r.status))
  const b = new Uint8Array(await r.arrayBuffer())
  return r.status === 206 ? b : b.subarray(from, from + len)
}
async function gunzipJson<T>(b: Uint8Array): Promise<T> {
  const s = new Blob([b as BlobPart]).stream().pipeThrough(new DecompressionStream('gzip'))
  return JSON.parse(await new Response(s).text()) as T
}

// 아이템 머리: 성별마다 코디 수 · 자주 쓴 염색 · 쪽마다 바이트 길이. 쪽의 시작 바이트는 길이를 누적해 낸다
type Head = { t: Record<LookGender, number>; d: LookDye[]; p: Record<LookGender, number[]> }
type HeadAt = Head & { url: string; at: Record<LookGender, number[]> }
const heads = new LRU<Promise<HeadAt | null>>(60)
const pages = new LRU<Promise<LookRow[]>>(160)
const pageKey = (id: string, g: LookGender, c: number) => `${id}|${g}|${c}`
function loadHead(id: string): Promise<HeadAt | null> {
  const hit = heads.get(id)
  if (hit) return hit
  const p = loadIndex().then(async (ix) => {
    const e = ix?.items[id]
    if (!ix || !e) return null
    const [, shard, off, hl, p0] = e
    const url = `${BASE}/${ix.build}/s${shard}.bin`
    // 머리 + 전체의 첫 쪽을 한 번에(처음 열 때 요청 한 번)
    const buf = await range(url, off, hl + p0)
    const head = await gunzipJson<Head>(buf.subarray(0, hl))
    if (p0) pages.set(pageKey(id, 'a', 0), gunzipJson<LookRow[]>(buf.subarray(hl)))
    const at = {} as Record<LookGender, number[]>
    let pos = off + hl
    for (const g of ['a', 'f', 'm'] as const) { at[g] = head.p[g].map((len) => { const s = pos; pos += len; return s }) }
    return { ...head, url, at }
  })
  heads.set(id, p)
  p.catch(() => heads.delete(id))
  return p
}
// 아이템 하나의 c 번째 60벌 묶음(그 성별). 첫 묶음에는 자주 쓴 염색도 붙인다. 같은 묶음을 다시 부르면 기억해 둔 것을 준다
export const LOOK_CHUNK = 60
export async function lookChunk(id: string, c: number, g: LookGender = 'a'): Promise<LookPage> {
  const h = await loadHead(id)
  if (!h) return { ready: true, total: 0, page: c, size: LOOK_CHUNK, looks: [], dyes: [] }
  const k = pageKey(id, g, c)
  let p = pages.get(k)
  if (!p) {
    const from = h.at[g][c], len = h.p[g][c]
    p = from == null || !len ? Promise.resolve([]) : range(h.url, from, len).then((b) => gunzipJson<LookRow[]>(b))
    pages.set(k, p)
    p.catch(() => pages.delete(k))
  }
  const looks = await p
  return { ready: true, total: h.t[g], page: c, size: LOOK_CHUNK, looks, ...(c === 0 ? { dyes: h.d } : {}) }
}

// 코디 조합의 코디를 입을 때의 연출 = 지금 연출 그대로(배율 · 액션 · 무기 모션 · 표정 · 이펙트 · 시선 · 명찰 — 남의 설정이 아니라 코디만 가져온다)에
// 귀 · 형상 변이만 그 코디의 값(사용자 지시 — 게임에서 코디에 속하는 분류다). 코디에 그 값이 없으면(지금 표본은 담지 않는다) 지금 값 그대로
export const lookPv = <T extends PvSnap>(snap: Snapshot, pv: T): T => ({ ...pv, ...(snap.pv?.ear ? { ear: snap.pv.ear } : {}), ...(snap.pv?.form ? { form: snap.pv.form } : {}) })
// 카드 · 상세 그림 = 목록 '내 캐릭터' 카드와 같은 연출(ShopContext cardPv — 액션은 서기)에 입을 때와 같은 귀 · 형상 변이(lookPv)를 얹어
// SnapThumb view 로 그린다(사용자 지시 — 같은 방식에서 파생, 본 그대로 입는다)
export const withCardPv = (snap: Snapshot, pv: PvSnap): Snapshot => ({ ...snap, pv: lookPv(snap, pv) })
// 코디 조합을 두지 않는 부위 — 코디는 생김새만 본다(사용자 지시: 훈장 · 칭호는 가져올 필요도, 이 기능을 둘 필요도 없다). 표본에서도 뺀다(parser looks/build.ts)
export const COMBO_SKIP = new Set(['medal', 'title'])
