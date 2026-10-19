'use client'

// 건의 · 오류 글의 부품 — 공지 및 건의함(NoticeBody)과 운영자 화면(/suggestion)이 함께 쓴다.
//  · FeedbackBox  = 목록의 글 하나(상자, 격자로 늘어선다). 누르면 상세로 간다. 본문은 몇 줄만(넘치면 말줄임), 댓글 수, 운영자 답변 여부.
//    본인 글은 상자에서 바로 지운다(del). 상자 안에 버튼이 있어 상자는 button 이 아니라 role=button 이다.
//  · FeedbackPost = 상세 맨 위의 글 본문.
//  · FeedbackThread = 댓글 · 답글 나무. depth 1 = 글에 단 댓글, 2 · 3 = 답글(댓글부터 세 단까지).
//    가장 깊은 단에는 '답글'이 없다(DB 트리거도 막는다). 답글 묶음의 왼쪽 줄은 깊이마다 진해진다(--fb-line 을 인라인으로).
//    답글 칸은 한 번에 하나만 열린다. 지운 글은 답글이 달려 있을 때만 자리가 남는다('지운 글이에요').
//  · FeedbackComposer = 답글 입력칸(나무 안에 펼친다, 운영자 화면의 댓글 칸). PC 는 Enter 로 보낸다(Shift+Enter 줄바꿈).
//  · InputBar = 창 아래, 푸터 바로 위에 붙박인 입력 띠. 건의 · 오류 글쓰기, 상세의 댓글 쓰기, 질문이 모두 이것이다 —
//    목록을 아래위로 보는 중에도 언제든 쓸 수 있게(사용자 지시). 띠는 따뜻한 바탕 + 윗줄로 본문 · 푸터와 갈린다.
//    입력칸은 한 줄에서 시작해 네 줄까지 늘고, 그 뒤로는 칸 안이 스크롤된다.

import clsx from 'clsx'
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { FEEDBACK_DEPTH, PLAZA_COMMENT_MAX, plazaAlias, plazaWhen, type FeedbackNode, type FeedbackPost } from '@/lib/plaza'
import { IconBubble } from '../ui/Icons'
import styles from './plaza.module.css'

// 답글 묶음 왼쪽 줄: 부모 깊이 1(댓글) 아래 2단은 옅게, 2 아래 3단은 진하게
const LINE: Record<number, string> = { 1: '#f4cfdf', 2: '#ec86ac' }
type Who = { owner: string; op: boolean; mine: boolean }

function WhoLine({ n, time, del }: { n: Who; time: string; del?: ReactNode }) {
  return (
    <span className={styles.cmtMeta}>
      <span className={clsx(styles.cmtWho, n.op && styles.cmtWhoAuthor, n.mine && !n.op && styles.cmtWhoMine)}>{n.op ? '운영자' : plazaAlias(n.owner)}</span>
      {n.op && <span className={styles.cmtChip}>답변</span>}
      {n.mine && !n.op && <span className={clsx(styles.cmtChip, styles.cmtChipMine)}>나</span>}
      <span className={styles.cmtTime}>{plazaWhen(time)}</span>
      {del}
    </span>
  )
}

export function FeedbackBox({ p, onOpen, del }: { p: FeedbackPost; onOpen: () => void; del?: ReactNode }) {
  return (
    <div role="button" tabIndex={0} onClick={onOpen} aria-label="글 열기"
      onKeyDown={(e) => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onOpen() } }}
      className={styles.fbBox}>
      <WhoLine n={p} time={p.createdAt} del={p.deleted || !del ? undefined : <span onClick={(e) => e.stopPropagation()} className={styles.fbBoxDel}>{del}</span>} />
      <span className={clsx(styles.fbBoxBody, p.deleted && styles.fbGone)}>{p.deleted ? '지운 글이에요' : p.body}</span>
      <span className={styles.fbBoxFoot}>
        {p.answered && <span className={clsx(styles.cmtChip, styles.fbAnswered)}>운영자 답변</span>}
        <span className={clsx(styles.fbCount, p.count > 0 && styles.fbCountOn)} aria-label={`댓글 ${p.count}개`}><IconBubble />{p.count}</span>
      </span>
    </div>
  )
}

export function FeedbackPostBody({ p, del }: { p: FeedbackPost; del?: ReactNode }) {
  return (
    <div className={styles.fbPost}>
      <WhoLine n={p} time={p.createdAt} del={p.deleted ? undefined : del} />
      <p className={clsx(styles.fbPostText, p.deleted && styles.fbGone)}>{p.deleted ? '지운 글이에요' : p.body}</p>
    </div>
  )
}

export function FeedbackComposer({ value, onChange, onSend, busy, ph, label, send = '등록', mobile, autoFocus, side }: {
  value: string; onChange: (v: string) => void; onSend: () => void; busy: boolean; ph: string; label: string
  send?: string; mobile: boolean; autoFocus?: boolean; side?: ReactNode
}) {
  const t0 = value.trim()
  const can = !!t0 && !busy
  return (
    <div className={styles.cmtForm}>
      <textarea value={value} maxLength={PLAZA_COMMENT_MAX} onChange={(e) => onChange(e.target.value)} autoFocus={autoFocus}
        onKeyDown={(e) => { if (!mobile && e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); if (can) onSend() } }}
        placeholder={ph} aria-label={label}
        className={clsx('pb-input', 'pb-scroll', styles.cmtInput, mobile && styles.cmtInputM)} />
      <div className={styles.cmtFormFoot}>
        <span className={styles.cmtLen}>{value.length}/{PLAZA_COMMENT_MAX}</span>
        <div className={styles.hpActs}>
          {side}
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { if (can) onSend() }} disabled={!can}
            title={t0 ? undefined : '내용을 먼저 적어 주세요'} className={clsx(styles.cmtSend, !can && styles.cmtSendOff)}>{send}</button>
        </div>
      </div>
    </div>
  )
}

// 한 줄 높이 = 띠의 버튼 높이(PC 32 · 휴대폰 36 — 하단 탭보다 크지 않다) ~ 네 줄
const barMin = (mobile: boolean) => (mobile ? 36 : 32)
export function InputBar({ value, onChange, onSend, busy, ph, label, send = '등록', mobile, max = PLAZA_COMMENT_MAX, enterSend, side, top }: {
  value: string; onChange: (v: string) => void; onSend: () => void; busy: boolean; ph: string; label: string
  send?: string; mobile: boolean; max?: number; enterSend?: boolean; side?: ReactNode; top?: ReactNode
}) {
  const ref = useRef<HTMLTextAreaElement>(null)
  // 쓴 만큼 늘린다(네 줄까지). 높이는 한 번에 바뀐다 — 전환하지 않는다
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const min = barMin(mobile)
    el.style.height = `${min}px`
    el.style.height = `${Math.min(min + 19.5 * 3, Math.max(min, el.scrollHeight + 2))}px`
  }, [value, mobile])
  const t0 = value.trim()
  const can = !!t0 && !busy
  const enter = enterSend ?? !mobile
  return (
    <div className={clsx(styles.hpBar, mobile && styles.hpBarM)}>
      {top}
      <div className={styles.hpBarRow}>
        <textarea ref={ref} rows={1} value={value} maxLength={max} onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => { if (enter && e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); if (can) onSend() } }}
          placeholder={ph} aria-label={label} className={clsx('pb-input', 'pb-scroll', styles.hpInput, mobile && styles.hpInputM)} />
        {!mobile && <span className={styles.hpBarLen}>{value.length}/{max}</span>}
        {side}
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { if (can) onSend() }} disabled={!can}
          title={t0 ? undefined : '내용을 먼저 적어 주세요'} className={clsx(styles.cmtSend, styles.hpSend, !can && styles.cmtSendOff)}>{send}</button>
      </div>
    </div>
  )
}

export function FeedbackThread({ nodes, mobile, canDelete, del, onReply }: {
  nodes: FeedbackNode[]; mobile: boolean
  canDelete: (n: FeedbackNode) => boolean
  del: (n: FeedbackNode) => ReactNode
  onReply: (parentId: string, body: string) => Promise<boolean>   // 성공하면 true(칸을 닫는다)
}) {
  const [replyTo, setReplyTo] = useState<string | null>(null)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const send = (id: string) => {
    setBusy(true)
    onReply(id, text).then((ok) => { if (ok) { setText(''); setReplyTo(null) } }).finally(() => setBusy(false))
  }
  const node = (n: FeedbackNode): ReactNode => (
    <div key={n.id} className={styles.fbNode}>
      <WhoLine n={n} time={n.createdAt} del={!n.deleted && canDelete(n) ? del(n) : undefined} />
      <p className={clsx(styles.cmtBody, n.deleted && styles.fbGone)}>{n.deleted ? '지운 글이에요' : n.body}</p>
      {!n.deleted && n.depth < FEEDBACK_DEPTH && (
        <button type="button" onClick={() => { setReplyTo(replyTo === n.id ? null : n.id); setText('') }} aria-expanded={replyTo === n.id}
          className={clsx(styles.cmtReplyBtn, replyTo === n.id && styles.fbReplyOn)}>{replyTo === n.id ? '답글 닫기' : '답글'}</button>
      )}
      {replyTo === n.id && (
        <div className={styles.fbReplyForm}>
          <FeedbackComposer value={text} onChange={setText} onSend={() => send(n.id)} busy={busy} mobile={mobile} autoFocus
            ph={`${n.op ? '운영자' : plazaAlias(n.owner)}에게 답글`} label="답글 입력" />
        </div>
      )}
      {n.children.length > 0 && (
        <div className={clsx(styles.fbKids, mobile && styles.fbKidsM)} style={{ '--fb-line': LINE[n.depth] || LINE[2] } as React.CSSProperties}>
          {n.children.map(node)}
        </div>
      )}
    </div>
  )
  return <div className={styles.fbThread}>{nodes.map(node)}</div>
}
