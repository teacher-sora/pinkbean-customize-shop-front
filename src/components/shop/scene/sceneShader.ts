// 배경 장면 셰이더(WebGL1). 텍스처 없이 수식(거리 함수)만으로 그린다 — 받아 올 그림이 없어 가볍다.
//  · sky  : 앱 배경. 메이플 15번가 — 하늘 · 뭉게구름 · 도시 스카이라인 · 열기구 · 해와 달 · 별자리.
//  · room : 미리보기 무대. 수식이 아니라 실제 맵 그림을 깐다(ROOM_MAIN 머리말).
// 그림체는 메이플 배경의 방식이다:
//  · **게임 픽셀 격자에 찍은 도트 그림**이다. 좌표를 격자에 맞춰(snap) 계산하므로 한 칸 안은 한 색이고, 가장자리는
//    한 칸만 중간색으로 깎으며(손으로 넣는 안티에일리어싱), 명암은 몇 단으로 끊는다(band). 멀리서 보면 선으로 읽힌다.
//  · **원근**: 멀리 있는 것은 가장자리를 넓게 풀고(gPx 를 키운다) 하늘빛에 묻어 뿌옇다. 가까운 것은 진한 외곽선으로 또렷하다.
//  · **움직이는 것**(구름·열기구)은 그 물체 자신의 격자에 맞춘다 → 무늬는 물체에 붙어 흔들리지 않고, 물체는 화면 픽셀
//    단위로 매끄럽게 미끄러진다(도트 스프라이트를 translate 로 옮기는 것과 같다). 그래서 캔버스는 화면 해상도로 그린다.
// 좌표 단위는 게임 픽셀. uPx = 캔버스 한 픽셀이 차지하는 단위 길이, gPx = 가장자리를 푸는 폭.

export const VERT = 'attribute vec2 aPos; void main(){ gl_Position = vec4(aPos, 0., 1.); }'

const COMMON = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec2 uRes;
uniform float uPx;
uniform float uTime;
uniform vec3 uSky[4];
uniform vec3 uCloudA;
uniform vec3 uCloudB;
uniform vec3 uAmb;
uniform vec3 uLight;
uniform vec3 uSunCol;
uniform vec3 uSun;   // xy = 하늘 안 위치(0~1), z = 보이는 정도
uniform vec3 uMoon;
uniform float uNight;
uniform float uLamp;

float gPx;

float hash(vec2 p){ vec3 q = fract(vec3(p.xyx) * .1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
float vnoise(vec2 p){
  vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  return mix(mix(hash(i), hash(i + vec2(1., 0.)), f.x), mix(hash(i + vec2(0., 1.)), hash(i + vec2(1., 1.)), f.x), f.y);
}
vec2 rot(vec2 p, float a){ float c = cos(a), s = sin(a); return vec2(c * p.x - s * p.y, s * p.x + c * p.y); }
float smin(float a, float b, float k){ float h = clamp(.5 + .5 * (b - a) / k, 0., 1.); return mix(b, a, h) - k * h * (1. - h); }

// 명암을 n 단으로 끊는다(도트 그림의 면 나누기)
float band(float x, float n){ return floor(clamp(x, 0., 1.) * n + .5) / n; }
// 거리 → 덮는 정도(가장자리 한 픽셀을 부드럽게)
vec2 snap(vec2 p){ return floor(p) + .5; }
float cov(float d){ return clamp(.5 - d / gPx, 0., 1.); }
// 채우고 바깥에 외곽선을 두른다
void ink(inout vec3 col, float d, vec3 fillc, vec3 line, float lw){ col = mix(col, line, cov(d - lw)); col = mix(col, fillc, cov(d)); }

float sdSeg(vec2 p, vec2 a, vec2 b){ vec2 pa = p - a, ba = b - a; return length(pa - ba * clamp(dot(pa, ba) / dot(ba, ba), 0., 1.)); }
float sdCone(vec2 p, vec2 a, vec2 b, float ra, float rb){ vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0., 1.); return length(pa - ba * h) - mix(ra, rb, h); }
float sdEll(vec2 p, vec2 r){ float k0 = length(p / r); float k1 = length(p / (r * r)); return k0 * (k0 - 1.) / max(k1, .0001); }
float sdBox(vec2 p, vec2 b){ vec2 d = abs(p) - b; return length(max(d, 0.)) + min(max(d.x, d.y), 0.); }
float sdRBox(vec2 p, vec2 b, float r){ return sdBox(p, b - r) - r; }
float sdTri(vec2 p, float apex, float base, float k){ return max((abs(p.x) * k - (p.y - apex)) / sqrt(1. + k * k), p.y - base); }
float sdTrap(vec2 p, float r1, float r2, float he){
  vec2 k1 = vec2(r2, he), k2 = vec2(r2 - r1, 2. * he);
  p.x = abs(p.x);
  vec2 ca = vec2(p.x - min(p.x, p.y < 0. ? r1 : r2), abs(p.y) - he);
  vec2 cb = p - k1 + k2 * clamp(dot(k1 - p, k2) / dot(k2, k2), 0., 1.);
  return (cb.x < 0. && ca.y < 0. ? -1. : 1.) * sqrt(min(dot(ca, ca), dot(cb, cb)));
}
float sdStar(vec2 p, float r){
  const vec2 k1 = vec2(.809016994, -.587785252);
  const vec2 k2 = vec2(-.809016994, -.587785252);
  p.y = -p.y;
  p.x = abs(p.x);
  p -= 2. * max(dot(k1, p), 0.) * k1;
  p -= 2. * max(dot(k2, p), 0.) * k2;
  p.x = abs(p.x);
  p.y -= r;
  vec2 ba = .45 * vec2(-k1.y, k1.x) - vec2(0., 1.);
  float h = clamp(dot(p, ba) / dot(ba, ba), 0., r);
  return length(p - ba * h) * sign(p.y * ba.x - p.x * ba.y);
}

vec3 gradAt(float t){
  t = clamp(t, 0., 1.);
  if (t < .42) return mix(uSky[0], uSky[1], t / .42);
  if (t < .78) return mix(uSky[1], uSky[2], (t - .42) / .36);
  return mix(uSky[2], uSky[3], (t - .78) / .22);
}

float stars(vec2 p, float t){
  vec2 c = floor(p / 9.);
  float h = hash(c);
  if (h < .72) return 0.;
  float d = length(p - (c * 9. + 1.5 + vec2(hash(c + 3.1), hash(c + 7.7)) * 6.));
  float big = step(.95, h);
  float a = 1. - smoothstep(.2, .75 + big * .5, d);
  a += big * exp(-d * d * .35) * .35;
  return a * (.6 + .4 * sin(uTime * (.8 + h * 2.) + h * 40.)) * (1. - smoothstep(.72, .98, t));
}

#define S(ax,ay,bx,by) d = min(d, sdSeg(q, vec2(ax,ay), vec2(bx,by)));
#define N(ax,ay) n = min(n, length(q - vec2(ax,ay)));
// 별자리 셋: 핑크빈 · 국자 · 별. 돌려주는 값 = (선까지 거리, 별까지 거리)
vec2 cPinkbean(vec2 q){
  float d = 99., n = 99.;
  if (abs(q.x) > 24. || abs(q.y) > 25.) return vec2(99.);
  S(-8.,-12.,8.,-12.) S(8.,-12.,16.,-3.) S(16.,-3.,15.,9.) S(15.,9.,7.,15.) S(7.,15.,-7.,15.) S(-7.,15.,-15.,9.) S(-15.,9.,-16.,-3.) S(-16.,-3.,-8.,-12.)
  S(-8.,-12.,-17.,-18.) S(-17.,-18.,-16.,-3.) S(8.,-12.,17.,-18.) S(17.,-18.,16.,-3.)
  S(-3.,6.,0.,8.) S(0.,8.,3.,6.)
  N(-8.,-12.) N(8.,-12.) N(16.,-3.) N(15.,9.) N(7.,15.) N(-7.,15.) N(-15.,9.) N(-16.,-3.) N(-17.,-18.) N(17.,-18.) N(-6.,1.) N(6.,1.)
  return vec2(d, n);
}
vec2 cDipper(vec2 q){
  float d = 99., n = 99.;
  if (abs(q.x) > 29. || abs(q.y) > 16.) return vec2(99.);
  S(-22.,-4.,-14.,-7.) S(-14.,-7.,-6.,-5.) S(-6.,-5.,0.,-1.) S(0.,-1.,1.,7.) S(1.,7.,11.,8.) S(11.,8.,12.,-1.) S(12.,-1.,0.,-1.)
  N(-22.,-4.) N(-14.,-7.) N(-6.,-5.) N(0.,-1.) N(1.,7.) N(11.,8.) N(12.,-1.)
  return vec2(d, n);
}
vec2 cStar(vec2 q){
  float d = 99., n = 99.;
  if (abs(q.x) > 15. || abs(q.y) > 15.) return vec2(99.);
  S(0.,-9.,5.,7.) S(5.,7.,-9.,-3.) S(-9.,-3.,9.,-3.) S(9.,-3.,-5.,7.) S(-5.,7.,0.,-9.)
  N(0.,-9.) N(5.,7.) N(-9.,-3.) N(9.,-3.) N(-5.,7.)
  return vec2(d, n);
}
void constel(inout vec3 col, vec2 dn, float ph){
  if (dn.x > 50.) return;
  float pulse = .7 + .3 * sin(uTime * 1.2 + ph);
  float a = exp(-dn.x * dn.x * 5.) * .6 + exp(-dn.x * dn.x * .3) * .14;
  a = max(a, exp(-dn.y * dn.y * .22) * .6);
  col = mix(col, vec3(1., .85, .36), min(1., a * pulse) * uNight);
  col = mix(col, vec3(1., .97, .78), (1. - smoothstep(.5, 1.3, dn.y)) * uNight);
}

void orbs(inout vec3 col, vec2 p, vec2 size){
  if (uMoon.z > 0.) {
    vec2 q = p - uMoon.xy * size;
    float d = length(q);
    col = mix(col, vec3(.78, .84, 1.), exp(-d * .09) * .4 * uMoon.z);
    col = mix(col, vec3(1., .96, .78), cov(max(d - 7., 6.2 - length(q - vec2(3.4, -2.2)))) * uMoon.z);
  }
  if (uSun.z > 0.) {
    float d = length(p - uSun.xy * size);
    col = mix(col, uSunCol, exp(-d * .055) * .6 * uSun.z);
    col = mix(col, mix(uSunCol, vec3(1.), .7), cov(d - 8.) * uSun.z);
  }
}

// 뭉게구름 한 덩이: 밑은 평평하고 위는 둥글게 솟는다. q = 밑변 가운데 기준.
float cloudD(vec2 q){
  float d = length(q - vec2(1., -9.)) - 11.;
  d = smin(d, length(q - vec2(-12., -6.)) - 8.5, 3.);
  d = smin(d, length(q - vec2(13., -6.)) - 8., 3.);
  d = smin(d, length(q - vec2(-23., -3.)) - 5.5, 3.);
  d = smin(d, length(q - vec2(23., -3.)) - 5., 3.);
  d = smin(d, length(q - vec2(-5., -15.)) - 6.5, 3.);
  return max(d, q.y - 1.5);
}
void cloudLayer(inout vec3 col, vec2 p, float y, float s, float speed, float seed, float fade){
  float cell = 96. * s;
  float x = floor(p.x + uTime * speed + seed * 57.) + .5;
  p.y = floor(p.y) + .5;
  float id = floor(x / cell);
  float h = hash(vec2(id, seed));
  if (h < .22) return;
  float sz = s * (.75 + .5 * hash(vec2(id, seed + 1.)));
  vec2 q = vec2(x - (id + .5) * cell - (hash(vec2(id, seed + 2.)) - .5) * (cell - 62. * sz), p.y - y - (hash(vec2(id, seed + 3.)) - .5) * 14. * s) / sz;
  if (abs(q.x) > 31. || q.y < -23. || q.y > 3.) return;
  if (h > .6) q.x = -q.x;
  float d = cloudD(q) * sz;
  vec3 c = mix(uCloudB, uCloudA, smoothstep(1., -11., q.y));
  c = mix(c, uCloudA, .7 * cov((cloudD(q + vec2(1.5, 2.5)) + 2.5) * sz));
  col = mix(col, mix(c, col, fade), cov(d));
}

// 15번가 건물 한 줄. q.y 는 땅에서 위로 잰 높이. haze 가 클수록 멀리 있어 하늘빛에 묻힌다(외곽선도 옅다).
void cityLayer(inout vec3 col, vec2 p, float ground, float cell, float hmin, float hmax, float seed, float haze, float tall){
  float id = floor(p.x / cell);
  float h1 = hash(vec2(id, seed)), h2 = hash(vec2(id, seed + 1.)), h3 = hash(vec2(id, seed + 2.));
  float bh = mix(hmin, hmax, h1 * h1);
  if (h3 > .86) bh = max(bh, tall * (.9 + .1 * h2));   // 눈에 띄게 높은 탑
  vec2 q = vec2(p.x - (id + .5) * cell, ground - p.y);
  if (q.y < 0. || q.y > bh + cell * 1.3) return;
  float bw = cell * (.36 + .12 * h2);
  float body = max(abs(q.x) - bw, q.y - bh);
  float top = floor(h3 * 4.99);
  float cap = 99.;
  if (top == 1. || top == 4.) cap = max((abs(q.x) * (cell * 1.1 / (bw * .7)) + q.y - bh - cell * 1.1) / 2.4, bh - q.y);   // 뾰족 지붕
  else if (top == 2.) cap = length(vec2(q.x, q.y - bh)) - bw * .72;                                                    // 돔
  else if (top == 3.) cap = max(abs(q.x) - bw * .58, q.y - bh - cell * .3);                                             // 한 단 더
  vec3 base = col;
  vec3 c = h2 < .2 ? vec3(.97, .6, .72) : (h2 < .4 ? vec3(.99, .9, .74) : (h2 < .6 ? vec3(.5, .78, .8) : (h2 < .8 ? vec3(.86, .46, .42) : vec3(.62, .64, .78))));
  vec3 roof = h1 < .5 ? vec3(.36, .5, .78) : vec3(.5, .34, .62);
  vec3 line = c * .5;
  ink(col, cap, (top == 3. ? c * .93 : roof) * uAmb, line * uAmb, .6 * (1. - haze));
  vec3 bc = c * (1. - .13 * smoothstep(-.5, .5, q.x - bw * .35));
  bc = mix(bc, c * 1.08, cov(abs(q.y - bh + 2.) - 1.2));               // 처마 띠
  ink(col, body, bc * uAmb, line * uAmb, .6 * (1. - haze));
  // 창: 켜진 창은 스스로 빛난다
  vec2 wc = vec2(floor((q.x + bw) / 6.), floor(q.y / 8.));
  vec2 g = vec2(mod(q.x + bw, 6.) - 3., mod(q.y, 8.) - 4.);
  float win = cov(sdBox(g, vec2(1.5, 2.3))) * cov(body + 2.5) * step(5., q.y);
  float on = step(.45, hash(wc + id * 7. + seed)) * uLamp;
  col = mix(col, mix(mix(vec3(.6, .82, .98), vec3(.26, .32, .56), uNight) * uAmb, vec3(1., .86, .46), on), win);
  col = mix(col, base, haze);
}

// 열기구
void balloon(inout vec3 col, vec2 q, vec3 a, vec3 b, float fade){
  if (abs(q.x) > 12. || q.y < -13. || q.y > 20.) return;
  vec3 base = col;
  vec3 line = vec3(.4, .26, .34) * uAmb;
  col = mix(col, line, cov(min(sdSeg(q, vec2(-5.5, 8.), vec2(-2., 14.)), sdSeg(q, vec2(5.5, 8.), vec2(2., 14.))) - .3));
  ink(col, sdRBox(q - vec2(0., 15.6), vec2(2.6, 2.), .8), vec3(.78, .56, .36) * uAmb, line, .5);
  float env = smin(length(q) - 10., sdTrap(q - vec2(0., 8.5), 6., 2.6, 2.5), 3.);
  ink(col, env, (mod(floor((q.x + 12.) / 4.), 2.) < 1. ? a : b) * (1. - .14 * smoothstep(-3., 9., q.x + q.y * .4)) * uAmb, line, .6);
  col = mix(col, vec3(1.), .35 * cov(sdEll(rot(q - vec2(-4.5, -5.), -.6), vec2(2.4, 1.2))));
  col = mix(col, base, fade);
}

vec3 sky(vec2 pr, vec2 size){
  vec2 p = snap(pr);
  float t = p.y / size.y;
  vec3 col = gradAt(t);
  if (uNight > .01) {
    col = mix(col, vec3(1., .97, .9), min(1., stars(p, t)) * uNight);
    CONSTELLATIONS
  }
  orbs(col, p, size);
  gPx = 2.2;
  cloudLayer(col, pr, size.y * .34, .55, 1., 3., .5);
  gPx = 1.5;
  cloudLayer(col, pr, size.y * .58, .8, 2.2, 9., .15);
  SKY_MID
  gPx = 1.;
  return col;
}
`

const SKY_MAIN = `
void main(){
  gPx = 1.;
  vec3 col = sky(vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) * uPx, uRes * uPx);
  // 어두운 막: 배경을 한 톤 눌러 화면 내용(흰 카드)과 갈라 준다. 흰 막은 뿌옇게 보였다. 셰이더 안에서 섞으므로 따로 드는 비용이 없다.
  gl_FragColor = vec4(mix(col, vec3(.09, .07, .16), .32), 1.);
}
`

// 앱 배경은 대부분 화면에 가려지고 위쪽 띠와 양옆만 보인다 → 높은 탑 끝·열기구·구름이 그 자리에 오게 한다.
const SKY_PARTS = {
  CONSTELLATIONS: `
    constel(col, cDipper(p - vec2(size.x * .5, 13.)), 0.);
    constel(col, cStar(p - vec2(size.x * .34, 13.)), 2.);
    constel(col, cStar(p - vec2(size.x * .66, 14.)), 4.);
    constel(col, cPinkbean(p - vec2(size.x * .035, size.y * .16)), 1.);
    constel(col, cPinkbean(p - vec2(size.x * .965, size.y * .2)), 3.);`,
  SKY_MID: `
    cloudLayer(col, pr, 27., .5, 2., 33., .08);
    gPx = 2.4;
    cityLayer(col, p, size.y, 26., size.y * .4, size.y * .72, 4., .66, size.y * .93);
    gPx = 1.6;
    balloon(col, snap(pr - vec2(mod(uTime * 1.6 + size.x * .2, size.x + 60.) - 30., size.y * .3 + sin(uTime * .4 + 2.) * 2.)), vec3(.4, .7, .9), vec3(1., .97, .92), .3);
    gPx = 1.;
    balloon(col, snap(pr - vec2(mod(uTime * 2.5 + size.x * .7, size.x + 60.) - 30., 13. + sin(uTime * .5) * 1.5)), vec3(.96, .42, .4), vec3(1., .9, .6), 0.);
    cityLayer(col, p, size.y, 38., size.y * .2, size.y * .52, 11., 0., size.y * .66);`,
}

// 미리보기 무대: 피팅룸 그림 두 겹을 합친다. 그림은 parser/scripts/stage-build.cjs 가 찍는다(게임 원화는 쓰지 않는다).
//  · far(가게 안쪽 홀) : 살짝 흐리고 뿌옇게 → 멀리 있는 것으로 읽힌다. 바깥 빛이 드는 곳이라 시각의 색을 많이 탄다.
//  · main(바닥 · 단상 · 피팅 정자 · 소품) : 손대지 않고 또렷하게 얹는다.
//  · 그 사이에 창에서 비껴 드는 빛줄기와 떠다니는 빛 먼지가 천천히 움직인다(먼지는 게임 픽셀 격자에 맞춘다).
const ROOM_MAIN = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec2 uRes;
uniform float uPx;
uniform float uTime;
uniform vec2 uOrigin;
uniform float uShadow;
uniform vec3 uAmb;
uniform float uLamp;
uniform float uNight;
uniform sampler2D uTex;   // far
uniform sampler2D uTexB;  // main
uniform vec2 uTexSize;
uniform vec2 uFoot;       // 그림 안에서 캐릭터가 서는 자리(발)
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
vec3 farAt(vec2 q){ return texture2D(uTex, clamp(q, vec2(.5), uTexSize - .5) / uTexSize).rgb; }
float beam(vec2 w, float side){
  float d = side * w.x + 182. - (190. + w.y) * .52;               // 창(발 기준 x=±182, 높이 190)에서 안쪽 아래로 비껴 내린다
  return smoothstep(48., 8., abs(d)) * smoothstep(-250., -150., w.y) * smoothstep(20., -60., w.y) * (.8 + .2 * sin(uTime * .35 + d * .06 + side));
}
void main(){
  vec2 w = floor((vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) - uOrigin) * uPx) + .5;
  vec2 t = w + uFoot;
  vec3 col = farAt(t) * .36 + (farAt(t + vec2(1.5, 0.)) + farAt(t - vec2(1.5, 0.)) + farAt(t + vec2(0., 1.5)) + farAt(t - vec2(0., 1.5))) * .16;
  col *= mix(vec3(1.), uAmb, .9);
  col = mix(col, uAmb * vec3(.97, .94, 1.), .14);                  // 뿌연 공기
  float b = beam(w, 1.) + beam(w, -1.);
  col += mix(vec3(1., .96, .82), vec3(.55, .65, 1.), uNight) * b * mix(.13, .05, uNight);
  vec2 g = floor(w / 26.);                                         // 빛 먼지: 칸마다 하나, 천천히 떠오른다
  vec2 o = vec2(hash(g), hash(g + 7.3));
  vec2 p = (g + .2 + .6 * o) * 26. + vec2(sin(uTime * .3 + o.x * 6.3) * 5., 13. - mod(uTime * (1.5 + 2.5 * o.y) + o.x * 26., 26.));
  float mote = step(.5, hash(g + 3.1)) * step(length(floor(w) - floor(p)), .5) * (.5 + .5 * sin(uTime * 1.3 + o.y * 20.)) * step(w.y, -8.);
  col += vec3(1., .97, .86) * mote * .5;
  vec4 m = texture2D(uTexB, clamp(t, vec2(.5), uTexSize - .5) / uTexSize);
  m.rgb *= mix(uAmb, vec3(1.02, .98, .92), .55 + .3 * uLamp);      // 가까운 것은 실내 조명을 받아 덜 물든다
  m.rgb = mix(m.rgb, vec3(.2, .13, .12), .32 * (1. - smoothstep(.55, 1., length(vec2(w.x / uShadow, (w.y - .4) / 1.9))))); // 발밑 그림자
  col = mix(col, m.rgb, m.a);
  col = mix(col, vec3(.1, .06, .08), smoothstep(-24., 30., t.y - uTexSize.y)); // 그림 아래로 넘어가면 어둠으로 잦아든다
  gl_FragColor = vec4(col, 1.);
}
`

const fill = (src: string, parts: Record<string, string>) => Object.entries(parts).reduce((s, [k, v]) => s.replace(k, v), src)

export const fragSource = (kind: 'sky' | 'room') => (kind === 'sky' ? fill(COMMON, SKY_PARTS) + SKY_MAIN : ROOM_MAIN)
