// 안드로이드 — 그림이 따로 없는 '두 번째 캐릭터'. 외형(피부 톤 · 헤어 · 성형 · 입는 장비 id)은 parser scripts/android-build.py 가
// 목록(CDN androids/list.json) · meta 의 android 에 적는다. 모두 이미 CDN 에 있는 아이템이라 캐릭터와 같은 조립(assemble)으로 그린다.
// 미리보기(PreviewModel) · 부위 카드(ItemThumb) · 스냅샷(snapRender)이 이 파일 하나를 쓴다.
import { assemble, getFrameLayers, isBackFrame, type AssembleInput, type PlacedLayer, type ViewOpts } from './assemble'
import { loadMeta, type AndroidLook, type ItemMeta } from './data'

export interface AndroidParts { body: ItemMeta; head: ItemMeta; worn: ItemMeta[] }

// 캐릭터 옆에 세우는 자리(게임 px, 캐릭터의 발 기준) — **늘 오른쪽**(시선과 상관없이), 발 줄은 캐릭터와 같다(같은 바닥에 서 있다 — 사용자 지시).
// 그리기가 시선 반전(flip)으로 캔버스를 통째로 뒤집으므로, 반전될 때는 부르는 쪽이 -ANDROID_DX 를 넘긴다(androidDx)
export const ANDROID_DX = 60
export const androidDx = (flip: boolean) => (flip ? -ANDROID_DX : ANDROID_DX)

// 받은 부위(같은 외형은 한 번만 받는다). CDN 에 없는 부위(이름 없는 안드로이드 전용 장식 등)는 빼고 그린다 — 못 받았다고 안드로이드를 비우지 않는다
const partsCache = new Map<string, Promise<AndroidParts | null>>()
export const androidKey = (look: AndroidLook) => JSON.stringify(look)
// 피부 톤은 몸 0000 2xxx 와 머리 0001 2xxx 가 한 쌍이다(parser ARCHITECTURE '피부 톤') — 원본의 피부 id(2003)가 곧 몸 id 다
export function loadAndroidParts(look: AndroidLook): Promise<AndroidParts | null> {
  const key = androidKey(look)
  let p = partsCache.get(key)
  if (!p) {
    p = Promise.all([loadMeta(String(look.skin).padStart(8, '0')), loadMeta(String(look.skin + 10000).padStart(8, '0')), ...[look.hair, look.face, ...look.items].map((id) => loadMeta(id).catch(() => null))])
      .then(([body, head, ...worn]) => ({ body: body!, head: head!, worn: worn.filter((m): m is ItemMeta => !!m) }))
      .catch(() => { partsCache.delete(key); return null })
    partsCache.set(key, p)
  }
  return p
}

// 안드로이드 하나의 조립 입력 — 부위 카드는 이것을 캐릭터처럼 그대로 쓴다(그 카드의 주인공이 안드로이드다)
export function androidInputs(parts: AndroidParts, view: ViewOpts, fi?: number): AssembleInput[] {
  const back = isBackFrame(parts.body, view, fi)
  return [
    { itemId: parts.body.id, slot: 'body', vslot: null, layers: getFrameLayers(parts.body, view, fi) },
    { itemId: parts.head.id, slot: 'head', vslot: null, layers: getFrameLayers(parts.head, view, fi ?? 0, back) },
    ...parts.worn.map((m) => ({ itemId: m.id, slot: m.slot, vslot: m.vslot ?? null, layers: getFrameLayers(m, view, fi, back), invisibleFace: m.invisibleFace, name: m.name })),
  ]
}

// 캐릭터 옆에 세울 레이어. 발을 stand1 기준에 고정하고(캐릭터와 같은 보정 — 몸통만 숨 쉰다) (dx, dy) 만큼 옮긴다.
// slot 은 'android' — 그리기가 캐릭터의 몸(slot 'body')으로 착각하지 않게(가운데 맞추기 · 바닥 · 명찰 자리). 캐릭터보다 먼저(뒤에) 그린다.
export function androidPlaced(parts: AndroidParts, view: ViewOpts, fi: number | undefined, zmap: string[], smap: Record<string, string>, dx: number, dy = 0): PlacedLayer[] {
  const { placed } = assemble(androidInputs(parts, view, fi), zmap, smap)
  const ref = parts.body.frames['stand1']?.[0]?.layers?.find((l) => l.name === 'body')?.map?.navel
  const cur = placed.find((p) => p.slot === 'body' && p.name === 'body')?.map?.navel
  const sx = dx + (ref && cur ? cur.x - ref.x : 0), sy = dy + (ref && cur ? cur.y - ref.y : 0)
  return placed.map((p) => ({ ...p, slot: 'android', x: p.x + sx, y: p.y + sy }))
}

// 안드로이드가 서는 자세 — 캐릭터의 동작을 따르되 무기가 없어 한손 자세다. 캐릭터가 앉아 있으면(의자 · 라이딩) 안드로이드는 선다
export const androidView = (v: ViewOpts, seated: boolean): ViewOpts => {
  const a = seated ? 'stand1' : v.action === 'stand2' ? 'stand1' : v.action === 'walk2' ? 'walk1' : v.action
  return { ...v, action: a, expression: 'default', weaponMotion: 'basic' }
}
