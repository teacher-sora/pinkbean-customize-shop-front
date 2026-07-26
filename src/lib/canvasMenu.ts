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

// centered=true: 화면 중앙에 큰 다이얼로그(모바일 롱프레스용, 뒤 마스크 없음).
//        false : 커서 옆 작은 컨텍스트 메뉴(데스크톱 우클릭용).
export function openCanvasMenu (x: number, y: number, items: CanvasMenuItem[], opts?: { centered?: boolean }): void {
  closeCanvasMenu()
  const centered = !!opts?.centered
  const el = document.createElement('div')
  el.setAttribute('role', 'menu')
  el.setAttribute('data-pb-canvas-menu', '')
  el.oncontextmenu = (e) => e.preventDefault() // 메뉴 위에서 다시 우클릭해도 브라우저 기본 메뉴가 안 뜨게
  Object.assign(el.style, centered
    ? {
        position: 'fixed', zIndex: '9999', left: '50%', top: '50%',
        transform: 'translate(-50%,-50%) scale(.96)', width: 'min(320px, 84vw)', padding: '9px',
        background: '#fff', border: '1px solid #efe8e0', borderRadius: '18px',
        boxShadow: '0 18px 50px rgba(42,37,33,.24)', font: '15px system-ui, "Malgun Gothic", sans-serif',
        color: '#2a2521', userSelect: 'none', opacity: '0',
        transition: 'opacity .14s ease, transform .14s cubic-bezier(.22,.61,.36,1)',
      } as unknown as CSSStyleDeclaration
    : {
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
    Object.assign(b.style, centered
      ? {
          display: 'block', width: '100%', textAlign: 'center', padding: '15px 16px',
          border: 'none', background: 'transparent', borderRadius: '12px', cursor: 'pointer',
          font: 'inherit', fontWeight: '600', color: it.danger ? '#c0392b' : '#2a2521', whiteSpace: 'nowrap',
        } as unknown as CSSStyleDeclaration
      : {
          display: 'block', width: '100%', textAlign: 'left', padding: '8px 11px',
          border: 'none', background: 'transparent', borderRadius: '7px', cursor: 'pointer',
          font: 'inherit', color: it.danger ? '#c0392b' : '#2a2521', whiteSpace: 'nowrap',
        } as CSSStyleDeclaration)
    b.onmouseenter = () => { b.style.background = it.danger ? '#fdecea' : '#f6edf2' }
    b.onmouseleave = () => { b.style.background = 'transparent' }
    // 터치 하이라이트(누르는 느낌).
    b.addEventListener('touchstart', () => { b.style.background = it.danger ? '#fdecea' : '#f6edf2' }, { passive: true })
    b.onclick = () => { closeCanvasMenu(); it.onClick() }
    el.appendChild(b)
  }

  document.body.appendChild(el)
  current = el // ★ 반드시 대입 — 안 하면 closeCanvasMenu 가 노드를 못 지워 메뉴가 무한 누적된다.
  if (centered) {
    el.style.opacity = '1'
    el.style.transform = 'translate(-50%,-50%) scale(1)'
  } else {
    // 뷰포트 밖으로 나가지 않게 위치 보정.
    const r = el.getBoundingClientRect()
    const px = Math.min(x, window.innerWidth - r.width - 8)
    const py = Math.min(y, window.innerHeight - r.height - 8)
    el.style.left = Math.max(8, px) + 'px'
    el.style.top = Math.max(8, py) + 'px'
    el.style.opacity = '1'
  }

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

// 미리보기 캔버스 공용: 우클릭/롱프레스 → "이미지 복사 / 이미지 저장" 메뉴. getBlob 이 내보내기 이미지를 만든다.
// centered=true 면 화면 중앙 큰 다이얼로그(모바일용).
export function openImageMenu (x: number, y: number, getBlob: () => Promise<Blob | null>, filename: string, centered?: boolean): void {
  openCanvasMenu(x, y, [
    { label: '이미지 복사', onClick: async () => flashToast((await copyImage(getBlob)) ? '이미지를 복사했어요' : '이미지 복사에 실패했어요') },
    { label: '이미지 저장', onClick: async () => { const r = await saveImage(getBlob, filename); if (r === 'saved') flashToast('이미지를 저장했어요'); else if (r === 'error') flashToast('이미지 저장에 실패했어요') } }, // 취소는 조용히
  ], { centered })
}

// 요소에 "우클릭(데스크톱·안드로이드) + 롱프레스(iOS 등 터치)" 를 모두 걸어 이미지 메뉴를 띄운다.
// 반환값은 해제 함수. 렌더와 무관한 이벤트 리스너만 붙이므로 성능 영향 없음.
export function bindImageMenu (el: HTMLElement, getBlob: () => Promise<Blob | null>, filename: string): () => void {
  // 터치 위주 기기(모바일)면 롱프레스 → 중앙 큰 다이얼로그. 마우스면 우클릭 → 커서 옆 작은 메뉴.
  const coarse = typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: coarse)')?.matches
  // 우클릭: 마우스 기기에서만 메뉴를 연다. 터치 기기(안드로이드)는 롱프레스 타이머가 중앙 다이얼로그를 열고,
  // 여기선 네이티브 메뉴만 막는다(둘 다 열려 중복되는 걸 방지).
  const onCtx = (e: MouseEvent) => { e.preventDefault(); if (!coarse) openImageMenu(e.clientX, e.clientY, getBlob, filename, false) }
  el.addEventListener('contextmenu', onCtx)
  // 롱프레스 시 iOS 네이티브 콜아웃/이미지 드래그·선택(영역 드래그)을 막고 우리 메뉴로 대체.
  el.style.setProperty('-webkit-touch-callout', 'none')
  el.style.setProperty('-webkit-user-select', 'none')
  el.style.setProperty('user-select', 'none')
  el.style.setProperty('-webkit-user-drag', 'none')
  el.setAttribute('draggable', 'false')
  const onDrag = (e: Event) => e.preventDefault() // 이미지 드래그 시작 자체를 차단
  el.addEventListener('dragstart', onDrag)

  // 터치 롱프레스 직접 감지(iOS Safari 는 롱프레스에 contextmenu 를 안 쏜다).
  let timer: ReturnType<typeof setTimeout> | null = null
  let sx = 0, sy = 0, fired = false
  const clear = () => { if (timer) { clearTimeout(timer); timer = null } }
  const onStart = (e: TouchEvent) => {
    if (e.touches.length !== 1) { clear(); return }
    const t = e.touches[0]; sx = t.clientX; sy = t.clientY; fired = false
    clear()
    timer = setTimeout(() => { fired = true; openImageMenu(sx, sy, getBlob, filename, true) }, 500) // ≈0.5초 꾹 → 중앙 다이얼로그
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
    el.removeEventListener('dragstart', onDrag)
    el.removeEventListener('touchstart', onStart)
    el.removeEventListener('touchmove', onMove)
    el.removeEventListener('touchend', onEnd)
    el.removeEventListener('touchcancel', clear)
    clear()
  }
}
