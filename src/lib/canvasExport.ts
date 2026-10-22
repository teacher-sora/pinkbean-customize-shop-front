// 모델(캐릭터) → "복사/저장용 이미지" 유틸. **우클릭 시점에만** 실행되므로 렌더 루프·성능에 영향 없음.
//
// ★ 복사 이미지의 **단일 규칙**. 우측 미리보기 · 광장/프리셋 카드 · 부위 카드 ·
//   염색 미리보기가 전부 modelShotBlob 하나로 만든다.
//   규칙:
//    1) 화면 픽셀을 가공하지 않고 합성 입력(placed)으로 **다시 그린다** — 카드가 작아도 결과가 같다.
//       가운데 기준은 화면과 같다(마네킹 중심 / 라이딩은 navel·메카).
//    2) 그림이 닿는 데(불투명 픽셀의 상자)까지만 자르고 사방에 조금만 남긴다(SHOT_PAD) → 이펙트가 한쪽에 커도 빈 곳이 없다.
//    3) **게임 크기(1배) 그대로** 내보낸다 — 게임 픽셀 하나가 이미지 픽셀 하나다. 포토샵 등에서 1px 로 쓰려는 것이다
//       (사용자 지시. 2배 · 4배는 도트 하나가 2px · 4px 로 들어갔다). 키우는 것은 받는 쪽에서 한다.
//    4) **배경은 투명**이다. ⚠️ 투명을 모르는 곳에 붙여 넣으면(그림판·일부 메신저) 바탕이 검게 나올 수 있다.
// renderCharacter 가 CORS 로 이미지를 로드해 그리므로 taint 되지 않는다 → getImageData / toBlob 이 동작한다.
import type { PlacedLayer } from './core/assemble'
import { computeModelPlacement } from './core/modelPlacement'
import type { ParticleDraw } from './core/particle'
import type { ChatDraw } from './core/chatUi'
import { renderCharacter, type EffectDraw } from './core/render'

// 다시 그릴 때 필요한 것 = 화면에 그린 입력 그대로. center* 는 화면 렌더와 같은 값을 넘긴다.
export type ModelShot = {
  placed: PlacedLayer[]
  override?: Map<string, HTMLCanvasElement>
  effects?: EffectDraw[]
  particles?: ParticleDraw[] // 다 퍼진 한 장(particle.stillSim)
  chat?: ChatDraw            // 명찰 · 말풍선
  flip?: boolean
  centerX?: boolean; centerXOnly?: boolean; centerMount?: boolean // 라이딩 정렬(renderCharacter 옵션 그대로)
  centerDx?: number; centerDy?: number                            // 뒷모습 등 중심 오프셋(없으면 기본)
  lift?: number              // 캐릭터 전체를 올릴 만큼(월드 px, 위가 음수) — 부유
  chatT?: number             // 움직이는 이모티콘의 시각(ms)
  ringFloor?: number         // 변신 그림을 올리거나 내릴 만큼 — 동작 전체로 잰 값(움짤). 없으면 그리는 한 프레임으로 잰다
}

// 다시 그리는 판(게임 픽셀, 몸통 가운데에서 사방 반씩). 가장 큰 이펙트(시즌 I 챌린저 문장)가 가운데에서 약 344칸까지 그려져
// 480(반 240)이면 잘렸다 — 1,150개 이펙트를 재서 넉넉히 잡는다. 결과 크기와는 무관(그림이 닿는 데까지 다시 자른다)
const SHOT_BOX = 960
export const SHOT_PAD = 4 // 그림 상자 둘레 여백(게임 픽셀)

// 합성 입력을 게임 크기(1배)로 다시 그린 판(SHOT_BOX)과, 그 판에서 불투명 픽셀이 닿는 상자. 그림이 없으면 null.
// 움짤 저장(lib/gifExport)도 프레임마다 이것으로 그린다 — 한 장 저장과 그리는 규칙이 같다.
export async function drawShot (shot: ModelShot): Promise<{ c: HTMLCanvasElement; x0: number; y0: number; x1: number; y1: number } | null> {
  if (!shot.placed.length) return null
  const off = document.createElement('canvas')
  const pl = computeModelPlacement({ divW: SHOT_BOX, divH: SHOT_BOX, dpr: 1, margin: 1, fraction: 0, scale: 1, centerDx: shot.centerDx, centerDy: shot.centerDy })
  try {
    await renderCharacter(off, shot.placed, {
      scale: pl.scale, box: pl.box, anchor: shot.lift ? { x: pl.anchor.x, y: pl.anchor.y + shot.lift } : pl.anchor, flip: shot.flip,
      centerX: shot.centerX, centerXOnly: shot.centerXOnly, centerMount: shot.centerMount,
      override: shot.override, effects: shot.effects, particles: shot.particles, chat: shot.chat, chatT: shot.chatT, ringFloor: shot.ringFloor,
    })
  } catch { return null }
  const w = off.width, h = off.height
  const sctx = off.getContext('2d')
  if (!w || !h || !sctx) return null
  // 불투명 픽셀의 상자.
  let x0 = w, y0 = h, x1 = -1, y1 = -1
  try {
    const data = sctx.getImageData(0, 0, w, h).data
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (data[(y * w + x) * 4 + 3] > 8) {
          if (x < x0) x0 = x
          if (x > x1) x1 = x
          if (y < y0) y0 = y
          y1 = y
        }
      }
    }
  } catch { return null } // 혹시라도 taint 면 조용히 포기
  if (x1 < 0) return null
  return { c: off, x0, y0, x1, y1 }
}

export async function modelShotBlob (shot: ModelShot): Promise<Blob | null> {
  const d = await drawShot(shot)
  if (!d) return null
  const bw = d.x1 - d.x0 + 1 + SHOT_PAD * 2, bh = d.y1 - d.y0 + 1 + SHOT_PAD * 2
  const out = document.createElement('canvas')
  out.width = bw; out.height = bh
  const ctx = out.getContext('2d')!
  // 늘리지 않고 그대로 옮긴다(1:1). 바탕은 칠하지 않는다 — 투명
  ctx.drawImage(d.c, d.x0 - SHOT_PAD, d.y0 - SHOT_PAD, bw, bh, 0, 0, bw, bh)
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

// PNG(움짤은 GIF) 파일로 저장. 가능하면 "다른 이름으로 저장" 대화상자(File System Access API)를 띄워 위치·파일명을
// 사용자가 고르게 한다. 미지원 브라우저(Firefox/Safari/모바일 등)는 기존 다운로드로 폴백한다.
// 반환: 'saved' 저장됨 · 'canceled' 사용자가 취소 · 'error' 실패.
export async function saveImage (getBlob: () => Promise<Blob | null>, filename: string, kind: 'png' | 'gif' = 'png'): Promise<'saved' | 'canceled' | 'error'> {
  const name = filename.endsWith(`.${kind}`) ? filename : `${filename}.${kind}`
  const type = kind === 'gif' ? { description: '움짤(GIF)', accept: { 'image/gif': ['.gif'] } } : { description: 'PNG 이미지', accept: { 'image/png': ['.png'] } }
  const picker = (window as unknown as { showSaveFilePicker?: (o: unknown) => Promise<{ createWritable: () => Promise<{ write: (b: Blob) => Promise<void>; close: () => Promise<void> }> }> }).showSaveFilePicker
  if (typeof picker === 'function') {
    // 대화상자는 사용자 제스처 안에서 즉시 열어야 하므로 blob 생성보다 먼저 호출한다.
    let handle: { createWritable: () => Promise<{ write: (b: Blob) => Promise<void>; close: () => Promise<void> }> } | null = null
    try {
      handle = await picker({ suggestedName: name, types: [type] })
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
