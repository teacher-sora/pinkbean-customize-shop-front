// v2 마크업의 인라인 SVG 아이콘(경로·굵기 그대로).

type P = { size?: number; className?: string; style?: React.CSSProperties }

export const IconRate = ({ size = 15 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5.5 4.5h13v9.5a4 4 0 0 1-4 4h-5a4 4 0 0 1-4-4z" /><path d="M8.6 20.5h6.8" /><path d="M9.6 9.2l1.6 1.6 3.2-3.2" /></svg>
)
export const IconCopy = ({ size = 15 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="10.5" height="10.5" rx="2" /><path d="M15 6.5V6a1.5 1.5 0 0 0-1.5-1.5H6A1.5 1.5 0 0 0 4.5 6v7.5A1.5 1.5 0 0 0 6 15h.5" /></svg>
)
export const IconChevronLeft = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}><path d="M14.5 5.5 8 12l6.5 6.5" /></svg>
)
export const IconChevronRight = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}><path d="M9.5 5.5 16 12l-6.5 6.5" /></svg>
)
export const IconSearch = ({ size = 14, className }: P) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#b7ada2" strokeWidth="2" strokeLinecap="round"><circle cx="10.5" cy="10.5" r="6" /><path d="M15 15l4.5 4.5" /></svg>
)
export const IconSearchBold = ({ size = 15 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="10.5" cy="10.5" r="6" /><path d="M15 15l4.5 4.5" /></svg>
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
export const IconDot = ({ size = 13 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="2.6" fill="currentColor" stroke="none" /><path d="M12 3.6v3M12 17.4v3M3.6 12h3M17.4 12h3" /></svg>
)
export const IconCaretDown = ({ size = 12, className }: P) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9.5l6 6 6-6" /></svg>
)
// 부위 염색(물방울)
export const IconDrop = ({ size = 14 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 3.4s5.6 6.3 5.6 10.2a5.6 5.6 0 0 1-11.2 0C6.4 9.7 12 3.4 12 3.4z" /></svg>
)
export const IconCaretUp = ({ size = 12 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M6 14.5l6-6 6 6" /></svg>
)
export const IconBookmark = ({ filled }: { filled: boolean }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinejoin="round"><path d="M6 3h12v11l-6 4-6-4z" /></svg>
)
export const IconCheck = ({ size = 10 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
)
export const IconClose = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
)
export const IconPencil = ({ className }: P) => (
  <svg className={className} width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#c9a3b5" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M16.5 4.5l3 3L8 19H5v-3z" /></svg>
)
export const IconShare = () => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 15V5m0 0L8.5 8.5M12 5l3.5 3.5" /><path d="M5.5 14v4.5h13V14" /></svg>
)
export const IconTrash = () => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5.5 7.5h13M9.5 7.5V5.5h5v2M7 7.5l1 12h8l1-12" /></svg>
)
export const IconImport = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 4.5v10m0 0-3.5-3.5M12 14.5l3.5-3.5" /><path d="M5.5 15v4h13v-4" /></svg>
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
// 탭 아이콘(v2 TABS.icon 경로)
export const TAB_ICONS: Record<string, string> = {
  codi: 'M12 3.4a2.2 2.2 0 0 0-2.2 2.2c0 .9.6 1.7 1.4 2L4 12.6V18h16v-5.4l-7.2-5a2.2 2.2 0 0 0 1.4-2A2.2 2.2 0 0 0 12 3.4z',
  search: 'M10.5 4.2a6.3 6.3 0 1 0 0 12.6 6.3 6.3 0 0 0 0-12.6zM19.8 19.8l-4.4-4.4',
  info: 'M12 3.4s5.4 6.1 5.4 9.8a5.4 5.4 0 0 1-10.8 0C6.6 9.5 12 3.4 12 3.4z',
  preset: 'M4.2 4.2h6.2v6.2H4.2zM13.6 4.2h6.2v6.2h-6.2zM4.2 13.6h6.2v6.2H4.2zM13.6 13.6h6.2v6.2h-6.2z',
  share: 'M8.4 9.6a2.6 2.6 0 1 0 0-5.2 2.6 2.6 0 0 0 0 5.2zM16.4 10.4a2.2 2.2 0 1 0 0-4.4 2.2 2.2 0 0 0 0 4.4zM3.4 19.2c0-2.8 2.2-5 5-5s5 2.2 5 5M14.4 14.6c2.2.3 3.9 2.1 3.9 4.4',
  notice: 'M4.2 10v4l9.6 3.6V6.4L4.2 10zm9.6 0h2.8a2.8 2.8 0 0 1 0 5.6h-2.8',
}
export const IconTab = ({ id, size }: { id: string; size: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d={TAB_ICONS[id]} /></svg>
)
