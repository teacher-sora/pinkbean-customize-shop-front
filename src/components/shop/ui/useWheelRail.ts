'use client'

// 막대를 숨긴 가로 줄(`pb-norail`): 마우스 휠 → 가로 스크롤(rAF 보간). 양끝 흐림은 다른 스크롤 칸과 같은 pb-fade(ui/useScrollFade).
// 하단 부위 줄(nav/BottomNav)과 채팅 이모티콘 묶음 줄(preview/ChatBar)이 함께 쓴다.
// ⚠️ 줄은 CSS scroll-behavior:smooth 라 휠마다 scrollLeft += d 를 넣으면 진행 중인 스무스 스크롤이 중간 위치에서
//    매번 다시 시작돼 거리가 깎이고 뻑뻑하게 끊긴다 → 목표 위치를 누적하고 rAF 로 직접 보간(scrollTo instant).
// on: 줄이 나중에 붙는 경우(떠 있는 목록) 붙을 때 다시 건다.
import { useEffect, useRef } from 'react'

export function useWheelRail<T extends HTMLElement = HTMLElement>(on = true) {
  const railRef = useRef<T | null>(null)
  useEffect(() => {
    const el = railRef.current; if (!on || !el) return
    let target = el.scrollLeft, raf = 0
    // ⚠️ scrollLeft 는 정수로 반올림된다. 남은 거리의 20% 가 1px 이 안 되면(남은 거리 < 5px) 그 걸음이 반올림으로 사라져
    //    끝에서 2px 모자란 채 멈췄다 — 양끝 흐림이 끝까지 넘겨도 남았고, 프레임 루프도 멈추지 않았다. 그때는 목표에 바로 붙인다.
    const tick = () => {
      const cur = el.scrollLeft
      const diff = target - cur
      if (Math.abs(diff * 0.2) < 1) { el.scrollTo({ left: target, behavior: 'instant' as ScrollBehavior }); raf = 0; return }
      el.scrollTo({ left: cur + diff * 0.2, behavior: 'instant' as ScrollBehavior })
      raf = requestAnimationFrame(tick)
    }
    const onWheel = (e: WheelEvent) => {
      const max = el.scrollWidth - el.clientWidth
      if (max < 2) return
      let d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY
      if (!d) return
      if (e.deltaMode === 1) d *= 16; else if (e.deltaMode === 2) d *= el.clientWidth
      e.preventDefault()
      if (!raf) target = el.scrollLeft // 멈춰 있을 땐 실제 위치(터치 드래그 등으로 바뀌었을 수 있음)에서 시작
      target = Math.max(0, Math.min(max, target + d))
      if (!raf) raf = requestAnimationFrame(tick)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => { cancelAnimationFrame(raf); el.removeEventListener('wheel', onWheel) }
  }, [on])
  return railRef
}
