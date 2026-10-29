import { chromium, devices } from 'playwright'
const b = await chromium.launch({ executablePath: process.env.PW_EXE })
const ctx = await b.newContext({ ...devices['iPhone 13 Pro'] })
const p = await ctx.newPage(); await p.route('**/*.supabase.co/auth/**', (r) => r.abort())
await p.goto(process.env.URL, { waitUntil: 'networkidle' })
await p.getByRole('button', { name: '헤어', exact: true }).first().tap(); await p.waitForTimeout(1500)
await p.locator('button[aria-label^="코디 룩북"]').first().tap(); await p.waitForTimeout(3000)
await p.evaluate(() => { window.__ev = []; for (const t of ['touchstart', 'touchend', 'pointerup', 'click']) window.addEventListener(t, (e) => window.__ev.push(t + (t === 'click' ? (e.defaultPrevented ? '(막힘)' : '') : '')), true) })
const cdp = await ctx.newCDPSession(p)
const touch = async (x, y, ys) => {
  const pt = (yy) => [{ x, y: yy, id: 1, radiusX: 5, radiusY: 5, force: 1 }]
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pt(y) })
  for (const d of ys) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pt(y + d) }); await p.waitForTimeout(16) }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
}
for (const ys of [[2, 4], [9, 12], [9, 12, 20], [10, 30]]) {
  await p.locator('button[aria-label="이 염색으로 염색 창 열기"]').first().tap(); await p.waitForTimeout(800)
  await p.evaluate(() => { window.__ev = [] })
  const bb = await p.locator('[role=dialog] button[aria-label="닫기"]').first().boundingBox()
  await touch(bb.x + bb.width / 2, bb.y + bb.height / 2, ys); await p.waitForTimeout(800)
  const still = await p.evaluate(() => !!document.querySelector('[role=dialog]') && !document.querySelector('[class*="overlayHidden"]'))
  console.log(`밀림 ${ys.join('→')}px: ${still ? '무시됨' : '닫힘'}  이벤트 ${await p.evaluate(() => window.__ev.join(' '))}`)
  if (still) { await p.locator('[role=dialog] button[aria-label="닫기"]').tap(); await p.waitForTimeout(800) }
}
await b.close()
