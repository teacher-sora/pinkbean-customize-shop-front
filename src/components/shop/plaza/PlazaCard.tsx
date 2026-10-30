'use client'

// 코디 광장 카드 — 썸네일(실제 코디) + 이름 한 줄. 프리셋 카드와 같은 테두리·hover(-4px)를 쓴다.
// 넓은 화면: 우상단 세로 레일 = 가져오기 · 링크 복사, 썸네일 우하단 = 좋아요 수 + 하트.
// 모바일: 그림 위 단추가 좁은 칸에서 캐릭터 머리를 가려(사용자 지적) 이름 아래 막대로 뺀다 — 목록 카드의 [북마크 · 염색] 막대와 같은 부품
//   (list .bar · .act). [가져오기][♡ 수] 두 칸, 링크 복사는 상세에서. 좌상단 = (수상작이면) 배지 · (내 글이면) 내리기는 화면마다 같다.
// 카드를 누르면 상세, 아이콘은 stopPropagation 으로 카드 클릭을 막는다.

import { CONFIRM_ATTR } from '@/lib/confirmTwice'
import clsx from 'clsx'
import SnapThumb, { warmSnap } from '../SnapThumb'
import { useShop } from '../ShopContext'
import { PLAZA_AWARD_LABEL, PLAZA_AWARD_TITLE, type PlazaPost } from '@/lib/plaza'
import { IconHeart, IconLinkCopy, IconTakeDown, IconTrashSolid } from '../ui/Icons'
import styles from './plaza.module.css'
import list from '../list/list.module.css'
import { CARD_FIT_W_M, CARD_FRACTION_M } from '@/lib/shopData'

// 모바일 마네킹 비율 · 폭 상한은 모든 모바일 카드와 같은 값(shopData.CARD_FRACTION_M · CARD_FIT_W_M)
const CARD_FRACTION = 0.38 // 프리셋 카드와 같은 마네킹 비율

export default function PlazaCard({ post, mobile, priority = 0 }: { post: PlazaPost; mobile: boolean; priority?: number }) {
  const s = useShop()
  const stop = (fn: () => void) => (e: React.MouseEvent) => { e.stopPropagation(); fn() }
  const name = post.name || '이름 없는 코디'
  return (
    <div onClick={() => s.openPlazaPost(post)} onPointerEnter={() => warmSnap(post.snapshot, s.index)} onPointerDown={() => warmSnap(post.snapshot, s.index)} title={name} className="pb-presetwrap" style={{ cursor: 'pointer' }}>
      <div className="pb-preset">
        {!mobile && (
          <div className={styles.rail}>
            <button type="button" onClick={stop(() => s.plazaTakeDirect(post))} title="내 프리셋으로 가져오기" aria-label="가져오기" className={styles.railBtn}><IconTakeDown /></button>
            <button type="button" onClick={stop(() => s.plazaCopyLink(post))} title="공유 링크 복사" aria-label="링크 복사" className={styles.railBtn}><IconLinkCopy /></button>
          </div>
        )}
        {/* 내리기는 반대쪽(좌상단)에 둔다 — 가져오기·링크 복사와 나란히 두면 잘못 누르기 쉽다 */}
        {/* 대회 수상 배지도 좌상단이다. 내 글이면 배지 아래로 내리기가 온다 — 겹치지 않는다. */}
        {(post.award || post.mine) && (
          <div className={clsx(styles.railLeft, mobile && styles.railM, post.award && styles.railLeftAward)}>
            {post.award && <span className={clsx(styles.award, AWARD_CLASS[post.award.kind])} title={PLAZA_AWARD_TITLE[post.award.kind]}>{PLAZA_AWARD_LABEL[post.award.kind]}</span>}
            {post.mine && <button type="button" onClick={stop(() => s.plazaRemove(post))} {...{ [CONFIRM_ATTR]: `plaza:${post.id}` }} title="광장에서 내리기 (두 번 누르기)" aria-label="내리기"
              className={clsx(styles.railBtn, styles.delBtn, mobile && styles.railBtnM)}><IconTrashSolid /></button>}
          </div>
        )}
        <div className={styles.thumb}>
          <SnapThumb snap={post.snapshot} fraction={mobile ? CARD_FRACTION_M : CARD_FRACTION} fitW={mobile ? CARD_FIT_W_M : undefined} priority={priority} />
          {/* 대회 출품 날짜(간략히 M.D) — 순번(#n)은 중간 글이 내려가면 비어 보여 쓰지 않는다. */}
          {post.contest && (
            <span className={clsx(styles.contestNo, mobile && styles.contestNoM)} title={`${fullDate(post.createdAt)} 등록`}>{shortDate(post.createdAt)}</span>
          )}
          {!mobile && (
            <div className={styles.likeWrap}>
              <span className={styles.likeCount}>{post.likes > 999 ? '999+' : post.likes}</span>
              <button type="button" onClick={stop(() => s.plazaLike(post))} title={post.liked ? '좋아요 취소' : '좋아요'} aria-label="좋아요" aria-pressed={post.liked}
                className={clsx(styles.likeBtn, post.liked && styles.likeOn)}><IconHeart filled={post.liked} /></button>
            </div>
          )}
        </div>
        <div className={clsx(styles.meta, mobile && styles.metaM)}>
          <span className={clsx(styles.name, mobile && styles.nameM)}>{name}</span>
        </div>
        {mobile && (
          <div className={clsx(list.bar, list.barM, styles.barM)}>
            <button type="button" onClick={stop(() => s.plazaTakeDirect(post))} title="내 프리셋으로 가져오기" aria-label="가져오기" className={clsx('pb-cardact', list.act, list.actM)}><IconTakeDown size={13} /></button>
            <button type="button" onClick={stop(() => s.plazaLike(post))} title={post.liked ? '좋아요 취소' : '좋아요'} aria-label="좋아요" aria-pressed={post.liked}
              className={clsx('pb-cardact', list.act, list.actM, list.actDye, styles.likeAct, post.liked && styles.likeActOn)}><IconHeart filled={post.liked} size={12} /><span>{post.likes > 999 ? '999+' : post.likes}</span></button>
          </div>
        )}
      </div>
    </div>
  )
}

// 순위 = 솔리드 핑크 · 픽 = 핑크 배경 · 추첨 = 흰 바탕 외곽선. 세 단계 모두 기존 핑크 값만 쓴다.
const AWARD_CLASS = { rank1: styles.awardRank, rank2: styles.awardRank, rank3: styles.awardRank, pick: styles.awardPick, lucky: styles.awardLucky }

const shortDate = (iso: string) => { const d = new Date(iso); return `${d.getMonth() + 1}.${d.getDate()}` }
const fullDate = (iso: string) => new Date(iso).toLocaleString('ko-KR', { month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' })
