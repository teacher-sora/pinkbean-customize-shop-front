// 명찰 · 말풍선(반지의 info.nameTag · info.chatBalloon → UI.wz 의 NameTag.img · ChatBalloon.img 조각).
// (데이터는 public/chatui — shopData 의 CHAT_CATS).
// 조각은 반지마다 그림 한 장(아틀라스)에 모아 두고 잘라 쓴다 — 반지 하나를 그리는 데 요청이 한 번이다.
//
// 조각은 모두 반투명(알파 204 안팎)이라 **어느 두 조각도 겹치면 안 된다**(겹친 자리만 진해진다). 조각 배치는 원본 origin 그대로다.
//  명찰: origin = **글자 칸**(높이 12)의 모서리 · 가운데 위 기준. 글자 칸을 발끝 아래 TAG_TEXT 에 두고 띠는 origin 대로 놓는다.
//        글자 칸 폭 = 이름 폭 그대로, 왼끝 = 기준점에서 (이름 폭 + 4) / 2 왼쪽 — 게임 화면과 점 단위로 맞춘 값이다(게임도 명찰이 2px 왼쪽).
//        디자인마다 띠가 글자 칸 위로 올라오는 만큼이 달라 명찰마다 높이가 다르다 —
//        디자인마다 띠가 글자 칸 위로 올라오는 만큼이 달라 명찰마다 높이가 다르다.
//        w(왼쪽)는 오른쪽 끝이 글자 칸 왼쪽에, c(가운데)는 글자 칸 폭만큼 이어 붙이고, e(오른쪽)는 글자 칸 오른쪽에서 시작한다.
//        움직이는 명찰(aniNameTag)의 층 0, 1, 2(, 3) = 이름 폭에 따라 고르는 **명찰 통째 그림**이다(층마다 24px 안팎씩 넓다).
//        이름이 들어가는 가장 작은 층 하나만 첫 프레임으로 그린다(층마다 들어가는 폭 = aniFit). 이때 w · c · e 는 7개 모두 같은
//        검은 대체 그림이라 그리지 않는다 — 함께 그리면 명찰이 두 개 겹쳐 보인다.
//  말풍선: 9조각. origin = **안쪽 칸**의 모서리 기준. 네 모서리는 origin 대로 두고, 위 · 아래 띠(n · s)는 두 모서리가 실제로 그려진 사이를 가로로,
//        옆 띠(w · e)는 세로로, 안쪽(c)은 네 띠 사이를 조각 크기 단위로 메운다(origin 이 조각 크기와 어긋난 디자인도 겹치거나 비지 않는다).
//        위 장식(head)과 꼬리(arrow)는 띠 무늬를 그 안에 이미 품은 조각이다(첫 열이 띠 조각의 첫 열과 같다) — 띠 위에 얹지 않고
//        **띠 한 칸을 대신한다**. 폭이 띠 조각과 달라도 되도록 그 자리를 비워 두고 띠를 양옆에서 이어 붙인다.
//        위 장식이 있으면 안쪽 칸 폭 = 띠 조각 k개 + 장식 + 띠 조각 k개 — 장식 왼쪽이 띠 조각 경계에 떨어져 무늬가 끊기지 않는다.
//        위 장식 · 꼬리는 말풍선 가운데에, 안쪽 칸의 가운데는 캐릭터 기준점에 온다.
//        꼬리 그림의 아래 끝을 발끝 위 BALLOON_TIP 에 둔다 — 아래 띠가 두꺼운 디자인도 얼굴을 덮지 않고,
//        몸통 높이는 디자인마다 다르다. originOffset 은 말풍선 전체를 옮긴다.
//        이모티콘을 고르면 글 대신 이모티콘을 원래 크기 그대로 안쪽 칸 가운데에 둔다(안쪽 칸이 그 크기에 맞춰 커진다).
//        움직이는 이모티콘은 프레임 전부가 들어가는 상자로 칸을 한 번만 잡고(프레임마다 칸이 흔들리지 않게), 프레임은 말풍선 그림에 굽지 않고
//        그릴 때마다 보낸 뒤 흐른 시간의 프레임을 덧그린다(drawChat — 프레임마다 원본의 머무는 시간대로, 끝나면 처음부터).
// 글자는 돋움 12px 비트맵의 도트를 그대로 찍는다(core/chatGlyphs — 브라우저가 글꼴을 그리지 않아 어느 기기에서나 게임과 같다).
// 글자 폭(advance) · 왼쪽 여백 · 기준선 높이도 돋움 값 그대로다. 색은 원본 clr. 돋움에 없는 글자만 사이트 글꼴로 그려 알파를 끊는다.
// 원본에 있지만 아직 쓰지 않는 값: 움직이는 명찰의 heightoffset · bottomoffset(뜻을 확인하지 못했다), fontType(명찰 · 말풍선 각 1개).
import { groundOf, type PlacedLayer } from './assemble'
import { glyphOf, loadGlyphs } from './chatGlyphs'
import type { Vec } from './data'
import { loadImage } from './render'

export interface ChatPart { x: number; y: number; w: number; h: number; origin: Vec } // 아틀라스 안의 자리
export interface ChatUi {
  kind: 'nameTag' | 'chatBalloon'; clr: string; atlas: string; parts: Record<string, ChatPart>
  originOffset?: Vec; heightoffset?: number; bottomoffset?: number; fontType?: number
  aniFit?: number[] // 움직이는 명찰: 층(ani0, ani1, …)마다 이름이 들어가는 폭(px) — 추출 때 그림의 안쪽 폭을 재어 적는다
}
// 이모티콘 프레임: 가로로 이은 그림(strip) 안의 자리 x · 크기 · origin(ox, oy) · 머무는 시간(d, ms)
export interface EmoFrame { x: number; w: number; h: number; ox: number; oy: number; d: number }
// png = 대표 그림(mainImg — 고르기 칸 · 정지 그림). 움직이는 것은 strip · frames 가 있다.
export interface ChatEmo { id: string; name: string; png: string; w: number; h: number; origin: Vec; main?: number; strip?: string; frames?: EmoFrame[] }
// 그릴 것: 명찰 · 말풍선(없으면 그리지 않는다)과 글자 · 이모티콘.
export interface ChatDraw { tag?: ChatUi; balloon?: ChatUi; name: string; text: string; emo?: ChatEmo; t0?: number } // t0 = 보낸 시각(performance.now) — 움직이는 이모티콘의 시계

const LINE = 12            // 글자 한 줄 높이(돋움 12px — 기준선 위 10, 아래 2)
const GAP = 2              // 줄 사이
const WRAP = 144           // 말풍선 한 줄의 최대 폭(px, 한글 12자) — 넘으면 다음 줄로. 원본에 없는 값이라 게임 화면의 느낌에 맞춰 정했다
const BASE = 12            // 글자 그림 안의 기준선(위 여백 2 — 기준선 위로 10보다 높은 글자가 있어도 잘리지 않게)
// 발끝에서의 두 거리는 원본에 없어 게임 화면(꿈나라 달링 · 벼링 명찰 · 말풍선, 1배 캡처)을 픽셀로 재어 맞췄다.
const TAG_TEXT = 8         // 발끝 아래 명찰 글자 칸 위까지(띠 origin y 6 인 명찰의 윗변이 발끝 2px 아래 — 게임과 같다)
const BALLOON_TIP = 76     // 발끝 위 말풍선 꼬리 그림 아래 끝까지(두 반지 모두 이 줄 — 몸통은 꼬리 길이만큼 오르내린다)

// ox, oy = 기준점(발끝)에서 그림 왼쪽 위까지. emo = 덧그릴 움직이는 이모티콘(x, y = 그림 왼쪽 위에서 프레임 origin 이 닿는 점)
type Bitmap = { c: HTMLCanvasElement; ox: number; oy: number; emo?: { img: HTMLImageElement; frames: EmoFrame[]; x: number; y: number } }

// 보낸 뒤 t ms 에 보일 프레임 번호(머무는 시간을 더해 가며, 끝나면 처음부터). t 가 없으면(정지 그림) 대표 프레임.
export function emoFrameAt (emo: ChatEmo, t?: number): number {
  const fr = emo.frames
  if (!fr?.length) return 0
  if (t == null) return Math.min(emo.main ?? 0, fr.length - 1)
  const total = fr.reduce((s, f) => s + Math.max(1, f.d), 0)
  let r = ((t % total) + total) % total
  for (let i = 0; i < fr.length; i++) { r -= Math.max(1, fr[i].d); if (r < 0) return i }
  return fr.length - 1
}
// 만든 그림(명찰 · 말풍선 + 글). 최근에 쓴 것 CACHE_MAX 개만 둔다 — 채팅 칸에 적는 동안 글자마다 미리 만들어 두므로(warmChat) 끝없이 쌓이지 않게.
const cache = new Map<string, Promise<Bitmap | null>>()
const CACHE_MAX = 48

const canvasOf = (w: number, h: number) => { const c = document.createElement('canvas'); c.width = Math.max(1, w); c.height = Math.max(1, h); return c }
let fbFont = ''
const fallbackFont = () => fbFont || (fbFont = `12px ${getComputedStyle(document.body).fontFamily}`) // 돋움에 없는 글자만
const advOf = (ch: string, fb: CanvasRenderingContext2D) => { const g = glyphOf(ch.codePointAt(0)!); return g ? g.adv : Math.ceil(fb.measureText(ch).width) }

// 말풍선 글을 줄로 나눈다 — 글자 폭을 더해 WRAP 을 넘기 전에 끊는다(띄어쓰기에서 끊을 수 있으면 거기서).
function wrapLines (str: string): string[] {
  const fb = canvasOf(1, 1).getContext('2d')!; fb.font = fallbackFont()
  const out: string[] = []
  for (const para of str.split('\n')) {
    let line = '', w = 0, lastSpace = -1
    for (const ch of para) {
      const a = advOf(ch, fb)
      if (w + a > WRAP && line) {
        if (lastSpace > 0) { out.push(line.slice(0, lastSpace)); line = line.slice(lastSpace + 1); w = [...line].reduce((s, c) => s + advOf(c, fb), 0) }
        else { out.push(line); line = ''; w = 0 }
        lastSpace = -1
      }
      if (ch === ' ') lastSpace = line.length
      line += ch; w += a
    }
    out.push(line)
  }
  return out
}

// 글자 한 줄 → 잉크가 닿는 상자로 자른 그림(가로 · 세로 모두 — 놓을 때 잉크를 칸 가운데에 맞춘다)과 글자 폭의 합(adv).
// 돋움 도트를 펜 위치 + 왼쪽 여백, 기준선 - 기준선 위 높이에 찍고 펜을 글자 폭만큼 옮긴다(게임 · 윈도우의 글자 놓기와 같다).
// top = 잘린 그림의 위가 줄의 위(기준선 - 10)에서 몇 칸 아래인지 — 여러 줄을 같은 기준선 간격으로 쌓을 때 쓴다.
// left = 잘린 그림의 왼끝이 펜의 시작에서 몇 칸 오른쪽인지 — 명찰 글자를 게임처럼 펜 위치로 놓을 때 쓴다.
function textBitmap (str: string, clr: string): { c: HTMLCanvasElement; adv: number; top: number; left: number } {
  const chars = [...str]
  const fb = canvasOf(1, 1).getContext('2d')!
  fb.font = fallbackFont()
  let adv = 0
  for (const ch of chars) adv += advOf(ch, fb)
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
  if (bot < 0) return { c: canvasOf(1, 1), adv, top: 0, left: 0 }
  g2.putImageData(img, 0, 0)
  const out = canvasOf(right - left + 1, bot - top + 1)
  out.getContext('2d')!.drawImage(c, -left, -top)
  return { c: out, adv, top: top - (BASE - 10), left: left - 2 }
}

// 그릴 조각: 그림 위 왼쪽 위 자리(x, y)와 조각 안에서 잘라 쓸 범위((sx, sy) 부터 w × h — 이어 붙일 때 양끝에서 자른다).
type Piece = { p: ChatPart; x: number; y: number; sx?: number; sy?: number; w?: number; h?: number }
const at = (p: ChatPart, ax: number, ay: number): Piece => ({ p, x: ax - p.origin.x, y: ay - p.origin.y }) // origin 이 (ax, ay) 에 닿게
const right = (q: Piece) => q.x + (q.w ?? q.p.w), bottom = (q: Piece) => q.y + (q.h ?? q.p.h)
// 조각 p 를 [a, b) 에 조각 폭 단위로 깐다. 'start' = a 에서 무늬가 시작(끝 조각은 b 에서 자른다),
// 'end' = b 에서 무늬가 끝난다(첫 조각은 왼쪽을 자른다 — 위 장식 · 꼬리 왼쪽 띠가 장식 쪽에서 무늬가 이어지게).
function hfill (out: Piece[], p: ChatPart, a: number, b: number, y: number, align: 'start' | 'end' = 'start', h = p.h, sy = 0) {
  if (align === 'start') for (let x = a; x < b; x += p.w) out.push({ p, x, y, sy, w: Math.min(p.w, b - x), h })
  else for (let x = b; x > a; x -= p.w) { const l = Math.max(a, x - p.w); out.push({ p, x: l, y, sx: l - (x - p.w), sy, w: x - l, h }) }
}
const vfill = (out: Piece[], p: ChatPart, x: number, a: number, b: number) => { for (let y = a; y < b; y += p.h) out.push({ p, x, y, h: Math.min(p.h, b - y) }) }
// 조각들을 한 장에 그린다. 기준점(0,0)에서 그림 왼쪽 위까지 = (ox, oy).
function compose (A: HTMLImageElement, pieces: Piece[], extra: (g: CanvasRenderingContext2D, x0: number, y0: number) => void): Bitmap {
  const live = pieces.filter((q) => (q.w ?? q.p.w) > 0 && (q.h ?? q.p.h) > 0)
  const x0 = Math.min(...live.map((q) => q.x)), y0 = Math.min(...live.map((q) => q.y))
  const c = canvasOf(Math.max(...live.map(right)) - x0, Math.max(...live.map(bottom)) - y0), g = c.getContext('2d')!
  g.imageSmoothingEnabled = false
  for (const q of live) { const w = q.w ?? q.p.w, h = q.h ?? q.p.h; g.drawImage(A, q.p.x + (q.sx ?? 0), q.p.y + (q.sy ?? 0), w, h, q.x - x0, q.y - y0, w, h) }
  extra(g, x0, y0)
  return { c, ox: x0, oy: y0 }
}

// 명찰. 기준점(0,0) = 발끝. 글자 칸(높이 12)의 위 = TAG_TEXT, 글자 칸의 왼끝 = -(이름 폭 + 4) / 2.
// 양끝(w · e)은 origin 대로 글자 칸 양옆에 두고, 가운데(c)는 두 조각이 실제로 그려진 사이만 메운다 — origin 이 조각 폭과 몇 px
// 어긋난 디자인도 겹치거나(진한 줄) 비지(빈 틈) 않는다.
async function nameTag (ui: ChatUi, name: string): Promise<Bitmap> {
  const A = await loadImage(ui.atlas, true), P = ui.parts
  const t = textBitmap(name, ui.clr)
  const T = TAG_TEXT
  const pieces: Piece[] = []
  const ani = Object.keys(P).filter((k) => /^ani\d+$/.test(k)).sort((a, b) => +a.slice(3) - +b.slice(3))
  if (ani.length) {
    // 이름이 들어가는 가장 작은 층(없으면 가장 넓은 층). origin = 글자 칸 가운데 위.
    const i = (ui.aniFit ?? []).findIndex((f) => t.adv <= f)
    pieces.push(at(P[ani[i < 0 ? ani.length - 1 : i]], 0, T))
  } else {
    // 글자 칸 = 이름 폭. 이름이 아주 짧아도 양끝 조각이 안쪽으로 들어온 만큼은 남겨 서로 겹치지 않게.
    const inner = Math.max(t.adv, P.w.w - P.w.origin.x + P.e.origin.x)
    const L = -Math.floor((t.adv + 4) / 2), R = L + inner
    const w = at(P.w, L, T), e = at(P.e, R, T)
    hfill(pieces, P.c, right(w), e.x, T - P.c.origin.y)
    pieces.push(w, e)
  }
  // 글자: 글자 칸 왼끝부터 돋움의 펜 위치대로, 세로는 글자 칸의 기준선에 — 띠가 아니라 글자 칸을 기준으로 놓는다.
  const tl = ani.length ? -Math.floor(t.adv / 2) : -Math.floor((t.adv + 4) / 2)
  return compose(A, pieces, (g, x0, y0) => g.drawImage(t.c, tl + t.left - x0, T + t.top - y0))
}

// 말풍선. 기준점(0,0) = 발끝. 안쪽 칸 높이 = 옆 띠 조각 높이의 배수.
// 안쪽 칸 폭: 글이면 가장 긴 줄 / 조각 + 2 칸, 이모티콘이면 그 크기가 들어가는 칸 수(꼬리 양옆에 띠가 한 칸씩은 남게).
// 위 장식이 있으면 [띠 k 개][장식][띠 k 개]로 잡는다.
// 네 모서리는 origin 대로 안쪽 칸 모서리에 둔다. 띠는 이웃한 두 모서리가 실제로 그려진 사이를, 안쪽은 네 띠가 그려진 사이를 메운다 —
// origin 이 조각 크기와 어긋난 디자인(안쪽으로 들어온 모서리, 1px 어긋난 띠, 안쪽 조각 origin 7 등)도 겹치거나 비지 않는다.
async function balloon (ui: ChatUi, text: string, emo?: ChatEmo): Promise<Bitmap> {
  const A = await loadImage(ui.atlas, true), P = ui.parts
  const anim = emo?.frames?.length && emo.strip ? emo.frames : null
  const E = emo ? await loadImage(anim ? emo.strip! : emo.png, true) : null
  const lines = E ? [] : wrapLines(text).map((l) => textBitmap(l, ui.clr))
  const xt = P.n.w, yt = P.w.h
  // 움직이는 이모티콘: 모든 프레임을 origin 에 맞춰 겹친 상자(origin 왼쪽 · 오른쪽 · 위 · 아래로 가장 먼 것)
  const box = anim ? { l: Math.max(...anim.map((f) => f.ox)), r: Math.max(...anim.map((f) => f.w - f.ox)), t: Math.max(...anim.map((f) => f.oy)), b: Math.max(...anim.map((f) => f.h - f.oy)) } : null
  const contentW = box ? box.l + box.r : E ? E.width : Math.max(0, ...lines.map((l) => l.adv))
  const contentH = box ? box.t + box.b : E ? E.height : lines.length * LINE + (lines.length - 1) * GAP
  const need = Math.max((E ? Math.ceil(contentW / xt) : Math.floor(contentW / xt) + 2) * xt, P.arrow ? P.arrow.w + 2 * P.s.w : 0)
  const hw = P.head?.w ?? 0
  const k = P.head ? Math.max(1, Math.ceil((need - hw) / (2 * xt))) : 0
  const W = P.head ? 2 * k * xt + hw : Math.max(2, Math.ceil(need / xt)) * xt
  // 높이: 위 · 아래 띠(와 모서리)가 안쪽으로 들어오는 만큼은 늘 남긴다 — 위 띠가 안쪽 깊이 내려오는 옛 디자인(황금의 파리)이
  // 한 줄짜리 낮은 말풍선에서 아래 띠와 겹치지 않게.
  const intr = Math.max(...[P.n, P.nw, P.ne].map((q) => q.h - q.origin.y)) + Math.max(...[P.s, P.sw, P.se].map((q) => q.origin.y))
  const H = Math.max(Math.max(1, Math.ceil(contentH / yt)), Math.ceil(intr / yt)) * yt
  const L = -Math.floor(W / 2), R = L + W, B = 0, T = -H
  const nw = at(P.nw, L, T), ne = at(P.ne, R, T), sw = at(P.sw, L, B), se = at(P.se, R, B)
  const ny = T - P.n.origin.y, sy = B - P.s.origin.y
  const wx = L - P.w.origin.x, ex = R - P.e.origin.x
  const pieces: Piece[] = []
  // 안쪽: 옆 띠 사이 × 위 · 아래 띠 사이. 모서리가 안쪽으로 들어온 줄에서는 그 모서리 옆부터 메운다(줄을 모서리 높이에서 끊는다).
  const cx0 = wx + P.w.w, cx1 = ex, cy0 = ny + P.n.h, cy1 = sy
  const cuts = [...new Set([cy0, cy1, ...[bottom(nw), bottom(ne), sw.y, se.y].filter((v) => v > cy0 && v < cy1)])].sort((a, b) => a - b)
  for (let i = 0; i + 1 < cuts.length; i++) {
    const ya = cuts[i], yb = cuts[i + 1]
    const xa = Math.max(cx0, ya < bottom(nw) ? right(nw) : -Infinity, ya >= sw.y ? right(sw) : -Infinity)
    const xb = Math.min(cx1, ya < bottom(ne) ? ne.x : Infinity, ya >= se.y ? se.x : Infinity)
    for (let y = ya; y < yb;) { const off = (y - cy0) % P.c.h, h = Math.min(P.c.h - off, yb - y); hfill(pieces, P.c, xa, xb, y, 'start', h, off); y += h }
  }
  // 위 띠 — 장식이 띠 한 칸을 대신한다
  if (P.head) { const hl = L + k * xt; hfill(pieces, P.n, right(nw), hl, ny, 'end'); pieces.push({ p: P.head, x: hl, y: T - P.head.origin.y }); hfill(pieces, P.n, hl + hw, ne.x, ny) }
  else hfill(pieces, P.n, right(nw), ne.x, ny)
  // 아래 띠 — 꼬리를 가운데에 두고 그 자리를 비워 양옆을 잇는다
  let tip = sy + P.s.h
  if (P.arrow) {
    const al = L + Math.floor((W - P.arrow.w) / 2) // 꼬리 그림을 말풍선 가운데에
    hfill(pieces, P.s, right(sw), al, sy, 'end'); pieces.push({ p: P.arrow, x: al, y: B - P.arrow.origin.y }); hfill(pieces, P.s, al + P.arrow.w, se.x, sy)
    tip = B - P.arrow.origin.y + P.arrow.h
  }
  // 옆 띠
  vfill(pieces, P.w, wx, bottom(nw), sw.y)
  vfill(pieces, P.e, ex, bottom(ne), se.y)
  pieces.push(nw, ne, sw, se)
  let emoAt: { x: number; y: number } | null = null
  const bm = compose(A, pieces, (g, x0, y0) => {
    if (box) emoAt = { x: Math.round(-contentW / 2) + box.l - x0, y: Math.round(T + (H - contentH) / 2) + box.t - y0 } // 프레임은 그릴 때 덧그린다
    else if (E) g.drawImage(E, Math.round(-E.width / 2) - x0, Math.round(T + (H - E.height) / 2) - y0)
    else {
      // 줄마다 가운데 정렬, 줄 묶음은 안쪽 칸 세로 가운데. 줄 간격은 기준선 기준(LINE + GAP)이다.
      const top = Math.round(T + (H - contentH) / 2)
      lines.forEach((l, i) => g.drawImage(l.c, Math.round(-l.c.width / 2) - x0, top + i * (LINE + GAP) + l.top - y0))
    }
  })
  // 꼬리 그림 아래 끝(tip)이 발끝 위 BALLOON_TIP 에 오게 옮긴다. 안쪽 칸 가운데 = 기준점.
  const oo = ui.originOffset ?? { x: 0, y: 0 }
  return { c: bm.c, ox: bm.ox + oo.x, oy: bm.oy - tip - BALLOON_TIP + oo.y, ...(anim && E && emoAt ? { emo: { img: E, frames: anim, ...(emoAt as { x: number; y: number }) } } : {}) }
}

const key = (ui: ChatUi, s: string, emo?: ChatEmo) => `${ui.kind}|${ui.atlas}|${emo ? 'emo:' + emo.id : s}`
function bitmapOf (ui: ChatUi, s: string, keep: boolean, emo?: ChatEmo): Promise<Bitmap | null> {
  const k = key(ui, s, emo)
  let p = cache.get(k)
  if (p) { cache.delete(k); cache.set(k, p); return p } // 최근에 쓴 것으로 올린다
  p = (ui.kind === 'nameTag' ? nameTag(ui, s) : balloon(ui, s, emo)).catch(() => null)
  p.then((b) => { if (!b || !keep) cache.delete(k) })
  cache.set(k, p)
  if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value!)
  return p
}

// 명찰 · 말풍선을 하나씩 따로 만든다(목록 카드가 쓴다 — 몸 없이 그 아이템만). 기준점 정보(ox, oy)는 버리고 그림만(카드에는 이모티콘이 없다).
export async function chatPreview (ui: ChatUi, d: Pick<ChatDraw, 'name' | 'text' | 'emo'>): Promise<HTMLCanvasElement | null> {
  const keep = await loadGlyphs([d.name, d.text, ' : '])
  const b = await bitmapOf(ui, ui.kind === 'nameTag' ? d.name : `${d.name} : ${d.text}`, keep, ui.kind === 'nameTag' ? undefined : d.emo)
  return b?.c ?? null
}

// 채팅 칸에 적는 동안 보낼 말풍선을 미리 만든다 — 글자 도트 묶음을 받고 그림까지 캐시에 넣어 두어, 전송하면 그리기만 한다.
// 드문 글자(돋움의 KS 밖 · 한자 · 가나)는 묶음을 처음 받을 때 수십~수백 ms 가 걸리는데 그 시간이 적는 동안에 지나간다.
export function warmChat (ui: ChatUi, name: string, text: string): void {
  void loadGlyphs([name, text, ' : ']).then((keep) => bitmapOf(ui, `${name} : ${text}`, keep)).catch(() => {})
}

// 그릴 그림들을 미리 만든다(캐시). 그리기는 동기로 한다 — renderCharacter 가 그림을 다 받은 뒤 부른다.
export async function prepareChat (d: ChatDraw | undefined): Promise<Bitmap[]> {
  if (!d) return []
  // 글자 도트를 먼저 받는다(이미 받았으면 바로 끝난다) — 받기 전에 그리지 않는다. 받지 못했으면 그린 그림을 기억하지 않아 다음에 다시 그린다.
  const keep = await loadGlyphs([d.name, d.text, ' : '])
  const out = await Promise.all([d.balloon ? bitmapOf(d.balloon, `${d.name} : ${d.text}`, keep, d.emo) : null, d.tag ? bitmapOf(d.tag, d.name, keep) : null])
  return out.filter((b): b is Bitmap => !!b)
}

// 캐릭터 위에 덧그린다. 시선이 오른쪽(flip)이어도 글자는 뒤집지 않고 자리만 옮긴다. 기준점 = 딛고 선 바닥(탈것이면 탈것의 바닥).
// t = 보낸 뒤 흐른 시간(ms) — 움직이는 이모티콘의 프레임을 고른다. 없으면 대표 프레임(복사 그림 등).
export function drawChat (ctx: CanvasRenderingContext2D, maps: Bitmap[], placed: PlacedLayer[], o: { anchorX: number; anchorY: number; scale: number; flip?: boolean; width: number; t?: number; main?: number }) {
  if (!maps.length) return
  const g = groundOf(placed)
  if (!g) return
  const fx = (o.anchorX + g.x) * o.scale
  const cx = o.flip ? o.width - fx : fx
  const cy = (o.anchorY + g.y) * o.scale
  ctx.imageSmoothingEnabled = false
  for (const b of maps) {
    const bx = Math.round(cx + b.ox * o.scale), by = Math.round(cy + b.oy * o.scale)
    ctx.drawImage(b.c, bx, by, b.c.width * o.scale, b.c.height * o.scale)
    if (b.emo) {
      const f = b.emo.frames[emoFrameAt({ frames: b.emo.frames, main: o.main } as ChatEmo, o.t)]
      ctx.drawImage(b.emo.img, f.x, 0, f.w, f.h, bx + (b.emo.x - f.ox) * o.scale, by + (b.emo.y - f.oy) * o.scale, f.w * o.scale, f.h * o.scale)
    }
  }
}
