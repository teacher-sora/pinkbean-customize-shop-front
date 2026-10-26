'use client'

import clsx from 'clsx'
import { useRef } from 'react'
import { badgeUrl, type ListItem } from '@/lib/core/data'
import { CHAT_CARD, DOT_MOVER_IDS, SLOT_TO_CAT, isDyeableSkin } from '@/lib/shopData'
import ItemThumb from '../ItemThumb'
import { isMultiCat, useShop, type ListMode } from '../ShopContext'
import { IconStar } from '../ui/Icons'
import { preloadSnapshot } from '@/lib/core/snapRender'
import { COMBO_SKIP, countLabel, lookChunk, useLookCount, withCardPv } from '@/lib/looks'
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
  const dyeable = isSkinItem ? isDyeableSkin(item.name) : item.dyeMode !== 'none'
  const isDot = DOT_MOVER_IDS.has(item.id)
  const looks = useLookCount(item.id) // 이 아이템이 든 실제 유저 코디 수(코디 조합 표본 — lib/looks). 0 이면 칩이 없다
  const badgeKind: 'master' | 'special' | 'cash' | null =
    item.label ? item.label : (item.isCash && !NO_CASH_BADGE.has(item.slot)) ? 'cash' : null

  const equip = () => { if (s.consumeSwipeClick()) return; s.equipFromCat(cat, item) }
  // 누르는 순간(클릭보다 먼저) 착용에 필요한 메타·스프라이트를 받기 시작 → 착용 반영 대기 단축.
  const warm = () => s.warmForPreview(item)
  const pin = (e: React.MouseEvent) => { e.stopPropagation(); s.toggleBookmark(item) }
  // 염색 버튼은 착용을 바꾸지 않는다. 사소한 변경점/쩜은 점 위치 전용 다이얼로그.
  const dye = (e: React.MouseEvent) => { e.stopPropagation(); if (isDot) s.openDot(item); else s.openDye(item) }
  // 코디 조합 — 목록 자리에 이 아이템을 입은 코디와 자주 쓴 염색을 펼친다(combo/ComboPanel). 숨은 기능이 되지 않게 늘 보인다(사용자 지시)
  const combo = (e: React.MouseEvent) => { e.stopPropagation(); if (s.consumeSwipeClick()) return; s.openCombo(item) }
  // 미리 받기(칩에 120ms 머물면 — 지나가기만 하면 받지 않는다): 첫 묶음과, 첫 12벌의 아이템 정보 · 정지 자세 그림 파일(snapRender.preloadSnapshot —
  // 받기만, 합성은 누른 뒤). 합성까지 미리 걸면 그 일이 화면을 붙잡아 패널이 늦게 떴다(실측 CPU ×4: 패널 367 → 1149 · 1671ms)
  // 터치는 머무름이 없어 손가락이 닿는 순간(떼기 전) 시작한다. 받은 것은 lib/looks · 그림 캐시에 남아 두 번 받지 않는다
  const hover = useRef(0)
  const comboPreload = () => { lookChunk(item.id, 0).then((d) => { const ix = s.index; if (ix) for (const r of d.looks.slice(0, 12)) void preloadSnapshot(withCardPv(r.s, s.cardPv), ix, true).catch(() => {}) }).catch(() => {}) }
  const comboEnter = (e: React.PointerEvent) => { if (e.pointerType !== 'mouse') return; window.clearTimeout(hover.current); hover.current = window.setTimeout(comboPreload, 120) }
  const comboLeave = () => window.clearTimeout(hover.current)
  const comboDown = (e: React.PointerEvent) => { if (e.pointerType !== 'mouse') comboPreload() }

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
          <ItemThumb item={item} mode={mode} chat={item.chatUi ? CHAT_CARD : undefined} gaze={s.pv.gaze} ctxItems={ctx.items} ctxKey={ctx.key} override={ctx.override} ctxEffs={ctx.effs} pvEff={s.pv}
            zmap={s.index?.zmap || []} smap={s.index?.smap || {}} skinHeadId={isSkinItem ? item.headId : undefined}
            ctxExpr={ctx.expr} faceMeta={ctx.faceMeta} dye={mode === 'mymodel' ? { palette: s.renderPalette, hsb: s.renderHsb } : undefined}
            ear={mode === 'mymodel' ? s.pv.ear : undefined} weapon={s.pv.weapon} isMy={mode === 'mymodel'} stance={ctx.stance} ctxAction={ctx.action} dotOffsets={mode === 'mymodel' ? s.dotPos[item.id] : undefined} />
          {badgeKind && (
            // WZ 등급 배지(픽셀 아트)는 리샘플링 없이 원본 도트로 그린다(next/image 를 쓰지 않는다)
            <img src={badgeUrl(badgeKind)} alt={badgeKind} draggable={false} onError={(e) => { e.currentTarget.style.display = 'none' }}
              className={clsx(styles.labelBadge, badgeKind === 'cash' && styles.labelBadgeCash)} />
          )}
          {looks > 0 && !COMBO_SKIP.has(item.slot) && (
            <button type="button" onClick={combo} onPointerEnter={comboEnter} onPointerLeave={comboLeave} onPointerDown={comboDown} data-guide="combo" title={`이 아이템을 입은 코디 ${looks.toLocaleString()}벌 보기`} aria-label={`코디 조합 ${looks.toLocaleString()}벌`}
              className={clsx(styles.combo, mobile && styles.comboM)}>코디 {countLabel(looks)}</button>
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
