// 공유 링크 미리보기 카드(카카오톡·디스코드 등 og:image) 이미지 — 1200×630 JPEG.
// 미리보기 스테이지와 같은 배경(center 78% + 톤 그라데이션) 위에 프리셋 캐릭터를 정수 배율(도트 선명)로 중앙 합성한다.
// 복사 시점에 브라우저에서 그려 /api/share 로 코드와 함께 올린다(서버는 캔버스·염색 로직이 없어 여기서 그린다).
import bg from '@/assets/pinkbean-bg.png'
import { loadAnima, loadIndex } from '@/lib/core/data'
import { computeModelPlacement } from '@/lib/core/modelPlacement'
import { renderCharacter } from '@/lib/core/render'
import { composeSnapshot } from '@/lib/core/snapRender'
import type { Snapshot } from '@/components/shop/ShopContext'

export const SHARE_IMG_W = 1200
export const SHARE_IMG_H = 630
const FRACTION = 0.6 // 마네킹 높이 = 카드 높이의 60%(카톡이 좌우를 살짝 잘라도 캐릭터는 중앙에 남는다)

const loadBg = () => new Promise<HTMLImageElement>((res, rej) => {
  const img = new Image()
  img.onload = () => res(img); img.onerror = rej
  img.src = bg.src
})

// 불투명 픽셀의 경계 상자(끝 좌표는 미포함). 전부 투명이면 null.
function opaqueBox(c: HTMLCanvasElement): { x0: number; y0: number; x1: number; y1: number } | null {
  const { data, width, height } = c.getContext('2d')!.getImageData(0, 0, c.width, c.height)
  let x0 = width, y0 = height, x1 = -1, y1 = -1
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    if (data[(y * width + x) * 4 + 3] > 8) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y }
  }
  return x1 < 0 ? null : { x0, y0, x1: x1 + 1, y1: y1 + 1 }
}

// 성공 시 base64(데이터 URL 접두어 제외) JPEG, 실패 시 null(링크는 기본 카드 이미지로 동작).
export async function renderShareImage(snap: Snapshot): Promise<string | null> {
  try {
    const [index, animaRaces, bgImg] = await Promise.all([loadIndex(), loadAnima().catch(() => []), loadBg()])
    const comp = await composeSnapshot(snap, index, animaRaces)
    if (!comp) return null
    const out = document.createElement('canvas')
    out.width = SHARE_IMG_W; out.height = SHARE_IMG_H
    const ctx = out.getContext('2d')!
    // 배경: object-fit cover + object-position center 78% (미리보기 스테이지와 동일)
    const s = Math.max(SHARE_IMG_W / bgImg.width, SHARE_IMG_H / bgImg.height)
    const dw = bgImg.width * s, dh = bgImg.height * s
    ctx.drawImage(bgImg, (SHARE_IMG_W - dw) / 2, (SHARE_IMG_H - dh) * 0.78, dw, dh)
    const tone = ctx.createLinearGradient(0, 0, 0, SHARE_IMG_H)
    tone.addColorStop(0, 'rgba(255,255,255,0.55)'); tone.addColorStop(0.45, 'rgba(255,255,255,0.2)'); tone.addColorStop(1, 'rgba(255,255,255,0.5)')
    ctx.fillStyle = tone; ctx.fillRect(0, 0, SHARE_IMG_W, SHARE_IMG_H)
    // 캐릭터: 카드 전체 크기 캔버스에 정수 배율로 렌더 후 그대로 얹는다.
    const p = computeModelPlacement({ divW: SHARE_IMG_W, divH: SHARE_IMG_H, dpr: 1, margin: 1, fraction: FRACTION, snap: true })
    const ch = document.createElement('canvas')
    await renderCharacter(ch, comp.placed, { scale: p.scale, box: p.box, anchor: p.anchor, override: comp.overrides, effects: comp.effects })
    ctx.imageSmoothingEnabled = false
    // 몸통 기준 배치는 무기·가방·이펙트가 한쪽으로 뻗으면 그림이 치우쳐 보인다 → 실제로 그려진 픽셀 bbox 의 중심을 카드 중앙에.
    const box = opaqueBox(ch)
    const cx = box ? (box.x0 + box.x1) / 2 : ch.width / 2, cy = box ? (box.y0 + box.y1) / 2 : ch.height / 2
    ctx.drawImage(ch, Math.round(SHARE_IMG_W / 2 - cx), Math.round(SHARE_IMG_H / 2 - cy))
    return out.toDataURL('image/jpeg', 0.92).split(',')[1] || null
  } catch { return null }
}
