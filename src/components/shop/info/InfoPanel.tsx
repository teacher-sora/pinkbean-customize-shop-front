'use client'

// 코디 정보 · 염색. 18부위 행 그리드. 부위를 누르면 염색/점 위치 서피스를 연다(PC 는 가운데 다이얼로그, 모바일은 바텀 시트).

import clsx from 'clsx'
import { CatTabsM, StickyBarM } from '../nav/BottomNav'
import { useListMinHeight } from '../list/ListArea'
import { useEffect, useRef, useState } from 'react'
import { DEFAULT_TONE, DOT_MOVER_IDS, isDyeableSkin, skinDyeFamily } from '@/lib/shopData'
import { useShop } from '../ShopContext'
import { CONFIRM_ATTR, confirmTwice } from '@/lib/confirmTwice'
import { IconEye, IconShareImage, IconTrashSolid } from '../ui/Icons'
import { DyeBand, SlotSprite } from './SlotSprite'
import { bandStateOf, infoRows, useSkinItem, useToneName, type Row } from './infoRows'
import styles from './info.module.css'
import ui from '../ui/ui.module.css'

export default function InfoPanel({ mobile }: { mobile: boolean }) {
  const s = useShop()
  const narrow = s.listNarrow
  const toneName = useToneName()
  const skinItem = useSkinItem()

  // 부위 그리드 열 = min(최대 열, 150px 카드가 들어가는 수)
  const slotsRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  useListMinHeight(scrollRef, mobile) // 모바일: 목록 화면과 같은 칸 높이 · 페이지 높이(ListArea useMobileRows)
  const [infoW, setInfoW] = useState(0)
  useEffect(() => {
    const el = slotsRef.current; if (!el) return
    const m = () => { const w = el.clientWidth; if (w) setInfoW((p) => (p === w ? p : w)) }
    m()
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(m) : null
    ro?.observe(el)
    return () => ro?.disconnect()
  }, [mobile])
  const maxCols = mobile ? 2 : narrow ? 3 : 4
  const fit = infoW > 0 ? Math.floor((infoW - 20 + 8) / (150 + 8)) : maxCols
  const cols = Math.max(1, Math.min(maxCols, fit > 0 ? fit : maxCols))

  const rows = infoRows(s, skinItem, toneName)
  const wornCount = rows.filter((r) => r.on).length

  // 명찰 · 말풍선 칸이 비었을 때는 '기본'(게임처럼 반지가 없으면 기본 명찰 · 말풍선). 기본 명찰은 연출 설정 > 캐릭터의 토글로 켜고 끈다(pv.baseTag)
  const baseOf = (r: typeof rows[number]) => (r.on ? null : r.slot === 'nameTag' ? (s.pv.baseTag ? '기본' : '기본 꺼짐') : r.slot === 'chatBalloon' ? '기본' : null)
  const baseTitle = (r: typeof rows[number]) => (r.slot === 'nameTag' ? `명찰 - 기본 명찰(${s.pv.baseTag ? '켜짐' : '꺼짐'}), 눌러서 연출 설정 > 캐릭터에서 켜고 끄기` : '말풍선 - 기본 말풍선, 채팅을 보내면 떠요')
  const pick = (r: typeof rows[number]) => {
    if (!r.on && r.slot === 'nameTag' && baseOf(r)) { s.guideGo({ go: mobile ? { tab: 'preview', sheet: 'pv', group: 'char' } : { tab: 'preview', drawer: 'char' } }); return }
    if (!r.on || !r.item) return
    s.setDyeTarget(r.slot)
    // 어느 폭이든 염색 창(서피스 — PC 는 가운데 다이얼로그, 모바일은 바텀 시트)을 연다(사용자 지시). 창 안에서 캐릭터를 크게 보며 바꾼다.
    if (r.isSkin && !isDyeableSkin(toneName)) { s.notify('이 피부는 염색할 수 없어요'); return }
    if (!r.isSkin && r.item.dyeMode === 'none' && !DOT_MOVER_IDS.has(r.item.id)) { s.notify('이 아이템은 염색할 수 없어요'); return }
    if (DOT_MOVER_IDS.has(r.item.id)) s.openDot(r.item); else s.openDye(r.item)
  }

  const bandState = (r: Row) => bandStateOf(r, toneName)
  // 휴지통: 피부는 되돌릴 것이 있을 때만(기본 피부로 보이는 중이면 없다). 눈은 늘 있다 — 기본 피부여도 마네킹을 가릴 수 있다(사용자 지시)
  const canClear = (r: Row) => !r.isSkin || s.tone !== DEFAULT_TONE || r.hidden

  const grid = (
    <div className={styles.grid} style={{ gridTemplateColumns: `repeat(${cols},minmax(0,1fr))` }}>
      {rows.map((r) => {
        const base = baseOf(r)
        const name = r.on ? (r.hidden ? '숨김' : (r.item!.name || r.item!.id)) : base ?? '미착용'
        return (
          <button key={r.c.id} type="button" data-share-slot={r.slot} onClick={() => pick(r)} title={r.on ? `${r.c.label} - ${r.item!.name || r.item!.id}, 눌러서 염색` : base ? baseTitle(r) : `${r.c.label} - 미착용`}
            className={clsx(r.on && 'pb-slotrow', styles.slot, ui.dyeChip, r.on && styles.slotOn, r.hidden && styles.slotHidden, r.sel && styles.slotSel)}>
            <span className={clsx('pb-chipthumb', styles.slotThumb, r.on && !r.hidden && styles.slotThumbOn)}>
              {r.on && r.item ? (
                <span className={clsx(styles.slotSprite, r.hidden && styles.slotSpriteHidden)}>
                  <SlotSprite slot={r.slot} item={r.item} grayscale={r.hidden} />
                </span>
              ) : <span className={styles.slotEmpty} />}
              {r.dyed && <span title={r.dyeOff ? '염색 비활성화됨' : '염색됨'} className={clsx(styles.dyedDot, r.dyeOff && styles.dyedDotOff)} />}
            </span>
            <span className={clsx(styles.slotText, mobile && styles.slotTextM)}>
              <span className={styles.slotPart}>{r.c.label}</span>
              <span className={clsx(styles.slotName, ((r.on && !r.hidden) || name === '기본') && styles.slotNameOn)}>{name}</span>
            </span>
            {r.on && (
              <span role="button" tabIndex={0} title="미리보기 표시/숨김" aria-label="미리보기 표시/숨김"
                onClick={(e) => { e.stopPropagation(); s.setHidden((h) => { const n = { ...h }; if (n[r.slot]) delete n[r.slot]; else n[r.slot] = true; return n }) }}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); s.setHidden((h) => { const n = { ...h }; if (n[r.slot]) delete n[r.slot]; else n[r.slot] = true; return n }) } }}
                className={clsx(styles.toggle, r.hidden && styles.toggleHidden)}>
                <IconEye hidden={r.hidden} />
              </span>
            )}
            {/* 이 부위만 벗기 — 칩 오른쪽 아래 모서리의 휴지통(이름 줄 끝의 눈 단추와 떨어지게). 두 번 눌러야 한다(lib/confirmTwice, 누른 단추 위에 되묻는 말풍선). 사용자 요청. */}
            {r.on && canClear(r) && (
              <span role="button" tabIndex={0} title={r.isSkin ? '기본 피부로 되돌리기' : '이 부위 벗기'} aria-label={r.isSkin ? '기본 피부로 되돌리기' : `${r.c.label} 벗기`} {...{ [CONFIRM_ATTR]: `unequip:${r.slot}` }}
                onClick={(e) => { e.stopPropagation(); if (confirmTwice(`unequip:${r.slot}`, r.isSkin ? '한 번 더 누르면 뽀송 꽃잎 피부로 돌아가요' : '한 번 더 누르면 벗어요')) s.unequipSlot(r.slot, r.c.label) }}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); if (confirmTwice(`unequip:${r.slot}`, r.isSkin ? '한 번 더 누르면 뽀송 꽃잎 피부로 돌아가요' : '한 번 더 누르면 벗어요')) s.unequipSlot(r.slot, r.c.label) } }}
                className={styles.trash}>
                <IconTrashSolid size={13} />
              </span>
            )}
            <DyeBand state={bandState(r)}
              slot={r.slot} palette={s.dyePalette[r.slot]} hsb={s.dyeHsb[r.slot]} off={r.dyeOff} skinFamily={r.isSkin ? skinDyeFamily(toneName) ?? undefined : undefined} />
          </button>
        )
      })}
    </div>
  )

  const chip = (
    <div title="착용한 부위 수" className={clsx(styles.chip, mobile && styles.chipM)}>
      <span className={styles.chipLabel}>착용</span>
      <span className={styles.chipNum}>{wornCount}</span>
      <span className={styles.chipSlash}>/</span>
      <span className={styles.chipLabel}>{s.infoCats.length}</span>
    </div>
  )
  // 코디 프로필 저장(헤더 오른쪽 — 예전 '전체 벗기' 자리). 눈에 띄게 진한 핑크(사용자 지시 — 옅은 버튼은 있는 줄도 몰랐다).
  // 누르면 꾸미는 창(코디 프로필 — 디자인 · 배경 · 명찰 · 말풍선 · 자리)이 열리고 거기서 저장한다
  const share = (
    <button type="button" data-guide="share-image" onClick={s.openCard} title="내 캐릭터와 코디 정보를 카드 한 장으로 꾸며 저장"
      className={clsx('pb-solid', styles.btn, styles.btnIcon, styles.btnSolid, mobile && styles.btnM)}><IconShareImage size={14} /><span>코디 프로필 저장</span></button>
  )

  if (mobile) {
    return (
      <>
        <StickyBarM>
          <CatTabsM jump />
          <div className={styles.headerM}>{chip}<div className={styles.right}>{share}</div></div>
          <div className={styles.hrM} />
        </StickyBarM>
        {/* 칸 안 스크롤 — 목록 화면과 같다(사용자 지시): 페이지는 맨 위 헤더 높이만큼만 내려가고, 부위 칸은 이 칸 안에서 스크롤한다.
            칸 높이 = 헤더만큼 내렸을 때 미리보기 + 머리 묶음 아래 화면 끝까지(ListArea useMobileRows), 끝에 닿으면 페이지가 이어서 스크롤한다 */}
        <div ref={scrollRef} data-pb-list className={clsx('pb-scroll', 'pb-norail', styles.scrollM)}>
          <div ref={slotsRef}>{grid}</div>
        </div>
      </>
    )
  }
  return (
    <section className={styles.panel}>
      <div className={styles.header}>{chip}<div className={styles.right}>{share}</div></div>
      <div className={styles.hr} />
      <div className={clsx('pb-scroll', 'pb-fade', styles.scroll)}>
        <div ref={slotsRef} className={styles.slots}>{grid}</div>
      </div>
    </section>
  )
}
