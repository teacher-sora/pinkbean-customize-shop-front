// 코디 프로필(공유 카드) — 내 캐릭터를 세로형 카드 한 장으로 그린다(사용자 지시 — 정보만 늘어놓은 그림이 아니라 고르는 디자인의 '카드').
// 맨 위 = 강조색 띠 · 로고 · '코디 프로필', 사진 칸(배경 + 캐릭터 · 명찰 · 말풍선, 끌어 옮기고 키워 자리를 고른다), 이름 줄(이름 · 날짜 | 착용 개수), 장착 칩 2열.
// 코디 프로필 창(surface/ProfileCardBody)의 미리보기와 저장이 **이 파일의 같은 함수**로 그린다 — 미리보기 그대로 저장된다(저장만 해상도가 두 배).
//  · 판 = 사진 칸 밖 전부(디자인 · 이름 · 칩, drawCardBase). 디자인 · 칩 · 이름이 바뀔 때만 다시 그린다.
//  · 사진 칸(drawCardPhoto) = 배경 + 캐릭터. 끌 때는 판을 그대로 깔고 사진 칸만 다시 그린다(프레임마다 칩 글자를 다시 쓰지 않게).
//  · 캐릭터는 정수 배율(게임 1칸 = 카드 z px — 저장에서는 2z)이라 도트가 뭉개지지 않는다.
//  · 글자 = 사이트 글꼴(Wanted Sans). 그리기 전에 쓰는 굵기를 받아 둔다(받기 전에 그리면 대체 글꼴이 박힌다).
import { CASH_BGS, CASH_BG_GROUND, CASH_BG_H, CASH_BG_W, type StageBgImage } from './stageBg'
import { roomLit } from './stageShot'
import { ROOM } from '@/components/shop/scene/sceneData'
import { sceneFallback } from '@/components/shop/scene/skyTime'
import { STAGE_COLORS } from '@/components/shop/preview/StageBg'

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
// pattern = 바탕 무늬(옅게 — 그림을 가리지 않게).
export type CardTheme = {
  id: string; label: string
  bg: [string, string]; accent: string; brand: string; text: string; sub: string
  chip: string; chipLine: string; iconBg: string; key: string; val: string; photo: [string, string]
  pattern: 'sheen' | 'dots' | 'hearts' | 'stars' | 'none'
}
export const CARD_THEMES: CardTheme[] = [
  { id: 'midnight', label: '미드나잇', bg: ['#1c2540', '#2c3b5e'], accent: '#d4b072', brand: '#e9cf9c', text: '#f6eedd', sub: '#b9ac92',
    chip: 'rgba(255,255,255,0.06)', chipLine: 'rgba(212,176,114,0.34)', iconBg: 'rgba(255,255,255,0.08)', key: '#a99d86', val: '#efe4cc', photo: ['#2e3d62', '#1f2a46'], pattern: 'sheen' },
  { id: 'noir', label: '블랙 메탈', bg: ['#121214', '#2d2e33'], accent: '#c9ced6', brand: '#e6e9ee', text: '#f3f4f6', sub: '#9da1a9',
    chip: 'rgba(255,255,255,0.05)', chipLine: 'rgba(201,206,214,0.26)', iconBg: 'rgba(255,255,255,0.07)', key: '#8f939b', val: '#e3e6ea', photo: ['#34353b', '#1b1b1e'], pattern: 'sheen' },
  { id: 'pinkbean', label: '핑크빈', bg: ['#ffcfe1', '#ff93bf'], accent: '#ffffff', brand: '#ffffff', text: '#5e2442', sub: '#a64f7a',
    chip: '#fff8fb', chipLine: '#ffd3e4', iconBg: '#ffeef5', key: '#c18aa5', val: '#7a3b5a', photo: ['#fff1f7', '#ffd6e7'], pattern: 'hearts' },
  { id: 'milk', label: '딸기우유', bg: ['#fffaf5', '#ffe5ee'], accent: '#ee8fb2', brand: '#ec86ac', text: '#5a3a45', sub: '#b3878f',
    chip: '#ffffff', chipLine: '#f6d6e1', iconBg: '#fff3f7', key: '#c3a1aa', val: '#7d5560', photo: ['#fff5f8', '#ffe7ef'], pattern: 'dots' },
  { id: 'lavender', label: '라벤더', bg: ['#f3eeff', '#d6c8ff'], accent: '#8b70e0', brand: '#7a5fd6', text: '#3a2e62', sub: '#8679b0',
    chip: '#ffffff', chipLine: '#e3daff', iconBg: '#f5f1ff', key: '#a297c4', val: '#55488a', photo: ['#f7f4ff', '#e6ddff'], pattern: 'stars' },
  { id: 'mint', label: '민트', bg: ['#e8f8f1', '#b8e6d4'], accent: '#3c947b', brand: '#2f8169', text: '#21443a', sub: '#5d8b7c',
    chip: '#ffffff', chipLine: '#cdebdf', iconBg: '#effaf5', key: '#8cb0a4', val: '#356a5a', photo: ['#f2fbf7', '#d5f0e5'], pattern: 'dots' },
  { id: 'cream', label: '크림', bg: ['#fbf8f4', '#f4ede5'], accent: '#ec86ac', brand: '#ec86ac', text: '#3d372f', sub: '#a39a90',
    chip: '#ffffff', chipLine: '#ebe3da', iconBg: '#f7f2ec', key: '#b0a599', val: '#6f655b', photo: ['#ffffff', '#f6f0e9'], pattern: 'none' },
]

// ── 배치(카드 px — 저장은 S 배) ───────────────────────────────────
// 레퍼런스(세로형 캐릭터 카드 · 프로필 카드)의 공통점을 따랐다: 그림이 크게 주인공이고, 구역은 몇 개뿐(이름 · 핵심 숫자 · 목록),
// 강조색은 하나, 장식은 덜어 낸다(겹줄 · 점선 테두리 대신 옅은 한 줄). 맨 위 강조색 띠 · 이름 옆 막대 · 큰 숫자가 눈에 띄는 자리다.
export const CARD_W = 1080
const PAD = 48, GAP = 14, COLGAP = 16
const CHIP_H = 104, CHIP_W = (CARD_W - PAD * 2 - COLGAP) / 2
const BAND = 12 // 맨 위 강조색 띠
export const PHOTO = { x: PAD, y: BAND + 96, w: CARD_W - PAD * 2, h: 760, r: 32 }
const NAME_Y = PHOTO.y + PHOTO.h + 74
const RULE_Y = NAME_Y + 84
const CHIPS_Y = RULE_Y + 32
export const ZOOM_MIN = 1, ZOOM_MAX = 12
export function cardHeight (n: number): number {
  const rows = Math.max(1, Math.ceil(n / 2))
  return CHIPS_Y + rows * CHIP_H + (rows - 1) * GAP + 104
}

export type CardText = { name: string; sub: string }
const FAM = () => getComputedStyle(document.body).fontFamily || 'sans-serif'
const font = (wt: number, px: number) => `${wt} ${px}px ${FAM()}`
export async function cardFonts (): Promise<void> {
  try { await Promise.all([500, 600, 700].map((wt) => document.fonts.load(font(wt, 20), '핑크빈 커마샵 코디 프로필 가나다 0123'))) } catch { /* 없으면 지금 있는 글꼴로 */ }
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
// 늘 같은 자리에 나오는 무늬(카드마다 · 저장할 때마다 같게). 그림을 가리지 않게 옅게
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
    gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.42, 'rgba(255,255,255,0.06)'); gr.addColorStop(0.5, 'rgba(255,255,255,0)'); gr.addColorStop(0.58, 'rgba(255,255,255,0.03)'); gr.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = gr; g.fillRect(0, 0, CARD_W, H)
  } else if (t.pattern === 'dots') {
    g.fillStyle = t.accent; g.globalAlpha = 0.07
    for (let y = 20, row = 0; y < H; y += 40, row++) for (let x = (row % 2) * 20 + 20; x < CARD_W; x += 40) { g.beginPath(); g.arc(x, y, 3, 0, Math.PI * 2); g.fill() }
  } else if (t.pattern === 'hearts') {
    g.fillStyle = '#ffffff'
    for (let i = 0; i < 46; i++) { g.globalAlpha = 0.14 + rand(i + 9) * 0.16; heart(g, rand(i) * CARD_W, rand(i + 400) * H, 6 + rand(i + 800) * 10) }
  } else if (t.pattern === 'stars') {
    g.fillStyle = t.accent
    for (let i = 0; i < 40; i++) { g.globalAlpha = 0.08 + rand(i + 5) * 0.12; sparkle(g, rand(i + 50) * CARD_W, rand(i + 950) * H, 5 + rand(i + 1300) * 8) }
  }
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
  // 맨 위 강조색 띠 · 둘레 옅은 한 줄
  g.fillStyle = t.accent; g.fillRect(0, 0, CARD_W, BAND)
  g.save(); g.strokeStyle = t.accent; g.globalAlpha = 0.32; g.lineWidth = 1.5; round(g, 18, BAND + 18, CARD_W - 36, H - BAND - 36, 26); g.stroke(); g.restore()
  // 머리: 로고 글자 · '코디 프로필' 알약
  const hy = BAND + 50
  g.textBaseline = 'middle'
  g.fillStyle = t.brand; g.font = font(700, 26); g.textAlign = 'left'; g.fillText('핑크빈 커마샵', PAD, hy)
  g.font = font(700, 18)
  const pill = '코디 프로필', pw = g.measureText(pill).width + 36
  round(g, CARD_W - PAD - pw, hy - 20, pw, 40, 20); g.strokeStyle = t.accent; g.lineWidth = 2; g.stroke()
  g.fillStyle = t.brand; g.textAlign = 'center'; g.fillText(pill, CARD_W - PAD - pw / 2, hy + 1)
  // 이름 줄: 왼쪽 = 강조 막대 · 이름 · 한 줄 설명, 오른쪽 = 착용 개수(큰 숫자)
  const nx = PAD + 26
  round(g, PAD, NAME_Y - 38, 8, 112, 4); g.fillStyle = t.accent; g.fill()
  g.textAlign = 'right'
  g.fillStyle = t.text; g.font = font(700, 76); const num = String(chips.length); g.fillText(num, CARD_W - PAD, NAME_Y + 2)
  const numW = g.measureText(num).width
  g.fillStyle = t.sub; g.font = font(600, 20); g.fillText('착용 아이템', CARD_W - PAD, NAME_Y + 58)
  const right = Math.max(numW, g.measureText('착용 아이템').width) + 40
  g.textAlign = 'left'
  g.fillStyle = t.text; g.font = font(700, 58); g.fillText(fit(g, text.name, CARD_W - nx - PAD - right), nx, NAME_Y + 2)
  g.fillStyle = t.sub; g.font = font(500, 21); g.fillText(fit(g, text.sub, CARD_W - nx - PAD - right), nx, NAME_Y + 58)
  // 구분 줄
  g.save(); g.strokeStyle = t.accent; g.globalAlpha = 0.35; g.lineWidth = 1.5; g.beginPath(); g.moveTo(PAD, RULE_Y); g.lineTo(CARD_W - PAD, RULE_Y); g.stroke(); g.restore()
  // 칩 2열
  chips.forEach((ch, i) => drawChip(g, t, ch, PAD + (i % 2) * (CHIP_W + COLGAP), CHIPS_Y + Math.floor(i / 2) * (CHIP_H + GAP)))
  if (!chips.length) { g.textAlign = 'center'; g.fillStyle = t.sub; g.font = font(600, 20); g.fillText('입고 있는 아이템이 없어요', CARD_W / 2, CHIPS_Y + 40) }
  // 바닥: 사이트 주소
  g.textAlign = 'left'; g.fillStyle = t.sub; g.font = font(600, 18)
  g.fillText('pinkbean-customize.com', PAD, H - 56)
  g.textAlign = 'right'; g.fillText('핑크빈 커마샵', CARD_W - PAD, H - 56)
  g.textAlign = 'left'
}

// 칩: 아이콘 칸 + 부위 · 이름 · 염색 값 한 줄(칸 테두리 · 띠를 덜어 깔끔하게)
function drawChip (g: CanvasRenderingContext2D, t: CardTheme, ch: ShareChip, x: number, y: number) {
  round(g, x, y, CHIP_W, CHIP_H, 18); g.fillStyle = t.chip; g.fill(); g.strokeStyle = t.chipLine; g.lineWidth = 1; g.stroke()
  const ib = 72, ix = x + 16, iy = y + (CHIP_H - ib) / 2
  round(g, ix, iy, ib, ib, 14); g.fillStyle = t.iconBg; g.fill()
  if (ch.icon && ch.icon.width && ch.icon.height) {
    // 칩 캔버스는 디바이스 px 로 그려져 있다 — 칸에 맞게 줄이되 도트는 nearest(키울 때) / 부드럽게(줄일 때)
    const sc = Math.min((ib - 10) / ch.icon.width, (ib - 10) / ch.icon.height)
    g.imageSmoothingEnabled = sc < 1
    const w = ch.icon.width * sc, h = ch.icon.height * sc
    g.drawImage(ch.icon, Math.round(ix + (ib - w) / 2), Math.round(iy + (ib - h) / 2), w, h)
    g.imageSmoothingEnabled = true
  }
  const tx = ix + ib + 16, tw = CHIP_W - (tx - x) - 16
  g.textAlign = 'left'; g.textBaseline = 'middle'
  g.fillStyle = t.sub; g.font = font(700, 14); g.fillText(fit(g, ch.part, tw), tx, y + 26) // 강조색은 흰 칩 위에서 묻히는 디자인이 있다(핑크빈)
  g.fillStyle = t.text; g.font = font(700, 20); g.fillText(fit(g, ch.name, tw), tx, y + 52)
  // 염색 값 한 줄: (점) 낱말 값 · 칸 사이 14px. 염색하지 않았으면 낱말 하나
  const cy = y + 80, cells = ch.band.cells?.length ? ch.band.cells : null
  if (!cells) { g.fillStyle = t.key; g.font = font(500, 14); g.fillText(fit(g, ch.band.muted || '', tw), tx, cy); return }
  let px = tx
  for (const cell of cells) {
    if (px > tx + tw - 20) break
    if (cell.dot) {
      g.beginPath(); g.arc(px + 5, cy, 5, 0, Math.PI * 2)
      if (cell.dot === 'all') { const gr = g.createConicGradient(0, px + 5, cy); ['#ff6f8f', '#ffd36b', '#7fd88a', '#6bb8ff', '#c79bff', '#ff6f8f'].forEach((col, j, a) => gr.addColorStop(j / (a.length - 1), col)); g.fillStyle = gr } else g.fillStyle = cell.dot
      g.fill(); px += 15
    }
    g.fillStyle = t.key; g.font = font(500, 14); g.fillText(cell.key, px, cy); px += g.measureText(cell.key).width + 4
    g.fillStyle = t.val; g.font = font(700, 14); g.fillText(cell.val, px, cy); px += g.measureText(cell.val).width + 14
  }
}

// ── 사진 칸 ─────────────────────────────────────────────
// 캐릭터 판(canvasExport.drawShot — 게임 1배)과 그 판의 발 자리. 보기(view) = 사진 칸 가운데에 올 점(발 기준, 게임 칸)과 배율 z(게임 1칸 = 카드 z px).
export type CardBoard = { c: HTMLCanvasElement; x0: number; y0: number; x1: number; y1: number; foot: { x: number; y: number } }
export type CardView = { z: number; x: number; y: number }
// 배경: 'theme' = 카드 색, 'room' 피팅룸, 캐시샵 배경(cs0~), 'white' · 'black', 올린 그림의 id
export type CardBg = { sel: string; images: StageBgImage[] }

// 처음 보기 — 그림 상자가 사진 칸 높이의 62%(폭은 80%)가 되는 가장 큰 정수 배율, 상자 가운데를 칸 가운데에
export function defaultView (b: CardBoard | null): CardView {
  if (!b) return { z: 5, x: 0, y: -30 }
  const w = b.x1 - b.x0 + 1, h = b.y1 - b.y0 + 1
  // 그림(캐릭터 + 명찰 · 말풍선 · 칭호)이 사진 칸 높이의 84% · 폭의 94% 안에 드는 가장 큰 정수 배율(사용자 지시 — 0.62 · 0.8 은 멀었다)
  const z = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, Math.floor(Math.min((PHOTO.h * 0.84) / h, (PHOTO.w * 0.94) / w))))
  return { z, x: (b.x0 + b.x1 + 1) / 2 - b.foot.x, y: (b.y0 + b.y1 + 1) / 2 - b.foot.y }
}

const imgCache = new Map<string, Promise<HTMLImageElement | HTMLCanvasElement>>()
const loadImg = (src: string) => new Promise<HTMLImageElement>((res, rej) => { const img = new Image(); img.onload = () => res(img); img.onerror = rej; img.src = src })
// 배경 그림(피팅룸 = 지금 시각의 빛을 입힌 한 장 — 한 번만 만든다)
export function cardBgImage (sel: string, images: StageBgImage[]): Promise<HTMLImageElement | HTMLCanvasElement> | null {
  const src = sel === 'room' ? 'room' : CASH_BGS.find((c) => c.id === sel)?.src ?? images.find((i) => i.id === sel)?.src
  if (!src) return null
  let p = imgCache.get(src)
  if (!p) { p = (src === 'room' ? roomLit(13) : loadImg(src)) as Promise<HTMLImageElement | HTMLCanvasElement>; p.catch(() => imgCache.delete(src)); imgCache.set(src, p) }
  return p
}

// 사진 칸을 그린다(디바이스 px 로 — 캐릭터 배율이 정수가 되게). img = cardBgImage 가 받은 그림(카드 색 · 흰색 · 검은색은 없음).
export function drawCardPhoto (g: CanvasRenderingContext2D, S: number, t: CardTheme, sel: string, img: HTMLImageElement | HTMLCanvasElement | null, b: CardBoard | null, v: CardView, base: CardView) {
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
  } else if (sel === 'white' || sel === 'black') fill(STAGE_COLORS[sel])
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
  g.save(); g.strokeStyle = t.accent; g.globalAlpha = 0.55; g.lineWidth = 2 * S; round(g, px, py, pw, ph, PHOTO.r * S); g.stroke(); g.restore()
  g.imageSmoothingEnabled = true
}
