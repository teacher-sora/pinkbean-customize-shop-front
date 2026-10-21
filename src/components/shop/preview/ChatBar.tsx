'use client'

// 채팅 칸(dev 전용 — 명찰 · 말풍선). 게임처럼 미리보기 아래쪽에 떠 있는 입력 칸에서 말을 보내면 말풍선이 잠깐 떴다 사라진다(CHAT_SHOW_MS).
// 한 테두리 안에 [입력][이모티콘][전송] — 프리셋의 불러오기 칸과 같은 생김새이고, 장면 위에 떠 있어 작은 떠 있는 버튼의 그림자를 쓴다.
//  · PC · 절반 · 태블릿 = 연출 설정 드로어에 붙어 있다(드로어 윗변 위). 드로어가 오르내리면 같은 전환으로 함께 오르내리고,
//    접혀 있을 때는 아래 줄(배율 · 액션 · 연출 설정) 바로 위에 뜬다. 드로어가 화면 밖으로 내려갈 때 칸만 그만큼(아래 줄 높이) 되올린다.
//  · 모바일 = 미리보기가 낮아 늘 띄워 두면 명찰을 가린다. 아래 줄의 말풍선 버튼을 누르면 아래 줄 자리에 칸이 올라오고, 바깥을 누르면 내려간다.
// 이모티콘은 표정 · 모션 고르기와 같은 작은 창(3열 · 미리보기 안쪽 10px 여백)으로 칸 위에 뜨고, 고르면 바로 보낸다.
// 묶음 줄은 막대를 숨긴 가로 줄이라 휠로 옆으로 움직이고(ui/useWheelRail) 양끝이 흐려진다(pb-fade). 모바일은 창이 미리보기 아래로 내려온다.
// 말풍선을 끼었을 때만 나온다. 명찰 이름은 고른 프리셋의 이름을 그대로 쓴다(ShopContext.chatName).

import clsx from 'clsx'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { ChatEmo } from '@/lib/core/chatUi'
import { CHAT_EMO_FILE, CHAT_TEXT_MAX } from '@/lib/shopData'
import { useShop } from '../ShopContext'
import { IconSmile } from '../ui/Icons'
import { useWheelRail } from '../ui/useWheelRail'
import styles from './preview.module.css'

type EmoSet = { id: string; name: string; icon: string | null; items: ChatEmo[] }
let emoSets: Promise<EmoSet[]> | null = null
const loadEmoSets = () => (emoSets ??= fetch(CHAT_EMO_FILE).then((r) => (r.ok ? r.json() : Promise.reject(new Error('emo')))).catch((e) => { emoSets = null; throw e }))

const PANEL_H = 250 // 묶음 줄 + 3열 × 2줄 남짓(표정 · 모션 고르기와 같다)
const INSET = 10    // 미리보기 안쪽 여백(표정 · 모션 고르기와 같다)
const GAP = 8       // 칸과 창 사이
const OUT_MS = 180  // 닫힘 전환이 끝난 뒤 떼어낸다
type Pos = { left: number; w: number; maxH: number; bottom?: number; top?: number }

export default function ChatBar ({ mobile, show, onClose }: { mobile: boolean; show: boolean; onClose?: () => void }) {
  const s = useShop()
  const [text, setText] = useState('')
  const [pos, setPos] = useState<Pos | null>(null)
  const [shown, setShown] = useState(false)
  const [sets, setSets] = useState<EmoSet[] | null>(null)
  const [set, setSet] = useState(0)
  const box = useRef<HTMLDivElement>(null), btn = useRef<HTMLButtonElement>(null), panel = useRef<HTMLDivElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const open = !!pos
  const rail = useWheelRail<HTMLDivElement>(open && !!sets?.length)

  const close = () => { setShown(false); if (timer.current) clearTimeout(timer.current); timer.current = setTimeout(() => setPos(null), OUT_MS) }
  const toggle = () => {
    if (open) { close(); return }
    if (timer.current) clearTimeout(timer.current)
    const r = box.current?.getBoundingClientRect(); if (!r) return
    const area = box.current?.closest('[data-pv-stage], [data-hero]')?.getBoundingClientRect()
    if (mobile && area) {
      // 모바일: 미리보기가 낮아 그 아래로 내려온다(가로는 미리보기 안쪽 여백만큼 들인다)
      const top = Math.round(area.bottom) + GAP
      setPos({ left: Math.round(area.left) + 12, w: Math.round(area.width) - 24, top, maxH: Math.max(150, Math.min(PANEL_H, window.innerHeight - top - 12)) })
    } else {
      const a = area ?? { left: r.left - INSET, width: r.width + INSET * 2, top: 0 }
      setPos({ left: Math.round(a.left) + INSET, w: Math.round(a.width) - INSET * 2, bottom: Math.round(window.innerHeight - r.top) + GAP,
        maxH: Math.max(150, Math.min(PANEL_H, Math.round(r.top - a.top) - GAP - INSET)) })
    }
    loadEmoSets().then(setSets).catch(() => setSets([]))
  }
  useEffect(() => {
    if (!pos) return
    let r2 = 0
    const r1 = requestAnimationFrame(() => { r2 = requestAnimationFrame(() => setShown(true)) })
    return () => { cancelAnimationFrame(r1); cancelAnimationFrame(r2) }
  }, [pos])
  // 바깥을 누르거나 Esc: 이모티콘 창이 열려 있으면 창만, 아니면(모바일) 칸을 내린다
  useEffect(() => {
    if (!open && !(mobile && show)) return
    const inside = (t: Node) => !!(box.current?.contains(t) || panel.current?.contains(t))
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node
      if (open) { if (btn.current?.contains(t) || panel.current?.contains(t)) return; close(); if (!inside(t)) onClose?.(); return }
      if (!inside(t)) onClose?.()
    }
    const onKey = (e: KeyboardEvent) => { if (e.key !== 'Escape') return; e.stopImmediatePropagation(); if (open) close(); else onClose?.() }
    window.addEventListener('pointerdown', onDown, true); window.addEventListener('keydown', onKey, true)
    return () => { window.removeEventListener('pointerdown', onDown, true); window.removeEventListener('keydown', onKey, true) }
  }, [open, mobile, show, onClose])
  useEffect(() => { if (!show && open) close() }, [show]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])
  // 모바일: 칸이 올라오면 바로 적을 수 있게
  useEffect(() => { if (mobile && show) box.current?.querySelector('input')?.focus({ preventScroll: true }) }, [mobile, show])

  const can = !!text.trim()
  const send = () => { const t = text.trim(); if (!t) return; s.sendChat({ text: t }); setText('') }
  const cur = sets?.[set]
  return (
    <div ref={box} inert={!show || undefined} className={clsx(styles.chatBox, mobile && styles.chatBoxM, show && styles.chatBoxOn)}>
      <input value={text} maxLength={CHAT_TEXT_MAX} onChange={(e) => setText(e.target.value)} tabIndex={show ? 0 : -1}
        onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); send() } }}
        placeholder="말풍선에 띄울 말" aria-label="채팅" enterKeyHint="send" className={styles.chatField} />
      <button ref={btn} type="button" onClick={toggle} aria-expanded={open} title="이모티콘" aria-label="이모티콘"
        className={clsx(styles.chatEmoBtn, open && styles.chatEmoBtnOn)}><IconSmile size={16} /></button>
      <button type="button" onClick={send} disabled={!can} title={can ? '말풍선 띄우기' : '말을 적으면 보낼 수 있어요'}
        className={clsx('pb-solid', styles.chatSend)}>전송</button>
      {open && typeof document !== 'undefined' && createPortal(
        <div ref={panel} role="dialog" aria-label="이모티콘"
          className={clsx(styles.pvPanel, styles.chatEmoPanel, pos!.top != null && styles.chatEmoPanelDown, shown && styles.pvPanelOn)}
          style={{ left: pos!.left, top: pos!.top, bottom: pos!.bottom, width: pos!.w, height: pos!.maxH }}>
          <div ref={rail} role="tablist" aria-label="이모티콘 묶음" className={clsx('pb-norail', 'pb-fade', styles.chatEmoSets)}>
            {sets?.map((st, i) => (
              <button key={st.id} type="button" role="tab" onClick={() => setSet(i)} aria-selected={i === set} title={st.name} aria-label={st.name}
                className={clsx(styles.chatEmoSet, i === set && styles.chatEmoSetOn)}>
                {st.icon && <img src={st.icon} alt="" className={styles.chatPx} />}
              </button>
            ))}
          </div>
          <div role="listbox" aria-label={cur?.name ?? '이모티콘'} className={clsx('pb-scroll', 'pb-scroll-thin', 'pb-fade', styles.chatEmoScroll)}>
            <div className={styles.pvGrid}>
              {cur?.items.map((e) => (
                <button key={e.id} type="button" role="option" aria-selected={false} title={e.name}
                  onClick={() => { s.sendChat({ text: '', emo: { id: e.id, name: e.name, png: e.png, w: e.w, h: e.h, origin: e.origin } }); close() }}
                  className={styles.pvCell}>
                  <span className={styles.pvCellArt}><img src={e.png} alt="" width={e.w} height={e.h} className={styles.chatPx} /></span>
                  <span className={styles.pvCellName}>{e.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  )
}
