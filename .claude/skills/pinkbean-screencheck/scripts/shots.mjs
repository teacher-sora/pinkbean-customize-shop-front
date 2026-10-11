// 핑크빈 커마샵 폭별 캡처 — PC / 절반 / 태블릿(터치) / 모바일(터치)
//   node shots.mjs <url> [--tab=plaza] [--out=<dir>] [--only=mobile,pc] [--wait=2500] [--click="표정"]
// 태블릿·모바일은 hasTouch 로 (pointer:coarse) 를 만들어야 useBreakpoint 가 제대로 잡힌다.
// CDN 은 localhost(80)·dev·운영 출처만 허용한다. 다른 포트의 로컬 서버에서도 아이템이 뜨도록 CDN 응답에 허용 헤더를 끼워 준다.

import { chromium, devices } from 'playwright'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const args = process.argv.slice(2)
const url = args.find((a) => !a.startsWith('--')) || 'https://dev.pinkbean-customize.com'
const opt = (k, d) => (args.find((a) => a.startsWith(`--${k}=`)) || `=${d}`).split('=').slice(1).join('=')
const outDir = opt('out', join(process.env.TEMP || tmpdir(), 'pb-shots'))
const wait = Number(opt('wait', 2500))
const tab = opt('tab', '')
const only = opt('only', '').split(',').filter(Boolean)
const click = opt('click', '') // 찍기 전에 누를 버튼(aria-label 또는 글자) — 팝오버·시트를 연 모습을 찍을 때

const MODES = [
  { name: 'pc', width: 1440, height: 900, touch: false },
  { name: 'half', width: 860, height: 900, touch: false },
  { name: 'tablet', width: 1000, height: 1280, touch: true },
  { name: 'mobile', width: 390, height: 844, touch: true },
]

mkdirSync(outDir, { recursive: true })
const browser = await chromium.launch()

for (const m of MODES) {
  if (only.length && !only.includes(m.name)) continue
  const ctx = await browser.newContext({
    viewport: { width: m.width, height: m.height },
    deviceScaleFactor: 2,
    hasTouch: m.touch,
    isMobile: m.touch,
    locale: 'ko-KR',
    userAgent: m.touch ? devices['Pixel 7'].userAgent : undefined,
  })
  const page = await ctx.newPage()
  // CDN CORS 뚫기(로컬 확인용). dev·운영 도메인에서는 원래 열려 있어 그대로 지나간다.
  await page.route('https://cdn.pinkbean-customize.com/**', async (route) => {
    try {
      const r = await route.fetch()
      await route.fulfill({ response: r, headers: { ...r.headers(), 'access-control-allow-origin': '*' } })
    } catch { await route.abort().catch(() => {}) }
  })
  await page.goto(url, { waitUntil: 'networkidle' }).catch(() => page.goto(url))
  // 탭 전환(코디 광장 등) — 하단 탭 버튼 이름으로 누른다.
  if (tab) {
    const label = { plaza: '코디 광장', ai: 'AI 코디 검색', look: '코디', notice: '공지' }[tab] || tab
    await page.getByRole('button', { name: label }).first().click().catch(() => {})
  }
  await page.waitForTimeout(wait)
  if (click) {
    await page.evaluate((t) => {
      const b = [...document.querySelectorAll('button')].find((x) => (x.getAttribute('aria-label') || '') === t || x.textContent.trim() === t)
      if (b) b.click()
    }, click).catch(() => {})
    await page.waitForTimeout(wait)
  }
  const file = join(outDir, `${m.name}.png`)
  await page.screenshot({ path: file })
  console.log(`${m.name.padEnd(7)} ${m.width}x${m.height}${m.touch ? ' touch' : ''}  ${file}`)
  await ctx.close()
}

await browser.close()
console.log(`\n캡처 폴더: ${outDir}`)
