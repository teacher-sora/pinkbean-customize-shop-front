'use client'

// 배경 장면이 들어갈 자리. 세 겹이다:
//   ① 지금 시각의 바탕색(하늘빛) ② 움직이지 않는 그림(<img>, next/image) ③ WebGL 장면(scene/sceneGl)
// ②까지는 WebGL 없이 뜨고 **늘 깔려 있다** — GPU 가 없거나 장면을 못 띄워도, 띄웠다가 잃어도 배경이 보인다(사용자 지시).
// ③은 화면이 한가해지면 따로 받아 그 위에 띄운다(첫 화면 로딩과 조작을 막지 않는다). ③은 ②의 <img> 를 텍스처로 쓴다(한 번만 받는다).
// WebGL 을 아예 못 쓰는 기기에서는 지나가는 것들(구름 · 열기구 · 헬리콥터 · 걷는 이)을 놓아 둔 폴백 그림 한 장(assets/background)을 ② 위에 얹는다.
// ②의 그림은 화면이 뜬 뒤에 넣는다: 서버는 화면 폭을 몰라, 미리 넣으면 배경을 안 쓰는 모바일도 받는다.

import clsx from 'clsx'
import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import { STREET } from './sceneData'
import { SCENE_SRC, STILL, STILL_OVER } from './sceneSrc'
import { onSkyChange, sceneFallback, sceneVeil } from './skyTime'
import styles from './scene.module.css'

type Idle = Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void }

export default function SceneCanvas({ kind, className }: { kind: 'sky' | 'room'; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const veil = useRef<HTMLDivElement>(null)
  const [ready, setReady] = useState(false)                       // 화면이 떴다 → 그림을 넣는다
  const [noGl, setNoGl] = useState(false)                         // WebGL 을 못 쓴다 → 폴백 그림을 얹는다
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
    const fail = () => { if (!dead && kind === 'sky') setNoGl(true) }
    const start = () => {
      import('./sceneGl').then((m) => { if (dead) return; unmount = m.mountScene(kind, host); if (m.sceneFailed(kind)) fail() }).catch(fail)
    }
    const w = window as Idle
    const id = w.requestIdleCallback ? w.requestIdleCallback(start, { timeout: 2000 }) : window.setTimeout(start, 300)
    return () => {
      dead = true
      window.clearInterval(iv); off()
      if (w.cancelIdleCallback) w.cancelIdleCallback(id); else window.clearTimeout(id)
      unmount?.()
    }
  }, [kind])
  useEffect(() => { if (veil.current) veil.current.style.opacity = String(sceneVeil(kind)) }, [ready, kind])
  // 원래 크기 그대로(1칸 = 1px) 깐다 — 줄이거나 다시 압축하면 장면과 어긋나고 선이 뭉개진다
  const img = (i: number) => {
    const l = STILL[kind].find((x) => x.i === i)!
    return <Image key={i} data-scene={i} src={SCENE_SRC[kind][i]} alt="" width={l.w} height={l.h} unoptimized loading="eager" fetchPriority="low" draggable={false} className={styles.still} style={l.style} />
  }
  // 장면만 쓰는 그림(아틀라스 · 빛 지도 · 구름)도 여기서 함께 받기 시작한다 — 장면 코드가 도착할 때까지 기다렸다 받으면 그만큼 늦게 뜬다.
  // 화면에는 안 보이고, 장면이 이 <img> 를 텍스처로 쓴다 → 한 번만 받는다.
  const early = (i: number, [w, h]: number[]) => <Image key={'e' + i} data-scene={i} src={SCENE_SRC.sky[i]} alt="" width={w} height={h} unoptimized loading="eager" fetchPriority="low" style={{ display: 'none' }} />
  return (
    <div ref={ref} aria-hidden className={clsx(styles.host, className)}>
      {ready && (kind === 'sky' ? (
        // 쌓는 순서는 장면과 같다: 먼 빌딩 → 탑 → 거리. 폴백 그림은 가려질 부분이 지워져 있어 맨 위에 얹는다
        <>{img(1)}{img(4)}{img(2)}
          {noGl && <Image src={STILL_OVER} alt="" width={STREET.w} height={STREET.h} unoptimized loading="eager" draggable={false} className={styles.still} style={{ left: `calc(50% - ${STREET.w / 2}px)`, bottom: '0px' }} />}
          {early(5, STREET.back)}{early(0, STREET.atlas)}{early(3, [STREET.w / 2, STREET.main.h / 2])}</>
      ) : STILL.room.map((l) => img(l.i)))}
      {ready && <div ref={veil} className={styles.veil} />}
    </div>
  )
}
