// 탭 ↔ 주소. 탭을 바꾸면 주소도 바뀌고(뒤로 가기 · 새로고침 · 링크 공유가 그 탭으로 통한다),
// 화면은 주소가 아니라 상태로 갈아 끼운다 — 서버 왕복 없이 바로 바뀐다(ShopContext 의 setPrimary).
// 주소마다 app/(shop)/<이름>/page.tsx 가 있어야 새로고침 · 직접 진입이 된다. 코디 광장은 /share(공유 링크 전용)와 겹치지 않게 /plaza.
export const TAB_PATH: Record<string, string> = { codi: '/', search: '/search', info: '/info', preset: '/preset', share: '/plaza' }
export const TAB_TITLE: Record<string, string> = { search: 'AI 코디 검색', info: '코디 정보 / 염색', preset: '프리셋', share: '코디 광장' }

// 아이템 코디 룩북 주소(/lookbook/<아이템 id> — 검색엔진에서 들어온다, app/(shop)/lookbook). 탭은 코디 광장이고, 광장의 '코디 룩북'에 그 아이템을 골라 연다(ShopContext)
export const LOOKBOOK_PATH = '/lookbook/'
export const lookbookIdOf = (path: string): string | null => /^\/lookbook\/(\d{8})\/?$/.exec(path)?.[1] ?? null

export function tabOfPath(path: string): string {
  const p = path.replace(/\/+$/, '') || '/'
  if (p === '/lookbook' || p.startsWith(LOOKBOOK_PATH)) return 'share'
  for (const [tab, v] of Object.entries(TAB_PATH)) if (v === p) return tab
  return 'codi'
}
