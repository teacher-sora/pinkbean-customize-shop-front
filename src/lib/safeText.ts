// 핑크빈 말풍선 안전망 — 성적·폭력적 표현이 화면에 올라가지 않게 막는다.
// 2026-09-21 사용자 제보: 말풍선에 "넥타이가 벌써부터 강간당한 기분 아니야?" 가 나왔다.
//
// 말은 모델(Qwen)이 짓는다. 지시문만으로는 확률을 낮출 뿐 **못 막는다** → 나온 문장을 코드로 검사한다.
// 서버(back/app.py `_unsafe`)가 같은 규칙으로 먼저 거르고, 여기서 화면에 붙이기 직전 한 번 더 본다
// (백엔드는 따로 배포되므로, 그쪽이 옛 버전이어도 사용자는 보지 않게 된다).
// 걸린 문장은 **고치지 않고 버린다.** 말풍선은 원래 2~3개라 하나 줄어도 티가 안 나고, 다 버려지면
// 안전한 기본 문구로 대신한다(safeBubbles).
//
// 오탐이 나면 말풍선 하나를 잃을 뿐이라 넉넉하게 잡되, **패션 얘기에서 정상적으로 쓰이는 말**은 일부러 뺐다:
//   · '노출'(노출이 심한 옷) · '누드'(누드톤) · '로리타'(패션 장르) · '벗겨'(칠이 벗겨진)
//   · '죽여'(죽여주는 코디 = 칭찬) · '사정'(사정이 있어) · '보지/자지'(보지 마, 만지지 — 어미와 겹친다)
//   · '씹'(씹다) — 욕설 형태('씹할' 등)만 따로 잡는다.

// ① 띄어쓰기·기호를 무시하고 찾는다("강 간", "강.간", "강-간" 도 잡힌다). 오탐 위험이 낮은 말만 넣는다.
const LOOSE = [
  // 성폭력
  '강간', '윤간', '성폭행', '성폭력', '성추행', '강제추행', '성희롱', '몰카', '불법촬영', '그루밍범죄',
  '근친상간', '수간', '시간증', '아동포르노', '아동성착취', '미성년자성', '로리콘', '쇼타콘', '따먹',
  // 성적 표현
  '섹스', '섹드립', '섹파', '야동', '포르노', '음란', '외설', '페티시', '노출증', '스와핑', '콘돔',
  '오르가슴', '자위행위', '발기', '정액', '애액', '유두', '젖꼭지', '성기', '음경', '고환', '질내',
  '삽입', '교미', '발정', '떡치', '야스', '19금', '성인물', '에로물', '변태성', '딜도', '사까시',
  // 자해
  '자살', '자해',
]

// ② 글자 그대로만 찾는다(짧아서 다른 낱말에 묻어 나올 수 있다).
const TIGHT = ['좆', '씨발', '씹할', '씹새', '병신', '지랄', '개새끼', '니미', '썅', '창녀', '화냥']
const TIGHT_RE = /시발(?!점|역|탄)/ // '시발점'(시작점)은 정상 낱말이라 뺀다

// ③ 영문은 **낱말 경계**로 찾는다('unisex' 가 'sex' 로 걸리면 안 된다).
const EN = ['rape', 'raping', 'molest', 'incest', 'bestiality', 'porn', 'porno', 'nsfw', 'orgasm',
  'masturbate', 'masturbation', 'blowjob', 'handjob', 'dildo', 'horny', 'boobs', 'tits', 'pussy',
  'dick', 'penis', 'vagina', 'nipple', 'naked', 'sex', 'sexual', 'cum', 'slut', 'whore']
const EN_RE = new RegExp(`\\b(?:${EN.join('|')})\\b`, 'i')

const SQUEEZE = /[^0-9A-Za-z가-힣]+/g

/** 화면에 올려도 되는 문장인가. 걸리면 false. */
export function safeBubble(text: string): boolean {
  const raw = (text || '').normalize('NFKC')
  if (!raw.trim()) return false
  const low = raw.toLowerCase()
  if (TIGHT.some((w) => low.includes(w)) || TIGHT_RE.test(low)) return false
  if (EN_RE.test(low)) return false
  const squeezed = low.replace(SQUEEZE, '')
  return !LOOSE.some((w) => squeezed.includes(w))
}

// 다 걸러졌을 때 대신 보여 줄 말(모델을 거치지 않는 고정 문구).
const FALLBACK = ['뀨…? 지금은 좀 부끄러운걸!', '음… 뭐라고 해야 하지?']

/** 말풍선 목록에서 안전한 것만 남긴다. 하나도 안 남으면 고정 문구를 돌려준다. */
export function safeBubbles(list: unknown): string[] {
  const kept = (Array.isArray(list) ? list : [])
    .map((b) => String(b ?? '').trim())
    .filter((b) => b && safeBubble(b))
  return kept.length ? kept : FALLBACK.slice()
}
