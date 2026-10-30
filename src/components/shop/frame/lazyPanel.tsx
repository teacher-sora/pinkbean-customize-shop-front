'use client'

import clsx from 'clsx'
import { useEffect, useState, type ComponentType } from 'react'
import { MOBILE_GRID } from '@/lib/shopData'
import styles from './frame.module.css'

// 탭 패널을 첫 로드 묶음 밖으로 뺀다(사용자 지시 — 다른 탭의 코드까지 받느라 첫 화면이 늦지 않게).
//  · 앱이 붙자마자 preload 로 미리 받는다. 받아 둔 패널은 Suspense 를 거치지 않고 같은 렌더에서 바로 그린다 — next/dynamic 은 받아 둔 뒤에도 빈 프레임이 한 번 끼어 탭이 깜빡인다.
//  · 받기 전에 누르면 패널과 같은 틀(.panelWait)이 자리를 지키고, 0.2초가 넘어가면 그 안에 뼈대가 나타난다(CSS 지연 — 빨리 받으면 보이지 않아 점멸이 없다).
//  · 실패하면 조금 뒤 다시 받고, 그래도 안 되면 한 번만 새로고침한다 — 페이지를 열어 둔 사이 새 배포로 옛 파일이 사라진 경우다. 지금 탭은 새로고침 복원이 되살린다.
const RELOAD_KEY = 'pb_panel_reload'
const RETRY_MS = [600, 1800]

type WaitKind = 'cards' | 'rows' | 'side'
function PanelWait({ kind, mobile }: { kind: WaitKind; mobile: boolean }) {
  const cards = mobile ? MOBILE_GRID.cols * MOBILE_GRID.rows : 12
  return (
    <div className={clsx(styles.panelWait, mobile && styles.panelWaitM, kind === 'side' && styles.panelWaitSide)} aria-hidden>
      <div className={styles.waitBody}>
        {mobile && <div className={styles.waitHead}><div className={clsx(styles.waitCard, styles.waitLine)} /><div className={clsx(styles.waitCard, styles.waitLine)} /></div>}
        {kind === 'cards'
          ? <div className={clsx(styles.waitGrid, mobile && styles.waitGridM)}>{Array.from({ length: cards }, (_, i) => <div key={i} className={styles.waitCard} />)}</div>
          : <div className={styles.waitRows}>{Array.from({ length: 8 }, (_, i) => <div key={i} className={styles.waitCard} />)}</div>}
      </div>
    </div>
  )
}

export function lazyPanel<P extends { mobile: boolean }>(load: () => Promise<{ default: ComponentType<P> }>, kind: WaitKind = 'cards') {
  let Loaded: ComponentType<P> | null = null
  let loading: Promise<ComponentType<P>> | null = null
  const get = () => (loading ??= load().then((m) => { Loaded = m.default; return m.default }).catch((e) => { loading = null; throw e }))
  function Panel(props: P) {
    const [C, setC] = useState<ComponentType<P> | null>(() => Loaded)
    useEffect(() => {
      if (C) return
      let alive = true, t = 0, tries = 0
      const run = () => {
        get().then((c) => { if (alive) setC(() => c) }).catch(() => {
          if (!alive) return
          if (tries < RETRY_MS.length) { t = window.setTimeout(run, RETRY_MS[tries++]); return }
          try { if (sessionStorage.getItem(RELOAD_KEY)) return; sessionStorage.setItem(RELOAD_KEY, '1') } catch { return }
          location.reload()
        })
      }
      run()
      return () => { alive = false; clearTimeout(t) }
    }, [C])
    return C ? <C {...props} /> : <PanelWait kind={kind} mobile={props.mobile} />
  }
  Panel.preload = () => get().catch(() => undefined)
  return Panel
}
