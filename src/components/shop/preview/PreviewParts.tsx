'use client'

// 미리보기 영역 부품: 평가 말풍선 · 북마크 스프라이트 · 북마크 박스(PC) · 북마크 시트 본문(모바일) · 연출 설정 시트 본문(모바일).

import clsx from 'clsx'
import { useEffect, useRef, useState } from 'react'
import type { ListItem } from '@/lib/core/data'
import { SLOT_TO_CAT } from '@/lib/shopData'
import { useShop } from '../ShopContext'
import { DyeSprite, INFO_FRAC, INFO_FRAC_HAIR } from '../render/DyeSprite'
import { IconCaretUp } from '../ui/Icons'
import { PvGroups, PvInlineFields, type PvGroup } from './pvControls'
import styles from './preview.module.css'

// 핑크빈 코디 평가 말풍선 — 평가가 오면 캐릭터 주변 링 모양 위치에 2~3개를 페이드업→3초 유지→페이드다운(기존 기능 유지).
export function RateBubbles() {
  const s = useShop()
  const [bubbles, setBubbles] = useState<{ id: number; text: string; top: number; left: number; delay: number }[]>([])
  const bubbleId = useRef(0)
  useEffect(() => {
    const r = s.rateResult
    if (!r || !r.bubbles.length) return
    // 캐릭터(미리보기 중앙)를 피해 "반지(링) 모양"으로 배치 — 인덱스별로 원주에 분산.
    const arr = r.bubbles.slice(0, 3)
    const base = Math.random() * Math.PI * 2
    const spawned = arr.map((text, i) => {
      const angle = base + (i / arr.length) * Math.PI * 2 + (Math.random() - 0.5) * 0.7
      const rx = 32 + Math.random() * 10, ry = 28 + Math.random() * 10
      const left = Math.max(2, Math.min(66, 48 + Math.cos(angle) * rx))
      const top = Math.max(3, Math.min(60, 44 + Math.sin(angle) * ry))
      return { id: ++bubbleId.current, text, top, left, delay: i * 1.3 } // 일정 간격으로 천천히 하나씩
    })
    setBubbles((b) => [...b, ...spawned])
    const ids = new Set(spawned.map((x) => x.id))
    const t = setTimeout(() => setBubbles((b) => b.filter((x) => !ids.has(x.id))), 3600 + (spawned.length - 1) * 1300 + 300)
    return () => clearTimeout(t)
  }, [s.rateResult])
  return (
    <>
      {bubbles.map((b) => (
        // 위치·지연은 말풍선마다 무작위로 정해지는 즉시 값이라 인라인
        <div key={b.id} className="pb-bubble" style={{ top: `${b.top}%`, left: `${b.left}%`, animation: `pbBubbleFloat 3.6s ease ${b.delay}s both` }}>{b.text}</div>
      ))}
    </>
  )
}

// 북마크 썸네일: 아이템 스프라이트(헤어·성형은 염색표처럼 몸 없이 모든 파츠 합성, 무염색).
export function BookmarkSprite({ item }: { item: ListItem }) {
  const s = useShop()
  const zmap = s.index?.zmap || []
  if (item.slot === 'hair' || item.slot === 'face') return <DyeSprite id={item.id} mix zmap={zmap} frac={item.slot === 'hair' ? INFO_FRAC_HAIR : INFO_FRAC} />
  if (item.slot === 'skin') return <DyeSprite id={item.id} thumb={`sprites/${item.id}/thumb.png`} mix={false} zmap={zmap} frac={INFO_FRAC} />
  return <DyeSprite id={item.id} thumb={item.icon || `sprites/${item.id}/icon.png`} mix={false} zmap={zmap} frac={INFO_FRAC} />
}

const wornOf = (s: ReturnType<typeof useShop>, it: ListItem) => s.isEquippedInCat(SLOT_TO_CAT[it.slot], it.id)

function PinCount({ n }: { n: number }) {
  return <span className={clsx(styles.count, n > 0 && styles.countOn)}>{n}</span>
}

// PC: 미리보기 아래 8칸 박스. 슬롯을 누르면 입혀보기(토글), ✕ 로 해제.
export function BookmarkBox() {
  const s = useShop()
  const n = s.bookmarks.length
  return (
    <div className={clsx('pb-pinbox', styles.pinbox)}>
      <div className={styles.pinHead}>
        <span className={styles.pinTitle}>북마크<PinCount n={n} /></span>
        <button type="button" onClick={s.clearBookmarks} title="북마크 전체 비우기" className={clsx('pb-ghost', styles.clear, n > 0 && styles.clearOn)}>비우기</button>
      </div>
      <div className={styles.pinGrid}>
        {Array.from({ length: 8 }, (_, i) => {
          const it = s.bookmarks[i]
          if (!it) return <div key={i} title="북마크한 아이템이 여기에 담겨요" className={clsx('pb-slot', styles.slot)} />
          const worn = wornOf(s, it)
          const name = it.name || it.id
          return (
            <div key={it.id} onClick={() => s.equipFromCat(SLOT_TO_CAT[it.slot], it)} title={`${name} — ${worn ? '현재 장착 중' : '눌러서 입혀보기'}`}
              className={clsx('pb-slot', styles.slot, styles.slotFilled, worn && styles.slotWorn)}>
              <div className={styles.slotSprite}><BookmarkSprite item={it} /></div>
              <button type="button" onClick={(e) => { e.stopPropagation(); s.toggleBookmark(it) }} title="찜 해제" aria-label="찜 해제" className={clsx('pb-slot-x', styles.slotX)}>✕</button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// 모바일: 북마크 시트 본문.
export function BookmarkSheetBody() {
  const s = useShop()
  const n = s.bookmarks.length
  return (
    <div className={styles.sheetBody}>
      <div className={styles.bmHead}>
        <span className={styles.bmTitle}>북마크<PinCount n={n} /></span>
        <button type="button" onClick={s.clearBookmarks} className={clsx('pb-ghost', styles.clear, n > 0 && styles.clearOn)}>비우기</button>
      </div>
      <div className={styles.bmBody}>
        {n === 0 ? (
          <div className={styles.bmEmpty}>
            <span className={styles.bmEmptyTitle}>북마크가 비어 있어요</span>
            <span className={styles.bmEmptyHint}>아이템 카드의 북마크를 눌러 담아둬요.</span>
          </div>
        ) : (
          <div className={styles.bmGrid}>
            {s.bookmarks.map((it) => {
              const worn = wornOf(s, it)
              const name = it.name || it.id
              return (
                <button key={it.id} type="button" onClick={() => { s.equipFromCat(SLOT_TO_CAT[it.slot], it); s.closeSurface() }} title={`${name} — ${worn ? '장착 중' : '눌러서 입혀보기'}`}
                  className={clsx(styles.chip, worn && styles.chipWorn)}>
                  <span className={styles.chipSprite}><BookmarkSprite item={it} /></span>
                  <span role="button" tabIndex={0} title="북마크 해제" aria-label="북마크 해제" className={styles.chipX}
                    onClick={(e) => { e.stopPropagation(); s.toggleBookmark(it) }}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); s.toggleBookmark(it) } }}>✕</span>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// 모바일: 연출 설정 시트 본문.
export function PvSheetBody() {
  const s = useShop()
  const [group, setGroup] = useState<PvGroup>('char')
  return (
    <div className={styles.sheetBody}>
      <PvGroups group={group} onGroup={setGroup} mobile />
      <div className={styles.gridM}>
        <PvInlineFields mobile narrow={false} />
        <button type="button" onClick={s.closeSurface} className={clsx('pb-soft', styles.closeSheet)}>
          연출 설정 닫기<IconCaretUp />
        </button>
      </div>
    </div>
  )
}
