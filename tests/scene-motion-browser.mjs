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
await page.addInitScript(() => {
  localStorage.setItem('portfolio-scene-motion', 'reduced'); localStorage.setItem('portfolio-language', 'en')
  // Test-only optical controls: intercept the offscreen hero draw, without production debug switches.
  const draw = WebGL2RenderingContext.prototype.drawElements
  WebGL2RenderingContext.prototype.drawElements = function(...args) {
    const overrides = []
    if (!this.canvas.isConnected && (window.__sceneNoGlow || Number.isFinite(window.__sceneSurfaceTime))) {
      const program = this.getParameter(this.CURRENT_PROGRAM)
      for (const [name, value] of [['night', window.__sceneNoGlow ? 0 : null], ['time', window.__sceneSurfaceTime]]) if (typeof value === 'number') {
        const location = this.getUniformLocation(program, name)
        if (location) { overrides.push([location, this.getUniform(program, location)]); this.uniform1f(location, value) }
      }
    }
    draw.apply(this, args)
    for (const [location, value] of overrides) this.uniform1f(location, value)
  }
})
function sampleRegisteredFrame(canvas) {
    const w = innerWidth, h = innerHeight, mobile = w < 700
    const rw = mobile ? 720 : 1280, rh = mobile ? 1280 : 720
    const a = +canvas.dataset.cameraScale, tx = +canvas.dataset.cameraX, ty = +canvas.dataset.cameraY
    const c = document.createElement('canvas'); c.width = rw; c.height = rh
    const ctx = c.getContext('2d'); ctx.setTransform(1 / a, 0, 0, 1 / a, -tx / a, -ty / a)
    ctx.drawImage(canvas, 0, 0, canvas.width, canvas.height, 0, 0, w, h)
    const regions = mobile ? { sky: [240, 180, 240, 250], water: [590, 952, 50, 50], fall: [596, 834, 15, 42], ground: [140, 1000, 90, 50], foreground: [180, 1150, 130, 50], robotLight: [344, 1009, 12, 12], catLight: [389, 1019, 12, 12], rock: [120, 780, 35, 45], slope: [50, 800, 120, 90] }
      : { sky: [430, 100, 320, 180], water: [1050, 550, 100, 60], fall: [949, 412, 20, 45], ground: [300, 550, 140, 50], foreground: [280, 635, 170, 45], robotLight: [548, 564, 14, 14], catLight: [604, 575, 12, 12], rock: [150, 250, 55, 60], slope: [100, 410, 260, 70] }
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
}
async function snapshot() { return page.locator('.hero-atmosphere-canvas').evaluate(sampleRegisteredFrame) }
// Inject the same sampler so controlled pairs render synchronously, without a camera frame between them.
await page.addInitScript({content: 'window.__sceneSample = ' + sampleRegisteredFrame.toString()})
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
    const center = () => page.locator('.hero-atmosphere-canvas').evaluate(c => ({ y: +c.dataset.cameraY + (innerWidth < 700 ? 1280 : 720) * .5 * +c.dataset.cameraScale, t: +c.dataset.renderTime, matrix: [c.dataset.cameraScale,c.dataset.cameraX,c.dataset.cameraY] }))
    const positions = [await center()], before = await snapshot()
    for (let i = 0; i < 5; i++) { await page.waitForTimeout(1000); positions.push(await center()) }
    const after = await snapshot(), travel = Math.max(...positions.map(p => p.y)) - Math.min(...positions.map(p => p.y))
    const speed = Math.max(...positions.slice(1).map((p, i) => Math.abs(p.y - positions[i].y) / (p.t - positions[i].t)))
    assert.ok(positions.every(p => JSON.stringify(p.matrix) === JSON.stringify(positions[0].matrix)), 'camera translation and zoom must stay completely fixed')
    assert.equal(travel,0); assert.equal(speed,0)
    console.log('Camera travel over 5s:', travel.toFixed(2), 'CSS px; peak speed:', speed.toFixed(2), 'px/s')
    const delta = Object.fromEntries(Object.keys(before).map(key => [key, +difference(before[key], after[key]).toFixed(3)]))
    console.log(width < 700 ? 'Portrait' : 'Desktop', 'registered pixel change (camera removed):', delta)
    assert.ok(delta.sky > delta.rock * 1.3 && delta.sky > 1, 'clouds must drift independently of camera')
    assert.ok(delta.water > delta.rock * 1.3 && delta.water > 1, 'creek texture/reflections must flow')
    // The subtler waterfall is checked below with a deterministic frozen-time pair.
    const { windy, calm } = await page.locator('.hero-atmosphere-canvas').evaluate(canvas => {
      window.__sceneSurfaceTime = 8; dispatchEvent(new Event('resize'))
      const windy = window.__sceneSample(canvas)
      window.__sceneSurfaceTime = 0; dispatchEvent(new Event('resize'))
      const calm = window.__sceneSample(canvas)
      delete window.__sceneSurfaceTime; dispatchEvent(new Event('resize'))
      return { windy, calm }
    })
    const plantMovement = difference(windy.foreground, calm.foreground)
    const distantMovement = difference(windy.ground, calm.ground), slopeMovement = difference(windy.slope, calm.slope)
    const fallMovement = difference(windy.fall, calm.fall)
    console.log('Breeze contribution:', { foreground: plantMovement, distantMeadow: distantMovement, mountains: slopeMovement })
    assert.ok(fallMovement > .8, 'waterfall texture must change independently of the camera')
    assert.ok(plantMovement > .6 && plantMovement > distantMovement * 2, 'only the closest flowers visibly sway')
    assert.ok(distantMovement < 1.2 && slopeMovement < 1.2, 'distant vegetation remains still apart from subpixel camera resampling')
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
  for (const [width, height] of [[1440,900],[390,844]]) {
    await page.setViewportSize({ width, height })
    await page.locator('.scene-trigger').click()
    await page.getByRole('checkbox', { name: 'Reduce motion', exact: true }).check()
    await page.getByRole('button', { name: 'Deep night', exact: true }).click()
    await page.getByRole('combobox', { name: 'Weather', exact: true }).selectOption('clear')
    await page.getByRole('button', { name: 'Close scene settings', exact: true }).click()
    await page.waitForTimeout(150)
    const illuminated = await snapshot()
    await page.evaluate(() => { window.__sceneNoGlow = true; dispatchEvent(new Event('resize')) })
    const unlit = await snapshot()
    const fieldGlow = difference(illuminated.ground, unlit.ground), slopeGlow = difference(illuminated.slope, unlit.slope)
    const robotGlow = difference(illuminated.robotLight, unlit.robotLight), catGlow = difference(illuminated.catLight, unlit.catLight)
    console.log(width < 700 ? 'Portrait' : 'Desktop', 'night emission contribution:', { fieldGlow, slopeGlow, robotGlow, catGlow })
    assert.ok(robotGlow > 3 && catGlow > 3, 'robot amber rings and kitten components emit light at night')
    assert.ok(fieldGlow > 3 && slopeGlow > 1, 'flowers and mountain vegetation must visibly glow after night exposure')
    await page.evaluate(() => { window.__sceneNoGlow = false; dispatchEvent(new Event('resize')) })
    await page.screenshot({ path: width < 700 ? 'artifacts/meadow-night-phone.png' : 'artifacts/meadow-night-desktop.png' })
  }
  assert.deepEqual(errors, [])
  console.log('PASS: locked camera, faster clouds, foreground-only breeze, robot/kitten lights and seamless phone rain')
} finally { await browser.close() }
