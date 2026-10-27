// 착용 전 워밍: 아이템을 입었을 때 미리보기가 기다리는 것(메타 JSON · 이펙트 메타 · 현재 연출 기준 첫 프레임 스프라이트 ·
// 헤어/성형 발색 변이)을 미리 받아 캐시에 올려 둔다. 모든 로더가 id/경로 캐시라 여러 번 불러도 요청은 한 번뿐.
// 실제 착용 순간엔 네트워크 대기 없이 바로 합성된다(액션·표정 프리페치와 같은 방식).

import { frameDelays, getFrameLayers, weaponPose, type ViewOpts } from './assemble'
import { loadEffect, loadEffectIndex, loadMeta, type ItemMeta, type ListItem } from './data'
import { applyHsb, buildOverrides, loadDyeImage, preloadPaletteVariant, type DyeState, type PaletteParams } from './dye'
import { effectGroups, effectGroupsFor, loadImage } from './render'

const warmed = new Set<string>()

export function warmItem(item: ListItem, view: ViewOpts, palette?: PaletteParams): Promise<void> {
  const key = `${item.id}|${view.action}|${view.expression}|${view.ear}|${view.weaponMotion}|${palette ? JSON.stringify(palette) : ''}`
  if (warmed.has(key)) return Promise.resolve()
  warmed.add(key)
  return (async () => {
    const [meta, eidx] = await Promise.all([loadMeta(item.id), loadEffectIndex()])
    const jobs: Promise<unknown>[] = getFrameLayers(meta, view, 0).filter((l) => l.png).map((l) => loadImage(l.png, true).catch(() => null))
    if (palette) preloadPaletteVariant(meta, palette, view)
    if (eidx.has(String(parseInt(item.id, 10)))) {
      jobs.push(loadEffect(item.id).then((em) => {
        if (!em) return
        return Promise.all(effectGroups(em).map((g) => (g.frames[0] ? loadImage(g.frames[0].png, true).catch(() => null) : null)))
      }))
    }
    await Promise.all(jobs)
  })().catch(() => { warmed.delete(key) })
}

// 코디를 통째로 입기 전에(코디 룩북 [전부 입기] · 프리셋에 저장): 미리보기(PreviewModel)가 그 코디의 첫 그림에서 기다리는 것을 모두 받아 둔다.
// warmItem(첫 프레임만)으로는 모자랐다(사용자 지적 — 누른 뒤에야 그림을 받았다, 실측 PC 150ms · CPU 4배 450ms):
//  · 미리보기는 돌던 시계를 이어 가므로 첫 그림이 0번 프레임이 아닐 수 있다 → 그 동작의 **모든 프레임**(서기 3장 정도라 작다)과 정지 대표 그림
//  · 자세는 착용한 무기가 정한다(두손 무기 → stand2, assemble.weaponPose) — 무기 meta 를 받은 뒤 고른다
//  · 이펙트는 그 동작에서 도는 묶음의 모든 프레임(effectGroupsFor — 미리보기가 먼저 받는 것과 같다)
//  · 명찰 · 말풍선 · 칭호 · 훈장의 meta(ids 에 넣는다 — 미리보기는 착용 아이템의 meta 가 다 와야 그린다. 이것은 CDN 이 아니라 사이트의 /chatui/meta 라
//    요청마다 23 ~ 240ms 로 흔들렸고, 넥슨 표본 코디는 거의 다 명찰 · 말풍선 반지를 낀다 — 실측에서 마지막 대기가 이것이었다)와 틀 그림(chatUi atlas)
//  · dye = 염색까지 칠해 둔다(모든 프레임 — 미리보기의 1 · 2단계 염색과 같은 캐시). 무거우니 누르기 직전(상세가 열렸을 때)만 넘긴다
export async function warmLook(ids: string[], items: ListItem[], view: ViewOpts, dye?: DyeState): Promise<void> {
  const [metas, eidx] = await Promise.all([Promise.all(ids.map((id) => loadMeta(id).catch(() => null))), loadEffectIndex()])
  const ms = metas.filter((m): m is ItemMeta => !!m)
  const V = weaponPose(ms.find((m) => m.slot === 'weapon'), view)
  const body = ms.find((m) => m.slot === 'body')
  const n = Math.max(1, body ? frameDelays(body, V).length : 1)
  const jobs: Promise<unknown>[] = []
  const png = (p: string) => { if (p) jobs.push(loadImage(p, true).catch(() => null)) }
  for (const m of ms) {
    if (!m.frames) continue // 명찰 · 말풍선 · 칭호 · 훈장은 그림 레이어가 없다(meta 만 — 미리보기가 다 와야 그린다)
    for (let i = 0; i < n; i++) for (const l of getFrameLayers(m, V, i)) png(l.png)
    for (const l of getFrameLayers(m, V)) png(l.png)
  }
  for (const it of items) if (it.chatUi?.atlas) png(it.chatUi.atlas)
  const fx = items.filter((it) => eidx.has(String(parseInt(it.id, 10))))
  const ems = await Promise.all(fx.map((it) => loadEffect(it.id).then((em) => ({ it, em })).catch(() => null)))
  for (const e of ems) if (e?.em) for (const g of effectGroupsFor(e.em, V.action)) for (const fr of g.frames) png(fr.png)
  await Promise.all(jobs)
  if (!dye) return
  const dyeable = ms.filter((m) => m.slot !== 'body' && m.slot !== 'head')
  await buildOverrides(dyeable, dye, V, true).catch(() => null)
  for (const e of ems) {
    const h = e?.em && e.it.dyeMode !== 'none' ? dye.hsb[e.it.slot] : undefined
    if (!e?.em || !h || (!h.h && !h.s && !h.b)) continue
    for (const g of effectGroupsFor(e.em, V.action)) for (const fr of g.frames) {
      try { applyHsb(await loadDyeImage(fr.png), h, fr.png) } catch { /* 그 프레임만 원본 */ }
    }
  }
}
