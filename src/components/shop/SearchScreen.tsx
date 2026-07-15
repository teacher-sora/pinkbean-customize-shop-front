'use client'

// AI 코디 검색 — 코디탭과 "동일 경험". 헤더(부위 드롭다운 + 썸네일/모델/내모델 토글 + 베타 배지 + 페이지),
// 카드(장착 시 translateY(-5px)+테두리), 페이징/스와이프/방향키까지 코디탭 구조를 그대로 가져온다.
// 결과는 원본(raw) ListItem 이라 스프라이트/톤/염색/라벨이 코디와 완전히 동일하게 렌더된다.
import { useEffect, useRef, useState } from 'react'
import { CATS } from '@/lib/catalog'
import { css } from '@/lib/style'
import { isStacked } from '@/lib/useBreakpoint'
import { CAT_TO_SLOT, SLOT_TO_CAT, thumbView } from '@/lib/shopData'
import { getFrameLayers, type AssembleInput } from '@/lib/core/assemble'
import { badgeUrl, loadMeta, type ListItem } from '@/lib/core/data'
import { useShop, type ListMode } from './ShopContext'
import ItemThumb from './ItemThumb'

const SEARCH_CATS = [{ id: 'all', label: '전체' }, ...CATS.filter((c) => c.id !== 'skin')]
const MODES: { v: ListMode; l: string }[] = [{ v: 'sprite', l: '썸네일' }, { v: 'model', l: '모델' }, { v: 'mymodel', l: '내 모델' }]
const NO_CASH_BADGE = new Set(['hair', 'face', 'skin'])
type Ctx = { items: AssembleInput[]; key: string }
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
  const mobile = s.bp === 'mobile'
  const searched = s.searchQuery !== null
  const gaze = s.pv.gaze
  const tv = thumbView(gaze)
  const mode = s.listMode
  const catLabel = SEARCH_CATS.find((c) => c.id === cat)?.label || '전체'
  const effMode = (slot: string): ListMode => (slot === 'hair' && mode === 'sprite') ? 'model' : mode

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
    const key = `${mode}:${gaze}:${s.tone}:${slotsInList.join(',')}:${eqSig}`
    if (key === ctxKeyRef.current) return
    const eqIds = mode === 'mymodel' ? myEq.map(([, it]) => it.id) : []
    const ids = Array.from(new Set([bodyId, headId, ...eqIds]))
    Promise.all(ids.map((id) => loadMeta(id).then((m) => [id, m] as const).catch(() => null))).then((res) => {
      if (!alive) return
      const map = new Map(res.filter(Boolean).map((r) => r!))
      const body = map.get(bodyId), head = map.get(headId)
      const baseItems: AssembleInput[] = []
      if (body) baseItems.push({ itemId: body.id, slot: 'body', vslot: null, layers: getFrameLayers(body, tv.view) })
      if (head) baseItems.push({ itemId: head.id, slot: 'head', vslot: null, layers: getFrameLayers(head, tv.view) })
      const bySlot: Record<string, Ctx> = {}
      if (mode === 'mymodel') {
        for (const slot of slotsInList) {
          const items = [...baseItems]
          for (const [sl, it] of myEq) {
            if (sl === slot) continue
            const m = map.get(it.id); if (!m) continue
            items.push({ itemId: m.id, slot: sl, vslot: m.vslot ?? null, layers: getFrameLayers(m, tv.view), invisibleFace: m.invisibleFace, name: m.name })
          }
          bySlot[slot] = { items, key: `${key}:${slot}` }
        }
      }
      ctxKeyRef.current = key
      setCtx({ base: { items: baseItems, key }, bySlot })
    })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.index, s.tone, gaze, mode, s.equipped, s.hidden, list])

  const ctxFor = (item: ListItem): Ctx => {
    const em = effMode(item.slot)
    if (em === 'sprite') return EMPTY_CTX
    if (em === 'mymodel') return ctx.bySlot[item.slot] || ctx.base
    return ctx.base
  }

  const thumbBox = 'flex:1 1 auto; width:100%; min-height:0; border-radius:8px; background:#f7f2ec; display:flex; align-items:center; justify-content:center; overflow:hidden;'
  const gridStyle = `display:grid; grid-template-columns:repeat(${s.cols},minmax(0,1fr)); grid-template-rows:repeat(${s.rows},1fr); gap:${mobile ? 10 : 16}px; height:100%;`
  const pages = Array.from({ length: s.pageCount }, (_, p) => list.slice(p * s.itemsPerPage, p * s.itemsPerPage + s.itemsPerPage))
  const trackStyle = `display:flex; height:100%; width:100%; will-change:transform; transform:translateX(calc(${-s.curIdx * 100}% + ${s.offset}px)); transition:${s.snapping ? 'transform .34s cubic-bezier(.22,.61,.36,1)' : 'none'};`

  const cell = (item: ListItem) => {
    const em = effMode(item.slot)
    const c = ctxFor(item)
    const sel = s.equipped[item.slot]?.id === item.id
    const dyeable = item.dyeMode !== 'none'
    const badgeKind: 'master' | 'special' | 'cash' | null =
      item.label ? item.label : (item.isCash && !NO_CASH_BADGE.has(item.slot)) ? 'cash' : null
    return (
      <div key={item.id} onClick={() => s.equipFromCat(SLOT_TO_CAT[item.slot], item)} className="pb-cardwrap">
        <div className="pb-card" style={css(`display:flex; flex-direction:column; align-items:center; gap:8px; padding:12px 8px 10px; ${sel ? 'border:1px solid #ec86ac; transform:translateY(-5px); ' : ''}border-radius:12px; background:${sel ? '#fdf0f5' : '#fff'}; cursor:pointer; min-height:0; min-width:0;`)}>
          {dyeable && (
            <button onClick={(e) => { e.stopPropagation(); s.openDye(item.slot, item) }} className="pb-dye" title="이 아이템 염색" style={css('position:absolute; top:7px; right:7px; height:22px; padding:0 9px; border-radius:20px; border:1px solid #f4cfdf; background:#fce9f1; color:#d76d9a; font-family:inherit; font-size:10px; font-weight:600; cursor:pointer; z-index:2;')}>염색</button>
          )}
          <div style={css(thumbBox + ' position:relative;')}>
            <ItemThumb item={item} mode={em} gaze={gaze} ctxItems={c.items} ctxKey={c.key} zmap={s.index?.zmap || []} smap={s.index?.smap || {}} />
            {badgeKind && (
              <img src={badgeUrl(badgeKind)} alt={badgeKind} draggable={false} onError={(e) => { e.currentTarget.style.display = 'none' }}
                style={{ position: 'absolute', bottom: 4, left: 4, height: badgeKind === 'cash' ? 14 : 17, imageRendering: 'pixelated', zIndex: 2 }} />
            )}
          </div>
          <div style={css('font-size:12px; font-weight:500; color:#3d372f; line-height:1.3; text-align:center; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; width:100%;')}>{item.name || item.id}</div>
        </div>
      </div>
    )
  }

  // ── 헤더 스타일(코디탭 부위 드롭다운과 동일) ──
  const partBtnBg = menuOpen ? '#fce9f1' : hoverBtn ? '#f7f2ec' : 'transparent'
  const partBtnBd = menuOpen ? '#eeb2ce' : hoverBtn ? '#e0d8ce' : '#eee6dc'
  const partBtn = `display:flex; align-items:center; gap:9px; height:40px; padding:0 12px; margin-left:-4px; border:1px solid ${partBtnBd}; border-radius:10px; cursor:pointer; background:${partBtnBg}; transition:background .14s ease, border-color .14s ease;`
  const partBadgeBg = menuOpen ? '#ec86ac' : hoverBtn ? '#eddbe4' : '#f2ece5'
  const partBadgeCol = menuOpen ? '#fff' : hoverBtn ? '#d76d9a' : '#a89e93'
  const partBadge = `display:inline-flex; align-items:center; gap:4px; height:22px; padding:0 9px; border-radius:20px; font-size:11px; font-weight:600; background:${partBadgeBg}; color:${partBadgeCol}; transition:background .14s ease, color .14s ease;`
  const partMenu = `position:absolute; top:calc(100% + 8px); left:0; z-index:20; width:min(360px, 84vw); padding:10px; background:#fff; border:1px solid #e7ded4; border-radius:12px; box-shadow:0 12px 32px rgba(42,37,33,.12); transform-origin:top left; transition:opacity .2s ease, transform .2s cubic-bezier(.22,.61,.36,1); opacity:${menuOpen ? 1 : 0}; transform:translateY(${menuOpen ? '0' : '-6px'}) scale(${menuOpen ? 1 : 0.98}); pointer-events:${menuOpen ? 'auto' : 'none'};`

  return (
    <section style={css(`${stacked ? 'flex:1 1 auto; width:100%' : 'flex:0 0 65%'}; min-width:0; min-height:0; background:#fff; border:1px solid #e7ded4; border-radius:16px; display:flex; flex-direction:column; overflow:hidden;`)}>
      {/* 헤더: 코디탭과 동일 구조(부위 드롭다운 + 표시모드 토글 + 베타 배지 + 페이지) + 검색 입력 행 */}
      <div style={css('flex:0 0 auto; border-bottom:1px solid #f0e9e1; display:flex; flex-direction:column;')}>
        {/* 상단 바 — 코디 헤더와 동일 크기(58px) → 탭 전환 시 시프트 없음, 아래 입력행만 추가됨 */}
        <div style={css(`flex:0 0 auto; ${narrow ? 'flex-wrap:wrap; min-height:58px; padding:9px 16px;' : 'height:58px; padding:0 22px;'} display:flex; align-items:center; gap:${narrow ? 8 : 12}px;`)}>
          {/* 부위 선택 + 표시모드 토글 (모바일=한 줄 space-between) */}
          <div style={css(`${mobile ? 'flex:1 1 100%; justify-content:space-between;' : 'flex:1 1 0;'} min-width:0; display:flex; align-items:center; gap:${mobile ? 6 : 10}px;`)}>
            <div ref={wrapRef} style={css('position:relative; flex:0 0 auto;')}>
              <button onClick={() => setMenuOpen(!menuOpen)} onMouseEnter={() => setHoverBtn(true)} onMouseLeave={() => setHoverBtn(false)} title="검색할 부위 선택" style={css(partBtn)}>
                <span style={css('font-size:15px; font-weight:700; white-space:nowrap;')}>{catLabel}</span>
                <span style={css(partBadge)}>부위 ▾</span>
              </button>
              <div style={css(partMenu)}>
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
                    style={css(`height:28px; padding:0 ${mobile ? 8 : 11}px; border:none; border-radius:7px; cursor:pointer; font-family:inherit; font-size:${mobile ? 11 : 12}px; font-weight:${on ? 600 : 500}; white-space:nowrap; color:${on ? '#fff' : '#8a8075'}; background:${on ? '#ec86ac' : 'transparent'}; transition:background .22s ease, color .22s ease, filter .18s ease;`)}>{m.l}</button>
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
        {/* 추가 입력 행(상단 58px 바 아래) — 검색 입력 + AI 검색 버튼(높이 38) */}
        <div style={css(`flex:0 0 auto; padding:${narrow ? '0 16px 10px' : '2px 22px 12px'}; display:flex; gap:8px; flex-wrap:wrap; align-items:center;`)}>
          <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') run() }} placeholder="원하는 코디를 문장으로 검색"
            style={css(`flex:1 1 ${mobile ? '100%' : '200px'}; min-width:0; height:38px; padding:0 14px; border:1.5px solid #eeb2ce; border-radius:11px; background:#faf7f3; font-family:inherit; font-size:14px; color:#3d372f; outline:none; transition:border-color .14s ease;`)} />
          <button onClick={() => run()} disabled={s.searchLoading} className="pb-h-solid" style={css(`${mobile ? 'flex:1 1 100%' : 'flex:0 0 auto'}; height:38px; padding:0 20px; border:none; border-radius:11px; background:${s.searchLoading ? '#f0aecb' : '#ec86ac'}; color:#fff; font-family:inherit; font-size:14px; font-weight:600; cursor:${s.searchLoading ? 'default' : 'pointer'}; white-space:nowrap; transition:background .18s ease, filter .18s ease;`)}>{s.searchLoading ? '검색 중…' : 'AI 검색'}</button>
        </div>
      </div>

      {/* 결과 캐러셀 — 코디탭과 동일 */}
      <div ref={s.bindVp} style={css('flex:1 1 auto; min-height:0; overflow:hidden; position:relative; touch-action:none; cursor:grab; user-select:none;')}>
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
              <div key={pi} style={css('flex:0 0 100%; width:100%; height:100%; padding:18px 22px; contain:paint;')}>
                {Math.abs(pi - s.curIdx) <= 1 && (
                  <div style={css(gridStyle)}>{items.map((it) => cell(it))}</div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={css('flex:0 0 auto; height:38px; display:flex; align-items:center; justify-content:center; border-top:1px solid #f0e9e1;')}>
        <span style={css('font-size:12px; color:#a89e93; word-break:keep-all; text-align:center; padding:0 12px;')}>{searched && list.length > 0 ? '카드를 누르면 착용 · 스와이프/← →로 페이지 넘김' : '베타 기능 — 재미로 즐겨 주세요'}</span>
      </div>
    </section>
  )
}
