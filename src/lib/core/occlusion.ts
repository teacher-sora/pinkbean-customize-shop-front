// Cap/head occlusion via vslot + smap (Phase 2 A1).
//
// Each item's `vslot` lists the 2-char visual slot codes it occupies. The cap is
// the "covering" piece: a hair/head/face layer is hidden when the slot code of
// its z-name (looked up in `smap`) is among the codes the worn cap covers.
//   crown   vslot "Cp"                  -> covers nothing extra, hides no hair
//   cap     vslot "CpH1H5"              -> hides hairOverHead(H1) etc., keeps the rest
//   helmet  vslot "CpHdH1..HsFc.."      -> also covers Hd/Fc -> hides head & face too
import type { Index } from './data'

export interface Equipped { id: string; slot: string; vslot: string | null }

function parseCodes(vslot: string | null): string[] {
  if (!vslot) return []
  const out: string[] = []
  for (let i = 0; i + 2 <= vslot.length; i += 2) out.push(vslot.slice(i, i + 2))
  return out
}

// Returns a predicate: is a layer of `slot` with z-name `z` visible?
export function buildVisibility(
  equipped: Equipped[],
  smap: Index['smap'],
): (slot: string, z: string) => boolean {
  const covered = new Set<string>()
  for (const it of equipped) {
    if (it.slot !== 'cap') continue
    for (const c of parseCodes(it.vslot)) covered.add(c)
  }
  return (slot, z) => {
    if (slot === 'cap') return true // the cap's own layers always show
    const first = parseCodes(smap[z] || '')[0]
    return first ? !covered.has(first) : true
  }
}
