'use client'

// 화면 상태 기억 — 두 갈래로 나눈다(2026-09-21 사용자 지시).
//  · 영구(localStorage)   : 취향에 가까운 값. 지금은 광장 정렬 하나.
//  · 새로고침까지(sessionStorage): 길찾기 값(탭·부위·검색어·페이지·광장 필터).
//    실수로 새로고침해도 보던 자리를 잃지 않되, **탭을 닫고 다시 들어오면 깨끗한 첫 화면**
//    (코디 탭 · 전체 · 1페이지)에서 시작한다 — sessionStorage 가 그 경계를 그대로 그어 준다.
//
// 작업물(프리셋 20칸·연출 설정·찜·북마크)은 예전부터 localStorage 에 따로 있다. 여기서 다루지 않는다.
// 저장이 막힌 환경(시크릿 창 등)에서도 앱이 멀쩡해야 하므로 읽기·쓰기를 모두 try 로 감싼다.

import { useEffect, useLayoutEffect } from 'react'
import type { ListItem } from '@/lib/core/data'

// SSR 에선 useLayoutEffect 가 경고 → 클라이언트에서만 layout effect(페인트 전에 되살려 깜빡임을 막는다).
export const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect

export type UiSession = {
  primary?: string
  activeCat?: string
  search?: string
  pageByCat?: Record<string, number>
  // AI 코디 검색: 검색어와 **결과까지** 담는다. 되살릴 때 다시 검색하지 않으려는 것이다
  //  — 재검색은 외부 API 왕복이라 느리고, 같은 질의에 다른 결과가 나올 수도 있다.
  aiQ?: string
  searchQuery?: string | null
  searchResults?: ListItem[]
  // 아래 둘은 코디 광장이 있는 배포에서만 쓴다(main 에는 광장이 없어 저장되지 않는다).
  plazaFilter?: string
  plazaQ?: string
  // 서버가 그린 첫 화면과 다른 값이 들어 있는가 — 뼈대를 띄울지 말지를 layout.tsx 의 인라인
  // 스크립트가 이 한 글자로 판단한다(거기선 앱 기본값을 알 수 없다).
  dirty?: boolean
}
export type UiPref = { plazaSort?: string }

const SESSION_KEY = 'pb_ui_session_v1'
const PREF_KEY = 'pb_ui_pref_v1'
const HIST_KEY = 'pb_ui_hist_v1'

export const RESTORE_TABS = new Set(['codi', 'search', 'info', 'preset', 'share'])
// 검색 결과 저장 상한(검색 자체가 topK 100 이다). sessionStorage 를 과하게 쓰지 않도록 둔다.
export const SEARCH_KEEP = 100
// 새로고침 복원 중 표시. layout.tsx 의 인라인 스크립트가 **새로고침일 때만** 켜고,
// 되살린 화면이 실제로 그려진 뒤(uiReady) 끈다. 고정 대기 시간은 두지 않는다.
export const RESTORE_ATTR = 'data-pb-csr'

function read<T>(store: 'sessionStorage' | 'localStorage', key: string): Partial<T> {
  try {
    const raw = window[store].getItem(key)
    if (!raw) return {}
    const v = JSON.parse(raw)
    return v && typeof v === 'object' ? (v as Partial<T>) : {}
  } catch { return {} }
}
function write(store: 'sessionStorage' | 'localStorage', key: string, v: unknown): boolean {
  try { window[store].setItem(key, JSON.stringify(v)); return true } catch { return false } // 저장이 막혀도 앱은 그대로
}

// 서버 HTML(SSG)이 그리는 첫 화면과 다른 값이 하나라도 있는가.
// 같다면 되살려도 화면이 그대로라 뼈대를 띄울 이유가 없다(쓸데없는 한 프레임을 아낀다).
// ⚠️ 여기 적힌 기본값은 ShopContext 의 useState 초기값과 같아야 한다.
function differs(v: UiSession): boolean {
  return Boolean(
    (v.primary && v.primary !== 'codi') ||
    (v.activeCat && v.activeCat !== 'all') ||
    v.search || v.aiQ || v.searchQuery ||
    (v.searchResults && v.searchResults.length) ||
    (v.plazaFilter && v.plazaFilter !== 'all') || v.plazaQ ||
    (v.pageByCat && Object.values(v.pageByCat).some((n) => n !== 0)),
  )
}

export const readUiSession = (): UiSession => read<UiSession>('sessionStorage', SESSION_KEY)
export function writeUiSession(v: UiSession): void {
  const x = { ...v, dirty: differs(v) }
  if (write('sessionStorage', SESSION_KEY, x)) return
  // 검색 결과가 커서 막혔을 수 있다 → 결과만 빼고 다시. 탭·검색어는 반드시 남겨야 한다.
  write('sessionStorage', SESSION_KEY, { ...x, searchResults: undefined })
}

// ── 되돌리기/다시실행 스택(새로고침까지) ──
// 코디 자체는 localStorage(프리셋)로 살아남는데 히스토리만 사라져서, 새로고침 뒤엔 되돌릴 수 없었다.
// 수명은 다른 "보던 자리" 값들과 같게 sessionStorage — 탭을 닫으면 깨끗해진다.
// over = 그 기록이 **다른 프리셋을 덮어쓴** 기록일 때(공유 코디·광장 가져오기) 덮어쓰기 전후의 그 프리셋 내용·이름.
//        되돌리면 prev 로, 다시 실행하면 next 로 그 프리셋을 되살린다(선택 프리셋 코디만 되돌리면 덮어쓴 프리셋은 그대로 남았다).
export type PresetOver<S> = { id: string; prev: S; prevName: string; next: S; nextName: string }
export type UiHistory<S> = { stack: { snap: S; sel: string | null; over?: PresetOver<S> }[]; idx: number }
export function readUiHistory<S>(): UiHistory<S> | null {
  const h = read<UiHistory<S>>('sessionStorage', HIST_KEY)
  if (!Array.isArray(h.stack) || !h.stack.length || typeof h.idx !== 'number') return null
  if (h.idx < 0 || h.idx >= h.stack.length) return null
  if (h.stack.some((e) => !e || typeof e !== 'object' || !e.snap)) return null
  return { stack: h.stack, idx: h.idx }
}
export function writeUiHistory<S>(h: UiHistory<S>): void {
  if (!h.stack.length) { try { window.sessionStorage.removeItem(HIST_KEY) } catch {} ; return }
  // 스냅샷 50개가 저장 한도를 넘을 수 있다 → 오래된 것부터 잘라 가며 다시 시도(현재 위치는 보존).
  for (let keep = h.stack.length; keep >= 1; keep = Math.floor(keep / 2)) {
    const cut = Math.min(h.stack.length - keep, h.idx)
    if (write('sessionStorage', HIST_KEY, { stack: h.stack.slice(cut), idx: h.idx - cut })) return
  }
  try { window.sessionStorage.removeItem(HIST_KEY) } catch {}
}
export const readUiPref = (): UiPref => read<UiPref>('localStorage', PREF_KEY)
export const writeUiPref = (v: UiPref): void => { write('localStorage', PREF_KEY, v) }
