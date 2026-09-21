'use client'

// 광장 상세 → '가져오기': 어느 프리셋 칸에 저장할지 고르는 화면.
// 공유 링크로 받을 때의 다이얼로그(ShareReceiveSheet)와 **같은 내용**이지만, 여기서는 서피스 안에서 열려
// 상세와 한 다이얼로그를 공유한다(2026-09-21 사용자 지시 — 닫혔다 다시 뜨는 끊김 제거).
// 칸을 고르면 applySharedToPreset 으로 들어가 덮어쓰기·되돌리기 동작이 공유 링크와 완전히 같다.

import clsx from 'clsx'
import SnapThumb from '../SnapThumb'
import { useShop } from '../ShopContext'
import type { PlazaPost } from '@/lib/plaza'
import styles from './plaza.module.css'

export default function PlazaTakeBody({ post, mobile }: { post: PlazaPost; mobile: boolean }) {
  const s = useShop()
  const snap = { ...post.snapshot, name: post.name }
  return (
    <div className={clsx('pb-scroll', styles.takeBody)}>
      <div className={styles.takeTop}>
        <div className={styles.takeThumb}><SnapThumb snap={snap} /></div>
        <div className={styles.takeHint}>
          <div className={styles.takeName}>{post.name}</div>
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
