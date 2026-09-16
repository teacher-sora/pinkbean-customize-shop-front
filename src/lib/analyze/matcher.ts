// 코디 역분석 프로토타입 — analysis-by-synthesis 매처 (v2).
//  · 우리는 "정답"을 그대로 렌더할 수 있다(닫힌 카탈로그 + 자체 렌더러). 그래서 각 슬롯의 후보를
//    캐노니컬 프레임에 렌더 → 쿼리(사용자가 실루엣에 맞춘 이미지)와 형태로 비교해 top-k.
//  · 지표 = "에지 방향(orientation) 벡터장의 정규화 상관(NCC)" — OpenCV matchTemplate 의 CCOEFF_NORMED
//    와 같은 계열. 방향(부호무시)이라 발색·밝기역전(염색)에 강하고, 크기만 보던 v1 보다 형태 변별력이 크다.
//  · 국소 정렬 탐색(±R px): 사용자의 수동 맞춤 오차를 흡수(마스크별 최적 오프셋에서 점수).
//  · 미착용/투명 억제(관건) = "바탕(under-base)이 그 자리를 아이템만큼/더 잘 설명하는가"(개선량 Δ)로 판정.
//    후보를 혼자 비교하지 않고, 그 자리에서 바탕과의 상관을 빼므로 주변 정보 섞임이 상쇄된다.
//    미착용이면 쿼리엔 바탕(맨살/헤어)만 있어 Δ≈0 이하 → 자동 억제. 작은 장신구 허점(v1)도 사라진다.
'use client'

import { assemble, getFrameLayers, type AssembleInput, type PlacedLayer } from '@/lib/core/assemble'
import { loadMeta, loadSlot, spriteUrl, type Index, type ListItem } from '@/lib/core/data'
import { computeModelPlacement } from '@/lib/core/modelPlacement'
import { renderCharacter } from '@/lib/core/render'
import { CATS } from '@/lib/catalog'
import { CAT_TO_SLOT, THUMB_VIEW } from '@/lib/shopData'

// 캐노니컬 비교 프레임(디바이스 px). 작게 잡아 픽셀 루프를 빠르게 — 형태 매칭엔 이 해상도면 충분.
export const CANON = { w: 96, h: 128 }
const W = CANON.w, H = CANON.h
const PLACEMENT = computeModelPlacement({ divW: W, divH: H, dpr: 1, margin: 1, fraction: 0.9, snap: false })
const R = 3 // 국소 정렬 탐색 반경(px). 사용자 수동 맞춤 오차 흡수.

export interface Params {
  covMin: number      // 구조 에너지비(쿼리가 그 자리에 아이템만큼의 에지를 가졌나) 최소. 미만이면 = 아무것도 없음 → 억제
  baseMargin: number  // 개선량 Δ(=아이템 상관 − 바탕 상관) 최소. 못 넘으면 바탕이 더/비슷하게 설명 → 억제
  scoreMin: number    // 아이템 상관(NCC) 최소. 미만이면 확신 부족 → 억제
}
export const DEFAULT_PARAMS: Params = { covMin: 0.22, baseMargin: 0.02, scoreMin: 0.30 }

export interface Cand { id: string; name: string; icon: string; score: number }
export interface SlotResult {
  slot: string; label: string; suppressed: boolean; reason: string
  excluded?: boolean; excludeReason?: string  // 상호배타 소거(한벌옷↔상·하의) — 게이트와 별개
  bestScore: number; baseScore: number; coverage: number  // coverage 는 구조 에너지비를 담는다
  top: Cand[]
}

const iconOf = (it: ListItem) => spriteUrl(it.icon || `sprites/${it.id}/icon.png`)

// ── 픽셀 유틸 ────────────────────────────────────────────────────────────
interface Field { ox: Float32Array; oy: Float32Array; mag2: Float32Array; alpha: Uint8Array }

// 그레이 → Sobel 그래디언트 → "방향(orientation) 벡터장"(더블앵글: θ→2θ 로 부호 무시).
//  ox=(gx²−gy²)/m, oy=2·gx·gy/m 라 |o|=m(=그래디언트 크기). 부호무시 = 밝기 역전(발색)에 강함.
function field(data: Uint8ClampedArray): Field {
  const n = W * H
  const gray = new Float32Array(n)
  const alpha = new Uint8Array(n)
  for (let i = 0; i < n; i++) {
    const a = data[i * 4 + 3]; alpha[i] = a
    gray[i] = a === 0 ? 0 : (0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2]) / 255
  }
  const ox = new Float32Array(n), oy = new Float32Array(n), mag2 = new Float32Array(n)
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      const i = y * W + x
      const gx = (gray[i - W + 1] + 2 * gray[i + 1] + gray[i + W + 1]) - (gray[i - W - 1] + 2 * gray[i - 1] + gray[i + W - 1])
      const gy = (gray[i + W - 1] + 2 * gray[i + W] + gray[i + W + 1]) - (gray[i - W - 1] + 2 * gray[i - W] + gray[i - W + 1])
      const m2 = gx * gx + gy * gy
      mag2[i] = m2
      if (m2 > 1e-6) { const m = Math.sqrt(m2); ox[i] = (gx * gx - gy * gy) / m; oy[i] = (2 * gx * gy) / m }
    }
  }
  return { ox, oy, mag2, alpha }
}

// 쿼리(사용자 이미지, 알파 없음): 테두리색으로 배경 추정 → 전경 밖 그래디언트는 죽인다(배경 오염 방지).
interface Query extends Field { fg: Uint8Array; fgCount: number }
function queryFeat(canvas: HTMLCanvasElement): Query {
  const ctx = canvas.getContext('2d')!
  const { data } = ctx.getImageData(0, 0, W, H)
  const f = field(data)
  const corners = [[2, 2], [W - 3, 2], [2, H - 3], [W - 3, H - 3]]
  const samp = corners.map(([x, y]) => { const i = (y * W + x) * 4; return [data[i], data[i + 1], data[i + 2]] })
  const bg = [0, 1, 2].map((k) => samp.map((s) => s[k]).sort((a, b) => a - b)[Math.floor(samp.length / 2)])
  const fg = new Uint8Array(W * H); let fgCount = 0
  for (let i = 0; i < fg.length; i++) {
    const d = Math.abs(data[i * 4] - bg[0]) + Math.abs(data[i * 4 + 1] - bg[1]) + Math.abs(data[i * 4 + 2] - bg[2])
    if (d > 40) { fg[i] = 1; fgCount++ } else { f.ox[i] = 0; f.oy[i] = 0; f.mag2[i] = 0 }
  }
  return { ...f, fg, fgCount }
}

// 렌더된 캔버스(알파 있음)의 field + 그린 픽셀(alpha>24) 마스크의 좌표 목록.
interface Rendered { f: Field; xs: Int16Array; ys: Int16Array; count: number; sumT: number }
function renderedFeat(canvas: HTMLCanvasElement): Rendered {
  const ctx = canvas.getContext('2d')!
  const f = field(ctx.getImageData(0, 0, W, H).data)
  const xs = new Int16Array(W * H), ys = new Int16Array(W * H)
  let count = 0, sumT = 0
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    const i = y * W + x
    if (f.alpha[i] > 24) { xs[count] = x; ys[count] = y; sumT += f.mag2[i]; count++ }
  }
  return { f, xs: xs.subarray(0, count), ys: ys.subarray(0, count), count, sumT }
}

// 마스크(템플릿 좌표) 위에서, 쿼리를 (dx,dy) 만큼 이동해 방향 벡터장의 정규화 상관 + 쿼리 에너지.
function corrAt(Q: Field, T: Field, r: Rendered, dx: number, dy: number): { dot: number; nq: number } {
  let dot = 0, nq = 0
  const { xs, ys, count } = r
  for (let k = 0; k < count; k++) {
    const x = xs[k] + dx, y = ys[k] + dy
    if (x < 1 || x >= W - 1 || y < 1 || y >= H - 1) continue
    const i = ys[k] * W + xs[k], j = y * W + x
    dot += Q.ox[j] * T.ox[i] + Q.oy[j] * T.oy[i]
    nq += Q.mag2[j]
  }
  return { dot, nq }
}

// ── 렌더 헬퍼 ────────────────────────────────────────────────────────────
const A = (id: string, slot: string, meta: Awaited<ReturnType<typeof loadMeta>>): AssembleInput =>
  ({ itemId: id, slot, vslot: meta.vslot ?? null, layers: getFrameLayers(meta, THUMB_VIEW), invisibleFace: meta.invisibleFace, name: meta.name })

async function renderPlaced(canvas: HTMLCanvasElement, placed: PlacedLayer[]) {
  const ctx = canvas.getContext('2d')!; ctx.clearRect(0, 0, W, H)
  await renderCharacter(canvas, placed, { scale: PLACEMENT.scale, box: PLACEMENT.box, anchor: PLACEMENT.anchor, flip: false, cors: true })
}

// 간단한 동시성 풀. fn 에 worker 인덱스를 넘겨 워커별 전용 스크래치 캔버스를 쓰게 한다(레이스 방지).
async function pool<T>(items: T[], n: number, fn: (t: T, i: number, worker: number) => Promise<void>, tick?: (done: number) => void) {
  let idx = 0, done = 0
  const workers = Array.from({ length: Math.min(n, items.length) }, (_, wid) => (async () => {
    while (idx < items.length) {
      const my = idx++
      try { await fn(items[my], my, wid) } catch { /* skip broken item */ }
      done++; if (tick && done % 4 === 0) tick(done)
    }
  })())
  await Promise.all(workers)
  tick?.(done)
}

// ── 메인 ────────────────────────────────────────────────────────────────
export interface AnalyzeOpts { onProgress?: (label: string, done: number, total: number) => void; params?: Params; signal?: { aborted: boolean } }

export async function analyze(qCanvas: HTMLCanvasElement, index: Index, opts: AnalyzeOpts = {}): Promise<SlotResult[]> {
  const params = opts.params ?? DEFAULT_PARAMS
  const Q = queryFeat(qCanvas)

  const tone = index.base.tones.find((t) => t.tone === index.base.default) || index.base.tones[0]
  const [bodyMeta, headMeta] = await Promise.all([loadMeta(tone.body), loadMeta(tone.head)])
  const baseInputs: AssembleInput[] = [A(bodyMeta.id, 'body', bodyMeta), A(headMeta.id, 'head', headMeta)]

  // 헤어·성형을 먼저 분석해 "바탕(under-base)"에 포함 → 이후 슬롯의 미착용 억제가 정확해진다.
  const cats = CATS.filter((c) => c.id !== 'skin' && c.id !== 'riding')
  const order = cats.slice().sort((a, b) => rank(a.id) - rank(b.id))

  const CONC = 6
  const scratch = Array.from({ length: CONC }, () => { const c = document.createElement('canvas'); c.width = W; c.height = H; return c })

  const results: SlotResult[] = []
  const underBase: AssembleInput[] = [...baseInputs]

  for (const cat of order) {
    if (opts.signal?.aborted) break
    const slot = CAT_TO_SLOT[cat.id]
    const summary = index.slots.find((s) => s.slot === slot)
    if (!summary) continue
    const items: ListItem[] = await loadSlot(summary.file).catch(() => [])
    if (!items.length) continue

    // "아이템 없는 바탕" field(현재까지 확정된 under-base).
    const baseCanvas = scratch[0]
    { const { placed } = assemble(underBase, index.zmap, index.smap); await renderPlaced(baseCanvas, placed) }
    const baseField = field(baseCanvas.getContext('2d')!.getImageData(0, 0, W, H).data)

    const scored: { it: ListItem; score: number; delta: number; energy: number }[] = new Array(items.length)
    opts.onProgress?.(cat.label, 0, items.length)
    await pool(items, CONC, async (it, i, wid) => {
      if (opts.signal?.aborted) return
      const c = scratch[wid]
      const meta = await loadMeta(it.id)
      const { placed } = assemble([...underBase, A(it.id, slot, meta)], index.zmap, index.smap)
      const own = placed.filter((p) => p.slot === slot) // 이 후보 아이템의 레이어만(자기 footprint = 템플릿·마스크)
      if (!own.length) { scored[i] = { it, score: 0, delta: 0, energy: 0 }; return }
      await renderPlaced(c, own)
      const r = renderedFeat(c)
      if (r.count < 6 || r.sumT < 1e-4) { scored[i] = { it, score: 0, delta: 0, energy: 0 }; return } // 안 그려짐(투명/빈 아트)

      // 국소 정렬 탐색: 아이템 상관이 최대가 되는 오프셋 d* 를 찾는다.
      let best = -2, bx = 0, by = 0, bnq = 0
      const normT = Math.sqrt(r.sumT)
      for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
        const { dot, nq } = corrAt(Q, r.f, r, dx, dy)
        const c2 = nq > 1e-6 ? dot / (normT * Math.sqrt(nq)) : 0
        if (c2 > best) { best = c2; bx = dx; by = dy; bnq = nq }
      }
      const score = Math.max(0, best)
      // 같은 정렬(d*)에서 "바탕"과의 상관 → 개선량 Δ.
      let sumB = 0
      for (let k = 0; k < r.count; k++) sumB += baseField.mag2[r.ys[k] * W + r.xs[k]]
      const { dot: dotB } = corrAt(Q, baseField, r, bx, by)
      const baseCos = sumB > 1e-6 && bnq > 1e-6 ? Math.max(0, dotB / (Math.sqrt(sumB) * Math.sqrt(bnq))) : 0
      const delta = score - baseCos
      const energy = normT > 1e-6 ? Math.sqrt(bnq) / normT : 0 // 쿼리 구조 / 템플릿 구조(그 자리에 아이템만큼 에지가 있나)
      scored[i] = { it, score, delta, energy }
    }, (done) => opts.onProgress?.(cat.label, done, items.length))

    const valid = scored.filter(Boolean)
    // top-k 순위 = 절대 상관(얼마나 잘 맞나) 우선. 억제/배제는 아래에서 개선량 Δ 로.
    valid.sort((a, b) => (b.score - a.score) || (b.delta - a.delta))
    const best = valid[0]
    if (!best) continue

    // ── 억제 판정(미착용/투명) ──
    let suppressed = false, reason = ''
    if (best.energy < params.covMin) { suppressed = true; reason = `그 자리에 구조가 거의 없음(에너지비 ${best.energy.toFixed(2)})` }
    else if (best.delta < params.baseMargin) { suppressed = true; reason = `바탕(미착용)이 아이템만큼 설명함(Δ ${best.delta.toFixed(2)})` }
    else if (best.score < params.scoreMin) { suppressed = true; reason = `확신 부족(best ${best.score.toFixed(2)})` }

    results.push({
      slot, label: cat.label, suppressed, reason,
      bestScore: best.score, baseScore: best.score - best.delta, coverage: best.energy,
      top: valid.slice(0, 5).map((v) => ({ id: v.it.id, name: v.it.name || v.it.id, icon: iconOf(v.it), score: v.score })),
    })

    // 헤어/성형이 확정(억제 안 됨)이면 under-base 에 추가 → 이후 슬롯 억제가 정확해진다.
    if (!suppressed && (slot === 'hair' || slot === 'face')) {
      const meta = await loadMeta(best.it.id)
      underBase.push(A(best.it.id, slot, meta))
    }
  }

  // ── 상호배타 소거: 한벌옷(longcoat) ↔ 상의(coat)+하의(pants) ──
  applyExclusivity(results)

  // 원래 부위 순서(카탈로그 CATS)대로 정렬해 반환.
  const ord = new Map(cats.map((c, i) => [CAT_TO_SLOT[c.id], i]))
  results.sort((a, b) => (ord.get(a.slot)! - ord.get(b.slot)!))
  return results
}

// 한벌옷과 상·하의는 동시에 입을 수 없다. 게이트를 통과한(=입은 것으로 보이는) 쪽만 남긴다.
function applyExclusivity(results: SlotResult[]) {
  const by = new Map(results.map((r) => [r.slot, r]))
  const oc = by.get('longcoat'), tp = by.get('coat'), bt = by.get('pants')
  const dOf = (r?: SlotResult) => (r ? r.bestScore - r.baseScore : -Infinity)
  const live = (r?: SlotResult) => !!r && !r.suppressed
  if (!live(oc) && !(live(tp) || live(bt))) return
  const twoPiece = Math.max(live(tp) ? dOf(tp) : -Infinity, live(bt) ? dOf(bt) : -Infinity)
  if (live(oc) && dOf(oc) >= twoPiece) {
    for (const r of [tp, bt]) if (r && !r.suppressed) { r.excluded = true; r.excludeReason = '한벌옷으로 추정 — 상·하의 배제' }
  } else if (live(oc)) {
    oc!.excluded = true; oc!.excludeReason = '상·하의로 추정 — 한벌옷 배제'
  }
}

// 헤어(0)·성형(1) 먼저, 나머지는 뒤.
function rank(catId: string): number { return catId === 'hair' ? 0 : catId === 'face' ? 1 : 2 }
