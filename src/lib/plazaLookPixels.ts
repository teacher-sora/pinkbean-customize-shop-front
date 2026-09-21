// 대회 '같은 조합' — 결과 픽셀 비교(브라우저 전용). 규칙과 정규화는 plazaLook.ts.
//
// 두 스냅샷의 착용 아이템·피부가 같을 때, 염색이 다른 부위마다 **실제로 그려질 결과**를 비교한다.
//  · 부위의 착용 스프라이트(THUMB_VIEW 첫 프레임 레이어)에 게임과 같은 공식으로 각 설정을 적용한다
//    — 헤어·성형 = 색 변이 스프라이트 블렌드(dye.buildOverrides), 그 외 = Prism HSB(dye.applyHsb), 컬러라인 피부 = 라인만 HSB.
//  · 같은 위치의 픽셀끼리 CIE Lab 색 차이 ΔE 를 잰다. ΔE ≥ PIX.de(15) 인 픽셀이 불투명 픽셀의 PIX.share(10%) 이상이면 그 부위는 '다르다'.
//    → 색조 1 차이, 같은 색끼리의 비율 조절, 검은 옷의 색조 회전처럼 결과가 거의 같은 건 같은 조합,
//      색 계열(t)로 일부 색만 확 바꾼 경우처럼 눈에 띄는 영역이 생기면 다른 조합.
//  · 모든 부위가 같을 때만 '같은 조합'.

import { getFrameLayers } from './core/assemble'
import { loadMeta, type ItemMeta } from './core/data'
import { applyHsb, buildOverrides, skinLineHsb, type HsbParams, type PaletteParams } from './core/dye'
import { loadImage } from './core/render'
import { hsbParamSame, lookItems, normLook, palGap, paramSame, type HsbN, type LookSnap } from './plazaLook'
import { THUMB_VIEW } from './shopData'

// 기준(2026-09-21 보정: 아이템 7종 × 염색 14가지 실측).
//  · 픽셀 하나가 '눈에 띄게 다르다' = ΔE ≥ 15. 게임 공식의 색 계단(17 단위) 때문에 색조 1~5 만 돌려도 일부 픽셀이
//    ΔE 10~15 로 튀지만 15 를 넘는 픽셀은 0% 였다(ΔE 10 기준이면 색조 1 이 '다름'으로 잘못 나왔다).
//  · 그런 픽셀이 불투명 픽셀의 10% 이상이면 '다른 부위'.
//    실측: 색조 1~5·채도/명도 ±10 → 전부 같음 / 검은 옷 색조 60 → 같음(실제로 거의 안 바뀜), 명도 +20 → 다름 /
//    채도 높은 모자 색조 15 → 다름 / 헤어 검정 vs 검정70+빨강30 → 같음, 검정 vs 갈색·빨강 vs 주황 → 다름.
export const PIX = { de: 15, share: 0.1 }

export type SkinInfo = { body: string; head: string; colorLine: boolean } | null

// sRGB(0~255) → CIE Lab(D65)
const lin = (c: number) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4 }
const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116)
function lab(r: number, g: number, b: number): [number, number, number] {
  const R = lin(r), G = lin(g), B = lin(b)
  const x = f((R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047), y = f(R * 0.2126 + G * 0.7152 + B * 0.0722), z = f((R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883)
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)]
}

const dataOf = (src: CanvasImageSource & { width: number; height: number }): ImageData => {
  const c = document.createElement('canvas'); c.width = src.width; c.height = src.height
  const ctx = c.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(src, 0, 0)
  return ctx.getImageData(0, 0, c.width, c.height)
}

type Tally = { n: number; far: number; sum: number }
function tally(t: Tally, a: ImageData, b: ImageData) {
  const w = Math.min(a.width, b.width), h = Math.min(a.height, b.height)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * a.width + x) * 4, j = (y * b.width + x) * 4
    const aa = a.data[i + 3], ba = b.data[j + 3]
    if (!aa && !ba) continue
    t.n++
    let de: number
    if (!aa || !ba) de = 100 // 한쪽만 보이는 픽셀 = 확실히 다름
    else {
      const p = lab(a.data[i], a.data[i + 1], a.data[i + 2]), q = lab(b.data[j], b.data[j + 1], b.data[j + 2])
      de = Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2])
    }
    t.sum += de
    if (de >= PIX.de) t.far++
  }
}

// 한 부위(아이템)의 레이어별 결과 픽셀.
async function renderItem(meta: ItemMeta, slot: string, pal?: Record<number, number>, hsb?: HsbN | null): Promise<Map<string, ImageData>> {
  const layers = getFrameLayers(meta, THUMB_VIEW)
  let over = new Map<string, HTMLCanvasElement>()
  if (pal && meta.dyeMode === 'palette') {
    const cs = Object.entries(pal).filter(([, w]) => w > 0).sort((x, y) => y[1] - x[1])
    const p: PaletteParams = cs.length > 1
      ? { baseColor: +cs[0][0], mixColor: +cs[1][0], ratio: Math.round(cs[1][1] * 100) }
      : { baseColor: +cs[0][0], mixColor: null, ratio: 0 }
    over = await buildOverrides([meta], { palette: { [slot]: p }, hsb: {} }, THUMB_VIEW)
  } else if (hsb && meta.dyeMode === 'hsb') {
    over = await buildOverrides([meta], { palette: {}, hsb: { [slot]: hsb } }, THUMB_VIEW)
  }
  const out = new Map<string, ImageData>()
  await Promise.all(layers.map(async (l) => {
    try { out.set(l.png, dataOf(over.get(l.png) ?? await loadImage(l.png, true))) } catch { /* 없는 레이어는 건너뛴다 */ }
  }))
  return out
}
async function renderSkin(skin: NonNullable<SkinInfo>, hsb: HsbN | null): Promise<Map<string, ImageData>> {
  const out = new Map<string, ImageData>()
  for (const id of [skin.body, skin.head]) {
    const meta = await loadMeta(id)
    await Promise.all(getFrameLayers(meta, THUMB_VIEW).map(async (l) => {
      try {
        const img = await loadImage(l.png, true)
        out.set(l.png, dataOf(hsb ? applyHsb(img, skinLineHsb(hsb as HsbParams), l.png) : img))
      } catch { /* noop */ }
    }))
  }
  return out
}
function differs(a: Map<string, ImageData>, b: Map<string, ImageData>): { differ: boolean; share: number; mean: number } {
  const t: Tally = { n: 0, far: 0, sum: 0 }
  for (const [k, x] of a) { const y = b.get(k); if (y) tally(t, x, y) }
  const share = t.n ? t.far / t.n : 0
  return { differ: share >= PIX.share, share, mean: t.n ? t.sum / t.n : 0 }
}

// 두 스냅샷이 화면에서 같은 코디인가(모든 부위가 같을 때만 true). skinOf = 피부 번호 → 몸·머리 id, 컬러라인 여부.
export async function sameLookDeep(a: LookSnap, b: LookSnap, skinOf: (tone: number) => SkinInfo): Promise<boolean> {
  const na = normLook(a), nb = normLook(b)
  if (lookItems(na) !== lookItems(nb)) return false
  if (paramSame(na, nb)) return true
  if (!hsbParamSame(na.skin, nb.skin)) {
    const sk = skinOf(na.tone)
    if (sk?.colorLine && differs(await renderSkin(sk, na.skin), await renderSkin(sk, nb.skin)).differ) return false
  }
  for (const k of Object.keys(na.slots)) {
    const x = na.slots[k], y = nb.slots[k]
    if (x.pal ? palGap(x.pal, y.pal || {}) === 0 : hsbParamSame(x.hsb, y.hsb)) continue
    const meta = await loadMeta(x.id)
    const [ra, rb] = await Promise.all([renderItem(meta, k, x.pal, x.hsb), renderItem(meta, k, y.pal, y.hsb)])
    if (differs(ra, rb).differ) return false
  }
  return true
}

// 한 부위의 두 설정 차이 수치(확인·보정용).
export async function slotDiff(id: string, slot: string, a: { pal?: Record<number, number>; hsb?: HsbN | null }, b: { pal?: Record<number, number>; hsb?: HsbN | null }) {
  const meta = await loadMeta(id)
  const [ra, rb] = await Promise.all([renderItem(meta, slot, a.pal, a.hsb), renderItem(meta, slot, b.pal, b.hsb)])
  return differs(ra, rb)
}

