'use client'

import clsx from 'clsx'
import { useEffect, useRef, useState } from 'react'
import { css } from '@/lib/style'
import { isStacked } from '@/lib/useBreakpoint'
import MiniCalendar from './MiniCalendar'
import SnapThumb from './SnapThumb'
import { useShop, type LookOption } from './ShopContext'

// 닉네임으로 불러올 때 "어느 시점의 · 어느 코디의 · 어느 프리셋을 가져올지" 고르는 다이얼로그.
// 한 패널(고정 크기) 안에서 두 화면을 좌우로 밀며(pb-view-*) 전환한다 — 2중 다이얼로그도, 크기 변화도 없다.
//   1) 코디 화면: 지금 선택된 날짜의 치장 프리셋 카드(기본 + 프리셋 1~3). 위엔 시점 + "날짜 변경".
//   2) 날짜 화면: 코디 검색과 같은 가로 flicking(페이지) 리스트. 현재±1 페이지만 마운트(가상화) + 보이는 것만 병렬 조회.
//      · 모바일 4개(2×2) · PC 6개(3×2)씩, 스와이프/휠/← →로 넘김. 날짜 input 으로 특정 날짜로 점프.
// 미리보기 조회는 동시 N개 병렬 + 취소(다이얼로그 닫힘/이동 시 즉시 중단). 못 가져온 날은 카드에만 "코디 없음"(토스트 없음).
// 속도: 서버가 ocid 캐시 + 429/5xx 재시도 + 과거시점 응답을 캐시 → 두 번째부터 즉시.

const MIN_DATE = '2023-12-21'
const DAY = 86400000
const CONCURRENCY = 3 // 미리보기 동시 조회 수(넥슨 버스트 레이트리밋을 넘지 않게 — 재시도로 흡수)
const kstNow = () => new Date(Date.now() + 9 * 3600 * 1000)
const iso = (d: Date) => d.toISOString().slice(0, 10)
const addDaysStr = (s: string, n: number) => iso(new Date(Date.parse(s + 'T00:00:00Z') + n * DAY))

type CacheVal = LookOption[] | null | 'load'

export default function LookDialog() {
  const s = useShop()
  const lp = s.lookPick
  const stacked = isStacked(s.bp)
  const cols = stacked ? 2 : 3
  const perPage = cols * 2 // 한 페이지 카드 수(2줄): 모바일 4 · PC 6

  const [hover, setHover] = useState<string | null>(null)
  const [lookKey, setLookKey] = useState<string | null>(null)
  const [closing, setClosing] = useState(false)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 화면 전환(코디 ↔ 날짜) — 양방향 슬라이드.
  const [view, setView] = useState<'preset' | 'date'>('preset')
  const [anim, setAnim] = useState('')
  const animTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 날짜 캐러셀 상태
  const [anchor, setAnchor] = useState(0) // 리스트 시작(날짜 점프 시 그 날이 첫 카드)
  const [pageIdx, setPageIdx] = useState(0)
  const [offset, setOffset] = useState(0)
  const [snapping, setSnapping] = useState(true)
  const [selecting, setSelecting] = useState<string | null>(null)
  const vpRef = useRef<HTMLDivElement | null>(null)
  const dragRef = useRef({ on: false, captured: false, startX: 0, lastX: 0, lastT: 0, vel: 0 })
  const wheelRef = useRef({ acc: 0, dir: 0, t: 0 })
  const liveRef = useRef({ pageIdx: 0, maxIdx: 0, offset: 0 })

  // 미리보기 캐시 + 병렬 조회 큐(취소 가능)
  const [cache, setCache] = useState<Record<string, CacheVal>>({})
  const cacheRef = useRef<Record<string, CacheVal>>({})
  const queueRef = useRef<string[]>([])
  const workingRef = useRef(0)
  const epochRef = useRef(0)     // stopLoader 마다 증가 → 이전 조회 결과/구동 무효화
  const abortRef = useRef<AbortController | null>(null)

  const kNow = kstNow()
  const today = iso(kNow)
  // 인게임 코디는 "다음날 오전 5시(KST)"에 반영된다 → 그 전엔 전날 코디를 아직 못 가져온다.
  //  예) 8/25 05:00 이전엔 8/24 코디가 아직 없어 최신 조회 가능일 = 8/23. 05:00 이후엔 8/24.
  const latestFetch = addDaysStr(today, kNow.getUTCHours() >= 5 ? -1 : -2)

  // 전체 날짜(내림차순): [현재(최신)=오늘, 최신조회일, …, 2023-12-21]. 경계(오늘/최신조회일)가 바뀔 때만 재생성.
  const allDatesRef = useRef<{ key: string; list: string[] }>({ key: '', list: [] })
  const dkey = today + latestFetch
  if (allDatesRef.current.key !== dkey) {
    const list = [today]
    for (let d = latestFetch; d >= MIN_DATE; d = addDaysStr(d, -1)) list.push(d)
    allDatesRef.current = { key: dkey, list }
  }
  const allDates = allDatesRef.current.list

  // 캐러셀 파생값(가드 앞)
  const sub = allDates.slice(anchor)
  const pageCount = Math.max(1, Math.ceil(sub.length / perPage))
  const maxIdx = pageCount - 1
  const curPage = Math.min(Math.max(0, pageIdx), maxIdx)
  const winStart = Math.max(0, curPage - 1)
  const winEnd = Math.min(maxIdx, curPage + 1)
  liveRef.current = { pageIdx: curPage, maxIdx, offset }

  const setCacheAt = (d: string, v: CacheVal) => {
    cacheRef.current = { ...cacheRef.current, [d]: v }
    setCache(cacheRef.current)
  }

  // ── 병렬 미리보기 로더(가상화: 보이는 페이지만 큐에 넣고, 닫으면 즉시 중단) ──
  const ensureAbort = () => { if (!abortRef.current || abortRef.current.signal.aborted) abortRef.current = new AbortController() }
  const stopLoader = () => { epochRef.current++; try { abortRef.current?.abort() } catch {} abortRef.current = null; queueRef.current = [] }
  const drainQueue = () => {
    ensureAbort()
    const ep = epochRef.current
    const signal = abortRef.current?.signal
    while (workingRef.current < CONCURRENCY) {
      let next: string | undefined
      while ((next = queueRef.current.shift()) !== undefined && next in cacheRef.current) { /* 이미 조회함 → skip */ }
      if (next === undefined) break
      const d = next
      workingRef.current++
      setCacheAt(d, 'load')
      void (async () => {
        const opts = await s.previewLookAt(d, signal).catch(() => null)
        workingRef.current = Math.max(0, workingRef.current - 1)
        if (epochRef.current !== ep) return // 그새 닫힘/이동 → 폐기
        setCacheAt(d, opts && opts.length ? opts : null)
        drainQueue()
      })()
    }
  }
  const enqueue = (dates: string[]) => {
    for (const d of dates) if (cacheRef.current[d] === undefined && !queueRef.current.includes(d)) queueRef.current.push(d)
    drainQueue()
  }

  // 다이얼로그가 "열릴 때"만 초기화. 현재(오늘) 미리보기는 이미 있으니 시드. 닫히면 로더 중단.
  const wasOpen = useRef(false)
  useEffect(() => {
    const open = !!lp
    if (open && !wasOpen.current && lp) {
      stopLoader(); workingRef.current = 0
      setView('preset'); setAnim(''); setAnchor(0); setPageIdx(0); setOffset(0); setSnapping(true); setSelecting(null)
      cacheRef.current = { [lp.date]: lp.options }; setCache(cacheRef.current)
      const pref = lp.options.find((o) => o.key === 'additional') ?? lp.options[0]
      setLookKey(pref?.key ?? null)
    }
    if (!open && wasOpen.current) stopLoader() // 닫힘 → 진행 중 조회 중단
    wasOpen.current = open
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lp])

  // 코디 탭 기본 선택 유지(제로/엔버).
  useEffect(() => {
    if (!lp) { setLookKey(null); return }
    if (!lp.options.some((o) => o.key === lookKey)) {
      const pref = lp.options.find((o) => o.key === 'additional') ?? lp.options[0]
      setLookKey(pref?.key ?? null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lp])

  // 날짜 화면에서 보이는(현재±1) 페이지 카드만 병렬 조회. 페이지가 바뀌면 대기열을 보이는 것만으로 갱신.
  useEffect(() => {
    if (view !== 'date') return
    queueRef.current = []
    enqueue(sub.slice(curPage * perPage, (curPage + 1) * perPage)) // 보이는 현재 페이지만(콜 최소화 — 넘기면 그때 로드)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, curPage, anchor, perPage])

  const close = (after?: () => void) => {
    if (closeTimer.current) return
    stopLoader()
    setClosing(true)
    closeTimer.current = setTimeout(() => {
      closeTimer.current = null; setClosing(false)
      if (after) after(); else s.closeLookPick()
    }, 200)
  }
  useEffect(() => () => {
    if (closeTimer.current) clearTimeout(closeTimer.current)
    if (animTimer.current) clearTimeout(animTimer.current)
    stopLoader()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const goView = (to: 'preset' | 'date', dir: 'fwd' | 'back') => {
    if (animTimer.current) return
    if (to === 'preset') stopLoader() // 날짜 화면을 떠나면 미리보기 조회 중단
    setAnim(dir === 'fwd' ? 'pb-view-out-l' : 'pb-view-out-r')
    animTimer.current = setTimeout(() => {
      animTimer.current = null
      setView(to)
      setAnim(dir === 'fwd' ? 'pb-view-in-r' : 'pb-view-in-l')
    }, 170)
  }

  // Esc: 날짜 화면이면 코디 화면으로, 아니면 닫기.
  useEffect(() => {
    if (!lp) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (view === 'date' && !animTimer.current) goView('preset', 'back'); else close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lp, view])

  const setPage = (i: number, snap = true) => {
    setPageIdx(Math.max(0, Math.min(liveRef.current.maxIdx, i)))
    setOffset(0); setSnapping(snap)
  }

  // ← →: 다이얼로그가 열려 있으면 캡처해서 뒤 화면(코디 검색)이 같이 넘어가지 않게 막고, 날짜 화면이면 페이지 이동.
  useEffect(() => {
    if (!lp) return
    const onKeyCap = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
      e.stopImmediatePropagation()
      if (view === 'date' && !animTimer.current) { e.preventDefault(); setPage(liveRef.current.pageIdx + (e.key === 'ArrowRight' ? 1 : -1)) }
    }
    window.addEventListener('keydown', onKeyCap, true)
    return () => window.removeEventListener('keydown', onKeyCap, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lp, view])

  // 캐러셀 입력(스와이프/휠) — 날짜 화면에서만. 코디 검색의 조작감을 그대로.
  const onWheel = (e: WheelEvent) => {
    e.preventDefault()
    let raw = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY
    if (e.deltaMode === 1) raw *= 16
    else if (e.deltaMode === 2) raw *= (vpRef.current?.clientWidth || 400)
    if (Math.abs(raw) < 2) return
    const TH = 100, CAP = 12, now = performance.now(), dir = Math.sign(raw), w = wheelRef.current
    if (dir !== w.dir || now - w.t > 200) { w.acc = dir * (TH - 1); w.dir = dir }
    w.t = now; w.acc += raw
    let n = Math.trunc(w.acc / TH); w.acc -= n * TH; n = Math.max(-CAP, Math.min(CAP, n))
    if (n) setPage(liveRef.current.pageIdx + n)
  }
  const onVpDown = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse') return
    dragRef.current = { on: true, captured: false, startX: e.clientX, lastX: e.clientX, lastT: performance.now(), vel: 0 }
    setSnapping(false)
  }
  useEffect(() => {
    if (view !== 'date') return
    const vp = vpRef.current
    const onMove = (e: PointerEvent) => {
      const d = dragRef.current
      if (!d.on) return
      if (e.buttons === 0) { d.on = false; d.captured = false; return }
      let dx = e.clientX - d.startX
      if (!d.captured) { if (Math.abs(dx) < 6) return; d.captured = true; try { vp?.setPointerCapture(e.pointerId) } catch {} }
      const now = performance.now(), dt = now - d.lastT
      if (dt > 0) d.vel = (e.clientX - d.lastX) / dt
      d.lastX = e.clientX; d.lastT = now
      const max = liveRef.current.maxIdx, cur = liveRef.current.pageIdx
      if ((cur === 0 && dx > 0) || (cur === max && dx < 0)) dx *= 0.35
      setOffset(dx)
    }
    const onUp = () => {
      const d = dragRef.current
      if (!d.on) return
      d.on = false
      if (!d.captured) return
      d.captured = false
      const W = (vp && vp.clientWidth) || 1
      const frac = liveRef.current.offset / W
      let moved = 0
      if (Math.abs(frac) > 0.15) moved = Math.sign(frac) * Math.max(1, Math.round(Math.abs(frac)))
      else if (Math.abs(d.vel) > 0.45) moved = Math.sign(d.vel)
      setPage(liveRef.current.pageIdx - moved)
    }
    vp?.addEventListener('wheel', onWheel, { passive: false })
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      vp?.removeEventListener('wheel', onWheel)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, lp])

  const jumpToDate = (v: string) => {
    const i = allDates.indexOf(v)
    if (i < 0) return
    setAnchor(i); setPageIdx(0); setOffset(0); setSnapping(false) // 점프는 슬라이드 없이 즉시
  }

  const commitAndBack = (d: string, opts: LookOption[]) => { s.commitLookDate(d, opts); goView('preset', 'back') }
  // 선택 시엔 full(일반 장비 포함)로 정확히 다시 받아 적용. 실패하면 이미 받아둔 light 미리보기로라도 적용(그냥 넘기지 않음).
  const selectDate = async (d: string) => {
    if (selecting) return
    if (cacheRef.current[d] === null) return // 코디 없음(데이터 자체가 없음)
    setSelecting(d)
    ensureAbort()
    const full = await s.previewLookAt(d, abortRef.current?.signal, true).catch(() => null)
    setSelecting(null)
    if (full && full.length) { setCacheAt(d, full); commitAndBack(d, full); return }
    const light = cacheRef.current[d] // full 실패 → light 미리보기 폴백
    if (Array.isArray(light) && light.length) commitAndBack(d, light)
  }

  if (!lp) return null
  const look = lp.options.find((o) => o.key === lookKey) ?? lp.options[0]
  if (!look) return null
  const multiLook = lp.options.length > 1
  const presetCols = Math.min(look.presets.length, cols)
  const dateLabel = lp.date >= today ? '현재 (최신)' : lp.date
  const inputDate = sub[curPage * perPage] ?? today // 지금 보고 있는 페이지의 첫 날짜(스와이프하면 따라 갱신)
  const winPages: number[] = []
  for (let p = winStart; p <= winEnd; p++) winPages.push(p)

  const closeBtn = (
    <button onClick={() => close()} title="닫기 (Esc)"
      style={css('flex:0 0 auto; width:34px; height:34px; border:1px solid #e7ded4; background:#faf7f3; border-radius:8px; cursor:pointer; font-family:inherit; font-size:15px; color:#8a8075; transition:border-color .14s ease, color .14s ease;')}>✕</button>
  )

  // ── 코디(프리셋) 화면 ─────────────────────────────────────────────
  const presetView = (
    <div style={css('display:flex; flex-direction:column; min-height:0; flex:1 1 auto;')}>
      <div style={css('flex:0 0 auto; padding:18px 22px 0; display:flex; align-items:flex-start; justify-content:space-between; gap:12px;')}>
        <div style={css('display:flex; flex-direction:column; gap:4px; min-width:0;')}>
          <span style={css('font-size:15px; font-weight:700; color:#2a2521;')}>가져올 코디 선택</span>
          <span style={css('font-size:12px; color:#a89e93; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;')}>
            {multiLook ? `'${lp.nick}' 은(는) 코디가 두 벌이에요 · 프리셋을 골라 주세요` : `'${lp.nick}' 의 치장 프리셋을 골라 주세요`}
          </span>
        </div>
        {closeBtn}
      </div>

      <div style={css('flex:0 0 auto; padding:14px 22px 0; display:flex; align-items:center; gap:10px; flex-wrap:wrap;')}>
        <span style={css('font-size:12px; font-weight:600; color:#8a8075; flex:0 0 auto;')}>시점</span>
        <span style={css('font-size:12px; color:#3d372f; font-variant-numeric:tabular-nums;')}>{dateLabel}</span>
        <button onClick={() => goView('date', 'fwd')}
          style={css('margin-left:auto; height:30px; padding:0 12px; display:inline-flex; align-items:center; gap:6px; border:1px solid #eeb2ce; border-radius:8px; background:#fdf4f8; font-family:inherit; font-size:12px; font-weight:600; color:#d76d9a; cursor:pointer; transition:background .14s ease;')}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>
          날짜 변경
        </button>
      </div>

      {multiLook && (
        <div style={css('flex:0 0 auto; padding:12px 22px 0;')}>
          <div style={css('display:flex; align-items:center; gap:4px; padding:3px; background:#f4ecf3; border-radius:10px;')}>
            {lp.options.map((o) => {
              const on = o.key === look.key
              return (
                <button key={o.key} onClick={() => setLookKey(o.key)}
                  style={css(`flex:1 1 auto; height:32px; padding:0 12px; border:none; border-radius:8px; cursor:pointer; font-family:inherit; font-size:13px; font-weight:${on ? 600 : 500}; white-space:nowrap; color:${on ? '#fff' : '#8a8075'}; background:${on ? '#ec86ac' : 'transparent'}; transition:background .22s ease, color .22s ease;`)}>{o.label}</button>
              )
            })}
          </div>
        </div>
      )}

      {/* 고정 높이 행으로 채워 스크롤이 생기지 않게(패딩이 hover 리프트도 흡수). */}
      <div style={css(`flex:1 1 auto; min-height:0; overflow:hidden; padding:14px 22px; display:grid; grid-template-columns:repeat(${presetCols}, 1fr); grid-auto-rows:${stacked ? 200 : 218}px; align-content:start; gap:14px;`)}>
        {look.presets.map((p) => {
          const hk = `${look.key}:${p.key}`
          const on = hover === hk
          return (
            <button key={hk} onClick={() => close(() => s.chooseLook(look.key, p.key))}
              onMouseEnter={() => setHover(hk)} onMouseLeave={() => setHover(null)}
              style={css(`display:flex; flex-direction:column; align-items:stretch; height:100%; min-height:0; gap:0; padding:0; border-radius:12px; cursor:pointer; overflow:hidden; font-family:inherit; background:#faf7f3; border:2px solid ${on ? '#ec86ac' : '#e7ded4'}; transition:border-color .14s ease, transform .14s ease; transform:translateY(${on ? -2 : 0}px);`)}>
              <div style={css('position:relative; flex:1 1 0; min-height:0; width:100%; background:#f7f2ec; overflow:hidden;')}>
                <SnapThumb snap={p.snap} />
                {p.active && (
                  <span style={css('position:absolute; top:7px; left:7px; height:20px; padding:0 8px; display:inline-flex; align-items:center; border-radius:20px; background:rgba(255,255,255,0.94); border:1px solid #f4cfdf; color:#d76d9a; font-size:10px; font-weight:600; white-space:nowrap; box-shadow:0 2px 8px rgba(214,109,154,.18);')}>착용 중</span>
                )}
              </div>
              <span style={css(`flex:0 0 auto; padding:8px; font-size:13px; font-weight:600; text-align:center; color:${on ? '#d76d9a' : '#6e645c'}; background:#fff; border-top:1px solid #f0e9e1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; transition:color .14s ease;`)}>{p.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )

  // ── 날짜(시점) 화면 — 가상화 가로 flicking 캐러셀 ──────────────────
  const dateCard = (d: string) => {
    const isToday = d === today
    const c = cacheRef.current[d]
    const opts = Array.isArray(c) ? c : null
    const primary = opts ? (opts.find((o) => o.presets.some((p) => p.active)) ?? opts[0]) : null
    const rep = primary ? (primary.presets.find((p) => p.active) ?? primary.presets[0]) : null
    const empty = c === null
    const on = d === lp.date
    const busy = selecting === d
    const hk = `d:${d}`
    const hov = hover === hk && !empty
    const preview = rep
      ? <SnapThumb snap={rep.snap} />
      : empty
        ? <span style={css('font-size:11px; color:#b7ada2;')}>코디 없음</span>
        : <div className="pb-skel" style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', width: '56%', height: '56%', borderRadius: 8 }} />
    return (
      <button key={hk} disabled={empty || busy} onClick={() => selectDate(d)}
        onMouseEnter={() => setHover(hk)} onMouseLeave={() => setHover(null)}
        style={css(`display:flex; flex-direction:column; align-items:stretch; height:100%; min-height:0; min-width:0; padding:0; border-radius:12px; overflow:hidden; font-family:inherit; background:#faf7f3; border:2px solid ${on ? '#ec86ac' : hov ? '#eeb2ce' : '#e7ded4'}; cursor:${empty ? 'default' : 'pointer'}; transition:border-color .14s ease, transform .14s ease; transform:translateY(${hov ? -2 : 0}px); ${empty ? 'opacity:.6;' : ''}`)}>
        <div style={css('position:relative; flex:1 1 0; min-height:0; width:100%; background:#f7f2ec; overflow:hidden; display:flex; align-items:center; justify-content:center;')}>
          {preview}
          {isToday && !empty && (
            <span style={css('position:absolute; top:7px; left:7px; height:19px; padding:0 8px; display:inline-flex; align-items:center; border-radius:20px; background:rgba(255,255,255,0.94); border:1px solid #f4cfdf; color:#d76d9a; font-size:10px; font-weight:600; white-space:nowrap; box-shadow:0 2px 8px rgba(214,109,154,.18);')}>최신</span>
          )}
          {busy && <div style={css('position:absolute; inset:0; background:rgba(255,255,255,0.55); display:flex; align-items:center; justify-content:center;')}><span className="pb-spin" style={css('width:22px; height:22px; border:2.5px solid #f0d7e2; border-top-color:#ec86ac; border-radius:50%;')} /></div>}
        </div>
        <span style={css(`flex:0 0 auto; padding:7px 8px; font-size:12.5px; font-weight:600; text-align:center; color:${on ? '#d76d9a' : '#6e645c'}; background:#fff; border-top:1px solid #f0e9e1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; font-variant-numeric:tabular-nums;`)}>{isToday ? '현재 (최신)' : d}</span>
      </button>
    )
  }

  const trackTx = `translateX(calc(${-curPage * 100}% + ${offset}px))`
  const gridStyle = `display:grid; grid-template-columns:repeat(${cols},minmax(0,1fr)); grid-template-rows:repeat(2,1fr); gap:${stacked ? 10 : 14}px; height:100%;`

  const dateView = (
    <div style={css('display:flex; flex-direction:column; min-height:0; flex:1 1 auto;')}>
      <div style={css('flex:0 0 auto; padding:18px 22px 0; display:flex; align-items:flex-start; justify-content:space-between; gap:12px;')}>
        <div style={css('display:flex; align-items:center; gap:10px; min-width:0;')}>
          <button onClick={() => goView('preset', 'back')} title="코디 선택으로"
            style={css('flex:0 0 auto; width:34px; height:34px; border:1px solid #e7ded4; background:#faf7f3; border-radius:8px; cursor:pointer; font-family:inherit; font-size:16px; color:#8a8075; display:flex; align-items:center; justify-content:center;')}>‹</button>
          <div style={css('display:flex; flex-direction:column; gap:4px; min-width:0;')}>
            <span style={css('font-size:15px; font-weight:700; color:#2a2521;')}>시점 선택</span>
            <span style={css('font-size:12px; color:#a89e93; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;')}>날짜를 골라 그 시점의 코디를 가져와요</span>
          </div>
        </div>
        {closeBtn}
      </div>

      {/* 날짜(자체 달력으로 점프) + 인덱스 */}
      <div style={css('flex:0 0 auto; padding:14px 22px 0; display:flex; align-items:center; gap:10px;')}>
        <MiniCalendar value={inputDate} min={MIN_DATE} max={latestFetch} today={latestFetch} onPick={jumpToDate} width={stacked ? 150 : 168} />
        <span style={css('margin-left:auto; flex:0 0 auto; font-size:12px; color:#a89e93; font-variant-numeric:tabular-nums;')}>{curPage + 1} / {pageCount}</span>
      </div>

      {/* 캐러셀 뷰포트 — 현재±1 페이지만 마운트(가상화). 각 페이지는 절대배치 → translateX 슬라이드가 그대로 동작.
          overflow:hidden 이 가로 트랙을 자르는데, 세로 hover 리프트(translateY)가 잘리지 않게 페이지에 세로 패딩을 준다. */}
      <div ref={vpRef} onPointerDown={onVpDown}
        style={css(`flex:1 1 auto; min-height:0; margin-top:10px; overflow:hidden; position:relative; touch-action:${stacked ? 'pan-y' : 'none'}; cursor:${stacked ? 'grab' : 'default'}; user-select:none;`)}>
        <div style={css(`position:absolute; inset:0; will-change:transform; transform:${trackTx}; transition:${snapping ? 'transform .34s cubic-bezier(.22,.61,.36,1)' : 'none'};`)}>
          {winPages.map((p) => (
            <div key={p} style={css(`position:absolute; top:0; left:${p * 100}%; width:100%; height:100%; padding:6px 22px 8px;`)}>
              <div style={css(gridStyle)}>{sub.slice(p * perPage, p * perPage + perPage).map(dateCard)}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 가이드 — height 18px + padding-bottom 4px */}
      <div style={css('flex:0 0 auto; height:18px; padding-bottom:4px; display:flex; align-items:center; justify-content:center;')}>
        <span style={css('font-size:11px; color:#a89e93; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;')}>스크롤 · 스와이프 · ← → 방향키로 페이지를 넘길 수 있어요</span>
      </div>
    </div>
  )

  return (
    <div onClick={(e) => { if (e.target === e.currentTarget) close() }} className={clsx(closing ? 'pb-overlay-out' : 'pb-overlay')}
      style={css(`position:fixed; inset:0; z-index:60; background:rgba(42,37,33,0.42); display:flex; align-items:center; justify-content:center; padding:${stacked ? 14 : 32}px;`)}>
      <div onClick={(e) => e.stopPropagation()} className={clsx(closing ? 'pb-panel-out' : 'pb-panel')}
        style={css('width:100%; max-width:560px; height:min(620px, 88svh); background:#fff; border-radius:18px; display:flex; flex-direction:column; overflow:hidden;')}>
        <div className={anim} style={css('display:flex; flex-direction:column; min-height:0; flex:1 1 auto;')}>
          {view === 'preset' ? presetView : dateView}
        </div>
      </div>
    </div>
  )
}
