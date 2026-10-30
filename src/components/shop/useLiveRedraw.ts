import { useEffect, useRef } from 'react'

// 발색 슬라이더를 드래그하는 동안에도 "렉 없이 + 바로바로" 다시 그리기 위한 훅.
//  - single-flight: 무거운 리컬러(applyHsb 등)를 한 번에 하나만 실행 → 파이프라인 폭주(렉 원인)를 원천 차단.
//  - 최신값 수렴(dirty 플래그): 그리는 중에 값이 또 바뀌면(dirty=true) 현재 그리기를 끝낸 뒤 최신 값으로 다시 그린다.
//  - UI 양보: 재계산 사이에 setTimeout(0) 로 이벤트 루프에 양보 → 드래그/슬라이더가 매끄럽게 반응한다.
// dirty 플래그만 쓰므로 StrictMode 의 mount→unmount→remount 이중 호출에도 멈추지 않는다(리마운트가 dirty 를
// 다시 세팅 → 돌던 pump 가 이를 감지해 최신값으로 그린다). 고정 디바운스와 달리 연속 드래그 중에도 계속 갱신된다.
//  - stale(): 도는 중에 새 값이 들어왔는지. 급하지 않은 뒷일(미리보기의 전 프레임 염색)은 이것을 보고 그만둔다 —
//    한 번에 하나만 도니, 뒷일을 끝까지 하면 다음 장착의 '보이는 프레임'이 그 뒤로 밀려 미리보기가 직전 그림에 멈춰 있었다.
export function useLiveRedraw(compute: (stale: () => boolean) => Promise<void>, deps: unknown[]) {
  const computeRef = useRef(compute)
  computeRef.current = compute // 매 렌더마다 최신 파라미터를 캡처한 compute 로 갱신
  const running = useRef(false)
  const dirty = useRef(false)
  const stale = useRef(() => dirty.current).current
  useEffect(() => {
    dirty.current = true
    const pump = async () => {
      if (running.current) return // 이미 도는 pump 가 dirty 를 보고 최신값으로 다시 그린다
      running.current = true
      while (dirty.current) {
        dirty.current = false
        try { await computeRef.current(stale) } catch { /* ignore */ }
        if (dirty.current) await new Promise((r) => setTimeout(r, 0)) // 재계산 전 UI 에 양보
      }
      running.current = false
    }
    pump()
  }, deps)
}
