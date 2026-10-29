// Optional browser regression: set FLUX_PLAYWRIGHT_MODULE to an installed Playwright index.mjs.
// Serve the exported out/ directory at PORTFOLIO_TEST_URL (default http://127.0.0.1:4177).
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { pathToFileURL } from 'node:url'
const { chromium } = await import(process.env.FLUX_PLAYWRIGHT_MODULE ? pathToFileURL(process.env.FLUX_PLAYWRIGHT_MODULE).href : 'playwright')
const browser = await chromium.launch({
  headless: true, executablePath: process.env.FLUX_CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
})
const base = process.env.PORTFOLIO_TEST_URL || 'http://127.0.0.1:4177'
fs.mkdirSync('artifacts', { recursive: true })
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
await context.addInitScript(() => {
  localStorage.setItem('portfolio-language', 'en')
  localStorage.setItem('portfolio-scene-motion', 'reduced')
})
const page = await context.newPage(), errors = [], hydration = []
page.on('pageerror', error => errors.push(error.message))
page.on('console', message => { if (/hydrat|didn't match/i.test(message.text()) && message.type() === 'error') hydration.push(message.text()) })
const canvas = () => page.locator('.hero-atmosphere-canvas')
async function open() { if (await page.locator('.scene-trigger').getAttribute('aria-expanded') !== 'true') await page.locator('.scene-trigger').click() }
async function close() { await page.getByRole('button', { name: 'Close scene settings', exact: true }).click() }
try {
  await page.goto(base, { waitUntil: 'domcontentloaded' })
  await page.locator('.hero-atmosphere-canvas[data-ready=true]').waitFor({ timeout: 45000 })
  await open()
  for (const [name, id] of [['Before dawn','predawn'],['Morning','morning'],['Day','day'],['Dusk','dusk'],['Night','night'],['Deep night','deep']]) {
    await page.getByRole('button', { name, exact: true }).click()
    await page.locator('.hero-atmosphere-canvas[data-phase=' + id + ']').waitFor()
    assert.equal(await page.locator('.scene-phase-grid [aria-pressed=true]').count(), 1)
  }
  await page.getByRole('button', { name: 'Day', exact: true }).click()
  await close(); await page.waitForTimeout(1500)
  await page.screenshot({ path: 'artifacts/final-day.png' })
  await open(); await page.getByRole('button', { name: 'Deep night', exact: true }).click(); await close()
  await page.screenshot({ path: 'artifacts/final-night.png' })
  console.log('PASS: six phases, shared scene geometry, daylight and original night sky')

  await open()
  await page.getByRole('checkbox', { name: 'Reduce motion', exact: true }).uncheck()
  await page.waitForFunction(() => document.querySelector('.hero-atmosphere video').currentTime > .3, { timeout: 20000 })
  await page.getByRole('button', { name: 'Morning', exact: true }).click()
  await page.getByRole('combobox', { name: 'Weather', exact: true }).selectOption('mist')
  await page.waitForTimeout(7000)
  await page.screenshot({ path: 'artifacts/final-mist.png' })
  await page.getByRole('combobox', { name: 'Weather', exact: true }).selectOption('storm')
  await page.waitForTimeout(9000)
  const hydrology = await canvas().evaluate(c => ({ wet: +c.dataset.wetness, stream: +c.dataset.stream, fall: +c.dataset.waterfall }))
  assert.ok(hydrology.wet > hydrology.stream && hydrology.stream > hydrology.fall)
  assert.ok(hydrology.wet > .01)
  await page.screenshot({ path: 'artifacts/final-rain.png' })
  await page.getByRole('combobox', { name: 'Weather', exact: true }).selectOption('clear')
  await page.waitForTimeout(1500)
  assert.ok(+(await canvas().getAttribute('data-wetness')) > .01, 'rain must not instantly dry')
  await page.getByRole('checkbox', { name: 'Reduce motion', exact: true }).check()
  const stopped = await canvas().getAttribute('data-render-time')
  await page.waitForTimeout(500)
  assert.equal(await canvas().getAttribute('data-render-time'), stopped)
  assert.equal(await page.locator('.hero-atmosphere video').evaluate(v => v.paused), true)
  await page.keyboard.press('Escape')
  assert.equal(await page.locator('.scene-trigger').getAttribute('aria-expanded'), 'false')
  assert.equal(await page.locator('.scene-trigger').evaluate(el => document.activeElement === el), true)
  console.log('PASS: video playback, dew, rain, lagged runoff, wetness memory, reduced motion and keyboard access')

  await page.getByRole('button', { name: 'Switch language', exact: true }).click()
  await open()
  await page.getByRole('button', { name: '清晨', exact: true }).click()
  await page.getByRole('combobox', { name: '天气', exact: true }).selectOption('mist')
  await page.getByRole('button', { name: '关闭场景设置', exact: true }).click()
  await page.setViewportSize({ width: 390, height: 844 })
  await page.waitForTimeout(400)
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
  await page.screenshot({ path: 'artifacts/final-mobile.png' })
  await open()
  await page.getByRole('button', { name: '恢复当地时间与自然天气', exact: true }).click()
  assert.match(await page.locator('.scene-trigger').innerText(), /当地时间/)
  await page.getByRole('button', { name: '关闭场景设置', exact: true }).click()
  await page.screenshot({ path: 'artifacts/final-local-time.png' })
  // Check actual CTA remains above every visual layer.
  const projects = page.getByRole('button', { name: '查看项目', exact: true })
  if (await projects.count()) await projects.click()
  else await page.locator('#about').scrollIntoViewIfNeeded()
  await page.waitForTimeout(700)
  assert.equal(await canvas().getAttribute('data-paused'), 'true')
  assert.equal(await page.locator('.scene-controls').isVisible(), false)
  assert.deepEqual(errors, []); assert.deepEqual(hydration, [])
  console.log('PASS: Chinese controls, responsive framing, local-time restore, links and offscreen pause; no browser/hydration errors')

  const quietContext = await browser.newContext({ reducedMotion: 'reduce', timezoneId: 'Asia/Shanghai', viewport: { width: 390, height: 844 } })
  await quietContext.addInitScript(() => localStorage.removeItem('portfolio-scene-motion'))
  const quietPage = await quietContext.newPage()
  quietPage.on('console', message => { if (/hydrat|didn't match/i.test(message.text()) && message.type() === 'error') hydration.push(message.text()) })
  await quietPage.goto(base)
  await quietPage.locator('.hero-atmosphere-canvas[data-ready=true]').waitFor()
  await quietPage.locator('.scene-trigger').click()
  assert.equal(await quietPage.getByRole('checkbox', { name: /Reduce motion|减少动效/ }).isChecked(), true)
  assert.equal(await quietPage.locator('.hero-atmosphere video').evaluate(v => v.paused), true)
  await quietContext.close()

  const fallbackContext = await browser.newContext({ reducedMotion: 'reduce' })
  await fallbackContext.route('**/scene/valley-day.webp', route => route.abort())
  const fallbackPage = await fallbackContext.newPage()
  await fallbackPage.goto(base)
  await fallbackPage.locator('.hero-atmosphere-canvas[data-asset-fallback=true][data-ready=true]').waitFor()
  assert.ok(await fallbackPage.locator('h1').isVisible())
  await fallbackContext.close()
  assert.deepEqual(hydration, [])
  console.log('PASS: OS motion preference, cross-timezone hydration and failed-landscape fallback')
} finally {
  await browser.close()
}
