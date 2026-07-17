'use client'

import { useEffect, useRef, useState } from 'react'
import { CATS } from '@/lib/catalog'
import { MOBILE_H, isStacked } from '@/lib/useBreakpoint'
import { getFrameLayers, type AssembleInput } from '@/lib/core/assemble'
import { badgeUrl, loadMeta, type ItemMeta, type ListItem } from '@/lib/core/data'
import { buildOverrides } from '@/lib/core/dye'
import { collectWornEffects, type WornEff } from '@/lib/core/thumbEffects'
import { CAT_TO_SLOT, SLOT_TO_CAT, isColorLineSkin, thumbView } from '@/lib/shopData'
import { css } from '@/lib/style'
import { useShop, type GenderFilter, type ListMode } from './ShopContext'
import ItemThumb from './ItemThumb'

// 부위 메뉴 = 전체 + 15부위(3열 × 6행, 마지막 줄은 방패 하나). '전체'는 모든 부위를 한 리스트로.
const PART_CATS = [{ id: 'all', label: '전체' }, ...CATS]
const MODES: { v: ListMode; l: string }[] = [
  { v: 'sprite', l: '썸네일' }, { v: 'model', l: '모델' }, { v: 'mymodel', l: '내 모델' },
]
// 헤어/성형/피부는 전부 캐시라 캐시 배지가 정보 가치 없음 → 숨김(라벨은 예외 유지).
const NO_CASH_BADGE = new Set(['hair', 'face', 'skin'])
// 성별 필터. "여자"=여 전용만이 아니라 **여캐가 입을 수 있는 것**(여+공용)이다 — 사람들이 원하는 건
// "여자 전용템 목록"이 아니라 "내 캐릭터가 입을 수 있는 것만 보기"다.
const GENDERS: { v: GenderFilter; l: string; hint: string }[] = [
  { v: 'all', l: '전체', hint: '모든 아이템' },
  { v: 'f', l: '여자', hint: '여자 캐릭터가 입을 수 있는 것 (여자 전용 + 공용)' },
  { v: 'm', l: '남자', hint: '남자 캐릭터가 입을 수 있는 것 (남자 전용 + 공용)' },
]

export default function CodiScreen() {
  const s = useShop()
  const activeMeta = PART_CATS.find((c) => c.id === s.activeCat) || PART_CATS[0]
  const list = s.activeList // 검색 필터 + folded (정렬 순서 유지)
  const loading = s.catLoading
  const isAll = s.activeCat === 'all'
  const isSkinCat = s.activeCat === 'skin'
  const isHairCat = s.activeCat === 'hair'
  // 헤어/피부는 썸네일(스프라이트)=모델이라 스프라이트 보기 무의미 → 썸네일 잠그고 모델로 대체.
  // '전체'는 부위가 섞이므로 토글은 잠그지 않고, 아이템별로 헤어/피부만 모델로 승격한다(검색 탭과 동일).
  const noSprite = isHairCat || isSkinCat
  const mode: ListMode = noSprite && s.listMode === 'sprite' ? 'model' : s.listMode
  const effMode = (slot: string): ListMode =>
    (mode === 'sprite' && (slot === 'hair' || slot === 'skin')) ? 'model' : mode
  const gf = s.genderFilter
  const gaze = s.pv.gaze // 시선(왼/오/뒷)을 썸네일에도 반영
  const tv = thumbView(gaze)

  // 모델/내모델 공통 배경(base 또는 내 착용) 조립 입력 + 키
  const [ctx, setCtx] = useState<{ items: AssembleInput[]; key: string; override: Map<string, HTMLCanvasElement>; effs: WornEff[] }>({ items: [], key: '', override: new Map(), effs: [] })
  const ctxKeyRef = useRef('')
  useEffect(() => {
    const idx = s.index
    if (mode === 'sprite' || !idx) { if (ctxKeyRef.current) { ctxKeyRef.current = ''; setCtx({ items: [], key: '', override: new Map(), effs: [] }) } return }
    let alive = true
    const toneEntry = idx.base.tones.find((t) => t.tone === s.tone) || idx.base.tones.find((t) => t.tone === idx.base.default) || idx.base.tones[0]
    const bodyId = toneEntry.body, headId = toneEntry.head
    const activeSlot = isAll ? null : CAT_TO_SLOT[s.activeCat] // '전체'는 제외할 활성 슬롯이 없다
    const eqEntries = mode === 'mymodel'
      ? Object.entries(s.equipped).filter(([sl, it]) => it && sl !== activeSlot && !s.hidden[sl]) as [string, ListItem][]
      : []
    const eqSig = eqEntries.map(([sl, it]) => sl + it.id).sort().join(',')
    // 내 모델: 우측 미리보기에 적용된 염색(발색/HSB)을 썸네일 배경(내 착용)에도 동일 반영 → 키에 염색 시그니처 포함.
    const dyeSig = mode === 'mymodel' ? JSON.stringify({ p: s.dyePalette, h: s.dyeHsb }) : ''
    const key = `${mode}:${gaze}:${s.tone}:${isSkinCat ? 'skin' : 'base'}:${eqSig}:${dyeSig}:${s.pv.wEffect}${s.pv.cEffect}`
    if (key === ctxKeyRef.current) return // 이미 최신 컨텍스트 → 불필요한 재조립/리렌더 방지
    // ⚠️ ctxKeyRef 는 async 가 "실제로 setCtx 로 커밋된 뒤"에만 찍는다. StrictMode(dev)는 mount 시
    // setup→cleanup→setup 을 돌리는데, 커밋 전에 ref 를 찍어두면 두 번째 setup 이 key===ref 로 early-return
    // 하고 첫 setup 의 async 는 cleanup(alive=false)으로 버려져 → ctx 가 영영 비어버린다(탭 왕복 후 아이콘 사라짐).
    const ids = [...(isSkinCat ? [] : [bodyId, headId]), ...eqEntries.map(([, it]) => it.id)]
    Promise.all(ids.map((id) => loadMeta(id).then((m) => [id, m] as const).catch(() => null))).then(async (res) => {
      if (!alive) return
      const map = new Map(res.filter(Boolean).map((r) => r!))
      const items: AssembleInput[] = []
      if (!isSkinCat) {
        const body = map.get(bodyId), head = map.get(headId)
        if (body) items.push({ itemId: body.id, slot: 'body', vslot: null, layers: getFrameLayers(body, tv.view) })
        if (head) items.push({ itemId: head.id, slot: 'head', vslot: null, layers: getFrameLayers(head, tv.view) })
      }
      for (const [sl, it] of eqEntries) {
        const m = map.get(it.id); if (!m) continue
        items.push({ itemId: m.id, slot: sl, vslot: m.vslot ?? null, layers: getFrameLayers(m, tv.view), invisibleFace: m.invisibleFace, name: m.name })
      }
      // 내 모델: 착용 아이템(활성 슬롯 제외)의 현재 염색을 override 로 구워 배경에 반영. 후보 아이템 자체는 기본색(미장착).
      let override = new Map<string, HTMLCanvasElement>()
      let effs: WornEff[] = []
      if (mode === 'mymodel') {
        const dyeMetas = eqEntries.map(([, it]) => map.get(it.id)).filter(Boolean) as ItemMeta[]
        override = await buildOverrides(dyeMetas, { palette: s.dyePalette, hsb: s.dyeHsb }, tv.view).catch(() => new Map())
        // 착용 아이템의 이펙트(망토 오라 등)도 카드에 그린다 + 그 이펙트 염색을 override 에 굽는다.
        // 연출 토글이 꺼진 슬롯은 아예 제외 → 카드에서도 안 보인다.
        effs = await collectWornEffects(eqEntries.map(([sl, it]) => ({ slot: sl, id: it.id })), s.pv, s.dyeHsb, override).catch(() => [])
      }
      if (!alive) return
      ctxKeyRef.current = key // 커밋 성공 시에만 기록(위 주석 참고)
      setCtx({ items, key, override, effs })
    })
    return () => { alive = false }
  }, [mode, gaze, s.index, s.tone, s.activeCat, s.equipped, s.hidden, isSkinCat, isAll, s.dyePalette, s.dyeHsb, s.pv.wEffect, s.pv.cEffect])

  const pages = Array.from({ length: s.pageCount }, (_, p) => list.slice(p * s.itemsPerPage, p * s.itemsPerPage + s.itemsPerPage))
  const gridStyle = `display:grid; grid-template-columns:repeat(${s.cols},minmax(0,1fr)); grid-template-rows:repeat(${s.rows},1fr); gap:${s.bp === 'mobile' ? 10 : 16}px; height:100%;`
  const stacked = isStacked(s.bp)
  const narrow = s.bp !== 'pc' // 좁으면 헤더(부위·모드·페이지·검색)를 wrap 시켜 겹침 방지
  // ⚠️ 분리 기준: phone 은 "글자 크기"뿐이다.
  //   mobile(=stacked, 태블릿 포함) → 레이아웃 전부(행 배치·정렬·space-between·여백·높이). 태블릿도 세로 스택이라
  //     같은 구조여야 한다. 행 배치까지 phone 전용으로 두면 태블릿만 페이지가 뷰어모드 옆에 붙어 어긋난다.
  //   phone(=모바일만) → 폰트/문구 길이. 태블릿은 가로가 넓어 줄일 이유가 없다.
  const phone = s.bp === 'mobile'
  const mobile = stacked
  const trackStyle = `display:flex; height:100%; width:100%; will-change:transform; transform:translateX(calc(${-s.curIdx * 100}% + ${s.offset}px)); transition:${s.snapping ? 'transform .34s cubic-bezier(.22,.61,.36,1)' : 'none'};`

  // (여)/(남) 칩이 붙어도 배지가 짧아 모든 환경에서 들어간다 → 버튼을 줄이지 않는다(이름이 잘리면 안 된다).
  const partBtnStyle = (() => {
    const bg = s.partMenuOpen ? '#fce9f1' : s.hoverPartBtn ? '#f7f2ec' : 'transparent'
    const bd = s.partMenuOpen ? '#eeb2ce' : s.hoverPartBtn ? '#e0d8ce' : '#eee6dc'
    return `display:flex; align-items:center; gap:${phone ? 6 : 9}px; height:40px; padding:0 ${phone ? 9 : 12}px; margin-left:-4px; border:1px solid ${bd}; border-radius:10px; cursor:pointer; background:${bg}; transition:background .14s ease, border-color .14s ease;`
  })()
  const partBadgeStyle = (() => {
    const bg = s.partMenuOpen ? '#ec86ac' : s.hoverPartBtn ? '#eddbe4' : '#f2ece5'
    const col = s.partMenuOpen ? '#fff' : s.hoverPartBtn ? '#d76d9a' : '#a89e93'
    return `flex:0 0 auto; display:inline-flex; align-items:center; justify-content:center; gap:4px; height:22px; padding:0 ${phone ? 6 : 9}px; border-radius:20px; font-size:11px; font-weight:600; letter-spacing:-0.01em; background:${bg}; color:${col}; transition:background .14s ease, color .14s ease;`
  })()
  const partMenuStyle = `position:absolute; top:calc(100% + 8px); left:0; z-index:20; width:min(360px, calc(100vw - 40px)); padding:10px; background:#fff; border:1px solid #e7ded4; border-radius:12px; box-shadow:0 12px 32px rgba(42,37,33,.12); transform-origin:top left; transition:opacity .2s ease, transform .2s cubic-bezier(.22,.61,.36,1); opacity:${s.partMenuOpen ? 1 : 0}; transform:translateY(${s.partMenuOpen ? '0' : '-6px'}) scale(${s.partMenuOpen ? 1 : 0.98}); pointer-events:${s.partMenuOpen ? 'auto' : 'none'};`

  const thumbBox = 'flex:1 1 auto; width:100%; min-height:0; border-radius:8px; background:#f7f2ec; display:flex; align-items:center; justify-content:center; overflow:hidden;'

  const cell = (item: ListItem) => {
    // '전체'는 부위가 섞이므로 활성 부위가 아니라 **아이템 자신의 슬롯**을 기준으로 판단한다.
    const cat = isAll ? SLOT_TO_CAT[item.slot] : s.activeCat
    const em = effMode(item.slot)
    const sel = s.isEquippedInCat(cat, item.id)
    const isSkinItem = item.slot === 'skin'
    // 피부는 원칙적으로 염색 불가지만, "컬러라인" 커스텀 피부는 라인만 HSB 로 염색 가능.
    const dyeable = isSkinItem ? isColorLineSkin(item.name) : item.dyeMode !== 'none'
    const badgeKind: 'master' | 'special' | 'cash' | null =
      item.label ? item.label : (item.isCash && !NO_CASH_BADGE.has(item.slot)) ? 'cash' : null
    return (
      <div key={item.id} onClick={() => s.equipFromCat(cat, item)} className="pb-cardwrap">
        <div className="pb-card" style={css(`display:flex; flex-direction:column; align-items:center; gap:${mobile ? 5 : 8}px; padding:${mobile ? '7px 5px 6px' : '12px 8px 10px'}; ${sel ? `border:1px solid #ec86ac; transform:translateY(-${mobile ? 3 : 5}px); ` : ''}border-radius:12px; background:${sel ? '#fdf0f5' : '#fff'}; cursor:pointer; min-height:0; min-width:0;`)}>
          {dyeable && (
            <button onClick={(e) => { e.stopPropagation(); s.openDye(item.slot, item) }} className="pb-dye" title="이 아이템 염색" style={css('position:absolute; top:7px; right:7px; height:22px; padding:0 9px; border-radius:20px; border:1px solid #f4cfdf; background:#fce9f1; color:#d76d9a; font-family:inherit; font-size:10px; font-weight:600; cursor:pointer; z-index:2;')}>염색</button>
          )}
          <div style={css(thumbBox + ' position:relative;')}>
            <ItemThumb item={item} mode={em} gaze={gaze} ctxItems={ctx.items} ctxKey={ctx.key} override={ctx.override} ctxEffs={ctx.effs} pvEff={s.pv} zmap={s.index?.zmap || []} smap={s.index?.smap || {}} skinHeadId={isSkinItem ? item.headId : undefined} />
            {badgeKind && (
              <img src={badgeUrl(badgeKind)} alt={badgeKind} draggable={false} title={badgeKind} onError={(e) => { e.currentTarget.style.display = 'none' }}
                style={{ position: 'absolute', bottom: 4, left: 4, height: badgeKind === 'cash' ? 14 : 17, imageRendering: 'pixelated', zIndex: 2 }} />
            )}
          </div>
          <div title={item.name || item.id} style={css(`flex:0 0 auto; font-size:${phone ? 11 : 12}px; font-weight:500; color:#3d372f; line-height:1.3; text-align:center; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; width:100%;`)}>{item.name || item.id}</div>
        </div>
      </div>
    )
  }

  const skeletonCell = (i: number) => (
    <div key={i} className="pb-cardwrap">
      <div className="pb-card" style={css(`display:flex; flex-direction:column; align-items:center; gap:${mobile ? 5 : 8}px; padding:${mobile ? '7px 5px 6px' : '12px 8px 10px'}; border-radius:12px; background:#fff; min-height:0; min-width:0;`)}>
        <div className="pb-skel" style={css('flex:1 1 auto; width:100%; min-height:0; border-radius:8px;')} />
        <div className="pb-skel" style={css(`flex:0 0 auto; width:70%; height:${mobile ? 10 : 12}px; border-radius:6px;`)} />
      </div>
    </div>
  )

  return (
    <section style={css(`${mobile ? `flex:0 0 auto; width:100%; height:${MOBILE_H.list}` : stacked ? 'flex:1 1 auto; width:100%' : 'flex:0 0 65%'}; min-width:0; min-height:0; background:#fff; border:1px solid #e7ded4; border-radius:16px; display:flex; flex-direction:column; overflow:hidden;`)}>
      <div style={css(`flex:0 0 auto; ${mobile ? `flex-wrap:wrap; min-height:50px; padding:7px ${phone ? 12 : 16}px;` : narrow ? 'flex-wrap:wrap; min-height:58px; padding:9px 16px;' : 'height:58px; padding:0 22px;'} display:flex; align-items:center; gap:${narrow ? 8 : 12}px; border-bottom:1px solid #f0e9e1;`)}>
        {/* flex:1 1 0 은 basis 0 이라 안쪽 0-0-auto 버튼들이 컨테이너를 뚫고 나가 페이지 입력과 겹친다.
            좁은 화면에선 자연 폭(0 1 auto) + wrap 으로 바꿔 구조적으로 겹침이 불가능하게 한다. */}
        <div style={css(`${mobile ? 'flex:1 1 100%; justify-content:space-between;' : narrow ? 'flex:0 1 auto; flex-wrap:wrap;' : 'flex:1 1 0;'} min-width:0; display:flex; align-items:center; gap:${phone ? 6 : 10}px;`)}>
          {/* 부위 이름은 어느 환경에서도 자르지 않는다. 배지를 "부위 선택"->"부위" 로 줄인 것만으로
              모바일까지 전부 들어가는 걸 확인했다(사용자 실기기 확인). */}
          <div ref={s.partWrapRef} style={css('position:relative; flex:0 0 auto;')}>
            <button onClick={() => s.setPartMenuOpen(!s.partMenuOpen)} onMouseEnter={() => s.setHoverPartBtn(true)} onMouseLeave={() => s.setHoverPartBtn(false)} title="클릭해서 부위·성별 선택" style={css(partBtnStyle)}>
              <span style={css('flex:0 0 auto; font-size:15px; font-weight:700; white-space:nowrap; color:#2a2521;')}>{activeMeta.label}</span>
              {/* 성별이 걸려 있으면 라벨 옆에 칩으로 드러낸다 — 필터가 켜진 걸 모르고 "왜 안 나오지?" 하는 걸 막는다.
                  전체(기본)일 땐 아무것도 안 늘어난다. */}
              {gf !== 'all' && (
                <span style={css(`flex:0 0 auto; display:inline-flex; align-items:center; height:22px; padding:0 ${phone ? 6 : 8}px; border-radius:20px; font-size:11px; font-weight:700; letter-spacing:-0.01em; white-space:nowrap; background:${gf === 'f' ? '#fce9f1' : '#e7f0fb'}; color:${gf === 'f' ? '#d76d9a' : '#5a86c4'};`)}>{gf === 'f' ? '여' : '남'}</span>
              )}
              <span style={css(partBadgeStyle)}>{phone ? '▾' : '부위 ▾'}</span>
            </button>
            <div style={css(partMenuStyle)}>
              {/* 성별 필터 — 헤더는 이미 부위·뷰어모드·페이지·검색으로 꽉 찼다. 버튼을 더 얹으면 무너진다.
                  이 패널은 부위를 고르려면 어차피 모두가 여는 곳이라, 여기 두면 헤더 비용 0 + 발견성 확보. */}
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
                {PART_CATS.map((c) => {
                  const on = c.id === s.activeCat
                  const hov = s.hoverCat === c.id
                  let bg = on ? '#ec86ac' : 'transparent', col = on ? '#fff' : '#7a7066'
                  if (hov && !on) { bg = '#f4e7ee'; col = '#ec86ac' }
                  return (
                    <button key={c.id}
                      onClick={() => { if (s.activeCat === c.id) { s.setPartMenuOpen(false) } else { s.setActiveCat(c.id); s.setOffset(0); s.setSnapping(false); s.setPartMenuOpen(false); s.setSearch('') } }}
                      onMouseEnter={() => s.setHoverCat(c.id)} onMouseLeave={() => s.setHoverCat(null)}
                      style={css(`width:100%; display:flex; align-items:center; justify-content:center; height:40px; padding:0 8px; border:none; border-radius:9px; cursor:pointer; font-family:inherit; font-size:13px; font-weight:${on ? 600 : 500}; color:${col}; background:${bg}; transition:background .26s ease, color .26s ease;`)}>{c.label}</button>
                  )
                })}
              </div>
            </div>
          </div>
          {/* N종 표기 자리에 표시 모드 토글(썸네일/모델/내 모델). 헤어/피부는 썸네일 비활성. */}
          <div title="아이템 표시 방식" style={css('flex:0 0 auto; display:flex; align-items:center; gap:3px; padding:3px; background:#f4ecf3; border-radius:9px;')}>
            {MODES.map((m) => {
              const disabled = noSprite && m.v === 'sprite'
              const on = !disabled && mode === m.v
              return (
                <button key={m.v} disabled={disabled} className={on ? 'pb-h-solid' : 'pb-h-soft'} title={disabled ? (isSkinCat ? '피부는 썸네일 보기를 지원하지 않아요' : '헤어는 썸네일 보기를 지원하지 않아요') : undefined} onClick={() => { if (!disabled) s.setListMode(m.v) }}
                  style={css(`height:28px; padding:0 ${phone ? 8 : 11}px; border:none; border-radius:7px; cursor:${disabled ? 'not-allowed' : 'pointer'}; opacity:${disabled ? 0.4 : 1}; font-family:inherit; font-size:${phone ? 11 : 12}px; font-weight:${on ? 600 : 500}; white-space:nowrap; color:${on ? '#fff' : '#8a8075'}; background:${on ? '#ec86ac' : 'transparent'}; transition:background .22s ease, color .22s ease, filter .18s ease;`)}>{m.l}</button>
              )
            })}
          </div>
        </div>

        <div style={css('flex:0 0 auto; display:flex; align-items:center; gap:7px; font-variant-numeric:tabular-nums;')}>
          <span style={css('font-size:11px; font-weight:500; color:#a89e93;')}>페이지</span>
          <div title="페이지 번호를 입력해 이동" style={css('display:flex; align-items:center; gap:5px;')}>
            <input value={s.pageEditing ? s.pageInput : `${s.curIdx + 1}`} onFocus={s.onPageFocus} onChange={s.onPageChange} onKeyDown={s.onPageKey} onBlur={s.commitPage} inputMode="numeric" aria-label="현재 페이지"
              style={css('width:44px; height:34px; padding:0 6px; border:1.5px solid #eeb2ce; border-radius:8px; background:#fff; text-align:center; font-family:inherit; font-size:14px; font-weight:700; color:#ec86ac; outline:none; cursor:text; transition:border-color .12s;')} />
            <span style={css('font-size:13px; font-weight:500; color:#c3b9ad;')}>/</span>
            <span style={css('font-size:14px; font-weight:600; color:#8a8075;')}>{s.pageCount}</span>
          </div>
        </div>

        {/* 우: 아이템 검색. 좁으면 100%로 다음 행 wrap(겹침 방지), 넓으면 우측 정렬로 페이지 중앙 유지 */}
        <div style={css(`${mobile ? 'flex:1 1 auto; justify-content:flex-end;' : narrow ? 'flex:1 1 100%; justify-content:flex-start;' : 'flex:1 1 0; justify-content:flex-end;'} min-width:0; display:flex;`)}>
          <input value={s.search} onChange={(e) => { s.setSearch(e.target.value); s.setIdx(0, false) }} placeholder="아이템 검색"
            style={css(`height:34px; width:100%; ${narrow ? '' : 'max-width:180px;'} min-width:0; padding:0 12px; border:1px solid #e7ded4; border-radius:8px; background:#faf7f3; font-family:inherit; font-size:13px; outline:none; transition:border-color .14s ease;`)} />
        </div>
      </div>

      {/* touch-action:none 은 브라우저 패닝을 전부 막아 모바일 문서 스크롤까지 죽인다 →
          모바일은 pan-y(세로=페이지 스크롤은 브라우저에, 가로=페이지 넘김은 우리에게).
          세로로 끌면 브라우저가 pointercancel 을 쏘고 ShopContext 가 이를 onUp 으로 받아 스와이프를 취소한다. */}
      <div ref={s.bindVp} style={css(`flex:1 1 auto; min-height:0; overflow:hidden; position:relative; touch-action:${mobile ? 'pan-y' : 'none'}; cursor:grab; user-select:none;`)}>
        {loading ? (
          <div style={css(`width:100%; height:100%; padding:${mobile ? '10px 12px' : '18px 22px'};`)}>
            <div style={css(gridStyle)}>
              {Array.from({ length: s.itemsPerPage }, (_, i) => skeletonCell(i))}
            </div>
          </div>
        ) : list.length === 0 ? (
          <div style={css('width:100%; height:100%; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:8px;')}>
            <span style={css('font-size:14px; font-weight:600; color:#8a8075;')}>검색 결과가 없어요</span>
            <span style={css('font-size:12px; color:#b7ada2;')}>다른 이름으로 검색해 보세요.</span>
          </div>
        ) : (
          <div style={css(trackStyle)}>
            {/* 셀은 현재 페이지 ±1 만 마운트(보이는 부분만 CDN 로드 → 속도/안정성). */}
            {pages.map((items, pi) => (
              // contain:paint → 각 페이지의 그리기를 자기 박스로 클립(전환 시 canvas/카드 레이어의 stale-tile 잔상이 옆 페이지로 새지 않음).
              <div key={pi} style={css(`flex:0 0 100%; width:100%; height:100%; padding:${mobile ? '10px 12px' : '18px 22px'}; contain:paint;`)}>
                {Math.abs(pi - s.curIdx) <= 1 && (
                  <div style={css(gridStyle)}>
                    {items.map((item) => cell(item))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      {/* 모바일은 힌트를 짧게(마우스/키보드가 없다) + 26px 로 줄여 그 높이를 그리드에 돌려준다 */}
      <div style={css(`flex:0 0 auto; height:${mobile ? 26 : 38}px; display:flex; align-items:center; justify-content:center; padding:0 12px; border-top:1px solid #f0e9e1;`)}>
        <span style={css(`font-size:${mobile ? 10.5 : 12}px; color:#a89e93; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;`)}>{mobile ? '스와이프로 페이지를 넘길 수 있어요' : '스크롤 · 스와이프 · ← → 방향키로 페이지를 넘길 수 있어요'}</span>
      </div>
    </section>
  )
}
