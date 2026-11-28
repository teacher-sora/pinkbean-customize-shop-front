'use client'

// 모바일 아이템 카드의 이름 줄과, 그 줄을 누르면 뜨는 아이템 시트(서피스 'item').
// 왜(사용자 지시): 카드 하나에 즐겨찾기 · 북마크 · 염색 · 코디 룩북 · 세트가 작은 단추로 몰려 손가락으로 정확히 누르기 어려웠다.
// 그래서 모바일 카드에서 누르는 곳은 둘뿐이다. 그림을 누르면 입고, 아래 이름 줄 전체(높이 36)를 누르면 이 시트가 뜬다.
// 시트에는 할 일을 한 줄에 하나씩 큰 단추(높이 52)로 둔다: 염색 · 북마크 · 즐겨찾기 · 코디 룩북 · 세트.
// 북마크 · 즐겨찾기는 켜고 꺼도 시트가 그대로라 상태가 바로 보이고, 염색 · 세트는 그 창으로 바뀌며, 코디 룩북은 시트를 닫고 목록 자리에 펼친다.
// 시트는 내용 높이만큼이라 위의 미리보기가 보인다. PC 카드는 그대로다(마우스는 작은 단추도 정확히 누른다). 지금 dev 에서만
import clsx from 'clsx'
import type { ListItem } from '@/lib/core/data'
import { DOT_MOVER_IDS, isDyeableSkin } from '@/lib/shopData'
import { COMBO_SKIP, useLookCount } from '@/lib/looks'
import { useShop } from '../ShopContext'
import { IconBookmark, IconCat, IconCheck, IconChevronRight, IconDot, IconDrop, IconMore, IconStar, IconTab } from '../ui/Icons'
import { setEntryOf, useSetTable } from './SetPop'
import styles from './list.module.css'

// 카드 이름 줄 — 줄 전체가 단추. 왼쪽 = 세트 표시(세트일 때), 오른쪽 = 더 보기 점. 이름은 세 칸 격자의 가운데라 표시가 있어도 카드 한가운데다
export function ItemNameRow({ item, name }: { item: ListItem; name: string }) {
  const s = useShop()
  useSetTable()
  const set = !!setEntryOf(item)
  const open = (e: React.MouseEvent) => { e.stopPropagation(); if (s.consumeSwipeClick()) return; s.openItemSheet(item) }
  return (
    <button type="button" onClick={open} aria-haspopup="dialog" aria-label={name} className={clsx(styles.nameM, styles.nameRowM)}>
      <span className={styles.nameRowSet} style={set ? undefined : { visibility: 'hidden' }}><IconCat id="all" size={9} /></span>
      <span className={styles.nameRowText}>{name}</span>
      <span className={styles.nameRowMore}><IconMore size={14} /></span>
    </button>
  )
}

export function ItemSheetBody({ item }: { item: ListItem }) {
  const s = useShop()
  useSetTable()
  const looks = useLookCount(item.id)
  const set = setEntryOf(item)
  const pinned = s.isBookmarked(item.id)
  const fav = s.favorites.has(item.id)
  const dyeable = item.slot === 'skin' ? isDyeableSkin(item.name) : item.dyeMode !== 'none'
  const isDot = DOT_MOVER_IDS.has(item.id)
  const row = (key: string, icon: React.ReactNode, label: string, onClick: () => void, opt: { on?: boolean; val?: string; go?: boolean; fav?: boolean } = {}) => (
    <button key={key} type="button" onClick={onClick} aria-pressed={opt.go ? undefined : !!opt.on}
      className={clsx(styles.itemRow, opt.on && styles.itemRowOn, opt.on && opt.fav && styles.itemRowFav)}>
      <span className={styles.itemRowIco}>{icon}</span>
      <span className={styles.itemRowLabel}>{label}</span>
      {opt.val && <span className={styles.itemRowVal}>{opt.val}</span>}
      <span className={styles.itemRowEnd}>{opt.go ? <IconChevronRight /> : <span style={opt.on ? undefined : { visibility: 'hidden' }}><IconCheck size={14} /></span>}</span>
    </button>
  )
  return (
    <div className={clsx('pb-scroll', styles.itemSheet)}>
      {dyeable && row('dye', isDot ? <IconDot size={18} /> : <IconDrop size={18} />, isDot ? '점 위치' : '염색', () => (isDot ? s.openDot(item) : s.openDye(item)), { go: true })}
      {row('bm', <IconBookmark filled={pinned} />, '북마크', () => s.toggleBookmark(item), { on: pinned })}
      {row('fav', <IconStar size={18} />, '즐겨찾기', () => s.toggleFavorite(item.id), { on: fav, fav: true })}
      {looks > 0 && !COMBO_SKIP.has(item.slot) && row('combo', <IconTab id="codi" size={18} />, '코디 룩북', () => { s.closeSurface(); s.openCombo(item) }, { go: true, val: `${looks.toLocaleString()}벌` })}
      {set && row('set', <IconCat id="all" size={15} />, '세트', () => s.openSetSheet(item), { go: true, val: `${set.members.length}개` })}
    </div>
  )
}
