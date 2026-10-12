'use client'

// 코디 평가: 핑크빈이 무대로 걸어 나와 캐릭터 둘레를 돌며 한마디씩 한다.
//   평가를 누르면 왼쪽에서 걸어 들어온다 → 답을 기다리는 동안 캐릭터 둘레를 돈다(오래 걸릴수록 여러 바퀴)
//   → 한 마디 하고, 반대쪽으로 돌아가 다음 마디를 한다(말은 핑크빈 머리 위에 뜨고, 그 말이 가리키는 부위의 아이템을 앞에 보여 준다)
//   → 다 말하면 좋아하고(하트) 가까운 쪽으로 걸어 나간다.
// 도는 길: 왼쪽 → 오른쪽은 캐릭터 **뒤로**, 오른쪽 → 왼쪽은 **앞으로** 지난다. 그래서 이 칸은 캐릭터(PreviewModel)보다 **먼저** 놓고,
// 앞으로 지날 때와 말할 때만 z-index 로 올린다(preview.module.css 의 .beanFront · .say).
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
// 서는 자리 = 캐릭터 가운데에서 양옆으로 SIDE(게임 픽셀). EDGE = 칸의 가장자리에서 띄울 폭
const SIDE = 46, EDGE = 22
const HEAD = 36            // 발에서 머리 위까지(게임 픽셀). 말은 이 위에 뜬다
const SPEED = 78           // 걷는 빠르기(게임 픽셀/초)
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

export default function PinkbeanRate() {
  const s = useShop()
  const host = useRef<HTMLDivElement>(null)
  const bubble = useRef<HTMLDivElement>(null)
  // 바닥: 이 칸 안에서의 캐릭터 가운데 x · 발 높이 y(CSS px) · 핑크빈의 게임 픽셀 1칸의 CSS 크기
  const [geo, setGeo] = useState<{ x: number; y: number; k: number; w: number } | null>(null)
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
  // 칸 밖(왼쪽 -1 · 오른쪽 1)
  const outside = (side: number) => { const g = geoRef.current; return g ? side * (Math.ceil((side < 0 ? g.x : g.w - g.x) / g.k) + 40) : side * 200 }
  // 걷는다. 캐릭터를 가로지를 때 왼쪽 → 오른쪽은 뒤로, 오른쪽 → 왼쪽은 앞으로. 서면 캐릭터 쪽을 본다
  const walk = async (to: number, alive: () => boolean) => {
    const d = to - pos.current
    if (!d) return
    const ms = Math.max(260, (Math.abs(d) / SPEED) * 1000), cross = pos.current * to < 0
    pos.current = to
    setAct('move'); setAt({ gx: to, ms, right: d > 0, front: !(cross && d > 0) })
    await sleep(ms)
    if (alive()) { setAct('stand1'); setAt({ gx: to, ms: 0, right: to < 0, front: true }) }
  }
  const start = async () => {
    if (busy.current || !geoRef.current) return
    busy.current = true
    const my = ++token.current, alive = () => token.current === my
    pos.current = outside(-1)
    setAt({ gx: pos.current, ms: 0, right: true, front: true }); setLine(null); setSay(false); setOn(true)
    await sleep(40)
    let side = -1
    if (alive()) await walk(side * SIDE, alive)
    while (alive() && !pending.current && rating.current) {      // 답을 기다린다: 캐릭터 둘레를 돌며 살펴본다
      await sleep(450)
      if (!alive() || pending.current) break
      side = -side
      await walk(side * SIDE, alive)
    }
    const lines = pending.current; pending.current = null
    if (alive() && lines) {
      for (let i = 0; i < lines.length && alive(); i++) {
        if (i > 0) { setSay(false); await sleep(240); if (!alive()) break; side = -side; await walk(side * SIDE, alive); if (!alive()) break }
        setLine(lines[i]); setAct('chat'); setSay(true)
        await sleep(Math.min(4200, 1900 + lines[i].text.length * 75))
      }
      if (alive()) { setSay(false); setAct('love'); await sleep(1400) }
    }
    if (alive()) { setSay(false); await walk(outside(side), alive) }
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
          <div className={at.front ? styles.beanFront : styles.bean} style={{ transform: `translate3d(${px}px, ${geo.y}px, 0)`, transition: at.ms ? `transform ${at.ms}ms linear` : 'none' }}>
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
