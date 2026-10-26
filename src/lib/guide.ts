// 기능 안내('도움 및 건의함'의 도움 탭과 건의 등록 전 확인)가 쓰는 기능 목록. **이 목록이 곧 안내의 전부다.**
//  · AI(back 의 /guide)는 질문을 보고 이 목록에서 맞는 항목의 id 를 고르기만 한다. 화면에 보이는 설명 · 위치 · '열어 보기'는
//    모두 여기 적힌 글이다 — 모델이 없는 메뉴나 틀린 위치를 지어낼 수 없다(ARCHITECTURE 3-6).
//  · 기능을 더하거나 자리를 옮기면 **이 목록도 같이 고친다**. 고치지 않으면 안내가 옛 자리를 가리킨다.
//  · PC 와 휴대폰은 화면의 짜임이 다르다(PC 는 미리보기 아래 줄에 배율 · 액션 · 모션 · 표정이 늘 있고, 휴대폰은 연출 설정 시트 안에 있다).
//    그래서 항목마다 휴대폰 글(m)과 PC 글(pc)을 따로 둘 수 있다. 없으면 공통 글을 쓴다(guideFor).
//  · words = 사람들이 실제로 묻는 말투(건의함에 올라온 글에서 모았다). 모델이 고를 때 참고한다.
//    화면의 버튼 이름과 같은 낱말은 **그 버튼의 항목에만** 둔다('모션' 은 [모션] 버튼인 weapon 에만 — action 에도 두었더니 둘 다 나왔다).
//  · go = '열어 보기'. tab = 그 탭으로(preview 면 지금 탭 그대로 — 요청한 것 말고는 바꾸지 않는다), sheet = 그 창을 연다, pick = 휴대폰 연출 설정 시트를 그 고르기 화면(표정 등)으로 연다,
//    group = 연출 설정의 캐릭터 / 이펙트 칸, drawer = PC 미리보기 아래 연출 설정을 펼친다,
//    spot = 도착한 화면에서 그 요소(`data-guide`)를 잠깐 테두리로 가리키고(입력칸이면 커서를 둔다), click = 가리킨 뒤 눌러 연다.
//    sheet · drawer 와 함께 쓰면 창이 다 열린 뒤 그 줄까지 창 안을 스크롤해 가리킨다(아래쪽 줄도 보이게 — 사용자 지시).

import { backApi } from './backApi'
import { safeBubble } from './safeText'

// tab: 'preview' = 미리보기에 있는 기능. 미리보기는 코디 광장을 뺀 모든 탭에 있으므로 탭을 바꾸지 않는다(광장에서만 코디 탭으로)
export type GuideGo = {
  tab?: 'preview' | 'codi' | 'search' | 'info' | 'preset' | 'share'; sheet?: 'pv' | 'bg' | 'part' | 'bm'
  pick?: 'action' | 'weapon' | 'expr'; group?: 'char' | 'effect'; drawer?: 'char' | 'effect'; spot?: string; click?: boolean
}
// how = 화면에 보이는 안내 전부. 줄바꿈마다 끊어 보여 준다 — 쓰는 법은 pinkbean-design SKILL 의 '안내 글'(어느 쪽, 무엇, 무엇을 누른다)
type GuideText = { title: string; how: string; go?: GuideGo }
// only = 그 기기에만 있는 기능. 다른 기기에서는 모델에 보내지도, 답으로 보여 주지도 않는다(guideOn)
export type GuideEntry = GuideText & { id: string; words: string; only?: 'm' | 'pc'; m?: Partial<GuideText>; pc?: Partial<GuideText> }

// 안내 글은 **그 기능의 자리 하나만** 짚는다(사용자 지시 — 무기 이펙트를 물었는데 부유 효과까지 말했다). 어디 · 무엇을 누르고 · 어느 탭에서 · 무엇을
// 고르면 되는지만 적고, 덧말(값의 뜻 · 다른 기능)은 넣지 않는다. 한 항목에 기능 하나 — 여러 기능을 한 항목에 묶으면 묻지 않은 것까지 답한다.
const M = '위쪽의 캐릭터 화면 왼쪽 아래에 있는\n[연출 설정] 버튼을 누르고, ' // 휴대폰 연출 설정
const P = '오른쪽의 캐릭터 화면 아래 맨 끝에 있는\n[연출 설정] 버튼을 누르고, '  // PC 연출 설정(펼침)
const MC = '위쪽의 캐릭터 화면을 길게 누르고\n', PC_ = '오른쪽의 캐릭터 화면을 오른쪽 클릭하고\n'
export const GUIDE: GuideEntry[] = [
  { id: 'expr', title: '표정 바꾸기', words: '표정, 얼굴 표정, 웃는 얼굴, 윙크, 눈 감기, 화난 표정, 게슴츠레',
    how: M + '[표정]을 고르면 바꿀 수 있어요.', go: { tab: 'preview', sheet: 'pv', pick: 'expr' },
    pc: { how: '오른쪽의 캐릭터 화면 아래에 있는\n[표정] 버튼에서 바꿀 수 있어요.', go: { tab: 'preview', spot: 'expr', click: true } } },
  { id: 'action', title: '자세 바꾸기', words: '액션, 포즈, 자세, 동작, 걷기, 앉기, 점프, 눕기, 춤',
    how: M + '[액션]을 고르면 바꿀 수 있어요.', go: { tab: 'preview', sheet: 'pv', pick: 'action' },
    pc: { how: '오른쪽의 캐릭터 화면 아래에 있는\n[액션] 버튼에서 바꿀 수 있어요.', go: { tab: 'preview', spot: 'action', click: true } } },
  { id: 'action-frame', title: '액션을 한 자세로 멈추기', words: '멈추기, 정지, 프레임, 동작 고정, 특정 자세, 애니메이션 멈춤, 한 장면',
    how: M + '[액션]을 누르고 액션을 고른 뒤\n멈출 자세(1, 2, …)를 고르세요.', go: { tab: 'preview', sheet: 'pv', pick: 'action' },
    pc: { how: '오른쪽의 캐릭터 화면 아래 [액션] 버튼에서\n액션을 고른 뒤 멈출 자세(1, 2, …)를 고르세요.', go: { tab: 'preview', spot: 'action', click: true } } },
  { id: 'weapon', title: '무기 모션 바꾸기', words: '모션, 무기 모션, 무기 드는 자세, 건모션, 한손 두손, 휘두르기, 찌르기, 사격',
    how: M + '[모션]을 고르면 바꿀 수 있어요.', go: { tab: 'preview', sheet: 'pv', pick: 'weapon' },
    pc: { how: '오른쪽의 캐릭터 화면 아래에 있는\n[모션] 버튼에서 바꿀 수 있어요.', go: { tab: 'preview', spot: 'weapon', click: true } } },
  { id: 'zoom', title: '캐릭터 크기', words: '크기, 확대, 축소, 작게, 크게, 인게임 비율, 잘려요, 배율',
    how: M + '[배율]을 고르면 바꿀 수 있어요.', go: { tab: 'preview', sheet: 'pv', spot: 'zoom' },
    pc: { how: '오른쪽의 캐릭터 화면 아래에 있는\n[배율] 버튼에서 바꿀 수 있어요.', go: { tab: 'preview', spot: 'zoom', click: true } } },
  { id: 'form', title: '형상 변이', words: '형상 변이, 아니마, 호영 꼬리, 라라 뿔, 렌, 종족',
    how: M + '[캐릭터] 탭에서\n[형상 변이]를 고르면 바꿀 수 있어요.', go: { tab: 'preview', sheet: 'pv', group: 'char', spot: 'pv-form' },
    pc: { how: P + '[캐릭터] 탭에서\n[형상 변이]를 고르면 바꿀 수 있어요.', go: { tab: 'preview', drawer: 'char', spot: 'pv-form' } } },
  { id: 'ear', title: '귀 모양', words: '귀, 엘프 귀, 레프 귀, 하이레프 귀, 뾰족 귀, 사람 귀',
    how: M + '[캐릭터] 탭에서\n[귀]를 고르면 바꿀 수 있어요.', go: { tab: 'preview', sheet: 'pv', group: 'char', spot: 'pv-ear' },
    pc: { how: P + '[캐릭터] 탭에서\n[귀]를 고르면 바꿀 수 있어요.', go: { tab: 'preview', drawer: 'char', spot: 'pv-ear' } } },
  { id: 'gaze', title: '시선, 뒷모습', words: '시선, 방향, 오른쪽 보기, 왼쪽 보기, 뒤돌기, 뒷모습',
    how: M + '[캐릭터] 탭에서\n[시선]을 고르면 바꿀 수 있어요.', go: { tab: 'preview', sheet: 'pv', group: 'char', spot: 'pv-gaze' },
    pc: { how: P + '[캐릭터] 탭에서\n[시선]을 고르면 바꿀 수 있어요.', go: { tab: 'preview', drawer: 'char', spot: 'pv-gaze' } } },
  { id: 'basetag', title: '기본 명찰 켜고 끄기', words: '기본 명찰, 기본 이름표, 발밑 이름, 캐릭터 이름 표시, 명찰 반지 없이',
    how: M + '[캐릭터] 탭에서\n[기본 명찰]을 고르면 끄고 켤 수 있어요.', go: { tab: 'preview', sheet: 'pv', group: 'char', spot: 'basetag' },
    pc: { how: P + '[캐릭터] 탭에서\n[기본 명찰]을 고르면 끄고 켤 수 있어요.', go: { tab: 'preview', drawer: 'char', spot: 'basetag' } } },
  { id: 'fx', title: '이펙트 끄고 켜기', words: '이펙트, 이펙트 끄기, 효과 끄기, 반짝이 없애기, 빛 없애기',
    how: M + '[이펙트] 탭에서 끄고 켤 수 있어요.', go: { tab: 'preview', sheet: 'pv', group: 'effect' },
    pc: { how: P + '[이펙트] 탭에서 끄고 켤 수 있어요.', go: { tab: 'preview', drawer: 'effect' } } },
  { id: 'fx-weapon', title: '무기 이펙트 끄고 켜기', words: '무기 이펙트, 무기 효과, 무기 빛, 무기 반짝이, 제네시스 파장',
    how: M + '[이펙트] 탭에서\n[무기 이펙트]를 고르면 끄고 켤 수 있어요.', go: { tab: 'preview', sheet: 'pv', group: 'effect', spot: 'pv-wEffect' },
    pc: { how: P + '[이펙트] 탭에서\n[무기 이펙트]를 고르면 끄고 켤 수 있어요.', go: { tab: 'preview', drawer: 'effect', spot: 'pv-wEffect' } } },
  { id: 'fx-cape', title: '망토 이펙트 끄고 켜기', words: '망토 이펙트, 망토 효과, 망토 빛, 날개 이펙트',
    how: M + '[이펙트] 탭에서\n[망토 이펙트]를 고르면 끄고 켤 수 있어요.', go: { tab: 'preview', sheet: 'pv', group: 'effect', spot: 'pv-cEffect' },
    pc: { how: P + '[이펙트] 탭에서\n[망토 이펙트]를 고르면 끄고 켤 수 있어요.', go: { tab: 'preview', drawer: 'effect', spot: 'pv-cEffect' } } },
  { id: 'fx-cap', title: '모자 이펙트 끄고 켜기', words: '모자 이펙트, 모자 효과, 모자 빛, 머리 위 이펙트',
    how: M + '[이펙트] 탭에서\n[모자 이펙트]를 고르면 끄고 켤 수 있어요.', go: { tab: 'preview', sheet: 'pv', group: 'effect', spot: 'pv-capEffect' },
    pc: { how: P + '[이펙트] 탭에서\n[모자 이펙트]를 고르면 끄고 켤 수 있어요.', go: { tab: 'preview', drawer: 'effect', spot: 'pv-capEffect' } } },
  { id: 'fx-float', title: '부유 효과 끄고 켜기', words: '부유 효과, 둥둥 뜨기, 떠 있는 캐릭터, 공중에 뜸, 붕 뜸',
    how: M + '[이펙트] 탭에서\n[부유 효과]를 고르면 끄고 켤 수 있어요.', go: { tab: 'preview', sheet: 'pv', group: 'effect', spot: 'pv-floatFx' },
    pc: { how: P + '[이펙트] 탭에서\n[부유 효과]를 고르면 끄고 켤 수 있어요.', go: { tab: 'preview', drawer: 'effect', spot: 'pv-floatFx' } } },
  { id: 'nick', title: '닉네임으로 코디 불러오기', words: '닉네임 검색, 내 캐릭터, 인게임 코디 가져오기, 캐릭터 이름, 넥슨, 불러오기',
    how: '맨 아래의 [프리셋] 탭 맨 위 칸에\n닉네임을 넣고 오른쪽 버튼을 누르면 불러와요.', go: { tab: 'preset', spot: 'nick' },
    pc: { how: '맨 아래의 [프리셋] 탭 맨 위 칸에\n닉네임을 넣고 [불러오기]를 누르면 불러와요.' } },
  { id: 'link-in', title: '받은 링크로 코디 보기', words: '링크 붙여넣기, 코드 입력, 받은 코디, 공유 코드',
    how: '맨 아래의 [프리셋] 탭 맨 위 칸에\n받은 링크를 넣고 오른쪽 버튼을 누르면 불러와요.', go: { tab: 'preset', spot: 'nick' },
    pc: { how: '맨 아래의 [프리셋] 탭 맨 위 칸에\n받은 링크를 넣고 [불러오기]를 누르면 불러와요.' } },
  { id: 'link-out', title: '코디 링크 보내기', words: '공유, 링크 복사, 친구에게 보내기, 디스코드, 카톡',
    how: '오른쪽 맨 위에 있는 [복사] 버튼을 누르면\n지금 코디 링크가 복사돼요.', go: { spot: 'copy' },
    pc: { how: '오른쪽 맨 위에 있는 [프리셋 복사] 버튼을 누르면\n지금 코디 링크가 복사돼요.' } },
  { id: 'preset', title: '코디 저장', words: '저장, 코디 저장, 여러 코디, 슬롯, 프리셋',
    how: '맨 아래의 [프리셋] 탭에서 칸을 고르면\n지금 코디가 그 칸에 저절로 저장돼요.', go: { tab: 'preset' } },
  { id: 'preset-name', title: '프리셋 이름 바꾸기', words: '프리셋 이름, 이름 바꾸기, 이름 짓기, 코디 이름',
    how: '맨 아래의 [프리셋] 탭에서\n카드 아래의 이름 칸을 눌러 바꿀 수 있어요.', go: { tab: 'preset' } },
  { id: 'preset-order', title: '프리셋 순서 바꾸기', words: '프리셋 순서, 프리셋 정렬, 순서 바꾸기, 순서 변경, 자리 옮기기, 끌어서 옮기기, 드래그',
    how: '맨 아래의 [프리셋] 탭 왼쪽 위에 있는\n[순서] 버튼을 누르고, 카드를 끌어 옮기세요.', go: { tab: 'preset', spot: 'sort' },
    pc: { how: '맨 아래의 [프리셋] 탭 왼쪽 위에 있는\n[순서 변경] 버튼을 누르고, 카드를 끌어 옮기세요.' } },
  { id: 'dye', title: '염색하기', words: '염색, 색 바꾸기, 믹스 염색, 헤어 색, 렌즈 색, 색조 채도 명도, 프리즘',
    how: '위쪽의 캐릭터 화면 오른쪽 아래에 있는\n팔레트 버튼을 누르고, 부위를 고르면 염색할 수 있어요.', go: { tab: 'preview', sheet: 'part' },
    pc: { how: '오른쪽의 캐릭터 화면 왼쪽 위에 있는\n[부위 염색] 버튼을 누르고, 부위를 고르면 염색할 수 있어요.' } },
  { id: 'dye-vault', title: '염색 보관함', words: '염색 저장, 염색 값 저장, 염색 기록, 여러 염색 비교, 컬러라인 피부 값, 보관함, 보관함 비우기',
    how: '염색 창 아래쪽의 [보관함]에서\n[염색 저장]이나 [+] 칸을 누르면 지금 염색이 담겨요.\n담은 칸을 누르면 그 값으로 바뀌고, [적용]을 누르면 입혀져요.', go: { tab: 'info' } },
  { id: 'dye-table', title: '염색표', words: '염색표, 발색표, 색 비교, 한눈에',
    how: '헤어나 성형의 염색 창에 있는\n[염색표] 버튼을 누르면 볼 수 있어요.', go: { tab: 'info' } },
  { id: 'dot', title: '점 위치 옮기기', words: '점, 얼굴 점, 점 옮기기, 위치 조절',
    how: '점이 있는 얼굴장식을 입고\n위쪽의 캐릭터 화면 오른쪽 아래에 있는\n점 버튼을 누르면 옮길 수 있어요.', go: { tab: 'preview', spot: 'dot' },
    pc: { how: '점이 있는 얼굴장식을 입고\n오른쪽의 캐릭터 화면 오른쪽 위에 있는\n[점 위치] 버튼을 누르면 옮길 수 있어요.' } },
  { id: 'bg', title: '캐릭터 배경 바꾸기', words: '배경, 배경 바꾸기, 미리보기 배경, 코디 배경, 흰 배경, 검은 배경, 내 사진, 배경 업로드, 피팅룸, 캐시샵 배경, 버섯 집, 시스템 배경, 다크 배경, 프리셋 배경, 프리셋마다 배경',
    how: '위쪽의 캐릭터 화면 왼쪽 아래에 있는\n그림 버튼을 누르면 바꿀 수 있어요.\n배경은 프리셋마다 따로 저장돼요.', go: { tab: 'preview', sheet: 'bg' },
    pc: { how: '오른쪽의 캐릭터 화면 왼쪽 위에 있는\n[배경] 버튼을 누르면 바꿀 수 있어요.\n배경은 프리셋마다 따로 저장돼요.' } },
  { id: 'image', title: '캐릭터 이미지 저장, 복사', words: '이미지 저장, 사진 저장, 캡처, png, 다운로드, 복사, 이미지 복사, 투명 배경 이미지, 갤러리 저장, 앨범 저장',
    how: MC + '[이미지 저장]이나 [이미지 복사]를 고르세요.\n저장은 공유 창에서 [이미지 저장]을 고르면 갤러리에 들어가요.',
    pc: { how: PC_ + '[이미지 저장]이나 [이미지 복사]를 고르세요.' } },
  { id: 'gif', title: '움짤 저장', words: '움짤, 움짤 저장, gif, 움직이는 이미지, 움직이는 그대로 저장, 모션 저장, 배경째 저장, 배경 포함 움짤',
    how: MC + '[움짤 저장]을 고르세요.',
    pc: { how: PC_ + '[움짤 저장]을 고르세요.' } },
  { id: 'gif-clear', title: '투명 움짤 저장', words: '투명 움짤, 배경 없는 움짤, 투명 gif, 배경 빼고 움짤',
    how: MC + '[투명 움짤 저장]을 고르세요.',
    pc: { how: PC_ + '[투명 움짤 저장]을 고르세요.' } },
  { id: 'bookmark', title: '북마크', words: '찜, 북마크, 모아 두기, 담아 두기',
    how: '아이템 카드의 [북마크]를 누르면\n위쪽의 캐릭터 화면 오른쪽 아래에 있는\n북마크 버튼에 모여요.', go: { tab: 'preview', sheet: 'bm' },
    pc: { how: '아이템 카드의 [북마크]를 누르면\n오른쪽 아래의 북마크 칸에 모여요.', go: { tab: 'preview', spot: 'bm' } } },
  { id: 'vs', title: '코디 비교', words: '비교, 나란히, vs, 여러 코디 비교, 염색 비교, 코디 모아 보기, 네 개 비교, 칸 더하기',
    how: '위쪽의 캐릭터 화면 오른쪽 아래에 있는\n[비교](네모 넷) 버튼을 누르세요.\n칸(A B C D)을 누르고 목록에서 입히면 그 칸이 바뀌어요.', go: { tab: 'preview', spot: 'vs' },
    pc: { how: '오른쪽 아래 칸의 [비교] 탭을 누르세요.\n칸(A B C D)을 누르고 목록에서 입히면 그 칸이 바뀌어요.', go: { tab: 'preview', spot: 'vs' } } },
  { id: 'vs-preset', title: '비교 칸과 프리셋', words: '프리셋 비교, 프리셋 나란히, 비교 칸 저장, 비교 결과 저장, 프리셋마다 비교, 비교 칸 빼기, 휴지통',
    how: '비교 칸은 프리셋마다 따로 저장돼요.\n고른 칸이 곧 지금 프리셋이라, 고친 것은 그 프리셋에 저장돼요.\n비교 중에 [프리셋] 탭의 카드를 누르면 그 코디를 고른 칸에 입혀요.\n칸을 빼려면 칸 오른쪽 위의 휴지통 띠지를 두 번 누르세요.',
    pc: { how: '비교 칸은 프리셋마다 따로 저장돼요.\n고른 칸이 곧 지금 프리셋이라, 고친 것은 그 프리셋에 저장돼요.\n비교 중에 [프리셋] 탭의 카드를 누르면 그 코디를 고른 칸에 입혀요.\n칸을 빼려면 칸 오른쪽 위의 휴지통 띠지를 두 번 누르세요.' } },
  { id: 'ai-search', title: 'AI 코디 검색', words: '문장 검색, 비슷한 아이템, 생김새로 찾기, 스타일 검색',
    how: '맨 아래의 [AI 검색] 탭에서\n원하는 생김새를 문장으로 적으면 찾아 줘요.', go: { tab: 'search', spot: 'ai' },
    pc: { how: '맨 아래의 [AI 코디 검색] 탭에서\n원하는 생김새를 문장으로 적으면 찾아 줘요.' } },
  { id: 'find', title: '아이템 이름으로 찾기', words: '검색, 이름 검색, 아이템 찾기, 이름으로 찾기',
    how: '맨 아래의 [코디] 탭에서\n목록 위의 [아이템 검색] 칸에 이름을 적으세요.', go: { tab: 'codi' },
    pc: { how: '맨 아래의 [코디] 탭에서\n왼쪽 목록 맨 위의 [아이템 검색] 칸에 이름을 적으세요.' } },
  { id: 'gender', title: '성별로 거르기', words: '성별, 여자 아이템, 남자 아이템, 여캐, 남캐, 성별 필터',
    how: '맨 아래의 [코디] 탭에서\n목록 위의 [보기 설정]을 누르고, [성별]에서 고르세요.', go: { tab: 'codi', spot: 'listdir' },
    pc: { how: '맨 아래의 [코디] 탭에서\n왼쪽 목록 맨 위의 [여] [남] 버튼으로 고르세요.' } },
  { id: 'listdir', title: '목록 넘기는 방향', words: '가로 세로, 세로로 넘기기, 위아래로 넘기기, 스크롤 방향, 목록 방향',
    how: '맨 아래의 [코디] 탭에서\n목록 위의 [보기 설정]을 누르고, [방향]에서 고르세요.', go: { tab: 'codi', spot: 'listdir' },
    pc: { how: '맨 아래의 [코디] 탭에서\n왼쪽 목록 맨 위의 방향 버튼으로 고르세요.' } },
  { id: 'plaza-dir', title: '코디 광장 넘기는 방향', words: '광장 가로 세로, 광장 세로로 넘기기, 광장 스크롤 방향, 광장 정렬',
    how: '맨 아래의 [광장] 탭에서\n목록 위의 [보기 설정]을 누르고, [방향]에서 고르세요.', go: { tab: 'share' },
    pc: { how: '맨 아래의 [코디 광장] 탭에서\n왼쪽 목록 맨 위, 정렬 옆의 방향 버튼으로 고르세요.' } },
  { id: 'preset-dir', title: '프리셋 넘기는 방향', words: '프리셋 가로 세로, 프리셋 세로로 넘기기, 프리셋 스크롤 방향',
    how: '맨 아래의 [프리셋] 탭에서\n목록 위, [순서] 옆의 방향 버튼으로 고르세요.', go: { tab: 'preset' },
    pc: { how: '맨 아래의 [프리셋] 탭에서\n왼쪽 목록 맨 위, [순서 변경] 옆의 방향 버튼으로 고르세요.' } },
  { id: 'ring', title: '일루전링(변신, 거대한 몸)', words: '일루전 링, 변신, 변신 반지, 거대한 머리, 거대한 몸, 내 뒤에 나, 분신',
    how: '맨 아래의 [코디] 탭에서\n부위 줄의 [일루전링]을 고르세요.', go: { tab: 'codi' } },
  { id: 'chat', title: '채팅 보내기', words: '채팅, 말 걸기, 대사 띄우기, 말풍선 띄우기, 메시지',
    how: '위쪽의 캐릭터 화면 왼쪽 아래에 있는\n말풍선 버튼을 누르고, 말을 적어 보내세요.', go: { tab: 'preview', spot: 'chat', click: true },
    pc: { how: '오른쪽의 캐릭터 화면 아래 채팅 칸에\n말을 적고 Enter 를 누르세요.', go: { tab: 'preview', spot: 'chat' } } },
  { id: 'emoticon', title: '이모티콘 보내기', words: '이모티콘, 이모지, 감정 표현, 채팅 이모티콘',
    how: '위쪽의 캐릭터 화면 왼쪽 아래에 있는\n말풍선 버튼을 누르고, 웃는 얼굴 버튼에서 고르세요.', go: { tab: 'preview', spot: 'chat', click: true },
    pc: { how: '오른쪽의 캐릭터 화면 아래 채팅 칸의\n웃는 얼굴 버튼을 누르고, 이모티콘을 고르세요.', go: { tab: 'preview', spot: 'emo', click: true } } },
  { id: 'tag-ring', title: '명찰, 말풍선 모양 바꾸기', words: '명찰, 말풍선, 명찰 반지, 말풍선 반지, 이름표 모양, 말풍선 모양',
    how: '맨 아래의 [코디] 탭에서\n부위 줄의 [명찰 / 말풍선]을 고르세요.', go: { tab: 'codi' } },
  { id: 'title', title: '칭호 달기', words: '칭호, 칭호 아이템, 머리 위 글자, 머리 위 이름, 닉네임 태그',
    how: '맨 아래의 [코디] 탭에서\n부위 줄의 [칭호]를 고르세요.', go: { tab: 'codi' } },
  { id: 'medal', title: '훈장 달기', words: '훈장, 메달, 이름 아래 훈장, 명찰 아래 글자',
    how: '맨 아래의 [코디] 탭에서\n부위 줄의 [훈장]을 고르세요.', go: { tab: 'codi' } },
  { id: 'hide', title: '부위 숨기기', words: '숨기기, 안 보이게, 가리기, 숨김',
    how: '맨 아래의 [염색] 탭에서\n부위 옆의 눈 버튼을 누르면 숨겨져요.', go: { tab: 'info' },
    pc: { how: '맨 아래의 [코디 정보 / 염색] 탭에서\n부위 옆의 눈 버튼을 누르면 숨겨져요.' } },
  { id: 'unequip', title: '코디 처음으로 되돌리기', words: '전부 벗기, 다 벗기, 초기화, 처음으로, 코디 지우기, 프리셋 비우기',
    how: '맨 아래의 [프리셋] 탭에서\n카드의 휴지통 띠지를 두 번 누르면 처음 코디로 돌아가요.', go: { tab: 'preset' } },
  { id: 'share-image', title: '코디 프로필 저장', words: '코디 프로필, 공유 카드, 공유 이미지, 코디 카드, 코디 정보 저장, 프로필 카드, 코디 자랑 이미지, 한 장으로 저장, 갤러리 저장',
    how: '맨 아래의 [염색] 탭 오른쪽 위에 있는\n[코디 프로필 저장] 버튼을 누르세요.\n[저장] 뒤 공유 창에서 [이미지 저장]을 고르면 갤러리에 들어가요.', go: { tab: 'info', spot: 'share-image' },
    pc: { how: '맨 아래의 [코디 정보 / 염색] 탭 오른쪽 위에 있는\n[코디 프로필 저장] 버튼을 누르세요.' } },
  { id: 'card-qr', title: '코디 프로필의 불러오기 QR', words: 'QR, QR 코드, 큐알, 카드 QR, 코디 불러오기 QR, 카메라로 불러오기, 사진에서 불러오기, QR 끄기',
    how: '[코디 프로필 저장] 창의 카드 맨 아래에 이 코디의 QR이 들어가요.\n사진에서 QR을 누르거나 카메라로 비추면 이 코디를 불러와요.\n빼려면 아래쪽의 [QR 코드]를 끄세요.', go: { tab: 'info', spot: 'share-image' },
    pc: { how: '[코디 프로필 저장] 창의 카드 맨 아래에 이 코디의 QR이 들어가요.\n사진에서 QR을 누르거나 카메라로 비추면 이 코디를 불러와요.\n빼려면 오른쪽의 [QR 코드]를 끄세요.' } },
  { id: 'card-action', title: '코디 프로필의 액션 바꾸기', words: '카드 액션, 카드 자세, 프로필 자세, 공유 카드 포즈, 카드 동작',
    how: '[코디 프로필 저장] 창 아래쪽 맨 위 줄의\n[액션]을 누르고 액션과 멈출 자세를 고르세요.', go: { tab: 'info', spot: 'share-image' },
    pc: { how: '[코디 프로필 저장] 창 오른쪽 맨 위 줄의\n[액션]을 누르고 액션과 멈출 자세를 고르세요.' } },
  { id: 'card-design', title: '코디 프로필 카드 디자인, 배경 바꾸기', words: '카드 디자인, 카드 색, 카드 배경, 프로필 배경, 공유 카드 테마',
    how: '[코디 프로필 저장] 창 아래쪽 맨 위 줄의\n[카드 디자인] 또는 [배경]을 누르고 고르세요.', go: { tab: 'info', spot: 'share-image' },
    pc: { how: '[코디 프로필 저장] 창 오른쪽 맨 위 줄의\n[카드 디자인] 또는 [배경]을 누르고 고르세요.' } },
  { id: 'card-reset', title: '코디 프로필 사진 위치 초기화', words: '카드 사진 초기화, 사진 위치 되돌리기, 사진 배율 처음으로, 카드 확대 초기화',
    how: '[코디 프로필 저장] 창 위쪽 카드 미리보기의\n사진 칸 오른쪽 아래 [위치 초기화]를 누르세요.', go: { tab: 'info', spot: 'share-image' },
    pc: { how: '[코디 프로필 저장] 창 왼쪽 카드 미리보기의\n사진 칸 오른쪽 아래 [위치 초기화]를 누르세요.' } },
  { id: 'undo', title: '되돌리기', words: '취소, 되돌리기, 실수, 이전으로, 다시실행',
    how: '위쪽의 캐릭터 화면 오른쪽 위에 있는\n화살표 버튼으로 되돌릴 수 있어요.', go: { tab: 'preview', spot: 'undo' },
    pc: { how: '오른쪽의 캐릭터 화면 오른쪽 위에 있는\n화살표 버튼으로 되돌릴 수 있어요.' } },
  { id: 'rate', title: '핑크빈 코디 평가', words: '평가, 핑크빈, 한마디, 반응, 점수',
    how: '오른쪽 맨 위에 있는 [평가] 버튼을 누르세요.', go: { spot: 'rate' },
    pc: { how: '오른쪽 맨 위에 있는 [코디 평가] 버튼을 누르세요.' } },
  { id: 'plaza', title: '다른 사람 코디 보기', words: '다른 사람 코디, 구경, 가져오기, 좋아요, 랭킹, 코디 광장',
    how: '맨 아래의 [광장] 탭에서 볼 수 있어요.', go: { tab: 'share' },
    pc: { how: '맨 아래의 [코디 광장] 탭에서 볼 수 있어요.' } },
  { id: 'combo', title: '이 아이템을 입은 코디와 자주 쓴 염색', words: '코디 조합, 이 아이템 코디, 실제 유저 코디, 랭커 코디, 많이 쓴 염색, 자주 쓴 염색, 인기 염색, 염색 추천, 컬러라인 피부 염색 추천, 사소한 변경점 위치',
    how: '목록 카드 그림의 오른쪽 아래에 있는\n[코디] 칩을 누르세요.', go: { tab: 'codi', spot: 'combo' },
    pc: { how: '왼쪽 목록 카드 그림의 오른쪽 아래에 있는\n[코디] 칩을 누르세요.' } },
  { id: 'combo-find', title: '아이템 이름으로 코디 조합 찾기', words: '아이템으로 코디 찾기, 아이템 이름 검색, 코디 조합 검색',
    how: '맨 아래의 [광장] 탭을 누르고\n위쪽 분류에서 [코디 조합]을 누른 뒤, 그 아래 칸에 아이템 이름을 적으세요.', go: { tab: 'share' },
    pc: { how: '맨 아래의 [코디 광장] 탭에서\n[코디 조합]을 누르고, 위쪽 칸에 아이템 이름을 적으세요.' } },
  { id: 'plaza-up', title: '내 코디 올리기', words: '코디 올리기, 업로드, 자랑, 등록',
    how: '맨 아래의 [광장] 탭에서\n목록 위 오른쪽에 있는 + 버튼을 누르세요.', go: { tab: 'share' },
    pc: { how: '맨 아래의 [코디 광장] 탭에서\n오른쪽에 있는 [내 코디 등록]을 누르세요.' } },
  { id: 'pinch', title: '화면 확대', words: '핀치 줌, 손가락 확대, 화면 확대', only: 'm',
    how: '두 손가락으로 벌리면 화면이 커져요.' },
  { id: 'view', title: '캐릭터 크게 보기', words: '크게 보기, 넓게, 전체 화면, 캐릭터만, 목록 숨기기', only: 'm',
    how: '맨 위의 로고 옆에 있는 네모 버튼 셋 가운데\n오른쪽 것일수록 캐릭터가 크게 보여요.', go: { tab: 'preview', spot: 'view' } },
  { id: 'sky', title: '낮과 밤 바꾸기', words: '밤, 낮, 시간대, 하늘, 저녁, 새벽', only: 'pc',
    how: '오른쪽 맨 위에 있는 [자동] 버튼을 누를 때마다\n시간대가 바뀌어요.' },
  { id: 'bg-only', title: '배경만 보기', words: '배경만 보기, 배경 감상, 캐릭터 숨기고 배경', only: 'pc',
    how: '오른쪽 맨 위에 있는 [배경 보기] 버튼을 누르세요.' },
]

export const guideById = new Map(GUIDE.map((g) => [g.id, g]))
// 이 기기에 있는 기능인가(only)
export const guideOn = (g: GuideEntry, mobile: boolean) => !g.only || g.only === (mobile ? 'm' : 'pc')
// 지금 기기에 맞는 글(휴대폰 m / PC pc 가 있으면 그것, 없으면 공통). go 를 undefined 로 덮으면 '열어 보기'가 없다
export function guideFor(g: GuideEntry, mobile: boolean): GuideEntry {
  const o = mobile ? g.m : g.pc
  return o ? { ...g, ...o } : g
}
// 모델에 넘기는 목록(짧게 — 질문마다 같이 보낸다). 지금 기기의 글로 보낸다
const catalog = (mobile: boolean) => GUIDE.filter((g) => guideOn(g, mobile)).map((g0) => { const g = guideFor(g0, mobile); return { id: g.id, t: `${g.title}: ${g.how.replace(/\n/g, ' ')} / ${g.words}` } })

// 안내 서버의 답. feature = ids 의 기능들, none = 목록에 없다, chat = 인사에 대한 reply, error = 서버 · 모델 실패
// none 의 갈래(type): bug = 오류 신고(오류 칸으로), idea = 바라는 기능(건의 칸으로), other = 사이트와 상관없는 말(reply 로 답한다)
export type GuideNone = 'bug' | 'idea' | 'other'
export type GuideReply = { kind: 'feature' | 'none' | 'chat' | 'error'; ids: string[]; reply: string; type?: GuideNone }
// mode: ask = 도움 탭, check = 건의를 올리기 전 확인(이미 있는 기능일 때만 feature)
export async function askGuide(q: string, mode: 'ask' | 'check', history: { r: string; t: string }[], mobile: boolean): Promise<GuideReply> {
  try {
    const r = await fetch(`${backApi()}/guide`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ q, mode, history, catalog: catalog(mobile) }),
      signal: AbortSignal.timeout(20000),
    })
    if (!r.ok) return { kind: 'error', ids: [], reply: '' }
    const d = await r.json()
    // 다른 기기에만 있는 기능은 모델이 골라도 버린다(목록에 보내지 않았으니 드물다 — 대화 기록에 남은 이름 때문에 고를 수 있다)
    const ids = (Array.isArray(d.ids) ? d.ids : []).filter((id: unknown): id is string => typeof id === 'string' && guideById.has(id) && guideOn(guideById.get(id)!, mobile))
    const kind = d.kind === 'feature' && ids.length ? 'feature' : d.kind === 'chat' || d.kind === 'none' ? d.kind : 'error'
    // 인사의 답도 화면 직전에 한 번 더 거른다(lib/safeText — 말풍선과 같은 안전망)
    const reply = typeof d.reply === 'string' && safeBubble(d.reply) ? d.reply.slice(0, 140) : ''
    const k = kind === 'chat' && !reply ? 'none' : kind
    const type: GuideNone | undefined = k !== 'none' ? undefined : d.type === 'bug' || d.type === 'other' ? d.type : 'idea'
    return { kind: k, ids: kind === 'feature' ? ids : [], reply, type }
  } catch { return { kind: 'error', ids: [], reply: '' } }
}

// 휴대폰 연출 설정 시트를 '열어 보기'로 열 때 처음 보일 화면(고르기 화면 · 칸). 시트가 열리며 한 번 꺼내 쓴다(PvSheetBody)
let pvIntent: { pick?: GuideGo['pick']; group?: GuideGo['group'] } | null = null
export const setPvIntent = (v: typeof pvIntent) => { pvIntent = v }
export const takePvIntent = () => { const v = pvIntent; pvIntent = null; return v }

// 요소가 보이게 한다 — **사용자가 스크롤하는 칸(overflow auto · scroll)과 문서만** 움직인다. scrollIntoView 는 overflow:hidden 인
// 칸까지 밀어 올려, PC 미리보기 카드가 위로 밀리고 접혀 있던 연출 설정 칸이 드러났다(되돌릴 길도 없다).
function reveal(el: HTMLElement) {
  let p = el.parentElement
  while (p && p !== document.body) {
    const o = getComputedStyle(p).overflowY
    if ((o === 'auto' || o === 'scroll') && p.scrollHeight > p.clientHeight + 1) break
    p = p.parentElement
  }
  let r = el.getBoundingClientRect()
  if (p && p !== document.body) {
    const pr = p.getBoundingClientRect()
    if (r.top < pr.top || r.bottom > pr.bottom) p.scrollBy({ top: r.top - pr.top - (pr.height - r.height) / 2, behavior: 'smooth' })
    // 칸 안은 맞췄다 — 문서는 그 칸이 화면 밖에 있을 때만 움직인다
    if (pr.bottom > 0 && pr.top < window.innerHeight) return
    r = pr
  }
  if (r.top < 0 || r.bottom > window.innerHeight) window.scrollBy({ top: r.top - (window.innerHeight - Math.min(r.height, window.innerHeight)) / 2, behavior: 'smooth' })
}

// 도착한 화면에서 그 요소(data-guide)를 잠깐 테두리로 가리킨다. 입력칸이면 커서를 둔다. 보이는 것 하나만.
// click = 가리킨 뒤 눌러 연다(PC 미리보기 아래 표정 등 — 스크롤이 멈춘 뒤에 눌러야 팝오버가 제자리에 뜬다)
export function guideSpot(spot: string, click = false) {
  const el = [...document.querySelectorAll<HTMLElement>(`[data-guide~="${spot}"]`)].find((e) => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden')
  if (!el) return
  reveal(el)
  if (el.matches('input, textarea')) el.focus({ preventScroll: true })
  el.classList.remove('pb-guidehit')
  void el.offsetWidth
  el.classList.add('pb-guidehit')
  window.setTimeout(() => el.classList.remove('pb-guidehit'), 1900)
  if (click && !(el as HTMLButtonElement).disabled) window.setTimeout(() => { if (el.isConnected) el.click() }, 320)
}

// PC 미리보기 아래 연출 설정 펼치기(PreviewColumn 이 듣는다)
export const GUIDE_DRAWER_EVENT = 'pb-guide-drawer'
// 창(시트) · 펼침이 다 열린 뒤 — 그 안의 줄을 가리키는 때(움직이는 도중에 재면 자리가 틀린다)
export const GUIDE_SETTLE_MS = 460
