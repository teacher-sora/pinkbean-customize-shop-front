'use client'

/*
 * ShopContext — 상태·핸들러 단일 출처.
 * 코디(부위별 아이템 목록·착용)와 미리보기 합성은 실제 CDN 데이터를 사용한다.
 *   - index/slots/meta 는 src/lib/core/data.ts 로 CDN(https://cdn.pinkbean-customize.com)에서 로드.
 *   - equipped 는 실제 slot → ListItem. 미리보기(PreviewModel)가 이 값을 합성.
 * 프리셋/염색 UI 는 이 실제 모델 위에서 동작(염색 시각화·이펙트·형상변이 합성은 다음 단계).
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { ITEMS_PER_PAGE, type Preset, type Pv } from '@/lib/catalog'
import { loadAnima, loadEffectIndex, loadIndex, loadSlot, type Index, type ListItem } from '@/lib/core/data'
import type { HsbParams, PaletteParams } from '@/lib/core/dye'
import { conflictSlots } from '@/lib/core/slots'
import { decodeShareCode, encodeShareCode } from '@/lib/shareCode'
import { CAT_TO_SLOT, DEFAULT_EQUIP, DEFAULT_TONE, EQUIP_SLOTS, foldList } from '@/lib/shopData'

type Dispatch<T> = React.Dispatch<React.SetStateAction<T>>
export type ListMode = 'sprite' | 'model' | 'mymodel' // 아이템 리스트 표시: 스프라이트 / 베이스 모델 / 내 모델
// 염색 대상은 실제 slot. hair/face(성형)만 믹스 염색, 그 외 HSV.
const isMixSlot = (slot: string) => slot === 'hair' || slot === 'face'
// 프리셋 스냅샷: 착용(slot→itemId) + 톤 + 염색 + 숨김. (공유 코드/영속에 이 형태 그대로 저장)
export type Snapshot = { equipped: Record<string, string>; tone: number; dyePalette: Record<string, PaletteParams>; dyeHsb: Record<string, HsbParams>; hidden: Record<string, boolean> }

// ── 프리셋: 20개, 초깃값은 코디 기본(녹셀 헤어·운명의 인도자 얼굴·엘프 피부·금단의 계약). localStorage 영속(서버 없음). ──
const PRESET_COUNT = 20
const PRESET_IDS = Array.from({ length: PRESET_COUNT }, (_, i) => 'd' + i)
const defaultPresetName = (i: number) => `코디 ${i + 1}`
const defaultSnapshot = (): Snapshot => ({
  equipped: Object.fromEntries(Object.entries(DEFAULT_EQUIP).map(([slot, it]) => [slot, it.id])),
  tone: DEFAULT_TONE, dyePalette: {}, dyeHsb: {}, hidden: {},
})
const PRESET_KEY = 'pb_presets_v1'
type PresetStore = { data: Record<string, Snapshot>; names: Record<string, string>; sel: string | null }
const loadPresetStore = (): PresetStore | null => {
  try { const raw = localStorage.getItem(PRESET_KEY); if (!raw) return null; const s = JSON.parse(raw); return s && s.data ? s : null } catch { return null }
}
// 넥슨 캐시아이템 part → 내부 slot. (part 로 매핑: '한벌옷'=longcoat, '상의'=coat 구분)
const NEXON_PART_SLOT: Record<string, string> = {
  '모자': 'cap', '얼굴장식': 'faceAcc', '눈장식': 'eyeAcc', '귀고리': 'earring',
  '망토': 'cape', '장갑': 'glove', '신발': 'shoes', '무기': 'weapon', '방패': 'shield',
  '한벌옷': 'longcoat', '상의': 'coat', '하의': 'pants', '헤어': 'hair', '성형': 'face',
}
// 이름 정규화(성별 접미사·공백 제거)로 넥슨 이름 ↔ 내부 리스트 이름 매칭.
const nrmName = (n: string) => (n || '').replace(/\s*\((여|남)\)\s*$/, '').replace(/\s+/g, ' ').trim()
type NexonItem = { part: string; slot: string; name: string; gender: string | null }
type NexonBeauty = { name: string; baseColor: string | null; mixColor: string | null; mixRate: string }
// 넥슨 색상명 → 내부 믹스 팔레트 인덱스(MIX_PALETTE: 검정0 빨강1 주황2 노랑3 초록4 파랑5 보라6 갈색7).
const COLOR_IDX: Record<string, number> = {
  '검은색': 0, '검정': 0, '빨간색': 1, '빨강': 1, '주황색': 2, '주황': 2, '노란색': 3, '노랑': 3,
  '초록색': 4, '초록': 4, '녹색': 4, '파란색': 5, '파랑': 5, '보라색': 6, '보라': 6, '갈색': 7, '밤색': 7,
}
// 헤어 이름의 색 접두어("빨간색 리르하 헤어" → "리르하 헤어") 제거.
const stripColorPrefix = (name: string, color: string | null) => (color && name.startsWith(color) ? name.slice(color.length).trim() : name)

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
  dyePalette: Record<string, PaletteParams>; setDyePalette: Dispatch<Record<string, PaletteParams>> // hair/face 발색(색인덱스)
  dyeHsb: Record<string, HsbParams>; setDyeHsb: Dispatch<Record<string, HsbParams>> // 그 외 캐시 아이템(Prism HSB)
  dyeEdit: Record<string, string>; setDyeEdit: Dispatch<Record<string, string>>
  dyeInteracting: boolean; setDyeInteracting: Dispatch<boolean> // 발색 슬라이더 드래그 중(미리보기 애니메이션 일시정지용)
  isMixSlot: (slot: string) => boolean
  // 염색 다이얼로그(slot 대상)
  dialogSlot: string | null; dialogItem: ListItem | null; dialogClosing: boolean
  openDye: (slot: string, item?: ListItem | null) => void; closeDye: () => void
  // preview
  pv: Pv; setPv: (key: keyof Pv, val: Pv[keyof Pv]) => void
  pvOpen: boolean; setPvOpen: Dispatch<boolean>
  // presets
  presets: Preset[]; presetData: Record<string, Snapshot>; selectedPreset: string | null
  selectPreset: (id: string) => void; sharePreset: (p: Preset) => void; resetPreset: (id: string) => void
  editingPreset: string | null; editName: string; setEditName: Dispatch<string>
  setEditingPreset: Dispatch<string | null>
  startRename: (id: string, name: string, e: React.MouseEvent) => void
  commitRename: () => void
  nickInput: string; setNickInput: Dispatch<string>
  importMode: 'nick' | 'code'; setImportMode: Dispatch<'nick' | 'code'>
  importFetch: () => void
  importing: boolean
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
  const [dyePalette, setDyePalette] = useState<Record<string, PaletteParams>>({})
  const [dyeHsb, setDyeHsb] = useState<Record<string, HsbParams>>({})
  const [dyeEdit, setDyeEdit] = useState<Record<string, string>>({})
  const [dyeInteracting, setDyeInteracting] = useState(false)
  const [dialogSlot, setDialogSlot] = useState<string | null>(null)
  const [dialogItem, setDialogItem] = useState<ListItem | null>(null) // 염색 버튼을 누른 카드의 아이템
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
  const [presets, setPresets] = useState<Preset[]>(() => PRESET_IDS.map((id, i) => ({ id, name: defaultPresetName(i) })))
  const [presetData, setPresetData] = useState<Record<string, Snapshot>>(() => Object.fromEntries(PRESET_IDS.map((id) => [id, defaultSnapshot()])))
  const [selectedPreset, setSelectedPreset] = useState<string | null>('d0')
  const [nickInput, setNickInput] = useState('')
  const [importMode, setImportMode] = useState<'nick' | 'code'>('nick')
  const [importing, setImporting] = useState(false) // 불러오기 진행 중(로딩 애니메이션)
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
  const indexRef = useRef<Index | null>(null)      // 최신 index(리스트 로드/아이템 해석용, 상태 세팅 전에도 사용)
  const applyingRef = useRef(false)                 // 프리셋 적용 중(그 변경은 자동저장 스킵)
  const initedRef = useRef(false)                   // 초기 로드+적용 완료(그 전엔 저장/영속 안 함)
  const saveT = useRef<ReturnType<typeof setTimeout> | null>(null)
  const toastT = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dlgT = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pageT = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wheel = useRef({ acc: 0, dir: 0, t: 0 }) // 휠 delta 누적 / 제스처 방향 / 마지막 이벤트 시각
  const drag = useRef({ on: false, captured: false, startX: 0, lastX: 0, lastT: 0, vel: 0 })

  // ── 초기 로드: index → 저장된 프리셋(또는 기본 20개) 복원 → 선택된 프리셋을 라이브 모델에 적용 ──
  useEffect(() => {
    let alive = true
    // 연출 옵션 데이터(형상변이/이펙트 인덱스)를 미리 캐시 → 선택 시 즉시 적용.
    loadAnima().catch(() => {})
    loadEffectIndex().catch(() => {})
    loadIndex().then(async (idx) => {
      if (!alive) return
      indexRef.current = idx // resolveEquipped/loadSlotFolded 는 상태가 아닌 이 ref 를 쓰므로 setIndex 전에 사용 가능
      // localStorage 에서 프리셋 복원(없으면 20개 모두 코디 기본값). 첫 접속 시 d0 자동 선택.
      const store = loadPresetStore()
      const data: Record<string, Snapshot> = {}
      PRESET_IDS.forEach((id) => { data[id] = store?.data[id] || defaultSnapshot() })
      const sel = (store?.sel && PRESET_IDS.includes(store.sel)) ? store.sel : 'd0'
      // 선택된 프리셋을 라이브 모델로 해석(필요한 슬롯 리스트 로드). 그 뒤 index/프리셋/모델을 한 배치로 세팅
      // → 적용으로 인한 변경은 자동저장 1회만 발생하고 applyingRef 로 스킵된다.
      const snap = data[sel] || defaultSnapshot()
      applyingRef.current = true
      const eq = await resolveEquipped(snap)
      if (!alive) return
      setIndex(idx)
      setPresetData(data)
      setPresets(PRESET_IDS.map((id, i) => ({ id, name: store?.names[id] || defaultPresetName(i) })))
      setEquipped(eq); setTone(snap.tone ?? DEFAULT_TONE)
      setDyePalette({ ...(snap.dyePalette || {}) }); setDyeHsb({ ...(snap.dyeHsb || {}) }); setHidden({ ...(snap.hidden || {}) })
      setSelectedPreset(sel)
      initedRef.current = true
    }).catch((e) => console.error('[shop] index 로드 실패', e))
      .finally(() => { if (alive) setDataLoading(false) })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
  // 스크롤: 이벤트마다 방향 즉시 반영 + 크게 굴리면 여러 페이지. delta 를 누적해 THRESHOLD 마다 1스텝.
  // ⚠️ live.current.curIdx 는 리렌더 때만 갱신 → 다중 스텝은 반드시 setIdx(curIdx+n) 단일 호출(step 루프 금지).
  const onWheel = useCallback((e: WheelEvent) => {
    e.preventDefault()
    let raw = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY
    if (e.deltaMode === 1) raw *= 16                                   // line 단위(Firefox) → px 근사
    else if (e.deltaMode === 2) raw *= (vpElRef.current?.clientWidth || 400) // page 단위
    if (Math.abs(raw) < 2) return
    const THRESHOLD = 100, CAP = 12
    const now = performance.now(), dir = Math.sign(raw), w = wheel.current
    // 방향 전환/유휴(200ms) 시 리셋. 첫 이벤트가 곧바로 1스텝 넘도록 acc 를 시드(한 노치 ≈ 1페이지).
    if (dir !== w.dir || now - w.t > 200) { w.acc = dir * (THRESHOLD - 1); w.dir = dir }
    w.t = now
    w.acc += raw
    let n = Math.trunc(w.acc / THRESHOLD)
    w.acc -= n * THRESHOLD
    n = Math.max(-CAP, Math.min(CAP, n))
    if (n) setIdx(live.current.curIdx + n)
  }, [setIdx])
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

  // ── 핸들러 ──
  const setPv = (key: keyof Pv, val: Pv[keyof Pv]) => setPvState((s) => ({ ...s, [key]: val }))
  const showToast = (msg: string) => {
    setToastText(msg); setToast(true)
    if (toastT.current) clearTimeout(toastT.current)
    toastT.current = setTimeout(() => setToast(false), 2200)
  }

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

  // 현재 라이브 모델 → 스냅샷.
  const snapshot = (): Snapshot => {
    const eq: Record<string, string> = {}
    for (const [s, it] of Object.entries(equipped)) if (it) eq[s] = it.id
    return { equipped: eq, tone, dyePalette: { ...dyePalette }, dyeHsb: { ...dyeHsb }, hidden: { ...hidden } }
  }
  // 슬롯 리스트를 로드+폴드해서 반환(캐시). 스냅샷의 아이템 id 를 실제 ListItem 으로 해석하기 위해 필요.
  const loadSlotFolded = async (slot: string): Promise<ListItem[]> => {
    const idx = indexRef.current
    const summary = idx?.slots.find((s) => s.slot === slot)
    if (!summary) return []
    try {
      const folded = foldList(await loadSlot(summary.file))
      setLists((m) => (m[slot] ? m : { ...m, [slot]: folded }))
      return folded
    } catch { return [] }
  }
  // 스냅샷의 equipped(id) → 실제 ListItem 맵(필요한 슬롯 리스트를 로드 후 해석).
  const resolveEquipped = async (snap: Snapshot): Promise<Record<string, ListItem | null>> => {
    const eq: Record<string, ListItem | null> = {}
    for (const sl of EQUIP_SLOTS) eq[sl] = null
    const entries = Object.entries(snap.equipped).filter(([sl, id]) => id && (EQUIP_SLOTS as readonly string[]).includes(sl))
    await Promise.all(entries.map(async ([sl, id]) => {
      const folded = await loadSlotFolded(sl)
      eq[sl] = folded.find((x) => x.id === id) ?? null
    }))
    return eq
  }
  // 스냅샷을 라이브 모델에 적용. applyingRef 로 이 변경의 자동저장을 스킵(원본 프리셋과 동일하므로).
  const applySnapshot = async (snap: Snapshot): Promise<void> => {
    applyingRef.current = true
    const eq = await resolveEquipped(snap)
    setEquipped(eq)
    setTone(snap.tone ?? indexRef.current?.base.default ?? DEFAULT_TONE)
    setDyePalette({ ...(snap.dyePalette || {}) }); setDyeHsb({ ...(snap.dyeHsb || {}) }); setHidden({ ...(snap.hidden || {}) })
    setDyeTarget(null)
  }
  // 프리셋 선택: 현재 모델을 지금 선택된 프리셋에 즉시 저장(플러시) 후, 새 프리셋을 라이브에 적용. 항상 하나 선택.
  // 리스트 해석 후 equipped+selectedPreset 을 한 배치로 갱신 → 적용 직후 자동저장 1회만(applyingRef)로 스킵.
  const selectPreset = (id: string) => {
    if (selectedPreset && selectedPreset !== id) setPresetData((d) => ({ ...d, [selectedPreset]: snapshot() }))
    if (selectedPreset === id) return
    const snap = presetData[id] ?? defaultSnapshot()
    applyingRef.current = true
    resolveEquipped(snap).then((eq) => {
      setEquipped(eq)
      setTone(snap.tone ?? indexRef.current?.base.default ?? DEFAULT_TONE)
      setDyePalette({ ...(snap.dyePalette || {}) }); setDyeHsb({ ...(snap.dyeHsb || {}) }); setHidden({ ...(snap.hidden || {}) })
      setDyeTarget(null); setSelectedPreset(id)
    }).catch(() => {})
  }
  // 넥슨 이름 → 내부 리스트에서 매칭(성별 접미사 있는 경우 캐릭터 성별 우선).
  const matchByName = (list: ListItem[], name: string, gender: string | null): ListItem | null => {
    const target = nrmName(name)
    const ms = list.filter((it) => nrmName(it.name || '') === target)
    if (ms.length <= 1) return ms[0] || null
    const suffix = gender === '남' ? '(남)' : gender === '여' ? '(여)' : null
    if (suffix) { const g = ms.find((it) => (it.name || '').includes(suffix)); if (g) return g }
    return ms[0]
  }
  // 넥슨 헤어/성형 색상 → 내부 믹스 팔레트(baseColor/mixColor 인덱스 + 비율).
  const colorPalette = (b: NexonBeauty): PaletteParams => {
    const base = COLOR_IDX[b.baseColor ?? ''] ?? 0
    const mix = b.mixColor ? (COLOR_IDX[b.mixColor] ?? null) : null
    return { baseColor: base, mixColor: mix, ratio: mix != null ? (parseInt(b.mixRate, 10) || 50) : 0 }
  }
  // 닉네임 → 스냅샷: 내부 프록시(/api/nick)로 넥슨 착용(캐시아이템 + 헤어/성형/피부)을 받아 내부 아이템에 매칭.
  const importByNick = async (nick: string): Promise<Snapshot | null> => {
    try {
      const r = await fetch(`/api/nick?name=${encodeURIComponent(nick)}`)
      const j = await r.json().catch(() => null)
      if (!r.ok) { showToast(j?.error || '불러오기에 실패했어요'); return null }
      const items: NexonItem[] = Array.isArray(j?.items) ? j.items : []
      const gender: string | null = j?.gender ?? null
      const equipped: Record<string, string> = {}
      const dyePalette: Record<string, PaletteParams> = {}
      let tone = DEFAULT_TONE
      let matched = 0
      // 헤어(색 접두어 제거 + 염색색상)
      if (j?.hair?.name) {
        const found = matchByName(await loadSlotFolded('hair'), stripColorPrefix(j.hair.name, j.hair.baseColor), gender)
        if (found) { equipped.hair = found.id; dyePalette.hair = colorPalette(j.hair); matched++ }
      }
      if (!equipped.hair && DEFAULT_EQUIP.hair) equipped.hair = DEFAULT_EQUIP.hair.id
      // 성형(염색색상)
      if (j?.face?.name) {
        const found = matchByName(await loadSlotFolded('face'), stripColorPrefix(j.face.name, j.face.baseColor), gender)
        if (found) { equipped.face = found.id; dyePalette.face = colorPalette(j.face); matched++ }
      }
      if (!equipped.face && DEFAULT_EQUIP.face) equipped.face = DEFAULT_EQUIP.face.id
      // 피부(톤 이름 매칭)
      if (j?.skin?.name) {
        const te = indexRef.current?.base.tones.find((t) => nrmName(t.name || '') === nrmName(j.skin.name))
        if (te) { tone = te.tone; matched++ }
      }
      // 캐시 아이템(옷·모자·무기 등)
      for (const it of items) {
        const slot = NEXON_PART_SLOT[it.part]
        if (!slot) continue
        const found = matchByName(await loadSlotFolded(slot), it.name, it.gender ?? gender)
        if (found) { equipped[slot] = found.id; matched++ }
      }
      if (!matched) { showToast('보유한 데이터에서 일치하는 코디를 찾지 못했어요'); return null }
      return { equipped, tone, dyePalette, dyeHsb: {}, hidden: {} }
    } catch { showToast('불러오기에 실패했어요'); return null }
  }
  // 코드/닉네임으로 선택된 프리셋에 덮어쓰기.
  const importFetch = async () => {
    if (importing) return
    const val = nickInput.trim()
    if (!val) { showToast(importMode === 'code' ? '코드를 입력해 주세요' : '닉네임을 입력해 주세요'); return }
    if (!selectedPreset) return
    setImporting(true)
    try {
      let snap: Snapshot | null = null
      if (importMode === 'code') {
        snap = decodeShareCode(val)
        if (!snap) { showToast('올바른 공유 코드가 아니에요'); return }
      } else {
        snap = await importByNick(val)
        if (!snap) return
      }
      setPresetData((d) => ({ ...d, [selectedPreset]: snap! }))
      if (importMode === 'nick') setPresets((ps) => ps.map((p) => (p.id === selectedPreset ? { ...p, name: val } : p)))
      await applySnapshot(snap)
      setNickInput('')
      showToast(importMode === 'code' ? '공유 코드를 프리셋에 적용했어요' : `'${val}' 코디를 불러왔어요`)
    } finally { setImporting(false) }
  }
  // 자체 완결형 공유 코드 복사(서버 없음).
  const sharePreset = (p: Preset) => {
    const snap = p.id === selectedPreset ? snapshot() : (presetData[p.id] ?? defaultSnapshot())
    try { navigator.clipboard?.writeText(encodeShareCode(snap)) } catch {}
    showToast('공유 코드를 복사했어요')
  }
  const shareCurrent = () => { try { navigator.clipboard?.writeText(encodeShareCode(snapshot())) } catch {} ; showToast('현재 코디 공유 코드를 복사했어요') }
  // 프리셋을 코디 기본값 + 기본 이름으로 초기화(선택된 프리셋이면 라이브 모델도 즉시 적용).
  const resetPreset = (id: string) => {
    const snap = defaultSnapshot()
    setPresetData((d) => ({ ...d, [id]: snap }))
    const i = PRESET_IDS.indexOf(id)
    if (i >= 0) setPresets((ps) => ps.map((p) => (p.id === id ? { ...p, name: defaultPresetName(i) } : p)))
    if (id === selectedPreset) applySnapshot(snap).catch(() => {})
    showToast('프리셋을 기본값으로 초기화했어요')
  }
  const startRename = (id: string, name: string, e: React.MouseEvent) => { e.stopPropagation(); setEditingPreset(id); setEditName(name) }
  const commitRename = () => {
    const nm = editName.trim()
    setPresets((s) => s.map((p) => (p.id === editingPreset ? { ...p, name: nm || p.name } : p)))
    setEditingPreset(null); setEditName('')
  }

  // 자동 저장: 라이브 모델이 바뀔 때마다 선택된 프리셋에 저장(후순위 = 400ms 디바운스). 프리셋 적용으로 인한
  // 변경은 스킵(applyingRef). 프리셋을 "보기만" 할 땐 변화가 없어 저장이 일어나지 않는다.
  useEffect(() => {
    if (applyingRef.current) { applyingRef.current = false; return }
    if (!initedRef.current || !selectedPreset) return
    if (saveT.current) clearTimeout(saveT.current)
    saveT.current = setTimeout(() => { setPresetData((d) => ({ ...d, [selectedPreset]: snapshot() })) }, 400)
    return () => { if (saveT.current) clearTimeout(saveT.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [equipped, tone, dyePalette, dyeHsb, hidden, selectedPreset])

  // 영속: 프리셋 데이터/이름/선택을 localStorage 에 저장(디바운스). 서버 없이 새로고침/재실행에도 유지.
  useEffect(() => {
    if (!initedRef.current) return
    const t = setTimeout(() => {
      try {
        const names: Record<string, string> = {}; for (const p of presets) names[p.id] = p.name
        localStorage.setItem(PRESET_KEY, JSON.stringify({ data: presetData, names, sel: selectedPreset } as PresetStore))
      } catch {}
    }, 300)
    return () => clearTimeout(t)
  }, [presetData, presets, selectedPreset])
  const openDye = (slot: string, item: ListItem | null = null) => { setDialogSlot(slot); setDialogItem(item); setDialogClosing(false) }
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

  const value: ShopCtx = {
    index, dataLoading, catLoading, listForCat, activeList, search, setSearch,
    primary, setPrimary,
    activeCat, setActiveCat, listMode, setListMode, partMenuOpen, setPartMenuOpen, partWrapRef, bindVp,
    curIdx, pageCount, offset, snapping, setOffset, setSnapping, setIdx, step,
    pageEditing, pageInput, onPageFocus, onPageChange, onPageKey, commitPage,
    equipped, tone, equipFromCat, isEquippedInCat, hidden, setHidden,
    dyeTarget, setDyeTarget, dyePalette, setDyePalette, dyeHsb, setDyeHsb, dyeEdit, setDyeEdit, dyeInteracting, setDyeInteracting, isMixSlot,
    dialogSlot, dialogItem, dialogClosing, openDye, closeDye,
    pv, setPv, pvOpen, setPvOpen,
    presets, presetData, selectedPreset, selectPreset, sharePreset, resetPreset,
    editingPreset, editName, setEditName, setEditingPreset, startRename, commitRename,
    nickInput, setNickInput, importMode, setImportMode, importFetch, importing, shareCurrent,
    toast, toastText,
    hoverCat, setHoverCat, hoverPrimary, setHoverPrimary, hoverPill, setHoverPill,
    hoverMode, setHoverMode, hoverToggle, setHoverToggle, hoverPartBtn, setHoverPartBtn,
    hoverDlgClose, setHoverDlgClose, hoverDlgApply, setHoverDlgApply,
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
