'use client'

import { useEffect } from 'react'

// apex(pinkbean-customize.com) → www 로 도메인을 옮기면서, 이전에 apex origin 의 localStorage 에 저장해 둔
// 프리셋(pb_presets_v1)·즐겨찾기(pb_favorites_v1)가 www 에선 안 보이게 됐다(localStorage 는 origin 격리).
// 유저가 DevTools 를 만질 필요 없이 **자동으로** 넘겨주기 위한 일회성 브리지:
//   www 페이지가 apex 의 `/pb-migrate` 를 숨은 iframe 으로 띄우면, 그 페이지(apex origin)가 자기 localStorage 를
//   읽어 postMessage 로 부모(www)에 넘긴다. www 는 값이 없을 때만 넣고(기존 www 데이터 보존) 플래그를 세워 한 번만 실행.
// 전제: apex 가 "리다이렉트"가 아니라 앱을 서빙하고, /pb-migrate 만 리다이렉트 예외여야 iframe 이 apex 내용을 읽는다
//   (middleware.ts 가 처리). 그 전까지는 iframe 이 www 로 튕겨 origin 검사에서 걸러지고 아무 일도 안 일어난다(무해, 다음 방문에 재시도).
const APEX_ORIGIN = 'https://pinkbean-customize.com'
const WWW_HOST = 'www.pinkbean-customize.com'
const DONE_KEY = 'pb_migrated_from_apex_v1'

// www 는 첫 로드 때 앱이 기본 프리셋(pb_presets_v1)을 자동 저장한다. 그래서 "키 존재 여부"로 가져오기를
// 막으면 apex 서빙 전환 뒤에도 스킵돼버린다. 대신 www 프리셋이 **손 안 댄 기본값**일 때만 apex 값으로 교체한다
// (= 유저가 www 에서 새로 만든 프리셋은 보존). 판정: 20개 스냅샷이 전부 동일 + 이름이 전부 기본("코디 N")이면 기본값.
function presetsArePristine(raw: string | null): boolean {
  if (!raw) return true
  try {
    const store = JSON.parse(raw) as { data?: Record<string, unknown>; names?: Record<string, string> }
    const data = store?.data
    if (!data || typeof data !== 'object') return true
    const vals = Object.values(data)
    if (!vals.length) return true
    const first = JSON.stringify(vals[0])
    if (!vals.every((v) => JSON.stringify(v) === first)) return false // 프리셋마다 내용이 다르면 = 손 댄 것
    const names = store?.names || {}
    return Object.entries(names).every(([k, n]) => n === `코디 ${Number(String(k).replace('d', '')) + 1}`)
  } catch { return false }
}
function favoritesAreEmpty(raw: string | null): boolean {
  if (!raw) return true
  try { const a = JSON.parse(raw); return Array.isArray(a) ? a.length === 0 : true } catch { return false }
}

export default function PresetMigration() {
  useEffect(() => {
    if (typeof window === 'undefined') return
    // www 에서만, 그리고 한 번만.
    if (window.location.hostname !== WWW_HOST) return
    let done = false
    try { done = !!localStorage.getItem(DONE_KEY) } catch { return }
    if (done) return

    let iframe: HTMLIFrameElement | null = null
    let timer: ReturnType<typeof setTimeout> | null = null

    const cleanup = () => {
      window.removeEventListener('message', onMsg)
      if (timer) clearTimeout(timer)
      if (iframe && iframe.parentNode) iframe.parentNode.removeChild(iframe)
      iframe = null
    }

    const onMsg = (e: MessageEvent) => {
      // apex origin 에서 온 메시지만 신뢰(리다이렉트로 www 가 뜬 경우 origin 이 달라 걸러진다).
      if (e.origin !== APEX_ORIGIN) return
      const d = e.data as { __pb_migrate?: number; presets?: string | null; favorites?: string | null } | null
      if (!d || d.__pb_migrate !== 1) return
      let imported = false
      try {
        // www 가 "손 안 댄 기본값"이고 apex 값이 다를 때만 교체 — www 에서 새로 만든 프리셋은 보존.
        const wwwPresets = localStorage.getItem('pb_presets_v1')
        if (d.presets && d.presets !== wwwPresets && presetsArePristine(wwwPresets)) {
          localStorage.setItem('pb_presets_v1', d.presets); imported = true
        }
        // 즐겨찾기: www 가 비었을 때만.
        const wwwFav = localStorage.getItem('pb_favorites_v1')
        if (d.favorites && d.favorites !== wwwFav && favoritesAreEmpty(wwwFav)) {
          localStorage.setItem('pb_favorites_v1', d.favorites)
          if (!favoritesAreEmpty(d.favorites)) imported = true
        }
        localStorage.setItem(DONE_KEY, '1') // apex 응답을 받았으면(빈 값이라도) 성공으로 보고 재시도 안 함
      } catch { /* 저장 실패해도 무해 */ }
      cleanup()
      // 넣었으면 앱이 초기화 때 이미 읽은 뒤라 새로고침해야 프리셋이 반영된다.
      if (imported) window.location.reload()
    }

    window.addEventListener('message', onMsg)
    iframe = document.createElement('iframe')
    iframe.setAttribute('aria-hidden', 'true')
    iframe.style.display = 'none'
    iframe.src = `${APEX_ORIGIN}/pb-migrate`
    document.body.appendChild(iframe)
    // apex 가 아직 리다이렉트 상태면 응답이 안 온다 → 플래그를 세우지 않고 조용히 정리(다음 방문에 재시도).
    timer = setTimeout(cleanup, 8000)

    return cleanup
  }, [])

  return null
}
