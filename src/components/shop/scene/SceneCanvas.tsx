'use client'

// 배경 장면이 들어갈 자리. 처음에는 지금 시각의 바탕색만 깔고, 화면이 한가해지면 WebGL 장면(scene/sceneGl)을
// 따로 받아 그 위에 띄운다 — 첫 화면 로딩과 조작을 막지 않는다. WebGL 을 못 쓰는 기기는 바탕색으로 남는다.

import clsx from 'clsx'
import { useEffect, useRef } from 'react'
import { sceneFallback } from './skyTime'
import styles from './scene.module.css'

type Idle = Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void }

export default function SceneCanvas({ kind, className }: { kind: 'sky' | 'room'; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const host = ref.current
    if (!host) return
    const paint = () => { host.style.background = sceneFallback(kind) }
    paint()
    const iv = window.setInterval(paint, 120000)
    let dead = false
    let unmount: (() => void) | undefined
    const start = () => { import('./sceneGl').then((m) => { if (!dead) unmount = m.mountScene(kind, host) }).catch(() => {}) }
    const w = window as Idle
    const id = w.requestIdleCallback ? w.requestIdleCallback(start, { timeout: 2000 }) : window.setTimeout(start, 300)
    return () => {
      dead = true
      window.clearInterval(iv)
      if (w.cancelIdleCallback) w.cancelIdleCallback(id); else window.clearTimeout(id)
      unmount?.()
    }
  }, [kind])
  return <div ref={ref} aria-hidden className={clsx(styles.host, className)} />
}
