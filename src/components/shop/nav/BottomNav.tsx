'use client'

// 하단 부위 바(전체·신규·즐겨찾기 + 18부위) + 탭 바(6탭). 부위 바는 AI 코디 검색에서도 결과 필터로 작동한다.
// 모바일은 부위 · 광장 분류를 하단이 아니라 목록 머리 첫 줄(CatTabsM · PlazaTabsM)에 둔다 — 하단 탭 바와 붙어 있어 잘못 눌렸다(사용자 지시).

import clsx from 'clsx'
import { useEffect, useRef } from 'react'
import { PLAZA_FILTERS, type PlazaFilter } from '@/lib/plaza'
import { useShop } from '../ShopContext'
import { installScrollLink, setScrollFrozen } from '@/lib/scrollHide'
import { CAT_FIXED, CatExpand } from './CatPicker'
import { IconTab } from '../ui/Icons'
import { useWheelRail } from '../ui/useWheelRail'
import styles from './nav.module.css'

export const TABS = [
  { id: 'codi', label: '코디', short: '코디' },
  { id: 'search', label: 'AI 코디 검색', short: 'AI 검색' },
  { id: 'info', label: '코디 정보 / 염색', short: '정보 / 염색' }, // 모바일 = PC 와 같은 뜻, 구분자 옆은 좁은 공백(thin space — 사용자 지시)
  { id: 'preset', label: '프리셋', short: '프리셋' },
  { id: 'share', label: '코디 광장', short: '광장' },
  { id: 'notice', label: '도움 및 건의함', short: '도움' },
]
const READY = new Set(['codi', 'search', 'info', 'preset', 'share'])

// 고른 칩이 줄 밖에 있으면 보이도록 줄을 당겨 온다(다른 곳 — 펼친 창 · 같은 부위 다시 누르기 — 에서 바뀌어도). 처음 붙을 때는 바로, 그 뒤로는 부드럽게
// (사용자 지시 — 같은 부위를 다시 눌러 전체로 돌아가면 줄이 맨 앞까지 자연스럽게 흘러가야 한다). 모바일 부위 줄 · 광장 분류 · PC 하단 줄이 같이 쓴다
function useRevealOn(railRef: React.RefObject<HTMLElement | null>, on: string | undefined) {
  const first = useRef(true)
  useEffect(() => {
    const el = railRef.current
    const cur = el?.querySelector<HTMLElement>('[aria-pressed="true"]')
    const smooth = !first.current
    first.current = false
    if (!el || !cur) return
    const l = cur.offsetLeft - 8, r = cur.offsetLeft + cur.offsetWidth + 8
    const behavior: ScrollBehavior = smooth ? 'smooth' : 'auto'
    if (l < el.scrollLeft) el.scrollTo({ left: l, behavior })
    else if (r > el.scrollLeft + el.clientWidth) el.scrollTo({ left: r - el.clientWidth, behavior })
  }, [on, railRef])
}
// 고른 부위를 다시 누르면 전체로 돌아간다(사용자 지시 — 한벌옷을 보다가 한벌옷을 누르면 전체). 줄 · 펼친 창 어디서든 같다
const nextCat = (id: string, cur: string) => (id === cur && id !== 'all' ? 'all' : id)
// 코디 룩북이 열린 코디 탭(AI 코디 검색도 같다)에서 지금 부위나 지금 탭을 다시 누르면 한 단계 뒤로(사용자 지시 — Esc · [←] 과 같다: 상세 → 룩북 목록, 룩북 목록 → 아이템 목록)
const comboBack = (s: ReturnType<typeof useShop>) => {
  if (!s.comboShown || s.primary === 'share') return false // 광장의 코디 룩북은 분류다(닫는 것이 없다)
  if (s.comboDetail) s.setComboDetail(null); else s.closeCombo()
  return true
}
// 부위를 누를 때: 룩북이 열려 있으면 지금 부위 = 한 단계 뒤로, 다른 부위 = 룩북을 닫고 그 부위 목록으로. 아니면 지금 부위를 다시 누르면 전체로(nextCat)
const pickCat = (s: ReturnType<typeof useShop>, id: string) => {
  if (id === s.activeCat && comboBack(s)) return
  if (s.comboShown && s.primary !== 'share') { s.closeCombo(); s.setActiveCat(id); return }
  s.setActiveCat(nextCat(id, s.activeCat))
}

// 모바일 목록 머리의 분류 탭(밑줄 탭). 미리보기 위 둥근 버튼들과 다른 모양이라 '이 목록에서 무엇을 볼지'로 읽힌다.
// 고른 것이 바뀌면(다른 곳에서 바뀌어도) 고른 탭이 보이도록 가로로 당겨 온다. 코디 탭의 부위(CatTabsM)와 광장 분류(PlazaTabsM)가 같은 부품이다
function TabsM({ label, items, on, pick, end }: { label: string; items: { id: string; label: string }[]; on: string; pick: (id: string) => void; end?: React.ReactNode }) {
  const railRef = useWheelRail()
  useRevealOn(railRef, on)
  const rail = (
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
  return end ? <div className={styles.catRowM}>{rail}{end}</div> : rail
}
// 부위. jump = 코디 정보 / 염색 · 프리셋 탭에서 쓸 때 — 부위를 누르면 그 부위의 아이템을 보려는 것이라 코디 탭으로 넘어간다(하단 줄에 있던 때와 같다).
// 그때는 같은 부위를 눌러도 전체로 돌리지 않는다 — 목록이 안 보이는 탭에서 누른 것은 그 부위를 보러 가는 것이다
export function CatTabsM({ jump }: { jump?: boolean } = {}) {
  const s = useShop()
  const pick = (id: string) => { if (jump) { s.setActiveCat(id); s.setPrimary('codi') } else pickCat(s, id) }
  return <TabsM label="부위" items={[...CAT_FIXED, ...s.catBar]} on={s.activeCat} pick={pick} end={<CatExpand mobile on={s.activeCat} onPick={pick} />} />
}
// 코디 광장 분류(자유 코디 ~ 코디 룩북) — 모바일은 코디 탭의 부위처럼 미리보기와 목록 머리 사이에 둔다(사용자 지시, PinkbeanShop)
export function PlazaTabsM() {
  const s = useShop()
  return <TabsM label="분류" items={PLAZA_FILTERS} on={s.plazaFilter} pick={(id) => s.setPlazaFilter(id as PlazaFilter)} />
}

// 모바일 부위 · 분류 줄과 목록 머리를 묶어 미리보기 바로 아래에 둔다. 붙지도 접히지도 않고 미리보기 · 목록과 한 흐름의 같은 층이다(사용자 지시 —
// 붙여 두었더니 목록 위 층이 되어 목록이 그 밑으로 들어갔고, 접고 펼치는 것은 답답했다). 목록 화면은 페이지가 헤더 높이만큼만 내려가 늘 다 보인다.
// data-sticky-top = 목록 칸 맞춤(ListArea useMobileRows)이 이 높이를 뺀다
export function StickyBarM({ children }: { children: React.ReactNode }) {
  return <div data-sticky-top className={styles.barM}>{children}</div>
}

export default function BottomNav({ mobile }: { mobile: boolean }) {
  const s = useShop()
  const railRef = useWheelRail()
  const navRef = useRef<HTMLElement | null>(null)
  useEffect(() => (mobile ? installScrollLink() : undefined), [mobile]) // 하단 탭이 손가락 제스처 방향으로 숨고 나온다(lib/scrollHide)
  useEffect(() => { setScrollFrozen(!!s.surface) }, [s.surface]) // 창이 떠 있는 동안 숨김 상태를 그대로(lib/scrollHide)
  // 코디 광장은 부위 대신 광장 분류(전체·대회·내 등록·찜한 코디)를 쓴다. 항목이 4개뿐이라 양끝 페이드는 끈다
  // (요소는 그대로 두고 opacity 만 0 — 탭을 오갈 때 전환이 끊기지 않게).
  const plaza = s.primary === 'share'
  const chips = plaza
    ? PLAZA_FILTERS.map((f) => ({ id: f.id as string, label: f.label, on: s.plazaFilter === f.id, pick: () => s.setPlazaFilter(f.id) }))
    : [...CAT_FIXED, ...s.catBar].map((p) => ({ id: p.id, label: p.label, on: s.activeCat === p.id, pick: () => pickPart(p.id) }))
  // 고른 칩이 보이도록 줄을 당겨 온다 — 펼친 창에서 줄 밖의 부위를 고를 수 있다
  useRevealOn(railRef, chips.find((c) => c.on)?.id)
  // 코디 정보 / 염색 · 프리셋에서 부위를 바꾸면 그 부위의 아이템을 보려는 것이다 — 코디 탭으로 넘어가 바로 보인다(사용자 지시).
  // 목록이 보이는 탭(코디 · AI 코디 검색)에서 고른 부위를 다시 누르면 전체로(nextCat)
  const pickPart = (id: string) => {
    const jump = s.primary === 'info' || s.primary === 'preset'
    if (!jump) { pickCat(s, id); return }
    s.setActiveCat(id)
    s.setPrimary('codi')
  }
  const pickTab = (t: { id: string; label: string }) => {
    if (t.id === s.primary && comboBack(s)) return
    if (READY.has(t.id)) { s.setPrimary(t.id); return }
    if (t.id === 'notice') { s.openNotice(); return } // 도움 및 건의함는 탭 화면 없이 서피스로 연다(간이)
    s.notify(`${t.label}은 아직 준비 중이에요!`)
  }

  if (mobile) {
    // 부위 · 광장 분류는 목록 머리 위(CatTabsM · PlazaTabsM)에 있다(사용자 지시) — 모바일 하단은 탭 바만
    return (
      <>
        <nav ref={navRef} data-hero-below data-pb-tabnav className={styles.tabNavM} aria-label="메뉴">
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
            <button key={c.id} type="button" onClick={c.pick} title={c.label} aria-pressed={c.on}
              className={clsx(c.on ? 'pb-solid' : 'pb-soft', styles.part, c.on && styles.partOn)}>{c.label}</button>
          ))}
        </nav>
        {!plaza && <CatExpand mobile={false} on={s.activeCat} onPick={pickPart} />}
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
