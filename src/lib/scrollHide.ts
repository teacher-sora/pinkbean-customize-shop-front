// 모바일: 아래로 내리는 동안 숨는 것들(하단 탭 · 붙은 머리 묶음 — 사용자 지시: 유튜브의 아래 탭처럼, 머리도 하단 탭과 같은 동작)이 함께 보는 숨김 상태 하나.
// 아래로 내리면 숨고, 위로 올리면 다시 나온다. 맨 위에서, 그리고 하단 탭 자리가 화면에 들어오기 시작한 곳(4px)부터는 늘 보인다 —
// 맨 아래에 닿아야 나오면 탭 자리 위의 것(코디 정보 / 염색의 아래 칸)을 누르려는데 내리던 끝에 탭이 사라져 있어 곤란했다(사용자 지적).
// 탭 자리 바로 위는 붙은 미리보기 아래에 목록 3줄이 다 보이는 자리라(ListArea useMobileRows) 그보다 먼저 나오지 않는다(셋째 줄의 [북마크 · 염색]을 덮는다).
// 문서 스크롤만 본다(목록 안 가로 · 세로 넘기기는 해당 없음). 움직임은 각자 transform 으로(nav.module.css .tabNavHide · .barHide)
import { useSyncExternalStore } from 'react'

const HIDE_DELTA = 8 // 이만큼 이어서 움직여야 바꾼다(손가락 떨림 · 주소창 접힘으로 깜빡이지 않게)
let hidden = false, frozen = false, last = 0, acc = 0, raf = 0
const subs = new Set<() => void>()
const set = (v: boolean) => { if (v === hidden) return; hidden = v; subs.forEach((fn) => fn()) }
const check = () => {
  raf = 0
  const y = window.scrollY, d = y - last
  last = y
  const nav = document.querySelector<HTMLElement>('[data-mobile-col] > nav[data-hero-below]')?.offsetHeight ?? 0
  const end = y + window.innerHeight >= document.documentElement.scrollHeight - nav + 4
  if (y <= 0 || end) { acc = 0; set(false); return }
  acc = Math.sign(d) === Math.sign(acc) ? acc + d : d
  if (acc > HIDE_DELTA) set(true)
  else if (acc < -HIDE_DELTA) set(false)
}
const onScroll = () => { if (!frozen && !raf) raf = requestAnimationFrame(check) }
const subscribe = (fn: () => void) => {
  if (!subs.size) { last = window.scrollY; acc = 0; window.addEventListener('scroll', onScroll, { passive: true }) }
  subs.add(fn)
  return () => { subs.delete(fn); if (!subs.size) { window.removeEventListener('scroll', onScroll); if (raf) cancelAnimationFrame(raf); raf = 0; hidden = false } }
}
export const useScrollHidden = () => useSyncExternalStore(subscribe, () => hidden, () => false)
// 창(시트 · 다이얼로그)이 떠 있는 동안은 스크롤을 보지 않고 그대로 둔다. 시트는 뒤 페이지를 position:fixed 로 고정해 스크롤이 0 이 됐다가
// 닫을 때 제자리로 돌아가는데, 그것을 '맨 위로 올림' · '내림'으로 읽어 탭이 나타났다 사라졌다(연출 설정 — 사용자 지적). 풀리면 지금 위치에서 다시 센다.
export function setScrollFrozen(f: boolean) {
  if (f === frozen) return
  frozen = f
  if (!f) { last = window.scrollY; acc = 0 }
}
