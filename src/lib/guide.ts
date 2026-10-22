// 기능 안내('도움 및 가이드'의 도움 탭과 건의 등록 전 확인)가 쓰는 기능 목록. **이 목록이 곧 안내의 전부다.**
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

export const GUIDE: GuideEntry[] = [
  { id: 'expr', title: '표정 바꾸기', words: '표정, 얼굴 표정, 웃는 얼굴, 윙크, 눈 감기, 화난 표정, 게슴츠레',
    how: '위쪽의 캐릭터 화면 왼쪽 아래에 있는\n[연출 설정] 버튼을 누르면\n[표정]에서 바꿀 수 있어요.', go: { tab: 'preview', sheet: 'pv', pick: 'expr' },
    pc: { how: '오른쪽의 캐릭터 화면 아래에 있는\n[표정] 버튼에서 바꿀 수 있어요.', go: { tab: 'preview', spot: 'expr', click: true } } },
  { id: 'action', title: '자세 바꾸기', words: '액션, 포즈, 자세, 동작, 걷기, 앉기, 점프, 눕기, 춤',
    how: '위쪽의 캐릭터 화면 왼쪽 아래에 있는\n[연출 설정] 버튼을 누르면\n[액션]에서 바꿀 수 있어요.', go: { tab: 'preview', sheet: 'pv', pick: 'action' },
    pc: { how: '오른쪽의 캐릭터 화면 아래에 있는\n[액션] 버튼에서 바꿀 수 있어요.', go: { tab: 'preview', spot: 'action', click: true } } },
  { id: 'weapon', title: '무기 모션 바꾸기', words: '모션, 무기 모션, 무기 드는 자세, 건모션, 한손 두손, 휘두르기, 찌르기, 사격',
    how: '위쪽의 캐릭터 화면 왼쪽 아래에 있는\n[연출 설정] 버튼을 누르면\n[모션]에서 바꿀 수 있어요.', go: { tab: 'preview', sheet: 'pv', pick: 'weapon' },
    pc: { how: '오른쪽의 캐릭터 화면 아래에 있는\n[모션] 버튼에서 바꿀 수 있어요.', go: { tab: 'preview', spot: 'weapon', click: true } } },
  { id: 'zoom', title: '캐릭터 크기', words: '크기, 확대, 축소, 작게, 크게, 인게임 비율, 잘려요, 배율',
    how: '위쪽의 캐릭터 화면 왼쪽 아래에 있는\n[연출 설정] 버튼을 누르면\n[배율]에서 바꿀 수 있어요.\n1배가 가장 작아요.', go: { tab: 'preview', sheet: 'pv', spot: 'zoom' },
    pc: { how: '오른쪽의 캐릭터 화면 아래에 있는\n[배율] 버튼에서 바꿀 수 있어요.\n1배가 가장 작아요.', go: { tab: 'preview', spot: 'zoom', click: true } } },
  { id: 'form', title: '형상 변이, 귀, 시선', words: '아니마, 호영 꼬리, 라라 뿔, 렌, 엘프 귀, 레프 귀, 뒤돌기, 뒷모습, 방향, 시선',
    how: '위쪽의 캐릭터 화면 왼쪽 아래에 있는\n[연출 설정] 버튼을 누르면\n맨 위에서 바꿀 수 있어요.', go: { tab: 'preview', sheet: 'pv', group: 'char', spot: 'pv-form' },
    pc: { how: '오른쪽의 캐릭터 화면 아래 맨 끝에 있는\n[연출 설정] 버튼을 누르면\n펼쳐진 칸에서 바꿀 수 있어요.', go: { tab: 'preview', drawer: 'char', spot: 'pv-form' } } },
  { id: 'effect', title: '이펙트 끄고 켜기', words: '이펙트 끄기, 무기 이펙트, 망토 이펙트, 모자 이펙트, 반짝이 없애기, 효과 끄기, 부유 효과, 둥둥 뜨기, 떠 있는 캐릭터',
    how: '위쪽의 캐릭터 화면 왼쪽 아래에 있는\n[연출 설정] 버튼을 누르고\n[이펙트]를 고르면 끄고 켤 수 있어요.\n캐릭터가 둥둥 뜨는 것은 [부유 효과]예요.', go: { tab: 'preview', sheet: 'pv', group: 'effect', spot: 'pv-effect' },
    pc: { how: '오른쪽의 캐릭터 화면 아래 맨 끝에 있는\n[연출 설정] 버튼을 누르고\n[이펙트]를 고르면 끄고 켤 수 있어요.\n캐릭터가 둥둥 뜨는 것은 [부유 효과]예요.', go: { tab: 'preview', drawer: 'effect', spot: 'pv-effect' } } },
  { id: 'nick', title: '닉네임으로 코디 불러오기', words: '닉네임 검색, 내 캐릭터, 인게임 코디 가져오기, 캐릭터 이름, 넥슨, 불러오기',
    how: '맨 아래의 [프리셋] 탭에 있는 맨 위 칸에\n닉네임을 넣고 오른쪽 버튼을 누르면\n게임 속 코디를 그대로 가져와요.', go: { tab: 'preset', spot: 'nick' },
    pc: { how: '맨 아래의 [프리셋] 탭에 있는 맨 위 칸에\n닉네임을 넣고 [불러오기]를 누르면\n게임 속 코디를 그대로 가져와요.' } },
  { id: 'link-in', title: '받은 링크로 코디 보기', words: '링크 붙여넣기, 코드 입력, 받은 코디, 공유 코드',
    how: '받은 링크를 열면 바로 보여요.\n맨 아래의 [프리셋] 탭에 있는 맨 위 칸에\n붙여 넣어도 돼요.', go: { tab: 'preset', spot: 'nick' } },
  { id: 'link-out', title: '코디 링크 보내기', words: '공유, 링크 복사, 친구에게 보내기, 디스코드, 카톡',
    how: '오른쪽 맨 위에 있는 [복사] 버튼을 누르면\n지금 코디 링크가 복사돼요.', go: { spot: 'copy' },
    pc: { how: '오른쪽 맨 위에 있는 [프리셋 복사] 버튼을 누르면\n지금 코디 링크가 복사돼요.' } },
  { id: 'preset', title: '코디 저장', words: '저장, 코디 저장, 여러 코디, 슬롯, 이름 바꾸기, 프리셋',
    how: '맨 아래의 [프리셋] 탭에서 고른 칸에\n지금 코디가 저절로 저장돼요.', go: { tab: 'preset' } },
  { id: 'dye', title: '염색하기', words: '염색, 색 바꾸기, 믹스 염색, 헤어 색, 렌즈 색, 색조 채도 명도, 프리즘',
    how: '맨 아래의 [염색] 탭에서 할 수 있어요.\n캐릭터 화면 오른쪽 아래에 있는\n팔레트 버튼으로도 바로 돼요.', go: { tab: 'info' },
    pc: { how: '맨 아래의 [코디 정보 / 염색] 탭에서 할 수 있어요.\n오른쪽의 캐릭터 화면 왼쪽 위에 있는\n[부위 염색] 버튼으로도 바로 돼요.' } },
  { id: 'dye-table', title: '염색표', words: '염색표, 발색표, 색 비교, 한눈에',
    how: '헤어나 성형 염색 창 안에 있는\n[염색표] 버튼에서\n색을 한눈에 보고 고를 수 있어요.', go: { tab: 'info' } },
  { id: 'dot', title: '점 위치 옮기기', words: '점, 얼굴 점, 점 옮기기, 위치 조절',
    how: '점이 있는 얼굴장식을 입으면\n캐릭터 화면 오른쪽 아래에 있는 점 버튼이 켜져요.\n누르면 점을 옮길 수 있어요.', go: { tab: 'preview', spot: 'dot' },
    pc: { how: '점이 있는 얼굴장식을 입으면\n오른쪽의 캐릭터 화면 오른쪽 위에 있는\n[점 위치] 버튼에서 옮길 수 있어요.' } },
  { id: 'bg', title: '캐릭터 배경 바꾸기', words: '배경, 배경 바꾸기, 미리보기 배경, 코디 배경, 흰 배경, 검은 배경, 내 사진, 배경 업로드, 피팅룸, 캐시샵 배경, 버섯 집',
    how: '위쪽의 캐릭터 화면 왼쪽 아래에 있는\n그림 버튼에서 바꿀 수 있어요.\n피팅룸, 캐시샵 배경, 흰색, 검은색, 내 사진이 있어요.', go: { tab: 'preview', sheet: 'bg' },
    pc: { how: '오른쪽의 캐릭터 화면 왼쪽 위에 있는\n[배경] 버튼에서 바꿀 수 있어요.\n피팅룸, 캐시샵 배경, 흰색, 검은색, 내 사진이 있어요.' } },
  { id: 'image', title: '캐릭터 이미지, 움짤 저장', words: '이미지 저장, 사진 저장, 캡처, 투명 배경으로 저장, 배경 없이 저장, png, 다운로드, 복사, 움짤, 움짤 저장, gif, 움직이는 이미지, 움직이는 그대로 저장, 모션 저장, 투명 움짤, 배경 없는 움짤, 투명 gif, 배경째 저장, 배경 포함 움짤, 피팅룸 움짤',
    how: '캐릭터를 길게 누르면\n이미지로 저장하거나 복사할 수 있어요(배경 없이).\n[움짤 저장]은 움직이는 그대로 한 바퀴를\n끝없이 반복되는 GIF 로 저장해요.\n지금 깔린 배경(올린 그림 포함)째로 저장돼요.\n[투명 움짤 저장]은 배경 없이 저장하지만\n번지는 빛이 있는 이펙트는 끝이 거칠어져요.',
    pc: { how: '캐릭터를 오른쪽 클릭하면\n이미지로 저장하거나 복사할 수 있어요(배경 없이).\n[움짤 저장]은 움직이는 그대로 한 바퀴를\n끝없이 반복되는 GIF 로 저장해요.\n지금 깔린 배경(올린 그림 포함)째로 저장돼요.\n[투명 움짤 저장]은 배경 없이 저장하지만\n번지는 빛이 있는 이펙트는 끝이 거칠어져요.' } },
  { id: 'bookmark', title: '북마크와 비교', words: '찜, 북마크, 비교, 나란히, vs',
    how: '아이템 카드의 [북마크]로 모아 두면\n캐릭터 화면 오른쪽 아래에 있는 북마크 버튼에서\n모은 것을 보고 비교할 수 있어요.', go: { tab: 'preview', sheet: 'bm' },
    pc: { how: '아이템 카드의 [북마크]로 모아 두면\n오른쪽 아래의 북마크 칸에 쌓여요.\n[VS] 버튼으로 나란히 비교할 수 있어요.', go: { tab: 'preview', spot: 'bm' } } },
  { id: 'ai-search', title: 'AI 코디 검색', words: '문장 검색, 비슷한 아이템, 생김새로 찾기, 스타일 검색',
    how: '맨 아래의 [AI 검색] 탭에서\n원하는 생김새를 문장으로 적으면 찾아 줘요.\n예: 하얀 리본 모자', go: { tab: 'search', spot: 'ai' },
    pc: { how: '맨 아래의 [AI 코디 검색] 탭에서\n원하는 생김새를 문장으로 적으면 찾아 줘요.\n예: 하얀 리본 모자' } },
  { id: 'find', title: '아이템 찾기', words: '검색, 이름 검색, 신규, 새로 나온, 성별, 내 캐릭터로 보기, 입혀서 보기',
    how: '맨 아래의 [코디] 탭에서\n목록 위에 있는 [보기 설정]과 [아이템 검색]으로\n찾을 수 있어요.', go: { tab: 'codi' },
    pc: { how: '맨 아래의 [코디] 탭에서\n왼쪽 목록 맨 위에 있는 칸으로\n이름, 성별, 보기 방식을 고를 수 있어요.' } },
  { id: 'listdir', title: '목록 넘기는 방향', words: '가로 세로, 세로로 넘기기, 위아래로 넘기기, 스크롤 방향, 목록 방향',
    how: '맨 아래의 [코디] 탭에서\n목록 위에 있는 [보기 설정]을 누르면\n[방향]에서 가로와 세로를 고를 수 있어요.', go: { tab: 'codi', spot: 'listdir' },
    pc: { how: '맨 아래의 [코디] 탭에서\n왼쪽 목록 맨 위에 있는 방향 버튼으로\n가로와 세로를 고를 수 있어요.' } },
  { id: 'ring', title: '일루전링(변신, 거대한 몸)', words: '일루전 링, 변신, 변신 반지, 거대한 머리, 거대한 몸, 내 뒤에 나, 분신',
    how: '맨 아래의 [코디] 탭에서\n부위 줄의 [일루전링]을 골라 끼면\n캐릭터가 변신하거나 커져요.', go: { tab: 'codi' } },
  { id: 'chat', title: '명찰, 말풍선, 채팅', words: '명찰, 말풍선, 명찰 반지, 말풍선 반지, 채팅, 말 걸기, 대사 띄우기, 이름표, 이모티콘',
    how: '캐릭터 화면 왼쪽 아래의 말풍선 버튼으로\n말과 이모티콘을 보낼 수 있어요.\n명찰과 말풍선 모양은 맨 아래의 [코디] 탭\n부위 줄의 [명찰 / 말풍선]에서 골라 입어요.', go: { tab: 'preview', spot: 'chat', click: true },
    pc: { how: '오른쪽의 캐릭터 화면 아래 채팅 칸에\n말을 적고 Enter 를 누르면 떠요.\n명찰과 말풍선 모양은 맨 아래의 [코디] 탭\n부위 줄의 [명찰 / 말풍선]에서 골라 입어요.', go: { tab: 'preview', spot: 'chat' } } },
  { id: 'basetag', title: '기본 명찰 켜고 끄기', words: '기본 명찰, 기본 이름표, 발밑 이름, 캐릭터 이름 표시, 명찰 반지 없이',
    how: '위쪽의 캐릭터 화면 왼쪽 아래에 있는\n[연출 설정] 버튼을 누르고 [캐릭터]를 고르면\n[기본 명찰]에서 켜고 끌 수 있어요.\n명찰 반지를 끼면 그 명찰이 나와요.', go: { tab: 'preview', sheet: 'pv', group: 'char', spot: 'basetag' },
    pc: { how: '오른쪽의 캐릭터 화면 아래 맨 끝에 있는\n[연출 설정] 버튼을 누르고 [캐릭터]를 고르면\n[기본 명찰]에서 켜고 끌 수 있어요.\n명찰 반지를 끼면 그 명찰이 나와요.', go: { tab: 'preview', drawer: 'char', spot: 'basetag' } } },
  { id: 'hide', title: '숨기기, 전부 벗기', words: '숨기기, 안 보이게, 벗기, 전부 벗기, 맨몸',
    how: '맨 아래의 [염색] 탭에서\n부위 옆에 있는 눈 버튼으로 숨길 수 있어요.\n[전체 벗기]로 한 번에 벗을 수도 있어요.', go: { tab: 'info', spot: 'unequip' },
    pc: { how: '맨 아래의 [코디 정보 / 염색] 탭에서\n부위 옆에 있는 눈 버튼으로 숨길 수 있어요.\n[전체 벗기]로 한 번에 벗을 수도 있어요.' } },
  { id: 'undo', title: '되돌리기', words: '취소, 되돌리기, 실수, 이전으로, 다시실행',
    how: '위쪽의 캐릭터 화면 오른쪽 위에 있는\n화살표 버튼으로 되돌릴 수 있어요.', go: { tab: 'preview', spot: 'undo' },
    pc: { how: '오른쪽의 캐릭터 화면 오른쪽 위에 있는\n화살표 버튼으로 되돌릴 수 있어요.' } },
  { id: 'rate', title: '핑크빈 코디 평가', words: '평가, 핑크빈, 한마디, 반응, 점수',
    how: '오른쪽 맨 위에 있는 [평가] 버튼을 누르면\n핑크빈이 코디를 보고 한마디 해요.', go: { spot: 'rate' },
    pc: { how: '오른쪽 맨 위에 있는 [코디 평가] 버튼을 누르면\n핑크빈이 코디를 보고 한마디 해요.' } },
  { id: 'plaza', title: '다른 사람 코디 보기', words: '다른 사람 코디, 구경, 가져오기, 좋아요, 랭킹, 코디 광장',
    how: '맨 아래의 [광장] 탭에서\n다른 사람 코디를 구경하고\n마음에 들면 가져올 수 있어요.', go: { tab: 'share' },
    pc: { how: '맨 아래의 [코디 광장] 탭에서\n다른 사람 코디를 구경하고\n마음에 들면 가져올 수 있어요.' } },
  { id: 'plaza-up', title: '내 코디 올리기', words: '코디 올리기, 업로드, 자랑, 등록',
    how: '맨 아래의 [광장] 탭에서\n목록 위 오른쪽에 있는 + 버튼으로\n올릴 수 있어요.', go: { tab: 'share' },
    pc: { how: '맨 아래의 [코디 광장] 탭에서\n오른쪽에 있는 [내 코디 등록]으로\n올릴 수 있어요.' } },
  { id: 'pinch', title: '화면 확대', words: '핀치 줌, 손가락 확대, 화면 확대, 크게 보기',
    how: '두 손가락으로 벌리면 화면이 커져요.\n캐릭터만 키우고 싶다면\n맨 위의 로고 옆에 있는 네모 버튼을 써 보세요.',
    pc: { how: 'Ctrl 과 + 로 화면을 키울 수 있어요.\n캐릭터만 키우고 싶다면\n캐릭터 화면 아래에 있는 [배율]을 써 보세요.', go: { tab: 'preview', spot: 'zoom' } } },
  { id: 'view', title: '캐릭터 크게 보기', words: '크게 보기, 넓게, 전체 화면, 캐릭터만, 목록 숨기기', only: 'm',
    how: '맨 위의 로고 옆에 있는 네모 버튼 셋으로\n캐릭터를 크게 볼 수 있어요.\n오른쪽 버튼일수록 더 커져요.', go: { tab: 'preview', spot: 'view' } },
  { id: 'sky', title: '낮과 밤, 배경 보기', words: '밤, 낮, 시간대, 배경만 보기, 하늘', only: 'pc',
    how: '오른쪽 맨 위에 있는 [자동] 버튼에서\n낮과 밤을 고를 수 있어요.\n[배경 보기]를 누르면 배경만 보여요.' },
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
