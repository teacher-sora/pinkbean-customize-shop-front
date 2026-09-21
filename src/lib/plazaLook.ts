// 대회 '같은 조합' 판정 — 2026-09-21 개편(염색 허용 오차).
// ⚠️ supabase/0008 의 plaza_look_coarse · plaza_look_similar 와 **같은 규칙**이어야 한다.
//    여기 결과는 등록 폼의 **안내용**이고, 실제로 막는 건 DB 트리거다.
//
// 두 단계로 본다.
//  ① 뼈대(coarse): 착용 아이템 · 피부 · 숨김 · 염색 끔 · 팔레트 염색의 '고른 색'(기본색·믹스색). 이게 다르면 다른 조합.
//  ② 염색 수치: 뼈대가 같으면 HSB(색조·채도·명도)와 팔레트 믹스 비율을 **허용 오차 안이면 같다**고 본다.
//     미세하게 돌려 놓은 염색은 눈으로 거의 구분되지 않아서, 그걸로 같은 코디를 다시 올리는 걸 막는다(사용자 지시).
// 점 위치 · 연출(액션·표정·이펙트)은 보지 않는다.

import type { HsbParams, PaletteParams } from './core/dye'

export const DYE_TOL = { h: 20, s: 20, b: 20, ratio: 20 } // 색조는 0~359 순환, 채도·명도 −99~99, 비율 0~100

type LookSnap = {
  equipped?: Record<string, string>; tone?: number
  dyePalette?: Record<string, PaletteParams>; dyeHsb?: Record<string, HsbParams>
  hidden?: Record<string, boolean>; dyeOff?: Record<string, boolean>
}

const canon = (v: unknown): string => {
  if (v === null || v === undefined || typeof v !== 'object') return JSON.stringify(v ?? null)
  if (Array.isArray(v)) return `[${v.map(canon).join(',')}]`
  return `{${Object.keys(v as Record<string, unknown>).sort().map((k) => `${JSON.stringify(k)}:${canon((v as Record<string, unknown>)[k])}`).join(',')}}`
}
const onlyTrue = (m?: Record<string, boolean>) => Object.fromEntries(Object.entries(m || {}).filter(([, v]) => v === true))

export function lookCoarse(s: LookSnap): string {
  const p = Object.fromEntries(Object.entries(s.dyePalette || {}).map(([k, v]) => [k, { b: v.baseColor, m: v.mixColor ?? null }]))
  return canon({ e: s.equipped || {}, t: s.tone ?? null, x: onlyTrue(s.hidden), o: onlyTrue(s.dyeOff), p })
}

const hueGap = (a: number, b: number) => { const d = Math.abs(a - b) % 360; return Math.min(d, 360 - d) }
const Z: HsbParams = { h: 0, s: 0, b: 0 }

// 뼈대가 같은 두 스냅샷의 염색 수치가 허용 오차 안인가.
export function lookSimilar(a: LookSnap, b: LookSnap): boolean {
  const ha = a.dyeHsb || {}, hb = b.dyeHsb || {}
  for (const k of new Set([...Object.keys(ha), ...Object.keys(hb)])) {
    const x = ha[k] || Z, y = hb[k] || Z
    if ((x.t ?? 0) !== (y.t ?? 0)) return false
    if (hueGap(x.h || 0, y.h || 0) > DYE_TOL.h) return false
    if (Math.abs((x.s || 0) - (y.s || 0)) > DYE_TOL.s) return false
    if (Math.abs((x.b || 0) - (y.b || 0)) > DYE_TOL.b) return false
  }
  const pa = a.dyePalette || {}, pb = b.dyePalette || {}
  for (const k of Object.keys(pa)) {
    const x = pa[k], y = pb[k]
    if (!y) return false
    if (x.mixColor != null && Math.abs((x.ratio ?? 0) - (y.ratio ?? 0)) > DYE_TOL.ratio) return false
  }
  return true
}

export const sameLook = (a: LookSnap, b: LookSnap) => lookCoarse(a) === lookCoarse(b) && lookSimilar(a, b)
