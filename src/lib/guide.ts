// 기능 안내(건의함의 '질문' 탭과 건의 등록 전 확인)가 쓰는 기능 목록. **이 목록이 곧 안내의 전부다.**
//  · AI(back 의 /guide)는 질문을 보고 이 목록에서 맞는 항목의 id 를 고르기만 한다. 화면에 보이는 설명 · 위치 · '열어 보기'는
//    모두 여기 적힌 글이다 — 모델이 없는 메뉴나 틀린 위치를 지어낼 수 없다(ARCHITECTURE 3-6).
//  · 기능을 더하거나 자리를 옮기면 **이 목록도 같이 고친다**. 고치지 않으면 안내가 옛 자리를 가리킨다.
//  · PC 와 휴대폰은 화면의 짜임이 다르다(PC 는 미리보기 아래 줄에 배율 · 액션 · 모션 · 표정이 늘 있고, 휴대폰은 연출 설정 시트 안에 있다).
//    그래서 항목마다 휴대폰 글(m)과 PC 글(pc)을 따로 둘 수 있다. 없으면 공통 글을 쓴다(guideFor).
//  · words = 사람들이 실제로 묻는 말투(건의함에 올라온 글에서 모았다). 모델이 고를 때 참고한다.
//  · go = '열어 보기'. tab = 그 탭으로, sheet = 그 창을 연다, pick = 휴대폰 연출 설정 시트를 그 고르기 화면(표정 등)으로 연다,
//    group = 연출 설정의 캐릭터 / 이펙트 칸, drawer = PC 미리보기 아래 연출 설정을 펼친다,
//    spot = 도착한 화면에서 그 요소(`data-guide`)를 잠깐 테두리로 가리키고(입력칸이면 커서를 둔다), click = 가리킨 뒤 눌러 연다.

import { backApi } from './backApi'
import { safeBubble } from './safeText'

export type GuideGo = {
  tab?: 'codi' | 'search' | 'info' | 'preset' | 'share'; sheet?: 'pv' | 'bg' | 'part' | 'bm'
  pick?: 'action' | 'weapon' | 'expr'; group?: 'char' | 'effect'; drawer?: 'char' | 'effect'; spot?: string; click?: boolean
}
type GuideText = { title: string; where: string; how: string; go?: GuideGo }
export type GuideEntry = GuideText & { id: string; words: string; m?: Partial<GuideText>; pc?: Partial<GuideText> }

export const GUIDE: GuideEntry[] = [
  { id: 'expr', title: '표정 바꾸기', where: '연출 설정 > 표정', how: '미리보기의 연출 설정을 누르고 표정을 고르면 표정 그림을 보며 골라 입혀 볼 수 있어요.',
    words: '표정, 얼굴 표정, 웃는 얼굴, 윙크, 눈 감기, 화난 표정, 게슴츠레', go: { tab: 'codi', sheet: 'pv', pick: 'expr' },
    pc: { where: '미리보기 아래 > 표정', how: '미리보기 아래 줄의 표정을 누르면 표정 그림이 올라와요. 골라서 바로 입혀 볼 수 있어요.', go: { tab: 'codi', spot: 'expr', click: true } } },
  { id: 'action', title: '자세(액션) 바꾸기', where: '연출 설정 > 액션', how: '미리보기의 연출 설정에서 액션을 누르면 걷기, 앉기, 점프 같은 자세를 그림으로 보며 고를 수 있어요.',
    words: '포즈, 자세, 걷기, 앉기, 점프, 누워, 모션, 움직이게', go: { tab: 'codi', sheet: 'pv', pick: 'action' },
    pc: { where: '미리보기 아래 > 액션', how: '미리보기 아래 줄의 액션을 누르면 걷기, 앉기, 점프 같은 자세를 그림으로 보며 고를 수 있어요.', go: { tab: 'codi', spot: 'action', click: true } } },
  { id: 'weapon', title: '무기 모션', where: '연출 설정 > 모션', how: '미리보기의 연출 설정에서 모션을 누르면 한손, 두손, 건 같은 무기 드는 자세를 바꿀 수 있어요.',
    words: '무기 드는 자세, 건모션, 한손 두손, 무기 모션', go: { tab: 'codi', sheet: 'pv', pick: 'weapon' },
    pc: { where: '미리보기 아래 > 모션', how: '미리보기 아래 줄의 모션을 누르면 한손, 두손, 건 같은 무기 드는 자세를 바꿀 수 있어요.', go: { tab: 'codi', spot: 'weapon', click: true } } },
  { id: 'zoom', title: '캐릭터 크기(배율)', where: '연출 설정 > 배율', how: '미리보기의 연출 설정에서 배율로 캐릭터를 1배부터 3배까지 키우거나 줄일 수 있어요. 1배가 가장 작아요.',
    words: '크기, 확대, 축소, 작게, 크게, 인게임 비율, 잘려요, 배율', go: { tab: 'codi', sheet: 'pv' },
    pc: { where: '미리보기 아래 > 배율', how: '미리보기 아래 줄의 배율에서 캐릭터를 1배부터 3배까지 키우거나 줄일 수 있어요. 1배가 가장 작아요.', go: { tab: 'codi', spot: 'zoom', click: true } } },
  { id: 'form', title: '형상 변이, 귀, 시선', where: '연출 설정 > 캐릭터', how: '미리보기의 연출 설정에서 캐릭터 칸을 고르면 형상 변이(호영, 라라, 렌), 귀(엘프, 레프), 시선(보는 방향)을 바꿀 수 있어요.',
    words: '아니마, 호영 꼬리, 라라 뿔, 렌, 엘프 귀, 레프 귀, 뒤돌기, 뒷모습, 방향, 시선', go: { tab: 'codi', sheet: 'pv', group: 'char' },
    pc: { where: '미리보기 아래 > 연출 설정 > 캐릭터', how: '미리보기 아래 줄 끝의 연출 설정을 펼치면 형상 변이(호영, 라라, 렌), 귀(엘프, 레프), 시선(보는 방향)을 바꿀 수 있어요.', go: { tab: 'codi', drawer: 'char' } } },
  { id: 'effect', title: '이펙트 끄고 켜기', where: '연출 설정 > 이펙트', how: '미리보기의 연출 설정에서 이펙트 칸을 고르면 무기, 망토, 모자 이펙트를 각각 끄거나 켤 수 있어요.',
    words: '이펙트 끄기, 무기 이펙트, 망토 이펙트, 반짝이 없애기, 효과 끄기', go: { tab: 'codi', sheet: 'pv', group: 'effect' },
    pc: { where: '미리보기 아래 > 연출 설정 > 이펙트', how: '미리보기 아래 줄 끝의 연출 설정을 펼치고 이펙트를 고르면 무기, 망토, 모자 이펙트를 각각 끄거나 켤 수 있어요.', go: { tab: 'codi', drawer: 'effect' } } },
  { id: 'nick', title: '닉네임으로 코디 불러오기', where: '프리셋 탭 > 위쪽 입력칸', how: '프리셋 탭 위쪽 칸에 캐릭터 닉네임을 넣고 불러오기를 누르면 게임 속 코디와 염색을 그대로 가져와요.',
    words: '닉네임 검색, 내 캐릭터, 인게임 코디 가져오기, 캐릭터 이름, 넥슨, 불러오기', go: { tab: 'preset', spot: 'nick' } },
  { id: 'link-in', title: '공유 링크로 코디 받기', where: '프리셋 탭 > 위쪽 입력칸', how: '받은 공유 링크를 프리셋 탭 위쪽 칸에 붙여 넣고 불러오기를 누르거나, 링크를 그냥 열면 돼요.',
    words: '링크 붙여넣기, 코드 입력, 받은 코디, 공유 코드', go: { tab: 'preset', spot: 'nick' } },
  { id: 'link-out', title: '코디 공유하기', where: '맨 위 복사 버튼', how: '맨 위의 복사를 누르면 지금 코디의 공유 링크가 복사돼요. 미리보기를 크게 볼 때는 왼쪽 위 링크 버튼으로도 돼요.',
    words: '공유, 링크 복사, 친구에게 보내기, 디스코드, 카톡', go: { spot: 'copy' },
    pc: { where: '맨 위 프리셋 복사 버튼', how: '맨 위의 프리셋 복사를 누르면 지금 코디의 공유 링크가 복사돼요. 프리셋 카드의 복사 띠지로도 돼요.' } },
  { id: 'preset', title: '프리셋 저장', where: '프리셋 탭', how: '프리셋은 30칸이고, 고른 칸에 지금 코디가 저절로 저장돼요. 이름은 카드에서 바로 바꿀 수 있어요.',
    words: '저장, 코디 저장, 여러 코디, 슬롯, 이름 바꾸기', go: { tab: 'preset' } },
  { id: 'dye', title: '염색하기', where: '염색 탭, 미리보기 오른쪽 아래 부위 염색', how: '아래 염색 탭에서 부위를 고르거나, 미리보기 오른쪽 아래 물방울 버튼(부위 염색)에서 바로 염색할 수 있어요. 헤어와 성형은 믹스 염색이에요.',
    words: '염색, 색 바꾸기, 믹스 염색, 헤어 색, 렌즈 색, 색조 채도 명도, 프리즘', go: { tab: 'info' },
    pc: { where: '코디 정보 / 염색 탭, 미리보기 왼쪽 위 부위 염색', how: '코디 정보 / 염색 탭에서 부위를 고르거나, 미리보기 왼쪽 위 부위 염색에서 바로 염색할 수 있어요. 헤어와 성형은 믹스 염색이에요.' } },
  { id: 'dye-table', title: '염색표', where: '헤어, 성형 염색 창 > 염색표', how: '헤어와 성형 염색 창에서 염색표를 누르면 베이스 색과 믹스 색을 표에서 한 번에 고를 수 있어요.',
    words: '염색표, 발색표, 색 비교, 한눈에', go: { tab: 'info' } },
  { id: 'dot', title: '점 위치 옮기기', where: '미리보기 오른쪽 아래 점 위치', how: '점이 있는 얼굴 장식을 입으면 미리보기 오른쪽 아래 점 위치 버튼이 켜져요. 눌러서 점을 원하는 자리로 옮길 수 있어요.',
    words: '점, 얼굴 점, 점 옮기기, 위치 조절', go: { tab: 'codi', spot: 'dot' },
    pc: { where: '미리보기 > 점 위치', how: '점이 있는 얼굴 장식을 입으면 미리보기의 점 위치 버튼이 켜져요. 눌러서 점을 원하는 자리로 옮길 수 있어요.' } },
  { id: 'bg', title: '미리보기 배경 바꾸기', where: '미리보기 > 연출 설정 옆 그림 버튼', how: '미리보기의 연출 설정 옆 그림 버튼에서 피팅룸, 흰색, 검은색, 직접 올린 그림 가운데 고를 수 있어요.',
    words: '배경, 배경 바꾸기, 흰 배경, 검은 배경, 내 사진, 배경 업로드', go: { tab: 'codi', sheet: 'bg' },
    pc: { where: '미리보기 왼쪽 위 > 배경', how: '미리보기 왼쪽 위의 배경에서 피팅룸, 흰색, 검은색, 직접 올린 그림 가운데 고를 수 있어요.' } },
  { id: 'image', title: '캐릭터 이미지 저장, 복사(배경 투명)', where: '미리보기 캐릭터 길게 누르기', how: '캐릭터를 길게 누르면 이미지를 복사하거나 저장할 수 있어요. 미리보기를 크게 볼 때는 왼쪽 위 저장 버튼으로도 돼요. 배경은 투명해요.',
    words: '이미지 저장, 사진 저장, 캡처, 투명 배경으로 저장, 배경 없이 저장, png, 다운로드, 복사',
    pc: { where: '미리보기 캐릭터 우클릭', how: '캐릭터를 우클릭하면 캐릭터 이미지를 복사하거나 저장할 수 있어요. 저장한 이미지는 배경이 투명해요.' } },
  { id: 'bookmark', title: '북마크와 코디 비교', where: '미리보기 오른쪽 아래 북마크', how: '아이템 카드의 북마크로 모아 두고, 미리보기 오른쪽 아래 북마크 창에서 지금 코디와 나란히 비교(VS)할 수 있어요.',
    words: '찜, 북마크, 비교, 나란히, vs', go: { tab: 'codi', sheet: 'bm' },
    pc: { where: '미리보기 아래 북마크', how: '아이템 카드의 북마크로 모아 두면 미리보기 아래 북마크 칸에 쌓여요. VS 로 지금 코디와 나란히 비교할 수 있어요.', go: { tab: 'codi', spot: 'bm' } } },
  { id: 'ai-search', title: 'AI 코디 검색', where: 'AI 검색 탭', how: '원하는 생김새를 문장으로 적으면 어울리는 아이템을 찾아 줘요. 예: 하얀 리본이 달린 모자.',
    words: '문장 검색, 비슷한 아이템, 생김새로 찾기, 스타일 검색', go: { tab: 'search', spot: 'ai' },
    pc: { where: 'AI 코디 검색 탭' } },
  { id: 'find', title: '아이템 찾기와 보기 방식', where: '코디 탭 > 목록 머리', how: '코디 탭 목록 머리에서 이름 검색, 신규만 보기, 성별, 보기 방식(아이템, 기본 캐릭터, 내 캐릭터)을 고를 수 있어요.',
    words: '검색, 이름 검색, 신규, 새로 나온, 성별, 내 캐릭터로 보기, 입혀서 보기', go: { tab: 'codi' } },
  { id: 'hide', title: '부위 숨기기, 전체 벗기', where: '염색 탭', how: '아래 염색 탭에서 부위의 눈 아이콘으로 입은 채 숨기거나, 전체 벗기로 한 번에 벗을 수 있어요.',
    words: '숨기기, 안 보이게, 벗기, 전부 벗기, 맨몸', go: { tab: 'info', spot: 'unequip' },
    pc: { where: '코디 정보 / 염색 탭', how: '코디 정보 / 염색 탭에서 부위의 눈 아이콘으로 입은 채 숨기거나, 전체 벗기로 한 번에 벗을 수 있어요.' } },
  { id: 'undo', title: '되돌리기, 다시실행', where: '미리보기 오른쪽 위', how: '미리보기 오른쪽 위의 화살표 버튼으로 방금 바꾼 것을 되돌리거나 다시 실행할 수 있어요.',
    words: '취소, 되돌리기, 실수, 이전으로', go: { tab: 'codi', spot: 'undo' } },
  { id: 'rate', title: '핑크빈 코디 평가', where: '맨 위 평가 버튼', how: '맨 위의 평가를 누르면 핑크빈이 나와서 코디를 보고 한마디 해요.',
    words: '평가, 핑크빈, 말풍선, 반응', go: { spot: 'rate' },
    pc: { where: '맨 위 코디 평가 버튼', how: '맨 위의 코디 평가를 누르면 핑크빈이 나와서 코디를 보고 한마디 해요.' } },
  { id: 'plaza', title: '코디 광장', where: '광장 탭', how: '다른 사람이 올린 코디를 구경하고, 마음에 들면 내 프리셋으로 가져오거나 좋아요를 누를 수 있어요.',
    words: '다른 사람 코디, 구경, 가져오기, 좋아요, 랭킹', go: { tab: 'share' }, pc: { where: '코디 광장 탭' } },
  { id: 'plaza-up', title: '내 코디 올리기', where: '광장 탭 > 내 코디 등록', how: '코디 광장의 내 코디 등록에서 프리셋을 골라 이름, 설명, 태그와 함께 올릴 수 있어요.',
    words: '코디 올리기, 업로드, 자랑, 등록', go: { tab: 'share' }, pc: { where: '코디 광장 탭 > 내 코디 등록' } },
  { id: 'pinch', title: '화면 손가락 확대', where: '어디서나', how: '두 손가락으로 화면을 벌려 확대할 수 있어요. 캐릭터만 키우려면 맨 위 보기 버튼이나 연출 설정의 배율을 써 보세요.',
    words: '핀치 줌, 손가락 확대, 화면 확대, 크게 보기',
    pc: { title: '화면 확대', where: '브라우저 확대', how: 'Ctrl 과 + 로 화면 전체를 키울 수 있어요. 캐릭터만 키우려면 미리보기 아래 줄의 배율을 써 보세요.', go: { tab: 'codi', spot: 'zoom' } } },
  { id: 'view', title: '캐릭터 크게 보기', where: '맨 위 보기 버튼', how: '맨 위의 보기 버튼 셋 가운데 크게, 캐릭터만을 누르면 미리보기가 넓어지고 캐릭터도 커져요.',
    words: '크게 보기, 넓게, 전체 화면, 캐릭터만, 목록 숨기기', go: { tab: 'codi', spot: 'view' },
    pc: { where: '미리보기 아래 > 배율', how: 'PC 는 미리보기가 늘 크게 보여요. 캐릭터를 더 키우려면 미리보기 아래 줄의 배율을 3배로 바꿔 보세요.', go: { tab: 'codi', spot: 'zoom', click: true } } },
  { id: 'sky', title: '배경 시간대, 배경 보기', where: 'PC 화면에만 있어요', how: '시간대와 배경 보기는 PC 화면에만 있어요. 휴대폰에서는 미리보기 배경을 바꿀 수 있어요.',
    words: '밤, 낮, 시간대, 배경만 보기, 하늘', go: { tab: 'codi', sheet: 'bg' },
    pc: { where: '맨 위 도구 모음', how: '맨 위의 시간대 버튼으로 낮, 석양, 밤을 고르고, 배경 보기로 화면을 걷고 배경만 볼 수 있어요.', go: undefined } },
]

export const guideById = new Map(GUIDE.map((g) => [g.id, g]))
// 지금 기기에 맞는 글(휴대폰 m / PC pc 가 있으면 그것, 없으면 공통). go 를 undefined 로 덮으면 '열어 보기'가 없다
export function guideFor(g: GuideEntry, mobile: boolean): GuideEntry {
  const o = mobile ? g.m : g.pc
  return o ? { ...g, ...o } : g
}
// 모델에 넘기는 목록(짧게 — 질문마다 같이 보낸다). 지금 기기의 글로 보낸다
const catalog = (mobile: boolean) => GUIDE.map((g0) => { const g = guideFor(g0, mobile); return { id: g.id, t: `${g.title} (${g.where}) ${g.how} / ${g.words}` } })

// 안내 서버의 답. feature = ids 의 기능들, none = 목록에 없다, chat = 인사에 대한 reply, error = 서버 · 모델 실패
export type GuideReply = { kind: 'feature' | 'none' | 'chat' | 'error'; ids: string[]; reply: string }
// mode: ask = 질문 탭, check = 건의를 올리기 전 확인(이미 있는 기능일 때만 feature)
export async function askGuide(q: string, mode: 'ask' | 'check', history: { r: string; t: string }[], mobile: boolean): Promise<GuideReply> {
  try {
    const r = await fetch(`${backApi()}/guide`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ q, mode, history, catalog: catalog(mobile) }),
      signal: AbortSignal.timeout(20000),
    })
    if (!r.ok) return { kind: 'error', ids: [], reply: '' }
    const d = await r.json()
    const ids = (Array.isArray(d.ids) ? d.ids : []).filter((id: unknown): id is string => typeof id === 'string' && guideById.has(id))
    const kind = d.kind === 'feature' && ids.length ? 'feature' : d.kind === 'chat' || d.kind === 'none' ? d.kind : 'error'
    // 인사의 답도 화면 직전에 한 번 더 거른다(lib/safeText — 말풍선과 같은 안전망)
    const reply = typeof d.reply === 'string' && safeBubble(d.reply) ? d.reply.slice(0, 140) : ''
    return { kind: kind === 'chat' && !reply ? 'none' : kind, ids: kind === 'feature' ? ids : [], reply }
  } catch { return { kind: 'error', ids: [], reply: '' } }
}

// 휴대폰 연출 설정 시트를 '열어 보기'로 열 때 처음 보일 화면(고르기 화면 · 칸). 시트가 열리며 한 번 꺼내 쓴다(PvSheetBody)
let pvIntent: { pick?: GuideGo['pick']; group?: GuideGo['group'] } | null = null
export const setPvIntent = (v: typeof pvIntent) => { pvIntent = v }
export const takePvIntent = () => { const v = pvIntent; pvIntent = null; return v }

// 도착한 화면에서 그 요소(data-guide)를 잠깐 테두리로 가리킨다. 입력칸이면 커서를 둔다. 보이는 것 하나만.
// click = 가리킨 뒤 눌러 연다(PC 미리보기 아래 표정 등 — 스크롤이 멈춘 뒤에 눌러야 팝오버가 제자리에 뜬다)
export function guideSpot(spot: string, click = false) {
  const el = [...document.querySelectorAll<HTMLElement>(`[data-guide~="${spot}"]`)].find((e) => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden')
  if (!el) return
  el.scrollIntoView({ block: 'center', behavior: 'smooth' })
  if (el.matches('input, textarea')) el.focus({ preventScroll: true })
  el.classList.remove('pb-guidehit')
  void el.offsetWidth
  el.classList.add('pb-guidehit')
  window.setTimeout(() => el.classList.remove('pb-guidehit'), 1900)
  if (click && !(el as HTMLButtonElement).disabled) window.setTimeout(() => { if (el.isConnected) el.click() }, 320)
}

// PC 미리보기 아래 연출 설정 펼치기(PreviewColumn 이 듣는다)
export const GUIDE_DRAWER_EVENT = 'pb-guide-drawer'
