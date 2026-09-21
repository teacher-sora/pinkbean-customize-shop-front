// 스냅샷(착용+톤+염색+점 위치+연출설정 일부) → 합성 결과(placed·염색 override·이펙트). 렌더 캔버스와 무관한 순수 조립.
// SnapThumb(프리셋 카드·닉네임 코디 선택)과 공유 카드 이미지(shareImage)가 같은 그림이어야 해서 한 곳에 둔다.
import { assemble, getFrameLayers, type AssembleInput, type PlacedLayer } from './assemble'
import { loadMeta, loadAnima, type AnimaRace, type Index, type ItemMeta } from './data'
import { LRU } from './lru'
import { applyHsb, buildOverrides, skinHsb as skinHsbFor } from './dye'
import { effectDraws, loadImage, type EffectDraw } from './render'
import { collectWornEffects } from './thumbEffects'
import { animaLayers, skinDyeFamily, thumbView } from '@/lib/shopData'
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
  const skinFam = skinDyeFamily(te.name)
  if (skinHsb && (skinHsb.h || skinHsb.s || skinHsb.b) && skinFam != null) {
    for (const meta of [bodyMeta, headMeta]) for (const l of getFrameLayers(meta, TV)) {
      try { overrides.set(l.png, applyHsb(await loadImage(l.png, true), skinHsbFor(skinHsb, skinFam), l.png)) } catch (_) {}
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

// ── 합성 결과 캐시 ─────────────────────────────────────────────────────────────
// 2026-09-22 사용자 제보: 광장에서 자유 코디 ↔ 블아 대회 필터를 여러 번 오가면 점점 느려지다 끊겼다.
// 필터를 바꾸면 카드 키(post.id)가 전부 바뀌어 18~54장이 통째로 언마운트→재마운트되는데, 합성 결과를
// 아무도 기억하지 않아 **돌아올 때마다 처음부터 다시** 조립·염색했다. 게다가 시작된 합성은 중간에 멈출 수
// 없어서(네트워크·픽셀 작업의 연쇄 await) 빨리 오갈수록 버려질 작업이 메인 스레드에 쌓였다.
//  · 같은 코디(스냅샷)면 결과를 그대로 재사용한다 → 되돌아온 필터는 계산 0.
//  · 같은 키를 여러 장이 동시에 부르면 한 번만 계산하고 나눠 쓴다(같은 코디를 올린 사람이 여럿일 때).
//  · 중간에 취소된 카드의 작업도 캐시에 남으므로 헛일이 되지 않는다.
// 담기는 건 배치 정보(작은 객체)와 염색 캔버스 **참조**(실물은 dye.ts 의 캐시가 이미 쥐고 있다)라 가볍다.
// 120 칸 = 광장 전체(현재 96장) + 여유. 오래된 것부터 밀려난다 — 밀려나도 다시 합성하면 되는 값이라 안전하고,
// 염색 캔버스를 참조로 붙들고 있으므로 무한정 키우지 않는다(모바일 메모리).
const composeCache = new LRU<SnapComposite | null>(120)
const composeFlight = new Map<string, Promise<SnapComposite | null>>()

export const snapKey = (snap: Snapshot): string => JSON.stringify(snap)
// 카탈로그(index)는 loadIndex 를 부를 때마다 **새 객체**다(공유 카드 만들기 등에서 따로 받는다). 내용이 달라지면
// 결과도 달라지므로 객체마다 번호를 붙여 캐시를 나눈다 — 길이 같은 걸로 퉁치면 패치 직후 옛 결과가 섞일 수 있다.
const indexIds = new WeakMap<Index, number>()
let nextIndexId = 0
const indexId = (index: Index) => {
  let id = indexIds.get(index)
  if (id === undefined) { id = ++nextIndexId; indexIds.set(index, id) }
  return id
}
const cacheKey = (key: string, index: Index, animaRaces: AnimaRace[]) => `${key}|${indexId(index)}|${animaRaces.length}`

// 이미 합성해 둔 코디인지 **동기로** 본다 → 맞으면 줄(thumbQueue)을 서지 않고 그 자리에서 바로 그린다.
export function composePeek(key: string, index: Index, animaRaces: AnimaRace[]): SnapComposite | null | undefined {
  const k = cacheKey(key, index, animaRaces)
  return composeCache.has(k) ? (composeCache.get(k) ?? null) : undefined
}

export function composeSnapshotCached(key: string, snap: Snapshot, index: Index, animaRaces: AnimaRace[]): Promise<SnapComposite | null> {
  const k = cacheKey(key, index, animaRaces)
  if (composeCache.has(k)) return Promise.resolve(composeCache.get(k) ?? null)
  let p = composeFlight.get(k)
  if (!p) {
    p = composeSnapshot(snap, index, animaRaces)
      .then((r) => { composeCache.set(k, r); return r })
      .finally(() => { composeFlight.delete(k) })
    composeFlight.set(k, p)
  }
  return p
}

// 형상변이 목록은 세션에 한 번만 받는다. ⚠️ **동기로 꺼낼 수 있어야** 한다 —
// 카드가 빈 배열로 한 번 그리고 목록이 도착한 뒤 또 그리면 카드마다 합성이 두 번씩 돌았다(같은 제보).
let animaReady: AnimaRace[] | null = null
export const animaNow = (): AnimaRace[] | null => animaReady
export function animaOnce(): Promise<AnimaRace[]> {
  return loadAnima().then((r) => { animaReady = r; return r })
}
