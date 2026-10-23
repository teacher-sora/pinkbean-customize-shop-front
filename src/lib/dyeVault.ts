// 염색 보관함 — 아이템 하나의 염색 값을 여러 벌 담아 두고 골라 보는 곳(사용자 지시: 북마크 · 프리셋과 별개, 컬러라인 피부처럼 여러 값을 오가며 보고 싶다).
// 사용자가 [담기]를 누를 때만 담긴다(수치를 바꿀 때마다 담지 않는다). 이 기기의 localStorage 에만 있다(서버 없음 — 북마크와 같다).
// 아이템 id 마다 최근 것이 앞. 같은 값은 한 번만.
import { useEffect, useState } from 'react'
import type { HsbParams, PaletteParams } from './core/dye'

export type DyeSave = { hsb: HsbParams } | { pal: PaletteParams }
export const DYE_VAULT_MAX = 12
const KEY = 'pb_dye_vault_v1'

type Store = Record<string, DyeSave[]>
const read = (): Store => { try { const v = JSON.parse(localStorage.getItem(KEY) || '{}'); return v && typeof v === 'object' ? v as Store : {} } catch { return {} } }
const listeners = new Set<() => void>()
const write = (st: Store) => { try { localStorage.setItem(KEY, JSON.stringify(st)) } catch { /* 저장 공간이 없으면 이번 화면에서만 */ } listeners.forEach((f) => f()) }

// 견줄 때는 값만(색상 계열 · 테두리 포함까지 — 담는 값 그대로)
export const dyeSaveKey = (d: DyeSave): string => 'hsb' in d
  ? `h${d.hsb.h}|${d.hsb.s}|${d.hsb.b}|${d.hsb.t ?? 0}|${d.hsb.edge ? 1 : 0}`
  : `p${d.pal.baseColor}|${d.pal.mixColor ?? d.pal.baseColor}|${d.pal.mixColor == null || d.pal.mixColor === d.pal.baseColor ? 0 : d.pal.ratio}`

export function useDyeVault (itemId: string) {
  const [list, setList] = useState<DyeSave[]>([])
  useEffect(() => {
    const sync = () => setList(read()[itemId] ?? [])
    sync()
    listeners.add(sync)
    return () => { listeners.delete(sync) }
  }, [itemId])
  const put = (d: DyeSave) => {
    const st = read(), cur = st[itemId] ?? [], k = dyeSaveKey(d)
    if (cur.some((x) => dyeSaveKey(x) === k) || cur.length >= DYE_VAULT_MAX) return
    write({ ...st, [itemId]: [d, ...cur] })
  }
  const remove = (d: DyeSave) => {
    const st = read(), k = dyeSaveKey(d), next = (st[itemId] ?? []).filter((x) => dyeSaveKey(x) !== k)
    const out = { ...st }
    if (next.length) out[itemId] = next; else delete out[itemId]
    write(out)
  }
  const clear = () => { const st = read(); if (!st[itemId]) return; const out = { ...st }; delete out[itemId]; write(out) }
  return { list, put, remove, clear }
}
