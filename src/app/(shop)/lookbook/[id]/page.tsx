// 아이템 코디 룩북의 주소(/lookbook/<아이템 id>) — 검색엔진에서 아이템 이름으로 찾으면 이 주소로 들어와 그 아이템의 코디 룩북이 바로 열린다(사용자 지시).
// 본문(앱)은 (shop)/layout.tsx 가 그리고, 앱은 이 주소를 보고 코디 광장의 '코디 룩북'에 이 아이템을 골라 연다(ShopContext — lib/tabRoute 가 광장으로 읽는다).
// 이 페이지는 검색엔진이 읽을 것만 낸다: 아이템 이름으로 된 제목 · 설명, 정본 주소, 구조화 데이터, 화면 내용을 글로 옮긴 요약(sr-only — ShopHome 의 요약과 같은 방식).
// 아이템 정보는 CDN meta 한 장 · 코디 수는 룩북 색인(lib/server/lookbook). 하루마다 다시 만든다(ISR).
// 빨리 뜨게(사용자 지시 — 검색에서 들어오자마자 다 보이게): HTML 을 읽는 즉시 이 아이템의 meta · 룩북 색인 · 첫 조각(머리 + 첫 60벌 —
// 서버가 아는 위치로 범위 요청)을 받기 시작한다(레이아웃 BOOT 와 같은 window.__pbBoot, 조각은 window.__pbLook). 앱은 받은 것을 한 번씩 가져다 쓰고
// (lib/core/data · lib/looks), 조각은 실제 색인의 판 · 위치와 같을 때만 쓴다(페이지가 하루 묵어 판이 바뀌었으면 버리고 평소대로 받는다 — 결과가 늘 같다).
// 첫 화면 카드(첫 조각의 앞 18벌)가 입은 아이템의 meta 도 낮은 우선순위로 받는다(서버가 조각을 풀어 id 를 적는다 — 앱 코드 · 그림이 먼저).
// 그 부위 목록은 레이아웃 BOOT 가 보통 우선순위로 받는다(window.__pbSlot — 이 스크립트는 레이아웃 것보다 뒤라 직접 받으면 낮은 순위 요청에 밀린다).
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { CATS } from '@/lib/catalog'
import { SLOT_TO_CAT } from '@/lib/shopData'
import { lookbookIndex, lookbookItem, lookbookWarmIds, type LookbookItem } from '@/lib/server/lookbook'
import { DEFAULT_OG, SITE_NAME, SITE_URL } from '@/lib/siteUrl'
import { DATA_BASE } from '@/lib/core/data'

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
  const { counts, build, entries } = await lookbookIndex()
  return { it, n: counts[id] ?? 0, build, entry: entries[id] ?? null }
}
// 첫 화면 카드 수 — 앱의 미리 받기(ShopContext LOOKBOOK_WARM)와 같다
const WARM = 18

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
  const { it, n, build, entry } = d
  const warm = await lookbookWarmIds(build, entry, WARM)
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
  // 미리 받기(위 머리말). 값은 모두 JSON 으로 넣는다. 어느 하나가 실패해도 앱이 평소대로 받는다
  const boot = `(function(){try{
var B=${JSON.stringify(DATA_BASE.replace(/\/+$/, ''))},b=window.__pbBoot||(window.__pbBoot={}),id=${JSON.stringify(it.id)},sl=${JSON.stringify(it.slot)};
function g(u,o){if(b[u])return;var p=b[u]=fetch(B+'/'+u,o).then(function(r){if(!r.ok)throw 0;return r.json()});p.catch(function(){})}
g('meta/'+id+'.json');g('looks/v2/index.json');
${JSON.stringify(warm)}.forEach(function(w){g('meta/'+w+'.json',{priority:'low'})});
window.__pbSlot=sl;
var v=${JSON.stringify(build)},e=${JSON.stringify(entry)};
if(v&&e&&e[0]>0){var f=e[2],n=e[3]+e[4],p=fetch(B+'/looks/v2/'+v+'/s'+e[1]+'.bin',{headers:{Range:'bytes='+f+'-'+(f+n-1)}}).then(function(r){if(!r.ok)throw 0;return r.arrayBuffer().then(function(a){return r.status===206?a:a.slice(f,f+n)})});p.catch(function(){});window.__pbLook={id:id,build:v,e:e,buf:p}}
}catch(e){}})()`.replace(/\n/g, '')
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: boot }} />
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
