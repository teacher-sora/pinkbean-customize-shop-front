// 움짤(GIF) 저장 — 미리보기의 모든 움직임(몸 동작 · 이펙트 · 부유 · 이모티콘 · 입자)이 한 번씩 돌고 다 같이 처음으로 돌아오기까지를
// 한 바퀴로 만들어 끝없이 반복하게 저장한다(사용자 지시 — 다른 곳에 올려도 커마샵에서 보는 것처럼 이어지게). **누를 때만** 받고 실행된다(동적 import).
//  1) 반복 길이 = 움직이는 것마다의 한 바퀴 길이의 최소공배수. 너무 길면(MAX_MS) 주인 박자(몸 동작)의 배수로 자른다 — 몸은 이음매 없이
//     돌고, 박자가 맞지 않는 이펙트만 이음매에서 한 번 이어지지 않는다. 입자는 박자가 없어 이음매에서 조금 튈 수 있다.
//  2) 그 구간을 10ms(GIF 시간 단위)마다 훑어 보이는 그림이 바뀌는 때마다 프레임을 하나 둔다. 20ms 보다 짧은 프레임은 앞 프레임에 붙인다
//     (브라우저가 20ms 미만을 100ms 로 늘려 재생한다).
//  3) 그림은 한 장 저장과 같은 함수(canvasExport.drawShot)로 다시 그리고, 모든 프레임이 닿는 상자 하나로 자른다(사방 SHOT_PAD).
//     이미지 저장 · 복사와 같은 게임 크기(1배)다 — 게임 픽셀 하나가 움짤 칸 하나(사용자 지시). 바탕 둘:
//     - '움짤 저장': 그 상자 자리에 미리보기에서 보이는 배경을 깐다(lib/stageShot — 사용자 지시: 보는 화면을 통째로 뽑지 말고 캐릭터에
//       맞춘 판에 바탕만 지금 배경으로). 캐릭터를 미리보기 캔버스와 같은 판(stage.place)에 그려 배경과 자리가 맞는다. 반투명한 이펙트도
//       배경 위에 섞여 그대로 담긴다.
//     - '투명 움짤 저장': GIF 는 칸마다 보이거나 안 보이거나 둘뿐이라 반투명 칸을 알파 절반(ALPHA_CUT)에서 끊는다 — 캐릭터 · 옷은 그대로지만 이펙트의
//       번지는 빛은 끝이 딱딱해진다(점으로 흉내 내는 디더링은 빛이 점무늬가 되어 더 나빴다 — 2026-10 달 망토 이펙트로 견줘 봤다).
//  4) 색은 모든 프레임에서 고른 팔레트 하나(프레임마다 고르면 색이 깜빡인다). 팔레트의 마지막 칸은 투명 자리다 — 투명 판은 진짜 투명,
//     배경 판은 '앞 프레임 그대로'(바뀐 칸만 적는다 — 배경이 큰 판도 파일이 작다). 사진 배경은 색 띠가 지지 않게 고정 무늬로 흔든다(dither).
import { GIFEncoder, applyPalette, quantize } from 'gifenc'
import { SHOT_PAD, drawShot, type ModelShot } from './canvasExport'

export type GifSource = {
  periods: number[]                // 움직이는 것마다 한 바퀴 길이(ms). 첫 값이 주인 박자
  flowing?: boolean                // 입자처럼 박자 없이 계속 흐르는 것이 있다
  sigAt: (t: number) => string     // t 에 보이는 그림의 지문 — 같으면 같은 그림이다
  shotAt: (t: number) => ModelShot // t 의 그림. 시간 순서대로 부른다(입자가 그만큼 흐른다)
  stage?: GifStage                 // 배경 판(없으면 투명 판만 만든다)
}
// 배경: 캐릭터를 미리보기 캔버스와 같은 판(place — 상자 · 기준점, 게임 1배)에 그리고, paint 가 그 판의 (x0, y0) 칸이 움짤의 왼쪽 위에,
// 게임 1칸이 s px 로 오도록 지금 배경을 그린다. 돌려주는 값 true = 사진(올린 그림)이라 고르게 번지는 색이 많다
export type GifStage = {
  place: { box: { w: number; h: number }; anchor: { x: number; y: number } }
  paint: (g: CanvasRenderingContext2D, x0: number, y0: number, s: number) => Promise<boolean>
}

const TICK = 10, MIN_FRAME = 20, MAX_MS = 12000, FLOW_MS = 40, FLOW_LOOP = 3000, GIF_SCALE = 1, ALPHA_CUT = 128
const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a)
// 사진 배경의 색 띠 풀기 — 256색으로 줄이면 고른 그라데이션이 계단이 된다. 고정된 4×4 무늬(Bayer)로 ±DITHER 만큼 흔들어 둔다.
// 배경 판에 한 번만 입힌다(캐릭터는 도트 그대로) — 무늬가 프레임마다 같아 '앞 프레임 그대로' 칸도 그대로 남는다.
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5], DITHER = 10
function dither (g: CanvasRenderingContext2D, W: number, H: number) {
  const im = g.getImageData(0, 0, W, H), d = im.data
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const o = ((BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16 - 0.5) * 2 * DITHER, i = (y * W + x) * 4
    d[i] += o; d[i + 1] += o; d[i + 2] += o
  }
  g.putImageData(im, 0, 0)
}

// 한 바퀴 길이(ms). 움직이는 것이 없으면 0(한 장짜리 움짤).
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

  const stage = src.stage
  // 프레임마다 그려 그림 상자만 잘라 둔다(판 전체를 들고 있으면 프레임이 많을 때 메모리가 크다).
  const shots: { c: HTMLCanvasElement; x: number; y: number }[] = []
  let ux0 = Infinity, uy0 = Infinity, ux1 = -Infinity, uy1 = -Infinity
  for (let i = 0; i < starts.length; i++) {
    const d = await drawShot(src.shotAt(starts[i]), stage?.place)
    if (!d) return null
    const w = d.x1 - d.x0 + 1, h = d.y1 - d.y0 + 1
    const c = document.createElement('canvas'); c.width = w; c.height = h
    c.getContext('2d')!.drawImage(d.c, d.x0, d.y0, w, h, 0, 0, w, h)
    shots.push({ c, x: d.x0, y: d.y0 })
    ux0 = Math.min(ux0, d.x0); uy0 = Math.min(uy0, d.y0); ux1 = Math.max(ux1, d.x1); uy1 = Math.max(uy1, d.y1)
    if (i % 4 === 3) await new Promise((r) => setTimeout(r, 0)) // 화면이 멈추지 않게
  }
  // 판 크기와 캐릭터 판의 자리(판의 (ux0 - PAD, uy0 - PAD) 칸이 움짤의 왼쪽 위)
  const S = GIF_SCALE, x0 = ux0 - SHOT_PAD, y0 = uy0 - SHOT_PAD
  const W = (ux1 - x0 + 1 + SHOT_PAD) * S, H = (uy1 - y0 + 1 + SHOT_PAD) * S
  const ox = -x0 * S, oy = -y0 * S
  let back: HTMLCanvasElement | null = null
  if (!transparent) {
    back = document.createElement('canvas'); back.width = W; back.height = H
    const bg = back.getContext('2d', { willReadFrequently: true })!
    bg.fillStyle = '#ffffff'; bg.fillRect(0, 0, W, H) // 배경을 모르면 흰 바탕
    if (stage && await stage.paint(bg, x0, y0, S)) dither(bg, W, H)
  }
  const page = document.createElement('canvas'); page.width = W; page.height = H
  const g = page.getContext('2d', { willReadFrequently: true })!
  const compose = (i: number) => {
    const sh = shots[i]
    g.clearRect(0, 0, W, H)
    if (back) g.drawImage(back, 0, 0)
    g.imageSmoothingEnabled = false
    g.drawImage(sh.c, ox + sh.x * S, oy + sh.y * S, sh.c.width * S, sh.c.height * S)
    return g.getImageData(0, 0, W, H).data
  }
  // 팔레트 — 모든 프레임에서 고르게 뽑은 (보이는) 칸으로 한 번. 마지막 한 칸은 투명 자리로 비워 둔다
  const per = Math.max(1, Math.floor(W * H * shots.length / 600000))
  const sample = new Uint8Array(Math.ceil(W * H / per) * shots.length * 4)
  let n = 0
  for (let i = 0; i < shots.length; i++) {
    const d = compose(i)
    for (let p = (i * 7) % per; p < W * H; p += per) { const q = p * 4; if (d[q + 3] < ALPHA_CUT) continue; sample[n++] = d[q]; sample[n++] = d[q + 1]; sample[n++] = d[q + 2]; sample[n++] = 255 }
    if (i % 4 === 3) await new Promise((r) => setTimeout(r, 0))
  }
  const colors = quantize(sample.subarray(0, Math.max(4, n)), 255)
  const clear = colors.length
  const palette = [...colors, [0, 0, 0]]
  const gif = GIFEncoder()
  let prevIdx: Uint8Array | null = null
  for (let i = 0; i < shots.length; i++) {
    const d = compose(i)
    // 투명 판: 알파가 ALPHA_CUT 아래인 칸은 투명 자리로. 나머지는 불투명하게 색만 고른다
    const cut = transparent ? new Uint8Array(W * H) : null
    if (cut) for (let p = 0; p < W * H; p++) { if (d[p * 4 + 3] < ALPHA_CUT) cut[p] = 1; d[p * 4 + 3] = 255 }
    const idx = applyPalette(d, colors)
    if (cut) for (let p = 0; p < idx.length; p++) if (cut[p]) idx[p] = clear
    const delay = L ? (i + 1 < starts.length ? starts[i + 1] : L) - starts[i] : 0
    if (transparent) gif.writeFrame(idx, W, H, { palette: i === 0 ? palette : undefined, delay, repeat: 0, transparent: true, transparentIndex: clear })
    else {
      // 배경 판: 앞 프레임과 같은 칸은 투명 자리(= 앞 프레임 그대로, dispose 1)로 적는다
      const out = prevIdx ? idx.map((v, p) => (v === prevIdx![p] ? clear : v)) : idx
      gif.writeFrame(out, W, H, { palette: i === 0 ? palette : undefined, delay, repeat: 0, transparent: i > 0, transparentIndex: clear, dispose: 1 })
      prevIdx = idx
    }
    if (i % 4 === 3) await new Promise((r) => setTimeout(r, 0))
  }
  gif.finish()
  return new Blob([gif.bytes()], { type: 'image/gif' })
}
