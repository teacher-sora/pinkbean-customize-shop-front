// Pure character assembly. Single source of truth shared by the main canvas and
// the list thumbnails. Validated against the ground-truth render.
//
// Generalized to (action, frame) via getFrameLayers, plus cap/head
// occlusion. Anchor math unchanged:
//  - body `navel` is the root at world (0,0); a layer aligns by a shared named
//    map point: topLeft = worldAnchor - (origin + map[anchor]); it then
//    contributes its other map points so later parts attach.
//  - Paint order follows zmap: higher index = further back -> draw first.
import type { Illusion, ItemMeta, Layer, Vec, Index, Frame } from './data'
import { MODEL_REF } from './modelPlacement'
import { buildVisibility, type Equipped } from './occlusion'

export interface PlacedLayer extends Layer {
  x: number
  y: number
  itemId: string
  slot: string
  tintable: boolean
  scale?: number // 일루전으로 키운 레이어의 배율(그리기가 nearest 로 키운다). x, y 는 키운 그림의 왼쪽 위
}

export interface AssembleInput {
  itemId: string
  slot: string
  vslot: string | null
  layers: Layer[]
  invisibleFace?: number   // an equipped invisibleFace accessory hides the 성형(face)
  name?: string | null     // 투명(투명 시리즈) 판별용 — 투명 아이템은 아무것도 안 그리므로 가림에서 제외
  // 점 위치 커스터마이즈(사소한 변경점/쩜): 레이어 이름(accessoryEye/accessoryEye2)별 월드 오프셋.
  // 그 레이어의 그림 위치만 이동시킨다(앵커 발행에는 영향 없음). 지정 안 하면 원본 위치 그대로.
  dotOffsets?: Record<string, Vec>
}

// 투명 시리즈(투명 모자/얼굴장식/장갑…)는 스프라이트가 비어 아무것도 안 그리는데, vslot(가림)만 남으면
// 밑의 헤어/얼굴이 사라지는 구멍이 생긴다 → 이런 아이템은 occlusion/face-hide 에서 제외한다.
// ⚠️ '반투명'도 '투명'을 포함하지만 동작이 반대다(투명=부위 비움 / 반투명=그 부위의 일반 장비를 대신 노출).
// 반투명은 카탈로그에 없고 닉네임 임포트(api/nick)에서 일반 장비로 치환돼 여기까진 안 오지만, 만일에 대비해 배제한다.
const isTransparent = (name?: string | null) => !!name && name.includes('투명') && !name.includes('반투명')

export interface ViewOpts {
  action: string            // effective action key (resolved: stand1/swingT1/shoot6/…)
  expression: string        // face expression key
  ear: string               // "humanEar"(일반) | "ear"(엘프) | "lefEar"(우든레프) | "highlefEar"(하이레프)
  weaponMotion?: string     // '기본'basic | 'one'한손 | 'two'두손 | 'gun'건 — picks the weapon's stance
}

// Weapons carry an appearance per weapon-type stance code. Pick the stance matching the
// selected 무기모션: 건→49, 두손→40번대, 한손→30번대, 기본→30번대(없으면 첫 스탠스).
function pickWeaponStance(stances: string[], wm?: string): string {
  const nums = stances.map(Number)
  const inRange = (lo: number, hi: number) => { const i = nums.findIndex((n) => n >= lo && n <= hi); return i >= 0 ? stances[i] : undefined }
  const gun = () => { const i = nums.indexOf(49); return i >= 0 ? stances[i] : undefined }
  if (wm === 'gun') return gun() ?? inRange(40, 48) ?? stances[0]
  if (wm === 'two') return inRange(40, 48) ?? stances[0]
  // 한손/기본
  return inRange(30, 39) ?? stances[0]
}

// 서기·걷기 자세는 **무기가 정한다**(예: 아란의 폴암 마하·청룡언월도).
// 두손 전용 무기(폴암·두손검 일부)는 stand2·walk2 프레임만 갖고 stand1·walk1 이 아예 없다. 몸을 stand1 로 그리면
// 무기는 아래 폴백으로 stand2 그림을 내놓아, 한 손을 내린 몸에 두 손 자세의 무기가 얹혀 어긋난다.
// 게임은 무기에 맞는 자세로 선다 → 몸의 액션을 무기가 가진 쪽으로 바꾼다. 무기가 그 자세를 갖고 있으면 그대로 둔다.
// 바뀌지 않으면 **받은 객체를 그대로** 돌려준다(useMemo 의존성이 흔들리지 않게).
const POSE_PAIR: Record<string, string> = { stand1: 'stand2', stand2: 'stand1', walk1: 'walk2', walk2: 'walk1' }
export function weaponPose(weapon: ItemMeta | null | undefined, opts: ViewOpts): ViewOpts {
  const alt = POSE_PAIR[opts.action]
  if (!weapon || weapon.slot !== 'weapon' || !alt) return opts
  const f = weapon.frames as Record<string, unknown>
  const pre = weapon.stances?.length ? pickWeaponStance(weapon.stances, opts.weaponMotion) + '/' : ''
  if (f[pre + opts.action]) return opts
  if (f[pre + alt]) return { ...opts, action: alt }
  // 서기·걷기 프레임이 아예 없는 무기(채집 도구 — 스패너·곡괭이·삽은 휘두르는 프레임뿐이다)는 그 무기가 가진
  // 공격 자세로 선다. 안 그러면 아래 폴백이 휘두르는 그림을 서 있는 몸에 얹는다. 공격 프레임도 없으면(이펙트뿐인 무기) 그대로.
  const own = POSE_FALLBACK.find((a) => f[pre + a])
  return own ? { ...opts, action: own } : opts
}
const POSE_FALLBACK = ['alert', 'swingO1', 'swingT1', 'swingP1', 'stabO1', 'stabT1', 'shoot1', 'swingO2', 'swingT2', 'swingP2', 'stabO2', 'stabT2', 'shoot2', 'swingO3', 'swingT3', 'swingOF', 'swingTF', 'swingPF', 'stabOF', 'stabTF', 'shootF']

const TINTABLE_SLOTS = new Set(['hair', 'longcoat'])
// Climbing actions face away from the camera — show the back of the head, hide the face.
const BACK_ACTIONS = new Set(['ladder', 'rope'])
// Prone body actions: head-attached items (일부 헤어) carry a dedicated 'prone' frame with
// 엎드림 전용 스프라이트. Use it for these so the hair lies down instead of staying upright.
const PRONE_ACTIONS = new Set(['prone', 'proneStab'])
// The base body's shoot6(총 사격) is an action-ref to shootF; cosmetics usually only carry
// shootF. So when an item lacks the exact action, try this alternate BEFORE falling to stand
// (otherwise the clothing stands while the body shoots → 스프라이트가 어긋남).
const ACTION_FALLBACK: Record<string, string> = { shoot6: 'shootF' }

// Normalize a frames entry to Frame[] (tolerate legacy Layer[] from pre-animation data).
function normFrames(v: any): Frame[] {
  if (!v || !v.length) return []
  return v[0].layers ? (v as Frame[]) : [{ delay: 120, layers: v as Layer[] }]
}

// ── 뒷모습은 액션 단위가 아니라 **프레임 단위**도 있다 ──
// 두손 스윙(마무리) 0번과 한손 스윙(마무리) 1번은 한 프레임만 뒤를 보는 포즈다. 근거(실측):
//  · 베이스 몸의 그 프레임 z 가 `backBody`(zmap 140) — 사다리·밧줄 프레임과 **같은** 값이다.
//  · 한벌옷(금단의 계약)도 그 프레임만 `mail` 이 `backPants` — 역시 사다리·밧줄과 같다.
//    원본 데이터가 "이 프레임은 뒷모습"이라고 말하고 있는 셈이다.
// 그런데 머리·헤어는 **액션 이름만** 보고 앞모습 프레임을 썼다 → 긴 헤어의 `hairBelowBody`(103)가
// `backBody`(140)보다 앞이라 **몸·다리·옷이 통째로 가려져** 머리만 떠 있었다.
// 사다리·밧줄은 액션 전체가 뒷모습이라 BACK_ACTIONS 로 이미 처리되고 있었고, 이 두 프레임만 빠져 있었다.
// 판단은 **베이스 몸의 그 프레임 z** 하나로만 한다 — 액션 이름 목록을 따로 두면 패치로 액션이 늘 때 또 빠진다.
// 부위의 기본 z(zmap 이름). z 가 정수로 들어온 레이어를 이 자리에 그린다(zOf).
// 모자는 `cap` 이 아니라 `capOverHair` 다 — `cap`(45)은 헤어 윗부분 `hairOverHead`(42)보다 뒤라, 헤어 윗부분(H1)을 가리지 않는
// 모자(아메지스트 바니 vslot CpH5)는 귀가 헤어 뒤로 숨는다. 게임에서는 헤어 위에 보인다.
const SLOT_Z: Record<string, string> = {
  cap: 'capOverHair', hair: 'hair', face: 'face', faceAcc: 'accessoryFace', eyeAcc: 'accessoryEye', earring: 'accessoryEar',
  coat: 'mailChest', longcoat: 'mailChest', pants: 'pants', shoes: 'shoes', glove: 'glove', cape: 'cape', weapon: 'weapon', shield: 'shield',
}
const isBackBody =(fr: Frame | undefined) => !!fr?.layers.some((l) => l.name === 'body' && l.z.startsWith('back'))
export function isBackFrame(bodyMeta: ItemMeta, opts: ViewOpts, i = 0): boolean {
  const seq = getFrameSeq(bodyMeta, opts)
  return isBackBody(seq[Math.min(i, seq.length - 1)])
}
// 이 뷰의 프레임 중 **하나라도** 뒷모습이면 true. 염색 override 를 만들 때 쓴다 — 그 프레임에서만 쓰이는
// '뒷' 스프라이트까지 미리 칠해 둬야 한 프레임만 원본색으로 번쩍이지 않는다.
export const hasBackFrame = (bodyMeta: ItemMeta, opts: ViewOpts): boolean => getFrameSeq(bodyMeta, opts).some(isBackBody)

// Resolve the animation frame SEQUENCE for one item in the current view (key selection +
// head ear-filter + face/back hide). Returns [] when the item shows nothing (e.g. face on back).
// backFrame: 이 프레임만 뒷모습(isBackFrame) — 액션 이름은 앞모습이어도 뒤로 취급한다.
export function getFrameSeq(meta: ItemMeta, opts: ViewOpts, backFrame = false): Frame[] {
  const f = meta.frames as Record<string, any>
  const keys = Object.keys(f)
  const back = BACK_ACTIONS.has(opts.action) || backFrame
  // Weapon: pick the stance for 무기모션, then the action within it, with graceful fallback.
  if (meta.slot === 'weapon' && meta.stances?.length) {
    const s = pickWeaponStance(meta.stances, opts.weaponMotion)
    const fb = ACTION_FALLBACK[opts.action]
    const cands = [`${s}/${opts.action}`, ...(fb ? [`${s}/${fb}`] : []), `${s}/stand1`, `${s}/stand2`]
    for (const k of cands) if (f[k]) return normFrames(f[k])
    const anyInStance = keys.find((k) => k.startsWith(s + '/'))
    if (anyInStance) return normFrames(f[anyInStance])
    const anyMatch = keys.find((k) => k.endsWith('/' + opts.action)) || keys[0]
    return anyMatch ? normFrames(f[anyMatch]) : []
  }
  let key: string
  if (meta.slot === 'face') {
    if (back) return [] // 뒷모습에서는 얼굴을 그리지 않음
    key = f[opts.expression] ? opts.expression : f['default'] ? 'default' : keys[0]
  } else if (meta.slot === 'head') {
    key = back && (f[opts.action] || f['back']) ? (f[opts.action] ? opts.action : 'back') : f['front'] ? 'front' : keys[0]
  } else if (f['base']) {
    // head-attached non-face (hair/cap/accessories).
    // 그 액션의 프레임이 따로 있으면 그것이 우선이다(트리 모자·초밥 모자).
    // 모자 약 130개는 서기·걷기·공격마다 그림이나 위치가 base(=원본 default)와 다르다: 트리 모자는 default 의
    // origin 이 얼굴 높이라 base 로 그리면 얼굴을 덮고, 초밥 모자는 default 가 빈 그림이라 아무것도 안 나온다.
    // 게임은 그 액션의 노드를 쓴다. 추출기가 base 와 다른 액션만 그 이름으로 넣어 두므로(extract.cjs frameSet),
    // 있으면 쓰고 없으면 아래 base/back 규칙 그대로다. 뒷모습 액션·프레임도 그 액션 프레임이 곧 뒷모습이다.
    const afb = ACTION_FALLBACK[opts.action]
    const own = f[opts.action] ? opts.action : (afb && f[afb]) ? afb : null
    if (own && own !== 'prone') return normFrames(f[own])
    // 등반 시엔 뒷프레임만 — 없으면 숨김.
    if (back) return f['back'] ? normFrames(f['back']) : []
    // 엎드리기: prone 전용 프레임이 있으면 그걸 사용(엎드림 헤어). 없으면 서기(base)로 폴백.
    key = (PRONE_ACTIONS.has(opts.action) && f['prone']) ? 'prone' : 'base'
  } else { // body-attached: exact action → fallback(shoot6→shootF) → stand
    const fb = ACTION_FALLBACK[opts.action]
    key = f[opts.action] ? opts.action : (fb && f[fb]) ? fb : f['stand1'] ? 'stand1' : keys[0]
  }

  let seq = key != null ? normFrames(f[key]) : []
  // 안전망(파서 버그 보정): 재추출로 고친 헤어는 base 에 prone 레이어가 없어 no-op. 아직 안 고친
  // 오염 메타(원본 WZ가 엎드림 스프라이트를 서기 노드에 형제로 담아 'base'에 섞여 들어간 경우)는
  // 여기서 prone 레이어를 걸러 서기+엎드림 겹침을 방지한다. (prone 프레임 선택 시에는 걸러지지 않음.)
  if (key === 'base') seq = seq.map((fr) => ({ delay: fr.delay, layers: fr.layers.filter((l) => !/prone/i.test(l.name)) }))
  if (meta.slot === 'head') seq = seq.map((fr) => ({ delay: fr.delay, layers: fr.layers.filter((l) => l.name === 'head' || l.name === opts.ear) }))
  return seq
}

// Layers of animation frame `i` (clamped to the item's own length). Default 0 = static
// (thumbnails / non-animated contexts). The animator passes the current frame index.
// 앵커 map 이 비어 있는 레이어를 같은 아이템의 다른 프레임에서 채운다.
// assemble 은 map 의 앵커 이름으로만 위치를 잡으므로(아래 참고), map 이 {} 면 그 레이어는 영원히 배치되지 못하고
// 조용히 사라진다. 원본 WZ 에 실제로 이런 결손이 있다(예: 00050075 들판 얼굴 (남) — 레이어 25개 중 default
// 하나만 map={}, 나머지 24개는 brow={0,0}). meta.json 은 WZ 를 충실히 옮긴 것이므로 렌더 쪽에서 견딘다.
// ⚠️ 빌려오는 건 map(앵커 오프셋)뿐이다. origin 은 프레임마다 다르므로 그 프레임 것을 그대로 쓴다.
// 전 프레임에 map 이 없으면 빌려올 게 없다 → 그대로 두고 assemble 이 버린다(추측으로 지어내지 않는다).
// ⚠️ root 표지가 붙은 레이어는 채우지 않는다 — 앵커가 없는 것이 결손이 아니라 "발 기준으로 놓는 그림"이라는 뜻이다
//    (초밥 모자 stand1: origin (20,80)). 다른 프레임의 brow 를 빌리면 눈썹에서 80 위로 날아간다.
function fillMissingMap(meta: ItemMeta, layers: Layer[]): Layer[] {
  if (!layers.some((l) => !l.root && (!l.map || !Object.keys(l.map).length))) return layers // 정상이면 원본 그대로(할당 없음)
  const donor = new Map<string, Layer['map']>()
  for (const seq of Object.values(meta.frames || {})) {
    for (const fr of (seq as { layers: Layer[] }[]) || []) {
      for (const l of fr.layers || []) {
        if (l.map && Object.keys(l.map).length && !donor.has(l.name)) donor.set(l.name, l.map)
      }
    }
  }
  return layers.map((l) => {
    if (l.root || (l.map && Object.keys(l.map).length) || !donor.has(l.name)) return l
    return { ...l, map: donor.get(l.name)! } // has() 로 확인 후라 non-null
  })
}

// 정지 화면(카드·프리셋·'기본' 액션)에서 머리부착 아이템의 액션 프레임 중 어느 것을 보여 줄지.
// 액션 프레임의 0번이 꼭 대표 그림은 아니다 — 눈을 깜빡이는 모자(핑크빈 모자)는 0번이 감은 눈이고, 빛나는 모자
// (글로잉 스마일캡)는 0번이 꺼진 그림이다. 원본의 default(=base)가 그 아이템의 대표 그림이므로, 액션 프레임 가운데
// **base 와 같은 그림을 쓰는 첫 프레임**을 고른다(추출기가 같은 그림은 base 의 png 경로를 가리키게 해 둔다).
// 없으면 0번이다(초밥 모자처럼 base 가 빈 그림인 경우).
function stillIndex(meta: ItemMeta, seq: Frame[]): number {
  if (seq.length < 2) return 0
  const f = meta.frames as Record<string, any>
  const pool = new Set<string>()
  for (const k of ['base', 'back']) for (const fr of normFrames(f[k])) for (const l of fr.layers) pool.add(l.png)
  if (!pool.size) return 0
  const k = seq.findIndex((fr) => fr.layers.length > 0 && fr.layers.every((l) => pool.has(l.png)))
  return k < 0 ? 0 : k
}

// 무기 프레임 안에 박힌 이펙트 레이어. 이름이 effect·effect1~3·effect2·effect_back·weaponEffect·'weapon eff' 로
// 여러 갈래라 'eff' 가 들어간 이름을 모두 이펙트로 본다(무기 본체 레이어 이름에는 'eff' 가 없다).
// 무기 이펙트를 끄면 ItemEff(별도 그림)와 함께 이 레이어도 빠져야 한다(예 책가방 속 러브레터: 하트가 effect2).
export const isWeaponEffectLayer = (name: string) => /eff/i.test(name)
export const dropWeaponEffects = <T extends { name: string }>(slot: string, layers: T[], wEffect: boolean): T[] =>
  slot === 'weapon' && !wEffect ? layers.filter((l) => !isWeaponEffectLayer(l.name)) : layers

// i 를 주지 않으면 **정지 화면**이다(대표 프레임, stillIndex). 애니메이션은 프레임 번호를 넘긴다.
export function getFrameLayers(meta: ItemMeta, opts: ViewOpts, i?: number, backFrame = false): Layer[] {
  const seq = getFrameSeq(meta, opts, backFrame)
  if (!seq.length) return []
  const still = i === undefined && meta.slot !== 'face' && meta.slot !== 'head' && meta.slot !== 'body' && !!(meta.frames as Record<string, unknown>)['base']
  return fillMissingMap(meta, seq[still ? stillIndex(meta, seq) : Math.min(i ?? 0, seq.length - 1)].layers)
}

// Number of animation frames for the current view (drives the master clock = base body).
export function frameCount(meta: ItemMeta, opts: ViewOpts): number {
  return getFrameSeq(meta, opts).length
}
// Per-frame delays (ms) for the current view — used to time the animation loop.
export function frameDelays(meta: ItemMeta, opts: ViewOpts): number[] {
  return getFrameSeq(meta, opts).map((fr) => fr.delay)
}

// 머리에 얹는 장식형 모자: **그림 레이어의 z 가 전부 정수**인 모자는 원본 vslot 과 상관없이 헤어를 아메지스트 바니(CpH5)만큼만 가린다.
// 근거(사용자 인게임 확인): 아메지스트 레이스(vslot CpH1H3H4H5H6HfHbHcAe)와 머리 위에 버섯 셋(CpH1H5)은 인게임에서 헤어 위에 얹히기만 한다.
// 같은 vslot 의 코지 윈터 햇 · 숲속의 마법사 모자 · 소금빵 고양이 모자 · 이덴/티스크 해달 모자는 긴머리 · 옆머리를 가린다 —
// 이들은 z 가 `cap` · `capOverHair` · `backCap` 같은 이름이고, 레이스 · 버섯 셋은 z 가 "0" 이다. 정수 z 모자 16개 가운데
// 13개는 원래 CpH5 라 그대로이고, 군단장 매그너스 탈은 본체 z 가 이름(capOverHair)이라 해당하지 않는다(머리를 덮는 탈이 맞다).
// 헤어가 아닌 자리(Ae 귀고리 등)와 머리(Hd)는 원본 그대로 둔다. WzComparerR2 는 원본 vslot 대로 가린다.
const isIntZ = (z: unknown) => /^-?\d+$/.test(String(z))
function capVslot(i: AssembleInput): string | null {
  const v = i.vslot
  if (!v || !i.layers.length || !i.layers.every((l) => isIntZ(l.z))) return v
  let out = ''
  for (let k = 0; k + 2 <= v.length; k += 2) { const c = v.slice(k, k + 2); if (c[0] !== 'H' || c === 'Hd') out += c }
  return out + 'H5'
}

export function assemble(
  items: AssembleInput[],
  zmap: Index['zmap'],
  smap: Index['smap'],
): { placed: PlacedLayer[]; anchors: Record<string, Vec> } {
  // 투명 아이템은 vslot 을 null 로 취급 → 헤어/얼굴을 가리지 않는다(안 그리는데 가리면 구멍 생김).
  const equipped: Equipped[] = items.map((i) => ({ id: i.itemId, slot: i.slot, vslot: isTransparent(i.name) ? null : i.slot === 'cap' ? capVslot(i) : i.vslot }))
  const isVisible = buildVisibility(equipped, smap)
  // an equipped invisibleFace accessory (e.g. 신비주의) hides the 성형(face) slot. 단, 투명 아이템은 제외.
  const hideFace = items.some((i) => i.invisibleFace && !isTransparent(i.name))

  const anchors: Record<string, Vec> = { navel: { x: 0, y: 0 } }
  type Pending = Layer & { itemId: string; slot: string; hidden: boolean; ox?: number; oy?: number }
  const remaining: Pending[] = []
  // ⚠️ 가림(occlusion)은 "그리지 않는 것"이지 "골격에서 빼는 것"이 아니다.
  // 숨긴 레이어도 자기 map 앵커(brow/neck/hand…)는 그대로 제공해야 한다.
  // 예: 탈(vslot 에 Hd)은 머리를 숨기는데, 탈 자신이 붙을 brow 앵커를 주는 게 바로 그 머리다.
  // 머리를 아예 빼버리면 brow 가 없어 탈이 앵커를 못 찾고 → 아래 폴백이 몸통 원점(허리)에 그려버린다.
  const marks: Layer[] = [] // 일루전 표지(그리지 않는다 — 아래 applyIllusion 이 읽는다)
  for (const it of items) {
    const faceHidden = hideFace && it.slot === 'face'
    for (const l of it.layers) {
      if (l.illusion) { marks.push(l); continue }
      // 귀(head 레이어 중 'head' 가 아닌 것 = 엘프/우든레프/하이레프 귀)는 모자 가림에서 예외 — 모자를 써도
      // 귀는 삐져나와 보여야 한다(그냥 모자 vslot 이 귀 z 까지 덮어 귀가 사라지던 이슈). 사람귀는 모자에 어차피 덮임.
      const isEar = it.slot === 'head' && l.name !== 'head'
      const off = it.dotOffsets?.[l.name]
      remaining.push({ ...l, itemId: it.itemId, slot: it.slot, hidden: faceHidden || (!isEar && !isVisible(it.slot, l.z)), ox: off?.x, oy: off?.y })
    }
  }

  const placed: PlacedLayer[] = []
  let progress = true
  while (remaining.length && progress) {
    progress = false
    for (let i = 0; i < remaining.length; i++) {
      const L = remaining[i]
      // Skip null-valued map points: some items (e.g. 카오스 크레센트) declare a
      // map key with no vector — reading L.map[n].x on it throws and crashes the
      // whole assemble (cell stuck on skeleton, click errors the main preview).
      const names = Object.keys(L.map || {}).filter((n) => L.map[n])
      const aname = names.find((n) => anchors[n])
      if (!aname) continue
      const aw = anchors[aname]
      const x = aw.x - (L.origin.x + L.map[aname].x)
      const y = aw.y - (L.origin.y + L.map[aname].y)
      // 점 위치 오프셋(있으면)은 "그림 위치"에만 더한다. 앵커 발행(아래)은 오프셋 없는 x,y 로 계산해
      // 다른 파츠의 골격이 흔들리지 않게 한다. (점 레이어는 brow 만 소비하고 새 앵커를 안 내므로 실무상 무해하나 명시.)
      if (!L.hidden) placed.push({ ...L, x: x + (L.ox || 0), y: y + (L.oy || 0), tintable: TINTABLE_SLOTS.has(L.slot) }) // 숨긴 건 안 그린다(앵커는 아래에서 제공)
      for (const n of names) {
        if (!anchors[n]) anchors[n] = { x: x + L.origin.x + L.map[n].x, y: y + L.origin.y + L.map[n].y }
      }
      remaining.splice(i, 1)
      i--
      progress = true
    }
  }

  // Layers still unplaced reference only an anchor nothing provides — chiefly the `handMove`-only
  // lHand (전투대기/치유) whose grip is normally supplied by a weapon. WcR2 places such a part's
  // ORIGIN at the skeleton root, which coincides with the body's origin point. Reproduce that so
  // the hand lands at the correct forward position (not clustered on rHand). Truly anchorless
  // layers (all map points null, e.g. 카오스 크레센트) have no valid map key and stay dropped.
  const bodyLayer = placed.find((p) => p.name === 'body')
  if (bodyLayer && remaining.length) {
    const rox = bodyLayer.x + bodyLayer.origin.x
    const roy = bodyLayer.y + bodyLayer.origin.y
    for (const L of remaining) {
      if (L.hidden) continue // 가려진 레이어는 폴백으로도 그리지 않는다
      // root 표지 레이어(앵커 없는 액션 프레임 그림)는 여기서 몸 원점에 놓인다 — 원본이 정한 자리다.
      if (!L.root && !Object.keys(L.map || {}).some((n) => L.map[n])) continue // no valid anchor at all → drop
      placed.push({ ...L, x: rox - L.origin.x, y: roy - L.origin.y, tintable: TINTABLE_SLOTS.has(L.slot) })
    }
  }

  const zIndex = (z: string) => {
    const i = zmap.indexOf(z)
    return i < 0 ? 9999 : i
  }
  // root 레이어의 z 는 zmap 이름이 아니라 정수일 수 있다(이펙트와 같은 규칙: 0 이상 = 캐릭터 앞, 음수 = 뒤).
  // root 가 아닌 레이어의 정수 z 는 zmap 에 없는 이름이라 그대로 두면 9999(맨 뒤)가 되어 아메지스트 레이스 · 바니(z "0"~"3")가
  // 헤어 뒤로 숨었다(같은 꼴: 모자 20개, 망토 6개 — 망토 쪽은 1x1 빈 그림이다). 자리는 이렇게 정한다:
  //  1) 레이어 이름이 zmap 이름이면 그것 — 군단장 매그너스 탈은 이름 `hairBelowBody`, z "0" 인 꼬리 머리가 있다(몸 뒤가 맞다).
  //  2) 아니면 그 부위의 기본 자리(SLOT_Z). 같은 부위 안에서는 숫자가 클수록 앞이다.
  // 형상 변이의 귀 · 뿔은 모자와 같은 자리(capOverHair)라 들어온 순서로 모자 위에 덮였다 — 같은 자리면 모자 바로 뒤에 둔다(+0.5).
  // 그래서 모자와 겹치는 부분은 모자가 덮고, 모자 밖으로 나온 부분만 보인다. 다른 자리의 부품(꼬리 등)은 그대로.
  const zOf = (p: PlacedLayer) => zOfRaw(p) + (p.slot === 'anima' && p.z === SLOT_Z.cap ? 0.5 : 0)
  const zOfRaw = (p: PlacedLayer) => {
    if (!/^-?\d+$/.test(String(p.z))) return zIndex(p.z)
    if (p.root) return Number(p.z) >= 0 ? -1 : 10000
    if (zmap.includes(p.name)) return zIndex(p.name)
    return zIndex(SLOT_Z[p.slot] ?? p.z) - Number(p.z) / 1000
  }
  placed.sort((a, b) => zOf(b) - zOf(a))
  // `anchors` holds every resolved named reference point (navel/neck/brow/hand/…) in
  // world coords (navel = 0,0). Item effects use it to pick their attach point by `pos`.
  return { placed: marks.length ? applyIllusion(placed, anchors, marks) : placed, anchors }
}

// ── 일루전(반지 부위의 일루전 링 · 이펙트 부위의 내 뒤에 나) ─────────────────────────────────────────────
// 원본에는 그림이 없고(변신만 그림이 있다) '어느 부위를 몇 배로'라는 값뿐이다 — 게임이 지금 캐릭터의 그림을 그 자리에서 키운다.
// 그래서 조립이 끝난 레이어를 키우거나 바꾼다. 미리보기 · 카드 · 프리셋 · 공유 그림이 모두 assemble 을 거치므로 한 곳이면 된다.
// 키운 레이어는 scale 을 달고(그리기가 nearest 로 키운다), 이펙트가 붙을 이마(anchors.brow)도 함께 옮긴다.
// 기준점은 원본에 없어 그림으로 맞췄다: 거대한 머리 = 목(neck), 거대한 몸 = 발(몸 그림의 origin), 내 뒤에 나 = 발.
const HEAD_SLOTS = new Set(['head', 'hair', 'face', 'cap', 'faceAcc', 'eyeAcc', 'earring'])
const BODY_SLOTS = new Set(['body', 'coat', 'longcoat', 'pants', 'shoes', 'glove', 'cape'])
const isHeadPart = (p: PlacedLayer) => HEAD_SLOTS.has(p.slot) || (p.slot === 'anima' && p.name !== 'Tail') // 형상 변이의 귀 · 뿔은 머리
const scaleAbout = (p: PlacedLayer, pv: Vec, s: number): PlacedLayer => ({ ...p, x: pv.x + (p.x - pv.x) * s, y: pv.y + (p.y - pv.y) * s, scale: (p.scale ?? 1) * s })
// 조립 입력에서 링의 일루전(내 뒤에 나 제외) — 이펙트를 그릴지(hideEffect) 정할 때 쓴다.
export const ringIllusion = (items: { layers: Layer[] }[]): Illusion | null =>
  items.flatMap((i) => i.layers).find((l) => l.illusion && l.illusion.kind !== 'clone')?.illusion ?? null
// 발(몸 그림의 origin)의 월드 좌표. 복제(slot 'clone')가 아닌 진짜 몸에서 잰다. 일루전으로 키운 몸은 origin 도 배율만큼 멀다.
export const footOf = (placed: PlacedLayer[]): Vec | null => {
  const b = placed.find((p) => p.slot === 'body' && p.name === 'body')
  const k = b?.scale ?? 1
  return b ? { x: b.x + b.origin.x * k, y: b.y + b.origin.y * k } : null
}
// 딛고 선 바닥의 월드 좌표 — 탈것을 탔으면 탈것의 origin(라이딩의 바닥), 아니면 발.
const groundOf = (placed: PlacedLayer[]): Vec | null => {
  const m = placed.find((p) => p.slot === 'riding' && p.name.startsWith('mount'))
  return m ? { x: m.x + m.origin.x * (m.scale ?? 1), y: m.y + m.origin.y * (m.scale ?? 1) } : footOf(placed)
}
function applyIllusion(placed: PlacedLayer[], anchors: Record<string, Vec>, marks: Layer[]): PlacedLayer[] {
  const foot = footOf(placed)
  if (!foot) return placed
  const ring = marks.find((m) => m.illusion!.kind !== 'clone')
  const clone = marks.find((m) => m.illusion!.kind === 'clone')
  let out = ring ? applyRing(placed, anchors, ring, foot) : placed
  // 내 뒤에 나는 링을 낀 모습(변신 · 거대한 몸 · 거대한 머리)을 그대로 복제한다(사용자 지시 — 링과 함께 써도 나온다).
  // 기준은 딛고 선 바닥(groundOf — 탈것이면 탈것의 바닥, 링이 몸을 옮겼으면 옮긴 발, 변신은 처음 발)이다.
  // 이 점을 기준으로 키우므로 복제의 발끝(탈것이면 탈것의 바닥)이 본체와 같은 줄에 선다(사용자 지시 — 모든 경우).
  if (clone) {
    const pv = groundOf(out) ?? foot, s = clone.illusion!.scale ?? 1, off = clone.illusion!.offset ?? { x: 0, y: 0 }
    const twin = out.map((p) => ({ ...scaleAbout(p, pv, s), x: pv.x + (p.x - pv.x) * s + off.x, y: pv.y + (p.y - pv.y) * s + off.y, slot: 'clone' }))
    out = [...twin, ...out]
  }
  return out
}
// 링 하나(거대한 머리 · 거대한 몸 · 변신)를 적용한다.
function applyRing(placed: PlacedLayer[], anchors: Record<string, Vec>, ring: Layer, foot: Vec): PlacedLayer[] {
  const spec = ring.illusion!
  const s = spec.scale ?? 1
  if (spec.kind === 'transform') return placed.filter((p) => p.slot === 'ring' || p.slot === 'riding')
  const noWeapon = spec.hideWeapon ? placed.filter((p) => p.slot !== 'weapon' && p.slot !== 'shield') : placed
  if (spec.kind === 'bigHead') {
    const pv = anchors.neck ?? anchors.brow ?? foot
    if (anchors.brow) anchors.brow = { x: pv.x + (anchors.brow.x - pv.x) * s, y: pv.y + (anchors.brow.y - pv.y) * s }
    return noWeapon.map((p) => (isHeadPart(p) ? scaleAbout(p, pv, s) : p))
  }
  // bigBody: 머리는 원래 크기로, 키운 목 자리로 옮긴다. headorigin(프레임마다, 표지의 origin)만큼 머리를 더 내린다 — 키운 몸의 목이 둥글게 커져 그대로 두면 머리가 떠 보인다.
  const neck = anchors.neck ?? foot
  const ho = ring.origin
  const d = { x: (neck.x - foot.x) * (s - 1) + ho.x, y: (neck.y - foot.y) * (s - 1) + ho.y }
  const grown = noWeapon.map((p) => (isHeadPart(p) ? { ...p, x: p.x + d.x, y: p.y + d.y } : BODY_SLOTS.has(p.slot) || p.slot === 'anima' ? scaleAbout(p, foot, s) : p))
  // 키운 모습의 가운데를 맨 모습의 가운데(MODEL_REF.center — 모든 캔버스가 이 점을 화면 가운데에 둔다)로 옮긴다(사용자 지시 — 몸통이 가운데).
  // 가로 = 발 기준으로 키운 몸통의 가운데, 세로 = 발과 (옮긴) 머리 꼭대기의 가운데 — 머리만 d 만큼 올라가므로 가운데는 d/2.
  const c = { x: MODEL_REF.centerDx, y: MODEL_REF.centerDy }
  const t = { x: c.x - (foot.x + (c.x - foot.x) * s), y: -d.y / 2 }
  if (anchors.brow) anchors.brow = { x: anchors.brow.x + d.x + t.x, y: anchors.brow.y + d.y + t.y }
  return grown.map((p) => ({ ...p, x: p.x + t.x, y: p.y + t.y }))
}
