'use client'

// 연출 설정 고르기(액션 · 무기 모션 · 표정) — 이름만 늘어선 목록 대신 **3열 격자 + 작은 미리보기**로 고른다.
//  · 액션 · 무기 모션 = **지금 입고 있는 코디**를 그 동작·자세로 작게 그린다. 카드·광장과 같은 합성기(SnapThumb)를
//    쓰되 view 모드로 불러 스냅샷에 담긴 액션·무기 모션을 반영한다. 베이스 마네킹이 아니라 실제 코디인 이유:
//    무기 모션은 든 무기가 있어야 차이가 보이고, 지금 보고 있는 미리보기의 스프라이트가 이미 캐시에 있어 더 빠르다.
//  · 표정 = 표정 얼굴장식 25종의 **아이콘**(표정마다 다른 얼굴 그림, catalog.PV_EXPR_ICONS). 모델을 25번 그리는
//    것보다 훨씬 가볍고 작게 봐도 표정이 또렷하다. 짝이 없는 '기본'·'눈깜빡'은 이름만 보여 준다.
//
// 펼치는 방식은 폭에 따라 다르다.
//  · PC·태블릿 = 버튼 바로 위에 붙어 올라오는 팝박스(PopBox — 채팅 이모티콘 · 코디 프로필과 같은 창). 아래 줄 [닫기].
//  · 모바일 = 시트를 **가로로 슬라이드**해 시트 안의 다음 화면으로 간다(부위 염색 → 염색과 같은 몸짓, PvSheetBody).
//    좁은 화면에서 시트 위에 팝오버를 또 띄우면 층이 겹쳐 보여, 이미 쓰고 있는 전환을 그대로 쓴다.
// 액션은 한 단계 더 있다(사용자 건의): 자세가 여럿인 액션을 누르면 같은 창 안에서 **액션 상세**(재생 · 자세 1, 2, …)로 가로로 넘어간다.
// 미리보기는 상세에서 고를 때 바뀐다(누르자마자 바꾸지 않는다 — 창에 가려 보이지도 않고 합성만 헛돈다. 사용자 지시).
// 고르기는 한 번에 끝난다: 상세가 없는 칸 · 상세의 칸 · 무기 모션 · 표정 모두 누르면 곧바로 창이 닫힌다.

import clsx from 'clsx'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { PV_EXPR_ICONS, type Opt } from '@/lib/catalog'
import { spriteUrl } from '@/lib/core/data'
import { useShop, type Snapshot } from '../ShopContext'
import SnapThumb from '../SnapThumb'
import { useInnerSlide } from '../surface/innerSlide'
import { ActionFrameGrid, actionInfo, useActionInfo, warmActionFrames } from './ActionFrames'
import { PopBox, PopFoot, PopScroll, popNear, usePop } from './PopBox'
import ui from '../ui/ui.module.css'
import styles from './preview.module.css'

type Group = { group: string; items: Opt[] }

const WARM_DWELL = 120 // 칸 위에 마우스가 이만큼 머물면 미리 합성한다(지나가기만 한 칸까지 합성하지 않게). 누르면 바로
const MODEL_FRACTION = 0.55 // 칸 안 모델 크기. 0.62 는 위아래가 칸에 닿아 답답하다

export type PvField = 'action' | 'weapon' | 'expr'
type GridProps = {
  field: PvField
  options: Opt[]
  groups?: Group[]
  value: string
  onChange: (v: string) => void
  disabledValues?: Set<string>
  disabledTitle?: string
  onWarm?: (v: string) => void // 칸에 마우스를 올리거나 누르는 순간(액션 — 상세 자세를 미리 합성한다)
  scrollMemo?: { current: number | null } // 칸을 누를 때의 스크롤 좌표를 여기 적고, 붙을 때 값이 있으면 그 좌표로 되돌린다(상세에서 [이전] — 보던 화면 그대로. 사용자 지시)
}

// ── 격자 본체(팝오버 · 모바일 화면 공용) ──────────────────────────────────────
export function PvGrid({ field, options, groups, value, onChange, disabledValues, disabledTitle, onWarm, scrollMemo, eager = 6 }: GridProps & { eager?: number }) {
  const s = useShop()
  const dwell = useRef<ReturnType<typeof setTimeout>>()
  useEffect(() => () => clearTimeout(dwell.current), [])
  // 지금 코디는 **열 때 한 번만** 뜬다 — 렌더마다 새 스냅샷을 만들면 칸마다 합성이 다시 돈다.
  const [base] = useState<Snapshot>(() => s.snapshot())

  // 칸마다 쓸 스냅샷: 지금 코디 + 그 액션/무기 모션. 표정은 아이콘이라 스냅샷이 필요 없다.
  const snaps = useMemo(() => {
    if (field === 'expr') return null
    const m = new Map<string, Snapshot>()
    // 액션 칸은 늘 재생(대표 프레임)으로 — 지금 멈춰 둔 프레임 번호를 다른 액션에 옮기지 않는다
    for (const o of options) m.set(o.v, { ...base, pv: { ...(base.pv || ({} as NonNullable<Snapshot['pv']>)), [field]: o.v, ...(field === 'action' ? { frame: -1 } : {}) } })
    return m
  }, [base, field, options])

  // 짝이 되는 얼굴장식이 없는 '기본'·'눈깜빡'은 그림 없이 이름만 가운데 둔다.
  // (성형 아이템에는 아이콘이 없고, 표정별 얼굴 스프라이트는 눈·입만 떠 있어 그대로 두면 오히려 못 알아본다.)
  const iconOf = (v: string) => {
    if (field !== 'expr') return undefined
    const id = PV_EXPR_ICONS[v]
    return id ? spriteUrl(`sprites/${id}/icon.png`) : undefined
  }
  // 고른 값이 **가운데**에 오도록 열자마자 스크롤한다(끝에 걸쳐 보이면 찾기 어렵다). 맨 위 · 아래 칸이면 스크롤 끝에서 멈춘다.
  // 상세에서 [이전]으로 돌아오면 가운데로 옮기지 않고 들어가기 직전의 스크롤 좌표로 되돌린다(보던 화면 그대로 — 브라우저의 뒤로 가기와 같다).
  // 창 · 고르기 화면을 새로 열 때만 고른 값을 가운데로.
  const rootRef = useRef<HTMLDivElement>(null)
  const [restoreTo] = useState(() => scrollMemo?.current ?? null)
  const scroller = () => rootRef.current?.closest<HTMLElement>('.pb-scroll') ?? null
  const onCurrentCell = (el: HTMLButtonElement | null) => { if (el && restoreTo == null) el.scrollIntoView({ block: 'center', inline: 'nearest' }) }
  useLayoutEffect(() => { const sc = scroller(); if (sc && restoreTo != null) sc.scrollTop = restoreTo }, []) // eslint-disable-line react-hooks/exhaustive-deps -- 붙을 때 한 번

  const cells = (list: Opt[], from: number) => list.map((o, i) => {
    const on = o.v === value
    const dis = !!disabledValues?.has(o.v)
    const icon = iconOf(o.v)
    const snap = snaps?.get(o.v)
    return (
      <button key={o.v} ref={on ? onCurrentCell : undefined} type="button" role="option" aria-selected={on} disabled={dis}
        title={dis ? disabledTitle : (field === 'expr' && !icon ? `${o.l} — 짝이 되는 표정 아이템이 없어 그림은 없어요` : o.l)}
        onClick={() => { if (dis) return; if (scrollMemo) scrollMemo.current = scroller()?.scrollTop ?? null; onChange(o.v) }}
        onPointerEnter={onWarm && !dis ? () => { clearTimeout(dwell.current); dwell.current = setTimeout(() => onWarm(o.v), WARM_DWELL) } : undefined}
        onPointerLeave={onWarm ? () => clearTimeout(dwell.current) : undefined} onPointerDown={onWarm && !dis ? () => onWarm(o.v) : undefined}
        className={clsx(styles.pvCell, on && styles.pvCellOn, dis && styles.pvCellOff)}>
        {icon || snap ? (
          <>
            <span className={styles.pvCellArt}>
              {icon
                ? <img src={icon} alt="" width={46} height={58} className={styles.pvCellIcon} />
                : <SnapThumb snap={snap!} fraction={MODEL_FRACTION} priority={from + i < eager ? 0 : 1} view />}
            </span>
            <span className={styles.pvCellName}>{o.l}</span>
          </>
        ) : <span className={styles.pvCellPlain}>{o.l}</span>}
      </button>
    )
  })

  // 그룹(액션 3묶음)은 격자 안에 제목 줄을 끼워 넣는다 — 칸 순서는 이어지므로 먼저 그릴 칸을 그룹과 무관하게 센다.
  let seen = 0
  return (
    <div ref={rootRef} className={styles.pvGrid}>
      {groups
        ? groups.map((g) => {
          const from = seen
          seen += g.items.length
          return (
            <div key={g.group} className={styles.pvGroup}>
              <span className={styles.pvGroupName}>{g.group}</span>
              {cells(g.items, from)}
            </div>
          )
        })
        : cells(options, 0)}
    </div>
  )
}

// ── 버튼 + 팝박스(PC · 태블릿) ────────────────────────────────────────────────
export default function PvPicker({ field, options, groups, value, onChange, variant, narrow, title, ariaLabel, shortLabel, isDefault, disabledValues, disabledTitle, onOpenPage, guide }: GridProps & {
  variant: 'row' | 'rowM' | 'field' | 'fieldM'
  narrow?: boolean
  title?: string
  ariaLabel: string
  shortLabel?: string
  isDefault?: boolean
  onOpenPage?: () => void // 주면 팝박스 대신 시트 안 화면으로 넘긴다(모바일)
  guide?: string // 기능 안내가 가리킬 이름(data-guide)
}) {
  const s = useShop()
  const pop = usePop()
  const btnRef = useRef<HTMLButtonElement>(null)
  const open = !!pop.pos
  const current = (options.find((o) => o.v === value) || options[0] || { l: '' }).l
  // 자리는 버튼 바로 위(미리보기 아래 줄의 버튼이라 늘 위 — 미리보기 영역 data-pv-stage 안쪽). 가로로 가득 차고, 밖으로 비어져 나가지 않는다.
  const toggle = () => {
    if (onOpenPage) { onOpenPage(); return }
    if (open) { pop.close(); return }
    const b = btnRef.current?.getBoundingClientRect(); if (!b) return
    const stage = document.querySelector('[data-pv-stage]')?.getBoundingClientRect()
    pop.open(popNear(b, stage ?? { left: 0, width: window.innerWidth, top: 0, bottom: window.innerHeight }))
  }

  const isField = variant === 'field' || variant === 'fieldM'
  const cls = clsx('pb-ddbtn',
    variant === 'row' && ui.ddRow, variant === 'rowM' && ui.ddRowM,
    variant === 'field' && ui.ddField, variant === 'field' && narrow && ui.ddFieldNarrow,
    variant === 'fieldM' && ui.ddFieldM, open && ui.ddOpen)

  return (
    <>
      <button ref={btnRef} type="button" data-guide={guide} onClick={toggle} title={title ?? ariaLabel} aria-label={ariaLabel} aria-expanded={open} className={cls}>
        {isField
          ? <span className={clsx(ui.ddFieldText, isDefault && ui.ddFieldTextDef)}>{isDefault ? shortLabel : current}</span>
          : <span className={ui.ddRowText}>{current}</span>}
        <span className={clsx(ui.caret, open && ui.caretOpen)}>▾</span>
      </button>
      <PopBox pop={pop} label={ariaLabel} keep={[btnRef]}>
        {field === 'action'
          ? <ActionPickBody options={options} groups={groups} disabledValues={disabledValues} disabledTitle={disabledTitle} onClose={pop.close}
            current={{ action: s.pv.action, frame: s.pv.frame }} onPick={(a, f) => { onChange(a); s.setPv('frame', f) }} />
          : <>
            <PopScroll>
              <PvGrid field={field} options={options} groups={groups} value={value} disabledValues={disabledValues} disabledTitle={disabledTitle}
                onChange={(v) => { onChange(v); pop.close() }} />
            </PopScroll>
            <PopFoot onClose={pop.close} />
          </>}
      </PopBox>
    </>
  )
}

// ── 팝박스 안의 액션 고르기: 액션 격자 ↔ 액션 상세(재생 · 자세) ─────────────────────
// 연출 설정 · 코디 프로필이 함께 쓴다. 자세가 여럿인 액션은 상세로 넘어가기만 하고, 상세에서 고르면 onPick(액션, 프레임) 뒤 닫는다.
// 자세가 하나뿐인 액션은 누르면 바로 onPick(액션, -1). play = 상세의 '재생' 칸(정지 그림을 만드는 코디 프로필은 끈다).
// current = 지금 값(격자 · 상세에 표시). base = 칸 그림의 코디(없으면 연 순간의 코디).
export function ActionPickBody({ options, groups, current, onPick, onClose, play = true, base, disabledValues, disabledTitle }: {
  options: Opt[]; groups?: Group[]; current: { action: string; frame: number }; onPick: (action: string, frame: number) => void; onClose: () => void
  play?: boolean; base?: Snapshot; disabledValues?: Set<string>; disabledTitle?: string
}) {
  const s = useShop()
  const [snap] = useState<Snapshot>(() => base ?? s.snapshot())
  const { view, go, style } = useInnerSlide<'list' | 'frames'>('list')
  const [detail, setDetail] = useState<string | null>(null)
  const listScroll = useRef<number | null>(null) // 상세로 들어갈 때의 격자 스크롤 좌표 — [이전]으로 돌아오면 그대로 되돌린다(창을 새로 열면 새 ref)
  const info = useActionInfo(detail)
  const done = (a: string, f: number) => { onPick(a, f); onClose() }
  const pick = async (v: string) => {
    if ((await actionInfo(s, v)).delays.length > 1) { setDetail(v); go('frames', 1) } else done(v, -1)
  }
  const label = options.find((o) => o.v === detail)?.l ?? ''
  return (
    <>
      <PopScroll>
        <div style={style} className={styles.sheetSlide}>
          {view === 'frames' && detail ? (
            <div className={styles.pvGrid}>
              <div className={styles.pvDetailHead}>{label}</div>
              <div style={{ gridColumn: '1 / -1' }}>
                <ActionFrameGrid action={detail} info={info} play={play} value={current.action === detail ? current.frame : -2} base={snap} onPick={(f) => done(detail, f)} />
              </div>
            </div>
          ) : (
            <PvGrid field="action" options={options} groups={groups} value={current.action} disabledValues={disabledValues} disabledTitle={disabledTitle} onChange={(v) => { void pick(v) }}
              onWarm={(v) => warmActionFrames(s, snap, v)} scrollMemo={listScroll} />
          )}
        </div>
      </PopScroll>
      <PopFoot onBack={view === 'frames' ? () => go('list', -1) : undefined} onClose={onClose} />
    </>
  )
}
