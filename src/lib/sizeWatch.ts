// 카드 칸 크기 감지를 ResizeObserver 하나로 묶는다(ItemThumb · SnapThumb). 칸 크기가 바뀌면 그리기 전에 바로 반영해야 하는데(flushSync —
// 다음 프레임으로 미루면 앞 격자의 칸 크기로 한 프레임 그려져 그림이 번쩍였다), 카드마다 감지기를 두면 창 크기를 바꾸는 동안 카드 수만큼
// 따로 동기 렌더가 돌아 화면이 천천히 따라왔다(사용자 지적). 하나로 묶으면 한 번의 flushSync 안에서 바뀐 칸을 모두 잰다
import { flushSync } from 'react-dom'

const subs = new Map<Element, () => void>()
let ro: ResizeObserver | null = null

export function watchSize(el: Element, fn: () => void): () => void {
  if (!ro) ro = new ResizeObserver((entries) => flushSync(() => { for (const e of entries) subs.get(e.target)?.() }))
  subs.set(el, fn)
  ro.observe(el)
  return () => { subs.delete(el); ro?.unobserve(el) }
}
