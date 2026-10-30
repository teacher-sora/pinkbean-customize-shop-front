// 하루 방문자 — 브라우저마다 무작위 id 를 하나 두고, 한국 날짜로 하루에 한 번만 DB 에 적는다(supabase/0023, 운영자 화면 /dashboard 에서 본다).
//  · 망이 바뀌어도 같은 사람이다(IP 를 쓰지 않는다). 기기 · 브라우저가 다르면 다른 사람으로 센다 — 계정이 없어 그 이상은 알 수 없다.
//  · 첫 화면을 조금도 늦추지 않는다: 오늘 이미 적었으면 저장소만 읽고 끝나고, 처음이면 화면이 뜬 뒤 작은 요청 하나를 보낸다.
//    Supabase 라이브러리를 부르지 않는다.
//  · 자동화(navigator.webdriver)는 세지 않는다 — 시험이 수를 부풀리지 않게.
const URL_ENV = process.env.NEXT_PUBLIC_SUPABASE_URL
const KEY_ENV = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const VID_KEY = 'pb_vid', DAY_KEY = 'pb_vday'
const WAIT_MS = 4000
const PROD_HOST = /^(www\.)?pinkbean-customize\.com$/ // lib/plaza 의 plazaTarget 과 같은 규칙 — 운영 도메인일 때만 운영 표

export function recordVisit() {
  if (!URL_ENV || !KEY_ENV || navigator.webdriver) return
  const day = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10) // 한국 날짜
  let vid: string
  try {
    if (localStorage.getItem(DAY_KEY) === day) return
    vid = localStorage.getItem(VID_KEY) || crypto.randomUUID()
    localStorage.setItem(VID_KEY, vid)
  } catch { return } // 저장소를 못 쓰면 같은 사람을 또 세게 되므로 세지 않는다
  const prod = process.env.NEXT_PUBLIC_PLAZA_TARGET ? process.env.NEXT_PUBLIC_PLAZA_TARGET === 'prod' : PROD_HOST.test(location.hostname)
  setTimeout(() => {
    fetch(`${URL_ENV}/rest/v1/rpc/plaza_visit`, {
      method: 'POST', keepalive: true,
      headers: { apikey: KEY_ENV, 'Content-Type': 'application/json', ...(prod ? {} : { 'Content-Profile': 'plaza_dev' }) },
      body: JSON.stringify({ p_vid: vid }),
    }).then((r) => { if (r.ok) try { localStorage.setItem(DAY_KEY, day) } catch { /* 다음에 다시 적어도 한 줄이다 */ } }).catch(() => {})
  }, WAIT_MS)
}
