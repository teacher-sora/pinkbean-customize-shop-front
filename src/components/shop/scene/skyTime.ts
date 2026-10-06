// 실제 시각 → 장면 색. 정오 · 석양 · 자정 · 여명 네 장면 사이를 시각에 따라 천천히 섞는다.
// 장면(sceneGl)과 캔버스가 뜨기 전 바탕색(SceneCanvas)이 같은 값을 쓴다.

type RGB = [number, number, number]
const hex = (s: string): RGB => [parseInt(s.slice(1, 3), 16) / 255, parseInt(s.slice(3, 5), 16) / 255, parseInt(s.slice(5, 7), 16) / 255]

interface Key {
  sky: RGB[]     // 하늘 4단(천정 → 지평선)
  cloudA: RGB    // 구름 밝은 면
  cloudB: RGB    // 구름 그늘
  amb: RGB       // 실내·사물에 곱하는 빛
  light: RGB     // 창으로 들어와 바닥에 떨어지는 빛(더하기)
  sun: RGB
  night: number  // 별·별자리
  lamp: number   // 실내 등
}

const KEYS: Record<'noon' | 'sunset' | 'night' | 'dawn', Key> = {
  noon: {
    sky: [hex('#4fa9f2'), hex('#7cc4f8'), hex('#aedcfc'), hex('#dff3ff')],
    cloudA: hex('#ffffff'), cloudB: hex('#cfe3f6'), amb: [1, 1, 1], light: [0.1, 0.095, 0.075], sun: hex('#fff2b0'), night: 0, lamp: 0,
  },
  sunset: {
    sky: [hex('#3d4692'), hex('#b0508f'), hex('#f2705c'), hex('#ffc66a')],
    cloudA: hex('#ffb489'), cloudB: hex('#c2557c'), amb: [1, 0.86, 0.8], light: [0.2, 0.09, 0.03], sun: hex('#ffd36a'), night: 0.08, lamp: 0.55,
  },
  night: {
    sky: [hex('#0a0f31'), hex('#141b4d'), hex('#232c6b'), hex('#3a3f86')],
    cloudA: hex('#3f4a8c'), cloudB: hex('#232a5e'), amb: [0.6, 0.61, 0.86], light: [0.03, 0.05, 0.11], sun: hex('#ffd36a'), night: 1, lamp: 1,
  },
  dawn: {
    sky: [hex('#343b9c'), hex('#8a68d4'), hex('#f08fb4'), hex('#ffc8a2')],
    cloudA: hex('#f6c0e6'), cloudB: hex('#8f7bcb'), amb: [0.9, 0.84, 0.98], light: [0.1, 0.05, 0.1], sun: hex('#ffd9c0'), night: 0.3, lamp: 0.35,
  },
}

const mix = (a: number, b: number, t: number) => a + (b - a) * t
const mix3 = (a: RGB, b: RGB, t: number): RGB => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)]
const ease = (t: number) => { const x = Math.min(1, Math.max(0, t)); return x * x * (3 - 2 * x) }

function blend(a: Key, b: Key, t: number): Key {
  return {
    sky: a.sky.map((c, i) => mix3(c, b.sky[i], t)),
    cloudA: mix3(a.cloudA, b.cloudA, t), cloudB: mix3(a.cloudB, b.cloudB, t), amb: mix3(a.amb, b.amb, t),
    light: mix3(a.light, b.light, t), sun: mix3(a.sun, b.sun, t), night: mix(a.night, b.night, t), lamp: mix(a.lamp, b.lamp, t),
  }
}

// 여명 05:45 · 낮 08:30~15:30 · 석양 17:45~18:45 · 밤 21:00~04:00. 그 사이는 부드럽게 넘어간다.
// 석양은 한 시간쯤 머문다 — 한 점에서만 석양이면 넘어가는 중간색만 보이다 끝나 너무 짧게 느껴진다(사용자 지적).
function keyAt(h: number): Key {
  const K = KEYS
  if (h < 4) return K.night
  if (h < 5.75) return blend(K.night, K.dawn, ease((h - 4) / 1.75))
  if (h < 8.5) return blend(K.dawn, K.noon, ease((h - 5.75) / 2.75))
  if (h < 15.5) return K.noon
  if (h < 17.75) return blend(K.noon, K.sunset, ease((h - 15.5) / 2.25))
  if (h < 18.75) return K.sunset
  if (h < 21) return blend(K.sunset, K.night, ease((h - 18.75) / 2.25))
  return K.night
}

export interface SkyState extends Key {
  sunPhase: number   // 0(뜸) → 1(짐). 범위 밖이면 지평선 아래
  moonPhase: number
}

const RISE = 5.5, SET = 19 // 해가 떠 있는 시간(달은 그 반대)

export function skyState(h: number): SkyState {
  const night = SET - RISE
  const mh = h >= SET ? h - SET : h + 24 - SET
  return { ...keyAt(h), sunPhase: (h - RISE) / night, moonPhase: mh / (24 - night) }
}

// 지금 시각(0~24). 주소에 ?sky=18.5 처럼 주면 그 시각으로 고정하고, ?sky=fast 면 하루를 48초에 돌린다(확인용).
let fixed: number | 'fast' | null | undefined
export function skyHour(): number {
  if (fixed === undefined) {
    fixed = null
    try {
      const v = new URLSearchParams(window.location.search).get('sky')
      if (v === 'fast') fixed = 'fast'
      else if (v != null && v !== '' && isFinite(+v)) fixed = ((+v % 24) + 24) % 24
    } catch { /* 주소를 못 읽으면 실제 시각 */ }
  }
  if (fixed === 'fast') return (performance.now() / 2000) % 24
  if (typeof fixed === 'number') return fixed
  const d = new Date()
  return d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600
}

const css = (c: RGB) => `rgb(${c.map((v) => Math.round(Math.min(1, Math.max(0, v)) * 255)).join(',')})`
const mul = (a: RGB, b: RGB): RGB => [a[0] * b[0], a[1] * b[1], a[2] * b[2]]

// 캔버스가 뜨기 전(또는 WebGL 을 못 쓰는 기기)에 깔리는 바탕. 장면과 같은 시각의 색을 어둡게 눌러 둔다 —
// 장면은 이 어두운 바탕에서 밝아지며 나타난다.
export function sceneFallback(kind: 'sky' | 'room'): string {
  const s = skyState(skyHour())
  if (kind === 'sky') return `linear-gradient(180deg, ${s.sky.map((c) => css(mul(c, [0.5, 0.48, 0.56]))).join(', ')})`
  return css(mul(hex('#3a302c'), s.amb))
}
