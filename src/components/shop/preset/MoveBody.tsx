'use client'

// 옮겨 온 프리셋 고르기(서피스 'move' — 다른 기기의 코드 · QR · 아이디로 받은 프리셋들, lib/presetMove).
// 짜임은 닉네임으로 불러온 코디 고르기(LookPickBody)와 같다: PC · 절반 · 태블릿은 왼쪽 = 카드, 오른쪽 = [덮어쓰기 | 추가]. 모바일은 위 = 고르기, 아래 = 카드.
//  · 덮어쓰기: 받은 것으로 프리셋 전체를 바꾼다(순서 · 이름까지). 카드는 모두 고른 표시다. 카드를 누르면 추가로 바뀌고 그 카드만 고른다
//  · 추가: 누른 카드만 빈 칸에 차례로 넣는다
// 발의 단추 하나가 고른 방식으로 넣는다(ShopContext.takePresets).
import clsx from 'clsx'
import { useState } from 'react'
import type { MoveItem } from '@/lib/presetMove'
import { CARD_FIT_W_M, PRESET_FRACTION, PRESET_FRACTION_M } from '@/lib/shopData'
import { PickCard } from '../plaza/PlazaTakeBody'
import SnapThumb from '../SnapThumb'
import { useShop } from '../ShopContext'
import { SurfaceFooter } from '../surface/Surface'
import { Seg } from '../ui/controls'
import styles from './lookPick.module.css'

const MODES = [{ v: 'all' as const, l: '덮어쓰기' }, { v: 'add' as const, l: '추가' }]

export default function MoveBody({ items, mobile }: { items: MoveItem[]; mobile: boolean }) {
  const s = useShop()
  const [mode, setMode] = useState<'all' | 'add'>('all')
  const [pick, setPick] = useState<Set<number>>(() => new Set())
  const tap = (i: number) => {
    if (mode === 'all') { setMode('add'); setPick(new Set([i])); return }
    setPick((p) => { const n = new Set(p); if (n.has(i)) n.delete(i); else n.add(i); return n })
  }
  const go = () => {
    if (mode === 'all') { s.takePresets(items, 'all'); return }
    const sel = items.filter((_, i) => pick.has(i))
    if (!sel.length) { s.notify('가져올 프리셋을 골라 주세요'); return }
    s.takePresets(sel, 'add')
  }
  const side = (
    <div className={mobile ? styles.sideM : clsx('pb-scroll', 'pb-gutter', 'pb-fade', styles.side)}>
      <div className={styles.group}>
        <div className={styles.row}>
          <span className={styles.rowLabel}>가져오기</span>
          <Seg variant={mobile ? 'mobileFit' : 'pc'} opts={MODES} value={mode} onPick={(v) => { setMode(v); if (v === 'add') setPick(new Set()) }} />
        </div>
      </div>
    </div>
  )
  const cards = (
    <div className={mobile ? styles.cardsM : clsx('pb-scroll', 'pb-gutter', 'pb-fade', styles.cards)}>
      <div className={clsx(styles.grid, mobile && styles.gridM)}>
        {items.map((it, i) => (
          <PickCard key={i} name={it.name || `코디 ${i + 1}`} onPick={() => tap(i)} sel={mode === 'all' || pick.has(i)}>
            <SnapThumb snap={it.snap} fraction={mobile ? PRESET_FRACTION_M : PRESET_FRACTION} fitW={mobile ? CARD_FIT_W_M : undefined} />
          </PickCard>
        ))}
      </div>
    </div>
  )
  return (
    <>
      {mobile ? <div className={clsx('pb-scroll', 'pb-fade', styles.bodyM)}>{side}{cards}</div> : <div className={styles.body}>{cards}{side}</div>}
      {/* 단추 글자([덮어쓰기] ↔ [추가 N])가 바뀌어도 폭이 그대로 — 가장 긴 글자('추가 000', 숫자는 고정 폭)까지 한 칸에 겹쳐 자리를 잡아 둔다 */}
      <SurfaceFooter onApply={go} applyLabel={
        <span className={styles.swap}>
          <span style={mode === 'all' ? undefined : { visibility: 'hidden' }}>덮어쓰기</span>
          <span style={mode === 'all' ? { visibility: 'hidden' } : undefined}>{`추가 ${pick.size}`}</span>
          <span aria-hidden="true" style={{ visibility: 'hidden' }}>추가 000</span>
        </span>
      } />
    </>
  )
}
