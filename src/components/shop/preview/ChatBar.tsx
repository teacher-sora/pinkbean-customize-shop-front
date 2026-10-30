'use client'

// 채팅 칸(명찰 · 말풍선). 게임처럼 미리보기 아래쪽에 떠 있는 입력 칸에서 말을 보내면 말풍선이 잠깐 떴다 사라진다(CHAT_SHOW_MS).
// 한 테두리 안에 [입력][이모티콘][전송] — 프리셋의 불러오기 칸과 같은 생김새이고, 장면 위에 떠 있어 작은 떠 있는 버튼의 그림자를 쓴다.
//  · PC · 절반 · 태블릿 = 연출 설정 드로어에 붙어 있다(드로어 윗변 위). 드로어가 오르내리면 같은 전환으로 함께 오르내리고,
//    접혀 있을 때는 아래 줄(배율 · 액션 · 연출 설정) 바로 위에 뜬다. 드로어가 화면 밖으로 내려갈 때 칸만 그만큼(아래 줄 높이) 되올린다.
//  · 모바일 = 미리보기가 낮아 늘 띄워 두면 명찰을 가린다. 아래 줄의 말풍선 버튼을 누르면 아래 줄 자리에 칸이 올라오고, 바깥을 누르면 내려간다.
//    바깥 누름만으로는 닫는 법이 드러나지 않아 칸 왼쪽 끝에 정사각형 닫기 버튼(x)을 둔다(사용자 지시) — [닫기][입력][이모티콘][전송].
// 게임 채팅에는 줄바꿈이 없다 — Enter(휴대폰 자판의 보내기 · 완료 포함)가 곧 전송이다. 칸을 form 으로 감싸 제출로 보낸다:
// 한글 조합 중 Enter 도 조합이 끝난 뒤 한 번만 제출되고, 휴대폰 자판의 Enter 는 keydown 이 오지 않는 기기도 제출은 온다.
// 이모티콘(ChatEmoPicker): PC 는 표정 · 모션 고르기와 같은 팝박스(PopBox — 미리보기 안쪽 10px)가 칸 위에, 모바일은 아래 시트(Surface 'emo')로.
// 말풍선을 끼었을 때만 나온다. 명찰 이름은 고른 프리셋의 이름을 그대로 쓴다(ShopContext.chatName).

import clsx from 'clsx'
import { useEffect, useRef, useState } from 'react'
import { prefetchGlyphs } from '@/lib/core/chatGlyphs'
import { warmChat, warmChatUi } from '@/lib/core/chatUi'
import { CHAT_TEXT_MAX } from '@/lib/shopData'
import { useShop } from '../ShopContext'
import { IconClose, IconSmile } from '../ui/Icons'
import ChatEmoPicker from './ChatEmoPicker'
import { PopBox, popNear, usePop } from './PopBox'
import styles from './preview.module.css'

const WARM_MS = 90  // 적다가 이만큼 멈추면 말풍선을 미리 만든다

export default function ChatBar ({ mobile, show, onClose }: { mobile: boolean; show: boolean; onClose?: () => void }) {
  const s = useShop()
  const [text, setText] = useState('')
  const pop = usePop()
  const box = useRef<HTMLFormElement>(null), btn = useRef<HTMLButtonElement>(null)
  const open = !!pop.pos
  const sheetOn = s.surface?.kind === 'emo' && !s.surfaceClosing

  // 창은 칸 바로 위(미리보기 영역 안쪽) — 가로는 미리보기 가득(연출 설정 고르기와 같은 폭)
  const toggle = () => {
    if (mobile) { s.openSheet('emo'); return } // 모바일: 넓은 아래 시트로
    if (open) { pop.close(); return }
    const r = box.current?.getBoundingClientRect(); if (!r) return
    const a = box.current?.closest('[data-pv-stage]')?.getBoundingClientRect() ?? { left: r.left - 10, width: r.width + 20, top: 0, bottom: r.bottom }
    pop.open(popNear(r, a))
  }
  // 모바일: 바깥을 누르거나 Esc 면 칸을 내린다(창은 PopBox 가 닫는다). 시트(이모티콘 시트) 안을 누른 것은 바깥이 아니다.
  useEffect(() => {
    if (!(mobile && show)) return
    const inside = (t: Node) => !!(box.current?.contains(t) || (t instanceof Element && t.closest('[role="dialog"]')))
    const onDown = (e: PointerEvent) => { if (!inside(e.target as Node)) onClose?.() }
    const onKey = (e: KeyboardEvent) => { if (e.key !== 'Escape' || sheetOn) return; e.stopImmediatePropagation(); onClose?.() }
    window.addEventListener('pointerdown', onDown, true); window.addEventListener('keydown', onKey, true)
    return () => { window.removeEventListener('pointerdown', onDown, true); window.removeEventListener('keydown', onKey, true) }
  }, [mobile, show, onClose, sheetOn])
  useEffect(() => { if (!show && open) pop.close() }, [show]) // eslint-disable-line react-hooks/exhaustive-deps
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
      {mobile && <button type="button" onClick={onClose} tabIndex={show ? 0 : -1} title="닫기" aria-label="채팅 닫기" className={styles.chatClose}><IconClose size={14} /></button>}
      <input value={text} maxLength={CHAT_TEXT_MAX} onChange={(e) => setText(e.target.value)} tabIndex={show ? 0 : -1}
        placeholder="메시지..." aria-label="채팅" enterKeyHint="send" autoComplete="off" className={styles.chatField} />
      <button ref={btn} type="button" data-guide={mobile ? undefined : 'emo'} onClick={toggle} aria-expanded={mobile ? sheetOn : open} title="이모티콘" aria-label="이모티콘"
        className={clsx(styles.chatEmoBtn, (open || sheetOn) && styles.chatEmoBtnOn)}><IconSmile size={16} /></button>
      <button type="submit" disabled={!can} title={can ? '말풍선 띄우기' : '말을 적으면 보낼 수 있어요'}
        className={clsx('pb-solid', styles.chatSend)}>전송</button>
      <PopBox pop={pop} label="이모티콘" keep={[btn]}>
        <ChatEmoPicker mobile={false} onClose={pop.close} onPick={(emo) => { s.sendChat({ text: '', emo }); pop.close() }} />
      </PopBox>
    </form>
  )
}
