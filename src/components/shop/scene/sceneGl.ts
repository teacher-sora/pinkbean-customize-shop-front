// 배경 장면을 그리는 WebGL 실행기. 화면 조작(INP)에 끼어들지 않는 것이 첫째 조건이다.
//  · 초당 30번 그린다. 구름·열기구가 화면 픽셀 단위로 매끄럽게 흘러가려면 필요하고, 메인 스레드가 하는 일은 유니폼 몇 개를 넘기는 것뿐이다.
//  · 앱 배경은 캔버스 픽셀 수를 묶는다(layout: 약 240만 이하). 무대는 멈춘 그림 한 장이라 게임 픽셀 한 칸 = 1픽셀로 그리고 2초에 한 번만 갱신한다.
//  · 셰이더 컴파일은 KHR_parallel_shader_compile 로 끝나기를 기다린다(없으면 다음 프레임에 확인) → 메인 스레드를 막지 않는다.
//  · 탭이 가려지면 rAF 가 멈추니 따로 멈출 것이 없다. '동작 줄이기' 설정이면 20초에 한 번만(시각에 따른 색만) 그린다.
//  · 캔버스와 컨텍스트는 종류마다 하나를 끝까지 재사용한다(탭을 오갈 때마다 다시 컴파일하지 않는다).

import stage from '@/assets/stage-fitting.png'
import { getStageFloor, onStageFloor } from '@/lib/stageFloor'
import { VERT, fragSource } from './sceneShader'
import { skyHour, skyState, type SkyState } from './skyTime'

export type SceneKind = 'sky' | 'room'

const UNIFORMS = ['uRes', 'uPx', 'uTime', 'uSky', 'uCloudA', 'uCloudB', 'uAmb', 'uLight', 'uSunCol', 'uSun', 'uMoon', 'uNight', 'uLamp', 'uOrigin', 'uShadow', 'uTex', 'uTexSize', 'uFoot'] as const
const FRAME_MS = 33
const ROOM_MS = 2000 // 무대는 멈춘 그림이라 시각에 따른 빛만 가끔 갱신한다
// 무대 그림 안에서 캐릭터가 서는 자리(발). parser/scripts/stage-build.cjs 의 FOOT_X · FOOT_Y 와 같은 값이다.
const STAGE_FOOT = [640, 430]
const REDUCED_MS = 20000
const COMPLETION_STATUS_KHR = 0x91b1

interface Scene {
  kind: SceneKind
  canvas: HTMLCanvasElement
  gl: WebGLRenderingContext | null
  prog: WebGLProgram | null
  building: WebGLProgram | null
  parallel: boolean
  u: Partial<Record<(typeof UNIFORMS)[number], WebGLUniformLocation | null>>
  host: HTMLElement | null
  ox: number; oy: number; px: number; shadow: number
  dirty: boolean
  shown: boolean
  img: HTMLImageElement | null // 무대 그림
  tex: boolean                 // 텍스처로 올렸는가
  at: number                   // 마지막으로 그린 때
  failed: boolean
  cleanup: (() => void) | null
}

const scenes: Partial<Record<SceneKind, Scene>> = {}
let raf = 0
let last = 0
let reduce: MediaQueryList | null = null

function build(sc: Scene) {
  const gl = sc.gl
  if (!gl) return
  const mk = (type: number, src: string) => { const s = gl.createShader(type)!; gl.shaderSource(s, src); gl.compileShader(s); return s }
  const prog = gl.createProgram()!
  gl.attachShader(prog, mk(gl.VERTEX_SHADER, VERT))
  gl.attachShader(prog, mk(gl.FRAGMENT_SHADER, fragSource(sc.kind)))
  gl.bindAttribLocation(prog, 0, 'aPos')
  gl.linkProgram(prog)
  sc.parallel = !!gl.getExtension('KHR_parallel_shader_compile')
  sc.building = prog
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer())
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW) // 화면을 덮는 삼각형 하나
  gl.enableVertexAttribArray(0)
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)
}

// 무대 그림을 텍스처로 올린다(확대는 nearest — 도트를 뭉개지 않는다). 컨텍스트를 되찾았을 때도 다시 부른다.
function upload(sc: Scene) {
  const gl = sc.gl, img = sc.img
  if (!gl || !img || !img.complete || !img.naturalWidth) return
  gl.bindTexture(gl.TEXTURE_2D, gl.createTexture())
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  sc.tex = true
  sc.dirty = true
}

// 컴파일이 끝났는지 본다. 끝났으면 프로그램을 쓰기 시작한다.
function poll(sc: Scene) {
  const gl = sc.gl, prog = sc.building
  if (!gl || !prog) return
  if (sc.parallel && !gl.getProgramParameter(prog, COMPLETION_STATUS_KHR)) return
  sc.building = null
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    if (process.env.NODE_ENV !== 'production') console.warn('[scene]', sc.kind, gl.getProgramInfoLog(prog), gl.getShaderInfoLog(gl.getAttachedShaders(prog)![1]))
    sc.failed = true
    return
  }
  gl.useProgram(prog)
  for (const n of UNIFORMS) sc.u[n] = gl.getUniformLocation(prog, n)
  sc.prog = prog
  sc.dirty = true
}

function create(kind: SceneKind): Scene {
  const canvas = document.createElement('canvas')
  canvas.style.cssText = 'position:absolute;left:0;top:0;display:block;image-rendering:pixelated;opacity:0;transition:opacity .5s ease;pointer-events:none'
  const sc: Scene = { kind, canvas, gl: null, prog: null, building: null, parallel: false, u: {}, host: null, ox: 0, oy: 0, px: 1, shadow: 13, dirty: true, shown: false, img: null, tex: false, at: 0, failed: false, cleanup: null }
  // 소프트웨어 렌더러(GPU 없음)면 쓰지 않는다 — CPU 로 셰이더를 돌리면 느려진다. 그때는 바탕색만 남는다.
  // (?skygl=soft 는 GPU 없는 확인 환경에서 강제로 켜는 용도)
  const soft = /[?&]skygl=soft/.test(window.location.search)
  const gl = canvas.getContext('webgl', { alpha: false, antialias: false, depth: false, stencil: false, powerPreference: 'low-power', failIfMajorPerformanceCaveat: !soft })
  if (!gl) { sc.failed = true; return sc }
  sc.gl = gl
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); sc.prog = null; sc.building = null; sc.tex = false })
  canvas.addEventListener('webglcontextrestored', () => { build(sc); upload(sc) })
  build(sc)
  if (kind === 'room') {
    const img = new Image()
    img.decoding = 'async'
    img.onload = () => upload(sc)
    img.src = stage.src
    sc.img = img
  }
  return sc
}

// 캔버스 크기·위치. 게임 픽셀 한 칸(= px 디바이스 픽셀)을 캔버스 k 픽셀로 그리고 CSS 로 px/k 배(정수) 확대한다.
// k 가 클수록 움직이는 물체가 잘게(화면 픽셀 단위로) 미끄러진다. 픽셀 수가 MAX_PIXELS 를 넘지 않는 가장 큰 약수를 쓴다.
// 무대(room)는 캐릭터의 발 위치와 배율에 맞춰, 배경 도트가 캐릭터 도트와 같은 크기로 놓인다.
const MAX_PIXELS = 2_400_000
function layout(sc: Scene) {
  const host = sc.host
  if (!host) return
  const hw = host.clientWidth, hh = host.clientHeight
  if (!hw || !hh) return
  const dpr = window.devicePixelRatio || 1
  let px: number, cx = 0, fy = 0 // px = 한 칸의 디바이스 픽셀 수, cx·fy = 발 위치(디바이스 픽셀)
  if (sc.kind === 'sky') px = Math.max(1, Math.round(2 * dpr))
  else {
    const f = getStageFloor()
    if (f && f.wrap.isConnected && host.parentElement?.contains(f.wrap)) {
      const wr = f.wrap.getBoundingClientRect(), hr = host.getBoundingClientRect()
      px = f.scale; cx = (wr.left - hr.left + f.cx) * dpr; fy = (wr.top - hr.top + f.footY) * dpr; sc.shadow = f.shadow
    } else {
      // 캐릭터가 아직 안 그려졌을 때: 그려질 자리와 거의 같은 값으로 미리 잡는다.
      px = Math.max(2, Math.round(2 * dpr)); cx = (hw * dpr) / 2; fy = (hh * dpr) / 2 + 38.4 * px
    }
  }
  const ox = Math.ceil(cx / px), oy = Math.ceil(fy / px)
  const uw = ox + Math.ceil((hw * dpr - cx) / px), uh = oy + Math.ceil((hh * dpr - fy) / px) // 게임 픽셀 수
  let k = 1
  if (sc.kind === 'sky') for (let d = px; d > 1; d--) if (px % d === 0 && uw * uh * d * d <= MAX_PIXELS) { k = d; break }
  const c = sc.canvas
  if (c.width !== uw * k) c.width = uw * k
  if (c.height !== uh * k) c.height = uh * k
  c.style.width = `${(uw * px) / dpr}px`
  c.style.height = `${(uh * px) / dpr}px`
  c.style.left = `${(cx - ox * px) / dpr}px`
  c.style.top = `${(fy - oy * px) / dpr}px`
  sc.ox = ox * k; sc.oy = oy * k; sc.px = 1 / k
  sc.dirty = true
}

// 해·달의 자리. 무대 창은 가운데가 벽이라 달은 왼쪽 창 안에서만 움직이고, 앱 배경은 위쪽 띠만 보이니 거기 둔다.
function orb(kind: SceneKind, phase: number, moon: boolean, skyH: number): [number, number, number] {
  if (phase <= 0 || phase >= 1) return [0, 0, 0]
  const s = Math.sin(Math.PI * phase)
  const vis = Math.min(1, s * 6)
  if (kind === 'sky') return [0.12 + 0.76 * phase, (12 + (1 - s) * 26) / skyH, vis]
  return moon ? [0.08 + 0.08 * phase, 0.72 - s * 0.2, vis] : [0.2 + 0.72 * phase, 0.84 - s * 0.7, vis]
}

function draw(sc: Scene, now: number, st: SkyState) {
  const gl = sc.gl, u = sc.u, c = sc.canvas
  if (!gl || !sc.prog) return
  gl.viewport(0, 0, c.width, c.height)
  gl.uniform2f(u.uRes!, c.width, c.height)
  gl.uniform1f(u.uPx!, sc.px)
  gl.uniform1f(u.uTime!, now / 1000)
  gl.uniform3fv(u.uSky!, st.sky.flat())
  gl.uniform3fv(u.uCloudA!, st.cloudA)
  gl.uniform3fv(u.uCloudB!, st.cloudB)
  gl.uniform3fv(u.uAmb!, st.amb)
  gl.uniform3fv(u.uLight!, st.light)
  gl.uniform3fv(u.uSunCol!, st.sun)
  gl.uniform3fv(u.uSun!, orb(sc.kind, st.sunPhase, false, c.height * sc.px))
  const moon = orb(sc.kind, st.moonPhase, true, c.height * sc.px)
  moon[2] *= Math.min(1, st.night * 1.6)
  gl.uniform3fv(u.uMoon!, moon)
  gl.uniform1f(u.uNight!, st.night)
  gl.uniform1f(u.uLamp!, st.lamp)
  if (sc.kind === 'room') {
    gl.uniform2f(u.uOrigin!, sc.ox, sc.oy); gl.uniform1f(u.uShadow!, sc.shadow)
    gl.uniform1i(u.uTex!, 0); gl.uniform2f(u.uTexSize!, sc.img!.naturalWidth, sc.img!.naturalHeight); gl.uniform2f(u.uFoot!, STAGE_FOOT[0], STAGE_FOOT[1])
  }
  gl.drawArrays(gl.TRIANGLES, 0, 3)
  sc.dirty = false
  sc.at = now
  if (!sc.shown) { sc.shown = true; c.style.opacity = '1' }
}

function tick(now: number) {
  raf = requestAnimationFrame(tick)
  const due = now - last >= (reduce?.matches ? REDUCED_MS : FRAME_MS)
  let st: SkyState | null = null
  for (const sc of Object.values(scenes)) {
    if (!sc || !sc.host) continue
    if (sc.building) poll(sc)
    if (!sc.prog || (sc.kind === 'room' && !sc.tex)) continue
    if (!(sc.dirty || (sc.kind === 'room' ? now - sc.at >= ROOM_MS : due))) continue
    draw(sc, now, st ?? (st = skyState(skyHour())))
  }
  if (due) last = now
}

// host 안에 장면을 붙인다. 돌려주는 함수로 뗀다(캔버스·컨텍스트는 남겨 두었다가 다시 쓴다).
export function mountScene(kind: SceneKind, host: HTMLElement): () => void {
  const sc = scenes[kind] ?? (scenes[kind] = create(kind))
  if (sc.failed) return () => {}
  sc.cleanup?.()
  sc.host = host
  host.appendChild(sc.canvas)
  const relayout = () => layout(sc)
  const ro = new ResizeObserver(relayout)
  ro.observe(host)
  window.addEventListener('resize', relayout) // 배율(DPR) 변화
  const off = kind === 'room' ? onStageFloor(relayout) : null
  sc.cleanup = () => {
    ro.disconnect(); window.removeEventListener('resize', relayout); off?.()
    sc.canvas.remove(); sc.host = null; sc.cleanup = null
    if (!Object.values(scenes).some((s) => s?.host)) { cancelAnimationFrame(raf); raf = 0 }
  }
  layout(sc)
  reduce ??= window.matchMedia('(prefers-reduced-motion: reduce)')
  if (!raf) raf = requestAnimationFrame(tick)
  const mine = sc.cleanup
  return () => { if (sc.cleanup === mine) mine() }
}
