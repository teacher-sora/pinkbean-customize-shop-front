'use client'

// 코디 역분석 프로토타입 페이지(직접 URL /analyze — 네비 미노출).
//  흐름: 이미지 첨부 → 캐노니컬 실루엣(고스트)에 이동/확대/좌우반전으로 맞춤 → 분석 → 부위별 top-5.
//  미착용/투명 부위는 top-5 를 내지 않는다(matcher 의 억제 판정). 임계값은 하단에서 실시간 조정 가능.

import { useCallback, useEffect, useRef, useState } from 'react'
import { assemble, getFrameLayers, type AssembleInput } from '@/lib/core/assemble'
import { loadIndex, loadMeta, type Index } from '@/lib/core/data'
import { computeModelPlacement } from '@/lib/core/modelPlacement'
import { renderCharacter } from '@/lib/core/render'
import { THUMB_VIEW } from '@/lib/shopData'
import { analyze, CANON, DEFAULT_PARAMS, type Params, type SlotResult } from '@/lib/analyze/matcher'
import { css } from '@/lib/style'

const DISP = { w: 300, h: 400 } // 피팅 캔버스 표시 크기(캐노니컬과 같은 3:4 비율)
const K = CANON.w / DISP.w      // 표시→캐노니컬 축소율

type Xf = { scale: number; tx: number; ty: number; flip: boolean }

export default function AnalyzeClient() {
  const [index, setIndex] = useState<Index | null>(null)
  const [img, setImg] = useState<HTMLImageElement | null>(null)
  const [xf, setXf] = useState<Xf>({ scale: 1, tx: 0, ty: 0, flip: false })
  const [ghost, setGhost] = useState<HTMLCanvasElement | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [prog, setProg] = useState<{ label: string; done: number; total: number } | null>(null)
  const [results, setResults] = useState<SlotResult[] | null>(null)
  const [params, setParams] = useState<Params>(DEFAULT_PARAMS)
  const [showGhost, setShowGhost] = useState(true)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const xfRef = useRef(xf); xfRef.current = xf
  const imgRef = useRef(img); imgRef.current = img
  const abortRef = useRef<{ aborted: boolean }>({ aborted: false })

  // 인덱스 로드 + 캐노니컬 고스트(베이스 마네킹) 렌더 → 정렬 기준.
  useEffect(() => {
    let alive = true
    loadIndex().then(async (idx) => {
      if (!alive) return
      setIndex(idx)
      try {
        const tone = idx.base.tones.find((t) => t.tone === idx.base.default) || idx.base.tones[0]
        const [body, head] = await Promise.all([loadMeta(tone.body), loadMeta(tone.head)])
        const items: AssembleInput[] = [
          { itemId: body.id, slot: 'body', vslot: null, layers: getFrameLayers(body, THUMB_VIEW) },
          { itemId: head.id, slot: 'head', vslot: null, layers: getFrameLayers(head, THUMB_VIEW) },
        ]
        const { placed } = assemble(items, idx.zmap, idx.smap)
        const pl = computeModelPlacement({ divW: CANON.w, divH: CANON.h, dpr: 1, margin: 1, fraction: 0.9, snap: false })
        const c = document.createElement('canvas'); c.width = CANON.w; c.height = CANON.h
        await renderCharacter(c, placed, { scale: pl.scale, box: pl.box, anchor: pl.anchor, flip: false, cors: true })
        if (alive) setGhost(c)
      } catch { /* noop */ }
    }).catch(() => {})
    return () => { alive = false }
  }, [])

  // 이미지 레이어 그리기(고스트 제외 — 분석 캡처와 동일 변환).
  const drawImageLayer = useCallback((ctx: CanvasRenderingContext2D, k: number) => {
    const im = imgRef.current; if (!im) return
    const { scale, tx, ty, flip } = xfRef.current
    ctx.save()
    ctx.scale(k, k)
    if (flip) { ctx.translate(DISP.w, 0); ctx.scale(-1, 1) }
    ctx.translate(tx, ty)
    ctx.scale(scale, scale)
    ctx.imageSmoothingEnabled = true
    ctx.drawImage(im, 0, 0)
    ctx.restore()
  }, [])

  // 피팅 캔버스 재그리기(이미지 + 고스트 오버레이).
  const redraw = useCallback(() => {
    const canvas = canvasRef.current; if (!canvas) return
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, DISP.w, DISP.h)
    drawImageLayer(ctx, 1)
    if (showGhost && ghost) { ctx.save(); ctx.globalAlpha = 0.32; ctx.imageSmoothingEnabled = false; ctx.drawImage(ghost, 0, 0, DISP.w, DISP.h); ctx.restore() }
    // 프레임 테두리
    ctx.strokeStyle = 'rgba(236,134,172,0.6)'; ctx.lineWidth = 2; ctx.strokeRect(1, 1, DISP.w - 2, DISP.h - 2)
  }, [drawImageLayer, ghost, showGhost])

  useEffect(() => { redraw() }, [redraw, xf, img, ghost, showGhost])

  // ── 첨부 ──
  const onFile = (f: File | null | undefined) => {
    if (!f) return
    const url = URL.createObjectURL(f)
    const im = new Image()
    im.onload = () => {
      URL.revokeObjectURL(url)
      // 초기 배치: 이미지를 프레임에 맞춰 세로로 채우고 가운데.
      const s = Math.min(DISP.w / im.width, DISP.h / im.height)
      setImg(im)
      setXf({ scale: s, tx: (DISP.w - im.width * s) / 2, ty: (DISP.h - im.height * s) / 2, flip: false })
      setResults(null)
    }
    im.src = url
  }

  // ── 이동/확대/반전(마우스·터치) ──
  const pts = useRef(new Map<number, { x: number; y: number }>())
  const pinch = useRef(0)
  const rectOf = () => canvasRef.current!.getBoundingClientRect()
  const zoomAround = (dispX: number, factor: number) => setXf((p) => {
    const ux = p.flip ? DISP.w - dispX : dispX
    const ns = Math.max(0.05, Math.min(20, p.scale * factor))
    const f = ns / p.scale
    return { ...p, scale: ns, tx: ux - (ux - p.tx) * f }
  })
  const onDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId)
    const r = rectOf(); pts.current.set(e.pointerId, { x: e.clientX - r.left, y: e.clientY - r.top })
    if (pts.current.size === 2) { const [a, b] = [...pts.current.values()]; pinch.current = Math.hypot(a.x - b.x, a.y - b.y) }
  }
  const onMove = (e: React.PointerEvent) => {
    if (!pts.current.has(e.pointerId)) return
    const r = rectOf(); const cur = { x: e.clientX - r.left, y: e.clientY - r.top }
    const prev = pts.current.get(e.pointerId)!
    pts.current.set(e.pointerId, cur)
    if (pts.current.size >= 2) {
      const [a, b] = [...pts.current.values()]
      const d = Math.hypot(a.x - b.x, a.y - b.y)
      if (pinch.current > 0) zoomAround((a.x + b.x) / 2, d / pinch.current)
      pinch.current = d
      return
    }
    const dx = cur.x - prev.x, dy = cur.y - prev.y
    setXf((p) => ({ ...p, tx: p.tx + (p.flip ? -dx : dx), ty: p.ty + dy }))
  }
  const onUp = (e: React.PointerEvent) => { pts.current.delete(e.pointerId); if (pts.current.size < 2) pinch.current = 0 }
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return
    const onWheel = (e: WheelEvent) => { e.preventDefault(); const r = canvas.getBoundingClientRect(); zoomAround(e.clientX - r.left, e.deltaY < 0 ? 1.1 : 1 / 1.1) }
    canvas.addEventListener('wheel', onWheel, { passive: false })
    return () => canvas.removeEventListener('wheel', onWheel)
  }, [])

  // ── 분석 ──
  const runAnalyze = async () => {
    if (!index || !img || analyzing) return
    setAnalyzing(true); setResults(null); setProg({ label: '', done: 0, total: 0 })
    abortRef.current = { aborted: false }
    // 캐노니컬 쿼리 캔버스(고스트 제외).
    const q = document.createElement('canvas'); q.width = CANON.w; q.height = CANON.h
    const qctx = q.getContext('2d')!; qctx.fillStyle = '#fff'; qctx.fillRect(0, 0, CANON.w, CANON.h)
    drawImageLayer(qctx, K)
    try {
      const res = await analyze(q, index, {
        params, signal: abortRef.current,
        onProgress: (label, done, total) => setProg({ label, done, total }),
      })
      if (!abortRef.current.aborted) setResults(res)
    } catch { /* noop */ } finally { setAnalyzing(false); setProg(null) }
  }
  const cancel = () => { abortRef.current.aborted = true }

  // 임계값을 실시간 반영해 억제 재판정(재분석 없이). 상호배타 소거(excluded)는 임계값과 무관하게 항상 억제.
  const suppressedNow = (r: SlotResult) => r.excluded || r.coverage < params.covMin || (r.bestScore - r.baseScore) < params.baseMargin || r.bestScore < params.scoreMin
  const reasonNow = (r: SlotResult) =>
    r.excluded ? (r.excludeReason || '상호배타로 배제')
      : r.coverage < params.covMin ? `그 자리에 구조 거의 없음 (E ${r.coverage.toFixed(2)})`
        : (r.bestScore - r.baseScore) < params.baseMargin ? `바탕이 더/비슷하게 설명 (Δ ${(r.bestScore - r.baseScore).toFixed(2)})`
          : `확신 부족 (best ${r.bestScore.toFixed(2)})`

  const card = 'background:#fff; border:1px solid #eee6dc; border-radius:12px; padding:14px 16px;'

  return (
    <div style={css('height:100dvh; overflow-y:auto; background:#fbf4f8; padding:24px; display:flex; flex-direction:column; align-items:center; gap:18px;')}>
      <div style={css('width:100%; max-width:920px; display:flex; flex-direction:column; gap:6px;')}>
        <h1 style={css('margin:0; font-size:20px; font-weight:800; color:#2a2521;')}>코디 역분석 <span style={css('font-size:12px; font-weight:600; color:#ec86ac; background:#fce9f1; padding:2px 8px; border-radius:20px; vertical-align:middle;')}>프로토타입</span></h1>
        <p style={css('margin:0; font-size:13px; color:#8a8075; line-height:1.6;')}>이미지를 첨부하고, <b>캐릭터를 반투명 실루엣(고스트)에 최대한 맞춰</b> 주세요(드래그=이동 · 휠/핀치=확대 · 좌우반전 버튼). 서 있는·정면(또는 반전) 컷일수록 정확합니다. 맞춘 뒤 <b>분석</b>을 누르면 부위별 상위 5개를 추천합니다. 미착용·투명 부위는 표시하지 않습니다.</p>
      </div>

      <div style={css('width:100%; max-width:920px; display:flex; gap:20px; flex-wrap:wrap; align-items:flex-start;')}>
        {/* 좌: 피팅 */}
        <div style={css('display:flex; flex-direction:column; gap:10px; flex:0 0 auto;')}>
          <div style={css(`position:relative; width:${DISP.w}px; height:${DISP.h}px; border-radius:12px; overflow:hidden; background:#fff; box-shadow:0 2px 10px rgba(42,37,33,.08);`)}>
            <canvas ref={canvasRef} width={DISP.w} height={DISP.h}
              onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
              style={{ display: 'block', width: DISP.w, height: DISP.h, cursor: img ? 'grab' : 'default', touchAction: 'none' }} />
            {!img && (
              <label style={css('position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:8px; cursor:pointer; color:#b7ada2; font-size:13px;')}>
                <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#d8b7c7" strokeWidth="1.6"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 15l5-5 4 4 3-3 6 6" /><circle cx="8.5" cy="8.5" r="1.5" /></svg>
                이미지 첨부(클릭 또는 드래그)
                <input type="file" accept="image/*" onChange={(e) => onFile(e.target.files?.[0])} style={{ display: 'none' }} />
              </label>
            )}
          </div>
          <div style={css('display:flex; gap:8px; flex-wrap:wrap;')}>
            <label style={css('height:34px; padding:0 12px; display:flex; align-items:center; border:1px solid #e7ded4; border-radius:8px; background:#faf7f3; font-size:12px; font-weight:600; color:#8a8075; cursor:pointer;')}>
              이미지 교체<input type="file" accept="image/*" onChange={(e) => onFile(e.target.files?.[0])} style={{ display: 'none' }} />
            </label>
            <button onClick={() => setXf((p) => ({ ...p, flip: !p.flip }))} disabled={!img} style={btn(!!img)}>좌우반전</button>
            <button onClick={() => setShowGhost((v) => !v)} style={btn(true)}>{showGhost ? '고스트 숨김' : '고스트 표시'}</button>
          </div>
          {!analyzing ? (
            <button onClick={runAnalyze} disabled={!img || !index} style={css(`height:44px; border:none; border-radius:10px; background:${img && index ? '#ec86ac' : '#f0c9da'}; color:#fff; font-family:inherit; font-size:15px; font-weight:700; cursor:${img && index ? 'pointer' : 'default'};`)}>분석</button>
          ) : (
            <div style={css('display:flex; flex-direction:column; gap:6px;')}>
              <div style={css('height:8px; border-radius:6px; background:#f0e4ea; overflow:hidden;')}>
                <div style={css(`height:100%; background:#ec86ac; width:${prog && prog.total ? Math.round((prog.done / prog.total) * 100) : 5}%; transition:width .2s ease;`)} />
              </div>
              <div style={css('display:flex; justify-content:space-between; align-items:center;')}>
                <span style={css('font-size:12px; color:#8a8075;')}>분석 중 · {prog?.label} {prog?.total ? `(${prog.done}/${prog.total})` : ''}</span>
                <button onClick={cancel} style={css('font-size:12px; color:#d76d9a; background:none; border:none; cursor:pointer; text-decoration:underline;')}>취소</button>
              </div>
              <span style={css('font-size:11px; color:#b7ada2; line-height:1.5;')}>첫 분석은 카탈로그 스프라이트를 받아오느라 느릴 수 있어요(이후 캐시).</span>
            </div>
          )}
        </div>

        {/* 우: 결과 */}
        <div style={css('flex:1 1 340px; min-width:280px; display:flex; flex-direction:column; gap:12px;')}>
          {!results ? (
            <div style={css(card + ' color:#b7ada2; font-size:13px; text-align:center; padding:40px 16px;')}>맞춘 뒤 <b style={css('color:#8a8075;')}>분석</b>을 누르면 여기에 부위별 추천이 나옵니다.</div>
          ) : (
            results.map((r) => {
              const sup = suppressedNow(r)
              return (
                <div key={r.slot} style={css(card)}>
                  <div style={css('display:flex; align-items:center; justify-content:space-between; margin-bottom:8px;')}>
                    <span style={css('font-size:13px; font-weight:700; color:#2a2521;')}>{r.label}</span>
                    <span style={css('font-size:10.5px; color:#c3b9ad; font-variant-numeric:tabular-nums;')}>best {r.bestScore.toFixed(2)} · Δ {(r.bestScore - r.baseScore).toFixed(2)} · E {r.coverage.toFixed(2)}</span>
                  </div>
                  {sup ? (
                    <div style={css('font-size:12px; color:#b7ada2; background:#faf7f3; border-radius:8px; padding:8px 10px;')}>미착용/투명 추정 — <span style={css('color:#a89e93;')}>{reasonNow(r)}</span></div>
                  ) : (
                    <div style={css('display:flex; gap:8px; flex-wrap:wrap;')}>
                      {r.top.map((c, i) => (
                        <div key={c.id} title={`${c.name} · ${c.score.toFixed(3)}`} style={css('width:64px; display:flex; flex-direction:column; align-items:center; gap:3px;')}>
                          <div style={css(`position:relative; width:64px; height:64px; border-radius:8px; background:#f7f2ec; border:1px solid ${i === 0 ? '#ec86ac' : '#eee6dc'}; display:flex; align-items:center; justify-content:center; overflow:hidden;`)}>
                            <img src={c.icon} alt={c.name} draggable={false} onError={(e) => { (e.currentTarget.style.display = 'none') }} style={{ maxWidth: '100%', maxHeight: '100%', imageRendering: 'pixelated' }} />
                            <span style={css('position:absolute; top:2px; left:2px; font-size:9px; font-weight:700; color:#fff; background:rgba(42,37,33,.5); border-radius:4px; padding:0 3px;')}>{i + 1}</span>
                          </div>
                          <span style={css('width:64px; font-size:10px; color:#8a8075; text-align:center; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;')}>{c.name}</span>
                          <span style={css('font-size:9px; color:#c3b9ad; font-variant-numeric:tabular-nums;')}>{c.score.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* 임계값 튜닝(실시간 억제 재판정) */}
      <div style={css('width:100%; max-width:920px; ' + card)}>
        <div style={css('font-size:12px; font-weight:700; color:#2a2521; margin-bottom:10px;')}>억제 임계값(실시간)</div>
        <div style={css('display:flex; gap:20px; flex-wrap:wrap;')}>
          {slider('구조 에너지비(E) 최소', params.covMin, 0, 1, 0.01, (v) => setParams((p) => ({ ...p, covMin: v })))}
          {slider('개선량 Δ 최소', params.baseMargin, -0.1, 0.3, 0.005, (v) => setParams((p) => ({ ...p, baseMargin: v })))}
          {slider('상관(best) 최소', params.scoreMin, 0, 1, 0.01, (v) => setParams((p) => ({ ...p, scoreMin: v })))}
        </div>
        <p style={css('margin:10px 0 0; font-size:11px; color:#b7ada2; line-height:1.6;')}>E=쿼리가 그 자리에 아이템만큼의 에지(구조)를 가졌나 · Δ=아이템이 &quot;미착용 바탕&quot;보다 얼마나 더 잘 맞나(개선량) · best=방향 벡터장 정규화 상관. 값을 올리면 더 엄격히 억제합니다. (재분석 없이 즉시 반영 · 한벌옷↔상·하의 상호배타 소거는 별도)</p>
      </div>
    </div>
  )
}

function btn(on: boolean) { return css(`height:34px; padding:0 12px; border:1px solid #e7ded4; border-radius:8px; background:#faf7f3; font-family:inherit; font-size:12px; font-weight:600; color:${on ? '#8a8075' : '#c3b9ad'}; cursor:${on ? 'pointer' : 'default'};`) }

function slider(label: string, val: number, min: number, max: number, step: number, on: (v: number) => void) {
  return (
    <label key={label} style={css('display:flex; flex-direction:column; gap:4px; min-width:180px; flex:1 1 180px;')}>
      <span style={css('font-size:11px; font-weight:600; color:#8a8075; display:flex; justify-content:space-between;')}>{label}<b style={css('color:#d76d9a; font-variant-numeric:tabular-nums;')}>{val.toFixed(3)}</b></span>
      <input type="range" min={min} max={max} step={step} value={val} onChange={(e) => on(parseFloat(e.target.value))} style={{ width: '100%', accentColor: '#ec86ac' }} />
    </label>
  )
}
