'use client'

// 요소가 스크롤 칸(root) 안에서 보이는 자리 가까이(MARGIN) 온 적이 있는가 — 한 번 true 면 계속 true.
// 카드가 많은 목록(프리셋 100칸)이 보이지 않는 카드까지 한꺼번에 합성 · 그리지 않게 한다(처음 보일 때 그리고, 그린 것은 그대로 둔다 —
// 스크롤을 오갈 때마다 다시 합성하지 않게). 관찰기는 root 마다 하나를 카드들이 함께 쓴다(카드마다 하나씩 만들지 않는다).
// IntersectionObserver 가 없는 환경이면 처음부터 true(예전처럼 모두 그린다).
import { useEffect, useState } from 'react'

const MARGIN = '200px'
type Shared = { io: IntersectionObserver; cbs: Map<Element, () => void> }
const byRoot = new WeakMap<Element, Shared>()
let viewport: Shared | null = null

function shared (root: Element | null): Shared {
  const hit = root ? byRoot.get(root) : viewport
  if (hit) return hit
  const cbs = new Map<Element, () => void>()
  const io = new IntersectionObserver((es) => { for (const e of es) if (e.isIntersecting) { const f = cbs.get(e.target); if (f) f() } }, { root, rootMargin: MARGIN })
  const s = { io, cbs }
  if (root) byRoot.set(root, s); else viewport = s
  return s
}

export function useSeen (el: React.RefObject<Element | null>, root: React.RefObject<Element | null> | null): boolean {
  const [seen, setSeen] = useState(() => typeof IntersectionObserver === 'undefined')
  useEffect(() => {
    const t = el.current
    if (seen || !t) return
    const s = shared(root?.current ?? null)
    s.cbs.set(t, () => { s.io.unobserve(t); s.cbs.delete(t); setSeen(true) })
    s.io.observe(t)
    return () => { s.io.unobserve(t); s.cbs.delete(t) }
  }, [seen])
  return seen
}
