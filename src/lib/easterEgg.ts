// 이스터에그: 코디 탭의 아이템 검색과 AI 코디 검색에 정해진 낱말을 **정확히** 넣으면 정해진 아이템만 나온다.
// 순서는 코디 정보의 칸 순서(헤어 → 방패). id 는 목록에 나오는 대표 id 다(헤어·성형 = 기본 색, 같은 이름 장비 = 가장 낮은 id).
const WORDS = ['못바', '못생긴바인더']
export const EGG_ITEMS: { slot: string; id: string }[] = [
  { slot: 'hair', id: '00066530' },      // 루미엘 헤어 (남)
  { slot: 'face', id: '00053021' },      // 차차 얼굴 (남)
  { slot: 'skin', id: '00002015' },      // 뽀송 꽃잎 피부
  { slot: 'cap', id: '01002498' },       // 대머리 가발
  { slot: 'faceAcc', id: '01012571' },   // 나른zZ
  { slot: 'eyeAcc', id: '01022079' },    // 투명 안경
  { slot: 'longcoat', id: '01050117' },  // 블루 삼각 수영복 (남)
  { slot: 'shoes', id: '01072153' },     // 투명 신발
  { slot: 'cape', id: '01102154' },      // 자쿰의 팔
  { slot: 'weapon', id: '01702043' },    // 응가 막대
  { slot: 'shield', id: '01092056' },    // 투명 방패
]
const IDS = new Set(EGG_ITEMS.map((e) => e.id))
export const isEgg = (q: string) => WORDS.includes(q.trim())
export const isEggItem = (id: string) => IDS.has(id)
