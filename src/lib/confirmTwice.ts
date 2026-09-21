'use client'

// 지우기 "두 번 누르기" 공용 판정(프리셋 삭제 · 광장 내리기 · 댓글 지우기).
// 통과 조건은 둘 다다(2026-09-21 사용자 지시):
//  ① 제한 시간(3초) 안에 같은 버튼을 다시 눌렀다
//  ② **그 사이에 다른 상호작용이 없었다** — 지우기를 한 번 누르고 다른 버튼을 눌렀다가 돌아와 누르면
//     예전엔 두 번으로 쳐서 지워졌다. 이제는 처음부터 다시 센다.
// 버튼에는 data-confirm-key 를 붙인다. 문서 전체의 pointerdown·keydown 을 캡처 단계에서 보고,
// 그 표시가 붙은 같은 버튼이 아니면 대기 상태를 푼다(캡처라 버튼의 onClick 보다 먼저 온다).

const WINDOW_MS = 3000
export const CONFIRM_ATTR = 'data-confirm-key'

let armed: { key: string; at: number } | null = null
let listening = false

function listen() {
  if (listening || typeof document === 'undefined') return
  listening = true
  const reset = (e: Event) => {
    if (!armed) return
    const t = e.target as Element | null
    const el = t && typeof t.closest === 'function' ? t.closest(`[${CONFIRM_ATTR}]`) : null
    if (el && el.getAttribute(CONFIRM_ATTR) === armed.key) return
    armed = null
  }
  document.addEventListener('pointerdown', reset, true)
  document.addEventListener('keydown', reset, true)
}

// true = 이번이 연속 두 번째(지워도 된다). false = 첫 번째(안내를 띄운다).
export function confirmTwice(key: string): boolean {
  listen()
  const now = Date.now()
  if (armed && armed.key === key && now - armed.at < WINDOW_MS) { armed = null; return true }
  armed = { key, at: now }
  return false
}
