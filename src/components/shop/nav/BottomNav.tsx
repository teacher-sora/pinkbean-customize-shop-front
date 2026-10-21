'use client'

// 하단 부위 바(전체·신규·즐겨찾기 + 18부위) + 탭 바(6탭). 부위 바는 AI 코디 검색에서도 결과 필터로 작동한다.
// 모바일의 코디 · AI 코디 검색은 부위를 하단이 아니라 목록 머리 첫 줄(CatTabsM)에 둔다 — 하단 탭 바와 붙어 있어 잘못 눌렸다(사용자 지시).

import clsx from 'clsx'
import { useEffect, useRef } from 'react'
import { CATS } from '@/lib/catalog'
import { PLAZA_FILTERS } from '@/lib/plaza'
import { useShop } from '../ShopContext'
import { IconTab } from '../ui/Icons'
import styles from './nav.module.css'

const PARTS = [{ id: 'all', label: '전체' }, { id: 'new', label: '신규' }, { id: 'fav', label: '즐겨찾기' }, ...CATS]
export const TABS = [
  { id: 'codi', label: '코디', short: '코디' },
  { id: 'search', label: 'AI 코디 검색', short: 'AI 검색' },
  { id: 'info', label: '코디 정보 / 염색', short: '염색' },
  { id: 'preset', label: '프리셋', short: '프리셋' },
  { id: 'share', label: '코디 광장', short: '광장' },
  { id: 'notice', label: '공지 및 건의함', short: '공지' },
]
const READY = new Set(['codi', 'search', 'info', 'preset', 'share'])

// 가로 레일: 휠 → 가로 스크롤(rAF 보간). 양끝 흐림은 다른 스크롤 칸과 같은 pb-fade(ui/useScrollFade).
// ⚠️ 레일은 CSS scroll-behavior:smooth 라 휠마다 scrollLeft += d 를 넣으면 진행 중인 스무스 스크롤이 중간 위치에서
//    매번 다시 시작돼 거리가 깎이고 뻑뻑하게 끊긴다 → 목표 위치를 누적하고 rAF 로 직접 보간(scrollTo instant).
function useRail() {
  const railRef = useRef<HTMLElement | null>(null)
  useEffect(() => {
    const el = railRef.current; if (!el) return
    let target = el.scrollLeft, raf = 0
    // ⚠️ scrollLeft 는 정수로 반올림된다. 남은 거리의 20% 가 1px 이 안 되면(남은 거리 < 5px) 그 걸음이 반올림으로 사라져
    //    끝에서 2px 모자란 채 멈췄다 — 양끝 흐림이 끝까지 넘겨도 남았고, 프레임 루프도 멈추지 않았다. 그때는 목표에 바로 붙인다.
    const tick = () => {
      const cur = el.scrollLeft
      const diff = target - cur
      if (Math.abs(diff * 0.2) < 1) { el.scrollTo({ left: target, behavior: 'instant' as ScrollBehavior }); raf = 0; return }
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
    return () => { cancelAnimationFrame(raf); el.removeEventListener('wheel', onWheel) }
  }, [])
  return { railRef }
}

// 모바일 목록 머리의 부위 탭(밑줄 탭). 미리보기 위 둥근 버튼들과 다른 모양이라 '이 목록에서 무엇을 볼지'로 읽힌다.
// 부위를 바꾸면(다른 곳에서 바뀌어도) 고른 탭이 보이도록 가로로 당겨 온다.
export function CatTabsM() {
  const s = useShop()
  const { railRef } = useRail()
  useEffect(() => {
    const el = railRef.current
    const on = el?.querySelector<HTMLElement>('[aria-pressed="true"]')
    if (!el || !on) return
    const l = on.offsetLeft - 8, r = on.offsetLeft + on.offsetWidth + 8
    if (l < el.scrollLeft) el.scrollTo({ left: l })
    else if (r > el.scrollLeft + el.clientWidth) el.scrollTo({ left: r - el.clientWidth })
  }, [s.activeCat, railRef])
  return (
    <nav ref={railRef} className={clsx('pb-norail', 'pb-fade', styles.catTabsM)} aria-label="부위">
      {PARTS.map((p) => {
        const on = s.activeCat === p.id
        return (
          <button key={p.id} type="button" onClick={() => s.setActiveCat(p.id)} aria-pressed={on} title={p.label}
            className={clsx(styles.catTabM, on && styles.catTabMOn)}>{p.label}</button>
        )
      })}
    </nav>
  )
}

export default function BottomNav({ mobile }: { mobile: boolean }) {
  const s = useShop()
  const { railRef } = useRail()
  // 코디 광장은 부위 대신 광장 분류(전체·대회·내 등록·찜한 코디)를 쓴다. 항목이 4개뿐이라 양끝 페이드는 끈다
  // (요소는 그대로 두고 opacity 만 0 — 탭을 오갈 때 전환이 끊기지 않게).
  const plaza = s.primary === 'share'
  const chips = plaza
    ? PLAZA_FILTERS.map((f) => ({ id: f.id as string, label: f.label, on: s.plazaFilter === f.id, pick: () => s.setPlazaFilter(f.id) }))
    : PARTS.map((p) => ({ id: p.id, label: p.label, on: s.activeCat === p.id, pick: () => pickPart(p.id) }))
  // 코디 정보 / 염색 · 프리셋에서 부위를 바꾸면 그 부위의 아이템을 보려는 것이다 — 코디 탭으로 넘어가 바로 보인다(사용자 지시).
  const pickPart = (id: string) => {
    s.setActiveCat(id)
    if (s.primary === 'info' || s.primary === 'preset') s.setPrimary('codi')
  }
  const pickTab = (t: { id: string; label: string }) => {
    if (READY.has(t.id)) { s.setPrimary(t.id); return }
    if (t.id === 'notice') { s.openNotice(); return } // 공지 및 건의함은 탭 화면 없이 서피스로 연다(간이)
    s.notify(`${t.label}은 아직 준비 중이에요!`)
  }

  if (mobile) {
    const listTab = s.primary === 'codi' || s.primary === 'search' // 부위는 목록 머리(CatTabsM)에 있다
    return (
      <>
        {!listTab && <div data-hero-below className={styles.partNavM}>
          <nav ref={railRef} className={clsx('pb-norail', 'pb-fade', styles.railM)} aria-label={plaza ? '분류' : '부위'}>
            {chips.map((c) => (
              <button key={c.id} type="button" onClick={c.pick} title={c.label}
                className={clsx(c.on ? 'pb-solid' : 'pb-soft', styles.partM, plaza && styles.partWideM, c.on && styles.partOn)}>{c.label}</button>
            ))}
          </nav>
        </div>}
        <nav data-hero-below className={styles.tabNavM} aria-label="메뉴">
          {TABS.map((t) => {
            const on = s.primary === t.id
            return (
              <button key={t.id} type="button" onClick={() => pickTab(t)} title={t.label} aria-label={t.label} className={clsx(!on && 'pb-icon', styles.tabM, on && styles.tabMOn)}>
                <IconTab id={t.id} size={19} />
                <span className={styles.tabMLabel}>{t.short}</span>
              </button>
            )
          })}
        </nav>
      </>
    )
  }

  return (
    <div className={styles.bottom} data-pb-body>
      <div className={clsx('pb-partnav', styles.partNav)}>
        <nav ref={railRef} className={clsx('pb-norail', 'pb-fade', styles.rail)} aria-label={plaza ? '분류' : '부위'}>
          {chips.map((c) => (
            <button key={c.id} type="button" onClick={c.pick} title={c.label}
              className={clsx(c.on ? 'pb-solid' : 'pb-soft', styles.part, c.on && styles.partOn)}>{c.label}</button>
          ))}
        </nav>
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
