import Image from 'next/image'
import { MOBILE_GRID } from '@/lib/shopData'
import styles from './frame.module.css'

// 휴대폰에서 JS 가 붙기 전의 뼈대 — 실제 모바일 화면과 같은 자리(헤더 · 미리보기 · 머리 묶음 · 카드 · 하단 탭)에 빈 칸만 그린다. 움직이는 것 없이 CSS 로만 보인다(frame.module.css .bootM)
export default function BootMobile() {
  return (
    <div className={styles.bootM} aria-hidden>
      <div className={styles.headerM}>
        <span className={styles.logoBoxM}>
          <Image src="/logo.png" alt="" width={24} height={24} priority className={styles.logoImgM} />
          <span className={styles.logoTextM}>커마샵</span>
        </span>
      </div>
      <div className={styles.bootHero} />
      <div className={styles.bootBars} />
      <div className={styles.bootGrid}>
        {Array.from({ length: MOBILE_GRID.cols * MOBILE_GRID.rows }, (_, i) => <div key={i} className={styles.bootCard} />)}
      </div>
      <div className={styles.bootNav} />
    </div>
  )
}
