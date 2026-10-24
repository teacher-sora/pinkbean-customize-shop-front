'use client'

// 하단 부위 바(전체·신규·즐겨찾기 + 18부위) + 탭 바(6탭). 부위 바는 AI 코디 검색에서도 결과 필터로 작동한다.
// 모바일의 코디 · AI 코디 검색은 부위를 하단이 아니라 목록 머리 첫 줄(CatTabsM)에 둔다 — 하단 탭 바와 붙어 있어 잘못 눌렸다(사용자 지시).

import clsx from 'clsx'
import { useEffect } from 'react'
import { PLAZA_FILTERS } from '@/lib/plaza'
import { useShop } from '../ShopContext'
import { IconTab } from '../ui/Icons'
import { useWheelRail } from '../ui/useWheelRail'
import styles from './nav.module.css'

const MULTI = [{ id: 'all', label: '전체' }, { id: 'new', label: '신규' }, { id: 'fav', label: '즐겨찾기' }]
export const TABS = [
  { id: 'codi', label: '코디', short: '코디' },
  { id: 'search', label: 'AI 코디 검색', short: 'AI 검색' },
  { id: 'info', label: '코디 정보 / 염색', short: '정보 / 염색' }, // 모바일 = PC 와 같은 뜻, 구분자 옆은 좁은 공백(thin space — 사용자 지시)
  { id: 'preset', label: '프리셋', short: '프리셋' },
  { id: 'share', label: '코디 광장', short: '광장' },
  { id: 'notice', label: '도움 및 건의함', short: '도움' },
]
const READY = new Set(['codi', 'search', 'info', 'preset', 'share'])

// 모바일 목록 머리의 부위 탭(밑줄 탭). 미리보기 위 둥근 버튼들과 다른 모양이라 '이 목록에서 무엇을 볼지'로 읽힌다.
// 부위를 바꾸면(다른 곳에서 바뀌어도) 고른 탭이 보이도록 가로로 당겨 온다.
export function CatTabsM() {
  const s = useShop()
  const railRef = useWheelRail()
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
      {[...MULTI, ...s.cats].map((p) => {
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
  const railRef = useWheelRail()
  // 코디 광장은 부위 대신 광장 분류(전체·대회·내 등록·찜한 코디)를 쓴다. 항목이 4개뿐이라 양끝 페이드는 끈다
  // (요소는 그대로 두고 opacity 만 0 — 탭을 오갈 때 전환이 끊기지 않게).
  const plaza = s.primary === 'share'
  const chips = plaza
    ? PLAZA_FILTERS.map((f) => ({ id: f.id as string, label: f.label, on: s.plazaFilter === f.id, pick: () => s.setPlazaFilter(f.id) }))
    : [...MULTI, ...s.cats].map((p) => ({ id: p.id, label: p.label, on: s.activeCat === p.id, pick: () => pickPart(p.id) }))
  // 코디 정보 / 염색 · 프리셋에서 부위를 바꾸면 그 부위의 아이템을 보려는 것이다 — 코디 탭으로 넘어가 바로 보인다(사용자 지시).
  const pickPart = (id: string) => {
    s.setActiveCat(id)
    if (s.primary === 'info' || s.primary === 'preset') s.setPrimary('codi')
  }
  const pickTab = (t: { id: string; label: string }) => {
    if (READY.has(t.id)) { s.setPrimary(t.id); return }
    if (t.id === 'notice') { s.openNotice(); return } // 도움 및 건의함는 탭 화면 없이 서피스로 연다(간이)
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
