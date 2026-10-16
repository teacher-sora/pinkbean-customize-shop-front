// 염색의 픽셀 연산(lib/core/dye.ts 의 applyHsb · blendPalette 안쪽 루프)을 그대로 옮긴 것.
// JS 쪽 루프가 정본이고 이것은 같은 결과를 더 빨리 내는 사본이다 — 한쪽을 고치면 다른 쪽도 고치고 `node wasm/check.cjs` 로 맞춘다.
// 빌드: sh scripts/build-wasm.sh (emsdk 필요) → src/lib/core/dyeWasmBin.ts
#include <math.h>
#include <stdint.h>
#include <emscripten.h>

// 색조 · 채도 · 명도: seotbeo/WzComparerR2 Prism.cs v2(2026-07). 원본처럼 float(32비트)으로 계산한다 — JS 는 Math.fround 로 같은 자리에서 자른다.
static inline float clampF(float v, float lo, float hi) { return v < lo ? lo : v > hi ? hi : v; }
static inline int checkColorType(int type, float hue, float sat) {
  int h = (int)floorf(hue);
  switch (type) {
    case 1: return !((h >= 30 && h <= 330) || sat == 0);
    case 2: return !(h < 30 || h > 90);
    case 3: return !(h < 90 || h > 150);
    case 4: return !(h < 150 || h > 210);
    case 5: return !(h < 210 || h > 270);
    case 6: return !(h < 270 || h > 330);
    default: return 1;
  }
}
static inline float applyStep(float v, float step) {
  float q = v / step;
  float o = (q - floorf(q) >= 0.985f ? ceilf(q) : floorf(q)) * step;
  return o < 0 ? 0 : o > 255 ? 255 : o;   // JS 의 Uint8ClampedArray 대입과 같게
}

// fine = 1 단위(풀컬러 그림 · 이펙트), 0 = 17 단위(16단계 그림). 그림 전체에서 한 번 정한 값을 받는다(dye.ts).
EMSCRIPTEN_KEEPALIVE
void hsb(uint8_t *a, int len, int hue, int saturation, int brightness, int type, int edge, int fine) {
  float st = fine ? 1.0f : 17.0f;
  float sk = (float)(saturation - 100) / 100.0f, bk = (float)(brightness - 100) / 100.0f;
  for (int i = 0; i < len; i += 4) {
    int R = a[i], G = a[i + 1], B = a[i + 2];
    if (a[i + 3] == 0 || (R == 255 && G == 255 && B == 255) || (!edge && R == 0 && G == 0 && B == 0)) continue;
    float r = (float)R / 255.0f, g = (float)G / 255.0f, b = (float)B / 255.0f;
    float mx = r > g ? r : g; mx = mx > b ? mx : b;
    float mn = r < g ? r : g; mn = mn < b ? mn : b;
    float d = mx - mn, v0 = mx, s0 = v0 > 0 ? d / v0 : 0.0f, h = 0.0f;
    if (!(R == G && G == B)) {
      if (r == mx) h = (g - b) / d; else if (g == mx) h = 2.0f + (b - r) / d; else h = 4.0f + (r - g) / d;
      h = h * 60.0f; if (h < 0.0f) h = h + 360.0f;
    }
    if (!(edge && s0 == 0) && !checkColorType(type, h, s0)) continue;
    h = fmodf(h + (float)hue, 360.0f);
    float ds = 0, dv = 0;
    if (saturation < 100) { ds = sk * s0; dv = sk * s0 * v0 / 2.0f; }
    else if (s0 > 0 && v0 < 1) { ds = sk * (2.0f - s0) * (1.0f - v0); dv = sk * (1.0f - s0) * v0; }
    float ts = clampF(s0 + ds, 0, 1), tv = clampF(v0 + dv, 0, 1);
    float ds2 = 0, dv2 = 0;
    if (brightness < 100) dv2 = bk * s0 * tv;
    else { ds2 = bk * -ts; dv2 = bk * (15.0f - 12.0f * s0) / 15.0f * (1.0f - tv); }
    float S = clampF(ts + ds2, 0, 1), V = clampF(tv + dv2, 0, 1);
    float c = V * S, x = c * (1.0f - fabsf(fmodf(h / 60.0f, 2.0f) - 1.0f)), m = V - c;
    float rr = 0, gg = 0, bb = 0;
    switch ((int)floorf(h) / 60) {
      case 0: rr = c; gg = x; break;
      case 1: rr = x; gg = c; break;
      case 2: gg = c; bb = x; break;
      case 3: gg = x; bb = c; break;
      case 4: bb = c; rr = x; break;
      case 5: bb = x; rr = c; break;
    }
    a[i] = (uint8_t)applyStep((rr + m) * 255.0f, st);
    a[i + 1] = (uint8_t)applyStep((gg + m) * 255.0f, st);
    a[i + 2] = (uint8_t)applyStep((bb + m) * 255.0f, st);
  }
}

static inline uint8_t clamp8(double v) { if (!(v > 0)) return 0; if (v > 255) return 255; return (uint8_t)lrint(v); }

// 믹스 염색: A 를 B 쪽으로 t 만큼 섞는다(알파가 0 인 칸은 그대로). JS 의 Uint8ClampedArray 대입과 같은 반올림.
EMSCRIPTEN_KEEPALIVE
// ratio 는 0..100 정수. q4 = 16단계 그림(dye.ts is16Step) — 4비트 값으로 섞고 내림해 17 단위에 머문다.
void blend(uint8_t *a, const uint8_t *b, int len, int r, int q4) {
  double t = r / 100.0;
  for (int i = 0; i < len; i += 4) {
    if (a[i + 3] == 0) continue;
    if (q4) {
      for (int k = 0; k < 3; k++) a[i + k] = (uint8_t)(17 * (((a[i + k] / 17) * (100 - r) + (b[i + k] / 17) * r) / 100));
    } else {
      a[i] = clamp8(a[i] * (1 - t) + b[i] * t);
      a[i + 1] = clamp8(a[i + 1] * (1 - t) + b[i + 1] * t);
      a[i + 2] = clamp8(a[i + 2] * (1 - t) + b[i + 2] * t);
    }
  }
}

// 픽셀을 주고받는 자리(두 장). 이보다 큰 그림은 JS 가 맡는다.
#define CAP (4 * 1024 * 1024)
static uint8_t bufA[CAP], bufB[CAP];
EMSCRIPTEN_KEEPALIVE uint8_t *slotA(void) { return bufA; }
EMSCRIPTEN_KEEPALIVE uint8_t *slotB(void) { return bufB; }
EMSCRIPTEN_KEEPALIVE int cap(void) { return CAP; }
