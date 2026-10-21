// 파티클(제네시스 무기의 붉은 파장 · 떠오르는 점 등). 원본은 그림이 아니라 '입자를 뿌리는 규칙'이다 —
// 무기 그림의 동작 노드에 `particle/<n>/particleName` 이 있고, 규칙은 Effect `particle.img/<이름>` 에 있다(parser extract-particles).
// 움직임은 WzComparerR2 MapRender 의 ParticleSystem 을 그대로 옮겼다(코코스 파티클과 같은 꼴):
//  - 1초에 total / 평균 수명 개를 뿌리고, 한 번에 total 개까지만 산다(duration -1 = 끝없이).
//  - 입자마다 시작 · 끝 색 · 크기 · 회전을 (값 ± 폭)에서 뽑고 수명 동안 고르게 바꾼다. 알파는 중간점(MiddlePoint 0/1, %)을 지나며 바뀐다.
//  - 중력 모드: 방향(angle ± angleVar, 위가 90도) · 속력으로 날아가고 중력 · 지름 방향 가속을 받는다. 접선 가속은 게임에서도 쓰지 않는다(원본 주석).
//  - 그리기: 그림을 색으로 곱해(틴트) 알파를 곱하고, 크기는 '그림 대각선/√2 = size' 가 되게 키운다.
// 원본의 posX/posY(-200, 60)는 만드는 도구의 자리값이라 쓰지 않는다 — 무기 노드의 자리(발 + origin)에 붙인다(게임 화면으로 맞췄다).

export interface ParticleDesc {
  name: string
  total: number
  angle: number; angleVar: number
  duration: number
  startColor: number; startColorVar: number; endColor: number; endColorVar: number // ARGB
  mid: [number, number][] // [시간 0..1, 알파 0..255]
  startSize: number; startSizeVar: number; endSize: number; endSizeVar: number
  posVarX: number; posVarY: number
  startSpin: number; startSpinVar: number; endSpin: number; endSpinVar: number
  gravity?: { x: number; y: number; speed: number; speedVar: number; radialAccel: number; radialAccelVar: number; rotationIsDir: boolean }
  life: number; lifeVar: number
  opacityModifyRGB: boolean
  tex: { png: string; origin: { x: number; y: number }; w: number; h: number }
}
// 아이템에 붙은 파티클 하나 — 무기 노드의 이름 · z(음수 = 캐릭터 뒤) · 자리(발 기준 origin).
export interface ParticleSpot { name: string; z: number; origin: { x: number; y: number } }
// 그릴 것 하나 — 흐르는 입자(sim)와 붙는 자리(월드 좌표, navel = 0,0).
export interface ParticleDraw { sim: ParticleSim; ox: number; oy: number; z: number }
// 동작에 맞는 파티클 자리. 그 동작에 없으면 서기(자세가 있으면 같은 자세의 서기)를, 그것도 없으면 아무 동작의 것을 쓴다 —
// 게임에서는 공격 동작 중에도 파장이 이어진다.
export function spotsFor(acts: Record<string, ParticleSpot[]> | undefined, action: string): ParticleSpot[] {
  if (!acts) return []
  const keys = Object.keys(acts)
  const k = keys.find((x) => x === action || x.endsWith(`/${action}`)) ?? keys.find((x) => x.split('/').pop() === 'stand1') ?? keys[0]
  return k ? acts[k] : []
}
// 붙는 자리 = 발 + origin(원본 노드의 origin — 제네시스는 (0,-40), 발에서 40px 위의 가슴께. 게임 화면으로 맞췄다).
export function placeParticles(spots: ParticleSpot[], descs: Map<string, ParticleDesc>, foot: { x: number; y: number }, simOf: (d: ParticleDesc, i: number) => ParticleSim): ParticleDraw[] {
  const out: ParticleDraw[] = []
  spots.forEach((s, i) => { const d = descs.get(s.name); if (d) out.push({ sim: simOf(d, i), ox: foot.x + s.origin.x, oy: foot.y + s.origin.y, z: s.z }) })
  return out
}

type RGBA = [number, number, number, number] // 0..1
const argb = (v: number): RGBA => [((v >>> 16) & 255) / 255, ((v >>> 8) & 255) / 255, (v & 255) / 255, ((v >>> 24) & 255) / 255]

interface P {
  x: number; y: number; dx: number; dy: number
  c0: RGBA; c1: RGBA; s0: number; s1: number; r0: number; r1: number
  life: number; t: number; radial: number
}

// 같은 화면이 늘 같은 모양이 되도록(카드 · 스냅샷) 씨앗이 있는 난수.
function rng(seed: number) {
  let a = seed >>> 0
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
}

export class ParticleSim {
  readonly desc: ParticleDesc
  readonly ps: P[] = []
  private rand: () => number
  private rate: number
  private carry = 0
  constructor(desc: ParticleDesc, seed = 1) {
    this.desc = desc
    this.rand = rng(seed)
    if (desc.duration > 0) this.rate = desc.total / Math.min(desc.duration, 1)
    else {
      const lo = Math.max(0, desc.life - desc.lifeVar), hi = Math.max(0, desc.life + desc.lifeVar)
      this.rate = desc.total / ((lo + hi) / 2 || 1)
    }
  }
  private v(base: number, range: number, nonNeg = false) {
    if (!range) return base
    const x = base + (this.rand() * 2 - 1) * range
    return nonNeg && x < 0 ? 0 : x
  }
  private col(base: number, range: number): RGBA {
    const b = argb(base), r = argb(range)
    return b.map((c, i) => Math.min(1, Math.max(0, this.v(c, r[i])))) as RGBA
  }
  private emit() {
    const d = this.desc, g = d.gravity
    const speed = g ? this.v(g.speed, g.speedVar) : 0
    const ang = this.v(d.angle, d.angleVar)
    const rad = (ang * Math.PI) / 180
    let r0 = this.v(d.startSpin, d.startSpinVar), r1 = this.v(d.endSpin, d.endSpinVar)
    if (g?.rotationIsDir) { const dr = r1 - r0; r0 = ang; r1 = ang + dr }
    const life = this.v(d.life, d.lifeVar, true)
    if (life <= 0) return
    this.ps.push({
      x: this.v(0, d.posVarX), y: this.v(0, d.posVarY),
      dx: Math.cos(rad) * speed, dy: -Math.sin(rad) * speed,
      c0: this.col(d.startColor, d.startColorVar), c1: this.col(d.endColor, d.endColorVar),
      s0: this.v(d.startSize, d.startSizeVar, true), s1: this.v(d.endSize, d.endSizeVar, true),
      r0, r1, life, t: 0, radial: g ? this.v(g.radialAccel, g.radialAccelVar) : 0,
    })
  }
  // dt 초만큼 흐르게 한다. 긴 dt 는 잘게 나눠 계산한다(탭을 오래 비웠다 돌아온 경우).
  step(dt: number) {
    if (!(dt > 0)) return
    if (dt > 0.1) { for (let left = dt; left > 0; left -= 0.05) this.step(Math.min(0.05, left)); return }
    const d = this.desc, g = d.gravity
    if (this.ps.length < d.total) {
      this.carry += this.rate * dt
      const n = Math.min(Math.floor(this.carry), d.total - this.ps.length)
      this.carry -= Math.floor(this.carry)
      for (let i = 0; i < n; i++) this.emit()
    }
    const gx = g?.x ?? 0, gy = g?.y ?? 0
    for (const p of this.ps) {
      p.t += dt
      const len = Math.hypot(p.x, p.y) || 1
      const ax = gx + (p.x / len) * p.radial, ay = gy + (p.y / len) * p.radial
      p.dx += ax * dt; p.dy += ay * dt
      p.x += p.dx * dt; p.y += p.dy * dt
    }
    for (let i = this.ps.length - 1; i >= 0; i--) if (this.ps[i].t >= this.ps[i].life) this.ps.splice(i, 1)
  }
}

// 카드 · 스냅샷 · 복사 그림처럼 한 장으로 그리는 곳은 입자가 다 퍼진 뒤의 모습을 쓴다(파티클마다 하나를 만들어 같이 쓴다).
const stills = new Map<string, ParticleSim>()
export function stillSim(desc: ParticleDesc): ParticleSim {
  let s = stills.get(desc.name)
  if (!s) {
    s = new ParticleSim(desc, 7)
    s.step(Math.min(12, desc.life + desc.lifeVar + 1))
    stills.set(desc.name, s)
  }
  return s
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t
function alphaAt(d: ParticleDesc, p: P, t: number): number {
  const a0 = p.c0[3] * 255, a1 = p.c1[3] * 255
  if (!d.mid.length) return lerp(a0, a1, t)
  const pts: [number, number][] = [[0, a0], ...d.mid, [1, a1]]
  for (let i = 1; i < pts.length; i++) {
    if (t < pts[i][0]) { const [ta, aa] = pts[i - 1], [tb, ab] = pts[i]; return tb === ta ? ab : lerp(aa, ab, (t - ta) / (tb - ta)) }
  }
  return a1
}

// 색을 곱한 그림 — 색은 8단계씩 묶어 캐시한다(입자마다 새로 만들면 느리다).
const tinted = new Map<string, HTMLCanvasElement>()
function tint(img: CanvasImageSource & { width: number; height: number }, key: string, r: number, g: number, b: number): HTMLCanvasElement {
  const q = (v: number) => Math.round(v * 31)
  const k = `${key}|${q(r)}|${q(g)}|${q(b)}`
  let c = tinted.get(k)
  if (!c) {
    c = document.createElement('canvas')
    c.width = img.width; c.height = img.height
    const x = c.getContext('2d')!
    x.drawImage(img, 0, 0)
    x.globalCompositeOperation = 'multiply'
    x.fillStyle = `rgb(${(q(r) / 31) * 255},${(q(g) / 31) * 255},${(q(b) / 31) * 255})`
    x.fillRect(0, 0, c.width, c.height)
    x.globalCompositeOperation = 'destination-in'
    x.drawImage(img, 0, 0)
    if (tinted.size > 600) tinted.clear()
    tinted.set(k, c)
  }
  return c
}

// 입자를 그린다. (cx, cy) = 이 파티클이 붙는 자리(디바이스 픽셀), scale = 게임 1px 의 디바이스 픽셀 수.
export function drawParticles(ctx: CanvasRenderingContext2D, sim: ParticleSim, img: CanvasImageSource & { width: number; height: number }, cx: number, cy: number, scale: number) {
  const d = sim.desc
  const rad = Math.hypot(img.width, img.height) / Math.SQRT2
  ctx.save()
  ctx.imageSmoothingEnabled = true
  const base = ctx.getTransform() // 좌우 뒤집기(flip) 등 바깥 변환을 그대로 두고 그 위에 입자마다 옮긴다
  for (const p of sim.ps) {
    const t = Math.min(1, p.t / p.life)
    let r = lerp(p.c0[0], p.c1[0], t), g = lerp(p.c0[1], p.c1[1], t), b = lerp(p.c0[2], p.c1[2], t)
    const a = alphaAt(d, p, t) / 255
    if (a <= 0.004) continue
    if (d.opacityModifyRGB && !r && !g && !b) r = g = b = a
    const size = lerp(p.s0, p.s1, t)
    if (size <= 0) continue
    const k = (size / rad) * scale
    const rot = (lerp(p.r0, p.r1, t) * Math.PI) / 180
    ctx.globalAlpha = a
    ctx.setTransform(base)
    ctx.translate(cx + p.x * scale, cy + p.y * scale)
    if (rot) ctx.rotate(rot)
    ctx.scale(k, k)
    ctx.drawImage(tint(img, d.name, r, g, b), -d.tex.origin.x, -d.tex.origin.y)
  }
  ctx.restore()
}
