// 염색의 픽셀 연산(lib/core/dye.ts 의 applyHsb · blendPalette 안쪽 루프)을 그대로 옮긴 것.
// JS 쪽 루프가 정본이고 이것은 같은 결과를 더 빨리 내는 사본이다 — 한쪽을 고치면 다른 쪽도 고치고 `node wasm/check.cjs` 로 맞춘다.
// 빌드: sh scripts/build-wasm.sh (emsdk 필요) → src/lib/core/dyeWasmBin.ts
#include <math.h>
#include <stdint.h>
#include <emscripten.h>

typedef struct { double r, g, b, gap, min, max; int gray; } Rgb;
typedef struct { double h, s, v; } Hsv;

static inline double max3(double a, double b, double c) { double m = a > b ? a : b; return m > c ? m : c; }
static inline double min3(double a, double b, double c) { double m = a < b ? a : b; return m < c ? m : c; }

static inline void setHsvFromRgb(Rgb *rgb, Hsv *hsv) {
  double r = rgb->r / 255, g = rgb->g / 255, b = rgb->b / 255;
  double mx = max3(r, g, b), mn = min3(r, g, b), d = mx - mn;
  rgb->gap = d * 255; rgb->max = mx * 255; rgb->min = mn * 255; rgb->gray = mx == mn;
  hsv->v = (mx + mn) / 2;
  hsv->s = hsv->v > 0 && hsv->v < 1 ? d / (1 - fabs(2 * hsv->v - 1)) : 0;
  if (rgb->r == rgb->g && rgb->g == rgb->b) hsv->h = 0;
  else {
    if (r == mx) hsv->h = (g - b) / d;
    else if (g == mx) hsv->h = 2 + (b - r) / d;
    else hsv->h = 4 + (r - g) / d;
    hsv->h *= 60; if (hsv->h < 0) hsv->h += 360;
  }
}
static inline double customRound(double v, double t) { return v - floor(v) >= t ? ceil(v) : floor(v); }
static inline double applyStep(double v, double step) { return customRound(v / step, 0.985) * step; }
static inline void setRgbFromHsv(Rgb *rgb, Hsv *hsv, int step, int doRounding) {
  double r = 0, g = 0, b = 0;
  double c = (1 - fabs(2 * hsv->v - 1)) * hsv->s;
  double x = c * (1 - fabs(fmod(hsv->h / 60, 2) - 1));
  double m = hsv->v - c / 2;
  switch ((int)floor(hsv->h / 60)) {
    case 0: r = c; g = x; break;
    case 1: r = x; g = c; break;
    case 2: g = c; b = x; break;
    case 3: g = x; b = c; break;
    case 4: b = c; r = x; break;
    case 5: b = x; r = c; break;
  }
  if (doRounding) {
    rgb->r = applyStep((r + m) * 255, step ? 1 : 17);
    rgb->g = applyStep((g + m) * 255, step ? 1 : 17);
    rgb->b = applyStep((b + m) * 255, step ? 1 : 17);
  } else { rgb->r = (r + m) * 255; rgb->g = (g + m) * 255; rgb->b = (b + m) * 255; }
}
static inline void calcBrightness(Rgb *rgb, double brightness, double add[3]) {
  double color[3] = { rgb->r, rgb->g, rgb->b };
  double mx = max3(color[0], color[1], color[2]), mn = min3(color[0], color[1], color[2]);
  add[0] = add[1] = add[2] = 0;
  if (brightness < 100) {
    if (rgb->gray) return;
    double adjustedGap = (rgb->gap / rgb->max) * mx;
    for (int i = 0; i < 3; i++) {
      double c = color[i];
      if (c <= 0) { add[i] = -255; continue; }
      add[i] = mn == 0 ? (c * (brightness - 100)) / 100 : (adjustedGap * (brightness - 100)) / 100;
    }
  } else {
    for (int i = 0; i < 3; i++) {
      double c = color[i];
      if (mx == 255 || rgb->gray) add[i] = ((255 - c) * (brightness - 100)) / 100;
      else {
        double amount = ((255 - mx) * (15 - (12 * rgb->gap) / (rgb->min + rgb->gap))) / 15 + mx;
        add[i] = ((amount - c) * (brightness - 100)) / 100;
      }
    }
  }
}
static inline int checkColorType(int type, Hsv *hsv) {
  int hue = (int)floor(hsv->h);
  switch (type) {
    case 1: return !((hue >= 30 && hue <= 330) || hsv->s == 0);
    case 2: return !(hue < 30 || hue > 90);
    case 3: return !(hue < 90 || hue > 150);
    case 4: return !(hue < 150 || hue > 210);
    case 5: return !(hue < 210 || hue > 270);
    case 6: return !(hue < 270 || hue > 330);
    default: return 1;
  }
}
static inline double clampN(double v, double lo, double hi) { return v < lo ? lo : v > hi ? hi : v; }
// Uint8ClampedArray 에 쓰는 것과 같게: 반올림(짝수로) 후 0..255
static inline uint8_t clamp8(double v) { if (!(v > 0)) return 0; if (v > 255) return 255; return (uint8_t)lrint(v); }

EMSCRIPTEN_KEEPALIVE
void hsb(uint8_t *a, int len, int hue, int saturation, int brightness, int type, int edge) {
  for (int i = 0; i < len; i += 4) {
    int alpha = a[i + 3];
    Rgb rgb = { a[i], a[i + 1], a[i + 2], 0, 0, 0, 0 };
    Hsv hsv = { 0, 0, 0 };
    setHsvFromRgb(&rgb, &hsv);
    int black = a[i] == 0 && a[i + 1] == 0 && a[i + 2] == 0;
    int white = a[i] == 255 && a[i + 1] == 255 && a[i + 2] == 255;
    int convert = edge && black ? 1 : checkColorType(type, &hsv);
    if ((black && !edge) || white || alpha == 0) convert = 0;
    if (convert) {
      int not16 = a[i] % 17 != 0 || a[i + 1] % 17 != 0 || a[i + 2] % 17 != 0;
      if (hue > 0) { hsv.h = fmod(hsv.h + hue, 360); setRgbFromHsv(&rgb, &hsv, not16, 1); }
      int bu0 = not16 || rgb.r > 238, bu1 = not16 || rgb.g > 238, bu2 = not16 || rgb.b > 238;
      if (saturation != 100 && hsv.s != 0) {
        hsv.s = saturation > 100 ? clampN(hsv.s + (saturation - 100) / 100.0, 0, 1) : (hsv.s * saturation) / 100;
        setRgbFromHsv(&rgb, &hsv, 0, 0);
      }
      double add[3] = { 0, 0, 0 };
      if (brightness != 100) calcBrightness(&rgb, brightness, add);
      rgb.r = clampN(rgb.r + add[0], 0, bu0 ? 255 : 238);
      rgb.g = clampN(rgb.g + add[1], 0, bu1 ? 255 : 238);
      rgb.b = clampN(rgb.b + add[2], 0, bu2 ? 255 : 238);
      if (!not16) { rgb.r = applyStep(rgb.r, 17); rgb.g = applyStep(rgb.g, 17); rgb.b = applyStep(rgb.b, 17); }
    }
    a[i] = clamp8(rgb.r); a[i + 1] = clamp8(rgb.g); a[i + 2] = clamp8(rgb.b);
  }
}

// 믹스 염색: A 를 B 쪽으로 t 만큼 섞는다(알파가 0 인 칸은 그대로). JS 의 Uint8ClampedArray 대입과 같은 반올림.
EMSCRIPTEN_KEEPALIVE
void blend(uint8_t *a, const uint8_t *b, int len, double t) {
  for (int i = 0; i < len; i += 4) {
    if (a[i + 3] == 0) continue;
    a[i] = clamp8(a[i] * (1 - t) + b[i] * t);
    a[i + 1] = clamp8(a[i + 1] * (1 - t) + b[i + 1] * t);
    a[i + 2] = clamp8(a[i + 2] * (1 - t) + b[i + 2] * t);
  }
}

// 픽셀을 주고받는 자리(두 장). 이보다 큰 그림은 JS 가 맡는다.
#define CAP (4 * 1024 * 1024)
static uint8_t bufA[CAP], bufB[CAP];
EMSCRIPTEN_KEEPALIVE uint8_t *slotA(void) { return bufA; }
EMSCRIPTEN_KEEPALIVE uint8_t *slotB(void) { return bufB; }
EMSCRIPTEN_KEEPALIVE int cap(void) { return CAP; }
