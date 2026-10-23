// 명찰 · 말풍선(반지의 info.nameTag · info.chatBalloon → UI.wz 의 NameTag.img · ChatBalloon.img 조각).
// (데이터는 public/chatui — shopData 의 CHAT_CATS).
// 조각은 반지마다 그림 한 장(아틀라스)에 모아 두고 잘라 쓴다 — 반지 하나를 그리는 데 요청이 한 번이다.
//
// 조각은 모두 반투명(알파 204 안팎)이라 **어느 두 조각도 겹치면 안 된다**(겹친 자리만 진해진다). 조각 배치는 원본 origin 그대로다.
//  명찰: origin = **글자 칸**(높이 12)의 모서리 · 가운데 위 기준. 띠는 글자 칸에 origin 대로 붙이고, 다 그린 그림을 발끝 아래 TAG_TOP 에 둔다(아래 '쌓기').
//        글자 칸 폭 = 이름 폭 그대로, 왼끝 = 기준점에서 (이름 폭 + 4) / 2 왼쪽 — 게임 화면과 점 단위로 맞춘 값이다(게임도 명찰이 2px 왼쪽).
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
//  훈장 · 칭호: 명찰과 같은 조각(NameTag.img/medal · nick — w · c · e, 움직이는 훈장은 ani0 …)이라 명찰 그리기를 그대로 쓴다. 글자 = 그 아이템 이름.
//        글자가 박힌 움직이는 판(ani 프레임만 있는 것)은 글자를 얹지 않는다(baked).
//  움직이는 판(움직이는 명찰 · 훈장 · 칭호의 판 · 틀 — 137벌): **캐릭터 동작과 상관없는 제 시계로 늘 재생한다**(사용자 지시 — 기본 상태는 캐릭터 · 무기가
//        가만히 있고 이펙트 · 망토 · 명찰 · 칭호 · 훈장의 고유 애니메이션은 돈다). 첫 프레임은 아틀라스에, 나머지는 animAtlas 한 장에 따로 있다(프레임까지
//        한 장이면 최대 820KB 라 목록 카드 · 첫 그림이 늦다). 처음에는 첫 프레임으로 그리고, 미리보기가 그릴 때 animAtlas 를 받아 프레임마다 판을
//        한 장씩 만들어 둔다(움직이는 판 = 바뀌는 조각 하나 — 나머지 조각은 그대로). 그릴 때 clock(ms)의 프레임을 고른다. clock 이 없으면(복사 그림 ·
//        코디 프로필) 첫 프레임. 목록 카드(chatPreview)는 첫 프레임만 그린다.
//        틀(fx — 판 위에 덧붙는 장식, 가운데가 띠 한 장 폭만큼 뚫렸다)이 있는 칭호는 띠를 제 폭으로 깔고 틀을 씌운다. 가장 넓은 층에도 이름이
//        들어가지 않는 훈장은 판 가운데 세로줄을 이어 늘린다. 글자가 박힌 판은 캐릭터 가운데에 둔다(원본 기준점이 치우친 것이 많다).
//  쌓기(게임 1배 캡처 13장을 조각 대조로 재어 맞췄다 — 글자 칸이 아니라 **다 그린 그림의 모서리**로 놓인다):
//        명찰 그림 위 = 발끝 아래 TAG_TOP(반지마다 띠가 글자 칸 위로 올라오는 만큼이 달라도 그림 위가 같은 줄 — 글자 줄은 반지마다 오르내린다),
//        훈장 그림 위 = 명찰 그림 아래 + MEDAL_GAP(명찰이 없으면 기본 명찰 자리 아래 — 훈장마다 글자 줄이 다른 것은 판 모양 탓이다),
//        칭호 그림 아래 = 발끝 위 TITLE_BOTTOM. 칭호 · 훈장은 그림 가운데를 고정된 가로 자리 TAG_MID 에 둔다 — 명찰 생김새 · 유무와 상관없이 x 가 움직이지 않는다(사용자 지시.
//        명찰 그림 가운데에 맞추면 명찰마다 양끝 조각 폭이 달라 흔들렸다). y 는 칭호 = 발끝 기준 고정, 훈장 = 명찰 그림 아래 끝을 따른다.
//        길드 이름 줄은 그리지 않는다(서비스가 길드를 다루지 않는다 — 게임에서는 명찰과 훈장 사이에 같은 규칙으로 한 줄 낀다).
//        말풍선은 제자리에서 칭호를 덮는다(게임과 같다 — 사용자 캡처).
// 글자는 돋움 12px 비트맵의 도트를 그대로 찍는다(core/chatGlyphs — 브라우저가 글꼴을 그리지 않아 어느 기기에서나 게임과 같다).
// 글자 폭(advance) · 왼쪽 여백 · 기준선 높이도 돋움 값 그대로다. 색은 원본 clr. 돋움에 없는 글자만 사이트 글꼴로 그려 알파를 끊는다.
// 원본에 있지만 아직 쓰지 않는 값: 움직이는 명찰의 heightoffset · bottomoffset(뜻을 확인하지 못했다), fontType(명찰 · 말풍선 각 1개).
import { footOf, groundOf, type PlacedLayer } from './assemble'
import { glyphOf, loadGlyphs } from './chatGlyphs'
import type { Vec } from './data'
import { imageLoaded, loadImage } from './render'

export interface ChatPart { x: number; y: number; w: number; h: number; origin: Vec } // 아틀라스 안의 자리
export interface ChatUi {
  kind: 'nameTag' | 'chatBalloon' | 'medal' | 'nick'; clr: string; atlas: string; parts: Record<string, ChatPart>
  originOffset?: Vec; heightoffset?: number; bottomoffset?: number; fontType?: number
  aniFit?: number[] // 움직이는 명찰: 층(ani0, ani1, …)마다 이름이 들어가는 폭(px) — 추출 때 그림의 안쪽 폭을 재어 적는다
  plain?: boolean // 기본 명찰(BASE_TAG) — 조각 그림 없이 반투명 검은 판을 그린다
  baked?: boolean // 훈장 · 칭호: 판 그림에 이름 글자가 박혀 있다(움직이는 판의 첫 프레임) — 글자를 얹지 않는다
  anim?: Record<string, number[]> // 움직이는 조각 → 프레임마다 머무는 시간(ms). 프레임 i(1부터)의 조각 = animParts['<키>#i']
  animAtlas?: string; animParts?: Record<string, ChatPart>
  arrowPad?: number // 말풍선 꼬리의 왼쪽 빈 열 수(origin.x 만큼 띠 위에 걸치는 자리 중 띠 높이에서 투명한 열) — 띠를 그만큼 꼬리 밑으로 늘린다
}
// 이모티콘 프레임: 가로로 이은 그림(strip) 안의 자리 x · 크기 · origin(ox, oy) · 머무는 시간(d, ms)
export interface EmoFrame { x: number; w: number; h: number; ox: number; oy: number; d: number }
// png = 대표 그림(mainImg — 고르기 칸 · 정지 그림). 움직이는 것은 strip · frames 가 있다.
export interface ChatEmo { id: string; name: string; png: string; w: number; h: number; origin: Vec; main?: number; strip?: string; frames?: EmoFrame[]; still?: boolean } // still = 움직이는 그림이 오기 전 대표 프레임(png)으로 그린다(prepareChat)
// 그릴 것: 명찰 · 말풍선 · 칭호 · 훈장(없으면 그리지 않는다)과 글자 · 이모티콘. 칭호 · 훈장의 글자는 그 아이템 이름(name).
export type ChatLabel = { ui: ChatUi; name: string }
export interface ChatDraw { tag?: ChatUi; balloon?: ChatUi; title?: ChatLabel; medal?: ChatLabel; name: string; text: string; emo?: ChatEmo; t0?: number } // t0 = 보낸 시각(performance.now) — 움직이는 이모티콘의 시계

const LINE = 12            // 글자 한 줄 높이(돋움 12px — 기준선 위 10, 아래 2)
const GAP = 2              // 줄 사이
const WRAP = 108           // 말풍선 한 줄의 최대 폭(px, 한글 9자) — 넘으면 다음 줄로. 원본에 없는 값이라 게임 화면으로 맞췄다:
                           // 게임에서 '강도시로코쨩 : 테스트'(122px)는 '강도시로코쨩 :' 뒤에서 줄이 바뀐다(사용자 지시 — 144 는 길었다)
const BASE = 12            // 글자 그림 안의 기준선(위 여백 2 — 기준선 위로 10보다 높은 글자가 있어도 잘리지 않게)
// 발끝에서의 두 거리는 원본에 없어 게임 화면(꿈나라 달링 · 벼링 명찰 · 말풍선, 1배 캡처)을 픽셀로 재어 맞췄다.
const TAG_TEXT = 8         // 명찰을 만들 때 글자 칸 위(띠 origin y 6 인 명찰 기준) — 다 만든 그림은 prepareChat 이 TAG_TOP 으로 옮긴다
const TAG_TOP = 2          // 발끝 아래 명찰 그림 위까지(기본 명찰 판 · 반지 명찰 모두)
const BALLOON_TIP = 76     // 발끝 위 말풍선 꼬리 그림 아래 끝까지(두 반지 모두 이 줄 — 몸통은 꼬리 길이만큼 오르내린다)
const TITLE_BOTTOM = 83    // 발끝 위 칭호 그림 아래 끝까지(칭호 5종 · 캐릭터 3명에서 같은 줄)
const MEDAL_GAP = 1        // 명찰 그림 아래 끝과 훈장 그림 위 사이(게임에서 명찰 → 길드 → 훈장이 모두 이 간격)
const TAG_MID = -1         // 칭호 · 훈장 그림 가운데의 가로 자리(기준점에서) — 기본 명찰 판의 가운데(게임도 명찰이 기준점보다 1~2px 왼쪽)

// ox, oy = 기준점(발끝)에서 그림 왼쪽 위까지. emo = 덧그릴 움직이는 이모티콘(x, y = 그림 왼쪽 위에서 프레임 origin 이 닿는 점)
// live = 움직이는 판: 프레임마다의 판(dx, dy = 첫 프레임 그림에서 그 프레임 그림 왼쪽 위까지)과 머무는 시간. 쌓기가 자리를 옮긴 사본도 같은 live 를 본다(받기가 끝나면 채워진다)
type AnimFrame = { c: HTMLCanvasElement; dx: number; dy: number }
type Live = { frames?: AnimFrame[]; d: number[]; load: () => Promise<void> }
type Bitmap = { c: HTMLCanvasElement; ox: number; oy: number; up?: boolean; emo?: { img: HTMLImageElement; frames: EmoFrame[]; x: number; y: number }; live?: Live }

// 머무는 시간을 더해 가며 t 에 보일 프레임 번호(끝나면 처음부터)
const cycleAt = (d: number[], t: number) => {
  const total = d.reduce((s, x) => s + Math.max(1, x), 0)
  let r = ((t % total) + total) % total
  for (let i = 0; i < d.length; i++) { r -= Math.max(1, d[i]); if (r < 0) return i }
  return d.length - 1
}
const animsOf = (d: ChatDraw | undefined) => (d ? [d.tag, d.title?.ui, d.medal?.ui].filter((u): u is ChatUi => !!u?.anim) : [])
// 움직이는 판이 있는가(미리보기가 캐릭터가 멈춰 있어도 프레임마다 그린다) · t 에 보일 프레임 번호들(같으면 다시 합성하지 않는다) · 한 바퀴 길이들(움짤)
export const chatAnimated = (d: ChatDraw | undefined) => animsOf(d).length > 0
export const chatAnimSig = (d: ChatDraw | undefined, t: number) => animsOf(d).map((u) => Object.values(u.anim!).map((x) => cycleAt(x, t)).join(',')).join(';')
export const chatAnimPeriods = (d: ChatDraw | undefined) => animsOf(d).flatMap((u) => Object.values(u.anim!).map((x) => x.reduce((s, v) => s + Math.max(1, v), 0)))

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
type Piece = { p: ChatPart; x: number; y: number; sx?: number; sy?: number; w?: number; h?: number; img?: HTMLImageElement } // img = 다른 그림(움직이는 판의 프레임 — animAtlas)
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
  for (const q of live) { const w = q.w ?? q.p.w, h = q.h ?? q.p.h; g.drawImage(q.img ?? A, q.p.x + (q.sx ?? 0), q.p.y + (q.sy ?? 0), w, h, q.x - x0, q.y - y0, w, h) }
  extra(g, x0, y0)
  return { c, ox: x0, oy: y0 }
}

// 기본 명찰 — 명찰 반지를 끼지 않았을 때의 게임 명찰. 원본에 그림이 없다(클라이언트가 직접 그린다) — 게임 화면을 점 단위로 재어 맞췄다:
// 판 = 이름 폭 + 5(펜 시작 2칸 왼쪽부터) × 16(글자 줄 12 의 위 2, 아래 2), 위 끝이 발끝 2칸 아래, 네 모서리 1칸씩 깎음, 검정 55% 불투명. 글자는 흰색, 글자 줄의 위 = 판 위 + 2.
export const BASE_TAG: ChatUi = { kind: 'nameTag', clr: '#ffffff', atlas: 'base', parts: {}, plain: true }
const BASE_TAG_H = 16, BASE_TAG_ALPHA = 0.55
function plainTag (name: string): Bitmap {
  const t = textBitmap(name, BASE_TAG.clr)
  const pen = -Math.floor((t.adv + 4) / 2), x = pen - 2, w = t.adv + 5, h = BASE_TAG_H
  const c = canvasOf(w, h), g = c.getContext('2d')!
  g.fillStyle = `rgba(0,0,0,${BASE_TAG_ALPHA})`
  g.fillRect(1, 0, w - 2, 1); g.fillRect(0, 1, w, h - 2); g.fillRect(1, h - 1, w - 2, 1)
  g.drawImage(t.c, pen + t.left - x, 2 + t.top)
  return { c, ox: x, oy: TAG_TOP }
}

// 명찰. 기준점(0,0) = 발끝. 글자 칸(높이 12)의 위 = TAG_TEXT, 글자 칸의 왼끝 = -(이름 폭 + 4) / 2.
// 양끝(w · e)은 origin 대로 글자 칸 양옆에 두고, 가운데(c)는 두 조각이 실제로 그려진 사이만 메운다 — origin 이 조각 폭과 몇 px
// 어긋난 디자인도 겹치거나(진한 줄) 비지(빈 틈) 않는다.
async function nameTag (ui: ChatUi, name: string): Promise<Bitmap> {
  if (ui.plain) return plainTag(name)
  const A = await loadImage(ui.atlas, true), P = ui.parts
  const t = textBitmap(name, ui.clr)
  const T = TAG_TEXT
  const pieces: Piece[] = []
  const ani = Object.keys(P).filter((k) => /^ani\d+$/.test(k)).sort((a, b) => +a.slice(3) - +b.slice(3))
  let tl = -Math.floor((t.adv + 4) / 2) // 글자 칸 왼끝(펜 시작)
  let moving: string | undefined // 움직이는 조각(이 판에서 프레임마다 바뀌는 것)
  if (ani.length && ui.baked) {
    moving = ani[0]
    // 글자가 박힌 움직이는 판(훈장 · 칭호): 판 한 장을 캐릭터 가운데에 — 원본 기준점은 한쪽으로 치우친 것이 많다(사용자 지적: 칭호가 옆으로 비켜 섰다)
    const p = P[ani[0]]
    pieces.push({ p, x: -Math.floor(p.w / 2), y: T - p.origin.y })
  } else if (ani.length) {
    // 이름이 들어가는 가장 작은 층(없으면 가장 넓은 층). origin = 글자 칸 가운데 위.
    const fits = ui.aniFit ?? []
    const i = fits.findIndex((f) => t.adv <= f), li = i < 0 ? ani.length - 1 : i
    const p = P[ani[li]], extra = ui.kind !== 'nameTag' && i < 0 && fits[li] ? t.adv - fits[li] + 6 : 0
    moving = ani[li]
    if (extra > 0) {
      // 가장 넓은 층에도 이름이 들어가지 않는 훈장: 판 가운데(기준점의 세로줄)를 이어 늘린다(사용자 지적: 글자가 판 밖으로 잘렸다)
      const ox = p.origin.x, x0 = -ox - Math.floor(extra / 2), y = T - p.origin.y
      pieces.push({ p, x: x0, y, w: ox })
      for (let k = 0; k < extra; k++) pieces.push({ p, x: x0 + ox + k, y, sx: ox, w: 1 })
      pieces.push({ p, x: x0 + ox + extra, y, sx: ox, w: p.w - ox })
    } else pieces.push(at(p, 0, T))
    tl = -Math.floor(t.adv / 2)
  } else if (P.fx) {
    // 틀(fx)이 있는 칭호(SWEET WISH 등): 틀은 가운데 띠(c) 한 장 폭만큼 뚫린 그림이다 — 띠는 이름 폭이 아니라 제 폭(이름이 더 길면 그만큼)으로 깔고,
    // 틀의 origin 을 띠 왼끝에 맞춘다. 이름은 띠 가운데
    const inner = Math.max(t.adv, P.c.w), L = -Math.floor(inner / 2)
    hfill(pieces, P.c, L, L + inner, T - P.c.origin.y)
    pieces.push(at(P.fx, L, T))
    moving = 'fx'
    tl = L + Math.floor((inner - t.adv) / 2)
  } else {
    // 글자 칸 = 이름 폭. 이름이 아주 짧아도 양끝 조각이 안쪽으로 들어온 만큼은 남겨 서로 겹치지 않게.
    const inner = Math.max(t.adv, P.w.w - P.w.origin.x + P.e.origin.x)
    const L = -Math.floor((t.adv + 4) / 2), R = L + inner
    const w = at(P.w, L, T), e = at(P.e, R, T)
    hfill(pieces, P.c, right(w), e.x, T - P.c.origin.y)
    pieces.push(w, e)
  }
  // 글자: 글자 칸 왼끝부터 돋움의 펜 위치대로, 세로는 글자 칸의 기준선에 — 띠가 아니라 글자 칸을 기준으로 놓는다.
  const text = (g: CanvasRenderingContext2D, x0: number, y0: number) => { if (!ui.baked) g.drawImage(t.c, tl + t.left - x0, T + t.top - y0) }
  const bm = compose(A, pieces, text)
  const d = moving ? ui.anim?.[moving] : undefined
  if (!d || !moving || !ui.animAtlas || !ui.animParts) return bm
  // 움직이는 판: 바뀌는 조각만 그 프레임의 조각으로 바꿔(같은 자리 — origin 차이만큼 옮긴다) 프레임마다 한 장씩. animAtlas 는 load() 때 받는다
  const base = P[moving], key = moving, AP = ui.animParts, src = ui.animAtlas
  const live: Live = { d, load: () => {
    const p = loadImage(src, true).then((B) => {
      live.frames = d.map((_, i) => {
        const f = i ? AP[`${key}#${i}`] : undefined
        if (!f) return { c: bm.c, dx: 0, dy: 0 }
        const fb = compose(A, pieces.map((q) => (q.p === base ? { ...q, p: f, img: B, x: q.x + base.origin.x - f.origin.x, y: q.y + base.origin.y - f.origin.y } : q)), text)
        return { c: fb.c, dx: fb.ox - bm.ox, dy: fb.oy - bm.oy }
      })
    })
    p.catch(() => { live.load = once }) // 받지 못하면 다음 그리기에서 다시 받는다
    live.load = () => p
    return p
  } }
  const once = live.load
  return { ...bm, live }
}

// 말풍선. 기준점(0,0) = 발끝. 안쪽 칸 높이 = 옆 띠 조각 높이의 배수.
// 안쪽 칸 폭: 글이면 가장 긴 줄 / 조각 + 2 칸, 이모티콘이면 그 크기가 들어가는 칸 수(꼬리 양옆에 띠가 한 칸씩은 남게).
// 위 장식이 있으면 [띠 k 개][장식][띠 k 개]로 잡는다.
// 네 모서리는 origin 대로 안쪽 칸 모서리에 둔다. 띠는 이웃한 두 모서리가 실제로 그려진 사이를, 안쪽은 네 띠가 그려진 사이를 메운다 —
// origin 이 조각 크기와 어긋난 디자인(안쪽으로 들어온 모서리, 1px 어긋난 띠, 안쪽 조각 origin 7 등)도 겹치거나 비지 않는다.
async function balloon (ui: ChatUi, text: string, emo?: ChatEmo): Promise<Bitmap> {
  const A = await loadImage(ui.atlas, true), P = ui.parts
  const anim = emo?.frames?.length && emo.strip ? emo.frames : null
  // still: 움직이는 그림(strip)이 아직 없다 — 크기는 움직이는 그림의 상자로 잡고(말풍선 크기가 그대로), 대표 프레임(png, 크기 · 기준점이 같다 — 111종 대조)을 박아 둔다
  const still = !!(anim && emo!.still)
  const E = emo ? await loadImage(anim && !still ? emo.strip! : emo.png, true) : null
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
    // 꼬리 왼쪽의 빈 열(arrowPad)은 띠가 메운다 — 비워 두면 1~2px 세로 틈으로 바탕이 비친다(게임의 기본 말풍선과 대조 — 사용자 지적)
    hfill(pieces, P.s, right(sw), al + (ui.arrowPad ?? 0), sy, 'end'); pieces.push({ p: P.arrow, x: al, y: B - P.arrow.origin.y }); hfill(pieces, P.s, al + P.arrow.w, se.x, sy)
    tip = B - P.arrow.origin.y + P.arrow.h
  }
  // 옆 띠
  vfill(pieces, P.w, wx, bottom(nw), sw.y)
  vfill(pieces, P.e, ex, bottom(ne), se.y)
  pieces.push(nw, ne, sw, se)
  let emoAt: { x: number; y: number } | null = null
  const bm = compose(A, pieces, (g, x0, y0) => {
    if (box && still && E) { const o = emo!.origin; g.drawImage(E, Math.round(-contentW / 2) + box.l - o.x - x0, Math.round(T + (H - contentH) / 2) + box.t - o.y - y0) }
    else if (box) emoAt = { x: Math.round(-contentW / 2) + box.l - x0, y: Math.round(T + (H - contentH) / 2) + box.t - y0 } // 프레임은 그릴 때 덧그린다
    else if (E) g.drawImage(E, Math.round(-E.width / 2) - x0, Math.round(T + (H - E.height) / 2) - y0)
    else {
      // 줄마다 가운데 정렬, 줄 묶음은 안쪽 칸 세로 가운데. 줄 간격은 기준선 기준(LINE + GAP)이다.
      const top = Math.round(T + (H - contentH) / 2)
      lines.forEach((l, i) => g.drawImage(l.c, Math.round(-l.c.width / 2) - x0, top + i * (LINE + GAP) + l.top - y0))
    }
  })
  // 꼬리 그림 아래 끝(tip)이 발끝 위 BALLOON_TIP 에 오게 옮긴다. 안쪽 칸 가운데 = 기준점.
  const oo = ui.originOffset ?? { x: 0, y: 0 }
  return { c: bm.c, ox: bm.ox + oo.x, oy: bm.oy - tip - BALLOON_TIP + oo.y, ...(anim && !still && E && emoAt ? { emo: { img: E, frames: anim, ...(emoAt as { x: number; y: number }) } } : {}) }
}

const key = (ui: ChatUi, s: string, emo?: ChatEmo) => `${ui.kind}|${ui.atlas}|${emo ? 'emo:' + emo.id + (emo.still ? ':still' : '') : s}`
function bitmapOf (ui: ChatUi, s: string, keep: boolean, emo?: ChatEmo): Promise<Bitmap | null> {
  const k = key(ui, s, emo)
  let p = cache.get(k)
  if (p) { cache.delete(k); cache.set(k, p); return p } // 최근에 쓴 것으로 올린다
  p = (ui.kind === 'chatBalloon' ? balloon(ui, s, emo) : nameTag(ui, s)).catch(() => null)
  p.then((b) => { if (!b || !keep) cache.delete(k) })
  cache.set(k, p)
  if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value!)
  return p
}

// 명찰 · 말풍선을 하나씩 따로 만든다(목록 카드가 쓴다 — 몸 없이 그 아이템만). 기준점 정보(ox, oy)는 버리고 그림만(카드에는 이모티콘이 없다).
// 칭호 · 훈장은 name 에 그 아이템 이름을 준다.
export async function chatPreview (ui: ChatUi, d: Pick<ChatDraw, 'name' | 'text' | 'emo'>): Promise<HTMLCanvasElement | null> {
  const keep = await loadGlyphs([d.name, d.text, ' : '])
  const bub = ui.kind === 'chatBalloon'
  const b = await bitmapOf(ui, bub ? `${d.name} : ${d.text}` : d.name, keep, bub ? d.emo : undefined)
  return b?.c ?? null
}

// 채팅 칸에 적는 동안 보낼 말풍선을 미리 만든다 — 글자 도트 묶음을 받고 그림까지 캐시에 넣어 두어, 전송하면 그리기만 한다.
// 드문 글자(돋움의 KS 밖 · 한자 · 가나)는 묶음을 처음 받을 때 수십~수백 ms 가 걸리는데 그 시간이 적는 동안에 지나간다.
export function warmChat (ui: ChatUi, name: string, text: string): void {
  void loadGlyphs([name, text, ' : ']).then((keep) => bitmapOf(ui, `${name} : ${text}`, keep)).catch(() => {})
}

// 말풍선 · 명찰 틀 그림을 미리 받는다(채팅 칸이 나올 때 — ChatBar). 처음 보내는 말풍선이 틀을 그때 받느라 0.1~0.4초 늦었다(실측). 한 장이고 작다
// 첫 화면의 받기와 다투지 않게 한가할 때 받는다
export function warmChatUi (ui: ChatUi | null | undefined): void {
  if (!ui) return
  const go = () => { void loadImage(ui.atlas, true).catch(() => {}) }
  const ric = (window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback
  if (ric) ric(go, { timeout: 3000 }); else window.setTimeout(go, 600)
}

// 움직이는 이모티콘의 그림(strip)을 미리 받는다 — 고르기 창에서 마우스를 올리거나 누를 때, 보고 있는 묶음을 한가할 때(ChatEmoPicker).
// 받은 그림은 render 의 그림 캐시에 남아 다시 보내도 바로 뜬다
export function warmEmo (emo: ChatEmo): Promise<unknown> {
  return emo.strip && emo.frames?.length ? loadImage(emo.strip, true).catch(() => {}) : Promise.resolve()
}

// 그릴 그림들을 미리 만든다(캐시). 그리기는 동기로 한다 — renderCharacter 가 그림을 다 받은 뒤 부른다.
// 움직이는 이모티콘의 그림이 아직 없으면 **기다리지 않고** 대표 프레임으로 먼저 그린다(still — 고르기 창에 떠 있던 그림이라 받아 둔 것이다).
// 그림이 오면 다음 프레임부터 움직인다(미리보기는 이모티콘이 떠 있는 동안 프레임마다 다시 그린다). 보내는 순간의 지연 = 그림 받기였다
// (느린 3G 0.7~1.4초, 4G 0.2~0.3초 — 실측). full = 움짤처럼 움직이는 그림이 꼭 있어야 할 때(기다린다).
export async function prepareChat (d: ChatDraw | undefined, full = false): Promise<Bitmap[]> {
  if (!d) return []
  // 글자 도트를 먼저 받는다(이미 받았으면 바로 끝난다) — 받기 전에 그리지 않는다. 받지 못했으면 그린 그림을 기억하지 않아 다음에 다시 그린다.
  const keep = await loadGlyphs([d.name, d.text, ' : ', d.title?.name ?? '', d.medal?.name ?? ''])
  let emo = d.emo
  if (!full && emo?.strip && emo.frames?.length && !imageLoaded(emo.strip, true)) { void warmEmo(emo); emo = { ...emo, still: true } }
  const [bub, tag, title, medal] = await Promise.all([
    d.balloon ? bitmapOf(d.balloon, `${d.name} : ${d.text}`, keep, emo) : null, d.tag ? bitmapOf(d.tag, d.name, keep) : null,
    d.title ? bitmapOf(d.title.ui, d.title.name, keep) : null, d.medal ? bitmapOf(d.medal.ui, d.medal.name, keep) : null,
  ])
  // 움직이는 판의 프레임: 움짤(full)은 기다리고, 미리보기는 기다리지 않고 첫 프레임으로 먼저 그린다(받으면 다음 그리기부터 움직인다)
  const moving = [tag, title, medal].filter((b): b is Bitmap => !!b?.live && !b.live.frames).map((b) => b.live!.load().catch(() => {}))
  if (full && moving.length) await Promise.all(moving)
  // 쌓기(캐시한 그림은 그대로 두고 자리만 옮긴 사본으로 — 머리말의 '쌓기'). 훈장 높이만 명찰을 따르고(없으면 기본 명찰 자리 아래), 가로는 늘 TAG_MID.
  // 말풍선은 제자리 — 게임에서도 칭호 위로 비켜 가지 않고 칭호를 덮는다(사용자 캡처: 미소노미카쨩 · 신비한 정원). 그래서 칭호보다 나중에(위에) 그린다.
  const g = tag && { ...tag, oy: TAG_TOP }
  const under = TAG_TOP + (g ? g.c.height : BASE_TAG_H)
  const centered = (b: Bitmap, oy: number): Bitmap => ({ ...b, ox: Math.floor(TAG_MID - b.c.width / 2), oy })
  // up = 머리 위에 서는 것(칭호 · 말풍선) — 탈것을 타면 탄 사람 · 탈것의 높이를 따른다(chatRefOf)
  const t = title && { ...centered(title, -TITLE_BOTTOM - title.c.height), up: true }
  const m = medal && centered(medal, under + MEDAL_GAP)
  const u = bub && { ...bub, up: true }
  return [t, g, m, u].filter((x): x is Bitmap => !!x)
}

// 캐릭터 위에 덧그린다. 시선이 오른쪽(flip)이어도 글자는 뒤집지 않고 자리만 옮긴다.
// 기준점(사용자 지시 — 서기 0프레임의 몸 자리로 한 번 정한 뒤에는 어떤 동작에서도 움직이지 않는다. 게임에서도 제자리에 가만히 있다):
//  · 맨몸: 발(몸 그림의 origin). 미리보기 · 자세 합성은 모든 프레임을 서기 0프레임의 배꼽에 맞춰 옮겨(stab) 이 점이 동작 내내 서기 0프레임의 발 자리다.
//    (지금 프레임의 배꼽을 따르면 숨 쉬기 · 동작마다 배꼽이 오르내리고 옆으로 가서 명찰 · 칭호 · 훈장 · 말풍선이 흔들렸다)
//  · 탈것(사용자 지시 — 몸만 기준으로 두니 탈것의 가운데 · 탄 높이가 어긋났다): chatRefOf. 미리보기 · 움짤은 그 동작 0프레임으로 잰 값(ref)을 넘겨 동작 내내 같다.
//  ref 가 없으면 이 프레임으로 잰다(한 장 그림).
// t = 보낸 뒤 흐른 시간(ms) — 움직이는 이모티콘의 프레임을 고른다. 없으면 대표 프레임(복사 그림 등).
// clock = 움직이는 판의 시계(ms — 미리보기는 지금 시각, 움짤은 그 프레임의 시각). 없으면 첫 프레임.
// 명찰 · 말풍선 · 칭호 · 훈장의 기준점(월드). 맨몸 = 발(x · ground · up 이 모두 발).
// 탈것을 타면 게임처럼 캐릭터 자리 = 탈것의 origin(딛는 바닥 — 명찰 · 훈장은 그 아래, 가로 가운데도 탈것의 origin):
//  · dx = 탈것 origin 이 배꼽에서 떨어진 가로 거리 — 렌더러가 탈 때는 배꼽을 가로 가운데에 고정하므로(centerXOnly) 배꼽 + dx 로 놓아야 프레임마다 같은 자리다.
//  · up = 머리 위에 서는 칭호 · 말풍선의 '발' 높이 = 탄 사람의 발(안장 위로 올라간 만큼). 맨몸에서 머리 위에 서는 간격을 그대로 두고 캐릭터와 함께 올린다.
//    탈것 그림의 높이는 보지 않는다 — 게임 캡처(사용자 첨부: 재규어 · 메카)에서 칭호 · 말풍선은 탈것이 아니라 탄 캐릭터의 머리 위에 선다.
export type ChatRef = { x: number; dx?: number; ground: number; up: number }
export function chatRefOf (placed: PlacedLayer[]): ChatRef | null {
  const g = groundOf(placed)
  if (!g) return null
  const mount = placed.some((p) => p.slot === 'riding' && p.name.startsWith('mount'))
  if (!mount) return { x: g.x, ground: g.y, up: g.y }
  const body = placed.find((p) => p.slot === 'body' && p.name === 'body'), nav = body?.map?.navel, k = body?.scale ?? 1
  const foot = footOf(placed)
  const up = Math.min(foot ? foot.y : g.y, g.y)
  const dx = body && nav ? g.x - (body.x + (body.origin.x + nav.x) * k) : undefined
  return { x: g.x, dx, ground: g.y, up }
}

export function drawChat (ctx: CanvasRenderingContext2D, maps: Bitmap[], placed: PlacedLayer[], o: { anchorX: number; anchorY: number; scale: number; flip?: boolean; width: number; t?: number; main?: number; clock?: number; ref?: ChatRef }) {
  if (!maps.length) return
  const r = o.ref ?? chatRefOf(placed)
  if (!r) return
  const body = placed.find((p) => p.slot === 'body' && p.name === 'body'), nav = body?.map?.navel, k = body?.scale ?? 1
  // 탈것: 지금 프레임의 배꼽 + dx(렌더러가 고정하는 배꼽에서 잰 거리라 동작 내내 같은 자리)
  const mx = r.dx != null && body && nav ? body.x + (body.origin.x + nav.x) * k + r.dx : r.x
  const fx = (o.anchorX + mx) * o.scale
  const cx = o.flip ? o.width - fx : fx
  const cy = (o.anchorY + r.ground) * o.scale, cyUp = (o.anchorY + r.up) * o.scale
  ctx.imageSmoothingEnabled = false
  for (const b of maps) {
    const fr = b.live?.frames && o.clock != null ? b.live.frames[cycleAt(b.live.d, o.clock)] : undefined
    const c = fr?.c ?? b.c
    const bx = Math.round(cx + (b.ox + (fr?.dx ?? 0)) * o.scale), by = Math.round((b.up ? cyUp : cy) + (b.oy + (fr?.dy ?? 0)) * o.scale)
    ctx.drawImage(c, bx, by, c.width * o.scale, c.height * o.scale)
    if (b.emo) {
      const f = b.emo.frames[emoFrameAt({ frames: b.emo.frames, main: o.main } as ChatEmo, o.t)]
      ctx.drawImage(b.emo.img, f.x, 0, f.w, f.h, bx + (b.emo.x - f.ox) * o.scale, by + (b.emo.y - f.oy) * o.scale, f.w * o.scale, f.h * o.scale)
    }
  }
}
