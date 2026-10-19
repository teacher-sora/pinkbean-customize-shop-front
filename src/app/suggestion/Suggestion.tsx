'use client'

// 운영자용 건의함. 주소(/suggestion)로 직접 들어와 아이디 · 비밀번호를 넣으면
// '공지 및 건의함'의 건의 · 오류 글을 종류별로 보고, '운영자' 답변을 달고, 어떤 글이든 지울 수 있다.
//  · 로그인은 **이 화면이 떠 있는 동안만** 유지된다 — 값은 메모리에만 두고 저장하지 않는다(새로고침하면 다시 묻는다).
//  · 아이디 · 비밀번호의 확인과 쓰기 · 지우기는 DB 함수가 한다(supabase/0016). 앱에는 비밀번호도 서비스 키도 없다.
//  · 지우기는 두 번 누른다(3초 안에 같은 버튼을 다시).

import clsx from 'clsx'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  PLAZA_COMMENT_MAX, opDelete, opLoadFeedback, opLogin, opReply, plazaAlias, plazaWhen,
  type FeedbackKind, type OpComment, type OpCred,
} from '@/lib/plaza'
import styles from './suggestion.module.css'

export default function Suggestion() {
  const [cred, setCred] = useState<OpCred | null>(null)
  return (
    <main className={styles.page}>
      <div className={styles.box}>
        {cred ? <Board cred={cred} onLost={() => setCred(null)} /> : <Login onOk={setCred} />}
      </div>
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
    <form onSubmit={submit} className={styles.card}>
      <h1 className={styles.title}>건의함 관리</h1>
      <input value={id} onChange={(e) => setId(e.target.value)} placeholder="아이디" aria-label="아이디" autoComplete="off" autoCapitalize="none" className={styles.input} />
      <input value={pw} onChange={(e) => setPw(e.target.value)} type="password" placeholder="비밀번호" aria-label="비밀번호" autoComplete="off" className={styles.input} />
      <p className={styles.msg}>{msg}</p>
      <button type="submit" disabled={busy || !id || !pw} className={styles.btn}>들어가기</button>
    </form>
  )
}

function Board({ cred, onLost }: { cred: OpCred; onLost: () => void }) {
  const [kind, setKind] = useState<FeedbackKind>('idea')
  const [list, setList] = useState<OpComment[] | null>(null)
  const [msg, setMsg] = useState('')
  const [replyTo, setReplyTo] = useState<string | null>(null)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [armed, setArmed] = useState<string | null>(null)   // 지우기를 한 번 누른 글
  const armTimer = useRef<number>()

  useEffect(() => () => window.clearTimeout(armTimer.current), [])
  const load = useCallback(() => opLoadFeedback(kind).then(setList).catch(() => setMsg('글을 불러오지 못했어요.')), [kind])
  useEffect(() => { setList(null); void load() }, [load])

  // 로그인이 틀렸다는 답이 오면(잠겼거나 비밀번호가 바뀌었다) 로그인 화면으로 돌아간다
  const run = (job: Promise<boolean>, fail: string) => {
    setBusy(true); setMsg('')
    return job.then((ok) => { if (!ok) { onLost(); return false } return load().then(() => true) })
      .catch(() => { setMsg(fail); return false })
      .finally(() => setBusy(false))
  }
  const send = (parent: string) => {
    const body = text.trim()
    if (!body || busy) return
    void run(opReply(cred, parent, body), '답변을 달지 못했어요.').then((ok) => { if (ok) { setText(''); setReplyTo(null) } })
  }
  const remove = (id: string) => {
    window.clearTimeout(armTimer.current)
    if (armed !== id) { setArmed(id); armTimer.current = window.setTimeout(() => setArmed(null), 3000); return }
    setArmed(null)
    void run(opDelete(cred, id), '지우지 못했어요.')
  }
  const del = (id: string) => (
    <button type="button" onClick={() => remove(id)} disabled={busy} className={clsx(styles.del, armed === id && styles.delArmed)}>{armed === id ? '한 번 더' : '지우기'}</button>
  )

  return (
    <>
      <div className={styles.card}>
        <div className={styles.row}>
          <h1 className={clsx(styles.title, styles.grow)}>건의함 관리</h1>
          <button type="button" onClick={() => void load()} className={styles.ghost}>새로고침</button>
          <button type="button" onClick={onLost} className={styles.ghost}>나가기</button>
        </div>
        <div className={clsx(styles.row, styles.wrap)}>
          {([['idea', '건의'], ['bug', '오류']] as const).map(([k, l]) => (
            <button key={k} type="button" onClick={() => setKind(k)} className={clsx(styles.ghost, k === kind && styles.ghostOn)}>{l}</button>
          ))}
        </div>
        <p className={styles.msg}>{msg}</p>
      </div>
      <div className={styles.card}>
        {!list && <p className={styles.empty}>불러오는 중…</p>}
        {list && !list.length && <p className={styles.empty}>{kind === 'idea' ? '건의글이 없어요.' : '오류 보고가 없어요.'}</p>}
        {list?.map((c) => (
          <div key={c.id} className={styles.item}>
            <div className={styles.row}>
              <span className={styles.who}>{plazaAlias(c.owner)}</span>
              <span className={clsx(styles.time, styles.grow)}>{plazaWhen(c.createdAt)} | {new Date(c.createdAt).toLocaleString('ko-KR')}</span>
              <button type="button" onClick={() => { setReplyTo(replyTo === c.id ? null : c.id); setText('') }} className={clsx(styles.ghost, replyTo === c.id && styles.ghostOn)}>답변</button>
              {del(c.id)}
            </div>
            <p className={styles.body}>{c.body}</p>
            {c.replies.map((r) => (
              <div key={r.id} className={styles.reply}>
                <div className={styles.row}>
                  <span className={clsx(styles.who, styles.op)}>운영자</span>
                  <span className={clsx(styles.time, styles.grow)}>{plazaWhen(r.createdAt)}</span>
                  {del(r.id)}
                </div>
                <p className={styles.body}>{r.body}</p>
              </div>
            ))}
            {replyTo === c.id && (
              <div className={styles.form}>
                <textarea value={text} maxLength={PLAZA_COMMENT_MAX} onChange={(e) => setText(e.target.value)} placeholder="운영자 답변" aria-label="운영자 답변" autoFocus className={styles.area} />
                <div className={styles.row}>
                  <span className={clsx(styles.len, styles.grow)}>{text.length}/{PLAZA_COMMENT_MAX}</span>
                  <button type="button" onClick={() => send(c.id)} disabled={busy || !text.trim()} className={styles.btn}>운영자로 답변</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  )
}
