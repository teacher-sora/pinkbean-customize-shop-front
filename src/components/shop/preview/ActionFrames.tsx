'use client'

// 액션 상세 — 그 액션을 **재생**할지, 액션을 이루는 **자세 하나(프레임)에 멈출지** 3열 격자에서 눈으로 보고 고른다(사용자 건의).
// 액션 고르기(팝박스의 ActionPickBody · 모바일 시트)에서 자세가 여럿인 액션을 누르면 이 화면으로 가로로 넘어온다.
//  · 첫 칸 '재생'(play — 정지 그림을 저장하는 코디 프로필에는 없다) = 그 액션이 계속 도는 그림(아래 프레임 칸들의 그림을 원본의 머무는 시간대로 번갈아 보인다 — 칸마다 따로 합성하지 않는다).
//  · 그 뒤 '1', '2', … = 그 자세로 멈춘 지금 코디(SnapThumb 의 view — snapRender 가 pv.frame 을 그 프레임으로 그린다).
// 프레임 수 · 박자는 지금 몸(피부의 body)과 무기 모션으로 정해진 그 액션의 것이다(미리보기와 같다 — frameDelays).
// 왕복하는 액션(서기 1-2-3-2-1 …)도 자세는 고유한 것만 늘어선다.

import clsx from 'clsx'
import { useEffect, useMemo, useState } from 'react'
import { frameDelays } from '@/lib/core/assemble'
import { loadMeta } from '@/lib/core/data'
import { animaOnce, composeSnapshotCached, snapKey } from '@/lib/core/snapRender'
import { enqueueThumb } from '@/lib/thumbQueue'
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

// 그 액션의 i 번째 자세 스냅샷 — 상세 칸 · 미리 합성(warmActionFrames)이 같은 것을 만들어야 같은 캐시 열쇠가 된다
export const frameSnap = (base: Snapshot, action: string, i: number): Snapshot => ({ ...base, pv: { ...(base.pv || ({} as NonNullable<Snapshot['pv']>)), action, frame: i } })
// 액션 칸에 마우스를 올리거나 누르는 순간 그 액션의 자세들을 먼저 합성해 둔다(사용자 지시 — 상세 칸이 뜨는 게 보였다).
// 상세 칸(SnapThumb)은 같은 열쇠의 합성이 끝나 있으면 줄을 서지 않고 바로 그린다. 같은 것을 두 번 부르면 캐시가 한 번만 한다
export function warmActionFrames (s: Shop, base: Snapshot, action: string): void {
  const index = s.index
  if (!index) return
  void Promise.all([actionInfo(s, action), animaOnce()]).then(([info, ar]) => {
    if (info.delays.length < 2) return
    for (let i = 0; i < info.delays.length; i++) {
      const sn = frameSnap(base, action, i)
      enqueueThumb(0, () => composeSnapshotCached(snapKey(sn), sn, index, ar, true).then(() => {}))
    }
  }).catch(() => {})
}

// 프레임 순서(왕복이면 0 1 2 1 0 …의 한 바퀴)와 그 시간
const sequence = (n: number, pingpong: boolean) => (pingpong && n > 2 ? [...Array(n).keys(), ...[...Array(n - 2).keys()].map((i) => n - 2 - i)] : [...Array(n).keys()])

// 재생 칸 — 프레임 그림을 겹쳐 두고 차례로 하나만 보인다(같은 스냅샷이라 합성은 프레임 칸과 함께 한 번).
// 모든 프레임이 그려진 뒤에 돌기 시작한다 — 그 전에는 첫 자세에 멈춰 있다(사용자 제보: 아직 안 그려진 프레임 차례에 빈 칸이 깜빡였다)
function PlayArt ({ snaps, info }: { snaps: Snapshot[]; info: ActionInfo }) {
  const seq = useMemo(() => sequence(snaps.length, info.pingpong), [snaps.length, info.pingpong])
  const [k, setK] = useState(0)
  const [drawn, setDrawn] = useState(() => new Set<number>())
  useEffect(() => { setDrawn(new Set()); setK(0) }, [snaps])
  const ready = drawn.size >= snaps.length
  useEffect(() => {
    if (seq.length < 2 || !ready) return
    let i = 0, t: ReturnType<typeof setTimeout>
    const tick = () => { t = setTimeout(() => { i = (i + 1) % seq.length; setK(i); tick() }, Math.max(60, info.delays[seq[i]] || 120)) }
    tick()
    return () => clearTimeout(t)
  }, [seq, info.delays, ready])
  return (
    <>
      {snaps.map((sn, i) => (
        <span key={i} className={styles.pvFrameLayer} style={{ opacity: (ready ? seq[k] : 0) === i ? 1 : 0 }}>
          <SnapThumb snap={sn} fraction={MODEL_FRACTION} view onDrawn={() => setDrawn((d) => (d.has(i) ? d : new Set(d).add(i)))} />
        </span>
      ))}
    </>
  )
}

// value = 지금 고른 프레임(-1 = 재생, 그 밖의 음수 = 고른 것 없음). onPick(-1) = 재생, onPick(i) = i 번째 자세에 멈춘다.
export function ActionFrameGrid ({ action, info, value, onPick, base, play = true }: { action: string; info: ActionInfo | null; value: number; onPick: (frame: number) => void; base: Snapshot; play?: boolean }) {
  const n = info?.delays.length ?? 0
  const snaps = useMemo(() => [...Array(n).keys()].map((i) => frameSnap(base, action, i)), [base, action, n])
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
      {play && cell(-1, '재생', <PlayArt snaps={snaps} info={info} />)}
      {snaps.map((sn, i) => cell(i, String(i + 1), <SnapThumb snap={sn} fraction={MODEL_FRACTION} priority={i < 6 ? 0 : 1} view />))}
    </div>
  )
}
