// 배경 장면을 그리는 WebGL 실행기. 그림은 게임 맵에서 뽑은 것(메이플 15번가)이고, 여기서는 층을 겹쳐 놓고
// 시각에 따른 색과 작은 움직임만 입힌다. 화면 조작(INP)에 끼어들지 않는 것이 첫째 조건이다.
//  · 앱 배경(sky) = 15번가 거리: 하늘(셰이더) → 구름 · 열기구 → 먼 빌딩 숲 → 거리의 건물(탑을 끌어안은 예티 풍선 포함) → 밤 불빛의 번짐
//    → 가게 앞을 지나는 버스와 차 → 길을 걷는 핑크빈(왼쪽 → 오른쪽)과 스쿠터를 탄 NPC(오른쪽 → 왼쪽, 더 빠르게) → 헬리콥터.
//    그림 1칸 = 화면 1px 로 놓고(배율을 바꾸지 않는다) 아래 가운데를 화면 아래 가운데에 맞춘다.
//  · 무대(room) = 15번가 패션 매장 안: 창밖 거리 → 매장. 가운데 깔개가 캐릭터 발밑에 오고, 그림 1칸 = 캐릭터 도트 1칸이다 —
//    미리보기 배율을 올리면 방도 함께 커진다(정수 배율이라 칸을 그대로 키운다).
//  · 움직임: 구름 · 열기구 · 차가 따로 흘러가고(정점 셰이더에서 계산), 화면 전체가 아주 천천히 좌우로 흔들린다(층마다 폭이 다르다).
//  · 시각(skyTime): 하늘 · 해 · 달 · 별 · 별똥별 · 핑크빈 별자리, 그림에 곱하는 빛. 밤에는 하늘이 아니라 거리가 밝다 —
//    창에 노란 불이 켜지고 가로등 둘레와 길바닥이 노랗게 밝아진다(어느 창이 켜지고 어디가 밝은지는 미리 뽑아 둔 지도 street-glow 가 정한다).
//    네온처럼 밝고 진한 색도 제 빛을 지킨다.
//  · 그림은 화면이 한가할 때 받아 한 프레임에 한 장씩 올린다(디코딩은 createImageBitmap 으로 메인 스레드 밖에서).
//  · 초당 30번 그린다. '동작 줄이기'면 바뀔 때와 20초마다만 그린다. 탭이 가려지면 rAF 가 멈춘다.
//  · 캔버스와 컨텍스트는 종류마다 하나를 끝까지 재사용한다. 밝아지며 다가가는 연출은 처음 뜰 때 한 번뿐 —
//    탭을 오가며 다시 붙을 때는 그 자리에서 바로 보인다(전환이 밀리지 않게).

import roomFar from '@/assets/scene/room-far.webp'
import roomMain from '@/assets/scene/room-main.webp'
import streetAir from '@/assets/scene/street-air.webp'
import streetFar from '@/assets/scene/street-far.webp'
import streetGlow from '@/assets/scene/street-glow.webp'
import streetMain from '@/assets/scene/street-main.webp'
import { getStageFloor, onStageFloor } from '@/lib/stageFloor'
import { ROOM, STREET } from './sceneData'
import { skyHour, skyState, type SkyState } from './skyTime'

export type SceneKind = 'sky' | 'room'

const FRAME_MS = 33
const REDUCED_MS = 20000
const MAX_RATIO = 2      // 앱 배경 캔버스 해상도 상한(화면 배율)
const SWAY = 12          // 화면이 좌우로 흔들리는 폭(그림 픽셀)
const MASK = 0.2         // 앱 배경을 화면 내용과 가르는 어두운 막

// 정점: 자리(2) · 텍스처 좌표(2) · [종류, 위상(걷는 이는 그림 한 장의 텍스처 폭), 처음 x, 걷는 그림 장수](4)
// 종류 0 구름 · 1 열기구 · 2 헬리콥터 · 3 버스와 차 · 4 먼 빌딩 · 5 거리 · 6 무대의 창밖 · 7 무대 · 8 밤 불빛의 번짐 · 9 오른쪽으로 걷는 이 · 10 왼쪽으로 가는 이
const QUAD_VS = `
attribute vec2 aPos; attribute vec2 aUv; attribute vec4 aAni;
uniform vec4 uView; uniform vec2 uRes; uniform float uTime; uniform float uSway;
varying vec2 vUv; varying float vKind; varying vec2 vPos;
void main(){
  float k = aAni.x, ph = aAni.y;
  vec2 p = aPos, uv = aUv;
  if (k < 3.5) {
    float sp = k < .5 ? 3. + ph * 2. : k < 1.5 ? 1.5 + ph * 2.5 : k < 2.5 ? 7. + ph * 6. : 22. + ph * 16.;
    float pad = k < .5 ? 2155. : 400., per = k < .5 ? 6465. : k < 2.5 ? ${STREET.w + 500}. : ${(STREET.w + 500) * 2}.;   // 차는 드문드문
    p.x += mod(aAni.z + sp * uTime + pad, per) - pad - aAni.z;
    p.y += k < .5 ? 0. : k < 1.5 ? sin(uTime * .55 + ph * 6.283) * 5. : k < 2.5 ? sin(uTime * 1.3 + ph * 6.283) * 2.5 : 0.;
  } else if (k > 8.5) {
    // 길을 지나가는 이들: 한쪽 끝에서 나타나 반대쪽 끝으로 사라지고, 한참 뒤에 다시 나타난다(둘의 주기와 처음 자리가 달라 따로 나타난다)
    bool right = k < 9.5;
    float per = right ? ${STREET.w + 700}. : ${Math.round((STREET.w + 700) * 1.35)}.;
    float m = mod((right ? 24. : 46.) * uTime + (right ? 1250. : per - 700.), per);
    p.x += (right ? m - 350. : ${STREET.w + 350}. - m) - aAni.z;
    uv.x += floor(mod(uTime * 8., aAni.w)) * ph;
  }
  float par = k < .5 ? .15 : k < 1.5 ? .3 : k < 2.5 ? .6 : k < 3.5 ? 1. : k < 4.5 ? .5 : k < 5.5 ? 1. : k < 6.5 ? .25 : k < 7.5 ? 0. : 1.;
  p.x += uSway * par;
  vPos = p;
  vec2 c = p * uView.xy + uView.zw;          // 캔버스 픽셀(왼쪽 위 원점)
  gl_Position = vec4(c.x / uRes.x * 2. - 1., 1. - c.y / uRes.y * 2., 0., 1.);
  vUv = uv; vKind = k;
}`
const QUAD_FS = `
precision mediump float;
uniform sampler2D uTex; uniform sampler2D uGlow; uniform vec3 uAmb; uniform vec3 uCloud; uniform vec3 uHaze; uniform float uLamp; uniform float uMask; uniform float uTw;
uniform vec3 uFoot;   // 발 자리(그림 픽셀)와 그림자 반폭
varying vec2 vUv; varying float vKind; varying vec2 vPos;
void main(){
  vec4 t = texture2D(uTex, vUv);
  if (vKind > 7.5 && vKind < 8.5) {
    // 밤 불빛의 번짐: 가로등과 창 둘레의 공기가 노랗게 밝다(더하기)
    gl_FragColor = vec4(vec3(1., .72, .34) * t.g * uLamp * .2 * (1. - uMask), 0.);
    return;
  }
  if (t.a < .004) discard;
  vec3 c = t.rgb / t.a;
  float mx = max(c.r, max(c.g, c.b)), mn = min(c.r, min(c.g, c.b)), lum = dot(c, vec3(.3, .59, .11));
  vec3 lit;
  if (vKind < .5) lit = c * uCloud;
  else if (vKind > 6.5 && vKind < 7.5) {
    // 매장 안은 등불을 받아 바깥보다 덜 물든다. 아주 밝은 면(조명)은 느리게 일렁인다
    lit = c * mix(vec3(1.), uAmb, .3) + vec3(.03, .012, 0.) * uLamp;
    lit *= 1. + smoothstep(.9, .99, lum) * .07 * sin(uTw * 1.7 + vPos.x * .11 + vPos.y * .07);
    vec2 d = (vPos - uFoot.xy) / vec2(uFoot.z, uFoot.z * .26);
    lit *= 1. - .34 * smoothstep(1., .25, length(d));
  } else {
    lit = c * uAmb;
    // 밤: 밝고 진한 색(네온 · 간판)은 제 빛을 지킨다
    lit = mix(lit, c * 1.05 + .03, smoothstep(.6, .9, mx) * smoothstep(.2, .5, mx - mn) * uLamp);
    if (vKind > 4.5 && vKind < 5.5) {
      // 거리: 가로등과 창의 빛(g)을 받은 면은 제 색이 살아나고 노랗게 물든다. 불 켜진 창(r)은 통째로 노랗다
      vec2 gw = texture2D(uGlow, vUv).rg * uLamp;
      lit *= 1. + gw.y * 1.3;
      lit += vec3(1., .72, .34) * gw.y * .16;
      lit = mix(lit, vec3(1., .88, .56) * (.6 + .5 * lum), gw.x);
    } else if (vKind > 3.5 && vKind < 4.5) lit = mix(lit, uHaze, .3);
    else if ((vKind > 2.5 && vKind < 3.5) || vKind > 8.5) lit *= 1. + .75 * uLamp;   // 차와 행인은 가로등 아래에 있다
  }
  gl_FragColor = vec4(mix(lit, vec3(.09, .07, .16), uMask) * t.a, t.a);
}`
const SKY_VS = 'attribute vec2 aPos; void main(){ gl_Position = vec4(aPos, 0., 1.); }'
// 하늘: 네 단 그러데이션 · 해와 달 · 별 · 핑크빈 별자리. 좌표는 CSS px(왼쪽 위 원점)
const SKY_FS = `
precision mediump float;
uniform vec2 uRes; uniform float uPx; uniform vec3 uSky[4]; uniform vec3 uSun; uniform vec3 uMoon; uniform vec3 uSunCol; uniform float uNight; uniform float uTime; uniform float uMask;
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
  vec2 size = uRes / uPx;
  vec2 p = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) / uPx;
  float t = clamp(p.y / (size.y * .8), 0., 1.);
  vec3 col = t < .42 ? mix(uSky[0], uSky[1], t / .42) : (t < .78 ? mix(uSky[1], uSky[2], (t - .42) / .36) : mix(uSky[2], uSky[3], (t - .78) / .22));
  if (uNight > .01) {
    vec2 g = floor(p / 16.); float h = hash(g);
    vec2 o = (vec2(hash(g + 7.), hash(g + 13.)) - .5) * 10.;
    float tw = .6 + .4 * sin(uTime * (.8 + h * 2.) + h * 40.);
    col += vec3(1., .97, .9) * step(.8, h) * smoothstep(1.5, .3, length(p - (g + .5) * 16. - o)) * tw * uNight * (1. - smoothstep(.5, .9, t));
    for (int i = 0; i < 2; i++) {
      vec2 dn = pinkbean((p - vec2(i == 0 ? 78. : size.x - 78., i == 0 ? 44. : 48.)) * .52);
      float a = max(exp(-dn.x * dn.x * 4.) * .7, exp(-dn.y * dn.y * .3));
      col = mix(col, vec3(1., .86, .4), min(1., a) * uNight * (.75 + .25 * sin(uTime * 1.2 + float(i) * 2.)));
    }
  }
  if (uNight > .01) {
    // 별똥별: 아홉 초에 한 번쯤, 둘에 하나꼴로 위쪽 하늘을 가로지른다
    float id = floor(uTime / 9.), f = fract(uTime / 9.) * 7.;
    float h1 = hash(vec2(id, 3.)), h2 = hash(vec2(id, 11.));
    if (h1 > .5 && f < 1.) {
      vec2 dir = normalize(vec2(h2 > .5 ? 1. : -1., .42));
      vec2 head = vec2(size.x * (.15 + .7 * h2), 14. + 60. * hash(vec2(id, 5.))) + dir * f * 260.;
      float along = dot(p - head, -dir);
      float d = length(p - head + dir * clamp(along, 0., 70.));
      col += vec3(1., .96, .86) * exp(-d * d * .6) * (1. - clamp(along, 0., 70.) / 70.) * sin(f * 3.1416) * uNight;
    }
  }
  vec2 m = p - uMoon.xy;
  col = mix(col, vec3(.78, .84, 1.), exp(-length(m) * .03) * .4 * uMoon.z);
  col = mix(col, vec3(1., .97, .84), smoothstep(15., 13.5, length(m)) * smoothstep(11., 12.5, length(m - vec2(7., -5.))) * uMoon.z);
  vec2 s = p - uSun.xy;
  col = mix(col, uSunCol, exp(-length(s) * .016) * .6 * uSun.z);
  col = mix(col, mix(uSunCol, vec3(1.), .7), smoothstep(19., 17., length(s)) * uSun.z);
  gl_FragColor = vec4(mix(col, vec3(.09, .07, .16), uMask), 1.);
}`

type Uni = Record<string, WebGLUniformLocation | null>
interface Scene {
  kind: SceneKind
  canvas: HTMLCanvasElement
  gl: WebGLRenderingContext | null
  quad: { prog: WebGLProgram; u: Uni; buf: WebGLBuffer } | null
  sky: { prog: WebGLProgram; u: Uni; buf: WebGLBuffer } | null
  ranges: number[][]             // 종류별 [첫 정점, 개수]
  bmps: (ImageBitmap | HTMLImageElement | null)[]
  tex: (WebGLTexture | null)[]
  pending: number[]              // 아직 올리지 않은 그림 번호
  host: HTMLElement | null
  ratio: number                  // 캔버스 픽셀 / CSS 픽셀
  foot: [number, number]         // 무대: 발 자리(캔버스 픽셀)
  px: number                     // 무대: 그림 1칸의 캔버스 픽셀 수(= 캐릭터 도트 1칸)
  nearest: boolean               // 무대: 지금 텍스처 필터
  shadow: number                 // 무대: 발밑 그림자 반폭(그림 픽셀)
  arrive: number                 // 0 → 1: 처음 뜨면서 살짝 다가간다
  shown: boolean
  dirty: boolean
  at: number
  failed: boolean
  cleanup: (() => void) | null
}

const SOURCES: Record<SceneKind, string[]> = { sky: [streetAir.src, streetFar.src, streetMain.src, streetGlow.src], room: [roomFar.src, roomMain.src] }
const scenes: Partial<Record<SceneKind, Scene>> = {}
let raf = 0
let last = 0
let reduce: MediaQueryList | null = null

function program(gl: WebGLRenderingContext, vs: string, fs: string, names: string[]) {
  const mk = (type: number, src: string) => { const s = gl.createShader(type)!; gl.shaderSource(s, src); gl.compileShader(s); return s }
  const prog = gl.createProgram()!
  gl.attachShader(prog, mk(gl.VERTEX_SHADER, vs)); gl.attachShader(prog, mk(gl.FRAGMENT_SHADER, fs))
  gl.bindAttribLocation(prog, 0, 'aPos'); gl.bindAttribLocation(prog, 1, 'aUv'); gl.bindAttribLocation(prog, 2, 'aAni')
  gl.linkProgram(prog)
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    if (process.env.NODE_ENV !== 'production') console.warn('[scene]', gl.getProgramInfoLog(prog), gl.getShaderInfoLog(gl.getAttachedShaders(prog)![0]), gl.getShaderInfoLog(gl.getAttachedShaders(prog)![1]))
    return null
  }
  const u: Uni = {}
  for (const n of names) u[n] = gl.getUniformLocation(prog, n)
  return { prog, u }
}

// 사각형 목록 → 정점 배열. 종류순으로 놓고 종류별 범위를 적어 둔다.
const STRIDE = 8
function mesh(kind: SceneKind) {
  const out: number[] = [], ranges: number[][] = []
  const quad = (k: number, ph: number, x: number, y: number, w: number, h: number, u0: number, v0: number, u1: number, v1: number, frames = 0) => {
    const r = (ranges[k] ??= [out.length / STRIDE, 0])
    r[1] += 6
    for (const [cx, cy] of [[0, 0], [1, 0], [0, 1], [1, 0], [1, 1], [0, 1]]) out.push(x + cx * w, y + cy * h, cx ? u1 : u0, cy ? v1 : v0, k, ph, x, frames)
  }
  if (kind === 'sky') {
    const [aw, ah] = STREET.atlas
    STREET.sprites.forEach(([k, ax, ay, w, h, x, y, frames, pitch], i) => quad(k, frames ? pitch / aw : (i * 0.618034) % 1, x, y, w, h, ax / aw, ay / ah, (ax + w) / aw, (ay + h) / ah, frames))
    quad(4, 0, 0, STREET.far.y, STREET.w, STREET.far.h, 0, 0, 1, 1)
    quad(5, 0, 0, STREET.main.y, STREET.w, STREET.main.h, 0, 0, 1, 1)
    quad(8, 0, 0, STREET.main.y, STREET.w, STREET.main.h, 0, 0, 1, 1)
  } else {
    quad(6, 0, 0, 0, ROOM.w, ROOM.h, 0, 0, 1, 1)
    quad(7, 0, 0, 0, ROOM.w, ROOM.h, 0, 0, 1, 1)
  }
  return { verts: new Float32Array(out), ranges }
}

// 셰이더 · 정점 버퍼를 올린다. 컨텍스트를 되찾았을 때도 다시 부른다(그림은 다시 올린다).
function init(sc: Scene) {
  const gl = sc.gl
  if (!gl) return
  if (sc.kind === 'sky' && gl.getParameter(gl.MAX_TEXTURE_SIZE) < STREET.w) { sc.failed = true; return }
  const qp = program(gl, QUAD_VS, QUAD_FS, ['uView', 'uRes', 'uTime', 'uTw', 'uSway', 'uTex', 'uGlow', 'uAmb', 'uCloud', 'uHaze', 'uLamp', 'uMask', 'uFoot'])
  const sp = sc.kind === 'sky' ? program(gl, SKY_VS, SKY_FS, ['uRes', 'uPx', 'uSky', 'uSun', 'uMoon', 'uSunCol', 'uNight', 'uTime', 'uMask']) : null
  if (!qp || (sc.kind === 'sky' && !sp)) { sc.failed = true; return }
  const m = mesh(sc.kind)
  const buf = gl.createBuffer()!
  gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, m.verts, gl.STATIC_DRAW)
  sc.quad = { ...qp, buf }; sc.ranges = m.ranges
  if (sp) {
    const sb = gl.createBuffer()!
    gl.bindBuffer(gl.ARRAY_BUFFER, sb); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
    sc.sky = { ...sp, buf: sb }
  }
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true)
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
  sc.tex = sc.bmps.map(() => null)
  sc.pending = sc.bmps.map((b, i) => (b ? i : -1)).filter((i) => i >= 0)
  sc.nearest = false
  sc.dirty = true
}

// 그림 한 장을 텍스처로. 한 프레임에 한 장만 올린다(큰 그림을 한꺼번에 올리면 프레임이 끊긴다).
function upload(sc: Scene) {
  const gl = sc.gl, i = sc.pending.shift()
  if (!gl || i == null) return
  const t = gl.createTexture()
  gl.bindTexture(gl.TEXTURE_2D, t)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, sc.bmps[i]!)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  sc.tex[i] = t
  sc.dirty = true
}

function load(sc: Scene) {
  SOURCES[sc.kind].forEach((src, i) => {
    const done = (b: ImageBitmap | HTMLImageElement) => { sc.bmps[i] = b; if (sc.quad && !sc.tex[i] && !sc.pending.includes(i)) sc.pending.push(i) }
    const viaImg = () => { const img = new Image(); img.decoding = 'async'; img.onload = () => done(img); img.src = src }
    if (typeof createImageBitmap !== 'function') { viaImg(); return }
    fetch(src).then((r) => r.blob()).then((b) => createImageBitmap(b, { premultiplyAlpha: 'premultiply' })).then(done).catch(viaImg)
  })
}

function create(kind: SceneKind): Scene {
  const canvas = document.createElement('canvas')
  canvas.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;display:block;opacity:0;pointer-events:none'
  const sc: Scene = { kind, canvas, gl: null, quad: null, sky: null, ranges: [], bmps: SOURCES[kind].map(() => null), tex: [], pending: [], host: null, ratio: 1, foot: [0, 0], px: 1, nearest: false, shadow: 13, arrive: 0, shown: false, dirty: true, at: 0, failed: false, cleanup: null }
  // 소프트웨어 렌더러(GPU 없음)면 쓰지 않는다. 그때는 바탕색만 남는다. (?skygl=soft 는 GPU 없는 확인 환경에서 강제로 켜는 용도)
  const soft = /[?&]skygl=soft/.test(window.location.search)
  const gl = canvas.getContext('webgl', { alpha: false, antialias: false, depth: false, stencil: false, powerPreference: 'low-power', failIfMajorPerformanceCaveat: !soft })
  if (!gl) { sc.failed = true; return sc }
  sc.gl = gl
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); sc.quad = null; sc.sky = null; sc.tex = []; sc.pending = [] })
  canvas.addEventListener('webglcontextrestored', () => init(sc))
  init(sc)
  if (!sc.failed) load(sc)
  return sc
}

// 캔버스 크기와(무대라면) 캐릭터 발 자리 · 배율.
function layout(sc: Scene) {
  const host = sc.host
  if (!host) return
  const hw = host.clientWidth, hh = host.clientHeight
  if (!hw || !hh) return
  const dpr = window.devicePixelRatio || 1
  const r = (sc.ratio = sc.kind === 'room' ? dpr : Math.min(dpr, MAX_RATIO))
  const c = sc.canvas, w = Math.round(hw * r), h = Math.round(hh * r)
  if (c.width !== w) c.width = w
  if (c.height !== h) c.height = h
  if (sc.kind === 'room') {
    const f = getStageFloor()
    if (f && f.wrap.isConnected && host.parentElement?.contains(f.wrap)) {
      const wr = f.wrap.getBoundingClientRect(), hr = host.getBoundingClientRect()
      sc.foot = [Math.round((wr.left - hr.left + f.cx) * r), Math.round((wr.top - hr.top + f.footY) * r)]
      sc.px = f.scale; sc.shadow = f.shadow
    } else {
      // 캐릭터가 아직 안 그려졌을 때: 그려질 자리와 거의 같은 값으로 미리 잡는다.
      sc.px = Math.max(1, Math.round(dpr))
      sc.foot = [Math.round((hw / 2) * r), Math.round((hh / 2 + 38.4) * r)]
    }
  }
  sc.dirty = true
}

// 해·달의 자리(CSS px). 앱 배경은 위쪽 띠와 양옆만 보이니 위쪽에 둔다.
function orb(phase: number, w: number): [number, number, number] {
  if (phase <= 0 || phase >= 1) return [0, 0, 0]
  const s = Math.sin(Math.PI * phase)
  return [(0.1 + 0.8 * phase) * w, 34 + (1 - s) * 130, Math.min(1, s * 6)]
}

function draw(sc: Scene, now: number, st: SkyState, still: boolean) {
  const gl = sc.gl, q = sc.quad, c = sc.canvas
  if (!gl || !q || sc.tex.length < SOURCES[sc.kind].length || sc.tex.some((t) => !t)) return
  const s = still ? 40 : now / 1000, W = c.width, H = c.height, room = sc.kind === 'room'
  sc.arrive = still ? 1 : Math.min(1, sc.arrive + 0.035)
  const ease = 1 - Math.pow(1 - sc.arrive, 3), zoom = 1 + 0.03 * (1 - ease)
  if (room) {
    // 다가가는 동안만 부드럽게, 멈추면 칸을 그대로(캐릭터 도트와 같은 결)
    const nearest = sc.arrive >= 1 && Number.isInteger(sc.px)
    if (nearest !== sc.nearest) {
      sc.nearest = nearest
      const f = nearest ? gl.NEAREST : gl.LINEAR
      for (const t of sc.tex) { gl.bindTexture(gl.TEXTURE_2D, t); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, f); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, f) }
    }
  }
  gl.viewport(0, 0, W, H)
  gl.enableVertexAttribArray(0)
  const mask = room ? 0 : MASK
  if (sc.sky) {
    const k = sc.sky, cw = W / sc.ratio, moon = orb(st.moonPhase, cw)
    moon[2] *= Math.min(1, st.night * 1.6)
    gl.disable(gl.BLEND)
    gl.disableVertexAttribArray(1); gl.disableVertexAttribArray(2)
    gl.useProgram(k.prog)
    gl.bindBuffer(gl.ARRAY_BUFFER, k.buf); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)
    gl.uniform2f(k.u.uRes, W, H); gl.uniform1f(k.u.uPx, sc.ratio); gl.uniform3fv(k.u.uSky, st.sky.flat()); gl.uniform3fv(k.u.uSun, orb(st.sunPhase, cw)); gl.uniform3fv(k.u.uMoon, moon)
    gl.uniform3fv(k.u.uSunCol, st.sun); gl.uniform1f(k.u.uNight, st.night); gl.uniform1f(k.u.uTime, s); gl.uniform1f(k.u.uMask, mask)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
  } else { gl.clearColor(0.085, 0.075, 0.075, 1); gl.clear(gl.COLOR_BUFFER_BIT) }
  gl.enable(gl.BLEND)
  gl.enableVertexAttribArray(1); gl.enableVertexAttribArray(2)
  gl.useProgram(q.prog)
  gl.bindBuffer(gl.ARRAY_BUFFER, q.buf)
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, STRIDE * 4, 0); gl.vertexAttribPointer(1, 2, gl.FLOAT, false, STRIDE * 4, 8); gl.vertexAttribPointer(2, 4, gl.FLOAT, false, STRIDE * 4, 16)
  // 그림 픽셀 → 캔버스 픽셀: c = p * k + o
  let k: number, ox: number, oy: number
  if (room) { k = sc.px * zoom; ox = sc.foot[0] - ROOM.foot[0] * k; oy = sc.foot[1] - ROOM.foot[1] * k }
  else { k = sc.ratio * Math.max(1, W / sc.ratio / (STREET.w - 4 * SWAY)) * zoom; ox = W / 2 - (STREET.w / 2) * k; oy = H - STREET.h * k }
  gl.uniform4f(q.u.uView, k, k, ox, oy); gl.uniform2f(q.u.uRes, W, H); gl.uniform1f(q.u.uTime, s); gl.uniform1f(q.u.uTw, s % 600)
  gl.uniform1f(q.u.uSway, still ? 0 : Math.sin(s * 0.09) * SWAY)
  // 불빛 지도는 1번 자리에(거리만 읽는다. 무대는 아무 그림이나 물려 둔다)
  gl.uniform1i(q.u.uGlow, 1); gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, sc.tex[room ? 0 : 3])
  gl.uniform1i(q.u.uTex, 0); gl.activeTexture(gl.TEXTURE0)
  // 밤의 거리는 하늘빛보다 조금 더 가라앉힌다 — 그래야 창과 가로등의 불빛이 살아난다
  const dim = 1 - 0.3 * st.night
  gl.uniform3f(q.u.uAmb, st.amb[0] * dim, st.amb[1] * dim, st.amb[2] * dim)
  gl.uniform3fv(q.u.uCloud, st.cloudA)
  gl.uniform3fv(q.u.uHaze, st.sky[2].map((v, i) => (v + st.sky[3][i]) / 2))
  gl.uniform1f(q.u.uLamp, st.lamp); gl.uniform1f(q.u.uMask, mask)
  gl.uniform3f(q.u.uFoot, ROOM.foot[0], ROOM.foot[1] + 1, sc.shadow)
  const part = (tex: number, kinds: number[]) => {
    gl.bindTexture(gl.TEXTURE_2D, sc.tex[tex])
    for (const kd of kinds) { const r = sc.ranges[kd]; if (r) gl.drawArrays(gl.TRIANGLES, r[0], r[1]) }
  }
  if (room) { part(0, [6]); part(1, [7]) }
  else { part(0, [0, 1]); part(1, [4]); part(2, [5]); part(3, [8]); part(0, [3, 9, 10, 2]) }
  sc.dirty = false
  sc.at = now
  if (!sc.shown) { sc.shown = true; c.style.transition = 'opacity .45s ease'; c.style.opacity = '1' }
}

function tick(now: number) {
  raf = requestAnimationFrame(tick)
  const still = !!reduce?.matches
  for (const sc of Object.values(scenes)) if (sc && sc.host && sc.pending.length) { upload(sc); break } // 한 프레임에 한 장
  if (now - last < FRAME_MS) return
  last = now
  let st: SkyState | null = null
  for (const sc of Object.values(scenes)) {
    if (!sc || !sc.host || !sc.quad) continue
    if (still && !sc.dirty && now - sc.at < REDUCED_MS) continue
    draw(sc, now, st ?? (st = skyState(skyHour())), still)
  }
}

// host 안에 장면을 붙인다. 돌려주는 함수로 뗀다(캔버스·컨텍스트는 남겨 두었다가 다시 쓴다).
export function mountScene(kind: SceneKind, host: HTMLElement): () => void {
  const sc = scenes[kind] ?? (scenes[kind] = create(kind))
  if (sc.failed) return () => {}
  sc.cleanup?.()
  sc.host = host
  // 처음 뜰 때만 어두운 바탕에서 밝아지며 살짝 다가간다. 이미 떠 있던 장면은 다시 붙자마자 그린다(아래)
  const again = sc.shown
  if (!again) { sc.canvas.style.transition = 'none'; sc.canvas.style.opacity = '0'; sc.arrive = 0 }
  host.appendChild(sc.canvas)
  const relayout = () => layout(sc)
  const ro = new ResizeObserver(relayout)
  ro.observe(host)
  window.addEventListener('resize', relayout)
  const off = kind === 'room' ? onStageFloor(relayout) : null
  sc.cleanup = () => {
    ro.disconnect(); window.removeEventListener('resize', relayout); off?.()
    sc.canvas.remove(); sc.host = null; sc.cleanup = null
    if (!Object.values(scenes).some((s) => s?.host)) { cancelAnimationFrame(raf); raf = 0 }
  }
  layout(sc)
  reduce ??= window.matchMedia('(prefers-reduced-motion: reduce)')
  if (again) draw(sc, performance.now(), skyState(skyHour()), reduce.matches) // 빈 프레임 없이
  if (!raf) raf = requestAnimationFrame(tick)
  const mine = sc.cleanup
  return () => { if (sc.cleanup === mine) mine() }
}
