// 모바일: 아래로 내리는 동안 숨는 것들 — 하단 탭과 붙은 머리 묶음(사용자 지시: 유튜브의 아래 탭 · 위 머리처럼). 움직임(곡선 · 시간)은 같고 나오는 조건이 다르다.
//  · 둘 다: 아래로 내리면 숨고, 위로 올리면 나온다. 맨 위에서는 보인다.
//  · 하단 탭만: 하단 탭 자리가 화면에 들어오기 시작한 곳(4px)부터 늘 보인다 — 맨 아래에 닿아야 나오면 탭 자리 위의 것(코디 정보 / 염색의 아래 칸)을
//    누르려는데 내리던 끝에 탭이 사라져 있어 곤란했다(사용자 지적). 탭 자리 바로 위는 붙은 미리보기 아래에 목록 3줄이 다 보이는 자리라(ListArea useMobileRows)
//    그보다 먼저 나오지 않는다(셋째 줄의 [북마크 · 염색]을 덮는다).
//  · 머리 묶음은 위로 올릴 때만 나온다(사용자 지시 — 바닥에 닿을 때 하단 탭과 함께 나오면 안 된다).
// 스크롤 위치는 페이지 범위 안으로 잘라 읽는다 — 아이폰은 위 · 아래 끝에서 튕기며 범위 밖으로 나갔다 돌아오는데, 그 되돌아옴을 '올림 · 내림'으로 읽었다.
// 문서 스크롤만 본다(목록 안 가로 · 세로 넘기기는 해당 없음). 움직임은 각자 transform 으로(nav.module.css .tabNavHide · .barHide)
import { useSyncExternalStore } from 'react'

const HIDE_DELTA = 8 // 이만큼 이어서 움직여야 바꾼다(손가락 떨림 · 주소창 접힘으로 깜빡이지 않게)
type State = { nav: boolean; bar: boolean } // true = 숨음
let state: State = { nav: false, bar: false }
let frozen = false, last = 0, acc = 0, down = false, raf = 0
const subs = new Set<() => void>()
const set = (nav: boolean, bar: boolean) => { if (nav === state.nav && bar === state.bar) return; state = { nav, bar }; subs.forEach((fn) => fn()) }
const pos = () => Math.min(Math.max(0, window.scrollY), Math.max(0, document.documentElement.scrollHeight - window.innerHeight))
const check = () => {
  raf = 0
  const y = pos(), d = y - last
  last = y
  if (y <= 0) { acc = 0; down = false; set(false, false); return }
  if (d) {
    acc = Math.sign(d) === Math.sign(acc) ? acc + d : d
    if (acc > HIDE_DELTA) down = true
    else if (acc < -HIDE_DELTA) down = false
  }
  const navH = document.querySelector<HTMLElement>('[data-mobile-col] > nav[data-hero-below]')?.offsetHeight ?? 0
  const end = y + window.innerHeight >= document.documentElement.scrollHeight - navH + 4
  set(down && !end, down)
}
const onScroll = () => { if (!frozen && !raf) raf = requestAnimationFrame(check) }
const subscribe = (fn: () => void) => {
  if (!subs.size) { last = pos(); acc = 0; window.addEventListener('scroll', onScroll, { passive: true }) }
  subs.add(fn)
  return () => { subs.delete(fn); if (!subs.size) { window.removeEventListener('scroll', onScroll); if (raf) cancelAnimationFrame(raf); raf = 0; down = false; state = { nav: false, bar: false } } }
}
const useState = () => useSyncExternalStore(subscribe, () => state, () => state)
export const useNavHidden = () => useState().nav // 하단 탭
export const useBarHidden = () => useState().bar // 붙은 머리 묶음
// 창(시트 · 다이얼로그)이 떠 있는 동안은 스크롤을 보지 않고 그대로 둔다. 시트는 뒤 페이지를 position:fixed 로 고정해 스크롤이 0 이 됐다가
// 닫을 때 제자리로 돌아가는데, 그것을 '맨 위로 올림' · '내림'으로 읽어 탭이 나타났다 사라졌다(연출 설정 — 사용자 지적). 풀리면 지금 위치에서 다시 센다.
export function setScrollFrozen(f: boolean) {
  if (f === frozen) return
  frozen = f
  if (!f) { last = pos(); acc = 0 }
}
