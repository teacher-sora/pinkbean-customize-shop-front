// 코디 조합 — 넥슨 랭킹 캐릭터의 실제 코디 표본(parser looks/ 가 만들어 CDN looks/v1 에 올린다).
//  · 목록 카드의 '코디 N' = CDN looks/v1/counts.json(아이템 id → 그 아이템이 든 코디 수). 한 번 받아 메모리에 둔다.
//  · 코디 목록 · 자주 쓴 염색 = back 의 POST /looks(아이템 여러 개의 교집합, 입은 사람이 많은 순). 쪽마다 받아 기억한다.
import { useSyncExternalStore } from 'react'
import { backApi } from '@/lib/backApi'
import { DATA_BASE } from '@/lib/core/data'
import { LRU } from '@/lib/core/lru'
import type { HsbParams, PaletteParams } from '@/lib/core/dye'
import type { PvSnap, Snapshot } from '@/components/shop/ShopContext'

// i 번호(입은 사람이 많은 순), n 입은 사람 수, sk 피부 카드 id(톤의 몸 id), s 스냅샷
export type LookRow = { i: number; n: number; sk: string | null; s: Snapshot }
// 자주 쓴 염색 — 헤어 · 성형은 믹스(palette), 그 밖과 피부는 HSB. n = 그 염색으로 입은 사람 수
export type LookDye = { kind: 'palette'; v: PaletteParams; n: number } | { kind: 'hsb'; v: HsbParams; n: number }
export type LookPage = { ready: boolean; total: number; page: number; size: number; looks: LookRow[]; dyes?: LookDye[] }
export type LookMeta = { looks: number; chars: number; from: string; to: string; built: string }

const BASE = `${DATA_BASE}/looks/v1`

// 아직 dev 에서만 연다(사용자 지시 — 운영 서버에는 /looks 가 없다). 고르는 기준은 backApi 와 같은 호스트다. 서버 그림에서는 늘 꺼져 있고
// 브라우저에서만 켜진다(useComboLive) — 운영은 칩 · 광장 탭이 아예 없다.
export const comboLive = () => typeof window !== 'undefined' && !/^(www\.)?pinkbean-customize\.com$/.test(window.location.hostname)
const noSub = () => () => {}
export const useComboLive = () => useSyncExternalStore(noSub, comboLive, () => false)

// ── 목록 카드의 코디 수 ─────────────────────────────────────────────
let counts: Record<string, number> | null = null
let countsP: Promise<void> | null = null
const subs = new Set<() => void>()
function loadCounts() {
  if (!countsP) countsP = fetch(`${BASE}/counts.json`).then((r) => (r.ok ? r.json() : {})).catch(() => ({}))
    .then((c: Record<string, number>) => { counts = c; subs.forEach((f) => f()) })
  return countsP
}
const subscribe = (f: () => void) => { subs.add(f); if (comboLive()) void loadCounts(); return () => { subs.delete(f) } }
// 그 아이템이 든 코디 수(표본에 없으면 0). 처음 부르면 counts.json 을 받기 시작하고, 받으면 다시 그린다
export function useLookCount(id: string): number {
  return useSyncExternalStore(subscribe, () => counts?.[id] ?? 0, () => 0)
}
// 코디 수 표 전체(광장의 아이템 찾기가 많은 순으로 고른다)
export const loadLookCounts = (): Promise<Record<string, number>> => loadCounts().then(() => counts ?? {})
// 칩 글자: 1,234 → 1.2천, 12,345 → 1.2만(칸이 좁다)
export function countLabel(n: number): string {
  if (n < 1000) return String(n)
  if (n < 10000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}천`
  return `${(n / 10000).toFixed(1).replace(/\.0$/, '')}만`
}

// ── 표본 정보(기준 날짜) ───────────────────────────────────────────
let metaP: Promise<LookMeta | null> | null = null
export const loadLookMeta = () => (metaP ??= fetch(`${BASE}/meta.json`).then((r) => (r.ok ? r.json() : null)).catch(() => null))

// ── 코디 목록 쪽 ────────────────────────────────────────────────────
// 같은 쪽을 다시 부르면 기억해 둔 것을 준다(오가며 넘겨도 다시 받지 않는다). 실패한 쪽은 지워 다음에 다시 받는다.
const pages = new LRU<Promise<LookPage>>(120)
export function fetchLooks(ids: string[], page: number, size: number): Promise<LookPage> {
  const k = `${ids.join(',')}|${size}|${page}`
  const hit = pages.get(k)
  if (hit) return hit
  const p = fetch(`${backApi()}/looks`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids, page, size }) })
    .then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.json() as Promise<LookPage> })
  pages.set(k, p)
  p.then((d) => { if (!d.ready) pages.delete(k) }).catch(() => pages.delete(k)) // 서버가 표본을 아직 못 받았으면 다음에 다시
  return p
}
// 목록은 쪽 크기와 상관없이 60벌(서버가 한 번에 주는 최대) 묶음으로 받는다 — 창 크기 · 격자가 바뀌어도 받은 묶음을 그대로 쓰고,
// 목록 카드의 칩에 올리거나 누르는 순간 첫 묶음을 미리 받아 둘 수 있다(쪽 크기는 패널을 연 뒤에야 정해진다)
export const LOOK_CHUNK = 60
// 카드 · 상세 그림 = 목록 '내 캐릭터' 카드와 같은 연출(지금 연출 설정의 시선 · 표정 · 귀 · 무기 모션 · 형상 변이 · 이펙트, 액션은 서기 — ShopContext cardPv)을 얹어
// SnapThumb view 로 그린다(사용자 지시 — 같은 방식에서 파생). 입기 · 프리셋에 저장은 원래 스냅샷(row.s) 그대로다
export const withCardPv = (snap: Snapshot, pv: PvSnap): Snapshot => ({ ...snap, pv })
// 코디 조합을 두지 않는 부위 — 코디는 생김새만 본다(사용자 지시: 훈장 · 칭호는 가져올 필요도, 이 기능을 둘 필요도 없다). 표본에서도 뺀다(parser looks/build.ts)
export const COMBO_SKIP = new Set(['medal', 'title'])
export const lookChunk = (id: string, c: number): Promise<LookPage> => fetchLooks([id], c, LOOK_CHUNK)
