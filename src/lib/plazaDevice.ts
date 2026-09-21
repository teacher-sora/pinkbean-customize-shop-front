// 기기 특징 — 좋아요 1번 · 대회 출품 3개를 **기기** 기준으로 세기 위한 값(2026-09-21 사용자 지시).
//
// 익명 로그인 uid 는 브라우저 저장소에 묶여 시크릿 창·다른 브라우저마다 새로 생긴다. 그래서 서버가 uid 와 별개로
// '기기 키' = HMAC(접속 네트워크 | 이 문자열)을 만든다(supabase/0011 plaza_device_key). 여기 값은 **브라우저가 달라도
// 같아야** 한다 — 크롬·사파리·웨일·시크릿 창에서 같은 기기면 같은 문자열.
//  · 넣는 것: OS 계열 · 터치 여부 · 화면 크기(CSS px, 가로세로 정렬) · 시간대 · GPU 제조사.
//  · 빼는 것: 브라우저마다 다른 값 — UA 의 브라우저 이름, 언어, 코어 수(사파리는 줄여 알린다), 색 깊이,
//    devicePixelRatio(PC 크롬은 확대 배율에 따라 바뀐다), GPU 모델명(사파리는 'Apple GPU' 로 가린다).
// 같은 기종은 이 값이 같다 → 서버가 접속 네트워크를 함께 묶어 전국의 같은 기종이 한 기기가 되지 않게 한다.

let cached: string | null = null

function osFamily(): string {
  const ua = navigator.userAgent
  const touch = (navigator.maxTouchPoints || 0) > 1
  if (/iPhone|iPod/.test(ua)) return 'ios'
  if (/iPad/.test(ua) || (/Macintosh/.test(ua) && touch)) return 'ipados' // 아이패드 사파리는 맥으로 자신을 알린다
  if (/Android/.test(ua)) return 'android'
  if (/Windows/.test(ua)) return 'windows'
  if (/Macintosh|Mac OS X/.test(ua)) return 'mac'
  if (/CrOS/.test(ua)) return 'chromeos'
  if (/Linux/.test(ua)) return 'linux'
  return 'other'
}

function gpuVendor(): string {
  try {
    const c = document.createElement('canvas')
    const gl = (c.getContext('webgl') || c.getContext('experimental-webgl')) as WebGLRenderingContext | null
    if (!gl) return 'none'
    const ext = gl.getExtension('WEBGL_debug_renderer_info')
    const raw = String((ext && gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) || gl.getParameter(gl.RENDERER) || '').toLowerCase()
    gl.getExtension('WEBGL_lose_context')?.loseContext()
    // 모델명은 브라우저마다 달리 적거나 가린다 → 제조사만.
    for (const [k, v] of [['apple', 'apple'], ['nvidia', 'nvidia'], ['geforce', 'nvidia'], ['radeon', 'amd'], ['amd', 'amd'],
      ['intel', 'intel'], ['adreno', 'qualcomm'], ['qualcomm', 'qualcomm'], ['mali', 'arm'], ['powervr', 'imgtec'], ['xclipse', 'samsung']] as const) {
      if (raw.includes(k)) return v
    }
    return raw ? 'other' : 'none'
  } catch { return 'none' }
}

export function plazaDeviceFp(): string {
  if (cached) return cached
  const w = Math.round(screen.width), h = Math.round(screen.height)
  let tz = ''
  try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '' } catch { /* 없음 */ }
  cached = ['v1', osFamily(), (navigator.maxTouchPoints || 0) > 0 ? 't' : 'm', `${Math.max(w, h)}x${Math.min(w, h)}`, tz, gpuVendor()].join('|')
  return cached
}
