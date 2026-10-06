// 배경 장면 셰이더(WebGL1). 텍스처 없이 수식만으로 도트 그림을 그린다 — 받아 올 그림이 없어 가볍다.
//  · sky  : 앱 배경. 하늘 · 구름 · 해와 달 · 별자리 · 뜬 섬.
//  · room : 미리보기 무대. 핑크빈 커마샵 피팅룸. 창밖으로 같은 하늘이 보인다.
// 좌표는 전부 '도트 한 칸' 단위의 정수다(캔버스를 작게 그리고 CSS 로 정수배 확대한다 → 도트가 또렷하고 비용이 작다).

export const VERT = 'attribute vec2 aPos; void main(){ gl_Position = vec4(aPos, 0., 1.); }'

const COMMON = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec2 uRes;
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

float hash(vec2 p){ vec3 q = fract(vec3(p.xyx) * .1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
float vnoise(vec2 p){
  vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  return mix(mix(hash(i), hash(i + vec2(1., 0.)), f.x), mix(hash(i + vec2(0., 1.)), hash(i + vec2(1., 1.)), f.x), f.y);
}
float b2(vec2 a){ a = floor(a); return fract(a.x * .5 + a.y * a.y * .75); }
float bayer(vec2 a){ return b2(.5 * a) * .25 + b2(a); }
float sdSeg(vec2 p, vec2 a, vec2 b){ vec2 pa = p - a, ba = b - a; return length(pa - ba * clamp(dot(pa, ba) / dot(ba, ba), 0., 1.)); }
bool box(vec2 p, float x0, float y0, float x1, float y1){ return p.x >= x0 && p.x < x1 && p.y >= y0 && p.y < y1; }

vec3 gradAt(float t){
  t = clamp(t, 0., 1.);
  if (t < .42) return mix(uSky[0], uSky[1], t / .42);
  if (t < .78) return mix(uSky[1], uSky[2], (t - .42) / .36);
  return mix(uSky[2], uSky[3], (t - .78) / .22);
}

float stars(vec2 p, float t){
  vec2 c = floor(p / 7.);
  float h = hash(c);
  if (h < .8) return 0.;
  vec2 d = abs(p - (c * 7. + floor(vec2(hash(c + 3.1), hash(c + 7.7)) * 6.)));
  float m = d.x + d.y;
  float on = m < .5 ? 1. : (h > .965 && m < 1.5 ? .5 : 0.);
  return on * (.5 + .5 * step(.5, fract(uTime * (.2 + h * .5) + h * 31.))) * (1. - smoothstep(.72, .98, t));
}

#define S(ax,ay,bx,by) d = min(d, sdSeg(q, vec2(ax,ay), vec2(bx,by)));
#define N(ax,ay) n = min(n, length(q - vec2(ax,ay)));
// 별자리 셋: 핑크빈 · 국자 · 별. 돌려주는 값 = (선까지 거리, 별까지 거리)
vec2 cPinkbean(vec2 q){
  float d = 99., n = 99.;
  if (abs(q.x) > 21. || abs(q.y) > 22.) return vec2(99.);
  S(-8.,-12.,8.,-12.) S(8.,-12.,16.,-3.) S(16.,-3.,15.,9.) S(15.,9.,7.,15.) S(7.,15.,-7.,15.) S(-7.,15.,-15.,9.) S(-15.,9.,-16.,-3.) S(-16.,-3.,-8.,-12.)
  S(-8.,-12.,-17.,-18.) S(-17.,-18.,-16.,-3.) S(8.,-12.,17.,-18.) S(17.,-18.,16.,-3.)
  S(-3.,6.,0.,8.) S(0.,8.,3.,6.)
  N(-8.,-12.) N(8.,-12.) N(16.,-3.) N(15.,9.) N(7.,15.) N(-7.,15.) N(-15.,9.) N(-16.,-3.) N(-17.,-18.) N(17.,-18.) N(-6.,1.) N(6.,1.)
  return vec2(d, n);
}
vec2 cDipper(vec2 q){
  float d = 99., n = 99.;
  if (abs(q.x) > 26. || abs(q.y) > 13.) return vec2(99.);
  S(-22.,-4.,-14.,-7.) S(-14.,-7.,-6.,-5.) S(-6.,-5.,0.,-1.) S(0.,-1.,1.,7.) S(1.,7.,11.,8.) S(11.,8.,12.,-1.) S(12.,-1.,0.,-1.)
  N(-22.,-4.) N(-14.,-7.) N(-6.,-5.) N(0.,-1.) N(1.,7.) N(11.,8.) N(12.,-1.)
  return vec2(d, n);
}
vec2 cStar(vec2 q){
  float d = 99., n = 99.;
  if (abs(q.x) > 12. || abs(q.y) > 12.) return vec2(99.);
  S(0.,-9.,5.,7.) S(5.,7.,-9.,-3.) S(-9.,-3.,9.,-3.) S(9.,-3.,-5.,7.) S(-5.,7.,0.,-9.)
  N(0.,-9.) N(5.,7.) N(-9.,-3.) N(9.,-3.) N(-5.,7.)
  return vec2(d, n);
}
void constel(inout vec3 col, vec2 dn, float ph){
  if (dn.x > 50.) return;
  float pulse = .62 + .38 * sin(uTime * 1.2 + ph);
  float a = max(step(dn.x, .6) * .6 * pulse, step(dn.x, 1.7) * .16 * pulse);
  a = max(a, step(dn.y, 2.3) * .45 * pulse);
  col = mix(col, vec3(1., .86, .38), a * uNight);
  if (dn.y < 1.1) col = mix(col, vec3(1., .96, .74), uNight);
}

void orbs(inout vec3 col, vec2 p, vec2 size){
  if (uMoon.z > 0.) {
    vec2 mp = floor(uMoon.xy * size);
    float d = length(p - mp);
    float halo = 1. - smoothstep(7., 24., d);
    col = mix(col, vec3(.74, .8, 1.), step(bayer(p), halo * halo * .8) * .3 * uMoon.z);
    if (d < 7.) col = mix(col, length(p - mp - vec2(3., -2.)) < 6. ? vec3(.93, .86, .6) : vec3(1., .97, .8), uMoon.z);
  }
  if (uSun.z > 0.) {
    float d = length(p - floor(uSun.xy * size));
    float halo = 1. - smoothstep(9., 34., d);
    col = mix(col, uSunCol, step(bayer(p), halo * halo) * .5 * uSun.z);
    if (d < 9.) col = mix(col, uSunCol, uSun.z);
    if (d < 7.) col = mix(col, vec3(1., .99, .93), uSun.z * .85);
  }
}

float bump(float x, float s){ return vnoise(vec2(x * .022, s)) * .6 + vnoise(vec2(x * .07, s + 7.)) * .28 + vnoise(vec2(x * .19, s + 3.)) * .12; }
// 밑은 거의 평평하고 위가 몽글몽글한 구름 띠.
void cloudBand(inout vec3 col, vec2 p, float base, float H, float speed, float seed, float cut, float fade){
  float x = floor(p.x + uTime * speed);
  float k = max(0., bump(x, seed) - cut) / (1. - cut);
  if (k <= 0.) return;
  float h = floor(sqrt(k) * H + abs(sin(x * .23 + seed)) * min(3., H * .2));
  float low = floor(max(0., bump(x + 40., seed + 11.) - cut) * H * .3);
  float d = base - p.y;
  if (h > 1. && d > -low && d <= h) {
    vec3 c = d > h - 2. - floor(h * .14) ? uCloudA : (d < h * .28 ? uCloudB : mix(uCloudA, uCloudB, .42));
    col = mix(c, col, fade);
  }
}

// 뜬 섬과 작은 성. q = 섬 윗면 가운데 기준.
void island(inout vec3 col, vec2 q, float fade, float seed){
  if (abs(q.x) > 30. || q.y < -32. || q.y > 44.) return;
  float ax = abs(q.x);
  vec3 c = vec3(-1.);
  float self = 0.;
  float depth = floor(27. * (1. - ax / 26.) + hash(vec2(floor(q.x / 3.), seed)) * 5.);
  if (q.y >= 0. && q.y < depth && ax < 26.) {
    c = q.x > 2. + hash(vec2(floor(q.y / 3.), seed)) * 7. ? vec3(.55, .47, .66) : vec3(.7, .62, .78);
    if (mod(q.y, 6.) < 1.) c *= .9;
  }
  if (q.y >= -3. && q.y < 2. && ax < (q.y < -2. ? 25. : 27.)) c = q.y < -1. ? vec3(.62, .86, .5) : vec3(.42, .7, .42);
  if (length(q - vec2(-18., -5.)) < 3.2 || length(q - vec2(19., -5.)) < 3.2) c = vec3(.36, .64, .42);
  vec3 wall = vec3(1., .95, .9), roof = vec3(.96, .56, .72);
  if (box(q, -5., -14., 6., -3.) || box(q, -11., -20., -6., -3.) || box(q, 6., -17., 11., -3.) || box(q, -2., -21., 3., -14.)) c = q.x > 7. || (q.x > 2. && q.x < 6.) ? wall * .9 : wall;
  if (q.y >= -27. && q.y < -20. && abs(q.x + 8.5) < (q.y + 27.) * .5 + .6) c = roof;
  if (q.y >= -24. && q.y < -17. && abs(q.x - 8.5) < (q.y + 24.) * .5 + .6) c = roof;
  if (q.y >= -29. && q.y < -21. && abs(q.x - .5) < (q.y + 29.) * .45 + .6) c = roof;
  if (box(q, -9., -16., -8., -13.) || box(q, 8., -13., 9., -10.) || box(q, 0., -18., 1., -16.) || box(q, 0., -8., 2., -3.)) { c = mix(vec3(.36, .4, .62), vec3(1., .86, .45), uLamp); self = uLamp; }
  if (c.x >= 0.) col = mix(c * mix(uAmb, vec3(1.), self), col, fade);
  if (box(q, 13., 2., 15., 40.) && q.y > depth - 3.) col = mix(col, vec3(.86, .95, 1.), .5 * (1. - q.y / 40.) * (.6 + .4 * step(.5, fract(q.y * .2 - uTime * 1.5))));
}

// 핑크빈. q = 몸 가운데 기준.
void pinkbean(inout vec3 col, vec2 q, vec3 amb, float blink){
  if (abs(q.x) > 12. || abs(q.y) > 11.) return;
  float ax = abs(q.x);
  float body = q.x * q.x / 81. + q.y * q.y / 49.;
  float ear = length((vec2(ax, q.y) - vec2(7., -6.)) * vec2(1., .85));
  vec3 c = vec3(-1.), dark = vec3(.24, .15, .24);
  if (ear < 4.) c = vec3(.42, .27, .62);
  if (ear < 3.) c = vec3(.62, .44, .88);
  if (q.x * q.x / 100. + q.y * q.y / 64. < 1.) c = vec3(.8, .42, .58);
  if (body < 1.) {
    c = vec3(.99, .71, .81);
    if (q.x * q.x / 30. + (q.y - 5.) * (q.y - 5.) / 6. < 1.) c = vec3(1., .94, .96);
    if (ax == 6. && q.y == 1.) c = vec3(.97, .5, .66);
    if (ax == 4. && (q.y == -1. || (blink < .5 && q.y == -2.))) c = dark;
    if ((q.y == 1. && (ax == 2. || ax == 0.)) || (q.y == 2. && ax == 1.)) c = dark;
  }
  if (c.x >= 0.) col = c * amb;
}

vec3 sky(vec2 p, vec2 size){
  float t = p.y / size.y;
  float n = clamp(floor(size.y / 9.), 10., 36.);
  vec3 col = gradAt(floor(t * n + .5 + (bayer(p) - .5) * .22) / n);
  if (uNight > .01) {
    col = mix(col, vec3(1., .97, .9), stars(p, t) * uNight);
    CONSTELLATIONS
  }
  orbs(col, p, size);
  cloudBand(col, p, floor(size.y * .4), max(8., size.y * .07), 1.1, 3., .5, .5);
  SKY_MID
  cloudBand(col, p, floor(size.y * .66), max(10., size.y * .11), 2.4, 9., .46, .12);
  cloudBand(col, p, size.y + 2., max(14., size.y * .2), .7, 21., .22, .3);
  return col;
}
`

const SKY_MAIN = `
void main(){
  vec2 p = vec2(floor(gl_FragCoord.x), floor(uRes.y - gl_FragCoord.y));
  gl_FragColor = vec4(sky(p, uRes), 1.);
}
`

// 앱 배경은 대부분 화면에 가려지고 위쪽 띠와 양옆만 보인다 → 볼거리를 그 자리에 둔다.
const SKY_PARTS = {
  CONSTELLATIONS: `
    constel(col, cDipper(p - floor(vec2(size.x * .5, 13.))), 0.);
    constel(col, cStar(p - floor(vec2(size.x * .34, 13.))), 2.);
    constel(col, cStar(p - floor(vec2(size.x * .66, 14.))), 4.);
    constel(col, cPinkbean(p - floor(vec2(size.x * .035, size.y * .3))), 1.);
    constel(col, cPinkbean(p - floor(vec2(size.x * .965, size.y * .55))), 3.);
    constel(col, cDipper(p - floor(vec2(size.x * .96, size.y * .2))), 5.);
    constel(col, cStar(p - floor(vec2(size.x * .04, size.y * .7))), 6.);`,
  SKY_MID: `
    cloudBand(col, p, 24., 15., 2., 33., .5, .08);
    island(col, p - vec2(floor(size.x * .04), floor(size.y * .52 + sin(uTime * .4) * 1.5)), .2, 1.);
    island(col, p - vec2(floor(size.x * .962), floor(size.y * .36 + sin(uTime * .33 + 2.) * 1.5)), .2, 5.);
    pinkbean(col, p - vec2(floor(mod(uTime * 4., size.x + 60.) - 30.), 12. + floor(sin(uTime * .7) * 1.5)), mix(uAmb, vec3(1.), .4), step(.96, fract(uTime * .23)));`,
}

const ROOM_PARTS = {
  CONSTELLATIONS: `
    constel(col, cPinkbean(p - vec2(31., 42.)), 1.);
    constel(col, cDipper(p - vec2(149., 78.)), 0.);
    constel(col, cStar(p - vec2(160., 36.)), 3.);`,
  SKY_MID: `
    island(col, p - vec2(152., 70. + floor(sin(uTime * .4) * 1.5)), .28, 1.);
    pinkbean(col, p - vec2(floor(mod(uTime * 2.2, size.x + 60.) - 30.), 86. + floor(sin(uTime * .7) * 1.5)), mix(uAmb, vec3(1.), .4), step(.96, fract(uTime * .23)));`,
}

// 피팅룸. w = 발이 닿는 자리(0,0) 기준 좌표(아래가 +). 벽과 바닥이 만나는 선은 발보다 12칸 위다(살짝 안쪽에 선 느낌).
const ROOM_MAIN = `
uniform vec2 uOrigin;
uniform float uShadow;
const float SEAM = -12.;
const float RAIL = -40.;
const float WX = 59.;      // 창 가운데(좌우 대칭)
const vec2 SKY_SIZE = vec2(180., 124.);

void main(){
  vec2 b = vec2(floor(gl_FragCoord.x), floor(uRes.y - gl_FragCoord.y));
  vec2 w = b - uOrigin;
  float ax = abs(w.x);
  vec3 col;
  float self = 0.;           // 스스로 빛나는 정도(창밖 하늘 · 켜진 등) — 실내 빛을 곱하지 않는다

  if (w.y < SEAM) {
    // 벽지: 세로 줄무늬 + 작은 반짝이 무늬
    col = mod(w.x + 4., 16.) < 8. ? vec3(1., .905, .93) : vec3(1., .953, .925);
    vec2 m = mod(w + vec2(8., floor((w.x + 8.) / 16.) * 12.), vec2(16., 24.)) - vec2(8., 12.);
    if (abs(m.x) + abs(m.y) < 1.5) col = vec3(.98, .78, .86);
    // 차양(줄무늬 + 물결 밑단)
    float sx = mod(w.x + 5., 10.) - 5.;
    float edge = -172. + floor(sqrt(max(0., 25. - sx * sx)));
    if (w.y < edge + 4. && w.y >= edge) col *= .92;
    if (w.y < edge) col = mod(floor((w.x + 5.) / 10.), 2.) < 1. ? vec3(.97, .58, .73) : vec3(1., .96, .97);
    if (w.y < edge && w.y >= edge - 1.) col = vec3(.9, .46, .63);
    if (w.y < -198.) col = vec3(.95, .7, .8);
    if (w.y < -198. && w.y >= -202.) col = vec3(.78, .56, .47);
    // 허리 몰딩 아래 패널
    if (w.y >= RAIL) {
      col = mod(w.x + 6., 12.) < 1. ? vec3(.93, .68, .78) : vec3(.97, .78, .85);
      if (w.y < RAIL + 3.) col = vec3(1., .96, .97);
      if (w.y >= RAIL + 3. && w.y < RAIL + 4.) col = vec3(.9, .64, .75);
      if (w.y >= SEAM - 5.) col = vec3(1., .96, .97);
      if (w.y >= SEAM - 6. && w.y < SEAM - 5.) col = vec3(.9, .64, .75);
    }
    // 아치 창
    float wx = abs(ax - WX);
    float arch = length(vec2(wx, w.y + 125.));
    bool inFrame = w.y < RAIL && ((w.y >= -125. && wx < 29.) || (w.y < -125. && arch < 29.));
    bool inGlass = w.y < RAIL - 1. && ((w.y >= -125. && wx < 25.) || (w.y < -125. && arch < 25.));
    if (w.y < RAIL && ((w.y >= -125. && wx < 30.) || (w.y < -125. && arch < 30.))) col = vec3(.89, .72, .66);
    if (inFrame) col = vec3(1., .97, .94);
    if (inGlass) {
      if (wx < 1. || abs(w.y + 125.) < 1. || abs(w.y + 83.) < 1.) col = vec3(1., .97, .94);
      else {
        col = sky(w + vec2(90., 150.), SKY_SIZE);
        if (mod(w.x + w.y + 400., 70.) < 6.) col = mix(col, vec3(1.), .1);
        self = 1.;
      }
    }
    if (w.y >= RAIL - 1. && w.y < RAIL + 3. && wx < 32.) col = w.y < RAIL + 2. ? vec3(1., .97, .94) : vec3(.89, .72, .66);
    // 가운데 벽: 커마샵 간판(핑크빈 얼굴)
    float pl = length(w - vec2(0., -128.));
    if (pl < 17.) col = vec3(.9, .46, .63);
    if (pl < 16.) col = vec3(.98, .68, .8);
    if (pl < 13.) col = vec3(1., .95, .93);
    if (pl < 13.) pinkbean(col, w - vec2(0., -127.), vec3(1.), step(.97, fract(uTime * .19)));
    // 벽등
    vec2 lq = vec2(ax - 21., w.y + 104.);
    if (box(lq, -1., 3., 1., 9.) || box(lq, -3., 8., 3., 10.)) col = vec3(.86, .66, .36);
    if (box(lq, -3., -4., 3., 3.) || box(lq, -2., -5., 2., -4.)) { col = mix(vec3(1., .95, .88), vec3(1., .9, .55), uLamp); self = uLamp; }
  } else {
    // 마루
    float fy = w.y - SEAM;
    float row = floor(fy / 10.);
    float px = w.x + row * 37.;
    col = vec3(.965, .86, .75) * (1. - hash(vec2(row, floor(px / 58.))) * .05);
    if (mod(fy, 10.) < 1. || mod(px, 58.) < 1.) col = vec3(.89, .75, .62);
    if (fy < 3.) col *= .93;
    // 창으로 들어온 빛
    float sk = (ax - WX) + fy * .18;
    if (fy > 5. && fy < 32. && abs(sk) < 24. && abs(sk) > 1. && abs(fy - 18.) > 1.) col += uLight;
    // 핑크빈 러그
    float e = w.x * w.x / 2116. + (w.y - 2.) * (w.y - 2.) / 121.;
    if (w.y < -3. && abs(ax - 31.) < (w.y + 11.) * 1.1 + .5) col = abs(ax - 31.) < (w.y + 10.) * 1.1 - .5 ? vec3(.74, .58, .9) : vec3(.56, .4, .76);
    if (e < 1.) {
      col = e > .9 ? vec3(.93, .56, .7) : (e > .62 && e < .74 ? vec3(1., .95, .96) : vec3(.98, .72, .81));
      if ((ax - 13.) * (ax - 13.) / 9. + (w.y - 1.) * (w.y - 1.) / 2.6 < 1.) col = vec3(.5, .3, .42);
      if ((w.y == 5. && (ax == 2. || ax == 0.)) || (w.y == 6. && ax == 1.)) col = vec3(.5, .3, .42);
    }
    // 발밑 그림자
    if (w.x * w.x / (uShadow * uShadow) + w.y * w.y / 9. < 1.) col = mix(col, vec3(.4, .26, .42), .26);
  }

  // 옷걸이(왼쪽)
  vec3 gold = vec3(.88, .68, .38), goldD = vec3(.7, .5, .27);
  if (box(w, -88., -6., -50., -4.) || box(w, -87., -45., -85., -6.) || box(w, -53., -45., -51., -6.) || box(w, -90., -47., -48., -45.)) col = (w.x == -86. || w.x == -52. || w.y == -46. || w.y == -5.) ? goldD : gold;
  for (int i = 0; i < 3; i++) {
    float gx = -79. + float(i) * 10.;
    float dx = abs(w.x - gx);
    if (dx < 1. && w.y >= -45. && w.y < -42.) col = goldD;
    float hw = w.y < -40. ? 2. + (w.y + 42.) * 1.5 : 4. + (w.y + 40.) * (i == 1 ? .04 : .11);
    float bot = i == 0 ? -17. : (i == 1 ? -20. : -14.);
    if (w.y >= -42. && w.y < bot && dx <= floor(hw)) {
      vec3 g = i == 0 ? vec3(.27, .32, .52) : (i == 1 ? vec3(.97, .98, 1.) : vec3(.98, .62, .75));
      if (dx >= floor(hw)) g *= .82;
      if (i == 0 && dx < 1. && mod(w.y, 5.) < 1.) g = vec3(.95, .8, .42);
      if (i == 1 && w.y >= -38. && w.y < -35. && dx < 2.) g = vec3(.32, .46, .8);
      if (i == 2 && w.y >= bot - 2.) g = vec3(1., .95, .97);
      col = g;
    }
  }
  // 전신 거울(오른쪽)
  vec2 mq = w - vec2(72., -28.);
  float me = mq.x * mq.x / 81. + mq.y * mq.y / 361.;
  if (box(w, 71., -10., 73., -5.) || box(w, 65., -6., 79., -4.)) col = w.y == -5. ? goldD : gold;
  if (mq.x * mq.x / 144. + mq.y * mq.y / 484. < 1.) col = goldD;
  if (mq.x * mq.x / 121. + mq.y * mq.y / 441. < 1.) col = gold;
  if (me < 1.) { col = mod(mq.x + mq.y + 40., 13.) < 3. ? vec3(1.) : vec3(.84, .94, 1.); if (me > .78) col = vec3(.74, .87, .97); }
  // 창턱에 앉은 핑크빈
  pinkbean(col, w - vec2(46., RAIL - 7.), vec3(1.), step(.96, fract(uTime * .21 + .4)));

  // 실내 빛: 시각에 따른 빛 + 벽등 불빛(밤에도 캐릭터 둘레는 밝다)
  float ld = min(length(w - vec2(21., -104.)), length(w - vec2(-21., -104.)));
  float lf = (1. - smoothstep(8., 170., ld)) * uLamp;
  lf = floor(lf * 8. + .5 + (bayer(b) - .5) * .3) / 8.;
  vec3 amb = mix(uAmb, vec3(1.04, .95, .84), lf * .8);
  col *= mix(amb, vec3(1.), self);
  if (ld < 13. && self < .5) col = mix(col, vec3(1., .88, .55), step(bayer(b), (1. - ld / 13.) * .7) * .4 * uLamp);
  // 떠다니는 반짝이
  vec2 sc = floor(b / 29.);
  float sh = hash(sc + 5.);
  vec2 sp = sc * 29. + floor(vec2(hash(sc) * 26. + sin(uTime * .3 + sh * 6.) * 2., mod(hash(sc + 2.) * 29. - uTime * (1. + sh * 2.), 29.)));
  if (sh > .55 && w.y < SEAM && b == sp) col = mix(col, vec3(1., .96, .98), .45 + .35 * sin(uTime * 2. + sh * 20.));

  gl_FragColor = vec4(col, 1.);
}
`

const fill = (src: string, parts: Record<string, string>) => Object.entries(parts).reduce((s, [k, v]) => s.replace(k, v), src)

export const fragSource = (kind: 'sky' | 'room') =>
  kind === 'sky' ? fill(COMMON, SKY_PARTS) + SKY_MAIN : fill(COMMON, ROOM_PARTS) + ROOM_MAIN
