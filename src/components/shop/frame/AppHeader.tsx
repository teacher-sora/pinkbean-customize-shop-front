'use client'

import clsx from 'clsx'
import Image from 'next/image'
import { useEffect, useState } from 'react'
import { useShop } from '../ShopContext'
import { IconCopy, IconRate, IconScene } from '../ui/Icons'
import styles from './frame.module.css'

export default function AppHeader({ mobile }: { mobile: boolean }) {
  const s = useShop()
  // 배경 보기(PC 만): 헤더만 남기고 나머지를 감춘다. 표시는 <html> 속성 하나로 한다 — 감추는 것은 CSS(globals.css),
  // 어두운 막을 걷는 것은 배경 장면(sceneGl)이 이 속성을 보고 한다. 화면이 좁아져 모바일이 되면 저절로 풀린다.
  const [bgOnly, setBgOnly] = useState(false)
  useEffect(() => {
    document.documentElement.toggleAttribute('data-pb-bgonly', bgOnly && !mobile)
    return () => document.documentElement.removeAttribute('data-pb-bgonly')
  }, [bgOnly, mobile])
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
        <button type="button" onClick={() => setBgOnly((v) => !v)} aria-pressed={bgOnly} title={bgOnly ? '화면으로 돌아가기' : '배경만 보기'} className={clsx('pb-ghost', styles.rateBtn)}>
          <IconScene />{bgOnly ? '돌아가기' : '배경 보기'}
        </button>
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
