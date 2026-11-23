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
// 투명 아이템이 있는 부위는 그 아이콘 모양을 따른다. 모두 넓고 낮은 비율(폭 >= 높이, 옷 · 신발 · 귀고리 · 훈장도 — 길쭉해 보인다는 지적), 한 물건은 한 덩어리(모자의 머리 · 챙이 층져 보였다).
// 18 칸 격자 — PC 18px 에서 1:1 이라 곧은 변이 정수 좌표(화면 픽셀 경계)에 떨어져 번지지 않는다(24 칸을 줄이면 끝이 흐렸다 — 사용자 지적).
// 곡선 · 사선뿐인 것(가면 · 귀고리 · 한벌옷 · 망토 · 검 · 방패 · 발자국 · 반지 · 훈장 · 반짝임 · 불꽃 · 자동차)은 24 칸 그림을 0.75 로 줄였다.
// 구멍은 fillRule evenodd, 겹치는 조각은 path 를 나눈다. 그림의 중심 = 칸 중심(재서 0.4 안)
const CAT_PATHS: Record<string, JSX.Element> = {
  all: <path d="M3.5 2h3a1.5 1.5 0 0 1 1.5 1.5v3a1.5 1.5 0 0 1 -1.5 1.5h-3a1.5 1.5 0 0 1 -1.5 -1.5v-3a1.5 1.5 0 0 1 1.5 -1.5zM11.5 2h3a1.5 1.5 0 0 1 1.5 1.5v3a1.5 1.5 0 0 1 -1.5 1.5h-3a1.5 1.5 0 0 1 -1.5 -1.5v-3a1.5 1.5 0 0 1 1.5 -1.5zM3.5 10h3a1.5 1.5 0 0 1 1.5 1.5v3a1.5 1.5 0 0 1 -1.5 1.5h-3a1.5 1.5 0 0 1 -1.5 -1.5v-3a1.5 1.5 0 0 1 1.5 -1.5zM11.5 10h3a1.5 1.5 0 0 1 1.5 1.5v3a1.5 1.5 0 0 1 -1.5 1.5h-3a1.5 1.5 0 0 1 -1.5 -1.5v-3a1.5 1.5 0 0 1 1.5 -1.5z" />, // 전체 — 네 칸
  new: <path fillRule="evenodd" d="M4.5 1h9a3.5 3.5 0 0 1 3.5 3.5v9a3.5 3.5 0 0 1 -3.5 3.5h-9a3.5 3.5 0 0 1 -3.5 -3.5v-9a3.5 3.5 0 0 1 3.5 -3.5zM5 13L5 5L7.44 5L11 10.12L11 5L13 5L13 13L10.56 13L7 7.88L7 13z" />, // 신규 — N 배지 — 사선도 세로 획과 같은 굵기
  fav: <path d="M9 1.7L11 6.95L16.61 7.23L12.23 10.75L13.7 16.17L9 13.1L4.3 16.17L5.77 10.75L1.39 7.23L7 6.95z" />, // 즐겨찾기 — 별
  hair: <><path opacity=".42" d="M5.5 8L7 9.8L8.3 7.9L9.7 10L11 7.9L12.5 9.4V15H5.5z" /><path d="M9 1.5C4.9 1.5 2 4.4 2 8V15.5A1 1 0 0 0 3 16.5H4.5A1 1 0 0 0 5.5 15.5V8L7 9.8L8.3 7.9L9.7 10L11 7.9L12.5 9.4V15.5A1 1 0 0 0 13.5 16.5H15A1 1 0 0 0 16 15.5V8C16 4.4 13.1 1.5 9 1.5z" /></>, // 헤어 — 머리만 — 겉머리 진하게, 사이로 보이는 뒷머리 옅게(마네킹 없이)
  plastic: <><path fillRule="evenodd" d="M1.5 9.5a7 7 0 1 0 14 0a7 7 0 1 0 -14 0zM5.4 9a1.1 1.4 0 1 0 2.2 0a1.1 1.4 0 1 0 -2.2 0zM9.4 9a1.1 1.4 0 1 0 2.2 0a1.1 1.4 0 1 0 -2.2 0zM6.6 12.1Q8.5 13.8 10.4 12.1L10.9 12.7Q8.5 15 6.1 12.7z" /><path d="M15 .8Q15.25 2.75 17.2 3Q15.25 3.25 15 5.2Q14.75 3.25 12.8 3Q14.75 2.75 15 .8z" /></>, // 성형 — 동그란 얼굴 + 반짝임
  skin: <><path d="M5.5 5.5a3.5 3.5 0 1 0 7 0a3.5 3.5 0 1 0 -7 0z" /><path d="M2 16C2 12.3 5.1 10.5 9 10.5S16 12.3 16 16Q16 16.5 15.5 16.5H2.5Q2 16.5 2 16z" /></>, // 피부 — 사람 윗몸
  cap: <path d="M17 13V10.8C17 7.5 14.6 5 11.5 5S6 7.5 6 10.6C4 10.9 2.4 11.7 1.3 12.7Q1 13 1.4 13z" />, // 모자 — 야구모자 한 덩어리(투명 모자)
  faceacc: <><g transform="scale(.75)"><g transform="translate(0 -0.5)"><path fillRule="evenodd" d="M4.2 4c2.6 1 5.1 1.4 7.8 1.4S17.2 5 19.8 4c.6 1.4.9 2.9.9 4.5 0 6.4-3.9 11.4-8.7 12.5C7.2 19.9 3.3 14.9 3.3 8.5c0-1.6.3-3.1.9-4.5zM6.9 10.6c.7-1.3 2.7-1.4 3.6-.2.2.3 0 .7-.4.6-.9-.3-1.8-.2-2.7.2-.4.2-.7-.2-.5-.6zM13.5 10.4c.9-1.2 2.9-1.1 3.6.2.2.4-.1.8-.5.6-.9-.4-1.8-.5-2.7-.2-.4.1-.6-.3-.4-.6zM9.2 14.3c1.7 1.3 3.9 1.3 5.6 0 .3-.2.7.1.5.4-.9 1.6-2.2 2.4-3.3 2.4s-2.4-.8-3.3-2.4c-.2-.3.2-.6.5-.4z" /></g></g></>, // 얼굴장식 — 웃는 가면(투명 얼굴장식)
  eyeacc: <><path fillRule="evenodd" d="M3 6h3a2 2 0 0 1 2 2v2a2 2 0 0 1 -2 2h-3a2 2 0 0 1 -2 -2v-2a2 2 0 0 1 2 -2zM3.5 7.5h2a1 1 0 0 1 1 1v1a1 1 0 0 1 -1 1h-2a1 1 0 0 1 -1 -1v-1a1 1 0 0 1 1 -1z" /><path fillRule="evenodd" d="M12 6h3a2 2 0 0 1 2 2v2a2 2 0 0 1 -2 2h-3a2 2 0 0 1 -2 -2v-2a2 2 0 0 1 2 -2zM12.5 7.5h2a1 1 0 0 1 1 1v1a1 1 0 0 1 -1 1h-2a1 1 0 0 1 -1 -1v-1a1 1 0 0 1 1 -1z" /><path d="M8 7.6Q9 6.9 10 7.6V9Q9 8.3 8 9z" /></>, // 눈장식 — 렌즈가 뚫린 안경(투명 안경)
  earring: <><g transform="scale(.75)"><g transform="translate(0 1.1)"><path d="M5.5 5.7a1.6 1.6 0 1 0 3.2 0a1.6 1.6 0 1 0 -3.2 0z" /><path d="M7.1 8.2C4.7 10.9 3.6 12.6 3.6 14.2A3.5 3.5 0 0 0 10.6 14.2C10.6 12.6 9.5 10.9 7.1 8.2z" /><path d="M15.3 5.7a1.6 1.6 0 1 0 3.2 0a1.6 1.6 0 1 0 -3.2 0z" /><path d="M16.9 8.2C14.5 10.9 13.4 12.6 13.4 14.2A3.5 3.5 0 0 0 20.4 14.2C20.4 12.6 19.3 10.9 16.9 8.2z" /></g></g></>, // 귀고리 — 알 + 물방울 한 쌍
  overall: <><g transform="scale(.75)"><path d="M9.5 4.4Q12 6.6 14.5 4.4L17 5.1Q17.5 5.3 17.8 5.7L19.8 8.3Q20.1 8.8 19.6 9.1L17.8 10.2Q17.3 10.5 16.9 10.1L15.8 9.2L15.4 12.1L20.5 18.2Q21 19 20 19.3Q12 20.6 4 19.3Q3 19 3.5 18.2L8.6 12.1L8.2 9.2L7.1 10.1Q6.7 10.5 6.2 10.2L4.4 9.1Q3.9 8.8 4.2 8.3L6.2 5.7Q6.5 5.3 7 5.1z" /></g></>, // 한벌옷 — 짧은 소매 + 잘록한 허리 + 퍼지는 치마
  top: <path d="M7 3Q9 5 11 3L13.6 3.7Q14.1 3.9 14.4 4.3L16.6 7.1Q16.9 7.5 16.5 7.8L14.9 9Q14.5 9.3 14.1 9L13 8.2V14.2Q13 15 12.2 15H5.8Q5 15 5 14.2V8.2L3.9 9Q3.5 9.3 3.1 9L1.5 7.8Q1.1 7.5 1.4 7.1L3.6 4.3Q3.9 3.9 4.4 3.7z" />, // 상의 — 소매를 옆으로 편 티셔츠
  bottom: <><path d="M3.6 3h10.8a0.6 0.6 0 0 1 0.6 0.6v0.8a0.6 0.6 0 0 1 -0.6 0.6h-10.8a0.6 0.6 0 0 1 -0.6 -0.6v-0.8a0.6 0.6 0 0 1 0.6 -0.6z" /><path d="M3 6H15L15.8 14.2Q15.9 15 15.1 15H11.6Q11 15 10.8 14.4L9 9.6L7.2 14.4Q7 15 6.4 15H2.9Q2.1 15 2.2 14.2z" /></>, // 하의 — 허리띠 + 넓은 바지
  shoes: <path d="M3 3H8.5Q9.5 3 9.5 4V8.5L14 10.5Q16 11.4 16 13.4V14Q16 15 15 15H3Q2 15 2 14V4Q2 3 3 3z" />, // 신발 — 낮은 앵클 부츠(투명 신발)
  gloves: <><path d="M6 12V6.5A4.5 4.5 0 0 1 15 6.5V12z" /><path d="M6 8.6L3.7 6.7Q2.7 6 2.1 6.8Q1.6 7.6 2.4 8.4L6 11.6z" /><path d="M6 13h9a1 1 0 0 1 1 1v1a1 1 0 0 1 -1 1h-9a1 1 0 0 1 -1 -1v-1a1 1 0 0 1 1 -1z" /></>, // 장갑 — 벙어리장갑 + 엄지 + 손목 띠(투명 장갑)
  cape: <><g transform="scale(.75)"><path d="M6.4 4.6Q7.4 4.2 8.4 4.7L12 7.6L15.6 4.7Q16.6 4.2 17.6 4.6L18.4 5Q19 5.3 19.2 6L20.8 18Q21 19.4 19.6 19.2Q12 18.2 4.4 19.2Q3 19.4 3.2 18L4.8 6Q5 5.3 5.6 5z" /></g></>, // 망토 — 어깨 + 목 V 홈, 퍼지는 한 덩어리(투명 망토)
  weapon: <><g transform="scale(.75)"><path d="M20.8 3.2v4.4l-9.4 9.4-4.4-4.4 9.4-9.4z" /><path d="M4.9 11.4l1.2-1.2 7.7 7.7-1.2 1.2z" /><path d="M7.2 15.4l1.4 1.4-4.4 4.4a1 1 0 0 1-1.4-1.4z" /></g></>, // 무기 — 검(투명 무기)
  shield: <><g transform="scale(.75)"><g transform="translate(12 12) scale(1.06 0.9) translate(-12 -12)"><path fillRule="evenodd" d="M12 3 3.8 5.8v5.9c0 4.4 3.3 7.7 8.2 9.2 4.9-1.5 8.2-4.8 8.2-9.2V5.8zM10.9 7.6h2.2v3.4h3.4v2.2h-3.4v4h-2.2v-4H7.5V11h3.4z" /></g></g></>, // 방패 — 십자 방패(투명 방패)
  pet: <><g transform="scale(.75)"><path d="M3.2 10.4a2.4 2.4 0 1 0 4.8 0a2.4 2.4 0 1 0 -4.8 0z" /><path d="M6.9 5.6a2.4 2.4 0 1 0 4.8 0a2.4 2.4 0 1 0 -4.8 0z" /><path d="M12.3 5.6a2.4 2.4 0 1 0 4.8 0a2.4 2.4 0 1 0 -4.8 0z" /><path d="M16 10.4a2.4 2.4 0 1 0 4.8 0a2.4 2.4 0 1 0 -4.8 0z" /><path d="M12 11.6c-3.4 0-6.6 3.3-6.6 6.2 0 2.1 1.7 3.3 3.6 3.3 1.2 0 2-.6 3-.6s1.8.6 3 .6c1.9 0 3.6-1.2 3.6-3.3 0-2.9-3.2-6.2-6.6-6.2z" /></g></>, // 펫 — 발자국
  android: <><path fillRule="evenodd" d="M5.5 7h7a2.5 2.5 0 0 1 2.5 2.5v4a2.5 2.5 0 0 1 -2.5 2.5h-7a2.5 2.5 0 0 1 -2.5 -2.5v-4a2.5 2.5 0 0 1 2.5 -2.5zM5.4 11a1.1 1.1 0 1 0 2.2 0a1.1 1.1 0 1 0 -2.2 0zM10.4 11a1.1 1.1 0 1 0 2.2 0a1.1 1.1 0 1 0 -2.2 0zM7.5 13h3v1h-3z" /><path d="M8.5 4.5h1v2.5h-1z" /><path d="M7.8 3.6a1.2 1.2 0 1 0 2.4 0a1.2 1.2 0 1 0 -2.4 0z" /><path d="M1.75 10h0a0.75 0.75 0 0 1 0.75 0.75v2a0.75 0.75 0 0 1 -0.75 0.75h-0a0.75 0.75 0 0 1 -0.75 -0.75v-2a0.75 0.75 0 0 1 0.75 -0.75z" /><path d="M16.25 10h0a0.75 0.75 0 0 1 0.75 0.75v2a0.75 0.75 0 0 1 -0.75 0.75h-0a0.75 0.75 0 0 1 -0.75 -0.75v-2a0.75 0.75 0 0 1 0.75 -0.75z" /></>, // 안드로이드 — 로봇 얼굴
  ring: <><g transform="scale(.75)"><path fillRule="evenodd" d="M5.6 14.6a6.4 6.4 0 1 0 12.8 0a6.4 6.4 0 1 0 -12.8 0zM8 14.6a4 4 0 1 0 8 0a4 4 0 1 0 -8 0z" /><path d="M12 3.2l3.4 3.1L12 9 8.6 6.3z" /><path d="M4.2 3.2Q4.47 5.33 6.6 5.6Q4.47 5.87 4.2 8Q3.93 5.87 1.8 5.6Q3.93 5.33 4.2 3.2zM19.8 3.2Q20.07 5.33 22.2 5.6Q20.07 5.87 19.8 8Q19.53 5.87 17.4 5.6Q19.53 5.33 19.8 3.2z" /></g></>, // 일루전링 — 보석 반지 + 반짝임(변신)
  chatring: <path fillRule="evenodd" d="M3 2H15A2 2 0 0 1 17 4V11A2 2 0 0 1 15 13H9.5L5.8 15.9Q5 16.5 5 15.5V13H3A2 2 0 0 1 1 11V4A2 2 0 0 1 3 2zM4.4 7.5a1.1 1.1 0 1 0 2.2 0a1.1 1.1 0 1 0 -2.2 0zM7.9 7.5a1.1 1.1 0 1 0 2.2 0a1.1 1.1 0 1 0 -2.2 0zM11.4 7.5a1.1 1.1 0 1 0 2.2 0a1.1 1.1 0 1 0 -2.2 0z" />, // 명찰 / 말풍선 — 말줄임 말풍선(메이플톡)
  title: <><path d="M4 5H14V12H4z" /><path d="M1 6H4V13H1L2.6 9.5z" /><path d="M17 6H14V13H17L15.4 9.5z" /></>, // 칭호 — 리본 띠
  medal: <><g transform="scale(.75)"><path d="M3.8 3.8H8.6L11.3 9.3Q9.3 9.8 7.9 11.1z" /><path d="M20.2 3.8H15.4L12.7 9.3Q14.7 9.8 16.1 11.1z" /><path fillRule="evenodd" d="M6.2 14.6a5.8 5.8 0 1 0 11.6 0a5.8 5.8 0 1 0 -11.6 0zM12 11.2L12.88 13.59L15.42 13.69L13.43 15.26L14.12 17.71L12 16.3L9.88 17.71L10.57 15.26L8.58 13.69L11.12 13.59z" /></g></>, // 훈장 — 별 메달(메뉴의 훈장)
  effect: <><g transform="scale(.75)"><path d="M10.4 5.4Q11.32 12.68 18.6 13.6Q11.32 14.52 10.4 21.8Q9.48 14.52 2.2 13.6Q9.48 12.68 10.4 5.4z" /><path d="M18.6 2.2Q18.96 5.04 21.8 5.4Q18.96 5.76 18.6 8.6Q18.24 5.76 15.4 5.4Q18.24 5.04 18.6 2.2z" /></g></>, // 이펙트 — 반짝임
  soul: <><g transform="scale(.75)"><g transform="translate(12 12) scale(1.1 0.88) translate(-12 -12)"><path fillRule="evenodd" d="M12.6 2.6c.5 3.4 6.8 5.8 6.8 11.5a7.4 6.9 0 0 1-14.8 0c0-2.6 1.4-4.5 3-5.7.3 2 1.4 3.2 2.9 3.7-.7-3.3 0-6.8 2.1-9.5zM12 13.2c.3 1.6 3 2.8 3 5.4a3 2.8 0 0 1-6 0c0-1.2.7-2.1 1.4-2.6.2.9.7 1.4 1.3 1.6-.2-1.5 0-3 .3-4.4z" /></g></g></>, // 소울 — 불꽃(메뉴의 소울 컬렉션)
  riding: <><g transform="scale(.75)"><g transform="translate(0 -0.7)"><path fillRule="evenodd" d="M3 16.6v-3.3c0-1.1.7-2 1.7-2.3l1.7-.5 2.1-3.8c.4-.7 1.1-1.1 1.9-1.1h3.2c.8 0 1.5.4 1.9 1.1l2.1 3.8 1.7.5c1 .3 1.7 1.2 1.7 2.3v3.3zM8.8 10.2l1.4-2.6h3.6l1.4 2.6z" /><path d="M4.8 17.2a2.6 2.6 0 1 0 5.2 0a2.6 2.6 0 1 0 -5.2 0z" /><path d="M14 17.2a2.6 2.6 0 1 0 5.2 0a2.6 2.6 0 1 0 -5.2 0z" /></g></g></>, // 라이딩 — 자동차
  chair: <><path d="M5.5 2h7a1.5 1.5 0 0 1 1.5 1.5v2a1.5 1.5 0 0 1 -1.5 1.5h-7a1.5 1.5 0 0 1 -1.5 -1.5v-2a1.5 1.5 0 0 1 1.5 -1.5z" /><path d="M3 8h12a1 1 0 0 1 1 1v1a1 1 0 0 1 -1 1h-12a1 1 0 0 1 -1 -1v-1a1 1 0 0 1 1 -1z" /><path d="M3 11h2v5h-2z" /><path d="M13 11h2v5h-2z" /></>, // 의자 — 의자
}
export const IconCat = ({ id, size = 18 }: P & { id: string }) => CAT_PATHS[id] ? (
  <svg width={size} height={size} viewBox="0 0 18 18" fill="currentColor" style={{ display: 'block', flex: '0 0 auto' }} aria-hidden="true">{CAT_PATHS[id]}</svg>
) : null
