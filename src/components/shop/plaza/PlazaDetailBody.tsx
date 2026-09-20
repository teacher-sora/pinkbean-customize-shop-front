'use client'

// 코디 광장 글 상세 — 공용 서피스 본문. 미리보기(첨부 이미지가 있으면 두 칸) · 설명 · 좋아요 · 링크 복사 · 태그.
// 태그를 누르면 시트를 닫고 그 태그로 검색한다(닫힘 애니메이션을 끝까지 보여준 뒤 검색어를 넣는다).

import clsx from 'clsx'
import Image from 'next/image'
import bg from '@/assets/pinkbean-bg.png'
import type { PlazaPost } from '@/lib/plaza'
import SnapThumb from '../SnapThumb'
import { useShop } from '../ShopContext'
import { IconHeart, IconLinkCopy } from '../ui/Icons'
import styles from './plaza.module.css'

const DETAIL_FRACTION = 0.5

export default function PlazaDetailBody({ post, mobile }: { post: PlazaPost; mobile: boolean }) {
  const s = useShop()
  const tagPick = (t: string) => {
    s.closeSurface()
    setTimeout(() => { s.setPlazaQ(t); s.setPlazaFilter('all') }, 330)
  }
  return (
    <div className={clsx('pb-scroll', styles.detail)}>
      <div className={clsx(styles.stages, mobile && styles.stagesM)}>
        <div className={styles.stage}>
          <Image src={bg} alt="" fill sizes="440px" className={styles.stageImg} />
          <div className={styles.stageTone} />
          <SnapThumb snap={post.snapshot} fraction={DETAIL_FRACTION} />
        </div>
        {post.imageUrl && (
          <div className={clsx(styles.stage, styles.stageRef)}>
            {/* 사용자가 올린 참조 이미지(도메인이 Supabase 라 next/image 최적화 대신 원본을 그대로 쓴다) */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={post.imageUrl} alt="참조 이미지" className={styles.refImg} style={{ width: '100%', height: '100%' }} />
          </div>
        )}
      </div>
      <div className={styles.detailHr} />
      <div className={styles.descBlock}>
        <div className={styles.descHead}>
          <span className={styles.descLabel}>설명</span>
          <span className={styles.descActs}>
            <span className={styles.likeText}><IconHeart filled size={12} /> {post.likes}</span>
            <button type="button" onClick={() => s.plazaCopyLink(post)} title="공유 링크 복사" className={clsx('pb-ghost', styles.copyBtn)}>
              <IconLinkCopy size={13} />링크 복사
            </button>
          </span>
        </div>
        <p className={styles.descText}>{post.description || '설명을 아직 적지 않았어요.'}</p>
        {post.tags.length > 0 && (
          <div className={styles.tagRow}>
            {post.tags.map((t) => (
              <button key={t} type="button" onClick={() => tagPick(t)} title="이 태그로 검색" className={styles.tagChip}>#{t}</button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
