// 코디 프로필(공유 카드) — 내 캐릭터를 세로형 카드 한 장으로 그린다(사용자 지시 — 정보만 늘어놓은 그림이 아니라 고르는 디자인의 '카드').
// 위 = 둘레에 걸친 이름 띠 · 사진 칸(배경 + 캐릭터 · 명찰 · 말풍선, 끌어 옮기고 키워 자리를 고른다) · 겹친 알약, 가운데 = 이름 · 한 줄 정보, 아래 = 장착 칩 2열.
// 코디 프로필 창(surface/ProfileCardBody)의 미리보기와 저장이 **이 파일의 같은 함수**로 그린다 — 미리보기 그대로 저장된다(저장만 해상도가 두 배).
//  · 판 = 사진 칸 밖 전부(디자인 · 이름 · 칩, drawCardBase). 디자인 · 칩 · 이름이 바뀔 때만 다시 그린다.
//  · 사진 칸(drawCardPhoto) = 배경 + 캐릭터. 끌 때는 판을 그대로 깔고 사진 칸만 다시 그린다(프레임마다 칩 글자를 다시 쓰지 않게).
//  · 캐릭터는 정수 배율(게임 1칸 = 카드 z px — 저장에서는 2z)이라 도트가 뭉개지지 않는다.
//  · 글자 = 사이트 글꼴(Wanted Sans). 그리기 전에 쓰는 굵기를 받아 둔다(받기 전에 그리면 대체 글꼴이 박힌다).
import { CASH_BGS, CASH_BG_GROUND, CASH_BG_H, CASH_BG_W, type StageBgImage } from './stageBg'
import { roomLit } from './stageShot'
import { ROOM } from '@/components/shop/scene/sceneData'
import { sceneFallback } from '@/components/shop/scene/skyTime'
import { stageColor } from '@/components/shop/preview/StageBg'

export type ShareChip = {
  part: string                // 부위 이름(헤어 · 모자 …)
  name: string                // 아이템 이름
  icon: HTMLCanvasElement | null
  band: ShareBand             // 칩 아래 띠(염색 값)
}
// 띠 = 같은 폭의 칸들. 칸마다 점(색) · 낱말 · 값. 염색하지 않았으면 낱말 하나(염색 없음 / 염색 불가)
export type ShareBand = { muted?: string; cells?: { dot?: string; key: string; val: string }[] }

// ── 카드 디자인 ─────────────────────────────────────────────
// bg = 바탕 그라데이션(위 → 아래), accent = 테두리 · 장식 · 이름 밑줄, photo = 배경 '카드 색'일 때 사진 칸 색.
// pattern = 바탕 무늬, frame = 카드 둘레 선(double = 두 줄, dash = 점선).
export type CardTheme = {
  id: string; label: string
  bg: [string, string]; accent: string; brand: string; text: string; sub: string
  chip: string; chipLine: string; iconBg: string; key: string; val: string; photo: [string, string]
  pattern: 'sheen' | 'dots' | 'hearts' | 'stars' | 'none'; frame: 'double' | 'dash' | 'single'
}
export const CARD_THEMES: CardTheme[] = [
  { id: 'midnight', label: '미드나잇', bg: ['#1c2540', '#2c3b5e'], accent: '#d4b072', brand: '#e9cf9c', text: '#f6eedd', sub: '#b9ac92',
    chip: 'rgba(255,255,255,0.06)', chipLine: 'rgba(212,176,114,0.34)', iconBg: 'rgba(255,255,255,0.15)', key: '#a99d86', val: '#efe4cc', photo: ['#2e3d62', '#1f2a46'], pattern: 'sheen', frame: 'double' },
  { id: 'noir', label: '블랙 메탈', bg: ['#121214', '#2d2e33'], accent: '#c9ced6', brand: '#e6e9ee', text: '#f3f4f6', sub: '#9da1a9',
    chip: 'rgba(255,255,255,0.05)', chipLine: 'rgba(201,206,214,0.26)', iconBg: 'rgba(255,255,255,0.14)', key: '#8f939b', val: '#e3e6ea', photo: ['#34353b', '#1b1b1e'], pattern: 'sheen', frame: 'double' },
  { id: 'pinkbean', label: '핑크빈', bg: ['#ffcfe1', '#ff93bf'], accent: '#ffffff', brand: '#ffffff', text: '#5e2442', sub: '#a64f7a',
    chip: '#fff8fb', chipLine: '#ffd3e4', iconBg: '#fff5f9', key: '#c18aa5', val: '#7a3b5a', photo: ['#fff1f7', '#ffd6e7'], pattern: 'hearts', frame: 'dash' },
  { id: 'milk', label: '딸기우유', bg: ['#fffaf5', '#ffe5ee'], accent: '#ee8fb2', brand: '#ec86ac', text: '#5a3a45', sub: '#b3878f',
    chip: '#ffffff', chipLine: '#f6d6e1', iconBg: '#fff8fa', key: '#c3a1aa', val: '#7d5560', photo: ['#fff5f8', '#ffe7ef'], pattern: 'dots', frame: 'dash' },
  { id: 'lavender', label: '라벤더', bg: ['#f3eeff', '#d6c8ff'], accent: '#8b70e0', brand: '#7a5fd6', text: '#3a2e62', sub: '#8679b0',
    chip: '#ffffff', chipLine: '#e3daff', iconBg: '#f9f7ff', key: '#a297c4', val: '#55488a', photo: ['#f7f4ff', '#e6ddff'], pattern: 'stars', frame: 'double' },
  { id: 'mint', label: '민트', bg: ['#e8f8f1', '#b8e6d4'], accent: '#3c947b', brand: '#2f8169', text: '#21443a', sub: '#5d8b7c',
    chip: '#ffffff', chipLine: '#cdebdf', iconBg: '#f5fcf9', key: '#8cb0a4', val: '#356a5a', photo: ['#f2fbf7', '#d5f0e5'], pattern: 'dots', frame: 'double' },
  { id: 'cream', label: '크림', bg: ['#fbf8f4', '#f4ede5'], accent: '#ec86ac', brand: '#ec86ac', text: '#3d372f', sub: '#a39a90',
    chip: '#ffffff', chipLine: '#ebe3da', iconBg: '#faf7f4', key: '#b0a599', val: '#6f655b', photo: ['#ffffff', '#f6f0e9'], pattern: 'none', frame: 'single' },
]

// ── 배치(카드 px — 저장은 S 배) ───────────────────────────────────
// 방향(사용자 지시): maple.gg 카드처럼 깔끔 · 심플하고 여유로운 공간 — 모양은 따라 하지 않고 이 카드만의 것으로.
// 여러 굵기의 선(2.5 · 1.5 · 1px)과 가벼운 구분선으로 가르고, 이름 알약을 사진 아래 끝에 겹쳐 얹는다(이 카드의 눈에 띄는 자리).
// 둘레는 둥근 가는 한 줄(디자인에 따라 점선 · 안쪽 옅은 둘째 줄), 목록은 상자 없이 가는 선으로 가른 2열. 아이콘은 직접 그린 선.
export const CARD_W = 1080
const FR = 26                 // 바깥 둘레선의 안쪽 여백
const PAD = 72                // 내용의 옆 여백
const CHIP_H = 124, COLGAP = 40, CHIP_W = (CARD_W - PAD * 2 - COLGAP) / 2
export const PHOTO = { x: PAD, y: 112, w: CARD_W - PAD * 2, h: 720, r: 24 }
const NAME_H = 76                                   // 사진 아래 끝에 걸친 이름 알약의 높이(절반이 사진 위)
const INFO_Y = PHOTO.y + PHOTO.h + NAME_H / 2 + 46
const DIV_Y = INFO_Y + 54
const CHIPS_Y = DIV_Y + 34
export const ZOOM_MIN = 1, ZOOM_MAX = 12
export function cardHeight (n: number): number {
  const rows = Math.max(1, Math.ceil(n / 2))
  return CHIPS_Y + rows * CHIP_H + 116
}

export type CardText = { name: string; sub: string }
const FAM = () => getComputedStyle(document.body).fontFamily || 'sans-serif'
const font = (wt: number, px: number) => `${wt} ${px}px ${FAM()}`
const loadImg = (src: string) => new Promise<HTMLImageElement>((res, rej) => { const img = new Image(); img.onload = () => res(img); img.onerror = rej; img.src = src })
// 머리 줄 로고(사이트 머리의 로고와 같은 그림). 글꼴과 함께 미리 받아 두고, 못 받으면 로고 없이 그린다
let logo: HTMLImageElement | null = null
export async function cardFonts (): Promise<void> {
  const fonts = Promise.all([500, 600, 700].map((wt) => document.fonts.load(font(wt, 20), '핑크빈 커마샵 코디 프로필 가나다 0123'))).catch(() => { /* 없으면 지금 있는 글꼴로 */ })
  const img = logo ? null : loadImg('/logo.png').then((i) => { logo = i }).catch(() => {})
  await Promise.all([fonts, img])
}

function round (g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath()
}
// 칸 폭을 넘는 글은 끝을 … 로 줄인다
function fit (g: CanvasRenderingContext2D, s: string, w: number): string {
  if (g.measureText(s).width <= w) return s
  let t = s
  while (t.length > 1 && g.measureText(t + '…').width > w) t = t.slice(0, -1)
  return t + '…'
}
// 늘 같은 자리에 나오는 무늬(카드마다 · 저장할 때마다 같게) — 옅게
const rand = (i: number) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x) }
function heart (g: CanvasRenderingContext2D, x: number, y: number, r: number) {
  g.beginPath(); g.moveTo(x, y + r * 0.9)
  g.bezierCurveTo(x - r * 1.6, y - r * 0.2, x - r * 0.6, y - r * 1.3, x, y - r * 0.45)
  g.bezierCurveTo(x + r * 0.6, y - r * 1.3, x + r * 1.6, y - r * 0.2, x, y + r * 0.9); g.fill()
}
function sparkle (g: CanvasRenderingContext2D, x: number, y: number, r: number) {
  g.beginPath(); g.moveTo(x, y - r); g.quadraticCurveTo(x, y, x + r, y); g.quadraticCurveTo(x, y, x, y + r); g.quadraticCurveTo(x, y, x - r, y); g.quadraticCurveTo(x, y, x, y - r); g.fill()
}
function pattern (g: CanvasRenderingContext2D, t: CardTheme, H: number) {
  g.save()
  if (t.pattern === 'sheen') {
    const gr = g.createLinearGradient(0, 0, CARD_W, H * 0.6)
    gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.42, 'rgba(255,255,255,0.05)'); gr.addColorStop(0.5, 'rgba(255,255,255,0)'); gr.addColorStop(0.58, 'rgba(255,255,255,0.03)'); gr.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = gr; g.fillRect(0, 0, CARD_W, H)
  } else if (t.pattern === 'dots') {
    g.fillStyle = t.accent; g.globalAlpha = 0.07
    for (let y = 20, row = 0; y < H; y += 40, row++) for (let x = (row % 2) * 20 + 20; x < CARD_W; x += 40) { g.beginPath(); g.arc(x, y, 2.6, 0, Math.PI * 2); g.fill() }
  } else if (t.pattern === 'hearts') {
    g.fillStyle = '#ffffff'
    for (let i = 0; i < 44; i++) { g.globalAlpha = 0.12 + rand(i + 9) * 0.16; heart(g, rand(i) * CARD_W, rand(i + 400) * H, 6 + rand(i + 800) * 9) }
  } else if (t.pattern === 'stars') {
    g.fillStyle = t.accent
    for (let i = 0; i < 38; i++) { g.globalAlpha = 0.07 + rand(i + 5) * 0.11; sparkle(g, rand(i + 50) * CARD_W, rand(i + 950) * H, 5 + rand(i + 1300) * 7) }
  }
  g.restore()
}
// 가운데에 작은 반짝이를 둔 가는 구분선(양끝은 가늘게 사라진다)
function sparkleRule (g: CanvasRenderingContext2D, cx: number, y: number, half: number, color: string) {
  g.save(); g.lineWidth = 1
  for (const s of [-1, 1]) {
    const gr = g.createLinearGradient(cx + s * 22, y, cx + s * half, y); gr.addColorStop(0, color); gr.addColorStop(1, 'rgba(0,0,0,0)')
    g.strokeStyle = gr; g.beginPath(); g.moveTo(cx + s * 22, y + 0.5); g.lineTo(cx + s * half, y + 0.5); g.stroke()
  }
  g.fillStyle = color; sparkle(g, cx, y, 9); g.globalAlpha = 0.6; sparkle(g, cx - 15, y, 4); sparkle(g, cx + 15, y, 4)
  g.restore()
}
// 작은 그림 아이콘(직접 그린 선 — 글자 색과 같은 색)
function iconHanger (g: CanvasRenderingContext2D, x: number, y: number, c: string) {
  g.save(); g.strokeStyle = c; g.lineWidth = 2; g.lineCap = 'round'; g.lineJoin = 'round'
  g.beginPath(); g.moveTo(x + 9, y + 6); g.arc(x + 11, y + 5, 2.5, Math.PI, Math.PI * 2.4); g.lineTo(x + 11, y + 9); g.lineTo(x + 2, y + 15); g.lineTo(x + 20, y + 15); g.lineTo(x + 11, y + 9); g.stroke(); g.restore()
}
function iconCalendar (g: CanvasRenderingContext2D, x: number, y: number, c: string) {
  g.save(); g.strokeStyle = c; g.fillStyle = c; g.lineWidth = 2; g.lineJoin = 'round'
  round(g, x + 2, y + 4, 18, 15, 3); g.stroke()
  g.beginPath(); g.moveTo(x + 2, y + 9); g.lineTo(x + 20, y + 9); g.moveTo(x + 7, y + 2); g.lineTo(x + 7, y + 6); g.moveTo(x + 15, y + 2); g.lineTo(x + 15, y + 6); g.stroke()
  g.fillRect(x + 6, y + 12, 3, 3); g.fillRect(x + 11, y + 12, 3, 3)
  g.restore()
}

// 판: 사진 칸 밖 전부. g 는 (CARD_W × H) × S 캔버스.
export function drawCardBase (g: CanvasRenderingContext2D, S: number, t: CardTheme, text: CardText, chips: ShareChip[]): void {
  const H = cardHeight(chips.length)
  g.setTransform(S, 0, 0, S, 0, 0)
  const bg = g.createLinearGradient(0, 0, CARD_W * 0.35, H)
  bg.addColorStop(0, t.bg[0]); bg.addColorStop(1, t.bg[1])
  g.fillStyle = bg; g.fillRect(0, 0, CARD_W, H)
  pattern(g, t, H)
  // 둘레: 둥근 가는 한 줄(점선 디자인은 점선), 겹줄 디자인은 안쪽에 옅은 둘째 줄
  g.save(); g.strokeStyle = t.accent
  if (t.frame === 'dash') { g.lineWidth = 3; g.setLineDash([1, 9]); g.lineCap = 'round'; g.globalAlpha = 0.95 } else { g.lineWidth = 1.5; g.globalAlpha = 0.75 }
  round(g, FR, FR, CARD_W - FR * 2, H - FR * 2, 30); g.stroke()
  if (t.frame === 'double') { g.setLineDash([]); g.lineWidth = 1; g.globalAlpha = 0.3; round(g, FR + 9, FR + 9, CARD_W - FR * 2 - 18, H - FR * 2 - 18, 22); g.stroke() }
  g.restore()
  // 머리 줄: 로고 + 로고 글자 | '코디 프로필' 알약. 알약 높이 = 로고 높이(글자는 작아도 왼쪽 타이틀과 같은 크기로 보인다)
  const hy = (FR + PHOTO.y) / 2 + 4, HEAD_H = 36
  g.textBaseline = 'middle'
  if (logo) g.drawImage(logo, PAD, hy - HEAD_H / 2, HEAD_H, HEAD_H)
  g.fillStyle = t.brand; g.font = font(700, 23); g.textAlign = 'left'; g.fillText('핑크빈 커마샵', PAD + (logo ? HEAD_H + 10 : 0), hy + 1)
  g.font = font(600, 16)
  const pw = g.measureText('코디 프로필').width + 34, px = CARD_W - PAD - pw
  g.save(); round(g, px + 0.75, hy - HEAD_H / 2 + 0.75, pw - 1.5, HEAD_H - 1.5, (HEAD_H - 1.5) / 2); g.strokeStyle = t.accent; g.lineWidth = 1.5; g.globalAlpha = 0.8; g.stroke(); g.restore()
  g.fillStyle = t.sub; g.textAlign = 'center'; g.fillText('코디 프로필', px + pw / 2, hy + 1)
  // 사진 바깥 가는 둘째 테두리(안쪽 테두리 · 이름 알약은 drawCardPhoto — 사진 위에 겹친다)
  g.save(); g.strokeStyle = t.accent; g.globalAlpha = 0.35; g.lineWidth = 1; round(g, PHOTO.x - 7, PHOTO.y - 7, PHOTO.w + 14, PHOTO.h + 14, PHOTO.r + 7); g.stroke(); g.restore()
  // 한 줄 정보(아이콘 + 가는 세로 구분선). 이름은 사진 아래 끝의 알약(photoBadge)
  // 두 칸이면 구분선이 늘 카드 가운데 — 왼쪽 칸은 구분선에 오른쪽 끝을, 오른쪽 칸은 왼쪽 끝을 붙인다(글 길이가 달라도 구분선이 움직이지 않는다)
  const parts = text.sub.split(' | ')
  g.font = font(600, 21)
  const widths = parts.map((p) => g.measureText(p).width + 30), sep = 28, cx = CARD_W / 2
  const xs = parts.length === 2 ? [cx - sep / 2 - widths[0], cx + sep / 2] : [cx - widths[0] / 2]
  if (parts.length === 2) { g.save(); g.strokeStyle = t.sub; g.globalAlpha = 0.5; g.lineWidth = 1; g.beginPath(); g.moveTo(Math.round(cx) + 0.5, INFO_Y - 9); g.lineTo(Math.round(cx) + 0.5, INFO_Y + 9); g.stroke(); g.restore() }
  xs.forEach((x, i) => {
    ;(i ? iconCalendar : iconHanger)(g, x, INFO_Y - 11, t.accent)
    g.textAlign = 'left'; g.fillStyle = t.sub; g.fillText(parts[i], x + 30, INFO_Y + 1)
  })
  sparkleRule(g, CARD_W / 2, DIV_Y, 260, t.accent)
  // 목록: 2열, 칸은 상자 없이 가는 가로줄로 가르고 가운데에 가는 세로줄
  const rows = Math.max(1, Math.ceil(chips.length / 2))
  g.save(); g.strokeStyle = t.chipLine; g.lineWidth = 1
  for (let r = 1; r < rows; r++) { const y = CHIPS_Y + r * CHIP_H + 0.5; g.beginPath(); g.moveTo(PAD, y); g.lineTo(PAD + CHIP_W, y); g.moveTo(PAD + CHIP_W + COLGAP, y); g.lineTo(CARD_W - PAD, y); g.stroke() }
  if (chips.length > 1) { const cx = Math.round(CARD_W / 2) + 0.5; g.beginPath(); g.moveTo(cx, CHIPS_Y + 14); g.lineTo(cx, CHIPS_Y + rows * CHIP_H - 14); g.stroke() }
  g.restore()
  chips.forEach((ch, i) => drawChip(g, t, ch, PAD + (i % 2) * (CHIP_W + COLGAP), CHIPS_Y + Math.floor(i / 2) * CHIP_H))
  if (!chips.length) { g.textAlign = 'center'; g.fillStyle = t.sub; g.font = font(600, 20); g.fillText('입고 있는 아이템이 없어요', CARD_W / 2, CHIPS_Y + 44) }
  // 바닥: 가는 선 사이의 사이트 주소
  const fy = H - FR - 46
  g.font = font(600, 17); g.textAlign = 'center'; g.fillStyle = t.sub
  const site = 'pinkbean-customize.com', sw = g.measureText(site).width / 2 + 18
  g.fillText(site, CARD_W / 2, fy)
  g.save(); g.strokeStyle = t.accent; g.globalAlpha = 0.45; g.lineWidth = 1; g.beginPath(); g.moveTo(CARD_W / 2 - sw - 90, fy + 0.5); g.lineTo(CARD_W / 2 - sw, fy + 0.5); g.moveTo(CARD_W / 2 + sw, fy + 0.5); g.lineTo(CARD_W / 2 + sw + 90, fy + 0.5); g.stroke(); g.restore()
  g.textAlign = 'left'
}

// 목록 한 칸: 가는 테두리의 아이콘 칸 + 부위(강조색 작은 글) · 이름 · 염색 값 한 줄
// 크기(사용자 지시 — 작아서 잘 안 보였다): 칸 높이 124, 아이콘 칸 84, 글 17 · 24 · 17
function drawChip (g: CanvasRenderingContext2D, t: CardTheme, ch: ShareChip, x: number, y: number) {
  const ib = 84, ix = x + 4, iy = y + (CHIP_H - ib) / 2
  round(g, ix, iy, ib, ib, 16); g.fillStyle = t.iconBg; g.fill()
  if (ch.icon && ch.icon.width && ch.icon.height) {
    // 칩 캔버스는 디바이스 px 로 그려져 있다 — 칸 안쪽 여백 없이 칸에 꽉 맞게(사용자 지시 — 피부처럼 넓은 그림 옆이 비었다), 칸 모서리로 자른다.
    // 도트는 nearest(키울 때) / 부드럽게(줄일 때)
    const sc = Math.min(ib / ch.icon.width, ib / ch.icon.height)
    g.save(); round(g, ix, iy, ib, ib, 16); g.clip()
    g.imageSmoothingEnabled = sc < 1
    const w = ch.icon.width * sc, h = ch.icon.height * sc
    g.drawImage(ch.icon, Math.round(ix + (ib - w) / 2), Math.round(iy + (ib - h) / 2), w, h)
    g.restore()
  }
  round(g, ix, iy, ib, ib, 16); g.strokeStyle = t.chipLine; g.lineWidth = 1; g.stroke()
  const tx = ix + ib + 20, tw = CHIP_W - (tx - x) - 4
  g.textAlign = 'left'; g.textBaseline = 'middle'
  g.fillStyle = t.sub; g.font = font(600, 17); g.fillText(fit(g, ch.part, tw), tx, y + 32)
  g.fillStyle = t.text; g.font = font(700, 24); g.fillText(fit(g, ch.name, tw), tx, y + 62)
  const cy = y + 94, cells = ch.band.cells?.length ? ch.band.cells : null
  if (!cells) { g.fillStyle = t.key; g.font = font(500, 17); g.fillText(fit(g, ch.band.muted || '', tw), tx, cy); return }
  let px = tx
  cells.forEach((cell, k) => {
    if (px > tx + tw - 24) return
    if (k) { g.save(); g.strokeStyle = t.chipLine; g.lineWidth = 1; g.beginPath(); g.moveTo(px - 9 + 0.5, cy - 8); g.lineTo(px - 9 + 0.5, cy + 8); g.stroke(); g.restore() }
    if (cell.dot) {
      g.beginPath(); g.arc(px + 6, cy, 6, 0, Math.PI * 2)
      if (cell.dot === 'all') { const gr = g.createConicGradient(0, px + 6, cy); ['#ff6f8f', '#ffd36b', '#7fd88a', '#6bb8ff', '#c79bff', '#ff6f8f'].forEach((col, j, a) => gr.addColorStop(j / (a.length - 1), col)); g.fillStyle = gr } else g.fillStyle = cell.dot
      g.fill(); px += 18
    }
    g.fillStyle = t.key; g.font = font(500, 17); g.fillText(cell.key, px, cy); px += g.measureText(cell.key).width + 5
    g.fillStyle = t.val; g.font = font(700, 17); g.fillText(cell.val, px, cy); px += g.measureText(cell.val).width + 19
  })
}

// 사진 아래 끝에 겹쳐 얹은 이름 알약(사진을 그린 뒤 — 사진이 덮지 않게). 절반은 사진 위, 절반은 판 위
function photoBadge (g: CanvasRenderingContext2D, S: number, t: CardTheme, name: string) {
  g.setTransform(S, 0, 0, S, 0, 0)
  g.font = font(700, 40); g.textBaseline = 'middle'; g.textAlign = 'center'
  const label = fit(g, name, PHOTO.w - 160), w = Math.max(220, g.measureText(label).width + 80), x = (CARD_W - w) / 2, y = PHOTO.y + PHOTO.h - NAME_H / 2
  round(g, x, y, w, NAME_H, NAME_H / 2); g.fillStyle = t.bg[0]; g.fill()
  g.strokeStyle = t.accent; g.lineWidth = 2.5; g.stroke()
  g.save(); g.globalAlpha = 0.35; g.lineWidth = 1; round(g, x + 6, y + 6, w - 12, NAME_H - 12, (NAME_H - 12) / 2); g.stroke(); g.restore()
  g.fillStyle = t.text; g.fillText(label, CARD_W / 2, y + NAME_H / 2 + 2)
  g.textAlign = 'left'; g.setTransform(1, 0, 0, 1, 0, 0)
}

// ── 사진 칸 ─────────────────────────────────────────────
// 캐릭터 판(canvasExport.drawShot — 게임 1배)과 그 판의 발 자리. 보기(view) = 사진 칸 가운데에 올 점(발 기준, 게임 칸)과 배율 z(게임 1칸 = 카드 z px).
export type CardBoard = { c: HTMLCanvasElement; x0: number; y0: number; x1: number; y1: number; foot: { x: number; y: number } }
export type CardView = { z: number; x: number; y: number }
// 배경: 'theme' = 카드 색, 'room' 피팅룸, 캐시샵 배경(cs0~), 'white' · 'black', 올린 그림의 id
export type CardBg = { sel: string; images: StageBgImage[] }

// 처음 보기 — 그림이 사진 칸에 드는 가장 큰 정수 배율, 몸통을 칸 가로 가운데에
export function defaultView (b: CardBoard | null): CardView {
  if (!b) return { z: 5, x: 0, y: -30 }
  // 가로 가운데는 그림 상자가 아니라 몸통(마네킹 시각 중심 = foot.x — 미리보기와 같은 기준, 사용자 지시: 긴 무기 쪽으로 쏠렸다).
  // 그래서 폭은 몸통에서 더 먼 쪽 끝까지의 두 배로 잰다. 세로 가운데는 그림 상자 그대로
  const w = 2 * Math.max(b.foot.x - b.x0, b.x1 + 1 - b.foot.x), h = b.y1 - b.y0 + 1
  // 그림(캐릭터 + 명찰 · 말풍선 · 칭호)이 사진 칸 높이의 84% · 폭의 94% 안에 드는 가장 큰 정수 배율(사용자 지시 — 0.62 · 0.8 은 멀었다)
  const z = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, Math.floor(Math.min((PHOTO.h * 0.84) / h, (PHOTO.w * 0.94) / w))))
  return { z, x: 0, y: (b.y0 + b.y1 + 1) / 2 - b.foot.y }
}

const imgCache = new Map<string, Promise<HTMLImageElement | HTMLCanvasElement>>()
// 배경 그림(피팅룸 = 지금 시각의 빛을 입힌 한 장 — 한 번만 만든다)
export function cardBgImage (sel: string, images: StageBgImage[]): Promise<HTMLImageElement | HTMLCanvasElement> | null {
  const src = sel === 'room' ? 'room' : CASH_BGS.find((c) => c.id === sel)?.src ?? images.find((i) => i.id === sel)?.src
  if (!src) return null
  let p = imgCache.get(src)
  if (!p) { p = (src === 'room' ? roomLit(13) : loadImg(src)) as Promise<HTMLImageElement | HTMLCanvasElement>; p.catch(() => imgCache.delete(src)); imgCache.set(src, p) }
  return p
}

// 사진 칸을 그린다(디바이스 px 로 — 캐릭터 배율이 정수가 되게). img = cardBgImage 가 받은 그림(카드 색 · 흰색 · 검은색은 없음).
export function drawCardPhoto (g: CanvasRenderingContext2D, S: number, t: CardTheme, sel: string, img: HTMLImageElement | HTMLCanvasElement | null, b: CardBoard | null, v: CardView, base: CardView, name: string) {
  g.setTransform(1, 0, 0, 1, 0, 0)
  const px = PHOTO.x * S, py = PHOTO.y * S, pw = PHOTO.w * S, ph = PHOTO.h * S
  g.save()
  round(g, px, py, pw, ph, PHOTO.r * S); g.clip()
  const k = v.z * S
  // 발이 오는 자리(디바이스 px, 정수)
  const fx = Math.round(px + pw / 2 - v.x * k), fy = Math.round(py + ph / 2 - v.y * k)
  const fill = (c: string, y0 = py, y1 = py + ph) => { g.fillStyle = c; g.fillRect(px, y0, pw, y1 - y0) }
  g.imageSmoothingEnabled = false
  const cash = CASH_BGS.find((c) => c.id === sel)
  if (sel === 'room') {
    fill(sceneFallback('room'))
    if (img) g.drawImage(img, fx - ROOM.foot[0] * k, fy - ROOM.foot[1] * k, ROOM.w * k, ROOM.h * k)
  } else if (cash) {
    const top = fy - CASH_BG_GROUND * k
    fill(cash.top, py, top + (CASH_BG_H * k) / 2); fill(cash.bottom, top + (CASH_BG_H * k) / 2)
    if (img) g.drawImage(img, fx - (CASH_BG_W / 2) * k, top, CASH_BG_W * k, CASH_BG_H * k)
  } else if (img) {
    // 올린 그림: 처음 보기에서 사진 칸을 덮는 크기(cover)로, 캐릭터와 함께 움직이고 커진다(카메라로 자르는 것처럼)
    const nw = (img as HTMLImageElement).naturalWidth || img.width, nh = (img as HTMLImageElement).naturalHeight || img.height
    const cover = Math.max(pw / nw, ph / nh) * (v.z / base.z)
    const cx = px + pw / 2 + (base.x - v.x) * k, cy = py + ph / 2 + (base.y - v.y) * k
    fill('#ffffff')
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high'
    g.drawImage(img, cx - (nw * cover) / 2, cy - (nh * cover) / 2, nw * cover, nh * cover)
    g.imageSmoothingEnabled = false
  } else if (sel === 'white' || sel === 'black' || sel === 'system') fill(stageColor(sel)!)
  else {
    const gr = g.createLinearGradient(0, py, 0, py + ph); gr.addColorStop(0, t.photo[0]); gr.addColorStop(1, t.photo[1])
    g.fillStyle = gr; g.fillRect(px, py, pw, ph)
  }
  if (b) {
    const w = b.x1 - b.x0 + 1, h = b.y1 - b.y0 + 1
    g.drawImage(b.c, b.x0, b.y0, w, h, fx + (b.x0 - b.foot.x) * k, fy + (b.y0 - b.foot.y) * k, w * k, h * k)
  }
  g.restore()
  // 칸 테두리
  g.save(); g.strokeStyle = t.accent; g.globalAlpha = 0.85; g.lineWidth = 2.5 * S; round(g, px, py, pw, ph, PHOTO.r * S); g.stroke(); g.restore()
  g.imageSmoothingEnabled = true
  photoBadge(g, S, t, name)
}
