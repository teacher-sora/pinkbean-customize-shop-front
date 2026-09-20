'use client'

/*
 * 핑크빈 커마샵 — 화면 조합 루트(핸드오프 v2).
 * 상태/핸들러는 shop/ShopContext. 레이아웃 모드는 화면 폭(useBreakpoint): PC · 절반 · 태블릿 = 2분할, 모바일 = 세로 적층.
 * 시트·다이얼로그는 단일 서피스(shop/surface/Surface) 하나. 불러오기 코디 선택(LookDialog)·공유 받기 시트는 현행 유지.
 */

import clsx from 'clsx'
import { ShopProvider, useShop } from './shop/ShopContext'
import Background from './shop/frame/Background'
import AppHeader from './shop/frame/AppHeader'
import BottomNav from './shop/nav/BottomNav'
import ListArea from './shop/list/ListArea'
import InfoPanel from './shop/info/InfoPanel'
import PresetPanel from './shop/preset/PresetPanel'
import PlazaPanel from './shop/plaza/PlazaPanel'
import PlazaUpload from './shop/plaza/PlazaUpload'
import PreviewColumn, { MobileHero } from './shop/preview/PreviewColumn'
import { useRidingGuards } from './shop/preview/pvControls'
import Surface from './shop/surface/Surface'
import LookDialog from './shop/LookDialog'
import ShareReceiveSheet from './shop/ShareReceiveSheet'
import Toast from './shop/ui/Toast'
import styles from './shop/frame/frame.module.css'

function Shell() {
  const s = useShop()
  useRidingGuards()
  const mobile = s.bp === 'mobile'
  const isList = s.primary === 'codi' || s.primary === 'search'
  const isPlaza = s.primary === 'share' // 코디 광장: 미리보기 자리에 등록 폼이 들어가고 모바일 히어로는 감춘다

  return (
    <>
      <Background />
      {mobile ? (
        // 모바일: 폰 프레임(390×780) 없이 화면 전체(100svh 고정, 문서 스크롤 없음).
        <div className={clsx('pb-root', 'pb-shell', styles.root)}>
          <div data-mobile-col className={styles.mobileCol}>
            <AppHeader mobile />
            {!isPlaza && <MobileHero />}
            {isList && <ListArea mobile />}
            {isPlaza && <PlazaPanel mobile />}
            {s.primary === 'preset' && <PresetPanel mobile />}
            {s.primary === 'info' && <InfoPanel mobile />}
            <BottomNav mobile />
          </div>
        </div>
      ) : (
        // PC·절반·태블릿: 2분할은 높이가 고정돼야(리스트 그리드 height:100%) 하므로 문서 스크롤로 풀지 않는다.
        <div className={clsx('pb-root', styles.root)}>
          <div className={clsx(styles.frame, s.bp === 'pc' ? styles.framePc : s.bp === 'half' ? styles.frameHalf : styles.frameTablet)}>
            <AppHeader mobile={false} />
            <main className={styles.main}>
              {isList && <ListArea mobile={false} />}
              {s.primary === 'info' && <InfoPanel mobile={false} />}
              {s.primary === 'preset' && <PresetPanel mobile={false} />}
              {isPlaza && <PlazaPanel mobile={false} />}
              {isPlaza ? <PlazaUpload mobile={false} /> : <PreviewColumn />}
            </main>
            <BottomNav mobile={false} />
          </div>
        </div>
      )}
      <Surface />
      <LookDialog />
      <ShareReceiveSheet />
      <Toast />
    </>
  )
}

export default function PinkbeanShop() {
  return (
    <ShopProvider>
      <Shell />
    </ShopProvider>
  )
}
