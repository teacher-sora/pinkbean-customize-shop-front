'use client'

// 채팅 이모티콘 고르기(명찰 · 말풍선). 위 = 묶음 줄(막대 없는 가로 줄, 휠로 옆으로 · 양끝 흐림), 구분선, 아래 = 3열 격자(세로 스크롤).
// 채팅(ChatBar)과 코디 프로필이 **같은 이것을 같은 팝박스(PopBox)에** 넣는다(사용자 지시 — 같은 디자인은 하나로). 모바일 채팅은 아래 시트(Surface 'emo').
// 모바일 미리보기는 낮아 그 안이나 아래로 펼치면 자리가 모자라고 스크롤도 못 한다. 고르면 바로 onPick.
//  · pickFrame(코디 프로필 — 정지 그림을 저장한다): 움직이는 이모티콘을 누르면 같은 창 안에서 그 프레임 격자로 가로로 넘어가 한 장을 고른다(재생 칸 없음).
//  · onClose 를 주면(팝박스) 아래 줄 [이전] [닫기]를 그린다. 시트는 시트의 아래 줄을 쓴다.
// 여백은 칸마다 상하좌우가 같고(PC 8 · 모바일 12), 묶음 줄과 격자 사이는 구분선으로 가른다.

import clsx from 'clsx'
import { useEffect, useState } from 'react'
import { warmEmo, type ChatEmo } from '@/lib/core/chatUi'
import { imageSrc } from '@/lib/core/render'
import { CHAT_EMO_FILE } from '@/lib/shopData'
import { useInnerSlide } from '../surface/innerSlide'
import { useWheelRail } from '../ui/useWheelRail'
import { PopFoot } from './PopBox'
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
const FRAME_BOX = 60 // 프레임 칸 그림의 최대 변(px) — 더 크면 줄여 보인다

// value = 지금 고른 이모티콘 · 프레임(0부터 — 표시만). onPick(e, frame) — frame 은 pickFrame 일 때만(움직이지 않으면 0)
export default function ChatEmoPicker ({ mobile, onPick, onClose, pickFrame, value }: {
  mobile: boolean; onPick: (e: ChatEmo, frame?: number) => void; onClose?: () => void; pickFrame?: boolean; value?: { id: string; frame: number } | null
}) {
  const [sets, setSets] = useState<EmoSet[] | null>(null)
  const [set, setSetState] = useState(lastSet)
  const rail = useWheelRail<HTMLDivElement>(!!sets?.length)
  const { view, go, style } = useInnerSlide<'list' | 'frames'>('list')
  const [detail, setDetail] = useState<ChatEmo | null>(null)
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
  const pick = (e: ChatEmo) => {
    if (pickFrame && e.strip && (e.frames?.length ?? 0) > 1) { void warmEmo(e); setDetail(e); go('frames', 1); return }
    onPick(e, pickFrame ? 0 : undefined)
  }
  const fr = detail?.frames ?? []
  return (
    <div className={clsx(styles.chatEmo, mobile && styles.chatEmoM)}>
      <div style={style} className={clsx(styles.chatEmo, styles.sheetSlide)}>
        {view === 'frames' && detail ? (
          <>
            <div className={styles.chatEmoHead}>
              <img src={imageSrc(detail.png, true)} crossOrigin="anonymous" alt="" className={styles.chatPx} />
              {detail.name}<span className={styles.pvDetailHint}>멈출 프레임을 골라요</span>
            </div>
            <div role="listbox" aria-label={`${detail.name} 프레임`} className={clsx('pb-scroll', 'pb-scroll-thin', 'pb-fade', styles.chatEmoScroll)}>
              <div className={styles.pvGrid}>
                {fr.map((f, i) => {
                  const k = Math.min(1, FRAME_BOX / Math.max(f.w, f.h))
                  const on = value?.id === detail.id && value.frame === i
                  return (
                    <button key={i} type="button" role="option" aria-selected={on} onClick={() => onPick(detail, i)} title={`${i + 1}번째 프레임`} className={clsx(styles.pvCell, on && styles.pvCellOn)}>
                      <span className={styles.pvCellArt}>
                        <span className={styles.emoFrame} style={{ width: f.w, height: f.h, backgroundImage: `url("${imageSrc(detail.strip!, true)}")`, backgroundPosition: `-${f.x}px 0`, transform: k < 1 ? `scale(${k})` : undefined }} />
                      </span>
                      <span className={styles.pvCellName}>{i + 1}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          </>
        ) : (
          <>
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
                  <button key={e.id} type="button" role="option" aria-selected={value?.id === e.id} title={e.name}
                    onPointerEnter={() => void warmEmo(e)} onPointerDown={() => void warmEmo(e)} onClick={() => pick(e)} className={clsx(styles.pvCell, value?.id === e.id && styles.pvCellOn)}>
                    {/* 말풍선이 쓰는 것과 같은 주소 · CORS 로 받는다 — 보내면 이 그림이 곧 대표 프레임이다(다시 받지 않는다) */}
                    <span className={styles.pvCellArt}><img src={imageSrc(e.png, true)} crossOrigin="anonymous" alt="" width={e.w} height={e.h} className={styles.chatPx} /></span>
                    <span className={styles.pvCellName}>{e.name}</span>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
      {onClose && <PopFoot onBack={view === 'frames' ? () => go('list', -1) : undefined} onClose={onClose} />}
    </div>
  )
}
