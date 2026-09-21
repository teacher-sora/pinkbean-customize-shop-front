'use client'

// 코디 광장 댓글 — PC 는 상세 오른쪽 열, 모바일은 설명 아래.
//  · 로그인을 받지 않으므로 **모두 익명**이다. 번호('익명 1') 대신 uid 를 해시해 고정 이름을 뽑는다(lib/plaza.ts).
//    같은 사람은 어느 글에서나 같은 이름 → 대화를 따라갈 수 있다. 드물게 겹칠 때만 짧은 꼬리표를 붙인다.
//  · 답글은 **1단까지** 접는다(유튜브와 같게). 답글에 다시 답글을 달면 같은 스레드 끝에 붙고 앞에
//    '@이름' 이 들어간다 — 들여쓰기가 깊어지면 좁은 열에서 읽을 수 없고, DB 트리거도 2단을 막는다.
//  · 목록과 달리 캐시하지 않는다. 내가 쓴 댓글이 바로 안 보이면 고장으로 느껴진다.
//  · 지우기는 글 내리기와 같은 **두 번 누르기**(3초 안에, 다른 상호작용 없이 연속으로 — lib/confirmTwice).
//    버튼은 숨기지 않는다 — 있는 줄 몰라서 못 지우는 게 더 나쁘다. 첫 번째 누름의 안내는 토스트로만 한다.

import clsx from 'clsx'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  PLAZA_COMMENT_MAX, addComment, deleteComment, loadComments, plazaAlias, plazaAliasTag, plazaWhen,
  type PlazaComment, type PlazaPost,
} from '@/lib/plaza'
import { CONFIRM_ATTR, confirmTwice } from '@/lib/confirmTwice'
import { useShop } from '../ShopContext'
import { IconTrashSolid } from '../ui/Icons'
import styles from './plaza.module.css'

type Thread = { top: PlazaComment; replies: PlazaComment[] }
// 답글 입력칸의 위치(root = 스레드 원댓글)와 누른 댓글(at). 답글을 눌렀으면 at 이 그 답글이다.
type ReplyTo = { root: string; at: string } | null

export default function PlazaComments({ post, mobile }: { post: PlazaPost; mobile: boolean }) {
  const s = useShop()
  const [list, setList] = useState<PlazaComment[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [replyTo, setReplyTo] = useState<ReplyTo>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let alive = true
    setList(null); setFailed(false); setReplyTo(null)
    loadComments(post)
      .then((r) => { if (alive) setList(r) })
      .catch(() => { if (alive) { setList([]); setFailed(true) } })
    return () => { alive = false }
  }, [post])

  // 원댓글 + 그 아래 답글로 묶는다(둘 다 시간순).
  const threads = useMemo<Thread[]>(() => {
    const all = list || []
    const tops = all.filter((c) => !c.parentId)
    const byParent = new Map<string, PlazaComment[]>()
    for (const c of all) {
      if (!c.parentId) continue
      const arr = byParent.get(c.parentId)
      if (arr) arr.push(c); else byParent.set(c.parentId, [c])
    }
    return tops.map((top) => ({ top, replies: byParent.get(top.id) || [] }))
  }, [list])

  // 이름표. 같은 이름이 둘 이상 나올 때만 꼬리표를 붙여 구분한다.
  const names = useMemo(() => {
    const owners = Array.from(new Set((list || []).map((c) => c.owner)))
    const bucket = new Map<string, string[]>()
    for (const o of owners) {
      const nm = plazaAlias(o)
      const arr = bucket.get(nm)
      if (arr) arr.push(o); else bucket.set(nm, [o])
    }
    const out = new Map<string, string>()
    for (const [nm, os] of bucket) for (const o of os) out.set(o, os.length > 1 ? `${nm} ${plazaAliasTag(o)}` : nm)
    return out
  }, [list])

  const scrollToEnd = () => requestAnimationFrame(() => {
    const el = listRef.current
    if (el && !mobile) el.scrollTop = el.scrollHeight
  })
  const onAdded = (c: PlazaComment) => { setList((l) => [...(l || []), c]); setReplyTo(null); scrollToEnd() }

  const remove = (c: PlazaComment) => {
    if (confirmTwice(`cmt:${c.id}`)) {
      // 원댓글을 지우면 딸린 답글도 함께 사라진다(DB 도 cascade).
      setList((l) => (l || []).filter((x) => x.id !== c.id && x.parentId !== c.id))
      deleteComment(c).catch(() => {
        s.notify('댓글을 지우지 못했어요')
        loadComments(post).then(setList).catch(() => undefined)
      })
      return
    }
    s.notify('한 번 더 누르면 댓글을 지워요')
  }

  const nameOf = (c: PlazaComment) => names.get(c.owner) || plazaAlias(c.owner)
  // 본문 앞의 '@이름' 을 알아본다(지금 목록에 있는 이름만 — 아무 '@' 나 칠하지 않는다). 긴 이름부터 맞춘다.
  const known = useMemo(() => Array.from(new Set(names.values())).sort((a, b) => b.length - a.length), [names])
  const body = (text: string) => {
    if (text.startsWith('@')) {
      const hit = known.find((nm) => text.startsWith(`@${nm} `) || text === `@${nm}`)
      if (hit) return <><span className={styles.cmtAt}>@{hit}</span>{text.slice(hit.length + 1)}</>
    }
    return text
  }
  const toggleReply = (c: PlazaComment) => {
    const root = c.parentId || c.id
    setReplyTo((r) => (r && r.at === c.id ? null : { root, at: c.id }))
  }

  const row = (c: PlazaComment, reply: boolean) => (
    <div key={c.id} className={clsx(styles.cmtItem, reply && styles.cmtItemReply)}>
      <div className={styles.cmtMeta}>
        <span className={clsx(styles.cmtWho, c.author && styles.cmtWhoAuthor, c.mine && styles.cmtWhoMine)}>
          {nameOf(c)}
        </span>
        {c.author && <span className={styles.cmtChip}>글쓴이</span>}
        {c.mine && !c.author && <span className={clsx(styles.cmtChip, styles.cmtChipMine)}>나</span>}
        <span className={styles.cmtTime}>{plazaWhen(c.createdAt)}</span>
        {c.canDelete && (
          <button type="button" onClick={() => remove(c)} {...{ [CONFIRM_ATTR]: `cmt:${c.id}` }}
            title="댓글 지우기 (두 번 누르기)" aria-label="댓글 지우기" className={styles.cmtDel}>
            <IconTrashSolid />
          </button>
        )}
      </div>
      <p className={styles.cmtBody}>{reply ? body(c.body) : c.body}</p>
      <button type="button" onClick={() => toggleReply(c)} className={styles.cmtReplyBtn}>
        {replyTo?.at === c.id ? '답글 취소' : '답글'}
      </button>
    </div>
  )

  const n = list?.length ?? 0
  return (
    <div className={clsx(styles.cmtCol, mobile && styles.cmtColM)}>
      <div className={styles.cmtHead}>
        <span className={styles.descLabel}>댓글</span>
        {list && <span className={styles.cmtCount}>{n}</span>}
      </div>

      <div ref={listRef} className={clsx('pb-scroll', styles.cmtList, mobile && styles.cmtListM)}>
        {!list && (
          <div className={styles.cmtSkel}>
            <span className="pb-skel" style={{ width: '62%' }} />
            <span className="pb-skel" style={{ width: '88%' }} />
            <span className="pb-skel" style={{ width: '45%' }} />
          </div>
        )}
        {list && n === 0 && (
          <p className={styles.cmtEmpty}>{failed ? '댓글을 불러오지 못했어요.' : '첫 댓글을 남겨보세요.'}</p>
        )}
        {threads.map((t) => (
          <div key={t.top.id} className={styles.cmtThread}>
            {row(t.top, false)}
            {(t.replies.length > 0 || replyTo?.root === t.top.id) && (
              <div className={styles.cmtReplies}>
                {t.replies.map((r) => row(r, true))}
                {replyTo?.root === t.top.id && (() => {
                  // 답글에 답글을 달 때만 '@이름 ' 으로 시작한다(자기 답글이면 붙이지 않는다).
                  const at = t.replies.find((r) => r.id === replyTo.at)
                  const prefix = at && !at.mine ? `@${nameOf(at)} ` : ''
                  return <Composer key={replyTo.at} post={post} mobile={mobile} parentId={t.top.id} onAdded={onAdded} autoFocus initial={prefix} />
                })()}
              </div>
            )}
          </div>
        ))}
      </div>

      <Composer post={post} mobile={mobile} parentId={null} onAdded={onAdded} />
    </div>
  )
}

// 입력칸. 원댓글과 답글이 같은 것을 쓴다(답글은 스레드 안에 끼워 넣는다).
function Composer({ post, mobile, parentId, onAdded, autoFocus, initial = '' }: {
  post: PlazaPost; mobile: boolean; parentId: string | null
  onAdded: (c: PlazaComment) => void; autoFocus?: boolean; initial?: string
}) {
  const s = useShop()
  const [text, setText] = useState(initial)
  const [busy, setBusy] = useState(false)
  const ref = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!autoFocus || !el) return
    // 문서가 아니라 시트 안에서만 보이게 한다 — 그냥 focus() 는 브라우저가 스크롤할 곳으로 뒤 페이지(문서)를 골라
    // 마스크 뒤 배경이 움직였다(2026-09-21 사용자 제보).
    el.focus({ preventScroll: true })
    el.setSelectionRange(el.value.length, el.value.length) // '@이름 ' 뒤에서 바로 이어 쓰게
    el.scrollIntoView({ block: 'nearest' })
  }, [autoFocus])

  const text0 = text.trim()
  // '@이름' 만 있고 내용이 없으면 보내지 않는다.
  const canSend = !!text0 && text0 !== initial.trim() && !busy
  const submit = () => {
    if (!canSend) return
    setBusy(true)
    addComment(post, text0, parentId)
      // 모바일은 올라간 뒤에 키보드를 내린다(누르는 도중에 내려가면 화면 높이가 바뀌며 터치가 어긋났다).
      .then((c) => { setText(''); onAdded(c); if (mobile) ref.current?.blur() })
      .catch(() => s.notify('댓글을 남기지 못했어요. 잠시 후 다시 시도해 주세요'))
      .finally(() => setBusy(false))
  }
  return (
    <div className={clsx(styles.cmtForm, parentId && styles.cmtFormReply)}>
      <textarea
        ref={ref}
        value={text}
        maxLength={PLAZA_COMMENT_MAX}
        onChange={(e) => setText(e.target.value)}
        // PC 는 Enter 로 보내고 Shift+Enter 로 줄을 바꾼다. 모바일 키보드의 Enter 는 줄바꿈 그대로 둔다.
        onKeyDown={(e) => { if (!mobile && e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); submit() } }}
        placeholder={parentId ? '답글 작성' : '댓글 작성'}
        aria-label={parentId ? '답글 입력' : '댓글 입력'}
        className={clsx('pb-input', 'pb-scroll', styles.cmtInput, mobile && styles.cmtInputM)} />
      <div className={styles.cmtFormFoot}>
        <span className={styles.cmtLen}>{text.length}/{PLAZA_COMMENT_MAX}</span>
        {/* 누를 때 입력칸 포커스를 뺏지 않는다 — 뺏으면 그 순간 가상 키보드가 닫혀 화면 높이가 바뀐다. */}
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={submit} disabled={!canSend}
          className={clsx(styles.cmtSend, !canSend && styles.cmtSendOff)}>{parentId ? '답글' : '등록'}</button>
      </div>
    </div>
  )
}
