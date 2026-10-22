'use client'

// 프리셋 카드를 끌어 순서를 바꾼다(사용자 지시 — 따로 정렬 버튼 없이 카드를 집으면 손을 따라오고, 놓은 자리에 들어간다).
//  · 마우스: 누른 채 6px 넘게 움직이면 집는다(그냥 누르면 지금처럼 고르기). 이름 칸 · 복사 · 삭제 띠지에서는 집지 않는다.
//  · 터치: 0.28초 누르고 있으면 카드가 들리고, 그때 움직이면 끈다. 그 전에 움직이면 목록 스크롤이다.
//    끝까지 가만히 있으면(0.5초) 지금처럼 이미지 메뉴가 뜬다(canvasMenu 의 길게 누르기 — 10px 움직이면 그쪽이 스스로 물러난다).
//  · 칸 자리(slots)는 집을 때 한 번 잰다 — 카드가 바뀌어도 칸의 자리는 그대로라, 손이 가장 가까운 칸이 들어갈 자리다.
//    다른 카드는 옮겨 간 만큼 되돌렸다가 제자리로 미끄러진다(FLIP, transform 만 — 높이 · 자리 전환 없음).
//  · 칸 가장자리(EDGE)에 가면 목록이 그쪽으로 흐른다(PC 세로, 휴대폰 가로).
import { useEffect, useLayoutEffect, useRef, useState } from 'react'

const MOUSE_SLOP = 6, TOUCH_HOLD = 280, TOUCH_GIVEUP = 500, TOUCH_SLOP = 10, EDGE = 44, EDGE_SPEED = 14
const EASE = 'transform .2s cubic-bezier(.45,0,.55,1)'
const NO_GRAB = 'input, textarea, button, a, [data-nograb]'

type Drag = {
  id: string; x: number; y: number; gx: number; gy: number // 손 자리, 카드 안에서 집은 자리
  slots: { x: number; y: number; w: number; h: number }[]   // 칸 자리(그리드 왼쪽 위 기준)
}

// grid = 카드들의 부모, box = 스크롤 칸. ids = 지금 순서. onDrop = 놓았을 때의 새 순서(바뀌었을 때만).
// layout = 그리드가 다시 만들어지는 갈래(휴대폰 · PC) — 바뀌면 터치 리스너를 새 그리드에 다시 붙인다
export function usePresetDrag (ids: string[], grid: React.RefObject<HTMLElement | null>, box: React.RefObject<HTMLElement | null>, onDrop: (ids: string[]) => void, layout: string) {
  const [order, setOrder] = useState<string[] | null>(null) // 끄는 동안의 순서(놓으면 null — 바깥 순서로)
  const [dragId, setDragId] = useState<string | null>(null)
  const [liftId, setLiftId] = useState<string | null>(null) // 터치로 들린 카드(아직 끌지 않음)
  const drag = useRef<Drag | null>(null)
  const prevOrder = useRef<string[]>(ids)
  const justDropped = useRef(false)
  const view = order ?? ids
  // 리스너는 한 번만 붙인다 — 바깥 순서 · 콜백은 ref 로 읽는다(렌더마다 다시 붙이면 누르던 손가락을 놓친다)
  const idsRef = useRef(ids), dropRef = useRef(onDrop), orderRef = useRef<string[] | null>(null)
  idsRef.current = ids; dropRef.current = onDrop

  const card = (id: string) => grid.current?.querySelector<HTMLElement>(`[data-preset-id="${id}"]`) ?? null
  // 끄는 카드를 손 자리로(칸 자리에서 얼마나 떨어졌는지만 transform 으로)
  const place = (list: string[]) => {
    const d = drag.current, g = grid.current
    if (!d || !g) return
    const el = card(d.id), i = list.indexOf(d.id)
    if (!el || i < 0) return
    const r = g.getBoundingClientRect(), s = d.slots[i]
    el.style.transform = `translate(${d.x - d.gx - (r.left + s.x)}px, ${d.y - d.gy - (r.top + s.y)}px)`
  }
  // 손이 가장 가까운 칸으로 끄는 카드를 옮긴다
  const update = () => {
    const d = drag.current, g = grid.current
    if (!d || !g) return
    const r = g.getBoundingClientRect()
    let best = 0, bd = Infinity
    d.slots.forEach((s, i) => { const dx = d.x - (r.left + s.x + s.w / 2), dy = d.y - (r.top + s.y + s.h / 2), v = dx * dx + dy * dy; if (v < bd) { bd = v; best = i } })
    const cur = orderRef.current ?? idsRef.current, from = cur.indexOf(d.id)
    if (from < 0 || from === best) { place(cur); return }
    const next = cur.slice(); next.splice(from, 1); next.splice(best, 0, d.id)
    orderRef.current = next; setOrder(next)
  }

  // 순서가 바뀌면: 끄는 카드는 손 자리에 다시 두고, 나머지는 옛 칸에서 새 칸으로 미끄러진다
  useLayoutEffect(() => {
    const d = drag.current, prev = prevOrder.current
    prevOrder.current = view
    if (!d || !order) return
    place(order)
    order.forEach((id, b) => {
      if (id === d.id) return
      const a = prev.indexOf(id)
      if (a < 0 || a === b) return
      const el = card(id); if (!el) return
      const sa = d.slots[a], sb = d.slots[b]
      el.style.transition = 'none'
      el.style.transform = `translate(${sa.x - sb.x}px, ${sa.y - sb.y}px)`
      void el.offsetWidth
      el.style.transition = EASE
      el.style.transform = ''
    })
  }, [order])

  const begin = (id: string, x: number, y: number) => {
    const g = grid.current, el = card(id)
    if (!g || !el) return false
    const r = g.getBoundingClientRect(), er = el.getBoundingClientRect()
    const slots = idsRef.current.map((k) => { const c = card(k)!.getBoundingClientRect(); return { x: c.left - r.left, y: c.top - r.top, w: c.width, h: c.height } })
    drag.current = { id, x, y, gx: x - er.left, gy: y - er.top, slots }
    el.style.transition = 'none'
    document.documentElement.style.setProperty('user-select', 'none')
    window.getSelection()?.removeAllRanges() // 누르고 움직이는 사이 잡힌 글자 선택을 지운다
    orderRef.current = idsRef.current.slice()
    setDragId(id); setLiftId(null); setOrder(orderRef.current)
    return true
  }
  const move = (x: number, y: number) => { const d = drag.current; if (!d) return; d.x = x; d.y = y; update() }
  const end = () => {
    const d = drag.current
    if (!d) return
    drag.current = null
    document.documentElement.style.removeProperty('user-select')
    const el = card(d.id)
    if (el) { el.style.transition = EASE; el.style.transform = '' } // 놓은 칸으로 미끄러진다
    const o = orderRef.current, base = idsRef.current
    orderRef.current = null
    if (o && o.some((id, i) => id !== base[i])) dropRef.current(o)
    setOrder(null)
    justDropped.current = true
    window.setTimeout(() => { justDropped.current = false }, 0)
    window.setTimeout(() => setDragId((v) => (v === d.id ? null : v)), 220)
  }

  // 가장자리에서 목록을 흘린다(끄는 동안 매 프레임)
  useEffect(() => {
    if (!dragId) return
    let raf = 0
    const tick = () => {
      const d = drag.current, b = box.current
      if (d && b) {
        const r = b.getBoundingClientRect(), horiz = b.scrollWidth > b.clientWidth + 1
        const lo = horiz ? d.x - r.left : d.y - r.top, hi = horiz ? r.right - d.x : r.bottom - d.y
        const v = lo < EDGE ? -EDGE_SPEED * (1 - Math.max(0, lo) / EDGE) : hi < EDGE ? EDGE_SPEED * (1 - Math.max(0, hi) / EDGE) : 0
        if (v) { if (horiz) b.scrollLeft += v; else b.scrollTop += v; update() }
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [dragId])

  // 마우스 · 펜
  const onPointerDown = (e: React.PointerEvent<HTMLElement>, id: string) => {
    if (e.pointerType === 'touch' || e.button !== 0 || (e.target as HTMLElement).closest(NO_GRAB)) return
    const sx = e.clientX, sy = e.clientY
    let on = false
    const mv = (ev: PointerEvent) => {
      if (!on) { if (Math.hypot(ev.clientX - sx, ev.clientY - sy) < MOUSE_SLOP) return; on = begin(id, sx, sy) }
      if (on) { ev.preventDefault(); move(ev.clientX, ev.clientY) }
    }
    const up = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up); if (on) end() }
    window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up)
  }

  // 터치 — 스크롤을 막아야 해서(touchmove 의 preventDefault) passive 가 아닌 리스너를 직접 붙인다
  useEffect(() => {
    const g = grid.current
    if (!g) return
    let timer = 0, giveUp = 0, id: string | null = null, armed = false, on = false, sx = 0, sy = 0
    const reset = () => { clearTimeout(timer); clearTimeout(giveUp); id = null; armed = false; on = false; setLiftId(null) }
    const start = (e: TouchEvent) => {
      if (e.touches.length !== 1) { if (on) end(); reset(); return }
      const t = e.target as HTMLElement, c = t.closest<HTMLElement>('[data-preset-id]')
      if (!c || t.closest(NO_GRAB)) return
      reset()
      id = c.dataset.presetId!; sx = e.touches[0].clientX; sy = e.touches[0].clientY
      timer = window.setTimeout(() => { armed = true; setLiftId(id) }, TOUCH_HOLD)
      giveUp = window.setTimeout(() => { if (!on) reset() }, TOUCH_GIVEUP) // 가만히 있으면 이미지 메뉴에 넘긴다
    }
    const mv = (e: TouchEvent) => {
      if (!id) return
      const t = e.touches[0], far = Math.hypot(t.clientX - sx, t.clientY - sy) > TOUCH_SLOP
      if (!armed) { if (far) reset(); return } // 들리기 전에 움직이면 스크롤
      if (!on && far) { clearTimeout(giveUp); on = begin(id, sx, sy) }
      e.preventDefault()
      if (on) move(t.clientX, t.clientY)
    }
    const stop = (e: TouchEvent) => { if (on) { e.preventDefault(); end() } reset() }
    g.addEventListener('touchstart', start, { passive: true })
    g.addEventListener('touchmove', mv, { passive: false })
    g.addEventListener('touchend', stop)
    g.addEventListener('touchcancel', stop)
    return () => { g.removeEventListener('touchstart', start); g.removeEventListener('touchmove', mv); g.removeEventListener('touchend', stop); g.removeEventListener('touchcancel', stop); reset() }
  }, [layout])

  // 끌고 놓은 뒤 따라오는 클릭(고르기)을 삼킨다
  const swallowClick = () => justDropped.current

  return { view, dragId, liftId, onPointerDown, swallowClick }
}
