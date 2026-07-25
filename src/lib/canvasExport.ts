// 미리보기 캔버스 → "복사/저장용 이미지" 유틸. **우클릭 시점에만** 실행되므로 렌더 루프·성능에 영향 없음.
//
// 모든 모델 캔버스는 renderCharacter 가 CORS 로 이미지를 로드해 그리므로 taint 되지 않는다
// → getImageData / toBlob 이 전부 동작한다.

// 캔버스의 불투명 영역(=실제 그림)만 잘라 정사각형 배경 위 가운데에 키워 담은 Blob.
// pad = 사방 여백 비율(0.18 이면 모델이 정사각형의 ~64% 를 채움). bg = 배경색(미리보기와 동일 흰색 기본).
export async function canvasToSquareBlob (
  src: HTMLCanvasElement,
  opts?: { size?: number; pad?: number; bg?: string },
): Promise<Blob | null> {
  const size = opts?.size ?? 512
  const pad = opts?.pad ?? 0.18
  const bg = opts?.bg ?? '#fff'
  const w = src.width, h = src.height
  if (!w || !h) return null
  const sctx = src.getContext('2d')
  if (!sctx) return null

  // 불투명 bbox 산출(알파 > 8 인 픽셀 범위).
  let minX = w, minY = h, maxX = -1, maxY = -1
  try {
    const data = sctx.getImageData(0, 0, w, h).data
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (data[(y * w + x) * 4 + 3] > 8) {
          if (x < minX) minX = x; if (x > maxX) maxX = x
          if (y < minY) minY = y; if (y > maxY) maxY = y
        }
      }
    }
  } catch { return null } // 혹시라도 taint 면 조용히 포기(기본 우클릭 메뉴로 폴백)

  const out = document.createElement('canvas')
  out.width = size; out.height = size
  const ctx = out.getContext('2d')!
  ctx.imageSmoothingEnabled = false // 픽셀 아트 → nearest 로 선명하게 확대
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, size, size)
  if (maxX >= minX) {
    const cw = maxX - minX + 1, ch = maxY - minY + 1
    const avail = size * (1 - pad * 2)
    const scale = Math.min(avail / cw, avail / ch)
    const dw = Math.round(cw * scale), dh = Math.round(ch * scale)
    const dx = Math.round((size - dw) / 2), dy = Math.round((size - dh) / 2)
    ctx.drawImage(src, minX, minY, cw, ch, dx, dy, dw, dh)
  }
  return await new Promise((res) => out.toBlob((b) => res(b), 'image/png'))
}

// 클립보드에 PNG 복사. getBlob 은 Promise<Blob> 을 반환해 ClipboardItem 에 그대로 넘긴다
// (사용자 제스처 유지 — Safari 포함).
export async function copyImage (getBlob: () => Promise<Blob | null>): Promise<boolean> {
  try {
    const item = new ClipboardItem({ 'image/png': (async () => {
      const b = await getBlob(); if (!b) throw new Error('no blob'); return b
    })() })
    await navigator.clipboard.write([item])
    return true
  } catch { return false }
}

// PNG 파일로 저장. 가능하면 "다른 이름으로 저장" 대화상자(File System Access API)를 띄워 위치·파일명을
// 사용자가 고르게 한다. 미지원 브라우저(Firefox/Safari/모바일 등)는 기존 다운로드로 폴백한다.
// 반환: 'saved' 저장됨 · 'canceled' 사용자가 취소 · 'error' 실패.
export async function saveImage (getBlob: () => Promise<Blob | null>, filename: string): Promise<'saved' | 'canceled' | 'error'> {
  const name = filename.endsWith('.png') ? filename : `${filename}.png`
  const picker = (window as unknown as { showSaveFilePicker?: (o: unknown) => Promise<{ createWritable: () => Promise<{ write: (b: Blob) => Promise<void>; close: () => Promise<void> }> }> }).showSaveFilePicker
  if (typeof picker === 'function') {
    // 대화상자는 사용자 제스처 안에서 즉시 열어야 하므로 blob 생성보다 먼저 호출한다.
    let handle: { createWritable: () => Promise<{ write: (b: Blob) => Promise<void>; close: () => Promise<void> }> } | null = null
    try {
      handle = await picker({ suggestedName: name, types: [{ description: 'PNG 이미지', accept: { 'image/png': ['.png'] } }] })
    } catch (e) {
      if (e && (e as { name?: string }).name === 'AbortError') return 'canceled' // 사용자가 닫음
      handle = null // 권한 등 다른 실패 → 폴백 다운로드로
    }
    if (handle) {
      try {
        const b = await getBlob(); if (!b) return 'error'
        const w = await handle.createWritable(); await w.write(b); await w.close()
        return 'saved'
      } catch { return 'error' }
    }
  }
  // 폴백: 앵커 다운로드(브라우저 설정에 따라 저장 위치를 물어보거나 다운로드 폴더로 바로 저장).
  try {
    const b = await getBlob(); if (!b) return 'error'
    const url = URL.createObjectURL(b)
    const a = document.createElement('a')
    a.href = url; a.download = name
    document.body.appendChild(a); a.click(); a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    return 'saved'
  } catch { return 'error' }
}
