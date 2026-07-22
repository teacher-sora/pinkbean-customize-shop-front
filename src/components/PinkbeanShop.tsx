'use client'

/*
 * 핑크빈 커마샵 — 화면 조합 루트.
 * 상태/핸들러는 shop/ShopContext 에, 각 화면은 shop/*Screen · PreviewPanel · DyeDialog · Toast 에 있다.
 * (design_handoff_pinkbean_shop 재현. 아이템/캐릭터는 플레이스홀더 — CDN 단계에서 실제 데이터/합성으로 교체.)
 */

import { css } from '@/lib/style'
import { isStacked } from '@/lib/useBreakpoint'
import { ShopProvider, useShop } from './shop/ShopContext'
import Header from './shop/Header'
import CodiScreen from './shop/CodiScreen'
import SearchScreen from './shop/SearchScreen'
import InfoScreen from './shop/InfoScreen'
import PresetScreen from './shop/PresetScreen'
import PreviewPanel from './shop/PreviewPanel'
import DyeDialog from './shop/DyeDialog'
import LookDialog from './shop/LookDialog'
import ShareReceiveSheet from './shop/ShareReceiveSheet'
import Toast from './shop/Toast'

function Shell() {
  const { primary, bp } = useShop()
  const stacked = isStacked(bp)
  const mobile = bp === 'mobile'
  return (
    // ⚠️ 100vh 금지: iOS Safari 의 100vh 는 "툴바가 없을 때" 기준 큰 뷰포트라, 하단 주소창/탭바가 떠 있으면
    // 그만큼 콘텐츠가 툴바 뒤로 밀려 가려진다. 100dvh = 지금 실제로 보이는 높이.
    // 세로 스택(태블릿+모바일)은 height 대신 min-height + 문서 스크롤(globals.css) → 헤더를 스크롤로 치우고 툴바도 접히게.
    <div className={stacked ? 'pb-mobile' : undefined} style={css(`width:100%; ${stacked ? 'min-height:100dvh' : 'height:100dvh'}; display:flex; justify-content:center; background:linear-gradient(165deg, #fdf2f8 0%, #f6ecf6 55%, #efe8f7 100%);`)}>
      <div style={css(`width:100%; max-width:1440px; ${stacked ? '' : 'height:100%;'} padding:${mobile ? '12px 12px 0' : stacked ? '14px 16px 0' : '20px 32px 0'}; display:flex; flex-direction:column;`)}>
        <Header />
        <main style={css(`${stacked ? 'flex:0 0 auto; flex-direction:column;' : 'flex:1 1 auto; min-height:0;'} display:flex; gap:${stacked ? 10 : 20}px; padding:${stacked ? '10px 0 12px' : '12px 0 20px'};`)}>
          {primary === 'codi' && <CodiScreen />}
          {primary === 'search' && <SearchScreen />}
          {primary === 'info' && <InfoScreen />}
          {primary === 'preset' && <PresetScreen />}
          <PreviewPanel />
        </main>
      </div>
      <DyeDialog />
      <LookDialog />
      <ShareReceiveSheet />
      <Toast />
    </div>
  )
}

export default function PinkbeanShop() {
  return (
    <ShopProvider>
      <Shell />
    </ShopProvider>
  )
}
