'use client'

// 운영자 화면. 주소(/dashboard)로 직접 들어와 아이디 · 비밀번호를 넣는다(앱 어디에도 링크가 없다). 탭 넷:
//  · 건의 · 오류: '도움 및 건의함'의 글을 종류별로 보고, 어느 글이든 '운영자'로 댓글 · 답글을 달고, 어떤 글이든 지울 수 있다.
//  · 공지: 공지를 쓰고 고친다(지우기는 없다 — 옛 건의글이 공지에 매달려 있어 함께 지워진다).
//  · 방문자: 하루 방문자 수(lib/visit — 같은 브라우저는 하루 한 번).
//  · 화면: 넓으면 왼쪽 글 상자 목록 + 오른쪽 상세(글 + 댓글 · 답글 나무). 좁으면 목록 → 상세로 가로로 미끄러진다.
//    글 상자 · 나무 · 입력칸은 앱의 건의함과 같은 부품이다(plaza/FeedbackThread).
//  · 목록 위에서 '답변 대기'(운영자 댓글이 없는 글)만 골라 볼 수 있다.
//  · 로그인은 **이 화면이 떠 있는 동안만** 유지된다 — 값은 메모리에만 두고 저장하지 않는다(새로고침하면 다시 묻는다).
//  · 아이디 · 비밀번호의 확인과 쓰기 · 지우기는 DB 함수가 한다(supabase/0016 · 0019 · 0023). 앱에는 비밀번호도 서비스 키도 없다.
//  · 지우기는 두 번 누른다(3초 안에 같은 버튼을 다시). 운영자가 지우면 딸린 댓글 · 답글도 함께 지워진다.

import clsx from 'clsx'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  loadNotices, opDelete, opLoadFeedback, opLoadThread, opLoadVisits, opLogin, opReply, opSaveNotice,
  type FeedbackKind, type FeedbackNode, type FeedbackPost, type OpCred, type OpVisits, type PlazaNotice,
} from '@/lib/plaza'
import { FeedbackBox, FeedbackBoxSkel, FeedbackComposer, FeedbackPostBody, FeedbackThread } from '@/components/shop/plaza/FeedbackThread'
import plaza from '@/components/shop/plaza/plaza.module.css'
import { useInnerSlide } from '@/components/shop/surface/innerSlide'
import { IconChevronLeft, IconHelpTab } from '@/components/shop/ui/Icons'
import styles from './dashboard.module.css'

export default function Dashboard() {
  const [cred, setCred] = useState<OpCred | null>(null)
  return (
    <main className={styles.page}>
      {cred ? <Board cred={cred} onLost={() => setCred(null)} /> : <Login onOk={setCred} />}
    </main>
  )
}

function Login({ onOk }: { onOk: (c: OpCred) => void }) {
  const [id, setId] = useState('')
  const [pw, setPw] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (busy || !id || !pw) return
    setBusy(true); setMsg('')
    opLogin({ id, pw })
      .then((ok) => { if (ok) onOk({ id, pw }); else setMsg('아이디나 비밀번호가 맞지 않아요. 여러 번 틀리면 10분 동안 잠겨요.') })
      .catch(() => setMsg('확인하지 못했어요. 잠시 후 다시 시도해 주세요.'))
      .finally(() => setBusy(false))
  }
  return (
    <div className={styles.loginWrap}>
      <form onSubmit={submit} className={styles.login}>
        <div className={styles.loginHead}>
          <span className={styles.brand}>핑크빈 커마샵</span>
          <h1 className={styles.title}>대시보드</h1>
        </div>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>아이디</span>
          <input value={id} onChange={(e) => setId(e.target.value)} autoComplete="off" autoCapitalize="none" autoFocus className={styles.input} />
        </label>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>비밀번호</span>
          <input value={pw} onChange={(e) => setPw(e.target.value)} type="password" autoComplete="off" className={styles.input} />
        </label>
        <p className={styles.msg} role="alert">{msg}</p>
        <button type="submit" disabled={busy || !id || !pw} className={styles.btn}>{busy ? '확인 중' : '들어가기'}</button>
      </form>
    </div>
  )
}

const KINDS: { v: FeedbackKind; l: string }[] = [{ v: 'idea', l: '건의' }, { v: 'bug', l: '오류' }]
type Tab = FeedbackKind | 'notice' | 'visit'
const isFeedback = (t: Tab): t is FeedbackKind => t === 'idea' || t === 'bug'
type Filter = 'all' | 'wait'

// 넓은 화면(목록 + 상세 나란히)인가
function useWide() {
  const [wide, setWide] = useState(true)
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 900px)')
    const on = () => setWide(mq.matches)
    on()
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return wide
}

function Board({ cred, onLost }: { cred: OpCred; onLost: () => void }) {
  const wide = useWide()
  const [tab, setTab] = useState<Tab>('idea')
  const [lastKind, setLastKind] = useState<FeedbackKind>('idea')
  const kind = isFeedback(tab) ? tab : lastKind
  const [tick, setTick] = useState(0) // 새로고침 — 공지 · 방문자 칸이 다시 받는다
  const [filter, setFilter] = useState<Filter>('all')
  const [lists, setLists] = useState<Partial<Record<FeedbackKind, FeedbackPost[]>>>({})
  const [msg, setMsg] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)
  const { view, go, style } = useInnerSlide<'list' | 'post'>('list')
  const [armed, setArmed] = useState<string | null>(null)   // 지우기를 한 번 누른 글
  const armTimer = useRef<number>()
  useEffect(() => () => window.clearTimeout(armTimer.current), [])

  const loadKind = useCallback((k: FeedbackKind) => opLoadFeedback(k)
    .then((l) => setLists((m) => ({ ...m, [k]: l })))
    .catch(() => setMsg('글을 불러오지 못했어요.')), [])
  // 마지막으로 목록을 다 받은 시각 — 머리의 새로고침 옆에 보인다(사용자 요청 — 새로고침이 됐는지 알 수 있게).
  const [loadedAt, setLoadedAt] = useState<Date | null>(null)
  const loadAll = useCallback(() => Promise.all(KINDS.map((k) => loadKind(k.v))).then(() => setLoadedAt(new Date())), [loadKind])
  useEffect(() => { void loadAll() }, [loadAll])

  const list = lists[kind]
  const shown = list?.filter((p) => filter === 'all' || (!p.answered && !p.deleted)) ?? null
  const open = list?.find((p) => p.id === openId) ?? null
  const waitN = (k: FeedbackKind) => lists[k]?.filter((p) => !p.answered && !p.deleted).length

  // 로그인이 틀렸다는 답이 오면(잠겼거나 비밀번호가 바뀌었다) 로그인 화면으로 돌아간다
  const run = (job: Promise<boolean>, fail: string) => {
    setMsg('')
    return job.then((ok) => { if (!ok) { onLost(); return false } return true })
      .catch(() => { setMsg(fail); return false })
  }
  const arm = (id: string) => {
    window.clearTimeout(armTimer.current)
    if (armed !== id) { setArmed(id); armTimer.current = window.setTimeout(() => setArmed(null), 3000); return false }
    setArmed(null)
    return true
  }
  const delBtn = (id: string, onDone: () => void) => (
    <button type="button" onClick={() => { if (arm(id)) void run(opDelete(cred, id), '지우지 못했어요.').then((ok) => { if (ok) onDone() }) }}
      className={clsx(styles.del, armed === id && styles.delArmed)}>{armed === id ? '한 번 더' : '지우기'}</button>
  )
  const pick = (t: Tab) => { setTab(t); if (isFeedback(t)) setLastKind(t); setOpenId(null); if (!wide) go('list', -1) }
  const openPost = (p: FeedbackPost) => { setOpenId(p.id); if (!wide) go('post', 1) }
  const back = () => go('list', -1)

  const listPane = (
    <div className={styles.listPane}>
      <div className={styles.filters}>
        {(['all', 'wait'] as const).map((f) => (
          <button key={f} type="button" onClick={() => setFilter(f)} aria-pressed={filter === f} className={clsx(styles.chip, filter === f && styles.chipOn)}>
            {f === 'all' ? '전체' : '답변 대기'}<span className={styles.chipN}>{f === 'all' ? list?.length ?? '' : waitN(kind) ?? ''}</span>
          </button>
        ))}
      </div>
      <div className={plaza.fbList}>
        {!shown && [0, 1, 2].map((i) => <FeedbackBoxSkel key={i} />)}
        {shown && !shown.length && <p className={styles.empty}>{filter === 'wait' ? '답을 기다리는 글이 없어요.' : kind === 'idea' ? '건의글이 없어요.' : '오류 보고가 없어요.'}</p>}
        {shown?.map((p) => (
          <div key={p.id} className={clsx(styles.boxWrap, wide && p.id === openId && styles.boxOn)}>
            <FeedbackBox p={p} onOpen={() => openPost(p)} del={delBtn(p.id, () => { if (p.id === openId) setOpenId(null); void loadKind(kind) })} />
          </div>
        ))}
      </div>
    </div>
  )
  const detail = open
    ? <Detail key={open.id} post={open} cred={cred} wide={wide} run={run} delBtn={delBtn} onBack={wide ? undefined : back}
        onChanged={() => void loadKind(kind)} onGone={() => { setOpenId(null); if (!wide) back(); void loadKind(kind) }} />
    : <div className={styles.pick}><p className={styles.empty}>왼쪽에서 글을 고르면 여기에 열려요.</p></div>

  return (
    <div className={styles.board}>
      <header className={styles.bar}>
        <div className={styles.barRow}>
          <span className={styles.brand}>핑크빈 커마샵</span>
          <h1 className={clsx(styles.title, styles.grow)}>대시보드</h1>
          {loadedAt && <span className={styles.stamp} title="마지막으로 새로 받은 시각">{loadedAt.toLocaleTimeString('ko-KR', { hour12: false })}</span>}
          <button type="button" onClick={() => { setMsg(''); setTick((n) => n + 1); void loadAll() }} className={styles.ghost}>새로고침</button>
          <button type="button" onClick={onLost} className={styles.ghost}>나가기</button>
        </div>
        <div role="tablist" aria-label="글 종류" className={styles.kinds}>
          {KINDS.map((k) => (
            <button key={k.v} type="button" role="tab" aria-selected={tab === k.v} onClick={() => pick(k.v)}
              className={clsx(plaza.hpTab, tab === k.v && plaza.hpTabOn)}>
              <IconHelpTab tab={k.v} /><span>{k.l}</span>
              {!!waitN(k.v) && <span className={styles.wait} title="답변 대기">{waitN(k.v)}</span>}
            </button>
          ))}
          <button type="button" role="tab" aria-selected={tab === 'notice'} onClick={() => pick('notice')} className={clsx(plaza.hpTab, tab === 'notice' && plaza.hpTabOn)}><IconHelpTab tab="notice" /><span>공지</span></button>
          <button type="button" role="tab" aria-selected={tab === 'visit'} onClick={() => pick('visit')} className={clsx(plaza.hpTab, tab === 'visit' && plaza.hpTabOn)}><span>방문자</span></button>
        </div>
        {msg && <p className={styles.msg} role="alert">{msg}</p>}
      </header>
      {tab === 'notice' ? <NoticePane cred={cred} tick={tick} wide={wide} run={run} /> : tab === 'visit' ? <VisitPane cred={cred} tick={tick} onLost={onLost} /> : wide ? (
        <div className={styles.split}>
          {listPane}
          <section className={styles.detailPane}>{detail}</section>
        </div>
      ) : (
        <div className={styles.slide} style={style}>{view === 'post' && open ? <section className={styles.detailPane}>{detail}</section> : listPane}</div>
      )}
    </div>
  )
}

// 공지 쓰기 · 고치기. 목록에서 고르면 칸에 들어오고, [새 공지]는 칸을 비운다
function NoticePane({ cred, tick, wide, run }: { cred: OpCred; tick: number; wide: boolean; run: (job: Promise<boolean>, fail: string) => Promise<boolean> }) {
  const [list, setList] = useState<PlazaNotice[] | null>(null)
  const [editId, setEditId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [pinned, setPinned] = useState(false)
  const [busy, setBusy] = useState(false)
  const load = useCallback(() => loadNotices().then(setList).catch(() => setList((l) => l ?? [])), [])
  useEffect(() => { void load() }, [load, tick])
  const fill = (n: PlazaNotice | null) => { setEditId(n?.id ?? null); setTitle(n?.title ?? ''); setBody(n?.body ?? ''); setPinned(!!n?.pinned) }
  const save = () => {
    setBusy(true)
    let saved: string | null = null
    void run(opSaveNotice(cred, editId, title, body, pinned).then((id) => { saved = id; return id != null }), '저장하지 못했어요.')
      .then((ok) => { if (ok) { setEditId(saved); void load() } }).finally(() => setBusy(false))
  }
  const form = (
    <div className={styles.detail}>
      <label className={styles.field}>
        <span className={styles.fieldLabel}>제목</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} className={styles.input} />
      </label>
      <label className={styles.field}>
        <span className={styles.fieldLabel}>내용</span>
        <textarea value={body} onChange={(e) => setBody(e.target.value)} className={styles.textarea} />
      </label>
      <div className={styles.acts}>
        <button type="button" onClick={() => setPinned((p) => !p)} aria-pressed={pinned} className={clsx(styles.chip, pinned && styles.chipOn)}>맨 위 고정</button>
        <span className={styles.grow} />
        <button type="button" onClick={save} disabled={busy || !title.trim()} className={styles.btn}>{busy ? '저장 중' : editId ? '고치기' : '올리기'}</button>
      </div>
    </div>
  )
  const rows = (
    <div className={styles.listPane}>
      <div className={styles.filters}><button type="button" onClick={() => fill(null)} className={styles.ghost}>새 공지</button></div>
      <div className={styles.ntList}>
        {!list && <p className={styles.empty}>불러오는 중</p>}
        {list && !list.length && <p className={styles.empty}>아직 공지가 없어요.</p>}
        {list?.map((n) => (
          <button key={n.id} type="button" onClick={() => fill(n)} className={clsx(styles.ntRow, n.id === editId && styles.ntRowOn)}>
            <span className={styles.ntTitle}>{n.pinned ? '[고정] ' : ''}{n.title}</span>
            <span className={styles.when}>{new Date(n.createdAt).toLocaleString('ko-KR')}</span>
          </button>
        ))}
      </div>
    </div>
  )
  return wide
    ? <div className={styles.split}>{rows}<section className={styles.detailPane}>{form}</section></div>
    : <div className={styles.pane}><section className={styles.detailPane}>{form}</section>{rows}</div>
}

// 방문자: 오늘 · 어제 · 최근 7일 · 30일(기간 안의 고유 브라우저 수) + 날짜별
function VisitPane({ cred, tick, onLost }: { cred: OpCred; tick: number; onLost: () => void }) {
  const [v, setV] = useState<OpVisits | null>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let alive = true
    opLoadVisits(cred).then((r) => { if (!alive) return; if (r) setV(r); else onLost() }).catch(() => { if (alive) setFailed(true) })
    return () => { alive = false }
  }, [cred, tick, onLost])
  if (!v) return <div className={styles.pane}><p className={styles.empty}>{failed ? '불러오지 못했어요.' : '불러오는 중'}</p></div>
  const dayAgo = (n: number) => new Date(Date.now() + 9 * 3600e3 - n * 864e5).toISOString().slice(0, 10)
  const countOf = (d: string) => v.days.find((x) => x.d === d)?.n ?? 0
  const cards: [string, number][] = [['오늘', countOf(dayAgo(0))], ['어제', countOf(dayAgo(1))], ['최근 7일', v.week], ['최근 30일', v.month]]
  return (
    <div className={styles.pane}>
      <div className={styles.stats}>
        {cards.map(([l, n]) => <div key={l} className={styles.stat}><span className={styles.statLabel}>{l}</span><span className={styles.statNum}>{n.toLocaleString()}</span></div>)}
      </div>
      <div className={styles.days}>
        {v.days.map((x) => <div key={x.d} className={styles.dayRow}><span>{x.d}</span><span>{x.n.toLocaleString()}</span></div>)}
      </div>
    </div>
  )
}

function Detail({ post, cred, wide, run, delBtn, onBack, onChanged, onGone }: {
  post: FeedbackPost; cred: OpCred; wide: boolean
  run: (job: Promise<boolean>, fail: string) => Promise<boolean>
  delBtn: (id: string, onDone: () => void) => React.ReactNode
  onBack?: () => void; onChanged: () => void; onGone: () => void
}) {
  const [nodes, setNodes] = useState<FeedbackNode[] | null>(null)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const load = useCallback(() => opLoadThread(post.id).then(setNodes).catch(() => setNodes((n) => n ?? [])), [post.id])
  useEffect(() => { void load() }, [load])
  const reply = (parentId: string, body: string) =>
    run(opReply(cred, parentId, body), '답글을 달지 못했어요.').then((ok) => { if (ok) { void load(); onChanged() } return ok })
  const sendTop = () => {
    setBusy(true)
    void reply(post.id, text).then((ok) => { if (ok) setText('') }).finally(() => setBusy(false))
  }
  const after = () => { void load(); onChanged() }
  return (
    <div className={styles.detail}>
      {onBack && (
        <button type="button" onClick={onBack} className={clsx(styles.ghost, styles.back)}><IconChevronLeft />목록</button>
      )}
      <FeedbackPostBody p={post} del={delBtn(post.id, onGone)} />
      <span className={styles.when}>{new Date(post.createdAt).toLocaleString('ko-KR')}</span>
      {!post.deleted && (
        <FeedbackComposer value={text} onChange={setText} onSend={sendTop} busy={busy} mobile={!wide}
          ph="운영자로 댓글 달기" label="운영자 댓글" send="운영자로 등록" />
      )}
      {!nodes && <p className={styles.empty}>불러오는 중</p>}
      {nodes && !nodes.length && <p className={styles.empty}>아직 댓글이 없어요.</p>}
      {nodes && nodes.length > 0 && (
        <FeedbackThread nodes={nodes} mobile={!wide} canDelete={() => true} del={(n) => delBtn(n.id, after)} onReply={reply} />
      )}
    </div>
  )
}
