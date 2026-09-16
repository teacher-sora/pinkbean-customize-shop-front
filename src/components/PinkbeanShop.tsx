'use client'

/*
 * 핑크빈 커마샵 — 화면 조합 루트(핸드오프 v2).
 * 상태/핸들러는 shop/ShopContext. 레이아웃 모드는 화면 폭(useBreakpoint): PC · 절반 · 태블릿 = 2분할, 모바일 = 세로 적층.
 * 시트·다이얼로그는 단일 서피스(shop/surface/Surface) 하나. 불러오기 코디 선택(LookDialog)·공유 받기 시트는 현행 유지.
 */

import clsx from 'clsx'
import { useEffect } from 'react'
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

// 모바일 가상 키보드를 내린 뒤 하단에 남는 공백 제거. 브라우저가 레이아웃을 다시 잡지 않고 남겨둔 상태라(스크롤을 살짝
// 움직이면 사라짐) 키보드가 닫히는 순간 **한 번만** 1px 스크롤했다 되돌린다.
// 판정은 "입력칸에 포커스 + 보이는 화면이 창 높이의 75% 미만(= 키보드 열림)" → 그 상태가 풀릴 때만.
// (예전 구현은 포커스 해제·높이 변화 전반에 반응해 탭 이동 때도 스크롤을 건드려 꼬였다 → 키보드 열림→닫힘 전이에만 반응.)
function useKeyboardGapFix(enabled: boolean) {
  useEffect(() => {
    const vv = window.visualViewport
    if (!enabled || !vv) return
    const typing = () => { const a = document.activeElement as HTMLElement | null; return !!a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA') }
    let open = false
    const onResize = () => {
      const nowOpen = vv.height < window.innerHeight * 0.75
      if (nowOpen && typing()) { open = true; return }
      if (open && !nowOpen) {
        open = false
        requestAnimationFrame(() => {
          const y = window.scrollY
          window.scrollTo(0, y > 0 ? y - 1 : y + 1)
          window.scrollTo(0, y)
        })
      }
    }
    vv.addEventListener('resize', onResize)
    return () => vv.removeEventListener('resize', onResize)
  }, [enabled])
}

function Shell() {
  const s = useShop()
  useRidingGuards()
  useKeyboardGapFix(s.bp === 'mobile')
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
            {isList && <ListArea mobile />}
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
