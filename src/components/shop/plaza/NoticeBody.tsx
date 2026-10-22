'use client'

// 건의함 및 가이드 — 하단 탭 '건의함 및 가이드'를 누르면 서피스로 연다. 탭 넷: 건의 · 오류 · 가이드 · 공지(처음은 건의).
//  · 공지는 거의 쓰지 않아 맨 끝에 둔다(이름에서도 뺐다 — 사용자 판단 요청). 운영자가 쓸 때를 위해 탭은 남긴다.
//  · 공지는 운영자가 Supabase 대시보드(plaza_notices)에서 쓴다. 앱에는 쓰기 화면이 없다. 하나면 바로 그 공지를, 여럿이면 목록부터.
//  · 건의 · 오류는 같은 표에 종류로 나눠 담는다(lib/plaza 의 loadFeedback · supabase/0018 · 0019). 목록은 글마다 상자 하나,
//    한 쪽에 20개, 최신이 위, 쪽 넘김. 상자를 누르면 그 글의 상세(댓글 · 답글 나무, FeedbackThread)로 미끄러진다.
//    누구나 댓글과 답글(댓글부터 세 단까지)을 단다. 이름은 광장 댓글과 같은 익명 이름, 운영자 글은 '운영자'(/suggestion 에서 단다).
//    지우기는 본인 것만(두 번 누르기). 답글이 달린 글을 지우면 자리만 남는다.
//  · 가이드는 기능 안내다(lib/guide 의 목록 + back 의 /guide). 모델은 목록에서 고르기만 하고, 화면은 목록에 적힌 글과
//    '열어 보기'를 보여 준다. 대화는 이 창을 닫았다 열어도 이어진다(새로고침하면 비워진다).
//  · 건의를 올리기 전에 이미 있는 기능인지 한 번 묻는다. 있으면 그 기능을 보여 주고 '그래도 등록'으로 올린다.
//    건의 · 오류 칸에서 '질문하기'를 누르면 쓰던 글을 그대로 가이드 탭으로 넘겨 묻는다.
//  · 탭을 바꾸면 본문이 가로로 미끄러진다 — 부위 염색 ↔ 염색 전환과 같은 움직임 · 시간(ShopContext 의 slideTo).

import clsx from 'clsx'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  NOTICE_PAGE, addFeedback, deleteFeedback, loadFeedback, loadFeedbackThread, loadNotices, plazaWhen,
  type FeedbackKind, type FeedbackNode, type FeedbackPost, type PlazaNotice,
} from '@/lib/plaza'
import { CONFIRM_ATTR, confirmTwice } from '@/lib/confirmTwice'
import { askGuide, guideById, guideFor, guideOn, type GuideEntry, type GuideReply } from '@/lib/guide'
import { useShop } from '../ShopContext'
import { useInnerSlide } from '../surface/innerSlide'
import { SurfaceFooter } from '../surface/Surface'
import { IconChevronLeft, IconChevronRight, IconHelpTab, IconTrashSolid } from '../ui/Icons'
import { FeedbackBox, FeedbackBoxSkel, FeedbackNodeSkel, FeedbackPostBody, FeedbackThread, InputBar } from './FeedbackThread'
import styles from './plaza.module.css'

type Tab = 'notice' | 'idea' | 'bug' | 'ask'
const TABS: { v: Tab; l: string; t: string }[] = [
  { v: 'idea', l: '건의', t: '있었으면 하는 기능' },
  { v: 'bug', l: '오류', t: '이상하게 보이거나 동작하지 않는 것' },
  { v: 'ask', l: '가이드', t: '기능이 어디 있는지 물어보기' },
  { v: 'notice', l: '공지', t: '운영자 공지' },
]
const ORDER: Tab[] = TABS.map((t) => t.v)
const SLIDE_SWAP_MS = 90, SLIDE_IN_MS = 110   // ShopContext 의 PART_SLIDE_* 와 같다

// 가이드 대화 — 창을 닫았다 열어도 이어지게 모듈에 둔다
export type ChatMsg = { id: number; who: 'me' | 'bot'; text: string; reply?: GuideReply; pending?: boolean }
let chatKeep: ChatMsg[] = []
let chatSeq = 0

export default function NoticeBody({ mobile }: { mobile: boolean }) {
  const s = useShop()
  const [tab, setTab] = useState<Tab>('idea')
  const [shown, setShown] = useState<Tab>('idea')
  const [slide, setSlide] = useState(0)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  const [drafts, setDrafts] = useState<Record<FeedbackKind, string>>({ idea: '', bug: '' })
  const [chat, setChat] = useState<ChatMsg[]>(chatKeep)
  const [askBusy, setAskBusy] = useState(false)
  // 푸터의 '이전': 공지 · 글 상세에 들어가 있으면 그 화면이 돌아갈 길을 넘긴다(부위 염색 → 염색과 같은 자리 — 본문에 '목록' 버튼을 두지 않는다)
  const [back, setBackFn] = useState<(() => void) | null>(null)
  const setBack = useCallback((fn: (() => void) | null) => setBackFn(() => fn), [])
  useEffect(() => { chatKeep = chat }, [chat])
  useEffect(() => () => { for (const t of timers.current) clearTimeout(t) }, [])

  const go = (next: Tab) => {
    if (next === tab) return
    const dir = ORDER.indexOf(next) > ORDER.indexOf(tab) ? 1 : -1
    for (const t of timers.current) clearTimeout(t)
    setTab(next)
    setSlide(-34 * dir)
    timers.current = [
      setTimeout(() => { setShown(next); setSlide(34 * dir) }, SLIDE_SWAP_MS),
      setTimeout(() => setSlide(0), SLIDE_IN_MS),
    ]
  }

  const ask = (q0: string) => {
    const q = q0.trim().slice(0, 300)
    if (!q || askBusy) return
    const mine: ChatMsg = { id: ++chatSeq, who: 'me', text: q }
    const wait: ChatMsg = { id: ++chatSeq, who: 'bot', text: '', pending: true }
    const history = chat.slice(-6).map((m) => ({ r: m.who === 'me' ? 'u' : 'a', t: m.who === 'me' ? m.text : botText(m) }))
    setChat((c) => [...c, mine, wait])
    setAskBusy(true)
    askGuide(q, 'ask', history, mobile)
      .then((reply) => setChat((c) => c.map((m) => (m.id === wait.id ? { ...m, pending: false, reply } : m))))
      .finally(() => setAskBusy(false))
  }
  // 건의 · 오류 칸에서 쓰던 글을 가이드에 묻기
  const askFrom = (kind: FeedbackKind) => {
    const q = drafts[kind].trim()
    if (!q) return
    setDrafts((d) => ({ ...d, [kind]: '' }))
    go('ask')
    ask(q)
  }
  // 가이드 답이 목록에 없으면 그 질문을 갈래에 맞는 칸(오류 신고 → 오류, 바라는 기능 → 건의)으로
  const toFeedback = (k: FeedbackKind, q: string) => { setDrafts((d) => ({ ...d, [k]: q })); go(k) }

  return (
    <>
    <div className={styles.hp}>
      {/* 탭 넷을 폭 가득 같은 너비로 — 그림 + 낱말. 모바일은 그림 위 낱말(하단 탭과 같은 짜임) */}
      <div role="tablist" aria-label="건의함 및 가이드" className={clsx(styles.hpTabs, mobile && styles.hpTabsM)}>
        {TABS.map((t) => (
          <button key={t.v} type="button" role="tab" aria-selected={tab === t.v} onClick={() => go(t.v)} title={t.t}
            className={clsx(styles.hpTab, mobile && styles.hpTabM, tab === t.v && styles.hpTabOn)}>
            <IconHelpTab tab={t.v} size={15} /><span>{t.l}</span>
          </button>
        ))}
      </div>
      <div className={styles.hpSlide} style={{ transform: `translateX(${slide}px)`, opacity: slide ? 0 : 1 }}>
        {shown === 'notice' && <Notices mobile={mobile} setBack={setBack} />}
        {(shown === 'idea' || shown === 'bug') && (
          <Feedback key={shown} kind={shown} mobile={mobile} notify={s.notify}
            draft={drafts[shown]} setDraft={(v) => setDrafts((d) => ({ ...d, [shown]: v }))}
            onAsk={() => askFrom(shown)} setBack={setBack} />
        )}
        {shown === 'ask' && <Ask mobile={mobile} chat={chat} busy={askBusy} onAsk={ask} onLeave={toFeedback} onGo={s.guideGo} />}
      </div>
    </div>
    <SurfaceFooter onBack={back ?? undefined} closeToo />
    </>
  )
}

// 대화 기록으로 넘길 안내 쪽 말(짧게)
const botText = (m: ChatMsg) => {
  const r = m.reply
  if (!r) return ''
  if (r.kind === 'feature') return r.ids.map((id) => guideById.get(id)?.title).filter(Boolean).join(', ')
  if (r.kind === 'chat') return r.reply
  if (r.kind === 'none') return r.type === 'other' ? r.reply : r.type === 'bug' ? '오류 신고' : '목록에 없는 기능'
  return ''
}

// 불러오는 중이 잠깐이면 뼈대를 보이지 않는다(번쩍 나타났다 사라지는 깜빡임). 이만큼 넘게 걸릴 때만 뼈대를 그린다
const SKEL_AFTER_MS = 400
function useLate(loading: boolean) {
  const [late, setLate] = useState(false)
  useEffect(() => {
    if (!loading) { setLate(false); return }
    const t = setTimeout(() => setLate(true), SKEL_AFTER_MS)
    return () => clearTimeout(t)
  }, [loading])
  return loading && late
}
// 한 번 받은 것은 기억해 두고(창을 닫았다 열거나 탭을 오가도) 바로 보여 준 뒤 새로 받아 바꾼다
const noticeKeep: { list: PlazaNotice[] | null } = { list: null }
const fbKeep = new Map<string, { list: FeedbackPost[]; total: number }>()

/* ── 공지 ── */
function Notices({ mobile, setBack }: { mobile: boolean; setBack: (fn: (() => void) | null) => void }) {
  const [notices, setNotices] = useState<PlazaNotice[] | null>(noticeKeep.list)
  const skel = useLate(!notices)
  const [failed, setFailed] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    loadNotices()
      .then((l) => { noticeKeep.list = l; if (!alive) return; setNotices(l); if (l.length === 1) setOpenId(l[0].id) })
      .catch(() => { if (alive) { setNotices([]); setFailed(true) } })
    return () => { alive = false }
  }, [])
  const open = notices?.find((n) => n.id === openId) || null
  const many = (notices?.length ?? 0) > 1
  const shut = useCallback(() => setOpenId(null), [])
  useEffect(() => { setBack(open && many ? shut : null) }, [open, many, shut, setBack])
  useEffect(() => () => setBack(null), [setBack])
  return (
    <div className={clsx('pb-scroll', 'pb-fade', styles.hpScroll, mobile && styles.hpScrollM)}>
      <div className={styles.hpCol}>
        {skel && (
          <div className={styles.ntList} aria-hidden>
            <div className={clsx(styles.ntRow, styles.ntRowSkel)}><span className="pb-skel" style={{ width: '46%' }} /></div>
          </div>
        )}
        {notices && !notices.length && <p className={styles.cmtEmpty}>{failed ? '공지를 불러오지 못했어요.' : '아직 올라온 공지가 없어요.'}</p>}
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
              <span className={styles.ntTitle}>{open.title}</span>
              <span className={styles.ntDate}>{plazaWhen(open.createdAt)}</span>
            </div>
            {open.body.trim() && <p className={clsx(styles.descText, styles.ntText)}>{open.body}</p>}
          </>
        )}
      </div>
    </div>
  )
}

/* ── 건의 · 오류 ── */
// 목록(글마다 상자 하나) ↔ 상세(글 + 댓글 · 답글)는 탭 전환과 같은 가로 슬라이드로 바뀐다(surface/innerSlide).
// 목록으로 돌아오면 보던 자리로 스크롤을 되돌리고, 댓글 수가 바뀌었을 수 있어 조용히 다시 받는다.
const FB_TEXT: Record<FeedbackKind, { ph: string; label: string; empty: string; done: string }> = {
  idea: { ph: '있었으면 하는 기능을 적어 주세요', label: '건의', empty: '첫 건의를 남겨 주세요.', done: '건의를 남겼어요' },
  bug: { ph: '어떤 아이템에서 무엇이 이상한지 적어 주세요', label: '오류', empty: '올라온 오류 보고가 없어요.', done: '오류 보고를 남겼어요' },
}
function Feedback({ kind, mobile, notify, draft, setDraft, onAsk, setBack }: {
  kind: FeedbackKind; mobile: boolean; notify: (m: string) => void; draft: string; setDraft: (v: string) => void; onAsk: () => void
  setBack: (fn: (() => void) | null) => void
}) {
  const T = FB_TEXT[kind]
  const [page, setPage] = useState(0)
  const [data, setData] = useState<{ list: FeedbackPost[]; total: number } | null>(() => fbKeep.get(`${kind}:0`) ?? null)
  const skel = useLate(!data)
  const [failed, setFailed] = useState(false)
  const [busy, setBusy] = useState(false)
  // 건의를 올리기 전 확인: 이미 있는 기능이면 그 기능을 보여 주고, 같은 글로 한 번 더 누르면 그대로 올린다
  const [found, setFound] = useState<{ text: string; ids: string[] } | null>(null)
  const { view, go, style } = useInnerSlide<'list' | 'post'>('list')
  const [post, setPost] = useState<FeedbackPost | null>(null)
  const headRef = useRef<HTMLDivElement>(null)   // 목록 맨 위(쪽을 넘기면 여기로)
  const listScroll = useRef<HTMLDivElement>(null)
  const keepTop = useRef(0)
  const s = useShop()

  const load = useCallback((p: number) => {
    setFailed(false)
    const kept = fbKeep.get(`${kind}:${p}`)
    if (kept) setData(kept)   // 쪽을 넘길 때도 기억한 쪽이면 바로(없으면 지금 쪽을 그대로 둔 채 받는다 — 뼈대로 바꾸지 않는다)
    return loadFeedback(kind, p)
      .then((d) => { fbKeep.set(`${kind}:${p}`, d); setData(d) })
      .catch(() => { setData({ list: [], total: 0 }); setFailed(true) })
  }, [kind])
  useEffect(() => { void load(page) }, [load, page])
  // 목록으로 돌아오면 보던 자리로
  useLayoutEffect(() => { if (view === 'list' && listScroll.current) listScroll.current.scrollTop = keepTop.current }, [view])

  const pages = Math.max(1, Math.ceil((data?.total ?? 0) / NOTICE_PAGE))
  const goPage = (p: number) => {
    if (p < 0 || p >= pages || p === page) return
    setPage(p)
    // 목록 맨 위로 — 스크롤 칸만 움직인다(scrollIntoView 는 창 바깥 틀까지 밀어 올린다)
    const sc = listScroll.current, h = headRef.current
    if (sc && h) sc.scrollTo({ top: Math.max(0, h.getBoundingClientRect().top - sc.getBoundingClientRect().top + sc.scrollTop - 8), behavior: 'smooth' })
  }
  const text0 = draft.trim()
  const post0 = () => {
    setBusy(true)
    addFeedback(kind, text0)
      .then(() => { setDraft(''); setFound(null); notify(T.done); if (page === 0) void load(0); else setPage(0) })
      .catch(() => notify('글을 남기지 못했어요. 잠시 후 다시 시도해 주세요'))
      .finally(() => setBusy(false))
  }
  const send = () => {
    if (!text0 || busy) return
    if (kind !== 'idea' || found?.text === text0) { post0(); return }
    setBusy(true)
    askGuide(text0, 'check', [], mobile)
      .then((r) => {
        if (r.kind === 'feature' && r.ids.length) { setFound({ text: text0, ids: r.ids }); setBusy(false) }
        else { setBusy(false); post0() }
      })
  }
  const open = (p: FeedbackPost) => {
    keepTop.current = listScroll.current?.scrollTop ?? 0
    setPost(p)
    go('post', 1)
  }
  // '이전'은 늘 같은 함수(푸터에 넘긴다) — 안에서 지금의 go · load · page 를 읽는다(go 는 그릴 때마다 새로 생긴다)
  const latest = useRef({ go, load, page })
  latest.current = { go, load, page }
  const back = useCallback(() => { const l = latest.current; l.go('list', -1); void l.load(l.page) }, [])
  useEffect(() => { setBack(view === 'post' ? back : null) }, [view, back, setBack])
  useEffect(() => () => setBack(null), [setBack])
  // 본인 글은 목록에서도 지운다(두 번 누르기). 댓글이 달린 글은 자리만 남는다(DB)
  const removeBox = (p: FeedbackPost) => {
    if (!confirmTwice(`ntc:${p.id}`, '한 번 더 누르면 글을 지워요')) return
    deleteFeedback(p.id).then(() => { notify('글을 지웠어요'); void load(page) }).catch(() => notify('글을 지우지 못했어요'))
  }
  const hit = found && found.text === text0 ? found.ids.map((id) => guideById.get(id)).filter((g): g is GuideEntry => !!g) : []

  return (
    <div className={styles.hpSlide} style={style}>
      {view === 'post' && post ? (
        <FeedbackDetail key={post.id} post={post} mobile={mobile} notify={notify} onGone={back} />
      ) : (
        <>
        <div ref={listScroll} className={clsx('pb-scroll', 'pb-fade', styles.hpScroll, mobile && styles.hpScrollM)}>
          <div className={styles.hpCol}>
            <div ref={headRef} className={clsx(styles.fbList, mobile && styles.fbListM)}>
              {skel && [0, 1, 2, 3, 4, 5].slice(0, mobile ? 4 : 6).map((i) => <FeedbackBoxSkel key={i} />)}
              {data && !data.list.length && <p className={styles.cmtEmpty}>{failed ? '글을 불러오지 못했어요.' : T.empty}</p>}
              {data?.list.map((p) => <FeedbackBox key={p.id} p={p} onOpen={() => open(p)} del={p.mine ? delButton(p.id, () => removeBox(p)) : undefined} />)}
            </div>
            {pages > 1 && (
              <div className={styles.ntPager}>
                <div className={styles.pageChipM}>
                  <button type="button" onClick={() => goPage(page - 1)} disabled={page <= 0} title="이전 쪽" aria-label="이전 쪽" className={clsx('pb-arrow', styles.arrow, page > 0 && styles.arrowOn)}><IconChevronLeft /></button>
                  <span className={styles.ntPageNum}>{page + 1} / {pages}</span>
                  <button type="button" onClick={() => goPage(page + 1)} disabled={page >= pages - 1} title="다음 쪽" aria-label="다음 쪽" className={clsx('pb-arrow', styles.arrow, page < pages - 1 && styles.arrowOn)}><IconChevronRight /></button>
                </div>
              </div>
            )}
          </div>
        </div>
        <InputBar value={draft} onChange={setDraft} onSend={send} busy={busy} ph={T.ph} label={`${T.label} 입력`} mobile={mobile}
          send={hit.length ? '그래도 등록' : '등록'}
          top={hit.length > 0 && (
            <div className={clsx('pb-scroll', styles.hpFound)}>
              <p className={styles.hpFoundHead}>이미 있는 기능 같아요</p>
              {hit.map((g) => <GuideCard key={g.id} g={g} onGo={s.guideGo} />)}
            </div>
          )}
          side={(
            <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={onAsk} disabled={!text0}
              title={text0 ? '쓴 글로 가이드에 물어보기' : '물어볼 내용을 먼저 적어 주세요'} className={clsx('pb-ghost', styles.hpGhost)}>질문하기</button>
          )} />
        </>
      )}
    </div>
  )
}

// 지우기 버튼(두 번 누르기) — 목록 상자 · 상세가 함께 쓴다
const delButton = (id: string, onClick: () => void) => (
  <button type="button" onClick={onClick} {...{ [CONFIRM_ATTR]: `ntc:${id}` }} title="글 지우기 (두 번 누르기)" aria-label="글 지우기" className={styles.cmtDel}>
    <IconTrashSolid />
  </button>
)

// 글 하나: 글 → 줄 → 댓글 · 답글 나무. 두 덩어리는 줄과 넓은 간격으로 가른다(안은 좁게).
// 댓글 쓰기는 아래 띠(InputBar), 돌아가기는 푸터의 '이전'(NoticeBody)이다.
function FeedbackDetail({ post: post0, mobile, notify, onGone }: {
  post: FeedbackPost; mobile: boolean; notify: (m: string) => void; onGone: () => void
}) {
  const [post, setPost] = useState(post0)
  const [nodes, setNodes] = useState<FeedbackNode[] | null>(null)
  const skel = useLate(!nodes)
  const [failed, setFailed] = useState(false)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const load = useCallback(() => loadFeedbackThread(post0.id)
    .then((l) => { setNodes(l); setFailed(false) })
    .catch(() => { setNodes((n) => n ?? []); setFailed(true) }), [post0.id])
  useEffect(() => { void load() }, [load])

  const reply = (parentId: string, body: string) => addFeedback('idea', body, parentId)
    .then(() => load().then(() => true))
    .catch(() => { notify('댓글을 남기지 못했어요. 잠시 후 다시 시도해 주세요'); return false })
  const sendTop = () => {
    setBusy(true)
    void reply(post0.id, text).then((ok) => { if (ok) setText('') }).finally(() => setBusy(false))
  }
  const removeNode = (n: FeedbackNode) => {
    if (!confirmTwice(`ntc:${n.id}`, '한 번 더 누르면 글을 지워요')) return
    deleteFeedback(n.id).then(() => load()).catch(() => notify('글을 지우지 못했어요'))
  }
  const removePost = () => {
    if (!confirmTwice(`ntc:${post.id}`, '한 번 더 누르면 글을 지워요')) return
    const had = !!nodes?.length
    deleteFeedback(post.id)
      .then(() => { notify('글을 지웠어요'); if (had) setPost((p) => ({ ...p, deleted: true, body: '' })); else onGone() })
      .catch(() => notify('글을 지우지 못했어요'))
  }

  return (
    <>
    <div className={clsx('pb-scroll', 'pb-fade', styles.hpScroll, mobile && styles.hpScrollM)}>
      <div className={clsx(styles.hpCol, styles.fbDetail)}>
        <FeedbackPostBody p={post} del={post.mine ? delButton(post.id, removePost) : undefined} />
        <section className={styles.fbSec} aria-label="댓글">
          {skel && <FeedbackNodeSkel />}
          {nodes && !nodes.length && <p className={styles.cmtEmpty}>{failed ? '댓글을 불러오지 못했어요.' : '아직 댓글이 없어요.'}</p>}
          {nodes && nodes.length > 0 && (
            <FeedbackThread nodes={nodes} mobile={mobile} canDelete={(x) => x.mine} del={(x) => delButton(x.id, () => removeNode(x))} onReply={reply} />
          )}
        </section>
      </div>
    </div>
    {!post.deleted && <InputBar value={text} onChange={setText} onSend={sendTop} busy={busy} ph="댓글을 남겨 주세요" label="댓글 입력" mobile={mobile} />}
    </>
  )
}

/* ── 기능 하나(목록에 적힌 글 그대로) ── */
// 위치 · 쓰는 법 · '열어 보기'는 PC 와 휴대폰이 다르다(lib/guide 의 guideFor)
function GuideCard({ g: g0, onGo }: { g: GuideEntry; onGo: (g: GuideEntry) => void }) {
  const mobile = useShop().bp === 'mobile'
  if (!guideOn(g0, mobile)) return null   // 다른 기기에만 있는 기능(예: 휴대폰의 캐릭터 크게 보기)은 보여 주지 않는다
  const g = guideFor(g0, mobile)
  return (
    <div className={styles.hpCard}>
      <span className={styles.hpCardTitle}>{g.title}</span>
      <p className={styles.hpCardHow}>{g.how}</p>
      {g.go && <button type="button" onClick={() => onGo(g)} className={clsx('pb-ghost', styles.hpGhost, styles.hpCardGo)}>열어 보기</button>}
    </div>
  )
}

/* ── 가이드 ── */
const STARTERS = ['표정은 어디서 바꿔요?', '닉네임으로 코디를 불러올 수 있나요?', '무기 이펙트를 끄고 싶어요', '캐릭터 이미지를 저장하고 싶어요']
function Ask({ mobile, chat, busy, onAsk, onLeave, onGo }: {
  mobile: boolean; chat: ChatMsg[]; busy: boolean; onAsk: (q: string) => void; onLeave: (k: FeedbackKind, q: string) => void; onGo: (g: GuideEntry) => void
}) {
  const [text, setText] = useState('')
  const logRef = useRef<HTMLDivElement>(null)
  // 새 말이 오면 맨 아래로
  useEffect(() => { const el = logRef.current; if (el) el.scrollTo({ top: el.scrollHeight, behavior: chat.length > 2 ? 'smooth' : 'auto' }) }, [chat])
  const send = () => { const t0 = text.trim(); if (!t0 || busy) return; onAsk(t0); setText('') }
  return (
    <div className={styles.hpAsk}>
      <div ref={logRef} className={clsx('pb-scroll', 'pb-fade', styles.hpScroll, mobile && styles.hpScrollM)}>
        <div className={clsx(styles.hpCol, styles.hpLog)}>
          {!chat.length && (
            <div className={styles.hpIntro}>
              <p className={styles.hpIntroTitle}>궁금한 기능을 물어보세요</p>
              <p className={styles.cmtEmpty}>어디 있는지 알려 드려요.</p>
              <div className={styles.hpStarters}>
                {STARTERS.map((q) => <button key={q} type="button" onClick={() => onAsk(q)} disabled={busy} className={clsx('pb-soft', styles.hpStarter)}>{q}</button>)}
              </div>
            </div>
          )}
          {chat.map((m, i) => (m.who === 'me'
            ? <p key={m.id} className={styles.hpMe}>{m.text}</p>
            : <BotMsg key={m.id} m={m} q={chat[i - 1]?.text || ''} onLeave={onLeave} onGo={onGo} />))}
        </div>
      </div>
      <InputBar value={text} onChange={setText} onSend={send} busy={busy} ph="궁금한 기능을 물어보세요" label="질문 입력" mobile={mobile}
        max={300} enterSend send="보내기" />
    </div>
  )
}

function BotMsg({ m, q, onLeave, onGo }: { m: ChatMsg; q: string; onLeave: (k: FeedbackKind, q: string) => void; onGo: (g: GuideEntry) => void }) {
  if (m.pending) {
    return (
      <div className={clsx(styles.hpBot, styles.cmtSkel)} aria-label="답을 찾는 중">
        <span className="pb-skel" style={{ width: '58%' }} />
        <span className="pb-skel" style={{ width: '84%' }} />
      </div>
    )
  }
  const r = m.reply
  if (r?.kind === 'feature') {
    const gs = r.ids.map((id) => guideById.get(id)).filter((g): g is GuideEntry => !!g)
    return <div className={styles.hpBot}>{gs.map((g) => <GuideCard key={g.id} g={g} onGo={onGo} />)}</div>
  }
  if (r?.kind === 'chat' && r.reply) return <p className={clsx(styles.hpBot, styles.hpBotText)}>{r.reply}</p>
  // 목록에 없을 때는 말의 갈래대로: 오류 신고면 오류 칸, 바라는 기능이면 건의 칸으로 쓰던 말을 넘긴다. 상관없는 말이면 그 답만
  if (r?.kind === 'none' && r.type === 'other') {
    return <p className={clsx(styles.hpBot, styles.hpBotText)}>{r.reply || '여기서는 사이트 기능만 안내해 드릴 수 있어요.\n사이트에서 궁금한 것을 물어봐 주세요.'}</p>
  }
  if (r?.kind === 'none') {
    const bug = r.type === 'bug'
    return (
      <div className={clsx(styles.hpBot, styles.hpBotNone)}>
        <p className={styles.hpBotText}>{bug ? '오류로 보여요.\n오류로 남겨 주시면 살펴볼게요.' : '아직 없는 기능이에요.\n건의로 남겨 주시면 살펴볼게요.'}</p>
        <button type="button" onClick={() => onLeave(bug ? 'bug' : 'idea', q)} className={clsx('pb-ghost', styles.hpGhost)}>{bug ? '오류로 남기기' : '건의로 남기기'}</button>
      </div>
    )
  }
  return <p className={clsx(styles.hpBot, styles.hpBotText)}>{'지금은 답하지 못했어요.\n잠시 뒤 다시 물어봐 주세요.'}</p>
}
