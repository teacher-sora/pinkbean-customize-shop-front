// 움짤(GIF) 저장 — 미리보기의 모든 움직임(몸 동작 · 이펙트 · 부유 · 이모티콘 · 입자)이 한 번씩 돌고 다 같이 처음으로 돌아오기까지를
// 한 바퀴로 만들어 끝없이 반복하게 저장한다(사용자 지시 — 다른 곳에 올려도 커마샵에서 보는 것처럼 이어지게). **누를 때만** 실행된다.
//  1) 반복 길이 = 움직이는 것마다의 한 바퀴 길이의 최소공배수. 너무 길면(MAX_MS) 주인 박자(몸 동작)의 배수로 자른다 — 몸은 이음매 없이
//     돌고, 박자가 맞지 않는 이펙트만 이음매에서 한 번 이어지지 않는다. 입자는 박자가 없어 이음매에서 조금 튈 수 있다.
//  2) 그 구간을 10ms(GIF 시간 단위)마다 훑어 보이는 그림이 바뀌는 때마다 프레임을 하나 둔다. 20ms 보다 짧은 프레임은 앞 프레임에 붙인다
//     (브라우저가 20ms 미만을 100ms 로 늘려 재생한다).
//  3) 그림은 한 장 저장과 같은 함수(canvasExport.drawShot)로 다시 그리고, 모든 프레임이 닿는 상자 하나로 자른다(사방 SHOT_PAD).
//  4) 바탕은 흰색, 또는 투명(transparent — 메뉴의 '투명 움짤 저장'). GIF 는 칸마다 보이거나 안 보이거나 둘뿐이라 투명이면 반투명 칸을
//     알파 절반(ALPHA_CUT)에서 끊는다 — 캐릭터 · 옷은 그대로지만 이펙트의 번지는 빛은 끝이 딱딱해진다(점으로 흉내 내는 디더링은 빛이
//     점무늬가 되어 더 나빴다 — 2026-10 달 망토 이펙트로 견줘 봤다). 그래서 흰 바탕을 기본으로 두고 투명을 따로 둔다.
//     게임 픽셀 하나를 GIF_SCALE 칸으로 키운다(메신저가 작은 그림을 흐릿하게 늘리지 않게). 색은 모든 프레임에서 고른 팔레트 하나를
//     쓴다(프레임마다 고르면 색이 깜빡인다). 투명은 팔레트의 마지막 칸이다.
import { GIFEncoder, applyPalette, quantize } from 'gifenc'
import { SHOT_PAD, drawShot, type ModelShot } from './canvasExport'

export type GifSource = {
  periods: number[]                // 움직이는 것마다 한 바퀴 길이(ms). 첫 값이 주인 박자
  flowing?: boolean                // 입자처럼 박자 없이 계속 흐르는 것이 있다
  sigAt: (t: number) => string     // t 에 보이는 그림의 지문 — 같으면 같은 그림이다
  shotAt: (t: number) => ModelShot // t 의 그림. 시간 순서대로 부른다(입자가 그만큼 흐른다)
}

const TICK = 10, MIN_FRAME = 20, MAX_MS = 12000, FLOW_MS = 40, FLOW_LOOP = 3000, GIF_SCALE = 2, ALPHA_CUT = 128
const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a)

// 한 바퀴 길이(ms). 움직이는 것이 없으면 0.
export function gifLoopMs (periods: number[], flowing = false): number {
  const ps = periods.filter((p) => p > 0).map((p) => Math.max(TICK, Math.round(p / TICK) * TICK))
  if (!ps.length) return flowing ? FLOW_LOOP : 0
  let l = ps[0]
  for (const p of ps.slice(1)) { l = (l / gcd(l, p)) * p; if (l > MAX_MS) break }
  if (l <= MAX_MS) return l
  const top = Math.max(...ps)
  return ps[0] * Math.max(1, Math.min(Math.ceil(top / ps[0]), Math.floor(MAX_MS / ps[0])))
}

export async function animatedGif (src: GifSource, transparent = false): Promise<Blob | null> {
  const L = gifLoopMs(src.periods, src.flowing)
  if (!L) return null
  const sig = (t: number) => src.sigAt(t) + (src.flowing ? `|${Math.floor(t / FLOW_MS)}` : '')
  const starts: number[] = [0]
  let prev = sig(0)
  for (let t = TICK; t < L; t += TICK) {
    const s = sig(t)
    if (s === prev) continue
    prev = s
    if (t - starts[starts.length - 1] >= MIN_FRAME) starts.push(t)
  }
  while (starts.length > 1 && L - starts[starts.length - 1] < MIN_FRAME) starts.pop()

  // 프레임마다 그려 그림 상자만 잘라 둔다(판 전체를 들고 있으면 프레임이 많을 때 메모리가 크다).
  const shots: { c: HTMLCanvasElement; x: number; y: number }[] = []
  let ux0 = Infinity, uy0 = Infinity, ux1 = -Infinity, uy1 = -Infinity
  for (let i = 0; i < starts.length; i++) {
    const d = await drawShot(src.shotAt(starts[i]))
    if (!d) return null
    const w = d.x1 - d.x0 + 1, h = d.y1 - d.y0 + 1
    const c = document.createElement('canvas'); c.width = w; c.height = h
    c.getContext('2d')!.drawImage(d.c, d.x0, d.y0, w, h, 0, 0, w, h)
    shots.push({ c, x: d.x0, y: d.y0 })
    ux0 = Math.min(ux0, d.x0); uy0 = Math.min(uy0, d.y0); ux1 = Math.max(ux1, d.x1); uy1 = Math.max(uy1, d.y1)
    if (i % 4 === 3) await new Promise((r) => setTimeout(r, 0)) // 화면이 멈추지 않게
  }
  const gw = ux1 - ux0 + 1 + SHOT_PAD * 2, gh = uy1 - uy0 + 1 + SHOT_PAD * 2
  const page = document.createElement('canvas'); page.width = gw; page.height = gh
  const g = page.getContext('2d', { willReadFrequently: true })!
  const rgba = shots.map((s) => {
    if (transparent) g.clearRect(0, 0, gw, gh)
    else { g.fillStyle = '#ffffff'; g.fillRect(0, 0, gw, gh) }
    g.drawImage(s.c, s.x - ux0 + SHOT_PAD, s.y - uy0 + SHOT_PAD)
    return g.getImageData(0, 0, gw, gh).data
  })
  // 팔레트 — 모든 프레임에서 고르게 뽑은 (보이는) 칸으로 한 번. 투명이면 한 칸을 투명 자리로 비워 둔다
  const per = Math.max(1, Math.floor(gw * gh * rgba.length / 600000))
  const sample = new Uint8Array(Math.ceil(gw * gh / per) * rgba.length * 4)
  let n = 0
  for (const d of rgba) for (let p = 0; p < gw * gh; p += per) { const i = p * 4; if (transparent && d[i + 3] < ALPHA_CUT) continue; sample[n++] = d[i]; sample[n++] = d[i + 1]; sample[n++] = d[i + 2]; sample[n++] = 255 }
  const colors = quantize(sample.subarray(0, Math.max(4, n)), transparent ? 255 : 256)
  const clear = colors.length
  const palette = transparent ? [...colors, [0, 0, 0]] : colors
  const W = gw * GIF_SCALE, H = gh * GIF_SCALE
  const gif = GIFEncoder()
  const big = new Uint8Array(W * H)
  for (let i = 0; i < rgba.length; i++) {
    const d = rgba[i]
    // 투명: 알파가 ALPHA_CUT 아래인 칸은 투명 자리로, 나머지는 불투명하게 색만 고른다
    const cut = transparent ? new Uint8Array(gw * gh) : null
    if (cut) for (let p = 0; p < gw * gh; p++) { if (d[p * 4 + 3] < ALPHA_CUT) cut[p] = 1; d[p * 4 + 3] = 255 }
    const idx = applyPalette(d, colors)
    if (cut) for (let p = 0; p < idx.length; p++) if (cut[p]) idx[p] = clear
    for (let y = 0; y < H; y++) { const row = ((y / GIF_SCALE) | 0) * gw; for (let x = 0; x < W; x++) big[y * W + x] = idx[row + ((x / GIF_SCALE) | 0)] }
    const delay = (i + 1 < starts.length ? starts[i + 1] : L) - starts[i]
    gif.writeFrame(big, W, H, { palette: i === 0 ? palette : undefined, delay, repeat: 0, transparent, transparentIndex: transparent ? clear : 0 })
    if (i % 4 === 3) await new Promise((r) => setTimeout(r, 0))
  }
  gif.finish()
  return new Blob([gif.bytes()], { type: 'image/gif' })
}
