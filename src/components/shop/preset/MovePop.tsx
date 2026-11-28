'use client'

// 프리셋 옮기기 단추 + 작은 창(사용자 지시 — 한 기기의 프리셋 여러 개를 다른 기기로 한 번에. 설명 글 없이 코드만, 이 창만 크기가 달라도 된다).
// 프리셋 탭 머리의 불러오기 칸 왼쪽. 창은 카테고리 펼치기와 같은 팝박스(preview/PopBox), 맨 위 [보내기 | 받기].
//  · 보내기: 열면 바로 5자리 코드 + 남은 시간(5분 — 지나면 말소, 코드가 흐려지고 [새 코드]) + QR(사이트 주소 ?move=코드 — 휴대폰 카메라로 찍으면 받는 창이 뜬다).
//    코드를 누르면 복사. 아래 줄 = 아이디로 두기(겹치면 알린다)
//  · 받기: 코드나 아이디를 넣고 [확인] → 옮겨 온 프리셋 고르기 창(서피스 'move')
// 서버 · 규칙은 lib/presetMove · app/api/move.
import clsx from 'clsx'
import { useEffect, useRef, useState } from 'react'
import { drawQr, makeQr } from '@/lib/qr'
import { readAcct, receive, sendByCode, sendById, MOVE_ID_RE } from '@/lib/presetMove'
import { viewH, viewW } from '@/lib/viewport'
import { useShop } from '../ShopContext'
import { PopBox, popNear, usePop } from '../preview/PopBox'
import { Seg } from '../ui/controls'
import { IconSwap } from '../ui/Icons'
import styles from './preset.module.css'

const TABS = [{ v: 'send' as const, l: '보내기' }, { v: 'recv' as const, l: '받기' }]
const POP_W = 300, SIDE_M = 12

function Qr({ text }: { text: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current, q = makeQr(text, 'M')
    if (!c || !q) return
    const css = 148, dpr = Math.max(1, Math.round(window.devicePixelRatio || 1)), quiet = 2
    c.width = c.height = css * dpr; c.style.width = c.style.height = `${css}px`
    const g = c.getContext('2d')!
    g.setTransform(dpr, 0, 0, dpr, 0, 0)
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, css, css)
    const m = css / (q.size + quiet * 2)
    drawQr(g, q, quiet * m, quiet * m, m, '#2a2521') // 판은 늘 흰색 · 점은 짙은 색(뒤집힌 QR 을 못 읽는 카메라가 있다 — 코디 프로필 카드와 같다)
  }, [text])
  return <canvas ref={ref} className={styles.moveQr} aria-label="QR" />
}

export default function MovePop({ mobile }: { mobile: boolean }) {
  const s = useShop()
  const pop = usePop()
  const btn = useRef<HTMLButtonElement>(null)
  const [tab, setTab] = useState<'send' | 'recv'>('send')
  const [code, setCode] = useState<string | null>(null)
  const [exp, setExp] = useState(0) // 코드가 말소되는 때(ms)
  const [now, setNow] = useState(0)
  const [busy, setBusy] = useState(false)
  const [id, setId] = useState('')
  const [key, setKey] = useState('')
  const make = async () => {
    const items = s.movePresets()
    if (!items.length) { s.notify('옮길 프리셋이 없어요'); return }
    setBusy(true); setCode(null)
    const c = await sendByCode(items)
    setBusy(false)
    if (c) { setCode(c.code); setExp(Date.now() + c.ttl); setNow(Date.now()) } else s.notify('코드를 만들지 못했어요')
  }
  const toggle = () => {
    if (pop.isOpen) { pop.close(); return }
    const b = btn.current?.getBoundingClientRect(); if (!b) return
    const p = popNear(b, { left: 0, width: viewW(), top: 0, bottom: viewH() })
    const w = mobile ? viewW() - SIDE_M * 2 : POP_W
    pop.open({ ...p, w, left: mobile ? SIDE_M : Math.round(Math.min(Math.max(10, b.left), viewW() - w - 10)), fit: true })
    setId(readAcct()?.id ?? '')
    if (tab === 'send') make()
  }
  const pickTab = (v: 'send' | 'recv') => { setTab(v); if (v === 'send' && !code && !busy) make() }
  const saveId = async () => {
    const v = id.trim()
    if (!MOVE_ID_RE.test(v)) { s.notify('아이디는 2~16자, 숫자만은 안 돼요'); return }
    const items = s.movePresets()
    if (!items.length) { s.notify('옮길 프리셋이 없어요'); return }
    setBusy(true)
    const r = await sendById(v, items)
    setBusy(false)
    s.notify(r === 'ok' ? `'${v}'에 저장했어요` : r === 'taken' ? '이미 있는 아이디예요' : '저장하지 못했어요')
  }
  const take = async () => {
    const v = key.trim(); if (!v) return
    setBusy(true)
    const items = await receive(v)
    setBusy(false)
    if (!items) { s.notify('찾지 못했어요'); return }
    pop.close(); setKey('')
    s.openMove(items)
  }
  // 남은 시간 — 창이 열려 있는 동안 1초마다
  useEffect(() => {
    if (!pop.isOpen || !code) return
    const t = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(t)
  }, [pop.isOpen, code])
  const left = code ? Math.max(0, Math.ceil((exp - now) / 1000)) : 0, dead = !!code && left === 0
  const copy = () => { if (code) navigator.clipboard?.writeText(code).then(() => s.notify('코드를 복사했어요')).catch(() => {}) }
  const url = code && !dead ? `${location.origin}/preset?move=${code}` : ''
  return (
    <>
      <button ref={btn} type="button" onClick={toggle} aria-expanded={pop.isOpen} title="프리셋 여러 개를 다른 기기로 옮기기" aria-label="옮기기"
        className={clsx(styles.sortBtn, mobile && styles.sortBtnM, mobile && styles.iconBtnM, pop.isOpen && styles.sortOn)}>
        <IconSwap size={mobile ? 15 : 16} />{!mobile && '옮기기'}
      </button>
      <PopBox pop={pop} label="프리셋 옮기기" keep={[btn]} className={styles.movePop}>
        <div className={styles.moveHead}><Seg variant={mobile ? 'mobileFit' : 'pc'} opts={TABS} value={tab} onPick={pickTab} /></div>
        {tab === 'send' ? (
          <div className={styles.moveBody}>
            <button type="button" onClick={copy} disabled={!code || dead} title="코드 복사" className={clsx(styles.moveCode, (!code || dead) && styles.moveCodeWait)}>{code ?? '00000'}</button>
            {/* 남은 시간 · 말소되면 [새 코드] — 같은 자리(높이 고정)라 밀리지 않는다 */}
            <div className={styles.moveTime}>{dead ? <button type="button" onClick={make} disabled={busy} className={styles.moveNew}>새 코드</button> : code ? `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}` : ''}</div>
            <div className={styles.moveQrBox}>{url ? <Qr text={url} /> : <span className={styles.moveQrWait} />}</div>
            <div className={styles.moveRow}>
              <input value={id} onChange={(e) => setId(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') saveId() }} placeholder="아이디" maxLength={16} aria-label="아이디" className={styles.moveField} />
              <button type="button" onClick={saveId} disabled={busy} className={clsx('pb-solid', styles.moveGo)}>저장</button>
            </div>
          </div>
        ) : (
          <div className={styles.moveBody}>
            <div className={styles.moveRow}>
              <input value={key} onChange={(e) => setKey(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') take() }} placeholder="코드, 아이디" maxLength={16} aria-label="코드 또는 아이디" autoFocus className={styles.moveField} />
              <button type="button" onClick={take} disabled={busy} className={clsx('pb-solid', styles.moveGo)}>확인</button>
            </div>
          </div>
        )}
      </PopBox>
    </>
  )
}
