// 아이템 코디 룩북의 주소(/lookbook/<아이템 id>) — 검색엔진에서 아이템 이름으로 찾으면 이 주소로 들어와 그 아이템의 코디 룩북이 바로 열린다(사용자 지시).
// 본문(앱)은 (shop)/layout.tsx 가 그리고, 앱은 이 주소를 보고 코디 광장의 '코디 룩북'에 이 아이템을 골라 연다(ShopContext — lib/tabRoute 가 광장으로 읽는다).
// 이 페이지는 검색엔진이 읽을 것만 낸다: 아이템 이름으로 된 제목 · 설명, 정본 주소, 구조화 데이터, 화면 내용을 글로 옮긴 요약(sr-only — ShopHome 의 요약과 같은 방식).
// 아이템 정보는 CDN meta 한 장 · 코디 수는 룩북 색인(lib/server/lookbook). 하루마다 다시 만든다(ISR).
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { CATS } from '@/lib/catalog'
import { SLOT_TO_CAT } from '@/lib/shopData'
import { lookbookIndex, lookbookItem, type LookbookItem } from '@/lib/server/lookbook'
import { DEFAULT_OG, SITE_NAME, SITE_URL } from '@/lib/siteUrl'

export const revalidate = 86400

type Props = { params: { id: string } }
const slotLabel = (slot: string) => CATS.find((c) => c.id === SLOT_TO_CAT[slot])?.label ?? '아이템'
const gender = (it: LookbookItem) => (it.gender === 0 ? '남' : it.gender === 1 ? '여' : null)
// 설명(검색 결과에 보이는 두 줄) — 조사가 이름에 따라 바뀌지 않게 쓴다
const describe = (it: LookbookItem, n: number) => n > 0
  ? `${it.name} 착용 코디 ${n.toLocaleString()}벌과 자주 쓴 염색을 보고, 내 캐릭터에 바로 입혀 보세요. 메이플 ${slotLabel(it.slot)} 코디 룩북.`
  : `${it.name} 착용 모습을 마네킹과 내 캐릭터로 보고, 염색도 미리 해 보세요. 메이플 ${slotLabel(it.slot)} 코디 룩북.`

async function load(id: string) {
  const it = await lookbookItem(id)
  if (!it) return null
  const { counts } = await lookbookIndex()
  return { it, n: counts[id] ?? 0 }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const d = await load(params.id)
  if (!d) return { title: '코디 룩북', robots: { index: false, follow: true } }
  const title = `${d.it.name} 코디 룩북`
  const description = describe(d.it, d.n)
  const path = `/lookbook/${d.it.id}`
  return {
    title,
    description,
    alternates: { canonical: path, languages: { 'ko-KR': path } },
    // 자식의 openGraph 는 레이아웃 것을 통째로 바꾼다 — 이미지도 다시 적는다
    openGraph: { type: 'website', url: path, siteName: SITE_NAME, locale: 'ko_KR', title: `${title} - ${SITE_NAME}`, description, images: [DEFAULT_OG] },
    twitter: { card: 'summary_large_image', title: `${title} - ${SITE_NAME}`, description, images: [DEFAULT_OG.url] },
  }
}

export default async function Page({ params }: Props) {
  const d = await load(params.id)
  if (!d) notFound()
  const { it, n } = d
  const url = `${SITE_URL}/lookbook/${it.id}`
  const g = gender(it)
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'WebPage', '@id': url, url, name: `${it.name} 코디 룩북`, description: describe(it, n), inLanguage: 'ko-KR', isPartOf: { '@id': `${SITE_URL}/#website` } },
      { '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: SITE_NAME, item: SITE_URL },
        { '@type': 'ListItem', position: 2, name: '코디 룩북', item: `${SITE_URL}/plaza` },
        { '@type': 'ListItem', position: 3, name: it.name, item: url },
      ] },
    ],
  }
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      {/* 화면(앱이 연 이 아이템의 코디 룩북)을 글로 옮긴 요약 — 검색엔진 · 스크린리더용(ShopHome 의 sr-only 요약과 같다) */}
      <section className="sr-only">
        <h2>{it.name} 코디 룩북</h2>
        <p>메이플스토리 {slotLabel(it.slot)}{g ? `(${g})` : ''} 아이템 {it.name} 코디 룩북이에요.</p>
        {n > 0
          ? <p>넥슨 랭킹 캐릭터의 실제 코디 {n.toLocaleString()}벌 가운데 이 아이템을 입은 코디와, 이 아이템에 가장 많이 쓴 염색을 볼 수 있어요.</p>
          : <p>아직 실제 코디 표본에 없는 아이템이라, 기본 마네킹과 내 캐릭터에 입힌 모습과 염색 예시를 보여 줘요.</p>}
        <p>마음에 드는 코디는 [전부 입기]로 내 캐릭터에 바로 입혀 보고, 프리셋에 저장할 수 있어요. 염색 칩을 누르면 그 염색으로 염색 창이 열려요.</p>
      </section>
    </>
  )
}
