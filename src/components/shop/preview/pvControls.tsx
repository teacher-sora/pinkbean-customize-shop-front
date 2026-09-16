'use client'

// 연출 설정 컨트롤(PC 드로어 · 모바일 시트 공용).
//  상시: 배율·액션·무기 모션·표정 / 접힘: 캐릭터(형상 변이·귀·시선) · 이펙트(무기·망토·모자).
//  옵션 데이터는 실제 데이터(catalog.ts) — v2 파일의 목록은 디자인용 임의 데이터였다.

import clsx from 'clsx'
import { useEffect } from 'react'
import { PV_ACTIONS_FLAT, PV_EARS, PV_EXPRS, PV_FORMS, PV_GAZES, PV_WEAPONS, type Opt, type Pv } from '@/lib/catalog'
import { useShop } from '../ShopContext'
import Dropdown from '../ui/Dropdown'
import { Switch } from '../ui/controls'
import styles from './preview.module.css'

const ZOOMS: Opt[] = [{ v: '1', l: '1배' }, { v: '2', l: '2배' }, { v: '3', l: '3배' }]
// [dev] 재규어 라이딩 중 "가능한" 액션(UI 값 기준). 나머지는 목록에서 지우지 않고 비활성으로 표시한다.
const RIDING_ACTIONS = new Set(['basic', 'walk', 'jump', 'ladder', 'rope', 'shoot2'])
const lb = (arr: Opt[], v: string) => (arr.find((x) => x.v === v) || arr[0]).l

// 라이딩 중: 불가 액션·형상 변이를 안전한 기본값으로 되돌린다(셸에서 한 번만 마운트).
export function useRidingGuards() {
  const s = useShop()
  const ridingItem = s.equipped?.riding
  const riding = !!ridingItem
  useEffect(() => {
    if (!riding) return
    const allow = ridingItem?.ridingActions ? new Set(ridingItem.ridingActions) : RIDING_ACTIONS
    if (!allow.has(s.pv.action)) s.setPv('action', 'basic')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [riding, ridingItem, s.pv.action])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (riding && s.pv.form !== 'none') s.setPv('form', 'none') }, [riding, s.pv.form])
}

function useRiding() {
  const s = useShop()
  const ridingItem = s.equipped?.riding
  const riding = !!ridingItem
  const allowed = ridingItem?.ridingActions ? new Set(ridingItem.ridingActions) : RIDING_ACTIONS
  const disabledActions = riding ? new Set(PV_ACTIONS_FLAT.filter((a) => !allowed.has(a.v)).map((a) => a.v)) : undefined
  return { riding, disabledActions }
}

// 상시 4필드: 기본값이면 설정 이름, 바꾸면 값을 표시.
export function PvInlineFields({ mobile, narrow }: { mobile: boolean; narrow: boolean }) {
  const s = useShop()
  const { disabledActions } = useRiding()
  const pv = s.pv
  const variant = mobile ? 'fieldM' : 'field'
  const fields: { key: keyof Pv; title: string; short: string; def: string; hint: string; options: Opt[]; value: string; set: (v: string) => void }[] = [
    { key: 'zoom', title: '배율', short: '배율', def: '2', hint: '미리보기 캐릭터 크기', options: ZOOMS, value: String(pv.zoom), set: (v) => s.setPv('zoom', Number(v)) },
    { key: 'action', title: '액션', short: '액션', def: 'basic', hint: '캐릭터 동작 (서기·걷기·점프 등)', options: PV_ACTIONS_FLAT, value: pv.action, set: (v) => s.setPv('action', v) },
    { key: 'weapon', title: '무기 모션', short: '모션', def: 'basic', hint: '무기를 든 자세 (스윙·찌르기·사격 등)', options: PV_WEAPONS, value: pv.weapon, set: (v) => s.setPv('weapon', v) },
    { key: 'expr', title: '표정', short: '표정', def: 'default', hint: '얼굴 표정', options: PV_EXPRS, value: pv.expr, set: (v) => s.setPv('expr', v) },
  ]
  return (
    <>
      {fields.map((f) => (
        <Dropdown key={f.key} variant={variant} narrow={narrow} options={f.options} value={f.value} onChange={f.set}
          title={`${f.title} — ${f.hint}`} ariaLabel={f.title} shortLabel={f.short} isDefault={f.value === f.def}
          disabledValues={f.key === 'action' ? disabledActions : undefined} disabledTitle="라이딩 중에는 사용할 수 없어요" />
      ))}
    </>
  )
}

export type PvGroup = 'char' | 'effect'

// 캐릭터 / 이펙트 슬라이드(같은 자리에서 위아래로 전환) + 아코디언 바.
export function PvGroups({ group, onGroup, mobile }: { group: PvGroup; onGroup: (g: PvGroup) => void; mobile: boolean }) {
  const s = useShop()
  const { riding } = useRiding()
  const pv = s.pv
  const rowVariant = mobile ? 'rowM' : 'row'
  const labelCls = clsx(styles.pvLabel, mobile && styles.pvLabelM)
  const selects: { key: 'form' | 'ear' | 'gaze'; label: string; options: Opt[] }[] = [
    { key: 'form', label: '형상 변이', options: PV_FORMS },
    { key: 'ear', label: '귀', options: PV_EARS },
    { key: 'gaze', label: '시선', options: PV_GAZES },
  ]
  const switches: { key: 'wEffect' | 'cEffect' | 'capEffect'; label: string }[] = [
    { key: 'wEffect', label: '무기 이펙트' }, { key: 'cEffect', label: '망토 이펙트' }, { key: 'capEffect', label: '모자 이펙트' },
  ]
  const groups: { key: PvGroup; label: string; summary: string }[] = [
    { key: 'char', label: '캐릭터', summary: `${lb(PV_FORMS, pv.form)} · ${lb(PV_EARS, pv.ear)} · ${lb(PV_GAZES, pv.gaze)}` },
    { key: 'effect', label: '이펙트', summary: `${[pv.wEffect, pv.cEffect, pv.capEffect].filter(Boolean).length} / 3 켜짐` },
  ]
  const slides = (
    <>
      <div className={clsx('pb-slide', 'pb-scroll', 'pb-scroll-thin', styles.slide, group === 'char' && styles.slideOn)}>
        <div className={styles.slidePad}>
          {selects.map((r) => (
            <div key={r.key} className={styles.pvRow}>
              <span className={labelCls}>{r.label}</span>
              <Dropdown variant={rowVariant} options={r.options} value={pv[r.key]} onChange={(v) => s.setPv(r.key, v)} ariaLabel={r.label}
                blocked={r.key === 'form' && riding} blockedTitle="라이딩 중에는 형상 변이를 바꿀 수 없어요" />
            </div>
          ))}
        </div>
      </div>
      <div className={clsx('pb-slide', 'pb-scroll', 'pb-scroll-thin', styles.slide, group === 'effect' && styles.slideOn)}>
        <div className={styles.slidePad}>
          {switches.map((r) => (
            <div key={r.key} className={styles.pvRow}>
              <span className={labelCls}>{r.label}</span>
              <Switch on={pv[r.key]} onToggle={() => s.setPv(r.key, !pv[r.key])} title={r.label} />
            </div>
          ))}
        </div>
      </div>
    </>
  )
  return (
    <>
      <div className={mobile ? styles.slidesM : styles.slides}>{slides}</div>
      <div className={styles.line} />
      <div className={styles.bars}>
        {groups.map((g, gi) => (
          <button key={g.key} type="button" onClick={() => onGroup(g.key)} className={clsx('pb-accbar', styles.bar, gi === 1 && styles.bar2, group === g.key && styles.barOn)}>
            <span className={clsx(styles.barLabel, mobile && styles.barLabelM)}>{g.label}</span>
            <span className={clsx(styles.barSummary, mobile && styles.barSummaryM)}>{g.summary}</span>
          </button>
        ))}
      </div>
    </>
  )
}
