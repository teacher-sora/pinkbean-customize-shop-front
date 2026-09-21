'use client'

// 미리보기 영역 부품: 평가 말풍선 · 북마크 스프라이트 · 북마크 박스(PC) · 북마크 시트 본문(모바일) · 연출 설정 시트 본문(모바일).

import clsx from 'clsx'
import { useEffect, useRef, useState } from 'react'
import type { ListItem } from '@/lib/core/data'
import { SLOT_TO_CAT } from '@/lib/shopData'
import { useShop } from '../ShopContext'
import { DyeSprite } from '../render/DyeSprite'
import { VsPanes } from '../surface/VsBody'
import { useVsFlip, VS_WRAP_H } from '../surface/sheetMotion'
import { PvGroups, PvInlineFields, type PvGroup } from './pvControls'
import styles from './preview.module.css'

const BOOKMARK_FRAC = 0.9

// 핑크빈 코디 평가 말풍선 — 평가가 오면 캐릭터 주변 링 모양 위치에 2~3개를 페이드업→3초 유지→페이드다운(기존 기능 유지).
export function RateBubbles() {
  const s = useShop()
  const [bubbles, setBubbles] = useState<{ id: number; text: string; top: number; left: number; delay: number }[]>([])
  const bubbleId = useRef(0)
  useEffect(() => {
    // takeRate 는 아직 안 띄운 평가만 내준다 → 탭을 옮겼다 와서 이 컴포넌트가 다시 붙어도 지난 평가가 되풀이되지 않는다.
    const got = s.takeRate()
    if (!got || !got.length) return
    // 캐릭터(미리보기 중앙)를 피해 "반지(링) 모양"으로 배치 — 인덱스별로 원주에 분산.
    const arr = got.slice(0, 3)
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
  }, [s.rateResult, s.takeRate])
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
  // 북마크 칸은 작아서 채움 비율을 조금 더 높인다(캔버스 대비 아이콘이 작게 보이지 않게).
  if (item.slot === 'hair' || item.slot === 'face') return <DyeSprite id={item.id} mix zmap={zmap} frac={BOOKMARK_FRAC} />
  if (item.slot === 'skin') return <DyeSprite id={item.id} thumb={`sprites/${item.id}/thumb.png`} mix={false} zmap={zmap} frac={BOOKMARK_FRAC} />
  return <DyeSprite id={item.id} thumb={item.icon || `sprites/${item.id}/icon.png`} mix={false} zmap={zmap} frac={BOOKMARK_FRAC} />
}

const wornOf = (s: ReturnType<typeof useShop>, it: ListItem) => s.isEquippedInCat(SLOT_TO_CAT[it.slot], it.id)

function PinCount({ n }: { n: number }) {
  return <span className={clsx(styles.count, n > 0 && styles.countOn)}>{n}</span>
}

// PC: 미리보기 아래 8칸 박스. 슬롯을 누르면 입혀보기(토글), ✕ 로 해제. VS = 코디 비교 다이얼로그(비우기 왼쪽, 한 그룹).
export function BookmarkBox() {
  const s = useShop()
  const n = s.bookmarks.length
  return (
    <div className={clsx('pb-pinbox', styles.pinbox)}>
      <div className={styles.pinHead}>
        <span className={styles.pinTitle}>북마크<PinCount n={n} /></span>
        <span className={styles.pinActs}>
          <button type="button" onClick={s.openVs} title="북마크한 아이템을 나란히 비교하기" className={clsx('pb-ghost', styles.vsBtn, s.surface?.kind === 'vs' && styles.vsBtnOn)}>VS</button>
          <button type="button" onClick={s.clearBookmarks} title="북마크 전체 비우기" className={clsx('pb-ghost', styles.clear, n > 0 && styles.clearOn)}>비우기</button>
        </span>
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
              <button type="button" onClick={(e) => { e.stopPropagation(); s.toggleBookmark(it) }} title="북마크 해제" aria-label="북마크 해제" className={clsx('pb-slot-x', styles.slotX)}>✕</button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// 모바일: 북마크 시트 본문(delta §4·§5). 위에서부터 VS 확장 영역(0↔248px, 비교 캔버스 고정 236px) → 북마크 줄(VS·비우기)
// → 4×2 = 항상 8칸 예약(빈칸 점선). VS 가 켜진 동안 칩은 장착이 아니라 비교 대상 선택, 꺼져 있으면 장착 후 닫기.
// 북마크 줄의 윗선은 상시 유지하고 margin-top:-1px 로 접힌 상태에선 헤더 밑선과 정확히 겹친다.
// VS 펼침/접힘은 높이 전환이 아니라 transform FLIP(surface/sheetMotion.useVsFlip) — 목록(bmList)이 비교 영역을 덮고 있다가 드러낸다.
// 본문은 스크롤 가능(브라우저 내비게이션 바가 올라와 시트가 줄어도 잘리지 않게).
export function BookmarkSheetBody() {
  const s = useShop()
  const n = s.bookmarks.length
  const flip = useVsFlip()
  return (
    <div ref={flip.bodyRef} className={clsx('pb-scroll', styles.sheetBody)}>
      {/* 확장 높이는 상태 값이라 인라인(전환은 FLIP 이 transform 으로) */}
      <div className={styles.vsWrap} style={{ height: s.vsOn ? VS_WRAP_H : 0 }}>
        <div className={styles.vsWrapIn}><VsPanes mobile /></div>
      </div>
      <div ref={flip.listRef} className={styles.bmList}>
      <div className={styles.bmRow}>
        <span className={styles.bmTitle}>북마크<PinCount n={n} /></span>
        <span className={styles.pinActs}>
          <button type="button" onClick={flip.toggle} title="북마크한 아이템을 나란히 비교하기" aria-pressed={s.vsOn} className={clsx('pb-ghost', styles.vsBtn, s.vsOn && styles.vsBtnOn)}>VS</button>
          <button type="button" onClick={s.clearBookmarks} title="북마크 전체 비우기" className={clsx('pb-ghost', styles.clear, n > 0 && styles.clearOn)}>비우기</button>
        </span>
      </div>
      <div className={styles.bmBody}>
        <div className={styles.bmGrid}>
          {Array.from({ length: 8 }, (_, i) => {
            const it = s.bookmarks[i]
            if (!it) return <div key={i} title="북마크한 아이템이 여기에 담겨요" className={styles.chipEmpty} />
            const worn = wornOf(s, it)
            const picked = s.vsPicks.includes(it.id)
            const on = s.vsOn ? picked : worn
            const name = it.name || it.id
            const pick = () => {
              if (s.vsOn) { s.toggleVsPick(it.id); return }
              s.equipFromCat(SLOT_TO_CAT[it.slot], it); s.closeSurface()
            }
            return (
              <button key={it.id} type="button" onClick={pick} title={`${name} — ${s.vsOn ? (picked ? '비교에서 빼기' : '오른쪽에 끼워 비교') : worn ? '장착 중' : '눌러서 입혀보기'}`}
                className={clsx(styles.chip, on && styles.chipWorn)}>
                <span className={styles.chipSprite}><BookmarkSprite item={it} /></span>
                <span role="button" tabIndex={0} title="북마크 해제" aria-label="북마크 해제" className={styles.chipX}
                  onClick={(e) => { e.stopPropagation(); s.toggleBookmark(it) }}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); s.toggleBookmark(it) } }}>✕</span>
              </button>
            )
          })}
        </div>
      </div>
      </div>
    </div>
  )
}

// 모바일: 연출 설정 시트 본문. 닫기는 공용 푸터가 맡는다(자체 '연출 설정 닫기' 버튼 제거, delta §6).
export function PvSheetBody() {
  const [group, setGroup] = useState<PvGroup>('char')
  return (
    <div className={clsx('pb-scroll', styles.sheetBody)}>
      <PvGroups group={group} onGroup={setGroup} mobile />
      <div className={styles.gridM}>
        <PvInlineFields mobile narrow={false} />
      </div>
    </div>
  )
}
