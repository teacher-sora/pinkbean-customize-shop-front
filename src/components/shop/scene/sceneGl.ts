// 배경 장면을 그리는 WebGL 실행기. 그림은 게임 맵에서 뽑은 것(메이플 15번가)이고, 여기서는 층을 겹쳐 놓고
// 시각에 따른 색과 작은 움직임만 입힌다. 화면 조작(INP)에 끼어들지 않는 것이 첫째 조건이다.
//  · 앱 배경(sky) = 15번가 거리: 하늘(셰이더) → 구름 · 열기구 → 먼 빌딩 숲 → 거리의 건물(탑을 끌어안은 예티 풍선 포함) → 밤 불빛의 번짐
//    → 길을 걷는 이들 → 헬리콥터. 그림 1칸 = 화면 1px 로 놓고(배율을 바꾸지 않는다) 아래 가운데를 화면 아래 가운데에 맞춘다.
//    흔들림과 하늘의 것들은 끊지 않고 매끄럽게 흘려보내고(칸 사이는 부드럽게 섞인다), 걷는 캐릭터만 화면 픽셀에 맞춰 놓는다 —
//    도트 캐릭터는 반 칸씩 걸치면 뭉개져 보이고, 큰 그림은 한 칸씩 끊기면 딱딱해 보인다.
//  · 지나가는 것들(열기구 · 헬리콥터 · 걷는 이들)은 저마다 화면 한쪽 끝에서 나타나 반대쪽으로 사라지고, 화면에서 완전히 사라진 뒤
//    쉬었다가 다시 나타난다. 나타날 때마다 방향 · 빠르기 · 쉬는 시간을 정해진 범위 안에서 새로 뽑는다(MOVE). 걷는 이는 가끔 멈춰 선다.
//    자리 계산은 여기(JS)서 한다: 열 개 남짓의 덧셈이고, 셰이더에는 유니폼 배열 하나(uMov)로 넘긴다.
//  · 무대(room) = 15번가 패션 매장 안: 창밖 거리 → 매장. 가운데 깔개가 캐릭터 발밑에 오고, 그림 1칸 = 캐릭터 도트 1칸이다 —
//    미리보기 배율을 올리면 방도 함께 커진다(정수 배율이라 칸을 그대로 키운다).
//  · 움직임: 구름 · 열기구 · 차가 따로 흘러가고(정점 셰이더에서 계산), 화면 전체가 아주 천천히 좌우로 흔들린다(층마다 폭이 다르다).
//  · 시각(skyTime): 하늘 · 해 · 달 · 별 · 별똥별 · 핑크빈 별자리, 그림에 곱하는 빛. 밤에는 하늘이 아니라 거리가 밝다 —
//    그림을 덧칠하지 않고 밝기만 올린다: 길에서 가게 높이까지 은은하게, 가로등 둘레는 더, 창유리 자리는 조금 더 밝고 따뜻하게
//    (어디가 밝은지는 미리 뽑아 둔 지도 street-glow 가 정한다). 네온처럼 밝고 진한 색도 제 빛을 지킨다.
//  · 그림은 화면이 한가할 때 받아 한 프레임에 한 장씩 올린다(디코딩은 createImageBitmap 으로 메인 스레드 밖에서).
//  · 앱 배경은 초당 60번까지(느린 움직임이 끊겨 보이지 않게), 무대는 30번 그린다. 프레임마다 하는 일은 유니폼 몇 개와 그리기 호출 대여섯 번뿐이고
//    움직임은 전부 정점 셰이더가 시간으로 계산한다. '동작 줄이기'면 바뀔 때와 20초마다만 그린다. 탭이 가려지면 rAF 가 멈춘다.
//  · 캔버스와 컨텍스트는 종류마다 하나를 끝까지 재사용한다. 밝아지며 다가가는 연출은 처음 뜰 때 한 번뿐 —
//    탭을 오가며 다시 붙을 때는 그 자리에서 바로 보인다(전환이 밀리지 않게).

import roomFar from '@/assets/scene/room-far.webp'
import roomMain from '@/assets/scene/room-main.webp'
import streetAir from '@/assets/scene/street-air.webp'
import streetFar from '@/assets/scene/street-far.webp'
import streetGlow from '@/assets/scene/street-glow.webp'
import streetMain from '@/assets/scene/street-main.webp'
import streetTower from '@/assets/scene/street-tower.webp'
import { getStageFloor, onStageFloor } from '@/lib/stageFloor'
import { ROOM, STREET } from './sceneData'
import { onSkyChange, skyNow, type SkyState } from './skyTime'

export type SceneKind = 'sky' | 'room'

const FRAME_MS: Record<SceneKind, number> = { sky: 14, room: 31 }   // 다시 그리는 최소 간격(주사율이 높은 화면에서도 60번 · 30번을 넘지 않게)
const REDUCED_MS = 20000
const MAX_RATIO = 2      // 앱 배경 캔버스 해상도 상한(화면 배율)
const SWAY = 12          // 화면이 좌우로 흔들리는 폭(그림 픽셀)
const HELI_UP = 150      // 헬리콥터를 원래 자리보다 올려 띄우는 높이(그림 픽셀) — 열기구와 같은 하늘 높이
const HELI_SIZE = 0.75    // 헬리콥터 크기(원래 그림에 견준 배율)
const NIGHT_DIM = 0.18   // 밤에 앱 배경 전체를 가라앉히는 양(한밤 기준. 너무 밝다는 지적)
const MASK = 0.2         // 앱 배경을 화면 내용과 가르는 어두운 막

// 정점: 자리(2) · 텍스처 좌표(2) · [종류, 위상 | 지나가는 것의 번호, 처음 x | 그림이 보는 쪽(-1 왼쪽 · 0 뒤집지 않음), 걷는 그림 한 장의 텍스처 폭](4)
// 종류 0 구름 · 1 열기구 · 2 헬리콥터 · 3 이벤트 열기구(가운데 탑과 거리의 건물 사이에 뜬다) · 4 먼 빌딩 · 5 거리 · 6 무대의 창밖 · 7 무대 · 8 밤 불빛의 번짐 · 9 걷는 이 · 10 가운데 탑
//      · 11 열기구의 밤 그림(속에서 빛난다. 낮 그림 위에 겹쳐 두고 밤에만 드러낸다)
// 지나가는 것들(1 · 2 · 9 · 11)의 자리는 uMov[번호] = (가운데 x, y 를 옮긴 만큼, 걷는 그림 번호, 가는 쪽 ±1 — 멈춰 서 있으면 ±2). 정점의 x 는 가운데에서의 거리다.
const MAX_MOVERS = 12
const QUAD_VS = `
attribute vec2 aPos; attribute vec2 aUv; attribute vec4 aAni;
uniform vec4 uView; uniform vec2 uRes; uniform float uTime; uniform float uSway; uniform vec4 uMov[${MAX_MOVERS}];
varying vec2 vUv; varying float vKind; varying vec2 vPos; varying vec2 vGuv;
void main(){
  float kind = aAni.x;
  float k = kind > 10.5 || (kind > 2.5 && kind < 3.5) ? 1. : kind;   // 이벤트 열기구(3)와 그 밤 그림(11)은 열기구와 똑같이 움직인다
  vec2 p = aPos, uv = aUv;
  float snap = 0.;   // 걷는 이: 그림의 왼쪽 끝이 놓일 캔버스 x(맞추기 전)
  float still = 0.;  // 걷는 이가 멈춰 서 있는가
  if (k < .5) {
    float sp = 3. + aAni.y * 2.;
    p.x += mod(aAni.z + sp * uTime + 2155., 6465.) - 2155. - aAni.z;
  } else if (k < 2.5 || (k > 8.5 && k < 9.5)) {
    vec4 m = uMov[int(aAni.y + .5)];
    p = vec2(m.x + aPos.x * (aAni.z == 0. ? 1. : sign(m.w) * aAni.z), aPos.y + m.y);   // 가는 쪽을 보도록 뒤집는다
    uv.x += m.z * aAni.w;
    snap = (m.x - abs(aPos.x)) * uView.x + uView.z;
    still = abs(m.w) > 1.5 ? 1. : 0.;
  }
  // 화면의 느린 좌우 흔들림(깊이감). 거리와 걷는 이는 제자리에 두고 뒤의 층만 반대쪽으로 민다 — 층 사이의 어긋남은 그대로이고,
  // 길 위의 캐릭터가 화면 픽셀에 맞은 채로 가만히 있을 수 있다(거리째 흔들면 서 있는 캐릭터가 한 칸씩 끌려가거나 흐려진다).
  float par = k < .5 ? -.85 : k < 2.5 ? -.7 : k < 4.5 ? -.5 : k < 5.5 ? 0. : k < 6.5 ? .25 : 0.;   // 탑(10)도 거리처럼 제자리
  p.x += uSway * par;
  vPos = p;
  vec2 c = p * uView.xy + uView.zw;          // 캔버스 픽셀(왼쪽 위 원점)
  // 걷는 캐릭터는 서 있을 때만 화면 픽셀에 맞춘다(또렷하게). 걷는 동안은 맞추지 않는다 — 한 칸씩 끊어 옮기면 걸음이 덜컥거린다.
  // 꼭짓점마다 따로 반올림하면 폭이 한 칸씩 늘었다 줄므로 그림 전체를 같은 만큼 옮긴다
  if (k > 8.5 && k < 9.5 && still > .5) c.x += floor(snap + .5) - snap;
  gl_Position = vec4(c.x / uRes.x * 2. - 1., 1. - c.y / uRes.y * 2., 0., 1.);
  // 가운데 탑(10)은 거리(5)와 똑같이 칠한다. 불빛 지도는 거리 그림 자리에 맞춰 있어 탑은 제 자리로 읽을 곳을 따로 계산한다
  bool tower = kind > 9.5 && kind < 10.5;
  vGuv = tower ? (aPos - vec2(0., ${STREET.main.y}.)) / vec2(${STREET.w}., ${STREET.main.h}.) : aUv;
  vUv = uv; vKind = kind > 10.5 ? kind : tower ? 5. : k;
}`
const QUAD_FS = `
precision mediump float;
uniform sampler2D uTex; uniform sampler2D uGlow; uniform vec3 uAmb; uniform vec3 uCloud; uniform vec3 uHaze; uniform float uLamp; uniform float uMask; uniform float uTw; uniform vec4 uDim;   // 밤의 전체 밝기(rgb 에만 곱한다)
uniform vec3 uFoot;   // 발 자리(그림 픽셀)와 그림자 반폭
varying vec2 vUv; varying float vKind; varying vec2 vPos; varying vec2 vGuv;
void main(){
  vec4 t = texture2D(uTex, vUv);
  if (vKind > 7.5 && vKind < 8.5) {
    // 밤 불빛의 번짐: 창 · 간판 · 가로등 둘레에 빛무리가 지고(b), 그 빛이 닿는 공기도 조금 밝다(g). 더하기. 위로 갈수록 스러진다(지도에서)
    gl_FragColor = uDim * vec4(vec3(1., .74, .38) * (t.b * .34 + t.g * .07) * uLamp * ${(1 - MASK).toFixed(2)}, 0.);
    return;
  }
  if (t.a < .004) discard;
  vec3 c = t.rgb / t.a;
  if (vKind > 10.5) {
    // 열기구의 밤 그림: 제 빛 그대로, 밤이 깊을수록 드러난다
    float nf = smoothstep(.45, .95, uLamp) * t.a;
    gl_FragColor = uDim * vec4(mix(c, vec3(.09, .07, .16), uMask * .5) * nf, nf);
    return;
  }
  float mx = max(c.r, max(c.g, c.b)), mn = min(c.r, min(c.g, c.b)), lum = dot(c, vec3(.3, .59, .11));
  vec3 lit;
  float keep = 0.;   // 불빛을 받는 곳(창유리 · 빛이 닿은 벽과 길)은 막이 걷혀도 막이 있을 때의 밝기에 머문다 — 이미 가장 밝은 곳이라 더 밝아지면 하얗게 날아간다
  if (vKind < .5) lit = c * uCloud;
  else if (vKind > 6.5 && vKind < 7.5) {
    // 매장 안은 등불을 받아 바깥보다 덜 물든다. 아주 밝은 면(조명)은 느리게 일렁인다
    lit = c * mix(vec3(1.), uAmb, .3) + vec3(.03, .012, 0.) * uLamp;
    lit *= 1. + smoothstep(.9, .99, lum) * .07 * sin(uTw * 1.7 + vPos.x * .11 + vPos.y * .07);
    vec2 d = (vPos - uFoot.xy) / vec2(uFoot.z, uFoot.z * .26);
    lit *= 1. - .34 * smoothstep(1., .25, length(d));
  } else {
    lit = c * uAmb;
    if (vKind > 3.5 && vKind < 5.5) {
      // 건물 — 밤: 밝고 진한 색(네온 · 간판)은 제 빛을 지킨다
      lit = mix(lit, c * 1.05 + .03, smoothstep(.6, .9, mx) * smoothstep(.2, .5, mx - mn) * uLamp);
      if (vKind > 4.5) {
        // 거리: 건물의 창 · 간판 · 가로등에서 나온 빛(g)을 받은 면은 제 색이 살아나고 살짝 노랗게 물든다.
        // 창유리 자리(r)는 스스로 빛난다 — 안이 보이는 채로 더 밝고 따뜻하다
        vec2 gr = texture2D(uGlow, vGuv).rg;
        vec2 gw = gr * uLamp;
        keep = min(1., max(gr.x, gr.y * 2.)) * smoothstep(0., .25, uLamp);
        lit *= 1. + gw.y * 1.45;
        lit += vec3(1., .72, .34) * gw.y * .1;
        lit = mix(lit, mix(c, vec3(1., .9, .62) * (lum * 1.2 + .1), .45) * 1.12, gw.x * .9);
      } else lit = mix(lit, uHaze, .3);
    }
    // 캐릭터와 열기구는 색을 고르게 다룬다(부분만 밝히면 얼룩져 보인다).
    // 걷는 이들: 한낮에는 제 색 그대로 가장 밝고, 밤으로 갈수록 가로등 빛에 조금 가라앉는다. 어두운 막은 씌우지 않는다
    else if (vKind > 8.5) { gl_FragColor = uDim * vec4(c * mix(vec3(1.), vec3(.98, .93, .86), uLamp) * t.a, t.a); return; }
    else if (vKind < 1.5) lit = c * mix(uAmb, vec3(1.), .5 * uLamp);
  }
  gl_FragColor = uDim * vec4(mix(lit, vec3(.09, .07, .16), mix(uMask, ${MASK.toFixed(2)}, keep)) * t.a, t.a);
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
  gl_FragColor = vec4(mix(col, vec3(.09, .07, .16), uMask) * (1. - ${NIGHT_DIM} * uNight), 1.);
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
  mask: number                   // 지금의 어두운 막(배경만 볼 때는 걷힌다)
  movers: Mover[] | null         // 지나가는 것들(처음 그릴 때 화면 폭을 보고 놓는다)
  mov: Float32Array
  shown: boolean
  dirty: boolean
  at: number
  failed: boolean
  cleanup: (() => void) | null
}

// 지나가는 것 하나. type 0 열기구 · 1 헬리콥터 · 2 걷는 이
interface Mover { type: number; w: number; mult: number; frames: number; x: number; dir: number; speed: number; wait: number; jit: number; ph: number; walk: number; pauseAt: number; pause: number }
// 종류별 범위: 빠르기(그림 칸/초) · 화면에서 사라진 뒤 쉬는 시간(초) · 나타날 때마다 높이를 바꾸는 폭(칸).
// 열기구는 핑크빈 열기구가 기준이고 주황버섯은 그 0.75배, 슈피겔만은 1.25배다(mult). 걷는 이는 핑크빈이 느리고(mult 0.75) 아이돌이 빠르다.
const MOVE = [
  { speed: [4.2, 6], gap: [4, 26], jit: 26 },
  { speed: [9, 16], gap: [14, 60], jit: 24 },
  { speed: [26, 42], gap: [25, 95], jit: 0 },   // 걷는 이는 여섯이라 저마다 오래 쉰다 — 거리에 한둘만 보이게
]
const PAUSE = { chance: 0.5, sec: [3, 6] }    // 걷는 이가 도중에 멈춰 서는 비율과 시간
const rnd = (r: number[]) => r[0] + Math.random() * (r[1] - r[0])
let moverDefs: Omit<Mover, 'x' | 'dir' | 'speed' | 'wait' | 'jit' | 'walk' | 'pauseAt' | 'pause'>[] = []

function spawn(m: Mover, left: number, right: number) {
  const edge = SWAY + 4 + m.w / 2
  m.dir = Math.random() < 0.5 ? -1 : 1
  m.speed = rnd(MOVE[m.type].speed) * m.mult
  m.x = m.dir > 0 ? left - edge : right + edge
  m.jit = (Math.random() * 2 - 1) * MOVE[m.type].jit
  m.walk = 0; m.pause = 0
  m.pauseAt = m.type === 2 && Math.random() < PAUSE.chance ? left + (0.2 + 0.6 * Math.random()) * (right - left) : NaN
}
function initMovers(left: number, right: number): Mover[] {
  const count = [0, 0, 0], seen = [0, 0, 0]
  for (const d of moverDefs) count[d.type]++
  const first = Math.floor(Math.random() * count[2])   // 걷는 이 가운데 곧바로 들어올 하나
  return moverDefs.map((d) => {
    const m: Mover = { ...d, x: -1e5, dir: 1, speed: 0, wait: 0, jit: 0, walk: 0, pauseAt: NaN, pause: 0 }
    const i = seen[d.type]++
    spawn(m, left, right)
    // 처음: 열기구는 하늘에 고루 떠 있고, 헬리콥터 하나도 떠 있다. 걷는 이는 하나가 곧 들어오고 나머지는 사이를 두고 온다
    if (d.type === 0) m.x = left + ((i + 0.15 + 0.7 * Math.random()) / count[0]) * (right - left)
    else if (d.type === 1 && i === 0) m.x = left + (0.2 + 0.6 * Math.random()) * (right - left)
    else if (d.type === 2) m.wait = i === first ? 1 + Math.random() * 3 : 6 + Math.random() * MOVE[2].gap[1] * 1.3
    else m.wait = rnd(MOVE[d.type].gap)
    return m
  })
}
function stepMovers(sc: Scene, dt: number, s: number, left: number, right: number) {
  const list = (sc.movers ??= initMovers(left, right)), out = sc.mov
  list.forEach((m, i) => {
    if (m.wait > 0) { m.wait -= dt; if (m.wait <= 0) spawn(m, left, right) }
    else {
      if (m.pause > 0) m.pause -= dt
      else {
        const nx = m.x + m.dir * m.speed * dt
        if ((m.pauseAt - m.x) * (m.pauseAt - nx) <= 0) { m.pause = rnd(PAUSE.sec); m.pauseAt = NaN } // 멈출 자리를 지났다
        m.x = nx; m.walk += dt
      }
      const edge = SWAY + 4 + m.w / 2
      if (m.dir > 0 ? m.x > right + edge : m.x < left - edge) { m.wait = rnd(MOVE[m.type].gap); m.x = -1e5 } // 화면에서 완전히 사라졌다 → 쉰다
    }
    const o = i * 4
    out[o] = m.wait > 0 ? -1e5 : m.x
    out[o + 1] = m.type === 0 ? m.jit + Math.sin(s * 0.55 + m.ph * 6.283) * 5 : m.type === 1 ? m.jit + Math.sin(s * 1.3 + m.ph * 6.283) * 2.5 : 0
    out[o + 2] = m.type === 2 ? (m.pause > 0 ? 0 : Math.floor(m.walk * (m.frames > 4 ? 8.33 : 5)) % m.frames) : 0
    out[o + 3] = m.dir * (m.type === 2 && m.pause > 0 ? 2 : 1)   // 크기 2 = 멈춰 서 있다
  })
}

const SOURCES: Record<SceneKind, string[]> = { sky: [streetAir.src, streetFar.src, streetMain.src, streetGlow.src, streetTower.src], room: [roomFar.src, roomMain.src] }
const scenes: Partial<Record<SceneKind, Scene>> = {}
let raf = 0
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
  const quad = (k: number, ph: number, x: number, y: number, w: number, h: number, u0: number, v0: number, u1: number, v1: number, extra = 0, z = x) => {
    const r = (ranges[k] ??= [out.length / STRIDE, 0])
    r[1] += 6
    for (const [cx, cy] of [[0, 0], [1, 0], [0, 1], [1, 0], [1, 1], [0, 1]]) out.push(x + cx * w, y + cy * h, cx ? u1 : u0, cy ? v1 : v0, k, ph, z, extra)
  }
  if (kind === 'sky') {
    const [aw, ah] = STREET.atlas
    // sprites: [종류, 아틀라스 x, y, w, h, 장면 x, y, 빠르기 배수 | 걷는 그림 장수, 박자 | 장 사이 간격]
    // 구름은 제자리에서 흘러가고, 나머지는 지나가는 것들이다. 같은 그림이 여러 번 놓여 있으면 하나만 쓴다(하늘이 붐비지 않게).
    const defs: typeof moverDefs = [], byArt = new Map<string, number>(), byBeat = new Map<number, number>()
    let helis = 0
    STREET.sprites.forEach(([k, ax, ay, w, h, x, y, extra, b], i) => {
      const uv = [ax / aw, ay / ah, (ax + w) / aw, (ay + h) / ah] as const
      if (k === 0) { quad(0, (i * 0.618034) % 1, x, y, w, h, ...uv, 0); return }
      if (k === 11) { const idx = byBeat.get(b); if (idx != null) quad(11, idx, -w / 2, y, w, h, ...uv, 0, extra < 0 ? -1 : 1); return }
      const art = `${ax},${ay}`
      if (byArt.has(art) || defs.length >= MAX_MOVERS) return
      const walker = k === 9 || k === 10, idx = defs.length
      byArt.set(art, idx); if (b >= 0 && !walker) byBeat.set(b, idx)
      // 걷는 이: 핑크빈(9)은 오른쪽을 보게 뒤집어 뽑아 두었고 나머지는 왼쪽을 본다. 슈피겔만 열기구(배수가 음수)도 왼쪽을 본다.
      // 헬리콥터는 그림이 둘이다 — 첫째는 오른쪽, 둘째는 왼쪽을 본다(서로 뒤집은 그림).
      // 주황버섯 열기구(박자가 정해진 것 가운데 배수가 양수)는 오른쪽을 본다. 핑크빈 · 페페 열기구는 앞을 보고 있어 뒤집지 않는다
      const face = walker ? (k === 9 ? 1 : -1) : k === 2 ? (helis++ ? -1 : 1) : extra < 0 ? -1 : b >= 0 ? 1 : 0
      const sz = k === 2 ? HELI_SIZE : 1
      defs.push({ type: walker ? 2 : k === 2 ? 1 : 0, w, mult: walker ? (k === 9 ? 0.75 : 1) : k === 1 ? Math.abs(extra) : 1, frames: walker ? extra : 1, ph: (idx * 0.618034) % 1 })
      quad(walker ? 9 : k === 1 && b >= 0 ? 3 : k, idx, (-w * sz) / 2, k === 2 ? y - HELI_UP : y, w * sz, h * sz, ...uv, walker ? b / aw : 0, face)
    })
    moverDefs = defs
    quad(4, 0, 0, STREET.far.y, STREET.w, STREET.far.h, 0, 0, 1, 1)
    quad(10, 0, STREET.tower.x, STREET.tower.y, STREET.tower.w, STREET.tower.h, 0, 0, 1, 1)
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
  const qp = program(gl, QUAD_VS, QUAD_FS, ['uView', 'uRes', 'uTime', 'uTw', 'uSway', 'uMov', 'uTex', 'uGlow', 'uDim', 'uAmb', 'uCloud', 'uHaze', 'uLamp', 'uMask', 'uFoot'])
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
  const sc: Scene = { kind, canvas, gl: null, quad: null, sky: null, ranges: [], bmps: SOURCES[kind].map(() => null), tex: [], pending: [], host: null, ratio: 1, foot: [0, 0], px: 1, nearest: false, shadow: 13, arrive: 0, mask: MASK, movers: null, mov: new Float32Array(MAX_MOVERS * 4), shown: false, dirty: true, at: 0, failed: false, cleanup: null }
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
  // 배경만 볼 때(헤더의 '배경 보기')는 어두운 막을 걷는다
  sc.mask += ((document.documentElement.hasAttribute('data-pb-bgonly') ? 0 : MASK) - sc.mask) * (still ? 1 : 0.1)
  const mask = room ? 0 : sc.mask
  if (sc.sky) {
    const k = sc.sky, cw = W / sc.ratio, moon = orb(st.moonPhase, cw)
    moon[2] *= Math.min(1, st.night * 1.6) * st.orb
    const sun = orb(st.sunPhase, cw)
    sun[2] *= st.orb
    gl.disable(gl.BLEND)
    gl.disableVertexAttribArray(1); gl.disableVertexAttribArray(2)
    gl.useProgram(k.prog)
    gl.bindBuffer(gl.ARRAY_BUFFER, k.buf); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)
    gl.uniform2f(k.u.uRes, W, H); gl.uniform1f(k.u.uPx, sc.ratio); gl.uniform3fv(k.u.uSky, st.sky.flat()); gl.uniform3fv(k.u.uSun, sun); gl.uniform3fv(k.u.uMoon, moon)
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
  if (zoom === 1) { ox = Math.round(ox); oy = Math.round(oy) } // 칸이 화면 픽셀에 딱 맞게
  gl.uniform4f(q.u.uView, k, k, ox, oy); gl.uniform2f(q.u.uRes, W, H); gl.uniform1f(q.u.uTime, s); gl.uniform1f(q.u.uTw, s % 600)
  gl.uniform1f(q.u.uSway, still ? 0 : Math.sin(s * 0.09) * SWAY)
  if (!room) {
    // 지나가는 것들: 지금 화면에 보이는 범위(그림 칸)를 기준으로 드나든다
    stepMovers(sc, still || !sc.at ? 0 : Math.min(0.1, (now - sc.at) / 1000), s, Math.max(0, -ox / k), Math.min(STREET.w, (W - ox) / k))
    gl.uniform4fv(q.u.uMov, sc.mov)
  }
  // 불빛 지도는 1번 자리에(거리만 읽는다. 무대는 아무 그림이나 물려 둔다)
  gl.uniform1i(q.u.uGlow, 1); gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, sc.tex[room ? 0 : 3])
  gl.uniform1i(q.u.uTex, 0); gl.activeTexture(gl.TEXTURE0)
  // 밤의 거리는 하늘빛보다 조금 더 가라앉힌다 — 그래야 창과 가로등의 불빛이 살아난다
  const dim = 1 - 0.3 * st.night
  gl.uniform3f(q.u.uAmb, st.amb[0] * dim, st.amb[1] * dim, st.amb[2] * dim)
  gl.uniform3fv(q.u.uCloud, st.cloudA)
  gl.uniform3fv(q.u.uHaze, st.sky[2].map((v, i) => (v + st.sky[3][i]) / 2))
  gl.uniform1f(q.u.uLamp, st.lamp); gl.uniform1f(q.u.uMask, mask)
  const nd = room ? 1 : 1 - NIGHT_DIM * st.night
  gl.uniform4f(q.u.uDim, nd, nd, nd, 1)
  gl.uniform3f(q.u.uFoot, ROOM.foot[0], ROOM.foot[1] + 1, sc.shadow)
  const part = (tex: number, kinds: number[]) => {
    gl.bindTexture(gl.TEXTURE_2D, sc.tex[tex])
    for (const kd of kinds) { const r = sc.ranges[kd]; if (r) gl.drawArrays(gl.TRIANGLES, r[0], r[1]) }
  }
  if (room) { part(0, [6]); part(1, [7]) }
  else { part(0, [0, 1, 2]); part(1, [4]); part(4, [10]); part(0, [3, 11]); part(2, [5]); part(3, [8]); part(0, [9]) }
  sc.dirty = false
  sc.at = now
  if (!sc.shown) { sc.shown = true; c.style.transition = 'opacity .45s ease'; c.style.opacity = '1' }
}

// 헤더에서 시간대를 바꾸면 곧바로 다시 그린다(동작 줄이기에서는 20초마다만 그리므로)
onSkyChange(() => { for (const sc of Object.values(scenes)) if (sc) sc.dirty = true })

function tick(now: number) {
  raf = requestAnimationFrame(tick)
  const still = !!reduce?.matches
  for (const sc of Object.values(scenes)) if (sc && sc.host && sc.pending.length) { upload(sc); break } // 한 프레임에 한 장
  let st: SkyState | null = null
  for (const sc of Object.values(scenes)) {
    if (!sc || !sc.host || !sc.quad) continue
    if (!sc.dirty && now - sc.at < (still ? REDUCED_MS : FRAME_MS[sc.kind])) continue
    draw(sc, now, st ?? (st = skyNow()), still)
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
  if (again) draw(sc, performance.now(), skyNow(), reduce.matches) // 빈 프레임 없이
  if (!raf) raf = requestAnimationFrame(tick)
  const mine = sc.cleanup
  return () => { if (sc.cleanup === mine) mine() }
}
