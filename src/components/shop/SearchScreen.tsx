'use client'

// AI 코디 검색 — 코디탭과 "동일 경험". 헤더(부위 드롭다운 + 썸네일/모델/내모델 토글 + 베타 배지 + 페이지),
// 카드(장착 시 translateY(-5px)+테두리), 페이징/스와이프/방향키까지 코디탭 구조를 그대로 가져온다.
// 결과는 원본(raw) ListItem 이라 스프라이트/톤/염색/라벨이 코디와 완전히 동일하게 렌더된다.
import { useEffect, useRef, useState } from 'react'
import { CATS } from '@/lib/catalog'
import { css } from '@/lib/style'
import { MOBILE_H, isStacked } from '@/lib/useBreakpoint'
import { CAT_TO_SLOT, SLOT_TO_CAT, THUMB_VIEW, animaLayers, fixedExpr, forceMyModel, thumbView } from '@/lib/shopData'
import { getFrameLayers, type AssembleInput } from '@/lib/core/assemble'
import { badgeUrl, loadAnima, loadMeta, type AnimaRace, type ItemMeta, type ListItem } from '@/lib/core/data'
import { buildOverrides } from '@/lib/core/dye'
import { collectWornEffects, type WornEff } from '@/lib/core/thumbEffects'
import { useShop, type GenderFilter, type ListMode } from './ShopContext'
import ItemThumb from './ItemThumb'

const SEARCH_CATS = [{ id: 'all', label: '전체' }, ...CATS.filter((c) => c.id !== 'skin')]
const MODES: { v: ListMode; l: string }[] = [{ v: 'sprite', l: '썸네일' }, { v: 'model', l: '모델' }, { v: 'mymodel', l: '내 모델' }]
const NO_CASH_BADGE = new Set(['hair', 'face', 'skin'])
// 성별 필터 — 코디 탭과 동일 정의(공용 포함). 두 탭이 다르면 기준이 갈린다.
const GENDERS: { v: GenderFilter; l: string; hint: string }[] = [
  { v: 'all', l: '전체', hint: '모든 아이템' },
  { v: 'f', l: '여자', hint: '여자 캐릭터가 입을 수 있는 것 (여자 전용 + 공용)' },
  { v: 'm', l: '남자', hint: '남자 캐릭터가 입을 수 있는 것 (남자 전용 + 공용)' },
]
// override = 내 모델 배경(내 착용)의 현재 염색. 코디 탭과 100% 동일하게 보이도록 함께 넘긴다.
type Ctx = { items: AssembleInput[]; key: string; override?: Map<string, HTMLCanvasElement>; effs?: WornEff[]
  expr?: string             // 이 컨텍스트에 구워진 표정(표정 얼굴장식 착용 시 'default' 가 아니다)
  faceMeta?: ItemMeta | null // 표정 얼굴장식 카드가 얼굴을 자기 표정으로 다시 그릴 때 필요
}
const EMPTY_CTX: Ctx = { items: [], key: '' }

export default function SearchScreen() {
  const s = useShop()
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('all')
  const [menuOpen, setMenuOpen] = useState(false)
  const [hoverBtn, setHoverBtn] = useState(false)
  const [hoverCat, setHoverCat] = useState<string | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const list = s.searchResults
  const stacked = isStacked(s.bp)
  const narrow = s.bp !== 'pc'
  // 분리 기준은 CodiScreen 주석 참고 — mobile(=stacked)=레이아웃 전부, phone=글자 크기/문구뿐.
  const phone = s.bp === 'mobile'
  const mobile = stacked
  const searched = s.searchQuery !== null
  const gaze = s.pv.gaze
  const tv = thumbView(gaze, undefined, undefined, s.pv.weapon) // base(그냥 모델): 무기모션만, 귀/형상변이 ✗
  const [animaRaces, setAnimaRaces] = useState<AnimaRace[]>([])
  useEffect(() => { loadAnima().then(setAnimaRaces).catch(() => {}) }, [])
  const mode = s.listMode
  const gf = s.genderFilter
  const catLabel = SEARCH_CATS.find((c) => c.id === cat)?.label || '전체'
  // '모델' 모드인데 표정 얼굴장식이 결과에 있으면 그 카드는 '내 모델'로 승격된다 → 내 착용 배경이 필요.
  const needMy = mode === 'model' && list.some((it) => !!it.fixedEmotion)
  // 표정 얼굴장식은 맨 마네킹에 올려도 아무것도 안 보인다(성형이 없어 바뀔 얼굴이 없다) → '내 모델'로 승격.
  const effMode = (it: ListItem): ListMode =>
    forceMyModel(mode, it) ? 'mymodel' : (it.slot === 'hair' && mode === 'sprite') ? 'model' : mode

  // 부위 메뉴 바깥 클릭 시 닫기
  useEffect(() => {
    const onDown = (e: PointerEvent) => { if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setMenuOpen(false) }
    window.addEventListener('pointerdown', onDown, true)
    return () => window.removeEventListener('pointerdown', onDown, true)
  }, [])

  const run = (slot?: string | null) => { const t = q.trim(); if (!t) return; s.runSearch(t, slot !== undefined ? slot : (cat === 'all' ? null : CAT_TO_SLOT[cat])) }
  const pickCat = (id: string) => {
    setCat(id); setMenuOpen(false)
    const last = s.searchQuery // 이미 검색한 상태면 부위 바꿔 즉시 재검색(코디처럼 부위 전환=즉시 반영)
    if (last) s.runSearch(last, id === 'all' ? null : CAT_TO_SLOT[id])
  }

  // ── 모델/내모델 합성 컨텍스트(코디와 동일 방식): base(body+head, 현재 톤) + 내모델은 슬롯별(내 착용 − 그 슬롯) ──
  const [ctx, setCtx] = useState<{ base: Ctx; bySlot: Record<string, Ctx> }>({ base: EMPTY_CTX, bySlot: {} })
  const ctxKeyRef = useRef('')
  useEffect(() => {
    const idx = s.index
    const needCtx = !!idx && list.length > 0 && (mode !== 'sprite' || list.some((it) => it.slot === 'hair'))
    if (!needCtx) { if (ctxKeyRef.current) { ctxKeyRef.current = ''; setCtx({ base: EMPTY_CTX, bySlot: {} }) } return }
    let alive = true
    const toneEntry = idx!.base.tones.find((t) => t.tone === s.tone) || idx!.base.tones.find((t) => t.tone === idx!.base.default) || idx!.base.tones[0]
    const bodyId = toneEntry.body, headId = toneEntry.head
    const slotsInList = Array.from(new Set(list.map((it) => it.slot)))
    const myEq = Object.entries(s.equipped).filter(([sl, it]) => it && !s.hidden[sl]) as [string, ListItem][]
    const eqSig = myEq.map(([sl, it]) => sl + it.id).sort().join(',')
    // 내 모델: 우측 미리보기의 염색(발색/HSB)까지 동일 반영 → 키에 염색 시그니처 포함(코디 탭과 동일).
    const dyeSig = (mode === 'mymodel' || needMy) ? JSON.stringify({ p: s.dyePalette, h: s.dyeHsb }) : ''
    const key = `${mode}:${needMy}:${gaze}:${s.tone}:${slotsInList.join(',')}:${eqSig}:${dyeSig}:${s.pv.wEffect}${s.pv.cEffect}:${s.pv.form}:${s.pv.ear}:${s.pv.weapon}:${animaRaces.length}`
    if (key === ctxKeyRef.current) return
    const eqIds = (mode === 'mymodel' || needMy) ? myEq.map(([, it]) => it.id) : []
    const ids = Array.from(new Set([bodyId, headId, ...eqIds]))
    Promise.all(ids.map((id) => loadMeta(id).then((m) => [id, m] as const).catch(() => null))).then(async (res) => {
      if (!alive) return
      const map = new Map(res.filter(Boolean).map((r) => r!))
      const body = map.get(bodyId), head = map.get(headId)
      const baseItems: AssembleInput[] = []
      if (body) baseItems.push({ itemId: body.id, slot: 'body', vslot: null, layers: getFrameLayers(body, tv.view) })
      if (head) baseItems.push({ itemId: head.id, slot: 'head', vslot: null, layers: getFrameLayers(head, tv.view) })
      const bySlot: Record<string, Ctx> = {}
      // mode==='model' 이어도 표정 얼굴장식 카드는 '내 모델'로 승격되므로 그 슬롯의 배경이 필요하다.
      if (mode === 'mymodel' || needMy) {
        for (const slot of slotsInList) {
          // 표정 얼굴장식을 착용 중이면 이 슬롯 컨텍스트의 표정이 'default' 가 아니다. 단 후보가 들어갈
          // 슬롯의 착용품은 빠지므로(faceAcc 결과를 보는 중이면 내 얼굴장식은 제외) 슬롯마다 다르다.
          const cexpr = fixedExpr(myEq.filter(([sl]) => sl !== slot).map(([, it]) => it), THUMB_VIEW.expression)
          const cview = thumbView(gaze, cexpr, s.pv.ear, s.pv.weapon).view
          // 내 모델: 몸통/머리를 cview(귀 반영)로 다시 짜고 형상변이를 더한다(baseItems 는 귀/형상변이 없는 그냥-모델용).
          const items: AssembleInput[] = []
          if (body) items.push({ itemId: body.id, slot: 'body', vslot: null, layers: getFrameLayers(body, cview) })
          if (head) items.push({ itemId: head.id, slot: 'head', vslot: null, layers: getFrameLayers(head, cview) })
          if (head) items.push(...animaLayers(s.pv.form, animaRaces))
          const dyeMetas: ItemMeta[] = []
          let faceMeta: ItemMeta | null = null
          for (const [sl, it] of myEq) {
            if (sl === slot) continue // 후보 아이템이 들어갈 슬롯은 내 착용에서 제외
            const m = map.get(it.id); if (!m) continue
            items.push({ itemId: m.id, slot: sl, vslot: m.vslot ?? null, layers: getFrameLayers(m, cview), invisibleFace: m.invisibleFace, name: m.name })
            dyeMetas.push(m)
            if (sl === 'face') faceMeta = m
          }
          // 배경(내 착용)의 현재 염색을 구워 넣는다. 후보 아이템 자체는 기본색(미장착).
          const override = await buildOverrides(dyeMetas, { palette: s.dyePalette, hsb: s.dyeHsb }, cview).catch(() => new Map())
          // 착용 이펙트(망토 오라 등)도 카드에 그린다 + 이펙트 염색을 override 에 굽는다(토글 꺼진 슬롯 제외).
          const effs = await collectWornEffects(
            myEq.filter(([sl]) => sl !== slot).map(([sl, it]) => ({ slot: sl, id: it.id })), s.pv, s.dyeHsb, override,
          ).catch(() => [])
          bySlot[slot] = { items, key: `${key}:${slot}:${cexpr}`, override, effs, expr: cexpr, faceMeta }
        }
      }
      if (!alive) return
      ctxKeyRef.current = key
      setCtx({ base: { items: baseItems, key }, bySlot })
    })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.index, s.tone, gaze, mode, needMy, s.equipped, s.hidden, list, s.dyePalette, s.dyeHsb, s.pv.wEffect, s.pv.cEffect, s.pv.form, s.pv.ear, s.pv.weapon, animaRaces])

  const ctxFor = (item: ListItem): Ctx => {
    const em = effMode(item)
    if (em === 'sprite') return EMPTY_CTX
    if (em === 'mymodel') return ctx.bySlot[item.slot] || ctx.base
    return ctx.base
  }

  const thumbBox = 'flex:1 1 auto; width:100%; min-height:0; border-radius:8px; background:#f7f2ec; display:flex; align-items:center; justify-content:center; overflow:hidden;'
  const gridStyle = `display:grid; grid-template-columns:repeat(${s.cols},minmax(0,1fr)); grid-template-rows:repeat(${s.rows},1fr); gap:${mobile ? 10 : 16}px; height:100%;`
  const pages = Array.from({ length: s.pageCount }, (_, p) => list.slice(p * s.itemsPerPage, p * s.itemsPerPage + s.itemsPerPage))
  const trackStyle = `display:flex; height:100%; width:100%; will-change:transform; transform:translateX(calc(${-s.curIdx * 100}% + ${s.offset}px)); transition:${s.snapping ? 'transform .34s cubic-bezier(.22,.61,.36,1)' : 'none'};`

  const cell = (item: ListItem) => {
    const em = effMode(item)
    const c = ctxFor(item)
    const sel = s.equipped[item.slot]?.id === item.id
    const dyeable = item.dyeMode !== 'none'
    const badgeKind: 'master' | 'special' | 'cash' | null =
      item.label ? item.label : (item.isCash && !NO_CASH_BADGE.has(item.slot)) ? 'cash' : null
    return (
      <div key={item.id} onClick={() => s.equipFromCat(SLOT_TO_CAT[item.slot], item)} className="pb-cardwrap">
        <div className="pb-card" style={css(`display:flex; flex-direction:column; align-items:center; gap:${mobile ? 5 : 8}px; padding:${mobile ? '7px 5px 6px' : '12px 8px 10px'}; ${sel ? `border:1px solid #ec86ac; transform:translateY(-${mobile ? 3 : 5}px); ` : ''}border-radius:12px; background:${sel ? '#fdf0f5' : '#fff'}; cursor:pointer; min-height:0; min-width:0;`)}>
          {dyeable && (
            <button onClick={(e) => { e.stopPropagation(); s.openDye(item.slot, item) }} className="pb-dye" title="이 아이템 염색" style={css('position:absolute; top:7px; right:7px; height:22px; padding:0 9px; border-radius:20px; border:1px solid #f4cfdf; background:#fce9f1; color:#d76d9a; font-family:inherit; font-size:10px; font-weight:600; cursor:pointer; z-index:2;')}>염색</button>
          )}
          <div style={css(thumbBox + ' position:relative;')}>
            <ItemThumb item={item} mode={em} gaze={gaze} ctxItems={c.items} ctxKey={c.key} override={c.override} ctxEffs={c.effs} pvEff={s.pv} zmap={s.index?.zmap || []} smap={s.index?.smap || {}}
              ctxExpr={c.expr} faceMeta={c.faceMeta} dye={em === 'mymodel' ? { palette: s.dyePalette, hsb: s.dyeHsb } : undefined} ear={em === 'mymodel' ? s.pv.ear : undefined} weapon={s.pv.weapon} isMy={em === 'mymodel'} />
            {badgeKind && (
              <img src={badgeUrl(badgeKind)} alt={badgeKind} draggable={false} onError={(e) => { e.currentTarget.style.display = 'none' }}
                style={{ position: 'absolute', bottom: 4, left: 4, height: badgeKind === 'cash' ? 14 : 17, imageRendering: 'pixelated', zIndex: 2 }} />
            )}
          </div>
          <div title={item.name || item.id} style={css(`flex:0 0 auto; font-size:${phone ? 11 : 12}px; font-weight:500; color:#3d372f; line-height:1.3; text-align:center; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; width:100%;`)}>{item.name || item.id}</div>
        </div>
      </div>
    )
  }

  // ── 헤더 스타일(코디탭 부위 드롭다운과 동일) ──
  const partBtnBg = menuOpen ? '#fce9f1' : hoverBtn ? '#f7f2ec' : 'transparent'
  const partBtnBd = menuOpen ? '#eeb2ce' : hoverBtn ? '#e0d8ce' : '#eee6dc'
  // 배지가 짧아(부위 ▾ / 폰은 ▾) 칩이 붙어도 다 들어간다 → 버튼·이름을 줄이지 않는다.
  const partBtn = `display:flex; align-items:center; gap:${phone ? 6 : 9}px; height:40px; padding:0 ${phone ? 9 : 12}px; margin-left:-4px; border:1px solid ${partBtnBd}; border-radius:10px; cursor:pointer; background:${partBtnBg}; transition:background .14s ease, border-color .14s ease;`
  const partBadgeBg = menuOpen ? '#ec86ac' : hoverBtn ? '#eddbe4' : '#f2ece5'
  const partBadgeCol = menuOpen ? '#fff' : hoverBtn ? '#d76d9a' : '#a89e93'
  const partBadge = `flex:0 0 auto; display:inline-flex; align-items:center; justify-content:center; gap:4px; height:22px; padding:0 ${phone ? 6 : 9}px; border-radius:20px; font-size:11px; font-weight:600; background:${partBadgeBg}; color:${partBadgeCol}; transition:background .14s ease, color .14s ease;`
  const partMenu = `position:absolute; top:calc(100% + 8px); left:0; z-index:20; width:min(360px, 84vw); padding:10px; background:#fff; border:1px solid #e7ded4; border-radius:12px; box-shadow:0 12px 32px rgba(42,37,33,.12); transform-origin:top left; transition:opacity .2s ease, transform .2s cubic-bezier(.22,.61,.36,1); opacity:${menuOpen ? 1 : 0}; transform:translateY(${menuOpen ? '0' : '-6px'}) scale(${menuOpen ? 1 : 0.98}); pointer-events:${menuOpen ? 'auto' : 'none'};`

  return (
    <section style={css(`${mobile ? `flex:0 0 auto; width:100%; height:${MOBILE_H.search}` : stacked ? 'flex:1 1 auto; width:100%' : 'flex:0 0 65%'}; min-width:0; min-height:0; background:#fff; border:1px solid #e7ded4; border-radius:16px; display:flex; flex-direction:column; overflow:hidden;`)}>
      {/* 헤더: 코디탭과 동일 구조(부위 드롭다운 + 표시모드 토글 + 베타 배지 + 페이지) + 검색 입력 행.
          프리셋과 동일한 레이아웃 규칙 — 상단 바(자체 하단 border) → 입력 섹션 → 좌우 여백 있는 inset 선. */}
      <div style={css('flex:0 0 auto; display:flex; flex-direction:column;')}>
        {/* 상단 바 — 코디 헤더와 동일 크기(58px) → 탭 전환 시 시프트 없음. 프리셋 헤더처럼 자체 하단 border 로 닫는다. */}
        <div style={css(`flex:0 0 auto; ${mobile ? `flex-wrap:wrap; min-height:50px; padding:7px ${phone ? 12 : 16}px;` : narrow ? 'flex-wrap:wrap; min-height:58px; padding:9px 16px;' : 'height:58px; padding:0 22px;'} display:flex; align-items:center; gap:${narrow ? 8 : 12}px; border-bottom:1px solid #f0e9e1;`)}>
          {/* 부위 선택 + 표시모드 토글 (모바일=한 줄 space-between)
              flex:1 1 0(basis 0) + 안쪽 0-0-auto 버튼 조합이 half 폭에서 페이지 입력을 뚫고 겹치던 원인.
              좁은 화면은 자연 폭 + wrap 으로 전환. */}
          <div style={css(`${mobile ? 'flex:1 1 100%; justify-content:space-between;' : narrow ? 'flex:0 1 auto; flex-wrap:wrap;' : 'flex:1 1 0;'} min-width:0; display:flex; align-items:center; gap:${phone ? 6 : 10}px;`)}>
            <div ref={wrapRef} style={css('position:relative; flex:0 0 auto;')}>
              <button onClick={() => setMenuOpen(!menuOpen)} onMouseEnter={() => setHoverBtn(true)} onMouseLeave={() => setHoverBtn(false)} title="검색할 부위·성별 선택" style={css(partBtn)}>
                <span style={css('flex:0 0 auto; font-size:15px; font-weight:700; white-space:nowrap; color:#2a2521;')}>{catLabel}</span>
                {gf !== 'all' && (
                  <span style={css(`flex:0 0 auto; display:inline-flex; align-items:center; height:22px; padding:0 ${phone ? 6 : 8}px; border-radius:20px; font-size:11px; font-weight:700; white-space:nowrap; background:${gf === 'f' ? '#fce9f1' : '#e7f0fb'}; color:${gf === 'f' ? '#d76d9a' : '#5a86c4'};`)}>{gf === 'f' ? '여' : '남'}</span>
                )}
                <span style={css(partBadge)}>부위 ▾</span>
              </button>
              <div style={css(partMenu)}>
                {/* 성별 필터 — 코디 탭과 같은 자리·같은 규칙(공용 포함). 탭을 옮겨도 기준이 안 바뀐다. */}
                <div style={css('display:flex; align-items:center; gap:8px; padding:2px 2px 8px;')}>
                  <span style={css('flex:0 0 auto; font-size:11px; font-weight:600; color:#a89e93;')}>성별</span>
                  <div style={css('flex:1 1 auto; display:flex; gap:3px; padding:3px; background:#f4ecf3; border-radius:9px;')}>
                    {GENDERS.map((g) => {
                      const on = gf === g.v
                      return (
                        <button key={g.v} onClick={() => { s.setGenderFilter(g.v); s.setOffset(0); s.setSnapping(false) }}
                          className={on ? 'pb-h-solid' : 'pb-h-soft'} title={g.hint}
                          style={css(`flex:1 1 0; height:28px; border:none; border-radius:7px; cursor:pointer; font-family:inherit; font-size:12px; font-weight:${on ? 600 : 500}; white-space:nowrap; color:${on ? '#fff' : '#8a8075'}; background:${on ? '#ec86ac' : 'transparent'}; transition:background .22s ease, color .22s ease;`)}>{g.l}</button>
                      )
                    })}
                  </div>
                </div>
                <div style={css('height:1px; background:#f0e9e1; margin:0 2px 8px;')} />
                <div style={css('display:grid; grid-template-columns:repeat(3,1fr); gap:4px;')}>
                  {SEARCH_CATS.map((c) => {
                    const on = c.id === cat, hov = hoverCat === c.id
                    let bg = on ? '#ec86ac' : 'transparent', col = on ? '#fff' : '#7a7066'
                    if (hov && !on) { bg = '#f4e7ee'; col = '#ec86ac' }
                    return (
                      <button key={c.id} onClick={() => pickCat(c.id)} onMouseEnter={() => setHoverCat(c.id)} onMouseLeave={() => setHoverCat(null)}
                        style={css(`width:100%; display:flex; align-items:center; justify-content:center; height:40px; padding:0 8px; border:none; border-radius:9px; cursor:pointer; font-family:inherit; font-size:13px; font-weight:${on ? 600 : 500}; color:${col}; background:${bg}; transition:background .26s ease, color .26s ease;`)}>{c.label}</button>
                    )
                  })}
                </div>
              </div>
            </div>
            <div title="아이템 표시 방식" style={css('flex:0 0 auto; display:flex; align-items:center; gap:3px; padding:3px; background:#f4ecf3; border-radius:9px;')}>
              {MODES.map((m) => {
                const on = mode === m.v
                return (
                  <button key={m.v} onClick={() => s.setListMode(m.v)} className={on ? 'pb-h-solid' : 'pb-h-soft'}
                    style={css(`height:28px; padding:0 ${phone ? 8 : 11}px; border:none; border-radius:7px; cursor:pointer; font-family:inherit; font-size:${phone ? 11 : 12}px; font-weight:${on ? 600 : 500}; white-space:nowrap; color:${on ? '#fff' : '#8a8075'}; background:${on ? '#ec86ac' : 'transparent'}; transition:background .22s ease, color .22s ease, filter .18s ease;`)}>{m.l}</button>
                )
              })}
            </div>
          </div>
          {/* 페이지 (중앙) */}
          <div style={css('flex:0 0 auto; display:flex; align-items:center; gap:6px; font-variant-numeric:tabular-nums;')}>
            <span style={css('font-size:11px; font-weight:500; color:#a89e93;')}>페이지</span>
            <input value={s.pageEditing ? s.pageInput : `${s.curIdx + 1}`} onFocus={s.onPageFocus} onChange={s.onPageChange} onKeyDown={s.onPageKey} onBlur={s.commitPage} inputMode="numeric" aria-label="현재 페이지"
              style={css('width:44px; height:34px; padding:0 6px; border:1.5px solid #eeb2ce; border-radius:8px; background:#fff; text-align:center; font-family:inherit; font-size:14px; font-weight:700; color:#ec86ac; outline:none; cursor:text; transition:border-color .14s ease;')} />
            <span style={css('font-size:13px; font-weight:500; color:#c3b9ad;')}>/</span>
            <span style={css('font-size:14px; font-weight:600; color:#8a8075;')}>{s.pageCount}</span>
          </div>
          {/* 베타 배지 (우측 끝) */}
          <div style={css('flex:1 1 0; min-width:0; display:flex; justify-content:flex-end;')}>
            <span style={css('flex:0 0 auto; font-size:11px; font-weight:600; color:#d76d9a; background:#fce9f1; padding:3px 8px; border-radius:20px; white-space:nowrap;')}>베타 · 재미용</span>
          </div>
        </div>
        {/* LLM 입력 섹션(상단 58px 바 아래) — 검색 입력 + AI 검색 버튼(높이 34) */}
        <div style={css(`flex:0 0 auto; padding:${mobile ? `0 ${phone ? 12 : 16}px 9px` : narrow ? '0 16px 10px' : '12px 22px'}; display:flex; gap:8px; flex-wrap:wrap; align-items:center;`)}>
          {/* 모바일에서 입력·버튼이 각각 100% 를 먹어 2행(84px)을 잡아먹었다 → 한 행으로 합쳐 그리드에 돌려준다. */}
          <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') run() }} placeholder={phone ? '생김새로 검색 (예: 동물 귀)' : '아이템 생김새를 적어보세요 (예: 여자 단발 헤어, 동물 귀)'}
            style={css(`flex:1 1 ${phone ? '0' : '200px'}; min-width:0; height:34px; padding:0 12px; border:1.5px solid #eeb2ce; border-radius:8px; background:#faf7f3; font-family:inherit; font-size:13px; color:#3d372f; outline:none; transition:border-color .14s ease;`)} />
          <button onClick={() => run()} disabled={s.searchLoading} className="pb-h-solid" style={css(`flex:0 0 auto; height:34px; padding:0 ${phone ? 14 : 18}px; border:none; border-radius:8px; background:${s.searchLoading ? '#f0aecb' : '#ec86ac'}; color:#fff; font-family:inherit; font-size:13px; font-weight:600; cursor:${s.searchLoading ? 'default' : 'pointer'}; white-space:nowrap; transition:background .18s ease, filter .18s ease;`)}>{s.searchLoading ? '검색 중…' : 'AI 검색'}</button>
        </div>
        {/* 프리셋과 동일한 "완전히 닫히지 않은" inset 선 — 입력 섹션과 결과 캐러셀 구분 */}
        <div style={css(`flex:0 0 auto; height:1px; margin:0 ${mobile ? (phone ? 12 : 16) : narrow ? 16 : 22}px; background:#f0e9e1;`)} />
      </div>

      {/* 결과 캐러셀 — 코디탭과 동일 */}
      {/* 모바일은 pan-y — 세로는 문서 스크롤(브라우저), 가로는 페이지 넘김(우리). CodiScreen 주석 참고. */}
      <div ref={s.bindVp} style={css(`flex:1 1 auto; min-height:0; overflow:hidden; position:relative; touch-action:${mobile ? 'pan-y' : 'none'}; cursor:${mobile ? 'grab' : 'default'}; user-select:none;`)}>
        {s.searchLoading ? (
          <div style={css('width:100%; height:100%; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:14px;')}>
            <div className="pb-spin" style={{ width: 26, height: 26, borderColor: 'rgba(236,134,172,.35)', borderTopColor: '#ec86ac' }} />
            <div style={css('font-size:13px; font-weight:600; color:#a89e93;')}>코디를 찾는 중…</div>
          </div>
        ) : !searched ? (
          <div style={css('width:100%; height:100%; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:10px; text-align:center; padding:0 24px;')}>
            <div style={css('font-size:40px;')}>🔎</div>
            <div style={css(`font-size:${mobile ? 14 : 15}px; font-weight:600; color:#8a8075; word-break:keep-all;`)}>문장으로 원하는 코디를 찾아보세요</div>
            <div style={css('font-size:12.5px; color:#b7ada2; word-break:keep-all; max-width:400px; line-height:1.6;')}><b style={css('color:#c99bb2;')}>아직 베타 기능</b>이에요. 결과가 부정확할 수 있으니 <b style={css('color:#c99bb2;')}>재미로 가볍게</b> 즐겨 주세요 — 더 좋은 품질을 준비 중입니다. 부위·성별(여자/남자)을 함께 넣으면 조금 더 잘 찾아요.</div>
          </div>
        ) : list.length === 0 ? (
          <div style={css('width:100%; height:100%; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:8px; text-align:center; padding:0 24px;')}>
            <div style={css('font-size:34px;')}>🫧</div>
            <div style={css('font-size:14px; font-weight:600; color:#8a8075;')}>결과가 없어요</div>
            <div style={css('font-size:12.5px; color:#b7ada2;')}>다른 표현으로 검색하거나 부위를 ‘전체’로 바꿔 보세요.</div>
          </div>
        ) : (
          <div style={css(trackStyle)}>
            {pages.map((items, pi) => (
              <div key={pi} style={css(`flex:0 0 100%; width:100%; height:100%; padding:${mobile ? '10px 12px' : '18px 22px'}; contain:paint;`)}>
                {Math.abs(pi - s.curIdx) <= 1 && (
                  <div style={css(gridStyle)}>{items.map((it) => cell(it))}</div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={css(`flex:0 0 auto; height:${mobile ? 26 : 38}px; display:flex; align-items:center; justify-content:center; padding:0 12px; border-top:1px solid #f0e9e1;`)}>
        <span style={css(`font-size:${mobile ? 10.5 : 12}px; color:#a89e93; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;`)}>{mobile ? '스와이프로 페이지를 넘길 수 있어요' : '스크롤 · 스와이프 · ← → 방향키로 페이지를 넘길 수 있어요'}</span>
      </div>
    </section>
  )
}
