'use client'

// 배경 장면이 들어갈 자리. 세 겹이다:
//   ① 지금 시각의 바탕색(하늘빛) ② 움직이지 않는 그림(<img>, next/image) ③ WebGL 장면(scene/sceneGl)
// ②까지는 WebGL 없이 뜨고 **늘 깔려 있다** — GPU 가 없거나 장면을 못 띄워도, 띄웠다가 잃어도 배경이 보인다(사용자 지시).
// ③은 화면이 한가해지면 따로 받아 그 위에 띄운다(첫 화면 로딩과 조작을 막지 않는다). ③은 ②의 <img> 를 텍스처로 쓴다(한 번만 받는다).
// WebGL 을 아예 못 쓰는 기기에서는 지나가는 것들(구름 · 열기구 · 헬리콥터 · 걷는 이)도 ②에 움직이지 않는 그림으로 놓는다.
// ②의 그림은 화면이 뜬 뒤에 넣는다: 서버는 화면 폭을 몰라, 미리 넣으면 배경을 안 쓰는 모바일도 받는다.

import clsx from 'clsx'
import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import { STREET } from './sceneData'
import { SCENE_SRC, STILL, stillSprites, type StillSprite } from './sceneSrc'
import { onSkyChange, sceneFallback, sceneVeil } from './skyTime'
import styles from './scene.module.css'

type Idle = Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void }

// 아틀라스(구름은 street-cloud, 나머지는 street-air)에서 한 조각을 잘라 장면과 같은 자리에 놓는다.
function Sprite({ s }: { s: StillSprite }) {
  const [aw, ah] = s.cloud ? STREET.cloud : STREET.atlas, k = s.scale
  return (
    <div className={styles.still} style={{
      left: `calc(50% + ${s.x - STREET.w / 2}px)`, bottom: `${STREET.h - (s.y + s.h * k)}px`, width: s.w * k, height: s.h * k,
      backgroundImage: `url("${SCENE_SRC.sky[s.cloud ? 5 : 0]}")`, backgroundPosition: `${-s.ax * k}px ${-s.ay * k}px`, backgroundSize: `${aw * k}px ${ah * k}px`,
      transform: s.flip ? 'scaleX(-1)' : undefined,
    }} />
  )
}

export default function SceneCanvas({ kind, className }: { kind: 'sky' | 'room'; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const veil = useRef<HTMLDivElement>(null)
  const [ready, setReady] = useState(false)                       // 화면이 떴다 → 그림을 넣는다
  const [sprites, setSprites] = useState<StillSprite[] | null>(null)   // WebGL 을 못 쓴다 → 지나가는 것들을 그림으로 놓는다
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
    const noGl = () => { if (!dead && kind === 'sky') setSprites(stillSprites(host.clientWidth || window.innerWidth)) }
    const start = () => {
      import('./sceneGl').then((m) => { if (dead) return; unmount = m.mountScene(kind, host); if (m.sceneFailed(kind)) noGl() }).catch(noGl)
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
  const at = (layer: number) => sprites?.filter((s) => s.layer === layer).map((s) => <Sprite key={s.key} s={s} />)
  // 원래 크기 그대로(1칸 = 1px) 깐다 — 줄이거나 다시 압축하면 장면과 어긋나고 선이 뭉개진다
  const img = (i: number) => {
    const l = STILL[kind].find((x) => x.i === i)!
    return <Image key={i} data-scene={i} src={SCENE_SRC[kind][i]} alt="" width={l.w} height={l.h} unoptimized loading="eager" fetchPriority="low" draggable={false} className={styles.still} style={l.style} />
  }
  // 장면만 쓰는 그림(아틀라스 · 빛 지도 · 구름)도 여기서 함께 받기 시작한다 — 장면 코드가 도착할 때까지 기다렸다 받으면 그만큼 늦게 뜬다.
  // 화면에는 안 보이고, 장면이 이 <img> 를 텍스처로 쓴다(WebGL 을 못 쓰면 아래의 조각 그림이 같은 파일을 쓴다) → 한 번만 받는다.
  const early = (i: number, [w, h]: number[]) => <Image key={'e' + i} data-scene={i} src={SCENE_SRC.sky[i]} alt="" width={w} height={h} unoptimized loading="eager" fetchPriority="low" style={{ display: 'none' }} />
  return (
    <div ref={ref} aria-hidden className={clsx(styles.host, className)}>
      {ready && (kind === 'sky' ? (
        // 쌓는 순서는 장면과 같다: 구름 · 열기구 · 헬리콥터 → 먼 빌딩 → 탑 → 이벤트 열기구 → 거리 → 걷는 이
        <>{at(0)}{img(1)}{img(4)}{at(1)}{img(2)}{at(2)}{early(5, STREET.cloud)}{early(0, STREET.atlas)}{early(3, [STREET.w / 2, STREET.main.h / 2])}</>
      ) : STILL.room.map((l) => img(l.i)))}
      {ready && <div ref={veil} className={styles.veil} />}
    </div>
  )
}
