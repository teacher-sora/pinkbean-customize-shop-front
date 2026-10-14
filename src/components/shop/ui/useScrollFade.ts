'use client'

// 스크롤 칸의 가장자리 흐림. 더 볼 것이 남은 쪽(위 · 아래 · 왼쪽 · 오른쪽)에만 흐림을 깔아, 내용이 더 있다는 것을 알린다
// (하단 부위 줄의 흐림과 같은 역할). 끝까지 가면 그쪽 흐림은 사라진다.
//  - 붙이는 법: 스크롤하는 요소에 클래스 `pb-fade` 를 단다. 앱(PinkbeanShop)이 이 훅 하나로 화면의 `.pb-fade` 를 찾아 지켜본다
//    (창 · 시트 · 떠 있는 목록이 열리고 닫혀도 따라간다).
//  - 남은 쪽은 `data-fade="t b l r"` 로 적고, 흐림은 globals.css 의 `.pb-fade[data-fade]` 가 그린다(mask — 배경이 무엇이든 맞는다).
//  - 떠 있는 목록(드롭다운 · 연출 고르기 칸)은 그림자가 있어 mask 를 쓰면 그림자가 잘린다 → `pb-fadepop` 을 함께 달면
//    안쪽에 붙어 다니는 흰 흐림(::before · ::after)으로 그린다.
//  - 쪽 번호가 있는 목록(코디 · AI 검색 · 광장의 카드 목록)에는 달지 않는다 — 쪽 번호가 그 역할을 한다.
import { useEffect } from 'react'

function watch(el: HTMLElement): () => void {
  let last: string | null = null, lastSb = ''
  const bothEdges = getComputedStyle(el).scrollbarGutter.includes('both')
  const sync = () => {
    const x = el.scrollLeft, y = el.scrollTop
    const mx = el.scrollWidth - el.clientWidth, my = el.scrollHeight - el.clientHeight
    const v = [y > 1 && 't', my > 1 && y < my - 1 && 'b', x > 1 && 'l', mx > 1 && x < mx - 1 && 'r'].filter(Boolean).join(' ')
    if (v !== last) { last = v; el.dataset.fade = v }
    // 세로 스크롤바 자리는 흐리지 않는다(막대까지 흐려지면 끝이 어디인지 헷갈린다)
    const cs = getComputedStyle(el)
    const raw = el.offsetWidth - el.clientWidth - (parseFloat(cs.borderLeftWidth) || 0) - (parseFloat(cs.borderRightWidth) || 0)
    const sb = `${Math.max(0, bothEdges ? raw / 2 : raw)}px`
    if (sb !== lastSb) { lastSb = sb; el.style.setProperty('--pb-fsb', sb) }
  }
  el.addEventListener('scroll', sync, { passive: true })
  // 칸의 크기나 안의 내용(바로 아래 자식들의 크기)이 바뀌면 다시 잰다. 자식이 바뀌면 지켜볼 자식도 다시 고른다
  const ro = new ResizeObserver(sync)
  const observeKids = () => { ro.disconnect(); ro.observe(el); for (const c of Array.from(el.children)) ro.observe(c) }
  const mo = new MutationObserver(() => { observeKids(); sync() })
  mo.observe(el, { childList: true })
  observeKids()
  sync()
  return () => { el.removeEventListener('scroll', sync); ro.disconnect(); mo.disconnect() }
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
    // 화면에 요소가 붙고 떨어질 때만 다시 찾는다(한 프레임에 한 번)
    const mo = new MutationObserver(() => { if (!raf) raf = requestAnimationFrame(scan) })
    mo.observe(document.body, { childList: true, subtree: true })
    scan()
    return () => { mo.disconnect(); cancelAnimationFrame(raf); live.forEach((off) => off()); live.clear() }
  }, [])
}
