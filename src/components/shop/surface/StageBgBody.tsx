'use client'

// 미리보기 배경 고르기. 세 칸씩 놓는다: 첫 칸은 늘 '커스텀 배경'(그림 올리기)이고, 그 뒤로 피팅룸 · 흰색 · 검은색, 올린 그림은 올린 순서대로 맨 뒤에 붙는다.
// 고르면 곧바로 미리보기에 깔린다(창은 닫지 않는다 — 여러 개를 대 볼 수 있게). 올린 그림은 이 브라우저에만 남는다(lib/stageBg).

import clsx from 'clsx'
import { useEffect, useRef, useState } from 'react'
import { CONFIRM_ATTR, confirmTwice } from '@/lib/confirmTwice'
import { addStageBg, removeStageBg, setStageBg, setStageBgPos, STAGE_BG_MAX, useStageBg, type StageBgImage } from '@/lib/stageBg'
import { STAGE_COLORS } from '../preview/StageBg'
import { SCENE_SRC } from '../scene/sceneSrc'
import { useShop } from '../ShopContext'
import { IconAdd, IconCloseSmall } from '../ui/Icons'
import styles from './surface.module.css'

const FIXED = [
  { id: 'room', label: '피팅룸', style: { backgroundImage: `url("${SCENE_SRC.room[1]}")` } },
  { id: 'white', label: '흰색', style: { background: STAGE_COLORS.white } },
  { id: 'black', label: '검은색', style: { background: STAGE_COLORS.black } },
]

// 올린 그림에서 **어느 부분이 보일지** 맞춘다. 그림 전체를 놓고, 미리보기에 실제로 보이는 넓이만큼의 점선 틀을 끌어 옮긴다
// (광장의 그림 맞춤과 같은 생김새 — 가운데 점선). 미리보기는 그림을 칸에 꽉 차게 깔아서 가로나 세로 한쪽이 잘린다.
// 틀의 넓이는 지금 미리보기 칸의 비율에서 온다. 끄는 동안은 화면에만 반영하고 놓을 때 한 번 저장한다.
const FOCUS_H = 132
function BgFocus({ img }: { img: StageBgImage }) {
  const box = useRef<HTMLDivElement>(null)
  const [nat, setNat] = useState<[number, number] | null>(null)
  const [boxW, setBoxW] = useState(0)
  const [aspect, setAspect] = useState(3 / 4)
  useEffect(() => {
    const stage = document.querySelector('[data-stage-bg]')?.getBoundingClientRect()
    if (stage && stage.width && stage.height) setAspect(stage.width / stage.height)
    const el = box.current
    if (!el) return
    const ro = new ResizeObserver(() => setBoxW(el.clientWidth))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const x = img.x ?? 50, y = img.y ?? 50
  let view: { dw: number; dh: number; fw: number; fh: number } | null = null
  if (nat && boxW) {
    const k = Math.min(boxW / nat[0], FOCUS_H / nat[1]), dw = nat[0] * k, dh = nat[1] * k, wide = nat[0] / nat[1] > aspect
    view = { dw, dh, fw: wide ? dh * aspect : dw, fh: wide ? dh : dw / aspect }
  }
  const drag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!view) return
    const v = view, el = e.currentTarget, sx = e.clientX, sy = e.clientY, x0 = x, y0 = y
    const at = (ev: PointerEvent): [number, number] => [
      v.dw - v.fw > 0.5 ? Math.min(100, Math.max(0, x0 + ((ev.clientX - sx) / (v.dw - v.fw)) * 100)) : 50,
      v.dh - v.fh > 0.5 ? Math.min(100, Math.max(0, y0 + ((ev.clientY - sy) / (v.dh - v.fh)) * 100)) : 50,
    ]
    const move = (ev: PointerEvent) => setStageBgPos(img.id, ...at(ev), false)
    const up = (ev: PointerEvent) => { setStageBgPos(img.id, ...at(ev), true); el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up) }
    el.setPointerCapture(e.pointerId)
    el.addEventListener('pointermove', move); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up)
  }
  return (
    <div className={styles.bgFocus}>
      <span className={styles.bgFocusHint}>보일 부분을 끌어서 맞춰요</span>
      <div ref={box} className={styles.bgFocusBox} style={{ height: FOCUS_H }}>
        <div className={styles.bgFocusImg} style={view ? { width: view.dw, height: view.dh } : undefined} onPointerDown={drag}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={img.src} alt="" draggable={false} onLoad={(e) => setNat([e.currentTarget.naturalWidth, e.currentTarget.naturalHeight])} />
          {view && <div className={styles.bgFocusFrame} style={{ width: view.fw, height: view.fh, left: ((view.dw - view.fw) * x) / 100, top: ((view.dh - view.fh) * y) / 100 }} />}
        </div>
      </div>
    </div>
  )
}

export default function StageBgBody() {
  const s = useShop()
  const bg = useStageBg()
  const file = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const full = bg.images.length >= STAGE_BG_MAX
  const picked = bg.images.find((i) => i.id === bg.sel)

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
            title="그림 삭제" aria-label="그림 삭제" className={styles.bgDel}><IconCloseSmall /></button>
        )}
      </div>
    )
  }

  return (
    <div className={clsx('pb-scroll', styles.partBody)}>
      <div className={styles.bgGrid}>
        <div className={styles.bgCell}>
          <button type="button" onClick={() => { if (!full) file.current?.click() }} aria-disabled={full || undefined} title={full ? `그림은 ${STAGE_BG_MAX}장까지 올릴 수 있어요` : '내 그림을 배경으로 올리기'}
            className={clsx('pb-partchip', styles.bgTile, styles.bgAdd, full && styles.bgAddOff)}>
            <span className={clsx(styles.bgThumb, styles.bgAddThumb)}><IconAdd size={18} /></span>
            <span className={styles.bgName}>{busy ? '올리는 중' : '커스텀 배경'}</span>
          </button>
          <input ref={file} type="file" accept="image/*" hidden onChange={(e) => { upload(e.target.files?.[0]); e.target.value = '' }} />
        </div>
        {FIXED.map((f) => tile(f.id, f.label, f.style, false))}
        {bg.images.map((im, i) => tile(im.id, `내 그림 ${i + 1}`, { backgroundImage: `url("${im.src}")`, backgroundPosition: `${im.x ?? 50}% ${im.y ?? 50}%` }, true))}
      </div>
      {picked && <BgFocus key={picked.id} img={picked} />}
    </div>
  )
}
