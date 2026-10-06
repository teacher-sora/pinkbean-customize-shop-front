// 배경 장면 셰이더(WebGL1). 텍스처 없이 수식(거리 함수)만으로 그린다 — 받아 올 그림이 없어 가볍다.
//  · sky  : 앱 배경. 메이플 15번가 — 하늘 · 뭉게구름 · 도시 스카이라인 · 열기구 · 해와 달 · 별자리.
//  · room : 미리보기 무대. 커마샵 건물 안의 피팅룸(창밖은 15번가). 구성은 ROOM_MAIN 머리말 참고.
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

// 커마샵 피팅룸(건물 안). w = 발이 닿는 자리(0,0) 기준 좌표(아래가 +). 메이플 맵의 짜임을 따른다:
//  원경(창밖 15번가) → 벽(벽지 · 창 · 벽기둥 · 선반 · 휘장 · 천장 들보와 등) → 가구(옷걸이 · 소파) →
//  피팅 자리(아치 배경판 · 날개 장식 · 단상) → 발판(금테 윗면) → 발판 앞면(나무 패널) → 아래층 바닥과 근경 소품 → 돌 기단.
// 1배율(넓게)로 봐도 비지 않도록 위아래·양옆으로 내용을 채우고, 같은 무늬가 얇게 되풀이되지 않게 큰 덩어리로 나눈다.
const ROOM_MAIN = `
uniform vec2 uOrigin;
uniform float uShadow;
const vec2 SKY_SIZE = vec2(180., 170.);
const vec3 LINE = vec3(.34, .25, .5);
const vec3 GOLD = vec3(.98, .78, .36);
const vec3 GOLD_L = vec3(1., .93, .64);
const vec3 GOLD_D = vec3(.6, .38, .16);
const vec3 WOOD = vec3(.87, .63, .41);
const vec3 WOOD_L = vec3(.98, .82, .6);
const vec3 WOOD_D = vec3(.48, .28, .19);
const vec3 ROSE = vec3(.95, .5, .66);
const vec3 ROSE_D = vec3(.56, .18, .36);

float heartD(vec2 q){ return min(length(vec2(abs(q.x) - 1.05, q.y + .6)) - 1.25, max((abs(q.x) + q.y - 1.8) * .707, -q.y - .6)); }
// 둥근 덤불(잎 무늬 + 꽃)
void bushAt(inout vec3 col, vec2 bq, vec3 A){
  float bush = length(bq - vec2(0., -9.)) - 10.;
  bush = smin(bush, length(bq - vec2(-9., -5.)) - 7., 2.);
  bush = smin(bush, length(bq - vec2(10., -6.)) - 8., 2.);
  bush = smin(bush, length(bq - vec2(3., -16.)) - 6., 2.);
  bush = max(bush, bq.y - .5);
  vec3 gr = mix(vec3(.66, .92, .42), vec3(.16, .46, .32), band(smoothstep(-22., 2., bq.y + bq.x * .35), 4.));
  ink(col, bush, gr * A, vec3(.07, .24, .2) * A, 1.1);
  vec2 lf2 = vec2(mod(bq.x + 2.5, 5.) - 2.5, mod(bq.y + floor((bq.x + 2.5) / 5.) * 2.5, 5.) - 2.5);
  col = mix(col, vec3(.84, .98, .56) * A, cov(length(lf2) - 1.) * cov(bush + 3.5) * step(bq.y, -7.));
  float fl = min(length(bq - vec2(-6., -10.)), min(length(bq - vec2(7., -15.)), length(bq - vec2(12., -5.))));
  ink(col, fl - 2., vec3(1., .62, .82) * A, vec3(.6, .2, .42) * A, .8);
  col = mix(col, vec3(1., .95, .7) * A, cov(fl - .8));
}

void main(){
  gPx = 1.;
  vec2 wr = (vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) - uOrigin) * uPx;
  vec2 w = snap(wr);
  float ax = abs(w.x);
  // 실내 빛: 낮에는 시각의 빛, 해가 지면 등불(따뜻한 색)이 방을 채운다 — 밤에도 방 안은 밝다.
  float lf = max(1. - smoothstep(20., 210., length(w - vec2(0., -50.))), 1. - smoothstep(8., 150., length(vec2(ax - 134., w.y + 190.))));
  vec3 A = mix(uAmb, vec3(1.05, .96, .85), clamp(lf * .55 + .4, 0., 1.) * uLamp);
  vec3 col;

  if (w.y < 0.) {
    // 벽지(세로 줄 + 작은 마름모)
    col = mix(vec3(1., .95, .87), vec3(1., .9, .83), step(10., mod(w.x + 5., 20.)));
    vec2 m = vec2(mod(w.x + 10., 20.) - 10., mod(w.y + floor((w.x + 10.) / 20.) * 13., 26.) - 13.);
    col = mix(col, vec3(.97, .74, .76), cov(abs(m.x) + abs(m.y) - 2.));
    col *= A;
    // 허리 아래 나무 패널
    if (w.y > -36.) {
      vec3 wd = mix(WOOD_L, WOOD, band(smoothstep(-30., 0., w.y), 3.)) * (mod(w.x + 8., 16.) < 1. ? .82 : 1.);
      col = mix(col, wd * A, cov(-30. - w.y));
      ink(col, sdBox(w - vec2(w.x, -31.5), vec2(999., 2.)), WOOD_L * A, WOOD_D * A, .8);
    }
    // 천장: 들보와 널, 그 아래 몰딩
    if (w.y < -246.) {
      vec3 cl = vec3(.63, .41, .28) * (mod(-w.y, 14.) < 1. ? .8 : 1.);
      col = mix(col, cl * A, cov(w.y + 262.));
      ink(col, max(abs(mod(w.x + 30., 60.) - 30.) - 5.5, w.y + 262.), vec3(.5, .31, .21) * A, WOOD_D * .7 * A, .9);
      ink(col, sdBox(w - vec2(w.x, -256.), vec2(999., 5.5)), vec3(1., .95, .88) * A, WOOD_D * A, .9);
      col = mix(col, WOOD * A, cov(abs(w.y + 255.) - .5));
    }
    // 창(밖은 15번가). 안쪽 한 쌍 + 바깥 한 쌍
    vec2 wq = vec2(ax - (ax < 109. ? 68. : 150.), w.y);
    if (abs(wq.x) < 23. && w.y > -172. && w.y < -18.) {
      float gl = max(wq.y > -150. ? abs(wq.x) - 16. : length(wq - vec2(0., -150.)) - 16., wq.y + 27.);
      ink(col, gl - 3.6, WOOD_L * A, WOOD_D * A, .9);
      col = mix(col, WOOD * A, cov(abs(gl - 1.8) - .4));
      float g = cov(gl);
      if (g > 0.) {
        vec3 s = sky(wr + vec2(90., 160.), SKY_SIZE);
        s *= 1. - .25 * smoothstep(-4., 0., gl);
        float bar = min(abs(wq.x), min(abs(wq.y + 150.), abs(wq.y + 88.))) - 1.;
        s = mix(s, WOOD_D * A, cov(bar - .7) * .85);
        s = mix(s, WOOD_L * A, cov(bar));
        col = mix(col, s, g);
      }
      ink(col, sdRBox(wq - vec2(0., -25.), vec2(21., 2.4), 1.2), WOOD_L * A, WOOD_D * A, .9);
    }
    // 벽기둥
    float pxl = (ax - 100.) * sign(w.x);
    if (abs(pxl) < 12. && w.y > -250.) {
      vec3 pc = mix(vec3(1., .97, .93), vec3(.86, .74, .7), band(smoothstep(-7., 7., pxl), 4.)) * (1. - .08 * step(.5, fract((pxl + 7.) / 3.5)));
      ink(col, abs(pxl) - 7., pc * A, WOOD_D * A, .9);
      ink(col, max(min(abs(w.y + 44.), abs(w.y + 236.)) - 3., abs(pxl) - 9.), mix(GOLD_L, GOLD, band(smoothstep(-8., 8., pxl), 3.)) * A, GOLD_D * A, .8);
      ink(col, max(-w.y - 8., abs(pxl) - 10.), pc * .95 * A, WOOD_D * A, .9);
    }
    // 선반과 모자 상자 · 모자
    vec2 sq = vec2(ax - 123., w.y);
    if (abs(sq.x) < 16. && w.y > -140. && w.y < -110.) {
      ink(col, sdRBox(sq - vec2(-6., -124.), vec2(5.5, 5.), 1.), (mod(sq.x, 4.) < 2. ? vec3(1., .78, .86) : vec3(1., .93, .95)) * A, ROSE_D * A, .8);
      ink(col, sdRBox(sq - vec2(-6., -130.), vec2(6.5, 1.5), 1.), ROSE * A, ROSE_D * A, .8);
      ink(col, sdEll(sq - vec2(6., -120.5), vec2(7., 1.6)), vec3(.56, .44, .8) * A, LINE * A, .8);
      ink(col, sdRBox(sq - vec2(6., -124.5), vec2(3.6, 3.6), 2.), vec3(.66, .54, .9) * A, LINE * A, .8);
      col = mix(col, GOLD * A, cov(abs(sq.y + 122.4) - .7) * cov(abs(sq.x - 6.) - 3.6));
      ink(col, sdRBox(sq - vec2(0., -117.), vec2(14., 1.6), 1.), WOOD_L * A, WOOD_D * A, .9);
      ink(col, max(abs(abs(sq.x) - 9.) - 1., abs(w.y + 113.) - 2.5), WOOD * A, WOOD_D * A, .7);
    }
    // 휘장(물결) + 금봉
    if (w.y < -168. && w.y > -216.) {
      float sx = mod(w.x + 89., 178.) - 89.;
      float edge = max(w.y - (-200. + 24. * sx * sx / 7921.), -210. - w.y);
      vec3 dr = mix(vec3(.8, .28, .5), vec3(.98, .58, .74), band(.5 + .5 * sin(abs(sx) * .33 - w.y * .12), 3.));
      dr = mix(dr, GOLD, cov(abs(w.y - (-200. + 24. * sx * sx / 7921.) + 2.8) - 1.));
      ink(col, edge, dr * A, ROSE_D * A, .9);
      ink(col, sdBox(w - vec2(w.x, -211.), vec2(999., 1.8)), GOLD * A, GOLD_D * A, .8);
      ink(col, length(vec2(abs(sx) - 89., w.y + 172.)) - 3., GOLD_L * A, GOLD_D * A, .8);
    }
    // 간판(금테 판 + 별과 하트)
    vec2 gq = w - vec2(0., -232.);
    if (abs(gq.x) < 38. && abs(gq.y) < 14.) {
      ink(col, sdRBox(gq, vec2(34., 10.), 5.), GOLD * A, GOLD_D * A, .9);
      ink(col, sdRBox(gq, vec2(31., 7.5), 4.), vec3(1., .95, .9) * A, GOLD_D * A, .7);
      col = mix(col, ROSE * A, cov(heartD(vec2(abs(gq.x) - 16., gq.y) / 1.6) * 1.6));
      col = mix(col, GOLD * A, cov(sdStar(gq, 5.5)));
    }
    // 천장에서 내려온 등
    vec2 lq = vec2(ax - 134., w.y);
    if (abs(lq.x) < 12. && w.y < -182.) {
      col = mix(col, WOOD_D * A, cov(max(abs(lq.x) - .6, max(w.y + 204., -262. - w.y))));
      ink(col, length(lq - vec2(0., -191.5)) - 3.2, mix(vec3(1., .97, .9), vec3(1., .88, .5), uLamp), GOLD_D, .7);
      ink(col, sdTrap(lq - vec2(0., -198.), 3., 9.5, 5.5) - .8, mix(vec3(.99, .62, .76), vec3(.9, .42, .6), band(smoothstep(-8., 8., lq.x), 3.)) * mix(A, vec3(1.), .5), ROSE_D * A, .9);
      col = mix(col, GOLD * A, cov(abs(w.y + 193.) - .7) * cov(abs(lq.x) - 9.5));
    }

    // 가구: 왼쪽 옷걸이, 오른쪽 소파
    if (w.x < -104. && w.x > -164. && w.y > -70.) {
      float pole = min(sdRBox(w - vec2(-134., -64.), vec2(25., 1.3), 1.), min(sdBox(w - vec2(-156., -32.), vec2(1.2, 32.)), sdBox(w - vec2(-112., -32.), vec2(1.2, 32.))));
      pole = min(pole, min(sdRBox(w - vec2(-156., -1.4), vec2(6., 1.4), 1.), sdRBox(w - vec2(-112., -1.4), vec2(6., 1.4), 1.)));
      ink(col, pole, GOLD * A, GOLD_D * A, .8);
      for (int i = 0; i < 4; i++) {
        vec2 q = w - vec2(-151. + float(i) * 11.4, 0.);
        if (abs(q.x) > 9.) continue;
        float bot = i == 0 ? -20. : (i == 1 ? -30. : (i == 2 ? -14. : -24.));
        vec3 gc = i == 0 ? vec3(.3, .36, .62) : (i == 1 ? vec3(1., .98, .95) : (i == 2 ? vec3(.99, .62, .76) : vec3(.6, .86, .78)));
        col = mix(col, GOLD_D * A, cov(abs(length(q - vec2(0., -61.5)) - 1.6) - .45));
        float gd = sdTrap(q - vec2(0., (-58. + bot) * .5), 3.6, i == 1 ? 5. : 7., (bot + 58.) * .5) - 1.2;
        ink(col, gd, gc * (1. - .12 * band(smoothstep(-2., 5., q.x), 2.)) * A, gc * .45 * A, .9);
        if (i != 1) col = mix(col, vec3(1., .95, .9) * A, cov(bot - 3.5 - q.y) * cov(gd + 1.));
        if (i == 1) col = mix(col, vec3(.34, .48, .84) * A, cov(sdTri(q, -58., -52., .9)) * cov(gd + 1.));
      }
    }
    if (w.x > 100. && w.x < 170. && w.y > -40.) {
      vec2 q = w - vec2(135., 0.);
      ink(col, min(sdBox(vec2(abs(q.x) - 24., q.y + 2.), vec2(1.6, 2.5)), 99.), WOOD_D * A, WOOD_D * .6 * A, .6);
      ink(col, sdRBox(q - vec2(0., -22.), vec2(27., 13.), 7.), mix(vec3(1., .66, .78), ROSE, band(smoothstep(-34., -12., q.y), 3.)) * A, ROSE_D * A, 1.);
      col = mix(col, ROSE_D * A, .5 * cov(length(vec2(mod(q.x + 6., 12.) - 6., q.y + 25.)) - .9) * step(abs(q.x), 22.));
      ink(col, sdRBox(vec2(abs(q.x) - 27., q.y + 13.), vec2(5., 10.), 4.), vec3(.99, .58, .72) * A, ROSE_D * A, 1.);
      ink(col, sdRBox(q - vec2(0., -8.5), vec2(24., 5.), 3.), vec3(1., .74, .83) * A, ROSE_D * A, 1.);
      ink(col, sdRBox(rot(q - vec2(-12., -19.), .3), vec2(6., 6.), 2.5), vec3(1., .9, .56) * A, GOLD_D * A, .9);
      col = mix(col, ROSE * A, cov(heartD(rot(q - vec2(-12., -19.), .3) / 1.4) * 1.4));
    }

    // 피팅 자리: 아치 배경판(금테 + 연보라 판 + 조명 기둥 무늬)
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
      col = mix(col, vec3(.97, .5, .7) * A, cov(heartD(vec2(mod(w.x + 6., 12.) - 6., w.y + 9.))) * cov(t1 + 2.));
    }
    // 단상 양옆 덤불
    if (abs(ax - 64.) < 22. && w.y > -27.) bushAt(col, vec2(ax - 64., w.y), A);
  } else {
    // 돌 기단: 큰 돌을 어긋나게 쌓고 돌마다 색을 조금씩 달리한다
    float row = floor((w.y - 80.) / 18.);
    float bx = w.x + row * 19. + hash(vec2(row, 1.)) * 30.;
    vec2 bq = vec2(mod(bx, 38.) - 19., mod(w.y - 80., 18.) - 9.);
    float bh = hash(vec2(floor(bx / 38.), row));
    float bd = sdRBox(bq, vec2(18.2, 8.2), 2.);
    vec3 st = mix(vec3(.84, .7, .66), vec3(.76, .64, .7), bh) * (.92 + .14 * hash(vec2(row, floor(bx / 38.))));
    st = mix(st, st * 1.12, cov(abs(bd + 1.8) - .6) * step(bq.y, 0.));
    st = mix(st, st * .84, cov(abs(bd + 1.8) - .6) * step(0., bq.y));
    if (bh > .95) st = mix(st, st * .8, cov(heartD(bq / 2.2) * 2.2));
    col = mix(vec3(.4, .27, .3), st, cov(bd)) * (1. - clamp(row * .055, 0., .5));
    // 아래층 바닥 앞단(장밋빛 깔개 + 술)
    if (w.y < 84.) {
      float sc = mod(w.x + 4., 8.) - 4.;
      float fr = w.y - (77. + sqrt(max(0., 16. - sc * sc)));
      vec3 rg = mix(vec3(.97, .56, .7), vec3(.86, .38, .54), band(smoothstep(64., 80., w.y), 3.));
      rg = mix(rg, GOLD, cov(abs(w.y - 68.) - .8));
      ink(col, fr, rg, ROSE_D, .9);
    }
    // 발판 앞면: 큼직한 나무 패널(하트 · 별 번갈아)
    if (w.y < 64.) {
      float pm = mod(w.x + 23., 46.) - 23.;
      float pi = mod(floor((w.x + 23.) / 46.), 2.);
      vec3 wd = mix(WOOD_L, WOOD, band(smoothstep(6., 58., w.y), 4.));
      vec2 pq = vec2(pm, w.y - 31.5);
      float pan = sdRBox(pq, vec2(18., 19.), 2.5);
      wd = mix(wd, WOOD * .9, cov(pan));
      wd = mix(wd, WOOD_D, cov(abs(pan) - .55));
      wd = mix(wd, WOOD_L, cov(abs(pan + 2.4) - .45) * step(pq.x + pq.y, 0.));
      wd = mix(wd, WOOD_D * 1.3, cov(abs(pan + 2.4) - .45) * step(0., pq.x + pq.y) * .6);
      wd = mix(wd, GOLD_D, cov((pi < 1. ? heartD(pq / 3.4) * 3.4 : sdStar(pq, 6.5)) - .9));
      wd = mix(wd, GOLD, cov(pi < 1. ? heartD(pq / 3.4) * 3.4 : sdStar(pq, 6.5)));
      if (w.y > 57.) wd = mix(mix(WOOD_L, WOOD, band((w.y - 57.) / 7., 3.)), WOOD_D, cov(abs(w.y - 63.6) - .5));
      if (w.y > 56.2 && w.y < 57.2) wd = WOOD_D;
      col = wd;
    }
    // 가운데 카펫이 발판에서 아래층까지 내려온다
    if (w.y < 80.) {
      float cz = ax - 26.;
      vec3 cp = mix(vec3(.97, .5, .68), vec3(.86, .34, .55), band(smoothstep(5., 80., w.y), 5.));
      if (w.y > 57. && w.y < 64.) cp = vec3(1., .6, .76);
      cp = mix(cp, GOLD, cov(abs(cz + 3.5) - .9));
      cp = mix(cp, GOLD, cov(abs(w.x) + abs(mod(w.y - 6., 25.) - 12.5) - 5.));
      cp = mix(cp, vec3(.9, .4, .6), cov(abs(w.x) + abs(mod(w.y - 6., 25.) - 12.5) - 3.));
      col = mix(col, cp, cov(cz));
      col = mix(col, ROSE_D, .8 * cov(abs(cz) - .5));
    }
    col *= A;
    // 근경 소품(아래층 바닥 위): 쇼핑백 · 모자 상자 · 화분 · 구두 상자 — 진한 외곽선
    if (w.y > 14. && w.y < 66.) {
      vec2 q = vec2(ax - 56., w.y);
      if (abs(q.x) < 12.) {
        col = mix(col, GOLD_D * A, cov(max(abs(length(q - vec2(0., 41.)) - 5.) - .8, q.y - 41.)));
        ink(col, sdRBox(q - vec2(0., 52.), vec2(8.5, 11.), 1.5), mix(vec3(1., .66, .8), ROSE, band(smoothstep(-6., 6., q.x), 3.)) * A, ROSE_D * A, 1.1);
        col = mix(col, vec3(1., .96, .97) * A, cov(abs(q.y - 52.) - 2.6) * cov(abs(q.x) - 8.5));
        col = mix(col, ROSE * A, cov(heartD((q - vec2(0., 52.)) / 1.3) * 1.3));
      }
      q = vec2(ax - 82., w.y);
      if (abs(q.x) < 15.) {
        ink(col, sdRBox(q - vec2(0., 56.), vec2(11., 7.), 1.), (mod(q.x + 12., 6.) < 3. ? vec3(.8, .72, .98) : vec3(.95, .92, 1.)) * A, LINE * A, 1.1);
        ink(col, sdRBox(q - vec2(0., 48.), vec2(12.5, 2.2), 1.), vec3(.62, .5, .9) * A, LINE * A, 1.1);
        ink(col, sdRBox(q - vec2(-1., 40.), vec2(8., 5.), 1.), vec3(1., .78, .86) * A, ROSE_D * A, 1.1);
        ink(col, sdRBox(q - vec2(-1., 34.), vec2(9.2, 1.9), 1.), ROSE * A, ROSE_D * A, 1.1);
        ink(col, min(length(q - vec2(-3.6, 30.6)), length(q - vec2(1.6, 30.6))) - 2.2, GOLD * A, GOLD_D * A, .9);
      }
      q = vec2(ax - 122., w.y);
      if (abs(q.x) < 22.) {
        bushAt(col, q - vec2(0., 50.), A);
        ink(col, sdTrap(q - vec2(0., 56.5), 8., 5.5, 6.) - 1., mix(vec3(.96, .62, .46), vec3(.8, .42, .32), band(smoothstep(-6., 6., q.x), 3.)) * A, vec3(.4, .16, .14) * A, 1.1);
        ink(col, sdRBox(q - vec2(0., 50.), vec2(9.6, 1.8), 1.), vec3(.98, .68, .52) * A, vec3(.4, .16, .14) * A, 1.1);
      }
      q = vec2(ax - 158., w.y);
      if (abs(q.x) < 16.) {
        ink(col, sdRBox(q - vec2(0., 58.), vec2(13., 5.), 1.), vec3(1., .94, .84) * A, WOOD_D * A, 1.1);
        ink(col, sdRBox(q - vec2(0., 52.), vec2(14., 1.9), 1.), GOLD_L * A, WOOD_D * A, 1.1);
        ink(col, sdRBox(q - vec2(3., 46.), vec2(10., 4.), 1.), vec3(.74, .9, .86) * A, vec3(.2, .42, .4) * A, 1.1);
        ink(col, sdRBox(q - vec2(3., 41.), vec2(11., 1.7), 1.), vec3(.5, .78, .74) * A, vec3(.2, .42, .4) * A, 1.1);
      }
    }
    // 금테 발판 윗면
    float top = sdBox(w - vec2(w.x, 2.5), vec2(999., 2.5));
    ink(col, top, mix(GOLD_L, GOLD, band(smoothstep(.5, 5., w.y), 3.)) * A, GOLD_D * A, .8);
    col = mix(col, vec3(1., .98, .86) * A, cov(w.y - 1.));
    col = mix(col, GOLD_D * A, .6 * cov(length(vec2(mod(w.x + 11., 22.) - 11., w.y - 2.9)) - .9));
    col = mix(col, mix(vec3(1., .62, .78), vec3(.95, .46, .66), smoothstep(.5, 5., w.y)) * A, cov(ax - 25.) * cov(top));
    // 발밑 그림자
    col = mix(col, vec3(.3, .14, .32), .32 * (1. - smoothstep(.55, 1., length(vec2(w.x / uShadow, (w.y - .4) / 1.9)))));
  }

  // 등불 번짐
  col += vec3(1., .78, .42) * exp(-length(vec2(ax - 134., w.y + 190.)) * .09) * .4 * uLamp;
  // 위에서 내려오는 조명 두 줄기
  if (w.y < 5. && w.y > -210.) {
    vec2 d = normalize(vec2(-70., 170.));
    vec2 o = vec2(ax, w.y) - vec2(70., -190.);
    float t = dot(o, d);
    float bm = (1. - smoothstep(7. + t * .09, 11. + t * .13, abs(dot(o, vec2(-d.y, d.x))))) * step(0., t);
    col += vec3(1., .95, .8) * band(bm, 3.) * (.06 + .08 * uLamp);
  }
  // 떠다니는 반짝이
  vec2 sc = floor(w / 31.);
  float sh = hash(sc + 5.);
  if (sh > .5 && w.y < 0. && w.y > -246.) {
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
