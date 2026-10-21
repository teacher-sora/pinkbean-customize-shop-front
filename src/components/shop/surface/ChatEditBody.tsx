'use client'

// 명찰 · 말풍선 편집(dev 전용). 코디 비교(VsBody)와 같은 틀 — 왼쪽 = 명찰, 오른쪽 = 말풍선 미리보기, 각 아래 입력칸.
// 말풍선 입력칸 끝의 이모티콘 버튼으로 채팅 이모티콘을 고른다(게임처럼 말 대신 이모티콘이 원래 크기로 나온다).
// 고치는 동안은 이 창 안의 미리보기만 바뀌고, '적용'을 눌러야 캐릭터에 들어간다(ShopContext.setChat).

import clsx from 'clsx'
import { useEffect, useRef, useState } from 'react'
import { chatPreview, type ChatEmo, type ChatUi } from '@/lib/core/chatUi'
import { CHAT_EMO_FILE, CHAT_NAME_MAX, CHAT_TEXT_MAX, type ChatState } from '@/lib/shopData'
import StageBg from '../preview/StageBg'
import { useShop } from '../ShopContext'
import { IconClose, IconSmile } from '../ui/Icons'
import { SurfaceFooter } from './Surface'
import styles from './surface.module.css'

type EmoSet = { id: string; name: string; icon: string | null; items: (ChatEmo & { icon: string | null; frames: number })[] }
let emoSets: Promise<EmoSet[]> | null = null
const loadEmoSets = () => (emoSets ??= fetch(CHAT_EMO_FILE).then((r) => (r.ok ? r.json() : Promise.reject(new Error('emo')))).catch((e) => { emoSets = null; throw e }))

// 미리보기 칸 — 그림을 칸에 들어가는 가장 큰 정수 배율(최대 3)로, 디바이스 픽셀에 맞춰 또렷하게.
function ChatStage ({ ui, draft, empty }: { ui: ChatUi | undefined; draft: ChatState; empty: string }) {
  const wrap = useRef<HTMLDivElement>(null), cv = useRef<HTMLCanvasElement>(null)
  const [ok, setOk] = useState(false)
  useEffect(() => {
    let alive = true
    if (!ui) { setOk(false); return }
    chatPreview(ui, draft).then((src) => {
      const el = wrap.current, c = cv.current
      if (!alive || !src || !el || !c) return
      const dpr = window.devicePixelRatio || 1
      const k = Math.max(1, Math.min(3, Math.floor((el.clientWidth - 24) / src.width), Math.floor((el.clientHeight - 24) / src.height)))
      const dev = Math.max(1, Math.round(k * dpr))
      c.width = src.width * dev; c.height = src.height * dev
      const g = c.getContext('2d')!; g.imageSmoothingEnabled = false; g.clearRect(0, 0, c.width, c.height)
      g.drawImage(src, 0, 0, c.width, c.height)
      c.style.width = c.width / dpr + 'px'; c.style.height = c.height / dpr + 'px'
      setOk(true)
    }).catch(() => {})
    return () => { alive = false }
  }, [ui, draft.name, draft.text, draft.emo?.id])
  return (
    <div ref={wrap} className={clsx(styles.vsStage, styles.chatStage)}>
      <StageBg still />
      {ui ? <canvas ref={cv} className={clsx(styles.chatCanvas, !ok && styles.chatCanvasWait)} />
        : <div className={styles.chatEmpty}><span className={styles.chatEmptyTitle}>{empty}</span><span className={styles.chatEmptyHint}>명찰/말풍선 탭에서 고를 수 있어요</span></div>}
    </div>
  )
}

function EmoPicker ({ pick, onPick }: { pick?: ChatEmo; onPick: (e: ChatEmo) => void }) {
  const [sets, setSets] = useState<EmoSet[] | null>(null)
  const [set, setSet] = useState(0)
  useEffect(() => { loadEmoSets().then(setSets).catch(() => setSets([])) }, [])
  if (!sets) return <div className={styles.chatPicker}><div className={styles.chatPickerWait} /></div>
  const cur = sets[set]
  return (
    <div className={styles.chatPicker}>
      <div className={clsx('pb-norail', styles.chatSets)}>
        {sets.map((st, i) => (
          <button key={st.id} type="button" onClick={() => setSet(i)} aria-pressed={i === set} title={st.name} aria-label={st.name}
            className={clsx(styles.chatSet, i === set && styles.chatSetOn)}>
            {st.icon && <img src={st.icon} alt="" className={styles.chatPx} />}
          </button>
        ))}
      </div>
      <div className={clsx('pb-scroll', styles.chatGrid)}>
        {cur?.items.map((e) => (
          <button key={e.id} type="button" onClick={() => onPick({ id: e.id, name: e.name, png: e.png, w: e.w, h: e.h, origin: e.origin })}
            aria-pressed={pick?.id === e.id} title={e.name} aria-label={e.name}
            className={clsx(styles.chatEmo, pick?.id === e.id && styles.chatEmoOn)}>
            <img src={e.icon || e.png} alt="" className={styles.chatPx} />
          </button>
        ))}
      </div>
    </div>
  )
}

export default function ChatEditBody ({ mobile }: { mobile: boolean }) {
  const s = useShop()
  const [draft, setDraft] = useState<ChatState>(s.chat)
  const [picking, setPicking] = useState(false)
  const tag = s.equipped.nameTag, bal = s.equipped.chatBalloon
  const apply = () => { s.setChat({ ...draft, name: draft.name.trim() || s.chat.name }); s.closeSurface() }
  return (
    <>
      <div className={styles.vsBody}>
        <div className={clsx(styles.vsRow, mobile && styles.chatRowM)}>
          <div className={clsx(styles.vsPane, mobile && styles.vsPaneM)}>
            <div className={styles.vsLabelRow}><span className={styles.vsLabel}>명찰</span><span className={styles.vsName}>{tag?.name || '끼지 않음'}</span></div>
            <ChatStage ui={tag?.chatUi} draft={draft} empty="명찰을 끼면 여기에 보여요" />
            <input value={draft.name} maxLength={CHAT_NAME_MAX} onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder="이름" aria-label="명찰 이름" className={clsx('pb-input', styles.chatField)} />
          </div>
          <div className={clsx(styles.vsPane, mobile && styles.vsPaneM)}>
            <div className={styles.vsLabelRow}><span className={styles.vsLabel}>말풍선</span><span className={styles.vsName}>{bal?.name || '끼지 않음'}</span></div>
            <ChatStage ui={bal?.chatUi} draft={draft} empty="말풍선을 끼면 여기에 보여요" />
            <div className={styles.chatFieldRow}>
              {draft.emo ? (
                <div className={clsx(styles.chatField, styles.chatEmoField)}>
                  <img src={draft.emo.png} alt="" className={clsx(styles.chatPx, styles.chatEmoThumb)} />
                  <span className={styles.chatEmoName}>{draft.emo.name}</span>
                  <button type="button" onClick={() => setDraft({ ...draft, emo: undefined })} title="이모티콘 빼기" aria-label="이모티콘 빼기" className={clsx('pb-icon', styles.chatEmoX)}><IconClose size={12} /></button>
                </div>
              ) : (
                <input value={draft.text} maxLength={CHAT_TEXT_MAX} onChange={(e) => setDraft({ ...draft, text: e.target.value })}
                  placeholder="할 말" aria-label="말풍선 대사" className={clsx('pb-input', styles.chatField)} />
              )}
              <button type="button" onClick={() => setPicking((v) => !v)} aria-pressed={picking} title="이모티콘" aria-label="이모티콘"
                className={clsx(styles.chatEmoBtn, picking && styles.chatEmoBtnOn)}><IconSmile size={16} /></button>
            </div>
          </div>
        </div>
        {picking && <EmoPicker pick={draft.emo} onPick={(e) => setDraft({ ...draft, emo: e })} />}
      </div>
      <SurfaceFooter onApply={apply} />
    </>
  )
}
