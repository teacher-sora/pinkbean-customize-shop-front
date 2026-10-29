import fs from 'node:fs'
import { chromium, devices } from 'playwright'
const [W, H, DPR, TAG] = process.argv.slice(2); const OUT = process.env.OUT
const posts = fs.readFileSync(process.env.POSTS, 'utf8')
const b = await chromium.launch({ executablePath: process.env.PW_EXE })
const ctx = await b.newContext({ viewport: { width: +W, height: +H }, deviceScaleFactor: +DPR, isMobile: true, hasTouch: true, userAgent: devices['iPhone 13 Pro'].userAgent })
const p = await ctx.newPage()
await p.route('**/*.supabase.co/auth/**', (r) => r.abort())
await p.route('**/api/plaza/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: posts }))
const errs = []; p.on('pageerror', (e) => errs.push(e.message))
const shot = async (n) => { await p.waitForTimeout(1800); await p.screenshot({ path: `${OUT}/${TAG}-${n}.png` }) }
const targets = (sel) => p.evaluate((sel) => {
  const card = [...document.querySelectorAll(sel)].find((c) => c.getBoundingClientRect().width > 0 && c.getBoundingClientRect().top > 0)
  if (!card) return '카드 없음'
  return [...card.querySelectorAll('button, input, [role=button]')].filter((e) => e.getBoundingClientRect().width).map((e) => `${(e.getAttribute('aria-label') || e.textContent || e.tagName).trim().slice(0, 8)} ${Math.round(e.getBoundingClientRect().width)}×${Math.round(e.getBoundingClientRect().height)}`).join(' | ')
}, sel)
const tab = (t) => p.locator('nav[aria-label="메뉴"] button', { hasText: t }).click()
const cat = (t) => p.getByRole('button', { name: t, exact: true }).first().click()
await p.goto('https://dev.pinkbean-customize.com/', { waitUntil: 'networkidle' })
await shot('01-codi-all'); console.log('목록 카드', await targets('.pb-card'))
for (const [k, c] of [['02', '헤어'], ['03', '피부'], ['04', '모자'], ['05', '한벌옷']]) { await cat(c).catch(() => {}); await shot(`${k}-codi-${c}`) }
await p.getByRole('button', { name: /보기 설정/ }).first().click(); await p.waitForTimeout(500); await shot('06-view-pop')
await p.getByRole('button', { name: '아이템', exact: true }).first().click().catch(() => {}); await p.keyboard.press('Escape'); await p.mouse.click(5, 5); await shot('07-codi-item-mode')
await p.getByRole('button', { name: /보기 설정/ }).first().click(); await p.getByRole('button', { name: '내 캐릭터', exact: true }).first().click().catch(() => {}); await p.mouse.click(5, 5); await shot('08-codi-my-mode')
await tab('AI'); await p.waitForTimeout(800); const q = p.locator('input').first(); await q.fill('동물 귀'); await q.press('Enter'); await p.waitForTimeout(3000); await shot('09-ai')
await tab('코디'); await p.waitForTimeout(800); await p.locator('button[aria-label^="코디 룩북"]').first().click(); await shot('10-lookbook'); console.log('룩북 카드', await targets('.pb-presetwrap'))
await tab('프리셋'); await shot('11-preset'); console.log('프리셋 카드', await targets('.pb-presetwrap'))
await p.locator('button[title*="세로"], button[aria-label*="세로"]').first().click().catch(() => {}); await shot('12-preset-y')
await tab('광장'); await shot('13-plaza-free'); console.log('광장 카드', await targets('.pb-presetwrap'))
await p.getByRole('button', { name: '블아 대회', exact: true }).first().click().catch(() => {}); await shot('14-plaza-contest')
await p.getByRole('button', { name: '코디 룩북', exact: true }).first().click().catch(() => {}); await shot('15-plaza-lookbook')
console.log('오류', errs.length, errs.slice(0, 2).join(' | '))
await b.close()
