'use client'

// 코디 칩의 작은 동그라미 단추(사용자 지시 — 칩마다 따로 짓지 않고 이 하나로: 크기 · hover · 눌림 · 끝난 표시가 늘 같다).
// 크기 26(아이콘 15 · 체크 12 — 사용자 지시: 22 는 칩마다 체감 크기가 달랐다). 칩 글자 오른쪽(띠 위)에 붙는다. 쓰는 곳: 착용 칩의 '입기'(plaza/PlazaDetailBody WornItems), 자주 쓴 염색 칩의 '보관함에 담기'(combo/ComboPanel).
//  · done = 이미 끝난 상태(입고 있다 · 보관함에 있다) — 같은 자리 · 같은 크기의 분홍 체크(누를 수 없다)
//  · 칩 자체가 누르는 칸이어도 되게 누름은 칩으로 번지지 않는다(stopPropagation)
import clsx from 'clsx'
import { IconCheck } from './Icons'
import styles from './ui.module.css'

export function ChipAct({ done, doneTitle, icon, title, label, onClick, disabled }: {
  done: boolean; doneTitle: string; icon: React.ReactNode; title: string; label: string; onClick: () => void; disabled?: boolean
}) {
  if (done) return <span title={doneTitle} className={clsx(styles.chipAct, styles.chipActOn)}><IconCheck size={12} /></span>
  return (
    <button type="button" disabled={disabled} onClick={(e) => { e.stopPropagation(); onClick() }} title={title} aria-label={label} className={styles.chipAct}>{icon}</button>
  )
}
