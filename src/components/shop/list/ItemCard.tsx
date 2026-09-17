'use client'

import clsx from 'clsx'
import { badgeUrl, type ListItem } from '@/lib/core/data'
import { DOT_MOVER_IDS, SLOT_TO_CAT, isColorLineSkin } from '@/lib/shopData'
import ItemThumb from '../ItemThumb'
import { isMultiCat, useShop, type ListMode } from '../ShopContext'
import { IconStar } from '../ui/Icons'
import type { ThumbCtx } from './thumbCtx'
import styles from './list.module.css'

// 헤어/성형/피부는 전부 캐시라 캐시 배지가 정보 가치 없음 → 숨김(라벨은 예외 유지).
const NO_CASH_BADGE = new Set(['hair', 'face', 'skin'])

export default function ItemCard({ item, cat, mode, ctx, mobile }: {
  item: ListItem; cat: string; mode: ListMode; ctx: ThumbCtx; mobile: boolean
}) {
  const s = useShop()
  const name = item.name || item.id
  const sel = s.isEquippedInCat(cat, item.id)
  const fav = s.favorites.has(item.id)
  const pinned = s.isBookmarked(item.id)
  const isSkinItem = item.slot === 'skin'
  // 피부는 원칙적으로 염색 불가지만, "컬러라인" 커스텀 피부는 라인만 HSB 로 염색 가능.
  const dyeable = isSkinItem ? isColorLineSkin(item.name) : item.dyeMode !== 'none'
  const isDot = DOT_MOVER_IDS.has(item.id)
  const badgeKind: 'master' | 'special' | 'cash' | null =
    item.label ? item.label : (item.isCash && !NO_CASH_BADGE.has(item.slot)) ? 'cash' : null

  const equip = () => { if (s.consumeSwipeClick()) return; s.equipFromCat(cat, item) }
  // 누르는 순간(클릭보다 먼저) 착용에 필요한 메타·스프라이트를 받기 시작 → 착용 반영 대기 단축.
  const warm = () => s.warmForPreview(item)
  const pin = (e: React.MouseEvent) => { e.stopPropagation(); s.toggleBookmark(item) }
  // 염색 버튼은 착용을 바꾸지 않는다(§10.7). 사소한 변경점/쩜은 점 위치 전용 다이얼로그.
  const dye = (e: React.MouseEvent) => { e.stopPropagation(); if (isDot) s.openDot(item); else s.openDye(item) }

  return (
    <div onClick={equip} onPointerDown={warm} className="pb-cardwrap" title={name}>
      <div className={clsx('pb-card', styles.card, mobile && styles.cardM, sel && 'pb-card-sel')}>
        {s.newIds.has(item.id) && <span className={clsx(styles.newBadge, mobile && styles.newBadgeM)} aria-label="신규">{mobile ? 'N' : 'NEW'}</span>}
        <button type="button" onClick={(e) => { e.stopPropagation(); s.toggleFavorite(item.id) }} title={fav ? '즐겨찾기 해제' : '즐겨찾기에 모아두기'} aria-label="즐겨찾기" aria-pressed={fav}
          className={clsx('pb-ribbon', styles.fav, mobile && styles.favM, fav && styles.favOn)}>
          <IconStar size={mobile ? 10 : 9} className={styles.favGlyph} />
        </button>
        <button type="button" onClick={pin} title={pinned ? '북마크 해제' : '북마크에 담기'} aria-label="북마크" tabIndex={pinned ? 0 : -1}
          className={clsx('pb-ribbon', styles.pinMark, mobile && styles.pinMarkM, pinned && styles.pinMarkOn)} />
        <div className={styles.thumb}>
          <ItemThumb item={item} mode={mode} gaze={s.pv.gaze} ctxItems={ctx.items} ctxKey={ctx.key} override={ctx.override} ctxEffs={ctx.effs} pvEff={s.pv}
            zmap={s.index?.zmap || []} smap={s.index?.smap || {}} skinHeadId={isSkinItem ? item.headId : undefined}
            ctxExpr={ctx.expr} faceMeta={ctx.faceMeta} dye={mode === 'mymodel' ? { palette: s.renderPalette, hsb: s.renderHsb } : undefined}
            ear={mode === 'mymodel' ? s.pv.ear : undefined} weapon={s.pv.weapon} isMy={mode === 'mymodel'} />
          {badgeKind && (
            // eslint-disable-next-line @next/next/no-img-element -- WZ 등급 배지(픽셀 아트)는 리샘플링 없이 원본 도트로 그린다
            <img src={badgeUrl(badgeKind)} alt={badgeKind} draggable={false} onError={(e) => { e.currentTarget.style.display = 'none' }}
              className={clsx(styles.labelBadge, badgeKind === 'cash' && styles.labelBadgeCash)} />
          )}
        </div>
        <div className={mobile ? styles.nameM : styles.name}>{name}</div>
        <div className={clsx(styles.bar, mobile ? styles.barM : styles.barHover)}>
          <button type="button" onClick={pin} title={pinned ? '북마크 해제' : '북마크에 담기'} className={clsx('pb-cardact', styles.act, mobile && styles.actM, pinned && styles.actPinned)}>북마크</button>
          {dyeable && (
            <button type="button" onClick={dye} title={`${name} 색 바꾸기`} className={clsx('pb-cardact', styles.act, styles.actDye, mobile && styles.actM)}>{isDot ? '점 위치' : '염색'}</button>
          )}
        </div>
      </div>
    </div>
  )
}

// 전체·즐겨찾기처럼 부위가 섞인 리스트는 아이템 자신의 슬롯으로 착용 부위를 정한다.
export const catOf = (item: ListItem, activeCat: string) => (isMultiCat(activeCat) ? SLOT_TO_CAT[item.slot] : activeCat)
