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

  return (
    <>
      <Background />
      {mobile ? (
        // 모바일: 폰 프레임(390×780) 없이 화면 전체(100svh 고정, 문서 스크롤 없음).
        <div className={clsx('pb-root', 'pb-shell', styles.root)}>
          <div data-mobile-col className={styles.mobileCol}>
            <AppHeader mobile />
            <MobileHero />
            {/* 새로고침 복원 중에는 이 슬롯을 통째로 감추고 아래 빈 뼈대를 대신 보여준다.
                display:contents 라 평소 배치에는 아무 영향이 없다. */}
            <div data-pb-panel style={{ display: 'contents' }}>
              {isList && <ListArea mobile />}
              {s.primary === 'preset' && <PresetPanel mobile />}
              {s.primary === 'info' && <InfoPanel mobile />}
            </div>
            <div data-pb-stub aria-hidden />
            <BottomNav mobile />
          </div>
        </div>
      ) : (
        // PC·절반·태블릿: 2분할은 높이가 고정돼야(리스트 그리드 height:100%) 하므로 문서 스크롤로 풀지 않는다.
        <div className={clsx('pb-root', styles.root)}>
          <div className={clsx(styles.frame, s.bp === 'pc' ? styles.framePc : s.bp === 'half' ? styles.frameHalf : styles.frameTablet)}>
            <AppHeader mobile={false} />
            <main className={styles.main}>
              <div data-pb-panel style={{ display: 'contents' }}>
                {isList && <ListArea mobile={false} />}
                {s.primary === 'info' && <InfoPanel mobile={false} />}
                {s.primary === 'preset' && <PresetPanel mobile={false} />}
              </div>
              <div data-pb-stub aria-hidden />
              <PreviewColumn />
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
