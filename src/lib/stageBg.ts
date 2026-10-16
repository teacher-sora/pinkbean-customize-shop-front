// 미리보기의 배경. 피팅룸(기본 — 배경 장면) · 흰색 · 검은색 · 직접 올린 그림 가운데 하나를 고른다.
// 고른 것과 올린 그림은 이 브라우저에만 둔다(localStorage `pb_stage_bg_v1`). 서버에 보내지 않는다.
//  · 올린 그림은 긴 변 1000px 로 줄여 JPEG 로 담는다 — localStorage 는 5MB 남짓이고 프리셋과 나눠 쓴다(원본을 그대로 담으면 한두 장에 찬다).
//  · 여덟 장까지. 담지 못하면(용량) 없던 일로 하고 알린다.
import { useSyncExternalStore } from 'react'

export interface StageBgImage { id: string; src: string }
export interface StageBg { sel: string; images: StageBgImage[] }   // sel = 'room' | 'white' | 'black' | 올린 그림의 id
export const STAGE_BG_MAX = 8
const KEY = 'pb_stage_bg_v1'
const DEFAULT: StageBg = { sel: 'room', images: [] }

let state: StageBg | null = null
const subs = new Set<() => void>()
function read(): StageBg {
  if (state) return state
  state = DEFAULT
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || 'null') as StageBg | null
    if (v && typeof v.sel === 'string' && Array.isArray(v.images)) {
      const images = v.images.filter((i) => i && typeof i.id === 'string' && typeof i.src === 'string').slice(0, STAGE_BG_MAX).map((i) => ({ id: i.id, src: i.src }))
      state = { sel: ['room', 'white', 'black'].includes(v.sel) || images.some((i) => i.id === v.sel) ? v.sel : 'room', images }
    }
  } catch { /* 저장소를 못 쓰면 기본 배경 */ }
  return state
}
// 담지 못하면 false(그때는 바꾸지 않는다)
function write(next: StageBg): boolean {
  try { localStorage.setItem(KEY, JSON.stringify(next)) } catch { return false }
  state = next
  subs.forEach((fn) => fn())
  return true
}
const subscribe = (fn: () => void) => { subs.add(fn); return () => { subs.delete(fn) } }

// 서버와 첫 그리기에서는 기본 배경이고, 화면이 뜬 뒤에 저장된 것으로 바뀐다.
export function useStageBg(): StageBg { return useSyncExternalStore(subscribe, read, () => DEFAULT) }
export function getStageBg(): StageBg { return read() }
export function setStageBg(sel: string) { const s = read(); if (s.sel !== sel) write({ ...s, sel }) }
export function removeStageBg(id: string) {
  const s = read()
  write({ sel: s.sel === id ? 'room' : s.sel, images: s.images.filter((i) => i.id !== id) })
}

function shrink(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file), img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      const k = Math.min(1, 1000 / Math.max(img.naturalWidth, img.naturalHeight)), w = Math.max(1, Math.round(img.naturalWidth * k)), h = Math.max(1, Math.round(img.naturalHeight * k))
      const c = document.createElement('canvas')
      c.width = w; c.height = h
      const g = c.getContext('2d')
      if (!g) { reject(new Error('canvas')); return }
      g.fillStyle = '#fff'; g.fillRect(0, 0, w, h)   // 투명한 그림은 흰 바탕으로
      g.drawImage(img, 0, 0, w, h)
      resolve(c.toDataURL('image/jpeg', 0.82))
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('image')) }
    img.src = url
  })
}
// 그림을 올려 맨 뒤에 붙이고 그것을 고른다. 'full' = 여덟 장이 찼다 · 'bad' = 그림이 아니다 · 'store' = 담을 자리가 없다
export async function addStageBg(file: File): Promise<'ok' | 'full' | 'bad' | 'store'> {
  const s = read()
  if (s.images.length >= STAGE_BG_MAX) return 'full'
  let src: string
  try { src = await shrink(file) } catch { return 'bad' }
  const id = `c${Date.now().toString(36)}`
  return write({ sel: id, images: [...read().images, { id, src }] }) ? 'ok' : 'store'
}
