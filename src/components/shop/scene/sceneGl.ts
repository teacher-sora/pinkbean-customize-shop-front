// 배경 장면을 화면에 붙이는 쪽. 그리기는 sceneCore 가 하고, 여기는 캔버스를 만들어 넘기고 화면에서만 알 수 있는 값을 전한다.
//  · **장면은 워커에서 돈다**(scene.worker). 캔버스의 그리기 권한을 워커로 넘기면(OffscreenCanvas) 셰이더 준비 · 그림 디코딩 ·
//    텍스처 올리기 · 매 프레임 그리기가 메인 스레드를 쓰지 않는다 → 화면이 뜨자마자 목록 · 미리보기와 **동시에** 시작해도 서로 늦추지 않는다.
//    (메인 스레드에서 돌리던 때는 장면 준비가 목록 데이터를 기다리는 틈에 끼어들어 150~300ms 씩 화면을 붙잡았다.)
//  · 워커에서 WebGL 을 못 쓰는 브라우저(Safari 16 이하 등)에서는 같은 sceneCore 를 메인 스레드에서 돌린다. 이때는 예전처럼
//    화면이 한가해진 뒤에 시작한다(첫 화면을 막지 않게). 확인용: 주소에 `?skygl=main`.
//  · 전하는 값: 캔버스 크기와 화면 배율, (무대) 캐릭터가 서는 자리 · 배율, 배경 보기(<html data-pb-bgonly>), 동작 줄이기,
//    탭이 보이는지, 시간대(skyTime).
//  · 캔버스는 종류마다 하나를 끝까지 재사용한다. 밝아지며 나타나는 연출은 처음 뜰 때 한 번뿐 —
//    탭을 오가며 다시 붙을 때는 그 자리에서 바로 보인다(전환이 밀리지 않게).

import { getStageFloor, onStageFloor } from '@/lib/stageFloor'
import type { CoreIn, CoreOut, Env, SceneKind } from './sceneCore'
import { SCENE_SRC, STILL } from './sceneSrc'
import { getSkyMode, onSkyChange, skyFixed } from './skyTime'

export type { SceneKind }

const MAX_RATIO = 2      // 앱 배경 캔버스 해상도 상한(화면 배율)

type Post = (m: CoreIn, transfer?: Transferable[]) => void
interface View {
  kind: SceneKind
  canvas: HTMLCanvasElement
  post: Post
  worker: boolean                // 워커에서 그린다
  host: HTMLElement | null
  shown: boolean
  failed: boolean
  allowed: boolean[]             // 그리는 쪽에 받아도 된다고 알린 그림
  onFail: (() => void) | null
  cleanup: (() => void) | null
}

const views: Partial<Record<SceneKind, View>> = {}
let slow = 0                     // 느린 기기 보호 단계(sceneCore 의 watchPace 가 알린다). 2 부터 앱 배경 해상도를 화면 배율 1 로
let reduce: MediaQueryList | null = null
const search = () => { try { return window.location.search } catch { return '' } }
const env = (): Env => ({
  bgonly: document.documentElement.hasAttribute('data-pb-bgonly'),
  reduce: !!reduce?.matches,
  visible: document.visibilityState !== 'hidden',
})

// ── 그리는 쪽으로 가는 길 둘: 워커 / 메인 스레드 ──
let workerPost: Post | null | undefined      // undefined = 아직 안 만들었다 · null = 못 쓴다
let mainPost: Post | null = null
function viaWorker(): Post | null {
  if (workerPost !== undefined) return workerPost
  workerPost = null
  if (/[?&]skygl=main/.test(search())) return null
  if (typeof Worker === 'undefined' || typeof OffscreenCanvas === 'undefined' || !('transferControlToOffscreen' in HTMLCanvasElement.prototype)) return null
  try {
    const w = new Worker(new URL('./scene.worker.ts', import.meta.url))
    w.onmessage = (e: MessageEvent<CoreOut>) => onCore(e.data, true)
    // 워커가 뜨지 못했거나 죽었다 → 워커로 그리던 장면을 메인 스레드로 옮긴다
    w.onerror = () => { workerPost = null; for (const v of Object.values(views)) if (v?.worker) toMain(v) }
    workerPost = (m, transfer) => w.postMessage(m, transfer ?? [])
  } catch { workerPost = null }
  return workerPost
}
// 메인 스레드에서 돌릴 때는 화면이 한가해진 뒤에 코드를 받아 시작한다. 그 전의 메시지는 모아 두었다 차례로 넘긴다.
function viaMain(): Post {
  if (mainPost) return mainPost
  const queue: CoreIn[] = []
  let core: ((m: CoreIn) => void) | null = null
  const start = () => {
    import('./sceneCore').then((m) => { core = m.createCore((o) => onCore(o, false)); for (const q of queue.splice(0)) core(q) })
      .catch(() => { for (const v of Object.values(views)) if (v && !v.worker) fail(v) })
  }
  const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }
  if (w.requestIdleCallback) w.requestIdleCallback(start, { timeout: 2000 }); else window.setTimeout(start, 300)
  return (mainPost = (m) => { if (core) core(m); else queue.push(m) })
}

function fail(v: View) {
  const tell = v.onFail
  v.failed = true
  v.cleanup?.()
  tell?.()
}
// 워커에서 못 그린다 → 같은 자리에 메인 스레드 장면을 새로 붙인다(넘겨준 캔버스는 되돌려 받을 수 없어 새로 만든다).
function toMain(v: View) {
  const host = v.host, onFail = v.onFail
  v.cleanup?.()
  delete views[v.kind]
  if (host) mountScene(v.kind, host, onFail ?? undefined, true)
}
function onCore(m: CoreOut, fromWorker: boolean) {
  if (m.t === 'slow') { slow = m.level; const v = views.sky; if (v) layout(v); return }
  const v = views[m.kind]
  if (!v || v.worker !== fromWorker) return
  const c = v.canvas
  if (m.t === 'shown') { v.shown = true; c.style.transition = 'opacity .7s ease'; c.style.opacity = '1' }   // 깔려 있던 그림 위로 번지듯 나타난다(크기는 그대로 — 다가가는 효과는 그림과 어긋나 보였다)
  else if (m.t === 'hidden') { v.shown = false; c.style.transition = 'none'; c.style.opacity = '0' }
  else if (m.t === 'failed') { if (m.retry && fromWorker) toMain(v); else fail(v) }
}

function make(kind: SceneKind, forceMain: boolean): View {
  const canvas = document.createElement('canvas')
  canvas.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;display:block;opacity:0;pointer-events:none'
  reduce ??= window.matchMedia('(prefers-reduced-motion: reduce)')
  const wp = forceMain ? null : viaWorker()
  const v: View = { kind, canvas, post: wp ?? viaMain(), worker: !!wp, host: null, shown: false, failed: false, allowed: [], onFail: null, cleanup: null }
  // GPU 없는 확인 환경에서 강제로 켜는 용도: ?skygl=soft
  const init = { t: 'init' as const, kind, src: SCENE_SRC[kind], soft: /[?&]skygl=soft/.test(search()), skyMode: getSkyMode(), skyFixed: skyFixed(), env: env() }
  if (wp) { const off = canvas.transferControlToOffscreen(); v.post({ ...init, canvas: off }, [off]) }
  else v.post({ ...init, canvas })
  watchEnv()
  return v
}

// 화면에서만 알 수 있는 것들을 한 번만 걸어 두고, 바뀔 때마다 그리는 쪽에 알린다.
let watching = false
function watchEnv() {
  if (watching) return
  watching = true
  const tell = (m: CoreIn) => { const seen = new Set<Post>(); for (const v of Object.values(views)) if (v && !v.failed && !seen.has(v.post)) { seen.add(v.post); v.post(m) } }
  const push = () => tell({ t: 'env', env: env() })
  new MutationObserver(push).observe(document.documentElement, { attributes: true, attributeFilter: ['data-pb-bgonly'] })
  reduce?.addEventListener?.('change', push)
  document.addEventListener('visibilitychange', push)
  onSkyChange(() => tell({ t: 'sky', mode: getSkyMode(), fade: !reduce?.matches }))
}

// 캔버스 크기와(무대라면) 캐릭터 발 자리 · 배율을 재서 보낸다.
function layout(v: View) {
  const host = v.host
  if (!host) return
  // 칸 크기는 소수까지(getBoundingClientRect) — clientWidth · clientHeight 는 정수로 반올림돼(382.5 → 383), 비트맵이 칸보다 커져
  // 칸에 맞춰 눌려 그려졌다(도트가 1:1 이 아니고, 아래로 갈수록 최대 1px 어긋나 코디 비교의 고른 칸 배경이 다른 칸보다 1px 내려가 보였다 — 사용자 지적)
  const hb = host.getBoundingClientRect(), hw = hb.width, hh = hb.height
  if (!hw || !hh) return
  const dpr = window.devicePixelRatio || 1
  const r = v.kind === 'room' ? dpr : Math.min(dpr, slow >= 2 ? 1 : MAX_RATIO)
  // 캔버스의 CSS 크기 = 비트맵 ÷ 배율 — 브라우저가 늘이거나 줄이지 않는다(캐릭터 캔버스의 fitCanvas 와 같은 규칙)
  const bw = Math.round(hw * r), bh = Math.round(hh * r)
  v.canvas.style.width = `${bw / r}px`; v.canvas.style.height = `${bh / r}px`
  let foot: [number, number] = [0, 0], px = 1, shadow = 13
  if (v.kind === 'room') {
    const f = getStageFloor()
    if (f && f.wrap.isConnected && host.parentElement?.contains(f.wrap)) {
      const wr = f.wrap.getBoundingClientRect()
      foot = [Math.round((wr.left - hb.left + f.cx) * r), Math.round((wr.top - hb.top + f.footY) * r)]
      px = f.scale; shadow = f.shadow
    } else {
      // 캐릭터가 아직 안 그려졌을 때: 그려질 자리와 거의 같은 값으로 미리 잡는다.
      px = Math.max(1, Math.round(dpr))
      foot = [Math.round((hw / 2) * r), Math.round((hh / 2 + 38.4) * r)]
    }
  }
  v.post({ t: 'layout', kind: v.kind, w: bw, h: bh, ratio: r, foot, px, shadow })
}

// 그림을 받아도 되는 때를 그리는 쪽에 알린다. 화면에 <img> 로 깔리는 그림(SceneCanvas 의 data-scene)은 그 <img> 가 다 받은 뒤에,
// 나머지(아틀라스 · 빛 지도)는 곧바로. 같은 파일을 둘이 동시에 요청하면 느린 회선에서 두 번 내려받는다(sceneCore 머리말).
function allow(v: View, host: HTMLElement) {
  const still = new Set(STILL[v.kind].map((l) => l.i))
  SCENE_SRC[v.kind].forEach((_, i) => {
    if (v.allowed[i]) return
    const go = () => { if (!v.allowed[i]) { v.allowed[i] = true; v.post({ t: 'src', kind: v.kind, i }) } }
    if (!still.has(i)) { go(); return }
    let tries = 0
    const look = () => {
      if (v.allowed[i] || v.host !== host) return
      const el = host.querySelector<HTMLImageElement>(`img[data-scene="${i}"]`)
      if (!el) { if (++tries > 60) go(); else requestAnimationFrame(look); return }   // <img> 가 끝내 안 놓이면 그냥 받는다
      if (el.complete) go()   // 받았거나 실패했다(실패했으면 그리는 쪽이 따로 다시 받는다)
      else { el.addEventListener('load', go, { once: true }); el.addEventListener('error', go, { once: true }) }
    }
    look()
  })
}

// host 안에 장면을 붙인다. 돌려주는 함수로 뗀다(캔버스·컨텍스트는 남겨 두었다가 다시 쓴다).
// onFail = WebGL 을 못 쓰는 기기다(그때는 SceneCanvas 가 지나가는 것들도 그림으로 놓는다). 나중에 불릴 수도 있다.
export function mountScene(kind: SceneKind, host: HTMLElement, onFail?: () => void, forceMain = false): () => void {
  const v = views[kind] ?? (views[kind] = make(kind, forceMain))
  if (v.failed) { onFail?.(); return () => {} }
  v.cleanup?.()
  v.host = host
  v.onFail = onFail ?? null
  // 처음 뜰 때만 서서히 나타난다. 이미 떠 있던 장면은 다시 붙자마자 그린다
  if (!v.shown) { v.canvas.style.transition = 'none'; v.canvas.style.opacity = '0' }
  host.appendChild(v.canvas)
  const relayout = () => layout(v)
  const ro = new ResizeObserver(relayout)
  ro.observe(host)
  window.addEventListener('resize', relayout)
  const off = kind === 'room' ? onStageFloor(relayout) : null
  const mine = (v.cleanup = () => {
    ro.disconnect(); window.removeEventListener('resize', relayout); off?.()
    v.canvas.remove(); v.host = null; v.onFail = null; v.cleanup = null
    if (!v.failed) v.post({ t: 'detach', kind })
  })
  layout(v)
  v.post({ t: 'attach', kind })
  allow(v, host)
  return () => { if (v.cleanup === mine) mine() }
}
