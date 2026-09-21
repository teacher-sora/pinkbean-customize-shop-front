'use client'

/*
 * 점 위치 편집 캔버스 로직(재활용 — 기존 DotDialog 의 캔버스·상호작용을 그대로 분리).
 *  - 얼굴(머리+성형) bbox 기준으로 "항상 같은 배율"에 fit → 얼굴 전체가 중앙. 몸통·머리카락 등 전부 그린다(잘려도 됨).
 *  - 편집: 캔버스를 클릭/드래그하면 "현재 선택한 점"이 그 자리(정수 px)로 이동. 방향키 1px 미세조정.
 *  - 확대: 마우스 휠(커서 기준 줌인/아웃) · 모바일 두 손가락 핀치(중심 기준).
 *  - '이동' 툴: 확대된 화면을 드래그로 패닝 / 어떤 점에도 확인용 원을 두고 싶지 않을 때.
 *  - 열려 있는 동안엔 앱의 다른 키보드 단축키(리스트 ←/→ 페이지 등)를 캡처 단계에서 차단, 닫으면 복구.
 * 달라진 점: 캔버스 크기(box)를 고정 상수 대신 v2 캔버스 영역의 측정값으로 받는다.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { assemble, getFrameLayers, type AssembleInput } from '@/lib/core/assemble'
import { loadMeta, type ItemMeta, type ListItem, type Vec } from '@/lib/core/data'
import { applyHsb, buildOverrides, skinHsb as skinHsbFor, type HsbParams } from '@/lib/core/dye'
import { loadImage, renderCharacter } from '@/lib/core/render'
import { clampDye } from '@/lib/color'
import { skinDyeFamily, THUMB_VIEW } from '@/lib/shopData'
import { useShop } from '../ShopContext'

const PAD = 8                 // 얼굴 bbox 여백(월드 px)
const CLAMP = 60              // 점 오프셋 소프트 클램프(월드 px)
export const ZMIN = 1, ZMAX = 5
const DOT_RE = /^accessoryEye\d*$/

const clampV = (v: Vec): Vec => ({ x: Math.max(-CLAMP, Math.min(CLAMP, Math.round(v.x))), y: Math.max(-CLAMP, Math.min(CLAMP, Math.round(v.y))) })
const clampZ = (z: number) => Math.max(ZMIN, Math.min(ZMAX, z))
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y)
// 뷰 중심(focus)을 얼굴 범위 안으로 가둔다. 뷰가 얼굴보다 크면(축소) 이동 여유=0 → 무조건 정중앙(초기 위치).
function clampFocus(f: Vec, scale: number, fb: { cx: number; cy: number; w: number; h: number }, devW: number, devH: number): Vec {
  const mx = Math.max(0, (fb.w / 2 + PAD) - (devW / scale) / 2)
  const my = Math.max(0, (fb.h / 2 + PAD) - (devH / scale) / 2)
  return { x: Math.min(fb.cx + mx, Math.max(fb.cx - mx, f.x)), y: Math.min(fb.cy + my, Math.max(fb.cy - my, f.y)) }
}

type Box = { cx: number; cy: number; w: number; h: number }
type Parts = {
  items: AssembleInput[]; eyeIdx: number; slot: string; itemMeta: ItemMeta
  dotNames: string[]; dotSizes: Record<string, { w: number; h: number }>; baseXY: Record<string, Vec>
  faceBox: Box
  // 전체 염색 재현용: 착용 아이템 메타(헤어/성형/눈장식 등) + 피부(컬러라인) 염색 대상 body/head + 톤 이름.
  dyeMetas: ItemMeta[]; bodyMeta: ItemMeta; headMeta: ItemMeta; toneName?: string
}
export type DotTool = 'move' | number

// off = 이 서피스에서 '염색 비활성화'를 켠 상태(편집 중 수치는 유지, 미리보기에서만 뺀다).
export function useDotEditor(item: ListItem | null, box: { w: number; h: number }, off = false) {
  const s = useShop()

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [parts, setParts] = useState<Parts | null>(null)
  const [local, setLocal] = useState<Record<string, Vec>>({})
  const [hsb, setHsb] = useState<HsbParams>({ h: 0, s: 0, b: 0, t: 0 })
  const [raw, setRaw] = useState<{ h: string; s: string; b: string }>({ h: '0', s: '0', b: '0' })
  const [tool, setTool] = useState<DotTool>(0)
  const [zoom, setZoom] = useState(1)
  const [focus, setFocus] = useState<Vec>({ x: 0, y: 0 })
  const [activeHandle, setActiveHandle] = useState<{ cx: number; cy: number } | null>(null)

  const drawSeq = useRef(0)
  const viewRef = useRef<{ scale: number; anchorX: number; anchorY: number; dpr: number }>({ scale: 1, anchorX: 0, anchorY: 0, dpr: 1 })
  // 휠/핀치/키보드(캡처 리스너)에서 최신값을 읽기 위한 미러 ref.
  const rt = useRef<{ zoom: number; focus: Vec; fit: number; scale: number; dpr: number; devW: number; devH: number; tool: DotTool; parts: Parts | null }>({ zoom: 1, focus: { x: 0, y: 0 }, fit: 1, scale: 1, dpr: 1, devW: 0, devH: 0, tool: 0, parts: null })
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const modeRef = useRef<'dot' | 'pan' | 'pinch' | null>(null)
  const panRef = useRef<{ fx: number; fy: number; px: number; py: number }>({ fx: 0, fy: 0, px: 0, py: 0 })
  const pinchRef = useRef<{ lastDist: number }>({ lastDist: 0 })
  const hsbRef = useRef(hsb)
  hsbRef.current = hsb

  // 오픈 중: ESC 닫기 + 방향키 미세조정 + 그 외 앱 단축키(리스트 ←/→ 페이지 등) 캡처 차단.
  useEffect(() => {
    if (!item) return
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      const inInput = !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')
      if (e.key === 'Escape') { e.stopImmediatePropagation(); s.closeSurface(); return }
      if (inInput) return // 염색 숫자 입력창에선 통과
      const st = rt.current
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault(); e.stopImmediatePropagation()
        if (typeof st.tool === 'number' && st.parts) {
          const nm = st.parts.dotNames[st.tool]
          if (nm) {
            const dx = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0
            const dy = e.key === 'ArrowUp' ? -1 : e.key === 'ArrowDown' ? 1 : 0
            setLocal((prev) => ({ ...prev, [nm]: clampV({ x: (prev[nm]?.x || 0) + dx, y: (prev[nm]?.y || 0) + dy }) }))
          }
        }
        return
      }
      // 그 외 키는 편집기가 독점 → 앱 단축키 발동 차단(닫으면 리스너 제거되어 복구).
      e.stopImmediatePropagation()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item])

  // 아이템 로드 → 전체 착용(몸통·머리·머리카락·눈장식 등) 합성 입력 + 얼굴 bbox·점 기본좌표/크기 + 현재 염색/오프셋으로 초기화.
  useEffect(() => {
    const idx = s.index
    if (!item || !idx) { setParts(null); return }
    let alive = true
    ;(async () => {
      const te = idx.base.tones.find((t) => t.tone === s.tone) || idx.base.tones.find((t) => t.tone === idx.base.default) || idx.base.tones[0]
      const eqEntries = Object.entries(s.equipped).filter(([sl, it]) => it && !s.hidden[sl] && sl !== 'riding') as [string, ListItem][]
      const [body, head, ...eqMetas] = await Promise.all([
        loadMeta(te.body), loadMeta(te.head),
        ...eqEntries.map(([, it]) => loadMeta(it.id).catch(() => null)),
      ])
      if (!alive) return
      const items: AssembleInput[] = [
        { itemId: body.id, slot: 'body', vslot: null, layers: getFrameLayers(body, THUMB_VIEW) },
        { itemId: head.id, slot: 'head', vslot: null, layers: getFrameLayers(head, THUMB_VIEW) },
      ]
      let eyeIdx = -1
      let itemMeta: ItemMeta | null = null
      const dyeMetas: ItemMeta[] = [] // 착용 아이템 메타(염색 재현용: 헤어/성형/눈장식 등)
      eqEntries.forEach(([sl, it], k) => {
        const m = eqMetas[k]; if (!m) return
        if (it.id === item.id) { eyeIdx = items.length; itemMeta = m }
        items.push({ itemId: m.id, slot: sl, vslot: m.vslot ?? null, layers: getFrameLayers(m, THUMB_VIEW), invisibleFace: m.invisibleFace, name: m.name })
        dyeMetas.push(m)
      })
      if (eyeIdx < 0) { // 편집 아이템이 착용 목록에 없으면(카드에서 바로 연 경우) 직접 추가
        const m = await loadMeta(item.id); if (!alive) return
        // 같은 슬롯의 다른 착용품은 빼고 이 아이템으로 대체해 보여준다.
        for (let i = items.length - 1; i >= 2; i--) if (items[i].slot === m.slot) { items.splice(i, 1); const di = dyeMetas.findIndex((d) => d.slot === m.slot); if (di >= 0) dyeMetas.splice(di, 1) }
        eyeIdx = items.length; itemMeta = m
        items.push({ itemId: m.id, slot: m.slot, vslot: m.vslot ?? null, layers: getFrameLayers(m, THUMB_VIEW), invisibleFace: m.invisibleFace, name: m.name })
        dyeMetas.push(m)
      }
      const itemLayers = items[eyeIdx].layers
      const dotNames = itemLayers.filter((l) => DOT_RE.test(l.name)).map((l) => l.name)

      // 오프셋 0 기준 배치 → 얼굴(머리+성형) bbox + 점 기본좌표. 크기는 이미지 실측.
      const { placed } = assemble(items, idx.zmap, idx.smap)
      const facePlaced = placed.filter((p) => p.slot === 'head' || p.slot === 'face')
      const dotPlaced = placed.filter((p) => DOT_RE.test(p.name) && p.slot === item.slot)
      const needPng = [...new Set([...facePlaced, ...dotPlaced].map((p) => p.png))]
      const sizeByPng: Record<string, { w: number; h: number }> = {}
      await Promise.all(needPng.map(async (png) => {
        try { const img = await loadImage(png); sizeByPng[png] = { w: img.width, h: img.height } } catch { sizeByPng[png] = { w: 0, h: 0 } }
      }))
      if (!alive) return
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
      for (const p of facePlaced) {
        const sz = sizeByPng[p.png] || { w: 0, h: 0 }
        minX = Math.min(minX, p.x); minY = Math.min(minY, p.y); maxX = Math.max(maxX, p.x + sz.w); maxY = Math.max(maxY, p.y + sz.h)
      }
      const faceBox: Box = Number.isFinite(minX) ? { cx: (minX + maxX) / 2, cy: (minY + maxY) / 2, w: maxX - minX, h: maxY - minY } : { cx: 0, cy: 0, w: 40, h: 40 }
      const baseXY: Record<string, Vec> = {}
      const dotSizes: Record<string, { w: number; h: number }> = {}
      for (const nm of dotNames) {
        const p = placed.find((x) => x.name === nm && x.slot === item.slot)
        const l = itemLayers.find((x) => x.name === nm)
        if (p) baseXY[nm] = { x: p.x, y: p.y } // 오프셋 0 으로 배치한 값 = 기본좌표
        if (l) dotSizes[nm] = sizeByPng[l.png] || { w: 0, h: 0 }
      }
      setParts({ items, eyeIdx, slot: item.slot, itemMeta: itemMeta!, dotNames, dotSizes, baseXY, faceBox, dyeMetas, bodyMeta: body, headMeta: head, toneName: te.name })
      setLocal({ ...(s.dotPos[item.id] || {}) })
      const curHsb = s.dyeHsb[item.slot] ?? { h: 0, s: 0, b: 0, t: 0 }
      setHsb(curHsb); setRaw({ h: String(curHsb.h), s: String(curHsb.s), b: String(curHsb.b) })
      setTool(0); setZoom(1); setFocus({ x: faceBox.cx, y: faceBox.cy })
    })().catch(() => {})
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.id, s.index, s.tone])

  // 염색 오버라이드 — 두 갈래로 분리해 "눈장식 염색 슬라이더 드래그"가 헤어/성형까지 매 틱 리컬러하지 않게 한다.
  //  baseOv: 편집 슬롯을 제외한 착용 아이템(헤어/성형 등) + 피부(컬러라인) — 커밋된 염색 기준.
  //  eyeOv : 편집 중인 눈장식 하나 — 라이브 hsb. 작은 스프라이트라 매 틱 리컬러해도 가볍다.
  const [baseOv, setBaseOv] = useState<Map<string, HTMLCanvasElement>>(() => new Map())
  const [eyeOv, setEyeOv] = useState<Map<string, HTMLCanvasElement>>(() => new Map())
  useEffect(() => {
    if (!parts) { setBaseOv(new Map()); return }
    let alive = true
    const others = parts.dyeMetas.filter((m) => m.id !== parts.itemMeta.id) // 편집 아이템 제외(그건 eyeOv 가 담당)
    const skinHsb = s.renderHsb['skin']
    const skinFam = skinDyeFamily(parts.toneName)
    const skinDye = !!skinHsb && (skinHsb.h !== 0 || skinHsb.s !== 0 || skinHsb.b !== 0) && skinFam != null
    ;(async () => {
      try {
        const ov = await buildOverrides(others, { palette: s.renderPalette, hsb: s.renderHsb }, THUMB_VIEW)
        if (skinDye) { // body+head 프레임 png 를 HSB 로 리컬러(피부는 무채색이라 라인만 변한다)
          const pngs: string[] = []; const seen = new Set<string>()
          for (const meta of [parts.bodyMeta, parts.headMeta]) {
            for (const l of getFrameLayers(meta, THUMB_VIEW)) { if (!seen.has(l.png)) { seen.add(l.png); pngs.push(l.png) } }
          }
          const loaded = await Promise.all(pngs.map((p) => loadImage(p, true).then((img) => [p, img] as const).catch(() => null)))
          for (const e of loaded) { if (e) { try { ov.set(e[0], applyHsb(e[1], skinHsbFor(skinHsb!, skinFam!), e[0])) } catch { /* noop */ } } }
        }
        if (alive) setBaseOv(ov)
      } catch { /* noop */ }
    })()
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parts, s.renderHsb, s.renderPalette, s.index])

  useEffect(() => {
    if (!parts) { setEyeOv(new Map()); return }
    if (off || (hsb.h === 0 && hsb.s === 0 && hsb.b === 0)) { setEyeOv(new Map()); return } // 무염색·비활성화면 오버라이드 불필요
    let alive = true
    ;(async () => {
      try { const ov = await buildOverrides([parts.itemMeta], { palette: {}, hsb: { [parts.slot]: hsb } }, THUMB_VIEW); if (alive) setEyeOv(ov) }
      catch { /* noop */ }
    })()
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parts, hsb, off])

  const dyeOv = useMemo(() => { const m = new Map(baseOv); for (const [k, v] of eyeOv) m.set(k, v); return m }, [baseOv, eyeOv])

  // 캔버스 재합성(점 오프셋 반영) + 배율/패닝(focus) 반영 + 선택 점 링 위치. 배율 = fit(얼굴 기준, 불변) × zoom.
  useEffect(() => {
    const canvas = canvasRef.current; const idx = s.index
    if (!canvas || !parts || !idx || !box.w || !box.h) return
    const dpr = window.devicePixelRatio || 1
    const items = parts.items.map((it, i) => (i === parts.eyeIdx ? { ...it, dotOffsets: local } : it))
    const { placed } = assemble(items, idx.zmap, idx.smap)
    const devW = box.w * dpr, devH = box.h * dpr
    const fit = Math.min(devW / (parts.faceBox.w + PAD * 2), devH / (parts.faceBox.h + PAD * 2))
    // ⚠️ 정수 배율 스냅 — 점(1px 스프라이트)이 확대에도 정확히 격자에 떨어져 픽셀 사이 틈/단차가 안 생긴다(인게임과 동일).
    const scale = Math.max(1, Math.round(fit * zoom))
    const cf = clampFocus(focus, scale, parts.faceBox, devW, devH) // 얼굴 밖으로 못 나가게 + 최소배율=정중앙
    if (cf.x !== focus.x || cf.y !== focus.y) setFocus(cf)
    const worldBox = { w: devW / scale, h: devH / scale }
    const anchorX = worldBox.w / 2 - cf.x
    const anchorY = worldBox.h / 2 - cf.y
    // 표시 크기 = 비트맵 ÷ dpr(화면 픽셀 1:1). box 를 그대로 쓰면 비트맵 반올림과 어긋나 도트가 미세하게 뭉갠다.
    const bw = Math.round(worldBox.w * scale), bh = Math.round(worldBox.h * scale)
    canvas.style.width = bw / dpr + 'px'; canvas.style.height = bh / dpr + 'px'
    viewRef.current = { scale, anchorX, anchorY, dpr }
    rt.current = { zoom, focus: cf, fit, scale, dpr, devW, devH, tool, parts }
    const seq = ++drawSeq.current
    ;(async () => {
      if (seq !== drawSeq.current) return
      await renderCharacter(canvas, placed, { scale, box: worldBox, anchor: { x: anchorX, y: anchorY }, flip: false, override: dyeOv, shouldCancel: () => seq !== drawSeq.current }).catch(() => {})
    })()
    if (typeof tool === 'number') {
      const nm = parts.dotNames[tool]
      if (nm && parts.baseXY[nm]) {
        const off = local[nm] || { x: 0, y: 0 }; const sz = parts.dotSizes[nm] || { w: 0, h: 0 }
        setActiveHandle({ cx: (anchorX + parts.baseXY[nm].x + off.x + sz.w / 2) * scale / dpr, cy: (anchorY + parts.baseXY[nm].y + off.y + sz.h / 2) * scale / dpr })
      } else setActiveHandle(null)
    } else setActiveHandle(null)
  }, [parts, local, dyeOv, zoom, focus, tool, box.w, box.h, s.index])

  // 마우스 휠 = 커서 기준 줌(캔버스 위에서만).
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return
    const onWheel = (e: WheelEvent) => {
      const st = rt.current; if (!st.parts) return
      e.preventDefault()
      const rect = canvas.getBoundingClientRect()
      const cx = (e.clientX - rect.left) * st.dpr, cy = (e.clientY - rect.top) * st.dpr
      const nz = clampZ(st.zoom * (e.deltaY < 0 ? 1.2 : 1 / 1.2))
      const s0 = st.scale, s1 = Math.max(1, Math.round(st.fit * nz)) // 둘 다 정수(스냅)
      const wcX = (cx - st.devW / 2) / s0 + st.focus.x
      const wcY = (cy - st.devH / 2) / s0 + st.focus.y
      const nf = clampFocus({ x: wcX + (st.devW / 2 - cx) / s1, y: wcY + (st.devH / 2 - cy) / s1 }, s1, st.parts.faceBox, st.devW, st.devH)
      setZoom(nz); setFocus(nf)
    }
    canvas.addEventListener('wheel', onWheel, { passive: false })
    return () => canvas.removeEventListener('wheel', onWheel)
  }, [parts])

  // 커서(화면 px) → 월드 좌표.
  const toWorld = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current!; const v = viewRef.current; const rect = canvas.getBoundingClientRect()
    return { x: ((clientX - rect.left) * v.dpr) / v.scale - v.anchorX, y: ((clientY - rect.top) * v.dpr) / v.scale - v.anchorY }
  }
  // 선택된 점을 커서 위치(정수 px)로 이동.
  const placeAt = (clientX: number, clientY: number) => {
    if (!parts || typeof tool !== 'number') return
    const nm = parts.dotNames[tool]; if (!nm) return
    const w = toWorld(clientX, clientY); const sz = parts.dotSizes[nm] || { w: 0, h: 0 }
    setLocal((prev) => ({ ...prev, [nm]: clampV({ x: w.x - parts.baseXY[nm].x - sz.w / 2, y: w.y - parts.baseXY[nm].y - sz.h / 2 }) }))
  }
  // 두 손가락 핀치 → 중심 기준 줌.
  const applyPinch = () => {
    const pts = [...pointers.current.values()]; if (pts.length < 2) return
    const st = rt.current; const canvas = canvasRef.current; if (!canvas || !st.parts) return
    const fb = st.parts.faceBox
    const d = dist(pts[0], pts[1]); const last = pinchRef.current.lastDist || d
    pinchRef.current.lastDist = d
    const nz = clampZ(st.zoom * (d / last))
    const rect = canvas.getBoundingClientRect()
    const mx = ((pts[0].x + pts[1].x) / 2 - rect.left) * st.dpr, my = ((pts[0].y + pts[1].y) / 2 - rect.top) * st.dpr
    const s0 = st.scale, s1 = Math.max(1, Math.round(st.fit * nz))
    const wcX = (mx - st.devW / 2) / s0 + st.focus.x, wcY = (my - st.devH / 2) / s0 + st.focus.y
    const nf = clampFocus({ x: wcX + (st.devW / 2 - mx) / s1, y: wcY + (st.devH / 2 - my) / s1 }, s1, fb, st.devW, st.devH)
    setZoom(nz); setFocus(nf)
  }
  const onDown = (e: React.PointerEvent) => {
    e.preventDefault()
    try { (e.target as HTMLElement).setPointerCapture(e.pointerId) } catch { /* noop */ }
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointers.current.size >= 2) { modeRef.current = 'pinch'; pinchRef.current.lastDist = 0; return }
    if (tool === 'move') { modeRef.current = 'pan'; panRef.current = { fx: rt.current.focus.x, fy: rt.current.focus.y, px: e.clientX, py: e.clientY } }
    else { modeRef.current = 'dot'; placeAt(e.clientX, e.clientY) }
  }
  const onMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (modeRef.current === 'pinch') { applyPinch(); return }
    if (modeRef.current === 'pan') {
      const st = rt.current; const p = panRef.current
      const nf = { x: p.fx - (e.clientX - p.px) * st.dpr / st.scale, y: p.fy - (e.clientY - p.py) * st.dpr / st.scale }
      setFocus(st.parts ? clampFocus(nf, st.scale, st.parts.faceBox, st.devW, st.devH) : nf)
      return
    }
    if (modeRef.current === 'dot') placeAt(e.clientX, e.clientY)
  }
  const onUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId)
    try { (e.target as HTMLElement).releasePointerCapture(e.pointerId) } catch { /* noop */ }
    if (pointers.current.size < 2) pinchRef.current.lastDist = 0
    if (pointers.current.size === 0) modeRef.current = null
  }

  // 염색 입력(빈값=0).
  const setField = (f: 'h' | 's' | 'b', val: string) => {
    if (!/^-?\d*$/.test(val)) return
    setRaw((r) => ({ ...r, [f]: val }))
    const n = val === '' || val === '-' ? 0 : clampDye(f, parseInt(val, 10))
    setHsb((h) => ({ ...h, [f]: n }))
  }
  // +/− 1 단위 미세조정. 반복 입력이 stale 하지 않도록 hsbRef 로 최신값을 읽어 누적.
  const bump = (f: 'h' | 's' | 'b', d: number) => {
    const v = clampDye(f, (hsbRef.current[f] ?? 0) + d)
    hsbRef.current = { ...hsbRef.current, [f]: v }
    setHsb((h) => ({ ...h, [f]: v }))
    setRaw((r) => ({ ...r, [f]: String(v) }))
  }
  const resetHsb = () => { setHsb((h) => ({ h: 0, s: 0, b: 0, t: h.t ?? 0 })); setRaw({ h: '0', s: '0', b: '0' }) }
  const setFamily = (t: number) => setHsb((h) => ({ ...h, t }))

  return {
    canvasRef, parts, local, setLocal, hsb, raw, setField, bump, resetHsb, setFamily,
    tool, setTool, zoom, activeHandle, onDown, onMove, onUp,
    dotCount: parts?.dotNames.length ?? 1,
  }
}
