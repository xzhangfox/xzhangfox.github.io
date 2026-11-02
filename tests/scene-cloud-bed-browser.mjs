// Browser regression for the rebuilt sky / meadow / suspended-cloud-bed scene.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { pathToFileURL } from 'node:url'
const { chromium } = await import(process.env.FLUX_PLAYWRIGHT_MODULE ? pathToFileURL(process.env.FLUX_PLAYWRIGHT_MODULE).href : 'playwright')
const browser = await chromium.launch({ headless: true, executablePath: process.env.FLUX_CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe' })
const base = process.env.PORTFOLIO_TEST_URL || 'http://127.0.0.1:4220', errors = []
fs.mkdirSync('artifacts', { recursive: true })
async function choose(page, phase, weather = 'clear') {
  if (await page.locator('.scene-trigger').getAttribute('aria-expanded') !== 'true') await page.locator('.scene-trigger').click()
  await page.getByRole('button', { name: phase, exact: true }).click()
  await page.getByRole('combobox', { name: 'Weather', exact: true }).selectOption(weather)
  await page.getByRole('button', { name: 'Close scene settings', exact: true }).click()
}
async function sample(page, save = false) {
  return page.locator('.hero-atmosphere-canvas').evaluate((canvas, save) => {
    const c = document.createElement('canvas'); c.width = innerWidth; c.height = innerHeight
    const ctx = c.getContext('2d'); ctx.drawImage(canvas, 0, 0, c.width, c.height)
    const x = +canvas.dataset.bedX, y = +canvas.dataset.bedY, s = +canvas.dataset.bedSize
    const rects = { ground: [innerWidth * .04, innerHeight * .81, innerWidth * .2, innerHeight * .1],
      sky: [0, innerHeight * .06, innerWidth, innerHeight * .28],
      shelter: [x - s * .23, y + s * .19, s * .46, s * .17], gap: [x - s * .27, y - s * .01, s * .54, s * .16] }
    const data = Object.fromEntries(Object.entries(rects).map(([key, rect]) => [key, ctx.getImageData(...rect).data]))
    if (save) { window.__cloudBaseline = data; return {} }
    return Object.fromEntries(Object.entries(data).map(([key, pixels]) => {
      let sum = 0, count = 0
      for (let i = 0; i < pixels.length; i++) if (i % 4 !== 3) { sum += Math.abs(pixels[i] - window.__cloudBaseline[key][i]); count++ }
      return [key, sum / count]
    }))
  }, save)
}
try {
  for (const [width, height] of [[1440, 1000], [390, 844]]) {
    const context = await browser.newContext({ viewport: { width, height } })
    await context.addInitScript(() => {
      localStorage.setItem('portfolio-language', 'en'); localStorage.setItem('portfolio-scene-motion', 'reduced')
      // Optical ablation is confined to this test; production has no visual test switches.
      const fill = CanvasRenderingContext2D.prototype.fill, stroke = CanvasRenderingContext2D.prototype.stroke
      CanvasRenderingContext2D.prototype.fill = function (...args) {
        if (window.__hideRainbow && this.globalCompositeOperation === 'screen') return
        if (window.__hideStars && this.shadowBlur > 0 && String(this.fillStyle).replaceAll(' ', '').match(/ffebb6|255,235,182/i)) return
        return fill.apply(this, args)
      }
      CanvasRenderingContext2D.prototype.stroke = function (...args) {
        const style = String(this.strokeStyle).replaceAll(' ', '')
        if (window.__hideRain && style.startsWith('rgba(202,224,239,')) return
        if (window.__hideRainbow && this.globalCompositeOperation === 'screen') return
        if (window.__hideStars && style.startsWith('rgba(240,220,176,')) return
        return stroke.apply(this, args)
      }
    })
    const page = await context.newPage()
    page.on('pageerror', e => errors.push(e.message))
    page.on('console', m => { if (/THREE.WebGLProgram|shader error|hydration/i.test(m.text()) && m.type() === 'error') errors.push(m.text()) })
    await page.goto(base); await page.locator('.hero-atmosphere-canvas[data-ready=true]').waitFor({ timeout: 45000 })
    await choose(page, 'Day')
    for (const [w, h] of [[width, height], ...(width > 700 ? [[1280, 720], [360, 740], [844, 390]] : [])]) {
      await page.setViewportSize({ width: w, height: h }); await page.waitForTimeout(250)
      const layout = await page.evaluate(() => {
        const c = document.querySelector('.hero-atmosphere-canvas'), hero = document.querySelector('[data-home-hero]').getBoundingClientRect()
        return { top: +c.dataset.bedY - +c.dataset.bedSize / 2, bottom: +c.dataset.bedY + +c.dataset.bedSize / 2,
          actions: document.querySelector('[data-hero-actions]').getBoundingClientRect().bottom, end: hero.bottom, overflow: document.documentElement.scrollWidth > innerWidth }
      })
      assert.ok(layout.top > layout.actions + 4, `art stays below CTAs at ${w}x${h}`)
      assert.ok(layout.bottom < layout.end && !layout.overflow, `complete art fits hero at ${w}x${h}`)
    }
    await page.setViewportSize({ width, height }); await page.waitForTimeout(250)
    await choose(page, 'Day'); await sample(page, true)
    await page.locator('.scene-trigger').click(); await page.getByRole('checkbox', { name: 'Reduce motion', exact: true }).uncheck()
    await page.getByRole('button', { name: 'Close scene settings', exact: true }).click()
    const start = await page.locator('.hero-atmosphere-canvas').evaluate(c => ({ t: +c.dataset.renderTime, x: +c.dataset.bedX, y: +c.dataset.bedY }))
    await page.waitForFunction(t => +document.querySelector('.hero-atmosphere-canvas').dataset.renderTime > t + 5, start.t, { timeout: 18000 })
    const motion = await sample(page)
    const end = await page.locator('.hero-atmosphere-canvas').evaluate(c => ({ x: +c.dataset.bedX, y: +c.dataset.bedY, camera: [c.dataset.cameraScale, c.dataset.cameraX, c.dataset.cameraY] }))
    assert.ok(motion.ground > .5 && motion.sky > .1, 'real meadow and distant cloud pixels move')
    assert.ok(Math.abs(start.x - end.x) < .1 && Math.abs(start.y - end.y) < 8, 'bed remains centered with only a gentle bob')
    assert.deepEqual(end.camera, ['1', '0', '0'])
    console.log(width, 'forward drift / cloud motion:', motion.ground.toFixed(2), motion.sky.toFixed(2))
    await page.locator('.scene-trigger').click(); await page.getByRole('checkbox', { name: 'Reduce motion', exact: true }).check(); await page.getByRole('button', { name: 'Close scene settings', exact: true }).click()
    await choose(page, 'Deep night'); await sample(page, true)
    await page.evaluate(() => { window.__hideStars = true; dispatchEvent(new Event('resize')) })
    const stars = await sample(page); assert.ok(stars.gap > .05, 'hanging stars contribute actual visible pixels')
    await page.evaluate(() => { window.__hideStars = false; dispatchEvent(new Event('resize')) })
    await page.screenshot({ path: `artifacts/cloud-night-${width}.png` })
    await choose(page, 'Day', 'storm'); await sample(page, true)
    await page.evaluate(() => { window.__hideRain = true; dispatchEvent(new Event('resize')) })
    const rain = await sample(page)
    assert.ok(rain.ground > .01, 'rain visibly reaches the exposed meadow')
    assert.ok(rain.shelter < .02, 'rain does not reach the protected bed')
    await page.evaluate(() => { window.__hideRain = false; dispatchEvent(new Event('resize')) }); await sample(page, true)
    await page.evaluate(() => { window.__hideRainbow = true; dispatchEvent(new Event('resize')) })
    const rainbow = await sample(page); assert.ok(rainbow.gap > .5, 'a visible rainbow projects into the sheltered air')
    await page.evaluate(() => { window.__hideRainbow = false; dispatchEvent(new Event('resize')) })
    await page.screenshot({ path: `artifacts/cloud-rain-${width}.png` })
    console.log(width, 'visible stars / exposed rain / protected bed / rainbow:', stars.gap.toFixed(2), rain.ground.toFixed(2), rain.shelter.toFixed(2), rainbow.gap.toFixed(2))
    await page.getByRole('button', { name: 'Switch language', exact: true }).click(); await page.waitForTimeout(250)
    const zh = await page.evaluate(() => { const c = document.querySelector('.hero-atmosphere-canvas'); return +c.dataset.bedY - +c.dataset.bedSize / 2 > document.querySelector('[data-hero-actions]').getBoundingClientRect().bottom })
    assert.ok(zh, 'Chinese copy does not overlap cloud bed')
    await context.close()
  }
  assert.deepEqual(errors, [])
  console.log('PASS: responsive cloud-bed composition, fixed camera, forward background, night stars and a visible rain shelter that keeps the bed dry')
} finally { await browser.close() }
