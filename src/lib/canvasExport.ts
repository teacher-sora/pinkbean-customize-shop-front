// 모델(캐릭터) → "복사/저장용 이미지" 유틸. **우클릭 시점에만** 실행되므로 렌더 루프·성능에 영향 없음.
//
// ★ 복사 이미지의 **단일 규칙**(2026-10-02 사용자 지시). 우측 미리보기 · 광장/프리셋 카드 · 부위 카드 ·
//   염색 미리보기가 전부 modelShotBlob 하나로 만든다. 예전엔 두 갈래였고 서로 달랐다.
//    · 카드류: 화면 캔버스의 **그림 전체 테두리**를 가운데에 두고 비정수 배율로 늘렸다 → 무기·이펙트가 한쪽으로
//      길면 몸통이 반대쪽으로 밀렸다(여백은 적당).
//    · 우측 미리보기: 몸통을 가운데 두고 다시 그렸지만 630px 고정 판이라 흰 여백이 지나치게 넓었다.
//   지금 규칙 = 둘의 장점만:
//    1) 화면 픽셀을 가공하지 않고 합성 입력(placed)으로 **다시 그린다** — 정수 배율(게임 픽셀 ×SHOT_SCALE)이라 도트가 선명하고,
//       카드가 작아도 결과 해상도가 같다. 가운데 기준은 화면과 같다(마네킹 중심 / 라이딩은 navel·메카).
//    2) 그 중심을 **그대로 둔 채** 그림이 닿는 데까지만 자른다(중심에서 가장 먼 픽셀까지가 반 변) → 몸통은 정중앙,
//       여백은 판 크기가 아니라 그림 크기에 비례(SHOT_PAD).
//    3) **배경은 투명**이다(2026-10-04 사용자 지시 — 건의함: "저장할 때 배경이 투명하면 좋겠다"). 전에는 흰 바탕을 깔았다.
//       여백(2번)은 그대로 투명 여백으로 남는다. ⚠️ 투명을 모르는 곳에 붙여 넣으면(그림판·일부 메신저) 바탕이 검게 나올 수 있다.
// renderCharacter 가 CORS 로 이미지를 로드해 그리므로 taint 되지 않는다 → getImageData / toBlob 이 동작한다.
import type { PlacedLayer } from './core/assemble'
import { computeModelPlacement } from './core/modelPlacement'
import { renderCharacter, type EffectDraw } from './core/render'

// 다시 그릴 때 필요한 것 = 화면에 그린 입력 그대로. center* 는 화면 렌더와 같은 값을 넘긴다.
export type ModelShot = {
  placed: PlacedLayer[]
  override?: Map<string, HTMLCanvasElement>
  effects?: EffectDraw[]
  flip?: boolean
  centerX?: boolean; centerXOnly?: boolean; centerMount?: boolean // 라이딩 정렬(renderCharacter 옵션 그대로)
  centerDx?: number; centerDy?: number                            // 뒷모습 등 중심 오프셋(없으면 기본)
}

const SHOT_SCALE = 4   // 게임 픽셀 1 = 이미지 4px(정수 — 도트가 깨지지 않는다)
const SHOT_BOX = 480   // 다시 그리는 판(게임 픽셀). 큰 탈것·이펙트도 잘리지 않을 만큼 넉넉히, 결과 크기와는 무관
const SHOT_PAD = 0.12  // 결과 한 변 대비 사방 여백 비율
const SHOT_MIN = 256   // 결과 최소 한 변(px)

export async function modelShotBlob (shot: ModelShot): Promise<Blob | null> {
  if (!shot.placed.length) return null
  const off = document.createElement('canvas')
  const dev = SHOT_BOX * SHOT_SCALE
  const pl = computeModelPlacement({ divW: dev, divH: dev, dpr: 1, margin: 1, fraction: 0, scale: SHOT_SCALE, centerDx: shot.centerDx, centerDy: shot.centerDy })
  try {
    await renderCharacter(off, shot.placed, {
      scale: pl.scale, box: pl.box, anchor: pl.anchor, flip: shot.flip,
      centerX: shot.centerX, centerXOnly: shot.centerXOnly, centerMount: shot.centerMount,
      override: shot.override, effects: shot.effects,
    })
  } catch { return null }
  const w = off.width, h = off.height
  const sctx = off.getContext('2d')
  if (!w || !h || !sctx) return null
  // 중심(판 한가운데 = 몸통)에서 가장 먼 불투명 픽셀까지의 거리 → 결과의 반 변.
  const cx = w / 2, cy = h / 2
  let half = 0
  try {
    const data = sctx.getImageData(0, 0, w, h).data
    for (let y = 0; y < h; y++) {
      const dy = Math.max(cy - y, y + 1 - cy)
      for (let x = 0; x < w; x++) {
        if (data[(y * w + x) * 4 + 3] > 8) {
          const d = Math.max(dy, cx - x, x + 1 - cx)
          if (d > half) half = d
        }
      }
    }
  } catch { return null } // 혹시라도 taint 면 조용히 포기
  if (!half) return null
  let side = Math.max(SHOT_MIN, Math.ceil((half * 2) / (1 - SHOT_PAD * 2)))
  side += side % 2 // 짝수 — 중심이 픽셀 경계에 정확히 놓인다(반 픽셀 밀림 없음)
  const out = document.createElement('canvas')
  out.width = side; out.height = side
  const ctx = out.getContext('2d')!
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(off, side / 2 - cx, side / 2 - cy) // 늘리지 않고 그대로 옮긴다(1:1). 바탕은 칠하지 않는다 — 투명
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
