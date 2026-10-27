'use client'

// 미리보기 무대 — 평소(캐릭터 하나)와 코디 비교(칸 A B C D)를 한 부품으로 그린다. PC 는 미리보기 열(PreviewColumn), 모바일은 히어로(MobileHero) 안.
// 움직이는 미리보기(배경 장면 + PreviewModel, live 한 겹)는 **두 모드에서 같은 자리의 같은 요소**다 — 비교를 켜고 꺼도 다시 만들지 않는다.
//   왜: 다시 만들면 배경 장면이 새 바닥 자리(lib/stageFloor)를 받기 전에 임시 크기로 깔렸다가 바뀌어 화면이 흔들렸다(사용자 지적).
// 코디 비교(사용자 지시 — 염색이나 옷의 느낌을 한곳에 모아 두고 견준다): 칸 = 프리셋 목록에 없는 프리셋(ShopContext 의 CMP_KEY).
//  - 고른 칸만 움직이는 미리보기로, 나머지는 정지 그림(SnapThumb + CardStageBg)으로 그린다 — 넷을 모두 움직이면 휴대폰이 버티지 못한다.
//    live 는 칸들과 같은 격자 자리에 겹쳐 두고, 칸을 바꾸면 자리만 옮긴다. 옮긴 직후(비교를 켠 직후 포함)엔 직전 그림이 남아 있어
//    새 칸의 그림을 다 그릴 때까지(onDrawn) 가리고 아래의 정지 그림을 보인다. 떠나는 칸의 정지 그림은 옮기기 전에 합성한다(warmSnap).
//  - 모든 칸은 같은 배율(지금 배율 단계 — zoomStepScale, withView)이라 같은 크기로 견준다. 시선 · 액션 · 표정은 칸마다 그 칸의 것(정지 칸도 그 시선으로).
//  - 칸 배치는 지금 칸 수에 맞춘다(layoutOf, 사용자 지시): 1~2칸은 칸이 높이를 다 쓰고 아래에 얇은 [칸 더하기] 줄, 3칸은 2×2 의 넷째 자리가 [칸 더하기], 4칸은 2×2.
//    모바일은 히어로 높이를 바꾸지 않는다(바꾸면 아래 목록이 출렁인다) — 기본 보기는 한 줄(끝에 좁은 [칸 더하기]), 크게 · 캐릭터만은 PC 와 같다.
//  - 칸 위의 글자(A B C D — 고르지 않은 칸은 흐리게). 칸 다루기(담기 · 빼기)는 고른 칸의 오른쪽 위에만(좁은 칸에서 글자와 겹치지 않게).

import clsx from 'clsx'
import { useCallback, useMemo, useRef, useState } from 'react'
import { DOT_MOVER_IDS, PREVIEW_MARGIN } from '@/lib/shopData'
import { useHeroView } from '@/lib/heroView'
import { useIsoLayoutEffect } from '@/lib/uiState'
import PreviewModel from '../PreviewModel'
import SnapThumb, { warmSnap } from '../SnapThumb'
import { CMP_MAX, useShop, withView, type Snapshot } from '../ShopContext'
import { IconAdd, IconDot } from '../ui/Icons'
import { CmpDel } from './PreviewParts'
import PinkbeanRate from './PinkbeanRate'
import StageBg, { CardStageBg, type CardFloor } from './StageBg'
import styles from './preview.module.css'

const CMP_FRACTION = 0.4    // 칸 높이 대비 마네킹 키(× 배율 단계) — PC 칸(약 250px)
const CMP_FRACTION_M = 0.45 // 모바일 칸은 조금 더 크게
const HOLD_MS = 600         // 새 칸의 그림이 끝내 오지 않아도(같은 코디라 다시 그리지 않는 등) 이만큼 뒤엔 연다
const WARM_MS = 250         // 떠나는 칸의 정지 그림을 기다리는 한도(느린 기기에서 누름이 늦지 않게)

export const cmpLetter = (i: number) => String.fromCharCode(65 + i)

// 떠나는 칸(지금 코디)의 정지 그림을 먼저 합성해 두고 넘어간다 — PC 아래 칸의 비교 탭도 같은 길을 쓴다
export function useCmpLeave() {
  const s = useShop()
  return (go: () => void) => {
    const cur = s.snapshot()
    void Promise.race([warmSnap({ ...cur, pv: withView(cur.pv, s.pv) }, s.index, true), new Promise((r) => setTimeout(r, WARM_MS))]).then(go)
  }
}

type Layout = { cols: string; rows: string; pos: (i: number) => React.CSSProperties; add: React.CSSProperties | null; addKind: 'row' | 'cell' | 'slim' }
function layoutOf(n: number, line: boolean): Layout {
  const more = n < CMP_MAX
  if (line) return { cols: `repeat(${n}, minmax(0, 1fr))${more ? ' 40px' : ''}`, rows: 'minmax(0, 1fr)', pos: (i) => ({ gridRow: 1, gridColumn: i + 1 }), add: more ? { gridRow: 1, gridColumn: n + 1 } : null, addKind: 'slim' }
  if (n <= 2) return { cols: `repeat(${n}, minmax(0, 1fr))`, rows: 'minmax(0, 1fr) 34px', pos: (i) => ({ gridRow: 1, gridColumn: i + 1 }), add: { gridRow: 2, gridColumn: '1 / -1' }, addKind: 'row' }
  return { cols: 'repeat(2, minmax(0, 1fr))', rows: 'repeat(2, minmax(0, 1fr))', pos: (i) => ({ gridRow: (i >> 1) + 1, gridColumn: (i & 1) + 1 }), add: more ? { gridRow: 2, gridColumn: 2 } : null, addKind: 'cell' }
}

function Pane({ id, index, active, fraction, pos, slim, onPick }: { id: string; index: number; active: boolean; fraction: number; pos: React.CSSProperties; slim: boolean; onPick: (id: string) => void }) {
  const s = useShop()
  const snap = s.presetData[id]
  const zoom = s.pv.zoom
  const still = useMemo<Snapshot | null>(() => (snap ? { ...snap, pv: withView(snap.pv, s.pv) } : null),
    [snap, zoom]) // eslint-disable-line react-hooks/exhaustive-deps
  // 고른 칸의 정지 그림은 고른 순간의 것으로 둔다 — 움직이는 미리보기에 가려 있는 동안 편집마다 다시 합성하지 않게
  const frozen = useRef(still)
  if (!active) frozen.current = still
  const shown = active ? frozen.current : still
  const pick = () => { if (!active) onPick(id) }
  const eye = active ? s.equipped['eyeAcc'] : null
  const dot = eye && DOT_MOVER_IDS.has(eye.id) ? eye : null
  // 배경은 이 칸의 캐릭터가 실제로 그린 발 자리에 깐다(고른 칸의 미리보기 장면과 같은 자리 — CardStageBg floor)
  const [floor, setFloor] = useState<CardFloor | null>(null)
  const onFloor = useCallback((f: CardFloor) => setFloor((o) => (o && o.cx === f.cx && o.footY === f.footY && o.scale === f.scale ? o : f)), [])
  return (
    <div role="button" tabIndex={active ? -1 : 0} aria-pressed={active} aria-label={`${cmpLetter(index)} 칸`} title={active ? undefined : `${cmpLetter(index)} 칸 고르기`}
      onClick={pick} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick() } }}
      className={clsx(styles.cmpPane, !active && styles.cmpPaneOff)} style={pos}>
      {/* 그림은 테두리 안쪽(1px)에만 — 어두운 배경이 둥근 모서리의 테두리 바깥으로 번져 보이지 않게 */}
      <div className={styles.cmpArt}>
        {shown && <CardStageBg sel={shown.bg} fraction={fraction} zoom={zoom} floor={floor} />}
        {/* 칭호 · 명찰 · 훈장 · 말풍선도 그 칸의 것으로(고른 칸의 미리보기와 같은 규칙 — 말풍선은 보낸 말이 있을 때만) */}
        {shown && <SnapThumb snap={shown} fraction={fraction} zoom={zoom} margin={PREVIEW_MARGIN} view onFloor={onFloor} tagName={s.chatName} baseTag={s.chatOn && !!shown.pv?.baseTag}
          deco chatText={s.chatMsg ? s.chatMsg.text : null} defBalloon={s.chatDefault} />}
      </div>
      <div className={clsx(styles.cmpRing, active && styles.cmpRingOn)}>
        <span className={clsx(styles.cmpTag, active && styles.cmpTagOn)}>{cmpLetter(index)}</span>
      </div>
      {/* 휴지통 띠지는 테두리 겹 밖(칸 기준)에 — 테두리 안쪽이 기준이면 고른 칸(1.5px)만 반 픽셀 자리에 놓여 hover 때 움찔했다(사용자 지적) */}
      <CmpDel id={id} slim={slim} />
      {/* 점 위치(PC): 고른 칸에만, 칸마다 제 자리에 — 다른 칸을 고르면 그 아이템이 있던 칸에서 사라진다(사용자 지시. 움직이는 미리보기 안에 두면 새 칸으로 옮겨 가서 사라졌다) */}
      {!slim && (
        <button type="button" onClick={(e) => { e.stopPropagation(); if (dot) s.openDot(dot) }} disabled={!dot} tabIndex={dot ? 0 : -1} title="점 위치 변경" data-guide={active ? 'dot' : undefined}
          className={clsx('pb-ghost', styles.dotBtn, styles.cmpDot, dot && styles.dotBtnOn)}>
          <IconDot />점 위치
        </button>
      )}
    </div>
  )
}

export default function PreviewStage({ mobile }: { mobile: boolean }) {
  const s = useShop()
  const hv = useHeroView()
  const cmpOn = s.cmpOn
  const ids = s.cmpIds
  const line = mobile && hv === 'base'
  const lay = layoutOf(Math.max(1, ids.length), line)
  const fraction = mobile ? CMP_FRACTION_M : CMP_FRACTION
  const ai = Math.max(0, ids.indexOf(s.selectedPreset ?? ''))
  const eye = s.equipped['eyeAcc']
  const dotItem = !mobile && eye && DOT_MOVER_IDS.has(eye.id) ? eye : null

  // 칸을 옮긴 직후(비교를 켠 직후 포함) 움직이는 미리보기를 가린다(머리 주석). 칸 더하기는 코디가 같아 가리지 않는다. 끌 때는 아래에 보일 것이 없어 가리지 않는다
  const [hold, setHold] = useState(false)
  const prev = useRef(s.selectedPreset)
  const noHold = useRef(false)
  useIsoLayoutEffect(() => {
    if (prev.current === s.selectedPreset) return
    prev.current = s.selectedPreset
    if (noHold.current || !cmpOn) { noHold.current = false; setHold(false); return }
    setHold(true)
    const t = setTimeout(() => setHold(false), HOLD_MS)
    return () => clearTimeout(t)
  }, [s.selectedPreset])
  // 그린 크기가 지금 칸과 같을 때만 연다(칸을 옮기는 도중의 옛 크기 그림은 열지 않는다)
  const liveRef = useRef<HTMLDivElement>(null)
  const onDrawn = useCallback((w: number, h: number) => { const el = liveRef.current; if (el && Math.abs(el.clientWidth - w) <= 1 && Math.abs(el.clientHeight - h) <= 1) setHold(false) }, [])
  const cmp = useMemo(() => (cmpOn ? { fraction, onDrawn } : undefined), [cmpOn, fraction, onDrawn])

  const leave = useCmpLeave()
  const pickAt = (id: string) => leave(() => s.pickCmp(id))
  const add = () => leave(() => { noHold.current = true; s.addCmp() })

  // 칸(비교 중일 때만)을 먼저, live 를 늘 두 번째 자식으로 둔다 — 같은 자리라 모드를 바꿔도 다시 만들어지지 않는다
  const cells = cmpOn ? [
    ...ids.map((id, i) => <Pane key={id} id={id} index={i} active={i === ai} fraction={fraction} pos={lay.pos(i)} slim={mobile} onPick={pickAt} />),
    lay.add && (
      <button key="add" type="button" onClick={add} title="고른 칸을 복사해 칸 더하기" aria-label="칸 더하기"
        className={clsx(styles.cmpAdd, lay.addKind === 'cell' && styles.cmpAddCell, lay.addKind === 'slim' && styles.cmpAddSlim)} style={lay.add}>
        <IconAdd size={lay.addKind === 'row' ? 14 : 16} /><span>칸 더하기</span>
      </button>
    ),
  ] : null
  return (
    <div data-pv-stage className={clsx(mobile ? styles.heroStage : styles.stage, cmpOn && styles.cmpBoard, cmpOn && mobile && styles.cmpBoardM,
      cmpOn && mobile && hv === 'base' && styles.cmpBoardLine, cmpOn && !mobile && s.chatOn && styles.cmpBoardChat)}
      style={cmpOn ? { gridTemplateColumns: lay.cols, gridTemplateRows: lay.rows } : undefined}>
      {cells}
      <div ref={liveRef} className={cmpOn ? styles.cmpLive : styles.live} style={cmpOn ? { ...lay.pos(ai), opacity: hold ? 0 : 1 } : undefined}>
        <StageBg />
        {!mobile && !cmpOn && (
          <button type="button" onClick={() => { if (dotItem) s.openDot(dotItem) }} disabled={!dotItem} title="점 위치 변경" data-guide="dot"
            className={clsx('pb-ghost', styles.dotBtn, dotItem && styles.dotBtnOn)}>
            <IconDot />점 위치
          </button>
        )}
        <PinkbeanRate />
        <div className={mobile ? styles.heroModel : styles.model}><PreviewModel cmp={cmp} /></div>
      </div>
    </div>
  )
}
