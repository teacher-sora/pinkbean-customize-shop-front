// 카드/프리셋 썸네일에서 "착용 아이템의 이펙트(ItemEff)"를 다루는 공용 로직.
//
// 왜 필요한가:
//  - 코디/검색 카드의 '내 모델', 프리셋 카드는 착용 아이템을 합성해 보여주는데, 망토 오라 같은
//    이펙트는 아이템 레이어가 아니라 **별도 png(ItemEff)** 라서 그냥은 그려지지도, 염색되지도 않는다.
//    (buildOverrides 는 아이템 레이어만 염색한다 → 이펙트는 원래 색으로 남는다.)
//  - 연출 설정의 '무기 이펙트/망토 이펙트' 토글은 미리보기에만 적용되고 있었다 → 카드에서도 지켜야 한다.
//
// 그래서 이 헬퍼가 한 번에: 토글 반영 → 이펙트 메타 수집 → HSB 염색을 override 에 구움.
import { loadEffect, loadEffectIndex, type EffectMeta } from './data'
import { applyHsb, type HsbParams } from './dye'
import { loadImage } from './render'

export type WornEff = { slot: string; em: EffectMeta }

/** 슬롯이 연출 토글에 의해 이펙트가 꺼졌는지. (무기=wEffect, 망토=cEffect, 모자=capEffect)
 *  capEffect 는 옛 스냅샷/공유코드엔 없어(undefined) → `!== false` 로 기본 켜짐(기존 동작 보존). */
export const effectEnabled = (slot: string, pv: { wEffect: boolean; cEffect: boolean; capEffect?: boolean }) =>
  slot === 'weapon' ? pv.wEffect : slot === 'cape' ? pv.cEffect : slot === 'cap' ? pv.capEffect !== false : true

/**
 * 착용 아이템들의 이펙트 메타를 모으고(토글 꺼진 슬롯은 제외), 그 아이템에 HSB 염색이 걸려 있으면
 * 이펙트 프레임0 png 를 리컬러해 `override` 에 넣는다(카드는 정지 프레임0만 그리므로 프레임0이면 충분).
 * override 를 그 자리에서 변형(mutate)한다 — 호출부가 renderCharacter 에 그대로 넘기면 된다.
 */
export async function collectWornEffects(
  worn: { slot: string; id: string }[],
  pv: { wEffect: boolean; cEffect: boolean; capEffect?: boolean },
  dyeHsb: Record<string, HsbParams>,
  override: Map<string, HTMLCanvasElement>,
): Promise<WornEff[]> {
  if (!worn.length) return []
  const idx = await loadEffectIndex().catch(() => new Set<string>())
  const out: WornEff[] = []
  for (const { slot, id } of worn) {
    if (!effectEnabled(slot, pv)) continue                       // 토글 꺼짐 → 카드에서도 안 보인다
    if (!idx.has(String(parseInt(id, 10)))) continue             // 이펙트 없는 아이템
    const em = await loadEffect(id).catch(() => null)
    if (!em) continue
    out.push({ slot, em })
    const h = dyeHsb[slot]
    if (!h || (h.h === 0 && h.s === 0 && h.b === 0)) continue     // 염색 없음 → 원본 그대로
    // 프레임 png 는 병렬 로드(순차면 프레임 많은 망토에서 줄줄이 늘어져 느리다).
    const pngs = Object.values(em.groups).flatMap((g) => g.frames.slice(0, 1).map((fr) => fr.png))
    const loaded = await Promise.all(pngs.map((p) => loadImage(p, true).then((img) => [p, img] as const).catch(() => null)))
    for (const e of loaded) { if (e) { try { override.set(e[0], applyHsb(e[1], h, e[0])) } catch (_) {} } }
  }
  return out
}
