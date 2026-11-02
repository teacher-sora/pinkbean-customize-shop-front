'use client'

// 요소가 스크롤 칸(root) 안에서 보이는 자리 가까이(margin) 온 적이 있는가 — 한 번 true 면 계속 true.
// 칸이 많은 목록(프리셋 100칸 등)이 보이지 않는 칸까지 한꺼번에 합성 · 그리지 않게 한다(처음 보일 때 그리고, 그린 것은 그대로 둔다 —
// 스크롤을 오갈 때마다 다시 합성하지 않게). 관찰기는 root · margin 마다 하나를 칸들이 함께 쓴다(칸마다 하나씩 만들지 않는다).
// root = 'auto' 면 가장 가까운 스크롤 조상(없으면 화면). 처음부터 보이는 칸은 페인트 전에 바로 true 다(첫 페인트부터 그림 — 깜빡임 없음).
// IntersectionObserver 가 없는 환경이면 마운트 뒤 true(예전처럼 모두 그린다).
import { useState } from 'react'
import { useIsoLayoutEffect } from '@/lib/uiState'

const MARGIN = '200px'
type Shared = { io: IntersectionObserver; cbs: Map<Element, (on: boolean) => void> }
const byRoot = new WeakMap<Element, Map<string, Shared>>()
const viewport = new Map<string, Shared>()

function shared (root: Element | null, margin: string): Shared {
  let m = root ? byRoot.get(root) : viewport
  if (!m) { m = new Map(); byRoot.set(root!, m) }
  const hit = m.get(margin)
  if (hit) return hit
  const cbs = new Map<Element, (on: boolean) => void>()
  const io = new IntersectionObserver((es) => { for (const e of es) { const f = cbs.get(e.target); if (f) f(e.isIntersecting) } }, { root, rootMargin: margin })
  const s = { io, cbs }
  m.set(margin, s)
  return s
}

function scrollParent (el: Element): Element | null {
  for (let p = el.parentElement; p; p = p.parentElement) {
    const st = getComputedStyle(p)
    if (/(auto|scroll)/.test(st.overflowY + st.overflowX)) return p
  }
  return null
}

// margin('200px', '0px 60px' 처럼 위 오른 아래 왼)만큼 넓힌 root 상자와 겹치는가 — 페인트 전 판정
function nearNow (el: Element, root: Element | null, margin: string): boolean {
  const r = el.getBoundingClientRect()
  if (!r.width || !r.height) return false
  const px = margin.split(/\s+/).map((v) => parseFloat(v) || 0)
  const [t, rt = t, b = t, l = rt] = px
  const box = root ? root.getBoundingClientRect() : { top: 0, left: 0, bottom: innerHeight, right: innerWidth }
  return r.bottom > box.top - t && r.top < box.bottom + b && r.right > box.left - l && r.left < box.right + rt
}

export function useSeen (el: React.RefObject<Element | null>, root: React.RefObject<Element | null> | null | 'auto', margin = MARGIN): boolean {
  // 첫 값은 서버 · 브라우저 모두 false — 서버(IntersectionObserver 없음)에서 true 로 두면 서버 HTML 에만 카드 그림이 들어가 하이드레이션이 어긋나고
  // 문서 전체를 브라우저에서 다시 그렸다(프리셋 탭에서 새로고침 — React #418 · #423). 관찰기가 없는 브라우저만 마운트 뒤에 켠다
  const [seen, setSeen] = useState(false)
  useIsoLayoutEffect(() => {
    const t = el.current
    if (seen || !t) return
    if (typeof IntersectionObserver === 'undefined') { setSeen(true); return }
    const r = root === 'auto' ? scrollParent(t) : root?.current ?? null
    if (nearNow(t, r, margin)) { setSeen(true); return }
    const s = shared(r, margin)
    s.cbs.set(t, (on) => { if (!on) return; s.io.unobserve(t); s.cbs.delete(t); setSeen(true) })
    s.io.observe(t)
    return () => { s.io.unobserve(t); s.cbs.delete(t) }
  }, [seen])
  return seen
}

// 지금 root 안 margin 거리 안에 있는가(오갈 때마다 바뀐다) — 멀리 벗어난 칸의 캔버스를 놓을 때 쓴다(SnapThumb).
// 처음 값은 false, 마운트하자마자 페이지 그리기 전에 판정한다(처음부터 가까운 칸은 첫 페인트부터 true)
export function useNear (el: React.RefObject<Element | null>, root: React.RefObject<Element | null> | null | 'auto', margin: string): boolean {
  const [near, setNear] = useState(false)
  useIsoLayoutEffect(() => {
    const t = el.current
    if (!t) return
    if (typeof IntersectionObserver === 'undefined') { setNear(true); return }
    const r = root === 'auto' ? scrollParent(t) : root?.current ?? null
    if (nearNow(t, r, margin)) setNear(true)
    const s = shared(r, margin)
    s.cbs.set(t, setNear)
    s.io.observe(t)
    return () => { s.io.unobserve(t); s.cbs.delete(t) }
  }, [])
  return near
}
