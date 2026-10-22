'use client'

// 프리셋 카드를 끌어 순서를 바꾼다(사용자 지시 — 따로 정렬 버튼 없이 카드를 집으면 손을 따라오고, 놓은 자리에 들어간다).
//  · 마우스: 누른 채 6px 넘게 움직이면 집는다(그냥 누르면 지금처럼 고르기). 이름 칸 · 복사 · 삭제 띠지에서는 집지 않는다.
//  · 터치: 0.3초 누르고 있으면 카드가 들리고, 그때 움직이면 끈다. 들리기 전에 움직이면 목록 스크롤이다(스크롤과 나누려면 길게 눌러야 한다).
//    길게 누르기는 끌기만 한다 — 프리셋 카드의 이미지 메뉴(복사 · 저장)는 터치에서 열지 않는다(SnapThumb holdMenu, 사용자 지시 — 겹치는
//    동작이 하나도 없게). 같은 코디는 위의 캐릭터 화면을 길게 눌러 복사 · 저장한다. 들었다가 그냥 떼면 아무 일도 없다.
//  · **끄는 동안은 화면의 순서(DOM)를 바꾸지 않는다.** 카드마다 들어갈 칸까지 transform 으로만 옮긴다 — 리액트가 다시 그리지 않아
//    그림이 깜박이지 않고, 움직이던 카드가 또 밀려도 CSS 전환이 지금 보이는 자리에서 이어 간다(튀지 않는다).
//    놓을 때 한 번 순서를 바꾸고(onDrop — 이름 '코디 N' 도 그때 한 번), 바뀐 자리에서 보이던 자리로 되돌렸다가 미끄러지게 한다(FLIP).
//  · 칸 자리는 집을 때 한 번 잰다. 손이 어느 칸의 안쪽(가장자리 INSET 을 뺀 곳)에 들어가야 그 칸으로 간다 — 경계에서 왔다 갔다 하지 않는다.
//  · 칸 가장자리(EDGE)에 가면 목록이 그쪽으로 흐른다(PC 세로, 휴대폰 가로).
import { useEffect, useLayoutEffect, useRef, useState } from 'react'

const MOUSE_SLOP = 6, TOUCH_HOLD = 300, TOUCH_SLOP = 10, EDGE = 44, EDGE_SPEED = 12, INSET = 0.18, SETTLE_MS = 240
const EASE = 'transform .22s cubic-bezier(.45,0,.55,1)'
const NO_GRAB = 'input, textarea, button, a, [data-nograb]'

type Slot = { x: number; y: number; w: number; h: number } // 그리드 왼쪽 위 기준
type Drag = { id: string; x: number; y: number; gx: number; gy: number; slots: Slot[]; home: Map<string, number>; order: string[] }

// grid = 카드들의 부모, box = 스크롤 칸. ids = 지금 순서. onDrop = 놓았을 때의 새 순서(바뀌었을 때만).
// layout = 그리드가 다시 만들어지는 갈래(휴대폰 · PC) — 바뀌면 터치 리스너를 새 그리드에 다시 붙인다
export function usePresetDrag (ids: string[], grid: React.RefObject<HTMLElement | null>, box: React.RefObject<HTMLElement | null>, onDrop: (ids: string[]) => void, layout: string) {
  const [dragId, setDragId] = useState<string | null>(null)
  const [liftId, setLiftId] = useState<string | null>(null) // 터치로 들린 카드(아직 끌지 않음)
  const drag = useRef<Drag | null>(null)
  const justDropped = useRef(false)
  const flip = useRef<Map<string, DOMRect> | null>(null) // 놓을 때 보이던 자리(순서가 바뀐 뒤 그 자리에서 미끄러진다)
  // 리스너는 한 번만 붙인다 — 바깥 순서 · 콜백은 ref 로 읽는다(렌더마다 다시 붙이면 누르던 손가락을 놓친다)
  const idsRef = useRef(ids), dropRef = useRef(onDrop)
  idsRef.current = ids; dropRef.current = onDrop

  const cards = () => [...(grid.current?.querySelectorAll<HTMLElement>('[data-preset-id]') ?? [])]
  const card = (id: string) => grid.current?.querySelector<HTMLElement>(`[data-preset-id="${id}"]`) ?? null

  // 끄는 카드를 손 자리로(제 칸에서 얼마나 떨어졌는지만)
  const follow = () => {
    const d = drag.current, g = grid.current, el = d && card(d.id)
    if (!d || !g || !el) return
    const r = g.getBoundingClientRect(), s = d.slots[d.home.get(d.id)!]
    el.style.transform = `translate(${d.x - d.gx - (r.left + s.x)}px, ${d.y - d.gy - (r.top + s.y)}px)`
  }
  // 나머지 카드를 새 순서의 칸으로(제 칸에서의 차이만). 전환은 CSS 가 지금 자리에서 이어 간다
  const layoutOthers = () => {
    const d = drag.current
    if (!d) return
    d.order.forEach((id, k) => {
      if (id === d.id) return
      const el = card(id); if (!el) return
      const a = d.slots[d.home.get(id)!], b = d.slots[k]
      el.style.transform = a === b ? '' : `translate(${b.x - a.x}px, ${b.y - a.y}px)`
    })
  }
  const update = () => {
    const d = drag.current, g = grid.current
    if (!d || !g) return
    follow()
    const r = g.getBoundingClientRect(), px = d.x - r.left, py = d.y - r.top
    const to = d.slots.findIndex((s) => px > s.x + s.w * INSET && px < s.x + s.w * (1 - INSET) && py > s.y + s.h * INSET && py < s.y + s.h * (1 - INSET))
    const from = d.order.indexOf(d.id)
    if (to < 0 || to === from) return
    d.order = d.order.slice(); d.order.splice(from, 1); d.order.splice(to, 0, d.id)
    layoutOthers()
  }

  const begin = (id: string, x: number, y: number) => {
    const g = grid.current, el = card(id)
    if (!g || !el) return false
    const all = cards()
    for (const c of all) { c.style.transition = 'none'; c.style.transform = '' } // 앞 전환이 남아 있으면 칸 자리가 틀린다
    const r = g.getBoundingClientRect(), er = el.getBoundingClientRect()
    const list = idsRef.current
    const slots = list.map((k) => { const c = card(k)!.getBoundingClientRect(); return { x: c.left - r.left, y: c.top - r.top, w: c.width, h: c.height } })
    drag.current = { id, x, y, gx: x - er.left, gy: y - er.top, slots, home: new Map(list.map((k, i) => [k, i])), order: list.slice() }
    void g.offsetWidth
    for (const c of all) if (c !== el) c.style.transition = EASE
    document.documentElement.style.setProperty('user-select', 'none')
    window.getSelection()?.removeAllRanges() // 누르고 움직이는 사이 잡힌 글자 선택을 지운다
    setDragId(id); setLiftId(null)
    return true
  }
  const move = (x: number, y: number) => { const d = drag.current; if (!d) return; d.x = x; d.y = y; update() }
  const end = () => {
    const d = drag.current
    if (!d) return
    drag.current = null
    document.documentElement.style.removeProperty('user-select')
    justDropped.current = true
    window.setTimeout(() => { justDropped.current = false }, 0)
    window.setTimeout(() => setDragId((v) => (v === d.id ? null : v)), SETTLE_MS)
    const changed = d.order.some((id, i) => id !== idsRef.current[i])
    if (!changed) { const el = card(d.id); if (el) { el.style.transition = EASE; el.style.transform = '' } return }
    flip.current = new Map(cards().map((c) => [c.dataset.presetId!, c.getBoundingClientRect()]))
    dropRef.current(d.order)
  }

  // 놓은 뒤 순서가 바뀌어 그려지면: 바뀐 자리 → 보이던 자리로 되돌렸다가 제자리로 미끄러진다(그리기 전에 — 한 프레임도 튀지 않는다)
  const idsKey = ids.join(',')
  useLayoutEffect(() => {
    const prev = flip.current
    if (!prev) return
    flip.current = null
    const all = cards()
    for (const c of all) { c.style.transition = 'none'; c.style.transform = '' }
    const now = all.map((c) => c.getBoundingClientRect())
    all.forEach((c, i) => { const p = prev.get(c.dataset.presetId!); if (p) c.style.transform = `translate(${p.left - now[i].left}px, ${p.top - now[i].top}px)` })
    void grid.current?.offsetWidth
    for (const c of all) { c.style.transition = EASE; c.style.transform = '' }
  }, [idsKey])

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
    let timer = 0, id: string | null = null, armed = false, on = false, sx = 0, sy = 0
    const reset = () => { clearTimeout(timer); id = null; armed = false; on = false; setLiftId(null) }
    const start = (e: TouchEvent) => {
      if (e.touches.length !== 1) { if (on) end(); reset(); return }
      const t = e.target as HTMLElement, c = t.closest<HTMLElement>('[data-preset-id]')
      if (!c || t.closest(NO_GRAB)) return
      reset()
      id = c.dataset.presetId!; sx = e.touches[0].clientX; sy = e.touches[0].clientY
      timer = window.setTimeout(() => { armed = true; setLiftId(id) }, TOUCH_HOLD)
    }
    const mv = (e: TouchEvent) => {
      if (!id) return
      const t = e.touches[0], far = Math.hypot(t.clientX - sx, t.clientY - sy) > TOUCH_SLOP
      if (!armed) { if (far) reset(); return } // 들리기 전에 움직이면 스크롤
      if (!on && far) on = begin(id, sx, sy)
      e.preventDefault()
      if (on) move(t.clientX, t.clientY)
    }
    const stop = (e: TouchEvent) => {
      if (on) { e.preventDefault(); end() }
      else if (armed && e.cancelable) e.preventDefault() // 들었다가 그냥 뗐다 — 끌려던 것이라 고르기(클릭)도 하지 않는다
      reset()
    }
    g.addEventListener('touchstart', start, { passive: true })
    g.addEventListener('touchmove', mv, { passive: false })
    g.addEventListener('touchend', stop)
    g.addEventListener('touchcancel', stop)
    return () => { g.removeEventListener('touchstart', start); g.removeEventListener('touchmove', mv); g.removeEventListener('touchend', stop); g.removeEventListener('touchcancel', stop); reset() }
  }, [layout])

  // 끌고 놓은 뒤 따라오는 클릭(고르기)을 삼킨다
  const swallowClick = () => justDropped.current

  return { dragId, liftId, onPointerDown, swallowClick }
}
