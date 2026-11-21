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
const STAR_PATH = 'M12 3.6l2.5 5.1 5.6.8-4 3.9.95 5.6L12 16.3l-5.05 2.7.95-5.6-4-3.9 5.6-.8z'
export const IconStar = ({ size = 9, className }: P) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><path d={STAR_PATH} /></svg>
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
const BUBBLE_PATH = 'M4.5 6.5A2 2 0 0 1 6.5 4.5h11a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H11l-4.5 3.5v-3.5a2 2 0 0 1-2-2z'
export const IconBubble = ({ size = 13 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}><path d={BUBBLE_PATH} /></svg>
)
// 카테고리 펼친 창의 부위 아이콘(사용자 지시 — 글자만으로는 감이 잘 안 온다. 펼친 창에서만 — 부위 줄은 빼곡해 자리가 없다).
// 투명 아이템이 있는 부위는 그 아이콘의 모양을 따른다(게임의 대표 그림 — 투명 모자 = 야구모자, 투명 얼굴장식 = 웃는 가면 …, 사용자 지시).
// 나머지는 안드로이드처럼 동글동글하고 귀엽게. 같은 24 격자 · 1.8 굵기. 피부 · 장갑은 둘 다 손이면 헷갈려 피부를 볼터치 얼굴로 했다. 지금은 dev 에서만(CatPicker)
const CAT_PATHS: Record<string, JSX.Element> = {
  all: <><path d="M12 3.9 4 8.1l8 4.2 8-4.2z" /><path d="M4 12.1l8 4.2 8-4.2" /><path d="M4 15.9l8 4.2 8-4.2" /></>, // 전체 — 쌓인 층
  new: <><path d="M10.4 3.8c.5 3.6 2.4 5.5 6 6-3.6.5-5.5 2.4-6 6-.5-3.6-2.4-5.5-6-6 3.6-.5 5.5-2.4 6-6z" /><path d="M17.9 14.8c.3 1.7 1.1 2.5 2.8 2.8-1.7.3-2.5 1.1-2.8 2.8-.3-1.7-1.1-2.5-2.8-2.8 1.7-.3 2.5-1.1 2.8-2.8z" /></>, // 신규 — 반짝임
  fav: <path d={STAR_PATH} />, // 즐겨찾기 — 별(카드의 즐겨찾기와 같은 경로)
  hair: <><path d="M5.4 19.6v-7.4a6.6 6.6 0 0 1 13.2 0v7.4" /><path d="M8.2 11.4c1.4-.2 2.4-.9 3-2 .9 1.3 2.4 2 4.6 2" /><path d="M8.2 11.4v2.2a3.8 3.8 0 0 0 7.6 0v-2.2" /><path d="M12 5.6c-.3-1.3.4-2.2 1.6-2.1" /></>, // 헤어 — 앞머리 긴 머리 + 삐침 머리
  plastic: <><path d="M3 13c2.5-3.7 5.5-5.6 9-5.6s6.5 1.9 9 5.6c-2.5 3.7-5.5 5.6-9 5.6S5.5 16.7 3 13z" /><circle cx="12" cy="13" r="3" /><path d="M13 11.9h.01" /><path d="M12 3.8v2M7.2 5l1 1.6M16.8 5l-1 1.6" /></>, // 성형 — 속눈썹 눈
  skin: <><circle cx="12" cy="12" r="8.4" /><path d="M9.2 10.6h.01M14.8 10.6h.01" /><path d="M10.6 14c.8.6 2 .6 2.8 0" /><path d="M6.6 13.4h1.6M15.8 13.4h1.6" /></>, // 피부 — 볼터치 얼굴
  cap: <><path d="M7.6 15.2v-1.6a6.2 6.2 0 0 1 12.4 0v1.6z" /><path d="M7.6 15.2H4a1.3 1.3 0 0 1-.9-2.2c1.2-1.2 2.9-1.8 4.9-1.9" /><path d="M13.8 7.4c-1.6 1.6-2.4 4.4-2.4 7.8" /></>, // 모자 — 야구모자(투명 모자)
  faceacc: <><path d="M4.6 4.8c2.4.9 4.8 1.3 7.4 1.3s5-.4 7.4-1.3c.5 1.3.7 2.6.7 4 0 5.7-3.6 10.4-8.1 11.4C7.5 19.2 3.9 14.5 3.9 8.8c0-1.4.2-2.7.7-4z" /><path d="M7.4 10.6c.9-1 2.4-1 3.3 0M13.3 10.6c.9-1 2.4-1 3.3 0" /><path d="M9.8 14.4c1.3 1.1 3.1 1.1 4.4 0" /></>, // 얼굴장식 — 웃는 가면(투명 얼굴장식)
  eyeacc: <><rect x="3.2" y="10" width="7.4" height="6.4" rx="2.6" /><rect x="13.4" y="10" width="7.4" height="6.4" rx="2.6" /><path d="M10.6 12.2c.9-.6 1.9-.6 2.8 0" /><path d="M3.4 11.4 2.2 8.6M20.6 11.4l1.2-2.8" /></>, // 눈장식 — 안경(투명 안경)
  earring: <><ellipse cx="12" cy="12.6" rx="5.4" ry="7" transform="rotate(-28 12 12.6)" /><ellipse cx="12" cy="12.6" rx="2.8" ry="4.6" transform="rotate(-28 12 12.6)" /></>, // 귀고리 — 굵은 링(투명 귀고리)
  overall: <><path d="M9.4 3.8 8.8 8.6 4.6 19a1 1 0 0 0 .9 1.4h13a1 1 0 0 0 .9-1.4L15.2 8.6l-.6-4.8" /><path d="M9.4 3.8c.8 1 1.6 1.4 2.6 1.4s1.8-.4 2.6-1.4" /><path d="M12 8.6l-1.9-1.1v2.2zM12 8.6l1.9-1.1v2.2z" /></>, // 한벌옷 — 리본 원피스
  top: <path d="M8.7 4.2 4.3 6.4a1.2 1.2 0 0 0-.6 1.5l1.2 2.7 2.6-1V19a1.2 1.2 0 0 0 1.2 1.2h6.6a1.2 1.2 0 0 0 1.2-1.2V9.6l2.6 1 1.2-2.7a1.2 1.2 0 0 0-.6-1.5l-4.4-2.2c-.6 1.5-1.8 2.3-3.3 2.3S9.3 5.7 8.7 4.2z" />, // 상의 — 티셔츠
  bottom: <><path d="M7.2 3.8h9.6a1 1 0 0 1 1 .9l1 14.6a1 1 0 0 1-1 1.1h-3.2a1 1 0 0 1-1-.8L12 11l-1.6 8.6a1 1 0 0 1-1 .8H6.2a1 1 0 0 1-1-1.1l1-14.6a1 1 0 0 1 1-.9z" /><path d="M6.4 7.2h11.2" /></>, // 하의 — 바지
  shoes: <><path d="M7.4 3.8h5.4a1.2 1.2 0 0 1 1.2 1.2v7.6l4.6 2.2a3.2 3.2 0 0 1 1.8 2.9v.4a2.1 2.1 0 0 1-2.1 2.1H7.4a2.2 2.2 0 0 1-2.2-2.2V6a2.2 2.2 0 0 1 2.2-2.2z" /><path d="M5.2 7.4H14" /></>, // 신발 — 부츠(투명 신발)
  gloves: <><path d="M8 16.6 5.2 13a1.6 1.6 0 0 1 2.5-2l1.1 1.2V7a1.5 1.5 0 0 1 3 0V5.8a1.5 1.5 0 0 1 3 0v1.4a1.5 1.5 0 0 1 3 0v6.4c0 1.2-.3 2.2-.8 3" /><rect x="7.4" y="16.6" width="9.8" height="3.8" rx="1.2" /></>, // 장갑 — 통통한 장갑 + 손목 띠(투명 장갑)
  cape: <><path d="M8.2 4.2h7.6l1.6 3.4 3 11.8a1 1 0 0 1-1.3 1.2c-2.2-.8-4.5-1.2-7.1-1.2s-4.9.4-7.1 1.2a1 1 0 0 1-1.3-1.2l3-11.8z" /><path d="M8.2 4.2 6.6 7.6c1.6.4 3.4.6 5.4.6s3.8-.2 5.4-.6l-1.6-3.4" /><path d="M12 8.2v11" /></>, // 망토 — 깃 달린 망토(투명 망토)
  weapon: <><path d="M19.8 4.2l-.6 3.8-8.4 8.4-3.2-3.2 8.4-8.4z" /><path d="M5.8 11.4l6.8 6.8" /><path d="M8.4 16.8 5.6 19.6" /><circle cx="4.8" cy="20.4" r=".9" /></>, // 무기 — 검(투명 무기)
  shield: <><path d="M12 3.4 4.8 6v5.8c0 4.2 2.9 7.5 7.2 8.8 4.3-1.3 7.2-4.6 7.2-8.8V6z" /><path d="M12 6.6 7.8 8.1v3.6c0 2.7 1.7 4.8 4.2 5.7 2.5-.9 4.2-3 4.2-5.7V8.1z" /></>, // 방패 — 안쪽 테가 있는 방패(투명 방패)
  pet: <><path d="M7 8.4C5.2 6.8 3.4 7.6 3.6 10c.2 2 1.2 3.2 2.4 3.6" /><path d="M17 8.4c1.8-1.6 3.6-.8 3.4 1.6-.2 2-1.2 3.2-2.4 3.6" /><path d="M12 7.4c-3.8 0-6.4 2.8-6.4 6.4 0 3.4 2.8 6 6.4 6s6.4-2.6 6.4-6c0-3.6-2.6-6.4-6.4-6.4z" /><path d="M9.6 13h.01M14.4 13h.01" /><path d="M11.2 15.4h1.6l-.8.9z" /></>, // 펫 — 곰돌이 얼굴
  android: <><rect x="5" y="8.2" width="14" height="11.2" rx="3" /><path d="M12 8.2V5.4" /><circle cx="12" cy="4.2" r="1.2" /><path d="M9.4 13.4h.01M14.6 13.4h.01" /><path d="M3.2 12.2v3.2M20.8 12.2v3.2" /><path d="M10 16.4h4" /></>, // 안드로이드 — 로봇 얼굴
  ring: <><circle cx="8.2" cy="15.6" r="4.4" /><path d="M6.4 10.4 8.2 8.4l1.8 2" /><path d="M13.4 10.6c.4-3 2.4-5 5.4-5.4" /><path d="M16.4 3.8l2.4 1.4-1.4 2.4" /><path d="M18.4 12.2l.5 1.5 1.5.5-1.5.5-.5 1.5-.5-1.5-1.5-.5 1.5-.5z" /></>, // 일루전링 — 반지가 반짝이며 바뀐다(변신)
  chatring: <><path d={BUBBLE_PATH} /><path d="M8.6 10.5h.01M12 10.5h.01M15.4 10.5h.01" /></>, // 명찰 / 말풍선 — 말줄임 말풍선(IconBubble 과 같은 테두리)
  title: <><path d="M5.6 8c4.2-1.6 8.6-1.6 12.8 0v6.4c-4.2-1.6-8.6-1.6-12.8 0z" /><path d="M5.6 9.8H2.6l1.5 2.6-1.5 2.6h3M18.4 9.8h3l-1.5 2.6 1.5 2.6h-3" /></>, // 칭호 — 휜 리본 띠
  medal: <><path d="M7.6 3.6h3.2l1.9 5.2M16.4 3.6h-3.2l-1.6 4.4" /><circle cx="12" cy="15" r="5.2" /><path d="M12 12.4l.85 1.7 1.85.25-1.35 1.3.3 1.85L12 16.6l-1.65.9.3-1.85-1.35-1.3 1.85-.25z" /></>, // 훈장 — 끈 달린 별 메달
  effect: <><path d="M4.2 19.8l8.6-8.6" /><path d="M16.2 3.8l1.2 2.5 2.7.4-2 1.9.5 2.7-2.4-1.3-2.4 1.3.5-2.7-2-1.9 2.7-.4z" /><path d="M20.4 14.4h.01M10.6 5.2h.01M18.6 18h.01" /></>, // 이펙트 — 별 요술봉
  soul: <><path d="M5.4 19.6v-8.4a6.6 6.6 0 0 1 13.2 0v8.4l-2.2-1.5-2.2 1.5-2.2-1.5-2.2 1.5-2.2-1.5z" /><path d="M9.6 11.4h.01M14.4 11.4h.01" /></>, // 소울 — 꼬마 유령(영혼)
  riding: <><path d="M3.6 16.4v-2.6c0-1 .6-1.8 1.5-2.1l1.5-.5 1.9-3.4a2 2 0 0 1 1.7-1h4.4a2 2 0 0 1 1.7 1l1.9 3.4 1.5.5c.9.3 1.5 1.1 1.5 2.1v2.6z" /><circle cx="7.6" cy="16.8" r="2" /><circle cx="16.4" cy="16.8" r="2" /><path d="M6.6 11.2h10.8" /></>, // 라이딩 — 동글한 자동차
  chair: <><path d="M7.6 11.6V5.6a2 2 0 0 1 2-2h4.8a2 2 0 0 1 2 2v6" /><path d="M6 11.6h12a1 1 0 0 1 1 1v.6a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-.6a1 1 0 0 1 1-1z" /><path d="M7.2 14.2v6.2M16.8 14.2v6.2" /></>, // 의자 — 의자
}
export const IconCat = ({ id, size = 15 }: P & { id: string }) => CAT_PATHS[id] ? (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block', flex: '0 0 auto' }} aria-hidden="true">{CAT_PATHS[id]}</svg>
) : null
