'use client'

// 쪽 칩 [N개 | ‹ 번호 / 총수 ›] 하나 — 목록 · 광장 · 코디 룩북 · 도움 및 건의함이 함께 쓴다. 생김새는 frame/pageChip.module.css.
// 모바일에는 화살표를 두지 않는다(arrows 로 켤 수 있다) — 쪽은 목록을 옆으로 밀어 넘기고, 멀리 갈 때는 번호를 적는다.
// 번호 칸은 지금 탭의 쪽 넘김(ShopContext 의 pageInput 들)을 쓴다. num 을 주면 입력칸 대신 그 글자만 둔다(도움 및 건의함의 자기 쪽).
import clsx from 'clsx'
import { useShop } from '../ShopContext'
import { IconChevronLeft, IconChevronRight } from '../ui/Icons'
import styles from './pageChip.module.css'

export default function PageChip({ mobile, narrow, tight, arrows = !mobile, className, count, countTitle, countClass, cur, pageCount, totalText, onStep, idle, prevTitle, nextTitle, inputTitle, num }: {
  mobile: boolean; narrow?: boolean; tight?: boolean; arrows?: boolean; className?: string
  count?: string; countTitle?: string; countClass?: string // PC(좁지 않을 때)의 앞 개수 글자
  cur: number; pageCount: number; totalText?: string; onStep: (d: -1 | 1) => void
  idle?: boolean // 넘길 것이 없는 자리(코디 룩북에서 아이템을 고르기 전) — 번호 칸은 '1' 읽기 전용, 화살표는 꺼짐
  prevTitle: string; nextTitle: string; inputTitle?: string; num?: string
}) {
  const s = useShop()
  const canPrev = !idle && cur > 0, canNext = !idle && cur < pageCount - 1
  return (
    <div className={clsx(mobile ? styles.pageChipM : clsx(styles.pageChip, narrow && styles.pageChipNarrow), tight && styles.tight, className)}>
      {count != null && !mobile && !narrow && (
        <>
          <span title={countTitle} className={clsx(styles.count, countClass)}>{count}</span>
          <span className={styles.chipDiv} />
        </>
      )}
      {arrows && <button type="button" onClick={() => onStep(-1)} disabled={!canPrev} title={prevTitle} aria-label={prevTitle.replace(/ \(.\)$/, '')} className={clsx('pb-arrow', styles.arrow, canPrev && styles.arrowOn)}><IconChevronLeft /></button>}
      {num != null ? <span className={styles.num}>{num}</span> : (
        <>
          {idle
            ? <input value="1" readOnly tabIndex={-1} aria-label="현재 페이지" title="아이템을 고르면 넘길 수 있어요" className={clsx('pb-input', 'pb-pageinput', styles.pageInput)} />
            : <input value={s.pageEditing ? s.pageInput : `${cur + 1}`} onFocus={s.onPageFocus} onChange={s.onPageChange} onKeyDown={s.onPageKey} onBlur={s.commitPage}
                inputMode="numeric" aria-label="현재 페이지" title={mobile ? undefined : inputTitle} className={clsx('pb-input', 'pb-pageinput', styles.pageInput)} />}
          <span className={mobile ? styles.slashM : styles.slash}>/</span>
          <span className={styles.total}>{totalText ?? pageCount}</span>
        </>
      )}
      {arrows && <button type="button" onClick={() => onStep(1)} disabled={!canNext} title={nextTitle} aria-label={nextTitle.replace(/ \(.\)$/, '')} className={clsx('pb-arrow', styles.arrow, canNext && styles.arrowOn)}><IconChevronRight /></button>}
    </div>
  )
}
