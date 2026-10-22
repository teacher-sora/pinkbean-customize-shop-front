'use client'

// 스크롤 칸의 가장자리 흐림. 더 볼 것이 남은 쪽(위 · 아래 · 왼쪽 · 오른쪽)에만 옅은 검은 흐림을 깔아, 내용이 더 있다는 것을 알린다.
// 끝까지 가면 그쪽 흐림은 천천히 사라진다.
//  - **스크롤바가 보이지 않는 칸에서만** 흐린다(사용자 지시). 스크롤바가 자리를 차지하는 칸(마우스로 쓰는 PC 의 보통 스크롤 칸)은
//    막대가 이미 더 있음을 알리므로 흐리지 않는다. 막대를 숨긴 칸(`pb-norail` — 하단 부위 줄 등)과 막대가 자리를 차지하지 않는
//    기기(휴대폰 · 터치)에서만 흐림이 생긴다. 방향마다 따로 본다(세로 막대가 보여도 가로 막대가 없으면 가로는 흐린다).
//  - 붙이는 법: 스크롤하는 요소에 클래스 `pb-fade` 를 단다. 앱(PinkbeanShop)이 이 훅 하나로 화면의 `.pb-fade` 를 찾아 지켜본다
//    (창 · 시트 · 떠 있는 목록이 열리고 닫혀도 따라간다).
//  - 남은 쪽은 `data-fade="t b l r"` 로 적는다. 흐림은 칸 위에 얹는 층(`.pb-fadeov`, 칸 바로 뒤의 형제)이 그린다 — 칸 안에 두면
//    내용과 함께 스크롤되고, 내용 아래에 두면 카드에 가려진다. 층은 칸의 자리를 따라다닌다(칸이 옆으로 미끄러질 때도).
//    층은 칸의 안쪽 여백까지 덮는다 — 흐림이 내용(아이템)이 아니라 칸의 끝에 붙어야 한다. 세로 스크롤바 자리는 덮지 않는다.
//  - 떠 있는 목록(드롭다운 · 연출 고르기 칸)은 `pb-fadepop` 을 함께 단다 — 목록이 화면에 고정된 채 떠 있으므로 층도 body 에
//    고정으로 붙여 목록 바로 위에 놓는다(목록의 둥근 모서리 · 나타나고 사라지는 불투명도를 따라간다).
//  - 쪽 번호가 있는 목록(코디 · AI 검색 · 광장의 카드 목록, 프리셋 목록)에는 달지 않는다 — 쪽 번호가 그 역할을 한다.
import { useEffect } from 'react'
import { RELAYOUT_EVENT } from '@/lib/heroView'

function watch(el: HTMLElement): () => void {
  let last: string | null = null
  const pop = el.classList.contains('pb-fadepop')
  const bothEdges = getComputedStyle(el).scrollbarGutter.includes('both')
  const parent = el.parentElement
  let madeRelative = false
  const ov = document.createElement('div')
  ov.className = pop ? 'pb-fadeov pb-fadeovfix' : 'pb-fadeov'
  ov.setAttribute('aria-hidden', 'true')
  // 세로로 더 있는 쪽 화살표(가로는 층의 ::before · ::after) — 층 안의 두 점(globals.css 의 .pb-fadear)
  ov.innerHTML = '<i class="pb-fadear pb-fadear-t"></i><i class="pb-fadear pb-fadear-b"></i>'
  if (pop) document.body.appendChild(ov)
  else if (parent) {
    // 층은 칸 바로 뒤에 둔다. 부모가 자리 기준이 아니면 기준으로 만든다(층이 엉뚱한 조상을 기준으로 잡지 않게)
    if (getComputedStyle(parent).position === 'static') { parent.style.position = 'relative'; madeRelative = true }
    el.after(ov)
  }
  const place = () => {
    // 칸이 화면에서 빠졌으면(display:none) 층도 숨긴다
    if (!el.getClientRects().length) { ov.style.display = 'none'; return }
    ov.style.display = ''
    const cs = getComputedStyle(el), r = el.getBoundingClientRect()
    // 소수점까지 맞춘다(clientWidth 는 정수라 칸이 반 픽셀 걸치면 층이 1px 모자란다)
    const bl = parseFloat(cs.borderLeftWidth) || 0, br = parseFloat(cs.borderRightWidth) || 0, bt = parseFloat(cs.borderTopWidth) || 0, bb = parseFloat(cs.borderBottomWidth) || 0
    const sbV = Math.max(0, el.offsetWidth - el.clientWidth - Math.round(bl) - Math.round(br)), sbH = Math.max(0, el.offsetHeight - el.clientHeight - Math.round(bt) - Math.round(bb))
    // 칸의 안쪽(여백 포함) 왼쪽 위 — 화면 기준. 양쪽 스크롤바 자리는 왼쪽은 덮고 오른쪽(막대)은 비운다
    let left = r.left + bl, top = r.top + bt
    if (!pop) {
      // 층이 실제로 기준 삼는 상자(offsetParent)의 안쪽 기준으로 옮긴다(부모가 display:contents 여도 맞는다)
      const cb = ov.offsetParent as HTMLElement | null
      if (cb) { const c = cb.getBoundingClientRect(); left += cb.scrollLeft - c.left - cb.clientLeft; top += cb.scrollTop - c.top - cb.clientTop }
    }
    const s = ov.style
    s.left = `${left}px`; s.top = `${top}px`
    s.width = `${Math.max(0, r.width - bl - br - (bothEdges ? sbV / 2 : sbV))}px`; s.height = `${Math.max(0, r.height - bt - bb - sbH)}px`
    // 칸이 둥글면 층도 같은 둥글기(테두리 두께만큼 안쪽)
    const rad = parseFloat(cs.borderTopLeftRadius) || 0
    s.borderRadius = rad ? `${Math.max(0, rad - el.clientLeft)}px` : ''
    if (pop) { s.zIndex = String((parseInt(cs.zIndex) || 0) + 1); s.opacity = cs.opacity }
  }
  // 실제로 스크롤할 수 있는 방향만 본다. overflow 가 hidden 인 방향은 내용이 1~2px 넘쳐도(격자 반올림 등) 더 볼 것이 아니다
  const scrolls = (v: string) => v === 'auto' || v === 'scroll'
  const sync = () => {
    const cs = getComputedStyle(el)
    const x = el.scrollLeft, y = el.scrollTop
    const mx = scrolls(cs.overflowX) ? el.scrollWidth - el.clientWidth : 0, my = scrolls(cs.overflowY) ? el.scrollHeight - el.clientHeight : 0
    // 그 방향의 스크롤바가 자리를 차지하고 있으면(보이면) 그 방향은 흐리지 않는다
    const barV = el.offsetWidth - el.clientWidth - Math.round(parseFloat(cs.borderLeftWidth) || 0) - Math.round(parseFloat(cs.borderRightWidth) || 0) > 0
    const barH = el.offsetHeight - el.clientHeight - Math.round(parseFloat(cs.borderTopWidth) || 0) - Math.round(parseFloat(cs.borderBottomWidth) || 0) > 0
    const v = [!barV && y > 1 && 't', !barV && my > 1 && y < my - 1 && 'b', !barH && x > 1 && 'l', !barH && mx > 1 && x < mx - 1 && 'r'].filter(Boolean).join(' ')
    if (v !== last) { last = v; el.dataset.fade = v; ov.dataset.fade = v }
  }
  const all = () => { sync(); place() }
  // 칸이 옆으로 미끄러지는 동안(연출 설정의 두 칸 등)은 매 프레임 자리를 따라간다
  let raf = 0, moving = 0
  const follow = () => { place(); raf = moving > 0 ? requestAnimationFrame(follow) : 0 }
  // 떠 있는 목록은 나타나고 사라지는 불투명도도 따라간다
  const tracked = (e: TransitionEvent) => e.target === el && (e.propertyName === 'transform' || (pop && e.propertyName === 'opacity'))
  const onRun = (e: TransitionEvent) => { if (!tracked(e)) return; moving++; if (!raf) raf = requestAnimationFrame(follow) }
  const onEnd = (e: TransitionEvent) => { if (!tracked(e) || pop) return; moving = Math.max(0, moving - 1); place() }
  // 떠 있는 목록은 잠깐 떠 있는 동안 늘 따라간다(열리는 움직임이 전환이 아니라 애니메이션인 것도 있다)
  if (pop) { moving = 1; raf = requestAnimationFrame(follow) }
  el.addEventListener('scroll', sync, { passive: true })
  window.addEventListener(RELAYOUT_EVENT, all) // 보기를 바꿔 칸이 자리만 옮겨 간 때(크기 변화가 없어 ResizeObserver 가 모른다)
  el.addEventListener('transitionrun', onRun)
  el.addEventListener('transitionend', onEnd)
  el.addEventListener('transitioncancel', onEnd)
  // 칸의 크기나 안의 내용(바로 아래 자식들의 크기), 부모의 크기가 바뀌면 다시 잰다. 자식이 바뀌면 지켜볼 자식도 다시 고른다
  const ro = new ResizeObserver(all)
  const observeKids = () => { ro.disconnect(); ro.observe(el); if (parent && !pop) ro.observe(parent); for (const c of Array.from(el.children)) ro.observe(c) }
  const mo = new MutationObserver(() => { observeKids(); all() })
  mo.observe(el, { childList: true })
  observeKids()
  all()
  return () => {
    el.removeEventListener('scroll', sync); window.removeEventListener(RELAYOUT_EVENT, all);el.removeEventListener('transitionrun', onRun); el.removeEventListener('transitionend', onEnd); el.removeEventListener('transitioncancel', onEnd)
    ro.disconnect(); mo.disconnect(); cancelAnimationFrame(raf)
    ov.remove()
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
