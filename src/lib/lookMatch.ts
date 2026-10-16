// 닉네임 불러오기: 이름이 같은 헤어·성형 가운데 캐릭터가 실제로 쓰는 것을 캐릭터 이미지로 고른다.
//
// 왜: 넥슨은 헤어·성형 이름을 (남)/(여) 없이 준다('차차 얼굴'). 카탈로그에는 같은 이름이 여럿이고 그림도 다를 수 있다 —
// 차차 얼굴은 네 묶음인데 그림은 둘이다(50037 (남) = 54036 (여), 51051 (여) = 53021 (남)). 남캐도 분홍 눈두덩 그림을 쓴다.
// (남)/(여) 는 parser 가 id 규칙으로 붙인 것이라 캐릭터 성별로 고르면 틀린다.
//
// 방법: 후보마다 그 색의 정면 그림 한 장(meta.thumb)을 넥슨 캐릭터 이미지(서기, 기본 표정) 위에서 밀어 보며
// 색이 같은 픽셀 수가 가장 많은 자리를 찾는다. 가장 잘 맞는 후보가 뚜렷하게 앞설 때만 고르고, 아니면 null(이름 규칙으로 돌아간다).
import { loadMeta, type ListItem } from '@/lib/core/data'
import { variantId, type PaletteParams } from '@/lib/core/dye'
import { loadImage } from '@/lib/core/render'

const pixelsOf = (img: CanvasImageSource, w: number, h: number): ImageData | null => {
  const c = document.createElement('canvas'); c.width = w; c.height = h
  const x = c.getContext('2d', { willReadFrequently: true }); if (!x) return null
  x.drawImage(img, 0, 0)
  return x.getImageData(0, 0, w, h)
}

// 넥슨 캐릭터 이미지(우리 서버가 중계한다 — /api/nick/img). 실패하면 null.
export async function loadLookPixels(url: string): Promise<ImageData | null> {
  try {
    const r = await fetch(`/api/nick/img?u=${encodeURIComponent(url)}`)
    if (!r.ok) return null
    const bmp = await createImageBitmap(await r.blob())
    return pixelsOf(bmp, bmp.width, bmp.height)
  } catch { return null }
}

// 그림 한 장이 이미지의 어느 자리에서 가장 잘 맞는가(맞은 픽셀 수 - 틀린 픽셀 수). 틀린 것을 빼야
// 안경 · 앞머리에 함께 가려진 부분이 아니라 두 그림이 다른 부분(눈두덩, 코 색)이 점수를 가른다.
function bestScore(look: ImageData, spr: ImageData): number {
  const pts: number[] = []
  for (let i = 0; i < spr.data.length; i += 4) if (spr.data[i + 3] > 200) pts.push((i / 4) % spr.width, Math.floor(i / 4 / spr.width), spr.data[i], spr.data[i + 1], spr.data[i + 2])
  if (!pts.length) return 0
  const W = look.width, H = look.height, d = look.data
  let best = 0
  for (let oy = 0; oy + spr.height <= H; oy++) {
    for (let ox = 0; ox + spr.width <= W; ox++) {
      let s = 0
      for (let k = 0; k < pts.length; k += 5) {
        const j = ((oy + pts[k + 1]) * W + ox + pts[k]) * 4
        if (d[j + 3] <= 200) continue
        if (Math.abs(d[j] - pts[k + 2]) + Math.abs(d[j + 1] - pts[k + 3]) + Math.abs(d[j + 2] - pts[k + 4]) < 24) s++
        else s--
      }
      if (s > best) best = s
    }
  }
  return best
}

// pal = 넥슨 염색을 옮긴 팔레트. 섞은 염색이면 두 색 그림을 그 비율로 섞어 견준다(하늘과땅차이: 검정 + 초록 50% — 한 색만으로는 눈이 맞지 않는다). 그림이 같은 후보끼리는 점수가 같아 고르지 않는다(어느 쪽이든 모습이 같다).
// 한 코디의 프리셋마다 같은 헤어 · 성형을 다시 고르지 않게 이미지별로 기억한다.
const memo = new WeakMap<ImageData, Map<string, Promise<ListItem | null>>>()
export function pickBySprite(look: ImageData, cands: ListItem[], pal: PaletteParams): Promise<ListItem | null> {
  let m = memo.get(look); if (!m) memo.set(look, (m = new Map()))
  const k = `${pal.baseColor}/${pal.mixColor}/${pal.ratio}|${cands.map((c) => c.id).join(',')}`
  let p = m.get(k); if (!p) m.set(k, (p = pick(look, cands, pal)))
  return p
}
async function spriteOf(c: ListItem, thumb: string, color: number): Promise<ImageData | null> {
  const png = c.colorGroup != null ? thumb.replace(`sprites/${c.id}/`, `sprites/${variantId(c.colorGroup, color, c.slot)}/`) : thumb
  const img = await loadImage(png, true)
  return pixelsOf(img, img.naturalWidth, img.naturalHeight)
}
async function pick(look: ImageData, cands: ListItem[], pal: PaletteParams): Promise<ListItem | null> {
  const scored = await Promise.all(cands.map(async (c) => {
    try {
      const m = await loadMeta(c.id)
      if (!m.thumb) return { c, s: 0 }
      const spr = await spriteOf(c, m.thumb, pal.baseColor)
      if (spr && pal.mixColor != null && pal.ratio > 0) {
        const mix = await spriteOf(c, m.thumb, pal.mixColor).catch(() => null)
        if (mix && mix.width === spr.width && mix.height === spr.height) {
          const r = pal.ratio / 100
          for (let i = 0; i < spr.data.length; i++) spr.data[i] = Math.round(spr.data[i] * (1 - r) + mix.data[i] * r)
        }
      }
      return { c, s: spr ? bestScore(look, spr) : 0 }
    } catch { return { c, s: 0 } }
  }))
  scored.sort((a, b) => b.s - a.s)
  const [a, b] = scored
  // 먹음쟁이(차차 얼굴, 안경을 씀)에서 잰 값: 맞는 그림 72, 다른 그림 66. 같은 그림끼리는 0 차이다.
  if (!a || a.s < 15) return null
  if (b && a.s - b.s < 3) return null
  return a.c
}
