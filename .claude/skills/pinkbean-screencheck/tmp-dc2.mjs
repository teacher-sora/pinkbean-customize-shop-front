import { chromium, devices } from 'playwright'
const b = await chromium.launch({ executablePath: process.env.PW_EXE })
const ctx = await b.newContext({ ...devices['iPhone 13 Pro'] })
const p = await ctx.newPage(); await p.route('**/*.supabase.co/auth/**', (r) => r.abort())
await p.goto(process.env.URL, { waitUntil: 'networkidle' })
await p.getByRole('button', { name: '헤어', exact: true }).first().tap(); await p.waitForTimeout(1500)
await p.locator('button[aria-label^="코디 룩북"]').first().tap(); await p.waitForTimeout(3000)
const cdp = await ctx.newCDPSession(p)
const touch = async (x, y, dy) => {
  const pt = (yy) => [{ x, y: yy, id: 1, radiusX: 5, radiusY: 5, force: 1 }]
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pt(y) })
  for (let k = 1; k <= 4; k++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pt(y + dy * k / 4) }); await p.waitForTimeout(16) }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
}
const open = () => p.evaluate(() => !!document.querySelector('[role=dialog]'))
for (const [which, dy] of [['x', 0], ['x', 5], ['x', 10], ['x', 14], ['foot', 10], ['foot', 14]]) {
  await p.locator('button[aria-label="이 염색으로 염색 창 열기"]').first().tap(); await p.waitForTimeout(700)
  const sel = which === 'x' ? '[role=dialog] button[aria-label="닫기"]' : '[role=dialog] [data-sheet-foot] button'
  const bb = await p.locator(sel).first().boundingBox()
  await touch(bb.x + bb.width / 2, bb.y + bb.height / 2, dy); await p.waitForTimeout(700)
  const still = await open()
  console.log(`${which} 손가락 ${dy}px 밀림 → ${still ? '무시됨(열림 그대로)' : '닫힘'}`)
  if (still) { await p.locator('[role=dialog] button[aria-label="닫기"]').tap(); await p.waitForTimeout(700) }
}
await b.close()
