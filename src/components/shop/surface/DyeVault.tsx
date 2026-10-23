'use client'

// 염색 보관함 — 염색 창의 조절 칸 맨 아래(사용자 지시: 북마크 · 프리셋과 별개로 아이템 하나의 염색을 여러 벌 담아 두고 골라 본다).
//  · [담기] = 지금 조절 칸의 값을 담는다(누를 때만 — 수치를 바꿀 때마다 담지 않는다). 같은 값이 이미 있거나 가득 차면 누를 수 없다.
//  · 칸을 누르면 그 값이 조절 칸으로 들어온다(미리보기가 바로 바뀐다). 착용 · 코디에 들어가는 것은 [적용]을 누를 때다 — 지금까지와 같다.
//  · 칸은 북마크 칸과 같은 부품(pb-slot — 빈칸 점선, 담은 칸 실선, 지금 값과 같은 칸은 핑크, ✕ 는 마우스면 올렸을 때 · 터치면 늘).
//  · 한 줄 가로 스크롤(칸이 늘어도 높이는 그대로 — 밀림 없음). 빈칸은 VISIBLE 칸까지 채워 둔다. 마우스 휠은 가로로 넘긴다.
import clsx from 'clsx'
import { useEffect, useRef } from 'react'
import type { ListItem } from '@/lib/core/data'
import { DYE_VAULT_MAX, dyeSaveKey, useDyeVault, type DyeSave } from '@/lib/dyeVault'
import { useShop } from '../ShopContext'
import { LookSprite } from '../info/SlotSprite'
import pv from '../preview/preview.module.css'
import styles from './surface.module.css'

const VISIBLE = 5
const valueText = (d: DyeSave) => ('hsb' in d ? `색조 ${d.hsb.h} / 채도 ${d.hsb.s} / 명도 ${d.hsb.b}` : `${d.pal.mixColor == null || d.pal.mixColor === d.pal.baseColor ? '단색' : `비율 ${d.pal.ratio}`}`)

export default function DyeVault ({ item, current, onPick }: { item: ListItem; current: DyeSave; onPick: (d: DyeSave) => void }) {
  const s = useShop()
  const { list, put, remove } = useDyeVault(item.id)
  const curKey = dyeSaveKey(current)
  const has = list.some((d) => dyeSaveKey(d) === curKey)
  const full = list.length >= DYE_VAULT_MAX
  const tone = item.slot === 'skin' ? s.index?.base.tones.find((t) => t.body === item.id)?.tone ?? s.tone : s.tone
  const strip = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = strip.current
    if (!el) return
    const wheel = (e: WheelEvent) => {
      if (el.scrollWidth <= el.clientWidth || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return
      e.preventDefault(); el.scrollLeft += e.deltaY
    }
    el.addEventListener('wheel', wheel, { passive: false })
    return () => el.removeEventListener('wheel', wheel)
  }, [])
  const save = () => { put(current); strip.current?.scrollTo({ left: 0, behavior: 'smooth' }) }
  return (
    <div className={styles.vault}>
      <div className={pv.pinHead}>
        <span className={pv.pinTitle}>염색 보관함<span className={clsx(pv.count, list.length > 0 && pv.countOn)}>{list.length}</span></span>
        <button type="button" onClick={save} disabled={has || full}
          title={has ? '지금 염색이 이미 담겨 있어요' : full ? `${DYE_VAULT_MAX}개까지 담을 수 있어요` : '지금 염색을 담아 두기'}
          className={clsx('pb-ghost', pv.vsBtn, styles.vaultPut)}>담기</button>
      </div>
      <div ref={strip} className={clsx('pb-scroll-thin', styles.vaultStrip)}>
        {list.map((d) => {
          const k = dyeSaveKey(d), on = k === curKey
          return (
            <div key={k} role="button" tabIndex={0} onClick={() => onPick(d)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(d) } }}
              title={`${valueText(d)}${on ? ' — 지금 값' : ' — 눌러서 불러오기'}`} aria-pressed={on}
              className={clsx('pb-slot', pv.slot, pv.slotFilled, on && pv.slotWorn, styles.vaultCell)}>
              <div className={pv.slotSprite}>
                <LookSprite slot={item.slot} item={item} tone={tone} palette={'pal' in d ? d.pal : undefined} hsb={'hsb' in d ? d.hsb : undefined} />
              </div>
              <button type="button" onClick={(e) => { e.stopPropagation(); remove(d) }} title="보관함에서 빼기" aria-label="보관함에서 빼기" className={clsx('pb-slot-x', pv.slotX)}>✕</button>
            </div>
          )
        })}
        {Array.from({ length: Math.max(0, VISIBLE - list.length) }, (_, i) => (
          <div key={`e${i}`} title="[담기]를 누르면 지금 염색이 여기에 담겨요" className={clsx('pb-slot', pv.slot, styles.vaultCell)} />
        ))}
      </div>
    </div>
  )
}
