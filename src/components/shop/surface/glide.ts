// 되돌릴 수 있는 세로 이동(translateY) — VS 펼침·접힘, 착용 아이템 아코디언이 함께 쓴다(2026-09-21).
//
// 왜 필요한가: CSS transition 의 목표만 바꾸면 도중에 되돌릴 수는 있지만
//  ① 새 전환은 늘 속도 0 에서 출발한다(곡선 cubic-bezier(.45,0,.55,1)) → 빠르게 움직이던 요소가 그 자리에 딱 멈췄다가
//     다시 가속해 '어떤 상태에서 상태가 바뀌는' 느낌이 난다(모바일 VS 는 248px 을 움직여 특히 컸다 — 사용자 제보).
//  ② 브라우저는 '출발 값으로 되돌아가는' 전환을 걸린 시간만큼만 돌려, 되돌림이 0.15초 만에 휙 끝난다.
// 그래서 되돌릴 때마다 **지금 위치·지금 속도**를 계산해, 그 속도로 이어지는 곡선(첫 기울기 = 현재 속도)을 새로 만든다.
// 이전 방향으로 조금 감속하다 자연스럽게 돌아온다. 움직임 자체는 여전히 CSS transition(합성 단계)이라 메인 스레드가
// 바빠도 끊기지 않는다. 전환은 매번 현재 값에서 명시적으로 다시 시작해 ②의 단축 규칙이 끼어들지 않는다.

import { SHEET_MS } from './sheetMotion'

type Seg = { from: number; to: number; t0: number; dur: number; c: [number, number, number, number] }
const BASE: Seg['c'] = [0.45, 0, 0.55, 1] // 디자인 규칙의 대칭 곡선
const segs = new WeakMap<HTMLElement, Seg>()

// 3차 베지어(0,0)-(x1,y1)-(x2,y2)-(1,1)
const bz = (a: number, b: number, s: number) => 3 * (1 - s) * (1 - s) * s * a + 3 * (1 - s) * s * s * b + s * s * s
const dbz = (a: number, b: number, s: number) => 3 * (1 - s) * (1 - s) * a + 6 * (1 - s) * s * (b - a) + 3 * s * s * (1 - b)
const solveS = (x1: number, x2: number, x: number) => {
  let s = x
  for (let i = 0; i < 8; i++) { const d = dbz(x1, x2, s); if (Math.abs(d) < 1e-6) break; s -= (bz(x1, x2, s) - x) / d; s = Math.min(1, Math.max(0, s)) }
  return s
}
const tyOf = (el: Element) => { const t = getComputedStyle(el).transform; return !t || t === 'none' ? 0 : new DOMMatrixReadOnly(t).m42 }

// 지금 위치(px)와 속도(px/ms). 진행 중인 구간이 없으면 그려진 값 그대로, 속도 0.
function now(el: HTMLElement, t: number): { p: number; v: number } {
  const g = segs.get(el)
  if (!g || g.dur <= 0 || t >= g.t0 + g.dur) return { p: tyOf(el), v: 0 } // 멈춰 있으면 그려진 값(다른 코드가 바꿨을 수도 있다)
  const [x1, y1, x2, y2] = g.c
  const u = Math.max(0, (t - g.t0) / g.dur)
  const s = solveS(x1, x2, u)
  const dx = dbz(x1, x2, s)
  return { p: g.from + (g.to - g.from) * bz(y1, y2, s), v: dx > 1e-6 ? ((g.to - g.from) * dbz(y1, y2, s)) / dx / g.dur : 0 }
}

// 전환 없이 그 자리에 둔다(FLIP 의 출발점).
export function place(items: [HTMLElement, number][]) {
  const t = performance.now()
  for (const [el, y] of items) { el.style.transition = 'none'; el.style.transform = `translateY(${y}px)`; segs.set(el, { from: y, to: y, t0: t, dur: 0, c: BASE }) }
}

// 목표로 이동. 진행 중이면 지금 위치·속도에서 이어 간다. 끝나는 시각(ms 뒤)을 돌려준다.
export function glideTo(items: [HTMLElement, number][], dur = SHEET_MS): number {
  const t = performance.now()
  const st = items.map(([el]) => now(el, t))
  // 현재 값에서 전환을 새로 시작한다(브라우저의 되돌림 단축 규칙이 끼어들지 않게) — 한 번에 멈춰 세우고 한 번만 강제 계산.
  items.forEach(([el], i) => { el.style.transition = 'none'; el.style.transform = `translateY(${st[i].p}px)` })
  items[0]?.[0].getBoundingClientRect()
  items.forEach(([el, to], i) => {
    const { p, v } = st[i]
    const d = to - p
    let c = BASE
    if (Math.abs(v) > 0.01 && Math.abs(d) > 0.5) {
      // 첫 기울기(정규화) = v·dur/d. x1 을 0.3 으로 두고 y1 = 기울기·x1 — 반대 방향이면 y1<0 이라 잠깐 이어 가다 돌아온다.
      const x1 = 0.3
      c = [x1, Math.max(-1.5, Math.min(2.5, (v * dur / d) * x1)), 0.55, 1]
    }
    el.style.transition = `transform ${dur}ms cubic-bezier(${c.join(',')})`
    el.style.transform = `translateY(${to}px)`
    segs.set(el, { from: p, to, t0: t, dur, c })
  })
  return dur
}

// 흔적 제거(도착 뒤 정리). transform 을 비우면 레이아웃 그대로.
export function release(els: HTMLElement[]) {
  for (const el of els) { segs.delete(el); el.style.transition = 'none'; el.style.transform = '' }
  els[0]?.getBoundingClientRect()
  for (const el of els) el.style.transition = ''
}
