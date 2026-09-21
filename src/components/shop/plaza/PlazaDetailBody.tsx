'use client'

// 코디 광장 글 상세 — 공용 서피스 본문.
//  · PC·태블릿: 왼쪽 = 미리보기(첨부 이미지가 있으면 두 칸 그대로) · 설명 · 태그, 오른쪽 = 댓글 열.
//    두 칸을 세로로 쌓거나 한 칸으로 합치지 않는다 — 코디와 참고 이미지를 **나란히 두고 비교**하는 게 이 화면의 목적이다
//    (사용자 지시 2026-09-20). 대신 댓글 열이 들어온 만큼 스테이지를 조금 줄였다(432×280 → 292×250).
//  · 모바일: 폭이 없어 나눌 수 없다. 스테이지는 지금처럼 나란히 두고 댓글은 설명 아래로 이어 붙인다
//    (가로 슬라이드로 빼면 댓글을 보는 동안 코디가 사라진다).
// 태그를 누르면 시트를 닫고 그 태그로 검색한다(닫힘 애니메이션을 끝까지 보여준 뒤 검색어를 넣는다).
// 구역(2026-09-21): 비교 칸 → 행동 줄(좋아요·링크·가져오기) ┆ 설명·태그 ┆ 착용 아이템 ┆ 댓글.
//  · 행동 줄은 비교 칸 바로 아래에 둔다 — 보고 있는 코디에 대한 행동이고, 모바일에서 스크롤 없이 '가져오기'가 보여야 한다.
//  · 올린 사람의 글(설명)과 행동은 성격이 달라 끊긴 구분선(양 끝이 비어 있는 hr)으로 나눈다.
//  · 착용 아이템은 가져오기 전에 무엇을 입었는지 바로 보이게(가져와서 확인하는 번거로움을 덜기 — 사용자 제안).

import clsx from 'clsx'
import Image from 'next/image'
import { useEffect, useState } from 'react'
import bg from '@/assets/pinkbean-bg.png'
import { CATS } from '@/lib/catalog'
import type { PlazaPost } from '@/lib/plaza'
import { CAT_TO_SLOT } from '@/lib/shopData'
import SnapThumb from '../SnapThumb'
import { useShop } from '../ShopContext'
import { IconHeart, IconLinkCopy, IconTakeDown } from '../ui/Icons'
import PlazaComments from './PlazaComments'
import PlazaRefViewer from './PlazaRefViewer'
import styles from './plaza.module.css'

const DETAIL_FRACTION = 0.5

export default function PlazaDetailBody({ post, mobile }: { post: PlazaPost; mobile: boolean }) {
  const s = useShop()
  // 좋아요는 상세에서도 누를 수 있어야 한다 → 서피스가 들고 있는 사본이 아니라 **지금 목록의 값**을 읽는다.
  const live = s.plazaPosts.find((p) => p.id === post.id) || post
  // 착용 아이템(부위 순서대로). 이름은 부위 리스트를 읽어야 알 수 있어 비동기로 채운다.
  const [items, setItems] = useState<{ slot: string; label: string; name: string; dyed: boolean }[] | null>(null)
  useEffect(() => {
    let alive = true
    setItems(null)
    const snap = post.snapshot
    s.resolveSnapItems(snap).then((eq) => {
      if (!alive) return
      const out: { slot: string; label: string; name: string; dyed: boolean }[] = []
      for (const c of CATS) {
        const slot = CAT_TO_SLOT[c.id]
        if (!slot) continue
        const dyed = !!snap.dyePalette?.[slot] || !!snap.dyeHsb?.[slot]
        if (slot === 'skin') {
          const t = s.index?.base.tones.find((x) => x.tone === snap.tone)
          out.push({ slot, label: c.label, name: t?.name || `피부 ${snap.tone}`, dyed: false })
          continue
        }
        const it = eq[slot]
        if (it && !snap.hidden?.[slot]) out.push({ slot, label: c.label, name: it.name || it.id, dyed })
      }
      setItems(out)
    }).catch(() => { if (alive) setItems([]) })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [post.id])

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
            {/* 참조 이미지 — 확대·이동으로 살펴본다(원본 그대로, Supabase 도메인이라 next/image 대신 img). */}
            <PlazaRefViewer src={post.imageUrl} />
          </div>
        )}
      </div>
      {/* 하트 · 링크 복사 · 가져오기를 한 줄에 모은다(사용자 지시). 푸터에는 닫기만 남긴다. */}
      <div className={clsx(styles.actBar, mobile && styles.actBarM)}>
        <button type="button" onClick={() => s.plazaLike(live)} aria-pressed={live.liked}
          title={live.liked ? '좋아요 취소' : '좋아요'}
          className={clsx(styles.actBtn, styles.actLike, live.liked && styles.actBtnOn)}>
          <IconHeart filled={live.liked} size={13} />
          <span className={styles.actNum} style={{ width: `calc(${String(live.likes).length}ch + 2px)` }}>{live.likes}</span>
        </button>
        <button type="button" onClick={() => s.plazaCopyLink(post)} title="공유 링크 복사" className={clsx(styles.actBtn, styles.actLink)}>
          <IconLinkCopy size={13} />링크 복사
        </button>
        <button type="button" onClick={() => s.plazaTakeDirect(post)} title="내 프리셋으로 가져오기"
          className={clsx(styles.actBtn, styles.actTake)}>
          <IconTakeDown />가져오기
        </button>
      </div>
      <div className={styles.secHr} />
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
      <div className={styles.secHr} />
      <div className={styles.descBlock}>
        <span className={styles.descLabel}>착용 아이템</span>
        {!items ? (
          <div className={styles.itemRow}>{[64, 88, 72, 96].map((w, i) => <span key={i} className={clsx('pb-skel', styles.itemSkel)} style={{ width: w }} />)}</div>
        ) : (
          <div className={styles.itemRow}>
            {items.map((it) => (
              <span key={it.slot} className={styles.itemChip} title={`${it.label} · ${it.name}${it.dyed ? ' (염색)' : ''}`}>
                <span className={styles.itemSlot}>{it.label}</span>{it.name}{it.dyed && <span className={styles.itemDyed}>염색</span>}
              </span>
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
        <div className={styles.secHr} />
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
