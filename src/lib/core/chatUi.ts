// 명찰 · 말풍선(반지의 info.nameTag · info.chatBalloon → UI.wz 의 NameTag.img · ChatBalloon.img 조각). dev 전용 실험이다
// (데이터는 public/dev/chatui — main 에는 없어 운영에서는 부위가 나오지 않는다. shopData 의 CHAT_CATS).
//
// 조각 배치는 원본의 origin 을 그대로 따른다 — origin 은 **글자 칸**(명찰) · **안쪽 칸**(말풍선)의 모서리를 기준으로 잡혀 있다.
//  명찰: 왼쪽(w)은 오른쪽 끝이 글자 칸 왼쪽에, 가운데(c)는 글자 칸 폭만큼 이어 붙이고, 오른쪽(e)은 글자 칸 오른쪽에서 시작한다.
//  말풍선: 9조각. 위 · 아래 띠(n · s)는 가로로, 옆 띠(w · e)는 세로로 조각 크기 단위로 이어 붙인다 — 안쪽 칸은 조각 크기의 배수다.
//  꼬리(arrow)는 아래 띠 조각 하나를 **대신한다**(폭이 같고 윗줄이 띠와 같다). 띠 위에 겹쳐 그리면 반투명(알파 204)이
//  두 번 쌓여 꼬리 둘레만 진해진다 — 예전 시도의 문제였다.
// 글자는 돋움 12px 비트맵의 도트를 그대로 찍는다(core/chatGlyphs — 브라우저가 글꼴을 그리지 않아 어느 기기에서나 게임과 같다).
// 글자 폭(advance) · 왼쪽 여백 · 기준선 높이도 돋움 값 그대로다. 색은 원본 clr. 돋움에 없는 글자만 사이트 글꼴로 그려 알파를 끊는다.
import { groundOf, type PlacedLayer } from './assemble'
import { glyphOf, loadGlyphs } from './chatGlyphs'
import type { Vec } from './data'
import { loadImage } from './render'

export interface ChatPart { png: string; w: number; h: number; origin: Vec }
export interface ChatUi { kind: 'nameTag' | 'chatBalloon'; clr: string; parts: Record<string, ChatPart> }
// 그릴 것: 명찰 · 말풍선(없으면 그리지 않는다)과 글자.
export interface ChatDraw { tag?: ChatUi; balloon?: ChatUi; name: string; text: string }

const LINE = 12            // 글자 한 줄 높이(돋움 12px — 기준선 위 10, 아래 2)
const BASE = 12            // 글자 그림 안의 기준선(위 여백 2 — 기준선 위로 10보다 높은 글자가 있어도 잘리지 않게)
const TAG_GAP = 2          // 발끝 아래 명찰 띠까지
const BALLOON_UP = 85      // 발끝에서 말풍선 안쪽 칸 아래 끝까지(게임 클라이언트의 고정값)

type Bitmap = { c: HTMLCanvasElement; ox: number; oy: number } // ox, oy = 기준점(발끝)에서 그림 왼쪽 위까지
const cache = new Map<string, Promise<Bitmap | null>>()

const canvasOf = (w: number, h: number) => { const c = document.createElement('canvas'); c.width = Math.max(1, w); c.height = Math.max(1, h); return c }

// 글자 한 줄 → 잉크가 닿는 상자로 자른 그림(가로 · 세로 모두 — 놓을 때 잉크를 칸 가운데에 맞춘다)과 글자 폭의 합(adv).
// 돋움 도트를 펜 위치 + 왼쪽 여백, 기준선 - 기준선 위 높이에 찍고 펜을 글자 폭만큼 옮긴다(게임 · 윈도우의 글자 놓기와 같다).
function textBitmap (str: string, clr: string): { c: HTMLCanvasElement; adv: number } {
  const chars = [...str]
  const fb = canvasOf(1, 1).getContext('2d')!
  fb.font = `12px ${getComputedStyle(document.body).fontFamily}` // 돋움에 없는 글자만
  let adv = 0
  for (const ch of chars) { const g = glyphOf(ch.codePointAt(0)!); adv += g ? g.adv : Math.ceil(fb.measureText(ch).width) }
  const W = adv + 4, H = BASE + 6
  const c = canvasOf(W, H)
  const g2 = c.getContext('2d', { willReadFrequently: true })!
  const img = g2.createImageData(W, H), d = img.data
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(clr.substr(i, 2), 16))
  const dot = (x: number, y: number) => { if (x < 0 || y < 0 || x >= W || y >= H) return; const i = (y * W + x) * 4; d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 255 }
  let pen = 2
  for (const ch of chars) {
    const gl = glyphOf(ch.codePointAt(0)!)
    if (gl) {
      const rb = Math.ceil(gl.w / 8)
      for (let y = 0; y < gl.h; y++) for (let x = 0; x < gl.w; x++) if ((gl.rows[y * rb + (x >> 3)] >> (7 - (x & 7))) & 1) dot(pen + gl.bx + x, BASE - gl.by + y)
      pen += gl.adv
    } else {
      const w = Math.ceil(fb.measureText(ch).width), t = canvasOf(w + 2, H), tg = t.getContext('2d', { willReadFrequently: true })!
      tg.font = fb.font; tg.textBaseline = 'alphabetic'; tg.fillText(ch, 1, BASE)
      const td = tg.getImageData(0, 0, t.width, H).data
      for (let y = 0; y < H; y++) for (let x = 0; x < t.width; x++) if (td[(y * t.width + x) * 4 + 3] >= 128) dot(pen - 1 + x, y)
      pen += w
    }
  }
  let top = H, bot = -1, left = W, right = -1
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (d[(y * W + x) * 4 + 3]) { if (y < top) top = y; bot = y; if (x < left) left = x; if (x > right) right = x }
  if (bot < 0) return { c: canvasOf(1, 1), adv }
  g2.putImageData(img, 0, 0)
  const out = canvasOf(right - left + 1, bot - top + 1)
  out.getContext('2d')!.drawImage(c, -left, -top)
  return { c: out, adv }
}

// 그림의 불투명한 줄 범위(위, 아래 — 둘 다 포함). 글자를 띠의 불투명한 부분 가운데에 맞추려고 잰다.
function opaqueRows (img: HTMLImageElement): [number, number] {
  const c = canvasOf(img.width, img.height)
  const g = c.getContext('2d', { willReadFrequently: true })!
  g.drawImage(img, 0, 0)
  const d = g.getImageData(0, 0, c.width, c.height).data
  let top = -1, bot = -1
  for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) if (d[(y * c.width + x) * 4 + 3]) { if (top < 0) top = y; bot = y; break }
  return top < 0 ? [0, img.height - 1] : [top, bot]
}

async function parts (ui: ChatUi) {
  const out: Record<string, HTMLImageElement> = {}
  await Promise.all(Object.entries(ui.parts).map(async ([k, p]) => { out[k] = await loadImage(p.png, true) }))
  return out
}

// 명찰. 글자 칸 = 글자 폭 + 양옆 2px. 기준점(0,0) = 글자 칸 가운데 위.
async function nameTag (ui: ChatUi, name: string): Promise<Bitmap> {
  const im = await parts(ui), P = ui.parts
  const t = textBitmap(name, ui.clr)
  const inner = t.adv + 4
  const L = -Math.floor(inner / 2), R = L + inner
  const [ct, cb] = opaqueRows(im.c)
  // 띠의 불투명한 첫 줄이 발끝 TAG_GAP 아래에 오게 글자 칸 위(T)를 잡는다.
  const T = TAG_GAP - (ct - P.c.origin.y)
  const x0 = L - P.w.origin.x, x1 = R - P.e.origin.x + P.e.w
  const y0 = T - Math.max(P.w.origin.y, P.c.origin.y, P.e.origin.y)
  const y1 = T + Math.max(P.w.h - P.w.origin.y, P.c.h - P.c.origin.y, P.e.h - P.e.origin.y)
  const c = canvasOf(x1 - x0, y1 - y0), g = c.getContext('2d')!
  g.imageSmoothingEnabled = false
  const at = (img: HTMLImageElement, p: ChatPart, x: number, y: number, w = p.w) => g.drawImage(img, 0, 0, w, p.h, x - p.origin.x - x0, y - p.origin.y - y0, w, p.h)
  at(im.w, P.w, L, T)
  for (let x = L; x < R; x += P.c.w) at(im.c, P.c, x, T, Math.min(P.c.w, R - x))
  at(im.e, P.e, R, T)
  // 글자: 가로는 글자 칸 가운데, 세로는 띠의 불투명한 부분 가운데.
  const bandTop = T - P.c.origin.y + ct, bandBot = T - P.c.origin.y + cb
  const ty = Math.round((bandTop + bandBot + 1 - t.c.height) / 2)
  g.drawImage(t.c, L + Math.round((inner - t.c.width) / 2) - x0, ty - y0)
  return { c, ox: x0, oy: y0 }
}

// 말풍선. 안쪽 칸 폭 = 위 띠 조각 폭의 짝수 배(글자 폭 / 조각 + 2, 꼬리 조각이 가운데 칸에 정확히 들어가게 짝수로),
// 높이 = 옆 띠 조각 높이의 배수. 기준점(0,0) = 안쪽 칸 아래 가운데.
async function balloon (ui: ChatUi, line: string): Promise<Bitmap> {
  const im = await parts(ui), P = ui.parts
  const t = textBitmap(line, ui.clr)
  const xt = P.n.w, yt = P.w.h
  let cols = Math.floor(t.adv / xt) + 2
  if (cols % 2) cols++
  const rows = Math.max(1, Math.ceil(LINE / yt))
  const W = cols * xt, H = rows * yt
  const L = -W / 2, R = W / 2, B = 0, T = -H
  const pieces: [HTMLImageElement, ChatPart, number, number][] = []
  pieces.push([im.nw, P.nw, L, T], [im.ne, P.ne, R, T], [im.sw, P.sw, L, B], [im.se, P.se, R, B])
  const tail = cols / 2
  for (let i = 0; i < cols; i++) {
    pieces.push([im.n, P.n, L + i * xt, T])
    pieces.push(i === tail ? [im.arrow, P.arrow, L + i * xt, B] : [im.s, P.s, L + i * xt, B])
  }
  for (let y = T; y < B; y += yt) pieces.push([im.w, P.w, L, y], [im.e, P.e, R, y])
  for (let y = T; y < B; y += P.c.h) for (let x = L; x < R; x += P.c.w) pieces.push([im.c, P.c, x, y])
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  for (const [, p, x, y] of pieces) { x0 = Math.min(x0, x - p.origin.x); y0 = Math.min(y0, y - p.origin.y); x1 = Math.max(x1, x - p.origin.x + p.w); y1 = Math.max(y1, y - p.origin.y + p.h) }
  const c = canvasOf(x1 - x0, y1 - y0), g = c.getContext('2d')!
  g.imageSmoothingEnabled = false
  // 안쪽(c)을 먼저, 테두리 조각을 그 위에 — 조각끼리는 겹치지 않는다(origin 이 칸 모서리에 맞춰져 있다).
  for (const [img, p, x, y] of pieces.filter(([, p]) => p === P.c)) g.drawImage(img, 0, 0, Math.min(p.w, R - x), Math.min(p.h, B - y), x - x0, y - y0, Math.min(p.w, R - x), Math.min(p.h, B - y))
  for (const [img, p, x, y] of pieces.filter(([, p]) => p !== P.c)) g.drawImage(img, x - p.origin.x - x0, y - p.origin.y - y0)
  const tx = Math.round(-(t.c.width) / 2), ty = Math.round(T + (H - t.c.height) / 2)
  g.drawImage(t.c, tx - x0, ty - y0)
  return { c, ox: x0, oy: y0 - BALLOON_UP }
}

const key = (ui: ChatUi, s: string) => `${ui.kind}|${ui.parts[ui.kind === 'nameTag' ? 'c' : 'n']?.png}|${s}`
function bitmapOf (ui: ChatUi, s: string, keep: boolean): Promise<Bitmap | null> {
  const k = key(ui, s)
  let p = cache.get(k)
  if (!p) {
    p = (ui.kind === 'nameTag' ? nameTag(ui, s) : balloon(ui, s)).catch(() => null)
    p.then((b) => { if (!b || !keep) cache.delete(k) })
    cache.set(k, p)
  }
  return p
}

// 그릴 그림들을 미리 만든다(캐시). 그리기는 동기로 한다 — renderCharacter 가 그림을 다 받은 뒤 부른다.
export async function prepareChat (d: ChatDraw | undefined): Promise<Bitmap[]> {
  if (!d) return []
  // 글자 도트를 먼저 받는다(이미 받았으면 바로 끝난다) — 받기 전에 그리지 않는다. 받지 못했으면 그린 그림을 기억하지 않아 다음에 다시 그린다.
  const keep = await loadGlyphs([d.name, d.text, ' : '])
  const out = await Promise.all([d.balloon ? bitmapOf(d.balloon, `${d.name} : ${d.text}`, keep) : null, d.tag ? bitmapOf(d.tag, d.name, keep) : null])
  return out.filter((b): b is Bitmap => !!b)
}

// 캐릭터 위에 덧그린다. 시선이 오른쪽(flip)이어도 글자는 뒤집지 않고 자리만 옮긴다. 기준점 = 딛고 선 바닥(탈것이면 탈것의 바닥).
export function drawChat (ctx: CanvasRenderingContext2D, maps: Bitmap[], placed: PlacedLayer[], o: { anchorX: number; anchorY: number; scale: number; flip?: boolean; width: number }) {
  if (!maps.length) return
  const g = groundOf(placed)
  if (!g) return
  const fx = (o.anchorX + g.x) * o.scale
  const cx = o.flip ? o.width - fx : fx
  const cy = (o.anchorY + g.y) * o.scale
  ctx.imageSmoothingEnabled = false
  for (const b of maps) ctx.drawImage(b.c, Math.round(cx + b.ox * o.scale), Math.round(cy + b.oy * o.scale), b.c.width * o.scale, b.c.height * o.scale)
}
