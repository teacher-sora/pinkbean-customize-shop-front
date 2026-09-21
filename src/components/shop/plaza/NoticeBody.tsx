'use client'

// 공지 및 건의함(간이, 2026-09-21 사용자 지시) — 하단 탭 '공지 및 건의함'을 누르면 서피스로 연다.
//  · 공지는 운영자가 Supabase 대시보드(plaza_notices)에서 쓴다. 앱에는 쓰기 화면이 없다(계정이 없어 운영자를 가릴 수 없다).
//  · 공지가 하나면 바로 그 공지를, 여럿이면 목록부터(고정 → 최신 순).
//  · 댓글로 신고·건의를 받는다. 한 쪽에 20개, 최신이 위, 쪽 넘김. 이름은 광장 댓글과 같은 익명 이름(같은 사람 = 같은 이름).
//    운영자 uid(plaza_admins)의 댓글은 '운영자'. 지우기는 본인 것만(두 번 누르기).
// 탭 전체 화면 대신 서피스로 둔 이유: 4개 폭의 새 레이아웃 없이 기존 상세·댓글 부품을 그대로 쓴다('간이').

import clsx from 'clsx'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  NOTICE_PAGE, PLAZA_COMMENT_MAX, addNoticeComment, deleteNoticeComment, loadNoticeComments, loadNotices, plazaAlias, plazaWhen,
  type NoticeComment, type PlazaNotice,
} from '@/lib/plaza'
import { CONFIRM_ATTR, confirmTwice } from '@/lib/confirmTwice'
import { useShop } from '../ShopContext'
import { IconChevronLeft, IconChevronRight, IconTrashSolid } from '../ui/Icons'
import styles from './plaza.module.css'

export default function NoticeBody({ mobile }: { mobile: boolean }) {
  const s = useShop()
  const [notices, setNotices] = useState<PlazaNotice[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    loadNotices()
      .then((l) => { if (!alive) return; setNotices(l); if (l.length === 1) setOpenId(l[0].id) })
      .catch(() => { if (alive) { setNotices([]); setFailed(true) } })
    return () => { alive = false }
  }, [])

  const open = notices?.find((n) => n.id === openId) || null
  return (
    <div className={clsx('pb-scroll', styles.detail, styles.ntBody, mobile && styles.ntBodyM)}>
      {!notices && (
        <div className={styles.cmtSkel}>
          <span className="pb-skel" style={{ width: '48%' }} />
          <span className="pb-skel" style={{ width: '72%' }} />
        </div>
      )}
      {notices && !notices.length && (
        <p className={styles.cmtEmpty}>{failed ? '공지를 불러오지 못했어요.' : '아직 올라온 공지가 없어요.'}</p>
      )}
      {notices && notices.length > 0 && !open && (
        <div className={styles.ntList}>
          {notices.map((n) => (
            <button key={n.id} type="button" onClick={() => setOpenId(n.id)} className={styles.ntRow}>
              {n.pinned && <span className={styles.cmtChip}>고정</span>}
              <span className={styles.ntRowTitle}>{n.title}</span>
              <span className={styles.ntRowDate}>{plazaWhen(n.createdAt)}</span>
            </button>
          ))}
        </div>
      )}
      {open && (
        <>
          <div className={styles.ntHead}>
            {notices!.length > 1 && (
              <button type="button" onClick={() => setOpenId(null)} className={styles.cmtReplyBtn}>목록</button>
            )}
            <span className={styles.ntTitle}>{open.title}</span>
            <span className={styles.ntDate}>{plazaWhen(open.createdAt)}</span>
          </div>
          {open.body.trim() && <p className={clsx(styles.descText, styles.ntText)}>{open.body}</p>}
          <div className={styles.ntHr} />
          <NoticeComments key={open.id} notice={open} mobile={mobile} notify={s.notify} />
        </>
      )}
    </div>
  )
}

function NoticeComments({ notice, mobile, notify }: { notice: PlazaNotice; mobile: boolean; notify: (m: string) => void }) {
  const [page, setPage] = useState(0)
  const [data, setData] = useState<{ list: NoticeComment[]; total: number } | null>(null)
  const [failed, setFailed] = useState(false)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const headRef = useRef<HTMLDivElement>(null)

  const load = useCallback((p: number) => {
    setFailed(false)
    return loadNoticeComments(notice.id, p)
      .then((d) => setData(d))
      .catch(() => { setData({ list: [], total: 0 }); setFailed(true) })
  }, [notice.id])
  useEffect(() => { void load(page) }, [load, page])

  const pages = Math.max(1, Math.ceil((data?.total ?? 0) / NOTICE_PAGE))
  // 쪽을 넘기면 댓글 머리로 올라간다(아래쪽 쪽 넘김 버튼에서 누르므로 그대로 두면 새 쪽의 끝부터 보인다).
  const go = (p: number) => {
    if (p < 0 || p >= pages || p === page) return
    setPage(p)
    headRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' })
  }
  const text0 = text.trim()
  const canSend = !!text0 && !busy
  const send = () => {
    if (!canSend) return
    setBusy(true)
    addNoticeComment(notice.id, text0)
      // 새 댓글은 첫 쪽 맨 위에 있다 → 첫 쪽으로 가서 다시 읽는다.
      .then(() => { setText(''); if (page === 0) void load(0); else setPage(0) })
      .catch(() => notify('댓글을 남기지 못했어요. 잠시 후 다시 시도해 주세요'))
      .finally(() => setBusy(false))
  }
  const remove = (c: NoticeComment) => {
    if (!confirmTwice(`ntc:${c.id}`)) { notify('한 번 더 누르면 댓글을 지워요'); return }
    deleteNoticeComment(c.id)
      .then(() => load(page))
      .catch(() => notify('댓글을 지우지 못했어요'))
  }

  return (
    <div className={styles.ntCmt}>
      <div ref={headRef} className={styles.cmtHead}>
        <span className={styles.descLabel}>건의 · 신고</span>
        {data && <span className={styles.cmtCount}>{data.total}</span>}
      </div>
      <div className={styles.cmtForm}>
        <textarea value={text} maxLength={PLAZA_COMMENT_MAX} onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (!mobile && e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send() } }}
          placeholder="건의하거나 신고할 내용을 남겨 주세요" aria-label="댓글 입력"
          className={clsx('pb-input', 'pb-scroll', styles.cmtInput, mobile && styles.cmtInputM)} />
        <div className={styles.cmtFormFoot}>
          <span className={styles.cmtLen}>{text.length}/{PLAZA_COMMENT_MAX}</span>
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={send} disabled={!canSend}
            className={clsx(styles.cmtSend, !canSend && styles.cmtSendOff)}>등록</button>
        </div>
      </div>
      <div className={styles.ntCmtList}>
        {!data && (
          <div className={styles.cmtSkel}>
            <span className="pb-skel" style={{ width: '62%' }} />
            <span className="pb-skel" style={{ width: '88%' }} />
          </div>
        )}
        {data && !data.list.length && <p className={styles.cmtEmpty}>{failed ? '댓글을 불러오지 못했어요.' : '첫 의견을 남겨 주세요.'}</p>}
        {data?.list.map((c) => (
          <div key={c.id} className={styles.cmtItem}>
            <div className={styles.cmtMeta}>
              <span className={clsx(styles.cmtWho, c.admin && styles.cmtWhoAuthor, c.mine && !c.admin && styles.cmtWhoMine)}>
                {c.admin ? '운영자' : plazaAlias(c.owner)}
              </span>
              {c.mine && !c.admin && <span className={clsx(styles.cmtChip, styles.cmtChipMine)}>나</span>}
              <span className={styles.cmtTime}>{plazaWhen(c.createdAt)}</span>
              {c.mine && (
                <button type="button" onClick={() => remove(c)} {...{ [CONFIRM_ATTR]: `ntc:${c.id}` }}
                  title="댓글 지우기 (두 번 누르기)" aria-label="댓글 지우기" className={styles.cmtDel}>
                  <IconTrashSolid />
                </button>
              )}
            </div>
            <p className={styles.cmtBody}>{c.body}</p>
          </div>
        ))}
      </div>
      {pages > 1 && (
        <div className={styles.ntPager}>
          <div className={styles.pageChipM}>
            <button type="button" onClick={() => go(page - 1)} title="이전 쪽" aria-label="이전 쪽" className={clsx('pb-arrow', styles.arrow, page > 0 && styles.arrowOn)}><IconChevronLeft /></button>
            <span className={styles.ntPageNum}>{page + 1} / {pages}</span>
            <button type="button" onClick={() => go(page + 1)} title="다음 쪽" aria-label="다음 쪽" className={clsx('pb-arrow', styles.arrow, page < pages - 1 && styles.arrowOn)}><IconChevronRight /></button>
          </div>
        </div>
      )}
    </div>
  )
}
