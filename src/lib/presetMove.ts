// 프리셋 옮기기(사용자 지시 — 한 기기의 프리셋 여러 개를 다른 기기로 한 번에. 계정 없이 짧은 코드 · QR, 원하면 간단한 아이디).
// 서버는 app/api/move(R2 move/ · dev 는 move-dev/). 묶음 = { v: 1, items: [{ n: 이름, c: 긴 공유 코드 }] } — 코디는 공유 링크와 같은 코드다(lib/shareCode).
//  · 코드: 5자리 숫자, 5분(지나면 서버가 버린다 — 보내기 창에 남은 시간). 보낼 때마다 새로 받는다
//  · 아이디: 2~16자(숫자만은 안 된다 — 코드와 갈리게). 처음 저장한 기기가 받은 열쇠(token)를 이 기기에 둬야 고쳐 쓴다(MOVE_ACCT_KEY)
import { decodeShareCode, encodeShareCode } from './shareCode'
import type { Snapshot } from '@/components/shop/ShopContext'

export type MoveItem = { name: string; snap: Snapshot }
const MOVE_ACCT_KEY = 'pb_move_acct_v1'
export const MOVE_CODE_RE = /^\d{5}$/
export const MOVE_ID_RE = /^(?!\d+$)[0-9A-Za-z가-힣_-]{2,16}$/
export type MoveAcct = { id: string; token: string }
export const readAcct = (): MoveAcct | null => { try { const v = JSON.parse(localStorage.getItem(MOVE_ACCT_KEY) || 'null'); return v?.id && v?.token ? v : null } catch { return null } }
const writeAcct = (a: MoveAcct) => { try { localStorage.setItem(MOVE_ACCT_KEY, JSON.stringify(a)) } catch { /* noop */ } }

const pack = async (items: MoveItem[]) => ({ v: 1, items: await Promise.all(items.map(async (it) => ({ n: it.name, c: await encodeShareCode(it.snap) }))) })

// 보내기 — 5자리 코드와 살아 있는 시간(ms). 실패하면 null
export async function sendByCode(items: MoveItem[]): Promise<{ code: string; ttl: number } | null> {
  try {
    const r = await fetch('/api/move', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bundle: await pack(items) }) })
    const j = await r.json().catch(() => null)
    return r.ok && j?.code ? { code: String(j.code), ttl: Number(j.ttl) || 300000 } : null
  } catch { return null }
}
// 아이디로 두기 — 'ok' | 'taken'(다른 기기가 쓰는 아이디) | 'fail'
export async function sendById(id: string, items: MoveItem[]): Promise<'ok' | 'taken' | 'fail'> {
  try {
    const mine = readAcct()
    const token = mine && mine.id.toLowerCase() === id.toLowerCase() ? mine.token : undefined
    const r = await fetch('/api/move', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bundle: await pack(items), id, token }) })
    if (r.status === 409) return 'taken'
    const j = await r.json().catch(() => null)
    if (!r.ok || !j?.token) return 'fail'
    writeAcct({ id, token: j.token })
    return 'ok'
  } catch { return 'fail' }
}
// 받기 — 코드나 아이디로. 못 찾으면 null
export async function receive(key: string): Promise<MoveItem[] | null> {
  const k = key.trim()
  const q = MOVE_CODE_RE.test(k) ? `code=${k}` : MOVE_ID_RE.test(k) ? `id=${encodeURIComponent(k)}` : null
  if (!q) return null
  try {
    const r = await fetch(`/api/move?${q}`, { cache: 'no-store' })
    if (!r.ok) return null
    const j = await r.json() as { items?: { n: string; c: string }[] }
    const out: MoveItem[] = []
    for (const it of j.items ?? []) { const snap = await decodeShareCode(it.c); if (snap) out.push({ name: it.n, snap }) }
    return out.length ? out : null
  } catch { return null }
}
