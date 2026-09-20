'use client'

// 화면 뷰어(/viewer) — 왼쪽에서 앱을 폭별로 보고, 오른쪽에서 상태를 고르고 요소 값을 읽는다.
// 목적은 "어떤 요소의 어떤 값을 어떻게 바꿀지"를 정확히 집어내는 것이다. 운영 화면에는 영향을 주지 않는다:
//   · 앱은 같은 출처 iframe 으로 띄운다 → contentDocument 로 계산된 스타일을 그대로 읽을 수 있다.
//   · 태블릿(pointer:coarse)만 iframe 이 못 만들어서 `pbtouch=1` 로 강제한다(useBreakpoint).
//   · 탭 전환은 앱에 파라미터를 추가하지 않고 iframe 안의 하단 탭 버튼을 눌러서 한다.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import styles from './viewer.module.css'

type Preset = { id: string; label: string; w: number; h: number; touch: boolean; note: string }

const PRESETS: Preset[] = [
  { id: 'pc', label: 'PC', w: 1440, h: 900, touch: false, note: '≥1200 · 마우스' },
  { id: 'half', label: '절반', w: 860, h: 900, touch: false, note: '521~1199 · 마우스' },
  { id: 'tablet', label: '태블릿', w: 1000, h: 1280, touch: true, note: '861~1199 · 터치' },
  { id: 'mobile', label: '모바일', w: 390, h: 844, touch: true, note: '≤520 · 터치' },
  { id: 'mobile-sm', label: '모바일 소형', w: 360, h: 640, touch: true, note: '낮은 화면' },
]

const TABS = ['', '코디', 'AI 코디 검색', '코디 정보 · 염색', '프리셋', '코디 광장', '공지 및 건의함']

// CSS 모듈 클래스 `plaza_pickBtn__a1b2` → `plaza.module.css › .pickBtn`
const MOD = /^(.+?)_(.+)__[A-Za-z0-9_-]+$/
function readClass(c: string): { file: string; cls: string } | null {
  const m = MOD.exec(c)
  return m ? { file: `${m[1]}.module.css`, cls: `.${m[2]}` } : null
}

type Info = {
  tag: string
  path: string
  modules: { file: string; cls: string }[]
  globals: string[]
  box: string
  rows: [string, string][]
}

const px = (v: string) => (v === '0px' ? '0' : v)
const short = (el: Element) => {
  const mods = [...el.classList].map(readClass).filter(Boolean) as { file: string; cls: string }[]
  return el.tagName.toLowerCase() + (mods[0] ? mods[0].cls : el.classList[0] ? `.${el.classList[0]}` : '')
}

function describe(el: Element): Info {
  const cs = getComputedStyle(el)
  const r = el.getBoundingClientRect()
  const classes = [...el.classList]
  const modules = classes.map(readClass).filter(Boolean) as { file: string; cls: string }[]
  const globals = classes.filter((c) => !MOD.test(c))
  const chain: string[] = []
  for (let n: Element | null = el, i = 0; n && i < 4; n = n.parentElement, i++) chain.unshift(short(n))
  const rows: [string, string][] = [
    ['크기', `${Math.round(r.width)} × ${Math.round(r.height)}`],
    ['padding', [cs.paddingTop, cs.paddingRight, cs.paddingBottom, cs.paddingLeft].map(px).join(' ')],
    ['margin', [cs.marginTop, cs.marginRight, cs.marginBottom, cs.marginLeft].map(px).join(' ')],
    ['display', cs.display + (cs.display.includes('flex') || cs.display.includes('grid') ? ` · gap ${px(cs.gap)}` : '')],
  ]
  if (cs.display.includes('grid')) rows.push(['grid', `${cs.gridTemplateColumns} / ${cs.gridTemplateRows}`])
  if (cs.display.includes('flex')) rows.push(['flex', `${cs.flexDirection} · ${cs.alignItems} · ${cs.justifyContent} · ${cs.flex}`])
  rows.push(
    ['position', cs.position + (cs.position !== 'static' ? ` · ${px(cs.top)} ${px(cs.right)} ${px(cs.bottom)} ${px(cs.left)} · z ${cs.zIndex}` : '')],
    ['글자', `${cs.fontSize} / ${cs.fontWeight} / ${cs.lineHeight} · ${cs.color}`],
    ['배경', cs.backgroundColor + (cs.backgroundImage !== 'none' ? ' + image' : '')],
    ['테두리', `${cs.borderTopWidth} ${cs.borderTopStyle} ${cs.borderTopColor} · radius ${cs.borderRadius}`],
    ['overflow', `${cs.overflowX} / ${cs.overflowY}`],
  )
  if (cs.transform !== 'none') rows.push(['transform', cs.transform])
  if (cs.transitionDuration !== '0s') rows.push(['transition', `${cs.transitionProperty} ${cs.transitionDuration} ${cs.transitionTimingFunction}`])
  return {
    tag: el.tagName.toLowerCase(),
    path: chain.join(' › '),
    modules,
    globals,
    box: `${Math.round(r.width)} × ${Math.round(r.height)}`,
    rows,
  }
}

type FrameProps = {
  preset: Preset
  zoom: number
  path: string
  tab: string
  nonce: number
  inspect: boolean
  onPick: (el: Element, preset: Preset) => void
}

function Frame({ preset, zoom, path, tab, nonce, inspect, onPick }: FrameProps) {
  const ref = useRef<HTMLIFrameElement | null>(null)
  const [hover, setHover] = useState<DOMRect | null>(null)
  const [ready, setReady] = useState(0)
  const src = `${path}${path.includes('?') ? '&' : '?'}pbview=1${preset.touch ? '&pbtouch=1' : ''}`

  // 탭 전환: 앱에 파라미터를 더하지 않고 하단 탭 버튼(aria-label)을 눌러 준다.
  useEffect(() => {
    if (!ready || !tab) return
    const doc = ref.current?.contentDocument
    if (!doc) return
    // 하이드레이션 시점이 화면마다 달라서 버튼이 생길 때까지 잠깐 기다린다.
    let tries = 0
    const t = window.setInterval(() => {
      const btn = [...doc.querySelectorAll('button')].find((b) => (b.getAttribute('aria-label') || b.getAttribute('title')) === tab)
      if (btn) { btn.click(); window.clearInterval(t); return }
      if (++tries > 25) window.clearInterval(t)
    }, 200)
    return () => window.clearInterval(t)
  }, [ready, tab])

  // 요소 검사 — 같은 출처라 iframe 문서에 바로 리스너를 건다. 끄면 앱이 평소대로 동작한다.
  useEffect(() => {
    const doc = ref.current?.contentDocument
    if (!ready || !inspect || !doc) { setHover(null); return }
    const move = (e: Event) => {
      const el = e.target as Element | null
      if (el && el.getBoundingClientRect) setHover(el.getBoundingClientRect())
    }
    const leave = () => setHover(null)
    const click = (e: Event) => {
      if (!e.isTrusted) return // 탭 자동 전환 같은 프로그램 클릭은 앱으로 그대로 보낸다
      e.preventDefault(); e.stopPropagation()
      const el = e.target as Element | null
      if (el) onPick(el, preset)
    }
    doc.addEventListener('mousemove', move, true)
    doc.addEventListener('mouseleave', leave, true)
    doc.addEventListener('click', click, true)
    return () => {
      doc.removeEventListener('mousemove', move, true)
      doc.removeEventListener('mouseleave', leave, true)
      doc.removeEventListener('click', click, true)
    }
  }, [ready, inspect, onPick, preset])

  return (
    <div className={styles.frameWrap}>
      <div className={styles.frameHead}>
        <b>{preset.label}</b> <span>{preset.w} × {preset.h}{preset.touch ? ' · 터치' : ''}</span>
      </div>
      <div className={styles.frameBox} style={{ width: preset.w * zoom, height: preset.h * zoom }}>
        <div className={styles.frameScale} style={{ width: preset.w, height: preset.h, transform: `scale(${zoom})` }}>
          <iframe
            key={`${preset.id}:${nonce}`}
            ref={ref}
            src={src}
            title={`${preset.label} 미리보기`}
            className={styles.frame}
            style={{ width: preset.w, height: preset.h }}
            onLoad={() => setReady((v) => v + 1)}
          />
          {inspect && hover && (
            <div className={styles.hover} style={{ left: hover.left, top: hover.top, width: hover.width, height: hover.height }} />
          )}
        </div>
      </div>
    </div>
  )
}

export default function Viewer() {
  const [presetId, setPresetId] = useState('mobile')
  const [all, setAll] = useState(false)
  const [zoomMode, setZoomMode] = useState<'fit' | number>('fit')
  const [path, setPath] = useState('/')
  const [pathDraft, setPathDraft] = useState('/')
  const [tab, setTab] = useState('코디 광장')
  const [nonce, setNonce] = useState(0)
  const [inspect, setInspect] = useState(true)
  const [info, setInfo] = useState<Info | null>(null)
  const [copied, setCopied] = useState(false)
  const picked = useRef<Element | null>(null)
  const stageRef = useRef<HTMLDivElement | null>(null)
  const [stageW, setStageW] = useState(1200)

  useEffect(() => {
    const el = stageRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setStageW(el.clientWidth))
    ro.observe(el)
    setStageW(el.clientWidth)
    return () => ro.disconnect()
  }, [])

  const shown = useMemo(() => (all ? PRESETS : PRESETS.filter((p) => p.id === presetId)), [all, presetId])
  const widest = Math.max(...shown.map((p) => p.w))
  const fit = Math.min(1, (stageW - 48 - (all ? 24 * (shown.length - 1) : 0)) / (all ? shown.reduce((a, p) => a + p.w, 0) : widest))
  const zoom = zoomMode === 'fit' ? Math.max(0.2, Number(fit.toFixed(3))) : zoomMode

  const onPick = useCallback((el: Element) => {
    picked.current = el
    setInfo(describe(el))
    setCopied(false)
  }, [])
  const toParent = () => {
    const p = picked.current?.parentElement
    if (!p) return
    picked.current = p
    setInfo(describe(p))
    setCopied(false)
  }
  const copy = () => {
    if (!info) return
    const head = info.modules.length ? info.modules.map((m) => `${m.file} › ${m.cls}`).join(' + ') : info.path
    const text = [head, `경로: ${info.path}`, info.globals.length ? `전역 클래스: ${info.globals.join(' ')}` : '', ...info.rows.map(([k, v]) => `${k}: ${v}`)]
      .filter(Boolean).join('\n')
    void navigator.clipboard.writeText(text).then(() => setCopied(true))
  }

  return (
    <div className={styles.wrap}>
      <div ref={stageRef} className={styles.stage}>
        <div className={styles.frames}>
          {shown.map((p) => (
            <Frame key={p.id} preset={p} zoom={zoom} path={path} tab={tab} nonce={nonce} inspect={inspect} onPick={onPick} />
          ))}
        </div>
      </div>

      <aside className={styles.side}>
        <div className={styles.sideHead}>화면 뷰어</div>
        <div className={styles.sideBody}>
          <section>
            <h2 className={styles.h}>화면</h2>
            <div className={styles.chips}>
              {PRESETS.map((p) => (
                <button key={p.id} type="button" title={p.note} onClick={() => { setPresetId(p.id); setAll(false) }}
                  className={!all && presetId === p.id ? styles.chipOn : styles.chip}>{p.label}</button>
              ))}
              <button type="button" onClick={() => setAll(true)} className={all ? styles.chipOn : styles.chip}>전부</button>
            </div>
            <p className={styles.note}>{all ? '네 화면을 한 줄에 놓고 비교합니다.' : PRESETS.find((p) => p.id === presetId)?.note}</p>
          </section>

          <section>
            <h2 className={styles.h}>확대</h2>
            <div className={styles.chips}>
              {(['fit', 1, 0.75, 0.5] as const).map((z) => (
                <button key={String(z)} type="button" onClick={() => setZoomMode(z)}
                  className={zoomMode === z ? styles.chipOn : styles.chip}>{z === 'fit' ? '맞춤' : `${z * 100}%`}</button>
              ))}
            </div>
            <p className={styles.note}>지금 {Math.round(zoom * 100)}% — 확대해도 레이아웃은 실제 폭 기준입니다.</p>
          </section>

          <section>
            <h2 className={styles.h}>탭</h2>
            <select value={tab} onChange={(e) => { setTab(e.target.value); setNonce((n) => n + 1) }} className={styles.select}>
              {TABS.map((t) => <option key={t} value={t}>{t || '열린 그대로'}</option>)}
            </select>
          </section>

          <section>
            <h2 className={styles.h}>주소</h2>
            <div className={styles.row}>
              <input value={pathDraft} onChange={(e) => setPathDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { setPath(pathDraft || '/'); setNonce((n) => n + 1) } }}
                placeholder="/" className={styles.input} />
              <button type="button" onClick={() => setNonce((n) => n + 1)} className={styles.btn}>새로고침</button>
            </div>
            <p className={styles.note}>공유 링크(<code>/?c=PB-…</code>)도 그대로 넣어 볼 수 있어요.</p>
          </section>

          <section>
            <h2 className={styles.h}>요소 검사</h2>
            <div className={styles.row}>
              <button type="button" onClick={() => setInspect((v) => !v)} className={inspect ? styles.btnOn : styles.btn}>
                {inspect ? '검사 중 — 끄기' : '검사 켜기'}
              </button>
              <button type="button" onClick={toParent} disabled={!info} className={styles.btn}>부모로</button>
            </div>
            <p className={styles.note}>{inspect ? '화면의 요소를 누르면 값이 여기 나옵니다(클릭은 앱에 전달되지 않아요).' : '앱을 평소처럼 조작할 수 있어요.'}</p>
          </section>

          {info && (
            <section className={styles.info}>
              <div className={styles.infoTop}>
                {info.modules.length > 0 ? info.modules.map((m) => (
                  <div key={m.cls} className={styles.mod}><b>{m.cls}</b><span>{m.file}</span></div>
                )) : <div className={styles.mod}><b>{info.tag}</b><span>CSS 모듈 클래스 없음</span></div>}
                {info.globals.length > 0 && <div className={styles.glob}>{info.globals.join(' ')}</div>}
              </div>
              <div className={styles.path}>{info.path}</div>
              <table className={styles.table}>
                <tbody>
                  {info.rows.map(([k, v]) => (
                    <tr key={k}><th>{k}</th><td>{v}</td></tr>
                  ))}
                </tbody>
              </table>
              <button type="button" onClick={copy} className={styles.copy}>{copied ? '복사했어요' : '이 내용 복사'}</button>
            </section>
          )}
        </div>
      </aside>
    </div>
  )
}
