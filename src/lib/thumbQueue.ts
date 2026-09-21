// 썸네일 합성 순서 — 보이는 카드 먼저(2026-09-21, 광장 목록 공급 점검).
//
// 광장 목록은 현재 쪽 ±1 쪽(최대 54장)을 DOM 에 두는데(가상화), 전부가 동시에 합성을 시작하면 화면 밖 36장이
// 메타·스프라이트 요청과 염색 계산을 나눠 가져 **지금 보이는 18장**이 늦게 뜬다.
//  · 우선순위 0(보이는 것) = 곧바로 시작한다(예전과 같은 속도 — 제한 없음).
//  · 우선순위 1 이상(앞뒤 쪽 미리 그리기) = 0 이 하나도 남지 않았을 때, 동시에 MAX_IDLE 개까지만.
// 쪽을 넘기면 카드의 우선순위가 바뀌므로(setPrio) 기다리던 카드가 곧바로 앞으로 온다. 사라진 카드는 cancel.

type Job = { prio: number; seq: number; run: () => Promise<void>; state: 'wait' | 'run' | 'gone' }

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
  waiting.sort((a, b) => a.prio - b.prio || a.seq - b.seq)
  while (waiting.length) {
    const j = waiting[0]
    if (j.state !== 'wait') { waiting.shift(); continue }
    if (j.prio > 0 && (runningTop > 0 || running >= MAX_IDLE)) return
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
