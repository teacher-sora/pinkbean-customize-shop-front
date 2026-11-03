// 검색 칸 지우기(x) — 글을 적은 칸 안 오른쪽에 x 를 띄워 한 번에 비운다(사용자 지시: 검색 칸에만 — 아이템 검색, 생김새 검색, 코디 룩북 찾기, 광장 검색). 생김새는 ui/clearField.module.css
// 입력칸을 감싸기만 한다(값 · 키 처리 · 생김새는 부르는 쪽 그대로). 비었는지는 :placeholder-shown 으로 CSS 가 가린다 — 그래서 입력칸에 placeholder 가 꼭 있어야 한다.
// 글이 있을 때만 x 자리만큼 오른쪽 여백을 더해 글자가 x 밑으로 들어가지 않는다(빈 칸은 안내 글을 끝까지 보여 준다).
// 누를 때 입력칸 포커스를 뺏지 않아(mousedown 막기) 휴대폰 키패드가 내려가지 않고 이어서 적는다.
import clsx from 'clsx'
import { IconClose } from './Icons'
import styles from './clearField.module.css'

export default function ClearField({ onClear, className, children }: { onClear: () => void; className?: string; children: React.ReactNode }) {
  return (
    <span className={clsx(styles.wrap, className)}>
      {children}
      <button type="button" tabIndex={-1} title="입력 지우기" aria-label="입력 지우기" onMouseDown={(e) => e.preventDefault()}
        onClick={(e) => { onClear(); e.currentTarget.parentElement?.querySelector('input')?.focus() }} className={styles.x}><IconClose size={12} /></button>
    </span>
  )
}
