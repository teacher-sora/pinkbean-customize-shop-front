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

// 그날의 해 뜨는 시각 · 지는 시각(시계 시각, 0~24). 계절에 따라 하늘이 바뀌는 때가 달라지게 한다 —
// 여름에는 밤이 늦게 오고 겨울에는 일찍 온다(사용자 지시). 위치는 묻지 않고 서울(북위 37.57° · 동경 126.98° · 표준시 +9)로 계산한다:
// 위치 권한을 물으면 첫 화면에 창이 뜨고, 쓰는 사람 대부분이 한국에 있다. 다른 나라에서도 기기 시계에 서울의 해 시각을 그대로 얹는다.
// 식은 NOAA 의 근사식(균시차 · 적위 → 시간각). 오차는 1~2분이다. 하루에 한 번만 계산한다.
const LAT = 37.57 * Math.PI / 180, LON = 126.98, TZ = 9
let sunDay = -1, sunTimes: [number, number] = [5.5, 19]
function sunToday(): [number, number] {
  const d = new Date(), day = Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - Date.UTC(d.getFullYear(), 0, 0)) / 864e5)
  if (day === sunDay) return sunTimes
  const g = (2 * Math.PI / 365) * (day - 1)
  const eq = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g))
  const dec = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g) + 0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g)
  const ha = Math.acos(Math.cos(90.833 * Math.PI / 180) / (Math.cos(LAT) * Math.cos(dec)) - Math.tan(LAT) * Math.tan(dec)) * 180 / Math.PI
  const at = (sign: number) => (720 - 4 * (LON + sign * ha) - eq) / 60 + TZ
  sunDay = day; sunTimes = [at(1), at(-1)]
  return sunTimes
}

// 해 뜨는 시각 R · 지는 시각 S 를 기준으로 한다(시간 단위):
//   밤 ~R-1.5 · 밤→여명 ~R(해 뜰 때가 온전한 여명) · 여명→낮 ~R+2.25 · 낮 ~S-2.5 · 낮→석양 ~S-0.5 · 석양 ~S+0.1 · 석양→밤 ~S+0.75 · 밤
// 석양은 30분 남짓 머문다 — 한 점에서만 석양이면 넘어가는 중간색만 보이다 끝나 너무 짧게 느껴진다(사용자 지적).
// 해가 지고 45분 뒤(시민 박명이 끝난 뒤)면 온전한 밤이다: 하지 무렵 20:40쯤, 동지 무렵 18:00쯤.
function keyAt(h: number, R: number, S: number): Key {
  const K = KEYS
  if (h < R - 1.5) return K.night
  if (h < R) return blend(K.night, K.dawn, ease((h - (R - 1.5)) / 1.5))
  if (h < R + 2.25) return blend(K.dawn, K.noon, ease((h - R) / 2.25))
  if (h < S - 2.5) return K.noon
  if (h < S - 0.5) return blend(K.noon, K.sunset, ease((h - (S - 2.5)) / 2))
  if (h < S + 0.1) return K.sunset
  if (h < S + 0.75) return blend(K.sunset, K.night, ease((h - (S + 0.1)) / 0.65))
  return K.night
}

export interface SkyState extends Key {
  sunPhase: number   // 0(뜸) → 1(짐). 범위 밖이면 지평선 아래
  moonPhase: number
  orb: number        // 해 · 달의 세기(평소 1). 시간대가 바뀌는 동안 꺼졌다가 새 자리에서 다시 켜진다
}

export function skyState(h: number): SkyState {
  const [R, S] = sunToday()
  // 해는 뜨기 조금 전부터 지고 조금 뒤까지 하늘에 걸려 있다(지평선 둘레의 빛). 달은 그 반대
  const rise = R - 0.25, set = S + 0.25, day = set - rise
  const mh = h >= set ? h - set : h + 24 - set
  return { ...keyAt(h, R, S), sunPhase: (h - rise) / day, moonPhase: mh / (24 - day), orb: 1 }
}

// 시간대를 손으로 고른다(PC 헤더의 버튼). 'auto' 는 실제 시각을 따른다. 고른 값은 이 브라우저에 남겨 둔다.
export type SkyMode = 'auto' | 'noon' | 'sunset' | 'night' | 'dawn'
export const SKY_MODES: { id: SkyMode; label: string }[] = [
  { id: 'auto', label: '자동' }, { id: 'noon', label: '정오' }, { id: 'sunset', label: '석양' }, { id: 'night', label: '자정' }, { id: 'dawn', label: '여명' },
]
const MODE_KEY = 'pb.sky'
const FADE_MS = 800    // 시간대를 바꾸면 이만큼에 걸쳐 지금 장면에서 새 장면으로 스며든다
let mode: SkyMode | undefined
let fade: { from: SkyState; at: number } | null = null
const watchers = new Set<() => void>()
export function onSkyChange(fn: () => void): () => void { watchers.add(fn); return () => { watchers.delete(fn) } }
export function getSkyMode(): SkyMode {
  if (mode === undefined) {
    mode = 'auto'
    try { const v = localStorage.getItem(MODE_KEY); if (SKY_MODES.some((m) => m.id === v)) mode = v as SkyMode } catch { /* 저장소를 못 쓰면 자동 */ }
  }
  return mode
}
export function setSkyMode(m: SkyMode) {
  const from = skyNow()
  mode = m
  let still = false
  try { localStorage.setItem(MODE_KEY, m) } catch { /* 못 남겨도 이번 화면에서는 바뀐다 */ }
  try { still = window.matchMedia('(prefers-reduced-motion: reduce)').matches } catch { /* 그대로 */ }
  fade = still ? null : { from, at: performance.now() }
  watchers.forEach((fn) => fn())
}

// 지금 시각(0~24). 헤더에서 고른 시간대가 먼저다. 주소에 ?sky=18.5 처럼 주면 그 시각으로 고정하고, ?sky=fast 면 하루를 48초에 돌린다(확인용).
let fixed: number | 'fast' | null | undefined
function targetHour(): number {
  const m = getSkyMode()
  if (m !== 'auto') {
    // 고른 시간대의 온전한 모습이 되는 시각(그날의 해 시각 기준)
    const [R, S] = sunToday()
    return m === 'noon' ? (R + S) / 2 : m === 'sunset' ? S - 0.2 : m === 'dawn' ? R : 0
  }
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
export const skyHour = targetHour
// 지금 그릴 장면. 시간대를 막 바꿨으면 앞 장면에서 색이 스며들듯 넘어간다 — 시곗바늘을 돌리면 그 사이의 시간대가 휙 지나가 어지럽다(사용자 지적).
// 해와 달은 자리를 옮기지 않고, 제자리에서 꺼졌다가 새 자리에서 켜진다.
export function skyNow(): SkyState {
  const to = skyState(targetHour())
  if (!fade) return to
  const t = (performance.now() - fade.at) / FADE_MS
  if (t >= 1) { fade = null; return to }
  const e = ease(t), from = fade.from, at = e < 0.5 ? from : to
  return { ...blend(from, to, e), sunPhase: at.sunPhase, moonPhase: at.moonPhase, orb: Math.abs(1 - 2 * e) * at.orb }
}

const css = (c: RGB) => `rgb(${c.map((v) => Math.round(Math.min(1, Math.max(0, v)) * 255)).join(',')})`
const mul = (a: RGB, b: RGB): RGB => [a[0] * b[0], a[1] * b[1], a[2] * b[2]]

// 장면(WebGL)이 뜨기 전에, 그리고 못 띄우는 기기에서는 끝까지 깔려 있는 바탕. 이 위에 움직이지 않는 그림(<img>)이 얹힌다(SceneCanvas).
// 장면과 같은 시각의 색을 **장면과 같은 밝기로** 낸다 — 어둡게 눌러 두었더니 네트워크가 느린 곳과 GPU 가 없는 기기에서
// 화면이 내내 검게 보였다(사용자 제보).
export function sceneFallback(kind: 'sky' | 'room'): string {
  const s = skyState(skyHour())
  if (kind === 'sky') {
    // 장면이 하는 것과 같게: 어두운 막 20% + 밤에는 전체를 18% 가라앉힌다(sceneGl 의 MASK · NIGHT_DIM)
    const dark: RGB = [0.09, 0.07, 0.16], k = 1 - 0.18 * s.night
    return `linear-gradient(180deg, ${s.sky.map((c) => css(mul(mix3(c, dark, 0.2), [k, k, k]))).join(', ')})`
  }
  return css(mul(hex('#17120f'), s.amb))
}
// 움직이지 않는 그림 위에 씌우는 막의 짙기. 그림은 낮의 색이라 밤에는 짙게 씌운다(장면이 뜨면 장면이 제 빛으로 그린다).
export function sceneVeil(kind: 'sky' | 'room'): number {
  const s = skyState(skyHour())
  return kind === 'sky' ? 0.2 + 0.45 * s.night : 0.3 * s.night
}
