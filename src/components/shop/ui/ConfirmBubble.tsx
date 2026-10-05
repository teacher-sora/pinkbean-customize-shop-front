'use client'

// 지우기 "두 번 누르기"의 되묻는 문구를 **누른 버튼 바로 위에** 띄우는 말풍선(lib/confirmTwice).
// 화면에 하나만 장착한다(PinkbeanShop). 항상 마운트해 두고 opacity·transform 만 바꾼다 — 나타날 때와 사라질 때가 같은 곡선.
//  · 위에 자리가 없으면 버튼 아래로 뒤집는다. 좌우는 화면 안으로 밀어 넣고, 꼬리는 버튼 가운데를 따라간다.
//  · 스크롤·리사이즈로 버튼이 움직이면 따라간다(프리셋 목록·댓글 목록은 안에서 스크롤된다).
//  · 문구 아래 막대가 남은 시간만큼 줄어든다(다 줄면 대기가 풀린다 — 언제까지 눌러야 하는지 보이게, 2026-10-06 사용자 지시).
//    첫 누름마다 key 를 바꿔 처음부터 다시 줄어들게 하고, 사라지는 동안에는 줄어든 자리 그대로 둔다.
//  · 누른 버튼을 찾지 못했으면(있을 수 없는 경우의 대비) 예전처럼 토스트로 알린다.

import clsx from 'clsx'
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'
import { CONFIRM_WINDOW_MS, getConfirmPending, subscribeConfirm } from '@/lib/confirmTwice'
import { useShop } from '../ShopContext'
import styles from './ui.module.css'

const GAP = 8    // 버튼과 말풍선 사이
const EDGE = 8   // 화면 가장자리 여백
const TAIL = 12  // 꼬리가 말풍선 모서리에서 떨어져야 하는 최소 거리

export default function ConfirmBubble() {
  const { notify } = useShop()
  const pending = useSyncExternalStore(subscribeConfirm, getConfirmPending, () => null)
  const ref = useRef<HTMLDivElement>(null)
  // 사라지는 동안에도 문구와 자리를 그대로 둔다(비우면 닫히는 전환 중에 글자가 먼저 사라진다).
  const [shown, setShown] = useState<{ text: string; at: number; x: number; y: number; tail: number; below: boolean } | null>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (pending && !pending.el) notify(pending.text)
  }, [pending, notify])

  useLayoutEffect(() => {
    const el = pending?.el
    const box = ref.current
    if (!pending || !el || !box) { setOpen(false); return }
    let raf = 0
    const place = () => {
      if (!el.isConnected) { setOpen(false); return }
      const r = el.getBoundingClientRect()
      const w = box.offsetWidth, h = box.offsetHeight
      const vw = document.documentElement.clientWidth
      const cx = r.left + r.width / 2
      const x = Math.round(Math.max(EDGE, Math.min(cx - w / 2, vw - EDGE - w)))
      const below = r.top - GAP - h < EDGE
      const y = Math.round(below ? r.bottom + GAP : r.top - GAP - h)
      const tail = Math.round(Math.max(TAIL, Math.min(cx - x, w - TAIL)))
      setShown((p) => (p && p.text === pending.text && p.at === pending.at && p.x === x && p.y === y && p.tail === tail && p.below === below ? p : { text: pending.text, at: pending.at, x, y, tail, below }))
    }
    // 문구를 먼저 넣어 폭을 잰 뒤 자리를 잡고, 한 프레임 뒤에 연다(등장 전환이 보이게).
    setShown((p) => (p && p.text === pending.text && p.at === pending.at ? p : { text: pending.text, at: pending.at, x: p?.x ?? 0, y: p?.y ?? 0, tail: p?.tail ?? TAIL, below: p?.below ?? false }))
    raf = requestAnimationFrame(() => { place(); raf = requestAnimationFrame(() => setOpen(true)) })
    const follow = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(place) }
    window.addEventListener('scroll', follow, true)
    window.addEventListener('resize', follow)
    return () => { cancelAnimationFrame(raf); window.removeEventListener('scroll', follow, true); window.removeEventListener('resize', follow) }
  }, [pending])

  return (
    <div ref={ref} role="status" aria-live="polite"
      className={clsx(styles.confirmBubble, shown?.below && styles.confirmBubbleBelow, open && styles.confirmBubbleShow)}
      style={{ left: shown?.x ?? 0, top: shown?.y ?? 0, ['--tail' as string]: `${shown?.tail ?? TAIL}px` }}>
      {shown?.text}
      {shown && (
        <span className={styles.confirmBar} aria-hidden>
          <span key={shown.at} className={styles.confirmBarFill} style={{ animationDuration: `${CONFIRM_WINDOW_MS}ms` }} />
        </span>
      )}
    </div>
  )
}
