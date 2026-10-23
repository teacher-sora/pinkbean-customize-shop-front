'use client'

// 염색 보관함 — 염색 창의 조절 칸 맨 아래(사용자 지시: 북마크 · 프리셋과 별개로 아이템 하나의 염색을 여러 벌 담아 두고 골라 본다).
// 북마크를 참조만 한 이 창만의 부품이다 — 간격 · 글자 · 단추는 염색 창의 것을 따른다(사용자 지시: 북마크 부품을 그대로 빌려 와 간격과 라벨이 어긋났다).
//  · 조절 칸의 자식 둘로 들어간다: margin-top: auto 인 구분선(아래로 밀어 붙인다) + 보관함 묶음(머리 줄 · 칸 줄).
//  · 머리 줄: '보관함' 라벨(베이스 · 믹스 · 색조 · 채도 · 명도와 같은 글자) + [비우기] [염색 저장](염색 창의 다른 단추와 같은 모양).
//  · [염색 저장] · 칸 줄 끝의 + 칸 = 지금 조절 칸의 값을 담는다(누를 때만 — 수치를 바꿀 때마다 담지 않는다). 같은 값이 이미 있거나 가득 차면 누를 수 없다.
//  · 칸을 누르면 그 값이 조절 칸으로 들어온다(미리보기가 바로 바뀐다). 착용 · 코디에 들어가는 것은 [적용]을 누를 때다 — 지금까지와 같다.
//  · 칸의 ✕ 와 [비우기]는 두 번 눌러야 지운다(lib/confirmTwice — 누른 단추 위에 되묻는 말풍선).
//  · 칸은 크기가 고정이다 — 늘면 줄어들지 않고 가로로 스크롤된다(스크롤바는 숨기고 양 끝은 흐림 · 화살표 — 하단 부위 줄과 같은 pb-norail · pb-fade).
//    + 칸은 늘 맨 끝. 아무것도 없으면 + 칸 하나뿐이다. 새로 담은 것은 + 칸 바로 앞에 붙고 그 자리까지 스크롤한다. 마우스 휠은 가로로 넘긴다.
import clsx from 'clsx'
import { useEffect, useRef } from 'react'
import { CONFIRM_ATTR, confirmTwice } from '@/lib/confirmTwice'
import type { ListItem } from '@/lib/core/data'
import { DYE_VAULT_MAX, dyeSaveKey, useDyeVault, type DyeSave } from '@/lib/dyeVault'
import { useShop } from '../ShopContext'
import { LookSprite } from '../info/SlotSprite'
import { IconAdd } from '../ui/Icons'
import styles from './surface.module.css'

const valueText = (d: DyeSave) => ('hsb' in d ? `색조 ${d.hsb.h} / 채도 ${d.hsb.s} / 명도 ${d.hsb.b}` : `${d.pal.mixColor == null || d.pal.mixColor === d.pal.baseColor ? '단색' : `비율 ${d.pal.ratio}`}`)

export default function DyeVault ({ item, current, onPick, mobile }: { item: ListItem; current: DyeSave; onPick: (d: DyeSave) => void; mobile: boolean }) {
  const s = useShop()
  const { list, put, remove, clear } = useDyeVault(item.id)
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
  // 담은 칸은 + 칸 바로 앞(맨 끝)에 붙는다 — 그려진 뒤 끝까지 스크롤해 보이게
  const shown = [...list].reverse()
  const save = () => { put(current); requestAnimationFrame(() => { const el = strip.current; el?.scrollTo({ left: el.scrollWidth, behavior: 'smooth' }) }) }
  const why = has ? '지금 염색이 이미 저장돼 있어요' : full ? `${DYE_VAULT_MAX}개까지 저장할 수 있어요` : '지금 염색을 보관함에 저장'
  const btn = mobile ? styles.resetIcon : clsx('pb-ghost', styles.resetBtn)
  const clearKey = `vault:clear:${item.id}`
  return (
    <>
      <div className={clsx(styles.hr, styles.hrEnd)} />
      <div className={styles.vault}>
        <div className={styles.vaultHead}>
          <span className={styles.vaultLabel}>보관함<span className={styles.vaultCount}>{list.length} / {DYE_VAULT_MAX}</span></span>
          <span className={styles.vaultActs}>
            <button type="button" disabled={!list.length} title={list.length ? '보관함 비우기' : '비울 염색이 없어요'} {...{ [CONFIRM_ATTR]: clearKey }}
              onClick={() => { if (confirmTwice(clearKey, '한 번 더 누르면 보관함을 비워요')) clear() }} className={clsx(btn, styles.vaultBtn)}>비우기</button>
            <button type="button" onClick={save} disabled={has || full} title={why} className={clsx(btn, styles.vaultBtn)}>염색 저장</button>
          </span>
        </div>
        <div ref={strip} className={clsx('pb-norail', 'pb-fade', styles.vaultStrip)} role="list" aria-label="저장한 염색">
          {shown.map((d) => {
            const k = dyeSaveKey(d), on = k === curKey, xKey = `vault:x:${item.id}:${k}`
            return (
              <div key={k} role="listitem" className={styles.vaultItem}>
                <button type="button" onClick={() => onPick(d)} title={`${valueText(d)}${on ? ' — 지금 값' : ' — 눌러서 불러오기'}`} aria-pressed={on}
                  className={clsx(styles.vaultCell, on && styles.vaultCellOn)}>
                  <span className={styles.vaultSprite}>
                    <LookSprite slot={item.slot} item={item} tone={tone} palette={'pal' in d ? d.pal : undefined} hsb={'hsb' in d ? d.hsb : undefined} />
                  </span>
                </button>
                <button type="button" title="보관함에서 빼기" aria-label="보관함에서 빼기" {...{ [CONFIRM_ATTR]: xKey }}
                  onClick={() => { if (confirmTwice(xKey, '한 번 더 누르면 빼요')) remove(d) }} className={styles.vaultX}>✕</button>
              </div>
            )
          })}
          <div role="listitem" className={styles.vaultItem}>
            <button type="button" onClick={save} disabled={has || full} title={why} aria-label="염색 저장" className={styles.vaultAdd}><IconAdd size={16} /></button>
          </div>
        </div>
      </div>
    </>
  )
}
