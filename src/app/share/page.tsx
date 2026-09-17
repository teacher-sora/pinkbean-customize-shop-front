// 공유 링크(/?n=<이름>&c=<코드>) 전용 페이지 — middleware.ts 가 c 가 있는 / 요청만 여기로 rewrite 한다(주소창은 그대로).
// 본문은 홈과 같고, 링크 미리보기(카카오톡·디스코드 등)용 메타만 프리셋 기준으로 바꾼다:
//   og:title = 프리셋 이름 · og:description = 받아가기 안내 · og:image = 복사 시 올린 캐릭터 카드(share/<id>.jpg)
// 홈(/)은 정적 페이지로 남기기 위해 동적 메타를 여기로 분리했다.
import type { Metadata } from 'next'
import { inflateRawSync } from 'zlib'
import ShopHome from '@/components/ShopHome'

const CDN = process.env.NEXT_PUBLIC_DATA_BASE?.startsWith('http') ? process.env.NEXT_PUBLIC_DATA_BASE : 'https://cdn.pinkbean-customize.com'
const SHORT_RE = /^PB-[0-9A-Za-z]{8,12}$/
const DEFAULT_TITLE = '핑크빈 커마샵 코디'
const DESC = '링크를 눌러 이 코디를 미리 보고, 내 프리셋으로 바로 복사해 가세요!'
const YEAR = 60 * 60 * 24 * 365
// 이미지가 없을 때(긴 코드·업로드 실패)는 사이트 기본 카드 — 자식 openGraph 는 부모 것을 통째로 대체하므로 명시해야 한다.
const DEFAULT_IMAGE = { url: 'https://qg2tk4czk48x6wl4.public.blob.vercel-storage.com/pinkbean_embed.png', width: 1536, height: 1024, alt: '핑크빈 커마샵 미리보기', type: 'image/png' }

// 긴 코드 → 프리셋 이름(코드 안의 n). 실패하면 null.
function nameOf(long: string): string | null {
  try {
    const bytes = Buffer.from(long.slice(3), 'base64url')
    const json = long.startsWith('PB2') ? inflateRawSync(bytes).toString('utf8') : long.startsWith('PB1') ? bytes.toString('utf8') : ''
    const n = JSON.parse(json)?.n
    return typeof n === 'string' && n.trim() ? n.trim() : null
  } catch { return null }
}

type Props = { searchParams: Record<string, string | string[] | undefined> }
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() || ''

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const c = one(searchParams.c)
  let name: string | null = null
  let image: string | null = null
  if (SHORT_RE.test(c)) {
    // 짧은 코드·카드 이미지는 immutable 이라 1년 캐시.
    const [code, img] = await Promise.all([
      fetch(`${CDN}/share/${c}`, { next: { revalidate: YEAR } }).then((r) => (r.ok ? r.text() : '')).catch(() => ''),
      fetch(`${CDN}/share/${c}.jpg`, { method: 'HEAD', next: { revalidate: YEAR } }).then((r) => r.ok).catch(() => false),
    ])
    name = code ? nameOf(code.trim()) : null
    if (img) image = `${CDN}/share/${c}.jpg`
  } else if (c) name = nameOf(c)
  const title = (name || one(searchParams.n) || DEFAULT_TITLE).slice(0, 60)
  const images = [image ? { url: image, width: 1200, height: 630, alt: `${title} 코디 미리보기`, type: 'image/jpeg' } : DEFAULT_IMAGE]
  // og:url·canonical 은 공유 링크 자체 — 홈으로 두면 카톡 카드를 눌렀을 때 코드 없이 홈으로 갈 수 있다.
  const q = new URLSearchParams()
  const n = one(searchParams.n)
  if (n) q.set('n', n)
  q.set('c', c)
  const url = `/?${q.toString()}`
  return {
    title: { absolute: title },
    description: DESC,
    robots: { index: false, follow: true }, // 공유 링크는 검색 색인 제외
    alternates: { canonical: url },
    openGraph: { type: 'website', siteName: '핑크빈 커마샵', locale: 'ko_KR', url, title, description: DESC, images },
    twitter: { card: 'summary_large_image', title, description: DESC, images: [images[0].url] },
  }
}

export default function SharePage() {
  return <ShopHome />
}
