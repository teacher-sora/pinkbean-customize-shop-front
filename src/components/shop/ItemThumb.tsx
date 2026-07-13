'use client'

/*
 * ItemThumb — 아이템 리스트 셀의 3가지 표시 모드.
 *  - sprite  : 아이템 아이콘/스프라이트 이미지(가장 가벼움)
 *  - model   : 베이스 몸통+머리에 이 아이템을 올린 미니 합성
 *  - mymodel : 현재 내 착용(해당 슬롯 제외)에 이 아이템을 올린 미니 합성
 * model/mymodel 의 공통 배경(base 또는 내 착용)은 CodiScreen 이 ctxItems 로 넘긴다.
 */

import { useEffect, useRef, useState } from 'react'
import { assemble, getFrameLayers, type AssembleInput, type PlacedLayer } from '@/lib/core/assemble'
import { loadMeta, spriteUrl, type ListItem } from '@/lib/core/data'
import { renderCharacter } from '@/lib/core/render'
import { THUMB_VIEW } from '@/lib/shopData'
import type { ListMode } from './ShopContext'

// 몸통 박스보다 넉넉하게(큰 망토/날개·이펙트가 잘리지 않도록). navel 고정이라 몸은 안 흔들림.
const THUMB_BOX = { w: 96, h: 104 }
const THUMB_ANCHOR = { x: 45.5, y: 74 } // x: 몸통 시각중심 2.5px 보정(정중앙)

function Sprite({ item }: { item: ListItem }) {
  const sources: string[] = []
  if (item.icon) sources.push(spriteUrl(item.icon))
  if (item.thumb) sources.push(spriteUrl(item.thumb))
  sources.push(spriteUrl(`sprites/${item.id}/thumb.png`))
  const [idx, setIdx] = useState(0)
  useEffect(() => { setIdx(0) }, [item.id])
  if (idx >= sources.length) return null
  return (
    <img src={sources[idx]} alt={item.name || item.id} loading="lazy" decoding="async" draggable={false}
      onError={() => setIdx((i) => i + 1)} style={{ maxWidth: '100%', maxHeight: '100%', imageRendering: 'pixelated', objectFit: 'contain' }} />
  )
}

interface ModelProps {
  item: ListItem; ctxItems: AssembleInput[]; ctxKey: string
  zmap: string[]; smap: Record<string, string>; skinHeadId?: string
}
function ModelThumb({ item, ctxItems, ctxKey, zmap, smap, skinHeadId }: ModelProps) {
  const [placed, setPlaced] = useState<PlacedLayer[] | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    let alive = true
    setPlaced(null)
    ;(async () => {
      // 피부 셀: 이 아이템 자체가 몸통 → 몸통+머리를 self 로.
      if (item.slot === 'skin' && skinHeadId) {
        const [body, head] = await Promise.all([loadMeta(item.id), loadMeta(skinHeadId)])
        if (!alive) return
        const inputs: AssembleInput[] = [
          { itemId: head.id, slot: 'head', vslot: null, layers: getFrameLayers(head, THUMB_VIEW) },
          { itemId: body.id, slot: 'body', vslot: null, layers: getFrameLayers(body, THUMB_VIEW) },
        ]
        setPlaced(assemble([...ctxItems, ...inputs], zmap, smap).placed)
        return
      }
      const m = await loadMeta(item.id)
      if (!alive) return
      const self: AssembleInput = { itemId: m.id, slot: m.slot, vslot: m.vslot ?? null, layers: getFrameLayers(m, THUMB_VIEW), invisibleFace: m.invisibleFace }
      setPlaced(assemble([...ctxItems, self], zmap, smap).placed)
    })().catch(() => {})
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id, ctxKey, skinHeadId])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !placed) return
    let cancelled = false
    renderCharacter(canvas, placed, { scale: 1, box: THUMB_BOX, anchor: THUMB_ANCHOR, shouldCancel: () => cancelled }).catch(() => {})
    return () => { cancelled = true }
  }, [placed])

  if (!placed) return <div className="pb-skel" style={{ width: '68%', height: '68%', borderRadius: 8 }} />
  return <canvas ref={canvasRef} style={{ maxWidth: '100%', maxHeight: '100%', imageRendering: 'pixelated' }} />
}

export default function ItemThumb(props: {
  item: ListItem; mode: ListMode; ctxItems: AssembleInput[]; ctxKey: string
  zmap: string[]; smap: Record<string, string>; skinHeadId?: string
}) {
  if (props.mode === 'sprite') return <Sprite item={props.item} />
  return <ModelThumb item={props.item} ctxItems={props.ctxItems} ctxKey={props.ctxKey} zmap={props.zmap} smap={props.smap} skinHeadId={props.skinHeadId} />
}
