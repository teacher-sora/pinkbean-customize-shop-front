// 테마(사용자 지시): 시스템(OS 를 따른다) · 라이트 · 다크. 헤더의 버튼을 누를 때마다 한 단계씩 바뀐다(배경 시간대 버튼과 같은 몸짓).
// 고른 값은 이 브라우저에만(localStorage `pb_theme_v1`). <html data-theme> 로 알린다 — 시스템이면 속성을 뗀다(globals.css 가 OS 를 본다).
// 지금 테마를 따르는 것: 미리보기 배경 '시스템'과 손대지 않은 프리셋 카드 바탕(--pb-sys-bg). 첫 그리기 전에 layout 의 인라인 스크립트가 속성을 단다(깜빡임 없게).
import { useSyncExternalStore } from 'react'

export type Theme = 'system' | 'light' | 'dark'
export const THEMES: { id: Theme; label: string }[] = [{ id: 'system', label: '시스템' }, { id: 'light', label: '라이트' }, { id: 'dark', label: '다크' }]
export const THEME_KEY = 'pb_theme_v1'

let cur: Theme | null = null
const subs = new Set<() => void>()
const read = (): Theme => {
  if (cur) return cur
  try { const v = localStorage.getItem(THEME_KEY); cur = v === 'light' || v === 'dark' ? v : 'system' } catch { cur = 'system' }
  return cur
}
// <html data-theme> 를 지금 값으로(React 가 <html> 을 다시 그리면 인라인 스크립트가 단 속성이 지워질 수 있다 — 헤더가 붙을 때 다시 단다)
export function applyThemeAttr () {
  const t = read()
  if (t === 'system') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', t)
}
export function setTheme (t: Theme) {
  cur = t
  try { if (t === 'system') localStorage.removeItem(THEME_KEY); else localStorage.setItem(THEME_KEY, t) } catch { /* 이번 화면에서만 */ }
  if (t === 'system') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', t)
  subs.forEach((f) => f())
}
const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f) } }
export const useTheme = (): Theme => useSyncExternalStore(subscribe, read, () => 'system')
// 지금 어두운가(그림으로 내보낼 때 색을 고르는 데 쓴다)
export const isDarkTheme = (): boolean => {
  const t = typeof window === 'undefined' ? 'system' : read()
  return t === 'dark' || (t === 'system' && typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches)
}
