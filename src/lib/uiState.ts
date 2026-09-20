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
}
export type UiPref = { plazaSort?: string }

const SESSION_KEY = 'pb_ui_session_v1'
const PREF_KEY = 'pb_ui_pref_v1'

export const RESTORE_TABS = new Set(['codi', 'search', 'info', 'preset', 'share'])
// 검색 결과 저장 상한(검색 자체가 topK 100 이다). sessionStorage 를 과하게 쓰지 않도록 둔다.
export const SEARCH_KEEP = 100
// 새로고침 복원 중 표시. layout.tsx 의 인라인 스크립트가 켜고, 되살리기가 끝나면 끈다.
export const RESTORE_ATTR = 'data-pb-restore'

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

export const readUiSession = (): UiSession => read<UiSession>('sessionStorage', SESSION_KEY)
export function writeUiSession(v: UiSession): void {
  if (write('sessionStorage', SESSION_KEY, v)) return
  // 검색 결과가 커서 막혔을 수 있다 → 결과만 빼고 다시. 탭·검색어는 반드시 남겨야 한다.
  write('sessionStorage', SESSION_KEY, { ...v, searchResults: undefined })
}
export const readUiPref = (): UiPref => read<UiPref>('localStorage', PREF_KEY)
export const writeUiPref = (v: UiPref): void => { write('localStorage', PREF_KEY, v) }
