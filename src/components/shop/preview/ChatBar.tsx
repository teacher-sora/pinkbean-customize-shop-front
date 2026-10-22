'use client'

// 채팅 칸(명찰 · 말풍선). 게임처럼 미리보기 아래쪽에 떠 있는 입력 칸에서 말을 보내면 말풍선이 잠깐 떴다 사라진다(CHAT_SHOW_MS).
// 한 테두리 안에 [입력][이모티콘][전송] — 프리셋의 불러오기 칸과 같은 생김새이고, 장면 위에 떠 있어 작은 떠 있는 버튼의 그림자를 쓴다.
//  · PC · 절반 · 태블릿 = 연출 설정 드로어에 붙어 있다(드로어 윗변 위). 드로어가 오르내리면 같은 전환으로 함께 오르내리고,
//    접혀 있을 때는 아래 줄(배율 · 액션 · 연출 설정) 바로 위에 뜬다. 드로어가 화면 밖으로 내려갈 때 칸만 그만큼(아래 줄 높이) 되올린다.
//  · 모바일 = 미리보기가 낮아 늘 띄워 두면 명찰을 가린다. 아래 줄의 말풍선 버튼을 누르면 아래 줄 자리에 칸이 올라오고, 바깥을 누르면 내려간다.
// 게임 채팅에는 줄바꿈이 없다 — Enter(휴대폰 자판의 보내기 · 완료 포함)가 곧 전송이다. 칸을 form 으로 감싸 제출로 보낸다:
// 한글 조합 중 Enter 도 조합이 끝난 뒤 한 번만 제출되고, 휴대폰 자판의 Enter 는 keydown 이 오지 않는 기기도 제출은 온다.
// 이모티콘(ChatEmoPicker): PC 는 표정 · 모션 고르기와 같은 작은 창(3열 · 미리보기 안쪽 10px)이 칸 위에, 모바일은 아래 시트(Surface 'emo')로.
// 말풍선을 끼었을 때만 나온다. 명찰 이름은 고른 프리셋의 이름을 그대로 쓴다(ShopContext.chatName).

import clsx from 'clsx'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { prefetchGlyphs } from '@/lib/core/chatGlyphs'
import { warmChat, warmChatUi } from '@/lib/core/chatUi'
import { CHAT_TEXT_MAX } from '@/lib/shopData'
import { useShop } from '../ShopContext'
import { IconSmile } from '../ui/Icons'
import ChatEmoPicker from './ChatEmoPicker'
import styles from './preview.module.css'

const PANEL_H = 250 // 묶음 줄 + 3열 × 2줄 남짓(표정 · 모션 고르기와 같다)
const INSET = 10    // 미리보기 안쪽 여백(표정 · 모션 고르기와 같다)
const GAP = 8       // 칸과 창 사이
const OUT_MS = 180  // 닫힘 전환이 끝난 뒤 떼어낸다
const WARM_MS = 90  // 적다가 이만큼 멈추면 말풍선을 미리 만든다
type Pos = { left: number; w: number; maxH: number; bottom: number }

export default function ChatBar ({ mobile, show, onClose }: { mobile: boolean; show: boolean; onClose?: () => void }) {
  const s = useShop()
  const [text, setText] = useState('')
  const [pos, setPos] = useState<Pos | null>(null)
  const [shown, setShown] = useState(false)
  const box = useRef<HTMLFormElement>(null), btn = useRef<HTMLButtonElement>(null), panel = useRef<HTMLDivElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const open = !!pos
  const sheetOn = s.surface?.kind === 'emo' && !s.surfaceClosing

  const close = () => { setShown(false); if (timer.current) clearTimeout(timer.current); timer.current = setTimeout(() => setPos(null), OUT_MS) }
  const toggle = () => {
    if (mobile) { s.openSheet('emo'); return } // 모바일: 넓은 아래 시트로
    if (open) { close(); return }
    if (timer.current) clearTimeout(timer.current)
    const r = box.current?.getBoundingClientRect(); if (!r) return
    const a = box.current?.closest('[data-pv-stage]')?.getBoundingClientRect() ?? { left: r.left - INSET, width: r.width + INSET * 2, top: 0 }
    setPos({ left: Math.round(a.left) + INSET, w: Math.round(a.width) - INSET * 2, bottom: Math.round(window.innerHeight - r.top) + GAP,
      maxH: Math.max(150, Math.min(PANEL_H, Math.round(r.top - a.top) - GAP - INSET)) })
  }
  useEffect(() => {
    if (!pos) return
    let r2 = 0
    const r1 = requestAnimationFrame(() => { r2 = requestAnimationFrame(() => setShown(true)) })
    return () => { cancelAnimationFrame(r1); cancelAnimationFrame(r2) }
  }, [pos])
  // 바깥을 누르거나 Esc: 이모티콘 창이 열려 있으면 창만, 아니면(모바일) 칸을 내린다. 떠 있는 창 · 시트(이모티콘 시트) 안을 누른 것은 바깥이 아니다.
  useEffect(() => {
    if (!open && !(mobile && show)) return
    const inside = (t: Node) => !!(box.current?.contains(t) || panel.current?.contains(t) || (t instanceof Element && t.closest('[role="dialog"]')))
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node
      if (open) { if (btn.current?.contains(t) || panel.current?.contains(t)) return; close(); if (!inside(t)) onClose?.(); return }
      if (!inside(t)) onClose?.()
    }
    const onKey = (e: KeyboardEvent) => { if (e.key !== 'Escape' || sheetOn) return; e.stopImmediatePropagation(); if (open) close(); else onClose?.() }
    window.addEventListener('pointerdown', onDown, true); window.addEventListener('keydown', onKey, true)
    return () => { window.removeEventListener('pointerdown', onDown, true); window.removeEventListener('keydown', onKey, true) }
  }, [open, mobile, show, onClose, sheetOn])
  useEffect(() => { if (!show && open) close() }, [show]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])
  // 모바일: 칸이 올라오면 바로 적을 수 있게
  useEffect(() => { if (mobile && show) box.current?.querySelector('input')?.focus({ preventScroll: true }) }, [mobile, show])

  // 적는 동안 보낼 말풍선을 미리 만든다(글자 도트 · 그림 캐시) — 전송하면 그리기만 한다. 글자를 칠 때마다가 아니라 잠깐 멈췄을 때.
  const ui = (!s.hidden.chatBalloon ? s.equipped.chatBalloon?.chatUi : undefined) ?? s.chatDefault ?? undefined
  useEffect(() => { if (show) prefetchGlyphs(true) }, [show]) // 칸이 나오면 나머지 한글 도트도 한가할 때 받아 둔다
  useEffect(() => { if (show) warmChatUi(ui) }, [show, ui])   // 말풍선 틀도(처음 보내는 말풍선이 틀을 받느라 늦지 않게)
  useEffect(() => {
    const t = text.trim()
    if (!show || !ui || !t) return
    const id = setTimeout(() => warmChat(ui, s.chatName, t), WARM_MS)
    return () => clearTimeout(id)
  }, [text, show, ui, s.chatName])

  const can = !!text.trim()
  const send = () => { const t = text.trim(); if (!t) return; s.sendChat({ text: t }); setText('') }
  return (
    <form ref={box} data-guide={mobile ? undefined : 'chat'} inert={!show || undefined} onSubmit={(e) => { e.preventDefault(); send() }} className={clsx(styles.chatBox, mobile && styles.chatBoxM, show && styles.chatBoxOn)}>
      <input value={text} maxLength={CHAT_TEXT_MAX} onChange={(e) => setText(e.target.value)} tabIndex={show ? 0 : -1}
        placeholder="말풍선에 띄울 말" aria-label="채팅" enterKeyHint="send" autoComplete="off" className={styles.chatField} />
      <button ref={btn} type="button" onClick={toggle} aria-expanded={mobile ? sheetOn : open} title="이모티콘" aria-label="이모티콘"
        className={clsx(styles.chatEmoBtn, (open || sheetOn) && styles.chatEmoBtnOn)}><IconSmile size={16} /></button>
      <button type="submit" disabled={!can} title={can ? '말풍선 띄우기' : '말을 적으면 보낼 수 있어요'}
        className={clsx('pb-solid', styles.chatSend)}>전송</button>
      {open && typeof document !== 'undefined' && createPortal(
        <div ref={panel} role="dialog" aria-label="이모티콘" className={clsx(styles.pvPanel, styles.chatEmoPanel, shown && styles.pvPanelOn)}
          style={{ left: pos!.left, bottom: pos!.bottom, width: pos!.w, height: pos!.maxH }}>
          <ChatEmoPicker mobile={false} onPick={(emo) => { s.sendChat({ text: '', emo }); close() }} />
        </div>,
        document.body,
      )}
    </form>
  )
}
