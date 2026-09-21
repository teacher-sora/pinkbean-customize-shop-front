// 썸네일 합성 순서 — 보이는 카드 먼저(2026-09-21, 광장 목록 공급 점검).
//
// 광장 목록은 현재 쪽 ±1 쪽(최대 54장)을 DOM 에 두는데(가상화), 전부가 동시에 합성을 시작하면 화면 밖 36장이
// 메타·스프라이트 요청과 염색 계산을 나눠 가져 **지금 보이는 18장**이 늦게 뜬다.
//  · 우선순위 0(보이는 것) = 먼저, 동시에 MAX_TOP 개까지.
//  · 우선순위 1 이상(앞뒤 쪽 미리 그리기) = 0 이 하나도 남지 않았을 때, 동시에 MAX_IDLE 개까지만.
// 쪽을 넘기면 카드의 우선순위가 바뀌므로(setPrio) 기다리던 카드가 곧바로 앞으로 온다. 사라진 카드는 cancel.
//
// ⚠️ 보이는 것에도 **반드시 상한이 있어야 한다**(2026-09-22 사용자 제보 — 광장 필터를 여러 번 오가면 끊길
// 정도로 느려졌다). 한 번 시작한 합성은 중간에 멈출 수 없는데(네트워크·픽셀 작업의 연쇄 await), 제한이 없으면
// 필터를 바꿀 때마다 18장이 통째로 새로 시작돼 '버려질 작업'이 메인 스레드에 계속 얹혔다. 상한을 두면 아직
// 시작 안 한 것은 cancel 로 그냥 사라진다 → 빨리 오갈수록 오히려 일이 줄어든다.
// 합성 자체가 CPU(픽셀) 작업이라 동시에 더 돌린다고 빨라지지도 않는다.

type Job = { prio: number; seq: number; run: () => Promise<void>; state: 'wait' | 'run' | 'gone' }

const MAX_TOP = 6
const MAX_IDLE = 4
let seq = 0
let running = 0
let runningTop = 0
const waiting: Job[] = []

function start(j: Job) {
  j.state = 'run'
  running++
  if (j.prio === 0) runningTop++
  const top = j.prio === 0
  j.run().catch(() => undefined).finally(() => {
    running--
    if (top) runningTop--
    pump()
  })
}

function pump() {
  // 취소된 것부터 걷어낸다 — 아래 루프는 막히면 바로 멈추므로, 남겨 두면 정렬 비용만 계속 늘어난다.
  for (let i = waiting.length - 1; i >= 0; i--) if (waiting[i].state !== 'wait') waiting.splice(i, 1)
  waiting.sort((a, b) => a.prio - b.prio || a.seq - b.seq)
  while (waiting.length) {
    const j = waiting[0]
    if (j.state !== 'wait') { waiting.shift(); continue }
    if (j.prio === 0 ? runningTop >= MAX_TOP : (runningTop > 0 || running >= MAX_IDLE)) return
    waiting.shift()
    start(j)
  }
}

export function enqueueThumb(prio: number, run: () => Promise<void>) {
  const j: Job = { prio, seq: seq++, run, state: 'wait' }
  waiting.push(j)
  pump()
  return {
    setPrio(p: number) { if (j.state === 'wait' && p !== j.prio) { j.prio = p; pump() } },
    cancel() { if (j.state === 'wait') j.state = 'gone' },
  }
}
