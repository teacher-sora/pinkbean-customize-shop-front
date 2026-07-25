// 우클릭 시 뜨는 가벼운 커스텀 메뉴(브라우저 기본 메뉴 대체). 바닐라 DOM — 컴포넌트/컨텍스트 결합 없음.
// 렌더 루프와 무관하고, 열릴 때만 DOM 노드 하나를 만든다 → 성능 영향 없음.
import { copyImage, saveImage } from './canvasExport'

export interface CanvasMenuItem {
  label: string
  onClick: () => void
  danger?: boolean
}

let current: HTMLElement | null = null
let cleanup: (() => void) | null = null

// 캔버스 메뉴 액션 피드백용 경량 토스트(바닐라 — React 컨텍스트 결합 없음, 어느 컴포넌트에서도 동일).
// 앱 Toast.tsx 와 같은 모양. 카드처럼 컨텍스트를 구독하지 않는 곳에서도 쓰려고 DOM 으로 직접 띄운다.
let toastEl: HTMLElement | null = null
let toastT: ReturnType<typeof setTimeout> | null = null
export function flashToast (msg: string): void {
  if (!toastEl) {
    toastEl = document.createElement('div')
    Object.assign(toastEl.style, {
      position: 'fixed', bottom: '32px', left: '50%', zIndex: '9998',
      padding: '12px 22px', background: 'linear-gradient(100deg,#ec86ac,#b57bdb)', color: '#fff',
      borderRadius: '999px', font: '600 13px system-ui, "Malgun Gothic", sans-serif',
      boxShadow: '0 10px 28px rgba(180,123,219,.38)', pointerEvents: 'none',
      transition: 'opacity .28s ease, transform .28s cubic-bezier(.22,.61,.36,1)',
      opacity: '0', transform: 'translate(-50%, 12px)',
    } as CSSStyleDeclaration)
    document.body.appendChild(toastEl)
  }
  toastEl.textContent = msg
  // 리플로우 강제 후 진입(첫 표시에도 트랜지션 적용).
  void toastEl.offsetWidth
  toastEl.style.opacity = '1'
  toastEl.style.transform = 'translate(-50%, 0)'
  if (toastT) clearTimeout(toastT)
  toastT = setTimeout(() => {
    if (toastEl) { toastEl.style.opacity = '0'; toastEl.style.transform = 'translate(-50%, 12px)' }
  }, 2000)
}

export function closeCanvasMenu (): void {
  if (cleanup) { cleanup(); cleanup = null }
  if (current) { current.remove(); current = null }
  // 혹시라도 이전에 누적된 메뉴 노드가 남아 있으면 모두 제거(안전망).
  document.querySelectorAll('[data-pb-canvas-menu]').forEach((n) => n.remove())
}

export function openCanvasMenu (x: number, y: number, items: CanvasMenuItem[]): void {
  closeCanvasMenu()
  const el = document.createElement('div')
  el.setAttribute('role', 'menu')
  el.setAttribute('data-pb-canvas-menu', '')
  el.oncontextmenu = (e) => e.preventDefault() // 메뉴 위에서 다시 우클릭해도 브라우저 기본 메뉴가 안 뜨게
  Object.assign(el.style, {
    position: 'fixed', zIndex: '9999', minWidth: '176px', padding: '5px',
    background: '#fff', border: '1px solid #e7ded4', borderRadius: '11px',
    boxShadow: '0 10px 30px rgba(42,37,33,.16)', font: '13px system-ui, "Malgun Gothic", sans-serif',
    color: '#2a2521', userSelect: 'none', left: '0px', top: '0px', opacity: '0',
    transition: 'opacity .1s ease',
  } as CSSStyleDeclaration)

  for (const it of items) {
    const b = document.createElement('button')
    b.type = 'button'
    b.textContent = it.label
    Object.assign(b.style, {
      display: 'block', width: '100%', textAlign: 'left', padding: '8px 11px',
      border: 'none', background: 'transparent', borderRadius: '7px', cursor: 'pointer',
      font: 'inherit', color: it.danger ? '#c0392b' : '#2a2521', whiteSpace: 'nowrap',
    } as CSSStyleDeclaration)
    b.onmouseenter = () => { b.style.background = it.danger ? '#fdecea' : '#f6edf2' }
    b.onmouseleave = () => { b.style.background = 'transparent' }
    b.onclick = () => { closeCanvasMenu(); it.onClick() }
    el.appendChild(b)
  }

  document.body.appendChild(el)
  current = el // ★ 반드시 대입 — 안 하면 closeCanvasMenu 가 노드를 못 지워 메뉴가 무한 누적된다.
  // 뷰포트 밖으로 나가지 않게 위치 보정.
  const r = el.getBoundingClientRect()
  const px = Math.min(x, window.innerWidth - r.width - 8)
  const py = Math.min(y, window.innerHeight - r.height - 8)
  el.style.left = Math.max(8, px) + 'px'
  el.style.top = Math.max(8, py) + 'px'
  el.style.opacity = '1'

  // 바깥 클릭·스크롤·리사이즈·ESC·다른 우클릭 → 닫기.
  const onDown = (e: Event) => { if (!el.contains(e.target as Node)) closeCanvasMenu() }
  const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeCanvasMenu() }
  const onScroll = () => closeCanvasMenu()
  // 이번 우클릭이 만든 이벤트가 곧바로 닫지 않도록 다음 틱에 리스너 부착.
  setTimeout(() => {
    window.addEventListener('pointerdown', onDown, true)
    window.addEventListener('contextmenu', onDown, true)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onScroll)
    window.addEventListener('keydown', onKey)
  }, 0)
  cleanup = () => {
    window.removeEventListener('pointerdown', onDown, true)
    window.removeEventListener('contextmenu', onDown, true)
    window.removeEventListener('scroll', onScroll, true)
    window.removeEventListener('resize', onScroll)
    window.removeEventListener('keydown', onKey)
  }
}

// 미리보기 캔버스 공용: 우클릭 → "이미지 복사 / 이미지 저장" 메뉴. getBlob 이 그 캔버스의 내보내기 이미지를 만든다.
export function openImageMenu (x: number, y: number, getBlob: () => Promise<Blob | null>, filename: string): void {
  openCanvasMenu(x, y, [
    { label: '이미지 복사', onClick: async () => flashToast((await copyImage(getBlob)) ? '이미지를 복사했어요' : '이미지 복사에 실패했어요') },
    { label: '이미지 저장', onClick: async () => flashToast((await saveImage(getBlob, filename)) ? '이미지를 저장했어요' : '이미지 저장에 실패했어요') },
  ])
}

// 요소에 "우클릭(데스크톱·안드로이드) + 롱프레스(iOS 등 터치)" 를 모두 걸어 이미지 메뉴를 띄운다.
// 반환값은 해제 함수. 렌더와 무관한 이벤트 리스너만 붙이므로 성능 영향 없음.
export function bindImageMenu (el: HTMLElement, getBlob: () => Promise<Blob | null>, filename: string): () => void {
  const onCtx = (e: MouseEvent) => { e.preventDefault(); openImageMenu(e.clientX, e.clientY, getBlob, filename) }
  el.addEventListener('contextmenu', onCtx)
  // iOS 등에서 롱프레스 시 뜨는 네이티브 이미지 콜아웃(저장/복사) 억제 → 우리 메뉴로 대체.
  el.style.setProperty('-webkit-touch-callout', 'none')

  // 터치 롱프레스 직접 감지(iOS Safari 는 롱프레스에 contextmenu 를 안 쏜다).
  let timer: ReturnType<typeof setTimeout> | null = null
  let sx = 0, sy = 0, fired = false
  const clear = () => { if (timer) { clearTimeout(timer); timer = null } }
  const onStart = (e: TouchEvent) => {
    if (e.touches.length !== 1) { clear(); return }
    const t = e.touches[0]; sx = t.clientX; sy = t.clientY; fired = false
    clear()
    timer = setTimeout(() => { fired = true; openImageMenu(sx, sy, getBlob, filename) }, 500) // ≈0.5초 꾹
  }
  const onMove = (e: TouchEvent) => {
    const t = e.touches[0]; if (!t) return
    if (Math.abs(t.clientX - sx) > 10 || Math.abs(t.clientY - sy) > 10) clear() // 스크롤/스와이프면 취소
  }
  const onEnd = (e: TouchEvent) => { clear(); if (fired) e.preventDefault() } // 메뉴 떴으면 뒤따르는 유령 클릭 억제
  el.addEventListener('touchstart', onStart, { passive: true })
  el.addEventListener('touchmove', onMove, { passive: true })
  el.addEventListener('touchend', onEnd)
  el.addEventListener('touchcancel', clear, { passive: true })

  return () => {
    el.removeEventListener('contextmenu', onCtx)
    el.removeEventListener('touchstart', onStart)
    el.removeEventListener('touchmove', onMove)
    el.removeEventListener('touchend', onEnd)
    el.removeEventListener('touchcancel', clear)
    clear()
  }
}
