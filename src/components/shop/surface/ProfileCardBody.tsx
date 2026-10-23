'use client'

// 코디 프로필 — 공유 카드 꾸미기(Surface 'card', 코디 정보 탭의 [코디 프로필 저장]). 사용자 지시:
//  · 창을 둘로 나눈다 — 왼쪽(모바일은 위) = 저장될 카드 그대로의 미리보기(사진은 끌어 옮기기 · 휠 · 두 손가락 배율, 오른쪽 아래 [원래 자리]),
//    오른쪽(모바일은 아래) = 꾸미기.
//  · 꾸미기 = 접었다 펴는 칸 다섯, 이 순서: 카드 디자인 · 배경 · 캐릭터(액션 · 명찰 · 칭호 · 훈장 토글) · 이름 · 말풍선.
//    칸 사이는 넉넉히 띄우고 구분선으로 가른다. 접고 펼 때 높이를 전환하지 않는다 — 배치는 한 번에 바꾸고 보이는 움직임은
//    칸 안쪽과 아래 칸들의 translateY 로만(겉은 overflow hidden, surface/glide).
//  · 고를 것이 많은 디자인 · 배경은 높이를 미리 잡은 스크롤 칸(2줄)이다 — 무엇을 골라도 꾸미기의 배치가 밀리지 않는다(사용자 지시: Layout Shift 금지).
//  · 액션 · 이모티콘은 미리보기 · 채팅과 **같은 팝박스**(PopBox + ActionPickBody · ChatEmoPicker)가 꾸미기 칸 안쪽 아래에서 올라온다.
//    정지 그림을 저장하므로 둘 다 '재생'이 없고, 자세 · 프레임을 고르면 창이 닫힌다.
//  · 오른쪽 아래 [저장] = 미리보기 그대로 저장(lib/profileCard 의 같은 함수 — 저장만 두 배 해상도). 파일 이름은 '<이름> 공유 카드'.
// 그리기: 판(사진 칸 밖)은 디자인 · 이름 · 칩이 바뀔 때만, 사진 칸은 끌 때 프레임마다(React 를 다시 그리지 않고 ref + rAF).
// 캐릭터 그림(canvasExport.drawShot)은 명찰 · 말풍선 · 프레임이 바뀔 때만 다시 그린다(글을 적는 동안은 잠깐 멈춘 뒤).

import clsx from 'clsx'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { drawShot, fileSafe, getPreviewShot, saveImage, shotFoot, type ModelShot } from '@/lib/canvasExport'
import type { ChatEmo } from '@/lib/core/chatUi'
import { imageSrc } from '@/lib/core/render'
import { CARD_THEMES, CARD_W, PHOTO, ZOOM_MAX, ZOOM_MIN, cardBgImage, cardFonts, cardHeight, defaultView, drawCardBase, drawCardPhoto, type CardBoard, type CardView, type ShareChip } from '@/lib/profileCard'
import { CHAT_NAME_FALLBACK, CHAT_TEXT_MAX, chatDrawOf } from '@/lib/shopData'
import { PV_ACTION_GROUPS, PV_ACTIONS_FLAT } from '@/lib/catalog'
import { animaOnce, composeSnapshotCached, snapKey } from '@/lib/core/snapRender'
import { ActionPickBody } from '../preview/PvPicker'
import { PopBox, popIn, usePop } from '../preview/PopBox'
import { addStageBg, CASH_BGS, cashBgsOn, getStageBg, STAGE_BG_MAX, useStageBg } from '@/lib/stageBg'
import { infoRows, shareChips, useSkinItem, useToneName } from '../info/InfoPanel'
import ChatEmoPicker from '../preview/ChatEmoPicker'
import { STAGE_COLORS } from '../preview/StageBg'
import { SCENE_SRC } from '../scene/sceneSrc'
import { useShop } from '../ShopContext'
import { Switch } from '../ui/controls'
import { IconAdd, IconCaretDown, IconClose, IconReset, IconSmile } from '../ui/Icons'
import { glideTo, place, release } from './glide'
import { SurfaceFooter } from './Surface'
import sf from './surface.module.css'
import ui from '../ui/ui.module.css'
import styles from './profileCard.module.css'

const THEME_KEY = 'pb_card_theme_v1' // 마지막에 고른 카드 디자인(이 브라우저만 — 편의)
const readTheme = () => { try { return localStorage.getItem(THEME_KEY) } catch { return null } }
const today = () => { const d = new Date(); return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}` }
const clampZ = (z: number) => Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, Math.round(z)))
const FOLD_MS = 260

// 접었다 펴는 칸. 머리(이름 + 꺾쇠)를 누르면 안쪽이 위로 말려 들어가고 아래 칸들이 같은 만큼 따라 올라온다(펼칠 때는 반대).
// 높이는 한 번에 바꾸고(접힘 = hidden) 움직임은 translateY 로만 — 높이 전환은 프레임마다 레이아웃이라 아래가 출렁인다.
function Sec ({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true)
  const secRef = useRef<HTMLElement>(null), inRef = useRef<HTMLDivElement>(null)
  const busy = useRef(false)
  const toggle = () => {
    const sec = secRef.current, inner = inRef.current
    if (!sec || !inner || busy.current) return
    busy.current = true
    const below: HTMLElement[] = []
    for (let e = sec.nextElementSibling; e; e = e.nextElementSibling) below.push(e as HTMLElement)
    const els = [inner, ...below]
    if (open) {
      const h = inner.offsetHeight
      glideTo(els.map((e) => [e, -h]), FOLD_MS)
      setTimeout(() => { flushSync(() => setOpen(false)); release(els); busy.current = false }, FOLD_MS)
    } else {
      flushSync(() => setOpen(true))
      const h = inner.offsetHeight
      place(els.map((e) => [e, -h]))
      glideTo(els.map((e) => [e, 0]), FOLD_MS)
      setTimeout(() => { release(els); busy.current = false }, FOLD_MS)
    }
  }
  return (
    <section ref={secRef} className={styles.sec}>
      <button type="button" onClick={toggle} aria-expanded={open} className={styles.secHead}>
        {title}<IconCaretDown className={clsx(styles.secCaret, !open && styles.secCaretOff)} />
      </button>
      <div className={styles.secClip} hidden={!open}>
        <div ref={inRef} className={styles.secIn}>{children}</div>
      </div>
    </section>
  )
}

export default function ProfileCardBody({ mobile }: { mobile: boolean }) {
  const s = useShop()
  const toneName = useToneName()
  const skinItem = useSkinItem()
  const stage = useStageBg()

  // ── 꾸미기 값 ──
  const [themeId, setThemeId] = useState(() => readTheme() ?? CARD_THEMES[0].id)
  const theme = CARD_THEMES.find((t) => t.id === themeId) ?? CARD_THEMES[0]
  const pickTheme = (id: string) => { setThemeId(id); try { localStorage.setItem(THEME_KEY, id) } catch { /* 기억 못 해도 된다 */ } }
  const [bgSel, setBgSel] = useState(() => getStageBg().sel) // 처음은 미리보기의 배경
  const [name, setName] = useState(s.chatName)
  const [tagOn, setTagOn] = useState((!!s.equipped.nameTag && !s.hidden.nameTag) || s.pv.baseTag)
  const hasTitle = !!s.equipped.title && !s.hidden.title, hasMedal = !!s.equipped.medal && !s.hidden.medal
  const [titleOn, setTitleOn] = useState(true), [medalOn, setMedalOn] = useState(true)
  const [text, setText] = useState('')
  const [emo, setEmo] = useState<ChatEmo | null>(null)
  const [frame, setFrame] = useState(1) // 움직이는 이모티콘의 몇 번째 프레임(1부터)
  const [cash, setCash] = useState(false)
  useEffect(() => { let alive = true; cashBgsOn().then((v) => { if (alive) setCash(v) }); return () => { alive = false } }, [])

  // ── 재료: 글꼴 · 칩 · 미리보기의 그림 재료(창을 열 때 한 번) ──
  const [fonts, setFonts] = useState(false)
  const [chips, setChips] = useState<ShareChip[] | null>(null)
  const [pvShot, setPvShot] = useState<ModelShot | null | undefined>(undefined)
  useEffect(() => {
    let alive = true
    void cardFonts().then(() => { if (alive) setFonts(true) })
    void getPreviewShot().then((v) => { if (alive) setPvShot(v) })
    void shareChips(s, infoRows(s, skinItem, toneName), toneName).then((v) => { if (alive) setChips(v) }).catch(() => { if (alive) setChips([]) })
    return () => { alive = false }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps -- 연 순간의 코디로 만든다

  // ── 액션: 처음은 미리보기 그대로(pvShot). 고르면 지금 코디를 그 액션 · 자세로 다시 합성한다(카드 · 연출 고르기와 같은 합성기 — view)
  const [pose, setPose] = useState<{ action: string; frame: number } | null>(null)
  const [poseShot, setPoseShot] = useState<ModelShot | null>(null)
  useEffect(() => {
    if (!pose || !s.index) { setPoseShot(null); return }
    let alive = true
    const snap = s.snapshot(), sn = { ...snap, pv: { ...snap.pv!, action: pose.action, frame: pose.frame } }
    void animaOnce().then((ar) => composeSnapshotCached(snapKey(sn), sn, s.index!, ar, true)).then((r) => {
      if (alive && r) setPoseShot({ placed: r.placed, override: r.overrides, effects: r.effects, particles: r.particles, flip: s.pv.gaze === 'right', centerX: r.center === 'x', centerMount: r.center === 'mount' })
    }).catch(() => {})
    return () => { alive = false }
  }, [pose]) // eslint-disable-line react-hooks/exhaustive-deps -- 연 순간의 코디에 자세만 바꾼다
  const shot = pose ? poseShot : pvShot
  const [poseBase] = useState(() => s.snapshot())
  const actLabel = (a: string) => PV_ACTIONS_FLAT.find((o) => o.v === a)?.l ?? a

  // ── 팝박스(액션 · 이모티콘 — 꾸미기 칸 안쪽 아래에서 올라온다) ──
  const sideRef = useRef<HTMLDivElement>(null)
  const actPop = usePop(), emoPop = usePop()
  const actBtn = useRef<HTMLButtonElement>(null), emoBtn = useRef<HTMLButtonElement>(null)
  const openPop = (p: ReturnType<typeof usePop>) => {
    if (p.pos) { p.close(); return }
    const r = sideRef.current?.getBoundingClientRect()
    if (r) p.open(popIn(r))
  }

  // ── 명찰 · 말풍선 · 칭호 · 훈장(미리보기와 같은 규칙 — shopData.chatDrawOf) ──
  const nameShown = name.trim() || CHAT_NAME_FALLBACK
  const frames = emo?.frames?.length ? emo.frames : null
  const chat = useMemo(() => {
    if (!s.chatOn) return undefined
    const hidden = { ...s.hidden, nameTag: !!s.hidden.nameTag || !tagOn, title: !!s.hidden.title || !titleOn, medal: !!s.hidden.medal || !medalOn }
    const msg = emo ? { text: '', emo } : text.trim() ? { text: text.trim() } : null
    return chatDrawOf(s.equipped, hidden, nameShown, msg, undefined, s.chatDefault, tagOn)
  }, [s.chatOn, s.hidden, s.equipped, s.chatDefault, tagOn, titleOn, medalOn, emo, text, nameShown])
  // 프레임 N = 앞 프레임들이 머문 시간을 다 지난 때(chatUi.emoFrameAt 이 N 번째를 고른다)
  const chatT = frames ? frames.slice(0, Math.min(frame, frames.length) - 1).reduce((n, f) => n + Math.max(1, f.d), 0) : undefined

  // ── 캐릭터 판 ──
  const [board, setBoard] = useState<CardBoard | null>(null)
  // 처음 보기의 배율은 첫 그림으로 한 번만 정한다(말풍선을 적는 동안 크기가 흔들리지 않게). 가운데는 지금 그림(말풍선 · 칭호 포함)에 맞춘다 — 직접 옮기기 전까지
  const firstView = useRef<CardView | null>(null)
  useEffect(() => {
    if (!shot) return
    let alive = true
    const t = setTimeout(() => {
      void drawShot({ ...shot, chat, chatT }).then((d) => {
        if (!alive || !d) return
        const b = { ...d, foot: shotFoot(shot) }
        if (!firstView.current) firstView.current = defaultView(b)
        setBoard(b)
      })
    }, board ? 160 : 0)
    return () => { alive = false; clearTimeout(t) }
  }, [shot, chat, chatT]) // eslint-disable-line react-hooks/exhaustive-deps -- board 는 첫 그림인지만 본다

  // ── 배경 그림 ──
  const [bgImg, setBgImg] = useState<{ sel: string; img: HTMLImageElement | HTMLCanvasElement } | null>(null)
  useEffect(() => {
    const p = cardBgImage(bgSel, stage.images)
    if (!p) return
    let alive = true
    p.then((img) => { if (alive) setBgImg({ sel: bgSel, img }) }).catch(() => {})
    return () => { alive = false }
  }, [bgSel, stage.images])

  // ── 그리기 ──
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const grabRef = useRef<HTMLDivElement>(null)
  const [cssW, setCssW] = useState(0)
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const m = () => setCssW(el.clientWidth)
    m()
    const ro = new ResizeObserver(m); ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const S = Math.max(1, Math.min(2, Math.ceil((cssW * (typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1)) / CARD_W)))
  const H = cardHeight(chips?.length ?? 0)
  const sub = `착용 아이템 ${chips?.length ?? 0}개 | ${today()}`
  const baseRef = useRef<HTMLCanvasElement | null>(null)
  const [view, setView] = useState<CardView | null>(null) // null = 처음 보기
  const live = useRef({ view: null as CardView | null, theme, bgSel, img: null as HTMLImageElement | HTMLCanvasElement | null, board: null as CardBoard | null, S })
  const autoView = (b: CardBoard | null): CardView => { const d = defaultView(b); return firstView.current ? { ...d, z: firstView.current.z } : d }
  const curView = () => live.current.view ?? autoView(live.current.board)
  live.current = { ...live.current, theme, bgSel, img: bgImg?.sel === bgSel ? bgImg.img : null, board, S }
  const paint = useCallback(() => {
    const c = canvasRef.current, b = baseRef.current
    if (!c || !b) return
    if (c.width !== b.width || c.height !== b.height) { c.width = b.width; c.height = b.height }
    const g = c.getContext('2d')!
    g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(b, 0, 0)
    const L = live.current
    drawCardPhoto(g, L.S, L.theme, L.bgSel, L.img, L.board, curView(), firstView.current ?? curView())
  }, [])
  const raf = useRef(0)
  const schedule = useCallback(() => { if (!raf.current) raf.current = requestAnimationFrame(() => { raf.current = 0; paint() }) }, [paint])
  useEffect(() => () => { cancelAnimationFrame(raf.current); raf.current = 0 }, []) // 표시도 지운다 — 남아 있으면 다시 붙은 뒤(개발 모드의 두 번 실행) 다시 그리기가 막힌다
  // 판: 디자인 · 이름 · 칩 · 해상도가 바뀔 때
  useEffect(() => {
    if (!chips || !fonts) return
    const c = baseRef.current ?? document.createElement('canvas')
    c.width = CARD_W * S; c.height = H * S
    drawCardBase(c.getContext('2d')!, S, theme, { name: nameShown, sub }, chips)
    baseRef.current = c
    paint()
  }, [chips, fonts, theme, nameShown, sub, S, H, paint])
  // 사진 칸: 그림 · 배경 · 보기가 바뀔 때
  useEffect(() => { live.current.view = view; schedule() }, [view, board, bgImg, bgSel, theme, schedule])

  // ── 사진 자리: 끌어 옮기기 · 휠 · 두 손가락 ──
  useEffect(() => {
    const el = grabRef.current
    if (!el) return
    const ptrs = new Map<number, { x: number; y: number }>()
    let pinch: { d: number; z: number } | null = null
    const k = () => (el.parentElement!.clientWidth || 1) / CARD_W // 화면 px / 카드 px
    const dist = () => { const [a, b] = [...ptrs.values()]; return Math.hypot(a.x - b.x, a.y - b.y) }
    const down = (e: PointerEvent) => {
      el.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY })
      if (ptrs.size === 2) pinch = { d: dist(), z: curView().z }
    }
    const move = (e: PointerEvent) => {
      const p = ptrs.get(e.pointerId)
      if (!p) return
      const v = curView()
      if (ptrs.size === 1) {
        const f = k() * v.z
        live.current.view = { ...v, x: v.x - (e.clientX - p.x) / f, y: v.y - (e.clientY - p.y) / f }
      }
      p.x = e.clientX; p.y = e.clientY
      if (ptrs.size === 2 && pinch) live.current.view = { ...v, z: clampZ(pinch.z * (dist() / Math.max(1, pinch.d))) }
      schedule()
    }
    const up = (e: PointerEvent) => {
      if (!ptrs.delete(e.pointerId)) return
      if (ptrs.size < 2) pinch = null
      if (!ptrs.size) setView(live.current.view)
    }
    let acc = 0
    const wheel = (e: WheelEvent) => {
      e.preventDefault()
      acc += e.deltaY
      if (Math.abs(acc) < 60) return
      const v = curView(); const z = clampZ(v.z + (acc < 0 ? 1 : -1)); acc = 0
      setView({ ...v, z })
    }
    el.addEventListener('pointerdown', down); el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up)
    el.addEventListener('wheel', wheel, { passive: false })
    return () => {
      el.removeEventListener('pointerdown', down); el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up)
      el.removeEventListener('wheel', wheel)
    }
  }, [schedule])

  // ── 배경 올리기 ──
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const upload = async (f: File | undefined) => {
    if (!f || busy) return
    setBusy(true)
    const r = await addStageBg(f, false)
    setBusy(false)
    if (typeof r === 'object') setBgSel(r.id)
    else s.notify(r === 'full' ? `그림은 ${STAGE_BG_MAX}장까지 올릴 수 있어요` : r === 'bad' ? '그림 파일을 올려주세요' : '저장할 자리가 모자라요')
  }

  // ── 저장(미리보기와 같은 함수, 두 배 해상도) ──
  const [saving, setSaving] = useState(false)
  const save = async () => {
    if (saving) return
    if (!chips || !board) { s.notify('카드를 그리는 중이에요'); return }
    setSaving(true)
    try {
      const SS = 2, c = document.createElement('canvas')
      c.width = CARD_W * SS; c.height = H * SS
      const g = c.getContext('2d')!
      await cardFonts()
      drawCardBase(g, SS, theme, { name: nameShown, sub }, chips)
      drawCardPhoto(g, SS, theme, bgSel, live.current.img, board, curView(), firstView.current ?? curView())
      const res = await saveImage(() => new Promise((r) => c.toBlob((b) => r(b), 'image/png')), `${fileSafe(name.trim()) || s.saveName} 공유 카드`)
      s.notify(res === 'saved' ? '코디 프로필을 저장했어요' : '이미지를 만들지 못했어요')
    } finally { setSaving(false) }
  }

  // ── 화면 ──
  const tile = (id: string, label: string, style: React.CSSProperties, on: boolean, pick: () => void, inner?: React.ReactNode) => (
    <div key={id} className={sf.bgCell}>
      <button type="button" onClick={pick} aria-pressed={on} title={label} className={clsx('pb-partchip', sf.bgTile, styles.tile, on && sf.bgTileOn)}>
        <span className={clsx(sf.bgThumb, styles.thumb)} style={style}>{inner}</span>
        <span className={sf.bgName}>{label}</span>
      </button>
    </div>
  )
  const bgTile = (id: string, label: string, style: React.CSSProperties) => tile(id, label, style, bgSel === id, () => setBgSel(id))
  const toggleRow = (label: string, on: boolean, set: () => void, off?: string) => (
    <div className={styles.row} title={off}>
      <span className={styles.rowLabel}>{label}</span>
      <Switch on={on && !off} onToggle={set} disabled={!!off} title={off ?? `${label} 보이기`} />
    </div>
  )
  const actText = pose ? `${actLabel(pose.action)}${pose.frame >= 0 ? ` | ${pose.frame + 1}번째 자세` : ''}` : '미리보기 그대로'

  const side = (
    <div ref={sideRef} className={clsx('pb-scroll', 'pb-fade', styles.side, mobile && styles.sideM)}>
      <Sec title="카드 디자인">
        <div className={clsx('pb-scroll', 'pb-scroll-thin', 'pb-fade', styles.tileBox)}>
          <div className={clsx(sf.bgGrid, styles.tileGrid)}>
            {CARD_THEMES.map((t) => tile(t.id, t.label, { background: `linear-gradient(160deg, ${t.bg[0]}, ${t.bg[1]})` }, t.id === themeId, () => pickTheme(t.id),
              <span className={styles.themeLine} style={{ borderColor: t.accent }} />))}
          </div>
        </div>
      </Sec>
      <hr className={styles.rule} />
      <Sec title="배경">
        <div className={clsx('pb-scroll', 'pb-scroll-thin', 'pb-fade', styles.tileBox)}>
          <div className={clsx(sf.bgGrid, styles.tileGrid)}>
            <div className={sf.bgCell}>
              <button type="button" onClick={() => fileRef.current?.click()} disabled={busy || stage.images.length >= STAGE_BG_MAX}
                title={stage.images.length >= STAGE_BG_MAX ? `그림은 ${STAGE_BG_MAX}장까지 올릴 수 있어요` : '내 그림을 배경으로 올리기'}
                className={clsx('pb-partchip', sf.bgTile, styles.tile, sf.bgAdd, stage.images.length >= STAGE_BG_MAX && sf.bgAddOff)}>
                <span className={clsx(sf.bgThumb, sf.bgAddThumb, styles.thumb)}><IconAdd size={18} /></span>
                <span className={sf.bgName}>커스텀 배경</span>
              </button>
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { void upload(e.target.files?.[0]); e.target.value = '' }} />
            </div>
            {bgTile('room', '피팅룸', { backgroundImage: `url("${SCENE_SRC.room[1]}")` })}
            {cash && CASH_BGS.map((c) => bgTile(c.id, c.label, { backgroundImage: `url("${c.src}")`, backgroundSize: 'cover', backgroundPosition: 'center 70%', backgroundColor: c.top }))}
            {bgTile('white', '흰색', { background: STAGE_COLORS.white })}
            {bgTile('black', '검은색', { background: STAGE_COLORS.black })}
            {bgTile('theme', '카드 색', { background: `linear-gradient(${theme.photo[0]}, ${theme.photo[1]})` })}
            {stage.images.map((im, i) => bgTile(im.id, `내 그림 ${i + 1}`, { backgroundImage: `url("${im.src}")` }))}
          </div>
        </div>
      </Sec>
      <hr className={styles.rule} />
      <Sec title="캐릭터">
        <div className={styles.row}>
          <span className={styles.rowLabel}>액션</span>
          <button ref={actBtn} type="button" onClick={() => openPop(actPop)} aria-expanded={!!actPop.pos} title="카드에 담을 액션과 자세"
            className={clsx('pb-ddbtn', ui.ddRow, styles.pick, actPop.pos && ui.ddOpen)}>
            <span className={ui.ddRowText}>{actText}</span>
            <span className={clsx(ui.caret, actPop.pos && ui.caretOpen)}>▾</span>
          </button>
        </div>
        {s.chatOn && <>
          {toggleRow('명찰', tagOn, () => setTagOn((x) => !x))}
          {toggleRow('칭호', titleOn, () => setTitleOn((x) => !x), hasTitle ? undefined : '칭호를 끼면 켤 수 있어요')}
          {toggleRow('훈장', medalOn, () => setMedalOn((x) => !x), hasMedal ? undefined : '훈장을 끼면 켤 수 있어요')}
        </>}
      </Sec>
      <hr className={styles.rule} />
      <Sec title="이름">
        <input value={name} onChange={(e) => setName(e.target.value.slice(0, 20))} placeholder={CHAT_NAME_FALLBACK} aria-label="이름" className={clsx('pb-input', styles.input)} />
      </Sec>
      {s.chatOn && <>
        <hr className={styles.rule} />
        <Sec title="말풍선">
          <div className={styles.row}>
            {/* 이모티콘을 고르면 글 칸 자리에 같은 크기의 이모티콘 칸이 선다(아래로 줄이 늘지 않는다) */}
            {emo ? (
              <span className={styles.emoChip}>
                <img src={imageSrc(emo.png, true)} crossOrigin="anonymous" alt="" className={styles.emoImg} />
                <span className={styles.emoName}>{emo.name}{frames ? ` | ${Math.min(frame, frames.length)}번째 프레임` : ''}</span>
                <button type="button" onClick={() => { setEmo(null); setFrame(1) }} title="이모티콘 빼기" aria-label="이모티콘 빼기" className={styles.emoDel}><IconClose size={12} /></button>
              </span>
            ) : (
              <input value={text} onChange={(e) => setText(e.target.value.slice(0, CHAT_TEXT_MAX))} placeholder="메시지..." aria-label="말풍선 글" className={clsx('pb-input', styles.input)} />
            )}
            <button ref={emoBtn} type="button" onClick={() => openPop(emoPop)} aria-expanded={!!emoPop.pos} title="이모티콘" aria-label="이모티콘"
              className={clsx('pb-ghost', styles.iconBtn, emoPop.pos && styles.iconBtnOn)}><IconSmile size={16} /></button>
          </div>
        </Sec>
      </>}
    </div>
  )

  return (
    <>
      <div className={clsx(styles.body, mobile && styles.bodyM)}>
        <div className={clsx(styles.viewWrap, mobile && styles.viewWrapM)}>
          <div className={clsx('pb-scroll', 'pb-fade', styles.view, mobile && styles.viewM)}>
            <div ref={wrapRef} className={styles.stage} style={{ aspectRatio: `${CARD_W} / ${H}` }}>
              <canvas ref={canvasRef} className={styles.canvas} />
              {/* 사진 칸 위에만 끌기 판 — 나머지는 그대로 스크롤된다 */}
              <div ref={grabRef} data-no-sheet-drag title="끌어서 옮기기, 휠로 배율" className={styles.grab}
                style={{ left: `${(PHOTO.x / CARD_W) * 100}%`, top: `${(PHOTO.y / H) * 100}%`, width: `${(PHOTO.w / CARD_W) * 100}%`, height: `${(PHOTO.h / H) * 100}%` }} />
              {(!chips || !board || !fonts) && <div className="pb-skel" style={{ position: 'absolute', inset: 0, borderRadius: 8 }} />}
            </div>
          </div>
          <button type="button" onClick={() => setView(null)} disabled={!view} title={view ? '사진을 처음 자리와 배율로' : '사진이 처음 자리에 있어요'}
            className={clsx('pb-ghost', styles.resetBtn)}><IconReset />원래 자리</button>
        </div>
        {side}
      </div>
      <PopBox pop={actPop} label="액션" keep={[actBtn]}>
        <ActionPickBody options={PV_ACTIONS_FLAT} groups={PV_ACTION_GROUPS} play={false} base={poseBase} onClose={actPop.close}
          current={pose ?? { action: s.pv.action, frame: s.pv.frame }} onPick={(a, f) => setPose({ action: a, frame: f })} />
      </PopBox>
      <PopBox pop={emoPop} label="이모티콘" keep={[emoBtn]}>
        <ChatEmoPicker mobile={false} pickFrame onClose={emoPop.close} value={emo ? { id: emo.id, frame: frame - 1 } : null}
          onPick={(e, f) => { setEmo(e); setFrame((f ?? 0) + 1); emoPop.close() }} />
      </PopBox>
      <SurfaceFooter onApply={save} applyLabel={saving ? '저장 중' : '저장'} />
    </>
  )
}
