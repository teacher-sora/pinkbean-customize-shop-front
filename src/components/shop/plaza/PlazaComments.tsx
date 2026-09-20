'use client'

// 코디 광장 댓글 — PC 는 상세 오른쪽 열, 모바일은 설명 아래.
//  · 이름을 받지 않는다(계정이 없어 이름을 받으면 사칭이 된다). 글쓴이 / 나 / 익명 N 으로만 가른다.
//    '익명 N'은 그 글 안에서 처음 나타난 순서로 매긴다 — 글마다 다시 매겨지므로 사람을 추적할 수 없다.
//  · 목록과 달리 캐시하지 않는다(lib/plaza.ts). 내가 쓴 댓글이 바로 보이지 않으면 고장으로 느껴진다.
//  · 지우기는 글 내리기와 같은 **두 번 누르기(3초)**. 실수로 지워지는 쪽이 못 지우는 쪽보다 나쁘다.

import clsx from 'clsx'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  PLAZA_COMMENT_MAX, addComment, deleteComment, loadComments, plazaWhen,
  type PlazaComment, type PlazaPost,
} from '@/lib/plaza'
import { useShop } from '../ShopContext'
import { IconTrash } from '../ui/Icons'
import styles from './plaza.module.css'

export default function PlazaComments({ post, mobile }: { post: PlazaPost; mobile: boolean }) {
  const s = useShop()
  const [list, setList] = useState<PlazaComment[] | null>(null)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const del = useRef<{ id: string; at: number }>({ id: '', at: 0 })
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let alive = true
    setList(null)
    setFailed(false)
    loadComments(post)
      .then((r) => { if (alive) setList(r) })
      .catch(() => { if (alive) { setList([]); setFailed(true) } })
    return () => { alive = false }
  }, [post])

  // 글 안에서 처음 나타난 순서로 익명 번호를 매긴다(글쓴이·나는 따로 표시하므로 번호를 쓰지 않는다).
  const alias = useMemo(() => {
    const m = new Map<string, string>()
    let n = 0
    for (const c of list || []) {
      if (c.author || c.mine || m.has(c.owner)) continue
      m.set(c.owner, `익명 ${++n}`)
    }
    return m
  }, [list])

  const text0 = text.trim()
  const canSend = !!text0 && !busy
  const submit = () => {
    if (!canSend) return
    setBusy(true)
    addComment(post, text0)
      .then((c) => {
        setText('')
        setList((l) => [...(l || []), c])
        // 새 댓글은 맨 아래에 붙으므로 거기로 내려준다(내가 쓴 게 보여야 한다).
        requestAnimationFrame(() => { const el = listRef.current; if (el) el.scrollTop = el.scrollHeight })
      })
      .catch(() => s.notify('댓글을 남기지 못했어요. 잠시 후 다시 시도해 주세요'))
      .finally(() => setBusy(false))
  }
  const remove = (c: PlazaComment) => {
    const d = del.current
    if (d.id === c.id && Date.now() - d.at < 3000) {
      del.current = { id: '', at: 0 }
      setList((l) => (l || []).filter((x) => x.id !== c.id))
      deleteComment(c).catch(() => {
        setList((l) => [...(l || []), c].sort((a, b) => a.createdAt.localeCompare(b.createdAt)))
        s.notify('댓글을 지우지 못했어요')
      })
      return
    }
    del.current = { id: c.id, at: Date.now() }
    s.notify('한 번 더 누르면 댓글을 지워요')
  }

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
        {list && list.map((c) => (
          <div key={c.id} className={styles.cmtItem}>
            <div className={styles.cmtMeta}>
              <span className={clsx(styles.cmtWho, c.author && styles.cmtWhoAuthor, !c.author && c.mine && styles.cmtWhoMine)}>
                {c.author ? '글쓴이' : c.mine ? '나' : alias.get(c.owner) || '익명'}
              </span>
              <span className={styles.cmtTime}>{plazaWhen(c.createdAt)}</span>
              {c.canDelete && (
                <button type="button" onClick={() => remove(c)} title="댓글 지우기 (두 번 누르기)" aria-label="댓글 지우기"
                  className={clsx('pb-icon', styles.cmtDel)}><IconTrash /></button>
              )}
            </div>
            <p className={styles.cmtBody}>{c.body}</p>
          </div>
        ))}
      </div>

      <div className={styles.cmtForm}>
        <textarea
          value={text}
          maxLength={PLAZA_COMMENT_MAX}
          onChange={(e) => setText(e.target.value)}
          // PC 는 Enter 로 보내고 Shift+Enter 로 줄을 바꾼다. 모바일 키보드의 Enter 는 줄바꿈 그대로 둔다.
          onKeyDown={(e) => { if (!mobile && e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); submit() } }}
          placeholder="이 코디에 남길 한마디"
          aria-label="댓글 입력"
          className={clsx('pb-input', styles.cmtInput, mobile && styles.cmtInputM)} />
        <div className={styles.cmtFormFoot}>
          <span className={styles.cmtLen}>{text.length}/{PLAZA_COMMENT_MAX}</span>
          <button type="button" onClick={submit} disabled={!canSend}
            className={clsx('pb-solid', styles.cmtSend, !canSend && styles.cmtSendOff)}>등록</button>
        </div>
      </div>
    </div>
  )
}
