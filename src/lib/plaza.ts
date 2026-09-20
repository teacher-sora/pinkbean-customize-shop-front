// 코디 광장 데이터 — Supabase(테이블 plaza_posts / plaza_likes / plaza_contest_entries + 이미지 버킷).
//  · 운영과 dev 는 **스키마·버킷이 다르다**(운영 public/plaza, 그 외 plaza_dev/plaza-dev). plazaTarget() 참고.
// 저장소를 바꿀 일이 생기면 이 파일만 갈아끼우면 되도록 화면 쪽은 여기 함수만 쓴다.
//  · 사용자 구분 = 익명 로그인(auth.uid()). 계정 없이도 '내 등록'·좋아요·내리기 권한이 RLS 로 막힌다.
//  · 코디는 스냅샷(jsonb) 그대로 담는다 → 카드 18장을 조회 한 번으로 그린다(추가 요청 없음).
//  · 공유 코드(PB-…)는 기존 R2 공유 링크를 그대로 쓴다(링크 복사·카톡 카드 재사용).
//  · 목록은 한 번에 받아 화면에서 거르고 정렬한다(광장 규모가 작고, 검색·필터가 즉시 반응해야 한다).

import { createClient } from '@supabase/supabase-js'
import type { Snapshot } from '@/components/shop/ShopContext'

export type PlazaSort = 'popular' | 'recent'
export type PlazaFilter = 'all' | 'contest' | 'mine' | 'liked'
export const PLAZA_CONTEST = '봄맞이 코디 대회'
export const PLAZA_FILTERS: { id: PlazaFilter; label: string }[] = [
  { id: 'all', label: '전체' },
  { id: 'contest', label: '봄맞이 대회' },
  { id: 'mine', label: '내 등록' },
  { id: 'liked', label: '찜한 코디' },
]
export const PLAZA_TAG_MAX = 5
const POST_LIMIT = 300

export type PlazaPost = {
  id: string
  createdAt: string
  name: string
  description: string
  tags: string[]
  snapshot: Snapshot
  shareCode: string | null
  imageUrl: string | null
  contest: boolean
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
  return authP
}

type Row = {
  id: string; created_at: string; owner: string; name: string; description: string
  tags: string[] | null; snapshot: Snapshot; share_code: string | null; image_path: string | null
  contest: boolean; like_count: number
}

const publicUrl = (path: string | null) => {
  const c = sb()
  if (!c || !path) return null
  return c.storage.from(plazaTarget().bucket).getPublicUrl(path).data.publicUrl
}

const toPost = (r: Row, uid: string | null, liked: Set<string>): PlazaPost => ({
  id: r.id,
  createdAt: r.created_at,
  name: r.name,
  description: r.description || '',
  tags: r.tags || [],
  snapshot: r.snapshot,
  shareCode: r.share_code,
  imageUrl: publicUrl(r.image_path),
  contest: r.contest,
  likes: r.like_count,
  liked: liked.has(r.id),
  mine: !!uid && r.owner === uid,
})

// 목록 전체 + 내 좋아요. 정렬·검색·필터는 화면에서(즉시 반응).
export async function loadPlaza(): Promise<PlazaPost[]> {
  const c = sb()
  if (!c) return []
  const uid = await plazaAuth()
  const [postsRes, likesRes] = await Promise.all([
    c.from('plaza_posts').select('*').order('created_at', { ascending: false }).limit(POST_LIMIT),
    uid ? c.from('plaza_likes').select('post_id').eq('owner', uid) : Promise.resolve({ data: [], error: null } as never),
  ])
  if (postsRes.error) throw postsRes.error
  const liked = new Set<string>(((likesRes as { data: { post_id: string }[] | null }).data || []).map((l) => l.post_id))
  return (postsRes.data as Row[]).map((r) => toPost(r, uid, liked))
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
  const ins = await c.from('plaza_posts').insert({
    owner: uid, name: d.name, description: d.description, tags: d.tags,
    snapshot: d.snapshot, share_code: d.shareCode, image_path: imagePath, contest: d.contest,
  }).select('*').single()
  if (ins.error) throw ins.error
  const row = ins.data as Row
  if (d.contest && d.email) await c.from('plaza_contest_entries').insert({ post_id: row.id, email: d.email })
  return toPost(row, uid, new Set())
}

export async function togglePlazaLike(post: PlazaPost): Promise<void> {
  const c = sb()
  if (!c) throw new Error('supabase not configured')
  const uid = await plazaAuth()
  if (!uid) throw new Error('auth failed')
  if (post.liked) {
    const { error } = await c.from('plaza_likes').delete().eq('post_id', post.id).eq('owner', uid)
    if (error) throw error
  } else {
    const { error } = await c.from('plaza_likes').insert({ post_id: post.id, owner: uid })
    if (error) throw error
  }
}

export async function deletePlazaPost(post: PlazaPost): Promise<void> {
  const c = sb()
  if (!c) throw new Error('supabase not configured')
  const { error } = await c.from('plaza_posts').delete().eq('id', post.id)
  if (error) throw error
}

// ── 화면용 거르기·정렬(핸드오프 규칙: 이름·설명·태그 검색, 앞의 # 무시) ──
export function plazaView(posts: PlazaPost[], filter: PlazaFilter, query: string, sort: PlazaSort): PlazaPost[] {
  let out = posts
  if (filter === 'contest') out = out.filter((p) => p.contest)
  else if (filter === 'mine') out = out.filter((p) => p.mine)
  else if (filter === 'liked') out = out.filter((p) => p.liked)
  const q = query.trim().replace(/^#/, '')
  if (q) out = out.filter((p) => p.name.includes(q) || p.description.includes(q) || p.tags.some((t) => t.includes(q)))
  const by = sort === 'recent'
    ? (a: PlazaPost, b: PlazaPost) => b.createdAt.localeCompare(a.createdAt)
    : (a: PlazaPost, b: PlazaPost) => b.likes - a.likes || b.createdAt.localeCompare(a.createdAt)
  return out.slice().sort(by)
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
