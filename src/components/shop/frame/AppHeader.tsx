'use client'

import clsx from 'clsx'
import Image from 'next/image'
import { useShop } from '../ShopContext'
import { IconCopy, IconRate } from '../ui/Icons'
import styles from './frame.module.css'

export default function AppHeader({ mobile }: { mobile: boolean }) {
  const s = useShop()
  if (mobile) {
    return (
      <div className={styles.headerM}>
        <button type="button" onClick={s.goHome} title="처음 화면으로" className={clsx(styles.logoBoxM, styles.logoBtn)}>
          <Image src="/logo.png" alt="핑크빈 커마샵" width={24} height={24} priority className={styles.logoImgM} />
          <span className={styles.logoTextM}>커마샵</span>
        </button>
        <div className={styles.headerActsM}>
          <button type="button" onClick={s.rateCodi} title="핑크빈에게 코디 평가받기" className={clsx('pb-ghost', styles.rateBtnM)}>
            <IconRate size={13} />평가
          </button>
          <button type="button" onClick={s.shareCurrentLink} title="현재 프리셋 복사" className={clsx('pb-solid', styles.copyBtnM)}>
            <IconCopy size={13} />복사
          </button>
        </div>
      </div>
    )
  }
  return (
    <header className={styles.header}>
      <button type="button" onClick={s.goHome} title="처음 화면으로" className={clsx(styles.logoBox, styles.logoBtn)}>
        <Image src="/logo.png" alt="핑크빈 커마샵 로고" width={30} height={30} priority className={styles.logoImg} />
        <span className={styles.logoText}>핑크빈 커마샵</span>
      </button>
      <div className={styles.headerActs}>
        <button type="button" onClick={s.rateCodi} title="핑크빈에게 코디 평가받기" className={clsx('pb-ghost', styles.rateBtn)}>
          <IconRate />코디 평가
        </button>
        <button type="button" onClick={s.shareCurrentLink} title="현재 프리셋 복사" className={clsx('pb-solid', styles.copyBtn)}>
          <IconCopy />프리셋 복사
        </button>
      </div>
    </header>
  )
}
