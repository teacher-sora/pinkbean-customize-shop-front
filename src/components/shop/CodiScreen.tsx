'use client'

import { useEffect, useRef, useState } from 'react'
import { CATS, ITEMS_PER_PAGE } from '@/lib/catalog'
import { assemble, getFrameLayers, type AssembleInput } from '@/lib/core/assemble'
import { badgeUrl, loadMeta, type ListItem } from '@/lib/core/data'
import { CAT_TO_SLOT, THUMB_VIEW } from '@/lib/shopData'
import { css } from '@/lib/style'
import { useShop, type ListMode } from './ShopContext'
import ItemThumb from './ItemThumb'

const MODES: { v: ListMode; l: string }[] = [
  { v: 'sprite', l: '썸네일' }, { v: 'model', l: '모델' }, { v: 'mymodel', l: '내 모델' },
]
// 헤어/성형/피부는 전부 캐시라 캐시 배지가 정보 가치 없음 → 숨김(라벨은 예외 유지).
const NO_CASH_BADGE = new Set(['hair', 'face', 'skin'])

export default function CodiScreen() {
  const s = useShop()
  const activeMeta = CATS.find((c) => c.id === s.activeCat) || CATS[0]
  const list = s.activeList // 검색 필터 + folded (정렬 순서 유지)
  const loading = s.catLoading
  const isSkinCat = s.activeCat === 'skin'
  const isHairCat = s.activeCat === 'hair'
  // 헤어는 썸네일(스프라이트) 보기 불가 → 모델로 대체.
  const mode: ListMode = isHairCat && s.listMode === 'sprite' ? 'model' : s.listMode

  // 모델/내모델 공통 배경(base 또는 내 착용) 조립 입력 + 키
  const [ctx, setCtx] = useState<{ items: AssembleInput[]; key: string }>({ items: [], key: '' })
  const ctxKeyRef = useRef('')
  useEffect(() => {
    const idx = s.index
    if (mode === 'sprite' || !idx) { if (ctxKeyRef.current) { ctxKeyRef.current = ''; setCtx({ items: [], key: '' }) } return }
    let alive = true
    const toneEntry = idx.base.tones.find((t) => t.tone === s.tone) || idx.base.tones.find((t) => t.tone === idx.base.default) || idx.base.tones[0]
    const bodyId = toneEntry.body, headId = toneEntry.head
    const activeSlot = CAT_TO_SLOT[s.activeCat]
    const eqEntries = mode === 'mymodel'
      ? Object.entries(s.equipped).filter(([sl, it]) => it && sl !== activeSlot && !s.hidden[sl]) as [string, ListItem][]
      : []
    const eqSig = eqEntries.map(([sl, it]) => sl + it.id).sort().join(',')
    const key = `${mode}:${s.tone}:${isSkinCat ? 'skin' : 'base'}:${eqSig}`
    if (key === ctxKeyRef.current) return // 이미 최신 컨텍스트 → 불필요한 재조립/리렌더 방지
    ctxKeyRef.current = key
    const ids = [...(isSkinCat ? [] : [bodyId, headId]), ...eqEntries.map(([, it]) => it.id)]
    Promise.all(ids.map((id) => loadMeta(id).then((m) => [id, m] as const).catch(() => null))).then((res) => {
      if (!alive) return
      const map = new Map(res.filter(Boolean).map((r) => r!))
      const items: AssembleInput[] = []
      if (!isSkinCat) {
        const body = map.get(bodyId), head = map.get(headId)
        if (body) items.push({ itemId: body.id, slot: 'body', vslot: null, layers: getFrameLayers(body, THUMB_VIEW) })
        if (head) items.push({ itemId: head.id, slot: 'head', vslot: null, layers: getFrameLayers(head, THUMB_VIEW) })
      }
      for (const [sl, it] of eqEntries) {
        const m = map.get(it.id); if (!m) continue
        items.push({ itemId: m.id, slot: sl, vslot: m.vslot ?? null, layers: getFrameLayers(m, THUMB_VIEW), invisibleFace: m.invisibleFace })
      }
      setCtx({ items, key })
    })
    return () => { alive = false }
  }, [mode, s.index, s.tone, s.activeCat, s.equipped, s.hidden, isSkinCat])

  const pages = Array.from({ length: s.pageCount }, (_, p) => list.slice(p * ITEMS_PER_PAGE, p * ITEMS_PER_PAGE + ITEMS_PER_PAGE))
  const trackStyle = `display:flex; height:100%; width:100%; will-change:transform; transform:translateX(calc(${-s.curIdx * 100}% + ${s.offset}px)); transition:${s.snapping ? 'transform .34s cubic-bezier(.22,.61,.36,1)' : 'none'};`

  const partBtnStyle = (() => {
    const bg = s.partMenuOpen ? '#fce9f1' : s.hoverPartBtn ? '#f7f2ec' : 'transparent'
    const bd = s.partMenuOpen ? '#eeb2ce' : s.hoverPartBtn ? '#e0d8ce' : '#eee6dc'
    return `display:flex; align-items:center; gap:9px; height:40px; padding:0 12px; margin-left:-4px; border:1px solid ${bd}; border-radius:10px; cursor:pointer; background:${bg}; transition:background .14s ease, border-color .14s ease;`
  })()
  const partBadgeStyle = (() => {
    const bg = s.partMenuOpen ? '#ec86ac' : s.hoverPartBtn ? '#eddbe4' : '#f2ece5'
    const col = s.partMenuOpen ? '#fff' : s.hoverPartBtn ? '#d76d9a' : '#a89e93'
    return `display:inline-flex; align-items:center; gap:4px; height:22px; padding:0 9px; border-radius:20px; font-size:11px; font-weight:600; letter-spacing:-0.01em; background:${bg}; color:${col}; transition:background .14s ease, color .14s ease;`
  })()
  const partMenuStyle = `position:absolute; top:calc(100% + 8px); left:0; z-index:20; width:360px; padding:10px; background:#fff; border:1px solid #e7ded4; border-radius:12px; box-shadow:0 12px 32px rgba(42,37,33,.12); transform-origin:top left; transition:opacity .2s ease, transform .2s cubic-bezier(.22,.61,.36,1); opacity:${s.partMenuOpen ? 1 : 0}; transform:translateY(${s.partMenuOpen ? '0' : '-6px'}) scale(${s.partMenuOpen ? 1 : 0.98}); pointer-events:${s.partMenuOpen ? 'auto' : 'none'};`

  const thumbBox = 'flex:1 1 auto; width:100%; min-height:0; border-radius:8px; background:#f7f2ec; display:flex; align-items:center; justify-content:center; overflow:hidden;'

  const cell = (item: ListItem) => {
    const sel = s.isEquippedInCat(s.activeCat, item.id)
    const dyeable = !isSkinCat && item.dyeMode !== 'none'
    const badgeKind: 'master' | 'special' | 'cash' | null =
      item.label ? item.label : (item.isCash && !NO_CASH_BADGE.has(item.slot)) ? 'cash' : null
    return (
      <div key={item.id} onClick={() => s.equipFromCat(s.activeCat, item)} className="pb-cardwrap">
        <div className="pb-card" style={css(`display:flex; flex-direction:column; align-items:center; gap:8px; padding:12px 8px 10px; ${sel ? 'border:1px solid #ec86ac; transform:translateY(-5px); ' : ''}border-radius:12px; background:${sel ? '#fdf0f5' : '#fff'}; cursor:pointer; min-height:0; min-width:0;`)}>
          {dyeable && (
            <button onClick={(e) => { e.stopPropagation(); s.openDye(CAT_TO_SLOT[s.activeCat]) }} className="pb-dye" title="이 부위 염색" style={css('position:absolute; top:7px; right:7px; height:22px; padding:0 9px; border-radius:20px; border:1px solid #f4cfdf; background:#fce9f1; color:#d76d9a; font-family:inherit; font-size:10px; font-weight:600; cursor:pointer; z-index:2;')}>염색</button>
          )}
          <div style={css(thumbBox + ' position:relative;')}>
            <ItemThumb item={item} mode={mode} ctxItems={ctx.items} ctxKey={ctx.key} zmap={s.index?.zmap || []} smap={s.index?.smap || {}} skinHeadId={isSkinCat ? item.headId : undefined} />
            {badgeKind && (
              <img src={badgeUrl(badgeKind)} alt={badgeKind} draggable={false} title={badgeKind} onError={(e) => { e.currentTarget.style.display = 'none' }}
                style={{ position: 'absolute', bottom: 4, left: 4, height: badgeKind === 'cash' ? 14 : 17, imageRendering: 'pixelated', zIndex: 2 }} />
            )}
          </div>
          <div style={css('font-size:12px; font-weight:500; color:#3d372f; line-height:1.3; text-align:center; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; width:100%;')}>{item.name || item.id}</div>
        </div>
      </div>
    )
  }

  const skeletonCell = (i: number) => (
    <div key={i} className="pb-cardwrap">
      <div className="pb-card" style={css('display:flex; flex-direction:column; align-items:center; gap:8px; padding:12px 8px 10px; border-radius:12px; background:#fff; min-height:0; min-width:0;')}>
        <div className="pb-skel" style={css('flex:1 1 auto; width:100%; min-height:0; border-radius:8px;')} />
        <div className="pb-skel" style={css('width:70%; height:12px; border-radius:6px;')} />
      </div>
    </div>
  )

  return (
    <section style={css('flex:0 0 65%; min-width:0; background:#fff; border:1px solid #e7ded4; border-radius:16px; display:flex; flex-direction:column; overflow:hidden;')}>
      <div style={css('flex:0 0 auto; height:58px; padding:0 22px; display:flex; align-items:center; gap:12px; border-bottom:1px solid #f0e9e1;')}>
        <div style={css('flex:1 1 0; min-width:0; display:flex; align-items:center; gap:10px;')}>
          <div ref={s.partWrapRef} style={css('position:relative; flex:0 0 auto;')}>
            <button onClick={() => s.setPartMenuOpen(!s.partMenuOpen)} onMouseEnter={() => s.setHoverPartBtn(true)} onMouseLeave={() => s.setHoverPartBtn(false)} title="클릭해서 부위 선택" style={css(partBtnStyle)}>
              <span style={css('font-size:15px; font-weight:700; white-space:nowrap;')}>{activeMeta.label}</span>
              <span style={css(partBadgeStyle)}>부위 선택 ▾</span>
            </button>
            <div style={css(partMenuStyle)}>
              <div style={css('display:grid; grid-template-columns:repeat(3,1fr); gap:4px;')}>
                {CATS.map((c) => {
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
          {/* N종 표기 자리에 표시 모드 토글(썸네일/모델/내 모델). 헤어는 썸네일 비활성. */}
          <div title="아이템 표시 방식" style={css('flex:0 0 auto; display:flex; align-items:center; gap:3px; padding:3px; background:#f4ecf3; border-radius:9px;')}>
            {MODES.map((m) => {
              const disabled = isHairCat && m.v === 'sprite'
              const on = !disabled && mode === m.v
              return (
                <button key={m.v} disabled={disabled} title={disabled ? '헤어는 썸네일 보기를 지원하지 않아요' : undefined} onClick={() => { if (!disabled) s.setListMode(m.v) }}
                  style={css(`height:28px; padding:0 11px; border:none; border-radius:7px; cursor:${disabled ? 'not-allowed' : 'pointer'}; opacity:${disabled ? 0.4 : 1}; font-family:inherit; font-size:12px; font-weight:${on ? 600 : 500}; white-space:nowrap; color:${on ? '#fff' : '#8a8075'}; background:${on ? '#ec86ac' : 'transparent'}; transition:background .22s ease, color .22s ease;`)}>{m.l}</button>
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

        {/* 우: 아이템 검색(롤백). 좌 flex:1 + 우 flex:1 로 가운데 페이지가 중앙 정렬됨 */}
        <div style={css('flex:1 1 0; min-width:0; display:flex; justify-content:flex-end;')}>
          <input value={s.search} onChange={(e) => { s.setSearch(e.target.value); s.setIdx(0, false) }} placeholder="아이템 검색"
            style={css('height:34px; width:100%; max-width:180px; min-width:0; padding:0 12px; border:1px solid #e7ded4; border-radius:8px; background:#faf7f3; font-family:inherit; font-size:13px; outline:none; transition:border-color .14s ease;')} />
        </div>
      </div>

      <div ref={s.bindVp} style={css('flex:1 1 auto; min-height:0; overflow:hidden; position:relative; touch-action:none; cursor:grab; user-select:none;')}>
        {loading ? (
          <div style={css('width:100%; height:100%; padding:18px 22px;')}>
            <div style={css('display:grid; grid-template-columns:repeat(6,minmax(0,1fr)); grid-template-rows:repeat(3,1fr); gap:16px; height:100%;')}>
              {Array.from({ length: ITEMS_PER_PAGE }, (_, i) => skeletonCell(i))}
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
              <div key={pi} style={css('flex:0 0 100%; width:100%; height:100%; padding:18px 22px;')}>
                {Math.abs(pi - s.curIdx) <= 1 && (
                  <div style={css('display:grid; grid-template-columns:repeat(6,minmax(0,1fr)); grid-template-rows:repeat(3,1fr); gap:16px; height:100%;')}>
                    {items.map((item) => cell(item))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      <div style={css('flex:0 0 auto; height:38px; display:flex; align-items:center; justify-content:center; border-top:1px solid #f0e9e1;')}>
        <span style={css('font-size:12px; color:#a89e93;')}>스크롤 · 스와이프 · ← → 방향키로 페이지를 넘길 수 있어요</span>
      </div>
    </section>
  )
}
