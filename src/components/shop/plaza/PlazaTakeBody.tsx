'use client'

// '공유받은 코디' — 어느 프리셋 칸에 저장할지 고르는 화면(서피스 본문).
// 공유 링크로 받았을 때 · 링크/코드를 입력해 불러왔을 때 · 광장에서 가져오기를 눌렀을 때가 **모두 이 화면**이다
// (2026-09-21 사용자 지시 — 예전엔 광장만 이 다이얼로그였고 나머지는 별도 시트였다).
// 칸을 고르면 applySharedToPreset 으로 들어가 덮어쓰기·되돌리기 동작이 어느 경로로 왔든 똑같다.

import clsx from 'clsx'
import SnapThumb from '../SnapThumb'
import { useShop, type Snapshot } from '../ShopContext'
import styles from './plaza.module.css'

export default function PlazaTakeBody({ snap, mobile }: { snap: Snapshot; mobile: boolean }) {
  const s = useShop()
  return (
    <div className={clsx('pb-scroll', styles.takeBody)}>
      <div className={styles.takeTop}>
        <div className={styles.takeThumb}><SnapThumb snap={snap} /></div>
        <div className={styles.takeHint}>
          <div className={styles.takeName}>{snap.name || '공유받은 코디'}</div>
          <div className={styles.takeSub}>{mobile ? '저장할 프리셋을 골라주세요' : '저장할 프리셋을 고르면 바로 적용돼요 · 되돌리기 가능'}</div>
        </div>
      </div>
      <div className={clsx(styles.takeGrid, mobile && styles.takeGridM)}>
        {s.presets.map((p) => {
          const cur = s.presetData[p.id]
          return (
            <div key={p.id} className="pb-presetwrap">
              <div onClick={() => s.applySharedToPreset(snap, p.id)} className="pb-preset" title={`'${p.name}'에 저장`}>
                <div className={styles.takeCardThumb}>{cur && <SnapThumb snap={cur} />}</div>
                <div className={styles.takeCardFoot}><div className={styles.takeCardName}>{p.name}</div></div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
