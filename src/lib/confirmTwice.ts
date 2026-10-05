'use client'

// 지우기 "두 번 누르기" 공용 판정(프리셋 삭제 · 광장 내리기 · 댓글 지우기).
// 통과 조건은 둘 다다(2026-09-21 사용자 지시):
//  ① 제한 시간(3초) 안에 같은 버튼을 다시 눌렀다
//  ② **그 사이에 다른 상호작용이 없었다** — 지우기를 한 번 누르고 다른 버튼을 눌렀다가 돌아와 누르면
//     예전엔 두 번으로 쳐서 지워졌다. 이제는 처음부터 다시 센다.
// 버튼에는 data-confirm-key 를 붙인다. 문서 전체의 pointerdown·keydown 을 캡처 단계에서 보고,
// 그 표시가 붙은 같은 버튼이 아니면 대기 상태를 푼다(캡처라 버튼의 onClick 보다 먼저 온다).
//
// 되묻는 문구는 **누른 버튼 바로 위에** 띄운다(ui/ConfirmBubble, 2026-10-06 사용자 지시 — 화면 아래 토스트는
// 누른 자리와 멀어 무엇을 되묻는지 바로 읽히지 않았다). 그래서 대기 상태(무엇을·어느 버튼에서·무슨 문구로)를
// 구독할 수 있게 내보낸다. 대기가 풀리면(다른 상호작용 · 3초 경과 · 두 번째 누름) 말풍선도 같이 사라진다.

const WINDOW_MS = 3000
export const CONFIRM_ATTR = 'data-confirm-key'

export type ConfirmPending = { key: string; text: string; el: Element | null }

let armed: { key: string; at: number } | null = null
let pending: ConfirmPending | null = null
let lastEl: Element | null = null // 방금 누른 [data-confirm-key] 버튼(같은 key 가 화면에 둘일 수 있어 실제 누른 것을 기억한다)
let timer: ReturnType<typeof setTimeout> | null = null
let listening = false
const subs = new Set<() => void>()

function setPending(p: ConfirmPending | null) {
  if (pending === p) return
  pending = p
  subs.forEach((f) => f())
}
function disarm() {
  armed = null
  if (timer) { clearTimeout(timer); timer = null }
  setPending(null)
}

function listen() {
  if (listening || typeof document === 'undefined') return
  listening = true
  const reset = (e: Event) => {
    const t = e.target as Element | null
    const el = t && typeof t.closest === 'function' ? t.closest(`[${CONFIRM_ATTR}]`) : null
    lastEl = el
    if (!armed) return
    if (el && el.getAttribute(CONFIRM_ATTR) === armed.key) return
    disarm()
  }
  document.addEventListener('pointerdown', reset, true)
  document.addEventListener('keydown', reset, true)
}

// true = 이번이 연속 두 번째(지워도 된다). false = 첫 번째 — text 를 주면 누른 버튼 위에 그 문구를 띄운다.
export function confirmTwice(key: string, text?: string): boolean {
  listen()
  const now = Date.now()
  if (armed && armed.key === key && now - armed.at < WINDOW_MS) { disarm(); return true }
  disarm()
  armed = { key, at: now }
  timer = setTimeout(disarm, WINDOW_MS)
  if (text) {
    // 방금 누른 버튼. 못 잡았으면(리스너가 붙기 전의 첫 누름 등) 포커스된 버튼 → 화면에서 같은 key 의 첫 버튼 순으로 찾는다.
    const own = (el: Element | null | undefined) => (el && el.isConnected && el.getAttribute(CONFIRM_ATTR) === key ? el : null)
    const hit = own(lastEl) ?? own(document.activeElement?.closest(`[${CONFIRM_ATTR}]`))
      ?? Array.from(document.querySelectorAll(`[${CONFIRM_ATTR}]`)).find((el) => el.getAttribute(CONFIRM_ATTR) === key) ?? null
    setPending({ key, text, el: hit })
  }
  return false
}

// 모듈이 불릴 때 바로 듣기 시작한다 — 첫 누름부터 "어느 버튼을 눌렀는지"를 알아야 말풍선을 그 위에 띄운다.
listen()

// 말풍선(ui/ConfirmBubble)용 구독 — useSyncExternalStore 와 맞춘 모양.
export const subscribeConfirm = (f: () => void) => { subs.add(f); return () => { subs.delete(f) } }
export const getConfirmPending = () => pending
