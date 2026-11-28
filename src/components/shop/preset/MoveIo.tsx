'use client'

// 프리셋 옮기기(사용자 지시 — 한 기기의 프리셋 여러 개를 다른 기기로 한 번에. 설명 글 없이 코드만).
// 프리셋 탭 머리의 [옮기기](MoveBtn — 불러오기 칸 바로 왼쪽, 함께 오른쪽 끝)가 서피스 'moveio' 를 연다: PC = 가운데 창, 모바일 = 바텀 시트.
// 이 창만 폭 · 높이가 내용만큼이다(사용자 허락). 맨 위 [보내기 | 받기] — 두 쪽을 한 칸에 겹쳐 두어 바꿔도 창 높이가 그대로다(밀림 없음).
//  · 보내기: 왼쪽 QR(사이트 주소 ?move=코드 — 휴대폰 카메라로 찍으면 받는 창이 뜬다), 오른쪽 5자리 코드 + 남은 시간 + [복사].
//    5분이 지나면 말소 — 코드가 흐려지고 [복사] 자리가 [새 코드]. 아래 = 아이디 만들기 칸 + 이 기기에서 만든 아이디 목록
//    ([저장] = 지금 프리셋으로 덮어쓰기, 휴지통 = 지우기 — 서버에서 곧바로 없어져 누구나 그 아이디를 새로 쓸 수 있다)
//  · 받기: 코드나 아이디 → 옮겨 온 프리셋 고르기(서피스 'move' — MoveBody)
// 서버 · 규칙은 lib/presetMove · app/api/move.
import clsx from 'clsx'
import { useEffect, useRef, useState } from 'react'
import { drawQr, makeQr } from '@/lib/qr'
import { readIds, receive, removeId, sendByCode, sendById, MOVE_ID_RE, type MoveAcct } from '@/lib/presetMove'
import { CONFIRM_ATTR, confirmTwice } from '@/lib/confirmTwice'
import { useShop } from '../ShopContext'
import { Seg } from '../ui/controls'
import { IconSwap, IconTrashSolid } from '../ui/Icons'
import styles from './preset.module.css'

const TABS = [{ v: 'send' as const, l: '보내기' }, { v: 'recv' as const, l: '받기' }]
const QR_MAX = 150 // QR 칸(.mvQr 164 − 테두리) 안에서 점 크기를 정수로 — 남는 자리가 흰 여백이다

// 프리셋 탭 머리의 단추. 창이 열려 있는 동안은 켜진 색
export function MoveBtn({ mobile }: { mobile: boolean }) {
  const s = useShop()
  const on = s.surface?.kind === 'moveio' && !s.surfaceClosing
  return (
    <button type="button" onClick={s.openMoveIo} aria-haspopup="dialog" title="프리셋 옮기기" aria-label="옮기기"
      className={clsx(styles.sortBtn, mobile && styles.sortBtnM, mobile && styles.iconBtnM, styles.moveBtn, on && styles.sortOn)}>
      <IconSwap size={mobile ? 15 : 16} />{!mobile && '옮기기'}
    </button>
  )
}

function Qr({ text }: { text: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current, q = makeQr(text, 'M')
    if (!c || !q) return
    const m = Math.max(1, Math.floor(QR_MAX / q.size)), css = q.size * m, dpr = Math.max(1, Math.round(window.devicePixelRatio || 1))
    c.width = c.height = css * dpr; c.style.width = c.style.height = `${css}px`
    const g = c.getContext('2d')!
    g.setTransform(dpr, 0, 0, dpr, 0, 0)
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, css, css)
    drawQr(g, q, 0, 0, m, '#2a2521') // 판은 늘 흰색 · 점은 짙은 색(뒤집힌 QR 을 못 읽는 카메라가 있다 — 코디 프로필 카드와 같다)
  }, [text])
  return <canvas ref={ref} aria-label="QR" />
}

export default function MoveIoBody({ mobile }: { mobile: boolean }) {
  const s = useShop()
  // 옮길 프리셋이 없는 기기(새 기기)는 받기부터
  const [tab, setTab] = useState<'send' | 'recv'>(() => (s.movePresets().length ? 'send' : 'recv'))
  const [code, setCode] = useState<string | null>(null)
  const [exp, setExp] = useState(0) // 코드가 말소되는 때(ms)
  const [now, setNow] = useState(0)
  const [making, setMaking] = useState(false)
  const [busy, setBusy] = useState(false)
  const [ids, setIds] = useState<MoveAcct[]>(readIds)
  const [id, setId] = useState('')
  const [key, setKey] = useState('')
  const made = useRef(false)
  const make = async () => {
    const items = s.movePresets()
    if (!items.length) { s.notify('옮길 프리셋이 없어요'); return }
    setMaking(true); setCode(null)
    const c = await sendByCode(items)
    setMaking(false)
    if (c) { setCode(c.code); setExp(Date.now() + c.ttl); setNow(Date.now()) } else s.notify('코드를 만들지 못했어요')
  }
  // 보내기를 처음 볼 때 한 번 만든다(받기만 하는 기기는 만들지 않는다)
  useEffect(() => { if (tab === 'send' && !made.current) { made.current = true; make() } }, [tab]) // eslint-disable-line react-hooks/exhaustive-deps
  // 남은 시간 — 1초마다
  useEffect(() => {
    if (!code) return
    const t = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(t)
  }, [code])
  const left = code ? Math.max(0, Math.ceil((exp - now) / 1000)) : 0, dead = !!code && left === 0, wait = !code || dead
  const copy = () => { if (code) navigator.clipboard?.writeText(code).then(() => s.notify('코드를 복사했어요')).catch(() => {}) }
  const url = code && !dead ? `${location.origin}/preset?move=${code}` : ''

  const save = async (v: string, fromField: boolean) => {
    if (!MOVE_ID_RE.test(v)) { s.notify('아이디는 2~16자, 숫자만은 안 돼요'); return }
    const items = s.movePresets()
    if (!items.length) { s.notify('옮길 프리셋이 없어요'); return }
    setBusy(true)
    const r = await sendById(v, items)
    setBusy(false)
    if (r === 'ok') { setIds(readIds()); if (fromField) setId('') }
    s.notify(r === 'ok' ? '지금 프리셋을 저장했어요' : r === 'taken' ? '이미 있는 아이디예요' : '저장하지 못했어요')
  }
  const drop = async (a: MoveAcct) => {
    if (!confirmTwice(`moveid:${a.id}`, '한 번 더 누르면 삭제해요')) return
    setBusy(true)
    const ok = await removeId(a.id)
    setBusy(false)
    setIds(readIds())
    s.notify(ok ? '아이디를 지웠어요' : '지우지 못했어요')
  }
  const take = async () => {
    const v = key.trim(); if (!v) return
    setBusy(true)
    const items = await receive(v)
    setBusy(false)
    if (!items) { s.notify('찾지 못했어요'); return }
    s.openMove(items)
  }

  return (
    <div className={clsx('pb-scroll', styles.mvBody, mobile && styles.mvBodyM)}>
      <div className={styles.mvTabs}><Seg variant={mobile ? 'mobileFit' : 'pc'} opts={TABS} value={tab} onPick={setTab} /></div>
      <div className={styles.mvStack}>
        <div className={clsx(styles.mvPane, tab !== 'send' && styles.mvOff)} aria-hidden={tab !== 'send' || undefined}>
          <div className={styles.mvCodeRow}>
            <div className={clsx(styles.mvQr, !url && styles.mvQrWait)}>{url && <Qr text={url} />}</div>
            <div className={styles.mvCodeCol}>
              <button type="button" onClick={copy} disabled={wait} title="코드 복사" className={clsx(styles.mvCode, wait && styles.mvCodeWait)}>{code ?? '00000'}</button>
              <div className={styles.mvMeta}>
                <span className={clsx(styles.mvTime, dead && styles.mvTimeDead)}>{code ? `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}` : ''}</span>
                {/* [복사] ↔ [새 코드] — 두 글자를 한 칸에 겹쳐 폭이 바뀌지 않는다 */}
                <button type="button" onClick={dead ? make : copy} disabled={making || !code} className={styles.mvAct}>
                  <span className={styles.loadLabel}>
                    <span style={dead ? { visibility: 'hidden' } : undefined}>복사</span>
                    <span style={dead ? undefined : { visibility: 'hidden' }}>새 코드</span>
                  </span>
                </button>
              </div>
            </div>
          </div>
          <hr className={styles.mvRule} />
          <div className={styles.mvRow}>
            <input value={id} onChange={(e) => setId(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') save(id.trim(), true) }} placeholder="아이디" maxLength={16} aria-label="아이디" className={styles.mvField} />
            <button type="button" onClick={() => save(id.trim(), true)} disabled={busy} className={clsx('pb-solid', styles.mvGo)}>만들기</button>
          </div>
          {ids.length > 0 && (
            <ul className={styles.mvIds}>
              {ids.map((a) => (
                <li key={a.id} className={styles.mvId}>
                  <span className={styles.mvIdName}>{a.id}</span>
                  <button type="button" onClick={() => save(a.id, false)} disabled={busy} title="지금 프리셋으로 덮어쓰기" className={styles.mvIdBtn}>저장</button>
                  <button type="button" onClick={() => drop(a)} disabled={busy} {...{ [CONFIRM_ATTR]: `moveid:${a.id}` }} title="아이디 삭제" aria-label="삭제" className={clsx(styles.mvIdBtn, styles.mvIdDel)}><IconTrashSolid size={12} /></button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className={clsx(styles.mvPane, styles.mvRecv, tab !== 'recv' && styles.mvOff)} aria-hidden={tab !== 'recv' || undefined}>
          <div className={styles.mvRow}>
            <input value={key} onChange={(e) => setKey(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') take() }} placeholder="코드, 아이디" maxLength={16} aria-label="코드 또는 아이디" className={styles.mvField} />
            <button type="button" onClick={take} disabled={busy} className={clsx('pb-solid', styles.mvGo)}>받기</button>
          </div>
        </div>
      </div>
    </div>
  )
}
