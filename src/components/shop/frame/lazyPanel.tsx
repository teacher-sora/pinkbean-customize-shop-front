'use client'

import { useEffect, useState, type ComponentType } from 'react'
import styles from './frame.module.css'

// 탭 패널을 첫 로드 묶음 밖으로 뺀다(사용자 지시 — 다른 탭의 코드까지 받느라 첫 화면이 늦지 않게).
//  · 첫 화면 뒤 한가할 때 preload 로 미리 받는다. 받아 둔 패널은 Suspense 를 거치지 않고 같은 렌더에서 바로 그린다 — next/dynamic 은 받아 둔 뒤에도 빈 프레임이 한 번 끼어 탭이 깜빡인다.
//  · 받기 전에 누르면 그 자리는 빈 칸(.panelWait)으로 자리만 지키고, 받는 대로 그린다.
//  · 실패하면 조금 뒤 다시 받고, 그래도 안 되면 한 번만 새로고침한다 — 페이지를 열어 둔 사이 새 배포로 옛 파일이 사라진 경우다. 지금 탭은 새로고침 복원이 되살린다.
const RELOAD_KEY = 'pb_panel_reload'
const RETRY_MS = [600, 1800]

export function lazyPanel<P extends object>(load: () => Promise<{ default: ComponentType<P> }>) {
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
    return C ? <C {...props} /> : <div className={styles.panelWait} aria-hidden />
  }
  Panel.preload = () => get().catch(() => undefined)
  return Panel
}
