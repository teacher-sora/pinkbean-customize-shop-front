'use client'

// 코디 비교 판(사용자 지시 — 염색이나 옷의 느낌을 한곳에 모아 두고 견준다). 미리보기 자리를 2×2 칸으로 나눈다(PC 는 미리보기 열을 넓히고, 모바일은 히어로를 키운다).
// 칸 = 프리셋 목록에 없는 프리셋(ShopContext 의 CMP_KEY). 고른 칸이 지금 코디라 코디 탭 · 염색 · 연출 설정 · 북마크가 그 칸을 바꾼다.
//  - 고른 칸만 움직이는 미리보기(PreviewModel 하나)로, 나머지는 정지 그림(SnapThumb)으로 그린다 — 넷을 모두 움직이면 휴대폰이 버티지 못한다.
//    움직이는 미리보기는 칸들과 같은 격자 자리에 겹쳐 둔 한 겹(live)이고, 칸을 바꾸면 그 자리만 옮긴다(다시 만들지 않는다).
//    옮긴 직후에는 직전 칸의 그림이 남아 있으므로, 새 칸의 그림을 다 그릴 때까지(onDrawn) 가려 두고 아래의 정지 그림을 보인다.
//    떠나는 칸의 정지 그림은 칸을 옮기기 전에 미리 합성한다(warmSnap) — 옮긴 순간 그 칸에 뼈대가 비치지 않게.
//  - 모든 칸은 같은 배율(지금 배율 단계 — zoomStepScale) · 같은 자세(보기 설정은 칸마다 따로 두지 않는다 — withView)라 같은 크기로 견준다.
//  - 칸 위: 왼쪽 위 글자(A B C D), 오른쪽 위 [프리셋에 담기][빼기](둘 다 두 번 눌러야 한다). 빈 칸의 첫 자리는 [칸 더하기](고른 칸의 복사본).

import clsx from 'clsx'
import { useCallback, useMemo, useRef, useState } from 'react'
import { CONFIRM_ATTR, confirmTwice } from '@/lib/confirmTwice'
import { DOT_MOVER_IDS, PREVIEW_MARGIN } from '@/lib/shopData'
import { useIsoLayoutEffect } from '@/lib/uiState'
import PreviewModel from '../PreviewModel'
import SnapThumb, { warmSnap } from '../SnapThumb'
import { CMP_MAX, useShop, withView, type Snapshot } from '../ShopContext'
import { IconAdd, IconClose, IconDot, IconTakeDown } from '../ui/Icons'
import PinkbeanRate from './PinkbeanRate'
import StageBg, { CardStageBg } from './StageBg'
import styles from './preview.module.css'

const CMP_FRACTION = 0.4    // 칸 높이 대비 마네킹 키(× 배율 단계) — PC 칸(약 300px)
const CMP_FRACTION_M = 0.45 // 모바일 칸(약 180px)은 조금 더 크게
const HOLD_MS = 600         // 새 칸의 그림이 끝내 오지 않아도(같은 코디라 다시 그리지 않는 등) 이만큼 뒤엔 연다
const WARM_MS = 250         // 떠나는 칸의 정지 그림을 기다리는 한도(느린 기기에서 누름이 늦지 않게)

const letterOf = (i: number) => String.fromCharCode(65 + i)

// onPick: 판이 떠나는 칸의 그림을 먼저 만든 뒤 넘어간다(leave)
function Pane({ id, index, active, fraction, onPick }: { id: string; index: number; active: boolean; fraction: number; onPick: (id: string) => void }) {
  const s = useShop()
  const snap = s.presetData[id]
  const { gaze, action, frame, expr, zoom } = s.pv
  const still = useMemo<Snapshot | null>(() => (snap ? { ...snap, pv: withView(snap.pv, s.pv) } : null),
    [snap, gaze, action, frame, expr, zoom]) // eslint-disable-line react-hooks/exhaustive-deps
  // 고른 칸의 정지 그림은 고른 순간의 것으로 둔다 — 움직이는 미리보기에 가려 있는 동안 편집마다 다시 합성하지 않게
  const frozen = useRef(still)
  if (!active) frozen.current = still
  const shown = active ? frozen.current : still
  const n = s.cmpIds.length
  const back = s.presets.find((p) => p.id === s.cmpBack)?.name ?? ''
  const pick = () => { if (!active) onPick(id) }
  return (
    <div role="button" tabIndex={active ? -1 : 0} aria-pressed={active} aria-label={`${letterOf(index)} 칸`} title={active ? undefined : `${letterOf(index)} 칸 고르기`}
      onClick={pick} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick() } }}
      className={clsx(styles.cmpPane, !active && styles.cmpPaneOff)} style={{ gridRow: (index >> 1) + 1, gridColumn: (index & 1) + 1 }}>
      {shown && <CardStageBg sel={shown.bg} fraction={fraction} zoom={zoom} />}
      {shown && <SnapThumb snap={shown} fraction={fraction} zoom={zoom} margin={PREVIEW_MARGIN} view tagName={s.chatName} />}
      <div className={clsx(styles.cmpRing, active && styles.cmpRingOn)}>
        <span className={clsx(styles.cmpTag, active && styles.cmpTagOn)}>{letterOf(index)}</span>
        <span className={styles.cmpActs}>
          {back && (
            <button type="button" title={`'${back}'에 이 칸 담기`} aria-label={`'${back}'에 이 칸 담기`} {...{ [CONFIRM_ATTR]: `cmp:save:${id}` }}
              onClick={(e) => { e.stopPropagation(); if (confirmTwice(`cmp:save:${id}`, `한 번 더 누르면 '${back}'을 이 칸으로 바꿔요`)) s.cmpSave(id) }}
              className={clsx(styles.heroIcon, styles.heroIconOn)}><IconTakeDown size={14} /></button>
          )}
          {n > 1 && (
            <button type="button" title="이 칸 빼기" aria-label="이 칸 빼기" {...{ [CONFIRM_ATTR]: `cmp:x:${id}` }}
              onClick={(e) => { e.stopPropagation(); if (confirmTwice(`cmp:x:${id}`, '한 번 더 누르면 이 칸을 빼요')) s.removeCmp(id) }}
              className={clsx(styles.heroIcon, styles.heroIconOn)}><IconClose size={13} /></button>
          )}
        </span>
      </div>
    </div>
  )
}

export default function CompareBoard({ mobile }: { mobile: boolean }) {
  const s = useShop()
  const fraction = mobile ? CMP_FRACTION_M : CMP_FRACTION
  const ids = s.cmpIds
  const ai = Math.max(0, ids.indexOf(s.selectedPreset ?? ''))
  const eye = s.equipped['eyeAcc']
  const dotItem = !mobile && eye && DOT_MOVER_IDS.has(eye.id) ? eye : null

  // 칸을 옮긴 직후 움직이는 미리보기를 가린다(머리 주석). 칸 더하기는 코디가 같아 가리지 않는다.
  const [hold, setHold] = useState(false)
  const prev = useRef(s.selectedPreset)
  const noHold = useRef(false)
  useIsoLayoutEffect(() => {
    if (prev.current === s.selectedPreset) return
    prev.current = s.selectedPreset
    if (noHold.current) { noHold.current = false; return }
    setHold(true)
    const t = setTimeout(() => setHold(false), HOLD_MS)
    return () => clearTimeout(t)
  }, [s.selectedPreset])
  const onDrawn = useCallback(() => setHold(false), [])
  const cmp = useMemo(() => ({ fraction, onDrawn }), [fraction, onDrawn])

  // 떠나는 칸의 정지 그림을 먼저 합성해 두고 넘어간다
  const leave = (go: () => void) => {
    const cur = s.snapshot()
    void Promise.race([warmSnap({ ...cur, pv: withView(cur.pv, s.pv) }, s.index, true), new Promise((r) => setTimeout(r, WARM_MS))]).then(go)
  }
  const pickAt = (id: string) => leave(() => s.pickCmp(id))
  const add = () => leave(() => { noHold.current = true; s.addCmp() })

  return (
    <div data-pv-stage className={clsx(styles.cmpBoard, mobile && styles.cmpBoardM)}>
      {Array.from({ length: CMP_MAX }, (_, i) => {
        const id = ids[i]
        if (id) return <Pane key={id} id={id} index={i} active={i === ai} fraction={fraction} onPick={pickAt} />
        const pos = { gridRow: (i >> 1) + 1, gridColumn: (i & 1) + 1 }
        if (i === ids.length) return (
          <button key={'add' + i} type="button" onClick={add} title="고른 칸을 복사해 칸 더하기" className={styles.cmpAdd} style={pos}>
            <IconAdd size={16} /><span>칸 더하기</span>
          </button>
        )
        return <div key={'empty' + i} aria-hidden className={styles.cmpEmpty} style={pos} />
      })}
      <div className={styles.cmpLive} style={{ gridRow: (ai >> 1) + 1, gridColumn: (ai & 1) + 1, opacity: hold ? 0 : 1 }}>
        <StageBg />
        <PinkbeanRate />
        <div className={styles.model}><PreviewModel cmp={cmp} /></div>
        {!mobile && (
          <button type="button" onClick={() => { if (dotItem) s.openDot(dotItem) }} disabled={!dotItem} title="점 위치 변경" data-guide="dot"
            className={clsx('pb-ghost', styles.dotBtn, styles.cmpDot, dotItem && styles.dotBtnOn)}>
            <IconDot />점 위치
          </button>
        )}
      </div>
    </div>
  )
}
