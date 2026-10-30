import clsx from 'clsx'
import Image from 'next/image'
import { MOBILE_GRID } from '@/lib/shopData'
import { TABS } from '../nav/BottomNav'
import { IconTab } from '../ui/Icons'
import nav from '../nav/nav.module.css'
import styles from './frame.module.css'

// 휴대폰에서 JS 가 붙기 전의 뼈대 — 실제 모바일 화면과 같은 자리에 그린다(frame.module.css .bootM).
// 미리 알 수 있는 것(로고, 부위 앞 글자, 하단 탭)은 진짜와 같은 부품으로 그려 두고, 데이터가 있어야 하는 칸만 비운다. 빛줄기는 0.2초가 넘어가면 나타나 빨리 뜨는 기기에서는 보이지 않는다
const CATS = ['전체', '신규', '즐겨찾기', '헤어', '성형', '피부', '모자']
export default function BootMobile() {
  return (
    <div className={styles.bootM} aria-hidden>
      <div className={styles.headerM}>
        <span className={styles.logoBoxM}>
          <Image src="/logo.png" alt="" width={24} height={24} priority className={styles.logoImgM} />
          <span className={styles.logoTextM}>커마샵</span>
        </span>
      </div>
      <div className={clsx(styles.bootHero, styles.bootShim)} />
      <div className={styles.bootBars}>
        <div className={clsx(nav.catTabsM, styles.bootCats)}>
          {CATS.map((c, i) => <span key={c} className={clsx(nav.catTabM, i === 0 && nav.catTabMOn)}>{c}</span>)}
        </div>
      </div>
      <div className={styles.bootGrid}>
        {Array.from({ length: MOBILE_GRID.cols * MOBILE_GRID.rows }, (_, i) => <div key={i} className={clsx(styles.bootCard, styles.bootShim)} />)}
      </div>
      <div className={clsx(styles.bootNav, nav.tabNavM)}>
        {TABS.map((t, i) => (
          <span key={t.id} className={clsx(nav.tabM, i === 0 && nav.tabMOn)}>
            <IconTab id={t.id} size={19} /><span className={nav.tabMLabel}>{t.short}</span>
          </span>
        ))}
      </div>
    </div>
  )
}
