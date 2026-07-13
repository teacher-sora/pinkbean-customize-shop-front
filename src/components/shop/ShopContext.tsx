'use client'

/*
 * ShopContext — 핑크빈 커마샵의 모든 상태 · 핸들러의 단일 출처.
 * 화면 컴포넌트(Header/CodiScreen/InfoScreen/PresetScreen/PreviewPanel/DyeDialog/Toast)는
 * useShop() 으로 필요한 조각만 꺼내 쓴다. 파생값(slotList/presetCards/dialog 등)은 각 화면에서
 * 이 상태로부터 계산한다(정본 renderVals 와 동일).
 */

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { CATS, ITEMS_PER_PAGE, ITEM_COUNT, type Mix, type Hsv, type Preset, type Pv, type Snapshot } from '@/lib/catalog'
import { clampDye, defHsv, defMix, isMixCat } from '@/lib/color'

type Dispatch<T> = React.Dispatch<React.SetStateAction<T>>

export interface ShopCtx {
  // primary/screen
  primary: string; setPrimary: Dispatch<string>
  // codi
  activeCat: string; setActiveCat: Dispatch<string>
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
  // equip / dye
  equipped: Record<string, boolean>; setEquipped: Dispatch<Record<string, boolean>>
  hidden: Record<string, boolean>; setHidden: Dispatch<Record<string, boolean>>
  dyeTarget: string | null; setDyeTarget: Dispatch<string | null>
  dyeMix: Record<string, Mix>; setDyeMix: Dispatch<Record<string, Mix>>
  dyeHsv: Record<string, Hsv>; setDyeHsv: Dispatch<Record<string, Hsv>>
  dyeEdit: Record<string, string>; setDyeEdit: Dispatch<Record<string, string>>
  selectItem: (id: string) => void
  // dye dialog
  dialogKey: string | null; dialogClosing: boolean
  openDye: (key: string) => void; closeDye: () => void
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
  // hover 상태들
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
  const [primary, setPrimary] = useState('codi')
  const [activeCat, setActiveCat] = useState('hair')
  const [equipped, setEquipped] = useState<Record<string, boolean>>({})
  const [hidden, setHidden] = useState<Record<string, boolean>>({})
  const [dyeTarget, setDyeTarget] = useState<string | null>(null)
  const [dyeMix, setDyeMix] = useState<Record<string, Mix>>({})
  const [dyeHsv, setDyeHsv] = useState<Record<string, Hsv>>({})
  const [dyeEdit, setDyeEdit] = useState<Record<string, string>>({})
  const [dialogKey, setDialogKey] = useState<string | null>(null)
  const [dialogClosing, setDialogClosing] = useState(false)
  const [pageByCat, setPageByCat] = useState<Record<string, number>>({})
  const [offset, setOffset] = useState(0)
  const [snapping, setSnapping] = useState(false)
  const [pageEditing, setPageEditing] = useState(false)
  const [pageInput, setPageInput] = useState('')
  const [partMenuOpen, setPartMenuOpen] = useState(false)
  const [pv, setPvState] = useState<Pv>({
    action: 'basic', weapon: 'basic', expr: 'default', ear: 'humanEar', form: 'none',
    gaze: 'right', wEffect: true, cEffect: true, fps: 12, zoom: 2,
  })
  const [pvOpen, setPvOpen] = useState(false)
  const [presets, setPresets] = useState<Preset[]>(() =>
    Array.from({ length: 20 }, (_, i) => ({ id: 'd' + i, name: `코디 ${i + 1}` })),
  )
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

  const pageCount = Math.max(1, Math.ceil(ITEM_COUNT / ITEMS_PER_PAGE))
  const maxIndex = pageCount - 1
  const curIdx = Math.max(0, Math.min(maxIndex, pageByCat[activeCat] || 0))

  // 비반응 이벤트 핸들러가 최신 값을 읽도록 mirror
  const live = useRef({ activeCat, maxIndex, curIdx, offset })
  live.current = { activeCat, maxIndex, curIdx, offset }

  const setIdx = useCallback((i: number, snap = true) => {
    const cat = live.current.activeCat
    const v = Math.max(0, Math.min(live.current.maxIndex, i))
    setPageByCat((s) => ({ ...s, [cat]: v }))
    setOffset(0)
    setSnapping(snap)
  }, [])
  const step = useCallback((dir: number) => setIdx(live.current.curIdx + dir), [setIdx])

  /* ── 캐러셀 바인딩 (element = ref-callback 으로 재바인딩; window = mount-once) ── */
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
    if (e.pointerType === 'mouse') return // PC는 휠/방향키만
    drag.current = { on: true, captured: false, startX: e.clientX, lastX: e.clientX, lastT: performance.now(), vel: 0 }
    setSnapping(false)
  }, [])

  const bindVp = useCallback((el: HTMLDivElement | null) => {
    if (vpElRef.current === el) return
    if (vpElRef.current) {
      vpElRef.current.removeEventListener('wheel', onWheel)
      vpElRef.current.removeEventListener('pointerdown', onDown)
    }
    vpElRef.current = el
    if (el) {
      el.addEventListener('wheel', onWheel, { passive: false })
      el.addEventListener('pointerdown', onDown)
    }
  }, [onWheel, onDown])

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const d = drag.current
      if (!d.on) return
      if (e.buttons === 0) { d.on = false; d.captured = false; return }
      let dx = e.clientX - d.startX
      if (!d.captured) {
        if (Math.abs(dx) < 6) return
        d.captured = true
        try { vpElRef.current && vpElRef.current.setPointerCapture(e.pointerId) } catch {}
      }
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
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') step(-1)
      else if (e.key === 'ArrowRight') step(1)
    }
    const onDocDown = (e: PointerEvent) => {
      if (partWrapRef.current && !partWrapRef.current.contains(e.target as Node)) setPartMenuOpen(false)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    window.addEventListener('keydown', onKey)
    window.addEventListener('pointerdown', onDocDown, true)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('pointerdown', onDocDown, true)
    }
  }, [setIdx, step])

  // 선택 프리셋 복원
  useEffect(() => {
    try {
      const v = localStorage.getItem('pb_sel')
      if (v !== null) setSelectedPreset(v || null)
    } catch {}
  }, [])

  /* ── 핸들러 ─────────────────────────────────────────────────────────────── */
  const setPv = (key: keyof Pv, val: Pv[keyof Pv]) => setPvState((s) => ({ ...s, [key]: val }))
  const showToast = (msg: string) => {
    setToastText(msg); setToast(true)
    if (toastT.current) clearTimeout(toastT.current)
    toastT.current = setTimeout(() => setToast(false), 2200)
  }
  const snapshot = (): Snapshot => ({ equipped: { ...equipped }, dyeMix: { ...dyeMix }, dyeHsv: { ...dyeHsv }, hidden: { ...hidden } })
  const persistSel = (id: string | null) => { try { localStorage.setItem('pb_sel', id || '') } catch {} }

  const selectItem = (id: string) => {
    setEquipped((s) => {
      const eq = { ...s }
      const already = eq[id]
      Object.keys(eq).forEach((k) => { if (k.startsWith(activeCat + '-')) delete eq[k] })
      if (!already) eq[id] = true
      return eq
    })
  }
  const selectPreset = (id: string) => {
    const data = { ...presetData }
    if (selectedPreset) data[selectedPreset] = snapshot()
    if (selectedPreset === id) { setPresetData(data); setSelectedPreset(null); persistSel(null); return }
    const load = data[id] || { equipped: {}, dyeMix: {}, dyeHsv: {}, hidden: {} }
    setPresetData(data); setSelectedPreset(id); persistSel(id)
    setEquipped({ ...load.equipped }); setDyeMix({ ...load.dyeMix }); setDyeHsv({ ...load.dyeHsv })
    setHidden({ ...load.hidden }); setDyeTarget(null)
  }
  const mockImport = (val: string): Snapshot => {
    let h = 0; for (let i = 0; i < val.length; i++) h = (h * 31 + val.charCodeAt(i)) >>> 0
    const pick = ['hair', 'faceacc', 'overall', 'shoes', 'cape', 'weapon']
    const eq: Record<string, boolean> = {}
    pick.forEach((cid, i) => { if (CATS.find((c) => c.id === cid)) eq[`${cid}-${(h >> (i * 3)) % 40}`] = true })
    return { equipped: eq, dyeMix: {}, dyeHsv: {}, hidden: {} }
  }
  const importFetch = () => {
    const val = nickInput.trim()
    const label = importMode === 'code' ? '코드' : '닉네임'
    if (!val) { showToast(`${label}를 입력해 주세요`); return }
    if (!selectedPreset) { showToast('덮어쓸 프리셋을 먼저 선택해 주세요'); return }
    const snap = mockImport(val)
    setPresets((s) => s.map((p) => (p.id === selectedPreset ? { ...p, name: val } : p)))
    setPresetData((s) => ({ ...s, [selectedPreset]: snap }))
    setEquipped({ ...snap.equipped }); setDyeMix({}); setDyeHsv({}); setHidden({}); setDyeTarget(null); setNickInput('')
    showToast(`'${val}' 코디를 프리셋에 덮어썼어요`)
  }
  const shareCurrent = () => {
    try { navigator.clipboard && navigator.clipboard.writeText('https://pinkbean.shop/c/me') } catch {}
    showToast('현재 코디 공유 링크를 복사했어요')
  }
  const sharePreset = (p: Preset) => {
    try { navigator.clipboard && navigator.clipboard.writeText(`https://pinkbean.shop/c/${p.id}`) } catch {}
    showToast('공유 링크를 복사했어요')
  }
  const startRename = (id: string, name: string, e: React.MouseEvent) => { e.stopPropagation(); setEditingPreset(id); setEditName(name) }
  const commitRename = () => {
    const nm = editName.trim()
    setPresets((s) => s.map((p) => (p.id === editingPreset ? { ...p, name: nm || p.name } : p)))
    setEditingPreset(null); setEditName('')
  }
  const openDye = (key: string) => { setDialogKey(key); setDialogClosing(false) }
  const closeDye = () => {
    if (dialogClosing) return
    setDialogClosing(true)
    if (dlgT.current) clearTimeout(dlgT.current)
    dlgT.current = setTimeout(() => { setDialogKey(null); setDialogClosing(false) }, 200)
  }
  const onPageFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    setPageEditing(true); setPageInput(String(curIdx + 1))
    const el = e.target; requestAnimationFrame(() => el.select())
  }
  const onPageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/[^0-9]/g, '').slice(0, 6)
    setPageInput(val)
    if (pageT.current) clearTimeout(pageT.current)
    pageT.current = setTimeout(() => { const n = parseInt(val, 10); if (!isNaN(n)) setIdx(n - 1) }, 150)
  }
  const commitPage = () => {
    if (pageT.current) clearTimeout(pageT.current)
    const n = parseInt(pageInput, 10); if (!isNaN(n)) setIdx(n - 1)
    setPageEditing(false); setPageInput('')
  }
  const onPageKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur() }
    else if (e.key === 'Escape') e.currentTarget.blur()
  }

  // clampDye/defMix/defHsv/isMixCat 는 화면에서 직접 import 해 쓰지만, 컨텍스트 사용처의
  // 편의를 위해 아무것도 재노출하지 않는다(중복 방지).
  void clampDye; void defMix; void defHsv; void isMixCat

  const value: ShopCtx = {
    primary, setPrimary,
    activeCat, setActiveCat, partMenuOpen, setPartMenuOpen, partWrapRef, bindVp,
    curIdx, pageCount, offset, snapping, setOffset, setSnapping, setIdx, step,
    pageEditing, pageInput, onPageFocus, onPageChange, onPageKey, commitPage,
    equipped, setEquipped, hidden, setHidden, dyeTarget, setDyeTarget,
    dyeMix, setDyeMix, dyeHsv, setDyeHsv, dyeEdit, setDyeEdit, selectItem,
    dialogKey, dialogClosing, openDye, closeDye,
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
