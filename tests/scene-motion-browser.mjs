// Visual regression: movement must come from the photographed regions, not only a running clock/camera.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { pathToFileURL } from 'node:url'
const { chromium } = await import(process.env.FLUX_PLAYWRIGHT_MODULE ? pathToFileURL(process.env.FLUX_PLAYWRIGHT_MODULE).href : 'playwright')
const browser = await chromium.launch({ headless: true, executablePath: process.env.FLUX_CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe' })
const base = process.env.PORTFOLIO_TEST_URL || 'http://127.0.0.1:4177'
const errors = []
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
page.on('pageerror', error => errors.push(error.message))
page.on('console', message => { if (/THREE.WebGLProgram|VALIDATE_STATUS|shader error/i.test(message.text())) errors.push(message.text()) })
await page.addInitScript(() => { localStorage.setItem('portfolio-scene-motion', 'reduced'); localStorage.setItem('portfolio-language', 'en') })
async function snapshot() {
  return page.locator('.hero-atmosphere-canvas').evaluate(canvas => {
    const t = +canvas.dataset.renderTime, w = innerWidth, h = innerHeight, mobile = w < 700
    const rw = mobile ? 720 : 1280, rh = mobile ? 1280 : 720
    const scale = Math.max(w / rw, h / rh) * 1.035, zoom = 1 + Math.sin(t * .13) * .004
    const tx = w * .5 + Math.sin(t * .11) * w * .003 + zoom * ((w - rw * scale) * .5 - w * .5)
    const ty = h * .5 + Math.sin(t * .16) * h * .002 + zoom * ((h - rh * scale) * .5 - h * .5)
    const c = document.createElement('canvas'); c.width = rw; c.height = rh
    const ctx = c.getContext('2d'); ctx.setTransform(1 / (scale * zoom), 0, 0, 1 / (scale * zoom), -tx / (scale * zoom), -ty / (scale * zoom))
    ctx.drawImage(canvas, 0, 0, canvas.width, canvas.height, 0, 0, w, h)
    const regions = mobile ? { sky: [240, 180, 240, 250], water: [590, 952, 50, 50], fall: [596, 834, 15, 42], ground: [140, 1000, 90, 50] }
      : { sky: [430, 100, 320, 180], water: [1050, 550, 100, 60], fall: [949, 412, 20, 45], ground: [300, 600, 140, 60] }
    return Object.fromEntries(Object.entries(regions).map(([name, rect]) => {
      const data = ctx.getImageData(...rect).data, averaged = []
      // Average 4px blocks to suppress camera resampling noise in fine grass/rock textures.
      for (let y = 0; y + 3 < rect[3]; y += 4) for (let x = 0; x + 3 < rect[2]; x += 4) {
        for (let ch = 0; ch < 3; ch++) {
          let sum = 0
          for (let dy = 0; dy < 4; dy++) for (let dx = 0; dx < 4; dx++) sum += data[((y + dy) * rect[2] + x + dx) * 4 + ch]
          averaged.push(sum / 16)
        }
        averaged.push(255)
      }
      return [name, averaged]
    }))
  })
}
function difference(a, b) { let sum = 0, n = 0; for (let i = 0; i < a.length; i++) if (i % 4 !== 3) { sum += Math.abs(a[i] - b[i]); n++ } return sum / n }
try {
  await page.goto(base)
  await page.locator('.hero-atmosphere-canvas[data-ready=true]').waitFor()
  await page.locator('.scene-trigger').click()
  await page.getByRole('button', { name: 'Day', exact: true }).click()
  await page.getByRole('combobox', { name: 'Weather', exact: true }).selectOption('clear')
  await page.getByRole('checkbox', { name: 'Reduce motion', exact: true }).uncheck()
  await page.getByRole('button', { name: 'Close scene settings', exact: true }).click()
  assert.equal(await page.locator('.hero-atmosphere-canvas').getAttribute('data-surface'), 'webgl')
  for (const [width, height] of [[1440,900],[390,844]]) {
    await page.setViewportSize({ width, height }); await page.waitForTimeout(700)
    const before = await snapshot(); await page.waitForTimeout(5000); const after = await snapshot()
    const delta = Object.fromEntries(Object.keys(before).map(key => [key, +difference(before[key], after[key]).toFixed(3)]))
    console.log(width < 700 ? 'Portrait' : 'Desktop', 'registered pixel change (camera removed):', delta)
    assert.ok(delta.sky > delta.ground * 1.5 && delta.sky > 1, 'clouds must drift independently of camera')
    assert.ok(delta.water > delta.ground * 1.5 && delta.water > 1, 'creek texture/reflections must flow')
    assert.ok(delta.fall > delta.ground * 1.5 && delta.fall > 1, 'waterfall must flow')
  }
  await page.locator('.scene-trigger').click()
  await page.getByRole('combobox', { name: 'Weather', exact: true }).selectOption('storm')
  await page.getByRole('button', { name: 'Close scene settings', exact: true }).click()
  await page.waitForTimeout(8500)
  // Mobile storm sky has no full-width row discontinuity where the old two plates met.
  const rows = await page.locator('.hero-atmosphere-canvas').evaluate(c => {
    const data = c.getContext('2d').getImageData(0, 0, c.width, c.height).data, changes = []
    for (let y = Math.round(c.height * .3); y < c.height * .6; y++) {
      let sum = 0
      for (let x = 2; x < c.width - 2; x++) for (let ch = 0; ch < 3; ch++) sum += Math.abs(data[(y * c.width + x) * 4 + ch] - data[((y - 1) * c.width + x) * 4 + ch])
      changes.push(sum / ((c.width - 4) * 3))
    }
    return { max: Math.max(...changes), mean: changes.reduce((a, b) => a + b, 0) / changes.length }
  })
  console.log('Mobile storm row continuity:', rows)
  assert.ok(rows.max < 9 && rows.max < rows.mean * 5, 'no horizontal sky/rain seam')
  assert.equal(await page.locator('.hero-atmosphere-canvas').getAttribute('data-layout'), 'portrait')
  fs.mkdirSync('artifacts', { recursive: true })
  await page.screenshot({ path: 'artifacts/robot-mobile-storm-verified.png' })
  assert.deepEqual(errors, [])
  console.log('PASS: moving daytime clouds, creek, waterfall; continuous phone rain scene; no shader errors')
} finally { await browser.close() }
