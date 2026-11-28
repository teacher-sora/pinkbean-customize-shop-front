'use client'

// 프리셋 이동(사용자 지시 — 한 기기의 프리셋 여러 개를 다른 기기로 한 번에. 설명 글 없이 코드만).
// 프리셋 탭 머리의 [이동](MoveBtn — 불러오기 칸 바로 왼쪽, 함께 오른쪽 끝. 모바일은 아이콘만)이 서피스 'moveio' 를 연다: PC = 가운데 창, 모바일 = 바텀 시트.
// 짜임은 코디 프로필 창과 같다(탭 없이 한 화면 — 탭을 바꾸면 한쪽이 비어 보였다, 사용자 지적). PC 는 크기를 정한 창(600 × 400):
//  · 왼쪽(베이지 칸) = 보내기: 작은 QR(사이트 주소 ?move=코드 — 휴대폰 카메라로 찍으면 받는 창이 뜬다), 숫자 다섯 칸 + 복사 아이콘, 남은 시간 막대.
//    번호는 화면이 먼저 뽑아 QR 이 열자마자 보인다(서버가 겹친다고 하면 받은 번호로 바꾼다 — lib/presetMove pickCode).
//    5분이 지나면 말소 — 숫자가 흐려지고 복사 아이콘이 새 코드 아이콘으로 바뀐다
//  · 오른쪽 = 아이디 칸 + [만들기], 이 기기에서 만든 아이디 목록(남은 높이를 채우는 스크롤 칸 — [저장] = 지금 프리셋으로 덮어쓰기,
//    휴지통 = 지우기, 서버에서 곧바로 없어져 누구나 새로 쓸 수 있다), 맨 아래 받기 칸(코드나 아이디 → 서피스 'move' — MoveBody)
//  모바일은 바텀 시트: 위 = 보내기(QR 왼쪽, 코드 오른쪽), 아래 = 아이디 · 받기(목록은 세 줄 높이의 스크롤 칸 — 시트 높이가 늘지 않는다)
// 서버 · 규칙은 lib/presetMove · app/api/move.
import clsx from 'clsx'
import { useEffect, useRef, useState } from 'react'
import { drawQr, makeQr } from '@/lib/qr'
import { MOVE_ID_RE, MOVE_TTL, pickCode, readIds, receive, removeId, sendByCode, sendById, type MoveAcct } from '@/lib/presetMove'
import { CONFIRM_ATTR, confirmTwice } from '@/lib/confirmTwice'
import { useShop } from '../ShopContext'
import { IconDeviceMove, IconLinkCopy, IconReset, IconTrashSolid } from '../ui/Icons'
import styles from './preset.module.css'

// 프리셋 탭 머리의 단추. 창이 열려 있는 동안은 켜진 색
export function MoveBtn({ mobile }: { mobile: boolean }) {
  const s = useShop()
  const on = s.surface?.kind === 'moveio' && !s.surfaceClosing
  return (
    <button type="button" onClick={s.openMoveIo} aria-haspopup="dialog" aria-label="프리셋 이동"
      className={clsx(styles.sortBtn, mobile && styles.sortBtnM, mobile && styles.iconBtnM, styles.moveBtn, on && styles.sortOn)}>
      <IconDeviceMove size={16} />{!mobile && '이동'}
    </button>
  )
}

function Qr({ text, max }: { text: string; max: number }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current, q = makeQr(text, 'M')
    if (!c || !q) return
    const dpr = Math.max(1, Math.round(window.devicePixelRatio || 1)), dev = Math.max(1, Math.floor(max * dpr / q.size)) // 점 하나 = 화면 픽셀 정수
    c.width = c.height = q.size * dev; c.style.width = c.style.height = `${(q.size * dev) / dpr}px`
    const g = c.getContext('2d')!
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, c.width, c.height)
    drawQr(g, q, 0, 0, dev, '#2a2521') // 판은 늘 흰색 · 점은 짙은 색(뒤집힌 QR 을 못 읽는 카메라가 있다 — 코디 프로필 카드와 같다)
  }, [text, max])
  return <canvas ref={ref} aria-label="QR" />
}

export default function MoveIoBody({ mobile }: { mobile: boolean }) {
  const s = useShop()
  const [can] = useState(() => s.movePresets().length > 0) // 옮길 프리셋이 있는 기기만 코드 표
  const [code, setCode] = useState<string | null>(() => (can ? pickCode() : null))
  const [exp, setExp] = useState(() => Date.now() + MOVE_TTL) // 코드가 말소되는 때(ms)
  const [now, setNow] = useState(() => Date.now())
  const [making, setMaking] = useState(false)
  const [busy, setBusy] = useState(false)
  const [ids, setIds] = useState<MoveAcct[]>(readIds)
  const [id, setId] = useState('')
  const [key, setKey] = useState('')
  const make = async (want: string) => {
    const items = s.movePresets()
    if (!items.length) { s.notify('옮길 프리셋이 없어요'); return }
    setCode(want); setExp(Date.now() + MOVE_TTL); setNow(Date.now()); setMaking(true)
    const c = await sendByCode(items, want)
    setMaking(false)
    if (c) { setCode(c.code); setExp(Date.now() + c.ttl) } else { setExp(0); s.notify('코드를 만들지 못했어요') }
  }
  const first = useRef(false)
  useEffect(() => { if (code && !first.current) { first.current = true; make(code) } }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const left = Math.max(0, Math.ceil((exp - now) / 1000)), dead = !!code && left === 0
  // 남은 시간 — 1초마다(말소되면 멈춘다)
  useEffect(() => {
    if (!code || dead) return
    const t = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(t)
  }, [code, dead])
  const copy = () => { if (code) navigator.clipboard?.writeText(code).then(() => s.notify('코드를 복사했어요')).catch(() => {}) }

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

  // 보내기 칸: QR + 숫자 다섯 칸 + 복사(말소되면 새 코드) + 남은 시간. 옮길 프리셋이 없는 기기는 빈 칸만(자리는 그대로)
  const send = (
    <div className={clsx(styles.mvSend, mobile && styles.mvSendM)}>
      <div className={styles.mvQr}>{code && !dead && <Qr text={`${location.origin}/preset?move=${code}`} max={mobile ? 78 : 104} />}</div>
      <div className={styles.mvCodeCol}>
        <div className={styles.mvCodeLine}>
          <div className={clsx(styles.mvDigits, (dead || !code) && styles.mvDigitsDead)} aria-label={code ? `코드 ${code}` : undefined}>
            {(code ?? '     ').split('').map((d, i) => <span key={i} className={styles.mvDigit}>{d}</span>)}
          </div>
          <button type="button" onClick={dead ? () => make(pickCode()) : copy} disabled={making || !code} title={dead ? '새 코드' : '코드 복사'} aria-label={dead ? '새 코드' : '코드 복사'} className={styles.mvIcon}>
            {dead ? <IconReset /> : <IconLinkCopy size={15} />}
          </button>
        </div>
        <div className={styles.mvTimeLine} style={code ? undefined : { visibility: 'hidden' }}>
          <span className={styles.mvTrack}><span className={styles.mvFill} style={{ transform: `scaleX(${left / (MOVE_TTL / 1000)})` }} /></span>
          <span className={styles.mvTime}>{`${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`}</span>
        </div>
      </div>
    </div>
  )
  // 아이디 · 받기 칸: 아이디 목록은 높이를 정한 스크롤 칸이다(늘어나도 창이 커지지 않는다 — 사용자 지시)
  const side = (
    <div className={clsx(styles.mvSide, mobile && styles.mvSideM)}>
      <div className={styles.mvRow}>
        <input value={id} onChange={(e) => setId(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') save(id.trim(), true) }} placeholder="아이디" maxLength={16} aria-label="아이디" className={styles.mvField} />
        <button type="button" onClick={() => save(id.trim(), true)} disabled={busy} className={clsx('pb-solid', styles.mvGo)}>만들기</button>
      </div>
      <div className={clsx(styles.mvList, mobile && styles.mvListM)}>
        <div className={clsx('pb-scroll', styles.mvListIn)}>
        {ids.map((a) => (
          <div key={a.id} className={styles.mvId}>
            <span className={styles.mvIdName}>{a.id}</span>
            <button type="button" onClick={() => save(a.id, false)} disabled={busy} className={styles.mvIdBtn}>저장</button>
            <button type="button" onClick={() => drop(a)} disabled={busy} {...{ [CONFIRM_ATTR]: `moveid:${a.id}` }} title="아이디 삭제" aria-label="아이디 삭제" className={clsx(styles.mvIdBtn, styles.mvIdDel)}><IconTrashSolid size={12} /></button>
          </div>
        ))}
        </div>
      </div>
      <hr className={styles.mvRule} />
      <div className={styles.mvRow}>
        <input value={key} onChange={(e) => setKey(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') take() }} placeholder="코드, 아이디" maxLength={16} aria-label="받을 코드 또는 아이디" className={styles.mvField} />
        <button type="button" onClick={take} disabled={busy} className={clsx('pb-solid', styles.mvGo)}>받기</button>
      </div>
    </div>
  )
  return <div className={clsx(styles.mvBody, mobile && styles.mvBodyM)}>{send}{side}</div>
}
