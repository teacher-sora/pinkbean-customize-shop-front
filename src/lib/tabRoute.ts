// 탭 ↔ 주소. 탭을 바꾸면 주소도 바뀌고(뒤로 가기 · 새로고침 · 링크 공유가 그 탭으로 통한다),
// 화면은 주소가 아니라 상태로 갈아 끼운다 — 서버 왕복 없이 바로 바뀐다(ShopContext 의 setPrimary).
// 주소마다 app/(shop)/<이름>/page.tsx 가 있어야 새로고침 · 직접 진입이 된다. 코디 광장은 /share(공유 링크 전용)와 겹치지 않게 /plaza.
export const TAB_PATH: Record<string, string> = { codi: '/', search: '/search', info: '/info', preset: '/preset', share: '/plaza' }
export const TAB_TITLE: Record<string, string> = { search: 'AI 코디 검색', info: '코디 정보 · 염색', preset: '프리셋', share: '코디 광장' }

export function tabOfPath(path: string): string {
  const p = path.replace(/\/+$/, '') || '/'
  for (const [tab, v] of Object.entries(TAB_PATH)) if (v === p) return tab
  return 'codi'
}
