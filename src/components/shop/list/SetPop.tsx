'use client'

// 세트 보기(사용자 지시 — 모자 탭에서 아이템을 보다가 그 세트를 검색 칸 없이 바로, 이름과 그림만 미니멀하게).
// 카드 막대의 [세트] 를 누르면 그 카드 위나 아래에 작은 창(preview/PopBox — 카테고리 펼치기 · 연출 설정 고르기와 같은 창)이 뜬다.
//  · 세트 구성원은 catalog/set-members.json(lib/core/data loadSetMembers — 처음 열 때만 받는다). 묶음 · 순서는 목록의 세트 모으기(lib/setOrder)와 같다.
//  · 칸 = 그림(북마크 칸과 같은 부품 BookmarkSprite) + 이름. 누른 카드의 아이템은 분홍 테두리. 보기만 한다(누르는 동작이 없다).
//  · 창은 하나다(SetPopHost — 목록이 한 번 둔다). 카드는 openSet 으로 부른다. 바깥 누름 · Esc · 목록 스크롤에 닫힌다.
import clsx from 'clsx'
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { loadSetMembers, setOf, type ListItem, type SetEntry } from '@/lib/core/data'
import { viewH, viewW } from '@/lib/viewport'
import { useShop } from '../ShopContext'
import { PopBox, popNear, usePop, type PopPos } from '../preview/PopBox'
import { BookmarkSprite } from '../preview/PreviewParts'
import styles from './list.module.css'

type Req = { item: ListItem; rect: DOMRect; at: number }
let cur: Req | null = null
const subs = new Set<() => void>()
const sub = (f: () => void) => { subs.add(f); return () => { subs.delete(f) } }
export function openSet(item: ListItem, el: HTMLElement) { cur = { item, rect: el.getBoundingClientRect(), at: performance.now() }; subs.forEach((f) => f()) }

const SET_W = 420 // PC 창 폭 — 두 열, 이름이 열 글자 남짓 보이게
const SIDE_M = 12 // 모바일 좌우 끝 = 카드 끝(카테고리 펼치기와 같다)
function place(r: DOMRect, mobile: boolean): PopPos {
  const vw = viewW(), p = popNear(r, { left: 0, width: vw, top: 0, bottom: viewH() })
  const w = mobile ? vw - SIDE_M * 2 : Math.min(SET_W, vw - 20)
  const left = mobile ? SIDE_M : Math.round(Math.min(Math.max(10, r.left + r.width / 2 - w / 2), vw - w - 10))
  return { ...p, w, left, fit: true }
}
// 헤어는 끝자리, 성형은 백의 자리가 색 — 같은 색 묶음이면 같은 아이템으로 본다
const colorBase = (id: string, slot: string) => { const step = slot === 'hair' ? 1 : slot === 'face' ? 100 : 0; if (!step) return id; const n = Number(id); return String(n - (Math.floor(n / step) % 10) * step) }

export function SetPopHost({ mobile }: { mobile: boolean }) {
  const s = useShop()
  const req = useSyncExternalStore(sub, () => cur, () => null)
  const pop = usePop()
  const [set, setSet] = useState<{ entry: SetEntry; item: ListItem } | null>(null)
  const closedAt = useRef<{ id: string; t: number } | null>(null)
  const live = useRef(pop); live.current = pop
  useEffect(() => {
    if (!req) return
    // 열린 창의 [세트] 를 다시 누르면 닫는다 — 누르는 순간 바깥 누름으로 이미 닫혔으므로 다시 열지 않는다
    const c = closedAt.current
    if (c && c.id === req.item.id && req.at - c.t < 400) { closedAt.current = null; return }
    let on = true
    loadSetMembers().then((t) => {
      if (!on) return
      const entry = setOf(t, req.item)
      if (!entry) { s.notify('세트 정보가 없어요'); return }
      setSet({ entry, item: req.item }); live.current.open(place(req.rect, mobile))
    })
    return () => { on = false }
  }, [req]) // eslint-disable-line react-hooks/exhaustive-deps -- 부를 때마다 한 번
  // 닫힐 때 무엇이 언제 닫혔는지 적어 둔다(위 '다시 누르면 닫기')
  useEffect(() => { if (!pop.shown && set) closedAt.current = { id: set.item.id, t: performance.now() } }, [pop.shown]) // eslint-disable-line react-hooks/exhaustive-deps
  // 목록이 움직이면(쪽 넘김 · 스크롤) 창이 카드와 어긋나므로 닫는다. 창 안의 스크롤은 그대로
  useEffect(() => {
    if (!pop.shown) return
    const onScroll = (e: Event) => { const box = document.querySelector(`.${styles.setPop}`); if (!(e.target instanceof Node && box?.contains(e.target))) live.current.close() }
    window.addEventListener('scroll', onScroll, { capture: true, passive: true })
    return () => window.removeEventListener('scroll', onScroll, { capture: true } as EventListenerOptions)
  }, [pop.shown])
  if (!set) return null
  const me = colorBase(set.item.id, set.item.slot)
  return (
    <PopBox pop={pop} label="세트" className={styles.setPop}>
      <div className={styles.setHead}>
        <span className={styles.setTitle}>{set.entry.name}</span>
        <span className={styles.setCount}>{set.entry.members.length}개</span>
      </div>
      <div className={clsx('pb-scroll', 'pb-fade', styles.setBody)}>
        <div className={styles.setGrid}>
          {set.entry.members.map((m) => (
            <div key={m.id} title={m.name} className={clsx(styles.setCell, colorBase(m.id, m.slot) === me && styles.setCellOn)}>
              <div className={styles.setSprite}><BookmarkSprite item={{ id: m.id, slot: m.slot, name: m.name, icon: m.icon || undefined } as ListItem} /></div>
              <span className={styles.setName}>{m.name}</span>
            </div>
          ))}
        </div>
      </div>
    </PopBox>
  )
}
