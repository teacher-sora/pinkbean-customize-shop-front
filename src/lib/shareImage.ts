// 공유 링크 미리보기 카드(카카오톡·디스코드 등 og:image) 이미지 — 1200×630 JPEG.
// 미리보기와 같은 배경(lib/stageBg 에서 고른 것) 위에 프리셋 캐릭터를 정수 배율(도트 선명)로 중앙 합성한다.
//  · 피팅룸은 낮의 그림 그대로 깐다(보는 사람의 시각과 상관없이 늘 같은 카드). 캐릭터 발에 무대의 발자리를 맞춘다.
//  · 직접 올린 그림은 이 브라우저 밖으로 보내지 않는다 → 그때는 피팅룸을 깐다.
//  · 캐릭터 캔버스는 카드보다 넉넉히 크게 그린다 — 카드 가장자리에서만 잘리고, 캔버스 경계 때문에 그림 중간에서 잘리지 않게.
// 복사 시점에 브라우저에서 그려 /api/share 로 코드와 함께 올린다(서버는 캔버스·염색 로직이 없어 여기서 그린다).
import { ROOM } from '@/components/shop/scene/sceneData'
import { SCENE_SRC } from '@/components/shop/scene/sceneSrc'
import { STAGE_COLORS } from '@/components/shop/preview/StageBg'
import { getStageBg } from '@/lib/stageBg'
import { loadAnima, loadIndex } from '@/lib/core/data'
import { MODEL_REF, computeModelPlacement } from '@/lib/core/modelPlacement'
import { renderCharacter } from '@/lib/core/render'
import { composeSnapshot } from '@/lib/core/snapRender'
import type { Snapshot } from '@/components/shop/ShopContext'

export const SHARE_IMG_W = 1200
export const SHARE_IMG_H = 630
const FRACTION = 0.6 // 마네킹 높이 = 카드 높이의 60%(카톡이 좌우를 살짝 잘라도 캐릭터는 중앙에 남는다)
const ROOM_PX = 2   // 피팅룸 배율(정수 — 도트 선명). 카드를 덮는 가장 작은 정수(956×538 → 1912×1076)
const MARGIN = 2    // 캐릭터 캔버스 = 카드의 두 배. 큰 무기 · 이펙트도 카드 끝까지 그려진다

const loadImg = (src: string) => new Promise<HTMLImageElement>((res, rej) => {
  const img = new Image()
  img.onload = () => res(img); img.onerror = rej
  img.src = src
})

// 성공 시 base64(데이터 URL 접두어 제외) JPEG, 실패 시 null(링크는 기본 카드 이미지로 동작).
export async function renderShareImage(snap: Snapshot): Promise<string | null> {
  try {
    const sel = getStageBg().sel, color = STAGE_COLORS[sel]
    const [index, animaRaces, room] = await Promise.all([loadIndex(), loadAnima().catch(() => []), color ? Promise.resolve(null) : Promise.all(SCENE_SRC.room.map(loadImg))])
    const comp = await composeSnapshot(snap, index, animaRaces)
    if (!comp) return null
    const out = document.createElement('canvas')
    out.width = SHARE_IMG_W; out.height = SHARE_IMG_H
    const ctx = out.getContext('2d')!
    // 캐릭터: 카드의 두 배 캔버스에 정수 배율로 그려 가운데에 얹는다(넘치는 곳은 카드 끝에서 잘린다).
    const p = computeModelPlacement({ divW: SHARE_IMG_W, divH: SHARE_IMG_H, dpr: 1, margin: MARGIN, fraction: FRACTION, snap: true })
    const ch = document.createElement('canvas')
    // 라이딩(탑승)은 가로 정렬 기준이 다르다 — 합성기가 알려 준 기준을 그대로 쓴다(카드·미리보기와 동일).
    await renderCharacter(ch, comp.placed, { scale: p.scale, box: p.box, anchor: p.anchor, centerX: comp.center === 'x', centerMount: comp.center === 'mount', override: comp.overrides, effects: comp.effects })
    ctx.imageSmoothingEnabled = false
    // 미리보기와 같은 규칙: computeModelPlacement 가 몸통(navel)을 MODEL_REF 기준으로 박스 정중앙에 고정한다.
    // (그려진 픽셀 전체 bbox 로 맞추면 총·가방이 긴 코디는 몸통이 한쪽으로 밀려 보였다 — 사용자 피드백으로 되돌림)
    // 세로는 몸통 중앙에서 '발 아래 빈 공간의 절반'만큼 내린다 — 모자·귀 등으로 위로 길어지는 코디가 대부분이라 정중앙이면 위로 붙어 보였다.
    const feetGap = SHARE_IMG_H / 2 - (MODEL_REF.bodyRefH / 2) * p.scale
    const dy = Math.round(feetGap / 2)
    // 배경. 피팅룸은 무대의 발자리(ROOM.foot)를 캐릭터 발(배꼽 아래 32게임px = 마네킹 중심 −11 + 아래 끝 21)에 맞춘다
    if (room) {
      const footY = SHARE_IMG_H / 2 + dy + (-MODEL_REF.centerDy + 21) * p.scale
      ctx.fillStyle = '#17120f'; ctx.fillRect(0, 0, SHARE_IMG_W, SHARE_IMG_H)
      const x = Math.round(SHARE_IMG_W / 2 - ROOM.foot[0] * ROOM_PX), y = Math.round(footY - ROOM.foot[1] * ROOM_PX)
      for (const img of room) ctx.drawImage(img, x, y, ROOM.w * ROOM_PX, ROOM.h * ROOM_PX)
    } else { ctx.fillStyle = color; ctx.fillRect(0, 0, SHARE_IMG_W, SHARE_IMG_H) }
    ctx.drawImage(ch, Math.round((SHARE_IMG_W - ch.width) / 2), Math.round((SHARE_IMG_H - ch.height) / 2) + dy)
    return out.toDataURL('image/jpeg', 0.92).split(',')[1] || null
  } catch { return null }
}
