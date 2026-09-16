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

// 모바일 가상 키보드가 내려간 뒤 하단에 남는 공백 제거: 브라우저가 레이아웃을 다시 잡지 않고 남겨둔 상태라
// (사용자가 스크롤을 살짝 움직이면 사라짐) 키보드가 닫히는 순간 1px 스크롤했다 되돌려 같은 효과를 낸다.
// 판정 = visualViewport 높이가 다시 커질 때(키보드 닫힘) + 입력칸 포커스 해제 직후(visualViewport 미지원 대비).
function useKeyboardGapFix(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return
    const nudge = () => requestAnimationFrame(() => {
      const y = window.scrollY
      window.scrollTo(0, y > 0 ? y - 1 : y + 1) // 맨 위면 +1, 아니면 −1(맨 아래에서 +1 은 막힘)
      window.scrollTo(0, y)
    })
    const vv = window.visualViewport
    let lastH = vv?.height ?? 0
    const onVv = () => {
      if (!vv) return
      if (vv.height > lastH + 80) nudge() // 키보드 높이만큼 커짐 = 닫힘
      lastH = vv.height
    }
    const onFocusOut = (e: FocusEvent) => {
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) setTimeout(nudge, 350)
    }
    vv?.addEventListener('resize', onVv)
    window.addEventListener('focusout', onFocusOut)
    return () => { vv?.removeEventListener('resize', onVv); window.removeEventListener('focusout', onFocusOut) }
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
