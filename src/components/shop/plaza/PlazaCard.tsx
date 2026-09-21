'use client'

// 코디 광장 카드 — 썸네일(실제 코디) + 이름 한 줄. 프리셋 카드와 같은 테두리·hover(-4px)를 쓴다.
// 우상단 세로 레일 = 가져오기 · 링크 복사 · (내 글이면) 내리기, 썸네일 우하단 = 좋아요 수 + 하트.
// 카드를 누르면 상세, 아이콘은 stopPropagation 으로 카드 클릭을 막는다(핸드오프 §1).

import { CONFIRM_ATTR } from '@/lib/confirmTwice'
import clsx from 'clsx'
import SnapThumb from '../SnapThumb'
import { useShop } from '../ShopContext'
import type { PlazaPost } from '@/lib/plaza'
import { IconHeart, IconLinkCopy, IconTakeDown, IconTrashSolid } from '../ui/Icons'
import styles from './plaza.module.css'

const CARD_FRACTION = 0.38 // 프리셋 카드와 같은 마네킹 비율
// 모바일은 2열이라 칸이 프리셋 탭(3열)보다 넓은데 같은 비율이면 인물이 작아 보였다(2026-09-21 사용자 지적).
// ⚠️ 도트가 뭉개지지 않게 배율이 **정수로 스냅**되므로(modelPlacement) 조금 올려서는 안 바뀐다 — 0.46 은 그대로였다.
//    칸 높이 ≈142px(폭 390) 기준 0.54 면: DPR 3 → 3→4배(64→85px) · 2.75 → 2→3배(46→70px) · DPR 2 는 2배 그대로(64px).
//    DPR 2 까지 올리면(0.57) 3배 = 96px 라 머리가 오른쪽 아이콘 레일에 닿았다 — 그래서 한 단계 아래에서 멈춘다.
const CARD_FRACTION_M = 0.54

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
        </div>
        {/* 내리기는 반대쪽(좌상단)에 둔다 — 가져오기·링크 복사와 나란히 두면 잘못 누르기 쉽다(사용자 지시) */}
        {post.mine && (
          <div className={clsx(styles.railLeft, mobile && styles.railM)}>
            <button type="button" onClick={stop(() => s.plazaRemove(post))} {...{ [CONFIRM_ATTR]: `plaza:${post.id}` }} title="광장에서 내리기 (두 번 누르기)" aria-label="내리기"
              className={clsx(styles.railBtn, styles.delBtn, mobile && styles.railBtnM)}><IconTrashSolid /></button>
          </div>
        )}
        <div className={styles.thumb}>
          <SnapThumb snap={post.snapshot} fraction={mobile ? CARD_FRACTION_M : CARD_FRACTION} />
          {/* 대회 등록 순번 — 누가 먼저 올렸는지(선착) 보이게 */}
          {post.contest && post.contestNo != null && (
            <span className={clsx(styles.contestNo, mobile && styles.contestNoM)} title={`대회 ${post.contestNo}번째 출품`}>#{post.contestNo}</span>
          )}
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
