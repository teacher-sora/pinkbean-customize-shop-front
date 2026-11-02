// 목록 머리의 검색 칸 하나(돋보기 + 입력) — 코디 · AI 검색 · 코디 룩북 · 광장이 함께 쓴다. 생김새는 frame/search.module.css
// 입력칸은 부르는 쪽이 만들고 searchInputClass 로 생김새를 받는다(값 · 키 처리가 칸마다 다르다). children 뒤에 붙는 것(찾기 창 등)도 같은 칸 안에 둔다
import clsx from 'clsx'
import { IconSearch } from '../ui/Icons'
import styles from './search.module.css'

export const searchInputClass = (mobile: boolean) => clsx('pb-input', mobile ? styles.inputM : styles.input)

export default function SearchBox({ mobile, narrow, plaza, children }: { mobile: boolean; narrow?: boolean; plaza?: boolean; children: React.ReactNode }) {
  return (
    <div className={clsx(mobile ? styles.wrapM : clsx(styles.wrap, narrow && styles.wrapNarrow), plaza && styles.plaza)}>
      <IconSearch className={mobile ? styles.iconM : styles.icon} />
      {children}
    </div>
  )
}
