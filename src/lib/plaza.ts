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
export const PLAZA_CONTEST = '블아 코디 대회'
// 대회 출품은 기기(익명 세션)당 3개까지. 진짜 방어선은 DB 트리거다(supabase/0006) — 여기 값은 화면 안내용.
export const PLAZA_CONTEST_MAX = 3
export const PLAZA_FILTERS: { id: PlazaFilter; label: string }[] = [
  { id: 'all', label: '전체' },
  { id: 'contest', label: '블아 대회' },
  { id: 'mine', label: '내 등록' },
  { id: 'liked', label: '찜한 코디' },
]
export const PLAZA_TAG_MAX = 5
export const PLAZA_COMMENT_MAX = 200
const POST_LIMIT = 300
const COMMENT_LIMIT = 200

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
  owner: r.owner,
  name: r.name,
  description: r.description || '',
  tags: r.tags || [],
  snapshot: r.snapshot,
  shareCode: r.share_code,
  imageUrl: publicUrl(r.image_path),
  imagePath: r.image_path,
  contest: r.contest,
  likes: r.like_count,
  liked: liked.has(r.id),
  mine: !!uid && r.owner === uid,
})

// 목록 = ISR 캐시(/api/plaza) + 내 좋아요(실시간, 사용자마다 다름). 정렬·검색·필터는 화면에서.
//  좋아요 수는 캐시된 값이라 남이 방금 누른 좋아요는 바로 보이지 않는다(의도 — 가장 잦은 변화).
//  새 글·내린 글은 쓰기 직후 캐시를 비워(bumpPlazaCache) 다음에 들어오는 사람에게 바로 보인다.

// 목록 캐시를 즉시 비운다. 실패해도 시간 만료로 따라오니 흐름을 막지 않는다(fire-and-forget).
function bumpPlazaCache(): void {
  try { void fetch('/api/plaza/revalidate', { method: 'POST', keepalive: true }).catch(() => undefined) } catch { /* noop */ }
}

async function loadRows(): Promise<Row[] | null> {
  try {
    const r = await fetch('/api/plaza', { cache: 'no-store' })
    if (!r.ok) return null
    const j = await r.json()
    return Array.isArray(j?.posts) ? (j.posts as Row[]) : null
  } catch { return null }
}

export async function loadPlaza(): Promise<PlazaPost[]> {
  const c = sb()
  if (!c) return []
  // 목록은 로그인과 **무관**하다(공개 읽기). 익명 세션을 기다렸다가 받기 시작하면 왕복이 한 번 더 늘어
  // 광장 탭만 유독 늦게 뜬다 — 둘을 동시에 시작한다(2026-09-20).
  const rowsP = loadRows()
  const uid = await plazaAuth()
  const [cached, likesRes] = await Promise.all([
    rowsP,
    uid ? c.from('plaza_likes').select('post_id').eq('owner', uid) : Promise.resolve({ data: [], error: null } as never),
  ])
  const liked0 = new Set<string>(((likesRes as { data: { post_id: string }[] | null }).data || []).map((l) => l.post_id))
  if (cached) return cached.map((r) => toPost(r, uid, liked0))
  // ISR 라우트가 없거나 실패하면 예전처럼 직접 읽는다(로컬·장애 대비).
  const postsRes = await c.from('plaza_posts').select('*').order('created_at', { ascending: false }).limit(POST_LIMIT)
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
  if (ins.error) {
    // 대회 제한처럼 사용자가 알아야 하는 사유는 그대로 올려보낸다.
    // 글이 안 만들어졌으니 방금 올린 이미지는 주인 없는 파일이 된다 — 같이 치운다.
    if (imagePath) await c.storage.from(plazaTarget().bucket).remove([imagePath]).catch(() => undefined)
    throw new Error(ins.error.message || '등록에 실패했어요')
  }
  const row = ins.data as Row
  if (d.contest && d.email) await c.from('plaza_contest_entries').insert({ post_id: row.id, email: d.email })
  bumpPlazaCache()
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
  bumpPlazaCache()
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
// 익명 uid 를 해시해 메이플다운 이름을 고정으로 뽑는다 — 같은 사람은 어느 글에서나 같은 이름이고,
// 이름에서 uid 를 되짚을 수는 없다. 낱말 조합이 1,600 가지라 드물게 겹치는데,
// 그때만 화면에서 짧은 꼬리표를 붙인다(plazaAliasTag) — 평소에는 이름만 깔끔하게 보인다.
const ALIAS_ADJ = [
  '말랑한', '새침한', '포근한', '나른한', '몽글한', '수줍은', '느긋한', '상냥한',
  '엉뚱한', '야무진', '반짝이는', '소곤대는', '까칠한', '다정한', '장난스런', '조용한',
  '씩씩한', '발랄한', '산뜻한', '촉촉한', '폭신한', '달콤한', '은은한', '아늑한',
  '깜찍한', '담백한', '우아한', '무던한', '똘똘한', '싱그러운', '보송한', '나긋한',
  '홀가분한', '청량한', '따스한', '오동통한', '초롱한', '해맑은', '느릿한', '멋쟁이',
]
const ALIAS_NOUN = [
  '핑크빈', '슬라임', '주황버섯', '파란버섯', '뿔버섯', '스텀프', '리본돼지', '초록달팽이',
  '파란달팽이', '빨간달팽이', '스포아', '옥토퍼스', '예티', '펭귄', '루팡', '와일드보어',
  '좀비버섯', '도로시', '코니', '메이플잎', '별조각', '달빛', '구름', '솜사탕',
  '마시멜로', '캐러멜', '푸딩', '딸기우유', '체리', '복숭아', '라떼', '도넛',
  '마카롱', '단팥빵', '쿠키', '젤리', '사탕', '호박마차', '민트초코', '눈꽃',
]
const hash32 = (s: string) => {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) }
  return h >>> 0
}
export function plazaAlias(uid: string): string {
  const h = hash32(uid)
  return `${ALIAS_ADJ[h % ALIAS_ADJ.length]} ${ALIAS_NOUN[(h >>> 11) % ALIAS_NOUN.length]}`
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
  return toComment(data as CRow, uid, post)
}

export async function deleteComment(comment: PlazaComment): Promise<void> {
  const c = sb()
  if (!c) throw new Error('supabase not configured')
  const { error } = await c.from('plaza_comments').delete().eq('id', comment.id)
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
