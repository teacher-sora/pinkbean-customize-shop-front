'use client'

// 채팅 이모티콘 고르기(dev 전용 — 명찰 · 말풍선). 위 = 묶음 줄(막대 없는 가로 줄, 휠로 옆으로 · 양끝 흐림), 구분선, 아래 = 3열 격자(세로 스크롤).
// PC · 절반 · 태블릿은 채팅 칸 위에 뜨는 작은 창(ChatBar), 모바일은 배경 고르기와 같은 아래 시트(Surface 의 'emo')에 들어간다 —
// 모바일 미리보기는 낮아 그 안이나 아래로 펼치면 자리가 모자라고 스크롤도 못 한다. 고르면 바로 보낸다(onPick).
// 여백은 칸마다 상하좌우가 같고(PC 8 · 모바일 12), 묶음 줄과 격자 사이는 구분선으로 가른다.

import clsx from 'clsx'
import { useEffect, useState } from 'react'
import type { ChatEmo } from '@/lib/core/chatUi'
import { CHAT_EMO_FILE } from '@/lib/shopData'
import { useWheelRail } from '../ui/useWheelRail'
import styles from './preview.module.css'

type EmoSet = { id: string; name: string; icon: string | null; items: ChatEmo[] }
let emoSets: Promise<EmoSet[]> | null = null
const loadEmoSets = () => (emoSets ??= fetch(CHAT_EMO_FILE).then((r) => (r.ok ? r.json() : Promise.reject(new Error('emo')))).catch((e) => { emoSets = null; throw e }))
let lastSet = 0 // 마지막으로 본 묶음(창 · 시트를 다시 열어도 그 묶음에서)

export default function ChatEmoPicker ({ mobile, onPick }: { mobile: boolean; onPick: (e: ChatEmo) => void }) {
  const [sets, setSets] = useState<EmoSet[] | null>(null)
  const [set, setSetState] = useState(lastSet)
  const rail = useWheelRail<HTMLDivElement>(!!sets?.length)
  useEffect(() => { let alive = true; loadEmoSets().then((v) => { if (alive) setSets(v) }).catch(() => { if (alive) setSets([]) }); return () => { alive = false } }, [])
  const pickSet = (i: number) => { lastSet = i; setSetState(i) }
  const cur = sets?.[Math.min(set, (sets?.length ?? 1) - 1)]
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
              onClick={() => onPick({ id: e.id, name: e.name, png: e.png, w: e.w, h: e.h, origin: e.origin })} className={styles.pvCell}>
              <span className={styles.pvCellArt}><img src={e.png} alt="" width={e.w} height={e.h} className={styles.chatPx} /></span>
              <span className={styles.pvCellName}>{e.name}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
