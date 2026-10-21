'use client'

// 채팅 칸(dev 전용 — 명찰 · 말풍선) — 게임처럼 미리보기 바로 아래에서 말을 보내면 말풍선이 잠깐 떴다 사라진다(CHAT_SHOW_MS).
// 오른쪽 끝 = 전송, 그 왼쪽 = 이모티콘(누르면 표정 · 모션 고르기처럼 3열로 스크롤되는 상자가 채팅 칸 위로 올라온다. 고르면 바로 보낸다).
// 말풍선을 끼었을 때만 보인다. 명찰 이름은 고른 프리셋의 이름을 그대로 쓴다(ShopContext.chatName).

import clsx from 'clsx'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { ChatEmo } from '@/lib/core/chatUi'
import { CHAT_EMO_FILE, CHAT_TEXT_MAX } from '@/lib/shopData'
import { useShop } from '../ShopContext'
import { IconSmile } from '../ui/Icons'
import styles from './preview.module.css'

type EmoSet = { id: string; name: string; icon: string | null; items: ChatEmo[] }
let emoSets: Promise<EmoSet[]> | null = null
const loadEmoSets = () => (emoSets ??= fetch(CHAT_EMO_FILE).then((r) => (r.ok ? r.json() : Promise.reject(new Error('emo')))).catch((e) => { emoSets = null; throw e }))

const PANEL_H = 250 // 3열 × 2줄 + 다음 줄 살짝(표정 · 모션 고르기와 같다)
const OUT_MS = 180  // 닫힘 전환이 끝난 뒤 떼어낸다

export default function ChatBar ({ mobile }: { mobile: boolean }) {
  const s = useShop()
  const [text, setText] = useState('')
  const [pos, setPos] = useState<{ left: number; bottom: number; w: number } | null>(null)
  const [shown, setShown] = useState(false)
  const [sets, setSets] = useState<EmoSet[] | null>(null)
  const [set, setSet] = useState(0)
  const bar = useRef<HTMLDivElement>(null), btn = useRef<HTMLButtonElement>(null), panel = useRef<HTMLDivElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const open = !!pos

  const close = () => { setShown(false); if (timer.current) clearTimeout(timer.current); timer.current = setTimeout(() => setPos(null), OUT_MS) }
  const toggle = () => {
    if (open) { close(); return }
    if (timer.current) clearTimeout(timer.current)
    const r = bar.current?.getBoundingClientRect(); if (!r) return
    setPos({ left: Math.round(r.left), bottom: Math.round(window.innerHeight - r.top) + 6, w: Math.round(r.width) })
    loadEmoSets().then(setSets).catch(() => setSets([]))
  }
  useEffect(() => {
    if (!pos) return
    let r2 = 0
    const r1 = requestAnimationFrame(() => { r2 = requestAnimationFrame(() => setShown(true)) })
    return () => { cancelAnimationFrame(r1); cancelAnimationFrame(r2) }
  }, [pos])
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => { const t = e.target as Node; if (btn.current?.contains(t) || panel.current?.contains(t)) return; close() }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopImmediatePropagation(); close() } }
    window.addEventListener('pointerdown', onDown, true); window.addEventListener('keydown', onKey, true)
    return () => { window.removeEventListener('pointerdown', onDown, true); window.removeEventListener('keydown', onKey, true) }
  }, [open])
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  const send = () => { const t = text.trim(); if (!t) return; s.sendChat({ text: t }); setText('') }
  const cur = sets?.[set]
  return (
    <div ref={bar} className={clsx(styles.chatBar, mobile && styles.chatBarM)}>
      <input value={text} maxLength={CHAT_TEXT_MAX} onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); send() } }}
        placeholder="말풍선에 띄울 말" aria-label="채팅" className={clsx('pb-input', styles.chatInput)} />
      <button ref={btn} type="button" onClick={toggle} aria-expanded={open} title="이모티콘" aria-label="이모티콘"
        className={clsx(styles.chatIconBtn, open && styles.chatIconBtnOn)}><IconSmile size={16} /></button>
      <button type="button" onClick={send} disabled={!text.trim()} title={text.trim() ? '말풍선 띄우기' : '말을 적으면 보낼 수 있어요'}
        className={clsx('pb-solid', styles.chatSend)}>전송</button>
      {open && typeof document !== 'undefined' && createPortal(
        <div ref={panel} role="listbox" aria-label="이모티콘" className={clsx('pb-scroll', 'pb-scroll-thin', styles.pvPanel, styles.chatEmoPanel, shown && styles.pvPanelOn)}
          style={{ left: pos!.left, bottom: pos!.bottom, width: pos!.w, maxHeight: PANEL_H }}>
          <div className={clsx('pb-norail', styles.chatEmoSets)}>
            {sets?.map((st, i) => (
              <button key={st.id} type="button" onClick={() => setSet(i)} aria-pressed={i === set} title={st.name} aria-label={st.name}
                className={clsx(styles.chatEmoSet, i === set && styles.chatEmoSetOn)}>
                {st.icon && <img src={st.icon} alt="" className={styles.chatPx} />}
              </button>
            ))}
          </div>
          <div className={styles.pvGrid}>
            {cur?.items.map((e) => (
              <button key={e.id} type="button" role="option" aria-selected={false} title={e.name}
                onClick={() => { s.sendChat({ text: '', emo: { id: e.id, name: e.name, png: e.png, w: e.w, h: e.h, origin: e.origin } }); close() }}
                className={styles.pvCell}>
                <span className={styles.pvCellArt}><img src={e.png} alt="" className={clsx(styles.chatPx, styles.chatEmoArt)} /></span>
                <span className={styles.pvCellName}>{e.name}</span>
              </button>
            ))}
          </div>
        </div>,
        document.body,
      )}
    </div>
  )
}
