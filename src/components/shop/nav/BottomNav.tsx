'use client'

// 하단 부위 바(전체·신규·즐겨찾기 + 18부위) + 탭 바(6탭). 부위 바는 AI 코디 검색에서도 결과 필터로 작동한다.
// 모바일은 부위 · 광장 분류를 하단이 아니라 목록 머리 첫 줄(CatTabsM · PlazaTabsM)에 둔다 — 하단 탭 바와 붙어 있어 잘못 눌렸다(사용자 지시).

import clsx from 'clsx'
import { useEffect, useRef, useState } from 'react'
import { PLAZA_FILTERS, type PlazaFilter } from '@/lib/plaza'
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

// 모바일 목록 머리의 분류 탭(밑줄 탭). 미리보기 위 둥근 버튼들과 다른 모양이라 '이 목록에서 무엇을 볼지'로 읽힌다.
// 고른 것이 바뀌면(다른 곳에서 바뀌어도) 고른 탭이 보이도록 가로로 당겨 온다. 코디 탭의 부위(CatTabsM)와 광장 분류(PlazaTabsM)가 같은 부품이다
function TabsM({ label, items, on, pick }: { label: string; items: { id: string; label: string }[]; on: string; pick: (id: string) => void }) {
  const railRef = useWheelRail()
  useEffect(() => {
    const el = railRef.current
    const cur = el?.querySelector<HTMLElement>('[aria-pressed="true"]')
    if (!el || !cur) return
    const l = cur.offsetLeft - 8, r = cur.offsetLeft + cur.offsetWidth + 8
    if (l < el.scrollLeft) el.scrollTo({ left: l })
    else if (r > el.scrollLeft + el.clientWidth) el.scrollTo({ left: r - el.clientWidth })
  }, [on, railRef])
  return (
    <nav ref={railRef} className={clsx('pb-norail', 'pb-fade', styles.catTabsM)} aria-label={label}>
      {items.map((p) => {
        const sel = on === p.id
        return (
          <button key={p.id} type="button" onClick={() => pick(p.id)} aria-pressed={sel} title={p.label}
            className={clsx(styles.catTabM, sel && styles.catTabMOn)}>{p.label}</button>
        )
      })}
    </nav>
  )
}
// 부위. jump = 코디 정보 / 염색 · 프리셋 탭에서 쓸 때 — 부위를 누르면 그 부위의 아이템을 보려는 것이라 코디 탭으로 넘어간다(하단 줄에 있던 때와 같다)
export function CatTabsM({ jump }: { jump?: boolean } = {}) {
  const s = useShop()
  return <TabsM label="부위" items={[...MULTI, ...s.cats]} on={s.activeCat} pick={(id) => { s.setActiveCat(id); if (jump) s.setPrimary('codi') }} />
}
// 코디 광장 분류(자유 코디 ~ 코디 룩북) — 모바일은 코디 탭의 부위처럼 미리보기와 목록 머리 사이에 둔다(사용자 지시, PinkbeanShop)
export function PlazaTabsM() {
  const s = useShop()
  return <TabsM label="분류" items={PLAZA_FILTERS} on={s.plazaFilter} pick={(id) => s.setPlazaFilter(id as PlazaFilter)} />
}

// 모바일 하단 탭 숨기기(사용자 지시 — 유튜브의 아래 탭처럼): 페이지를 아래로 내리면 화면 아래로 숨고, 위로 올리면 다시 나온다.
// 맨 위에서, 그리고 맨 아래까지 탭 높이만큼 남은 곳부터는 늘 보인다 — 맨 아래에 닿아야 나오면 탭 자리 위의 것(코디 정보 / 염색의 아래 칸)을
// 누르려는데 내리던 끝에 탭이 사라져 있어 곤란했다(사용자 지적). 문서 스크롤만 본다(목록 안 가로 · 세로 넘기기는 해당 없음). 움직임은 transform 뿐(nav.module.css .tabNavHide)
// over = 카드 목록 탭(코디 · AI 코디 검색 · 프리셋 · 광장): 탭이 자리를 차지하지 않고 목록 위에 뜬다(.tabNavOver). 맨 아래 = 붙은 미리보기 아래에
// 3줄이 다 보이는 자리라(ListArea useMobileRows) 맨 아래 규칙을 두지 않는다 — 두면 셋째 줄의 [북마크 · 염색]을 덮는다. 위로 올리면 나온다
const HIDE_DELTA = 8 // 이만큼 이어서 움직여야 바꾼다(손가락 떨림 · 주소창 접힘으로 깜빡이지 않게)
// frozen = 창(시트 · 다이얼로그)이 떠 있다 — 그동안은 스크롤을 보지 않고 그대로 둔다. 시트는 뒤 페이지를 position:fixed 로 고정해 스크롤이 0 이 됐다가
// 닫을 때 제자리로 돌아가는데, 그것을 '맨 위로 올림' · '내림'으로 읽어 탭이 나타났다 사라졌다(연출 설정 — 사용자 지적). 풀리면 지금 위치에서 다시 센다.
function useHideOnScroll(on: boolean, navRef: React.RefObject<HTMLElement | null>, frozen: boolean, over: boolean): boolean {
  const [hidden, setHidden] = useState(false)
  useEffect(() => {
    if (!on) { setHidden(false); return }
    if (frozen) return
    let last = window.scrollY, acc = 0, raf = 0
    const check = () => {
      raf = 0
      const y = window.scrollY, d = y - last
      last = y
      const end = !over && y + window.innerHeight >= document.documentElement.scrollHeight - (navRef.current?.offsetHeight ?? 0) - 2
      if (y <= 0 || end) { acc = 0; setHidden(false); return }
      acc = Math.sign(d) === Math.sign(acc) ? acc + d : d
      if (acc > HIDE_DELTA) setHidden(true)
      else if (acc < -HIDE_DELTA) setHidden(false)
    }
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(check) }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => { window.removeEventListener('scroll', onScroll); if (raf) cancelAnimationFrame(raf) }
  }, [on, navRef, frozen, over])
  return hidden
}

export default function BottomNav({ mobile }: { mobile: boolean }) {
  const s = useShop()
  const railRef = useWheelRail()
  const navRef = useRef<HTMLElement | null>(null)
  const over = s.primary !== 'info' // 카드 목록 탭은 목록 위에 뜬다(useHideOnScroll 위 주석)
  const navHidden = useHideOnScroll(mobile, navRef, !!s.surface, over)
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
    // 부위 · 광장 분류는 목록 머리 위(CatTabsM · PlazaTabsM)에 있다(사용자 지시) — 모바일 하단은 탭 바만
    return (
      <>
        <nav ref={navRef} data-hero-below className={clsx(styles.tabNavM, over && styles.tabNavOver, navHidden && styles.tabNavHide)} aria-label="메뉴">
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
