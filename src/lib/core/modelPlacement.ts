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
}): ModelPlacement {
  const zoom = a.zoomMult ?? 1
  const cx = a.centerDx ?? MODEL_REF.centerDx
  const cy = a.centerDy ?? MODEL_REF.centerDy
  const canvasCssW = a.divW * a.margin
  const canvasCssH = a.divH * a.margin
  const canvasDevW = Math.max(1, Math.round(canvasCssW * a.dpr))
  const canvasDevH = Math.max(1, Math.round(canvasCssH * a.dpr))
  // 마네킹(bodyRefH) 이 fraction*divH CSS px 가 되도록: 디바이스 배율 = fraction*zoom*divH*dpr / bodyRefH.
  // snap=true 면 정수 배율로 스냅 → nearest 확대가 완벽히 선명(모든 카드 동일 배율, 화면 크기별로만 살짝 다름).
  let scale = Math.max(0.01, (a.fraction * zoom * a.divH * a.dpr) / MODEL_REF.bodyRefH)
  if (a.snap) scale = Math.max(1, Math.round(scale))
  // box*scale = 캔버스 디바이스 해상도(1:1 표시로 선명).
  const box = { w: canvasDevW / scale, h: canvasDevH / scale }
  // navel 을 (박스중앙 - centerDx, 박스중앙 - centerDy)에 → 마네킹 시각중심이 박스 정중앙에 온다.
  const anchor = { x: box.w / 2 - cx, y: box.h / 2 - cy }
  return { box, scale, anchor, canvasCssW, canvasCssH }
}
