// 작업 칩 [라벨 n / 총수] 하나 — 프리셋 탭 · 코디 정보가 함께 쓴다. 생김새는 frame/countChip.module.css
import clsx from 'clsx'
import styles from './countChip.module.css'

// digits = 숫자가 가질 수 있는 자리 수(폭을 미리 잡는다). label 이 없으면 앞 글자를 두지 않는다
export default function CountChip({ mobile, label, n, total, digits, title }: { mobile: boolean; label?: string; n: number; total: number; digits: 2 | 3; title: string }) {
  return (
    <div title={title} className={clsx(styles.chip, mobile && styles.chipM)}>
      {label != null && <span className={styles.label}>{label}</span>}
      <span className={clsx(styles.num, digits === 3 ? styles.num3 : styles.num2)}>{n}</span>
      <span className={styles.slash}>/</span>
      <span className={styles.label}>{total}</span>
    </div>
  )
}
