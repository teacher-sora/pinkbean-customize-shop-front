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
//  · 끄는 카드는 GPU 층(will-change: transform — preset.module.css 의 .dragging)이라 움직여도 그림 · 그림자를 다시 칠하지 않는다.
//    밀려나는 카드는 CSS 전환 중에 브라우저가 스스로 층으로 올린다(30장 모두에 걸면 GPU 메모리를 쥔다).
//  · 밀려나는 카드는 CSS 전환이 지금 보이는 자리에서 이어 간다(튀지 않는다). 손이 칸의 안쪽(가장자리 INSET 을 뺀 곳)에 들어가야 자리를 바꾼다
//    — 경계에서 왔다 갔다 하지 않는다. 칸 자리는 집을 때 한 번 잰다.
//  · 놓으면 끄던 카드를 새 칸으로 미끄러뜨리고, **미끄러짐이 끝난 뒤** 순서를 한 번 저장한다(onDrop — 이름 '코디 N' 도 그때 한 번).
//    저장은 앱 전체를 다시 그려 무겁다 — 움직이는 도중에 하면 놓는 순간 멈칫했다(CPU 4배 느리게에서 130ms). 끝난 뒤라 보이는 것이 그대로다:
//    카드는 이미 새 칸에 transform 으로 서 있고, 순서가 바뀌어 그려지면 그리기 전에 transform 만 지운다(자리가 같아 한 프레임도 튀지 않는다).
//  · 문서 전체(<html>)의 스타일은 건드리지 않는다 — user-select 를 걸고 풀 때마다 페이지 전체 스타일을 다시 계산해 집는 순간 멈칫했다.
//    글자 선택은 누를 때 기본 동작을 막아 막는다(이름 칸 · 버튼에서는 집지 않으니 그대로 쓸 수 있다).
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
  const settle = useRef<{ el: HTMLElement; t: number; order: string[] } | null>(null) // 놓고 미끄러지는 중(끝나면 순서를 저장)
  const committing = useRef(false)                     // 저장한 순서가 그려지면 transform 을 지운다
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
    flush() // 앞에서 놓은 것이 아직 미끄러지는 중이면 지금 저장한다
    const g = grid.current
    const all = cards(), el = all.find((c) => c.dataset.presetId === id)
    if (!g || !el) return false
    // 읽기를 먼저 다 하고(레이아웃 한 번) 쓰기는 그 뒤에. 남은 transform 이 있으면(드물다) 지우고 잰다
    if (all.some((c) => c.style.transform)) for (const c of all) { c.style.transition = 'none'; c.style.transform = '' }
    const r = g.getBoundingClientRect(), er = el.getBoundingClientRect()
    const els = new Map(all.map((c) => [c.dataset.presetId!, c]))
    const list = idsRef.current
    const slots = list.map((k) => { const c = els.get(k)!.getBoundingClientRect(); return { x: c.left - r.left, y: c.top - r.top, w: c.width, h: c.height } })
    for (const c of all) c.style.transition = c === el ? 'none' : EASE
    el.classList.add(dragCls)
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
    justDropped.current = true
    window.setTimeout(() => { justDropped.current = false }, 0)
    // 끄던 카드를 들어갈 칸으로 미끄러뜨린다(다른 카드는 이미 제 칸에 있다)
    const a = d.slots[d.home.get(d.id)!], q = d.slots[d.order.indexOf(d.id)]
    d.el.style.transition = EASE
    d.el.style.transform = a === q ? '' : `translate3d(${q.x - a.x}px, ${q.y - a.y}px, 0)`
    const changed = d.order.some((id, i) => id !== idsRef.current[i])
    settle.current = { el: d.el, order: changed ? d.order : [], t: window.setTimeout(flush, SETTLE_MS) }
  }
  // 미끄러짐이 끝났다(또는 다시 집었다) — 떠 있던 표시를 내리고, 순서가 바뀌었으면 저장한다
  const flush = () => {
    const st = settle.current
    if (!st) return
    settle.current = null
    clearTimeout(st.t)
    st.el.classList.remove(dragCls)
    if (st.order.length) { committing.current = true; dropRef.current(st.order) }
  }

  // 저장한 순서가 그려지면: 카드는 이미 그 자리에 transform 으로 서 있다 — 그리기 전에 transform 만 지운다(보이는 것은 그대로)
  const idsKey = ids.join(',')
  useLayoutEffect(() => {
    if (!committing.current) return
    committing.current = false
    for (const c of cards()) { c.style.transition = 'none'; c.style.transform = '' }
  }, [idsKey])

  // 순서 변경을 끄면 끌던 것을 놓는다. 패널이 사라지면 프레임을 멈추고, 미끄러지던 것은 바로 저장한다
  useEffect(() => { if (!enabled) end() }, [enabled])
  useEffect(() => () => { const d = drag.current; if (d) { cancelAnimationFrame(d.raf); drag.current = null } const st = settle.current; if (st) { settle.current = null; clearTimeout(st.t); if (st.order.length) dropRef.current(st.order) } }, [])

  // 마우스 · 펜
  const onPointerDown = (e: React.PointerEvent<HTMLElement>, id: string) => {
    if (!onRef.current || e.pointerType === 'touch' || e.button !== 0 || (e.target as HTMLElement).closest(NO_GRAB)) return
    e.preventDefault() // 글자 선택 · 그림 끌기를 시작하지 않는다
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
