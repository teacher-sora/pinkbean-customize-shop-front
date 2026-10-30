// 문서를 지금 스크롤 위치 그대로 제자리에 고정한다(body position:fixed + top −스크롤) — 풀 때 그 위치로 되돌린다.
// overflow:hidden 만으로는 가상 키패드가 입력칸을 보이게 하려는 브라우저 스크롤을 막지 못해, 키패드가 닫힌 뒤 문서가 엉뚱한 위치(빈 공간)에 남고
// 보이는 것과 누르는 자리가 어긋났다. 시트(surface/Surface)와 아이폰 키패드(lib/keyboard)가 함께 쓴다 — 겹쳐 걸면 처음 건 것이 위치를 적고 마지막에 푼 것이 되돌린다.
let count = 0, y = 0, prev: Partial<CSSStyleDeclaration> = {}
export function lockBody(): () => void {
  const b = document.body.style
  if (!count++) {
    y = window.scrollY
    prev = { position: b.position, top: b.top, left: b.left, right: b.right, width: b.width, overflow: b.overflow }
    Object.assign(b, { position: 'fixed', top: `-${y}px`, left: '0', right: '0', width: '100%', overflow: 'hidden' })
  }
  let done = false
  return () => {
    if (done) return
    done = true
    if (--count) return
    Object.assign(b, prev)
    window.scrollTo({ top: y, behavior: 'instant' as ScrollBehavior })
  }
}
