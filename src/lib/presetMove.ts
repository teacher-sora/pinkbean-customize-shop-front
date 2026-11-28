// 프리셋 이동(사용자 지시 — 한 기기의 프리셋 여러 개를 다른 기기로 한 번에. 계정 없이 짧은 코드 · QR, 원하면 간단한 아이디).
// 서버는 app/api/move(R2 move/ · dev 는 move-dev/). 묶음 = { v: 1, items: [{ n: 이름, c: 긴 공유 코드 }] } — 코디는 공유 링크와 같은 코드다(lib/shareCode).
//  · 코드: 5자리 숫자, 5분(지나면 서버가 버린다 — 보내기 창에 남은 시간). 보낼 때마다 새로 받는다
//  · 아이디: 2~16자(숫자만은 안 된다 — 코드와 갈리게). 만든 기기가 받은 열쇠(token)를 이 기기에 둬야 고쳐 쓰고 지운다(MOVE_ACCT_KEY — 이 기기에서 만든 아이디 목록)
import { decodeShareCode, encodeShareCode } from './shareCode'
import type { Snapshot } from '@/components/shop/ShopContext'

export type MoveItem = { name: string; snap: Snapshot }
const MOVE_ACCT_KEY = 'pb_move_acct_v1'
export const MOVE_CODE_RE = /^\d{5}$/
export const MOVE_ID_RE = /^(?!\d+$)[0-9A-Za-z가-힣_-]{2,16}$/
export type MoveAcct = { id: string; token: string }
const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase()
// 이 기기에서 만든 아이디들(만든 순서). 하나만 두던 꼴도 받는다
export const readIds = (): MoveAcct[] => {
  try {
    const v = JSON.parse(localStorage.getItem(MOVE_ACCT_KEY) || 'null')
    return (Array.isArray(v) ? v : v ? [v] : []).filter((a: MoveAcct) => !!a?.id && !!a?.token)
  } catch { return [] }
}
const writeIds = (a: MoveAcct[]) => { try { localStorage.setItem(MOVE_ACCT_KEY, JSON.stringify(a)) } catch { /* noop */ } }

const pack = async (items: MoveItem[]) => ({ v: 1, items: await Promise.all(items.map(async (it) => ({ n: it.name, c: await encodeShareCode(it.snap) }))) })
const post = (body: unknown, method = 'POST') => fetch('/api/move', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })

export const MOVE_TTL = 5 * 60 * 1000 // 코드가 살아 있는 시간(서버 app/api/move 의 TTL 과 같다)
// 화면이 먼저 뽑는 번호 — QR 을 서버를 기다리지 않고 바로 그린다. 서버가 살아 있는 번호와 겹친다고 하면 받은 번호로 바꾼다
export const pickCode = () => String(10000 + (crypto.getRandomValues(new Uint32Array(1))[0] % 90000))
// 보내기 — 5자리 코드와 살아 있는 시간(ms). want = 먼저 뽑아 둔 번호. 실패하면 null
export async function sendByCode(items: MoveItem[], want?: string): Promise<{ code: string; ttl: number } | null> {
  try {
    const r = await post({ bundle: await pack(items), code: want })
    const j = await r.json().catch(() => null)
    return r.ok && j?.code ? { code: String(j.code), ttl: Number(j.ttl) || MOVE_TTL } : null
  } catch { return null }
}
// 아이디로 두기(새로 만들거나, 이 기기가 만든 아이디면 덮어쓴다) — 'ok' | 'taken'(다른 기기가 쓰는 아이디) | 'fail'
export async function sendById(id: string, items: MoveItem[]): Promise<'ok' | 'taken' | 'fail'> {
  try {
    const mine = readIds(), had = mine.find((a) => same(a.id, id))
    const r = await post({ bundle: await pack(items), id: had?.id ?? id, token: had?.token })
    if (r.status === 409) return 'taken'
    const j = await r.json().catch(() => null)
    if (!r.ok || !j?.token) return 'fail'
    writeIds(had ? mine.map((a) => (a === had ? { id: a.id, token: j.token } : a)) : [...mine, { id, token: j.token }])
    return 'ok'
  } catch { return 'fail' }
}
// 지우기 — 서버에서 곧바로 없어져 누구나 그 아이디를 새로 쓸 수 있다. 서버가 남의 것이라 하면(열쇠가 맞지 않음) 목록에서만 뺀다
export async function removeId(id: string): Promise<boolean> {
  const mine = readIds(), a = mine.find((x) => same(x.id, id))
  if (a) {
    try {
      const r = await post({ id: a.id, token: a.token }, 'DELETE')
      if (!r.ok && r.status !== 403) return false
    } catch { return false }
  }
  writeIds(mine.filter((x) => x !== a))
  return true
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
