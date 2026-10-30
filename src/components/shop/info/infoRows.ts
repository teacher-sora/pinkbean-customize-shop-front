// 코디 정보의 부위 행 · 공유 칩 — 코디 정보 탭과 서피스(부위 고르기 · 코디 프로필)가 함께 쓴다. 탭 패널은 첫 로드 묶음 밖이라(frame/lazyPanel) 공용은 여기에 둔다.
import type { ListItem } from '@/lib/core/data'
import type { HsbParams } from '@/lib/core/dye'
import { CAT_TO_SLOT, isDyeableSkin, skinDyeFamily } from '@/lib/shopData'
import { useShop } from '../ShopContext'
import { dyeBandData, type DyeBandState } from './SlotSprite'
import { chipIcon } from '../render/DyeSprite'
import type { ShareChip } from '@/lib/profileCard'

export const hsbActive = (h?: HsbParams) => !!h && (h.h !== 0 || h.s !== 0 || h.b !== 0)

// 피부(톤)를 염색 다이얼로그에 넘길 ListItem 형태로.
export function useSkinItem(): ListItem | null {
  const s = useShop()
  const te = s.index?.base.tones.find((t) => t.tone === s.tone)
  if (!te) return null
  return { id: te.body, slot: 'skin', isCash: false, grade: 'none', islot: null, vslot: null, dyeMode: 'hsb', thumb: `sprites/${te.body}/thumb.png`, headId: te.head, name: te.name || `피부 ${te.tone}`, actions: [] }
}

type Shop = ReturnType<typeof useShop>
// 부위 행(코디 정보 칩 하나씩) — 코디 정보 탭과 코디 프로필 창(surface/ProfileCardBody)이 함께 쓴다
export function infoRows (s: Shop, skinItem: ListItem | null, toneName: string) {
  return s.infoCats.map((c) => {
    const slot = CAT_TO_SLOT[c.id]
    const isSkin = c.id === 'skin'
    const isMix = s.isMixSlot(slot)
    const item = isSkin ? skinItem : s.equipped[slot] || null
    const on = isSkin ? !!skinItem : !!item
    const hidden = !!s.hidden[slot]
    let dyed = false
    if (isSkin) dyed = isDyeableSkin(toneName) && hsbActive(s.dyeHsb.skin)
    else if (isMix) { const p = s.dyePalette[slot]; dyed = !!p && (p.baseColor !== 0 || (p.mixColor != null && p.ratio > 0)) }
    else dyed = hsbActive(s.dyeHsb[slot])
    return { c, slot, isSkin, isMix, item, on, hidden, dyed, dyeOff: !!s.dyeOff[slot], sel: s.dyeTarget === slot }
  })
}
export type Row = ReturnType<typeof infoRows>[number]
export const bandStateOf = (r: Row, toneName: string): DyeBandState => (!r.on ? 'empty' : r.dyed ? 'dyed' : (r.isSkin ? !isDyeableSkin(toneName) : r.item?.dyeMode === 'none') ? 'none' : 'plain')
export const useToneName = () => { const s = useShop(); return s.index?.base.tones.find((t) => t.tone === s.tone)?.name || `피부 ${s.tone}` }

// 카드의 칩: 입고 보이는 부위만(숨긴 부위 · 비어 있는 칸 — '기본' 명찰 · 말풍선 포함 — 은 넣지 않는다).
// 그림은 피부만 화면의 칩 캔버스(내보낼 수 있다), 그 밖은 같은 규칙으로 CORS 로 다시 그린다(화면 칩은 비-CORS 그림이 섞여 내보낼 수 없다)
export async function shareChips (s: Shop, rows: Row[], toneName: string): Promise<ShareChip[]> {
  const readable = (c: HTMLCanvasElement | null | undefined) => { if (!c || !c.width) return null; try { c.getContext('2d')!.getImageData(0, 0, 1, 1); return c } catch { return null } }
  const zmap = s.index?.zmap || []
  return Promise.all(rows.filter((r) => r.on && !r.hidden && r.item).map(async (r) => ({
    part: r.c.label, name: r.item!.name || r.item!.id,
    icon: r.isSkin ? readable(document.querySelector<HTMLCanvasElement>(`[data-share-slot="${r.slot}"] canvas`))
      : await chipIcon({ id: r.item!.id, icon: r.item!.icon, mix: r.isMix, palette: s.renderPalette[r.slot], hsb: s.renderHsb[r.slot], dyeable: r.item!.dyeMode !== 'none', zmap }),
    band: dyeBandData(bandStateOf(r, toneName), r.slot, s.dyeOff[r.slot] ? undefined : s.dyePalette[r.slot], s.dyeOff[r.slot] ? undefined : s.dyeHsb[r.slot], r.isSkin ? skinDyeFamily(toneName) ?? undefined : undefined),
  })))
}
