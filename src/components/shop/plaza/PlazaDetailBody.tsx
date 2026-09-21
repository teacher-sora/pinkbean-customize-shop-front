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
//    부위 염색 칩과 같은 스프라이트 칩(염색 반영)으로, 기본은 **닫힌 아코디언**(2026-09-21 사용자 지시) —
//    닫혀 있는 동안은 스프라이트를 하나도 받지 않아 상세가 가볍게 열리고, 모바일에서는 댓글이 한 단계 위로 온다.

import clsx from 'clsx'
import Image from 'next/image'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import bg from '@/assets/pinkbean-bg.png'
import { CATS } from '@/lib/catalog'
import type { ListItem } from '@/lib/core/data'
import type { PlazaPost } from '@/lib/plaza'
import { CAT_TO_SLOT } from '@/lib/shopData'
import SnapThumb from '../SnapThumb'
import { useShop, type Snapshot } from '../ShopContext'
import { LookSprite, lookDyed } from '../info/SlotSprite'
import { SHEET_EASE, SHEET_MS } from '../surface/sheetMotion'
import surf from '../surface/surface.module.css'
import { IconCaretDown, IconHeart, IconLinkCopy, IconTakeDown } from '../ui/Icons'
import PlazaComments from './PlazaComments'
import PlazaRefViewer from './PlazaRefViewer'
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
      <div className={clsx(styles.stages, mobile && styles.stagesM, mobile && post.imageUrl && styles.stagesPairM)}>
        <div className={styles.stage}>
          <Image src={bg} alt="" fill sizes="300px" className={styles.stageImg} />
          <div className={styles.stageTone} />
          <SnapThumb snap={post.snapshot} fraction={DETAIL_FRACTION} />
        </div>
        {post.imageUrl && (
          <div className={clsx(styles.stage, styles.stageRef)}>
            {/* 참조 이미지 — 확대·이동으로 살펴본다(원본 그대로, Supabase 도메인이라 next/image 대신 img). */}
            <PlazaRefViewer src={post.imageUrl} initial={post.imageView} />
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
          {post.description || '작성된 설명이 없어요 :)'}
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
      <WornItems snap={post.snapshot} postId={post.id} mobile={mobile} />
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

type Worn = { slot: string; label: string; item: ListItem | null; name: string; dyed: boolean; off: boolean }

// 착용 아이템 아코디언. 펼침·접힘은 높이 전환이 아니라 FLIP — 레이아웃은 한 번에 바꾸고,
// 칩 묶음은 overflow:hidden 창 안에서, 그 아래 구역(모바일 댓글)은 같은 거리만큼 translateY 로 움직인다.
//  · 펼침: 커밋(칩 등장) → 칩·아래 구역을 칩 높이만큼 위로 되돌려 놓고 0 으로.
//  · 접힘: 먼저 transform 으로 접힌 자리까지 옮긴 뒤 커밋 + 즉시 정리(먼저 커밋하면 칩이 툭 사라진다).
function WornItems({ snap, postId, mobile }: { snap: Snapshot; postId: string; mobile: boolean }) {
  const s = useShop()
  // 이름·아이콘 경로는 부위 리스트를 읽어야 알 수 있어 비동기로 채운다(리스트 JSON 이라 가볍다 — 스프라이트는 펼칠 때 받는다).
  const [items, setItems] = useState<Worn[] | null>(null)
  useEffect(() => {
    let alive = true
    setItems(null)
    s.resolveSnapItems(snap).then((eq) => {
      if (!alive) return
      const toneName = s.index?.base.tones.find((x) => x.tone === snap.tone)?.name
      const out: Worn[] = []
      for (const c of CATS) {
        const slot = CAT_TO_SLOT[c.id]
        if (!slot) continue
        const off = !!snap.dyeOff?.[slot]
        if (slot === 'skin') {
          out.push({ slot, label: c.label, item: null, name: toneName || `피부 ${snap.tone}`, off, dyed: lookDyed(slot, null, toneName, undefined, snap.dyeHsb?.skin) })
          continue
        }
        const it = eq[slot]
        if (!it || snap.hidden?.[slot]) continue
        out.push({ slot, label: c.label, item: it, name: it.name || it.id, off, dyed: lookDyed(slot, it, toneName, snap.dyePalette?.[slot], snap.dyeHsb?.[slot]) })
      }
      setItems(out)
    }).catch(() => { if (alive) setItems([]) })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId])

  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const innerRef = useRef<HTMLDivElement>(null)
  const moving = useRef<HTMLElement[]>([])
  const busy = useRef(false)
  const timer = useRef(0)
  useEffect(() => () => clearTimeout(timer.current), [])

  const followers = () => {
    const out: HTMLElement[] = []
    for (let n = wrapRef.current?.nextElementSibling; n; n = n.nextElementSibling) out.push(n as HTMLElement)
    return out
  }
  const put = (els: HTMLElement[], y: number, animate: boolean) => {
    for (const el of els) { el.style.transition = animate ? SHEET_EASE : 'none'; el.style.transform = y ? `translateY(${y}px)` : '' }
  }
  const clear = () => { put(moving.current, 0, false); for (const el of moving.current) el.style.transition = ''; moving.current = []; busy.current = false }

  const toggle = () => {
    if (busy.current) return
    if (!open) { setOpen(true); return }
    const inner = innerRef.current
    if (!inner) { setOpen(false); return }
    busy.current = true
    const h = inner.offsetHeight
    moving.current = [inner, ...followers()]
    put(moving.current, -h, true)
    timer.current = window.setTimeout(() => setOpen(false), SHEET_MS + 20)
  }
  useLayoutEffect(() => {
    if (!open) { clear(); return }
    const inner = innerRef.current
    if (!inner) return
    busy.current = true
    const h = inner.offsetHeight
    moving.current = [inner, ...followers()]
    put(moving.current, -h, false)
    inner.getBoundingClientRect()
    requestAnimationFrame(() => {
      put(moving.current, 0, true)
      timer.current = window.setTimeout(clear, SHEET_MS + 20)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  return (
    <div ref={wrapRef} className={styles.worn}>
      <button type="button" onClick={toggle} aria-expanded={open} aria-controls={`worn-${postId}`}
        title={open ? '착용 아이템 접기' : '착용 아이템 펼치기'} className={styles.wornBar}>
        <span className={styles.descLabel}>착용 아이템</span>
        {items && <span className={styles.wornCount}>{items.length}</span>}
        <IconCaretDown size={11} className={clsx(styles.wornCaret, open && styles.wornCaretOn)} />
      </button>
      <div id={`worn-${postId}`} className={styles.wornWin}>
        {open && (
          <div ref={innerRef} className={styles.wornInner}>
            {!items ? (
              <div className={clsx(surf.partGrid, mobile && surf.partGridM)}>
                {[0, 1, 2].map((i) => <span key={i} className={clsx('pb-skel', styles.wornSkel)} />)}
              </div>
            ) : items.length === 0 ? (
              <p className={clsx(styles.descText, styles.descNone)}>보이는 착용 아이템이 없어요</p>
            ) : (
              <div className={clsx(surf.partGrid, mobile && surf.partGridM)}>
                {items.map((w) => (
                  <span key={w.slot} title={`${w.label} · ${w.name}${w.dyed ? (w.off ? ' (염색 꺼짐)' : ' (염색)') : ''}`}
                    className={clsx(surf.partChip, styles.wornChip)}>
                    <span className={surf.partThumb}>
                      <span className={surf.partSprite}>
                        <LookSprite slot={w.slot} item={w.item} tone={snap.tone}
                          palette={w.off ? undefined : snap.dyePalette?.[w.slot]} hsb={w.off ? undefined : snap.dyeHsb?.[w.slot]} />
                      </span>
                      {w.dyed && <span title={w.off ? '염색 비활성화됨' : '염색됨'} className={clsx(surf.partDot, w.off && surf.partDotOff)} />}
                    </span>
                    <span className={surf.partText}>
                      <span className={surf.partSlot}>{w.label}</span>
                      <span className={surf.partName}>{w.name}</span>
                    </span>
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
