'use client'

/*
 * ItemThumb — 아이템 리스트 셀의 3가지 표시 모드.
 *  - sprite  : 아이템 아이콘/스프라이트 이미지(가장 가벼움)
 *  - model   : 베이스 몸통+머리에 이 아이템을 올린 미니 합성
 *  - mymodel : 현재 내 착용(해당 슬롯 제외)에 이 아이템을 올린 미니 합성
 * 이 아이템에 이펙트가 있으면(effects/index.json) 함께 합성한다. centerX 로 sprite 처럼 정중앙 정렬.
 */

import { useEffect, useRef, useState } from 'react'
import { assemble, getFrameLayers, type AssembleInput, type PlacedLayer } from '@/lib/core/assemble'
import { loadEffect, loadEffectIndex, loadMeta, spriteUrl, type ListItem } from '@/lib/core/data'
import { effectDraws, renderCharacter, type EffectDraw } from '@/lib/core/render'
import { THUMB_VIEW } from '@/lib/shopData'
import type { ListMode } from './ShopContext'

const THUMB_BOX = { w: 96, h: 104 }
const THUMB_ANCHOR = { x: 48, y: 74 } // x는 centerX로 재정렬되므로 대략값

function Sprite({ item }: { item: ListItem }) {
  const sources: string[] = []
  if (item.icon) sources.push(spriteUrl(item.icon))
  if (item.thumb) sources.push(spriteUrl(item.thumb))
  sources.push(spriteUrl(`sprites/${item.id}/thumb.png`))
  const [idx, setIdx] = useState(0)
  useEffect(() => { setIdx(0) }, [item.id])
  if (idx >= sources.length) return null
  return (
    // 스프라이트 썸네일만 살짝 크게(scale). 픽셀 아트라 pixelated 로 크리스프 유지.
    <img src={sources[idx]} alt={item.name || item.id} loading="lazy" decoding="async" draggable={false}
      onError={() => setIdx((i) => i + 1)} style={{ maxWidth: '100%', maxHeight: '100%', imageRendering: 'pixelated', objectFit: 'contain', transform: 'scale(1.32) translateZ(0)', backfaceVisibility: 'hidden' }} />
  )
}

interface ModelProps {
  item: ListItem; ctxItems: AssembleInput[]; ctxKey: string
  zmap: string[]; smap: Record<string, string>; skinHeadId?: string
}
function ModelThumb({ item, ctxItems, ctxKey, zmap, smap, skinHeadId }: ModelProps) {
  const [placed, setPlaced] = useState<PlacedLayer[] | null>(null)
  const [effs, setEffs] = useState<EffectDraw[]>([])
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    let alive = true
    setPlaced(null); setEffs([])
    ;(async () => {
      let self: AssembleInput[]
      if (item.slot === 'skin' && skinHeadId) {
        const [body, head] = await Promise.all([loadMeta(item.id), loadMeta(skinHeadId)])
        self = [
          { itemId: head.id, slot: 'head', vslot: null, layers: getFrameLayers(head, THUMB_VIEW) },
          { itemId: body.id, slot: 'body', vslot: null, layers: getFrameLayers(body, THUMB_VIEW) },
        ]
      } else {
        const m = await loadMeta(item.id)
        self = [{ itemId: m.id, slot: m.slot, vslot: m.vslot ?? null, layers: getFrameLayers(m, THUMB_VIEW), invisibleFace: m.invisibleFace }]
      }
      if (!alive) return
      const { placed: p, anchors } = assemble([...ctxItems, ...self], zmap, smap)
      setPlaced(p)
      // 이 아이템 자체의 이펙트(망토 등) — 정적 대표 프레임.
      if (item.slot !== 'skin') {
        const bare = String(parseInt(item.id, 10))
        const eidx = await loadEffectIndex().catch(() => new Set<string>())
        if (alive && eidx.has(bare)) {
          const em = await loadEffect(item.id).catch(() => null)
          if (em && alive) {
            const bp = p.find((x) => x.name === 'body')
            const foot = bp ? { x: bp.x + bp.origin.x, y: bp.y + bp.origin.y } : { x: 8, y: 21 }
            setEffs(effectDraws(em, THUMB_VIEW.action, { foot, brow: anchors.brow ?? foot }, 0))
          }
        }
      }
    })().catch(() => {})
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id, ctxKey, skinHeadId])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !placed) return
    let cancelled = false
    // 작은 셀은 1:1(scale 1)이 가장 깔끔(2배로 그린 뒤 축소하면 오히려 뭉개짐).
    renderCharacter(canvas, placed, { scale: 1, box: THUMB_BOX, anchor: THUMB_ANCHOR, effects: effs, centerX: true, shouldCancel: () => cancelled }).catch(() => {})
    return () => { cancelled = true }
  }, [placed, effs])

  if (!placed) return <div className="pb-skel" style={{ width: '68%', height: '68%', borderRadius: 8 }} />
  return <canvas ref={canvasRef} style={{ maxWidth: '100%', maxHeight: '100%', imageRendering: 'pixelated', transform: 'translateZ(0)', backfaceVisibility: 'hidden' }} />
}

export default function ItemThumb(props: {
  item: ListItem; mode: ListMode; ctxItems: AssembleInput[]; ctxKey: string
  zmap: string[]; smap: Record<string, string>; skinHeadId?: string
}) {
  if (props.mode === 'sprite') return <Sprite item={props.item} />
  return <ModelThumb item={props.item} ctxItems={props.ctxItems} ctxKey={props.ctxKey} zmap={props.zmap} smap={props.smap} skinHeadId={props.skinHeadId} />
}
