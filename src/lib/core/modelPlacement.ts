// 모델(캐릭터) 배치 계산 — 카드 썸네일과 우측 미리보기의 단일 규칙.
//
// 목표:
//  1) 캔버스는 항상 div 보다 크게(margin>1) → 스프라이트/이펙트는 div overflow 로만 잘리고 캔버스 경계로는
//     잘리지 않는다. 캔버스 비트맵은 div 의 "디바이스 픽셀" 해상도로 만들고 1:1 로 표시(추가 CSS 확대 없음
//     → nearest 로 선명, 디바이스 픽셀 하드 도트).
//  2) 베이스 마네킹(장비 없는 몸통+머리)이 div 중앙에 오고, 크기는 div 높이의 고정 비율(fraction). 기준 크기
//     bodyRefH 가 베이스 상수라 "장착 장비/스프라이트 크기와 무관하게 모델은 항상 같은 크기·비율".
//  3) 마네킹 시각중심을 캔버스 중앙에 두므로, renderCharacter 의 flip(캔버스 중앙 기준 반전)이 좌우 대칭이 된다.
//     (navel 이 아니라 마네킹 중심을 중앙에 두는 게 핵심 — navel 은 중심에서 약간 벗어나 있어 그대로 두면
//      시선 반전 시 좌우로 쏠린다.)
//
// MODEL_REF: 베이스 바디+머리 합성 bbox 에서 1회 측정한 상수(월드 px, navel=원점 기준).
//  - bodyRefH: 마네킹 전체 높이(머리끝~발). 모델 크기 정규화 기준.
//  - centerDx/centerDy: navel → 마네킹 시각중심의 오프셋(가로 양수=오른쪽, 세로 음수=위). 중앙정렬/반전 대칭용.
//  - back*: 뒷쪽(rope 액션)은 포즈가 달라 중심 오프셋이 다르다. (front=stand1, back=rope[0]+back head 합성 bbox 기준.)
//  - previewBack*: 우측 미리보기는 stabOffset(rope를 stand1 navel 기준으로 정렬, navel≈+10,-3 이동)이 적용되므로
//    카드(stab 없음)와 달리 back* 에 stab 만큼 더해 보정한다. (= backDx + (ropeNavel.x - stand1Navel.x) 등)
// (눈으로 미세 튜닝 가능. body 00002012 + head 00012012.)
export const MODEL_REF = { bodyRefH: 64, centerDx: 3.5, centerDy: -11, backDx: -0.5, backDy: -8.5, previewBackDx: 9.5, previewBackDy: -11.5 }

export interface ModelPlacement {
  box: { w: number; h: number }   // renderCharacter 월드 박스
  scale: number                   // 월드→디바이스 배율(분수 허용)
  anchor: { x: number; y: number } // navel 을 놓을 박스 좌표(마네킹 중심이 박스 중앙에 오도록 보정됨)
  canvasCssW: number; canvasCssH: number // <canvas> 표시 크기(CSS px). 비트맵은 box*scale(=디바이스 px).
}

// div(표시 영역) 크기 + dpr + 튜닝값 → 렌더/캔버스 파라미터.
export function computeModelPlacement(a: {
  divW: number; divH: number; dpr: number
  margin: number      // 캔버스 표시크기 = div * margin (>1)
  fraction: number    // 마네킹 높이 = fraction * divH (CSS px)
  zoomMult?: number   // 연출 배율(1x/2x/3x) → fraction 에 곱
  centerDx?: number   // navel→중심 가로 오프셋(시선별로 다름; 기본 MODEL_REF.centerDx)
  centerDy?: number   // navel→중심 세로 오프셋(기본 MODEL_REF.centerDy)
  snap?: boolean      // 배율을 가장 가까운 정수로 스냅(도트 완전 선명; 크기는 살짝 이산적)
  scale?: number      // 디바이스 배율을 직접 지정(연출 배율 단계별 정수 — zoomStepScale). 주면 fraction/zoom/snap 무시
  drop?: boolean      // 캐릭터를 살짝 아래로(아래 MODEL_DROP 설명). 화면에 보여 주는 모델 캔버스만 켠다.
}): ModelPlacement {
  const zoom = a.zoomMult ?? 1
  const cx = a.centerDx ?? MODEL_REF.centerDx
  const cy = a.centerDy ?? MODEL_REF.centerDy
  const canvasDevW = Math.max(1, Math.round(a.divW * a.margin * a.dpr))
  const canvasDevH = Math.max(1, Math.round(a.divH * a.margin * a.dpr))
  // 표시 크기 = 비트맵 ÷ dpr(디바이스 픽셀 1:1). div*margin 을 그대로 쓰면 비트맵 반올림과 어긋나
  // 브라우저가 캔버스를 미세하게 다시 늘려(DPR 1.25·1.5) 도트가 뭉갠다.
  const canvasCssW = canvasDevW / a.dpr
  const canvasCssH = canvasDevH / a.dpr
  // 마네킹(bodyRefH) 이 fraction*divH CSS px 가 되도록: 디바이스 배율 = fraction*zoom*divH*dpr / bodyRefH.
  // snap=true 면 정수 배율로 스냅 → nearest 확대가 완벽히 선명(모든 카드 동일 배율, 화면 크기별로만 살짝 다름).
  let scale = Math.max(0.01, (a.fraction * zoom * a.divH * a.dpr) / MODEL_REF.bodyRefH)
  if (a.snap) scale = Math.max(1, Math.round(scale))
  if (a.scale) scale = a.scale
  // box*scale = 캔버스 디바이스 해상도(1:1 표시로 선명).
  const box = { w: canvasDevW / scale, h: canvasDevH / scale }
  // navel 을 (박스중앙 - centerDx, 박스중앙 - centerDy)에 → 마네킹 시각중심이 박스 정중앙에 온다.
  const anchor = { x: box.w / 2 - cx, y: box.h / 2 - cy }
  if (a.drop) anchor.y += MODEL_DROP
  return { box, scale, anchor, canvasCssW, canvasCssH }
}

// ── 캐릭터를 살짝 아래로 ──(2026-09-22 사용자 지시)
// 맨 마네킹은 몸통이 정중앙인 게 맞지만, 헤어·모자를 씌우면 머리 쪽만 위로 길어져 **위로 치우친** 느낌이 난다.
// 그래서 몸통 기준 정중앙(위 anchor — 모든 캔버스가 같은 자리)에서 **고정 길이**만큼만 내린다.
//  · 길이 = 베이스 모델(몸통+머리, 아무것도 안 입힘) 높이의 1/9. 실측 64 게임 픽셀(피부 0~2 동일, stand1 프레임0
//    불투명 bbox y −43..21 · 중심 −11 = MODEL_REF 와 일치) → **약 7.1 게임 픽셀**.
//    1/8(8px)은 리스트 카드 모델이 아주 살짝 아래로 치우쳐 보였다(2026-09-22 사용자 판단) → 1/9 로 조금 올렸다.
//    정수가 아니어도 괜찮다 — 배율이 정수라 모든 레이어가 같은 소수부를 가져 반올림이 함께 움직인다(레이어끼리 안 어긋남).
//  · 게임 픽셀 단위라 캔버스 배율을 따라 커지고 작아질 뿐, 캐릭터 대비 내려간 양은 어느 캔버스든 똑같다.
//    배율이 정수라 디바이스 픽셀로도 정수 → 도트가 어긋나지 않는다.
//  ⚠️ 처음엔 '마네킹 키의 1/6 + 발 아래 빈 공간 절반 상한'으로 넣었다가 **너무 내려가고 칸마다 달랐다**(상한이
//     칸 크기에 따라 달리 걸림 — 사용자 지적). 상한 없이 고정값 하나로 바꿨다.
export const MODEL_DROP = MODEL_REF.bodyRefH / 9

// 캔버스 비트맵 크기(디바이스 px) — renderCharacter 가 잡는 크기와 같은 식.
export const canvasBitmap = (pl: ModelPlacement) => ({ bw: Math.round(pl.box.w * pl.scale), bh: Math.round(pl.box.h * pl.scale) })

// 캔버스를 화면 픽셀 격자에 맞춰 표시 영역 가운데 둔다 — 모든 미리보기·썸네일의 단일 규칙(2026-09-20 통일).
//  - CSS 크기 = 비트맵 ÷ dpr → 브라우저가 캔버스를 다시 늘리거나 줄이지 않는다(배율은 렌더 때 이미 정수).
//  - 가운데 정렬도 translate(-50%)(소수 px)가 아니라 디바이스 픽셀로 반올림한 left/top 으로, 감싼 박스가
//    소수 위치에 있으면 그만큼 되빼서 보정한다. 소수 위치면 재샘플링돼 세로줄이 찢겨 보였다(우측 미리보기 관측).
// wrap = position:relative 인 표시 영역, canvas = 그 안의 position:absolute.
export function fitCanvas(canvas: HTMLCanvasElement, wrap: HTMLElement | null, bw: number, bh: number, divW: number, divH: number, dpr: number) {
  const rect = wrap?.getBoundingClientRect()
  const fx = rect ? (rect.left * dpr) % 1 : 0, fy = rect ? (rect.top * dpr) % 1 : 0
  canvas.style.width = `${bw / dpr}px`
  canvas.style.height = `${bh / dpr}px`
  canvas.style.left = `${(Math.round((divW * dpr - bw) / 2) - fx) / dpr}px`
  canvas.style.top = `${(Math.round((divH * dpr - bh) / 2) - fy) / dpr}px`
}

// 연출 배율(1x/2x/3x) 단계별 정수 디바이스 배율. 단계마다 따로 반올림하면 미리보기 높이에 따라 1x·2x 가 같은 정수로
// 뭉친다(PC 스테이지 ≈570px: 1.56→2, 2.23→2). 기본 2x 크기는 그대로 두고, 1x 는 2x 보다 최소 1 작게·3x 는 최소 1 크게
// 강제해 항상 구분된다(2x 가 1 이면 1x 자리를 위해 2 로 올린다).
export function zoomStepScale(a: { fraction: number; divH: number; dpr: number; level: number; mults: Record<number, number> }): number {
  const raw = (lv: number) => (a.fraction * (a.mults[lv] ?? 1) * a.divH * a.dpr) / MODEL_REF.bodyRefH
  const s2 = Math.max(2, Math.round(raw(2)))
  if (a.level <= 1) return Math.max(1, Math.min(s2 - 1, Math.round(raw(1))))
  if (a.level >= 3) return Math.max(s2 + 1, Math.round(raw(3)))
  return s2
}
