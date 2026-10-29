import { chromium, devices } from 'playwright'
const b = await chromium.launch({ executablePath: process.env.PW_EXE })
for (const dev of ['iPhone 13 Pro', 'Pixel 7', 'iPhone SE']) {
const ctx = await b.newContext({ ...devices[dev] })
const p = await ctx.newPage(); await p.route('**/*.supabase.co/auth/**', (r) => r.abort())
await p.goto(process.env.URL, { waitUntil: 'networkidle' })
await p.getByRole('button', { name: '헤어', exact: true }).first().tap(); await p.waitForTimeout(1500)
await p.locator('button[aria-label^="코디 룩북"]').first().tap(); await p.waitForTimeout(3000)
for (const scroll of [0, 300, 'end']) {
  await p.evaluate((s) => window.scrollTo(0, s === 'end' ? document.documentElement.scrollHeight : s), scroll); await p.waitForTimeout(500)
  const a = p.locator('button[aria-label="이 염색으로 염색 창 열기"]').first()
  if (!(await a.isVisible())) { console.log(dev, scroll, '단추 안 보임'); continue }
  await a.tap(); await p.waitForTimeout(800)
  const r = await p.evaluate(() => {
    const hit = (sel) => { const e = document.querySelector(sel); if (!e) return '없음'; const b = e.getBoundingClientRect(); const h = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2); return e.contains(h) ? 'OK' : `가림:${h?.tagName}.${(h?.className || '').toString().slice(0, 40)} ${h?.closest('nav') ? '(nav)' : ''}` }
    const nav = document.querySelector('nav[aria-label="메뉴"]'); const nb = nav?.getBoundingClientRect()
    return { x: hit('[role=dialog] button[aria-label="닫기"]'), foot: hit('[role=dialog] [data-sheet-foot] button'), nav: nb ? `${Math.round(nb.top)}~${Math.round(nb.bottom)} z=${getComputedStyle(nav.closest('[class*="tabNav"]') || nav).zIndex}` : '-', vh: innerHeight }
  })
  console.log(dev, '스크롤', scroll, JSON.stringify(r))
  await p.locator('[role=dialog] button[aria-label="닫기"]').tap({ force: true }).catch(() => {}); await p.waitForTimeout(700)
}
await ctx.close()
}
await b.close()
