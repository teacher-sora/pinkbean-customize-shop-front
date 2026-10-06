// 배경 장면 셰이더(WebGL1). 텍스처 없이 수식(거리 함수)만으로 그린다 — 받아 올 그림이 없어 가볍다.
//  · sky  : 앱 배경. 메이플 15번가 — 하늘 · 뭉게구름 · 도시 스카이라인 · 열기구 · 해와 달 · 별자리.
//  · room : 미리보기 무대. 핑크빈의 집 안에 차린 커마샵 피팅룸. 둥근 창밖으로 같은 15번가가 보인다.
// 그림체는 메이플스토리 배경을 따른다: 도트가 아니라 **매끈한 외곽선과 부드러운 채색**이다(도트는 캐릭터만).
// 좌표 단위는 '게임 픽셀'이고, 화면 해상도에 맞춰 가장자리를 부드럽게 깎는다(gPx = 화면 한 픽셀이 차지하는 단위 길이).

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

// 거리 → 덮는 정도(가장자리 한 픽셀을 부드럽게)
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
  float x = p.x + uTime * speed + seed * 57.;
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

// 핑크빈(공식 간판 그림: 헤드폰 · 보라색 뿔귀 · 흰 배 · 자주색 발 · 꼬리). q = 몸 가운데 기준, 키 약 36.
void pinkbean(inout vec3 col, vec2 q, vec3 amb, float blink){
  if (q.x < -18. || q.x > 23. || q.y < -19. || q.y > 20.) return;
  vec3 line = vec3(.27, .1, .2) * amb;
  vec3 pink = vec3(.985, .74, .8), purple = vec3(.47, .27, .66);
  // 꼬리
  ink(col, min(sdSeg(q, vec2(9., 10.), vec2(15.5, 9.)), sdSeg(q, vec2(15.5, 9.), vec2(18.5, 4.))) - .8, pink * amb, line, .7);
  ink(col, length(q - vec2(19.2, 2.4)) - 2.5, purple * amb, line, .7);
  col = mix(col, vec3(.66, .46, .86) * amb, cov(length(q - vec2(18.5, 1.6)) - .9));
  // 헤드폰 띠
  ink(col, max(abs(length(q - vec2(0., -3.)) - 14.) - .95, q.y + 5.), vec3(.97, .97, .99) * amb, line, .65);
  // 뿔귀
  float ex = abs(q.x);
  float ear = sdCone(vec2(ex, q.y), vec2(6.2, -9.5), vec2(12.2, -15.8), 3.6, .7);
  ink(col, ear, purple * amb, line, .7);
  col = mix(col, vec3(.63, .43, .84) * amb, cov(ear + .9) * smoothstep(.2, .7, sin((ex * .7 - q.y * .7) * 2.6)));
  // 왼쪽 헤드폰(몸 뒤로 살짝)
  ink(col, sdEll(q - vec2(-12.8, -2.), vec2(2.9, 5.4)), vec3(.56, .8, .27) * amb, line, .7);
  col = mix(col, vec3(.98, .98, 1.) * amb, cov(sdEll(q - vec2(-13.6, -2.), vec2(1.5, 4.))));
  // 몸
  float body = smin(sdEll(q - vec2(0., -4.), vec2(10.2, 10.2)), sdEll(q - vec2(0., 5.5), vec2(12.6, 10.6)), 5.);
  ink(col, body, mix(pink, vec3(.95, .6, .71), smoothstep(2., 17., q.y + q.x * .35)) * amb, line, .8);
  float inb = cov(body + .7);
  col = mix(col, vec3(1., .985, .985) * amb, cov(sdEll(q - vec2(-.6, 9.2), vec2(8.6, 6.4))) * inb);
  col = mix(col, vec3(1., .92, .94) * amb, cov(sdEll(rot(q - vec2(-4.6, -10.2), -.5), vec2(1.7, .9))));
  col = mix(col, vec3(.97, .5, .6) * amb, .6 * (1. - smoothstep(.4, 1., length((vec2(abs(q.x + .2), q.y) - vec2(7.3, 1.4)) / vec2(2.5, 1.4)))) * inb);
  // 눈 · 입
  vec2 e = vec2(abs(q.x + .2) - 4., q.y + 2.2);
  if (blink > .5) col = mix(col, line, cov(sdSeg(e, vec2(-1.8, .2), vec2(1.8, .2)) - .5));
  else { col = mix(col, line, cov(length(e) - 2.3)); col = mix(col, vec3(1.), cov(length(e) - 1.05)); }
  vec2 m = q - vec2(-.2, .2);
  col = mix(col, line, cov(max(abs(length(vec2(abs(m.x) - 1.35, m.y)) - 1.35) - .4, -m.y)));
  // 오른쪽 헤드폰(초록 테 · 흰 판 · 주황 별)
  ink(col, length(q - vec2(12.4, -1.6)) - 6.3, vec3(.56, .8, .27) * amb, line, .75);
  ink(col, length(q - vec2(13.2, -1.6)) - 5., vec3(.99, .99, 1.) * amb, line, .5);
  col = mix(col, vec3(.97, .55, .13) * amb, cov(sdStar(rot(q - vec2(13.3, -1.4), .25), 3.7)));
  // 발
  vec3 foot = vec3(.67, .2, .5) * amb;
  ink(col, sdEll(rot(q - vec2(-9.8, 13.), .55), vec2(2.8, 5.2)), foot, line, .75);
  ink(col, sdEll(rot(q - vec2(5.8, 14.2), -.12), vec2(3., 5.4)), foot, line, .75);
  col = mix(col, vec3(.82, .36, .64) * amb, cov(sdEll(rot(q - vec2(-10.5, 12.4), .55), vec2(1., 3.2))) + cov(sdEll(rot(q - vec2(5., 13.6), -.12), vec2(1.1, 3.4))));
}
void pinkbeanAt(inout vec3 col, vec2 q, float s, vec3 amb, float blink){
  float keep = gPx; gPx = keep / s;
  pinkbean(col, q / s, amb, blink);
  gPx = keep;
}

vec3 sky(vec2 p, vec2 size){
  float t = p.y / size.y;
  vec3 col = gradAt(t);
  if (uNight > .01) {
    col = mix(col, vec3(1., .97, .9), min(1., stars(p, t)) * uNight);
    CONSTELLATIONS
  }
  orbs(col, p, size);
  cloudLayer(col, p, size.y * .34, .55, 1., 3., .45);
  cloudLayer(col, p, size.y * .58, .8, 2.2, 9., .1);
  SKY_MID
  return col;
}
`

const SKY_MAIN = `
void main(){
  gPx = uPx;
  vec2 p = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) * uPx;
  gl_FragColor = vec4(sky(p, uRes * uPx), 1.);
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
    cloudLayer(col, p, 27., .5, 2., 33., .05);
    cityLayer(col, p, size.y, 26., size.y * .4, size.y * .72, 4., .62, size.y * .93);
    balloon(col, p - vec2(mod(uTime * 2.5 + size.x * .7, size.x + 60.) - 30., 13. + sin(uTime * .5) * 1.5), vec3(.96, .42, .4), vec3(1., .9, .6), .1);
    balloon(col, p - vec2(mod(uTime * 1.6 + size.x * .2, size.x + 60.) - 30., size.y * .3 + sin(uTime * .4 + 2.) * 2.), vec3(.4, .7, .9), vec3(1., .97, .92), .25);
    pinkbeanAt(col, p - vec2(mod(uTime * 4., size.x + 60.) - 30., 12.5 + sin(uTime * .7) * 1.5), .56, mix(uAmb, vec3(1.), .5), step(.96, fract(uTime * .23)));
    cityLayer(col, p, size.y, 38., size.y * .2, size.y * .52, 11., .12, size.y * .66);`,
}

const ROOM_PARTS = {
  CONSTELLATIONS: `
    constel(col, cStar(p - vec2(152., 63.)), 3.);
    constel(col, cStar(p - vec2(20., 82.)), 0.);`,
  SKY_MID: `
    cityLayer(col, p, size.y, 15., size.y * .34, size.y * .5, 4., .6, size.y * .56);
    balloon(col, (p - vec2(mod(uTime * 1.4, size.x + 40.) - 20., 66. + sin(uTime * .5) * 1.5)) / .6, vec3(.96, .42, .4), vec3(1., .9, .6), .1);
    cityLayer(col, p, size.y, 21., size.y * .26, size.y * .36, 11., .12, size.y * .4);`,
}

// 핑크빈의 집 안. w = 발이 닿는 자리(0,0) 기준 좌표(아래가 +). 메이플 맵처럼 옆에서 본 그림이다: y=0 이 바닥 윗면(발판)이고
// 그 아래는 발판 앞면이다. 가운데는 보라색 뿔 아치의 피팅 부스(밝은 안쪽 벽 + 노란 커튼 = 집 대문의 색)다.
const ROOM_MAIN = `
uniform vec2 uOrigin;
uniform float uShadow;
const vec2 WIN = vec2(62., -78.);   // 둥근 창(좌우 대칭)
const vec2 SKY_SIZE = vec2(180., 124.);
const vec3 LINE = vec3(.56, .3, .46);
const vec3 PUR = vec3(.5, .31, .72);
const vec3 PUR_L = vec3(.67, .48, .88);
const vec3 PUR_D = vec3(.3, .16, .44);
const vec3 GOLD = vec3(.97, .78, .42);
const vec3 GOLD_D = vec3(.6, .4, .22);

void main(){
  gPx = uPx;
  vec2 w = (vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) - uOrigin) * uPx;
  float ax = abs(w.x);
  vec3 col;
  float self = 0.;           // 스스로 빛나는 정도(창밖 · 켜진 등) — 실내 빛을 곱하지 않는다

  if (w.y < 0.) {
    // 돔 벽: 집 겉과 같은 분홍. 돔 바깥(천장 그늘)은 짙은 자주.
    float dome = sdEll(w - vec2(0., 20.), vec2(140., 245.));
    col = mix(vec3(.5, .24, .46), vec3(.4, .18, .4), smoothstep(-120., -260., w.y));
    vec3 wall = mix(vec3(1., .82, .88), vec3(.99, .72, .82), smoothstep(-190., -20., w.y));
    wall = mix(wall, vec3(1., .9, .93), .6 * (1. - smoothstep(.3, 1., length((w - vec2(-58., -150.)) / vec2(22., 9.)))));
    ink(col, dome + 5., wall, PUR_D, .8);
    col = mix(col, mix(PUR, PUR_L, smoothstep(1., -3., dome + 2.5)), cov(abs(dome + 2.5) - 2.5));
    float inDome = cov(dome + 5.8);
    // 아래 벽: 물결 끝의 짙은 분홍 띠 + 보라 굽도리
    float wave = w.y - (-27. + sin(w.x * .21) * 2.4);
    col = mix(col, vec3(.74, .38, .56), cov(abs(wave) - .45) * inDome);
    col = mix(col, mix(vec3(.97, .6, .75), vec3(.94, .52, .7), smoothstep(-26., 0., w.y)), cov(-wave) * inDome);
    col = mix(col, vec3(1., .78, .86), .8 * cov(length(vec2(mod(w.x + 9., 18.) - 9., w.y + 14.)) - 1.6) * inDome);
    ink(col, sdBox(w - vec2(w.x, -2.6), vec2(999., 2.8)), mix(PUR_L, PUR, smoothstep(-5., 0., w.y)), PUR_D, .6);

    // 둥근 창(집의 눈처럼 하늘색 테)
    vec2 wq = vec2(ax, w.y) - WIN;
    float wd = length(wq) - 19.;
    if (wd < 6.) {
      ink(col, wd - 4.4, mix(vec3(.9, .97, 1.), vec3(.68, .84, .98), smoothstep(-20., 20., wq.y)), vec3(.3, .42, .7), .8);
      col = mix(col, vec3(1.), .7 * cov(abs(wd - 3.) - .4) * step(wq.y, -4.));
      float g = cov(wd);
      if (g > 0.) {
        vec3 s = sky(w + vec2(90., 150.), SKY_SIZE);
        s = mix(s, vec3(1.), .12 * smoothstep(.7, 1., sin((w.x + w.y) * .09 + 1.)));
        s *= 1. - .28 * smoothstep(-4.5, 0., wd);
        float bar = min(abs(wq.x), abs(wq.y)) - 1.;
        s = mix(s, vec3(.3, .42, .7), cov(bar - .6) * .85);
        s = mix(s, vec3(.86, .95, 1.), cov(bar));
        col = mix(col, s, g);
        self = g * (1. - cov(bar - .6));
      }
      col = mix(col, vec3(.3, .42, .7), cov(abs(wd) - .4));
    }

    // 피팅 부스: 보라색 뿔 아치 + 밝은 안쪽 벽 + 노란 커튼
    if (ax < 44. && w.y > -116.) {
      vec2 aq = vec2(w.x, w.y + 66.);
      float arch = w.y > -66. ? ax - 31. : length(aq) - 31.;
      float r = length(aq);
      float la = mod(atan(aq.y, aq.x) + 3.14159 + .2618, .5236) - .2618;
      float spike = w.y < -62. ? r - (31. + 8.5 * max(0., 1. - abs(la) / .19)) : 99.;
      ink(col, min(arch, spike), PUR, PUR_D, .8);
      col = mix(col, PUR_L, cov(abs(arch + 1.6) - .6));
      float inner = arch + 5.2;
      vec3 back = mix(vec3(1., .985, .93), vec3(1., .95, .84), smoothstep(-96., 0., w.y));
      back = mix(back, vec3(1., .93, .78), .5 * smoothstep(2.6, 3.2, abs(mod(w.x + 6., 12.) - 6.)));
      back *= 1. - .16 * smoothstep(-5., 0., inner);
      ink(col, inner, back, PUR_D, .7);
      float cw = w.y < -40. ? mix(13., 4.5, smoothstep(-92., -40., w.y)) : 4.5 + 3. * smoothstep(-40., -4., w.y);
      float cd = max((25.8 - cw) - ax, inner + .4);
      vec3 cur = mix(vec3(.97, .68, .2), vec3(1., .9, .44), .5 + .5 * sin(ax * 1.7 + w.y * .05));
      ink(col, cd, cur, vec3(.66, .4, .12), .6);
      col = mix(col, PUR, cov(abs(w.y + 40.) - 1.7) * cov(cd));
    }

    // 아치 위 간판
    vec2 sq = w - vec2(0., -134.);
    if (abs(sq.x) < 26. && abs(sq.y) < 24.) {
      ink(col, length(sq) - 19., GOLD, GOLD_D, .8);
      col = mix(col, vec3(1., .93, .68), cov(abs(length(sq) - 17.6) - .4));
      ink(col, length(sq) - 16., mix(vec3(1., .95, .97), vec3(1., .86, .91), smoothstep(-12., 14., sq.y)), GOLD_D, .6);
      pinkbeanAt(col, sq - vec2(-1.5, -.5), .72, vec3(1.), step(.97, fract(uTime * .19)));
    }

    // 벽등
    vec2 lq = vec2(ax - 44., w.y + 118.);
    if (abs(lq.x) < 7. && abs(lq.y) < 12.) {
      ink(col, min(sdBox(lq - vec2(0., 6.5), vec2(.8, 3.)), sdRBox(lq - vec2(0., 9.5), vec2(3.4, 1.2), 1.)), GOLD, GOLD_D, .5);
      float sh = sdTrap(lq - vec2(0., -.5), 2.2, 3.8, 4.) - .8;
      ink(col, sh, mix(vec3(1., .96, .9), vec3(1., .9, .56), uLamp), GOLD_D, .55);
      self = max(self, cov(sh) * uLamp);
    }
  } else {
    // 발판 앞면: 보라색 바탕에 밝은 물결 띠(핑크빈 마을 땅의 물결 무늬)
    col = mix(vec3(.56, .37, .78), vec3(.36, .22, .56), smoothstep(8., 150., w.y));
    float wv = w.y - (16. + sin(w.x * .2) * 2.6);
    col = mix(col, vec3(.7, .52, .9), cov(wv));
    col = mix(col, PUR_D, .7 * cov(abs(wv) - .45));
    col = mix(col, vec3(.8, .64, .96), cov(abs(w.y - (9. + sin(w.x * .2 + 1.2) * 1.4)) - .5));
    float wv2 = w.y - (62. + sin(w.x * .13 + 2.) * 4.);
    col = mix(col, col * .88, cov(-wv2) * 0. + cov(wv2));
    col = mix(col, vec3(.62, .44, .84), .8 * cov(abs(wv2) - .5));
    col = mix(col, vec3(.63, .44, .84), .7 * cov(sdStar(vec2(mod(w.x + 20., 40.) - 20., w.y - 36. - mod(floor((w.x + 20.) / 40.), 2.) * 22.), 3.2)));
    // 윗면
    ink(col, sdBox(w - vec2(w.x, 2.5), vec2(999., 2.5)), mix(vec3(1., .86, .91), vec3(.98, .7, .82), smoothstep(.5, 4.8, w.y)), PUR_D, .7);
    col = mix(col, vec3(1., .96, .97), cov(w.y - .9));
    // 러그: 발판 위에 깔려 앞으로 살짝 늘어진다
    if (ax < 50. && w.y < 18.) {
      float drape = max(sdRBox(w - vec2(0., 6.), vec2(36., 9.), 3.), -w.y + 1.);
      float sc = mod(w.x + 4.5, 9.) - 4.5;
      drape = max(drape, w.y - (11. + sqrt(max(0., 20. - sc * sc))));
      ink(col, drape, mix(vec3(1., .86, .4), vec3(.97, .7, .24), smoothstep(2., 14., w.y)), vec3(.62, .38, .12), .6);
      col = mix(col, PUR, cov(abs(w.y - 9.5) - .5) * cov(ax - 34.));
      col = mix(col, vec3(1., .97, .86), cov(sdStar(w - vec2(0., 5.4), 2.6)) * cov(drape + 1.));
      ink(col, sdRBox(w - vec2(0., .3), vec2(45., 1.5), 1.4), vec3(1., .84, .38), vec3(.62, .38, .12), .6);
      col = mix(col, vec3(1., .95, .7), cov(abs(w.y + .3) - .35) * cov(ax - 43.));
    }
    // 발밑 그림자
    col = mix(col, vec3(.3, .14, .32), .32 * (1. - smoothstep(.55, 1., length(vec2(w.x / uShadow, (w.y - .4) / 1.9)))));
  }

  // 옷걸이(왼쪽)
  if (w.x < -44. && w.x > -96. && w.y > -52. && w.y < 1.) {
    float pole = min(sdRBox(w - vec2(-70., -45.5), vec2(21., 1.1), 1.), min(sdBox(w - vec2(-88., -23.), vec2(1., 22.)), sdBox(w - vec2(-52., -23.), vec2(1., 22.))));
    pole = min(pole, min(sdRBox(w - vec2(-88., -1.2), vec2(5., 1.2), 1.), sdRBox(w - vec2(-52., -1.2), vec2(5., 1.2), 1.)));
    ink(col, pole, GOLD, GOLD_D, .6);
    ink(col, min(length(w - vec2(-91.5, -45.5)), length(w - vec2(-48.5, -45.5))) - 1.8, GOLD, GOLD_D, .6);
    for (int i = 0; i < 3; i++) {
      float fi = float(i);
      vec2 gq = w - vec2(-81. + fi * 11., 0.);
      if (abs(gq.x) > 8.) continue;
      float bot = i == 0 ? -15. : (i == 1 ? -19. : -12.);
      col = mix(col, GOLD_D, cov(abs(length(gq - vec2(0., -43.)) - 1.4) - .4));
      vec3 gc = i == 0 ? vec3(.26, .32, .56) : (i == 1 ? vec3(.98, .99, 1.) : vec3(.6, .86, .78));
      vec3 gl = i == 0 ? vec3(.13, .16, .32) : (i == 1 ? vec3(.5, .56, .72) : vec3(.26, .5, .46));
      float gd = sdTrap(gq - vec2(0., (-40. + bot) * .5), 3.4, i == 1 ? 4.6 : 6.4, (bot + 40.) * .5) - 1.;
      ink(col, gd, gc * (1. - .1 * smoothstep(-1., 4., gq.x)), gl, .6);
      float inside = cov(gd + .8);
      if (i == 0) col = mix(col, vec3(1., .84, .42), cov(length(vec2(gq.x, mod(gq.y, 6.) - 3.)) - .8) * inside);
      if (i == 1) { col = mix(col, vec3(.3, .46, .82), cov(sdTri(gq, -40., -35.5, .9)) * inside); col = mix(col, vec3(.3, .46, .82), cov(abs(gq.y - bot + 2.2) - .6) * inside); }
      if (i == 2) { col = mix(col, vec3(1., .98, .96), cov(bot - 3. - gq.y) * inside); col = mix(col, vec3(.95, .5, .6), cov(min(length(gq - vec2(-1.6, -36.)), length(gq - vec2(1.6, -36.))) - 1.3)); }
    }
  }
  // 전신 거울(오른쪽 뒤)
  vec2 mq = w - vec2(78., -27.);
  if (abs(mq.x) < 14. && abs(mq.y) < 29.) {
    ink(col, min(sdBox(mq - vec2(0., 22.5), vec2(1., 3.)), sdRBox(mq - vec2(0., 25.8), vec2(7., 1.2), 1.)), GOLD, GOLD_D, .6);
    ink(col, sdEll(mq, vec2(10.4, 21.4)), GOLD, GOLD_D, .7);
    col = mix(col, vec3(1., .93, .68), cov(abs(sdEll(mq, vec2(9.4, 20.4))) - .35));
    vec3 gl = mix(vec3(.93, .98, 1.), vec3(.72, .87, .98), smoothstep(-18., 18., mq.y - mq.x * .5));
    gl = mix(gl, vec3(1.), .75 * smoothstep(.55, .9, sin((mq.x + mq.y) * .32 + .6)));
    ink(col, sdEll(mq, vec2(8.2, 19.2)), gl, vec3(.5, .62, .78), .5);
  }
  // 분홍 탁자와 그 위에 앉은 핑크빈(가게 주인)
  if (w.x > 30. && w.x < 72. && w.y > -50. && w.y < 1.) {
    ink(col, min(sdBox(w - vec2(40., -8.), vec2(1.3, 8.)), sdBox(w - vec2(62., -8.), vec2(1.3, 8.))), vec3(.93, .5, .68), LINE, .6);
    ink(col, sdRBox(w - vec2(51., -17.4), vec2(15.5, 2.2), 1.6), mix(vec3(1., .74, .84), vec3(.97, .6, .75), smoothstep(-19., -15.5, w.y)), LINE, .7);
    pinkbeanAt(col, w - vec2(50., -32.6), .66, vec3(1.), step(.96, fract(uTime * .21 + .4)));
  }

  // 실내 빛: 시각에 따른 빛 + 벽등 불빛(밤에도 캐릭터 둘레는 밝다)
  float ld = min(length(w - vec2(44., -118.)), length(w - vec2(-44., -118.)));
  float lf = (1. - smoothstep(6., 190., ld)) * uLamp;
  col *= mix(mix(uAmb, vec3(1.04, .95, .84), lf * .85), vec3(1.), self);
  col += vec3(1., .78, .4) * exp(-ld * .13) * .35 * uLamp;
  if (w.y > 0. && w.y < 5.) col += uLight * (1. - smoothstep(18., 30., abs(ax - WIN.x)));
  // 떠다니는 반짝이
  vec2 sc = floor(w / 31.);
  float sh = hash(sc + 5.);
  if (sh > .5 && w.y < 0.) {
    float fy = mod(hash(sc + 2.) * 31. - uTime * (1. + sh * 2.), 31.);
    vec2 sp = w - sc * 31. - vec2(4. + hash(sc) * 23. + sin(uTime * .3 + sh * 6.) * 2., fy);
    col = mix(col, vec3(1., .97, .99), cov(abs(sp.x) * abs(sp.y) * 2.5 + length(sp) * .5 - .9) * (.4 + .4 * sin(uTime * 2. + sh * 20.)) * smoothstep(0., 4., min(fy, 31. - fy)));
  }

  gl_FragColor = vec4(col, 1.);
}
`

const fill = (src: string, parts: Record<string, string>) => Object.entries(parts).reduce((s, [k, v]) => s.replace(k, v), src)

export const fragSource = (kind: 'sky' | 'room') =>
  kind === 'sky' ? fill(COMMON, SKY_PARTS) + SKY_MAIN : fill(COMMON, ROOM_PARTS) + ROOM_MAIN
