'use client'

// 프리셋 30칸. 선택된 프리셋에 자동 저장 · 닉네임/공유 링크 불러오기(LookDialog) · 복사/삭제 띠지 · 인라인 이름.

import clsx from 'clsx'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { Preset } from '@/lib/catalog'
import { CHAT_NAME_FALLBACK, defaultPresetName } from '@/lib/shopData'
import { presetFileName } from '@/lib/canvasExport'
import { isNarrow } from '@/lib/useBreakpoint'
import SnapThumb from '../SnapThumb'
import { usePresetDrag } from './usePresetDrag'
import { CONFIRM_ATTR, confirmTwice } from '@/lib/confirmTwice'

// 프리셋 카드 캐릭터 크기(리스트 카드 0.45 보다 조금 작게)
const PRESET_FRACTION = 0.38
import { useShop, type Snapshot } from '../ShopContext'
import { IconCheck, IconLinkCopy, IconPencil, IconReorder, IconTakeDown, IconTrashSolid } from '../ui/Icons'
import styles from './preset.module.css'

export default function PresetPanel({ mobile }: { mobile: boolean }) {
  const s = useShop()
  const narrow = isNarrow(s.bp)
  // 라이브 모델 → Snapshot(선택된 카드가 이걸로 그려진다). 자동저장(100ms)을 기다리지 않고 즉시 반영.
  //  ⚠️ 반드시 context 의 snapshot() 을 그대로 쓴다 — 필드를 직접 나열하면 새 상태(점 위치·염색 등)를 빠뜨려
  //     "선택됨" 카드에만 반영이 안 되는 버그가 난다(과거 dotPos 누락 사례).
  const liveSnap: Snapshot = useMemo(() => s.snapshot(), [s.equipped, s.tone, s.dyePalette, s.dyeHsb, s.hidden, s.dotPos, s.pv])

  // 고른 칸이 **가운데**에 오도록 탭을 열자마자 스크롤한다(연출 설정 고르기와 같다). 탭을 열 때 한 번만 — 저장된 선택은 첫 그리기 뒤에 온다.
  // 스크롤 영역만 움직인다(scrollIntoView 는 모바일에서 문서까지 같이 끌고 간다).
  // 탭을 눌러 들어올 때는 칸 폭(cqw)이 자리 잡기 전에 불릴 수 있어, 그린 뒤 두 프레임 동안 다시 맞춘다(이미 맞으면 아무 일도 없다).
  const boxRef = useRef<HTMLDivElement>(null)
  const centered = useRef(false)
  useLayoutEffect(() => {
    if (centered.current || !s.selectedPreset) return
    centered.current = true
    const go = () => {
      const box = boxRef.current, el = box?.querySelector('.pb-preset-sel')?.closest('.pb-presetwrap')
      if (!box || !el) return
      const b = box.getBoundingClientRect(), r = el.getBoundingClientRect()
      box.scrollTo({ left: box.scrollLeft + r.left - b.left - (b.width - r.width) / 2, top: box.scrollTop + r.top - b.top - (b.height - r.height) / 2 })
    }
    go()
    let raf = requestAnimationFrame(() => { go(); raf = requestAnimationFrame(go) })
    return () => cancelAnimationFrame(raf)
  }, [s.selectedPreset])

  // 삭제는 2단계 확인: 3초 안에, 다른 상호작용 없이 연속으로 한 번 더 누르면 삭제(lib/confirmTwice).
  const remove = (p: Preset) => {
    // 되묻는 문구는 삭제 버튼 바로 위 말풍선으로 뜬다(ui/ConfirmBubble) — 어느 카드인지는 자리로 알 수 있어 이름을 뺐다.
    if (confirmTwice(`preset:${p.id}`, '한 번 더 누르면 삭제해요')) s.resetPreset(p.id)
  }

  const chip = (
    <div title="선택된 프리셋에 자동 저장돼요" className={clsx(styles.chip, mobile && styles.chipM)}>
      <span className={styles.chipLabel}>프리셋</span>
      <span className={styles.chipNum}>{s.presetUsed}</span>
      <span className={styles.chipSlash}>/</span>
      {/* 칸 수는 **실제 프리셋 목록**에서 센다 — 숫자를 박아 두면 칸 수를 바꿀 때 어긋난다. */}
      <span className={styles.chipLabel}>{s.presets.length}</span>
    </div>
  )
  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => { if (e.key === 'Enter') s.importFetch() }

  // 순서 변경(헤더 칩 옆 버튼, 사용자 지시): 켠 동안만 카드를 끌어 순서를 바꾼다(usePresetDrag). 켠 동안은 카드를 눌러도 고르지 않고
  // 길게 누르기 이미지 메뉴도 열지 않는다(끌기와 겹치지 않게). 끄면 원래대로. 순서는 놓을 때마다 저장된다. Esc 로도 끈다
  const [sorting, setSorting] = useState(false)
  useEffect(() => {
    if (!sorting) return
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') setSorting(false) }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [sorting])
  const toggleSort = () => setSorting((v) => { if (!v) s.notify('카드를 끌어 순서를 바꿔요'); return !v })
  const gridRef = useRef<HTMLDivElement>(null)
  const dnd = usePresetDrag(sorting, s.presets.map((p) => p.id), gridRef, boxRef, s.reorderPresets, styles.dragging, mobile ? 'm' : narrow ? 'n' : 'pc')
  // 켜짐 = 채운 핑크 + '완료'. 두 문구를 한 칸에 겹쳐 폭이 바뀌지 않는다(불러오기 버튼과 같다)
  const sortBtn = (
    <button type="button" data-guide="sort" onClick={toggleSort} aria-pressed={sorting} title={sorting ? '순서 변경 끝내기' : '카드를 끌어 순서 바꾸기'}
      className={clsx(styles.sortBtn, mobile && styles.sortBtnM, sorting && styles.sortOn)}>
      <IconReorder size={mobile ? 14 : 15} />
      <span className={styles.loadLabel}>
        <span aria-hidden={sorting || undefined} style={sorting ? { visibility: 'hidden' } : undefined}>{mobile ? '순서' : '순서 변경'}</span>
        <span aria-hidden={!sorting || undefined} style={sorting ? undefined : { visibility: 'hidden' }}>완료</span>
      </span>
    </button>
  )

  const grid = (
    <div ref={gridRef} className={mobile ? styles.gridHM : clsx(styles.grid, narrow && styles.gridTight, narrow ? styles.cols3 : styles.cols5)}>
      {s.presets.map((p, i) => {
        const on = s.selectedPreset === p.id
        const snap = on ? liveSnap : s.presetData[p.id]
        return (
          <div key={p.id} data-preset-id={p.id} onClick={() => { if (!sorting && !dnd.swallowClick()) s.selectPreset(p.id) }} onPointerDown={(e) => dnd.onPointerDown(e, p.id)}
            className={clsx('pb-presetwrap', styles.wrap, sorting && styles.sorting)}>
            <div className={clsx('pb-preset', on && 'pb-preset-sel')}>
              <span className={clsx(styles.badge, mobile && styles.badgeM, on && styles.badgeOn)} aria-label="선택됨">{mobile ? <IconCheck /> : '선택됨'}</span>
              <div className={clsx(styles.thumb, mobile && styles.thumbM)}>{snap && <SnapThumb snap={snap} fraction={PRESET_FRACTION} tagName={p.name.trim() || CHAT_NAME_FALLBACK} fileName={presetFileName(p.name, i)} holdMenu={!sorting} />}</div>
              <div className={styles.nameRow}>
                <span className={styles.nameWrap}>
                  <input value={p.name} aria-label="프리셋 이름" title={mobile ? undefined : '이름을 입력해 바꿀 수 있어요'}
                    onChange={(e) => s.renamePreset(p.id, e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
                    onBlur={() => s.commitPresetName(p.id, defaultPresetName(i))}
                    className={clsx('pb-input', 'pb-presetname', styles.nameInput)} />
                  <IconPencil className={styles.pencil} />
                </span>
              </div>
              <button type="button" onClick={(e) => { e.stopPropagation(); s.sharePreset(p) }} title="프리셋 복사" aria-label="프리셋 복사" className={clsx('pb-presetacts', styles.share, mobile && styles.shareM)}><IconLinkCopy size={11} /></button>
              <button type="button" onClick={(e) => { e.stopPropagation(); remove(p) }} {...{ [CONFIRM_ATTR]: `preset:${p.id}` }} title="프리셋 삭제" aria-label="삭제" className={clsx('pb-presetacts', styles.del, mobile && styles.delM)}><IconTrashSolid size={11} /></button>
            </div>
          </div>
        )
      })}
    </div>
  )

  if (mobile) {
    return (
      <>
        <div className={styles.headerM}>
          {chip}
          {sortBtn}
          {/* 불러오기: 입력과 버튼을 한 칸에 묶는다(아래 PC 와 같은 모양) */}
          <div className={clsx(styles.importBox, styles.importBoxM)}>
            <input data-guide="nick" value={s.nickInput} onChange={(e) => s.setNickInput(e.target.value)} onKeyDown={onKey} placeholder="닉네임, 공유 링크 입력" aria-label="닉네임 또는 공유 링크" className={styles.importField} />
            <button type="button" onClick={s.importFetch} disabled={s.importing} title="불러오기" aria-label="불러오기" aria-busy={s.importing || undefined} className={clsx('pb-solid', styles.loadBtnM, s.importing && styles.busy)}><IconTakeDown size={15} /></button>
          </div>
        </div>
        <div className={styles.hrM} />
        {/* 모바일: 코디 리스트처럼 가로 스크롤(열 단위 스냅, 스크롤바 숨김) — 2줄 × 폭에 따라 2열/3열 */}
        <div ref={boxRef} className={clsx('pb-norail', styles.hscrollM)}>{grid}</div>
      </>
    )
  }
  return (
    <section className={styles.panel}>
      <div className={styles.header}>
        <div className={styles.groupA}>{chip}{sortBtn}</div>
        <div className={styles.groupB}>
          {/* 불러오기: 아이콘 + 입력 + 채운 버튼을 한 테두리 안에. 칸의 생김새는 다른 탭의 검색 칸과 같고(면 · 테두리 · 아이콘), 채운 버튼 하나로만 눈에 띈다 */}
          <div className={clsx(styles.importBox, narrow && styles.importBoxNarrow)}>
            <span className={styles.importIcon} aria-hidden><IconTakeDown size={15} /></span>
            <input data-guide="nick" value={s.nickInput} onChange={(e) => s.setNickInput(e.target.value)} onKeyDown={onKey} placeholder="닉네임, 공유 링크 입력" aria-label="닉네임 또는 공유 링크" className={styles.importField} />
            <button type="button" onClick={s.importFetch} disabled={s.importing} title="닉네임 또는 공유 링크로 코디 불러오기" aria-busy={s.importing || undefined} className={clsx('pb-solid', styles.loadBtn, s.importing && styles.busy)}>
              {/* 두 문구를 한 칸에 겹쳐 두어 폭 = 긴 쪽('불러오는 중') — 상태가 바뀌어도 버튼·입력칸이 밀리지 않는다. */}
              <span className={styles.loadLabel}>
                <span aria-hidden={s.importing || undefined} style={s.importing ? { visibility: 'hidden' } : undefined}>불러오기</span>
                <span aria-hidden={!s.importing || undefined} style={s.importing ? undefined : { visibility: 'hidden' }}>불러오는 중</span>
              </span>
            </button>
          </div>
        </div>
      </div>
      <div className={styles.hr} />
      <div ref={boxRef} className={clsx('pb-scroll', styles.scroll)}>{grid}</div>
    </section>
  )
}
