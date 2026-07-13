'use client'

/*
 * 핑크빈 커마샵 — 프론트(디자인 재현 단계)
 * ------------------------------------------------------------------
 * design_handoff_pinkbean_shop/PinkbeanShop.dc.html 을 React/Next로 충실히 이식한 것.
 * 이 단계의 목적은 "디자인 핸드오프와 최대한 동일한 룩앤필/인터랙션" 재현이며,
 * 아이템/캐릭터는 전부 플레이스홀더다(정본과 동일: 60종 mock, CSS 썸네일).
 *
 * ⚠️ 다음 단계(CDN 연동)에서 교체될 부분:
 *   - itemCount()/allItems 의 mock 데이터 → CDN(index/slots/meta)에서 로드
 *   - 미리보기 점선 카드 → 실제 스프라이트 합성 캔버스(src/lib/core 의 assemble/dye 사용)
 *   - 염색 미리보기(hsl/rgb 근사) → dye.ts 의 정밀 Prism 염색
 *   - 닉네임/코드 임포트 mock → 넥슨 OpenAPI / Supabase 공유코드
 * 이 파일 자체는 위 연동 지점만 바꾸면 되도록 상태 구조를 정본과 동일하게 유지했다.
 */

import { useEffect, useRef, useState } from 'react'

/* ── inline-style helper: 정본의 CSS 문자열을 그대로 쓰기 위한 파서 ───────────── */
function toCamel(prop: string): string {
  if (prop.startsWith('--')) return prop // CSS custom property: 그대로
  const lead = prop.startsWith('-')
  const parts = prop.split('-').filter(Boolean)
  return parts
    .map((p, i) => (i === 0 && !lead ? p : p.charAt(0).toUpperCase() + p.slice(1)))
    .join('')
}
function css(s: string): React.CSSProperties {
  const o: Record<string, string> = {}
  s.split(';').forEach((decl) => {
    const i = decl.indexOf(':')
    if (i === -1) return
    const key = decl.slice(0, i).trim()
    const val = decl.slice(i + 1).trim()
    if (key) o[toCamel(key)] = val
  })
  return o as React.CSSProperties
}

/* ── 정적 데이터 (정본과 동일) ─────────────────────────────────────────────── */
type Cat = { id: string; label: string }
const CATS: Cat[] = [
  { id: 'hair', label: '헤어' },
  { id: 'plastic', label: '성형' },
  { id: 'skin', label: '피부' },
  { id: 'cap', label: '모자' },
  { id: 'faceacc', label: '얼굴장식' },
  { id: 'eyeacc', label: '눈장식' },
  { id: 'earring', label: '귀고리' },
  { id: 'overall', label: '한벌옷' },
  { id: 'top', label: '상의' },
  { id: 'bottom', label: '하의' },
  { id: 'shoes', label: '신발' },
  { id: 'gloves', label: '장갑' },
  { id: 'cape', label: '망토' },
  { id: 'weapon', label: '무기' },
  { id: 'shield', label: '방패' },
]
const PRIMARIES = [
  { id: 'codi', label: '코디' },
  { id: 'info', label: '코디 정보 · 염색' },
  { id: 'preset', label: '프리셋' },
]
const MIX_PALETTE = [
  { name: '검정', hex: '#2f2b27' },
  { name: '빨강', hex: '#e0503f' },
  { name: '주황', hex: '#e8944a' },
  { name: '노랑', hex: '#eccb4e' },
  { name: '초록', hex: '#5fb867' },
  { name: '파랑', hex: '#4f86dd' },
  { name: '보라', hex: '#9463c9' },
  { name: '갈색', hex: '#96704c' },
]
const PV_ACTIONS = [
  { v: 'stand', l: '서 있기', anim: false },
  { v: 'walk', l: '걷기', anim: true },
  { v: 'sit', l: '앉기', anim: false },
  { v: 'jump', l: '점프', anim: true },
  { v: 'prone', l: '엎드리기', anim: false },
  { v: 'ladder', l: '사다리 오르기', anim: true },
  { v: 'fly', l: '날기', anim: true },
  { v: 'alert', l: '경계', anim: true },
  { v: 'heal', l: '회복', anim: true },
  { v: 'dead', l: '쓰러지기', anim: false },
]
const PV_WEAPONS = [
  { v: 'none', l: '동작 없음' },
  { v: 'swingO1', l: '스윙 O1' },
  { v: 'swingO2', l: '스윙 O2' },
  { v: 'swingO3', l: '스윙 O3' },
  { v: 'swingP1', l: '스윙 P1' },
  { v: 'swingP2', l: '스윙 P2' },
  { v: 'swingT1', l: '스윙 T1' },
  { v: 'stabO1', l: '찌르기 O1' },
  { v: 'stabO2', l: '찌르기 O2' },
  { v: 'stabT1', l: '찌르기 T1' },
  { v: 'shoot1', l: '슛 1' },
  { v: 'shoot2', l: '슛 2' },
  { v: 'magic1', l: '매직 1' },
  { v: 'magic2', l: '매직 2' },
]
const PV_EXPRS = [
  { v: 'default', l: '기본' },
  { v: 'smile', l: '미소' },
  { v: 'wink', l: '윙크' },
  { v: 'glare', l: '째려봄' },
  { v: 'cry', l: '슬픔' },
  { v: 'angry', l: '분노' },
  { v: 'surprise', l: '놀람' },
  { v: 'love', l: '하트' },
  { v: 'close', l: '눈 감기' },
  { v: 'vomit', l: '오징어' },
  { v: 'cheer', l: '씩씩' },
  { v: 'despair', l: '근심' },
]
const PV_EARS = [
  { v: 'default', l: '기본' },
  { v: 'elf', l: '요정 귀' },
  { v: 'sharp', l: '뾰족 귀' },
  { v: 'fold', l: '접힌 귀' },
]
const PV_FORMS = [
  { v: 'human', l: '기본' },
  { v: 'wolf', l: '늑대' },
  { v: 'cat', l: '고양이' },
  { v: 'ghost', l: '유령' },
  { v: 'mini', l: '미니' },
  { v: 'statue', l: '조각상' },
]
const PV_GAZES = [
  { v: 'center', l: '정면' },
  { v: 'left', l: '왼쪽' },
  { v: 'right', l: '오른쪽' },
]
const ITEMS_PER_PAGE = 18
const ITEM_COUNT = 60 // 플레이스홀더(정본과 동일). CDN 단계에서 부위별 실제 개수로 교체.

/* ── 순수 헬퍼 (정본과 동일) ───────────────────────────────────────────────── */
const isMixCat = (id: string) => id === 'hair' || id === 'plastic'
const hx = (h: string) => {
  const s = h.replace('#', '')
  return [0, 2, 4].map((i) => parseInt(s.substr(i, 2), 16))
}
function mixColor(a: string, b: string, t: number) {
  const pa = hx(a), pb = hx(b), w = t / 100
  const c = pa.map((v, i) => Math.round(v + (pb[i] - v) * w))
  return `rgb(${c[0]},${c[1]},${c[2]})`
}
function mixColorTone(a: string, b: string, t: number, tone: number) {
  const pa = hx(a), pb = hx(b), w = t / 100
  let c = pa.map((v, i) => v + (pb[i] - v) * w)
  c = c.map((v) => (tone >= 0 ? v + (255 - v) * (tone / 100) : v * (1 + tone / 100)))
  return `rgb(${c.map((x) => Math.round(Math.max(0, Math.min(255, x)))).join(',')})`
}
const itemTone = (idx: number) => (((idx * 53) % 13) - 6) * 5
function hsvColor(h: number, s: number, v: number) {
  const sPct = Math.max(0, Math.min(100, 62 + s * 0.38))
  const lPct = Math.max(12, Math.min(90, 52 + v * 0.38))
  return `hsl(${h}, ${sPct}%, ${lPct}%)`
}
function presetThumb(id: string) {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 100
  const base = 300 + h * 0.6
  return `linear-gradient(155deg, hsl(${base % 360},80%,90%), hsl(${(base + 35) % 360},68%,82%))`
}
const defMix = () => ({ a: '#2f2b27', b: '#e0503f', ratio: 50 })
const defHsv = () => ({ h: 0, s: 0, v: 0 })
function pillStyle(sel: boolean, hov: boolean) {
  const bd = sel ? '#ec86ac' : hov ? '#eeb2ce' : '#e7ded4'
  const col = sel ? '#d76d9a' : hov ? '#d76d9a' : '#8a8075'
  return `height:30px; padding:0 12px; border-radius:8px; cursor:pointer; font-family:inherit; font-size:12px; font-weight:${sel ? 600 : 500}; border:1px solid ${bd}; background:${sel ? '#fce9f1' : '#fff'}; color:${col}; transition:background .26s ease, border-color .26s ease, color .26s ease;`
}
const swStyle = (hex: string, on: boolean) =>
  `width:30px; height:30px; border-radius:50%; cursor:pointer; background:${hex}; border:2px solid ${on ? '#2a2521' : 'rgba(0,0,0,0.08)'}; box-shadow:${on ? '0 0 0 2px #fff inset' : 'none'}; transition:transform .12s ease;`
const switchTrack = (on: boolean) =>
  `position:relative; width:42px; height:24px; border-radius:20px; border:none; cursor:pointer; padding:0; background:${on ? '#ec86ac' : '#e0d8ce'}; transition:background .18s ease;`
const switchKnob = (on: boolean) =>
  `position:absolute; top:3px; left:${on ? '21px' : '3px'}; width:18px; height:18px; border-radius:50%; background:#fff; transition:left .18s cubic-bezier(.22,.61,.36,1);`

/* ── 타입 ──────────────────────────────────────────────────────────────────── */
type Mix = { a: string; b: string; ratio: number }
type Hsv = { h: number; s: number; v: number }
type Preset = { id: string; name: string }
type Snapshot = {
  equipped: Record<string, boolean>
  dyeMix: Record<string, Mix>
  dyeHsv: Record<string, Hsv>
  hidden: Record<string, boolean>
}
type Pv = {
  action: string; weapon: string; expr: string; ear: string; form: string; gaze: string
  wEffect: boolean; cEffect: boolean; fps: number; zoom: number
}

export default function PinkbeanShop() {
  /* ── 상태 (정본 state 와 동일 구성) ─────────────────────────────────────── */
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
    action: 'stand', weapon: 'none', expr: 'default', ear: 'default', form: 'human',
    gaze: 'center', wEffect: true, cEffect: true, fps: 12, zoom: 2,
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
  // hover 상태 (인라인 색상 요소용)
  const [hoverCat, setHoverCat] = useState<string | null>(null)
  const [hoverPrimary, setHoverPrimary] = useState<string | null>(null)
  const [hoverPill, setHoverPill] = useState<string | null>(null)
  const [hoverMode, setHoverMode] = useState<string | null>(null)
  const [hoverToggle, setHoverToggle] = useState<string | null>(null)
  const [hoverPartBtn, setHoverPartBtn] = useState(false)
  const [hoverDlgClose, setHoverDlgClose] = useState(false)
  const [hoverDlgApply, setHoverDlgApply] = useState(false)

  /* ── refs ──────────────────────────────────────────────────────────────── */
  const vpRef = useRef<HTMLDivElement | null>(null)
  const partWrapRef = useRef<HTMLDivElement | null>(null)
  const renameRef = useRef<HTMLInputElement | null>(null)
  const toastT = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dlgT = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pageT = useRef<ReturnType<typeof setTimeout> | null>(null)
  const snapT = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastWheelStep = useRef(0)
  const drag = useRef({ on: false, captured: false, startX: 0, lastX: 0, lastT: 0, vel: 0 })

  /* ── 파생값(공통) ────────────────────────────────────────────────────────── */
  const pageCount = Math.max(1, Math.ceil(ITEM_COUNT / ITEMS_PER_PAGE))
  const maxIndex = pageCount - 1
  const clampIdx = (i: number) => Math.max(0, Math.min(maxIndex, i))
  const curIdx = clampIdx(pageByCat[activeCat] || 0)

  // 이벤트 핸들러(비반응)가 최신 값을 읽도록 mirror
  const live = useRef({ activeCat, pageByCat, maxIndex, curIdx, offset })
  live.current = { activeCat, pageByCat, maxIndex, curIdx, offset }

  const setIdx = (i: number, snap = true) => {
    const cat = live.current.activeCat
    const v = Math.max(0, Math.min(live.current.maxIndex, i))
    setPageByCat((s) => ({ ...s, [cat]: v }))
    setOffset(0)
    setSnapping(snap)
  }
  const step = (dir: number) => setIdx(live.current.curIdx + dir)

  /* ── 캐러셀: viewport 에 wheel/pointer 바인딩 + 전역 키/외부클릭 ─────────── */
  useEffect(() => {
    const vp = vpRef.current

    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const raw = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY
      if (Math.abs(raw) < 2) return
      const now = performance.now()
      if (now - lastWheelStep.current < 90) return
      lastWheelStep.current = now
      step(raw > 0 ? 1 : -1)
    }
    const onDown = (e: PointerEvent) => {
      if (e.pointerType === 'mouse') return // PC는 휠/방향키만
      if (snapT.current) clearTimeout(snapT.current)
      drag.current = { on: true, captured: false, startX: e.clientX, lastX: e.clientX, lastT: performance.now(), vel: 0 }
      setSnapping(false)
    }
    const onMove = (e: PointerEvent) => {
      const d = drag.current
      if (!d.on) return
      if (e.buttons === 0) { d.on = false; d.captured = false; return }
      let dx = e.clientX - d.startX
      if (!d.captured) {
        if (Math.abs(dx) < 6) return
        d.captured = true
        try { vp && vp.setPointerCapture(e.pointerId) } catch {}
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
      const W = (vp && vp.clientWidth) || 1
      const off = live.current.offset, frac = off / W
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

    if (vp) {
      vp.addEventListener('wheel', onWheel, { passive: false })
      vp.addEventListener('pointerdown', onDown)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    window.addEventListener('keydown', onKey)
    window.addEventListener('pointerdown', onDocDown, true)
    return () => {
      if (vp) {
        vp.removeEventListener('wheel', onWheel)
        vp.removeEventListener('pointerdown', onDown)
      }
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('pointerdown', onDocDown, true)
    }
    // 마운트 시 1회 바인딩(핸들러는 live ref 로 최신값 접근)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 선택 프리셋 복원 (localStorage)
  useEffect(() => {
    try {
      const v = localStorage.getItem('pb_sel')
      if (v !== null) setSelectedPreset(v || null)
    } catch {}
  }, [])

  /* ── 기타 헬퍼/핸들러 ─────────────────────────────────────────────────────── */
  const setPv = (key: keyof Pv, val: Pv[keyof Pv]) => setPvState((s) => ({ ...s, [key]: val }))
  const showToast = (msg: string) => {
    setToastText(msg); setToast(true)
    if (toastT.current) clearTimeout(toastT.current)
    toastT.current = setTimeout(() => setToast(false), 2200)
  }
  const snapshot = (): Snapshot => ({
    equipped: { ...equipped }, dyeMix: { ...dyeMix }, dyeHsv: { ...dyeHsv }, hidden: { ...hidden },
  })
  const persistSel = (id: string | null) => { try { localStorage.setItem('pb_sel', id || '') } catch {} }

  const selectPreset = (id: string) => {
    const data = { ...presetData }
    if (selectedPreset) data[selectedPreset] = snapshot()
    if (selectedPreset === id) {
      setPresetData(data); setSelectedPreset(null); persistSel(null); return
    }
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
  const startRename = (id: string, name: string, e: React.MouseEvent) => {
    e.stopPropagation(); setEditingPreset(id); setEditName(name)
  }
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

  // 페이지 입력
  const onPageFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    setPageEditing(true); setPageInput(String(curIdx + 1))
    const el = e.target; requestAnimationFrame(() => el.select())
  }
  const onPageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/[^0-9]/g, '').slice(0, 6)
    setPageInput(val)
    if (pageT.current) clearTimeout(pageT.current)
    pageT.current = setTimeout(() => {
      const n = parseInt(val, 10); if (!isNaN(n)) setIdx(n - 1)
    }, 150)
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

  /* ── 파생: 부위/아이템/페이지 ─────────────────────────────────────────────── */
  const activeMeta = CATS.find((c) => c.id === activeCat) || CATS[0]
  const allItems = Array.from({ length: ITEM_COUNT }, (_, i) => {
    const id = `${activeCat}-${i}`
    const sel = !!equipped[id]
    return {
      id, i, sel,
      code: `${activeCat.slice(0, 2).toUpperCase()}${String(i + 1).padStart(3, '0')}`,
      name: `${activeMeta.label} 아이템 ${i + 1}`,
    }
  })
  const pages = Array.from({ length: pageCount }, (_, p) => allItems.slice(p * ITEMS_PER_PAGE, p * ITEMS_PER_PAGE + ITEMS_PER_PAGE))
  const trackStyle = `display:flex; height:100%; width:100%; will-change:transform; transform:translateX(calc(${-curIdx * 100}% + ${offset}px)); transition:${snapping ? 'transform .34s cubic-bezier(.22,.61,.36,1)' : 'none'};`

  const selectItem = (id: string) => {
    setEquipped((s) => {
      const eq = { ...s }
      const already = eq[id]
      Object.keys(eq).forEach((k) => { if (k.startsWith(activeCat + '-')) delete eq[k] })
      if (!already) eq[id] = true
      return eq
    })
  }

  const isCodi = primary === 'codi'
  const isInfo = primary === 'info'
  const isPreset = primary === 'preset'
  const equippedCount = Object.keys(equipped).length

  /* ── 파생: 코디 정보 슬롯 리스트(15) ─────────────────────────────────────── */
  const slotList = CATS.map((c) => {
    const key = Object.keys(equipped).find((k) => k.startsWith(c.id + '-'))
    const on = !!key
    const i = on ? parseInt(key!.split('-')[1], 10) : 0
    const isHidden = on && !!hidden[key!]
    const selected = on && dyeTarget === key
    const dim = !on || isHidden
    let dyed: string | null = null
    if (on) {
      if (isMixCat(c.id)) { const m = dyeMix[key!]; if (m) dyed = mixColor(m.a, m.b, m.ratio) }
      else { const h = dyeHsv[key!]; if (h) dyed = hsvColor(h.h, h.s, h.v) }
    }
    const border = selected ? '2px solid #ec86ac' : on ? (isHidden ? '1px solid #e4dcd2' : '1px solid #f4cfdf') : '1px dashed #e4dcd2'
    const pad = selected ? '8px 10px' : '9px 11px'
    const thumbBg = dyed && !isHidden ? dyed : on && !isHidden ? 'repeating-linear-gradient(45deg,#f7f2ec,#f7f2ec 6px,#f1ebe2 6px,#f1ebe2 12px)' : '#f4efe8'
    const th = hoverToggle === key
    let bd = isHidden ? '#e0d8ce' : '#f4cfdf', bg = isHidden ? '#f2ece5' : '#fce9f1', col = isHidden ? '#a89e93' : '#d76d9a'
    if (th) { bd = isHidden ? '#c3b9ad' : '#ec86ac'; col = isHidden ? '#8a8075' : '#c85d8a' }
    return {
      cat: c, key, on, i, isHidden, selected,
      slot: c.label,
      name: on ? (isHidden ? '숨김' : `${c.label} 아이템 ${i + 1}`) : '미착용',
      code: on ? `${c.id.slice(0, 2).toUpperCase()}${String(i + 1).padStart(3, '0')}` : '',
      toggleLabel: isHidden ? '숨김' : '표시',
      cardStyle: `display:flex; align-items:center; gap:10px; padding:${pad}; border-radius:11px; min-width:0; cursor:${on ? 'pointer' : 'default'}; border:${border}; background:${isHidden ? '#f6f2ec' : on ? '#fdf4f8' : '#fbf8f4'}; transition:background .14s ease, border-color .14s ease, opacity .14s ease; opacity:${isHidden ? 0.6 : 1};`,
      thumbStyle: `flex:0 0 auto; width:42px; height:42px; border-radius:8px; display:flex; align-items:center; justify-content:center; background:${thumbBg}; ${isHidden ? 'filter:grayscale(1);' : ''}`,
      nameStyle: `font-size:12px; font-weight:${on && !isHidden ? 600 : 500}; color:${dim ? '#c3b9ad' : '#2a2521'}; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin-top:2px;`,
      toggleStyle: `flex:0 0 auto; height:24px; padding:0 9px; border-radius:20px; border:1px solid ${bd}; background:${bg}; color:${col}; font-family:inherit; font-size:10px; font-weight:600; cursor:pointer; transition:background .2s ease, color .2s ease, border-color .2s ease;`,
    }
  })

  /* ── 파생: 하단 염색 패널(코디 정보 화면) ─────────────────────────────────── */
  let dyeTargetEff = dyeTarget
  if (dyeTargetEff && !equipped[dyeTargetEff]) dyeTargetEff = null
  const dyeInfo = (() => {
    if (!dyeTargetEff) return null
    const cid = dyeTargetEff.split('-')[0], di = parseInt(dyeTargetEff.split('-')[1], 10)
    const dcat = CATS.find((c) => c.id === cid)
    const mixMode = isMixCat(cid)
    const dirty = mixMode ? !!dyeMix[dyeTargetEff] : !!dyeHsv[dyeTargetEff]
    const slot = dcat ? dcat.label : ''
    const name = `${slot} 아이템 ${di + 1}`
    const resetStyle = `height:28px; padding:0 12px; border-radius:8px; font-family:inherit; font-size:11px; font-weight:600; cursor:${dirty ? 'pointer' : 'default'}; border:1px solid ${dirty ? '#e7ded4' : '#efe8e0'}; background:${dirty ? '#faf7f3' : '#fbf8f4'}; color:${dirty ? '#5c534b' : '#c3b9ad'}; transition:border-color .14s ease, color .14s ease, background .14s ease;`
    const key = dyeTargetEff
    if (mixMode) {
      const m = dyeMix[key] || defMix()
      return { mixMode: true as const, slot, name, resetStyle, key, m }
    }
    const hv = dyeHsv[key] || defHsv()
    return { mixMode: false as const, slot, name, resetStyle, key, hv }
  })()
  const clampF = (f: string, v: number) => { if (isNaN(v)) v = 0; return f === 'h' ? Math.max(0, Math.min(359, v)) : Math.max(-99, Math.min(99, v)) }
  const hsvDisp = (key: string, f: string, num: number) => (dyeEdit[key + ':' + f] !== undefined ? dyeEdit[key + ':' + f] : String(num))
  const hsvOnNum = (key: string, f: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value
    setDyeEdit((s) => ({ ...s, [key + ':' + f]: raw }))
    const pv2 = parseInt(raw, 10)
    if (raw !== '' && !isNaN(pv2)) setDyeHsv((s) => ({ ...s, [key]: { ...(s[key] || defHsv()), [f]: clampF(f, pv2) } }))
  }
  const hsvOnBlur = (key: string, f: string) => () => setDyeEdit((s) => { const e = { ...s }; delete e[key + ':' + f]; return e })
  const hsvOnRange = (key: string, f: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = clampF(f, parseInt(e.target.value, 10))
    setDyeEdit((s) => { const ed = { ...s }; delete ed[key + ':' + f]; return ed })
    setDyeHsv((s) => ({ ...s, [key]: { ...(s[key] || defHsv()), [f]: v } }))
  }

  /* ── 파생: 프리셋 카드 ────────────────────────────────────────────────────── */
  const liveCount = Object.keys(equipped).length
  const presetCards = presets.map((p) => {
    const on = selectedPreset === p.id
    const cnt = on ? liveCount : presetData[p.id] ? Object.keys(presetData[p.id].equipped || {}).length : 0
    const editing = editingPreset === p.id
    return {
      p, on, editing,
      countLabel: cnt > 0 ? `${cnt}종 착용` : '비어 있음',
      cardStyle: on ? 'border-color:#ec86ac; background:#fdf4f8; transform:translateY(-5px);' : '',
      thumbStyle: `position:relative; width:100%; aspect-ratio:3/4; background:${presetThumb(p.id)};`,
      selBadgeStyle: `position:absolute; top:8px; left:8px; display:inline-flex; align-items:center; gap:4px; height:20px; padding:0 9px; border-radius:20px; background:rgba(255,255,255,0.92); color:#d76d9a; border:1px solid #f4cfdf; font-size:10px; font-weight:600; pointer-events:none; box-shadow:0 2px 8px rgba(214,109,154,.18); transition:opacity .22s ease, transform .22s ease; opacity:${on ? 1 : 0}; transform:translateY(${on ? '0' : '-6px'});`,
    }
  })

  /* ── 파생: 미리보기(연출) ─────────────────────────────────────────────────── */
  const curAction = PV_ACTIONS.find((a) => a.v === pv.action) || PV_ACTIONS[0]
  const pvAnimated = curAction.anim
  const pvCaption = `${curAction.l} · ${(PV_EXPRS.find((x) => x.v === pv.expr) || { l: '' }).l}`
  const mkPills = (list: { v: string; l: string }[], key: keyof Pv) =>
    list.map((o) => {
      const sel = pv[key] === o.v
      const hov = hoverPill === key + ':' + o.v && !sel
      return { o, sel, style: pillStyle(sel, hov) }
    })

  /* ── 파생: 염색 다이얼로그 ───────────────────────────────────────────────── */
  const dialog = (() => {
    const dk = dialogKey
    if (!dk) return null
    const dcid = dk.split('-')[0], didx = parseInt(dk.split('-')[1], 10)
    const dcat = CATS.find((c) => c.id === dcid)
    const dname = `${dcat ? dcat.label : ''} 아이템 ${didx + 1}`
    const closing = dialogClosing
    const equipHere = () =>
      setEquipped((s) => {
        const eq = { ...s }
        Object.keys(eq).forEach((k) => { if (k.startsWith(dcid + '-')) delete eq[k] })
        eq[dk] = true
        return eq
      })
    const common = {
      title: dname, slot: dcat ? dcat.label : '',
      overlayClass: closing ? 'pb-overlay-out' : 'pb-overlay',
      panelClass: closing ? 'pb-panel-out' : 'pb-panel',
      onApply: () => { equipHere(); closeDye() },
      closeStyle: `height:38px; padding:0 18px; border:1px solid ${hoverDlgClose ? '#ec86ac' : '#ddd4ca'}; background:#fff; border-radius:8px; font-family:inherit; font-size:13px; font-weight:500; color:${hoverDlgClose ? '#ec86ac' : '#5c534b'}; cursor:pointer; transition:border-color .2s ease, color .2s ease;`,
      applyStyle: `height:38px; padding:0 20px; border:none; background:${hoverDlgApply ? '#e07ba0' : '#ec86ac'}; border-radius:8px; font-family:inherit; font-size:13px; font-weight:600; color:#fff; cursor:pointer; transition:background .2s ease;`,
    }
    if (isMixCat(dcid)) {
      const m = dyeMix[dk] || defMix()
      const tone = itemTone(didx)
      return {
        ...common, kind: 'mix' as const, dk, m, tone,
        previewStyle: `width:120px; height:120px; border-radius:14px; border:1px solid #eee6dc; background:${mixColorTone(m.a, m.b, m.ratio, tone)};`,
      }
    }
    const hv = dyeHsv[dk] || defHsv()
    const setH = (f: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = clampF(f, parseInt(e.target.value, 10))
      setDyeHsv((s) => ({ ...s, [dk]: { ...(s[dk] || defHsv()), [f]: v } }))
    }
    return {
      ...common, kind: 'hsv' as const, dk, hv, setH,
      previewStyle: `width:120px; height:120px; border-radius:14px; border:1px solid #eee6dc; background:${hsvColor(hv.h, hv.s, hv.v)};`,
    }
  })()

  /* ── 스타일: 헤더/부위버튼/토스트 등 ──────────────────────────────────────── */
  const partBtnStyle = (() => {
    const bg = partMenuOpen ? '#fce9f1' : hoverPartBtn ? '#f7f2ec' : 'transparent'
    const bd = partMenuOpen ? '#eeb2ce' : hoverPartBtn ? '#e0d8ce' : '#eee6dc'
    return `display:flex; align-items:center; gap:9px; height:40px; padding:0 12px; margin-left:-4px; border:1px solid ${bd}; border-radius:10px; cursor:pointer; background:${bg}; transition:background .14s ease, border-color .14s ease;`
  })()
  const partBadgeStyle = (() => {
    const bg = partMenuOpen ? '#ec86ac' : hoverPartBtn ? '#eddbe4' : '#f2ece5'
    const col = partMenuOpen ? '#fff' : hoverPartBtn ? '#d76d9a' : '#a89e93'
    return `display:inline-flex; align-items:center; gap:4px; height:22px; padding:0 9px; border-radius:20px; font-size:11px; font-weight:600; letter-spacing:-0.01em; background:${bg}; color:${col}; transition:background .14s ease, color .14s ease;`
  })()
  const partMenuStyle = `position:absolute; top:calc(100% + 8px); left:0; z-index:20; width:360px; padding:10px; background:#fff; border:1px solid #e7ded4; border-radius:12px; box-shadow:0 12px 32px rgba(42,37,33,.12); transform-origin:top left; transition:opacity .2s ease, transform .2s cubic-bezier(.22,.61,.36,1); opacity:${partMenuOpen ? 1 : 0}; transform:translateY(${partMenuOpen ? '0' : '-6px'}) scale(${partMenuOpen ? 1 : 0.98}); pointer-events:${partMenuOpen ? 'auto' : 'none'};`
  const toastStyle = `position:fixed; bottom:32px; left:50%; z-index:70; display:flex; align-items:center; gap:8px; padding:12px 22px 12px 18px; background:linear-gradient(100deg,#ec86ac,#b57bdb); color:#fff; border-radius:999px; font-size:13px; font-weight:600; box-shadow:0 10px 28px rgba(180,123,219,.38); pointer-events:none; transition:opacity .28s ease, transform .28s cubic-bezier(.22,.61,.36,1); opacity:${toast ? 1 : 0}; transform:translate(-50%, ${toast ? '0' : '12px'});`
  const pvBarStyle = `flex:0 0 auto; width:100%; height:46px; padding:0 22px; border:none; border-top:1px solid #f0e9e1; background:${pvOpen ? '#faf7f3' : '#fff'}; display:flex; align-items:center; justify-content:space-between; gap:12px; cursor:pointer; font-family:inherit; transition:background .16s ease;`
  const pvCaretStyle = `font-size:11px; color:#a89e93; transition:transform .2s ease; transform:rotate(${pvOpen ? '180deg' : '0deg'}); flex:0 0 auto;`
  const pvZoomStyle = `height:100%; display:flex; align-items:center; justify-content:center; transform:scale(${pv.zoom / 2}); transform-origin:center; transition:transform .22s cubic-bezier(.22,.61,.36,1);`
  const pvDotStyle = `width:8px; height:8px; border-radius:50%; background:#ec86ac; animation:pbBlink ${(12 / pv.fps).toFixed(2)}s ease-in-out infinite;`

  const selStyle = 'flex:0 0 190px; height:34px; padding:0 30px 0 11px; border:1px solid #e7ded4; border-radius:8px; background-color:#faf7f3; font-family:inherit; font-size:13px; color:#3d372f; cursor:pointer; outline:none;'
  const rowBetween = 'display:flex; align-items:center; justify-content:space-between; gap:12px;'
  const pvLabel = 'font-size:12px; font-weight:600; color:#8a8075;'

  /* ══════════════════════════════════════════════════════════════════════════
     RENDER
     ══════════════════════════════════════════════════════════════════════════ */
  return (
    <div style={css('width:100%; height:100vh; display:flex; justify-content:center; background:linear-gradient(165deg, #fdf2f8 0%, #f6ecf6 55%, #efe8f7 100%);')}>
      <div style={css('width:100%; max-width:1440px; height:100%; padding:20px 32px 0; display:flex; flex-direction:column;')}>

        {/* ── 헤더 ── */}
        <header style={css('flex:0 0 auto; height:56px; display:flex; align-items:center; justify-content:space-between;')}>
          <div style={css('display:flex; align-items:center; gap:12px;')}>
            <div style={css('font-size:19px; font-weight:700; letter-spacing:-0.02em; background:linear-gradient(100deg, #ec86ac, #f0a9c4 55%, #c98fe0); -webkit-background-clip:text; background-clip:text; -webkit-text-fill-color:transparent; color:transparent;')}>핑크빈 커마샵</div>
            <span style={css('font-size:11px; font-weight:500; color:#9a8f84; background:#e9e2da; padding:3px 8px; border-radius:20px;')}>BETA</span>
          </div>
          <div style={css('display:flex; align-items:center; gap:5px; padding:3px; background:#f4ecf3; border-radius:10px;')}>
            {PRIMARIES.map((p) => {
              const on = p.id === primary
              const hov = hoverPrimary === p.id
              let bg = on ? '#ec86ac' : 'transparent', col = on ? '#fff' : '#8a8075'
              if (hov) { if (on) bg = '#e879a4'; else { bg = '#eadff0'; col = '#a15b93' } }
              return (
                <button key={p.id} onClick={() => setPrimary(p.id)} onMouseEnter={() => setHoverPrimary(p.id)} onMouseLeave={() => setHoverPrimary(null)}
                  style={css(`flex:0 0 auto; height:34px; padding:0 18px; border:none; border-radius:8px; cursor:pointer; font-family:inherit; font-size:13px; font-weight:${on ? 600 : 500}; color:${col}; background:${bg}; transition:background .28s ease, color .28s ease;`)}>{p.label}</button>
              )
            })}
          </div>
          <div style={css('display:flex; align-items:center; gap:12px;')}>
            <span style={css('display:flex; align-items:center; gap:6px; font-size:12px; color:#a89e93;')}>
              <span style={css('width:7px; height:7px; border-radius:50%; background:#5ec269;')} />자동 저장됨
            </span>
            <button onClick={shareCurrent} style={css('height:36px; padding:0 18px; border:none; background:#ec86ac; border-radius:8px; font-family:inherit; font-size:13px; font-weight:600; color:#fff; cursor:pointer; transition:background .18s ease, transform .18s ease;')}>코디 공유</button>
          </div>
        </header>

        {/* ── 메인 ── */}
        <main style={css('flex:1 1 auto; min-height:0; display:flex; gap:20px; padding:12px 0 20px;')}>

          {/* LEFT 65% */}
          <section style={css('flex:0 0 65%; min-width:0; background:#fff; border:1px solid #e7ded4; border-radius:16px; display:flex; flex-direction:column; overflow:hidden;')}>
            {/* 좌측 헤더 행 */}
            <div style={css('flex:0 0 auto; height:58px; padding:0 22px; display:flex; align-items:center; gap:14px; border-bottom:1px solid #f0e9e1;')}>
              <div style={css('flex:1 1 0; min-width:0; display:flex; align-items:center; gap:10px;')}>
                {isCodi ? (
                  <>
                    <div ref={partWrapRef} style={css('position:relative; flex:0 0 auto;')}>
                      <button onClick={() => setPartMenuOpen((v) => !v)} onMouseEnter={() => setHoverPartBtn(true)} onMouseLeave={() => setHoverPartBtn(false)} title="클릭해서 부위 선택" style={css(partBtnStyle)}>
                        <span style={css('font-size:15px; font-weight:700; white-space:nowrap;')}>{activeMeta.label}</span>
                        <span style={css(partBadgeStyle)}>부위 선택 ▾</span>
                      </button>
                      <div style={css(partMenuStyle)}>
                        <div style={css('display:grid; grid-template-columns:repeat(3,1fr); gap:4px;')}>
                          {CATS.map((c) => {
                            const on = c.id === activeCat
                            const hov = hoverCat === c.id
                            let bg = on ? '#ec86ac' : 'transparent', col = on ? '#fff' : '#7a7066'
                            if (hov && !on) { bg = '#f4e7ee'; col = '#ec86ac' }
                            return (
                              <button key={c.id}
                                onClick={() => { if (activeCat === c.id) { setPartMenuOpen(false) } else { setActiveCat(c.id); setOffset(0); setSnapping(false); setPartMenuOpen(false) } }}
                                onMouseEnter={() => setHoverCat(c.id)} onMouseLeave={() => setHoverCat(null)}
                                style={css(`width:100%; display:flex; align-items:center; justify-content:center; height:40px; padding:0 8px; border:none; border-radius:9px; cursor:pointer; font-family:inherit; font-size:13px; font-weight:${on ? 600 : 500}; color:${col}; background:${bg}; transition:background .26s ease, color .26s ease;`)}>{c.label}</button>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                    <span style={css('font-size:12px; color:#a89e93; white-space:nowrap; flex:0 0 auto;')}>{ITEM_COUNT}종</span>
                  </>
                ) : (
                  <span style={css('font-size:15px; font-weight:700;')}>{PRIMARIES.find((p) => p.id === primary)?.label}</span>
                )}
              </div>
              {isCodi && (
                <>
                  <div style={css('flex:0 0 auto; display:flex; align-items:center; gap:7px; font-variant-numeric:tabular-nums;')}>
                    <span style={css('font-size:11px; font-weight:500; color:#a89e93;')}>페이지</span>
                    <div title="페이지 번호를 입력해 이동" style={css('display:flex; align-items:center; gap:5px;')}>
                      <input value={pageEditing ? pageInput : `${curIdx + 1}`} onFocus={onPageFocus} onChange={onPageChange} onKeyDown={onPageKey} onBlur={commitPage} inputMode="numeric" aria-label="현재 페이지"
                        style={css('width:44px; height:34px; padding:0 6px; border:1.5px solid #eeb2ce; border-radius:8px; background:#fff; text-align:center; font-family:inherit; font-size:14px; font-weight:700; color:#ec86ac; outline:none; cursor:text; transition:border-color .12s;')} />
                      <span style={css('font-size:13px; font-weight:500; color:#c3b9ad;')}>/</span>
                      <span style={css('font-size:14px; font-weight:600; color:#8a8075;')}>{pageCount}</span>
                    </div>
                  </div>
                  <div style={css('flex:1 1 0; min-width:0; display:flex; justify-content:flex-end;')}>
                    <input placeholder="아이템 검색" style={css('height:34px; width:100%; max-width:180px; min-width:0; padding:0 12px; border:1px solid #e7ded4; border-radius:8px; background:#faf7f3; font-family:inherit; font-size:13px; outline:none;')} />
                  </div>
                </>
              )}
            </div>

            {/* codi: 캐러셀 */}
            {isCodi && (
              <>
                <div ref={vpRef} style={css('flex:1 1 auto; min-height:0; overflow:hidden; position:relative; touch-action:none; cursor:grab; user-select:none;')}>
                  <div style={css(trackStyle)}>
                    {pages.map((items, pi) => (
                      <div key={pi} style={css('flex:0 0 100%; width:100%; height:100%; padding:18px 22px;')}>
                        <div style={css('display:grid; grid-template-columns:repeat(6,minmax(0,1fr)); grid-template-rows:repeat(3,1fr); gap:16px; height:100%;')}>
                          {items.map((item) => (
                            <div key={item.id} onClick={() => selectItem(item.id)} className="pb-cardwrap">
                              <div className="pb-card" style={css(`display:flex; flex-direction:column; align-items:center; gap:8px; padding:12px 8px 10px; ${item.sel ? 'border:1px solid #ec86ac; transform:translateY(-5px); ' : ''}border-radius:12px; background:${item.sel ? '#fdf0f5' : '#fff'}; cursor:pointer; min-height:0; min-width:0;`)}>
                                <button onClick={(e) => { e.stopPropagation(); openDye(item.id) }} className="pb-dye" title="이 아이템 염색" style={css('position:absolute; top:7px; right:7px; height:22px; padding:0 9px; border-radius:20px; border:1px solid #f4cfdf; background:#fce9f1; color:#d76d9a; font-family:inherit; font-size:10px; font-weight:600; cursor:pointer; z-index:2;')}>염색</button>
                                <div style={css('flex:1 1 auto; width:100%; min-height:0; border-radius:8px; background:repeating-linear-gradient(45deg,#f7f2ec,#f7f2ec 8px,#f1ebe2 8px,#f1ebe2 16px); display:flex; align-items:center; justify-content:center;')}>
                                  <span style={css('font-size:10px; color:#b7ada2; font-family:monospace;')}>{item.code}</span>
                                </div>
                                <div style={css('font-size:12px; font-weight:500; color:#3d372f; line-height:1.3; text-align:center; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; width:100%;')}>{item.name}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div style={css('flex:0 0 auto; height:38px; display:flex; align-items:center; justify-content:center; border-top:1px solid #f0e9e1;')}>
                  <span style={css('font-size:12px; color:#a89e93;')}>스크롤 · 스와이프 · ← → 방향키로 페이지를 넘길 수 있어요</span>
                </div>
              </>
            )}

            {/* info: 코디 정보 + 염색 */}
            {isInfo && (
              <div style={css('flex:1 1 auto; min-height:0; display:flex; flex-direction:column;')}>
                <div style={css('flex:3 1 0; min-height:0; display:flex; flex-direction:column; padding:16px 22px 14px;')}>
                  <div style={css('flex:0 0 auto; display:flex; align-items:center; justify-content:space-between; margin-bottom:12px;')}>
                    <span style={css('font-size:13px; font-weight:700; color:#2a2521;')}>코디 정보</span>
                    <span style={css('font-size:12px; color:#a89e93;')}>착용 {equippedCount} / {slotList.length}</span>
                  </div>
                  <div className="pb-scroll" style={css('flex:1 1 auto; min-height:0; overflow:hidden auto;')}>
                    <div style={css('display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:10px;')}>
                      {slotList.map((s) => (
                        <div key={s.cat.id} onClick={() => { if (s.on) setDyeTarget(s.key!) }} style={css(s.cardStyle)}>
                          <div style={css(s.thumbStyle)}>
                            <span style={css('font-size:9px; color:#b7ada2; font-family:monospace;')}>{s.code}</span>
                          </div>
                          <div style={css('flex:1 1 0; min-width:0;')}>
                            <div style={css('font-size:11px; font-weight:600; color:#a89e93;')}>{s.slot}</div>
                            <div style={css(s.nameStyle)}>{s.name}</div>
                          </div>
                          {s.on && (
                            <button onClick={(e) => { e.stopPropagation(); setHidden((h) => { const n = { ...h }; if (n[s.key!]) delete n[s.key!]; else n[s.key!] = true; return n }) }}
                              onMouseEnter={() => setHoverToggle(s.key!)} onMouseLeave={() => setHoverToggle(null)} title="미리보기 표시/숨김" style={css(s.toggleStyle)}>{s.toggleLabel}</button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <div style={css('flex:0 0 auto; height:1px; margin:0 22px; background:#efe8e0;')} />
                <div style={css('flex:2 1 0; min-height:0; display:flex; flex-direction:column; padding:16px 22px 18px;')}>
                  <div style={css('flex:0 0 auto; display:flex; align-items:center; justify-content:space-between; margin-bottom:12px;')}>
                    <span style={css('font-size:13px; font-weight:700; color:#2a2521;')}>염색</span>
                    {dyeInfo && (
                      <button onClick={() => {
                        const k = dyeInfo.key
                        if (dyeInfo.mixMode) { setDyeMix((s) => { const d = { ...s }; delete d[k]; return d }); setDyeEdit((s) => { const e = { ...s }; delete e[k + ':ratio']; return e }) }
                        else { setDyeHsv((s) => { const d = { ...s }; delete d[k]; return d }); setDyeEdit((s) => { const e = { ...s };['h', 's', 'v'].forEach((f) => delete e[k + ':' + f]); return e }) }
                      }} style={css(dyeInfo.resetStyle)}>수치 초기화</button>
                    )}
                  </div>
                  {dyeInfo ? (
                    <div style={css('flex:1 1 auto; min-height:0; display:flex; gap:16px;')}>
                      <div style={css('flex:0 0 auto; display:flex; flex-direction:column; align-items:center; gap:8px; width:120px;')}>
                        <div style={css(`width:88px; height:88px; border-radius:12px; border:1px solid #eee6dc; background:${dyeInfo.mixMode ? mixColor(dyeInfo.m.a, dyeInfo.m.b, dyeInfo.m.ratio) : hsvColor(dyeInfo.hv.h, dyeInfo.hv.s, dyeInfo.hv.v)};`)} />
                        <div style={css('text-align:center;')}>
                          <div style={css('font-size:11px; font-weight:600; color:#a89e93;')}>{dyeInfo.slot}</div>
                          <div style={css('font-size:12px; font-weight:600; color:#2a2521; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:120px;')}>{dyeInfo.name}</div>
                        </div>
                      </div>
                      <div className="pb-scroll" style={css('flex:1 1 0; min-width:0; overflow:hidden auto; padding-right:2px; display:flex; flex-direction:column; gap:14px;')}>
                        {dyeInfo.mixMode ? (
                          <>
                            <div>
                              <div style={css('font-size:11px; font-weight:600; color:#a89e93; margin-bottom:8px;')}>색상 A</div>
                              <div style={css('display:flex; flex-wrap:wrap; gap:8px;')}>
                                {MIX_PALETTE.map((sw) => (
                                  <button key={sw.hex} title={sw.name} onClick={() => setDyeMix((s) => ({ ...s, [dyeInfo.key]: { ...(s[dyeInfo.key] || defMix()), a: sw.hex } }))} style={css(swStyle(sw.hex, dyeInfo.m.a === sw.hex))} />
                                ))}
                              </div>
                            </div>
                            <div>
                              <div style={css('font-size:11px; font-weight:600; color:#a89e93; margin-bottom:8px;')}>색상 B</div>
                              <div style={css('display:flex; flex-wrap:wrap; gap:8px;')}>
                                {MIX_PALETTE.map((sw) => (
                                  <button key={sw.hex} title={sw.name} onClick={() => setDyeMix((s) => ({ ...s, [dyeInfo.key]: { ...(s[dyeInfo.key] || defMix()), b: sw.hex } }))} style={css(swStyle(sw.hex, dyeInfo.m.b === sw.hex))} />
                                ))}
                              </div>
                            </div>
                            <div>
                              <div style={css('display:flex; align-items:center; justify-content:space-between; margin-bottom:6px;')}>
                                <span style={css('font-size:11px; font-weight:600; color:#a89e93;')}>혼합 비율</span>
                                <div style={css('display:flex; align-items:center; gap:4px;')}>
                                  <input type="number" min={0} max={100}
                                    value={dyeEdit[dyeInfo.key + ':ratio'] !== undefined ? dyeEdit[dyeInfo.key + ':ratio'] : String(dyeInfo.m.ratio)}
                                    onChange={(e) => { const raw = e.target.value; setDyeEdit((s) => ({ ...s, [dyeInfo.key + ':ratio']: raw })); const pv2 = parseInt(raw, 10); if (raw !== '' && !isNaN(pv2)) setDyeMix((s) => ({ ...s, [dyeInfo.key]: { ...(s[dyeInfo.key] || defMix()), ratio: Math.max(0, Math.min(100, pv2)) } })) }}
                                    onBlur={() => setDyeEdit((s) => { const e = { ...s }; delete e[dyeInfo.key + ':ratio']; return e })}
                                    style={css('width:52px; height:26px; padding:0 6px; border:1px solid #e7ded4; border-radius:6px; background:#faf7f3; font-family:inherit; font-size:12px; font-weight:600; text-align:right; color:#d76d9a; outline:none;')} />
                                  <span style={css('font-size:11px; color:#a89e93;')}>%</span>
                                </div>
                              </div>
                              <input type="range" min={0} max={100} value={dyeInfo.m.ratio}
                                onChange={(e) => { const v = Math.max(0, Math.min(100, parseInt(e.target.value, 10) || 0)); setDyeEdit((s) => { const ed = { ...s }; delete ed[dyeInfo.key + ':ratio']; return ed }); setDyeMix((s) => ({ ...s, [dyeInfo.key]: { ...(s[dyeInfo.key] || defMix()), ratio: v } })) }}
                                style={css('width:100%; accent-color:#ec86ac; cursor:pointer;')} />
                              <div style={css('display:flex; align-items:center; justify-content:space-between; margin-top:4px;')}>
                                <div style={css('display:flex; align-items:center; gap:6px;')}><span style={css(`width:12px; height:12px; border-radius:50%; background:${dyeInfo.m.a};`)} /><span style={css('font-size:10px; color:#a89e93;')}>A</span></div>
                                <div style={css('display:flex; align-items:center; gap:6px;')}><span style={css('font-size:10px; color:#a89e93;')}>B</span><span style={css(`width:12px; height:12px; border-radius:50%; background:${dyeInfo.m.b};`)} /></div>
                              </div>
                            </div>
                          </>
                        ) : (
                          <>
                            {([['색조 (Hue)', 'h', 0, 359], ['채도 (Saturation)', 's', -99, 99], ['명도 (Value)', 'v', -99, 99]] as const).map(([label, f, lo, hi]) => (
                              <div key={f}>
                                <div style={css('display:flex; align-items:center; justify-content:space-between; margin-bottom:6px;')}>
                                  <span style={css('font-size:11px; font-weight:600; color:#a89e93;')}>{label}</span>
                                  <input type="number" min={lo} max={hi}
                                    value={hsvDisp(dyeInfo.key, f, (dyeInfo.hv as any)[f])}
                                    onChange={hsvOnNum(dyeInfo.key, f)} onBlur={hsvOnBlur(dyeInfo.key, f)}
                                    style={css('width:52px; height:26px; padding:0 6px; border:1px solid #e7ded4; border-radius:6px; background:#faf7f3; font-family:inherit; font-size:12px; font-weight:600; text-align:right; color:#5c534b; outline:none;')} />
                                </div>
                                <input type="range" min={lo} max={hi} value={(dyeInfo.hv as any)[f]} onChange={hsvOnRange(dyeInfo.key, f)} style={css('width:100%; cursor:pointer; accent-color:#ec86ac;')} />
                              </div>
                            ))}
                          </>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div style={css('flex:1 1 auto; min-height:0; border:1px dashed #e4dcd2; border-radius:12px; background:#fbf8f4; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:6px;')}>
                      <span style={css('font-size:13px; font-weight:600; color:#8a8075;')}>염색할 아이템을 선택하세요</span>
                      <span style={css('font-size:12px; color:#b7ada2;')}>위 코디 정보에서 아이템 카드를 클릭하면 여기서 염색할 수 있어요.</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* preset */}
            {isPreset && (
              <div style={css('flex:1 1 auto; min-height:0; display:flex; flex-direction:column;')}>
                <div style={css('flex:0 0 auto; padding:16px 22px; display:flex; flex-direction:column; gap:10px;')}>
                  <div style={css('display:flex; align-items:center; gap:6px;')}>
                    {(['nick', 'code'] as const).map((mode) => {
                      const sel = (mode === 'nick') !== (importMode === 'code') ? importMode === mode : false
                      const isSel = importMode === mode
                      const th = hoverMode === mode && !isSel
                      const bd = isSel ? '#ec86ac' : th ? '#eeb2ce' : '#e7ded4'
                      const col = isSel ? '#d76d9a' : th ? '#d76d9a' : '#8a8075'
                      void sel
                      return (
                        <button key={mode} onClick={() => setImportMode(mode)} onMouseEnter={() => setHoverMode(mode)} onMouseLeave={() => setHoverMode(null)}
                          style={css(`height:34px; padding:0 12px; border-radius:8px; cursor:pointer; font-family:inherit; font-size:12px; font-weight:${isSel ? 600 : 500}; border:1px solid ${bd}; background:${isSel ? '#fce9f1' : '#fff'}; color:${col}; transition:background .26s ease, border-color .26s ease, color .26s ease;`)}>{mode === 'nick' ? '닉네임' : '코드'}</button>
                      )
                    })}
                    <span style={css('font-size:11px; color:#b7ada2; margin-left:2px;')}>불러온 코디는 선택한 프리셋에 덮어써져요</span>
                  </div>
                  <div style={css('display:flex; align-items:center; gap:10px;')}>
                    <input value={nickInput} onChange={(e) => setNickInput(e.target.value)} placeholder={importMode === 'code' ? '코디 공유 코드 입력 (예: PB-3F9AK2)' : '캐릭터 닉네임 입력'}
                      style={css('flex:1 1 0; min-width:0; height:38px; padding:0 14px; border:1px solid #e7ded4; border-radius:9px; background:#faf7f3; font-family:inherit; font-size:13px; outline:none; transition:border-color .14s ease;')} />
                    <button onClick={importFetch} style={css('flex:0 0 auto; height:38px; padding:0 18px; border:none; background:linear-gradient(100deg,#ec86ac,#b57bdb); border-radius:9px; font-family:inherit; font-size:13px; font-weight:600; color:#fff; cursor:pointer; transition:filter .15s ease, transform .15s ease;')}>불러오기</button>
                  </div>
                </div>
                <div style={css('flex:0 0 auto; height:1px; margin:0 22px; background:#f0e9e1;')} />
                <div className="pb-scroll pb-scroll-thin" style={css('flex:1 1 auto; min-height:0; overflow:hidden auto; padding:18px 22px;')}>
                  <div style={css('display:grid; grid-template-columns:repeat(5,minmax(0,1fr)); gap:12px;')}>
                    {presetCards.map((pc) => (
                      <div key={pc.p.id} className="pb-presetwrap">
                        <div onClick={() => selectPreset(pc.p.id)} className="pb-preset" style={css(pc.cardStyle)}>
                          <div style={css(pc.thumbStyle)}>
                            <span style={css(pc.selBadgeStyle)}>선택됨</span>
                            <button onClick={(e) => { e.stopPropagation(); sharePreset(pc.p) }} title="공유 링크 복사" style={css('position:absolute; top:7px; right:7px; width:24px; height:24px; border:none; border-radius:7px; background:rgba(255,255,255,0.85); color:#8a8075; font-family:inherit; font-size:11px; font-weight:600; cursor:pointer; transition:background .14s ease, color .14s ease;')}>↗</button>
                          </div>
                          <div style={css('padding:10px 11px 11px; display:flex; flex-direction:column; gap:3px;')}>
                            {pc.editing ? (
                              <input ref={renameRef} autoFocus value={editName} onChange={(e) => setEditName(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur() } else if (e.key === 'Escape') { setEditingPreset(null); setEditName('') } }}
                                onBlur={commitRename} onClick={(e) => e.stopPropagation()}
                                style={css('width:100%; height:26px; padding:0 8px; border:1.5px solid #ec86ac; border-radius:6px; background:#fff; font-family:inherit; font-size:13px; font-weight:600; color:#2a2521; outline:none;')} />
                            ) : (
                              <div style={css('display:flex; align-items:center; gap:5px;')}>
                                <span style={css('font-size:13px; font-weight:600; color:#2a2521; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; min-width:0;')}>{pc.p.name}</span>
                                <button onClick={(e) => startRename(pc.p.id, pc.p.name, e)} title="이름 변경" style={css('flex:0 0 auto; width:22px; height:22px; border:none; border-radius:6px; background:transparent; color:#c3b9ad; font-family:inherit; font-size:12px; cursor:pointer; transition:background .14s ease, color .14s ease;')}>✎</button>
                              </div>
                            )}
                            <span style={css('font-size:11px; color:#a89e93;')}>{pc.countLabel}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* RIGHT 35% — 미리보기 */}
          <section style={css('flex:0 0 calc(35% - 20px); min-width:0; background:#fff; border:1px solid #e7ded4; border-radius:16px; display:flex; flex-direction:column; overflow:hidden;')}>
            <div style={css('flex:0 0 auto; height:58px; padding:0 22px; display:flex; align-items:center; justify-content:space-between; border-bottom:1px solid #f0e9e1;')}>
              <span style={css('font-size:15px; font-weight:700;')}>코디 미리보기</span>
            </div>
            <div style={css('flex:1 1 40%; min-height:96px; display:flex; align-items:center; justify-content:center; padding:16px; overflow:hidden; background:radial-gradient(circle at 50% 42%, #fdf3f7 0%, #f9f5f0 60%);')}>
              <div style={css(pvZoomStyle)}>
                <div style={css('width:170px; height:100%; max-height:260px; border-radius:16px; border:2px dashed #e4b9cd; background:repeating-linear-gradient(45deg, #fdf0f5, #fdf0f5 10px, #fbe6ee 10px, #fbe6ee 20px); display:flex; flex-direction:column; align-items:center; justify-content:center; gap:10px; position:relative;')}>
                  <span style={css('font-size:11px; color:#c98fac; font-family:monospace;')}>character preview</span>
                  <span style={css('font-size:11px; color:#b98aa3; font-weight:600;')}>{pvCaption}</span>
                  {pvAnimated && (
                    <div style={css('position:absolute; top:10px; right:10px; display:flex; align-items:center; gap:5px; padding:3px 8px; border-radius:20px; background:#fff; border:1px solid #f4cfdf;')}>
                      <span style={css(pvDotStyle)} />
                      <span style={css('font-size:10px; font-weight:600; color:#d76d9a;')}>{pv.fps} fps</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <button onClick={() => setPvOpen((v) => !v)} style={css(pvBarStyle)}>
              <span style={css('font-size:13px; font-weight:600; color:#5c534b;')}>연출 설정</span>
              <span style={css('display:flex; align-items:center; gap:8px; min-width:0;')}>
                <span style={css('font-size:11px; color:#a89e93; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;')}>{pvCaption}</span>
                <span style={css(pvCaretStyle)}>▾</span>
              </span>
            </button>
            <div className={pvOpen ? 'pb-acc pb-acc-open' : 'pb-acc'} style={css('flex:0 0 auto;')}>
              <div>
                <div className="pb-scroll" style={css('max-height:300px; overflow:hidden auto; padding:14px 22px; border-top:1px solid #f0e9e1; display:flex; flex-direction:column; gap:11px;')}>
                  {/* 배율 */}
                  <div style={css(rowBetween)}>
                    <span style={css('font-size:12px; font-weight:600; color:#8a8075; flex:0 0 auto;')}>배율</span>
                    <div style={css('display:flex; gap:5px; flex-wrap:wrap; justify-content:flex-end;')}>
                      {[1, 2, 3].map((z) => {
                        const sel = pv.zoom === z, hov = hoverPill === 'zoom:' + z && !sel
                        return <button key={z} onClick={() => setPv('zoom', z)} onMouseEnter={() => setHoverPill('zoom:' + z)} onMouseLeave={() => setHoverPill(null)} style={css(pillStyle(sel, hov))}>{z}배</button>
                      })}
                    </div>
                  </div>
                  {/* 액션 */}
                  <div style={css(rowBetween)}>
                    <span style={css(pvLabel)}>액션</span>
                    <select value={pv.action} onChange={(e) => setPv('action', e.target.value)} className="pb-select" style={css(selStyle)}>
                      {PV_ACTIONS.map((a) => <option key={a.v} value={a.v}>{a.anim ? `${a.l} (애니메이션)` : a.l}</option>)}
                    </select>
                  </div>
                  {/* 프레임 속도 */}
                  {pvAnimated && (
                    <div>
                      <div style={css('display:flex; align-items:center; justify-content:space-between; margin-bottom:6px;')}>
                        <span style={css(pvLabel)}>프레임 속도</span>
                        <span style={css('font-size:12px; font-weight:600; color:#d76d9a; font-variant-numeric:tabular-nums;')}>{pv.fps} fps</span>
                      </div>
                      <input type="range" min={4} max={30} value={pv.fps} onChange={(e) => setPv('fps', parseInt(e.target.value, 10))} style={css('width:100%; accent-color:#ec86ac; cursor:pointer;')} />
                    </div>
                  )}
                  {/* 무기 모션 */}
                  <div style={css(rowBetween)}>
                    <span style={css(pvLabel)}>무기 모션</span>
                    <select value={pv.weapon} onChange={(e) => setPv('weapon', e.target.value)} className="pb-select" style={css(selStyle)}>
                      {PV_WEAPONS.map((w) => <option key={w.v} value={w.v}>{w.l}</option>)}
                    </select>
                  </div>
                  {/* 표정 */}
                  <div style={css(rowBetween)}>
                    <span style={css(pvLabel)}>표정</span>
                    <select value={pv.expr} onChange={(e) => setPv('expr', e.target.value)} className="pb-select" style={css(selStyle)}>
                      {PV_EXPRS.map((x) => <option key={x.v} value={x.v}>{x.l}</option>)}
                    </select>
                  </div>
                  {/* 형상 변이 */}
                  <div style={css(rowBetween)}>
                    <span style={css(pvLabel)}>형상 변이</span>
                    <select value={pv.form} onChange={(e) => setPv('form', e.target.value)} className="pb-select" style={css(selStyle)}>
                      {PV_FORMS.map((f) => <option key={f.v} value={f.v}>{f.l}</option>)}
                    </select>
                  </div>
                  {/* 귀 */}
                  <div style={css(rowBetween)}>
                    <span style={css('font-size:12px; font-weight:600; color:#8a8075; flex:0 0 auto;')}>귀</span>
                    <div style={css('display:flex; gap:6px; flex-wrap:wrap; justify-content:flex-end;')}>
                      {mkPills(PV_EARS, 'ear').map(({ o, style }) => (
                        <button key={o.v} onClick={() => setPv('ear', o.v)} onMouseEnter={() => setHoverPill('ear:' + o.v)} onMouseLeave={() => setHoverPill(null)} style={css(style)}>{o.l}</button>
                      ))}
                    </div>
                  </div>
                  {/* 시선 */}
                  <div style={css(rowBetween)}>
                    <span style={css('font-size:12px; font-weight:600; color:#8a8075; flex:0 0 auto;')}>시선</span>
                    <div style={css('display:flex; gap:6px; justify-content:flex-end;')}>
                      {mkPills(PV_GAZES, 'gaze').map(({ o, style }) => (
                        <button key={o.v} onClick={() => setPv('gaze', o.v)} onMouseEnter={() => setHoverPill('gaze:' + o.v)} onMouseLeave={() => setHoverPill(null)} style={css(style)}>{o.l}</button>
                      ))}
                    </div>
                  </div>
                  <div style={css('height:1px; background:#f0e9e1; margin:2px 0;')} />
                  {/* 무기 이펙트 */}
                  <div style={css('display:flex; align-items:center; justify-content:space-between;')}>
                    <span style={css(pvLabel)}>무기 이펙트</span>
                    <button onClick={() => setPv('wEffect', !pv.wEffect)} style={css(switchTrack(pv.wEffect))}><span style={css(switchKnob(pv.wEffect))} /></button>
                  </div>
                  {/* 망토 이펙트 */}
                  <div style={css('display:flex; align-items:center; justify-content:space-between;')}>
                    <span style={css(pvLabel)}>망토 이펙트</span>
                    <button onClick={() => setPv('cEffect', !pv.cEffect)} style={css(switchTrack(pv.cEffect))}><span style={css(switchKnob(pv.cEffect))} /></button>
                  </div>
                </div>
              </div>
            </div>
            <div style={css('flex:0 0 auto; padding:14px 22px; border-top:1px solid #f0e9e1; display:flex; justify-content:space-between; align-items:center;')}>
              <span style={css('font-size:12px; color:#a89e93;')}>착용 아이템 {equippedCount}개</span>
            </div>
          </section>
        </main>
      </div>

      {/* ── 염색 다이얼로그 ── */}
      {dialog && (
        <div onClick={closeDye} className={dialog.overlayClass} style={css('position:fixed; inset:0; z-index:60; background:rgba(42,37,33,0.42); display:flex; align-items:center; justify-content:center; padding:32px;')}>
          <div onClick={(e) => e.stopPropagation()} className={dialog.panelClass} style={css('width:100%; max-width:720px; max-height:88vh; background:#fff; border-radius:18px; display:flex; flex-direction:column; overflow:hidden;')}>
            <div style={css('flex:0 0 auto; height:60px; padding:0 22px; display:flex; align-items:center; justify-content:space-between; border-bottom:1px solid #f0e9e1;')}>
              <div style={css('display:flex; align-items:baseline; gap:10px;')}>
                <span style={css('font-size:16px; font-weight:700; color:#2a2521;')}>{dialog.title}</span>
                <span style={css('font-size:12px; color:#a89e93;')}>염색</span>
              </div>
              <button onClick={closeDye} style={css('width:34px; height:34px; border:1px solid #e7ded4; background:#faf7f3; border-radius:8px; cursor:pointer; font-family:inherit; font-size:15px; color:#8a8075; transition:border-color .14s ease, color .14s ease;')}>✕</button>
            </div>

            <div className="pb-scroll" style={css('flex:1 1 auto; min-height:0; overflow:hidden auto; padding:20px 22px;')}>
              {dialog.kind === 'mix' ? (
                <div style={css('display:flex; gap:22px;')}>
                  <div style={css('flex:0 0 auto; display:flex; flex-direction:column; align-items:center; gap:10px; width:120px;')}>
                    <div style={css(dialog.previewStyle)} />
                    <span style={css('font-size:11px; color:#b7ada2; text-align:center;')}>50 : 50 미리보기</span>
                  </div>
                  <div style={css('flex:1 1 0; min-width:0; overflow-x:auto;')}>
                    <div style={css('display:flex; gap:6px; margin-bottom:6px;')}>
                      <div style={css('flex:0 0 66px;')} />
                      <div style={css('flex:1 1 0; display:grid; grid-template-columns:repeat(8,1fr); gap:6px;')}>
                        {MIX_PALETTE.map((col) => (
                          <div key={col.hex} style={css('display:flex; flex-direction:column; align-items:center; gap:3px;')}>
                            <span style={css(`width:14px; height:14px; border-radius:50%; background:${col.hex}; border:1px solid rgba(0,0,0,0.1);`)} />
                            <span style={css('font-size:9px; color:#a89e93;')}>{col.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    {MIX_PALETTE.map((rp) => (
                      <div key={rp.hex} style={css('display:flex; gap:6px; align-items:center; margin-bottom:6px;')}>
                        <div style={css('flex:0 0 66px; display:flex; align-items:center; gap:5px;')}>
                          <span style={css(`width:14px; height:14px; border-radius:50%; background:${rp.hex}; border:1px solid rgba(0,0,0,0.1);`)} />
                          <span style={css('font-size:10px; font-weight:600; color:#8a8075;')}>{rp.name}</span>
                        </div>
                        <div style={css('flex:1 1 0; display:grid; grid-template-columns:repeat(8,1fr); gap:6px;')}>
                          {MIX_PALETTE.map((cp) => {
                            const sel = dialog.m.a === rp.hex && dialog.m.b === cp.hex
                            return <button key={cp.hex} onClick={() => setDyeMix((s) => ({ ...s, [dialog.dk]: { a: rp.hex, b: cp.hex, ratio: 50 } }))}
                              style={css(`width:100%; aspect-ratio:1/1; border-radius:7px; cursor:pointer; padding:0; background:${mixColorTone(rp.hex, cp.hex, 50, dialog.tone)}; border:2px solid ${sel ? '#ec86ac' : 'rgba(0,0,0,0.06)'}; transition:transform .1s ease;`)} />
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div style={css('display:flex; gap:22px;')}>
                  <div style={css('flex:0 0 auto; display:flex; flex-direction:column; align-items:center; gap:10px; width:120px;')}>
                    <div style={css(dialog.previewStyle)} />
                    <span style={css('font-size:12px; font-weight:600; color:#2a2521;')}>{dialog.slot}</span>
                  </div>
                  <div style={css('flex:1 1 0; min-width:0; display:flex; flex-direction:column; gap:16px;')}>
                    {([['색조 (Hue)', 'h', 0, 359, String(dialog.hv.h)], ['채도 (Saturation)', 's', -99, 99, (dialog.hv.s > 0 ? '+' : '') + dialog.hv.s], ['명도 (Value)', 'v', -99, 99, (dialog.hv.v > 0 ? '+' : '') + dialog.hv.v]] as const).map(([label, f, lo, hi, disp]) => (
                      <div key={f}>
                        <div style={css('display:flex; align-items:center; justify-content:space-between; margin-bottom:6px;')}>
                          <span style={css('font-size:12px; font-weight:600; color:#a89e93;')}>{label}</span>
                          <span style={css('font-size:12px; font-weight:600; color:#5c534b;')}>{disp}</span>
                        </div>
                        <input type="range" min={lo} max={hi} value={(dialog.hv as any)[f]} onChange={dialog.setH(f)} style={css('width:100%; accent-color:#ec86ac; cursor:pointer;')} />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div style={css('flex:0 0 auto; padding:14px 22px; border-top:1px solid #f0e9e1; display:flex; justify-content:flex-end; gap:8px;')}>
              <button onClick={closeDye} onMouseEnter={() => setHoverDlgClose(true)} onMouseLeave={() => setHoverDlgClose(false)} style={css(dialog.closeStyle)}>닫기</button>
              <button onClick={dialog.onApply} onMouseEnter={() => setHoverDlgApply(true)} onMouseLeave={() => setHoverDlgApply(false)} style={css(dialog.applyStyle)}>착용 · 적용</button>
            </div>
          </div>
        </div>
      )}

      {/* ── 토스트 ── */}
      <div style={css(toastStyle)}><span style={css('width:8px; height:8px; border-radius:50%; background:#fff; box-shadow:0 0 0 3px rgba(255,255,255,.35);')} />{toastText}</div>
    </div>
  )
}
