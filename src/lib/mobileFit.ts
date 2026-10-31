// 모바일 첫 화면의 맞춤 — 미리보기 높이와 3번째 줄이 보이는 몫을 기기마다 함께 정한다(사용자 지시). 푸터가 사라졌을 때가 기준이다.
//  · 목표: 마네킹이 그림 칸의 52 ~ 56%, 3번째 줄이 30% 이상 보이고, 미리보기는 남는 높이를 가져가되 폭에 맞는 높이의 1.15배를 넘지 않는다(사용자 지시 — 큰 화면에서 미리보기가 화면 절반을 차지했다).
//  · 마네킹은 정수 배율이라 기기 배율로 크기가 정해진다(2.8125 = 45.5px, 3 = 42.7px). 그 크기에서 그림 칸 높이를 거꾸로 구한다.
//    너무 작아지지 않는(MIN_M) 가장 작은 배율을 고른다 — 배율이 크면 카드 폭에 담기는 망토가 줄어든다.
//  · 먼저 가운데 값(그림 칸 54%, 3번째 줄 37.5%)으로 잡고, 미리보기가 폭에 맞는 높이보다 낮으면 3번째 줄 → 그림 칸 순으로 끝값까지 줄여 미리보기를 돌려준다.
//    미리보기가 상한을 넘으면 그 높이를 3번째 줄에 돌려준다 — 3줄이 다 보이는 화면은 다 보이게 두고, 그래도 남으면 줄이 커져 마네킹도 한 배율 커진다. 아주 낮은 화면만 범위를 벗어난다.
//  · 첫 그림 전에 정해야 밀리지 않는다 — 머리 스크립트(MOBILE_FIT_INIT)가 같은 함수를 돌려 <html> 에 값을 넣고, 화면이 바뀌면 applyMobileFit 이 다시 넣는다.
//    함수 본문을 그대로 스크립트로 내보내므로 밖의 이름을 쓰면 안 된다. 스크립트가 못 돌면 globals.css 의 --pb-hero-base 가 받친다.
export function mobileFit(vw: number, svh: number, dpr: number) {
  const HEAD = 165 // 헤더 46 + 머리 묶음 89 + 칸 위 여백 10 + 줄 간격 20
  const FOOT = 53 // 카드에서 그림 칸 아래(이름 줄 + 막대 + 테두리)
  const MIN_M = 38, MIN_H = 168, MAX_H = 300
  const SHARE = 0.54, SHARE_HI = 0.56, PEEK = 0.375, PEEK_LO = 0.3, HERO_OVER = 1.15
  const m = (Math.ceil((MIN_M * dpr) / 64) * 64) / dpr // 마네킹 키(CSS px)
  const want = Math.max(MIN_H, Math.min(MAX_H, vw * (216 / 390))) // 폭에 맞는 미리보기
  const room = svh - HEAD
  const heroOf = (t: number, p: number) => room - (2 + p) * (t + FOOT)
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
  let t = m / SHARE, p = PEEK
  if (heroOf(t, p) < want) {
    p = clamp((room - want) / (t + FOOT) - 2, PEEK_LO, PEEK)
    if (heroOf(t, p) < want) t = clamp((room - want) / (2 + p) - FOOT, m / SHARE_HI, t)
    if (heroOf(t, p) < MIN_H) t = Math.max(36, (room - MIN_H) / (2 + p) - FOOT)
  } else {
    const cap = Math.min(MAX_H, want * HERO_OVER)
    if (heroOf(t, p) > cap) {
      p = Math.min(1, (room - cap) / (t + FOOT) - 2) // 1 = 3줄이 다 보인다
      t = (room - cap) / (2 + p) - FOOT
    }
  }
  return { hero: Math.max(MIN_H, Math.floor(heroOf(t, p))), peek: p, row: t + FOOT }
}

// 머리 스크립트 — 모바일 폭(useBreakpoint ≤ 520)에서만. 100svh 는 재는 막대로 읽는다. --pb-boot-row 는 JS 가 붙기 전의 뼈대(frame/BootMobile)가 쓴다
export const MOBILE_FIT_INIT = `try{if(innerWidth<=520){var d=document.documentElement,b=document.createElement('div');b.style.cssText='position:fixed;visibility:hidden;width:0;height:100vh;height:100svh';d.appendChild(b);var f=(${mobileFit.toString()})(innerWidth,b.offsetHeight,devicePixelRatio||1);b.remove();d.style.setProperty('--pb-hero-base',f.hero+'px');d.style.setProperty('--pb-boot-row',f.row+'px')}}catch(e){}`
