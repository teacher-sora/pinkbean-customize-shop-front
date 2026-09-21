'use client'

// 하단 부위 바(전체·즐겨찾기 + 16부위) + 탭 바(6탭). 부위 바는 AI 코디 검색에서도 결과 필터로 작동한다.

import clsx from 'clsx'
import { useCallback, useEffect, useRef, useState } from 'react'
import { CATS } from '@/lib/catalog'
import { PLAZA_FILTERS } from '@/lib/plaza'
import { useShop } from '../ShopContext'
import { IconTab } from '../ui/Icons'
import styles from './nav.module.css'

const PARTS = [{ id: 'all', label: '전체' }, { id: 'new', label: '신규' }, { id: 'fav', label: '즐겨찾기' }, ...CATS]
export const TABS = [
  { id: 'codi', label: '코디' },
  { id: 'search', label: 'AI 코디 검색' },
  { id: 'info', label: '코디 정보 · 염색' },
  { id: 'preset', label: '프리셋' },
  { id: 'share', label: '코디 광장' },
  { id: 'notice', label: '공지 및 건의함' },
]
const READY = new Set(['codi', 'search', 'info', 'preset', 'share'])

// 가로 레일: 휠 → 가로 스크롤(rAF 보간), 양끝 페이드는 스크롤 위치로 표시.
// ⚠️ 레일은 CSS scroll-behavior:smooth 라 휠마다 scrollLeft += d 를 넣으면 진행 중인 스무스 스크롤이 중간 위치에서
//    매번 다시 시작돼 거리가 깎이고 뻑뻑하게 끊긴다 → 목표 위치를 누적하고 rAF 로 직접 보간(scrollTo instant).
function useRail() {
  const railRef = useRef<HTMLElement | null>(null)
  const [edge, setEdge] = useState({ l: false, r: true })
  const sync = useCallback(() => {
    const el = railRef.current; if (!el) return
    const max = el.scrollWidth - el.clientWidth
    const next = { l: el.scrollLeft > 4, r: max > 4 && el.scrollLeft < max - 4 }
    setEdge((e) => (e.l === next.l && e.r === next.r ? e : next))
  }, [])
  useEffect(() => {
    const el = railRef.current; if (!el) return
    let target = el.scrollLeft, raf = 0
    const tick = () => {
      const cur = el.scrollLeft
      const diff = target - cur
      if (Math.abs(diff) < 0.5) { el.scrollTo({ left: target, behavior: 'instant' as ScrollBehavior }); raf = 0; return }
      el.scrollTo({ left: cur + diff * 0.2, behavior: 'instant' as ScrollBehavior })
      raf = requestAnimationFrame(tick)
    }
    const onWheel = (e: WheelEvent) => {
      const max = el.scrollWidth - el.clientWidth
      if (max < 2) return
      let d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY
      if (!d) return
      if (e.deltaMode === 1) d *= 16; else if (e.deltaMode === 2) d *= el.clientWidth
      e.preventDefault()
      if (!raf) target = el.scrollLeft // 멈춰 있을 땐 실제 위치(터치 드래그 등으로 바뀌었을 수 있음)에서 시작
      target = Math.max(0, Math.min(max, target + d))
      if (!raf) raf = requestAnimationFrame(tick)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    el.addEventListener('scroll', sync, { passive: true })
    sync()
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(sync) : null
    ro?.observe(el)
    return () => { cancelAnimationFrame(raf); el.removeEventListener('wheel', onWheel); el.removeEventListener('scroll', sync); ro?.disconnect() }
  }, [sync])
  return { railRef, edge }
}

export default function BottomNav({ mobile }: { mobile: boolean }) {
  const s = useShop()
  const { railRef, edge } = useRail()
  // 코디 광장은 부위 대신 광장 분류(전체·대회·내 등록·찜한 코디)를 쓴다. 항목이 4개뿐이라 양끝 페이드는 끈다
  // (요소는 그대로 두고 opacity 만 0 — 탭을 오갈 때 전환이 끊기지 않게).
  const plaza = s.primary === 'share'
  const chips = plaza
    ? PLAZA_FILTERS.map((f) => ({ id: f.id as string, label: f.label, on: s.plazaFilter === f.id, pick: () => s.setPlazaFilter(f.id) }))
    : PARTS.map((p) => ({ id: p.id, label: p.label, on: s.activeCat === p.id, pick: () => s.setActiveCat(p.id) }))
  const fadeOn = (side: boolean) => !plaza && side
  const pickTab = (t: { id: string; label: string }) => {
    if (READY.has(t.id)) { s.setPrimary(t.id); return }
    if (t.id === 'notice') { s.openNotice(); return } // 공지 및 건의함은 탭 화면 없이 서피스로 연다(간이)
    s.notify(`${t.label}은 아직 준비 중이에요!`)
  }

  if (mobile) {
    return (
      <>
        <div className={styles.partNavM}>
          <nav ref={railRef} className={clsx('pb-norail', styles.railM)} aria-label={plaza ? '분류' : '부위'}>
            {chips.map((c) => (
              <button key={c.id} type="button" onClick={c.pick} title={c.label}
                className={clsx(c.on ? 'pb-solid' : 'pb-soft', styles.partM, plaza && styles.partWideM, c.on && styles.partOn)}>{c.label}</button>
            ))}
          </nav>
          <div className={clsx(styles.fadeL, styles.fadeM, fadeOn(edge.l) && styles.fadeShow)} />
          <div className={clsx(styles.fadeR, styles.fadeM, fadeOn(edge.r) && styles.fadeShow)} />
        </div>
        <nav className={styles.tabNavM} aria-label="메뉴">
          {TABS.map((t) => {
            const on = s.primary === t.id
            return (
              <button key={t.id} type="button" onClick={() => pickTab(t)} title={t.label} aria-label={t.label} className={clsx(!on && 'pb-icon', styles.tabM, on && styles.tabMOn)}>
                <IconTab id={t.id} size={21} />
              </button>
            )
          })}
        </nav>
      </>
    )
  }

  return (
    <div className={styles.bottom}>
      <div className={clsx('pb-partnav', styles.partNav)}>
        <nav ref={railRef} className={clsx('pb-norail', styles.rail)} aria-label={plaza ? '분류' : '부위'}>
          {chips.map((c) => (
            <button key={c.id} type="button" onClick={c.pick} title={c.label}
              className={clsx(c.on ? 'pb-solid' : 'pb-soft', styles.part, c.on && styles.partOn)}>{c.label}</button>
          ))}
        </nav>
        <div className={clsx(styles.fadeL, fadeOn(edge.l) && styles.fadeShow)} />
        <div className={clsx(styles.fadeR, fadeOn(edge.r) && styles.fadeShow)} />
        <div className={styles.partLine} />
      </div>
      <div className={styles.tabBox}>
        <nav className={clsx('pb-tabnav', styles.tabNav)} aria-label="메뉴">
          {TABS.map((t) => {
            const on = s.primary === t.id
            return (
              <button key={t.id} type="button" onClick={() => pickTab(t)} title={t.label} className={clsx(on ? 'pb-solid' : 'pb-soft', styles.tab, on && styles.tabOn)}>
                <IconTab id={t.id} size={15} />
                <span>{t.label}</span>
              </button>
            )
          })}
        </nav>
      </div>
    </div>
  )
}
