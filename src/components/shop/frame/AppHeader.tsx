'use client'

import clsx from 'clsx'
import Image from 'next/image'
import { useEffect, useState } from 'react'
import { useShop } from '../ShopContext'
import { SKY_MODES, getSkyMode, setSkyMode, type SkyMode } from '../scene/skyTime'
import { IconCopy, IconRate, IconScene, IconSky } from '../ui/Icons'
import styles from './frame.module.css'

// 글자가 바뀌는 버튼의 라벨. 나올 수 있는 글자를 모두 같은 자리에 겹쳐 두고 지금 것만 보인다 →
// 칸의 폭이 가장 긴 글자에 맞춰 고정돼, 글자가 바뀌어도 옆의 버튼이 밀리지 않는다.
function Swap({ now, all }: { now: string; all: string[] }) {
  return (
    <span className={styles.swap}>
      {all.map((t) => <span key={t} aria-hidden={t !== now} className={t === now ? undefined : styles.swapOff}>{t}</span>)}
    </span>
  )
}

export default function AppHeader({ mobile }: { mobile: boolean }) {
  const s = useShop()
  // 배경 보기(PC 만): 헤더만 남기고 나머지를 감춘다. 표시는 <html> 속성 하나로 한다 — 감추는 것은 CSS(globals.css),
  // 어두운 막을 걷는 것은 배경 장면(sceneGl)이 이 속성을 보고 한다. 화면이 좁아져 모바일이 되면 저절로 풀린다.
  const [bgOnly, setBgOnly] = useState(false)
  useEffect(() => {
    document.documentElement.toggleAttribute('data-pb-bgonly', bgOnly && !mobile)
    return () => document.documentElement.removeAttribute('data-pb-bgonly')
  }, [bgOnly, mobile])
  // 시간대(PC 만): 누를 때마다 자동 → 정오 → 석양 → 자정 → 여명. 저장된 값은 화면이 뜬 뒤에 읽는다(서버가 그린 글자와 어긋나지 않게)
  const [sky, setSky] = useState<SkyMode>('auto')
  useEffect(() => { setSky(getSkyMode()) }, [])
  const skyAt = SKY_MODES.findIndex((m) => m.id === sky)
  const nextSky = () => { const m = SKY_MODES[(skyAt + 1) % SKY_MODES.length].id; setSkyMode(m); setSky(m) }
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
      {/* 도구 모음 한 칸: 배경을 다루는 둘(시간대 · 배경 보기) | 코디를 다루는 둘(평가 · 복사) */}
      <div className={styles.tools}>
        <button type="button" onClick={nextSky} title={`배경 시간대: ${SKY_MODES[skyAt].label} (누르면 다음으로)`} className={clsx('pb-ghost', styles.tool)}>
          <IconSky mode={sky} /><Swap now={SKY_MODES[skyAt].label} all={SKY_MODES.map((m) => m.label)} />
        </button>
        <button type="button" onClick={() => setBgOnly((v) => !v)} aria-pressed={bgOnly} title={bgOnly ? '화면으로 돌아가기' : '배경만 보기'} className={clsx('pb-ghost', styles.tool, bgOnly && styles.toolOn)}>
          <IconScene /><Swap now={bgOnly ? '돌아가기' : '배경 보기'} all={['배경 보기', '돌아가기']} />
        </button>
        <span className={styles.toolSep} aria-hidden />
        <button type="button" onClick={s.rateCodi} title="핑크빈에게 코디 평가받기" className={clsx('pb-ghost', styles.tool)}>
          <IconRate />코디 평가
        </button>
        <button type="button" onClick={s.shareCurrentLink} title="현재 프리셋 복사" className={clsx('pb-solid', styles.toolSolid)}>
          <IconCopy />프리셋 복사
        </button>
      </div>
    </header>
  )
}
