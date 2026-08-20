import { type NextRequest, NextResponse } from 'next/server'

// 프리셋 이관 브리지(apex origin 전용 의미). www 페이지가 이 경로를 숨은 iframe 으로 띄우면,
// 이 페이지는 자기(=iframe 이 로드된 origin)의 localStorage 를 읽어 부모(www)로 postMessage 한다.
// - 정상 흐름: middleware 가 apex 의 /pb-migrate 만 리다이렉트 예외로 두므로, iframe 은 apex origin 으로 로드되어
//   apex 의 localStorage(=옛 프리셋)를 읽는다.
// - frame-ancestors 로 www 만 이 페이지를 iframe 에 넣을 수 있게 제한하고, postMessage 대상도 www 로 한정한다.
//   (프리셋은 민감정보가 아니지만, 아무 사이트나 읽어가지 못하게 막는다.)
const WWW_ORIGIN = 'https://www.pinkbean-customize.com'

const HTML = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>preset migrate</title></head>
<body><script>
(function () {
  try {
    var payload = {
      __pb_migrate: 1,
      presets: localStorage.getItem('pb_presets_v1'),
      favorites: localStorage.getItem('pb_favorites_v1')
    };
    if (window.parent && window.parent !== window) window.parent.postMessage(payload, ${JSON.stringify(WWW_ORIGIN)});
  } catch (e) { /* 무해 */ }
})();
</script></body></html>`

export function GET(_req: NextRequest) {
  return new NextResponse(HTML, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      // www 만 이 브리지를 iframe 으로 embed 할 수 있게 제한.
      'Content-Security-Policy': `frame-ancestors ${WWW_ORIGIN}`,
      'Cache-Control': 'no-store',
    },
  })
}
