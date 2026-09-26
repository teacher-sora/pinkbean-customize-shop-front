// Cap/head occlusion via vslot + smap (Phase 2 A1).
//
// 착용한 모자의 `vslot` = 그 모자가 **덮는** 자리 코드 목록. 어떤 레이어는 자기 자리 코드가 거기 들어 있으면 숨는다.
//   crown   vslot "Cp"                  -> 덮는 게 없다(헤어 그대로)
//   cap     vslot "CpH1H5"              -> 앞머리(H1)·윗머리(H5) 숨김, 나머지 헤어는 유지
//   helmet  vslot "CpHdH1..AfAyAsAe"    -> 머리·얼굴·장식까지 숨김(인형탈·투구)
//
// ⚠️ **레이어의 자리 코드는 z 이름만으로 정해지지 않는다**(2026-09-26 건의 — "모자를 쓰면 뿔테/래빗 포인트/
//    캣 포인트 동글이 안경이 안 보인다"). smap 은 z → 자리 코드 목록인데, `accessoryOverHair` 처럼
//    **여러 부위가 함께 쓰는 z** 는 목록이 `Cp Hd H1..H6 Hs Hf Hb Af Ay As Ae` 로 길다. 즉 그 z 하나만 보고는
//    "이 그림이 모자 자리인지 눈장식 자리인지" 알 수 없다 — **어느 아이템의 레이어인가**가 함께 있어야 정해진다.
//    예전 코드는 목록의 **첫 코드**(`Cp`)를 썼다. 그래서 눈장식이 `Cp` 로 판정돼, 모자를 쓰기만 하면
//    (모든 모자 vslot 이 `Cp` 로 시작한다) 안경이 통째로 사라졌다.
//    실측(전수, 2026-09-26): 이렇게 사라지던 아이템 26개 — 눈장식 196개 중 19개(위 3종 + 가면·레이스류),
//    얼굴장식 479개 중 6개(카튼 수염 3종 등), 귀고리 143개 중 1개(할로윈로이드 센서).
//  → **자기 부위 코드가 그 z 의 목록에 있으면 그것으로 판정한다.** 없을 때만 첫 코드로 돌아간다
//    (헤어처럼 z 가 자리를 더 잘게 쪼개는 경우 — `hairOverHead`=H5 에는 'Hr' 이 없다).
//    이러면 인형탈·투구(vslot 에 Ay·Af·Ae 를 담은 모자 125·122·305개)는 **그대로 가리고**,
//    평범한 모자(Cp+H*)만 장식을 살린다.
import type { Index } from './data'

export interface Equipped { id: string; slot: string; vslot: string | null }

// 부위 → 그 부위의 자리 코드(2자). data.ts 의 BASE_ISLOT 과 같은 표에 베이스(몸·머리)까지 더한 것.
// ⚠️ 여기 없는 부위는 종전대로 z 의 첫 코드로 판정된다(동작 변화 없음).
const SLOT_CODE: Record<string, string> = {
  body: 'Bd', head: 'Hd', hair: 'Hr', face: 'Fc', cap: 'Cp',
  faceAcc: 'Af', eyeAcc: 'Ay', earring: 'Ae',
  coat: 'Ma', longcoat: 'Ma', pants: 'Pn', shoes: 'So', glove: 'Gv',
  cape: 'Sr', weapon: 'Wp', shield: 'Si',
}

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
    const codes = parseCodes(smap[z] || '')
    if (!codes.length) return true
    // 자기 부위 코드가 그 z 의 목록에 있으면 그것이 이 레이어의 자리다(공유 z 구분). 없으면 첫 코드.
    const own = SLOT_CODE[slot]
    const code = own && codes.includes(own) ? own : codes[0]
    return !covered.has(code)
  }
}
