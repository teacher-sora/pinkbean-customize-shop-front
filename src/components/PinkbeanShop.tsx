'use client'

/*
 * 핑크빈 커마샵 — 화면 조합 루트.
 * 상태/핸들러는 shop/ShopContext. 레이아웃 모드는 화면 폭(useBreakpoint): PC · 절반 · 태블릿 = 2분할, 모바일 = 세로 적층.
 * 시트·다이얼로그는 단일 서피스(shop/surface/Surface) 하나. 닉네임 불러오기의 코디 선택만 별도 다이얼로그(LookDialog)다.
 */

import clsx from 'clsx'
import { useEffect } from 'react'
import { ShopProvider, useShop } from './shop/ShopContext'
import Background from './shop/frame/Background'
import AppHeader from './shop/frame/AppHeader'
import BootMobile from './shop/frame/BootMobile'
import BottomNav from './shop/nav/BottomNav'
import ListArea from './shop/list/ListArea'
import { lazyPanel } from './shop/frame/lazyPanel'
import PreviewColumn, { MobileHero } from './shop/preview/PreviewColumn'
import { useRidingGuards } from './shop/preview/pvControls'
import { useScrollFades } from './shop/ui/useScrollFade'
import Surface from './shop/surface/Surface'
import LookDialog from './shop/LookDialog'
import Toast from './shop/ui/Toast'
import ConfirmBubble from './shop/ui/ConfirmBubble'
import styles from './shop/frame/frame.module.css'

// 첫 화면에 없는 탭은 묶음 밖에 두고 한가할 때 받는다(frame/lazyPanel)
const InfoPanel = lazyPanel(() => import('./shop/info/InfoPanel'))
const PresetPanel = lazyPanel(() => import('./shop/preset/PresetPanel'))
const PlazaPanel = lazyPanel(() => import('./shop/plaza/PlazaPanel'))
const PlazaUpload = lazyPanel(() => import('./shop/plaza/PlazaUpload'))
const ComboPanel = lazyPanel(() => import('./shop/combo/ComboPanel'))

function Shell() {
  const s = useShop()
  useRidingGuards()
  useScrollFades()   // 스크롤 칸(.pb-fade)의 남은 쪽에만 가장자리 흐림
  // Esc 로 창 · 펼친 칸을 닫으면, 그것을 열었던 버튼에 포커스가 남아 테두리(focus-visible)가 생긴다 — Esc 는 키보드 입력이라
  // 브라우저가 그때부터 포커스를 그려 준다. 닫는 Esc 에서는 버튼의 포커스를 놓는다(Tab 으로 옮겨 다닐 때의 테두리는 그대로다).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && document.activeElement instanceof HTMLButtonElement) document.activeElement.blur() }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [])
  useEffect(() => {
    const run = () => { void (async () => { for (const load of [InfoPanel.preload, PresetPanel.preload, PlazaPanel.preload, PlazaUpload.preload, ComboPanel.preload]) await load() })() }
    if (!('requestIdleCallback' in window)) { const t = setTimeout(run, 1200); return () => clearTimeout(t) }
    const h = requestIdleCallback(run, { timeout: 2500 })
    return () => cancelIdleCallback(h)
  }, [])
  const mobile = s.bp === 'mobile'
  const isList = s.primary === 'codi' || s.primary === 'search'
  const isPlaza = s.primary === 'share' // 코디 광장: PC 는 미리보기 자리에 등록 폼이 들어간다(코디 룩북 분류만 미리보기). 모바일 히어로는 늘 있다
  // 코디 룩북(combo/ComboPanel): 코디 탭은 목록 카드의 칩으로 열면 목록 자리가 패널이 되고, 광장은 '코디 룩북' 분류가 광장 목록 자리에 든다.
  // 광장의 코디 룩북에서는 등록 폼 대신 미리보기를 둔다 — 자주 쓴 염색 · 부위 입기를 바로 보게
  const comboList = isList && s.comboShown // 연 탭(코디 · AI 코디 검색)에서만 — 다른 탭에 갔다 오면 그대로 다시 보인다
  const comboPlaza = isPlaza && s.plazaFilter === 'combo'
  return (
    <>
      <Background mobile={mobile} />
      {mobile ? (
        // 모바일: 화면 전체를 쓰는 흰 컬럼. 터치 기기에서는 문서(루트)가 스크롤한다(globals.css).
        <div className={clsx('pb-shell', styles.root)}>
          <div data-mobile-col className={styles.mobileCol}>
            <AppHeader mobile />
            {/* 새로고침 복원 중에는 이 슬롯을 통째로 감추고 아래 빈 뼈대를 대신 보여준다.
                display:contents(globals.css)라 평소 배치에는 아무 영향이 없다.
                히어로(미리보기)는 모든 탭에 있다 — 광장도 분류마다 같다(사용자 지시: 코디 룩북 분류에만 있으면 분류를 바꿀 때마다
                칸이 생겼다 사라져 아래가 밀렸다. 광장에서 가져온 코디도 바로 보인다). */}
            <div data-pb-panel>
              <MobileHero />
              {/* 채팅 칸 — 말풍선을 끼었을 때만, 미리보기 바로 아래 */}
              {isList && (comboList ? <ComboPanel mobile host="codi" /> : <ListArea mobile />)}
              {isPlaza && (comboPlaza ? <ComboPanel mobile host="plaza" /> : <PlazaPanel mobile />)}
              {s.primary === 'preset' && <PresetPanel mobile />}
              {s.primary === 'info' && <InfoPanel mobile />}
            </div>
            <div data-pb-stub="main" aria-hidden />
            <BottomNav mobile />
          </div>
        </div>
      ) : (
        // PC·절반·태블릿: 2분할은 높이가 고정돼야(리스트 그리드 height:100%) 하므로 문서 스크롤로 풀지 않는다.
        <div className={clsx(styles.root, styles.rootPc)}>
          <div className={clsx(styles.frame, s.bp === 'pc' ? styles.framePc : s.bp === 'half' ? styles.frameHalf : styles.frameTablet)}>
            <AppHeader mobile={false} />
            <main className={styles.main} data-pb-body>
              {/* 오른쪽 칸(미리보기 ↔ 등록 폼)도 같은 슬롯 안에 둔다. 탭에 따라 바뀌는 칸이라
                  밖에 두면 뼈대 동안 미리보기가 보였다가 등록 폼으로 갈아끼워진다. */}
              <div data-pb-panel>
                {isList && (comboList ? <ComboPanel mobile={false} host="codi" /> : <ListArea mobile={false} />)}
                {s.primary === 'info' && <InfoPanel mobile={false} />}
                {s.primary === 'preset' && <PresetPanel mobile={false} />}
                {isPlaza && (comboPlaza ? <ComboPanel mobile={false} host="plaza" /> : <PlazaPanel mobile={false} />)}
                {isPlaza && !comboPlaza && <PlazaUpload mobile={false} />}
                {(!isPlaza || comboPlaza) && <PreviewColumn />}
              </div>
              <div data-pb-stub="main" aria-hidden />
              <div data-pb-stub="side" aria-hidden />
            </main>
            <BottomNav mobile={false} />
          </div>
        </div>
      )}
      {!mobile && <BootMobile />}
      <Surface />
      <LookDialog />
      <Toast />
      <ConfirmBubble />
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
