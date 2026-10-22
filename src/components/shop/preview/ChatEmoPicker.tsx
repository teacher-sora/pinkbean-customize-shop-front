'use client'

// 채팅 이모티콘 고르기(명찰 · 말풍선). 위 = 묶음 줄(막대 없는 가로 줄, 휠로 옆으로 · 양끝 흐림), 구분선, 아래 = 3열 격자(세로 스크롤).
// PC · 절반 · 태블릿은 채팅 칸 위에 뜨는 작은 창(ChatBar), 모바일은 배경 고르기와 같은 아래 시트(Surface 의 'emo')에 들어간다 —
// 모바일 미리보기는 낮아 그 안이나 아래로 펼치면 자리가 모자라고 스크롤도 못 한다. 고르면 바로 보낸다(onPick).
// 여백은 칸마다 상하좌우가 같고(PC 8 · 모바일 12), 묶음 줄과 격자 사이는 구분선으로 가른다.

import clsx from 'clsx'
import { useEffect, useState } from 'react'
import { warmEmo, type ChatEmo } from '@/lib/core/chatUi'
import { imageSrc } from '@/lib/core/render'
import { CHAT_EMO_FILE } from '@/lib/shopData'
import { useWheelRail } from '../ui/useWheelRail'
import styles from './preview.module.css'

type EmoSet = { id: string; name: string; icon: string | null; items: ChatEmo[] }
let emoSets: Promise<EmoSet[]> | null = null
const loadEmoSets = () => (emoSets ??= fetch(CHAT_EMO_FILE).then((r) => (r.ok ? r.json() : Promise.reject(new Error('emo')))).catch((e) => { emoSets = null; throw e }))
let lastSet = 0 // 마지막으로 본 묶음(창 · 시트를 다시 열어도 그 묶음에서)
// 보고 있는 묶음의 움직이는 그림을 한가할 때 하나씩 미리 받는다(보내는 순간 바로 움직이게). 묶음을 바꾸거나 창을 닫으면 다음 것부터 멈춘다.
// 한 묶음이 최대 860KB(움직이는 그림 한 장 최대 430KB, 풀면 평균 0.35MB)라 망이 넉넉할 때만 — 데이터 절약 · 2G/3G 에서는 하지 않는다
// (그때는 마우스를 올리거나 누른 것만 받고, 받기 전에는 대표 프레임으로 먼저 뜬다 — chatUi.prepareChat).
type Conn = { saveData?: boolean; effectiveType?: string }
const roomy = () => { const c = (navigator as Navigator & { connection?: Conn }).connection; return !c || (!c.saveData && (!c.effectiveType || c.effectiveType === '4g')) }
const idle = (f: () => void) => { const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void }
  if (w.requestIdleCallback) { const id = w.requestIdleCallback(f, { timeout: 1500 }); return () => w.cancelIdleCallback!(id) }
  const id = window.setTimeout(f, 200); return () => clearTimeout(id) }

export default function ChatEmoPicker ({ mobile, onPick }: { mobile: boolean; onPick: (e: ChatEmo) => void }) {
  const [sets, setSets] = useState<EmoSet[] | null>(null)
  const [set, setSetState] = useState(lastSet)
  const rail = useWheelRail<HTMLDivElement>(!!sets?.length)
  useEffect(() => { let alive = true; loadEmoSets().then((v) => { if (alive) setSets(v) }).catch(() => { if (alive) setSets([]) }); return () => { alive = false } }, [])
  const pickSet = (i: number) => { lastSet = i; setSetState(i) }
  const cur = sets?.[Math.min(set, (sets?.length ?? 1) - 1)]
  useEffect(() => {
    if (!cur || !roomy()) return
    const list = cur.items.filter((e) => e.strip)
    let i = 0, stop = () => {}, alive = true
    const next = () => { stop = idle(() => { const e = list[i++]; if (!alive || !e) return; void warmEmo(e).then(() => { if (alive) next() }) }) }
    next()
    return () => { alive = false; stop() }
  }, [cur])
  return (
    <div className={clsx(styles.chatEmo, mobile && styles.chatEmoM)}>
      <div ref={rail} role="tablist" aria-label="이모티콘 묶음" className={clsx('pb-norail', 'pb-fade', styles.chatEmoSets)}>
        {sets?.map((st, i) => (
          <button key={st.id} type="button" role="tab" onClick={() => pickSet(i)} aria-selected={st === cur} title={st.name} aria-label={st.name}
            className={clsx(styles.chatEmoSet, st === cur && styles.chatEmoSetOn)}>
            {st.icon && <img src={st.icon} alt="" className={styles.chatPx} />}
          </button>
        ))}
      </div>
      <div role="listbox" aria-label={cur?.name ?? '이모티콘'} className={clsx('pb-scroll', 'pb-scroll-thin', 'pb-fade', styles.chatEmoScroll)}>
        <div className={styles.pvGrid}>
          {cur?.items.map((e) => (
            <button key={e.id} type="button" role="option" aria-selected={false} title={e.name}
              onPointerEnter={() => void warmEmo(e)} onPointerDown={() => void warmEmo(e)} onClick={() => onPick(e)} className={styles.pvCell}>
              {/* 말풍선이 쓰는 것과 같은 주소 · CORS 로 받는다 — 보내면 이 그림이 곧 대표 프레임이다(다시 받지 않는다) */}
              <span className={styles.pvCellArt}><img src={imageSrc(e.png, true)} crossOrigin="anonymous" alt="" width={e.w} height={e.h} className={styles.chatPx} /></span>
              <span className={styles.pvCellName}>{e.name}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
