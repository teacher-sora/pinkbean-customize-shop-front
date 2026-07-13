'use client'

/*
 * ShopContext — 상태·핸들러 단일 출처.
 * 코디(부위별 아이템 목록·착용)와 미리보기 합성은 실제 CDN 데이터를 사용한다.
 *   - index/slots/meta 는 src/lib/core/data.ts 로 CDN(https://cdn.pinkbean-customize.com)에서 로드.
 *   - equipped 는 실제 slot → ListItem. 미리보기(PreviewModel)가 이 값을 합성.
 * 프리셋/염색 UI 는 이 실제 모델 위에서 동작(염색 시각화·이펙트·형상변이 합성은 다음 단계).
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { ITEMS_PER_PAGE, type Mix, type Hsv, type Preset, type Pv } from '@/lib/catalog'
import { defHsv, defMix } from '@/lib/color'
import { loadAnima, loadEffectIndex, loadIndex, loadSlot, type Index, type ListItem } from '@/lib/core/data'
import { conflictSlots } from '@/lib/core/slots'
import { CAT_TO_SLOT, DEFAULT_EQUIP, DEFAULT_TONE, EQUIP_SLOTS, foldList } from '@/lib/shopData'

type Dispatch<T> = React.Dispatch<React.SetStateAction<T>>
export type ListMode = 'sprite' | 'model' | 'mymodel' // 아이템 리스트 표시: 스프라이트 / 베이스 모델 / 내 모델
// 염색 대상은 실제 slot. hair/face(성형)만 믹스 염색, 그 외 HSV.
const isMixSlot = (slot: string) => slot === 'hair' || slot === 'face'
// 프리셋 스냅샷: 착용(slot→itemId) + 톤 + 염색 + 숨김.
export type Snapshot = { equipped: Record<string, string>; tone: number; dyeMix: Record<string, Mix>; dyeHsv: Record<string, Hsv>; hidden: Record<string, boolean> }

export interface ShopCtx {
  // 데이터
  index: Index | null
  dataLoading: boolean
  catLoading: boolean
  listForCat: (cat: string) => ListItem[]
  activeList: ListItem[] // 활성 부위의 folded 리스트에 검색 필터 적용(정렬 순서 유지)
  search: string; setSearch: Dispatch<string>
  // primary/screen
  primary: string; setPrimary: Dispatch<string>
  // codi
  activeCat: string; setActiveCat: Dispatch<string>
  listMode: ListMode; setListMode: Dispatch<ListMode>
  partMenuOpen: boolean; setPartMenuOpen: Dispatch<boolean>
  partWrapRef: React.MutableRefObject<HTMLDivElement | null>
  bindVp: (el: HTMLDivElement | null) => void
  curIdx: number; pageCount: number
  offset: number; snapping: boolean; setOffset: Dispatch<number>; setSnapping: Dispatch<boolean>
  setIdx: (i: number, snap?: boolean) => void; step: (dir: number) => void
  pageEditing: boolean; pageInput: string
  onPageFocus: (e: React.FocusEvent<HTMLInputElement>) => void
  onPageChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  onPageKey: (e: React.KeyboardEvent<HTMLInputElement>) => void
  commitPage: () => void
  // 착용(실제)
  equipped: Record<string, ListItem | null>
  tone: number
  equipFromCat: (cat: string, item: ListItem) => void
  isEquippedInCat: (cat: string, itemId: string) => boolean
  hidden: Record<string, boolean>; setHidden: Dispatch<Record<string, boolean>>
  // 염색(slot 키)
  dyeTarget: string | null; setDyeTarget: Dispatch<string | null>
  dyeMix: Record<string, Mix>; setDyeMix: Dispatch<Record<string, Mix>>
  dyeHsv: Record<string, Hsv>; setDyeHsv: Dispatch<Record<string, Hsv>>
  dyeEdit: Record<string, string>; setDyeEdit: Dispatch<Record<string, string>>
  isMixSlot: (slot: string) => boolean
  // 염색 다이얼로그(slot 대상)
  dialogSlot: string | null; dialogClosing: boolean
  openDye: (slot: string) => void; closeDye: () => void
  // preview
  pv: Pv; setPv: (key: keyof Pv, val: Pv[keyof Pv]) => void
  pvOpen: boolean; setPvOpen: Dispatch<boolean>
  // presets
  presets: Preset[]; presetData: Record<string, Snapshot>; selectedPreset: string | null
  selectPreset: (id: string) => void; sharePreset: (p: Preset) => void
  editingPreset: string | null; editName: string; setEditName: Dispatch<string>
  setEditingPreset: Dispatch<string | null>
  startRename: (id: string, name: string, e: React.MouseEvent) => void
  commitRename: () => void
  nickInput: string; setNickInput: Dispatch<string>
  importMode: 'nick' | 'code'; setImportMode: Dispatch<'nick' | 'code'>
  importFetch: () => void
  shareCurrent: () => void
  // toast
  toast: boolean; toastText: string
  // hover
  hoverCat: string | null; setHoverCat: Dispatch<string | null>
  hoverPrimary: string | null; setHoverPrimary: Dispatch<string | null>
  hoverPill: string | null; setHoverPill: Dispatch<string | null>
  hoverMode: string | null; setHoverMode: Dispatch<string | null>
  hoverToggle: string | null; setHoverToggle: Dispatch<string | null>
  hoverPartBtn: boolean; setHoverPartBtn: Dispatch<boolean>
  hoverDlgClose: boolean; setHoverDlgClose: Dispatch<boolean>
  hoverDlgApply: boolean; setHoverDlgApply: Dispatch<boolean>
}

const Ctx = createContext<ShopCtx | null>(null)
export const useShop = () => {
  const v = useContext(Ctx)
  if (!v) throw new Error('useShop must be used within <ShopProvider>')
  return v
}

export function ShopProvider({ children }: { children: React.ReactNode }) {
  // ── 데이터 ──
  const [index, setIndex] = useState<Index | null>(null)
  const [lists, setLists] = useState<Record<string, ListItem[]>>({})
  const [dataLoading, setDataLoading] = useState(true)

  // ── UI ──
  const [primary, setPrimary] = useState('codi')
  const [activeCat, setActiveCat] = useState('hair')
  const [listMode, setListMode] = useState<ListMode>('model') // 기본=모델(코디는 모델이 기본)
  const [search, setSearch] = useState('')
  const [equipped, setEquipped] = useState<Record<string, ListItem | null>>({})
  const [tone, setTone] = useState(0)
  const [hidden, setHidden] = useState<Record<string, boolean>>({})
  const [dyeTarget, setDyeTarget] = useState<string | null>(null)
  const [dyeMix, setDyeMix] = useState<Record<string, Mix>>({})
  const [dyeHsv, setDyeHsv] = useState<Record<string, Hsv>>({})
  const [dyeEdit, setDyeEdit] = useState<Record<string, string>>({})
  const [dialogSlot, setDialogSlot] = useState<string | null>(null)
  const [dialogClosing, setDialogClosing] = useState(false)
  const [pageByCat, setPageByCat] = useState<Record<string, number>>({})
  const [offset, setOffset] = useState(0)
  const [snapping, setSnapping] = useState(false)
  const [pageEditing, setPageEditing] = useState(false)
  const [pageInput, setPageInput] = useState('')
  const [partMenuOpen, setPartMenuOpen] = useState(false)
  const [pv, setPvState] = useState<Pv>({
    action: 'basic', weapon: 'basic', expr: 'default', ear: 'humanEar', form: 'none',
    gaze: 'left', wEffect: true, cEffect: true, fps: 12, zoom: 2,
  })
  const [pvOpen, setPvOpen] = useState(false)
  const [presets, setPresets] = useState<Preset[]>(() => Array.from({ length: 20 }, (_, i) => ({ id: 'd' + i, name: `코디 ${i + 1}` })))
  const [presetData, setPresetData] = useState<Record<string, Snapshot>>({})
  const [selectedPreset, setSelectedPreset] = useState<string | null>('d0')
  const [nickInput, setNickInput] = useState('')
  const [importMode, setImportMode] = useState<'nick' | 'code'>('nick')
  const [editingPreset, setEditingPreset] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [toast, setToast] = useState(false)
  const [toastText, setToastText] = useState('')
  const [hoverCat, setHoverCat] = useState<string | null>(null)
  const [hoverPrimary, setHoverPrimary] = useState<string | null>(null)
  const [hoverPill, setHoverPill] = useState<string | null>(null)
  const [hoverMode, setHoverMode] = useState<string | null>(null)
  const [hoverToggle, setHoverToggle] = useState<string | null>(null)
  const [hoverPartBtn, setHoverPartBtn] = useState(false)
  const [hoverDlgClose, setHoverDlgClose] = useState(false)
  const [hoverDlgApply, setHoverDlgApply] = useState(false)

  const partWrapRef = useRef<HTMLDivElement | null>(null)
  const vpElRef = useRef<HTMLDivElement | null>(null)
  const toastT = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dlgT = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pageT = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastWheelStep = useRef(0)
  const drag = useRef({ on: false, captured: false, startX: 0, lastX: 0, lastT: 0, vel: 0 })

  // ── 초기 로드: index 만(빠르게). 부위 리스트는 "보여질 때" 지연 로드 ──
  useEffect(() => {
    let alive = true
    // 연출 옵션 데이터(형상변이/이펙트 인덱스)를 미리 캐시 → 선택 시 즉시 적용.
    loadAnima().catch(() => {})
    loadEffectIndex().catch(() => {})
    loadIndex().then((idx) => {
      if (!alive) return
      setIndex(idx); setTone(DEFAULT_TONE)
      const eq: Record<string, ListItem | null> = {}
      for (const s of EQUIP_SLOTS) eq[s] = null
      Object.assign(eq, DEFAULT_EQUIP) // 기본 착용(녹셀 헤어 검정·운명의 인도자 얼굴·금단의 계약)
      setEquipped(eq)
    }).catch((e) => console.error('[shop] index 로드 실패', e))
      .finally(() => { if (alive) setDataLoading(false) })
    return () => { alive = false }
  }, [])

  // 부위 리스트 지연 로드(활성 부위만). loadSlot 은 data.ts 에서 파일별 캐시됨.
  const loadingSlots = useRef<Set<string>>(new Set())
  const ensureSlot = useCallback((slot: string) => {
    if (!index || slot === 'skin') return
    if (lists[slot] !== undefined || loadingSlots.current.has(slot)) return
    const summary = index.slots.find((s) => s.slot === slot)
    if (!summary) { setLists((m) => ({ ...m, [slot]: [] })); return }
    loadingSlots.current.add(slot)
    loadSlot(summary.file)
      .then((l) => setLists((m) => ({ ...m, [slot]: foldList(l) }))) // fold: 헤어/성형=검정 대표 1개, 장비=이름당 1개
      .catch(() => setLists((m) => ({ ...m, [slot]: [] })))
      .finally(() => loadingSlots.current.delete(slot))
  }, [index, lists])
  useEffect(() => { if (activeCat !== 'skin') ensureSlot(CAT_TO_SLOT[activeCat]) }, [activeCat, ensureSlot])

  // 피부(skin) = index.base.tones 를 합성 리스트로. 그 외는 lists[slot].
  const skinList = useMemo<ListItem[]>(() => {
    if (!index) return []
    return index.base.tones.map((t) => ({
      id: t.body, slot: 'skin', isCash: false, grade: 'none', islot: null, vslot: null,
      dyeMode: 'hsb', thumb: `sprites/${t.body}/thumb.png`, headId: t.head, name: t.name || `피부 ${t.tone}`, actions: [],
    }))
  }, [index])
  const listForCat = useCallback((cat: string): ListItem[] => {
    if (cat === 'skin') return skinList
    return lists[CAT_TO_SLOT[cat]] || []
  }, [lists, skinList])

  // 활성 부위 리스트 로딩중?(index 미로드 또는 해당 slot 미로드)
  const catLoading = dataLoading || (activeCat !== 'skin' && lists[CAT_TO_SLOT[activeCat]] === undefined)

  // 활성 부위 리스트 + 검색 필터(이름 substring, 정렬 순서는 그대로 유지 — 필터만).
  const activeListFull = listForCat(activeCat)
  const activeList = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return activeListFull
    return activeListFull.filter((it) => (it.name || it.id).toLowerCase().includes(q))
  }, [activeListFull, search])

  // ── 페이지네이션(필터된 활성 리스트 길이 기준) ──
  const pageCount = Math.max(1, Math.ceil(activeList.length / ITEMS_PER_PAGE))
  const maxIndex = pageCount - 1
  const curIdx = Math.max(0, Math.min(maxIndex, pageByCat[activeCat] || 0))

  const live = useRef({ activeCat, maxIndex, curIdx, offset })
  live.current = { activeCat, maxIndex, curIdx, offset }

  const setIdx = useCallback((i: number, snap = true) => {
    const cat = live.current.activeCat
    const v = Math.max(0, Math.min(live.current.maxIndex, i))
    setPageByCat((s) => ({ ...s, [cat]: v }))
    setOffset(0); setSnapping(snap)
  }, [])
  const step = useCallback((dir: number) => setIdx(live.current.curIdx + dir), [setIdx])

  // ── 캐러셀 바인딩 ──
  const onWheel = useCallback((e: WheelEvent) => {
    e.preventDefault()
    const raw = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY
    if (Math.abs(raw) < 2) return
    const now = performance.now()
    if (now - lastWheelStep.current < 90) return
    lastWheelStep.current = now
    step(raw > 0 ? 1 : -1)
  }, [step])
  const onDown = useCallback((e: PointerEvent) => {
    if (e.pointerType === 'mouse') return
    drag.current = { on: true, captured: false, startX: e.clientX, lastX: e.clientX, lastT: performance.now(), vel: 0 }
    setSnapping(false)
  }, [])
  const bindVp = useCallback((el: HTMLDivElement | null) => {
    if (vpElRef.current === el) return
    if (vpElRef.current) { vpElRef.current.removeEventListener('wheel', onWheel); vpElRef.current.removeEventListener('pointerdown', onDown) }
    vpElRef.current = el
    if (el) { el.addEventListener('wheel', onWheel, { passive: false }); el.addEventListener('pointerdown', onDown) }
  }, [onWheel, onDown])

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const d = drag.current
      if (!d.on) return
      if (e.buttons === 0) { d.on = false; d.captured = false; return }
      let dx = e.clientX - d.startX
      if (!d.captured) { if (Math.abs(dx) < 6) return; d.captured = true; try { vpElRef.current?.setPointerCapture(e.pointerId) } catch {} }
      const now = performance.now(), dt = now - d.lastT
      if (dt > 0) d.vel = (e.clientX - d.lastX) / dt
      d.lastX = e.clientX; d.lastT = now
      const max = live.current.maxIndex, cur = live.current.curIdx
      if ((cur === 0 && dx > 0) || (cur === max && dx < 0)) dx *= 0.35
      setOffset(dx)
    }
    const onUp = () => {
      const d = drag.current
      if (!d.on) return
      d.on = false
      if (!d.captured) return
      d.captured = false
      const W = (vpElRef.current && vpElRef.current.clientWidth) || 1
      const frac = live.current.offset / W
      let moved = 0
      if (Math.abs(frac) > 0.15) moved = Math.sign(frac) * Math.max(1, Math.round(Math.abs(frac)))
      else if (Math.abs(d.vel) > 0.45) moved = Math.sign(d.vel)
      setIdx(live.current.curIdx - moved)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'ArrowLeft') step(-1); else if (e.key === 'ArrowRight') step(1) }
    const onDocDown = (e: PointerEvent) => { if (partWrapRef.current && !partWrapRef.current.contains(e.target as Node)) setPartMenuOpen(false) }
    window.addEventListener('pointermove', onMove); window.addEventListener('pointerup', onUp); window.addEventListener('pointercancel', onUp)
    window.addEventListener('keydown', onKey); window.addEventListener('pointerdown', onDocDown, true)
    return () => {
      window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); window.removeEventListener('pointercancel', onUp)
      window.removeEventListener('keydown', onKey); window.removeEventListener('pointerdown', onDocDown, true)
    }
  }, [setIdx, step])

  useEffect(() => {
    try { const v = localStorage.getItem('pb_sel'); if (v !== null) setSelectedPreset(v || null) } catch {}
  }, [])

  // ── 핸들러 ──
  const setPv = (key: keyof Pv, val: Pv[keyof Pv]) => setPvState((s) => ({ ...s, [key]: val }))
  const showToast = (msg: string) => {
    setToastText(msg); setToast(true)
    if (toastT.current) clearTimeout(toastT.current)
    toastT.current = setTimeout(() => setToast(false), 2200)
  }
  const persistSel = (id: string | null) => { try { localStorage.setItem('pb_sel', id || '') } catch {} }

  // 착용: skin=톤 변경, 그 외=slot 라디오(재클릭 해제) + islot 충돌 슬롯 자동 해제.
  const equipFromCat = (cat: string, item: ListItem) => {
    if (cat === 'skin') { setTone(index?.base.tones.find((t) => t.body === item.id)?.tone ?? 0); return }
    const slot = CAT_TO_SLOT[cat]
    setEquipped((prev) => {
      const cur = prev[slot]
      if (cur && cur.id === item.id) return { ...prev, [slot]: null } // 토글 해제
      const next = { ...prev, [slot]: item }
      for (const s of conflictSlots(prev, slot, item)) next[s] = null // islot 충돌 제거
      return next
    })
  }
  const isEquippedInCat = (cat: string, itemId: string) => {
    if (cat === 'skin') return index?.base.tones.find((t) => t.tone === tone)?.body === itemId
    return equipped[CAT_TO_SLOT[cat]]?.id === itemId
  }

  const snapshot = (): Snapshot => {
    const eq: Record<string, string> = {}
    for (const [s, it] of Object.entries(equipped)) if (it) eq[s] = it.id
    return { equipped: eq, tone, dyeMix: { ...dyeMix }, dyeHsv: { ...dyeHsv }, hidden: { ...hidden } }
  }
  const applySnap = (snap: Snapshot | undefined) => {
    const eq: Record<string, ListItem | null> = {}
    for (const s of EQUIP_SLOTS) {
      const id = snap?.equipped[s]
      eq[s] = id ? (lists[s]?.find((x) => x.id === id) ?? null) : null
    }
    setEquipped(eq)
    setTone(snap?.tone ?? index?.base.default ?? 0)
    setDyeMix({ ...(snap?.dyeMix || {}) }); setDyeHsv({ ...(snap?.dyeHsv || {}) }); setHidden({ ...(snap?.hidden || {}) })
    setDyeTarget(null)
  }
  const selectPreset = (id: string) => {
    const data = { ...presetData }
    if (selectedPreset) data[selectedPreset] = snapshot()
    if (selectedPreset === id) { setPresetData(data); setSelectedPreset(null); persistSel(null); return }
    setPresetData(data); setSelectedPreset(id); persistSel(id); applySnap(data[id])
  }
  const mockImport = (val: string): Snapshot => {
    let h = 0; for (let i = 0; i < val.length; i++) h = (h * 31 + val.charCodeAt(i)) >>> 0
    const eq: Record<string, string> = {}
    ;['hair', 'face', 'longcoat', 'shoes', 'cape', 'weapon'].forEach((slot, i) => {
      const l = lists[slot]; if (l && l.length) eq[slot] = l[(h >> (i * 3)) % l.length].id
    })
    return { equipped: eq, tone: index?.base.default ?? 0, dyeMix: {}, dyeHsv: {}, hidden: {} }
  }
  const importFetch = () => {
    const val = nickInput.trim()
    const label = importMode === 'code' ? '코드' : '닉네임'
    if (!val) { showToast(`${label}를 입력해 주세요`); return }
    if (!selectedPreset) { showToast('덮어쓸 프리셋을 먼저 선택해 주세요'); return }
    const snap = mockImport(val)
    setPresets((s) => s.map((p) => (p.id === selectedPreset ? { ...p, name: val } : p)))
    setPresetData((s) => ({ ...s, [selectedPreset]: snap }))
    applySnap(snap); setNickInput('')
    showToast(`'${val}' 코디를 프리셋에 덮어썼어요`)
  }
  const shareCurrent = () => { try { navigator.clipboard?.writeText('https://pinkbean.shop/c/me') } catch {} ; showToast('현재 코디 공유 링크를 복사했어요') }
  const sharePreset = (p: Preset) => { try { navigator.clipboard?.writeText(`https://pinkbean.shop/c/${p.id}`) } catch {} ; showToast('공유 링크를 복사했어요') }
  const startRename = (id: string, name: string, e: React.MouseEvent) => { e.stopPropagation(); setEditingPreset(id); setEditName(name) }
  const commitRename = () => {
    const nm = editName.trim()
    setPresets((s) => s.map((p) => (p.id === editingPreset ? { ...p, name: nm || p.name } : p)))
    setEditingPreset(null); setEditName('')
  }
  const openDye = (slot: string) => { setDialogSlot(slot); setDialogClosing(false) }
  const closeDye = () => {
    if (dialogClosing) return
    setDialogClosing(true)
    if (dlgT.current) clearTimeout(dlgT.current)
    dlgT.current = setTimeout(() => { setDialogSlot(null); setDialogClosing(false) }, 200)
  }
  const onPageFocus = (e: React.FocusEvent<HTMLInputElement>) => { setPageEditing(true); setPageInput(String(curIdx + 1)); const el = e.target; requestAnimationFrame(() => el.select()) }
  const onPageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/[^0-9]/g, '').slice(0, 6)
    setPageInput(val)
    if (pageT.current) clearTimeout(pageT.current)
    pageT.current = setTimeout(() => { const n = parseInt(val, 10); if (!isNaN(n)) setIdx(n - 1) }, 150)
  }
  const commitPage = () => { if (pageT.current) clearTimeout(pageT.current); const n = parseInt(pageInput, 10); if (!isNaN(n)) setIdx(n - 1); setPageEditing(false); setPageInput('') }
  const onPageKey = (e: React.KeyboardEvent<HTMLInputElement>) => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur() } else if (e.key === 'Escape') e.currentTarget.blur() }

  void defMix; void defHsv

  const value: ShopCtx = {
    index, dataLoading, catLoading, listForCat, activeList, search, setSearch,
    primary, setPrimary,
    activeCat, setActiveCat, listMode, setListMode, partMenuOpen, setPartMenuOpen, partWrapRef, bindVp,
    curIdx, pageCount, offset, snapping, setOffset, setSnapping, setIdx, step,
    pageEditing, pageInput, onPageFocus, onPageChange, onPageKey, commitPage,
    equipped, tone, equipFromCat, isEquippedInCat, hidden, setHidden,
    dyeTarget, setDyeTarget, dyeMix, setDyeMix, dyeHsv, setDyeHsv, dyeEdit, setDyeEdit, isMixSlot,
    dialogSlot, dialogClosing, openDye, closeDye,
    pv, setPv, pvOpen, setPvOpen,
    presets, presetData, selectedPreset, selectPreset, sharePreset,
    editingPreset, editName, setEditName, setEditingPreset, startRename, commitRename,
    nickInput, setNickInput, importMode, setImportMode, importFetch, shareCurrent,
    toast, toastText,
    hoverCat, setHoverCat, hoverPrimary, setHoverPrimary, hoverPill, setHoverPill,
    hoverMode, setHoverMode, hoverToggle, setHoverToggle, hoverPartBtn, setHoverPartBtn,
    hoverDlgClose, setHoverDlgClose, hoverDlgApply, setHoverDlgApply,
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
