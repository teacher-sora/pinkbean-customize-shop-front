'use client'

// 카드 썸네일(ItemThumb) 배경 컨텍스트 — 기존 CodiScreen/SearchScreen 의 조립 로직을 그대로 옮겼다.
//  · 기본 캐릭터(model) = 맨 마네킹(엘프 피부 고정) / 내 캐릭터(mymodel) = 내 착용(해당 슬롯 제외) + 염색 + 이펙트 + 형상변이·귀
//  · 표정 얼굴장식은 맨 마네킹에 올려도 안 보여 '내 캐릭터'로 승격한다.

import { useEffect, useRef, useState } from 'react'
import { getFrameLayers, type AssembleInput } from '@/lib/core/assemble'
import { loadAnima, loadMeta, type AnimaRace, type ItemMeta, type ListItem } from '@/lib/core/data'
import { buildOverrides } from '@/lib/core/dye'
import { collectWornEffects, type WornEff } from '@/lib/core/thumbEffects'
import { CAT_TO_SLOT, DEFAULT_TONE, THUMB_VIEW, animaLayers, fixedExpr, forceMyModel, hasFixedExpr, thumbView } from '@/lib/shopData'
import { isMultiCat, useShop, type ListMode } from '../ShopContext'

type Tones = { base: { tones: { tone: number; body: string; head: string }[]; default: number } }
// 톤 → body/head id. 없으면 기본 톤 → 첫 톤.
const toneIds = (idx: Tones, tone: number) => {
  const e = idx.base.tones.find((t) => t.tone === tone) || idx.base.tones.find((t) => t.tone === idx.base.default) || idx.base.tones[0]
  return { bodyId: e.body, headId: e.head }
}

// stance = 배경이 무기모션 자세(두손=stand2)로 구워졌는지 — 카드의 후보 아이템도 같은 자세로 그려야 어긋나지 않는다.
export type ThumbCtx = { items: AssembleInput[]; key: string; override?: Map<string, HTMLCanvasElement>; effs?: WornEff[]; expr?: string; faceMeta?: ItemMeta | null; stance?: boolean }
const EMPTY: ThumbCtx = { items: [], key: '' }

function useAnimaRaces() {
  const [animaRaces, setAnimaRaces] = useState<AnimaRace[]>([])
  useEffect(() => { loadAnima().then(setAnimaRaces).catch(() => {}) }, [])
  return animaRaces
}

export type ThumbApi = {
  mode: ListMode                          // 실효 보기 방식(피부 부위의 '아이템'은 '기본 캐릭터'로 대체)
  noSprite: 'skin' | null                 // '아이템' 보기를 지원하지 않는 부위
  effMode: (it: ListItem) => ListMode
  ctxFor: (it: ListItem) => ThumbCtx
}

// ── 코디 탭 ──
export function useCodiThumbs(list: ListItem[]): ThumbApi {
  const s = useShop()
  const isAll = s.activeCat === 'all'
  const mixedCat = isMultiCat(s.activeCat) // 전체·신규·즐겨찾기 = 여러 부위가 섞인 리스트(활성 슬롯 없음, 아이템 자신의 슬롯으로 판단)
  const isSkinCat = s.activeCat === 'skin'
  // 피부는 스프라이트=모델이라 '아이템' 보기 무의미 → 잠그고 '기본 캐릭터'로 대체.
  // 헤어의 '아이템' 보기 = 몸 없이 모든 파츠를 합성한 스프라이트(염색표·북마크와 동일, ItemThumb).
  const noSprite = isSkinCat ? 'skin' : null
  const mode: ListMode = noSprite && s.listMode === 'sprite' ? 'model' : s.listMode
  // '전체' sprite 모드라도 피부는 모델로 승격(스프라이트=모델) → 베이스(몸통/머리) ctx 가 필요하다.
  const spritePromote = mode === 'sprite' && list.some((it) => it.slot === 'skin')
  const effMode = (it: ListItem): ListMode =>
    forceMyModel(mode, it) ? 'mymodel'
      : (mode === 'sprite' && it.slot === 'skin') ? 'model' : mode
  const gaze = s.pv.gaze
  const animaRaces = useAnimaRaces()
  const activeSlotForExpr = mixedCat ? null : CAT_TO_SLOT[s.activeCat]
  // 배경(내 착용)에 구워질 표정. 활성 슬롯의 아이템은 배경에서 빠지므로(후보로 대체됨) 여기서도 제외한다.
  // '내 캐릭터'는 연출 설정 표정(pv.expr)을 따라간다(표정 얼굴장식이 있으면 그게 우선). '기본 캐릭터'는 THUMB_VIEW 'default'.
  const ctxExpr = fixedExpr(
    mode === 'mymodel'
      ? Object.entries(s.equipped).filter(([sl]) => sl !== activeSlotForExpr && !s.hidden[sl]).map(([, it]) => it)
      : [],
    mode === 'mymodel' ? s.pv.expr : THUMB_VIEW.expression,
  )
  // 표정 얼굴장식은 '기본 캐릭터'에 올리면 안 보여서 '내 캐릭터'로 승격 → 그 카드용 내 착용 배경(myCtx)을 하나 더 만든다.
  const needMy = mode === 'model' && list.some(hasFixedExpr)
  const [ctx, setCtx] = useState<ThumbCtx>(EMPTY)
  const [myCtx, setMyCtx] = useState<ThumbCtx>(EMPTY)
  const ctxKeyRef = useRef('')
  useEffect(() => {
    const idx = s.index
    if ((mode === 'sprite' && !spritePromote) || !idx) { if (ctxKeyRef.current) { ctxKeyRef.current = ''; setCtx(EMPTY); setMyCtx(EMPTY) } return }
    let alive = true
    // 기본 캐릭터 = 엘프 피부 고정, 내 캐릭터 = 현재 피부.
    const elf = toneIds(idx, DEFAULT_TONE), mine = toneIds(idx, s.tone)
    const activeSlot = mixedCat ? null : CAT_TO_SLOT[s.activeCat] // 전체·즐겨찾기는 제외할 활성 슬롯이 없다
    const myEq = Object.entries(s.equipped).filter(([sl, it]) => it && sl !== activeSlot && !s.hidden[sl]) as [string, ListItem][]
    const eqEntries = mode === 'mymodel' ? myEq : []
    const eqSig = (mode === 'mymodel' || needMy ? myEq : []).map(([sl, it]) => sl + it.id).sort().join(',')
    // 내 캐릭터: 우측 미리보기에 적용된 염색(발색/HSB)을 썸네일 배경(내 착용)에도 동일 반영 → 키에 염색 시그니처 포함.
    // 점 위치(변경점/변경쩜)도 미리보기와 동일하게 배경에 반영 → 키에 포함.
    const dyeSig = (mode === 'mymodel' || needMy) ? JSON.stringify({ p: s.renderPalette, h: s.renderHsb, d: s.dotPos }) : ''
    const key = `${mode}:${needMy}:${gaze}:${s.tone}:${isSkinCat ? 'skin' : 'base'}:${eqSig}:${dyeSig}:${s.pv.wEffect}${s.pv.cEffect}${s.pv.capEffect}:${ctxExpr}:${s.pv.form}:${s.pv.ear}:${s.pv.weapon}:${animaRaces.length}`
    if (key === ctxKeyRef.current) return // 이미 최신 컨텍스트 → 불필요한 재조립/리렌더 방지
    // ⚠️ ctxKeyRef 는 async 가 "실제로 setCtx 로 커밋된 뒤"에만 찍는다(StrictMode 이중 setup 대비).
    const ids = Array.from(new Set([...(isSkinCat ? [] : [elf.bodyId, elf.headId, mine.bodyId, mine.headId]), ...(mode === 'mymodel' || needMy ? myEq.map(([, it]) => it.id) : [])]))
    Promise.all(ids.map((id) => loadMeta(id).then((m) => [id, m] as const).catch(() => null))).then(async (res) => {
      if (!alive) return
      const map = new Map(res.filter(Boolean).map((r) => r!))
      // isMy = "내 캐릭터"(내 착용 배경) 컨텍스트. 형상변이·귀·이펙트는 코디 취급 → 내 캐릭터에만 적용.
      const build = async (worn: [string, ListItem][], expr: string, k: string, isMy: boolean): Promise<ThumbCtx> => {
        const stance = isMy && mode === 'mymodel' // 무기모션 자세는 '내 캐릭터' 보기에서만(승격 카드 제외)
        const view = thumbView(gaze, expr, isMy ? s.pv.ear : undefined, s.pv.weapon, stance).view
        const items: AssembleInput[] = []
        if (!isSkinCat) {
          const t = isMy ? mine : elf
          const body = map.get(t.bodyId), head = map.get(t.headId)
          if (body) items.push({ itemId: body.id, slot: 'body', vslot: null, layers: getFrameLayers(body, view) })
          if (head) items.push({ itemId: head.id, slot: 'head', vslot: null, layers: getFrameLayers(head, view) })
        }
        for (const [sl, it] of worn) {
          const m = map.get(it.id); if (!m) continue
          items.push({ itemId: m.id, slot: sl, vslot: m.vslot ?? null, layers: getFrameLayers(m, view), invisibleFace: m.invisibleFace, name: m.name, dotOffsets: s.dotPos[m.id] })
        }
        if (!isSkinCat && isMy) items.push(...animaLayers(s.pv.form, animaRaces)) // 형상변이 — 내 캐릭터에만
        let override = new Map<string, HTMLCanvasElement>()
        let effs: WornEff[] = []
        if (worn.length) {
          // 착용 아이템(활성 슬롯 제외)의 현재 염색을 override 로 구워 배경에 반영. 후보 아이템 자체는 기본색(미장착).
          const dyeMetas = worn.map(([, it]) => map.get(it.id)).filter(Boolean) as ItemMeta[]
          override = await buildOverrides(dyeMetas, { palette: s.renderPalette, hsb: s.renderHsb }, view).catch(() => new Map())
          // 착용 아이템의 이펙트(망토 오라 등)도 카드에 그린다 + 그 이펙트 염색을 override 에 굽는다(토글 꺼진 슬롯 제외).
          effs = await collectWornEffects(worn.map(([sl, it]) => ({ slot: sl, id: it.id })), s.pv, s.renderHsb, override).catch(() => [])
        }
        // 표정 얼굴장식 카드는 배경의 얼굴을 **자기 표정으로 다시 그려야** 한다(ItemThumb) → 메타를 넘긴다.
        const faceEntry = worn.find(([sl]) => sl === 'face')
        return { items, key: k, override, effs, expr, faceMeta: faceEntry ? (map.get(faceEntry[1].id) ?? null) : null, stance }
      }
      const main = await build(eqEntries, ctxExpr, key, mode === 'mymodel')
      const my = needMy ? await build(myEq, THUMB_VIEW.expression, `${key}:my`, true) : EMPTY
      if (!alive) return
      ctxKeyRef.current = key // 커밋 성공 시에만 기록(위 주석 참고)
      setCtx(main); setMyCtx(my)
    })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, needMy, gaze, s.index, s.tone, s.activeCat, s.equipped, s.hidden, isSkinCat, isAll, s.renderPalette, s.renderHsb, s.dotPos, s.pv.wEffect, s.pv.cEffect, s.pv.capEffect, s.pv.form, s.pv.ear, s.pv.weapon, ctxExpr, animaRaces, spritePromote])

  const ctxFor = (it: ListItem) => ((effMode(it) === 'mymodel' && mode === 'model') ? myCtx : ctx)
  return { mode, noSprite, effMode, ctxFor }
}

// ── AI 코디 검색 탭 ──
export function useSearchThumbs(list: ListItem[]): ThumbApi {
  const s = useShop()
  const gaze = s.pv.gaze
  const tv = thumbView(gaze, undefined, undefined, s.pv.weapon) // base(기본 캐릭터): 무기모션만, 귀/형상변이 ✗
  const animaRaces = useAnimaRaces()
  const mode = s.listMode
  const needMy = mode === 'model' && list.some((it) => !!it.fixedEmotion)
  const effMode = (it: ListItem): ListMode =>
    forceMyModel(mode, it) ? 'mymodel' : mode

  // 기본 캐릭터(body+head, 현재 톤) + 내 캐릭터는 슬롯별(내 착용 − 그 슬롯)
  const [ctx, setCtx] = useState<{ base: ThumbCtx; bySlot: Record<string, ThumbCtx> }>({ base: EMPTY, bySlot: {} })
  const ctxKeyRef = useRef('')
  useEffect(() => {
    const idx = s.index
    const needCtx = !!idx && list.length > 0 && mode !== 'sprite'
    if (!needCtx) { if (ctxKeyRef.current) { ctxKeyRef.current = ''; setCtx({ base: EMPTY, bySlot: {} }) } return }
    let alive = true
    const elf = toneIds(idx!, DEFAULT_TONE), mine = toneIds(idx!, s.tone) // 기본 캐릭터 = 엘프 피부, 내 캐릭터 = 현재 피부
    const slotsInList = Array.from(new Set(list.map((it) => it.slot)))
    const myEq = Object.entries(s.equipped).filter(([sl, it]) => it && !s.hidden[sl]) as [string, ListItem][]
    const eqSig = myEq.map(([sl, it]) => sl + it.id).sort().join(',')
    // 점 위치(변경점/변경쩜)도 미리보기와 동일하게 배경에 반영 → 키에 포함.
    const dyeSig = (mode === 'mymodel' || needMy) ? JSON.stringify({ p: s.renderPalette, h: s.renderHsb, d: s.dotPos }) : ''
    const key = `${mode}:${needMy}:${gaze}:${s.tone}:${slotsInList.join(',')}:${eqSig}:${dyeSig}:${s.pv.wEffect}${s.pv.cEffect}${s.pv.capEffect}:${s.pv.form}:${s.pv.ear}:${s.pv.weapon}:${mode === 'mymodel' ? s.pv.expr : ''}:${animaRaces.length}`
    if (key === ctxKeyRef.current) return
    const eqIds = (mode === 'mymodel' || needMy) ? myEq.map(([, it]) => it.id) : []
    const ids = Array.from(new Set([elf.bodyId, elf.headId, mine.bodyId, mine.headId, ...eqIds]))
    Promise.all(ids.map((id) => loadMeta(id).then((m) => [id, m] as const).catch(() => null))).then(async (res) => {
      if (!alive) return
      const map = new Map(res.filter(Boolean).map((r) => r!))
      const body = map.get(elf.bodyId), head = map.get(elf.headId)
      const myBody = map.get(mine.bodyId), myHead = map.get(mine.headId)
      const baseItems: AssembleInput[] = []
      if (body) baseItems.push({ itemId: body.id, slot: 'body', vslot: null, layers: getFrameLayers(body, tv.view) })
      if (head) baseItems.push({ itemId: head.id, slot: 'head', vslot: null, layers: getFrameLayers(head, tv.view) })
      const bySlot: Record<string, ThumbCtx> = {}
      if (mode === 'mymodel' || needMy) {
        for (const slot of slotsInList) {
          // 표정 얼굴장식을 착용 중이면 이 슬롯 컨텍스트의 표정이 'default' 가 아니다(후보가 들어갈 슬롯의 착용품은 빠진다).
          // '내 캐릭터' 보기는 연출 설정 표정·무기모션 자세를 따라간다(승격 카드는 기본 표정·자세).
          const stance = mode === 'mymodel'
          const cexpr = fixedExpr(myEq.filter(([sl]) => sl !== slot).map(([, it]) => it), stance ? s.pv.expr : THUMB_VIEW.expression)
          const cview = thumbView(gaze, cexpr, s.pv.ear, s.pv.weapon, stance).view
          const items: AssembleInput[] = []
          if (myBody) items.push({ itemId: myBody.id, slot: 'body', vslot: null, layers: getFrameLayers(myBody, cview) })
          if (myHead) items.push({ itemId: myHead.id, slot: 'head', vslot: null, layers: getFrameLayers(myHead, cview) })
          if (myHead) items.push(...animaLayers(s.pv.form, animaRaces))
          const dyeMetas: ItemMeta[] = []
          let faceMeta: ItemMeta | null = null
          for (const [sl, it] of myEq) {
            if (sl === slot) continue // 후보 아이템이 들어갈 슬롯은 내 착용에서 제외
            const m = map.get(it.id); if (!m) continue
            items.push({ itemId: m.id, slot: sl, vslot: m.vslot ?? null, layers: getFrameLayers(m, cview), invisibleFace: m.invisibleFace, name: m.name, dotOffsets: s.dotPos[m.id] })
            dyeMetas.push(m)
            if (sl === 'face') faceMeta = m
          }
          const override = await buildOverrides(dyeMetas, { palette: s.renderPalette, hsb: s.renderHsb }, cview).catch(() => new Map())
          const effs = await collectWornEffects(
            myEq.filter(([sl]) => sl !== slot).map(([sl, it]) => ({ slot: sl, id: it.id })), s.pv, s.renderHsb, override,
          ).catch(() => [])
          bySlot[slot] = { items, key: `${key}:${slot}:${cexpr}`, override, effs, expr: cexpr, faceMeta, stance }
        }
      }
      if (!alive) return
      ctxKeyRef.current = key
      setCtx({ base: { items: baseItems, key }, bySlot })
    })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.index, s.tone, gaze, mode, needMy, s.equipped, s.hidden, list, s.renderPalette, s.renderHsb, s.dotPos, s.pv.wEffect, s.pv.cEffect, s.pv.capEffect, s.pv.form, s.pv.ear, s.pv.weapon, s.pv.expr, animaRaces])

  const ctxFor = (item: ListItem): ThumbCtx => {
    const em = effMode(item)
    if (em === 'sprite') return EMPTY
    if (em === 'mymodel') return ctx.bySlot[item.slot] || ctx.base
    return ctx.base
  }
  return { mode, noSprite: null, effMode, ctxFor }
}
