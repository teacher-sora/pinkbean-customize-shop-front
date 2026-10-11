// 앱 본문(ShopHome)은 이 레이아웃에 한 번만 놓는다. 탭마다 주소가 있지만(/, /search, /info, /preset, /plaza, 공유 링크용 /share)
// 그 페이지들은 메타만 내고 본문은 비어 있다 — 어느 주소로 들어오든, 주소 사이를 오가든 앱은 다시 뜨지 않는다.
import ShopHome from '@/components/ShopHome'
import { DATA_BASE } from '@/lib/core/data'

// 목록 데이터를 **앱 코드가 도착하기 전에** 받기 시작한다. 이 스크립트는 HTML 을 읽는 즉시 돌므로, 앱 코드를 내려받아 실행하는
// 동안(수백 ms) CDN 왕복이 함께 진행된다. 받은 것은 window.__pbBoot 에 주소별 약속으로 두고 lib/core/data 의 로더가 한 번씩 가져다 쓴다
// (없거나 실패하면 로더가 평소대로 받는다). 여러 부위를 한 목록으로 보는 탭(전체 · 신규 · 즐겨찾기 — 첫 화면의 기본)이면
// index.json 이 오자마자 부위 목록도 모두 요청한다(보던 탭은 lib/uiState 의 세션 값에서 읽는다). `no-cache` 는 로더와 같은 이유다(새로고침하면 반드시 최신).
const BOOT = `(function(){try{var B=${JSON.stringify(DATA_BASE.replace(/\/+$/, ''))},b=window.__pbBoot={},g=function(u){var p=b[u]=fetch(B+'/'+u,{cache:'no-cache'}).then(function(r){if(!r.ok)throw 0;return r.json()});p.catch(function(){});return p};['anima.json','effects/index.json','catalog/new.json'].forEach(g);var c='all';try{var s=JSON.parse(sessionStorage.getItem('pb_ui_session_v1')||'{}');if(typeof s.activeCat==='string')c=s.activeCat}catch(e){}var i=g('index.json');if(c==='all'||c==='new'||c==='fav')i.then(function(x){(x.slots||[]).forEach(function(s){if(s.file&&!b[s.file])g(s.file)})}).catch(function(){})}catch(e){}})()`

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: BOOT }} />
      <ShopHome />
      {children}
    </>
  )
}
