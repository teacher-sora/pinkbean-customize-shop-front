// 공유 링크(/?c=<코드>&n=<이름>) 전용 페이지 — middleware.ts 가 c 가 있는 / 요청만 여기로 rewrite 한다(주소창은 그대로).
// 본문은 홈과 같고, 링크 미리보기(카카오톡·디스코드 등)용 메타만 프리셋 기준으로 바꾼다:
//   og:title = 프리셋 이름 · og:description = 받아가기 안내 · og:image = 복사 시 올린 캐릭터 카드(share/<id>.jpg)
// 홈(/)은 정적 페이지로 남기기 위해 동적 메타를 여기로 분리했다.
import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { permanentRedirect } from 'next/navigation'
import { inflateRawSync } from 'zlib'
import ShopHome from '@/components/ShopHome'
import { r2, r2Configured } from '@/lib/server/r2'

const CDN = process.env.NEXT_PUBLIC_DATA_BASE?.startsWith('http') ? process.env.NEXT_PUBLIC_DATA_BASE : 'https://cdn.pinkbean-customize.com'
const SHORT_RE = /^PB-[0-9A-Za-z]{8,12}$/
const DEFAULT_TITLE = '핑크빈 커마샵 코디'
// 카카오톡 카드 설명은 한 줄(약 20자)만 보인다 → 짧게.
const DESC = '링크를 눌러 코디를 가져와요'
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

// dev 는 공유 저장 경로가 다르다(`share-dev/`) — api/share · lib/shareCode.ts 와 규칙이 같아야 한다.
const sharePrefix = () => {
  const host = (headers().get('host') || '').split(':')[0]
  return /^(www\.)?pinkbean-customize\.com$/.test(host) ? 'share' : 'share-dev'
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const c = one(searchParams.c)
  let name: string | null = null
  let image: string | null = null
  if (SHORT_RE.test(c)) {
    // R2 를 직접 읽는다(CDN 은 방금 생긴 객체의 404 를 캐시할 수 있고, Next fetch 캐시도 실패를 굳힌다).
    // 복사 직후 바로 보내면 백그라운드 업로드(카드 렌더 + 저장, 수 초)보다 스크래핑이 먼저 온다 — 실측: 카톡이 이미지 저장 0.5초 전에
    // 긁어가 기본 카드로 굳음(카톡은 URL 별로 카드를 캐시). 그래서 **이미지** 등장을 최대 ~5초 기다린다.
    // (2026-09-20: 서버 저장 순서를 코드→이미지로 바꿨다. 링크는 즉시 열려야 하고, 기다림은 여기 메타 쪽만 진다.)
    const prefix = sharePrefix()
    const deadline = Date.now() + 5000
    let hasImage = false
    while (r2Configured()) {
      const r = await r2('HEAD', `${prefix}/${c}.jpg`).catch(() => null)
      if (r?.ok) { hasImage = true; break }
      if ((r && r.status !== 404) || Date.now() + 350 > deadline) break
      await new Promise((res) => setTimeout(res, 350))
    }
    if (hasImage) image = `${CDN}/${prefix}/${c}.jpg`
    // 이름은 코드 안의 것을 우선(코드가 먼저 저장된다 — 없으면 링크의 n 으로)
    const got = r2Configured() ? await r2('GET', `${prefix}/${c}`).catch(() => null) : null
    name = got?.ok ? nameOf((await got.text()).trim()) : null
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

// `/share` 는 middleware 가 `/?c=…` 를 넘겨줄 때만 쓰는 **내부 경로**다. 코드 없이 직접 열면
// 홈과 똑같은 내용을 noindex 로 한 벌 더 내보내는 꼴이라(실측 2026-09-24: 200 + `noindex, follow`),
// 구글이 이 주소를 주우면 "NOINDEX 태그에 의해 제외됨"으로 잡힌다. 코드가 없으면 홈으로 보낸다.
// (rewrite 로 들어온 요청은 `c` 를 그대로 들고 오므로 카톡 카드 경로는 영향이 없다.)
export default function SharePage({ searchParams }: Props) {
  if (!one(searchParams.c)) permanentRedirect('/') // 308 — 공개 주소가 아니다
  return <ShopHome />
}
