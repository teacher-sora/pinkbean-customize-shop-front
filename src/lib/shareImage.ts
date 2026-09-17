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
    // 미리보기와 같은 규칙: computeModelPlacement 가 몸통(navel)을 MODEL_REF 기준으로 박스 정중앙에 고정한다.
    // (그려진 픽셀 전체 bbox 로 맞추면 총·가방이 긴 코디는 몸통이 한쪽으로 밀려 보였다 — 사용자 피드백으로 되돌림)
    ctx.drawImage(ch, Math.round((SHARE_IMG_W - ch.width) / 2), Math.round((SHARE_IMG_H - ch.height) / 2))
    return out.toDataURL('image/jpeg', 0.92).split(',')[1] || null
  } catch { return null }
}
