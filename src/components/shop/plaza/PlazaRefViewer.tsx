'use client'

// 참고 이미지 보기 — 확대·이동이 되는 칸(2026-09-21 사용자 지시).
// contain 으로 두면 가로·세로가 긴 그림이 작아져 비교가 안 됐다. 그래서
//  · 처음엔 **가로형은 높이를, 세로형은 너비를** 칸에 맞춘다(넘치는 쪽은 잘리고 끌어서 본다).
//  · PC: 휠로 확대·축소(커서 지점 기준), 끌어서 이동. 모바일: 두 손가락으로 확대, 한 손가락으로 이동.
//  · 축소는 그림 전체가 보이는 크기(contain)까지. 두 번 누르거나 '원래대로' 로 처음 상태.
// 원본은 건드리지 않는다(보기만 바꾼다) — 올린 사람이 잘라 놓은 구도에 묶이지 않게.
// 모바일 시트 안이라 세로 스크롤과 싸우지 않도록, 세로로 넘치지 않을 때는 세로 끌기를 시트에 넘긴다(touch-action).

import clsx from 'clsx'
import { useCallback, useEffect, useRef, useState } from 'react'
import styles from './plaza.module.css'

const MAX_ZOOM = 5 // 처음 크기 대비

type View = { z: number; x: number; y: number } // z = 처음 크기 대비 배율, x·y = 칸 중심에서 그림 중심까지(px)

export default function PlazaRefViewer({ src }: { src: string }) {
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
  useEffect(() => { setV({ z: 1, x: 0, y: 0 }) }, [src])

  // 처음 배율: 가로형 → 높이 맞춤, 세로형 → 너비 맞춤. 최소 배율은 전체가 보이는 contain.
  const base = nat && box.w && box.h ? (nat.w >= nat.h ? box.h / nat.h : box.w / nat.w) : 1
  const fit = nat && box.w && box.h ? Math.min(box.w / nat.w, box.h / nat.h) : 1
  const minZ = Math.min(1, fit / base)

  const clamp = useCallback((n: View): View => {
    if (!nat) return n
    const z = Math.max(minZ, Math.min(MAX_ZOOM, n.z))
    const dw = nat.w * base * z, dh = nat.h * base * z
    const mx = Math.max(0, (dw - box.w) / 2), my = Math.max(0, (dh - box.h) / 2)
    return { z, x: Math.max(-mx, Math.min(mx, n.x)), y: Math.max(-my, Math.min(my, n.y)) }
  }, [nat, base, minZ, box.w, box.h])

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
  const reset = () => setV({ z: 1, x: 0, y: 0 })

  const scale = base * v.z
  const dw = nat ? nat.w * scale : 0, dh = nat ? nat.h * scale : 0
  const overX = dw > box.w + 0.5, overY = dh > box.h + 0.5
  const moved = Math.abs(v.z - 1) > 0.001 || Math.abs(v.x) > 0.5 || Math.abs(v.y) > 0.5

  return (
    <div ref={boxRef}
      className={clsx(styles.refView, (overX || overY) && styles.refViewPan, drag && styles.refViewDrag)}
      // 세로로 넘치면 세로 끌기도 그림이 가져간다. 아니면 세로 끌기는 시트 스크롤로 보낸다.
      style={{ touchAction: overY ? 'none' : 'pan-y' }}
      onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
      onDoubleClick={reset} title="휠·두 손가락으로 확대, 끌어서 이동 · 두 번 누르면 원래대로">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="참조 이미지" draggable={false}
        onLoad={(e) => setNat({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
        className={styles.refViewImg}
        style={nat ? { width: dw, height: dh, transform: `translate(calc(-50% + ${v.x}px), calc(-50% + ${v.y}px))` } : { opacity: 0 }} />
      <button type="button" onClick={reset} onPointerDown={(e) => e.stopPropagation()} aria-label="원래 크기로" title="원래 크기로"
        className={clsx(styles.refReset, moved && styles.refResetOn)}>원래대로</button>
    </div>
  )
}
