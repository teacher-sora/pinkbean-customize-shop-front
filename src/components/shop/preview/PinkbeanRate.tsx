'use client'

// 코디 평가: 핑크빈이 무대로 걸어 나와 캐릭터 둘레를 돌아다니며 한마디씩 한다.
//   평가를 누르면 왼쪽에서 걸어 들어온다 → 답을 기다리는 동안 캐릭터 둘레를 이리저리 다닌다(오래 걸릴수록 더 많이)
//   → 멈춰 서서 한 마디 하고, 다른 자리로 가서 다음 마디를 한다(말은 핑크빈 머리 위에 뜨고, 그 말이 가리키는 부위의 아이템을 앞에 보여 준다)
//   → 다 말하면 좋아하고(하트) 가까운 쪽으로 걸어 나간다.
// 서는 자리는 정해 두지 않는다. 닿을 수 있는 폭 안에서 그때그때 고르고, 캐릭터와 조금 겹쳐 서도 된다.
// 걷기는 **걷는 그림 한 바퀴의 배수**만큼만 한다 → 걸음이 땅에 닿는 장면에서 끝나 서 있는 그림으로 매끄럽게 이어진다
// (도중에 끊으면 뛰어오른 그림에서 갑자기 내려앉는다). 말은 늘 멈춰 서고 한 박자 뒤에 한다.
// 캐릭터 곁을 지날 때 오른쪽으로 가면 캐릭터 **뒤로**, 왼쪽으로 가면 **앞으로** 지난다. 그래서 이 칸은 캐릭터(PreviewModel)보다 **먼저** 놓고,
// 앞에 있을 때와 말만 z-index 로 올린다(preview.module.css 의 .beanFront · .say).
// 자리는 미리보기 캐릭터가 딛고 선 바닥(lib/stageFloor)에 맞추고, 도트 크기도 캐릭터와 같은 정수 배율이다.
// 칸이 좁아 캐릭터 옆에 설 자리가 없으면(태블릿처럼 캐릭터가 크게 그려질 때) 핑크빈만 배율을 낮춘다(정수 배율은 지킨다).
// 그림은 게임의 펫 '핑크빈'이다(parser 의 pinkbean-build.cjs → assets/pinkbean.png + pinkbeanData.ts). 왼쪽을 보는 그림이다.
// WebGL 을 쓰지 않는다(DOM 과 CSS 뿐이다) — 배경 장면을 못 띄우는 기기에서도 그대로 나온다.

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import sheet from '@/assets/pinkbean.png'
import { getStageFloor, onStageFloor } from '@/lib/stageFloor'
import { useShop, type RateLine } from '../ShopContext'
import { PINKBEAN, PINKBEAN_SHEET } from './pinkbeanData'
import { BookmarkSprite } from './PreviewParts'
import styles from './preview.module.css'

type Act = keyof typeof PINKBEAN
const SIDE = 46            // 캐릭터 옆에 서려면 필요한 폭(게임 픽셀). 이만큼도 없으면 핑크빈의 배율을 낮춘다
const REACH = 74           // 캐릭터 가운데에서 가장 멀리 가는 거리
const EDGE = 22            // 칸의 가장자리에서 띄울 폭
const NEAR = 22            // 이보다 가까이는 서지 않는다(캐릭터에 다 가려진다)
const TALK = 32            // 말할 때는 이만큼은 떨어진다(조금 겹치는 것은 괜찮다. 얼굴이 가려지면 누가 말하는지 안 보인다)
const BODY = 26            // 이 안에 있으면 캐릭터와 겹친다 → 앞뒤를 가린다
const HEAD = 36            // 발에서 머리 위까지. 말은 이 위에 뜬다
const CYCLE = PINKBEAN.move.reduce((n, f) => n + f[6], 0)   // 걷는 그림 한 바퀴(ms)
const STRIDE = 70          // 한 바퀴에 가는 거리(게임 픽셀)
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))
const rand = (a: number, b: number) => a + Math.random() * (b - a)

export default function PinkbeanRate() {
  const s = useShop()
  const host = useRef<HTMLDivElement>(null)
  const bubble = useRef<HTMLDivElement>(null)
  // 바닥: 이 칸 안에서의 캐릭터 가운데 x · 발 높이 y(CSS px) · 핑크빈의 게임 픽셀 1칸의 CSS 크기
  // hx · hy = 이 칸이 화면에서 놓인 자리(말을 화면 픽셀 격자에 맞출 때 쓴다)
  const [geo, setGeo] = useState<{ x: number; y: number; k: number; w: number; hx: number; hy: number } | null>(null)
  const [on, setOn] = useState(false)                       // 무대에 나와 있다
  const [at, setAt] = useState({ gx: 0, ms: 0, right: true, front: true })   // 자리(게임 픽셀) · 거기까지 걷는 시간 · 오른쪽을 본다 · 캐릭터 앞에 그린다
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
      const k = Math.max(1, Math.min(f.scale, Math.floor((Math.min(cx, hr.width - cx) * dpr) / (SIDE + EDGE)))) / dpr
      setGeo((g) => { const n = { x: cx, y: wr.top - hr.top + f.footY, k, w: hr.width, hx: hr.left, hy: hr.top }; return g && g.x === n.x && g.y === n.y && g.k === n.k && g.w === n.w && g.hx === n.hx && g.hy === n.hy ? g : n })
    }
    read()
    const off = onStageFloor(read)
    const ro = new ResizeObserver(read)
    if (host.current) ro.observe(host.current)
    return () => { off(); ro.disconnect() }
  }, [])

  // 프레임 넘기기. 동작이 바뀌면 첫 장부터 다시 돈다
  useEffect(() => {
    if (!on) return
    let i = 0, t: ReturnType<typeof setTimeout>
    const step = () => { setFrame(i); t = setTimeout(() => { i = (i + 1) % PINKBEAN[act].length; step() }, PINKBEAN[act][i][6]) }
    step()
    return () => clearTimeout(t)
  }, [act, on])

  // 순서. 화면에서 떨어지면(탭 이동) 그 자리에서 끊는다
  const geoRef = useRef(geo); geoRef.current = geo
  const pos = useRef(0), front = useRef(true), busy = useRef(false), token = useRef(0)
  const pending = useRef<RateLine[] | null>(null)
  const rating = useRef(false); rating.current = s.rating
  // 한쪽으로 닿을 수 있는 거리, 칸 밖(왼쪽 -1 · 오른쪽 1)
  const room = (side: number) => { const g = geoRef.current; return g ? (side < 0 ? g.x : g.w - g.x) / g.k : 100 }
  const outside = (side: number) => side * (Math.ceil(room(side)) + 40)
  // 다음에 설 자리: 닿을 수 있는 폭 안 아무 데나. 지금 자리에서 조금은 떨어지고, 캐릭터에 다 가려지는 한가운데는 피한다
  const pick = (near = NEAR) => {
    const lo = -Math.min(REACH, room(-1) - EDGE), hi = Math.min(REACH, room(1) - EDGE)
    for (let n = 0; n < 12; n++) {
      let t = Math.round(rand(lo, hi))
      if (Math.abs(t) < near) t = t < 0 ? -near : near
      if (Math.abs(t - pos.current) >= 34) return t
    }
    return pos.current > 0 ? Math.round(lo * 0.7) : Math.round(hi * 0.7)
  }
  // 걷는다(걷는 그림 한 바퀴의 배수만큼). 캐릭터 곁을 지나면 오른쪽으로는 뒤로, 왼쪽으로는 앞으로. 서면 캐릭터 쪽을 본다
  const walk = async (to: number, alive: () => boolean) => {
    const from = pos.current, d = to - from
    if (!d) return
    const ms = Math.max(1, Math.round(Math.abs(d) / STRIDE)) * CYCLE
    const passes = Math.min(from, to) < BODY && Math.max(from, to) > -BODY
    if (passes) front.current = d < 0
    pos.current = to
    setAct('move'); setAt({ gx: to, ms, right: d > 0, front: front.current })
    await sleep(ms)
    if (!alive()) return
    if (Math.abs(to) >= BODY) front.current = true
    setAct('stand1'); setAt({ gx: to, ms: 0, right: to < 0, front: front.current })
  }
  const start = async () => {
    if (busy.current || !geoRef.current) return
    busy.current = true
    const my = ++token.current, alive = () => token.current === my
    pos.current = outside(-1); front.current = true
    setAt({ gx: pos.current, ms: 0, right: true, front: true }); setLine(null); setSay(false); setOn(true)
    await sleep(40)
    if (alive()) await walk(-Math.round(rand(SIDE - 6, Math.min(REACH, room(-1) - EDGE))), alive)
    while (alive() && !pending.current && rating.current) {      // 답을 기다린다: 서서 살펴보다가 다른 자리로 간다
      await sleep(rand(350, 900))
      if (!alive() || pending.current) break
      await walk(pick(), alive)
    }
    const lines = pending.current; pending.current = null
    if (alive() && lines) {
      for (let i = 0; i < lines.length && alive(); i++) {
        if (i > 0) { setSay(false); await sleep(260); if (!alive()) break }
        if (i > 0 || Math.abs(pos.current) < TALK) { await walk(pick(TALK), alive); if (!alive()) break }
        // 멈춰 서고 한 박자 뒤에 말한다. 말의 내용은 그 한 박자 **전에** 바꿔 둔다 — 아이템 그림은 받아서 그리는 데 시간이 걸려,
        // 보이는 순간에 바꾸면 앞 말의 그림이 잠깐 남아 보인다(그림 칸도 아이템마다 새로 만든다. 아래 key)
        setLine(lines[i])
        await sleep(360)
        if (!alive()) break
        setAct('chat'); setSay(true)
        await sleep(Math.min(4200, 1900 + lines[i].text.length * 75))
      }
      if (alive()) { setSay(false); setAct('love'); await sleep(1400) }
    }
    if (alive()) { setSay(false); setAct('stand1'); await sleep(120) }
    if (alive()) await walk(outside(pos.current < 0 ? -1 : 1), alive)
    if (alive()) { setOn(false); busy.current = false; if (pending.current || rating.current) start(); else s.endRate() }
  }
  useEffect(() => { if (s.rating) start() }, [s.rating, geo !== null])
  useEffect(() => {
    // takeRate 는 아직 안 띄운 평가만 내준다 → 탭을 옮겼다 와서 다시 붙어도 지난 평가가 되풀이되지 않는다
    const got = s.takeRate()
    if (got && got.length) { pending.current = got.slice(0, 3); start() }
  }, [s.rateResult, s.takeRate, geo !== null])
  // 화면에서 떨어지면 끊고, 평가 버튼을 다시 누를 수 있게 푼다
  const endRate = useRef(s.endRate); endRate.current = s.endRate
  useEffect(() => () => { token.current++; busy.current = false; endRate.current() }, [])

  useLayoutEffect(() => { if (bubble.current) setBw(bubble.current.offsetWidth) }, [line, geo])

  const f = PINKBEAN[act][Math.min(frame, PINKBEAN[act].length - 1)]
  const k = geo?.k ?? 1
  const px = geo ? geo.x + at.gx * k : 0
  // 말은 핑크빈 머리 위 가운데에. 칸 밖으로 나가지 않게 밀어 넣고, 꼬리는 핑크빈을 따라간다.
  // 자리와 오르내리는 폭은 **화면 픽셀 격자에 맞춘다**(snap): 말 속 아이템 그림은 도트라, 반 픽셀에 걸쳐 놓이면 흐려지고
  // 오르내리는 동안 어떤 높이에서만 또렷해져 떨리는 것처럼 보인다. 격자에 맞추면 쉬는 자리(맨 아래 · 맨 위)에서는 늘 또렷하다.
  const dpr = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1
  const snap = (v: number) => Math.round(v * dpr) / dpr
  const left = geo ? snap(geo.hx + Math.max(8, Math.min(geo.w - bw - 8, px - bw / 2))) - geo.hx : 0
  const foot = geo ? snap(geo.hy + geo.y - HEAD * k - 10) - geo.hy : 0   // 말의 아랫변
  const item = line?.slot ? s.equipped[line.slot] : null
  return (
    <div ref={host} data-pb-rate aria-live="polite" className={styles.rate}>
      {geo && on && (
        <>
          <div className={at.front ? styles.beanFront : styles.bean} style={{ transform: `translate3d(${px}px, ${geo.y}px, 0)`, transition: at.ms ? `transform ${at.ms}ms linear` : 'none' }}>
            <div style={{ transform: at.right ? 'scaleX(-1)' : undefined }}>
              <div className={styles.beanArt} style={{
                left: -f[4] * k, top: -f[5] * k, width: f[2] * k, height: f[3] * k,
                backgroundImage: `url(${sheet.src})`, backgroundPosition: `${-f[0] * k}px ${-f[1] * k}px`, backgroundSize: `${PINKBEAN_SHEET[0] * k}px ${PINKBEAN_SHEET[1] * k}px`,
              }} />
            </div>
          </div>
          <div ref={bubble} className={styles.say} data-on={say || undefined} style={{ left, bottom: `calc(100% - ${foot}px)`, maxWidth: Math.min(230, geo.w - 16) }}>
            {/* 오르내리는 것은 안쪽 한 겹이다: 글자 · 아이템 그림 · 꼬리가 한 장으로 함께 움직인다 */}
            <div className={styles.sayIn} style={{ ['--bob' as string]: `${-snap(3)}px` }}>
              {item && <span key={item.id} className={styles.sayItem}><BookmarkSprite item={item} /></span>}
              <span className={styles.sayText}>{line?.text}</span>
              <i className={styles.sayTail} style={{ left: Math.max(12, Math.min(bw - 12, px - left)) }} />
            </div>
          </div>
        </>
      )}
    </div>
  )
}
