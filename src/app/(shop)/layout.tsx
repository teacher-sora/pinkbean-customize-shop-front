// 앱 본문(ShopHome)은 이 레이아웃에 한 번만 놓는다. 탭마다 주소가 있지만(/, /search, /info, /preset, /plaza, 공유 링크용 /share)
// 그 페이지들은 메타만 내고 본문은 비어 있다 — 어느 주소로 들어오든, 주소 사이를 오가든 앱은 다시 뜨지 않는다.
import ShopHome from '@/components/ShopHome'
import { DATA_BASE } from '@/lib/core/data'
import { DEFAULT_EQUIP, DEFAULT_TONE } from '@/lib/shopData'

// 첫 화면에 필요한 데이터를 **앱 코드가 도착하기 전에** 받기 시작한다. 이 스크립트는 HTML 을 읽는 즉시 돌므로, 앱 코드를 내려받아
// 실행하는 동안(수백 ms) CDN 왕복이 함께 진행된다. 받은 것은 window.__pbBoot 에 주소별 약속으로 두고 lib/core/data 의 로더가
// 한 번씩 가져다 쓴다(없거나 실패하면 로더가 평소대로 받는다 — 여기서 틀려도 느려질 뿐 깨지지 않는다).
//  · 미리보기 캐릭터가 먼저다: 고른 프리셋의 착용 아이템 meta(없으면 기본 코디)와 그 부위의 목록은 보통 우선순위로,
//    목록 화면만 쓰는 나머지 부위 목록은 **낮은 우선순위**로 요청한다. 한꺼번에 같은 순위로 보내면 느린 회선에서
//    미리보기가 쓰는 목록까지 늦게 온다.
//  · 나머지 부위 목록은 여러 부위를 한 목록으로 보는 탭(전체 · 신규 · 즐겨찾기 — 첫 화면의 기본)일 때만 받는다.
//  · 저장소 키와 기본값은 ShopContext(pb_presets_v1) · lib/uiState(pb_ui_session_v1) · lib/shopData(기본 코디 · 기본 피부)의 것이다.
//  · `no-cache` 는 로더와 같은 이유다(목록은 새로고침하면 반드시 최신). meta 는 로더처럼 브라우저 캐시를 그대로 쓴다.
const DEF_EQUIP = Object.fromEntries(Object.entries(DEFAULT_EQUIP).map(([slot, it]) => [slot, it.id]))
const DEF_TONE = DEFAULT_TONE
const BOOT = `(function(){try{
var B=${JSON.stringify(DATA_BASE.replace(/\/+$/, ''))},b=window.__pbBoot={},F={cache:'no-cache'},L={cache:'no-cache',priority:'low'};
function g(u,o){var p=b[u]=fetch(B+'/'+u,o).then(function(r){if(!r.ok)throw 0;return r.json()});p.catch(function(){});return p}
g('anima.json',F);g('effects/index.json',F);g('catalog/new.json',F);
var c='all';try{var s=JSON.parse(sessionStorage.getItem('pb_ui_session_v1')||'{}');if(typeof s.activeCat==='string')c=s.activeCat}catch(e){}
var eq=${JSON.stringify(DEF_EQUIP)},tone=${DEF_TONE};
try{var P=JSON.parse(localStorage.getItem('pb_presets_v1')),S=P&&P.data&&P.data[P.sel||'d0'];if(S&&S.equipped){eq=S.equipped;if(typeof S.tone==='number')tone=S.tone}}catch(e){}
for(var k in eq)if(typeof eq[k]==='string'&&eq[k]&&k!=='riding')g('meta/'+eq[k]+'.json');
g('index.json',F).then(function(x){
var m=c==='all'||c==='new'||c==='fav';
(x.slots||[]).forEach(function(s){if(!s.file||b[s.file])return;if(eq[s.slot])g(s.file,F);else if(m)g(s.file,L)});
var t=(x.base&&x.base.tones)||[],e=null,d=null;for(var i=0;i<t.length;i++){if(t[i].tone===tone)e=t[i];if(t[i].tone===${DEF_TONE})d=t[i]}
[e,d].forEach(function(y){if(y){if(!b['meta/'+y.body+'.json'])g('meta/'+y.body+'.json');if(!b['meta/'+y.head+'.json'])g('meta/'+y.head+'.json')}})
}).catch(function(){})
}catch(e){}})()`.replace(/\n/g, '')

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: BOOT }} />
      <ShopHome />
      {children}
    </>
  )
}
