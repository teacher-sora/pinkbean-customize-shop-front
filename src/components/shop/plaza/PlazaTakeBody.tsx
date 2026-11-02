'use client'

// '공유받은 코디' — 어느 프리셋 칸에 저장할지 고르는 화면(서피스 본문).
// 공유 링크로 받았을 때 · 링크/코드를 입력해 불러왔을 때 · 광장에서 가져오기를 눌렀을 때가 **모두 이 화면**이다.
// 칸을 고르면 applySharedToPreset 으로 들어가 덮어쓰기·되돌리기 동작이 어느 경로로 왔든 똑같다.
// 칸 그림은 스크롤 칸에서 보일 즈음에만 그린다(ui/useSeen, 프리셋 탭과 같다). 100칸을 한꺼번에 그리면 캔버스가 240MB 를 넘어
// 휴대폰 브라우저(특히 iOS 사파리)가 탭을 끄고 새로고침했다.

import clsx from 'clsx'
import { useMemo, useRef } from 'react'
import SnapThumb from '../SnapThumb'
import { presetCard } from '@/lib/core/snapRender'
import { useShop, type Snapshot } from '../ShopContext'
import { useSeen } from '../ui/useSeen'
import styles from './plaza.module.css'

// title = 이름이 없는 코디의 머리 글(코디 룩북 — 이름 없이 넘겨 저장할 프리셋의 이름이 그대로 남는다)
export default function PlazaTakeBody({ snap, mobile, title }: { snap: Snapshot; mobile: boolean; title?: string }) {
  const s = useShop()
  const box = useRef<HTMLDivElement>(null)
  return (
    <div ref={box} className={clsx('pb-scroll', 'pb-fade', styles.takeBody)}>
      <div className={styles.takeTop}>
        <div className={styles.takeThumb}><SnapThumb snap={snap} /></div>
        <div className={styles.takeHint}>
          <div className={styles.takeName}>{snap.name || title || '공유받은 코디'}</div>
          <div className={styles.takeSub}>{mobile ? '저장할 프리셋을 골라주세요' : '저장할 프리셋을 고르면 바로 적용돼요 (되돌리기 가능)'}</div>
        </div>
      </div>
      <div className={clsx(styles.takeGrid, mobile && styles.takeGridM)}>
        {s.presets.map((p) => <TakeCard key={p.id} name={p.name} cur={s.presetData[p.id]} root={box} onPick={() => s.applySharedToPreset(snap, p.id)} />)}
      </div>
    </div>
  )
}

function TakeCard({ name, cur, root, onPick }: { name: string; cur: Snapshot | undefined; root: React.RefObject<HTMLDivElement | null>; onPick: () => void }) {
  const thumb = useRef<HTMLDivElement>(null)
  const seen = useSeen(thumb, root)
  const card = useMemo(() => (cur ? presetCard(cur) : undefined), [cur])
  return (
    <div className="pb-presetwrap">
      <div onClick={onPick} className="pb-preset" title={`'${name}'에 저장`}>
        <div ref={thumb} className={styles.takeCardThumb}>{card && seen && <SnapThumb snap={card} view />}</div>
        <div className={styles.takeCardFoot}><div className={styles.takeCardName}>{name}</div></div>
      </div>
    </div>
  )
}
