'use client'

// 참고 이미지 보기 · 첫 화면 고르기 — 확대·이동이 되는 칸(2026-09-21 사용자 지시).
//  · 보기(상세): 올린 사람이 고른 **첫 화면(initial)** 에서 시작한다. 없으면 가로형은 높이, 세로형은 너비에 맞춘다.
//    PC 는 휠로 확대·축소(커서 지점 기준), 끌어서 이동 / 모바일은 두 손가락 확대, 한 손가락 이동.
//    축소는 그림 전체가 보이는 크기(contain)까지. 두 번 누르거나 '원래대로' 로 첫 화면에 돌아간다.
//  · 편집(등록 폼, edit): 같은 조작으로 첫 화면을 고른다. 칸 가운데의 **정사각형 점선**이 상세에서 처음 보일 범위다.
//    상세의 참고 이미지 칸은 PC·모바일 모두 정사각형이라 이 범위가 그대로 보인다(2026-09-21 사용자 지시).
//    점선 안은 항상 그림으로 채워진다(그보다 작게 줄이거나 밖으로 밀 수 없다).
//    원본은 자르지 않는다 — 고른 건 '처음 보일 자리'일 뿐, 보는 사람은 여전히 확대·이동할 수 있다.
// 첫 화면은 칸 크기와 무관한 값(RefView: 칸 가운데에 올 그림 위 점 + 정사각형 cover 대비 배율)으로 저장한다.

import clsx from 'clsx'
import Image from 'next/image'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { RefView } from '@/lib/plaza'
import styles from './plaza.module.css'

const MAX_ZOOM = 5 // 기본 배율 대비
const GUIDE_FRAC = 0.72 // 편집기 점선 정사각형 = 칸 짧은 변의 이 비율

type View = { z: number; x: number; y: number } // z = 기본 배율 대비, x·y = 칸 중심에서 그림 중심까지(px)

export default function PlazaRefViewer({ src, initial, edit, onChange }: {
  src: string; initial?: RefView | null; edit?: boolean; onChange?: (v: RefView) => void
}) {
  const boxRef = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState({ w: 0, h: 0 })
  const [nat, setNat] = useState<{ w: number; h: number } | null>(null)
  const [v, setV] = useState<View>({ z: 1, x: 0, y: 0 })

  useEffect(() => {
    const el = boxRef.current
    if (!el) return
    const m = () => setBox({ w: el.clientWidth, h: el.clientHeight })
    m()
    const ro = new ResizeObserver(m); ro.observe(el)
    return () => ro.disconnect()
  }, [])
  useEffect(() => { setNat(null) }, [src])

  const ready = !!nat && box.w > 0 && box.h > 0
  // 편집: 기준 틀 = 점선 정사각형(G). 기본 배율 = 틀을 꽉 채우는 배율이고, 그보다 줄이지 않는다.
  // 보기: 기준 틀 = 칸. 기본 배율은 가로형 → 높이 맞춤, 세로형 → 너비 맞춤. cover = 칸을 꽉 채우는 배율, fit = 전체가 보이는 배율.
  const G = edit ? Math.round(Math.min(box.w, box.h) * GUIDE_FRAC) : 0
  const frame = edit ? { w: G, h: G } : box
  const cover = ready ? Math.max(frame.w / nat!.w, frame.h / nat!.h) : 1
  const base = !ready ? 1 : edit ? cover : (nat!.w >= nat!.h ? box.h / nat!.h : box.w / nat!.w)
  const fit = ready ? Math.min(box.w / nat!.w, box.h / nat!.h) : 1
  const minZ = edit ? 1 : Math.min(1, fit / base)

  const clamp = useCallback((n: View): View => {
    if (!nat) return n
    const z = Math.max(minZ, Math.min(MAX_ZOOM, n.z))
    const dw = nat.w * base * z, dh = nat.h * base * z
    const mx = Math.max(0, (dw - frame.w) / 2), my = Math.max(0, (dh - frame.h) / 2)
    return { z, x: Math.max(-mx, Math.min(mx, n.x)), y: Math.max(-my, Math.min(my, n.y)) }
  }, [nat, base, minZ, frame.w, frame.h])

  // RefView ↔ View
  const toView = useCallback((r: RefView | null | undefined): View => {
    if (!r || !nat) return { z: 1, x: 0, y: 0 }
    const scale = cover * r.zc
    return clamp({ z: scale / base, x: (0.5 - r.fx) * nat.w * scale, y: (0.5 - r.fy) * nat.h * scale })
  }, [nat, cover, base, clamp])
  const fromView = (n: View): RefView | null => {
    if (!nat) return null
    const scale = base * n.z
    return { fx: 0.5 - n.x / (nat.w * scale), fy: 0.5 - n.y / (nat.h * scale), zc: scale / cover }
  }
  // 첫 화면: 보기는 올린 사람이 고른 자리, 편집은 기본 배율(가로형 높이 맞춤 · 세로형 너비 맞춤).
  const home = useCallback((): View => (edit ? { z: 1, x: 0, y: 0 } : toView(initial)), [edit, initial, toView])

  // 그림·칸 크기가 정해지면 첫 화면으로. 보기 모드는 칸 크기가 바뀌어도 첫 화면 기준으로 다시 맞추고,
  // 편집 모드는 고르던 자리를 유지한다(창 크기를 바꿨다고 조정한 게 날아가지 않게).
  const placed = useRef('')
  useEffect(() => {
    if (!ready) return
    const key = `${src}|${box.w}x${box.h}`
    if (placed.current === key) return
    const first = !placed.current.startsWith(src + '|')
    placed.current = key
    if (first) setV(edit ? toView(initial) : home())
    else if (edit) setV((cur) => clamp(cur))
    else setV(home())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, src, box.w, box.h])

  // 편집 모드: 고른 첫 화면을 바깥으로 알린다.
  useEffect(() => {
    if (!edit || !ready || !onChange) return
    const r = fromView(v)
    if (r) onChange(r)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [edit, ready, v.z, v.x, v.y])

  // 한 점(칸 중심 기준 px)을 고정한 채 배율을 바꾼다.
  const zoomAt = useCallback((cur: View, nz: number, px: number, py: number): View => {
    const z = Math.max(minZ, Math.min(MAX_ZOOM, nz))
    const k = z / cur.z
    return clamp({ z, x: px - (px - cur.x) * k, y: py - (py - cur.y) * k })
  }, [clamp, minZ])

  // 휠: passive 가 아니어야 페이지 스크롤을 막을 수 있어 직접 붙인다.
  useEffect(() => {
    const el = boxRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const r = el.getBoundingClientRect()
      const px = e.clientX - r.left - r.width / 2, py = e.clientY - r.top - r.height / 2
      setV((cur) => zoomAt(cur, cur.z * Math.exp(-e.deltaY * 0.0015), px, py))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [zoomAt])

  // 포인터: 한 개 = 이동, 두 개 = 확대(두 손가락 사이 중점 고정).
  const pts = useRef(new Map<number, { x: number; y: number }>())
  const pinch = useRef<{ d: number; z: number } | null>(null)
  const [drag, setDrag] = useState(false)
  const local = (e: React.PointerEvent) => {
    const r = boxRef.current!.getBoundingClientRect()
    return { x: e.clientX - r.left - r.width / 2, y: e.clientY - r.top - r.height / 2 }
  }
  const onDown = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    e.currentTarget.setPointerCapture(e.pointerId)
    pts.current.set(e.pointerId, local(e))
    if (pts.current.size === 2) {
      const [a, b] = [...pts.current.values()]
      pinch.current = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, z: v.z }
    }
    setDrag(true)
  }
  const onMove = (e: React.PointerEvent) => {
    const prev = pts.current.get(e.pointerId)
    if (!prev) return
    const p = local(e)
    pts.current.set(e.pointerId, p)
    if (pts.current.size >= 2 && pinch.current) {
      const [a, b] = [...pts.current.values()]
      const d = Math.hypot(a.x - b.x, a.y - b.y) || 1
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
      const { z: pz, d: d0 } = pinch.current
      setV((cur) => zoomAt(cur, pz * (d / d0), mid.x, mid.y))
      return
    }
    setV((cur) => clamp({ ...cur, x: cur.x + p.x - prev.x, y: cur.y + p.y - prev.y }))
  }
  const onUp = (e: React.PointerEvent) => {
    pts.current.delete(e.pointerId)
    if (pts.current.size < 2) pinch.current = null
    if (pts.current.size === 0) setDrag(false)
  }
  const reset = () => setV(home())

  const scale = base * v.z
  const dw = nat ? nat.w * scale : 0, dh = nat ? nat.h * scale : 0
  const overX = dw > box.w + 0.5, overY = dh > box.h + 0.5
  const h0 = home()
  const moved = ready && (Math.abs(v.z - h0.z) > 0.001 || Math.abs(v.x - h0.x) > 0.5 || Math.abs(v.y - h0.y) > 0.5)

  const guide = edit && ready ? G : 0

  return (
    <div ref={boxRef}
      className={clsx(styles.refView, (overX || overY || edit) && styles.refViewPan, drag && styles.refViewDrag)}
      // 편집기는 모든 끌기를 가져간다. 보기에서는 세로로 넘치지 않으면 세로 끌기를 시트 스크롤로 보낸다.
      style={{ touchAction: edit || overY ? 'none' : 'pan-y' }}
      onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
      onDoubleClick={reset}
      title={edit ? '끌어서 옮기고, 휠·두 손가락으로 확대해요' : '휠·두 손가락으로 확대, 끌어서 이동 · 두 번 누르면 처음 화면'}>
      {/* next/image 로 보낸다(보기) — 원본 대신 지금 크기에 맞는 WebP/AVIF. 확대하면 sizes 가 커져 더 큰 그림으로 바꿔 받는다
          (256px 단위로 올려 휠 한 칸마다 새로 받지 않게). 편집기는 아직 올리지 않은 로컬 파일(blob:)이라 그대로 쓴다.
          배율 계산은 가로세로 비만 쓰므로, 줄인 그림의 크기(naturalWidth)로 재도 결과가 같다. */}
      <div className={styles.refViewImg}
        style={ready ? { width: dw, height: dh, transform: `translate(calc(-50% + ${v.x}px), calc(-50% + ${v.y}px))` } : { width: box.w, height: box.h, opacity: 0, transform: 'translate(-50%, -50%)' }}>
        <Image src={src} alt="참조 이미지" draggable={false} fill priority unoptimized={!!edit} quality={85}
          sizes={`${Math.max(256, Math.ceil((ready ? Math.max(dw, dh) : Math.max(box.w, box.h)) / 256) * 256)}px`}
          onLoad={(e) => {
            // 확대로 더 큰 그림이 새로 들어와도 비가 같으면 그대로 둔다(nat 이 바뀌면 보던 자리가 처음으로 돌아간다).
            const im = e.currentTarget, w = im.naturalWidth, h = im.naturalHeight
            if (w) setNat((n) => (n && Math.abs(n.w / n.h - w / h) < 0.01 ? n : { w, h }))
          }}
          style={{ objectFit: 'fill' }} />
      </div>
      {guide > 0 && <div className={styles.refGuide} style={{ width: guide, height: guide }} aria-hidden />}
      <button type="button" onClick={reset} onPointerDown={(e) => e.stopPropagation()} aria-label="처음 화면으로" title="처음 화면으로"
        className={clsx(styles.refReset, moved && styles.refResetOn)}>원래대로</button>
    </div>
  )
}
