'use client'

/*
 * 단일 서피스 — 연출 설정 · 북마크 · 염색 · 점 위치가 모두 이 컴포넌트 하나를 공유한다(v2 §10.4).
 *  - PC(절반·태블릿): 중앙 다이얼로그 min(900px, 앱 영역−40px) × min(620px, 86svh)
 *  - 모바일: 하단 시트 85%. 패널·마스크 어디를 잡아도(버튼 포함) 아래로 끌어 닫힘(70px), 핸들은 56px.
 *    제외 = 글자 입력·슬라이더·점 위치 캔버스. 안쪽 스크롤이 맨 위가 아니면 먼저 스크롤한다. 손 뗀 최종 위치로만 판정.
 *    ⚠️ 포인터 이벤트는 브라우저가 세로 팬을 가져가며 pointercancel 로 끊겨(핸들만 동작하던 버그), 비수동(passive:false)
 *    touchmove 에서 "아래로·스크롤 맨 위"일 때만 preventDefault 로 제스처를 가져온다. 드래그 중 이동은 DOM 직접 갱신.
 *  - 마스크는 누름(pointerdown)·뗌(pointerup)이 둘 다 마스크일 때만 닫힘. click 으로 판정하면 마스크에서 눌러 패널에서
 *    떼도 click 대상이 공통 조상(마스크)이 되어 닫히므로 쓰지 않는다. 8px 넘게 움직였거나 드래그 직후 400ms 는 무시.
 *  - 등장은 마운트 후 한 프레임 뒤, 닫힘은 대칭 곡선 후 320ms 뒤 언마운트(ShopContext).
 */

import clsx from 'clsx'
import { useEffect, useRef, useState } from 'react'
import { useShop, type Surface as SurfaceState } from '../ShopContext'
import { BookmarkSheetBody, PvSheetBody } from '../preview/PreviewParts'
import { IconClose } from '../ui/Icons'
import { useMaskClose } from '../ui/useMaskClose'
import DotSurfaceBody from './DotSurfaceBody'
import DyeSurfaceBody from './DyeSurfaceBody'
import styles from './surface.module.css'

export default function Surface() {
  const s = useShop()
  const sf = s.surface
  if (!sf) return null
  return <SurfaceView key={`${sf.kind}:${sf.item?.id ?? ''}`} sf={sf} />
}

// 앱 영역(프레임) 폭 — 다이얼로그 폭 기준(뷰포트가 아니라 앱 영역).
function useFrameWidth(bp: string) {
  const [vw, setVw] = useState(0)
  useEffect(() => {
    const m = () => setVw(window.innerWidth)
    m()
    window.addEventListener('resize', m)
    return () => window.removeEventListener('resize', m)
  }, [])
  return bp === 'half' ? Math.min(vw, 860) : bp === 'tablet' ? Math.min(vw, 1024) : Math.min(vw, 1440)
}

function SurfaceView({ sf }: { sf: SurfaceState }) {
  const s = useShop()
  const mobile = s.bp === 'mobile'
  const [entered, setEntered] = useState(false)
  const dragRef = useRef({ draggedAt: 0 })
  const overlayRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const frameW = useFrameWidth(s.bp)
  const hidden = s.surfaceClosing || !entered
  const tall = sf.kind === 'dye' || sf.kind === 'dot'

  // 등장 전환이 보이도록 마운트 후 한 프레임 뒤 위치를 바꾼다.
  useEffect(() => {
    let r2 = 0
    const r1 = requestAnimationFrame(() => { r2 = requestAnimationFrame(() => setEntered(true)) })
    return () => { cancelAnimationFrame(r1); cancelAnimationFrame(r2) }
  }, [])
  // Esc 닫기(드롭다운·점 위치 편집기는 캡처 단계에서 먼저 처리한다).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') s.closeSurface() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  // 모바일은 문서 스크롤이 열려 있어, 시트가 떠 있는 동안 뒤 페이지가 함께 밀리지 않게 잠근다.
  useEffect(() => {
    if (!mobile) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [mobile])

  // 모바일 끌어내리기(터치 — 마우스 에뮬레이션은 넣지 않는다).
  const EASE = 'transform .3s cubic-bezier(.45,0,.55,1)'
  useEffect(() => {
    const layer = overlayRef.current
    if (!mobile || !layer) return
    let st: { x: number; y: number; baseY: number; mode: 'y' | 'skip' | null; threshold: number; scroller: HTMLElement | null; dist: number } | null = null
    // 시작점에서 패널까지 올라가며 실제로 세로 스크롤 가능한 조상을 찾는다.
    const scrollerOf = (el: HTMLElement | null) => {
      for (let n = el; n && n !== layer; n = n.parentElement) {
        if (n.scrollHeight - n.clientHeight > 1) { const oy = getComputedStyle(n).overflowY; if (oy === 'auto' || oy === 'scroll') return n }
      }
      return null
    }
    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) { st = null; return }
      const t = e.target as HTMLElement
      if (t.closest?.('input, textarea, select, .pb-slider, .pb-range, .pb-ddmenu, [data-no-sheet-drag]')) { st = null; return }
      const onHandle = !!t.closest?.('[data-sheet-handle]')
      const p = e.touches[0]
      st = { x: p.clientX, y: p.clientY, baseY: p.clientY, mode: null, threshold: onHandle ? 56 : 70, scroller: onHandle ? null : scrollerOf(t), dist: 0 }
    }
    const onMove = (e: TouchEvent) => {
      if (!st || st.mode === 'skip') return
      const p = e.touches[0]
      const dy = p.clientY - st.y, dx = p.clientX - st.x
      if (!st.mode) {
        if (Math.abs(dy) < 8 && Math.abs(dx) < 8) return
        // 세로·아래 방향이고 안쪽 스크롤이 맨 위일 때만 시트 드래그. 그 외(가로·위로·스크롤 중)는 기본 동작.
        st.mode = Math.abs(dy) > Math.abs(dx) && dy > 0 && (!st.scroller || st.scroller.scrollTop <= 0) ? 'y' : 'skip'
        if (st.mode === 'skip') return
        st.baseY = p.clientY // 판정 거리만큼 튀지 않게
      }
      if (e.cancelable) e.preventDefault()
      st.dist = Math.max(0, p.clientY - st.baseY)
      const el = panelRef.current
      if (el) { el.style.transition = 'transform 0s'; el.style.transform = `translateY(${st.dist}px)` }
    }
    const onEnd = () => {
      if (!st) return
      const { mode, dist, threshold } = st
      st = null
      if (mode !== 'y') return
      dragRef.current.draggedAt = Date.now()
      const el = panelRef.current
      if (el) el.style.transition = EASE
      if (dist > threshold) s.closeSurface() // 닫힘은 React 가 translateY(100%)로
      else if (el) el.style.transform = 'translateY(0px)'
    }
    // 드래그 직후의 클릭(버튼 위에서 시작한 경우 등)은 무시.
    const onClickCapture = (e: MouseEvent) => {
      if (dragRef.current.draggedAt && Date.now() - dragRef.current.draggedAt < 400) { e.stopPropagation(); e.preventDefault() }
    }
    layer.addEventListener('touchstart', onStart, { passive: true })
    layer.addEventListener('touchmove', onMove, { passive: false })
    layer.addEventListener('touchend', onEnd)
    layer.addEventListener('touchcancel', onEnd)
    layer.addEventListener('click', onClickCapture, true)
    return () => {
      layer.removeEventListener('touchstart', onStart)
      layer.removeEventListener('touchmove', onMove)
      layer.removeEventListener('touchend', onEnd)
      layer.removeEventListener('touchcancel', onEnd)
      layer.removeEventListener('click', onClickCapture, true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mobile])

  // 드래그 직후 400ms 는 마스크 닫기 무시(끌다 놓은 손이 마스크 위였던 경우).
  const mask = useMaskClose(() => s.closeSurface(), () => {
    const recent = !!dragRef.current.draggedAt && Date.now() - dragRef.current.draggedAt < 400
    if (recent) dragRef.current.draggedAt = 0
    return recent
  })

  const title = sf.kind === 'pv' ? '연출 설정' : sf.kind === 'bm' ? '북마크' : (sf.item?.name || sf.item?.id || '')
  const sub = sf.kind === 'pv' ? '미리보기 연출' : sf.kind === 'bm' ? '간이 가방' : sf.kind === 'dot' ? '점 위치 · 염색' : (sf.item && s.isMixSlot(sf.item.slot) ? '염색 · 발색' : '염색')

  // 패널 폭(앱 영역 기준)·등장/닫힘 위치는 즉시 반영 값이라 인라인(드래그 중 오프셋은 위 터치 핸들러가 DOM 직접).
  const panelStyle: React.CSSProperties = mobile
    ? { transform: `translateY(${hidden ? '100%' : '0px'})`, transition: EASE }
    : { width: `min(900px, ${Math.max(320, frameW - 40)}px)` }

  return (
    <div className={styles.layer}>
      <div
        ref={overlayRef}
        className={clsx(styles.overlay, mobile && styles.overlayM, hidden && styles.overlayHidden)}
        {...mask}>
        <div role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}
          ref={panelRef}
          onPointerDown={(e) => e.stopPropagation()}
          className={clsx(mobile ? styles.panelM : styles.panel, mobile ? tall && styles.panelMTall : tall && styles.panelTall, !mobile && hidden && styles.panelHidden)}
          style={panelStyle}>
          {mobile && (
            <div title="아래로 끌어 닫기" data-sheet-handle className={styles.handle}>
              <span className={styles.handleBar} />
            </div>
          )}
          <div className={styles.head}>
            <div className={styles.headL}>
              <span className={styles.title}>{title}</span>
              <span className={styles.sub}>{sub}</span>
            </div>
            <button type="button" onClick={s.closeSurface} title="닫기 (Esc)" aria-label="닫기" className={clsx('pb-icon', styles.close)}><IconClose /></button>
          </div>
          {sf.kind === 'pv' && <PvSheetBody />}
          {sf.kind === 'bm' && <BookmarkSheetBody />}
          {sf.kind === 'dye' && sf.item && <DyeSurfaceBody item={sf.item} mobile={mobile} />}
          {sf.kind === 'dot' && sf.item && <DotSurfaceBody item={sf.item} mobile={mobile} />}
        </div>
      </div>
    </div>
  )
}

export function SurfaceFooter({ onApply }: { onApply: () => void }) {
  const s = useShop()
  return (
    <div className={styles.foot}>
      <button type="button" onClick={s.closeSurface} className={clsx('pb-ghost', styles.btnClose)}>닫기</button>
      <button type="button" onClick={onApply} className={clsx('pb-solid', styles.btnApply)}>적용</button>
    </div>
  )
}
