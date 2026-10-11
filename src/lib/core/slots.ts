// Slot metadata + inventory-occupancy (islot) exclusivity. This is the
// "equippability" layer, distinct from vslot render occlusion: equipping an
// item auto-removes any equipped item whose islot codes intersect (e.g.
// longcoat MaPn ⇒ removes coat Ma + pants Pn; 2H weapon WpSi ⇒ removes shield Si).
import type { ListItem } from './data'

export function parseCodes(islot: string | null | undefined): string[] {
  if (!islot) return []
  const out: string[] = []
  for (let i = 0; i + 2 <= islot.length; i += 2) out.push(islot.slice(i, i + 2))
  return out
}

function intersects(a: string[], b: string[]): boolean {
  return a.some((c) => b.includes(c))
}

// Given current equipped map and a newly chosen item, return the slots that must
// be cleared (its own slot is replaced by the caller; these are extra conflicts).
// 헤어(Hr)·성형(Fc) 코드는 충돌 판정에서 제외한다. 전신 인형탈 등 일부 모자는 islot 에 'Hr'(때론 'Fc')을
// 포함해(예: 배고픈 기린 인형탈 'HrCp') 게임에선 헤어를 대체하지만, 코스메틱 미리보기에선 모자의 vslot 이
// 이미 헤어/얼굴을 시각적으로 가리므로(occlusion) 굳이 장착 해제할 필요가 없다 — base 외형(헤어/성형)은
// 유지되어야 한다(모자를 벗으면 다시 보임). Hr/Fc 를 빼면 "모자→헤어 벗김"과 "헤어→모자 벗김" 양방향이 함께
// 해결된다. 진짜 배타 충돌(한벌옷 MaPn⇒상하의, 두손무기 WpSi⇒방패)은 Ma/Pn/Wp/Si 라 영향 없음.
const CONFLICT_IGNORE = new Set(['Hr', 'Fc'])
export function conflictSlots(
  equipped: Record<string, ListItem | null>,
  newSlot: string,
  newItem: ListItem,
): string[] {
  const codes = parseCodes(newItem.islot).filter((c) => !CONFLICT_IGNORE.has(c))
  const clear: string[] = []
  for (const [slot, it] of Object.entries(equipped)) {
    if (!it || slot === newSlot) continue
    if (intersects(codes, parseCodes(it.islot))) clear.push(slot)
  }
  return clear
}
