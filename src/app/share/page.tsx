// 공유 링크(/?c=<코드>&n=<이름>) 전용 페이지 — middleware.ts 가 c 가 있는 / 요청만 여기로 rewrite 한다(주소창은 그대로).
// 본문은 홈과 같고, 링크 미리보기(카카오톡·디스코드 등)용 메타만 프리셋 기준으로 바꾼다:
//   og:title = 프리셋 이름 · og:description = 받아가기 안내 · og:image = 복사 시 올린 캐릭터 카드(share/<id>.jpg)
// 홈(/)은 정적 페이지로 남기기 위해 동적 메타를 여기로 분리했다.
import type { Metadata } from 'next'
import { inflateRawSync } from 'zlib'
import ShopHome from '@/components/ShopHome'
import { r2, r2Configured } from '@/lib/server/r2'

const CDN = process.env.NEXT_PUBLIC_DATA_BASE?.startsWith('http') ? process.env.NEXT_PUBLIC_DATA_BASE : 'https://cdn.pinkbean-customize.com'
const SHORT_RE = /^PB-[0-9A-Za-z]{8,12}$/
const DEFAULT_TITLE = '핑크빈 커마샵 코디'
// 카카오톡 카드 설명은 한 줄(약 20자)만 보인다 → 짧게.
const DESC = '링크를 눌러 코디를 복사해 가세요!'
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
    // R2 를 직접 읽는다(CDN 은 방금 생긴 객체의 404 를 캐시할 수 있고, Next fetch 캐시도 실패를 굳힌다).
    // 복사 직후 바로 붙여넣어 보내면 백그라운드 업로드보다 스크래핑이 먼저 올 수 있다 → 코드가 나타날 때까지 최대 ~2.5초 대기.
    // 서버는 이미지를 코드보다 먼저 저장하므로, 코드가 보이면 카드 이미지도 준비돼 있다.
    let code = ''
    const deadline = Date.now() + 2500 // 없는 코드로 들어온 사람이 오래 기다리지 않게 전체 대기 상한
    while (r2Configured()) {
      const r = await r2('GET', `share/${c}`).catch(() => null)
      if (r?.ok) { code = (await r.text()).trim(); break }
      if ((r && r.status !== 404) || Date.now() + 400 > deadline) break
      await new Promise((res) => setTimeout(res, 400))
    }
    name = code ? nameOf(code) : null
    if (code && (await r2('HEAD', `share/${c}.jpg`).then((r) => r.ok).catch(() => false))) image = `${CDN}/share/${c}.jpg`
  } else if (c) name = nameOf(c)
  const title = (name || one(searchParams.n) || DEFAULT_TITLE).slice(0, 60)
  const images = [image ? { url: image, width: 1200, height: 630, alt: `${title} 코디 미리보기`, type: 'image/jpeg' } : DEFAULT_IMAGE]
  // og:url·canonical 은 **넣지 않는다**. 홈으로 두면 카톡 카드를 눌렀을 때 코드 없이 홈으로 갈 수 있고, 공유 링크(쿼리 포함)를
  // 넣으려 해도 Next 메타 해석이 쿼리를 떼어낸다(상대경로·URL 객체 모두 실측) → 비워 두면 스크래퍼는 공유된 링크 그대로를 쓴다.
  return {
    title: { absolute: title },
    description: DESC,
    robots: { index: false, follow: true }, // 공유 링크는 검색 색인 제외
    alternates: { canonical: null }, // 레이아웃의 canonical('/') 상속 차단
    openGraph: { type: 'website', siteName: '핑크빈 커마샵', locale: 'ko_KR', title, description: DESC, images },
    twitter: { card: 'summary_large_image', title, description: DESC, images: [images[0].url] },
  }
}

export default function SharePage() {
  return <ShopHome />
}
