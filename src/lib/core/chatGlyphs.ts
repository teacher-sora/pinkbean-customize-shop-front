// 명찰 · 말풍선 글자 = 돋움 12px 비트맵(게임의 글꼴) 도트를 직접 찍는다(scripts/font-dotum-bitmap.py 가 뽑는다).
// 브라우저가 글꼴을 그리지 않으므로 어느 기기에서나 게임과 같은 도트 · 같은 글자 폭이다(윈도우 돋움과 한글 11,172자 · 기호 1,490자 전수 대조).
// 파일은 넷으로 나눠 그 글자가 든 것만 받는다 — 영문 · 기호(basic), 자주 쓰는 한글 2,350자(ks), 나머지 한글(rest), 한자 · 가나(cjk).
// 한 번 받은 파일은 다시 받지 않고(주소에 판이 들어가 오래 캐시 — next.config 의 headers), 부위가 생기면 한가할 때 basic · ks 를 미리 받는다.
import { DOTUM_DIR, KS_MASK } from './chatGlyphsKs'

export interface Glyph { adv: number; bx: number; by: number; w: number; h: number; rows: Uint8Array } // rows = 줄마다 ceil(w/8) 바이트

type Chunk = 'basic' | 'ks' | 'rest' | 'cjk'
let ks: Uint8Array | null = null
const isKs = (cp: number) => {
  if (!ks) ks = Uint8Array.from(atob(KS_MASK), (c) => c.charCodeAt(0))
  const i = cp - 0xac00
  return !!(ks[i >> 3] & (1 << (i & 7)))
}
const cjk = (c: number) => (c >= 0x2e80 && c <= 0x2fdf) || (c >= 0x3040 && c <= 0x30ff) || (c >= 0x31f0 && c <= 0x31ff) || (c >= 0x3400 && c <= 0x4dbf) || (c >= 0x4e00 && c <= 0x9fff) || (c >= 0xf900 && c <= 0xfaff) || c >= 0x20000
const chunkOf = (cp: number): Chunk => (cp >= 0xac00 && cp <= 0xd7a3 ? (isKs(cp) ? 'ks' : 'rest') : cjk(cp) ? 'cjk' : 'basic')

const glyphs = new Map<number, Glyph>()
const loaded = new Map<Chunk, Promise<void>>()
function loadChunk (k: Chunk): Promise<void> {
  let p = loaded.get(k)
  if (!p) {
    p = fetch(DOTUM_DIR + k + '.json').then((r) => (r.ok ? r.json() : Promise.reject(new Error(k)))).then((recs: [number, number, number, number, number, number, string][]) => {
      for (const [cp, adv, bx, by, w, h, hex] of recs) {
        const rows = new Uint8Array(hex.length / 2)
        for (let i = 0; i < rows.length; i++) rows[i] = parseInt(hex.substr(i * 2, 2), 16)
        glyphs.set(cp, { adv, bx, by, w, h, rows })
      }
    })
    p.catch(() => { if (loaded.get(k) === p) loaded.delete(k) }) // 실패는 남기지 않는다(다음에 다시 받는다)
    loaded.set(k, p)
  }
  return p
}

// 이 글들을 그릴 도트를 받아 둔다(이미 받았으면 바로 끝난다). 하나라도 받지 못했으면 false — 그린 그림을 기억하지 않는다.
export async function loadGlyphs (texts: string[]): Promise<boolean> {
  const need = new Set<Chunk>()
  for (const t of texts) for (const ch of t) need.add(chunkOf(ch.codePointAt(0)!))
  const ok = await Promise.all([...need].map((k) => loadChunk(k).then(() => true, () => false)))
  return ok.every(Boolean)
}
// 부위가 생기면 한가할 때 미리 받는다 — 명찰 · 말풍선을 끼는 순간 글자를 기다리지 않게.
export function prefetchGlyphs (): void {
  const go = () => { void loadChunk('basic').catch(() => {}); void loadChunk('ks').catch(() => {}) }
  const ric = (window as unknown as { requestIdleCallback?: (f: () => void) => void }).requestIdleCallback
  if (ric) ric(go); else setTimeout(go, 1)
}
// 그 글자의 도트. 돋움에 없는 글자거나 아직 받지 못했으면 null.
export const glyphOf = (cp: number): Glyph | null => glyphs.get(cp) ?? null
