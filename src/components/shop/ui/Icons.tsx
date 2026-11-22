// 인라인 SVG 아이콘.

import { css } from '@/lib/style'

type P = { size?: number; className?: string; style?: React.CSSProperties }

export const IconRate = ({ size = 15 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5.5 4.5h13v9.5a4 4 0 0 1-4 4h-5a4 4 0 0 1-4-4z" /><path d="M8.6 20.5h6.8" /><path d="M9.6 9.2l1.6 1.6 3.2-3.2" /></svg>
)
// 공유 이미지: 사진 액자(산 · 해) 위로 나가는 화살표
export const IconShareImage = ({ size = 15 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M13 4.5H6.5a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V11" /><path d="M4.8 16.5l4.2-4 3 2.6 2.4-2.4 5 4.6" /><path d="M16 4.5h4v4M20 4.5l-5.5 5.5" /></svg>
)
// 순서 변경: 위아래로 엇갈린 두 화살표(자리 바꾸기)
export const IconReorder = ({ size = 15 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M8 19.5V4.5M4.5 8 8 4.5 11.5 8" /><path d="M16 4.5v15M12.5 16l3.5 3.5 3.5-3.5" /></svg>
)
// 배경 보기: 액자 안의 풍경(해와 산)
export const IconScene = ({ size = 15 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3.5" y="5" width="17" height="14" rx="2.5" /><circle cx="8.6" cy="9.8" r="1.5" /><path d="M4.5 17l4.6-4.4 3 2.7 3.4-3.6 4 4.2" /></svg>
)
// 시간대: 자동(시계) · 정오(해) · 석양(지는 해) · 자정(달) · 여명(뜨는 해)
const SKY_PATHS: Record<string, JSX.Element> = {
  auto: <><circle cx="12" cy="12" r="8.2" /><path d="M12 7.6V12l3 1.9" /></>,
  noon: <><circle cx="12" cy="12" r="3.9" /><path d="M12 3.4v2M12 18.6v2M3.4 12h2M18.6 12h2M5.9 5.9l1.4 1.4M16.7 16.7l1.4 1.4M5.9 18.1l1.4-1.4M16.7 7.3l1.4-1.4" /></>,
  sunset: <><path d="M7.2 16.5a4.8 4.8 0 0 1 9.6 0" /><path d="M3.5 16.5h17M7 20h10M12 4.5v4.6M9.8 7l2.2 2.2L14.2 7" /></>,
  night: <path d="M19.6 14.3A8 8 0 0 1 9.7 4.4a8 8 0 1 0 9.9 9.9z" />,
  dawn: <><path d="M7.2 16.5a4.8 4.8 0 0 1 9.6 0" /><path d="M3.5 16.5h17M7 20h10M12 9.1V4.5M9.8 6.7 12 4.5l2.2 2.2" /></>,
}
export const IconSky = ({ mode, size = 15 }: P & { mode: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{SKY_PATHS[mode] ?? SKY_PATHS.auto}</svg>
)
// 테마: 시스템(반은 칠한 원 — 밝음 · 어두움을 OS 에 맡긴다) · 라이트(해) · 다크(기운 초승달)
const THEME_PATHS: Record<string, JSX.Element> = {
  system: <><circle cx="12" cy="12" r="8.2" /><path d="M12 3.8a8.2 8.2 0 0 0 0 16.4z" fill="currentColor" /></>,
  light: SKY_PATHS.noon,
  dark: SKY_PATHS.night,
}
export const IconTheme = ({ mode, size = 15 }: P & { mode: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{THEME_PATHS[mode] ?? THEME_PATHS.system}</svg>
)
export const IconChevronLeft = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}><path d="M14.5 5.5 8 12l6.5 6.5" /></svg>
)
export const IconChevronRight = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}><path d="M9.5 5.5 16 12l-6.5 6.5" /></svg>
)
// 검색(입력칸 머리 · 찾기 버튼 공용). 색은 currentColor, bold 는 버튼 글자 옆
export const IconSearch = ({ size = 14, className, bold }: P & { bold?: boolean }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={bold ? 2.2 : 2} strokeLinecap="round"><circle cx="10.5" cy="10.5" r="6" /><path d="M15 15l4.5 4.5" /></svg>
)
export const IconStar = ({ size = 9, className }: P) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><path d="M12 3.6l2.5 5.1 5.6.8-4 3.9.95 5.6L12 16.3l-5.05 2.7.95-5.6-4-3.9 5.6-.8z" /></svg>
)
// 카드 왼쪽 아래 등급 표시 — 콜라보 · 부티크(게임에 그림이 없어 그린다. 마라벨 · 스라벨 리본 · 캐시 동전과 같은 자리 · 같은 크기).
// 분홍 원(currentColor — 다크 모드 색은 CSS 가 준다) 안에 흰 글리프(--pb-mark-fg — 고른 필터 칸에서는 색을 뒤집는다): 콜라보 = 겹친 두 고리(협업 — ×는 지우기 단추로 읽혔다), 부티크 = 선물 상자(부티크 기프트)
export const IconBadgeCollab = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="7.5" fill="currentColor" /><circle cx="6.1" cy="8" r="2.7" fill="none" stroke="var(--pb-mark-fg, #fff)" strokeWidth="1.5" /><circle cx="9.9" cy="8" r="2.7" fill="none" stroke="var(--pb-mark-fg, #fff)" strokeWidth="1.5" /></svg>
)
export const IconBadgeBoutique = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="7.5" fill="currentColor" /><path d="M4 6.2h8v2.1H4zM4.8 8.3h6.4v3.9H4.8z" fill="var(--pb-mark-fg, #fff)" /><path d="M8 6.2v6" stroke="currentColor" strokeWidth="1.2" /><path d="M8 6.1C6.9 4.4 5.2 4.6 5.6 5.6c.3.6 1.4.6 2.4.5M8 6.1c1.1-1.7 2.8-1.5 2.4-.5-.3.6-1.4.6-2.4.5" fill="none" stroke="var(--pb-mark-fg, #fff)" strokeWidth="1.1" strokeLinecap="round" /></svg>
)
export const IconUndo = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 14 4 9l5-5" /><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" /></svg>
)
export const IconRedo = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 14l5-5-5-5" /><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13" /></svg>
)
// 점 위치: 가운데 점 + 네 방향 삼각형(점을 옮긴다). 눈금만 있던 옛 모양은 과녁 · 조준으로 읽혔다(사용자 지적).
// 선 화살표는 13~15px 에서 머리가 뭉개져, 채운 삼각형으로 그린다.
// 점 위치: 조준점(원 + 네 방향 눈금) 가운데에 점. "점을 원하는 자리에 놓는다". 선 굵기와 원 크기는 염색(팔레트)과 같다
export const IconDot = ({ size = 13 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><circle cx="12" cy="12" r="8.4" /><path d="M12 3.6v2.6M12 17.8v2.6M3.6 12h2.6M17.8 12h2.6" /><circle cx="12" cy="12" r="2.2" fill="currentColor" stroke="none" /></svg>
)
export const IconLock = ({ size = 12 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="11" width="14" height="9.5" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
)
export const IconCaretDown = ({ size = 12, className }: P) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9.5l6 6 6-6" /></svg>
)
// 염색(팔레트). 물방울은 물 · 흐림으로 읽혀 염색인 줄 바로 알기 어려웠다
export const IconDrop = ({ size = 14 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d={TAB_ICONS.info} /></svg>
)
export const IconBookmark = ({ filled }: { filled: boolean }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinejoin="round"><path d="M6 3h12v11l-6 4-6-4z" /></svg>
)
export const IconCheck = ({ size = 10 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
)
// 코디 광장: 가져오기(아래로 받기) · 링크 복사 · 내리기(채운 휴지통) · 좋아요(하트)
// 모바일 미리보기 크기(기본 · 크게 · 캐릭터만): 둥근 틀 안을 위에서부터 미리보기 몫만큼 채운다. 선 굵기는 다른 아이콘과 같다
const ViewIcon = ({ size = 15, h }: P & { h: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinejoin="round"><rect x="3.6" y="3.6" width="16.8" height="16.8" rx="3.4" /><rect x="7" y="7" width="10" height={h} rx="1.2" fill="currentColor" stroke="none" /></svg>
)
export const IconViewBase = (p: P) => <ViewIcon {...p} h={3.4} />
export const IconViewWide = (p: P) => <ViewIcon {...p} h={6.4} />
export const IconViewFull = (p: P) => <ViewIcon {...p} h={10} />
// 목록 넘기는 방향: 카드 세 장이 그 방향으로 늘어서고(마지막 장은 옅게 — 더 있다), 나란히 그 방향의 양쪽 화살표(앞뒤로 넘긴다) — '목록이 흐르는 방향'으로 읽힌다
const DirIcon = ({ size = 15, y }: P & { y?: boolean }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    {y ? <>
      <rect x="3.6" y="2.8" width="9" height="5" rx="1.4" fill="currentColor" stroke="none" />
      <rect x="3.6" y="9.5" width="9" height="5" rx="1.4" fill="currentColor" stroke="none" />
      <rect x="3.6" y="16.2" width="9" height="5" rx="1.4" fill="currentColor" stroke="none" opacity=".4" />
      <path d="M18.6 4v16M15.8 7l2.8-3 2.8 3M15.8 17l2.8 3 2.8-3" />
    </> : <>
      <rect x="2.8" y="3.6" width="5" height="9" rx="1.4" fill="currentColor" stroke="none" />
      <rect x="9.5" y="3.6" width="5" height="9" rx="1.4" fill="currentColor" stroke="none" />
      <rect x="16.2" y="3.6" width="5" height="9" rx="1.4" fill="currentColor" stroke="none" opacity=".4" />
      <path d="M4 18.6h16M7 15.8l-3 2.8 3 2.8M17 15.8l3 2.8-3 2.8" />
    </>}
  </svg>
)
export const IconDirX = (p: P) => <DirIcon {...p} />
export const IconDirY = (p: P) => <DirIcon {...p} y />
// 코디 비교 — 나란히 선 두 칸 + 가운데 가르는 선(위아래로 길게). 칸 넷짜리 격자는 프리셋 탭 아이콘과 같아 보여 바꿨다(사용자 지적)
export const IconCompare = ({ size = 15 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="6" width="6.5" height="12" rx="1.5" /><rect x="14.5" y="6" width="6.5" height="12" rx="1.5" /><path d="M12 3v18" /></svg>
)
export const IconTakeDown = ({ size = 14 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 4.5v11m0 0l-4.2-4.2M12 15.5l4.2-4.2M5 19h14" /></svg>
)
// 불러오기 — 사람 + 돋보기(닉네임으로 캐릭터를 찾아 코디를 가져온다). 내려받기(IconTakeDown)와 갈리게 '찾는다'는 꼴(사용자 지시)
export const IconImport = ({ size = 14 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="9.5" cy="7.5" r="3.5" /><path d="M3 20c0-3.6 2.9-6 6.5-6 1.1 0 2.1.2 3 .6" /><circle cx="17" cy="16.5" r="3" /><path d="M19.2 18.7L21.5 21" /></svg>
)
export const IconLinkCopy = ({ size = 14 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="10.5" height="10.5" rx="2" /><path d="M15 6.5V6a1.5 1.5 0 0 0-1.5-1.5H6A1.5 1.5 0 0 0 4.5 6v7.5A1.5 1.5 0 0 0 6 15h.5" /></svg>
)
export const IconTrashSolid = ({ size = 13 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><path d="M6.5 19c0 1.1.9 2 2 2h7c1.1 0 2-.9 2-2V7h-11v12zM18 4h-3.2l-.9-1h-3.8l-.9 1H6v2h12V4z" /></svg>
)
export const IconHeart = ({ filled, size = 14 }: { filled: boolean; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2} strokeLinejoin="round"><path d="M12 19.5s-7-4.6-7-9.2A3.8 3.8 0 0 1 12 8a3.8 3.8 0 0 1 7 2.3c0 4.6-7 9.2-7 9.2z" /></svg>
)
export const IconPlus = ({ size = 14 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5m0 0l-5 5m5-5l5 5" /></svg>
)
// 더하기
export const IconAdd = ({ size = 14 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
)
export const IconClose = ({ size = 14 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
)
const PENCIL = css('stroke: light-dark(#c9a3b5, #7f838e)')
export const IconPencil = ({ className }: P) => (
  <svg className={className} width="10" height="10" viewBox="0 0 24 24" fill="none" style={PENCIL} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M16.5 4.5l3 3L8 19H5v-3z" /></svg>
)
export const IconReset = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4.5 12a7.5 7.5 0 1 0 7.5-7.5 8 8 0 0 0-5.5 2.2L4.5 9" /><path d="M4.5 4.5V9H9" /></svg>
)
export const IconEye = ({ hidden }: { hidden: boolean }) => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d={hidden
      ? 'M3.5 3.5l17 17M10.6 5.1A7.4 7.4 0 0 1 12 5c5 0 8.5 4.6 8.5 7 0 .8-.5 1.9-1.4 3M6.3 7.3C4.5 8.6 3.5 10.5 3.5 12c0 2.4 3.5 7 8.5 7 1.4 0 2.6-.3 3.7-.9'
      : 'M2.6 12S6.2 5.5 12 5.5 21.4 12 21.4 12 17.8 18.5 12 18.5 2.6 12 2.6 12z M12 14.6a2.6 2.6 0 1 0 0-5.2 2.6 2.6 0 0 0 0 5.2z'} />
  </svg>
)
// 탭 아이콘
export const TAB_ICONS: Record<string, string> = {
  codi: 'M12 3.4a2.2 2.2 0 0 0-2.2 2.2c0 .9.6 1.7 1.4 2L4 12.6V18h16v-5.4l-7.2-5a2.2 2.2 0 0 0 1.4-2A2.2 2.2 0 0 0 12 3.4z',
  search: 'M10.5 4.2a6.3 6.3 0 1 0 0 12.6 6.3 6.3 0 0 0 0-12.6zM19.8 19.8l-4.4-4.4',
  info: 'M12 3.6a8.4 8.4 0 1 0 0 16.8c1 0 1.7-.8 1.7-1.7 0-.5-.2-.9-.5-1.2-.3-.3-.4-.7-.4-1.1 0-1 .8-1.7 1.7-1.7h2a4 4 0 0 0 3.9-4c0-3.9-3.8-7.1-8.4-7.1zM7.45 12.3a.45.45 0 1 0 .9 0 .45.45 0 1 0-.9 0zM9.55 8.2a.45.45 0 1 0 .9 0 .45.45 0 1 0-.9 0zM13.95 7.6a.45.45 0 1 0 .9 0 .45.45 0 1 0-.9 0z',
  preset: 'M4.2 4.2h6.2v6.2H4.2zM13.6 4.2h6.2v6.2h-6.2zM4.2 13.6h6.2v6.2H4.2zM13.6 13.6h6.2v6.2h-6.2z',
  share: 'M8.4 9.6a2.6 2.6 0 1 0 0-5.2 2.6 2.6 0 0 0 0 5.2zM16.4 10.4a2.2 2.2 0 1 0 0-4.4 2.2 2.2 0 0 0 0 4.4zM3.4 19.2c0-2.8 2.2-5 5-5s5 2.2 5 5M14.4 14.6c2.2.3 3.9 2.1 3.9 4.4',
  notice: 'M2.8 5.4A2.4 2.4 0 0 1 5.2 3h13.6a2.4 2.4 0 0 1 2.4 2.4v10.2a2.4 2.4 0 0 1-2.4 2.4h-7.2l-5 3.6V18h-1.4a2.4 2.4 0 0 1-2.4-2.4zM10.4 8.3a1.65 1.65 0 1 1 2.35 1.5c-.45.22-.75.58-.75 1.05v.3M12 13.8h.01', // 도움 및 건의함 = 도움(말풍선 속 물음표)
}
export const IconTab = ({ id, size }: { id: string; size: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d={TAB_ICONS[id]} /></svg>
)
// 보기 모델: 아이템(옷걸이 — 입은 사람 없이 아이템만) · 마네킹 · 내 캐릭터(사람 + 하트)
const VIEW_PATHS: Record<string, JSX.Element> = {
  sprite: <><path d="M10.1 6.1a1.9 1.9 0 1 1 2.8 1.7c-.6.3-.9.8-.9 1.4v.5" /><path d="M12 9.7 4.2 15.4c-.9.7-.4 2.1.7 2.1h14.2c1.1 0 1.6-1.4.7-2.1z" /></>,
  model: <><circle cx="12" cy="5.6" r="2.4" /><path d="M8.3 10h7.4l-1 6.2H9.3z" /><path d="M12 16.2v3.9M8.8 20.1h6.4" /></>,
  mymodel: <><circle cx="10.2" cy="7.4" r="3" /><path d="M3.8 19.8v-.6a6.4 6.4 0 0 1 9.6-5.6" /><path d="M17.6 20.4l-3-2.8a1.85 1.85 0 1 1 3-2.2 1.85 1.85 0 1 1 3 2.2z" fill="currentColor" strokeWidth="1.4" /></>,
}
export const IconViewModel = ({ mode, size = 16 }: P & { mode: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>{VIEW_PATHS[mode] ?? VIEW_PATHS.mymodel}</svg>
)
// 도움 및 건의함 탭: 도움(하단 탭과 같은 말풍선 속 물음표) · 건의(전구) · 오류(느낌표 세모) · 공지(확성기).
// 오류 · 도움은 테두리를 칸 가득 키우고 안의 기호를 작게 — 16px 에서도 테두리와 기호가 붙어 보이지 않게
const HP_PATHS: Record<string, JSX.Element> = {
  notice: <path d="M3.6 10.6v3.2l15.8 4.4V6.2L3.6 10.6zM7.2 14.8v2a2.4 2.4 0 0 0 4.7.7" />,
  idea: <><path d="M9 17.5h6" /><path d="M10 20.5h4" /><path d="M12 3.5a5.6 5.6 0 0 0-3.3 10.1c.5.4.8 1 .8 1.6v.3h5v-.3c0-.6.3-1.2.8-1.6A5.6 5.6 0 0 0 12 3.5z" /></>,
  bug: <><path d="M10.2 3.6 2.3 17.9a2.1 2.1 0 0 0 1.8 3.1h15.8a2.1 2.1 0 0 0 1.8-3.1L13.8 3.6a2.1 2.1 0 0 0-3.6 0z" /><path d="M12 10.6v2.9" /><path d="M12 16.9h.01" /></>,
  ask: <path d={TAB_ICONS.notice} />,
}
export const IconHelpTab = ({ tab, size = 16 }: P & { tab: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>{HP_PATHS[tab]}</svg>
)
// 댓글 수(말풍선)
// 채팅 이모티콘 고르기(명찰 · 말풍선 편집).
export const IconSmile = ({ size = 16 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}><circle cx="12" cy="12" r="8.5" /><path d="M8.6 14.2a4.2 4.2 0 0 0 6.8 0" /><path d="M9.2 9.8h.01M14.8 9.8h.01" /></svg>
)
export const IconBubble = ({ size = 13 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}><path d="M4.5 6.5A2 2 0 0 1 6.5 4.5h11a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H11l-4.5 3.5v-3.5a2 2 0 0 1-2-2z" /></svg>
)
// 카테고리 펼친 창의 부위 아이콘(사용자 지시 — 글자만으로는 감이 잘 안 온다. 펼친 창에서만 — 부위 줄은 빼곡해 자리가 없다).
// 메이플 인게임 메뉴(장비 · 훈장 · 소울 컬렉션 · 메이플톡 …)처럼 꽉 찬 단색 실루엣이다 — 선으로 그린 것은 얇고 흐리게 깨져 철회했다(사용자 지시).
// 투명 아이템이 있는 부위는 그 아이콘 모양을 따른다. 모두 정사각에 가까운 비율(길쭉하면 칸마다 크기가 달라 보였다), 한 물건은 한 덩어리(모자의 머리 · 챙이 층져 보였다).
// 구멍은 fillRule evenodd, 겹치는 조각은 path 를 나눈다. 그림의 중심 = 24 칸 중심(재서 0.4 안). 지금은 dev 에서만(CatPicker)
const CAT_PATHS: Record<string, JSX.Element> = {
  all: <path d="M5.5 3.5h3.5a2 2 0 0 1 2 2v3.5a2 2 0 0 1 -2 2h-3.5a2 2 0 0 1 -2 -2v-3.5a2 2 0 0 1 2 -2zM15 3.5h3.5a2 2 0 0 1 2 2v3.5a2 2 0 0 1 -2 2h-3.5a2 2 0 0 1 -2 -2v-3.5a2 2 0 0 1 2 -2zM5.5 13h3.5a2 2 0 0 1 2 2v3.5a2 2 0 0 1 -2 2h-3.5a2 2 0 0 1 -2 -2v-3.5a2 2 0 0 1 2 -2zM15 13h3.5a2 2 0 0 1 2 2v3.5a2 2 0 0 1 -2 2h-3.5a2 2 0 0 1 -2 -2v-3.5a2 2 0 0 1 2 -2z" />, // 전체 — 네 칸
  new: <path fillRule="evenodd" d="M8 3h8a5 5 0 0 1 5 5v8a5 5 0 0 1 -5 5h-8a5 5 0 0 1 -5 -5v-8a5 5 0 0 1 5 -5zM8.6 16.5V7.5h2.1l3.3 5.3V7.5h1.4v9h-2.1L10 11.2v5.3z" />, // 신규 — N 배지(카드의 NEW)
  fav: <path d="M12 3.32L14.53 9.44L21.13 9.95L16.09 14.25L17.64 20.68L12 17.22L6.36 20.68L7.91 14.25L2.87 9.95L9.47 9.44z" />, // 즐겨찾기 — 별
  hair: <path fillRule="evenodd" d="M12 3a8.6 8.3 0 0 0-8.6 8.3v9.2h4.7v-2.5a5 5 0 0 0 7.8 0v2.5h4.7v-9.2A8.6 8.3 0 0 0 12 3zM7.8 11.3c2.6-.1 4.5-1.5 5.4-3.5.8 1.8 1.9 3 3 3.5v2.5a4.2 4.2 0 0 1-8.4 0z" />, // 헤어 — 긴 머리
  plastic: <><g transform="translate(0 -0.5)"><path fillRule="evenodd" d="M12 6.5c4.3 0 7.6 2.6 9.5 6-1.9 3.4-5.2 6-9.5 6s-7.6-2.6-9.5-6c1.9-3.4 5.2-6 9.5-6zM8.4 12.5a3.6 3.6 0 1 0 7.2 0a3.6 3.6 0 1 0 -7.2 0zM10.4 12.5a1.6 1.6 0 1 0 3.2 0a1.6 1.6 0 1 0 -3.2 0z" /></g></>, // 성형 — 눈
  skin: <><path d="M7.8 7.6a4.2 4.2 0 1 0 8.4 0a4.2 4.2 0 1 0 -8.4 0z" /><path d="M3 19.9c0-4.4 4-7.3 9-7.3s9 2.9 9 7.3c0 .4-.3.7-.7.7H3.7a.7.7 0 0 1-.7-.7z" /></>, // 피부 — 사람 윗몸
  cap: <><g transform="translate(-0.35 0.35)"><path d="M2.7 17.2c-.6 0-.9-.7-.5-1.1 1.6-1.5 3.9-2.4 6.6-2.6.1-4.2 3.1-7.4 6.9-7.4 3.9 0 7 3.3 7 7.5v3.6z" /></g></>, // 모자 — 야구모자 한 덩어리(투명 모자)
  faceacc: <><g transform="translate(0 -0.5)"><path fillRule="evenodd" d="M4.2 4c2.6 1 5.1 1.4 7.8 1.4S17.2 5 19.8 4c.6 1.4.9 2.9.9 4.5 0 6.4-3.9 11.4-8.7 12.5C7.2 19.9 3.3 14.9 3.3 8.5c0-1.6.3-3.1.9-4.5zM6.9 10.6c.7-1.3 2.7-1.4 3.6-.2.2.3 0 .7-.4.6-.9-.3-1.8-.2-2.7.2-.4.2-.7-.2-.5-.6zM13.5 10.4c.9-1.2 2.9-1.1 3.6.2.2.4-.1.8-.5.6-.9-.4-1.8-.5-2.7-.2-.4.1-.6-.3-.4-.6zM9.2 14.3c1.7 1.3 3.9 1.3 5.6 0 .3-.2.7.1.5.4-.9 1.6-2.2 2.4-3.3 2.4s-2.4-.8-3.3-2.4c-.2-.3.2-.6.5-.4z" /></g></>, // 얼굴장식 — 웃는 가면(투명 얼굴장식)
  eyeacc: <><path d="M5 7.4h2.4a3.2 3.2 0 0 1 3.2 3.2v2.8a3.2 3.2 0 0 1 -3.2 3.2h-2.4a3.2 3.2 0 0 1 -3.2 -3.2v-2.8a3.2 3.2 0 0 1 3.2 -3.2z" /><path d="M16.6 7.4h2.4a3.2 3.2 0 0 1 3.2 3.2v2.8a3.2 3.2 0 0 1 -3.2 3.2h-2.4a3.2 3.2 0 0 1 -3.2 -3.2v-2.8a3.2 3.2 0 0 1 3.2 -3.2z" /><path d="M10.4 10c1.1-.6 2.1-.6 3.2 0v1.8c-1.1-.6-2.1-.6-3.2 0z" /></>, // 눈장식 — 안경(투명 안경)
  earring: <><g transform="translate(0 1.1)"><path d="M4.9 4.8a1.7 1.7 0 1 0 3.4 0a1.7 1.7 0 1 0 -3.4 0z" /><path d="M5.9 6.2h1.4v2h-1.4z" /><path d="M6.6 8.2c-2.5 3.1-3.6 5.1-3.6 6.9a3.6 3.6 0 0 0 7.2 0c0-1.8-1.1-3.8-3.6-6.9z" /><path d="M15.7 4.8a1.7 1.7 0 1 0 3.4 0a1.7 1.7 0 1 0 -3.4 0z" /><path d="M16.7 6.2h1.4v2h-1.4z" /><path d="M17.4 8.2c-2.5 3.1-3.6 5.1-3.6 6.9a3.6 3.6 0 0 0 7.2 0c0-1.8-1.1-3.8-3.6-6.9z" /></g></>, // 귀고리 — 드롭 귀고리 한 쌍 — 고리는 일루전링과 겹쳤다
  overall: <path d="M8.8 3.4h1.6v3h3.2v-3h1.6v3.4l.9 4 4.3 7.8c.4.8-.2 1.8-1.1 1.8H4.7c-.9 0-1.5-1-1.1-1.8l4.3-7.8.9-4z" />, // 한벌옷 — 끈 원피스
  top: <path d="M8.3 3.2 3.4 6.1c-.5.3-.7.9-.5 1.4l1.4 3.4c.2.5.8.8 1.3.6l1.7-.6v9.2c0 .6.5 1.1 1.1 1.1h7.2c.6 0 1.1-.5 1.1-1.1v-9.2l1.7.6c.5.2 1.1-.1 1.3-.6l1.4-3.4c.2-.5 0-1.1-.5-1.4l-4.9-2.9c-.7 1.6-2 2.5-3.7 2.5S9 4.8 8.3 3.2z" />, // 상의 — 티셔츠
  bottom: <path d="M5.8 3.6h12.4c.6 0 1 .4 1 1l.9 14.8c0 .6-.4 1.1-1 1.1h-4.6c-.5 0-.9-.3-1-.8L12 11.6l-1.5 8.1c-.1.5-.5.8-1 .8H4.9c-.6 0-1-.5-1-1.1l.9-14.8c0-.6.4-1 1-1z" />, // 하의 — 바지
  shoes: <path d="M4.6 3.8h7c.6 0 1 .4 1 1v6.9l5.9 2.6c1.7.8 2.7 2.2 2.7 4v.5c0 1-.8 1.8-1.8 1.8H4.6c-.9 0-1.6-.7-1.6-1.6V5.4c0-.9.7-1.6 1.6-1.6z" />, // 신발 — 부츠(투명 신발)
  gloves: <><g transform="translate(1.45 0.2)"><path d="M8 14.4V7a4 4 0 0 1 8 0v7.4z" /><path d="M8.6 12.8 5.8 10.2a1.8 1.8 0 0 0-2.6 2.5l3.9 3.7h1.5z" /><path d="M8.4 15.8h8.4a1.6 1.6 0 0 1 1.6 1.6v1.6a1.6 1.6 0 0 1-1.6 1.6H8.4a1.6 1.6 0 0 1-1.6-1.6v-1.6a1.6 1.6 0 0 1 1.6-1.6z" /></g></>, // 장갑 — 장갑(투명 장갑)
  cape: <><path d="M4 9.4C4.2 5.4 7.6 3 12 3s7.8 2.4 8 6.4l-2.6-1.2C16.1 6.6 14.2 5.8 12 5.8s-4.1.8-5.4 2.4z" /><path d="M6.8 8.6c1.4-1.2 3.2-1.8 5.2-1.8s3.8.6 5.2 1.8l3 11.4c.2.7-.5 1.3-1.2 1.1-2.3-.7-4.6-1-7-1s-4.7.3-7 1c-.7.2-1.4-.4-1.2-1.1z" /></>, // 망토 — 선 깃 망토(투명 망토)
  weapon: <><path d="M20.8 3.2v4.4l-9.4 9.4-4.4-4.4 9.4-9.4z" /><path d="M4.9 11.4l1.2-1.2 7.7 7.7-1.2 1.2z" /><path d="M7.2 15.4l1.4 1.4-4.4 4.4a1 1 0 0 1-1.4-1.4z" /></>, // 무기 — 검(투명 무기)
  shield: <path fillRule="evenodd" d="M12 3 3.8 5.8v5.9c0 4.4 3.3 7.7 8.2 9.2 4.9-1.5 8.2-4.8 8.2-9.2V5.8zM10.9 7.6h2.2v3.4h3.4v2.2h-3.4v4h-2.2v-4H7.5V11h3.4z" />, // 방패 — 십자 방패(투명 방패)
  pet: <><path d="M3.2 10.4a2.4 2.4 0 1 0 4.8 0a2.4 2.4 0 1 0 -4.8 0z" /><path d="M6.9 5.6a2.4 2.4 0 1 0 4.8 0a2.4 2.4 0 1 0 -4.8 0z" /><path d="M12.3 5.6a2.4 2.4 0 1 0 4.8 0a2.4 2.4 0 1 0 -4.8 0z" /><path d="M16 10.4a2.4 2.4 0 1 0 4.8 0a2.4 2.4 0 1 0 -4.8 0z" /><path d="M12 11.6c-3.4 0-6.6 3.3-6.6 6.2 0 2.1 1.7 3.3 3.6 3.3 1.2 0 2-.6 3-.6s1.8.6 3 .6c1.9 0 3.6-1.2 3.6-3.3 0-2.9-3.2-6.2-6.6-6.2z" /></>, // 펫 — 발자국
  android: <><g transform="translate(0 0.85)"><path fillRule="evenodd" d="M8.4 7.4h7.2a3.8 3.8 0 0 1 3.8 3.8v5.4a3.8 3.8 0 0 1 -3.8 3.8h-7.2a3.8 3.8 0 0 1 -3.8 -3.8v-5.4a3.8 3.8 0 0 1 3.8 -3.8zM7.9 13.4a1.4 1.4 0 1 0 2.8 0a1.4 1.4 0 1 0 -2.8 0zM13.3 13.4a1.4 1.4 0 1 0 2.8 0a1.4 1.4 0 1 0 -2.8 0zM10 16.6h4v1.4h-4z" /><path d="M11.2 4.6h1.6v2.8h-1.6z" /><path d="M10.5 3.4a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0 -3 0z" /><path d="M3.1 11.6h0a0.9 0.9 0 0 1 0.9 0.9v2.8a0.9 0.9 0 0 1 -0.9 0.9h-0a0.9 0.9 0 0 1 -0.9 -0.9v-2.8a0.9 0.9 0 0 1 0.9 -0.9zM20.9 11.6h0a0.9 0.9 0 0 1 0.9 0.9v2.8a0.9 0.9 0 0 1 -0.9 0.9h-0a0.9 0.9 0 0 1 -0.9 -0.9v-2.8a0.9 0.9 0 0 1 0.9 -0.9z" /></g></>, // 안드로이드 — 로봇 얼굴
  ring: <><path fillRule="evenodd" d="M5.6 14.6a6.4 6.4 0 1 0 12.8 0a6.4 6.4 0 1 0 -12.8 0zM8 14.6a4 4 0 1 0 8 0a4 4 0 1 0 -8 0z" /><path d="M12 3.2l3.4 3.1L12 9 8.6 6.3z" /><path d="M4.2 3.2Q4.47 5.33 6.6 5.6Q4.47 5.87 4.2 8Q3.93 5.87 1.8 5.6Q3.93 5.33 4.2 3.2zM19.8 3.2Q20.07 5.33 22.2 5.6Q20.07 5.87 19.8 8Q19.53 5.87 17.4 5.6Q19.53 5.33 19.8 3.2z" /></>, // 일루전링 — 보석 반지 + 반짝임(변신)
  chatring: <path fillRule="evenodd" d="M5.6 3.6h12.8c1.4 0 2.6 1.2 2.6 2.6v8.2c0 1.4-1.2 2.6-2.6 2.6h-6.7l-4.6 3.6c-.4.3-1 0-1-.5v-3.1H5.6C4.2 17 3 15.8 3 14.4V6.2c0-1.4 1.2-2.6 2.6-2.6zM6.9 10.3a1.3 1.3 0 1 0 2.6 0a1.3 1.3 0 1 0 -2.6 0zM10.7 10.3a1.3 1.3 0 1 0 2.6 0a1.3 1.3 0 1 0 -2.6 0zM14.5 10.3a1.3 1.3 0 1 0 2.6 0a1.3 1.3 0 1 0 -2.6 0z" />, // 명찰 / 말풍선 — 말줄임 말풍선(메이플톡)
  title: <><path d="M6 6.2h12v10.2H6z" /><path d="M4.8 8.8H1.4l2.1 3.6-2.1 3.6h4.6v1.8l-1.2-1.4zM19.2 8.8h3.4l-2.1 3.6 2.1 3.6H18v1.8l1.2-1.4z" /></>, // 칭호 — 리본 띠
  medal: <><path d="M5.4 2.8h4.2l3 6.2H8.3z" /><path d="M18.6 2.8h-4.2l-3 6.2h4.3z" /><path fillRule="evenodd" d="M5 14.8a7 7 0 1 0 14 0a7 7 0 1 0 -14 0zM12 11.1L13 13.72L15.8 13.86L13.62 15.63L14.35 18.34L12 16.8L9.65 18.34L10.38 15.63L8.2 13.86L11 13.72z" /></>, // 훈장 — 별 메달(메뉴의 훈장)
  effect: <><path d="M10.4 5.4Q11.32 12.68 18.6 13.6Q11.32 14.52 10.4 21.8Q9.48 14.52 2.2 13.6Q9.48 12.68 10.4 5.4z" /><path d="M18.6 2.2Q18.96 5.04 21.8 5.4Q18.96 5.76 18.6 8.6Q18.24 5.76 15.4 5.4Q18.24 5.04 18.6 2.2z" /></>, // 이펙트 — 반짝임
  soul: <path fillRule="evenodd" d="M12.6 2.6c.5 3.4 6.8 5.8 6.8 11.5a7.4 6.9 0 0 1-14.8 0c0-2.6 1.4-4.5 3-5.7.3 2 1.4 3.2 2.9 3.7-.7-3.3 0-6.8 2.1-9.5zM12 13.2c.3 1.6 3 2.8 3 5.4a3 2.8 0 0 1-6 0c0-1.2.7-2.1 1.4-2.6.2.9.7 1.4 1.3 1.6-.2-1.5 0-3 .3-4.4z" />, // 소울 — 불꽃(메뉴의 소울 컬렉션)
  riding: <><g transform="translate(0 -0.7)"><path fillRule="evenodd" d="M3 16.6v-3.3c0-1.1.7-2 1.7-2.3l1.7-.5 2.1-3.8c.4-.7 1.1-1.1 1.9-1.1h3.2c.8 0 1.5.4 1.9 1.1l2.1 3.8 1.7.5c1 .3 1.7 1.2 1.7 2.3v3.3zM8.8 10.2l1.4-2.6h3.6l1.4 2.6z" /><path d="M4.8 17.2a2.6 2.6 0 1 0 5.2 0a2.6 2.6 0 1 0 -5.2 0z" /><path d="M14 17.2a2.6 2.6 0 1 0 5.2 0a2.6 2.6 0 1 0 -5.2 0z" /></g></>, // 라이딩 — 자동차
  chair: <><path d="M7.8 3.4h8.4a2.2 2.2 0 0 1 2.2 2.2v3.6a2.2 2.2 0 0 1 -2.2 2.2h-8.4a2.2 2.2 0 0 1 -2.2 -2.2v-3.6a2.2 2.2 0 0 1 2.2 -2.2z" /><path d="M4.9 12.2h14.2a1.3 1.3 0 0 1 1.3 1.3v0.4a1.3 1.3 0 0 1 -1.3 1.3h-14.2a1.3 1.3 0 0 1 -1.3 -1.3v-0.4a1.3 1.3 0 0 1 1.3 -1.3z" /><path d="M5.2 15.2h2.4v5.4H5.2zM16.4 15.2h2.4v5.4h-2.4z" /></>, // 의자 — 의자
}
export const IconCat = ({ id, size = 18 }: P & { id: string }) => CAT_PATHS[id] ? (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" style={{ display: 'block', flex: '0 0 auto' }} aria-hidden="true">{CAT_PATHS[id]}</svg>
) : null
