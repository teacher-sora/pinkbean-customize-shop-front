'use client'

// 코디 광장 글 상세 — 공용 서피스 본문.
//  · PC·태블릿: 왼쪽 = 미리보기(첨부 이미지가 있으면 두 칸 그대로) · 설명 · 태그, 오른쪽 = 댓글 열.
//    두 칸을 세로로 쌓거나 한 칸으로 합치지 않는다 — 코디와 참고 이미지를 **나란히 두고 비교**하는 게 이 화면의 목적이다
//    (사용자 지시 2026-09-20). 대신 댓글 열이 들어온 만큼 스테이지를 조금 줄였다(432×280 → 292×250).
//  · 모바일: 폭이 없어 나눌 수 없다. 스테이지는 지금처럼 나란히 두고 댓글은 설명 아래로 이어 붙인다
//    (가로 슬라이드로 빼면 댓글을 보는 동안 코디가 사라진다).
// 태그를 누르면 시트를 닫고 그 태그로 검색한다(닫힘 애니메이션을 끝까지 보여준 뒤 검색어를 넣는다).

import clsx from 'clsx'
import Image from 'next/image'
import bg from '@/assets/pinkbean-bg.png'
import type { PlazaPost } from '@/lib/plaza'
import SnapThumb from '../SnapThumb'
import { useShop } from '../ShopContext'
import { IconHeart, IconLinkCopy, IconTakeDown } from '../ui/Icons'
import PlazaComments from './PlazaComments'
import styles from './plaza.module.css'

const DETAIL_FRACTION = 0.5

export default function PlazaDetailBody({ post, mobile }: { post: PlazaPost; mobile: boolean }) {
  const s = useShop()
  // 좋아요는 상세에서도 누를 수 있어야 한다 → 서피스가 들고 있는 사본이 아니라 **지금 목록의 값**을 읽는다.
  const live = s.plazaPosts.find((p) => p.id === post.id) || post
  const tagPick = (t: string) => {
    s.closeSurface()
    setTimeout(() => { s.setPlazaQ(t); s.setPlazaFilter('all') }, 330)
  }

  const main = (
    <>
      <div className={clsx(styles.stages, mobile && styles.stagesM)}>
        <div className={styles.stage}>
          <Image src={bg} alt="" fill sizes="300px" className={styles.stageImg} />
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
      {/* 하트 · 링크 복사 · 가져오기를 한 줄에 모은다(사용자 지시). 푸터에는 닫기만 남긴다. */}
      <div className={clsx(styles.actBar, mobile && styles.actBarM)}>
        <button type="button" onClick={() => s.plazaLike(live)} aria-pressed={live.liked}
          title={live.liked ? '좋아요 취소' : '좋아요'}
          className={clsx(styles.actBtn, live.liked && styles.actBtnOn)}>
          <IconHeart filled={live.liked} size={13} />{live.likes}
        </button>
        <button type="button" onClick={() => s.plazaCopyLink(post)} title="공유 링크 복사" className={styles.actBtn}>
          <IconLinkCopy size={13} />링크 복사
        </button>
        <button type="button" onClick={() => s.plazaTakeDirect(post)} title="내 프리셋으로 가져오기"
          className={clsx(styles.actBtn, styles.actTake)}>
          <IconTakeDown />가져오기
        </button>
      </div>
      <div className={styles.descBlock}>
        <span className={styles.descLabel}>설명</span>
        {/* 등록 뒤에는 고칠 수 없으므로 '아직 적지 않았다'가 아니라 끝난 사실로 적는다(사용자 지시). */}
        <p className={clsx(styles.descText, !post.description && styles.descNone)}>
          {post.description || '설명 없이 올라온 코디예요.'}
        </p>
        {post.tags.length > 0 && (
          <div className={styles.tagRow}>
            {post.tags.map((t) => (
              <button key={t} type="button" onClick={() => tagPick(t)} title="이 태그로 검색" className={styles.tagChip}>#{t}</button>
            ))}
          </div>
        )}
      </div>
    </>
  )

  if (mobile) {
    return (
      <div className={clsx('pb-scroll', styles.detail)}>
        {main}
        <div className={styles.detailHr} />
        <PlazaComments post={post} mobile />
      </div>
    )
  }
  return (
    <div className={styles.detailPc}>
      <div className={clsx('pb-scroll', styles.detailMain)}>{main}</div>
      <PlazaComments post={post} mobile={false} />
    </div>
  )
}
