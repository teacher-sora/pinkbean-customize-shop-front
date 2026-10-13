'use client'

// 배경 장면이 들어갈 자리. 세 겹이다:
//   ① 지금 시각의 바탕색(하늘빛) ② 움직이지 않는 그림(<img>, next/image) ③ WebGL 장면(scene/sceneGl → 워커의 sceneCore)
// ②까지는 WebGL 없이 뜨고 **늘 깔려 있다** — GPU 가 없거나 장면을 못 띄워도, 띄웠다가 잃어도 배경이 보인다.
// ③은 화면이 뜨자마자 시작한다 — 워커에서 돌아 첫 화면 로딩과 조작을 막지 않는다. ③은 ②와 같은 주소의 그림을 쓴다(한 번만 받는다).
// WebGL 을 아예 못 쓰는 기기에서는 구름을 ②에 그림으로 놓고, 열기구 · 헬리콥터 · 걷는 이는 장면 없이 움직인다(SceneMovers).
// '동작 줄이기'에서는 그들도 움직이지 않는 그림으로 놓는다.
// ②의 그림은 화면이 뜬 뒤에 넣는다: 서버는 화면 폭을 몰라, 미리 넣으면 배경을 안 쓰는 모바일도 받는다.

import clsx from 'clsx'
import Image from 'next/image'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { getStageFloor, onStageFloor } from '@/lib/stageFloor'
import { ROOM, STREET } from './sceneData'
import { mountScene } from './sceneGl'
import SceneMovers from './SceneMovers'
import { moverRows, SCENE_SRC, STILL, stillSprites, type MoverRow, type StillSprite } from './sceneSrc'
import { onSkyChange, sceneFallback, sceneVeil } from './skyTime'
import styles from './scene.module.css'

// 아틀라스(구름 · 뒤 열기구 · 헬리콥터는 street-back, 나머지는 street-air)에서 한 조각을 잘라 장면과 같은 자리에 놓는다.
function Sprite({ s }: { s: StillSprite }) {
  const [aw, ah] = s.back ? STREET.back : STREET.atlas, k = s.scale
  return (
    <div className={styles.still} style={{
      left: `calc(50% + ${s.x - STREET.w / 2}px)`, bottom: `${STREET.h - (s.y + s.h * k)}px`, width: s.w * k, height: s.h * k,
      backgroundImage: `url("${SCENE_SRC.sky[s.back ? 5 : 0]}")`, backgroundPosition: `${-s.ax * k}px ${-s.ay * k}px`, backgroundSize: `${aw * k}px ${ah * k}px`,
      transform: s.flip ? 'scaleX(-1)' : undefined,
    }} />
  )
}

export default function SceneCanvas({ kind, className }: { kind: 'sky' | 'room'; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const veil = useRef<HTMLDivElement>(null)
  const lone = useRef(false)                                      // 앱 배경인데 WebGL 을 못 쓴다
  const repaint = useRef<() => void>()
  const tooSlow = useRef(false)                                   // 움직여 보니 화면이 밀린다 → 이 화면에서는 다시 움직이지 않는다
  const [ready, setReady] = useState(false)                       // 화면이 떴다 → 그림을 넣는다
  const [sprites, setSprites] = useState<StillSprite[] | null>(null)   // WebGL 을 못 쓴다 → 구름(과, 움직이지 않을 때는 지나가는 것들)을 그림으로 놓는다
  const [movers, setMovers] = useState<{ rows: MoverRow[]; first: number } | null>(null)   // WebGL 을 못 쓴다 → 지나가는 것들을 장면 없이 움직인다
  useEffect(() => {
    const host = ref.current
    if (!host) return
    setReady(true)
    // WebGL 을 못 쓰는 앱 배경(lone)은 막을 고정 짙기로 두고 '배경 보기'에서 걷는다(CSS 의 .mask) — 그때는 바탕색도 막을 섞지 않은 색으로 칠한다
    const paint = () => {
      host.style.background = sceneFallback(kind, lone.current)
      if (veil.current) veil.current.style.opacity = lone.current ? '' : String(sceneVeil(kind))
    }
    repaint.current = paint
    paint()
    const iv = window.setInterval(paint, 120000)
    const off = onSkyChange(paint)
    let dead = false
    const calm = window.matchMedia('(prefers-reduced-motion: reduce)')
    const place = () => {
      const moving = !calm.matches && !tooSlow.current, rows = moving ? moverRows() : []
      setSprites(stillSprites(host.clientWidth || window.innerWidth, moving))
      setMovers(moving ? { rows, first: Math.floor(Math.random() * rows.filter((r) => r.type === 2).length) } : null)
    }
    const onCalm = () => { if (lone.current) place() }
    calm.addEventListener?.('change', onCalm)
    const noGl = () => { if (dead || kind !== 'sky') return; lone.current = true; repaint.current?.(); place() }
    // 한 프레임 뒤에 붙인다: 첫 렌더는 화면 폭을 모르고 PC 로 그려졌다가 곧바로 고쳐지므로(useBreakpoint), 바로 붙이면
    // 모바일에서도 안 보이는 앱 배경이 잠깐 붙어 그림을 받기 시작한다. 가려진 탭에서는 보일 때까지 시작하지 않는다.
    let unmount: (() => void) | undefined
    const raf = requestAnimationFrame(() => { unmount = mountScene(kind, host, noGl) })
    return () => {
      dead = true
      window.clearInterval(iv); off()
      calm.removeEventListener?.('change', onCalm)
      cancelAnimationFrame(raf)
      unmount?.()
    }
  }, [kind])
  useEffect(() => { repaint.current?.() }, [ready, kind])
  // 느린 기기 보호(장면의 watchPace 와 같은 기준): 움직이기 시작하고 5초 뒤부터 화면이 그려지는 간격을 재서, 90프레임 가운데 절반 넘게
  // 28ms 를 넘기는 일이 두 번 이어지면 멈춘 그림으로 바꾼다(덜컥거리는 것보다 멈춘 쪽이 낫다). 한번 멈추면 그 화면에서는 다시 움직이지 않는다.
  // 1분쯤 부드러웠으면 그만 잰다(재는 동안에만 프레임마다 코드가 돈다).
  useEffect(() => {
    if (!movers) return
    const t0 = performance.now()
    let raf = 0, last = 0, n = 0, bad = 0, badRuns = 0, okRuns = 0
    const tick = (t: number) => {
      const dt = t - last
      last = t
      if (t - t0 > 5000 && dt > 0 && dt < 250 && document.visibilityState === 'visible') { n++; if (dt > 28) bad++ }
      if (n >= 90) { if (bad > 45) { badRuns++; okRuns = 0 } else { okRuns++; badRuns = 0 } n = bad = 0 }
      if (badRuns >= 2) {
        tooSlow.current = true
        setMovers(null)
        setSprites(stillSprites(ref.current?.clientWidth || window.innerWidth, false))
        return
      }
      if (okRuns < 40) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [movers])
  const at = (layer: number) => sprites?.filter((s) => s.layer === layer).map((s) => <Sprite key={s.key} s={s} />)
  const mv = (layer: 0 | 1 | 2) => movers && <SceneMovers rows={movers.rows} layer={layer} first={movers.first} />
  // 무대의 그림은 캐릭터가 서는 자리와 배율(미리보기 배율 설정)에 맞춰 놓는다 — 장면(sceneGl 의 layout)과 같은 계산.
  // 그래야 처음 깔리는 그림과 그 위로 나타나는 장면의 크기 · 자리가 같다. 칸을 그대로 키운다(장면도 정수 배율에서는 그렇게 그린다).
  useLayoutEffect(() => {
    const host = ref.current
    if (!host || !ready || kind !== 'room') return
    const place = () => {
      const f = getStageFloor(), dpr = window.devicePixelRatio || 1
      let px: number, fx: number, fy: number
      if (f && f.wrap.isConnected && host.parentElement?.contains(f.wrap)) {
        const wr = f.wrap.getBoundingClientRect(), hr = host.getBoundingClientRect()
        px = f.scale; fx = Math.round((wr.left - hr.left + f.cx) * dpr); fy = Math.round((wr.top - hr.top + f.footY) * dpr)
      } else { px = Math.max(1, Math.round(dpr)); fx = Math.round((host.clientWidth / 2) * dpr); fy = Math.round((host.clientHeight / 2 + 38.4) * dpr) }
      host.querySelectorAll<HTMLImageElement>('img[data-scene]').forEach((el) => {
        el.style.width = `${(ROOM.w * px) / dpr}px`; el.style.height = `${(ROOM.h * px) / dpr}px`
        el.style.left = `${(fx - ROOM.foot[0] * px) / dpr}px`; el.style.top = `${(fy - ROOM.foot[1] * px) / dpr}px`
        el.style.imageRendering = Number.isInteger(px) ? 'pixelated' : ''
      })
    }
    place()
    const off = onStageFloor(place)
    const ro = new ResizeObserver(place)
    ro.observe(host)
    return () => { off(); ro.disconnect() }
  }, [ready, kind])
  // 원래 크기 그대로(1칸 = 1px) 깐다 — 줄이거나 다시 압축하면 장면과 어긋나고 선이 뭉개진다
  const img = (i: number) => {
    const l = STILL[kind].find((x) => x.i === i)!
    return <Image key={i} data-scene={i} src={SCENE_SRC[kind][i]} alt="" width={l.w} height={l.h} unoptimized loading="eager" fetchPriority="low" draggable={false} className={styles.still} style={l.style} />
  }
  return (
    <div ref={ref} aria-hidden className={clsx(styles.host, className)}>
      {ready && (kind === 'sky' ? (
        // 쌓는 순서는 장면과 같다: 구름 · 열기구 · 헬리콥터 → 먼 빌딩 → 탑 → 이벤트 열기구 → 거리 → 걷는 이
        <>{at(0)}{mv(0)}{img(1)}{img(4)}{at(1)}{mv(1)}{img(2)}{at(2)}</>
      ) : STILL.room.map((l) => img(l.i)))}
      {ready && <div ref={veil} className={clsx(styles.veil, sprites && styles.mask)} />}
      {/* 걷는 이들은 막 위에 둔다 — 장면에서도 어두운 막을 씌우지 않는다 */}
      {ready && kind === 'sky' && mv(2)}
    </div>
  )
}
