'use client'

// 스크롤 칸의 가장자리 흐림. 더 볼 것이 남은 쪽(위 · 아래 · 왼쪽 · 오른쪽)에만 어두운 흐림을 깔아, 내용이 더 있다는 것을 알린다
// (하단 부위 줄의 흐림과 같은 역할). 끝까지 가면 그쪽 흐림은 천천히 사라진다.
//  - 붙이는 법: 스크롤하는 요소에 클래스 `pb-fade` 를 단다. 앱(PinkbeanShop)이 이 훅 하나로 화면의 `.pb-fade` 를 찾아 지켜본다
//    (창 · 시트 · 떠 있는 목록이 열리고 닫혀도 따라간다).
//  - 남은 쪽은 `data-fade="t b l r"` 로 적는다. 흐림은 칸 위에 얹는 층(`.pb-fadeov`, 칸 바로 뒤의 형제)이 그린다 — 칸 안에 두면
//    내용과 함께 스크롤되고, 내용 아래에 두면 카드에 가려진다. 층은 칸의 자리를 따라다닌다(칸이 옆으로 미끄러질 때도).
//    세로 스크롤바 자리는 덮지 않는다.
//  - 떠 있는 목록(드롭다운 · 연출 고르기 칸)은 `pb-fadepop` 을 함께 단다 — 층 대신 안쪽에 붙어 다니는 흐림(::before · ::after).
//  - 쪽 번호가 있는 목록(코디 · AI 검색 · 광장의 카드 목록)에는 달지 않는다 — 쪽 번호가 그 역할을 한다.
import { useEffect } from 'react'

function watch(el: HTMLElement): () => void {
  let last: string | null = null
  const pop = el.classList.contains('pb-fadepop')
  const bothEdges = getComputedStyle(el).scrollbarGutter.includes('both')
  const parent = el.parentElement
  let ov: HTMLDivElement | null = null, madeRelative = false
  if (!pop && parent) {
    // 층의 기준은 칸의 부모다. 부모가 자리 기준이 아니면 기준으로 만든다(층이 엉뚱한 조상을 기준으로 잡지 않게)
    if (getComputedStyle(parent).position === 'static') { parent.style.position = 'relative'; madeRelative = true }
    ov = document.createElement('div')
    ov.className = 'pb-fadeov'
    ov.setAttribute('aria-hidden', 'true')
    el.after(ov)
  }
  const place = () => {
    if (!ov || !parent) return
    const r = el.getBoundingClientRect(), p = parent.getBoundingClientRect()
    const g = Math.max(0, (el.offsetWidth - el.clientWidth - el.clientLeft * 2) / (bothEdges ? 2 : 1))
    const left = r.left - p.left - parent.clientLeft + parent.scrollLeft + el.clientLeft
    const top = r.top - p.top - parent.clientTop + parent.scrollTop + el.clientTop
    const s = ov.style
    s.left = `${left}px`; s.top = `${top}px`
    s.width = `${Math.max(0, el.clientWidth + (bothEdges ? g : 0))}px`; s.height = `${el.clientHeight}px`
  }
  const sync = () => {
    const x = el.scrollLeft, y = el.scrollTop
    const mx = el.scrollWidth - el.clientWidth, my = el.scrollHeight - el.clientHeight
    const v = [y > 1 && 't', my > 1 && y < my - 1 && 'b', x > 1 && 'l', mx > 1 && x < mx - 1 && 'r'].filter(Boolean).join(' ')
    if (v !== last) { last = v; el.dataset.fade = v; if (ov) ov.dataset.fade = v }
  }
  const all = () => { sync(); place() }
  // 칸이 옆으로 미끄러지는 동안(연출 설정의 두 칸 등)은 매 프레임 자리를 따라간다
  let raf = 0, moving = 0
  const follow = () => { place(); raf = moving > 0 ? requestAnimationFrame(follow) : 0 }
  const onRun = (e: TransitionEvent) => { if (e.target !== el || e.propertyName !== 'transform') return; moving++; if (!raf) raf = requestAnimationFrame(follow) }
  const onEnd = (e: TransitionEvent) => { if (e.target !== el || e.propertyName !== 'transform') return; moving = Math.max(0, moving - 1); place() }
  el.addEventListener('scroll', sync, { passive: true })
  el.addEventListener('transitionrun', onRun)
  el.addEventListener('transitionend', onEnd)
  el.addEventListener('transitioncancel', onEnd)
  // 칸의 크기나 안의 내용(바로 아래 자식들의 크기), 부모의 크기가 바뀌면 다시 잰다. 자식이 바뀌면 지켜볼 자식도 다시 고른다
  const ro = new ResizeObserver(all)
  const observeKids = () => { ro.disconnect(); ro.observe(el); if (parent && ov) ro.observe(parent); for (const c of Array.from(el.children)) ro.observe(c) }
  const mo = new MutationObserver(() => { observeKids(); all() })
  mo.observe(el, { childList: true })
  observeKids()
  all()
  return () => {
    el.removeEventListener('scroll', sync); el.removeEventListener('transitionrun', onRun); el.removeEventListener('transitionend', onEnd); el.removeEventListener('transitioncancel', onEnd)
    ro.disconnect(); mo.disconnect(); cancelAnimationFrame(raf)
    ov?.remove()
    if (madeRelative && parent) parent.style.position = ''
  }
}

export function useScrollFades() {
  useEffect(() => {
    if (typeof ResizeObserver === 'undefined') return
    const live = new Map<HTMLElement, () => void>()
    let raf = 0
    const scan = () => {
      raf = 0
      live.forEach((off, el) => { if (!el.isConnected || !el.classList.contains('pb-fade')) { off(); live.delete(el) } })
      document.querySelectorAll<HTMLElement>('.pb-fade').forEach((el) => { if (!live.has(el)) live.set(el, watch(el)) })
    }
    // 화면에 요소가 붙고 떨어질 때만 다시 찾는다(한 프레임에 한 번). 층이 붙는 것도 변화라 한 번 더 돌지만 새로 찾을 것이 없어 멈춘다
    const mo = new MutationObserver(() => { if (!raf) raf = requestAnimationFrame(scan) })
    mo.observe(document.body, { childList: true, subtree: true })
    scan()
    return () => { mo.disconnect(); cancelAnimationFrame(raf); live.forEach((off) => off()); live.clear() }
  }, [])
}
