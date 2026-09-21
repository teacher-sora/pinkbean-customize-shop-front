// 참고 이미지 올리기 전 줄이기(2026-09-21 사용자 지시: 5MB 제한 + 너무 크면 줄이거나 화질을 낮춘다).
//
// 버킷은 5MB · 이미지 형식만 받는다(supabase/0011). 휴대폰 사진은 원본이 수 MB라 상세를 열 때마다 그만큼 내려받게 되고,
// Supabase 무료 전송량(월 5GB)을 금방 쓴다. 그래서 올리기 전에:
//  · 긴 변이 MAX_SIDE 를 넘거나 SOFT_BYTES 보다 크면 → 긴 변 MAX_SIDE 로 줄여 WebP(투명 유지)로 다시 굽는다.
//  · 그래도 크면 화질을 단계적으로 낮추고, 그래도 크면 크기를 더 줄인다.
//  · 작은 이미지는 그대로 둔다(다시 구우면 오히려 커지거나 뭉개진다). 움직이는 GIF 는 첫 장면만 남는다(크면).
// 결과가 5MB 를 넘을 수 없게 끝까지 줄인다. 브라우저가 WebP 인코딩을 못 하면 JPEG.

const MAX_SIDE = 2048
const SOFT_BYTES = 1_200_000
const HARD_BYTES = 5 * 1024 * 1024

const blobOf = (c: HTMLCanvasElement, type: string, q: number) =>
  new Promise<Blob | null>((res) => c.toBlob(res, type, q))

async function decode(file: File): Promise<ImageBitmap | HTMLImageElement> {
  try { return await createImageBitmap(file) } catch { /* 사파리 구버전 등 */ }
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    return img
  } finally { URL.revokeObjectURL(url) }
}

export async function shrinkPlazaImage(file: File): Promise<File> {
  if (!file.type.startsWith('image/')) throw new Error('이미지 파일만 올릴 수 있어요')
  const src = await decode(file)
  const w0 = 'naturalWidth' in src ? src.naturalWidth : src.width
  const h0 = 'naturalHeight' in src ? src.naturalHeight : src.height
  if (!w0 || !h0) throw new Error('이미지를 읽지 못했어요')
  if (Math.max(w0, h0) <= MAX_SIDE && file.size <= SOFT_BYTES) return file

  const probe = document.createElement('canvas')
  const webp = probe.toDataURL('image/webp').startsWith('data:image/webp')
  const type = webp ? 'image/webp' : 'image/jpeg'
  let side = Math.min(MAX_SIDE, Math.max(w0, h0))
  for (let round = 0; round < 6; round++) {
    const k = side / Math.max(w0, h0)
    const c = document.createElement('canvas')
    c.width = Math.max(1, Math.round(w0 * k)); c.height = Math.max(1, Math.round(h0 * k))
    const ctx = c.getContext('2d')!
    if (!webp) { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height) } // JPEG 는 투명이 검게 된다
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(src as CanvasImageSource, 0, 0, c.width, c.height)
    for (const q of [0.86, 0.78, 0.7]) {
      const b = await blobOf(c, type, q)
      if (b && b.size <= SOFT_BYTES) return new File([b], file.name.replace(/\.[^.]+$/, '') + (webp ? '.webp' : '.jpg'), { type })
      if (b && q === 0.7 && b.size <= HARD_BYTES && round >= 2) return new File([b], file.name.replace(/\.[^.]+$/, '') + (webp ? '.webp' : '.jpg'), { type })
    }
    side = Math.round(side * 0.8)
  }
  if (file.size <= HARD_BYTES) return file
  throw new Error('이미지가 너무 커요. 다른 이미지를 골라 주세요')
}
