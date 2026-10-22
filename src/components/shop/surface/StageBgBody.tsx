'use client'

// 미리보기 배경 고르기. 넓으면 다섯 칸, 좁아지면 네 칸 · 세 칸(모바일)씩 놓는다: 첫 칸은 늘 '커스텀 배경'(그림 올리기)이고, 그 뒤로 피팅룸 · 캐시샵 배경 다섯 · 흰색 · 검은색, 올린 그림은 올린 순서대로 맨 뒤에 붙는다.
// 고르면 곧바로 미리보기에 깔린다(창은 닫지 않는다 — 여러 개를 대 볼 수 있게). 올린 그림은 이 브라우저에만 남는다(lib/stageBg).

import clsx from 'clsx'
import { useEffect, useRef, useState } from 'react'
import { CONFIRM_ATTR, confirmTwice } from '@/lib/confirmTwice'
import { addStageBg, CASH_BGS, cashBgsOn, removeStageBg, setStageBg, STAGE_BG_MAX, useStageBg } from '@/lib/stageBg'
import { STAGE_COLORS } from '../preview/StageBg'
import { SCENE_SRC } from '../scene/sceneSrc'
import { useShop } from '../ShopContext'
import { IconAdd, IconClose } from '../ui/Icons'
import styles from './surface.module.css'

const FIXED = [
  { id: 'room', label: '피팅룸', style: { backgroundImage: `url("${SCENE_SRC.room[1]}")` } },
  { id: 'white', label: '흰색', style: { background: STAGE_COLORS.white } },
  { id: 'black', label: '검은색', style: { background: STAGE_COLORS.black } },
]

export default function StageBgBody() {
  const s = useShop()
  const bg = useStageBg()
  const file = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const full = bg.images.length >= STAGE_BG_MAX
  // 캐시샵 배경(파일이 있을 때만). 피팅룸 · 흰색 · 검은색 뒤, 올린 그림 앞에 둔다
  const [cash, setCash] = useState(false)
  useEffect(() => { let alive = true; cashBgsOn().then((v) => { if (alive) setCash(v) }); return () => { alive = false } }, [])

  const upload = async (f: File | undefined) => {
    if (!f || busy) return
    setBusy(true)
    const r = await addStageBg(f)
    setBusy(false)
    if (r === 'full') s.notify(`그림은 ${STAGE_BG_MAX}장까지 올릴 수 있어요`)
    else if (r === 'bad') s.notify('그림 파일을 올려주세요')
    else if (r === 'store') s.notify('저장할 자리가 모자라요')
  }
  const tile = (id: string, label: string, style: React.CSSProperties, custom: boolean) => {
    const on = bg.sel === id
    return (
      <div key={id} className={styles.bgCell}>
        <button type="button" onClick={() => setStageBg(id)} aria-pressed={on} title={label} className={clsx('pb-partchip', styles.bgTile, on && styles.bgTileOn)}>
          <span className={styles.bgThumb} style={style} />
          <span className={styles.bgName}>{label}</span>
        </button>
        {custom && (
          <button type="button" onClick={() => { if (confirmTwice(`bg:${id}`, '한 번 더 누르면 삭제해요')) removeStageBg(id) }} {...{ [CONFIRM_ATTR]: `bg:${id}` }}
            title="그림 삭제" aria-label="그림 삭제" className={styles.bgDel}><IconClose /></button>
        )}
      </div>
    )
  }

  return (
    <div className={clsx('pb-scroll', 'pb-fade', styles.partBody, s.bp === 'mobile' && styles.bgBodyM)}>
      <div className={styles.bgGrid}>
        <div className={styles.bgCell}>
          <button type="button" onClick={() => file.current?.click()} disabled={full} title={full ? `그림은 ${STAGE_BG_MAX}장까지 올릴 수 있어요` : '내 그림을 배경으로 올리기'}
            className={clsx('pb-partchip', styles.bgTile, styles.bgAdd, full && styles.bgAddOff)}>
            <span className={clsx(styles.bgThumb, styles.bgAddThumb)}><IconAdd size={18} /></span>
            <span className={styles.bgName}>커스텀 배경</span>
          </button>
          <input ref={file} type="file" accept="image/*" hidden onChange={(e) => { upload(e.target.files?.[0]); e.target.value = '' }} />
        </div>
        {/* 순서: 피팅룸 · 캐시샵 배경(dev) · 흰색 · 검은색 · 올린 그림(사용자 지시 — 색 둘은 고른 그림들 뒤, 올린 것은 맨 뒤) */}
        {FIXED.slice(0, 1).map((f) => tile(f.id, f.label, f.style, false))}
        {cash && CASH_BGS.map((c) => tile(c.id, c.label, { backgroundImage: `url("${c.src}")`, backgroundSize: 'cover', backgroundPosition: 'center 70%', backgroundColor: c.top }, false))}
        {FIXED.slice(1).map((f) => tile(f.id, f.label, f.style, false))}
        {bg.images.map((im, i) => tile(im.id, `내 그림 ${i + 1}`, { backgroundImage: `url("${im.src}")` }, true))}
      </div>
    </div>
  )
}
