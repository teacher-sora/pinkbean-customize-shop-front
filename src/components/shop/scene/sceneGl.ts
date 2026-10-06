// 배경 장면을 그리는 WebGL 실행기. 블록(상자)을 3D 로 쌓고 16×16 텍스처를 입혀 원근 카메라로 본다(마인크래프트 방식).
// 화면 조작(INP)에 끼어들지 않는 것이 첫째 조건이다.
//  · 라이브러리도 그림 파일도 없다: 텍스처는 코드로 찍고(voxelAtlas), 장면은 상자 목록으로 쌓아(voxelScenes) 정점 버퍼 하나로 올린다.
//    → 내려받는 것은 이 코드 조각뿐이고, 한 번 올린 뒤 프레임마다 하는 일은 행렬 하나와 유니폼 몇 개를 넘기는 것이다.
//  · 초당 30번 그린다(카메라가 천천히 흔들리고 포인터를 따라 살짝 움직인다). '동작 줄이기'면 바뀔 때만 그린다.
//  · 장면이 뜰 때: 어두운 바탕에서 밝아지며 카메라가 살짝 다가간다(arrive).
//  · 무대(room)는 캐릭터의 발 위치·배율에 맞춘다: 발이 놓이는 블록 자리가 늘 캐릭터 발밑에 오도록 화면을 민다(카메라가 움직여도 고정).
//  · 시각(skyTime)에 따라 하늘 · 빛 · 안개 색이 바뀌고, 밤에는 창과 등이 켜진다.
//  · 캔버스와 컨텍스트는 종류마다 하나를 끝까지 재사용한다. 탭이 가려지면 rAF 가 멈춘다.

import { getStageFloor, onStageFloor } from '@/lib/stageFloor'
import { skyHour, skyState, type SkyState } from './skyTime'
import { COLS, FIRST_LIT, ROWS, paintAtlas } from './voxelAtlas'
import { SCENES, buildMesh } from './voxelScenes'

export type SceneKind = 'sky' | 'room'

const FRAME_MS = 33
const MAX_RATIO = 1.5   // 캔버스 해상도 상한(화면 배율)
const BLOCK_PX = 26     // 무대: 블록 1칸 = 캐릭터 도트 26칸(캐릭터 키가 블록 두 칸 반쯤)

const BLOCK_VS = `
attribute vec3 aPos; attribute vec2 aUv; attribute vec3 aInfo;
uniform mat4 uPV; uniform vec4 uVs;
varying vec2 vUv; varying vec3 vInfo; varying float vDepth;
void main(){
  vec4 p = uPV * vec4(aPos, 1.);
  vDepth = p.w;
  p.xy = p.xy * uVs.xy + uVs.zw * p.w;   // 화면 밀기(무대: 발 자리를 캐릭터 발밑에 고정)
  gl_Position = p; vUv = aUv; vInfo = aInfo;
}`
const BLOCK_FS = `
precision mediump float;
uniform sampler2D uAtlas; uniform vec2 uGrid; uniform float uLit0;
uniform vec3 uAmb; uniform vec3 uFog; uniform vec2 uFogR; uniform float uLamp; uniform float uMask;
varying vec2 vUv; varying vec3 vInfo; varying float vDepth;
void main(){
  float t = floor(vInfo.x + .5);
  vec2 tile = vec2(mod(t, uGrid.x), floor(t / uGrid.x));
  vec3 c = texture2D(uAtlas, (tile * 16. + floor(fract(vUv) * 16.) + .5) / (uGrid * 16.)).rgb;
  vec3 col = c * vInfo.y * uAmb;
  if (t >= uLit0) {
    if (vInfo.z > 1.5) col = mix(col, c * vec3(1.2, 1., .55) + vec3(.3, .2, .04), uLamp * step(.42, fract(vInfo.z)) * .92); // 창: 밤에 군데군데 켜진다
    else col = c * (.82 + .4 * uLamp);                                                                                      // 등 · 전구
  } else if (vInfo.z > .5) col = c * vInfo.y * mix(uAmb, vec3(1.), .5 + .5 * uLamp);                                         // 불 밝힌 간판
  col = mix(col, uFog, smoothstep(uFogR.x, uFogR.y, vDepth));
  gl_FragColor = vec4(mix(col, vec3(.09, .07, .16), uMask), 1.);
}`
const SKY_VS = 'attribute vec2 aP; void main(){ gl_Position = vec4(aP, 0., 1.); }'
// 하늘: 네 단 그러데이션 · 네모난 해와 달 · 별 · 핑크빈 별자리. 3픽셀 칸으로 끊어 블록 세상의 하늘처럼 보이게 한다
const SKY_FS = `
precision mediump float;
uniform vec2 uRes; uniform vec3 uSky[4]; uniform vec3 uSun; uniform vec3 uMoon; uniform vec3 uSunCol; uniform float uNight; uniform float uTime; uniform float uMask;
float hash(vec2 p){ vec3 q = fract(vec3(p.xyx) * .1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
float seg(vec2 p, vec2 a, vec2 b){ vec2 pa = p - a, ba = b - a; return length(pa - ba * clamp(dot(pa, ba) / dot(ba, ba), 0., 1.)); }
#define S(ax,ay,bx,by) d = min(d, seg(q, vec2(ax,ay), vec2(bx,by)));
#define N(ax,ay) n = min(n, length(q - vec2(ax,ay)));
vec2 pinkbean(vec2 q){
  float d = 99., n = 99.;
  if (abs(q.x) > 24. || abs(q.y) > 25.) return vec2(99.);
  S(-8.,-12.,8.,-12.) S(8.,-12.,16.,-3.) S(16.,-3.,15.,9.) S(15.,9.,7.,15.) S(7.,15.,-7.,15.) S(-7.,15.,-15.,9.) S(-15.,9.,-16.,-3.) S(-16.,-3.,-8.,-12.)
  S(-8.,-12.,-17.,-18.) S(-17.,-18.,-16.,-3.) S(8.,-12.,17.,-18.) S(17.,-18.,16.,-3.) S(-3.,6.,0.,8.) S(0.,8.,3.,6.)
  N(-8.,-12.) N(8.,-12.) N(16.,-3.) N(15.,9.) N(7.,15.) N(-7.,15.) N(-15.,9.) N(-16.,-3.) N(-17.,-18.) N(17.,-18.) N(-6.,1.) N(6.,1.)
  return vec2(d, n);
}
void main(){
  vec2 size = floor(uRes / 3.);
  vec2 p = floor(vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) / 3.) + .5;
  float t = clamp(p.y / size.y, 0., 1.);
  vec3 col = t < .42 ? mix(uSky[0], uSky[1], t / .42) : (t < .78 ? mix(uSky[1], uSky[2], (t - .42) / .36) : mix(uSky[2], uSky[3], (t - .78) / .22));
  if (uNight > .01) {
    float h = hash(floor(p / 3.));
    col = mix(col, vec3(1., .97, .9), step(.955, h) * step(length(fract(p / 3.) - .5), .34) * (.6 + .4 * sin(uTime * (.8 + h * 2.) + h * 40.)) * uNight * (1. - smoothstep(.6, .95, t)));
    for (int i = 0; i < 2; i++) {
      vec2 dn = pinkbean((p - vec2(size.x * (i == 0 ? .06 : .94), size.y * (i == 0 ? .2 : .26))) * .9);
      float a = max(exp(-dn.x * dn.x * 4.) * .7, exp(-dn.y * dn.y * .3));
      col = mix(col, vec3(1., .86, .4), min(1., a) * uNight * (.75 + .25 * sin(uTime * 1.2 + float(i) * 2.)));
    }
  }
  vec2 m = p - uMoon.xy * size;
  col = mix(col, vec3(.78, .84, 1.), exp(-length(m) * .06) * .35 * uMoon.z);
  col = mix(col, vec3(1., .96, .8), step(max(abs(m.x), abs(m.y)), 9.) * step(4., max(abs(m.x - 4.), abs(m.y + 3.)) - 3.) * uMoon.z);
  vec2 s = p - uSun.xy * size;
  col = mix(col, uSunCol, exp(-length(s) * .035) * .55 * uSun.z);
  col = mix(col, mix(uSunCol, vec3(1.), .7), step(max(abs(s.x), abs(s.y)), 11.) * uSun.z);
  gl_FragColor = vec4(mix(col, vec3(.09, .07, .16), uMask), 1.);
}`

// ── 행렬(열 우선) ──
type M4 = Float32Array
const perspective = (fovy: number, aspect: number, n: number, f: number): M4 => {
  const k = 1 / Math.tan(fovy / 2)
  return new Float32Array([k / aspect, 0, 0, 0, 0, k, 0, 0, 0, 0, (f + n) / (n - f), -1, 0, 0, (2 * f * n) / (n - f), 0])
}
const lookAt = (e: number[], t: number[]): M4 => {
  let zx = e[0] - t[0], zy = e[1] - t[1], zz = e[2] - t[2]
  const zl = Math.hypot(zx, zy, zz); zx /= zl; zy /= zl; zz /= zl
  let xx = zz, xz = -zx; const xl = Math.hypot(xx, xz); xx /= xl; xz /= xl // x = up(0,1,0) × z
  const yx = zy * xz, yy = zz * xx - zx * xz, yz = -zy * xx                 // y = z × x
  return new Float32Array([xx, yx, zx, 0, 0, yy, zy, 0, xz, yz, zz, 0, -(xx * e[0] + xz * e[2]), -(yx * e[0] + yy * e[1] + yz * e[2]), -(zx * e[0] + zy * e[1] + zz * e[2]), 1])
}
const mul = (a: M4, b: M4): M4 => {
  const o = new Float32Array(16)
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3]
  return o
}

type Uni = Record<string, WebGLUniformLocation | null>
interface Scene {
  kind: SceneKind
  canvas: HTMLCanvasElement
  gl: WebGLRenderingContext | null
  block: { prog: WebGLProgram; u: Uni; buf: WebGLBuffer; ibuf: WebGLBuffer; count: number } | null
  sky: { prog: WebGLProgram; u: Uni; buf: WebGLBuffer } | null
  host: HTMLElement | null
  ratio: number                 // 캔버스 픽셀 / CSS 픽셀
  foot: [number, number]        // 발 자리(캔버스 픽셀)
  blockPx: number               // 발 자리에서 블록 1칸의 캔버스 픽셀 수
  arrive: number                // 0 → 1: 뜨면서 다가간다
  shown: boolean
  dirty: boolean
  failed: boolean
  cleanup: (() => void) | null
}

const scenes: Partial<Record<SceneKind, Scene>> = {}
const pointer = { x: 0, y: 0, tx: 0, ty: 0 }
let raf = 0
let last = 0
let reduce: MediaQueryList | null = null

function program(gl: WebGLRenderingContext, vs: string, fs: string, names: string[]) {
  const mk = (type: number, src: string) => { const s = gl.createShader(type)!; gl.shaderSource(s, src); gl.compileShader(s); return s }
  const prog = gl.createProgram()!
  gl.attachShader(prog, mk(gl.VERTEX_SHADER, vs)); gl.attachShader(prog, mk(gl.FRAGMENT_SHADER, fs))
  gl.bindAttribLocation(prog, 0, names[0]); gl.bindAttribLocation(prog, 1, 'aUv'); gl.bindAttribLocation(prog, 2, 'aInfo')
  gl.linkProgram(prog)
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    if (process.env.NODE_ENV !== 'production') console.warn('[scene]', gl.getProgramInfoLog(prog), gl.getShaderInfoLog(gl.getAttachedShaders(prog)![0]), gl.getShaderInfoLog(gl.getAttachedShaders(prog)![1]))
    return null
  }
  const u: Uni = {}
  for (const n of names.slice(1)) u[n] = gl.getUniformLocation(prog, n)
  return { prog, u }
}

// 텍스처 · 정점 버퍼 · 셰이더를 올린다. 컨텍스트를 되찾았을 때도 다시 부른다.
function init(sc: Scene) {
  const gl = sc.gl
  if (!gl) return
  if (!gl.getExtension('OES_element_index_uint')) { sc.failed = true; return }
  const bp = program(gl, BLOCK_VS, BLOCK_FS, ['aPos', 'uPV', 'uVs', 'uAtlas', 'uGrid', 'uLit0', 'uAmb', 'uFog', 'uFogR', 'uLamp', 'uMask'])
  const sp = sc.kind === 'sky' ? program(gl, SKY_VS, SKY_FS, ['aP', 'uRes', 'uSky', 'uSun', 'uMoon', 'uSunCol', 'uNight', 'uTime', 'uMask']) : null
  if (!bp || (sc.kind === 'sky' && !sp)) { sc.failed = true; return }
  const atlas = paintAtlas()
  gl.bindTexture(gl.TEXTURE_2D, gl.createTexture())
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, atlas.width, atlas.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, atlas.data)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  const mesh = buildMesh(SCENES[sc.kind])
  const buf = gl.createBuffer()!, ibuf = gl.createBuffer()!
  gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, mesh.verts, gl.STATIC_DRAW)
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibuf); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.index, gl.STATIC_DRAW)
  sc.block = { ...bp, buf, ibuf, count: mesh.index.length }
  if (sp) {
    const sb = gl.createBuffer()!
    gl.bindBuffer(gl.ARRAY_BUFFER, sb); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
    sc.sky = { ...sp, buf: sb }
  }
  sc.dirty = true
}

function create(kind: SceneKind): Scene {
  const canvas = document.createElement('canvas')
  canvas.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;display:block;image-rendering:pixelated;opacity:0;pointer-events:none'
  const sc: Scene = { kind, canvas, gl: null, block: null, sky: null, host: null, ratio: 1, foot: [0, 0], blockPx: 52, arrive: 0, shown: false, dirty: true, failed: false, cleanup: null }
  // 소프트웨어 렌더러(GPU 없음)면 쓰지 않는다. 그때는 바탕색만 남는다. (?skygl=soft 는 GPU 없는 확인 환경에서 강제로 켜는 용도)
  const soft = /[?&]skygl=soft/.test(window.location.search)
  const gl = canvas.getContext('webgl', { alpha: false, antialias: false, depth: true, stencil: false, powerPreference: 'low-power', failIfMajorPerformanceCaveat: !soft })
  if (!gl) { sc.failed = true; return sc }
  sc.gl = gl
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); sc.block = null; sc.sky = null })
  canvas.addEventListener('webglcontextrestored', () => init(sc))
  init(sc)
  return sc
}

// 캔버스 크기와(무대라면) 캐릭터 발 자리.
function layout(sc: Scene) {
  const host = sc.host
  if (!host) return
  const hw = host.clientWidth, hh = host.clientHeight
  if (!hw || !hh) return
  const dpr = window.devicePixelRatio || 1
  const r = (sc.ratio = Math.min(dpr, MAX_RATIO))
  const c = sc.canvas, w = Math.round(hw * r), h = Math.round(hh * r)
  if (c.width !== w) c.width = w
  if (c.height !== h) c.height = h
  if (sc.kind === 'room') {
    const f = getStageFloor()
    if (f && f.wrap.isConnected && host.parentElement?.contains(f.wrap)) {
      const wr = f.wrap.getBoundingClientRect(), hr = host.getBoundingClientRect()
      sc.foot = [(wr.left - hr.left + f.cx) * r, (wr.top - hr.top + f.footY) * r]
      sc.blockPx = (BLOCK_PX * f.scale * r) / dpr
    } else {
      // 캐릭터가 아직 안 그려졌을 때: 그려질 자리와 거의 같은 값으로 미리 잡는다.
      const px = Math.max(2, Math.round(2 * dpr))
      sc.foot = [(hw / 2) * r, (hh / 2 + (38.4 * px) / dpr) * r]
      sc.blockPx = (BLOCK_PX * px * r) / dpr
    }
  }
  sc.dirty = true
}

// 해·달의 자리(하늘 안 0~1). 앱 배경은 위쪽 띠만 보이니 거기 둔다.
function orb(phase: number): [number, number, number] {
  if (phase <= 0 || phase >= 1) return [0, 0, 0]
  const s = Math.sin(Math.PI * phase)
  return [0.12 + 0.76 * phase, 0.05 + (1 - s) * 0.2, Math.min(1, s * 6)]
}

function draw(sc: Scene, now: number, st: SkyState, still: boolean) {
  const gl = sc.gl, b = sc.block, c = sc.canvas
  if (!gl || !b) return
  const def = SCENES[sc.kind], s = still ? 4 : now / 1000, W = c.width, H = c.height
  sc.arrive = still ? 1 : Math.min(1, sc.arrive + 0.03)
  const ease = 1 - Math.pow(1 - sc.arrive, 3)
  const room = sc.kind === 'room'
  const sway = still ? 0 : room ? 0.5 : 1
  const eye = [
    def.eye[0] + (pointer.x * 1.2 + Math.sin(s * 0.21) * 0.4) * sway,
    def.eye[1] - (pointer.y * 0.6 - Math.sin(s * 0.33) * 0.15) * sway,
    def.eye[2] + (1 - ease) * (room ? 3 : 5),
  ]
  const look = [def.look[0] + pointer.x * 0.4 * sway, def.look[1], def.look[2]]
  const fov = ((!room && W < H ? 70 : def.fov) * Math.PI) / 180
  const pv = mul(perspective(fov, room ? 1 : W / H, 0.5, 260), lookAt(eye, look))
  let vs = [1, 1, 0, 0]
  if (room && def.pin) {
    // 발 자리가 화면의 sc.foot 에 오고, 그 깊이에서 블록 1칸이 sc.blockPx 가 되도록 큰 정사각 화면의 일부를 잘라 그린다
    const p = def.pin, cw = pv[3] * p[0] + pv[7] * p[1] + pv[11] * p[2] + pv[15]
    const nx = (pv[0] * p[0] + pv[4] * p[1] + pv[8] * p[2] + pv[12]) / cw, ny = (pv[1] * p[0] + pv[5] * p[1] + pv[9] * p[2] + pv[13]) / cw
    const full = sc.blockPx * 2 * cw * Math.tan(fov / 2)
    const ox = ((nx + 1) / 2) * full - sc.foot[0], oy = ((1 - ny) / 2) * full - sc.foot[1]
    vs = [full / W, full / H, full / W - (2 * ox) / W - 1, 1 - full / H + (2 * oy) / H]
  }
  gl.viewport(0, 0, W, H)
  gl.enableVertexAttribArray(0)
  const mask = room ? 0 : 0.3
  if (sc.sky) {
    const k = sc.sky, moon = orb(st.moonPhase)
    moon[2] *= Math.min(1, st.night * 1.6)
    gl.disable(gl.DEPTH_TEST)
    gl.disableVertexAttribArray(1); gl.disableVertexAttribArray(2)
    gl.useProgram(k.prog)
    gl.bindBuffer(gl.ARRAY_BUFFER, k.buf); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)
    gl.uniform2f(k.u.uRes, W, H); gl.uniform3fv(k.u.uSky, st.sky.flat()); gl.uniform3fv(k.u.uSun, orb(st.sunPhase)); gl.uniform3fv(k.u.uMoon, moon)
    gl.uniform3fv(k.u.uSunCol, st.sun); gl.uniform1f(k.u.uNight, st.night); gl.uniform1f(k.u.uTime, s); gl.uniform1f(k.u.uMask, mask)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
    gl.clear(gl.DEPTH_BUFFER_BIT)
  } else { gl.clearColor(0.1, 0.07, 0.09, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT) }
  gl.enable(gl.DEPTH_TEST)
  gl.enableVertexAttribArray(1); gl.enableVertexAttribArray(2)
  gl.useProgram(b.prog)
  gl.bindBuffer(gl.ARRAY_BUFFER, b.buf); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, b.ibuf)
  gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 32, 0); gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 32, 12); gl.vertexAttribPointer(2, 3, gl.FLOAT, false, 32, 20)
  gl.uniformMatrix4fv(b.u.uPV, false, pv); gl.uniform4fv(b.u.uVs, vs)
  gl.uniform1i(b.u.uAtlas, 0); gl.uniform2f(b.u.uGrid, COLS, ROWS); gl.uniform1f(b.u.uLit0, FIRST_LIT)
  // 방 안은 등불을 받아 바깥보다 덜 물든다
  const amb = room ? st.amb.map((v, i) => v + ([1.04, 0.98, 0.9][i] - v) * (0.5 + 0.3 * st.lamp)) : st.amb
  const fog = room ? [0.13, 0.09, 0.11] : st.sky[3].map((v, i) => v * 0.7 + st.sky[2][i] * 0.3)
  gl.uniform3fv(b.u.uAmb, amb); gl.uniform3fv(b.u.uFog, fog); gl.uniform2f(b.u.uFogR, def.fog[0], def.fog[1])
  gl.uniform1f(b.u.uLamp, st.lamp); gl.uniform1f(b.u.uMask, mask)
  gl.drawElements(gl.TRIANGLES, b.count, gl.UNSIGNED_INT, 0)
  sc.dirty = false
  if (!sc.shown) { sc.shown = true; c.style.transition = 'opacity .4s ease'; c.style.opacity = '1' }
}

function tick(now: number) {
  raf = requestAnimationFrame(tick)
  const still = !!reduce?.matches
  if (now - last < FRAME_MS) return
  last = now
  pointer.x += (pointer.tx - pointer.x) * 0.05
  pointer.y += (pointer.ty - pointer.y) * 0.05
  let st: SkyState | null = null
  for (const sc of Object.values(scenes)) {
    if (!sc || !sc.host || !sc.block) continue
    if (still && !sc.dirty) continue
    draw(sc, now, st ?? (st = skyState(skyHour())), still)
  }
}
const onMove = (e: PointerEvent) => { pointer.tx = (e.clientX / window.innerWidth) * 2 - 1; pointer.ty = (e.clientY / window.innerHeight) * 2 - 1 }

// host 안에 장면을 붙인다. 돌려주는 함수로 뗀다(캔버스·컨텍스트는 남겨 두었다가 다시 쓴다).
export function mountScene(kind: SceneKind, host: HTMLElement): () => void {
  const sc = scenes[kind] ?? (scenes[kind] = create(kind))
  if (sc.failed) return () => {}
  sc.cleanup?.()
  sc.host = host
  // 붙을 때마다: 어두운 바탕에서 밝아지며 다가간다
  sc.canvas.style.transition = 'none'; sc.canvas.style.opacity = '0'
  sc.shown = false; sc.arrive = 0
  host.appendChild(sc.canvas)
  const relayout = () => layout(sc)
  const ro = new ResizeObserver(relayout)
  ro.observe(host)
  window.addEventListener('resize', relayout)
  const off = kind === 'room' ? onStageFloor(relayout) : null
  if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) window.addEventListener('pointermove', onMove, { passive: true })
  sc.cleanup = () => {
    ro.disconnect(); window.removeEventListener('resize', relayout); off?.()
    sc.canvas.remove(); sc.host = null; sc.cleanup = null
    if (!Object.values(scenes).some((s) => s?.host)) { cancelAnimationFrame(raf); raf = 0; window.removeEventListener('pointermove', onMove) }
  }
  layout(sc)
  reduce ??= window.matchMedia('(prefers-reduced-motion: reduce)')
  if (!raf) raf = requestAnimationFrame(tick)
  const mine = sc.cleanup
  return () => { if (sc.cleanup === mine) mine() }
}
