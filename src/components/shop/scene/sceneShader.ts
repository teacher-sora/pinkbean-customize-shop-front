// 배경 장면 셰이더(WebGL1). 텍스처 없이 수식(거리 함수)만으로 그린다 — 받아 올 그림이 없어 가볍다.
//  · sky  : 앱 배경. 메이플 15번가 — 하늘 · 뭉게구름 · 도시 스카이라인 · 열기구 · 해와 달 · 별자리.
//  · room : 미리보기 무대. 15번가를 등진 쇼 무대(아치 배경판 · 날개 장식 · 단상 · 금테 발판 · 계단).
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
  gl_FragColor = vec4(sky(vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) * uPx, uRes * uPx), 1.);
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

const ROOM_PARTS = {
  CONSTELLATIONS: `
    constel(col, cPinkbean((p - vec2(163., 84.)) / .56) * .56, 1.);
    constel(col, cStar(p - vec2(18., 38.)), 3.);
    constel(col, cDipper(p - vec2(90., 12.)), 0.);`,
  SKY_MID: `
    gPx = 2.6;
    cityLayer(col, p, size.y, 15., size.y * .3, size.y * .48, 4., .7, size.y * .55);
    gPx = 1.8;
    balloon(col, snap(pr - vec2(mod(uTime * 1.4, size.x + 40.) - 20., 52. + sin(uTime * .5) * 1.5)), vec3(.96, .42, .4), vec3(1., .9, .6), .2);
    cityLayer(col, p, size.y, 21., size.y * .2, size.y * .32, 11., .4, size.y * .36);`,
}

// 쇼 무대. w = 발이 닿는 자리(0,0) 기준 좌표(아래가 +). 메이플 맵의 짜임을 따른다:
//  원경(15번가 하늘) → 중경(화면 밖으로 잘리는 큰 기둥 · 아치 배경판 · 날개 장식 · 단상) → 발판(금테 윗면) → 아래로 내려가는 계단.
const ROOM_MAIN = `
uniform vec2 uOrigin;
uniform float uShadow;
const vec2 SKY_SIZE = vec2(180., 170.);
const vec3 LINE = vec3(.34, .25, .5);
const vec3 GOLD = vec3(.98, .78, .36);
const vec3 GOLD_L = vec3(1., .93, .64);
const vec3 GOLD_D = vec3(.6, .38, .16);

void main(){
  gPx = 1.;
  vec2 wr = (vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) - uOrigin) * uPx;
  vec2 w = snap(wr);
  float ax = abs(w.x);
  // 무대 빛: 시각에 따른 빛 + 가운데를 비추는 조명(밤에도 캐릭터 둘레는 밝다)
  float lf = (1. - smoothstep(20., 170., length(w - vec2(0., -40.)))) * uLamp;
  vec3 A = mix(uAmb, vec3(1.03, .97, .9), lf * .85);
  vec3 col = sky(wr + vec2(90., 160.), SKY_SIZE);

  if (w.y < 0.) {
    // 양옆 기둥(화면 밖으로 잘린다)
    if (ax > 72.) {
      float px = (ax - 88.) * sign(w.x);
      vec3 pc = mix(vec3(1., .98, 1.), vec3(.7, .65, .9), band(smoothstep(-9., 9., px), 4.));
      pc *= 1. - .09 * step(.5, fract((px + 9.5) / 4.75));
      ink(col, abs(px) - 9.5, pc * A, LINE * A, .9);
      float ring = min(abs(w.y + 30.), abs(w.y + 116.)) - 3.2;
      ink(col, max(ring, abs(px) - 11.5), mix(GOLD_L, GOLD, band(smoothstep(-10., 10., px), 3.)) * A, GOLD_D * A, .8);
      ink(col, max(-w.y - 9., abs(px) - 12.5), pc * .94 * A, LINE * A, .9);
    }
    // 아치 배경판(금테 + 연보라 판 + 조명 기둥 무늬)
    vec2 aq = vec2(w.x, w.y + 80.);
    float arch = w.y > -80. ? ax - 48. : length(aq) - 48.;
    if (arch < 3.) {
      ink(col, arch, GOLD * A, GOLD_D * A, .9);
      col = mix(col, GOLD_L * A, cov(abs(arch + 1.5) - .5));
      float inner = arch + 4.6;
      vec3 pn = mix(vec3(.84, .72, .97), vec3(.99, .86, .95), band(smoothstep(-128., -8., w.y), 7.));
      float ch = 26. + hash(vec2(floor((w.x + 4.) / 8.), 3.)) * 74.;
      float bar = max(max(abs(mod(w.x + 4., 8.) - 4.) - 2.6, abs(mod(w.y, 7.) - 3.5) - 2.3), -w.y - ch);
      pn = mix(pn, vec3(1., .94, 1.), .5 * cov(bar));
      pn = mix(pn, vec3(1., .97, 1.), .55 * band(1. - smoothstep(8., 62., length(w - vec2(0., -62.))), 4.));
      pn *= 1. - .16 * smoothstep(-5., 0., inner);
      ink(col, inner, pn * A, GOLD_D * A, .8);
    }
    ink(col, sdStar(w - vec2(0., -135.), 7.5), GOLD_L * A, GOLD_D * A, .9);
    // 날개 장식과 별
    vec2 cq = vec2(ax, w.y);
    if (ax < 50. && w.y > -84. && w.y < -36.) {
      float wing = sdEll(rot(cq - vec2(26., -66.), .38), vec2(21., 7.5));
      wing = smin(wing, sdEll(rot(cq - vec2(23., -55.), .12), vec2(16., 6.)), 2.);
      wing = smin(wing, sdEll(rot(cq - vec2(19., -46.), -.15), vec2(11., 4.5)), 2.);
      ink(col, wing - 1.8, mix(GOLD_L, GOLD, band(smoothstep(-74., -44., w.y), 3.)) * A, GOLD_D * A, .8);
      col = mix(col, mix(vec3(1., .76, .88), vec3(.96, .54, .77), band(smoothstep(-72., -42., w.y), 3.)) * A, cov(wing));
      col = mix(col, GOLD_L * A, cov(abs(length(cq - vec2(31., -64.)) - 2.8) - .8) * cov(wing + 1.5));
      float star = sdStar(w - vec2(0., -64.), 13.) - 1.2;
      ink(col, star, mix(GOLD_L, GOLD, band(smoothstep(-76., -54., w.y), 3.)) * A, GOLD_D * A, .9);
      col = mix(col, vec3(1., .78, .9) * A, cov(sdStar(w - vec2(0., -64.), 7.5)));
    }
    // 단상(둥근 2단 + 금띠 하트)
    if (w.y > -35. && ax < 44.) {
      float t2 = sdRBox(w - vec2(0., -25.), vec2(30., 7.5), 2.);
      float t1 = sdRBox(w - vec2(0., -9.), vec2(41., 9.6), 2.);
      vec3 pd = mix(vec3(1., .98, 1.), vec3(.74, .68, .92), band(smoothstep(.25, 1., ax / 41.), 4.));
      ink(col, t2, pd * A, LINE * A, .9);
      col = mix(col, vec3(1.) * A, cov(abs(w.y + 31.) - .6) * cov(t2 + 1.2));
      ink(col, t1, pd * A, LINE * A, .9);
      col = mix(col, vec3(1.) * A, cov(abs(w.y + 17.2) - .6) * cov(t1 + 1.2));
      float bd = abs(w.y + 8.6) - 3.6;
      col = mix(col, GOLD_D * A, cov(bd - .7) * cov(t1 + .5));
      col = mix(col, mix(GOLD_L, GOLD, band(smoothstep(-12., -5., w.y), 3.)) * A, cov(bd) * cov(t1 + .5));
      vec2 hq = vec2(mod(w.x + 6., 12.) - 6., w.y + 9.);
      float heart = min(length(vec2(abs(hq.x) - 1.05, hq.y + .6)) - 1.25, max((abs(hq.x) + hq.y - 1.8) * .707, -hq.y - .6));
      col = mix(col, vec3(.97, .5, .7) * A, cov(heart) * cov(t1 + 2.));
    }
    // 근경: 발판 양옆의 덤불과 꽃(진한 외곽선)
    vec2 bq = vec2(ax - 64., w.y);
    if (abs(bq.x) < 22. && w.y > -27.) {
      float bush = length(bq - vec2(0., -9.)) - 10.;
      bush = smin(bush, length(bq - vec2(-9., -5.)) - 7., 2.);
      bush = smin(bush, length(bq - vec2(10., -6.)) - 8., 2.);
      bush = smin(bush, length(bq - vec2(3., -16.)) - 6., 2.);
      vec3 gr = mix(vec3(.66, .92, .42), vec3(.16, .46, .32), band(smoothstep(-22., 2., w.y + bq.x * .35), 4.));
      ink(col, bush, gr * A, vec3(.07, .24, .2) * A, 1.1);
      vec2 lf2 = vec2(mod(bq.x + 2.5, 5.) - 2.5, mod(w.y + floor((bq.x + 2.5) / 5.) * 2.5, 5.) - 2.5);
      col = mix(col, vec3(.84, .98, .56) * A, cov(length(lf2) - 1.) * cov(bush + 3.5) * step(w.y, -7.));
      float fl = min(length(bq - vec2(-6., -10.)), min(length(bq - vec2(7., -15.)), length(bq - vec2(12., -5.))));
      ink(col, fl - 2., vec3(1., .62, .82) * A, vec3(.6, .2, .42) * A, .8);
      col = mix(col, vec3(1., .95, .7) * A, cov(fl - .8));
    }
    // 위쪽 휘장
    if (w.y < -140.) {
      float edge = w.y - (-172. + 24. * ax * ax / 7921.);
      vec3 dr = mix(vec3(.8, .26, .52), vec3(.98, .56, .76), band(.5 + .5 * sin(ax * .33 - w.y * .12), 3.));
      dr = mix(dr, GOLD, cov(abs(edge + 2.8) - 1.));
      ink(col, edge, dr * A, vec3(.46, .12, .32) * A, .9);
    }
  } else {
    // 아래로 내려가는 계단 + 가운데 카펫
    float sy = mod(w.y - 30., 12.);
    float dim = 1. - clamp(floor((w.y - 30.) / 12.) * .07, 0., .55);
    float cz = ax - 26.;
    vec3 stone = sy < 3. ? vec3(.96, .93, 1.) : vec3(.8, .75, .94) * mix(1., .84, (sy - 3.) / 9.);
    vec3 carpet = sy < 3. ? vec3(.99, .52, .7) : vec3(.88, .34, .55) * mix(1., .84, (sy - 3.) / 9.);
    if (w.y < 30.) {
      stone = mix(vec3(.99, .97, 1.), vec3(.84, .79, .96), band(smoothstep(5., 30., w.y), 4.)) * (1. - .06 * step(6., mod(w.x + 6., 12.)));
      float bd = abs(w.y - 15.5) - 3.6;
      stone = mix(stone, vec3(.72, .4, .62), cov(bd - .7));
      stone = mix(stone, vec3(.98, .66, .82), cov(bd));
      stone = mix(stone, GOLD_L, cov(abs(mod(w.x + 8., 16.) - 8.) + abs(w.y - 15.5) - 2.3));
      stone = mix(stone, GOLD_D, cov(abs(w.y - 27.8) - 2.6));
      stone = mix(stone, mix(GOLD_L, GOLD, smoothstep(26., 30., w.y)), cov(abs(w.y - 27.8) - 1.9));
      carpet = vec3(.93, .4, .6) * mix(1., .86, smoothstep(5., 30., w.y));
      dim = 1.;
    } else stone = mix(stone, LINE, .45 * cov(abs(sy - 3.) - .45));
    carpet = mix(carpet, GOLD, cov(abs(cz + 3.5) - .9));
    carpet = mix(carpet, GOLD, cov(w.y < 30. ? abs(w.x) + abs(w.y - 16.) - 5. : abs(w.x) + abs(sy - 7.5) - 2.4));
    if (w.y < 30.) carpet = mix(carpet, vec3(.93, .4, .6), cov(abs(w.x) + abs(w.y - 16.) - 3.));
    col = mix(stone, carpet, cov(cz));
    col = mix(col, vec3(.5, .16, .34), .7 * cov(abs(cz) - .45));
    col *= dim * A;
    // 금테 발판 윗면
    float top = sdBox(w - vec2(w.x, 2.5), vec2(999., 2.5));
    ink(col, top, mix(GOLD_L, GOLD, band(smoothstep(.5, 5., w.y), 3.)) * A, GOLD_D * A, .8);
    col = mix(col, vec3(1., .98, .86) * A, cov(w.y - 1.));
    col = mix(col, GOLD_D * A, .6 * cov(length(vec2(mod(w.x + 11., 22.) - 11., w.y - 2.9)) - .9));
    col = mix(col, mix(vec3(1., .62, .78), vec3(.95, .46, .66), smoothstep(.5, 5., w.y)) * A, cov(cz + 1.) * cov(top));
    // 발밑 그림자
    col = mix(col, vec3(.3, .14, .32), .32 * (1. - smoothstep(.55, 1., length(vec2(w.x / uShadow, (w.y - .4) / 1.9)))));
  }

  // 위에서 내려오는 조명 두 줄기
  if (w.y < 5.) {
    vec2 d = normalize(vec2(-70., 170.));
    vec2 o = vec2(ax, w.y) - vec2(70., -190.);
    float t = dot(o, d);
    float bm = (1. - smoothstep(7. + t * .09, 11. + t * .13, abs(dot(o, vec2(-d.y, d.x))))) * step(0., t);
    col += vec3(1., .95, .8) * band(bm, 3.) * (.07 + .1 * uLamp);
  }
  // 떠다니는 반짝이
  vec2 sc = floor(w / 31.);
  float sh = hash(sc + 5.);
  if (sh > .5 && w.y < 0.) {
    float fy = mod(hash(sc + 2.) * 31. - uTime * (1. + sh * 2.), 31.);
    vec2 sp = w - sc * 31. - vec2(4. + hash(sc) * 23. + sin(uTime * .3 + sh * 6.) * 2., fy);
    col = mix(col, vec3(1., .98, 1.), cov(abs(sp.x) * abs(sp.y) * 2.5 + length(sp) * .5 - 1.) * (.45 + .4 * sin(uTime * 2. + sh * 20.)) * smoothstep(0., 4., min(fy, 31. - fy)));
  }

  gl_FragColor = vec4(col, 1.);
}
`

const fill = (src: string, parts: Record<string, string>) => Object.entries(parts).reduce((s, [k, v]) => s.replace(k, v), src)

export const fragSource = (kind: 'sky' | 'room') =>
  kind === 'sky' ? fill(COMMON, SKY_PARTS) + SKY_MAIN : fill(COMMON, ROOM_PARTS) + ROOM_MAIN
