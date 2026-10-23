// 코디 공유 이미지 — 지금 캐릭터와 장착 칩(아이템 그림 · 부위 · 이름 · 염색 값)을 한 장에 정돈해 그린다(사용자 지시 —
// 칩이 늘어 모바일 2열 화면으로는 한 번에 담기지 않았다). **어느 기기에서나 같은 한 장**이다: 폭 W 로 고정하고 칩은 늘 2열,
// 높이만 칩 수를 따라 늘어난다. 누를 때만 그린다(서버를 거치지 않는다).
//  · 캐릭터 = 우클릭 저장과 같은 그림(canvasExport.drawShot — 미리보기의 합성 입력을 게임 1배로 다시 그린다). 칸에 들어가는 가장 큰
//    정수 배율로 키운다(도트가 뭉개지지 않게 — 소수 배율 금지).
//  · 칩 그림 = 화면의 칩과 같은 규칙으로 CORS 로 다시 그린 캔버스(DyeSprite.chipIcon — 화면 칩은 비-CORS 그림이 섞여 내보낼 수 없다).
//  · 글자 = 사이트 글꼴(Wanted Sans). 그리기 전에 쓰는 굵기를 받아 둔다(받기 전에 그리면 대체 글꼴이 박힌다).
import { drawShot, type ModelShot } from './canvasExport'

export type ShareChip = {
  part: string                // 부위 이름(헤어 · 모자 …)
  name: string                // 아이템 이름
  icon: HTMLCanvasElement | null
  band: ShareBand             // 칩 아래 띠(염색 값)
}
// 띠 = 같은 폭의 칸들. 칸마다 점(색) · 낱말 · 값. 염색하지 않았으면 낱말 하나(염색 없음 / 염색 불가)
export type ShareBand = { muted?: string; cells?: { dot?: string; key: string; val: string }[] }

const W = 1080, PAD = 40, GAP = 16
const LEFT = 360                                  // 캐릭터 칸 폭
const CHIP_H = 104, CHIP_W = (W - PAD * 2 - LEFT - 24 - GAP) / 2
const C = { bg: '#fbf8f4', panel: '#ffffff', line: '#ebe3da', soft: '#f7f2ec', pink: '#ec86ac', text: '#3d372f', sub: '#a39a90', band: '#6f655b', key: '#b0a599', bandLine: '#f1e8df' }

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

export async function shareCardBlob (o: { shot: ModelShot | null; chips: ShareChip[]; title: string }): Promise<Blob | null> {
  const fam = getComputedStyle(document.body).fontFamily || 'sans-serif'
  const font = (wt: number, px: number) => `${wt} ${px}px ${fam}`
  try { await Promise.all([500, 600, 700].map((wt) => document.fonts.load(font(wt, 20), '핑크빈 커마샵 가나다 0123'))) } catch { /* 없으면 지금 있는 글꼴로 */ }

  const rows = Math.max(1, Math.ceil(o.chips.length / 2))
  const gridH = rows * CHIP_H + (rows - 1) * GAP
  const HEAD = 72, FOOT = 56
  const bodyH = Math.max(gridH, 460)
  const H = PAD + HEAD + bodyH + FOOT
  const S = 2 // 저장 해상도(선명하게 — 크기는 W × H 의 두 배)
  const c = document.createElement('canvas'); c.width = W * S; c.height = H * S
  const g = c.getContext('2d')!
  g.scale(S, S)
  g.fillStyle = C.bg; g.fillRect(0, 0, W, H)

  // 머리: 로고 글자 · 프리셋 이름
  g.textBaseline = 'middle'
  g.fillStyle = C.pink; g.font = font(700, 28); g.fillText('핑크빈 커마샵', PAD, PAD + 24)
  g.fillStyle = C.band; g.font = font(600, 20); g.textAlign = 'right'
  g.fillText(fit(g, o.title, W / 2), W - PAD, PAD + 24); g.textAlign = 'left'

  const top = PAD + HEAD
  // 캐릭터 칸
  round(g, PAD, top, LEFT, bodyH, 16); g.fillStyle = C.panel; g.fill(); g.strokeStyle = C.line; g.lineWidth = 1; g.stroke()
  const d = o.shot ? await drawShot(o.shot) : null
  if (d) {
    const w = d.x1 - d.x0 + 1, h = d.y1 - d.y0 + 1
    const k = Math.max(1, Math.min(6, Math.floor(Math.min((LEFT - 48) / w, (bodyH - 64) / h))))
    g.imageSmoothingEnabled = false
    const dx = Math.round(PAD + (LEFT - w * k) / 2), dy = Math.round(top + (bodyH - h * k) / 2)
    g.drawImage(d.c, d.x0, d.y0, w, h, dx, dy, w * k, h * k)
    g.imageSmoothingEnabled = true
  }

  // 칩 2열
  const gx = PAD + LEFT + 24
  o.chips.forEach((ch, i) => {
    const x = gx + (i % 2) * (CHIP_W + GAP), y = top + Math.floor(i / 2) * (CHIP_H + GAP)
    round(g, x, y, CHIP_W, CHIP_H, 12); g.fillStyle = C.panel; g.fill(); g.strokeStyle = C.line; g.stroke()
    // 그림 칸
    const ib = 56, ix = x + 14, iy = y + 12
    round(g, ix, iy, ib, ib, 10); g.fillStyle = C.soft; g.fill()
    if (ch.icon && ch.icon.width && ch.icon.height) {
      // 칩 캔버스는 디바이스 px 로 그려져 있다 — 칸에 맞게 줄이되 도트는 nearest(키울 때) / 부드럽게(줄일 때)
      const sc = Math.min((ib - 8) / ch.icon.width, (ib - 8) / ch.icon.height)
      g.imageSmoothingEnabled = sc < 1
      const w = ch.icon.width * sc, h = ch.icon.height * sc
      g.drawImage(ch.icon, Math.round(ix + (ib - w) / 2), Math.round(iy + (ib - h) / 2), w, h)
      g.imageSmoothingEnabled = true
    }
    // 부위 · 이름
    const tx = ix + ib + 14, tw = CHIP_W - (tx - x) - 14
    g.fillStyle = C.sub; g.font = font(500, 15); g.fillText(fit(g, ch.part, tw), tx, y + 28)
    g.fillStyle = C.text; g.font = font(600, 19); g.fillText(fit(g, ch.name, tw), tx, y + 54)
    // 띠(염색 값) — 같은 폭의 칸, 칸 사이 세로 줄
    const by = y + 78, bh = CHIP_H - 78
    g.strokeStyle = C.bandLine; g.beginPath(); g.moveTo(x + 12, by + 0.5); g.lineTo(x + CHIP_W - 12, by + 0.5); g.stroke()
    const cells = ch.band.cells?.length ? ch.band.cells : null
    const n = cells ? cells.length : 1, cw = (CHIP_W - 24) / n, cy = by + bh / 2
    for (let k = 0; k < n; k++) {
      const cx = x + 12 + k * cw
      if (k) { g.beginPath(); g.moveTo(Math.round(cx) + 0.5, by + 6); g.lineTo(Math.round(cx) + 0.5, by + bh - 6); g.stroke() }
      g.textAlign = 'center'
      if (!cells) { g.fillStyle = C.key; g.font = font(600, 14); g.fillText(ch.band.muted || '', cx + cw / 2, cy); g.textAlign = 'left'; continue }
      const cell = cells[k]
      g.font = font(500, 14); const kw = g.measureText(cell.key).width
      g.font = font(600, 14); const vw = g.measureText(cell.val).width
      const dot = cell.dot ? 12 : 0, total = dot + (dot ? 5 : 0) + kw + 4 + vw
      let px = cx + (cw - total) / 2
      g.textAlign = 'left'
      if (cell.dot) {
        g.beginPath(); g.arc(px + 5, cy, 5, 0, Math.PI * 2)
        if (cell.dot === 'all') { const gr = g.createConicGradient(0, px + 5, cy); ['#ff6f8f', '#ffd36b', '#7fd88a', '#6bb8ff', '#c79bff', '#ff6f8f'].forEach((col, j, a) => gr.addColorStop(j / (a.length - 1), col)); g.fillStyle = gr } else g.fillStyle = cell.dot
        g.fill(); px += dot + 5
      }
      g.fillStyle = C.key; g.font = font(500, 14); g.fillText(cell.key, px, cy); px += kw + 4
      g.fillStyle = C.band; g.font = font(600, 14); g.fillText(cell.val, px, cy)
    }
    g.textAlign = 'left'
  })
  if (!o.chips.length) { g.fillStyle = C.sub; g.font = font(600, 18); g.fillText('입고 있는 아이템이 없어요', gx, top + 30) }

  // 바닥: 사이트 주소
  g.fillStyle = C.key; g.font = font(500, 15); g.textAlign = 'right'
  g.fillText('pinkbean-customize.com', W - PAD, H - FOOT / 2); g.textAlign = 'left'
  return new Promise((res) => c.toBlob((b) => res(b), 'image/png'))
}
