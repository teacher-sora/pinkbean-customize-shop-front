'use client'

// WebGL 없이 지나가는 것들(열기구 · 헬리콥터 · 걷는 이)을 움직인다. 장면(sceneCore)을 못 띄우는 기기의 앱 배경에서만 쓴다(SceneCanvas).
//  · 그림 한 장 = 요소 하나. 아틀라스에서 잘라 배경으로 깔고, **자리는 transform 애니메이션(Web Animations)으로만** 옮긴다 —
//    한 번 지나가는 길이 애니메이션 하나라서 프레임마다 도는 코드가 없다(브라우저가 알아서 옮긴다. rAF 도 타이머도 돌지 않는다).
//    코드가 도는 때는 지나가기를 시작할 때 · 멈춰 설 때 · 화면에서 사라졌을 때뿐이다.
//  · 움직임의 규칙은 장면과 같다(sceneMath 의 MOVE · PAUSE): 화면 한쪽 끝에서 나타나 반대쪽으로 사라지고, 쉬었다가 방향 · 빠르기 ·
//    높이를 새로 뽑아 다시 나타난다. 걷는 이는 둘에 한 번쯤 도중에 멈춰 서고(첫 장), 가는 쪽을 보도록 그림을 뒤집는다.
//  · **한 칸(1px)씩 끊어 옮긴다**(steps). 이 길로 오는 기기는 거의 GPU 가 없어 화면을 CPU 로 합친다 — 매끄럽게 흘리면 움직이는 것들이
//    프레임마다 조금씩 바뀌어, 그들을 모두 감싸는 넓은 자리를 초당 60번 다시 합친다(재 보니 코어 하나의 56%). 한 칸씩 옮기면 바뀌는
//    때가 저마다 달라, 그때 그 그림 자리만 다시 합친다(열기구는 초당 5번쯤, 걷는 이는 30~40번).
//  · 화면의 느린 좌우 흔들림과 구름의 흐름은 하지 않는다 — 큰 그림을 통째로 옮기는 일이라 GPU 없는 기기에서는 프레임마다 다시 칠한다.
//  · 빛(시각에 따른 색 · 열기구의 밤 그림)은 입히지 않는다. 그것은 장면이 하는 일이다.

import { useEffect, useRef } from 'react'
import { STREET } from './sceneData'
import { BOB, MOVE, PAUSE, rnd, walkFps } from './sceneMath'
import { SCENE_SRC, type MoverRow } from './sceneSrc'
import styles from './scene.module.css'

const EDGE = 4   // 화면 끝에서 이만큼 더 나가야 완전히 사라진 것으로 친다(칸)

function bobFrames(amp: number): Keyframe[] {
  const N = 240, out: Keyframe[] = []
  let last = NaN
  for (let i = 0; i <= N; i++) {
    const v = Math.round(Math.sin((i / N) * 6.283) * amp)
    if (v !== last || i === N) { out.push({ offset: i / N, transform: `translateY(${v}px)`, easing: 'step-end' }); last = v }
  }
  return out
}

function run(el: HTMLElement, r: MoverRow, first: boolean): () => void {
  const host = el.offsetParent as HTMLElement | null
  const art = el.querySelector<HTMLElement>('[data-art]'), strip = el.querySelector<HTMLElement>('[data-strip]'), bobEl = el.querySelector<HTMLElement>('[data-bob]')
  if (!host || !art || typeof el.animate !== 'function') return () => {}
  const half = (r.w * r.scale) / 2
  let dead = false, timer = 0, cur: Animation | null = null, walk: Animation | null = null
  // 위아래로 떠는 것도 한 칸씩: 사인 곡선을 따라가다 값이 한 칸 바뀌는 때마다 옮긴다
  const bob = r.type < 2 && bobEl ? bobEl.animate(bobFrames(BOB[r.type].amp), { duration: BOB[r.type].sec * 1000, iterations: Infinity, delay: -r.ph * BOB[r.type].sec * 1000 }) : null
  // 그림 칸 → 화면 픽셀에 딱 맞는 자리(그림은 화면 가운데에 맞춰 있어 화면 폭이 홀수면 반 칸 어긋난다)
  const snap = (x: number) => { const base = host.clientWidth / 2 - STREET.w / 2 - half; return Math.round(base + x) - base }
  // 지금 화면에 보이는 범위(그림 칸). 그림은 화면 아래 가운데에 놓여 있다
  const range = () => { const vw = host.clientWidth; return [Math.max(0, STREET.w / 2 - vw / 2), Math.min(STREET.w, STREET.w / 2 + vw / 2)] }
  const at = (x: number, y: number) => `translate3d(${x - STREET.w / 2}px,${y}px,0)`
  const later = (sec: number, fn: () => void) => { timer = window.setTimeout(() => { if (!dead) fn() }, sec * 1000) }
  const stride = (on: boolean) => {
    if (!strip) return
    walk?.cancel(); walk = null   // 멈추면 첫 장(서 있는 모습)으로 돌아간다
    if (on) walk = strip.animate([{ transform: 'translateX(0)' }, { transform: `translateX(${-r.frames * r.step}px)` }], { duration: (r.frames / walkFps(r.frames)) * 1000, easing: `steps(${r.frames})`, iterations: Infinity })
  }
  const go = (x0: number, x1: number, y: number, speed: number, then: () => void) => {
    cur?.cancel()
    const n = Math.max(1, Math.round(Math.abs(x1 - x0)))
    cur = el.animate([{ transform: at(x0, y) }, { transform: at(x1, y) }], { duration: (n / speed) * 1000, easing: `steps(${n})`, fill: 'forwards' })
    cur.onfinish = () => { if (!dead) then() }
  }
  const rest = () => { el.style.visibility = 'hidden'; cur?.cancel(); cur = null; stride(false); later(rnd(MOVE[r.type].gap), () => pass()) }
  // 한 번 지나간다. from = 처음 놓일 자리(없으면 화면 끝에서 들어온다)
  const pass = (from?: number) => {
    const [left, right] = range(), out = EDGE + half
    const dir = Math.random() < 0.5 ? -1 : 1, speed = rnd(MOVE[r.type].speed) * r.mult
    const y = Math.round((Math.random() * 2 - 1) * MOVE[r.type].jit)
    const x0 = snap(from ?? (dir > 0 ? left - out : right + out)), x1 = snap(dir > 0 ? right + out : left - out)
    art.style.transform = r.face !== 0 && dir !== r.face ? 'scaleX(-1)' : ''   // 가는 쪽을 본다
    el.style.visibility = 'visible'
    stride(true)
    let stop = r.type === 2 && Math.random() < PAUSE.chance ? left + (0.2 + 0.6 * Math.random()) * (right - left) : NaN
    if (!((stop - x0) * (stop - x1) < 0)) { go(x0, x1, y, speed, rest); return }
    stop = snap(stop)
    go(x0, stop, y, speed, () => { stride(false); later(rnd(PAUSE.sec), () => { stride(true); go(stop, x1, y, speed, rest) }) })
  }
  // 처음: 열기구는 하늘에 고루 떠 있고, 헬리콥터 하나도 떠 있다. 걷는 이는 하나가 곧 들어오고 나머지는 사이를 두고 온다(sceneCore 의 initMovers 와 같다)
  const [left, right] = range()
  if (r.type === 0) pass(left + ((r.n + 0.15 + 0.7 * Math.random()) / r.of) * (right - left))
  else if (r.type === 1 && r.n === 0) pass(left + (0.2 + 0.6 * Math.random()) * (right - left))
  else later(r.type === 2 ? (first ? 1 + Math.random() * 3 : 6 + Math.random() * MOVE[2].gap[1] * 1.3) : rnd(MOVE[r.type].gap), () => pass())
  return () => { dead = true; window.clearTimeout(timer); cur?.cancel(); walk?.cancel(); bob?.cancel() }
}

function Mover({ r, first }: { r: MoverRow; first: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => (ref.current ? run(ref.current, r, first) : undefined), [r, first])
  const [aw, ah] = r.back ? STREET.back : STREET.atlas, k = r.scale, w = r.w * k, h = r.h * k
  const cut = { backgroundImage: `url("${SCENE_SRC.sky[r.back ? 5 : 0]}")`, backgroundPosition: `${-r.ax * k}px ${-r.ay * k}px`, backgroundSize: `${aw * k}px ${ah * k}px` }
  return (
    <div ref={ref} className={styles.mover} style={{ bottom: STREET.h - (r.y + h), width: w, height: h, marginLeft: -w / 2 }}>
      <div data-bob>
        {r.type === 2
          ? <div data-art className={styles.clip} style={{ width: w, height: h }}><div data-strip style={{ width: (r.frames - 1) * r.step + r.w, height: h, ...cut }} /></div>
          : <div data-art style={{ width: w, height: h, ...cut }} />}
      </div>
    </div>
  )
}

export default function SceneMovers({ rows, layer, first }: { rows: MoverRow[]; layer: 0 | 1 | 2; first: number }) {
  return <>{rows.filter((r) => r.layer === layer).map((r) => <Mover key={r.key} r={r} first={r.type === 2 && r.n === first} />)}</>
}
