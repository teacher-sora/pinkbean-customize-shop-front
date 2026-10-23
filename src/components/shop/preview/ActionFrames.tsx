'use client'

// 액션 상세 — 그 액션을 **재생**할지, 액션을 이루는 **자세 하나(프레임)에 멈출지** 3열 격자에서 눈으로 보고 고른다(사용자 건의).
// 액션 고르기(PvPicker 의 PC 창 · 모바일 시트 · 코디 프로필 창)에서 액션을 누르면 이 화면으로 가로로 넘어온다.
//  · 첫 칸 '재생' = 그 액션이 계속 도는 그림(아래 프레임 칸들의 그림을 원본의 머무는 시간대로 번갈아 보인다 — 칸마다 따로 합성하지 않는다).
//  · 그 뒤 '1', '2', … = 그 자세로 멈춘 지금 코디(SnapThumb 의 view — snapRender 가 pv.frame 을 그 프레임으로 그린다).
// 프레임 수 · 박자는 지금 몸(피부의 body)과 무기 모션으로 정해진 그 액션의 것이다(미리보기와 같다 — frameDelays).
// 왕복하는 액션(서기 1-2-3-2-1 …)도 자세는 고유한 것만 늘어선다.

import clsx from 'clsx'
import { useEffect, useMemo, useState } from 'react'
import { frameDelays } from '@/lib/core/assemble'
import { loadMeta } from '@/lib/core/data'
import { MOVE_POSTURE_ACTIONS, resolveAction, ridingSeatedSet } from '@/lib/shopData'
import { useShop, type Snapshot } from '../ShopContext'
import SnapThumb from '../SnapThumb'
import styles from './preview.module.css'

const MODEL_FRACTION = 0.55 // 액션 격자(PvGrid)와 같은 크기
export type ActionInfo = { delays: number[]; pingpong: boolean }

type Shop = ReturnType<typeof useShop>
const ONE: ActionInfo = { delays: [0], pingpong: false }
// 그 액션의 프레임 박자. 탑승해 앉는 액션 · 기본(정지) · 뒷모습은 자세가 하나다(상세로 넘어가지 않는다).
export async function actionInfo (s: Shop, action: string): Promise<ActionInfo> {
  const bodyId = s.index?.base.tones.find((t) => t.tone === s.tone)?.body
  const ride = s.equipped.riding && !s.hidden.riding ? s.equipped.riding : null
  if (!bodyId || action === 'basic' || s.pv.gaze === 'back' || (ride && ridingSeatedSet(ride).has(action))) return ONE
  try {
    const delays = frameDelays(await loadMeta(bodyId), { action: resolveAction(action, s.pv.weapon), expression: 'default', ear: s.pv.ear, weaponMotion: s.pv.weapon })
    return delays.length ? { delays, pingpong: MOVE_POSTURE_ACTIONS.has(action) } : ONE
  } catch { return ONE }
}
export function useActionInfo (action: string | null): ActionInfo | null {
  const s = useShop()
  const [info, setInfo] = useState<{ key: string; v: ActionInfo } | null>(null)
  const key = `${action}|${s.tone}|${s.pv.weapon}|${s.pv.gaze}|${s.equipped.riding?.id ?? ''}|${!!s.hidden.riding}`
  useEffect(() => {
    if (!action) return
    let alive = true
    void actionInfo(s, action).then((v) => { if (alive) setInfo({ key, v }) })
    return () => { alive = false }
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps -- key 가 모든 입력이다
  return info?.key === key ? info.v : null
}

// 프레임 순서(왕복이면 0 1 2 1 0 …의 한 바퀴)와 그 시간
const sequence = (n: number, pingpong: boolean) => (pingpong && n > 2 ? [...Array(n).keys(), ...[...Array(n - 2).keys()].map((i) => n - 2 - i)] : [...Array(n).keys()])

// 재생 칸 — 프레임 그림을 겹쳐 두고 차례로 하나만 보인다(같은 스냅샷이라 합성은 프레임 칸과 함께 한 번)
function PlayArt ({ snaps, info }: { snaps: Snapshot[]; info: ActionInfo }) {
  const seq = useMemo(() => sequence(snaps.length, info.pingpong), [snaps.length, info.pingpong])
  const [k, setK] = useState(0)
  useEffect(() => {
    if (seq.length < 2) return
    let i = 0, t: ReturnType<typeof setTimeout>
    const tick = () => { t = setTimeout(() => { i = (i + 1) % seq.length; setK(i); tick() }, Math.max(60, info.delays[seq[i]] || 120)) }
    tick()
    return () => clearTimeout(t)
  }, [seq, info.delays])
  return (
    <>
      {snaps.map((sn, i) => (
        <span key={i} className={styles.pvFrameLayer} style={{ opacity: seq[k] === i ? 1 : 0 }}><SnapThumb snap={sn} fraction={MODEL_FRACTION} view /></span>
      ))}
    </>
  )
}

// value = 지금 고른 프레임(-1 = 재생). onPick(-1) = 재생, onPick(i) = i 번째 자세에 멈춘다.
export function ActionFrameGrid ({ action, info, value, onPick, base }: { action: string; info: ActionInfo | null; value: number; onPick: (frame: number) => void; base: Snapshot }) {
  const n = info?.delays.length ?? 0
  const snaps = useMemo(() => [...Array(n).keys()].map((i) => ({ ...base, pv: { ...(base.pv || ({} as NonNullable<Snapshot['pv']>)), action, frame: i } })), [base, action, n])
  if (!info) return <div className={styles.pvGrid}>{[0, 1, 2].map((i) => <span key={i} className={clsx('pb-skel', styles.pvFrameSkel)} />)}</div>
  const cell = (i: number, label: string, art: React.ReactNode) => (
    <button key={i} type="button" role="option" aria-selected={value === i} onClick={() => onPick(i)} title={i < 0 ? '계속 재생해요' : `${label}번째 자세로 멈춰요`}
      className={clsx(styles.pvCell, value === i && styles.pvCellOn)}>
      <span className={styles.pvCellArt}>{art}</span>
      <span className={styles.pvCellName}>{label}</span>
    </button>
  )
  return (
    <div className={styles.pvGrid} role="listbox" aria-label="재생 또는 멈출 자세">
      {cell(-1, '재생', <PlayArt snaps={snaps} info={info} />)}
      {snaps.map((sn, i) => cell(i, String(i + 1), <SnapThumb snap={sn} fraction={MODEL_FRACTION} priority={i < 6 ? 0 : 1} view />))}
    </div>
  )
}
