// 코디 광장 데이터 — Supabase(테이블 plaza_posts / plaza_likes / plaza_contest_entries + 이미지 버킷).
//  · 운영과 dev 는 **스키마·버킷이 다르다**(운영 public/plaza, 그 외 plaza_dev/plaza-dev). plazaTarget() 참고.
// 저장소를 바꿀 일이 생기면 이 파일만 갈아끼우면 되도록 화면 쪽은 여기 함수만 쓴다.
//  · 사용자 구분 = 익명 로그인(auth.uid()). 계정 없이도 '내 등록'·좋아요·내리기 권한이 RLS 로 막힌다.
//  · 코디는 스냅샷(jsonb) 그대로 담는다 → 카드 18장을 조회 한 번으로 그린다(추가 요청 없음).
//  · 공유 코드(PB-…)는 기존 R2 공유 링크를 그대로 쓴다(링크 복사·카톡 카드 재사용).
//  · 목록은 한 번에 받아 화면에서 거르고 정렬한다(광장 규모가 작고, 검색·필터가 즉시 반응해야 한다).

import { censor } from './safeText'
import { createClient } from '@supabase/supabase-js'
import type { Snapshot } from '@/components/shop/ShopContext'
import { nameMatcher } from '@/lib/nameSearch'
import { plazaSnapshot } from '@/lib/plazaLook'
import { plazaDeviceFp } from '@/lib/plazaDevice'
import { CASH_BGS } from '@/lib/stageBg'

// 광장에 올리는 배경: 기본 제공(피팅룸 · 흰색 · 검은색 · 시스템 · 캐시샵)은 그대로, 직접 올린 그림(id)은 '시스템'(사용자 지시), 없으면 싣지 않는다
const plazaBg = (bg: string | undefined): string | undefined => !bg ? undefined : ['room', 'white', 'black', 'system'].includes(bg) || CASH_BGS.some((c) => c.id === bg) ? bg : 'system'

export type PlazaSort = 'popular' | 'recent'
// combo = 코디 조합(실제 유저 코디 표본 — combo/ComboPanel 이 광장 목록 자리에 든다. 광장 글이 아니다)
export type PlazaFilter = 'all' | 'contest' | 'mine' | 'liked' | 'combo'
export const PLAZA_CONTEST = '블아 코디 대회'
// 대회와 **별개**인 평소 광장. 여기에 대회 출품작까지 섞어 보이면
// '대회 + 그 밖의 전부'처럼 읽힌다. 그래서
// 대회 출품작은 대회 칸에서만 보이고, 등록 폼의 '등록할 곳'과 같은 낱말을 쓴다.
export const PLAZA_OPEN = '자유 코디'
// 대회 출품은 기기(익명 세션)당 3개까지. 진짜 방어선은 DB 트리거다(supabase/0006) — 여기 값은 화면 안내용.
export const PLAZA_CONTEST_MAX = 3
// 대회 기간 — 광장 목록 아래 안내 줄에 그대로 쓴다(대회 필터일 때). 정해지면 '2026.10.01 ~ 10.31' 처럼 적는다.
export const PLAZA_CONTEST_PERIOD: string | null = '10월 1일 오후 11시 59분까지'
// 마감 시각 — 이 순간부터 대회 **출품**이 막히고 등록할 곳에서 대회가 빠진다. **DB 가 진짜 방어선**(supabase/0011 plaza_contest_deadline)이고
// 여기 값은 화면 안내용이다. 바꿀 땐 둘 다 바꾼다.
// 좋아요는 마감 뒤에도 누를 수 있다(supabase/0015) — 순위는 plaza_awards 로 고정돼 좋아요 수가 바뀌어도 맨 앞 순서는 그대로다.
export const PLAZA_CONTEST_DEADLINE = Date.parse('2026-10-02T00:00:00+09:00')
export const plazaContestClosed = () => Date.now() >= PLAZA_CONTEST_DEADLINE
export const PLAZA_FILTERS: { id: PlazaFilter; label: string }[] = [
  { id: 'all', label: PLAZA_OPEN },
  { id: 'contest', label: '블아 대회' },
  { id: 'mine', label: '내 등록' },
  { id: 'liked', label: '찜한 코디' },
  { id: 'combo', label: '코디 조합' },
]
// 대회 수상(supabase/0014 plaza_awards) — 누가 받았는지는 운영자가 DB 에 직접 넣는다. 앱에는 쓰는 화면도 권한도 없다.
//  seq = 대회 칸 맨 앞에 놓이는 순서(1위 · 2위 · 3위 · 픽 · 픽 · 추첨). 배지 글자는 여기 한 곳에서만 정한다.
export type PlazaAwardKind = 'rank1' | 'rank2' | 'rank3' | 'pick' | 'lucky'
export type PlazaAward = { kind: PlazaAwardKind; seq: number }
export const PLAZA_AWARD_LABEL: Record<PlazaAwardKind, string> = { rank1: '1위', rank2: '2위', rank3: '3위', pick: '주최자 픽', lucky: '추첨' }
export const PLAZA_AWARD_TITLE: Record<PlazaAwardKind, string> = {
  rank1: `${PLAZA_CONTEST} 1위`, rank2: `${PLAZA_CONTEST} 2위`, rank3: `${PLAZA_CONTEST} 3위`,
  pick: '주최자가 인상 깊어서 고른 코디', lucky: '참여자 추첨 당첨',
}
export const PLAZA_TAG_MAX = 10 // DB 체크도 10(supabase/0009)
export const PLAZA_COMMENT_MAX = 200
const PAGE_ROWS = 1000 // Supabase 한 번 응답 최대 행 수(max_rows) — 목록은 이 단위로 끝까지 받는다
const COMMENT_LIMIT = 200

// 참고 이미지를 처음 열었을 때 보일 자리(올린 사람이 등록 때 고른다, image_view 열). 원본은 자르지 않는다.
//  fx·fy = 그림에서 칸 가운데에 올 점(0~1) · zc = 칸을 꽉 채우는 배율(cover) 대비 배율.
export type RefView = { fx: number; fy: number; zc: number }

export type PlazaPost = {
  id: string
  createdAt: string
  owner: string            // 익명 uid. 댓글에서 '글쓴이'를 가려내는 데 쓴다(이미 목록 응답에 들어 있던 값)
  name: string
  description: string
  tags: string[]
  snapshot: Snapshot
  shareCode: string | null
  imageUrl: string | null
  imagePath: string | null   // 글을 내릴 때 이미지도 같이 지우려면 경로가 필요하다
  contest: boolean
  contestNo: number | null  // 대회 등록 순번(선착 표시)
  award: PlazaAward | null  // 대회 수상(없으면 null)
  imageView: RefView | null
  likes: number
  liked: boolean
  mine: boolean
}

export type PlazaDraft = {
  name: string
  description: string
  tags: string[]
  snapshot: Snapshot
  shareCode: string | null
  contest: boolean
  email: string
  image: File | null
  imageView: RefView | null
}

const URL_ENV = process.env.NEXT_PUBLIC_SUPABASE_URL
const KEY_ENV = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
export const plazaConfigured = () => !!(URL_ENV && KEY_ENV)

// ── dev / 운영 데이터 분리 ──
// 무료 플랜이 조직당 프로젝트 2개까지라 프로젝트를 더 만들 수 없어서, 같은 프로젝트 안에서
// 스키마와 버킷을 나눴다(supabase/0003_plaza_dev.sql). 테이블 이름·구조는 양쪽이 같다.
// 고르는 기준은 **호스트**다 — 환경변수를 빠뜨리면 dev 가 운영 데이터를 건드리게 되므로,
// '운영 도메인일 때만 운영'으로 두어 실수가 안전한 쪽으로 떨어지게 한다.
const PROD = { schema: 'public', bucket: 'plaza' }
const DEV = { schema: 'plaza_dev', bucket: 'plaza-dev' }
const PROD_HOST = /^(www\.)?pinkbean-customize\.com$/
function plazaTarget() {
  const forced = process.env.NEXT_PUBLIC_PLAZA_TARGET // 'prod' 로 두면 강제(필요할 때만)
  if (forced) return forced === 'prod' ? PROD : DEV
  if (typeof window !== 'undefined' && PROD_HOST.test(window.location.hostname)) return PROD
  return DEV
}
// 목록 라우트도 같은 규칙으로 고른다. 서버가 호스트를 읽지 않아야 정적으로 캐시되고,
// 그래야 무효화가 엣지까지 즉시 닿는다(app/api/plaza/[target]/route.ts 주석 참고).
const targetName = () => (plazaTarget() === PROD ? 'prod' : 'dev')

// 스키마가 실행 환경에 따라 정해지므로 제네릭을 'public' 으로 못 박지 않는다.
const makeClient = () => createClient(URL_ENV!, KEY_ENV!, {
  auth: { persistSession: true, autoRefreshToken: true },
  db: { schema: plazaTarget().schema },
})
let client: ReturnType<typeof makeClient> | null = null
function sb() {
  if (!plazaConfigured()) return null
  if (!client) client = makeClient()
  return client
}

// 익명 로그인 세션(없으면 만든다). 실패하면 null — 읽기는 되고 쓰기만 막힌다.
let authP: Promise<string | null> | null = null
export function plazaAuth(): Promise<string | null> {
  if (authP) return authP
  const c = sb()
  if (!c) return Promise.resolve(null)
  authP = (async () => {
    const { data } = await c.auth.getSession()
    if (data.session?.user?.id) return data.session.user.id
    const { data: made, error } = await c.auth.signInAnonymously()
    if (error) return null
    return made.user?.id ?? null
  })().catch(() => null)
  // 실패(가입 한도 초과 등)는 붙잡아 두지 않는다 — 다음에 부를 때 다시 시도한다(새로고침 없이 한도가 풀리면 쓰기가 된다).
  // 성공한 세션만 재사용하므로 정상일 때 추가 요청은 없다.
  const p = authP
  void p.then((id) => { if (!id && authP === p) authP = null; else if (id) void linkAlias(c, id) })
  return p
}
// 이 uid 를 이 브라우저에 묶는다(supabase/0021) — 세션 갱신이 실패해 같은 브라우저에서 uid 가 새로 생겨도 이름은 이 브라우저의 첫 이름이다.
// 브라우저 id 는 이 브라우저 저장소에만 있는 무작위 값이다(브라우저 · 기기가 다르면 이름도 다르다 — 사용자 지시).
// 세션마다 한 번. 실패해도 쓰기 · 읽기는 그대로다(이름만 예전처럼 uid 마다).
const BID_KEY = 'pb.bid'
function browserId(): string | null {
  try {
    let v = localStorage.getItem(BID_KEY)
    if (!v || v.length < 16) { v = crypto.randomUUID().replace(/-/g, ''); localStorage.setItem(BID_KEY, v) }
    return v
  } catch { return null }
}
async function linkAlias(c: NonNullable<ReturnType<typeof sb>>, uid: string) {
  try {
    const bid = browserId()
    if (!bid) return
    const { data } = await c.rpc('plaza_alias_link', { bid })
    if (typeof data === 'string' && data) aliasCache.set(uid, data)
  } catch { /* 이름 묶기는 없어도 된다 */ }
}

type Row = {
  id: string; created_at: string; owner: string; name: string; description: string
  tags: string[] | null; snapshot: Snapshot; share_code: string | null; image_path: string | null
  contest: boolean; like_count: number; contest_no?: number | null; image_view?: RefView | null
  plaza_awards?: PlazaAward | PlazaAward[] | null // 1:1 이라 객체로 오지만, 관계를 못 읽은 서버는 배열로 준다
}
const toAward = (v: Row['plaza_awards']): PlazaAward | null => {
  const a = Array.isArray(v) ? v[0] : v
  return a && a.kind in PLAZA_AWARD_LABEL ? { kind: a.kind, seq: a.seq } : null
}

const publicUrl = (path: string | null) => {
  const c = sb()
  if (!c || !path) return null
  return c.storage.from(plazaTarget().bucket).getPublicUrl(path).data.publicUrl
}

const toPost = (r: Row, uid: string | null, liked: Set<string>): PlazaPost => ({
  id: r.id,
  createdAt: r.created_at,
  owner: r.owner,
  name: r.name,
  description: r.description || '',
  tags: r.tags || [],
  snapshot: plazaSnapshot(r.snapshot), // 숨김 규칙 이전에 올라온 글도 숨긴 부위는 없는 것으로
  shareCode: r.share_code,
  imageUrl: publicUrl(r.image_path),
  imagePath: r.image_path,
  contest: r.contest,
  contestNo: r.contest_no ?? null,
  award: toAward(r.plaza_awards),
  imageView: r.image_view ?? null,
  likes: r.like_count,
  liked: liked.has(r.id),
  mine: !!uid && r.owner === uid,
})

// 목록 = ISR 캐시(/api/plaza) + 내 좋아요(실시간, 사용자마다 다름). 정렬·검색·필터는 화면에서.
//  목록의 좋아요 수는 캐시값(최대 3분)이라, 화면에 보이는 카드·열린 상세만 몇 초마다 따로 새로 받는다(loadLikeCounts).
//  새 글·내린 글은 쓰기 직후 캐시를 비워(bumpPlazaCache) 다음에 들어오는 사람에게 바로 보인다.

// 쓰기 직후 30초 동안은 이 브라우저만 캐시를 비켜 읽는다.
// 올리자마자 새로고침하는 사람이 자기 글을 못 보는 일이 없어야 한다. localStorage 라 새로고침해도 남는다.
const FRESH_KEY = 'pb:plaza-fresh-until'
const FRESH_MS = 30000
const freshNow = () => {
  try { return Number(localStorage.getItem(FRESH_KEY) || 0) > Date.now() } catch { return false }
}
// 목록 캐시를 비운다. **기다린다** — 비우기가 끝나기 전에 새로고침이 들어가면 옛 응답을 받을 수 있다.
// 느리거나 실패해도 흐름을 막지 않도록 2초에서 끊는다(시간 만료로도 결국 따라온다).
async function bumpPlazaCache(): Promise<void> {
  try { localStorage.setItem(FRESH_KEY, String(Date.now() + FRESH_MS)) } catch { /* 저장 못 해도 계속 */ }
  try {
    await Promise.race([
      fetch(`/api/plaza/revalidate?target=${targetName()}`, { method: 'POST', keepalive: true }).then(() => undefined),
      new Promise<void>((r) => setTimeout(r, 2000)),
    ])
  } catch { /* noop */ }
}

// 전부 받는다: 첫 쪽이 전체 개수를 알려 주면 나머지 쪽(500개씩)을 한꺼번에 받는다(app/api/plaza/shared.ts).
// 쪽 사이에 새 글이 끼면 경계의 글이 두 쪽에 겹칠 수 있어 id 로 한 번 거른다.
async function loadRows(onFirst?: (rows: Row[]) => void): Promise<Row[] | null> {
  try {
    const base = `/api/plaza/${targetName()}`
    const fresh = freshNow()
    const url = (p: number) => (fresh ? `${base}/fresh?p=${p}` : p ? `${base}/${p}` : base)
    const get = async (p: number) => {
      const r = await fetch(url(p), { cache: 'no-store' })
      if (!r.ok) throw new Error('page')
      return (await r.json()) as { posts: Row[]; total: number; pageSize: number }
    }
    const first = await get(0)
    if (!Array.isArray(first?.posts)) return null
    const pages = Math.ceil((first.total || 0) / (first.pageSize || 500))
    if (pages > 1) onFirst?.(first.posts) // 최신 500개를 먼저 보여 주고 나머지는 뒤에서 받는다
    const rest = await Promise.all(Array.from({ length: Math.max(0, pages - 1) }, (_, i) => get(i + 1)))
    const seen = new Set<string>()
    return [first, ...rest].flatMap((j) => j.posts).filter((r) => (seen.has(r.id) ? false : (seen.add(r.id), true)))
  } catch { return null }
}

// 광장의 '맥박' — 글 수와 가장 최근 글의 id 만 Supabase 에 직접 묻는다(응답 수십 바이트, Vercel 을 거치지 않는다).
// 열어 둔 광장은 5초마다 이것만 보고, 바뀌었을 때만 목록 첫 쪽(loadPlazaHead)을 받는다.
// 왜: 5초마다 목록(글 200여 개 · 스냅샷 포함 ≈ 200KB)을 Vercel 에서 받던 것이 Vercel 무료 한도(ISR 읽기 · Fast Origin Transfer)를
// 거의 다 썼다(2026-10, 30일에 8.7GB). 글이 올라오거나 내려가면 수나 맨 앞 id 가 바뀐다.
export async function loadPlazaPulse(): Promise<string | null> {
  const c = sb()
  if (!c) return null
  const { data, count, error } = await c.from('plaza_posts').select('id', { count: 'exact' }).order('created_at', { ascending: false }).order('id').limit(1)
  if (error) return null
  return `${count ?? 0}|${(data as { id: string }[] | null)?.[0]?.id ?? ''}`
}

// 광장을 **열어 둔 사이에** 남이 올리거나 내린 글을 몇 초 안에 보여 준다 — 맥박(loadPlazaPulse)이 바뀌었을 때만 부른다.
// 목록 전체를 다시 받지 않고 **첫 쪽(최신 500개)만** 본다. 엣지 캐시(5분, 등록 · 내리기 때 즉시 비운다)에 걸려 대개 DB 까지 가지 않는다.
// fresh = 캐시를 비켜 읽는다 — 맥박이 본 최신 글이 캐시 응답에 없을 때(비우기 호출이 실패했을 때) 한 번만 쓴다.
// covers = 첫 쪽이 전체를 담고 있는가 — 담고 있으면 이 응답만으로 '내려간 글'도 가려낼 수 있다.
export async function loadPlazaHead(fresh = false): Promise<{ posts: PlazaPost[]; covers: boolean; total: number } | null> {
  if (!sb()) return null
  try {
    const base = `/api/plaza/${targetName()}`
    const r = await fetch(fresh || freshNow() ? `${base}/fresh?p=0` : base, { cache: 'no-store' })
    if (!r.ok) return null
    const j = (await r.json()) as { posts: Row[]; total: number; pageSize: number }
    if (!Array.isArray(j?.posts)) return null
    const uid = await plazaAuth()          // 캐시된 세션 — 첫 로그인 뒤로는 왕복이 없다
    const liked = new Set<string>(meCache?.liked || [])
    return { posts: j.posts.map((row) => toPost(row, uid, liked)), covers: (j.total || 0) <= j.posts.length, total: j.total || 0 }
  } catch { return null }
}

// onFirst: 글이 500개를 넘을 때, 첫 쪽(최신 500개)이 오자마자 먼저 부른다 — 나머지를 기다리지 않고 화면을 채운다.
export async function loadPlaza(onFirst?: (posts: PlazaPost[]) => void): Promise<PlazaPost[]> {
  const c = sb()
  if (!c) return []
  // 목록은 로그인과 **무관**하다(공개 읽기). 익명 세션을 기다렸다가 받기 시작하면 왕복이 한 번 더 늘어
  // 광장 탭만 유독 늦게 뜬다 — 둘을 동시에 시작한다.
  const meP = plazaAuth().then((u) => (u ? plazaMe() : null)).catch(() => null)
  const rowsP = loadRows(onFirst && ((rows) => {
    // 좋아요 표시는 내 상태가 오면 채운다(먼저 온 쪽을 붙잡지 않는다 — 대개 이미 와 있다).
    void Promise.race([meP, new Promise<null>((r) => setTimeout(() => r(null), 300))])
      .then((me) => onFirst(rows.map((r) => toPost(r, null, new Set(me?.liked || [])))))
  }))
  const uid = await plazaAuth()
  const [cached, me] = await Promise.all([rowsP, meP])
  const liked0 = new Set<string>(me?.liked || [])
  if (cached) return cached.map((r) => toPost(r, uid, liked0))
  // ISR 라우트가 없거나 실패하면 Supabase 에서 직접 읽는다(로컬·장애 대비).
  const rows: Row[] = []
  for (let from = 0; ; from += PAGE_ROWS) {
    const res = await c.from('plaza_posts').select('*,plaza_awards(kind,seq)').order('created_at', { ascending: false }).order('id').range(from, from + PAGE_ROWS - 1)
    if (res.error) throw res.error
    rows.push(...(res.data as Row[]))
    if ((res.data || []).length < PAGE_ROWS) break
  }
  return rows.map((r) => toPost(r, uid, liked0))
}

// 이 기기의 상태 — 좋아요한 글(이 기기 또는 이 브라우저가 누른 것), 이 기기가 올린 대회 출품 수(supabase/0011 plaza_me).
// 기기 기준이라 시크릿 창에서 들어와도 이미 누른 하트가 켜져 보이고, 대회 남은 개수도 같다.
let meCache: { liked: string[]; contest: number } | null = null
export async function plazaMe(): Promise<{ liked: string[]; contest: number } | null> {
  const c = sb()
  if (!c || !(await plazaAuth())) return null
  const { data, error } = await c.rpc('plaza_me', { fp: plazaDeviceFp() })
  if (error) return meCache
  meCache = data as { liked: string[]; contest: number }
  return meCache
}
// 보이는 글들의 좋아요 수만 새로 받는다(목록 캐시와 별개 — 남이 누른 좋아요를 몇 초 안에 보이게).
// 화면에 있는 카드·열린 상세만 묻기 때문에 응답이 작다(18개 ≈ 1KB).
export async function loadLikeCounts(ids: string[]): Promise<Map<string, number>> {
  const c = sb()
  const out = new Map<string, number>()
  if (!c || !ids.length) return out
  const { data, error } = await c.from('plaza_posts').select('id,like_count').in('id', ids)
  if (error) return out
  for (const r of (data || []) as { id: string; like_count: number }[]) out.set(r.id, r.like_count)
  return out
}
// 이 스냅샷과 착용·피부가 같은 대회 출품작만(‘같은 조합’ 확인용 — supabase/0010). 착용이 다르면 어차피 다른 조합이라,
// DB 가 지문 색인(look_key)으로 골라 준다 — 출품작이 수만 개여도 몇 개만 받는다(5만 행 실측 0.05ms).
// 목록 캐시(ISR·최근 300개)를 거치지 않아 방금 올라온 출품작도 빠지지 않는다.
export async function contestCandidates(snap: Snapshot): Promise<{ id: string; name: string; snapshot: Snapshot }[]> {
  const c = sb()
  if (!c) return []
  const { data, error } = await c.rpc('plaza_contest_candidates', { s: snap })
  if (error) throw error
  return (data || []) as { id: string; name: string; snapshot: Snapshot }[]
}

export async function createPlazaPost(d: PlazaDraft): Promise<PlazaPost> {
  const c = sb()
  if (!c) throw new Error('supabase not configured')
  const uid = await plazaAuth()
  if (!uid) throw new Error('auth failed')
  let imagePath: string | null = null
  if (d.image) {
    const ext = (d.image.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '') || 'png'
    const path = `${uid}/${Date.now()}.${ext}`
    const up = await c.storage.from(plazaTarget().bucket).upload(path, d.image, { cacheControl: '31536000', upsert: false })
    if (up.error) throw up.error
    imagePath = path
  }
  // 등록은 RPC 한 번(supabase/0011) — 좋아요 수·작성 시각·순번은 서버가 정하고, 대회 출품은 이메일과 한 트랜잭션이다
  // (이메일 저장이 따로 실패해 이메일 없는 출품작이 생기던 틈을 막는다). 기기 제한·마감도 여기서 걸린다.
  const ins = await c.rpc('plaza_submit', {
    p: {
      name: d.name, description: d.description, tags: d.tags, snapshot: { ...d.snapshot, bg: plazaBg(d.snapshot.bg) }, share_code: d.shareCode, // 배경은 메타로 함께(상세가 깐다) — 직접 올린 그림은 이 브라우저에만 있어 '시스템'으로
      image_path: imagePath, image_view: imagePath ? d.imageView : null, contest: d.contest,
    },
    email: d.contest ? d.email : null,
    fp: plazaDeviceFp(),
  }).single()
  if (ins.error) {
    // 대회 제한처럼 사용자가 알아야 하는 사유는 그대로 올려보낸다.
    // 글이 안 만들어졌으니 방금 올린 이미지는 주인 없는 파일이 된다 — 같이 치운다.
    if (imagePath) await c.storage.from(plazaTarget().bucket).remove([imagePath]).catch(() => undefined)
    throw new Error(ins.error.message || '등록에 실패했어요')
  }
  const row = ins.data as Row
  if (d.contest && meCache) meCache = { ...meCache, contest: meCache.contest + 1 }
  await bumpPlazaCache()
  return toPost(row, uid, new Set())
}

// 좋아요 누르기/취소 — 서버가 기기 기준으로 판정한다(이 기기가 이미 눌렀으면 어느 창에서든 취소가 된다).
// 돌려받은 실제 상태·수로 화면을 맞춘다.
export async function togglePlazaLike(post: PlazaPost): Promise<{ liked: boolean; likes: number }> {
  const c = sb()
  if (!c) throw new Error('supabase not configured')
  const uid = await plazaAuth()
  if (!uid) throw new Error('auth failed')
  const { data, error } = await c.rpc('plaza_toggle_like', { pid: post.id, fp: plazaDeviceFp() })
  if (error) throw new Error(error.message)
  const r = data as { liked: boolean; likes: number }
  if (meCache) meCache = { ...meCache, liked: r.liked ? [...meCache.liked, post.id] : meCache.liked.filter((x) => x !== post.id) }
  return r
}

export async function deletePlazaPost(post: PlazaPost): Promise<void> {
  const c = sb()
  if (!c) throw new Error('supabase not configured')
  const { error } = await c.from('plaza_posts').delete().eq('id', post.id)
  if (error) throw error
  if (post.contest && meCache) meCache = { ...meCache, contest: Math.max(0, meCache.contest - 1) }
  await bumpPlazaCache()
  // 첨부 이미지도 같이 지운다(글만 지우면 버킷에 주인 없는 파일이 쌓인다).
  // 글은 이미 사라졌으니 이미지 삭제가 실패해도 화면 흐름은 막지 않는다.
  if (post.imagePath) await c.storage.from(plazaTarget().bucket).remove([post.imagePath]).catch(() => undefined)
}

// ── 댓글 ──
// 목록(/api/plaza)과 달리 **캐시하지 않는다**. 내가 쓴 댓글이 바로 보이지 않으면 고장으로 느껴진다.
// 상세를 열 때 그 글의 댓글만 읽으므로 양이 적고, 캐시로 아낄 것도 거의 없다.
// 이름은 저장하지 않는다 — 계정이 없어 이름을 받으면 사칭이 된다. 화면에서 글쓴이/나/익명N 으로만 가른다.
export type PlazaComment = {
  id: string
  postId: string
  parentId: string | null   // 답글이면 부모 댓글 id(1단까지 — DB 트리거가 막는다)
  owner: string
  body: string
  createdAt: string
  mine: boolean
  author: boolean   // 글쓴이(그 코디를 올린 사람)가 단 댓글
  canDelete: boolean
}

type CRow = { id: string; post_id: string; parent_id: string | null; owner: string; body: string; created_at: string }

const toComment = (r: CRow, uid: string | null, post: PlazaPost): PlazaComment => ({
  id: r.id,
  postId: r.post_id,
  parentId: r.parent_id,
  owner: r.owner,
  body: r.body,
  createdAt: r.created_at,
  mine: !!uid && r.owner === uid,
  author: r.owner === post.owner,
  // 글 주인은 자기 글에 달린 댓글을 정리할 수 있다(신고 화면이 없는 동안의 최소 장치 — RLS 와 같은 조건).
  canDelete: !!uid && (r.owner === uid || post.owner === uid),
})

// ── 익명 이름 ──
// 로그인을 받지 않으므로 **모두 익명**이다. 다만 '익명 1' 같은 번호는 대화를 따라가기 어렵고 심심하다.
// 이름은 DB 가 사람마다 한 번 정해 plaza_alias 에 적는다(supabase/0017) — 사람끼리는 **겹치지 않는다**.
// 같은 브라우저에서 uid 가 새로 생겨도(세션 갱신 실패) 브라우저 id 로 묶어 그 브라우저의 첫 이름을 그대로 쓴다(supabase/0021, linkAlias).
//  · 수식어 324 × 실제 메이플 몬스터 997 = 약 32만 가지, 0.5% 확률로 몬스터 자리에 보스(이스터에그).
//    낱말 목록은 DB(plaza_priv.alias_adj / alias_noun / alias_boss)에만 있다.
//  · 처음 댓글을 다는 순간 트리거가 정한다. 화면은 댓글을 받을 때 그 사람들의 이름을 함께 받아 aliasCache 에 둔다.
//  · 표에 없는 사람(이름을 정하지 못한 드문 경우)만 예전 방식으로 uid 해시에서 뽑는다(plazaLegacyAlias). 그래서 아주 드물게
//    겹칠 수 있고, 그때는 화면이 꼬리표를 붙인다(plazaAliasTag).
//  ⚠️ 아래 두 목록은 예전 이름 계산용이다. DB 의 plaza_priv.alias_legacy 와 같아야 하므로 바꾸지 않는다.
const ALIAS_ADJ = [
  '씩씩한', '느긋한', '수줍은', '다정한', '조용한', '반짝이는', '상냥한', '엉뚱한',
  '야무진', '명랑한', '차분한', '당당한', '날렵한', '든든한', '의젓한', '재빠른',
  '꼼꼼한', '해맑은', '졸린', '배고픈', '용감한', '새침한', '부지런한', '느릿한',
  '헤네시스의', '엘리니아의', '페리온의', '커닝시티의', '리스항구의', '슬리피우드의', '오르비스의', '엘나스의',
  '루디브리엄의', '아쿠아리움의', '리프레의', '무릉의', '아리안트의', '마가티아의', '에레브의', '리엔의',
]
const ALIAS_NOUN = [
  '핑크빈', '예티', '슬라임', '주황버섯', '파란버섯', '초록버섯', '뿔버섯', '좀비버섯',
  '머쉬맘', '스텀프', '다크스텀프', '리본돼지', '달팽이', '파란달팽이', '빨간달팽이', '스포아',
  '옥토퍼스', '와일드보어', '루팡', '페페', '킹슬라임', '스톤골렘', '이블아이', '커즈아이',
  '루나픽시', '스타픽시', '헥터', '화이트팽', '레드드레이크', '블루와이번', '버블링', '토이트로이',
  '로보', '주니어예티', '쿨리좀비', '레이스', '파이어보어', '아이언호그', '주니어네키', '크로노스',
]
const hash32 = (s: string) => {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) }
  return h >>> 0
}
export function plazaLegacyAlias(uid: string): string {
  const h = hash32(uid)
  return `${ALIAS_ADJ[h % ALIAS_ADJ.length]} ${ALIAS_NOUN[(h >>> 11) % ALIAS_NOUN.length]}`
}
const aliasCache = new Map<string, string>()
export const plazaAlias = (uid: string): string => aliasCache.get(uid) || plazaLegacyAlias(uid)
// 아직 모르는 사람들의 이름을 한 번에 받아 둔다. 실패해도 화면은 예전 이름으로 보인다.
async function fillAliases(owners: string[]): Promise<void> {
  const c = sb()
  const need = Array.from(new Set(owners)).filter((o) => o && !aliasCache.has(o))
  if (!c || !need.length) return
  for (let i = 0; i < need.length; i += 200) {
    const { data } = await c.from('plaza_alias').select('owner,alias').in('owner', need.slice(i, i + 200))
    for (const r of (data || []) as { owner: string; alias: string }[]) aliasCache.set(r.owner, r.alias)
  }
}
// 같은 이름이 한 글에 둘 이상 나올 때만 붙이는 꼬리표.
export const plazaAliasTag = (uid: string) => hash32(`#${uid}`).toString(36).slice(-2).toUpperCase()

export async function loadComments(post: PlazaPost): Promise<PlazaComment[]> {
  const c = sb()
  if (!c) return []
  const uid = await plazaAuth()
  const { data, error } = await c.from('plaza_comments').select('*')
    .eq('post_id', post.id).order('created_at', { ascending: true }).limit(COMMENT_LIMIT)
  if (error) throw error
  await fillAliases((data as CRow[]).map((r) => r.owner)).catch(() => undefined)
  return (data as CRow[]).map((r) => toComment(r, uid, post))
}

export async function addComment(post: PlazaPost, body: string, parentId: string | null = null): Promise<PlazaComment> {
  const c = sb()
  if (!c) throw new Error('supabase not configured')
  const uid = await plazaAuth()
  if (!uid) throw new Error('auth failed')
  const text = body.trim().slice(0, PLAZA_COMMENT_MAX)
  if (!text) throw new Error('empty')
  const { data, error } = await c.from('plaza_comments')
    .insert({ post_id: post.id, parent_id: parentId, owner: uid, body: text }).select('*').single()
  if (error) throw error
  await fillAliases([uid]).catch(() => undefined)   // 첫 댓글이면 방금 트리거가 이름을 정했다
  return toComment(data as CRow, uid, post)
}

export async function deleteComment(comment: PlazaComment): Promise<void> {
  const c = sb()
  if (!c) throw new Error('supabase not configured')
  const { error } = await c.from('plaza_comments').delete().eq('id', comment.id)
  if (error) throw error
}

// ── 화면용 거르기·정렬(이름·설명·태그 검색, 앞의 # 무시) ──
export function plazaView(posts: PlazaPost[], filter: PlazaFilter, query: string, sort: PlazaSort): PlazaPost[] {
  let out = posts
  if (filter === 'all') out = out.filter((p) => !p.contest)   // 대회 출품작은 대회 칸에서만 본다
  else if (filter === 'contest') out = out.filter((p) => p.contest)
  else if (filter === 'mine') out = out.filter((p) => p.mine)
  else if (filter === 'liked') out = out.filter((p) => p.liked)
  // 이름·설명·태그를 코디 탭과 **같은 매처**로 찾는다 — lib/nameSearch:
  //  · 공백 무시("시로 코" ↔ "시로코")
  //  · 한/영 자판 무관: 영문 자판으로 친 "tlfhzh" 가 "시로코" 에 걸린다(en2ko).
  //  · 조합 중인 마지막 글자도 걸린다("시로ㅋ" → "시로코") → 타이핑 도중에도 결과가 끊기지 않는다.
  const q = query.trim().replace(/^#/, '')
  const match = nameMatcher(q)
  if (match) out = out.filter((p) => match(p.name) || match(p.description) || p.tags.some((t) => match(t)))
  const by = sort === 'recent'
    ? (a: PlazaPost, b: PlazaPost) => b.createdAt.localeCompare(a.createdAt)
    : (a: PlazaPost, b: PlazaPost) => b.likes - a.likes || b.createdAt.localeCompare(a.createdAt)
  return plazaPin(out.slice().sort(by), filter)
}
// 대회 칸에서는 수상작이 **어떤 정렬·검색에서도** 맨 앞에 수상 순서대로 온다. 나머지는 받은 순서 그대로.
// 다른 칸(내 등록·찜한 코디)은 건드리지 않는다 — 배지만 보인다.
export function plazaPin(list: PlazaPost[], filter: PlazaFilter): PlazaPost[] {
  if (filter !== 'contest' || !list.some((p) => p.award)) return list
  const won = list.filter((p) => p.award).sort((a, b) => a.award!.seq - b.award!.seq)
  return [...won, ...list.filter((p) => !p.award)]
}

// 등록 시점(상세 부제) — '방금', 'n분 전', 'n시간 전', 'n일 전', 그 이상은 날짜.
export function plazaWhen(iso: string): string {
  const t = new Date(iso).getTime()
  if (!t) return ''
  const m = Math.floor((Date.now() - t) / 60000)
  if (m < 1) return '방금'
  if (m < 60) return `${m}분 전`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}시간 전`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}일 전`
  const dt = new Date(t)
  return `${dt.getMonth() + 1}월 ${dt.getDate()}일`
}

// ── 도움 및 건의함(supabase/0011 · 0013 · 0018 · 0019) ──
// 공지는 운영자가 Supabase 대시보드(Table Editor → plaza_notices)에서 쓴다 — 앱에는 쓰기 화면이 없다. 공지에는 댓글이 없다.
// 건의 · 오류는 같은 표(plaza_notice_comments)에 종류(kind)로 나눠 담는다. 목록은 원글만, 한 쪽에 20개, 최신이 위.
// 글을 열면 그 글의 댓글 · 답글이 나무로 붙는다(depth 1 = 댓글, 2 · 3 = 답글 — 댓글부터 세 단까지. 깊이 · 원글은 DB 트리거가 정한다).
// op = 운영자 글(/suggestion 에서만 켜진다), deleted = 답글이 달린 채 지운 글(자리만 남는다).
export type PlazaNotice = { id: string; createdAt: string; title: string; body: string; pinned: boolean }
export type FeedbackKind = 'idea' | 'bug'
export const FEEDBACK_DEPTH = 3   // 댓글부터 세 단까지(댓글 → 답글 → 답글)
export const NOTICE_PAGE = 20
// 목록의 글 하나. count = 지우지 않은 댓글 · 답글 수, answered = 운영자 댓글이 있다
export type FeedbackPost = { id: string; owner: string; body: string; createdAt: string; mine: boolean; op: boolean; deleted: boolean; count: number; answered: boolean }
export type FeedbackNode = { id: string; owner: string; body: string; createdAt: string; mine: boolean; op: boolean; deleted: boolean; depth: number; children: FeedbackNode[] }
export async function loadNotices(): Promise<PlazaNotice[]> {
  const c = sb()
  if (!c) return []
  const { data, error } = await c.from('plaza_notices').select('id,created_at,title,body,pinned')
    .order('pinned', { ascending: false }).order('created_at', { ascending: false })
  if (error) throw error
  return ((data || []) as { id: string; created_at: string; title: string; body: string; pinned: boolean }[])
    .map((r) => ({ id: r.id, createdAt: r.created_at, title: r.title, body: r.body || '', pinned: r.pinned }))
}
type FbRow = { id: string; owner: string; body: string; created_at: string; op: boolean; deleted: boolean; depth: number; parent_id: string | null; root_id: string | null }
const FB_COLS = 'id,owner,body,created_at,op,deleted,depth,parent_id,root_id'
// 욕설 · 성희롱 낱말은 보여 줄 때도 가린다(lib/safeText) — 올릴 때 가리지만, 그 전에 올라온 글과 앱을 거치지 않고 넣은 글도 있다.
// 운영자 화면(raw)은 원문 그대로다.
const fbBody = (r: FbRow, raw: boolean) => (r.deleted ? '' : raw || r.op ? r.body : censor(r.body))
async function fbPosts(kind: FeedbackKind, from: number, to: number, uid: string | null, raw: boolean): Promise<{ list: FeedbackPost[]; total: number }> {
  const c = sb()
  if (!c) return { list: [], total: 0 }
  const { data, error, count } = await c.from('plaza_notice_comments').select(FB_COLS, { count: 'exact' })
    .eq('kind', kind).is('parent_id', null).order('created_at', { ascending: false }).order('id').range(from, to)
  if (error) throw error
  const rows = (data || []) as FbRow[]
  // 이 쪽 글들의 댓글 수 · 운영자 답변 여부를 한 번에
  const stat = new Map<string, { n: number; op: boolean }>()
  if (rows.length) {
    const { data: rd } = await c.from('plaza_notice_comments').select('root_id,op,deleted').in('root_id', rows.map((r) => r.id)).limit(5000)
    for (const r of (rd || []) as { root_id: string; op: boolean; deleted: boolean }[]) {
      const st = stat.get(r.root_id) || { n: 0, op: false }
      if (!r.deleted) st.n++
      if (r.op && !r.deleted) st.op = true
      stat.set(r.root_id, st)
    }
  }
  await fillAliases(rows.map((r) => r.owner)).catch(() => undefined)
  return {
    total: count ?? 0,
    list: rows.map((r) => ({
      id: r.id, owner: r.owner, body: fbBody(r, raw), createdAt: r.created_at, mine: !!uid && r.owner === uid, op: r.op, deleted: r.deleted,
      count: stat.get(r.id)?.n ?? 0, answered: !!stat.get(r.id)?.op,
    })),
  }
}
// 글 하나의 댓글 · 답글 나무(오래된 순 — 대화 순서대로 읽힌다)
async function fbThread(rootId: string, uid: string | null, raw: boolean): Promise<FeedbackNode[]> {
  const c = sb()
  if (!c) return []
  const { data, error } = await c.from('plaza_notice_comments').select(FB_COLS).eq('root_id', rootId).order('created_at', { ascending: true }).limit(1000)
  if (error) throw error
  const rows = (data || []) as FbRow[]
  await fillAliases(rows.map((r) => r.owner)).catch(() => undefined)
  const nodes = new Map<string, FeedbackNode>()
  for (const r of rows) {
    nodes.set(r.id, { id: r.id, owner: r.owner, body: fbBody(r, raw), createdAt: r.created_at, mine: !!uid && r.owner === uid, op: r.op, deleted: r.deleted, depth: r.depth, children: [] })
  }
  const top: FeedbackNode[] = []
  for (const r of rows) {
    const n = nodes.get(r.id)!
    const p = r.parent_id && r.parent_id !== rootId ? nodes.get(r.parent_id) : undefined
    if (p) p.children.push(n)
    else top.push(n)
  }
  return top
}
export async function loadFeedback(kind: FeedbackKind, page: number) {
  const uid = await plazaAuth()
  return fbPosts(kind, page * NOTICE_PAGE, page * NOTICE_PAGE + NOTICE_PAGE - 1, uid, false)
}
export async function loadFeedbackThread(rootId: string) {
  return fbThread(rootId, await plazaAuth(), false)
}
// 글 올리기(parentId 가 없으면 원글, 있으면 그 글 · 댓글에 다는 댓글 · 답글)
export async function addFeedback(kind: FeedbackKind, body: string, parentId: string | null = null): Promise<void> {
  const c = sb()
  if (!c) throw new Error('supabase not configured')
  const uid = await plazaAuth()
  if (!uid) throw new Error('auth failed')
  const text = censor(body.trim().slice(0, PLAZA_COMMENT_MAX))   // 욕설 · 성희롱 낱말만 가려서 올린다
  if (!text) throw new Error('empty')
  const { error } = await c.from('plaza_notice_comments').insert(parentId ? { owner: uid, body: text, parent_id: parentId } : { kind, owner: uid, body: text })
  if (error) throw error
  await fillAliases([uid]).catch(() => undefined)
}
// 자기 글 지우기 — 답글이 달려 있으면 자리만 남는다(DB 함수)
export async function deleteFeedback(id: string): Promise<void> {
  const c = sb()
  if (!c) throw new Error('supabase not configured')
  const { data, error } = await c.rpc('plaza_fb_remove', { p_id: id })
  if (error) throw error
  if (data !== true) throw new Error('not removed')
}

// ── 운영자용 건의함(/suggestion, supabase/0016 · 0019) ──
// 아이디 · 비밀번호는 DB 함수가 확인한다(앱에는 서비스 키가 없다). 화면은 로그인한 값을 메모리에만 쥐고 부를 때마다 함께 보낸다.
export type OpCred = { id: string; pw: string }
const opRpc = async <T>(fn: string, args: Record<string, unknown>): Promise<T | null> => {
  const c = sb()
  if (!c) throw new Error('supabase not configured')
  const { data, error } = await c.rpc(fn, args)
  if (error) throw error
  return data as T | null
}
export const opLogin = async (cred: OpCred) => (await opRpc<boolean>('plaza_op_login', { p_id: cred.id, p_pw: cred.pw })) === true
// 한 종류(건의 · 오류)의 원글 전부(최신이 위). 운영자 화면이라 가리지 않은 원문 그대로다.
export const opLoadFeedback = async (kind: FeedbackKind) => (await fbPosts(kind, 0, 1999, null, true)).list
export const opLoadThread = (rootId: string) => fbThread(rootId, null, true)
// 운영자 댓글 · 답글(원글이든 댓글이든). 돌려주는 값: 성공 true, 로그인이 틀렸으면(또는 잠겼으면) false
export const opReply = async (cred: OpCred, parentId: string, body: string) =>
  (await opRpc<string>('plaza_op_reply', { p_id: cred.id, p_pw: cred.pw, p_parent: parentId, p_body: body.trim().slice(0, PLAZA_COMMENT_MAX) })) != null
// 지우기(딸린 댓글 · 답글도 함께 지워진다)
export const opDelete = async (cred: OpCred, id: string) =>
  (await opRpc<boolean>('plaza_op_delete', { p_id: cred.id, p_pw: cred.pw, p_comment: id })) != null
