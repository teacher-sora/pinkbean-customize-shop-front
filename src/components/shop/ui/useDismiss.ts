'use client'

// 떠 있는 것(펼침 창 · 팝박스 · 말 입력칸)을 바깥 누름 · Esc 로 닫는다 — 보기 설정 · 드롭다운 · 팝박스 · 말 입력칸 · 광장 올리기 고르기가 함께 쓴다.
// 열려 있는 동안만 문서 전체의 누름을 캡처 단계에서 먼저 본다(그 위에 붙은 헤더 · 미리보기를 눌러도 닫히게).
//  · event: 'pointerdown'(기본) | 'click' — click + swallow 면 바깥 누름은 닫기만 하고 아래로 넘기지 않는다(보기 설정: 그 누름이 카드에 닿아 아이템이 입혀지면 안 된다)
//  · esc: false 면 Esc 를 받지 않는다. 함수면 그때그때 받을지 묻는다(말 입력칸 — 이모티콘 시트가 떠 있으면 시트가 먼저 닫힌다)
import { useEffect, useRef } from 'react'

export function useDismiss (open: boolean, inside: (t: Node) => boolean, close: () => void, opt: { event?: 'pointerdown' | 'click'; swallow?: boolean; esc?: boolean | (() => boolean) } = {}) {
  const live = useRef({ inside, close, opt })
  live.current = { inside, close, opt }
  useEffect(() => {
    if (!open) return
    const ev = live.current.opt.event ?? 'pointerdown'
    const onPress = (e: Event) => {
      if (live.current.inside(e.target as Node)) return
      if (live.current.opt.swallow) { e.preventDefault(); e.stopPropagation() }
      live.current.close()
    }
    const onKey = (e: KeyboardEvent) => {
      const esc = live.current.opt.esc ?? true
      if (e.key !== 'Escape' || esc === false || (typeof esc === 'function' && !esc())) return
      e.stopImmediatePropagation(); live.current.close()
    }
    window.addEventListener(ev, onPress, true)
    window.addEventListener('keydown', onKey, true)
    return () => { window.removeEventListener(ev, onPress, true); window.removeEventListener('keydown', onKey, true) }
  }, [open])
}
