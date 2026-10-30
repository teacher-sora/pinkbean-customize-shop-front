'use client'

// 코디 광장 글 상세 — 공용 서피스 본문.
//  · PC·태블릿: 왼쪽 = 미리보기(첨부 이미지가 있으면 두 칸 그대로) · 설명 · 태그, 오른쪽 = 댓글 열.
//    두 칸을 세로로 쌓거나 한 칸으로 합치지 않는다 — 코디와 참고 이미지를 **나란히 두고 비교**하는 게 이 화면의 목적이다.
//    대신 댓글 열이 들어온 만큼 스테이지를 줄여 둔다.
//  · 모바일: 폭이 없어 나눌 수 없다. 스테이지는 지금처럼 나란히 두고 댓글은 설명 아래로 이어 붙인다
//    (가로 슬라이드로 빼면 댓글을 보는 동안 코디가 사라진다).
// 태그를 누르면 시트를 닫고 그 태그로 검색한다(닫힘 애니메이션을 끝까지 보여준 뒤 검색어를 넣는다).
// 구역: 비교 칸 → 행동 줄(좋아요·링크·가져오기) ┆ 설명·태그 ┆ 착용 아이템 ┆ 댓글.
//  · 행동 줄은 비교 칸 바로 아래에 둔다 — 보고 있는 코디에 대한 행동이고, 모바일에서 스크롤 없이 '가져오기'가 보여야 한다.
//  · 올린 사람의 글(설명)과 행동은 성격이 달라 끊긴 구분선(양 끝이 비어 있는 hr)으로 나눈다.
//  · 착용 아이템은 가져오기 전에 무엇을 입었는지 바로 보이게(가져와서 확인하는 번거로움을 덜기).
//    부위 염색 칩과 같은 스프라이트 칩(염색 반영)을 **아코디언**에 담는다. 기본은 펼침(아래 WornItems) —
//    접혀 있는 동안은 스프라이트를 하나도 받지 않는다.
//  · 칩마다 '입기' 버튼(사용자 요청 — 코디 전체가 아니라 그 부위만 바로): 누르면 그 부위의 아이템 · 염색을 지금 코디에 입힌다
//    (ShopContext.wearFromSnap). 창은 그대로 두어 다른 부위도 이어서 입을 수 있다. 아이템 · 염색 · 점 위치까지 완전히 같게 입고 있을 때만 체크로 바뀐다.
//    버튼은 글자 없이 작은 동그라미 아이콘만(사용자 지시 — 글자 버튼은 쓸데없이 커서 이름을 가린다).

import clsx from 'clsx'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { CardStageBg } from '../preview/StageBg'
import { CATS } from '@/lib/catalog'
import type { ListItem } from '@/lib/core/data'
import { PLAZA_AWARD_LABEL, PLAZA_AWARD_TITLE, type PlazaPost } from '@/lib/plaza'
import { CAT_TO_SLOT, isDyeableSkin, skinDyeFamily, viewTone } from '@/lib/shopData'
import SnapThumb from '../SnapThumb'
import { useShop, type Snapshot } from '../ShopContext'
import { DyeBand, LookSprite, lookDyed } from '../info/SlotSprite'
import { glideTo, place, release } from '../surface/glide'
import surf from '../surface/surface.module.css'
import ui from '../ui/ui.module.css'
import { IconCaretDown, IconHeart, IconLinkCopy, IconTakeDown } from '../ui/Icons'
import { ChipAct } from '../ui/ChipAct'
import PlazaComments from './PlazaComments'
import PlazaRefViewer from './PlazaRefViewer'
import styles from './plaza.module.css'

const DETAIL_FRACTION = 0.5

export default function PlazaDetailBody({ post, mobile }: { post: PlazaPost; mobile: boolean }) {
  const s = useShop()
  // [가져오기]가 바로 반영되게 상세가 열리면 미리 받고 염색까지 칠해 둔다 — 코디 룩북 상세와 같은 함수(warmWear, 그 코디의 연출로 — take)
  useEffect(() => { s.warmWear(post.snapshot, true, true) }, [post.id]) // eslint-disable-line react-hooks/exhaustive-deps
  // 좋아요는 상세에서도 누를 수 있어야 한다 → 서피스가 들고 있는 사본이 아니라 **지금 목록의 값**을 읽는다.
  const live = s.plazaPosts.find((p) => p.id === post.id) || post
  const tagPick = (t: string) => {
    s.closeSurface()
    setTimeout(() => { s.setPlazaQ(t); s.setPlazaFilter('all') }, 330)
  }

  const main = (
    <>
      <div className={clsx(styles.stages, mobile && styles.stagesM, mobile && post.imageUrl && styles.stagesPairM)}>
        {/* 대회 수상은 상세에서 **띠지**로 보인다(카드의 작은 배지 대신, 앱에서 가장 큰 띠지).
            코디·프리셋 카드의 띠지처럼 칸 위로 살짝 걸친다 — 칸(.stage)은 넘치는 것을 자르므로 칸 **밖**(.stages)에 둔다.
            글자·색은 카드 배지와 같고, 두 낱말이면('주최자 픽') 두 줄로 쌓는다. */}
        {post.award && (
          <span title={PLAZA_AWARD_TITLE[post.award.kind]}
            className={clsx(styles.ribbon, mobile && styles.ribbonM, post.award.kind === 'pick' && styles.ribbonPick, post.award.kind === 'lucky' && styles.ribbonLucky, PLAZA_AWARD_LABEL[post.award.kind].includes(' ') && styles.ribbonTwo)}>
            {PLAZA_AWARD_LABEL[post.award.kind].split(' ').map((w) => <span key={w}>{w}</span>)}
          </span>
        )}
        <div className={styles.stage}>
          {/* 그 글의 배경(Snapshot.bg — 올린 사람의 미리보기 배경, 직접 올린 그림은 '시스템'으로 올라온다). 담기지 않은 옛 글은 피팅룸. 캐릭터와 같은 도트 크기 · 발 자리 */}
          <CardStageBg sel={post.snapshot.bg} fraction={DETAIL_FRACTION} />
          <SnapThumb snap={post.snapshot} fraction={DETAIL_FRACTION} priority={-1} />
        </div>
        {post.imageUrl && (
          <div className={clsx(styles.stage, styles.stageRef)}>
            {/* 참조 이미지 — 확대·이동으로 살펴본다(원본 그대로, Supabase 도메인이라 next/image 대신 img). */}
            <PlazaRefViewer src={post.imageUrl} initial={post.imageView} />
          </div>
        )}
      </div>
      {/* 하트 · 링크 복사 · 가져오기를 한 줄에 모은다. 푸터에는 닫기만 남긴다. */}
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
        {/* 등록 뒤에는 고칠 수 없으므로 '아직 적지 않았다'가 아니라 끝난 사실로 적는다. */}
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
      <div className={clsx('pb-scroll', 'pb-fade', styles.detail)}>
        {main}
        <div className={styles.secHr} />
        <PlazaComments post={post} mobile />
      </div>
    )
  }
  return (
    <div className={styles.detailPc}>
      <div className={clsx('pb-scroll', 'pb-fade', styles.detailMain)}>{main}</div>
      <PlazaComments post={post} mobile={false} />
    </div>
  )
}

type Worn = { slot: string; label: string; item: ListItem | null; name: string; dyed: boolean; off: boolean; dyeable: boolean; skinFamily?: number }

// 착용 아이템 아코디언. 펼침·접힘은 높이 전환이 아니라 FLIP — 레이아웃은 한 번에 바꾸고,
// 칩 묶음은 overflow:hidden 창 안에서, 그 아래 구역(모바일 댓글)은 같은 거리만큼 translateY 로 움직인다.
//  · 펼침: 커밋(칩 등장) → 칩·아래 구역을 칩 높이만큼 위로 되돌려 놓고 0 으로.
//  · 접힘: 먼저 transform 으로 접힌 자리까지 옮긴 뒤 칩을 뺀다(먼저 빼면 칩이 툭 사라진다).
//  · 창의 윗변은 막대 hover 면(아래로 6px 튀어나옴)의 **아래**에 둔다 — 칩이 막대 면 위로 올라와 잘려 보이지 않게.
// flat = 접지 않고 늘 보인다(코디 룩북 상세 — 착용 아이템을 보려고 여는 화면이라 접을 까닭이 없다, 사용자 지시: 코디 정보처럼 그냥 보이게).
//   머리는 같은 글자(착용 아이템 N)지만 누르는 막대가 아니다
export function WornItems({ snap, postId, mobile, flat }: { snap: Snapshot; postId: string; mobile: boolean; flat?: boolean }) {
  const s = useShop()
  // 이름·아이콘 경로는 부위 리스트를 읽어야 알 수 있어 비동기로 채운다(리스트 JSON 이라 가볍다 — 스프라이트는 펼칠 때 받는다).
  const [items, setItems] = useState<Worn[] | null>(null)
  useEffect(() => {
    let alive = true
    setItems(null)
    s.resolveSnapItems(snap).then((eq) => {
      if (!alive) return
      const skinTone = viewTone(snap.tone, snap.hidden) // 피부를 가린 코디는 보이는 대로 엘프 피부
      const toneName = s.index?.base.tones.find((x) => x.tone === skinTone)?.name
      const out: Worn[] = []
      for (const c of CATS) {
        const slot = CAT_TO_SLOT[c.id]
        if (!slot) continue
        const off = !!snap.dyeOff?.[slot]
        if (slot === 'skin') {
          out.push({ slot, label: c.label, item: null, name: toneName || `피부 ${skinTone}`, off, dyed: lookDyed(slot, null, toneName, undefined, snap.dyeHsb?.skin), dyeable: isDyeableSkin(toneName), skinFamily: skinDyeFamily(toneName) ?? undefined })
          continue
        }
        const it = eq[slot]
        if (!it || snap.hidden?.[slot]) continue
        out.push({ slot, label: c.label, item: it, name: it.name || it.id, off, dyed: lookDyed(slot, it, toneName, snap.dyePalette?.[slot], snap.dyeHsb?.[slot]), dyeable: it.dyeMode !== 'none' })
      }
      setItems(out)
    }).catch(() => { if (alive) setItems([]) })
    return () => { alive = false }
  }, [postId])

  // want = 누른 결과(목표) — 화살표·aria 는 누르는 즉시 이걸 따른다. mounted = 칩이 레이아웃에 있는가(접힘이 끝나야 빠진다).
  // 움직임은 CSS transition 이라 도중에 다시 누르면 **지금 위치에서** 반대 목표로 돌아간다(끝날 때까지 막지 않는다).
  // **기본은 펼침** — 접혀 있으면 막대가 있는 줄도 모르고 지나친다. 보기 싫은 사람이 접는다.
  const [want, setWant] = useState(true)
  const [mounted, setMounted] = useState(true)
  const wantRef = useRef(true)
  const first = useRef(true) // 처음 뜰 때는 펼침 애니메이션 없이 그냥 펼쳐진 채로(다이얼로그가 이미 등장 중이다)
  const wrapRef = useRef<HTMLDivElement>(null)
  const innerRef = useRef<HTMLDivElement>(null)
  const moving = useRef<HTMLElement[]>([])
  const timer = useRef(0)
  const raf = useRef(0)
  useEffect(() => () => { clearTimeout(timer.current); cancelAnimationFrame(raf.current) }, [])

  const followers = () => {
    const out: HTMLElement[] = []
    for (let n = wrapRef.current?.nextElementSibling; n; n = n.nextElementSibling) out.push(n as HTMLElement)
    return out
  }
  const clear = () => { release(moving.current); moving.current = [] }
  // 목표로 transition. 접힘 목표는 칩 높이만큼 위(창 밖), 펼침 목표는 0. 끝나면 접힘은 칩을 빼고, 펼침은 흔적을 지운다.
  const go = (open: boolean) => {
    const inner = innerRef.current
    if (!inner) return
    clearTimeout(timer.current); cancelAnimationFrame(raf.current)
    moving.current = [inner, ...followers()]
    const y = open ? 0 : -inner.offsetHeight
    const ms = glideTo(moving.current.map((el) => [el, y] as [HTMLElement, number])) // 진행 중이면 지금 위치·속도에서 이어 간다
    timer.current = window.setTimeout(() => { if (open) clear(); else setMounted(false) }, ms + 20)
  }

  const toggle = () => {
    const next = !wantRef.current
    wantRef.current = next
    setWant(next)
    if (next && !mounted) { setMounted(true); return } // 칩을 넣고 아래 layout effect 에서 출발
    go(next) // 도중이면 지금 위치에서 방향만 바꾼다
  }
  useLayoutEffect(() => {
    if (!mounted) { clear(); return }
    const inner = innerRef.current
    if (!inner) return
    if (first.current) { first.current = false; clear(); return } // 기본 펼침 — 처음엔 움직이지 않는다
    // 칩이 막 들어온 레이아웃: 칩·아래 구역을 칩 높이만큼 위(접힌 자리)에 두고 다음 프레임에 목표로.
    moving.current = [inner, ...followers()]
    place(moving.current.map((el) => [el, -inner.offsetHeight] as [HTMLElement, number]))
    inner.getBoundingClientRect()
    raf.current = requestAnimationFrame(() => go(wantRef.current))
  }, [mounted])
  const open = want
  // 그 부위를 완전히 같게(아이템 · 염색 · 점 위치까지) 입고 있으면 입기 버튼이 체크로 바뀐다(ShopContext.isWornFromSnap).
  const isWorn = (w: Worn) => s.isWornFromSnap(snap, w.slot, w.item)

  return (
    <div ref={wrapRef} className={styles.worn}>
      {flat ? (
        <div className={clsx(styles.wornBar, styles.wornBarFlat, mobile && styles.wornBarM)}>
          <span className={styles.descLabel}>착용 아이템</span>
          {items && <span className={styles.wornCount}>{items.length}</span>}
        </div>
      ) : (
        <button type="button" onClick={toggle} aria-expanded={open} aria-controls={`worn-${postId}`}
          title={open ? '착용 아이템 접기' : '착용 아이템 펼치기'} className={clsx(styles.wornBar, mobile && styles.wornBarM)}>
          <span className={styles.descLabel}>착용 아이템</span>
          {items && <span className={styles.wornCount}>{items.length}</span>}
          <IconCaretDown size={11} className={clsx(styles.wornCaret, open && styles.wornCaretOn)} />
        </button>
      )}
      <div id={`worn-${postId}`} className={styles.wornWin}>
        {mounted && (
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
                  <span key={w.slot} title={`${w.label} - ${w.name}${w.dyed ? (w.off ? ' (염색 꺼짐)' : ' (염색)') : ''}`}
                    className={clsx(surf.partChip, styles.wornChip, ui.dyeChip)}>
                    <span className={clsx('pb-chipthumb', surf.partThumb)}>
                      <span className={surf.partSprite}>
                        <LookSprite slot={w.slot} item={w.item} tone={viewTone(snap.tone, snap.hidden)}
                          palette={w.off ? undefined : snap.dyePalette?.[w.slot]} hsb={w.off ? undefined : snap.dyeHsb?.[w.slot]} />
                      </span>
                      {w.dyed && <span title={w.off ? '염색 비활성화됨' : '염색됨'} className={clsx(surf.partDot, w.off && surf.partDotOff)} />}
                    </span>
                    <span className={surf.partText}>
                      <span className={surf.partSlot}>{w.label}</span>
                      <span className={surf.partName}>{w.name}</span>
                    </span>
                    <ChipAct done={isWorn(w)} doneTitle="지금 입고 있어요" icon={<IconTakeDown size={15} />} title={`${w.label}만 지금 코디에 입기`} label={`${w.label}만 입기`}
                      onClick={() => { s.wearFromSnap(snap, [w.slot], w.label).catch(() => {}) }} />
                    <DyeBand state={w.dyed ? 'dyed' : w.dyeable ? 'plain' : 'none'} slot={w.slot} palette={snap.dyePalette?.[w.slot]} hsb={snap.dyeHsb?.[w.slot]} off={w.off} skinFamily={w.skinFamily} />
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
