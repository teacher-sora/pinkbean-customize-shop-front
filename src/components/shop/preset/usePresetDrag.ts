'use client'

// 프리셋 카드를 끌어 순서를 바꾼다 — **헤더의 [순서 변경]을 켰을 때만**(enabled, 사용자 지시). 켜면 카드를 집으면 손을 따라오고 놓은 자리에 들어간다.
//  왜 버튼인가: 휴대폰은 스크롤과 나누려면 길게 눌러야 하는데, 길게 누르기는 이미지 메뉴(복사 · 저장)다. 시간으로 나누면(잠깐 = 끌기,
//  더 오래 = 메뉴) 자주 엇갈렸다. 켜 둔 동안만 끌고, 끄면 누르기 · 길게 누르기가 원래대로다 — 겹치는 동작이 없다. 버튼이 있어야 기능이 있는 줄도 안다.
//  · 마우스: 누른 채 6px 넘게 움직이면 집는다. 이름 칸 · 복사 · 삭제 띠지에서는 집지 않는다.
//  · 터치: 카드에서 움직이면 바로 끈다(켜 둔 동안 카드는 touch-action: none). 목록은 카드 사이를 밀거나, 끄는 카드를 가장자리로 가져가 흘린다.
// 부드럽게(사용자 지시 — 끊기지 않게):
//  · **끄는 동안 리액트는 한 번도 다시 그리지 않는다.** 화면 순서(DOM)도 그대로 두고 카드마다 들어갈 칸까지 transform 으로만 옮긴다.
//    집는 표시(dragCls)도 classList 로 직접 붙인다 — 상태로 두면 집는 순간 카드 30장이 다시 그려져 한 번 멈칫했다.
//  · 손의 움직임은 자리만 적어 두고, 한 프레임에 한 번(requestAnimationFrame) 읽기 한 번(그리드 자리) · 쓰기만 한다 — 이벤트마다 재고 쓰면
//    브라우저가 그때마다 스타일을 다시 계산했다. 가장자리 흘리기도 같은 프레임에서 한다.
//  · 켜 둔 동안 카드는 GPU 층(will-change: transform)이라 움직여도 그림 · 그림자를 다시 칠하지 않는다(preset.module.css 의 .sorting).
//  · 밀려나는 카드는 CSS 전환이 지금 보이는 자리에서 이어 간다(튀지 않는다). 손이 칸의 안쪽(가장자리 INSET 을 뺀 곳)에 들어가야 자리를 바꾼다
//    — 경계에서 왔다 갔다 하지 않는다. 칸 자리는 집을 때 한 번 잰다.
//  · 놓을 때 한 번 순서를 바꾸고(onDrop — 이름 '코디 N' 도 그때 한 번), 바뀐 자리에서 보이던 자리로 되돌렸다가 미끄러지게 한다(FLIP, 그리기 전에).
import { useEffect, useLayoutEffect, useRef } from 'react'

const MOUSE_SLOP = 6, TOUCH_SLOP = 6, EDGE = 44, EDGE_SPEED = 12, INSET = 0.18, SETTLE_MS = 240
const EASE = 'transform .22s cubic-bezier(.45,0,.55,1)'
const NO_GRAB = 'input, textarea, button, a, [data-nograb]'

type Slot = { x: number; y: number; w: number; h: number } // 그리드 왼쪽 위 기준
type Drag = {
  id: string; el: HTMLElement; x: number; y: number; gx: number; gy: number
  slots: Slot[]; home: Map<string, number>; els: Map<string, HTMLElement>; order: string[]; raf: number
}

// grid = 카드들의 부모, box = 스크롤 칸. ids = 지금 순서. onDrop = 놓았을 때의 새 순서(바뀌었을 때만). dragCls = 끄는 카드에 붙일 클래스.
// layout = 그리드가 다시 만들어지는 갈래(휴대폰 · PC) — 바뀌면 터치 리스너를 새 그리드에 다시 붙인다
export function usePresetDrag (enabled: boolean, ids: string[], grid: React.RefObject<HTMLElement | null>, box: React.RefObject<HTMLElement | null>, onDrop: (ids: string[]) => void, dragCls: string, layout: string) {
  const drag = useRef<Drag | null>(null)
  const justDropped = useRef(false)
  const flip = useRef<Map<string, DOMRect> | null>(null) // 놓을 때 보이던 자리(순서가 바뀐 뒤 그 자리에서 미끄러진다)
  // 리스너는 한 번만 붙인다 — 바깥 순서 · 콜백은 ref 로 읽는다(렌더마다 다시 붙이면 누르던 손가락을 놓친다)
  const idsRef = useRef(ids), dropRef = useRef(onDrop), onRef = useRef(enabled)
  idsRef.current = ids; dropRef.current = onDrop; onRef.current = enabled

  const cards = () => [...(grid.current?.querySelectorAll<HTMLElement>('[data-preset-id]') ?? [])]

  // 한 프레임: 가장자리면 목록을 흘리고 → 그리드 자리를 한 번 읽고 → 끄는 카드를 손 자리로, 들어갈 칸이 바뀌었으면 나머지를 새 칸으로
  const frame = () => {
    const d = drag.current, g = grid.current, b = box.current
    if (!d || !g) return
    d.raf = requestAnimationFrame(frame)
    if (b) {
      const br = b.getBoundingClientRect(), horiz = b.scrollWidth > b.clientWidth + 1
      const lo = horiz ? d.x - br.left : d.y - br.top, hi = horiz ? br.right - d.x : br.bottom - d.y
      const v = lo < EDGE ? -EDGE_SPEED * (1 - Math.max(0, lo) / EDGE) : hi < EDGE ? EDGE_SPEED * (1 - Math.max(0, hi) / EDGE) : 0
      if (v) { if (horiz) b.scrollLeft += v; else b.scrollTop += v }
    }
    const r = g.getBoundingClientRect(), s = d.slots[d.home.get(d.id)!]
    d.el.style.transform = `translate3d(${d.x - d.gx - (r.left + s.x)}px, ${d.y - d.gy - (r.top + s.y)}px, 0)`
    const px = d.x - r.left, py = d.y - r.top
    const to = d.slots.findIndex((q) => px > q.x + q.w * INSET && px < q.x + q.w * (1 - INSET) && py > q.y + q.h * INSET && py < q.y + q.h * (1 - INSET))
    const from = d.order.indexOf(d.id)
    if (to < 0 || to === from) return
    d.order = d.order.slice(); d.order.splice(from, 1); d.order.splice(to, 0, d.id)
    d.order.forEach((id, k) => {
      if (id === d.id) return
      const el = d.els.get(id); if (!el) return
      const a = d.slots[d.home.get(id)!], q = d.slots[k]
      const t = a === q ? '' : `translate3d(${q.x - a.x}px, ${q.y - a.y}px, 0)`
      if (el.style.transform !== t) el.style.transform = t
    })
  }

  const begin = (id: string, x: number, y: number) => {
    const g = grid.current
    const all = cards(), el = all.find((c) => c.dataset.presetId === id)
    if (!g || !el) return false
    for (const c of all) { c.style.transition = 'none'; c.style.transform = '' } // 앞 전환이 남아 있으면 칸 자리가 틀린다
    const r = g.getBoundingClientRect(), er = el.getBoundingClientRect()
    const els = new Map(all.map((c) => [c.dataset.presetId!, c]))
    const list = idsRef.current
    const slots = list.map((k) => { const c = els.get(k)!.getBoundingClientRect(); return { x: c.left - r.left, y: c.top - r.top, w: c.width, h: c.height } })
    for (const c of all) if (c !== el) c.style.transition = EASE
    el.classList.add(dragCls)
    document.documentElement.style.setProperty('user-select', 'none')
    window.getSelection()?.removeAllRanges() // 누르고 움직이는 사이 잡힌 글자 선택을 지운다
    drag.current = { id, el, x, y, gx: x - er.left, gy: y - er.top, slots, home: new Map(list.map((k, i) => [k, i])), els, order: list.slice(), raf: 0 }
    drag.current.raf = requestAnimationFrame(frame)
    return true
  }
  const move = (x: number, y: number) => { const d = drag.current; if (d) { d.x = x; d.y = y } } // 자리만 적는다 — 그리기는 다음 프레임에
  const end = () => {
    const d = drag.current
    if (!d) return
    drag.current = null
    cancelAnimationFrame(d.raf)
    document.documentElement.style.removeProperty('user-select')
    justDropped.current = true
    window.setTimeout(() => { justDropped.current = false }, 0)
    window.setTimeout(() => d.el.classList.remove(dragCls), SETTLE_MS) // 제자리로 미끄러지는 동안은 위에 떠 있는다
    const changed = d.order.some((id, i) => id !== idsRef.current[i])
    if (!changed) { d.el.style.transition = EASE; d.el.style.transform = ''; return }
    flip.current = new Map([...d.els].map(([id, c]) => [id, c.getBoundingClientRect()]))
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
    all.forEach((c, i) => { const p = prev.get(c.dataset.presetId!); if (p) c.style.transform = `translate3d(${p.left - now[i].left}px, ${p.top - now[i].top}px, 0)` })
    void grid.current?.offsetWidth
    for (const c of all) { c.style.transition = EASE; c.style.transform = '' }
  }, [idsKey])

  // 순서 변경을 끄면 끌던 것을 놓는다. 패널이 사라지면 프레임만 멈춘다
  useEffect(() => { if (!enabled) end() }, [enabled])
  useEffect(() => () => { const d = drag.current; if (d) { cancelAnimationFrame(d.raf); drag.current = null; document.documentElement.style.removeProperty('user-select') } }, [])

  // 마우스 · 펜
  const onPointerDown = (e: React.PointerEvent<HTMLElement>, id: string) => {
    if (!onRef.current || e.pointerType === 'touch' || e.button !== 0 || (e.target as HTMLElement).closest(NO_GRAB)) return
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
    let id: string | null = null, on = false, sx = 0, sy = 0
    const reset = () => { id = null; on = false }
    const start = (e: TouchEvent) => {
      if (e.touches.length !== 1) { if (on) end(); reset(); return }
      if (!onRef.current) return
      const t = e.target as HTMLElement, c = t.closest<HTMLElement>('[data-preset-id]')
      if (!c || t.closest(NO_GRAB)) return
      reset()
      id = c.dataset.presetId!; sx = e.touches[0].clientX; sy = e.touches[0].clientY
    }
    const mv = (e: TouchEvent) => {
      if (!id) return
      const t = e.touches[0]
      if (!on && Math.hypot(t.clientX - sx, t.clientY - sy) > TOUCH_SLOP) on = begin(id, sx, sy)
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

  return { onPointerDown, swallowClick }
}
