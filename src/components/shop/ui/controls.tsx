'use client'

// 공용 컨트롤: 세그먼트 알약 · 스위치 · 색상 계열 점 · 믹스 스와치 · 염색 조절 행(슬라이더 + [−][값][+]).

import clsx from 'clsx'
import { useEffect, useRef, useState } from 'react'
import { DYE_FAMILIES } from '@/lib/catalog'
import styles from './ui.module.css'

/* ── 세그먼트 ── */
export type SegOpt<T extends string> = { v: T; l: string; t?: string; disabled?: boolean; disabledTitle?: string }
export function Seg<T extends string>({ opts, value, onPick, variant = 'pc', title }: {
  opts: SegOpt<T>[]; value: T; onPick: (v: T) => void; variant?: 'pc' | 'mobileFlex' | 'mobileFit'; title?: string
}) {
  const track = variant === 'pc' ? styles.segTrack : variant === 'mobileFlex' ? styles.segTrackM : styles.segTrackMFit
  const btn = variant === 'mobileFlex' ? styles.segFlex : styles.seg
  return (
    <div title={title} className={track}>
      {opts.map((o) => {
        const on = !o.disabled && value === o.v
        return (
          <button key={o.v} type="button" disabled={o.disabled} title={o.disabled ? o.disabledTitle : o.t}
            onClick={() => { if (!o.disabled) onPick(o.v) }}
            className={clsx(on ? 'pb-solid' : 'pb-soft', btn, on && styles.segOn, o.disabled && styles.segDisabled)}>{o.l}</button>
        )
      })}
    </div>
  )
}

/* ── 스위치 ── */
export function Switch({ on, onToggle, title }: { on: boolean; onToggle: () => void; title: string }) {
  return (
    <button type="button" onClick={onToggle} title={title} aria-label={title} aria-pressed={on} className={clsx(styles.track, on && styles.trackOn)}>
      <span className={styles.knob} />
    </button>
  )
}

/* ── 색상 계열(Prism type 0~6) 점 ── */
export function FamilyDots({ value, onPick, size }: { value: number; onPick: (i: number) => void; size: 'sm' | 'lg' | 'lgMin' }) {
  const hue = [styles.hue0, styles.hue1, styles.hue2, styles.hue3, styles.hue4, styles.hue5, styles.hue6]
  return (
    <>
      {DYE_FAMILIES.map((f, i) => (
        <button key={i} type="button" onClick={() => onPick(i)} title={f} aria-label={f}
          className={clsx(styles.fam, size !== 'sm' && styles.famLg, size === 'lgMin' && styles.famLgMin, value === i && styles.famOn)}>
          <span className={clsx(styles.famDot, hue[i])} />
        </button>
      ))}
    </>
  )
}

/* ── 믹스 스와치(팔레트 색은 데이터라 CSS 변수로만 주입) ── */
export function Swatch({ hex, name, on, onPick }: { hex: string; name: string; on: boolean; onPick: () => void }) {
  return <button type="button" onClick={onPick} title={name} className={clsx(styles.swatch, on && styles.swatchOn)} style={{ ['--sw' as string]: hex }} />
}

/* ── [−][값][+] 스테퍼: 누르고 있으면 400ms 뒤부터 70ms 간격 반복(onStep 은 함수형 갱신이어야 최신값 누적) ── */
export function Stepper({ label, valueStr, placeholder, onNum, onBlur, onStep, decOff, incOff, size }: {
  label: string; valueStr: string; placeholder?: string
  onNum: (raw: string) => void; onBlur?: () => void; onStep: (d: number) => void
  decOff: boolean; incOff: boolean; size: 'sm' | 'lg'
}) {
  const hold = useRef<{ t: ReturnType<typeof setTimeout> | null; i: ReturnType<typeof setInterval> | null }>({ t: null, i: null })
  const stop = () => {
    if (hold.current.t) { clearTimeout(hold.current.t); hold.current.t = null }
    if (hold.current.i) { clearInterval(hold.current.i); hold.current.i = null }
  }
  useEffect(() => stop, [])
  const start = (d: number) => (e: React.PointerEvent) => {
    if (e.button != null && e.button !== 0) return
    e.preventDefault() // 길게 누를 때 텍스트 선택/확대 방지
    stop(); onStep(d)
    hold.current.t = setTimeout(() => { hold.current.i = setInterval(() => onStep(d), 70) }, 400)
  }
  // 키보드(Enter/Space) 활성화는 pointer 이벤트가 없어 click(detail 0)으로 받는다.
  const key = (d: number) => (e: React.MouseEvent) => { if (e.detail === 0) onStep(d) }
  const btn = clsx('pb-step', styles.stepBtn, size === 'lg' && styles.stepBtnLg)
  return (
    <div className={styles.stepWrap}>
      <button type="button" tabIndex={-1} aria-label="1 감소" className={clsx(btn, decOff && styles.stepOff)}
        onPointerDown={start(-1)} onPointerUp={stop} onPointerLeave={stop} onPointerCancel={stop} onClick={key(-1)}>−</button>
      <input inputMode="numeric" aria-label={label} value={valueStr} placeholder={placeholder}
        onChange={(e) => onNum(e.target.value)} onBlur={onBlur} className={clsx(styles.stepNum, size === 'lg' && styles.stepNumLg)} />
      <button type="button" tabIndex={-1} aria-label="1 증가" className={clsx(btn, incOff && styles.stepOff)}
        onPointerDown={start(1)} onPointerUp={stop} onPointerLeave={stop} onPointerCancel={stop} onClick={key(1)}>+</button>
    </div>
  )
}

/* ── 염색 조절 행: 라벨 · 슬라이더(트랙 인셋) · 스테퍼. 폭은 .pb-dyecol 컨테이너 쿼리가 결정 ── */
export function DyeRow({ label, track, min, max, value, onRange, onDragStart, stepper }: {
  label: string; track: 'h' | 's' | 'v'; min: number; max: number; value: number
  onRange: (v: number) => void; onDragStart?: () => void
  stepper: React.ReactNode
}) {
  // 가로형(라벨·슬라이더·스테퍼 한 줄)에서 슬라이더가 250px 이하로 줄면 세로형(라벨+스테퍼 / 슬라이더 전체 폭).
  // 판정 = 줄 폭 − 라벨(38) − 간격(9×2) − 스테퍼 실측 폭. 스테퍼 크기(sm/lg)·배치 컨테이너와 무관하게 동작한다.
  const rowRef = useRef<HTMLDivElement>(null)
  const stepRef = useRef<HTMLDivElement>(null)
  const [stack, setStack] = useState(false)
  useEffect(() => {
    const row = rowRef.current; if (!row) return
    const m = () => {
      const stepW = stepRef.current?.offsetWidth ?? 0
      const next = row.clientWidth - 38 - 9 * 2 - stepW <= 250
      setStack((v) => (v === next ? v : next))
    }
    m()
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(m) : null
    ro?.observe(row)
    return () => ro?.disconnect()
  }, [])
  // x 좌표 → 값. 손잡이(18px) 중심이 움직이는 구간 = 좌우 9px 안쪽(트랙과 동일)이라 그 구간 기준으로 환산.
  const pick = (el: HTMLElement, clientX: number) => {
    const r = el.getBoundingClientRect()
    const span = Math.max(1, r.width - 18)
    const f = Math.max(0, Math.min(1, (clientX - r.left - 9) / span))
    const v = Math.round(min + f * (max - min))
    if (v !== value) onRange(v)
  }
  return (
    <div ref={rowRef} className="pb-dyerow" data-stack={stack ? '' : undefined}>
      <span className="pb-dyelabel">{label}</span>
      {/* 포인터는 슬라이더 영역이 직접 처리한다: 누른 위치로 손잡이가 즉시 이동하고, 포인터 캡처로 그대로 드래그.
          (모바일 기본 range 는 트랙을 탭해도 안 오고 손잡이를 정확히 잡아야만 끌려서 조작이 어긋났다.)
          input 은 키보드 조작·접근성용으로 남기고 포인터만 막는다(.pb-range pointer-events:none). */}
      <div className="pb-slider"
        onPointerDown={(e) => {
          if (e.pointerType === 'mouse' && e.button !== 0) return
          e.preventDefault()
          const el = e.currentTarget
          el.setPointerCapture(e.pointerId)
          el.querySelector('input')?.focus({ preventScroll: true })
          onDragStart?.()
          pick(el, e.clientX)
        }}
        onPointerMove={(e) => { if (e.currentTarget.hasPointerCapture(e.pointerId)) pick(e.currentTarget, e.clientX) }}>
        <div className={`pb-track pb-track-${track}`} />
        {/* 슬라이더 값은 즉시 수치 반영 요소라 value 를 그대로 바인딩 */}
        <input type="range" tabIndex={-1} className="pb-range" min={min} max={max} value={value} aria-label={label}
          onChange={(e) => onRange(parseInt(e.target.value, 10) || 0)} />
      </div>
      <div ref={stepRef} className="pb-dyestep">{stepper}</div>
    </div>
  )
}
