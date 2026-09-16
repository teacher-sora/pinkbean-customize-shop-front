'use client'

// 프리셋 20칸. 선택된 프리셋에 자동 저장 · 닉네임/공유 링크 불러오기(LookDialog 는 현행 유지) · 복사/삭제 띠지 · 인라인 이름.

import clsx from 'clsx'
import { useMemo, useRef } from 'react'
import type { Preset } from '@/lib/catalog'
import { isNarrow } from '@/lib/useBreakpoint'
import SnapThumb from '../SnapThumb'

// 프리셋 카드 캐릭터 크기(리스트 카드 0.45 보다 조금 작게 — 사용자 지시 2026-09-17)
const PRESET_FRACTION = 0.38
import { useShop, type Snapshot } from '../ShopContext'
import { IconImport, IconPencil, IconShare, IconTrash } from '../ui/Icons'
import styles from './preset.module.css'

export default function PresetPanel({ mobile }: { mobile: boolean }) {
  const s = useShop()
  const narrow = isNarrow(s.bp)
  // 라이브 모델 → Snapshot(선택된 카드가 이걸로 그려진다). 자동저장(100ms)을 기다리지 않고 즉시 반영.
  //  ⚠️ 반드시 context 의 snapshot() 을 그대로 쓴다 — 필드를 직접 나열하면 새 상태(점 위치·염색 등)를 빠뜨려
  //     "선택됨" 카드에만 반영이 안 되는 버그가 난다(과거 dotPos 누락 사례).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const liveSnap: Snapshot = useMemo(() => s.snapshot(), [s.equipped, s.tone, s.dyePalette, s.dyeHsb, s.hidden, s.dotPos, s.pv])

  // 삭제는 2단계 확인: 3초 안에 한 번 더 누르면 삭제.
  const armRef = useRef<{ id: string | null; t: ReturnType<typeof setTimeout> | null }>({ id: null, t: null })
  const remove = (p: Preset) => {
    const a = armRef.current
    if (a.id === p.id) {
      if (a.t) clearTimeout(a.t)
      armRef.current = { id: null, t: null }
      s.resetPreset(p.id)
      return
    }
    if (a.t) clearTimeout(a.t)
    armRef.current = { id: p.id, t: setTimeout(() => { armRef.current = { id: null, t: null } }, 3000) }
    s.notify(`'${p.name}' 삭제할까요? 한 번 더 누르면 삭제돼요`)
  }

  const chip = (
    <div title="선택된 프리셋에 자동 저장돼요" className={clsx(styles.chip, mobile && styles.chipM)}>
      <span className={styles.chipLabel}>프리셋</span>
      <span className={styles.chipNum}>{s.presetUsed}</span>
      <span className={styles.chipSlash}>/</span>
      <span className={styles.chipLabel}>20</span>
    </div>
  )
  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => { if (e.key === 'Enter') s.importFetch() }

  const grid = (
    <div className={clsx(styles.grid, (narrow || mobile) && styles.gridTight, mobile ? styles.cols2 : narrow ? styles.cols3 : styles.cols5)}>
      {s.presets.map((p, i) => {
        const on = s.selectedPreset === p.id
        const snap = on ? liveSnap : s.presetData[p.id]
        return (
          <div key={p.id} onClick={() => s.selectPreset(p.id)} className={clsx('pb-presetwrap', styles.wrap)}>
            <div className={clsx('pb-preset', on && 'pb-preset-sel')}>
              <span className={clsx(styles.badge, on && styles.badgeOn)}>선택됨</span>
              <div className={styles.thumb}>{snap && <SnapThumb snap={snap} fraction={PRESET_FRACTION} />}</div>
              <div className={styles.nameRow}>
                <span className={styles.nameWrap}>
                  <input value={p.name} aria-label="프리셋 이름" title={mobile ? undefined : '이름을 입력해 바꿀 수 있어요'}
                    onChange={(e) => s.renamePreset(p.id, e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
                    onBlur={(e) => { if (!e.target.value.trim()) s.renamePreset(p.id, `코디 ${i + 1}`) }}
                    className={clsx('pb-input', 'pb-presetname', styles.nameInput)} />
                  <IconPencil className={styles.pencil} />
                </span>
              </div>
              <button type="button" onClick={(e) => { e.stopPropagation(); s.sharePreset(p) }} title="프리셋 복사" aria-label="프리셋 복사" className={clsx('pb-presetacts', styles.share)}><IconShare /></button>
              <button type="button" onClick={(e) => { e.stopPropagation(); remove(p) }} title="프리셋 삭제" aria-label="삭제" className={clsx('pb-presetacts', styles.del, mobile && styles.delM)}><IconTrash /></button>
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
          <input value={s.nickInput} onChange={(e) => s.setNickInput(e.target.value)} onKeyDown={onKey} placeholder="닉네임 · 공유 링크" className={clsx('pb-input', styles.importInputM)} />
          <button type="button" onClick={s.importFetch} title="불러오기" aria-label="불러오기" aria-busy={s.importing || undefined} className={clsx('pb-solid', styles.loadBtnM, s.importing && styles.busy)}><IconImport /></button>
        </div>
        <div className={styles.hrM} />
        <div className={clsx('pb-scroll', 'pb-norail', styles.scrollM)}>{grid}</div>
      </>
    )
  }
  return (
    <section className={styles.panel}>
      <div className={styles.header}>
        <div className={styles.groupA}>{chip}</div>
        <div className={styles.groupB}>
          <div className={clsx(styles.importWrap, narrow && styles.importWrapNarrow)}>
            <input value={s.nickInput} onChange={(e) => s.setNickInput(e.target.value)} onKeyDown={onKey} placeholder="닉네임 또는 공유 링크" className={clsx('pb-input', styles.importInput)} />
          </div>
          <button type="button" onClick={s.importFetch} title="닉네임 또는 공유 링크로 코디 불러오기" aria-busy={s.importing || undefined} className={clsx('pb-solid', styles.loadBtn, s.importing && styles.busy)}>
            {s.importing ? '불러오는 중' : '불러오기'}
          </button>
        </div>
      </div>
      <div className={styles.hr} />
      <div className={clsx('pb-scroll', styles.scroll)}>{grid}</div>
    </section>
  )
}
