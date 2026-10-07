'use client'

// 배경 장면이 들어갈 자리. 세 겹이다:
//   ① 지금 시각의 바탕색(하늘빛) ② 움직이지 않는 그림(<img>, public/scene) ③ WebGL 장면(scene/sceneGl)
// ②까지는 WebGL 없이 뜬다 — GPU 가 없거나 장면을 못 띄워도 배경이 보인다(사용자 지시). ③은 화면이 한가해지면 따로 받아
// 그 위에 띄운다(첫 화면 로딩과 조작을 막지 않는다). ③이 뜨면 ②는 걷어 낸다(같은 그림을 두 번 쥐고 있지 않게).
// ②의 그림은 화면이 뜬 뒤에 넣는다: 서버는 화면 폭을 몰라, 미리 넣으면 배경을 안 쓰는 모바일도 받는다.

import clsx from 'clsx'
import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import { SCENE_SRC, STILL } from './sceneSrc'
import { onSkyChange, sceneFallback, sceneVeil } from './skyTime'
import styles from './scene.module.css'

type Idle = Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void }

export default function SceneCanvas({ kind, className }: { kind: 'sky' | 'room'; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const veil = useRef<HTMLDivElement>(null)
  const [ready, setReady] = useState(false)   // 화면이 떴다 → 그림을 넣는다
  const [live, setLive] = useState(false)     // WebGL 장면이 떠 있다 → 그림을 걷는다
  useEffect(() => {
    const host = ref.current
    if (!host) return
    setReady(true)
    const paint = () => { host.style.background = sceneFallback(kind); if (veil.current) veil.current.style.opacity = String(sceneVeil(kind)) }
    paint()
    const iv = window.setInterval(paint, 120000)
    const off = onSkyChange(paint)
    let dead = false
    let unmount: (() => void) | undefined
    const start = () => { import('./sceneGl').then((m) => { if (!dead) unmount = m.mountScene(kind, host, (on) => { if (!dead) setLive(on) }) }).catch(() => {}) }
    const w = window as Idle
    const id = w.requestIdleCallback ? w.requestIdleCallback(start, { timeout: 2000 }) : window.setTimeout(start, 300)
    return () => {
      dead = true
      window.clearInterval(iv); off()
      if (w.cancelIdleCallback) w.cancelIdleCallback(id); else window.clearTimeout(id)
      unmount?.()
    }
  }, [kind])
  useEffect(() => { if (veil.current) veil.current.style.opacity = String(sceneVeil(kind)) }, [ready, live, kind])
  return (
    <div ref={ref} aria-hidden className={clsx(styles.host, className)}>
      {ready && !live && (
        <>
          {STILL[kind].map((l) => (
            // 원래 크기 그대로(1칸 = 1px) 깐다 — 줄이거나 다시 압축하면 장면과 어긋나고 선이 뭉개진다
            <Image key={l.i} data-scene={l.i} src={SCENE_SRC[kind][l.i]} alt="" width={l.w} height={l.h} unoptimized loading="eager" fetchPriority="low" draggable={false} className={styles.still} style={l.style} />
          ))}
          <div ref={veil} className={styles.veil} />
        </>
      )}
    </div>
  )
}
