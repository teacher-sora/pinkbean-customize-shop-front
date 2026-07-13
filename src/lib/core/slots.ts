// Slot metadata + inventory-occupancy (islot) exclusivity. This is the
// "equippability" layer, distinct from vslot render occlusion: equipping an
// item auto-removes any equipped item whose islot codes intersect (e.g.
// longcoat MaPn ⇒ removes coat Ma + pants Pn; 2H weapon WpSi ⇒ removes shield Si).
import type { ListItem } from './data'

export const SLOT_ORDER = [
  'hair', 'face', 'cap', 'faceAcc', 'eyeAcc', 'earring',
  'coat', 'longcoat', 'pants', 'shoes', 'glove', 'cape', 'weapon', 'shield',
] as const
export type Slot = (typeof SLOT_ORDER)[number]

export const SLOT_LABELS: Record<string, string> = {
  hair: '헤어', face: '성형', cap: '모자', faceAcc: '얼굴장식', eyeAcc: '눈장식', earring: '귀고리',
  coat: '상의', longcoat: '한벌옷', pants: '하의', shoes: '신발', glove: '장갑', cape: '망토',
  weapon: '무기', shield: '방패', skin: '피부',
}

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
export function conflictSlots(
  equipped: Record<string, ListItem | null>,
  newSlot: string,
  newItem: ListItem,
): string[] {
  const codes = parseCodes(newItem.islot)
  const clear: string[] = []
  for (const [slot, it] of Object.entries(equipped)) {
    if (!it || slot === newSlot) continue
    if (intersects(codes, parseCodes(it.islot))) clear.push(slot)
  }
  return clear
}

// Is `slot` currently blocked by an equipped item in another slot that occupies
// this slot's primary code? Returns the blocking slot name, or null.
export function isSlotBlocked(equipped: Record<string, ListItem | null>, slot: string): string | null {
  const slotCode = SLOT_PRIMARY[slot]
  if (!slotCode) return null
  for (const [s, it] of Object.entries(equipped)) {
    if (!it || s === slot) continue
    if (parseCodes(it.islot).includes(slotCode)) return s
  }
  return null
}

// primary islot code per UI slot (for blocked-state display)
export const SLOT_PRIMARY: Record<string, string> = {
  hair: 'Hr', face: 'Fc', cap: 'Cp', faceAcc: 'Af', eyeAcc: 'Ay', earring: 'Ae',
  coat: 'Ma', longcoat: 'Ma', pants: 'Pn', shoes: 'So', glove: 'Gv', cape: 'Sr',
  weapon: 'Wp', shield: 'Si',
}
