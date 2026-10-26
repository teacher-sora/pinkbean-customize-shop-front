// 인라인 SVG 아이콘.

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
export const IconPencil = ({ className }: P) => (
  <svg className={className} width="10" height="10" viewBox="0 0 24 24" fill="none" style={{ stroke: 'light-dark(#c9a3b5, #7f838e)' }} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M16.5 4.5l3 3L8 19H5v-3z" /></svg>
)
export const IconReset = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 11a8 8 0 1 0-2.3 5.7" /><path d="M20 5v6h-6" /></svg>
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
// 보기 모델: 아이템(옷걸이 — 입은 사람 없이 아이템만) · 기본 캐릭터(마네킹) · 내 캐릭터(사람 + 하트)
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
