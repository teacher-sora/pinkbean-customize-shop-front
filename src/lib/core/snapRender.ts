// 스냅샷(착용+톤+염색+점 위치+연출설정 일부) → 합성 결과(placed·염색 override·이펙트). 렌더 캔버스와 무관한 순수 조립.
// SnapThumb(프리셋 카드·닉네임 코디 선택)과 공유 카드 이미지(shareImage)가 같은 그림이어야 해서 한 곳에 둔다.
import { assemble, getFrameLayers, type AssembleInput, type PlacedLayer } from './assemble'
import { loadMeta, type AnimaRace, type Index, type ItemMeta } from './data'
import { applyHsb, buildOverrides, skinLineHsb } from './dye'
import { effectDraws, loadImage, type EffectDraw } from './render'
import { collectWornEffects } from './thumbEffects'
import { animaLayers, isColorLineSkin, thumbView } from '@/lib/shopData'
import { PV_SNAP_DEFAULT, type Snapshot } from '@/components/shop/ShopContext'

export type SnapComposite = { placed: PlacedLayer[]; overrides: Map<string, HTMLCanvasElement>; effects: EffectDraw[] }

export async function composeSnapshot(snap: Snapshot, index: Index, animaRaces: AnimaRace[]): Promise<SnapComposite | null> {
  // 프리셋은 "저장된 연출설정(snap.pv)"을 쓴다(형상변이·귀·무기모션·이펙트토글). 시선은 적용 안 함(왼쪽 고정).
  const spv = snap.pv ?? PV_SNAP_DEFAULT
  const te = index.base.tones.find((t) => t.tone === snap.tone) || index.base.tones[0]
  if (!te) return null
  const [bodyMeta, headMeta] = await Promise.all([loadMeta(te.body), loadMeta(te.head)])
  const equipMetas: { slot: string; meta: ItemMeta }[] = []
  for (const [slot, id] of Object.entries(snap.equipped)) {
    if (snap.hidden?.[slot] || !id) continue
    const m = await loadMeta(id).catch(() => null)
    if (m) equipMetas.push({ slot, meta: m })
  }
  // 표정 얼굴장식(fixedEmotion)이 프리셋에 들어있으면 그 표정으로 굳는다. 없으면 종전대로 THUMB_VIEW.
  // 프리셋 스냅샷은 id 만 담으므로 표정은 meta 에서 읽는다.
  const snapExpr = equipMetas.find(({ meta }) => meta.fixedEmotion)?.meta.fixedEmotion
  // 시선=왼쪽 고정(gaze='left' → flip 없음) + 저장된 귀/무기모션 반영.
  // stance=true: 무기 모션은 **자세까지** 바꾼다(두손 → stand2). 미리보기와 같은 규칙으로 맞춘다
  //   (2026-09-21 — 카드는 늘 stand1 이라 '두손'으로 둔 코디가 광장에서 다른 자세로 보였다).
  const TV = thumbView('left', snapExpr, spv.ear, spv.weapon, true).view
  // 무기 이펙트를 끄면 **무기 자신의 'effect' 레이어**도 뺀다 — 미리보기(PreviewModel)와 같은 규칙.
  //   이펙트는 ItemEff(별도 png)뿐 아니라 무기 프레임 안에 레이어로 박혀 있기도 해서(예 01703646: effect 90장),
  //   ItemEff 만 걸러서는 꺼지지 않았다(2026-09-21 사용자 제보 — 광장에 연출 설정이 반영 안 됨).
  const wornLayers = (slot: string, meta: ItemMeta) => {
    const ls = getFrameLayers(meta, TV)
    return slot === 'weapon' && !spv.wEffect ? ls.filter((l) => l.name !== 'effect') : ls
  }
  const items: AssembleInput[] = [
    { itemId: bodyMeta.id, slot: 'body', vslot: null, layers: getFrameLayers(bodyMeta, TV) },
    { itemId: headMeta.id, slot: 'head', vslot: null, layers: getFrameLayers(headMeta, TV) },
    // name 은 투명 아이템 판별에 쓰인다 — 없으면 투명 모자/장식이 헤어·얼굴을 가려 구멍이 생긴다.
    ...equipMetas.map(({ slot, meta }) => ({ itemId: meta.id, slot, vslot: meta.vslot ?? null, layers: wornLayers(slot, meta), invisibleFace: meta.invisibleFace, name: meta.name, dotOffsets: snap.dotPos?.[meta.id] })),
    ...animaLayers(spv.form, animaRaces), // 형상변이 — 프리셋에 저장된 값
  ]
  const { placed, anchors } = assemble(items, index.zmap, index.smap)
  // 염색: 착용 아이템(팔레트/HSB) + 컬러라인 피부 라인. (옛 프리셋엔 dye 키가 없을 수 있어 방어)
  // 염색 비활성화(dyeOff) 슬롯은 수치가 있어도 렌더에서 뺀다.
  const off = snap.dyeOff || {}
  const onlyOn = <T,>(r: Record<string, T> | undefined) => Object.fromEntries(Object.entries(r || {}).filter(([k]) => !off[k])) as Record<string, T>
  const snapPal = onlyOn(snap.dyePalette), snapHsb = onlyOn(snap.dyeHsb)
  const overrides = await buildOverrides(equipMetas.map((e) => e.meta), { palette: snapPal, hsb: snapHsb }, TV)
  const skinHsb = snapHsb['skin']
  if (skinHsb && (skinHsb.h || skinHsb.s || skinHsb.b) && isColorLineSkin(te.name)) {
    for (const meta of [bodyMeta, headMeta]) for (const l of getFrameLayers(meta, TV)) {
      try { overrides.set(l.png, applyHsb(await loadImage(l.png, true), skinLineHsb(skinHsb), l.png)) } catch (_) {}
    }
  }
  // 이펙트(망토 등 ItemEff): 착용 아이템의 이펙트를 정지 프레임0으로 합성.
  const curBody = placed.find((pl) => pl.slot === 'body' && pl.name === 'body')
  const bnav = curBody?.map?.navel
  const foot = { x: bnav ? -bnav.x : 8, y: bnav ? -bnav.y : 21 }
  const brow = anchors.brow ? { x: anchors.brow.x, y: anchors.brow.y } : foot
  const worn = await collectWornEffects(equipMetas.map(({ slot, meta }) => ({ slot, id: meta.id, dyeable: meta.dyeMode !== 'none' })), spv, snapHsb, overrides).catch(() => [])
  const effects: EffectDraw[] = worn.flatMap(({ em }) => effectDraws(em, TV.action, { foot, brow }, 0))
  return { placed, overrides, effects }
}
