// 빈 상태 하나(제목 + 안내) — 목록 · 코디 룩북 · 광장 · 부위 고르기가 함께 쓴다. 생김새는 frame/empty.module.css
import clsx from 'clsx'
import styles from './empty.module.css'

export type EmptySize = 'pc' | 'm' | 'plaza' | 'plazaM' | 'part'
export default function EmptyState({ size, title, hint }: { size: EmptySize; title: React.ReactNode; hint: React.ReactNode }) {
  return (
    <div className={clsx(styles.empty, styles[size])}>
      <span className={styles.title}>{title}</span>
      <span className={styles.hint}>{hint}</span>
    </div>
  )
}
