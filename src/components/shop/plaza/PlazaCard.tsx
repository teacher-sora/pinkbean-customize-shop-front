'use client'

// 코디 광장 카드 — 썸네일(실제 코디) + 이름 한 줄. 프리셋 카드와 같은 테두리·hover(-4px)를 쓴다.
// 우상단 세로 레일 = 가져오기 · 링크 복사 · (내 글이면) 내리기, 썸네일 우하단 = 좋아요 수 + 하트.
// 카드를 누르면 상세, 아이콘은 stopPropagation 으로 카드 클릭을 막는다(핸드오프 §1).

import clsx from 'clsx'
import SnapThumb from '../SnapThumb'
import { useShop } from '../ShopContext'
import type { PlazaPost } from '@/lib/plaza'
import { IconHeart, IconLinkCopy, IconTakeDown, IconTrashSolid } from '../ui/Icons'
import styles from './plaza.module.css'

const CARD_FRACTION = 0.38 // 프리셋 카드와 같은 마네킹 비율

export default function PlazaCard({ post, mobile }: { post: PlazaPost; mobile: boolean }) {
  const s = useShop()
  const stop = (fn: () => void) => (e: React.MouseEvent) => { e.stopPropagation(); fn() }
  const name = post.name || '이름 없는 코디'
  return (
    <div onClick={() => s.openPlazaPost(post)} title={name} className="pb-presetwrap" style={{ cursor: 'pointer' }}>
      <div className="pb-preset">
        <div className={clsx(styles.rail, mobile && styles.railM)}>
          <button type="button" onClick={stop(() => s.plazaTakeDirect(post))} title="내 프리셋으로 가져오기" aria-label="가져오기"
            className={clsx(styles.railBtn, mobile && styles.railBtnM)}><IconTakeDown /></button>
          <button type="button" onClick={stop(() => s.plazaCopyLink(post))} title="공유 링크 복사" aria-label="링크 복사"
            className={clsx(styles.railBtn, mobile && styles.railBtnM)}><IconLinkCopy /></button>
          {post.mine && (
            <button type="button" onClick={stop(() => s.plazaRemove(post))} title="광장에서 내리기 (두 번 누르기)" aria-label="내리기"
              className={clsx(styles.railBtn, styles.delBtn, mobile && styles.railBtnM)}><IconTrashSolid /></button>
          )}
        </div>
        <div className={styles.thumb}>
          <SnapThumb snap={post.snapshot} fraction={CARD_FRACTION} />
          <div className={clsx(styles.likeWrap, mobile && styles.likeWrapM)}>
            <span className={styles.likeCount}>{post.likes > 999 ? '999+' : post.likes}</span>
            <button type="button" onClick={stop(() => s.plazaLike(post))} title={post.liked ? '좋아요 취소' : '좋아요'} aria-label="좋아요" aria-pressed={post.liked}
              className={clsx(styles.likeBtn, mobile && styles.likeBtnM, post.liked && styles.likeOn)}><IconHeart filled={post.liked} /></button>
          </div>
        </div>
        <div className={clsx(styles.meta, mobile && styles.metaM)}>
          <span className={clsx(styles.name, mobile && styles.nameM)}>{name}</span>
        </div>
      </div>
    </div>
  )
}
