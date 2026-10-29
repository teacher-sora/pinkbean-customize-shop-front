'use client'

import clsx from 'clsx'
import Image from 'next/image'
import { useEffect, useState } from 'react'
import { useShop } from '../ShopContext'
import { resetHeroView, saveCmpView, setHeroView, useHeroView, type HeroView } from '@/lib/heroView'
import { SKY_MODES, getSkyMode, setSkyMode, type SkyMode } from '../scene/skyTime'
import { THEMES, applyThemeAttr, setTheme, useTheme } from '@/lib/theme'
import { Seg } from '../ui/controls'
import { IconLinkCopy, IconRate, IconScene, IconSky, IconTheme, IconViewBase, IconViewFull, IconViewWide } from '../ui/Icons'
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
  // 테마(PC · 모바일): 누를 때마다 시스템 → 라이트 → 다크(lib/theme)
  const theme = useTheme()
  useEffect(() => { applyThemeAttr() }, [theme]) // 새로고침 뒤에도 테마 유지(사용자 제보: 프리셋 탭에서 새로고침하면 라이트로 고정)
  const themeAt = Math.max(0, THEMES.findIndex((t) => t.id === theme))
  const nextTheme = () => setTheme(THEMES[(themeAt + 1) % THEMES.length].id)
  const themeTitle = `테마: ${THEMES[themeAt].label} (누르면 다음으로)`
  const nextSky = () => { const m = SKY_MODES[(skyAt + 1) % SKY_MODES.length].id; setSkyMode(m); setSky(m) }
  // 미리보기 크기(모바일 만, lib/heroView): 기본 · 크게 · 캐릭터만. 모바일은 모든 탭에 미리보기가 있다(코디 광장도)
  const hv = useHeroView()
  useEffect(() => { if (!mobile) resetHeroView() }, [mobile])
  if (mobile) {
    const viewOpts: { v: HeroView; l: string; icon: React.ReactNode }[] = [
      { v: 'base', l: '미리보기 기본 크기', icon: <IconViewBase /> },
      { v: 'wide', l: '미리보기 크게', icon: <IconViewWide /> },
      { v: 'full', l: '캐릭터만 보기', icon: <IconViewFull /> },
    ]
    return (
      <div className={styles.headerM}>
        <button type="button" onClick={s.goHome} title="처음 화면으로" className={clsx(styles.logoBoxM, styles.logoBtn)}>
          <Image src="/logo.png" alt="핑크빈 커마샵" width={24} height={24} priority className={styles.logoImgM} />
          <span className={styles.logoTextM}>커마샵</span>
        </button>
        <div className={styles.headerActsM}>
          <div data-guide="view" className={styles.viewSegM}>
            <Seg variant="mobileFit" opts={viewOpts} value={hv} onPick={(v) => { setHeroView(v); if (s.cmpOn) saveCmpView(v) }} title="미리보기 크기" />
          </div>
          {/* 테마 — 뷰어 전환과 평가 사이(사용자 지시) */}
          <button type="button" onClick={nextTheme} title={themeTitle} aria-label={themeTitle} className={clsx('pb-ghost', styles.themeBtnM)}><IconTheme mode={theme} size={14} /></button>
          <button type="button" data-guide="rate" onClick={s.rateCodi} disabled={s.rateBusy} title={s.rateBusy ? '핑크빈이 코디를 보고 있어요' : '핑크빈에게 코디 평가받기'} aria-label="평가" className={clsx('pb-ghost', styles.rateBtnM)}>
            <IconRate size={13} /><span className={styles.btnLabelM}>평가</span>
          </button>
          <button type="button" onClick={s.shareCurrentLink} title="현재 프리셋 복사" aria-label="복사" data-guide="copy" className={clsx('pb-solid', styles.copyBtnM)}>
            <IconLinkCopy size={13} /><span className={styles.btnLabelM}>복사</span>
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
      {/* 도구 모음 한 칸: 배경을 다루는 둘(시간대 · 배경 보기) | 테마 · 평가 · 복사 */}
      <div className={styles.tools}>
        <button type="button" onClick={nextSky} title={`배경 시간대: ${SKY_MODES[skyAt].label} (누르면 다음으로)`} className={clsx('pb-ghost', styles.tool)}>
          <IconSky mode={sky} /><Swap now={SKY_MODES[skyAt].label} all={SKY_MODES.map((m) => m.label)} />
        </button>
        <button type="button" onClick={() => setBgOnly((v) => !v)} aria-pressed={bgOnly} title={bgOnly ? '화면으로 돌아가기' : '배경만 보기'} className={clsx('pb-ghost', styles.tool, bgOnly && styles.toolOn)}>
          <IconScene /><Swap now={bgOnly ? '돌아가기' : '배경 보기'} all={['배경 보기', '돌아가기']} />
        </button>
        <span className={styles.toolSep} aria-hidden />
        {/* 테마 — 구분선 오른쪽, 코디 평가 · 프리셋 복사와 같은 묶음(사용자 지시) */}
        <button type="button" onClick={nextTheme} title={themeTitle} className={clsx('pb-ghost', styles.tool)}>
          <IconTheme mode={theme} /><Swap now={THEMES[themeAt].label} all={THEMES.map((t) => t.label)} />
        </button>
        <button type="button" data-guide="rate" onClick={s.rateCodi} disabled={s.rateBusy} title={s.rateBusy ? '핑크빈이 코디를 보고 있어요' : '핑크빈에게 코디 평가받기'} className={clsx('pb-ghost', styles.tool)}>
          <IconRate />코디 평가
        </button>
        <button type="button" onClick={s.shareCurrentLink} title="현재 프리셋 복사" data-guide="copy" className={clsx('pb-solid', styles.toolSolid)}>
          <IconLinkCopy size={15} />프리셋 복사
        </button>
      </div>
    </header>
  )
}
