'use client'

// 프리셋 100칸(사용자 지시 — 기기에만 저장되고 공유할 때만 서버에 오른다). 카드 그림은 스크롤 칸에서 보일 즈음에만 합성 · 그린다(SnapThumb 이 스스로 — ui/useSeen). 선택된 프리셋에 자동 저장 · 닉네임/공유 링크 불러오기(서피스 look · ptake) · 복사/삭제 띠지 · 인라인 이름.

import clsx from 'clsx'
import CountChip from '../frame/CountChip'
import { CatTabsM, StickyBarM } from '../nav/BottomNav'
import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { watchSize } from '@/lib/sizeWatch'
import { DEV_SITE, type Preset } from '@/lib/catalog'
import { CARD_FIT_W_M, CHAT_NAME_FALLBACK, defaultPresetName, PRESET_FRACTION, PRESET_FRACTION_M } from '@/lib/shopData'
import { DIRS } from '../list/ListArea'
import { Seg } from '../ui/controls'
import { useWheelRail } from '../ui/useWheelRail'
import { useListMinHeight } from '../list/ListArea'
import { presetFileName } from '@/lib/canvasExport'
import SnapThumb from '../SnapThumb'
import { presetCard } from '@/lib/core/snapRender'
import { usePresetDrag } from './usePresetDrag'
import { CONFIRM_ATTR, confirmTwice } from '@/lib/confirmTwice'

// 프리셋 카드 캐릭터 크기(리스트 카드 0.45 보다 조금 작게)
import { isCustomSnapshot, useShop, type Snapshot } from '../ShopContext'
import { CardStageBg, SYS_BG_CSS } from '../preview/StageBg'
import { IconCheck, IconLinkCopy, IconPencil, IconCloud, IconImport, IconReorder, IconTrashSolid } from '../ui/Icons'
import styles from './preset.module.css'

export default function PresetPanel({ mobile }: { mobile: boolean }) {
  const s = useShop()
  const narrow = s.listNarrow
  // 라이브 모델 → Snapshot(선택된 카드가 이걸로 그려진다). 자동저장(100ms)을 기다리지 않고 즉시 반영.
  //  ⚠️ 반드시 context 의 snapshot() 을 그대로 쓴다 — 필드를 직접 나열하면 새 상태(점 위치·염색 등)를 빠뜨려
  //     "선택됨" 카드에만 반영이 안 되는 버그가 난다(과거 dotPos 누락 사례).
  // 미리보기 배경을 바꾸면 선택 카드 바탕도 바로(사용자 지시) — snapshot().bg 와 같은 s.bgSel 을 본다
  const liveSnap: Snapshot = useMemo(() => s.snapshot(), [s.equipped, s.tone, s.dyePalette, s.dyeHsb, s.hidden, s.dotPos, s.pv, s.bgSel]) // eslint-disable-line react-hooks/exhaustive-deps

  // 고른 칸이 **가운데**에 오도록 탭을 열자마자 스크롤한다(연출 설정 고르기와 같다). 탭을 열 때 한 번만 — 저장된 선택은 첫 그리기 뒤에 온다.
  // 스크롤 영역만 움직인다(scrollIntoView 는 모바일에서 문서까지 같이 끌고 간다).
  // 탭을 눌러 들어올 때는 칸 폭(cqw)이 자리 잡기 전에 불릴 수 있어, 그린 뒤 두 프레임 동안 다시 맞춘다(이미 맞으면 아무 일도 없다).
  // 넘기는 방향(사용자 지시 — 프리셋에도). 고르기 전에는 지금까지의 배치: PC 세로 스크롤 · 모바일 가로 스크롤(2줄). 가로 = 줄 수 고정(PC · 모바일 2줄),
  // 세로 = 열 수 고정. 끌어서 순서 바꾸기(usePresetDrag)는 칸 모양을 읽어 어느 쪽이든 그대로 된다. PC 가로는 마우스 휠을 가로로(useWheelRail)
  const dir = s.presetDir ?? (mobile ? 'x' : 'y')
  const across = dir === 'x'
  // PC 가로는 휠 한 번에 한 열씩(사용자 지시) — 열 간격은 그려진 두 열의 자리 차이
  const boxRef = useWheelRail<HTMLDivElement>(across && !mobile, () => lineStride(gridRef.current, 2, true))
  useListMinHeight(boxRef, mobile) // 모바일: 코디 탭 목록처럼 붙은 미리보기 아래에 3줄이 다 들어가는 높이(ListArea useMobileRows)
  // 고른 프리셋 = 비교 중이면 비교의 주인 프리셋(사용자 지시 — 비교 중에도 프리셋 탭에서 지금 프리셋이 '선택됨'으로 보인다. 고른 비교 칸 = 그 프리셋)
  const selId = s.cmpOn ? s.cmpBack : s.selectedPreset

  // 순서 변경(헤더 칩 옆 버튼, 사용자 지시): 켠 동안만 카드를 끌어 순서를 바꾼다(usePresetDrag). 켠 동안은 카드를 눌러도 고르지 않고
  // 길게 누르기 이미지 메뉴도 열지 않는다(끌기와 겹치지 않게). 끄면 원래대로. 순서는 놓을 때마다 저장된다. Esc 로도 끈다
  const [sorting, setSorting] = useState(false)
  const gridRef = useRef<HTMLDivElement>(null)

  // PC 는 보이는 줄과 앞뒤 VBUF 줄만 카드로 만든다(가상 스크롤 — 세로는 행, 가로는 열). 왜: 100칸이 모두 있으면 스크롤할 때마다 브라우저가
  // 칸 전체의 층을 다시 나눠(Layerize) CPU 4배 느리게에서 프레임 470개 중 190개가 50ms 를 넘었다. 비운 줄은 그리드의 안쪽 여백으로 자리만 잡는다.
  // 순서 변경 중에는 모두 그린다 — 끌기가 모든 칸의 자리를 잰다(usePresetDrag). 휴대폰은 그대로다(한 화면 3 × 3).
  const virt = !mobile && !sorting
  const per = across ? 2 : narrow ? 3 : 5 // 한 줄의 카드 수(세로 = 열 수, 가로 = 2줄)
  const lines = Math.ceil(s.presets.length / per)
  const selLine = Math.max(0, Math.floor(s.presets.findIndex((p) => p.id === selId) / per))
  const [stride, setStride] = useState(0) // 줄 간격(px) — 그려진 두 줄의 자리 차이로 잰다
  const [range, setRange] = useState<[number, number]>(() => [Math.max(0, selLine - 3), selLine + 4]) // 그릴 줄 [a, b) — 처음은 고른 칸 둘레
  const [, setResized] = useState(0)
  useLayoutEffect(() => {
    if (!virt) return
    const st = lineStride(gridRef.current, per, across)
    if (st > 0 && Math.abs(st - stride) > 0.01) setStride(st) // 소수점 흔들림으로 다시 그리지 않게
  })
  const scrollingRef = useRef(false)
  useEffect(() => {
    const box = boxRef.current
    if (!box || mobile) return
    let raf = 0, quiet = 0
    const upd = () => {
      raf = 0
      if (!virt || !stride) return
      const pos = (across ? box.scrollLeft : box.scrollTop) - BOX_PAD, size = across ? box.clientWidth : box.clientHeight
      const a = Math.max(0, Math.floor(pos / stride) - VBUF), b = Math.min(lines, Math.floor((pos + size) / stride) + 1 + VBUF)
      setRange((r) => (r[0] === a && r[1] === b ? r : [a, b]))
    }
    // 스크롤하는 동안은 카드가 마우스 밑을 지나가도 코디를 미리 받지 않는다(warmWear — 지나가는 카드마다 meta 를 받고 염색을 칠했다).
    // 클래스로 hover 를 끄지 않는다 — 붙였다 뗄 때마다 카드 전체의 스타일을 다시 계산했다(느린 기기에서는 스크롤 중에 수백 번). hover 는 브라우저가 스크롤이 끝난 뒤 갱신한다
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(upd)
      scrollingRef.current = true
      clearTimeout(quiet); quiet = window.setTimeout(() => { scrollingRef.current = false }, 160)
    }
    box.addEventListener('scroll', onScroll, { passive: true })
    const off = watchSize(box, () => setResized((n) => n + 1)) // 폭이 바뀌면 줄 간격을 다시 잰다
    upd()
    return () => { box.removeEventListener('scroll', onScroll); off(); cancelAnimationFrame(raf); clearTimeout(quiet); scrollingRef.current = false }
  }, [mobile, virt, stride, across, per, lines])
  const [va, vb] = virt ? (stride ? [range[0], Math.min(lines, range[1])] : [Math.min(range[0], lines), Math.min(lines, range[1])]) : [0, lines]
  const padStyle: React.CSSProperties | undefined = virt && stride ? (across ? { paddingLeft: va * stride, paddingRight: (lines - vb) * stride } : { paddingTop: va * stride, paddingBottom: (lines - vb) * stride }) : undefined

  // 고른 칸이 가운데에 오게(위 주석). 가상 스크롤이면 줄 간격을 잰 뒤에, 고른 칸이 그릴 줄 밖이면(저장된 선택이 첫 그리기 뒤에 온다) 그 둘레를 먼저 그린다
  const centered = useRef(false), centerRaf = useRef(0)
  useLayoutEffect(() => {
    if (centered.current || !selId || (virt && !stride)) return
    if (virt) {
      const ln = Math.floor(s.presets.findIndex((p) => p.id === selId) / per)
      if (ln >= 0 && (ln < va || ln >= vb)) { setRange([Math.max(0, ln - 3), Math.min(lines, ln + 4)]); return }
    }
    centered.current = true
    const go = () => {
      const box = boxRef.current, el = box?.querySelector('.pb-preset-sel')?.closest('.pb-presetwrap')
      if (!box || !el) return
      const b = box.getBoundingClientRect(), r = el.getBoundingClientRect()
      box.scrollTo({ left: box.scrollLeft + r.left - b.left - (b.width - r.width) / 2, top: box.scrollTop + r.top - b.top - (b.height - r.height) / 2 })
    }
    go()
    // 두 프레임 다시 맞추기는 가운데로 옮긴 스크롤이 그릴 줄을 바꿔도(va · vb) 끊지 않는다 — 탭을 떠날 때만 멈춘다
    centerRaf.current = requestAnimationFrame(() => { go(); centerRaf.current = requestAnimationFrame(go) })
  }, [selId, stride, va, vb])
  useEffect(() => () => cancelAnimationFrame(centerRaf.current), [])

  // 삭제는 2단계 확인: 3초 안에, 다른 상호작용 없이 연속으로 한 번 더 누르면 삭제(lib/confirmTwice).
  const remove = (p: Preset) => {
    // 되묻는 문구는 삭제 버튼 바로 위 말풍선으로 뜬다(ui/ConfirmBubble) — 어느 카드인지는 자리로 알 수 있어 이름을 뺐다.
    if (confirmTwice(`preset:${p.id}`, '한 번 더 누르면 삭제해요')) s.resetPreset(p.id)
  }

  const dirSeg = <Seg variant={mobile ? 'mobileFit' : 'pc'} title="넘기는 방향" opts={DIRS} value={dir} onPick={s.setPresetDir} />
  // 모바일은 머리에 방향이 더 들어가 글자를 뺀다 — 바로 위 탭 이름이 '프리셋'이다. 칸 수는 **실제 프리셋 목록**에서 센다 — 숫자를 박아 두면 칸 수를 바꿀 때 어긋난다
  const chip = <CountChip mobile={mobile} label={mobile ? undefined : '프리셋'} n={s.presetUsed} total={s.presets.length} digits={3} title="선택된 프리셋에 자동 저장돼요" />
  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => { if (e.key === 'Enter') s.importFetch() }

  useEffect(() => {
    if (!sorting) return
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') setSorting(false) }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [sorting])
  const toggleSort = () => setSorting((v) => { if (!v) s.notify('카드를 끌어 순서를 바꿔요'); return !v })
  const dnd = usePresetDrag(sorting, s.presets.map((p) => p.id), gridRef, boxRef, s.reorderPresets, styles.dragging, `${mobile ? 'm' : narrow ? 'n' : 'pc'}${dir}`)
  // 켜짐 = 채운 핑크 + '완료'. 두 문구를 한 칸에 겹쳐 폭이 바뀌지 않는다(불러오기 버튼과 같다)
  const sortBtn = (
    <button type="button" data-guide="sort" onClick={toggleSort} aria-pressed={sorting} title={sorting ? '순서 변경 끝내기' : '카드를 끌어 순서 바꾸기'}
      className={clsx(styles.sortBtn, mobile && styles.sortBtnM, sorting && styles.sortOn)}>
      <IconReorder size={mobile ? 14 : 15} />
      <span className={styles.loadLabel}>
        <span aria-hidden={sorting || undefined} style={sorting ? { visibility: 'hidden' } : undefined}>{mobile ? '순서' : '순서 변경'}</span>
        <span aria-hidden={!sorting || undefined} style={sorting ? undefined : { visibility: 'hidden' }}>완료</span>
      </span>
    </button>
  )

  // 프리셋 동기화(로그인) — 프리셋 탭 머리(사용자 검토: 모바일 맨 위 머리는 차 있고, 로그인을 쓸 곳이 프리셋 중심이다). 지금은 dev 에서만 자리 · 디자인 시험(DEV_SITE).
  // PC 는 구름 + '동기화', 모바일은 순서 단추와 같은 높이의 정사각 아이콘
  const syncBtn = DEV_SITE && (
    <button type="button" onClick={s.openSync} title="로그인하고 프리셋과 설정을 기기마다 이어 쓰기" aria-label="동기화" className={clsx(styles.sortBtn, mobile && styles.sortBtnM, mobile && styles.syncBtnM)}>
      <IconCloud size={mobile ? 15 : 16} />{!mobile && '동기화'}
    </button>
  )

  // 카드는 메모된 부품(PresetCard)이다 — 다루는 함수는 늘 같은 ref 로 넘겨, 순서를 바꿔 놓을 때 · 다른 카드를 고를 때 바뀐 카드만 다시 그린다
  // (30장을 다 다시 그리면 놓는 순간 한 번 멈칫했다 — CPU 4배 느리게에서 최대 140ms)
  const act = useRef<CardAct>(null!)
  act.current = {
    select: (id) => { if (!dnd.swallowClick()) s.selectPreset(id) },
    warm: (snap, dye) => { if (!scrollingRef.current) s.warmWear(snap, dye, 'preset') },
    down: dnd.onPointerDown, share: s.sharePreset, remove, rename: s.renamePreset, commit: s.commitPresetName,
  }

  const grid = (
    <div ref={gridRef} style={padStyle} className={mobile ? (across ? styles.gridHM : styles.gridVM) : across ? clsx(styles.gridH, narrow && styles.gridHNarrow) : clsx(styles.grid, narrow && styles.gridTight, narrow ? styles.cols3 : styles.cols5)}>
      {s.presets.slice(va * per, vb * per).map((p, k) => {
        const i = va * per + k, on = selId === p.id
        return <PresetCard key={p.id} p={p} i={i} on={on} snap={on ? liveSnap : s.presetData[p.id]} mobile={mobile} fill={mobile || across} sorting={sorting} act={act} />
      })}
    </div>
  )

  if (mobile) {
    return (
      <>
        <StickyBarM>
        <CatTabsM jump />
        <div className={styles.headerM}>
          {chip}
          {sortBtn}
          {dirSeg}
          {syncBtn}
          {/* 불러오기: 입력과 버튼을 한 칸에 묶는다(아래 PC 와 같은 모양) */}
          <div className={clsx(styles.importBox, styles.importBoxM)}>
            <input data-guide="nick" value={s.nickInput} onChange={(e) => s.setNickInput(e.target.value)} onKeyDown={onKey} placeholder="닉네임, 공유 링크 입력" aria-label="닉네임 또는 공유 링크" className={styles.importField} />
            <button type="button" onClick={s.importFetch} disabled={s.importing} title="불러오기" aria-label="불러오기" aria-busy={s.importing || undefined} className={clsx('pb-solid', styles.loadBtnM, s.importing && styles.busy)}><IconImport size={15} /></button>
          </div>
        </div>
        <div className={styles.hrM} />
        </StickyBarM>
        {/* 모바일: 코디 리스트처럼 가로 스크롤(열 단위 스냅, 스크롤바 숨김) — 2줄 × 폭에 따라 2열/3열 */}
        <div ref={boxRef} data-pb-list={across ? 'x' : 'y'} className={clsx('pb-norail', across ? styles.hscrollM : styles.vscrollM)}>{grid}</div>
      </>
    )
  }
  return (
    <section className={styles.panel}>
      <div className={styles.header}>
        <div className={styles.groupA}>{chip}{sortBtn}{dirSeg}{syncBtn}</div>
        <div className={styles.groupB}>
          {/* 불러오기: 입력 + 채운 아이콘 버튼을 한 테두리 안에(모바일과 같은 모양). 칸의 생김새는 다른 탭의 검색 칸과 같다 */}
          <div className={clsx(styles.importBox, narrow && styles.importBoxNarrow)}>
            <input data-guide="nick" value={s.nickInput} onChange={(e) => s.setNickInput(e.target.value)} onKeyDown={onKey} placeholder="닉네임, 공유 링크 입력" aria-label="닉네임 또는 공유 링크" className={styles.importField} />
            {/* 불러오기는 아이콘 버튼(모바일과 같은 부품 — 사용자 지시: 글자 버튼이면 비교 중 좁은 머리에서 입력 칸이 26px 까지 눌렸다) */}
            <button type="button" onClick={s.importFetch} disabled={s.importing} title={s.importing ? '불러오는 중' : '닉네임 또는 공유 링크로 코디 불러오기'} aria-label="불러오기" aria-busy={s.importing || undefined}
              className={clsx('pb-solid', styles.loadBtnM, styles.loadBtnPc, s.importing && styles.busy)}><IconImport size={15} /></button>
          </div>
        </div>
      </div>
      <div className={styles.hr} />
      <div ref={boxRef} className={across ? clsx('pb-norail', 'pb-fade', styles.hscroll) : clsx('pb-scroll', styles.scroll)}>{grid}</div>
    </section>
  )
}

const BOX_PAD = 8, VBUF = 2 // 스크롤 칸 안쪽 여백(.scroll · .hscroll padding), 보이는 줄 앞뒤로 더 그릴 줄 수
// 줄 간격 = 그려진 첫 카드와 다음 줄 첫 카드의 자리 차이(세로 = 행, 가로 = 열). 두 줄이 그려지지 않았으면 0
// 소수점까지 잰다(getBoundingClientRect) — 정수(offsetTop)로 재면 줄마다 깎인 만큼 여백이 어긋나 줄이 바뀔 때 카드가 1px 씩 움찔했다
function lineStride (g: HTMLElement | null, per: number, across: boolean): number {
  const k = g?.children
  if (!k || k.length <= per) return 0
  const a = k[0].getBoundingClientRect(), b = k[per].getBoundingClientRect()
  return across ? b.left - a.left : b.top - a.top
}

type CardAct = {
  select: (id: string) => void; warm: (snap: Snapshot, dye: boolean) => void; down: (e: React.PointerEvent<HTMLElement>, id: string) => void
  share: (p: Preset) => void; remove: (p: Preset) => void; rename: (id: string, name: string) => void; commit: (id: string, fallback: string) => void
}
// 프리셋 카드 한 장. 받는 값이 같으면 다시 그리지 않는다(memo) — act 는 늘 같은 ref, p 는 이름이 바뀔 때만 새 객체다
// 그림은 스크롤 칸에서 보일 즈음에만 그린다(SnapThumb 이 스스로) — 100칸을 한꺼번에 합성 · 그리지 않게. 한 번 그린 것은 그대로 둔다
const PresetCard = memo(function PresetCard ({ p, i, on, snap, mobile, fill, sorting, act }: { p: Preset; i: number; on: boolean; snap: Snapshot | undefined; mobile: boolean; fill: boolean; sorting: boolean; act: React.MutableRefObject<CardAct> }) {
  const card = useMemo(() => (snap ? presetCard(snap) : undefined), [snap]) // 그 프리셋의 연출 그대로(액션 첫 프레임 · 표정 · 이펙트 · 형상 변이 · 귀)
  // 누르기 전에 미리(전부 입기와 같다): 마우스가 120ms 머물면 받고 염색까지 칠해 두고, 터치는 닿는 순간 받는다. 고른 칸 · 순서 변경 중에는 하지 않는다
  const hover = useRef(0)
  const canWarm = !on && !sorting && !!snap
  const enter = (e: React.PointerEvent) => {
    if (e.pointerType !== 'mouse' || !canWarm) return
    window.clearTimeout(hover.current); hover.current = window.setTimeout(() => act.current.warm(snap!, true), 120)
  }
  const down = (e: React.PointerEvent<HTMLElement>) => { if (e.pointerType !== 'mouse' && canWarm) act.current.warm(snap!, false); act.current.down(e, p.id) }
  return (
    <div data-preset-id={p.id} onClick={() => { if (!sorting) act.current.select(p.id) }} onPointerEnter={enter} onPointerLeave={() => window.clearTimeout(hover.current)} onPointerDown={down}
      className={clsx('pb-presetwrap', styles.wrap, sorting && styles.sorting)}>
      <div className={clsx('pb-preset', on && 'pb-preset-sel')}>
        <span className={clsx(styles.badge, mobile && styles.badgeM, on && styles.badgeOn)} aria-label="선택됨">{mobile ? <IconCheck /> : '선택됨'}</span>
        {/* 바탕(사용자 지시): 손대지 않은 프리셋(광장 등록의 올릴 프리셋 판정과 같다)은 시스템 테마 색, 꾸민 프리셋은 그 프리셋의 미리보기 배경 */}
        <div className={clsx(styles.thumb, fill && styles.thumbM)} style={snap && !isCustomSnapshot(snap) ? { background: SYS_BG_CSS } : undefined}>
          {snap && isCustomSnapshot(snap) && <div className={styles.thumbBg}><CardStageBg sel={snap.bg} fraction={mobile ? PRESET_FRACTION_M : PRESET_FRACTION} /></div>}
          {card && <SnapThumb snap={card} view fraction={mobile ? PRESET_FRACTION_M : PRESET_FRACTION} fitW={mobile ? CARD_FIT_W_M : undefined} tagName={p.name.trim() || CHAT_NAME_FALLBACK} fileName={presetFileName(p.name, i)} holdMenu={!sorting} />}</div>
        <div className={clsx(styles.nameRow, mobile && styles.nameRowM)}>
          <span className={styles.nameWrap}>
            <input value={p.name} aria-label="프리셋 이름" title={mobile ? undefined : '이름을 입력해 바꿀 수 있어요'}
              onChange={(e) => act.current.rename(p.id, e.target.value)}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
              onBlur={() => act.current.commit(p.id, defaultPresetName(i))}
              className={clsx('pb-input', 'pb-presetname', styles.nameInput, mobile && styles.nameInputM)} />
            <IconPencil className={styles.pencil} />
          </span>
        </div>
        <button type="button" onClick={(e) => { e.stopPropagation(); act.current.share(p) }} title="프리셋 복사" aria-label="프리셋 복사" className={clsx('pb-presetacts', styles.share, mobile && styles.shareM)}><IconLinkCopy size={11} /></button>
        <button type="button" onClick={(e) => { e.stopPropagation(); act.current.remove(p) }} {...{ [CONFIRM_ATTR]: `preset:${p.id}` }} title="프리셋 삭제" aria-label="삭제" className={clsx('pb-presetacts', styles.del, mobile && styles.delM)}><IconTrashSolid size={11} /></button>
      </div>
    </div>
  )
})
