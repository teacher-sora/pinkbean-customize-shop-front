// 착용 전 워밍: 아이템을 입었을 때 미리보기가 기다리는 것(메타 JSON · 이펙트 메타 · 현재 연출 기준 첫 프레임 스프라이트 ·
// 헤어/성형 발색 변이)을 미리 받아 캐시에 올려 둔다. 모든 로더가 id/경로 캐시라 여러 번 불러도 요청은 한 번뿐.
// 실제 착용 순간엔 네트워크 대기 없이 바로 합성된다(액션·표정 프리페치와 같은 방식).

import { getFrameLayers, type ViewOpts } from './assemble'
import { loadEffect, loadEffectIndex, loadMeta, type ListItem } from './data'
import { preloadPaletteVariant, type PaletteParams } from './dye'
import { loadImage } from './render'

const warmed = new Set<string>()

export function warmItem(item: ListItem, view: ViewOpts, palette?: PaletteParams): Promise<void> {
  const key = `${item.id}|${view.action}|${view.expression}|${view.ear}|${view.weaponMotion}|${palette ? JSON.stringify(palette) : ''}`
  if (warmed.has(key)) return Promise.resolve()
  warmed.add(key)
  return (async () => {
    const [meta, eidx] = await Promise.all([loadMeta(item.id), loadEffectIndex()])
    const jobs: Promise<unknown>[] = getFrameLayers(meta, view, 0).map((l) => loadImage(l.png, true).catch(() => null))
    if (palette) preloadPaletteVariant(meta, palette, view)
    if (eidx.has(String(parseInt(item.id, 10)))) {
      jobs.push(loadEffect(item.id).then((em) => {
        if (!em) return
        return Promise.all(Object.values(em.groups).map((g) => (g.frames[0] ? loadImage(g.frames[0].png, true).catch(() => null) : null)))
      }))
    }
    await Promise.all(jobs)
  })().catch(() => { warmed.delete(key) })
}
