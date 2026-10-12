'use client'

// 코디 평가: 핑크빈이 무대로 걸어 나와 캐릭터 옆에 서서 한마디씩 한다.
//   평가를 누르면 걸어 들어온다 → 답을 기다리는 동안 캐릭터 곁을 오간다 → 말은 핑크빈 머리 위 한 곳에서 한 줄씩 바뀐다
//   (말하는 동안 그 말이 가리키는 부위의 아이템을 말 앞에 보여 준다) → 다 말하면 좋아하고 걸어 나간다.
// 자리는 미리보기 캐릭터가 딛고 선 바닥(lib/stageFloor)에 맞추고, 도트 크기도 캐릭터와 같은 정수 배율이다.
// 칸이 좁아 캐릭터 옆에 설 자리가 없으면(태블릿처럼 캐릭터가 크게 그려질 때) 핑크빈만 배율을 낮춘다(정수 배율은 지킨다).
// 그림은 게임의 펫 '핑크빈'이다(parser 의 pinkbean-build.cjs → assets/pinkbean.png + pinkbeanData.ts). 왼쪽을 보는 그림이다.

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import sheet from '@/assets/pinkbean.png'
import { getStageFloor, onStageFloor } from '@/lib/stageFloor'
import { useShop, type RateLine } from '../ShopContext'
import { PINKBEAN, PINKBEAN_SHEET } from './pinkbeanData'
import { BookmarkSprite } from './PreviewParts'
import styles from './preview.module.css'

type Act = keyof typeof PINKBEAN
// 서는 자리(게임 픽셀, 캐릭터 가운데에서 왼쪽으로). 말 사이사이에 두 자리를 오간다. 먼 자리는 칸이 좁으면 안쪽으로 당긴다(spots)
const NEAR = -46, FAR = -62, EDGE = 22
const HEAD = 36            // 발에서 머리 위까지(게임 픽셀). 말은 이 위에 뜬다
const SPEED = 70           // 걷는 빠르기(게임 픽셀/초)
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

export default function PinkbeanRate() {
  const s = useShop()
  const host = useRef<HTMLDivElement>(null)
  const bubble = useRef<HTMLDivElement>(null)
  // 바닥: 이 칸 안에서의 캐릭터 가운데 x · 발 높이 y(CSS px) · 핑크빈의 게임 픽셀 1칸의 CSS 크기
  const [geo, setGeo] = useState<{ x: number; y: number; k: number; w: number } | null>(null)
  const [on, setOn] = useState(false)                       // 무대에 나와 있다
  const [at, setAt] = useState({ gx: 0, ms: 0, right: true })   // 자리(게임 픽셀) · 거기까지 걷는 시간 · 오른쪽을 본다
  const [act, setAct] = useState<Act>('stand1')
  const [frame, setFrame] = useState(0)
  const [line, setLine] = useState<RateLine | null>(null)
  const [say, setSay] = useState(false)                     // 말이 보인다
  const [bw, setBw] = useState(0)

  useLayoutEffect(() => {
    const read = () => {
      const f = getStageFloor(), el = host.current
      if (!f || !el || !f.wrap.isConnected || !el.parentElement?.contains(f.wrap)) return
      const wr = f.wrap.getBoundingClientRect(), hr = el.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1, cx = wr.left - hr.left + f.cx
      const k = Math.max(1, Math.min(f.scale, Math.floor((cx * dpr) / (EDGE - NEAR)))) / dpr
      setGeo((g) => { const n = { x: cx, y: wr.top - hr.top + f.footY, k, w: hr.width }; return g && g.x === n.x && g.y === n.y && g.k === n.k && g.w === n.w ? g : n })
    }
    read()
    const off = onStageFloor(read)
    const ro = new ResizeObserver(read)
    if (host.current) ro.observe(host.current)
    return () => { off(); ro.disconnect() }
  }, [])

  // 프레임 넘기기
  useEffect(() => {
    if (!on) return
    let i = 0, t: ReturnType<typeof setTimeout>
    const step = () => { setFrame(i); t = setTimeout(() => { i = (i + 1) % PINKBEAN[act].length; step() }, PINKBEAN[act][i][6]) }
    step()
    return () => clearTimeout(t)
  }, [act, on])

  // 순서. 화면에서 떨어지면(탭 이동) 그 자리에서 끊는다
  const geoRef = useRef(geo); geoRef.current = geo
  const pos = useRef(0), busy = useRef(false), token = useRef(0)
  const pending = useRef<RateLine[] | null>(null)
  const rating = useRef(false); rating.current = s.rating
  const spots = () => { const g = geoRef.current; return [NEAR, Math.min(NEAR, Math.max(FAR, g ? Math.ceil(-g.x / g.k) + EDGE : FAR))] }
  const outside = () => { const g = geoRef.current; return g ? -Math.ceil(g.x / g.k) - 40 : -200 }
  const walk = async (to: number, alive: () => boolean) => {
    const d = to - pos.current
    if (!d) return
    const ms = Math.max(260, (Math.abs(d) / SPEED) * 1000)
    pos.current = to
    setAct('move'); setAt({ gx: to, ms, right: d > 0 })
    await sleep(ms)
    if (alive()) { setAct('stand1'); setAt({ gx: to, ms: 0, right: true }) }   // 서면 캐릭터 쪽(오른쪽)을 본다
  }
  const start = async () => {
    if (busy.current || !geoRef.current) return
    busy.current = true
    const my = ++token.current, alive = () => token.current === my
    pos.current = outside()
    setAt({ gx: pos.current, ms: 0, right: true }); setLine(null); setSay(false); setOn(true)
    await sleep(40)
    if (alive()) await walk(spots()[0], alive)
    let side = 0
    while (alive() && !pending.current && rating.current) {      // 답을 기다린다: 캐릭터 곁을 오가며 살펴본다
      await sleep(700)
      if (!alive() || pending.current) break
      side ^= 1
      await walk(spots()[side], alive)
    }
    const lines = pending.current; pending.current = null
    if (alive() && lines) {
      for (let i = 0; i < lines.length && alive(); i++) {
        if (i > 0) { setSay(false); await sleep(240); if (!alive()) break; side ^= 1; await walk(spots()[side], alive); if (!alive()) break }
        setLine(lines[i]); setAct('chat'); setSay(true)
        await sleep(Math.min(4200, 1900 + lines[i].text.length * 75))
      }
      if (alive()) { setSay(false); setAct('love'); await sleep(1400) }
    }
    if (alive()) { setSay(false); await walk(outside(), alive) }
    if (alive()) { setOn(false); busy.current = false; if (pending.current || rating.current) start() }
  }
  useEffect(() => { if (s.rating) start() }, [s.rating, geo !== null])
  useEffect(() => {
    // takeRate 는 아직 안 띄운 평가만 내준다 → 탭을 옮겼다 와서 다시 붙어도 지난 평가가 되풀이되지 않는다
    const got = s.takeRate()
    if (got && got.length) { pending.current = got.slice(0, 3); start() }
  }, [s.rateResult, s.takeRate, geo !== null])
  useEffect(() => () => { token.current++; busy.current = false }, [])

  useLayoutEffect(() => { if (bubble.current) setBw(bubble.current.offsetWidth) }, [line, geo])

  const f = PINKBEAN[act][Math.min(frame, PINKBEAN[act].length - 1)]
  const k = geo?.k ?? 1
  const px = geo ? geo.x + at.gx * k : 0
  // 말은 핑크빈 머리 위 가운데에. 칸 밖으로 나가지 않게 밀어 넣고, 꼬리는 핑크빈을 따라간다
  const left = geo ? Math.max(8, Math.min(geo.w - bw - 8, px - bw / 2)) : 0
  const item = line?.slot ? s.equipped[line.slot] : null
  return (
    <div ref={host} data-pb-rate aria-live="polite" className={styles.rate}>
      {geo && on && (
        <>
          <div className={styles.bean} style={{ transform: `translate3d(${px}px, ${geo.y}px, 0)`, transition: at.ms ? `transform ${at.ms}ms linear` : 'none' }}>
            <div style={{ transform: at.right ? 'scaleX(-1)' : undefined }}>
              <div className={styles.beanArt} style={{
                left: -f[4] * k, top: -f[5] * k, width: f[2] * k, height: f[3] * k,
                backgroundImage: `url(${sheet.src})`, backgroundPosition: `${-f[0] * k}px ${-f[1] * k}px`, backgroundSize: `${PINKBEAN_SHEET[0] * k}px ${PINKBEAN_SHEET[1] * k}px`,
              }} />
            </div>
          </div>
          <div ref={bubble} className={styles.say} data-on={say || undefined} style={{ left, bottom: `calc(100% - ${geo.y - HEAD * k - 10}px)`, maxWidth: Math.min(230, geo.w - 16) }}>
            {item && <span className={styles.sayItem}><BookmarkSprite item={item} /></span>}
            <span className={styles.sayText}>{line?.text}</span>
            <i className={styles.sayTail} style={{ left: Math.max(12, Math.min(bw - 12, px - left)) }} />
          </div>
        </>
      )}
    </div>
  )
}
