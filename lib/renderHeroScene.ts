import layouts from './sceneSkyline.json'
import { createSceneSurface } from './sceneSurface'
import { approach, clamp, lightAt, type SceneEnvironment } from './sceneEnvironment'

type Drop = { x: number; y: number; r: number; age: number; wait: number; speed: number; seed: number; trail: { x: number; y: number }[] }
type Rain = { x: number; y: number; speed: number; depth: number }
export interface SceneController {
  update: (environment: SceneEnvironment, reduced: boolean) => void
  setVisible: (visible: boolean) => void
  destroy: () => void
}
// Geometry is registered separately for the complete desktop and portrait compositions.
const NOISE = (n: number) => { const r = Math.sin(n * 97.13 + 113.79) * 43758.54; return r - Math.floor(r) }

// ponytail: Texture displacement animates this fixed viewpoint; walking through the valley
// would require authored depth/3D geometry instead of a single photographic plate.
export function createHeroScene(canvas: HTMLCanvasElement, video: HTMLVideoElement, initial: SceneEnvironment, reduced: boolean): SceneController | null {
  const ctx = canvas.getContext('2d', { alpha: false })
  if (!ctx) return null
  let layout = layouts.desktop
  let SKY = new Path2D(layout.sky), GROUND = new Path2D(), WATER = new Path2D(layout.water), FALL = new Path2D(layout.fall)
  let surface: ReturnType<typeof createSceneSurface> = null, surfaceSource: HTMLImageElement | null = null
  const backing = document.createElement('canvas'), frost = document.createElement('canvas'), skyLayer = document.createElement('canvas'), skyMask = document.createElement('canvas')
  const scene = backing.getContext('2d'), glass = frost.getContext('2d'), sky = skyLayer.getContext('2d'), maskContext = skyMask.getContext('2d')
  if (!scene || !glass || !sky || !maskContext) return null
  const desktop = new Image(), portrait = new Image(), desktopFallback = new Image(), portraitFallback = new Image(), nightSky = new Image(), wideNightSky = new Image()
  let master = desktop, fallback = desktopFallback
  let env = initial, quiet = reduced, disposed = false, visible = true, pageVisible = !document.hidden
  let width = 1, height = 1, dpr = 1, scale = 1, ox = 0, oy = 0, frame = 0, previous = 0, elapsed = 0
  let hour = env.hour, rain = env.rain, fog = env.fog, wet = env.wetness, runoff = env.stream, fall = env.waterfall
  let painted = false, videoWanted = false
  let drops: Drop[] = [], streaks: Rain[] = []
  desktop.src = layouts.desktop.reference; portrait.src = layouts.mobile.reference
  desktopFallback.src = '/scene/valley-robot-fallback.jpg'; portraitFallback.src = '/scene/valley-robot-mobile-fallback.jpg'
  nightSky.src = '/scene/night-sky.webp'; wideNightSky.src = '/scene/night-sky-wide.webp'
  const world = (c: CanvasRenderingContext2D) => {
    const t = quiet ? 0 : elapsed
    // Overscan keeps every edge covered throughout this slow camera breath.
    const zoom = 1 + Math.sin(t * .13) * .004
    c.translate(width * .5 + Math.sin(t * .11) * width * .003, height * .5 + Math.sin(t * .16) * height * .002)
    c.scale(zoom, zoom); c.translate(-width * .5, -height * .5)
    c.translate(ox, oy); c.scale(scale, scale)
  }
  function prepareSurface(source: HTMLImageElement) {
    if (surfaceSource === source) return
    surface?.destroy(); surface = null; surfaceSource = source
    const mask = document.createElement('canvas'); mask.width = layout.width; mask.height = layout.height
    const m = mask.getContext('2d')!
    m.fillStyle = '#000'; m.fillRect(0, 0, mask.width, mask.height)
    m.fillStyle = '#f00'; m.fill(SKY)
    m.fillStyle = '#0f0'; m.fill(WATER)
    m.strokeStyle = '#00f'; m.lineWidth = layout.fallWidth; m.lineCap = 'round'; m.stroke(FALL)
    // Keep moving reflections on cool/white water, excluding warm grass and dark boulders.
    const pixels = m.getImageData(0, 0, mask.width, mask.height)
    const photo = document.createElement('canvas'); photo.width = mask.width; photo.height = mask.height
    const pc = photo.getContext('2d')!; pc.drawImage(source, 0, 0, mask.width, mask.height)
    const colors = pc.getImageData(0, 0, mask.width, mask.height).data
    for (let i = 0; i < pixels.data.length; i += 4) if (pixels.data[i + 1]) {
      const r = colors[i], g = colors[i + 1], b = colors[i + 2]
      const cool = clamp((b / Math.max(1, r) - .76) / .22) * clamp((Math.min(r, g, b) - 55) / 85)
      pixels.data[i + 1] *= cool
    }
    m.putImageData(pixels, 0, 0)
    surface = createSceneSurface(source, mask)
    canvas.dataset.surface = surface ? 'webgl' : 'canvas'
  }
  const canAnimate = () => visible && pageVisible && !quiet && !disposed
  function syncVideo() {
    const want = canAnimate() && lightAt(hour).night > .02
    if (want === videoWanted) return
    videoWanted = want
    if (want) void video.play().catch(() => { canvas.dataset.videoFallback = 'true' })
    else video.pause()
  }
  function resize() {
    width = window.innerWidth; height = window.innerHeight
    // Cap both device ratio and total backing pixels; avoids enormous buffers on 4K phones.
    dpr = Math.min(window.devicePixelRatio || 1, width < 700 ? 1.25 : 1.5, Math.sqrt(2_200_000 / (width * height)))
    backing.width = canvas.width = Math.round(width * dpr); backing.height = canvas.height = Math.round(height * dpr)
    frost.width = Math.max(1, Math.round(width * dpr * .35)); frost.height = Math.max(1, Math.round(height * dpr * .35))
    ctx!.setTransform(dpr, 0, 0, dpr, 0, 0); scene!.setTransform(dpr, 0, 0, dpr, 0, 0)
    glass!.setTransform(dpr * .35, 0, 0, dpr * .35, 0, 0)
    const nextLayout = width < 700 ? layouts.mobile : layouts.desktop
    if (layout !== nextLayout) { surface?.destroy(); surface = null; surfaceSource = null }
    layout = nextLayout
    master = width < 700 ? portrait : desktop; fallback = width < 700 ? portraitFallback : desktopFallback
    SKY = new Path2D(layout.sky); WATER = new Path2D(layout.water); FALL = new Path2D(layout.fall)
    GROUND = new Path2D('M0 0H' + layout.width + 'V' + layout.height + 'H0Z'); GROUND.addPath(SKY)
    scale = Math.max(width / layout.width, height / layout.height) * 1.035
    ox = (width - layout.width * scale) * .5; oy = (height - layout.height * scale) * .5
    skyLayer.width = skyMask.width = layout.width; skyLayer.height = skyMask.height = layout.height
    // Feather the horizon optically; weather and stars must never form a cut-out ridge.
    maskContext!.filter = 'blur(7px)'; maskContext!.fillStyle = '#fff'; maskContext!.fill(SKY); maskContext!.filter = 'none'
    canvas.dataset.layout = width < 700 ? 'portrait' : 'landscape'
    drops = []
    streaks = Array.from({ length: width < 700 ? 100 : 220 }, () => ({ x: Math.random() * width, y: Math.random() * height, speed: .5 + Math.random(), depth: Math.random() }))
    render(0)
  }
  function haze(x: number, y: number, rx: number, ry: number, opacity: number, color = '201,215,222', target = scene!) {
    if (opacity < .001) return
    target.save(); target.translate(x, y); target.scale(rx, ry)
    const g = target.createRadialGradient(0, 0, 0, 0, 0, 1)
    g.addColorStop(0, 'rgba(' + color + ',' + opacity + ')'); g.addColorStop(1, 'rgba(' + color + ',0)')
    target.fillStyle = g; target.fillRect(-1, -1, 2, 2); target.restore()
  }
  function render(dt: number) {
    if (disposed || !width) return
    const moving = canAnimate()
    if (moving) {
      const delta = (env.hour - hour + 36) % 24 - 12
      hour = (hour + delta * (1 - Math.exp(-dt / 2)) + 24) % 24
      rain = approach(rain, env.rain, 4, dt); fog = approach(fog, env.fog, 7, dt)
      // Lens responds first, ground next, stream later, distant waterfall last.
      wet = clamp(wet + rain * dt / 35 - (1 - rain) * dt / 480)
      wet = Math.max(wet, env.wetness)
      runoff = approach(runoff, Math.max(env.stream, rain * .8), rain > runoff ? 75 : 240, dt)
      fall = approach(fall, Math.max(env.waterfall, runoff * .85), runoff > fall ? 150 : 420, dt)
    } else if (quiet) {
      hour = env.hour; rain = env.rain; fog = env.fog
      wet = Math.max(wet, env.wetness); runoff = env.stream; fall = env.waterfall
    }
    const light = lightAt(hour), clouds = clamp(rain * .95 + fog * .14)
    const source = master.complete && master.naturalWidth ? master : fallback.complete && fallback.naturalWidth ? fallback : null
    scene!.fillStyle = '#090e18'; scene!.fillRect(0, 0, width, height)
    if (source) {
      prepareSurface(source)
      const animated = surface?.render(quiet ? 0 : elapsed, rain, runoff, fall)
      scene!.save(); world(scene!)
      scene!.drawImage(animated || source, 0, 0, layout.width, layout.height)
      scene!.restore()
      scene!.save(); scene!.globalCompositeOperation = 'multiply'
      const tint = light.tint.map(v => Math.round(v)).join(',')
      scene!.fillStyle = 'rgba(' + tint + ',' + (.08 + light.night * .28) + ')'; scene!.fillRect(0, 0, width, height)
      scene!.restore()
      scene!.fillStyle = 'rgba(4,9,20,' + clamp(1 - light.brightness + clouds * .18) + ')'; scene!.fillRect(0, 0, width, height)
    }
    // The existing night movie is used only above the registered skyline.
    sky!.clearRect(0, 0, layout.width, layout.height)
    if (light.night > .001 && (video.readyState >= 2 || (width < 700 ? nightSky : wideNightSky).naturalWidth)) {
      sky!.globalAlpha = light.night * (1 - clouds * .98)
      // Only upper crops are sampled from the old movie; its observer/equipment cannot enter the scene.
      const skyBottom = layout.height * .73
      const zoom = Math.max(layout.width / 560, skyBottom / 300)
      const dx = (layout.width - 560 * zoom) * .5
      if (width >= 700) {
        // A wide upper crop preserves the original star scale and excludes all equipment below y=400.
        if (video.readyState >= 2) {
          const ratio = video.videoWidth / 1280
          sky!.drawImage(video, 0, 0, video.videoWidth, 400 * ratio, 0, 0, layout.width, layout.height * .75)
        } else sky!.drawImage(wideNightSky, 0, 0, layout.width, layout.height * .75)
      } else if (video.readyState >= 2) {
        const ratio = video.videoWidth / 1280
        sky!.drawImage(video, 360 * ratio, 0, 560 * ratio, 300 * ratio, dx, 0, 560 * zoom, 300 * zoom)
      } else sky!.drawImage(nightSky, dx, 0, 560 * zoom, 300 * zoom)
      sky!.globalAlpha = 1
    }
    if (light.warmth > .01) haze(layout.width * .67, layout.height * .63, layout.width * .53, layout.height * .43, light.warmth * .45, '255,184,111', sky!)
    for (let i = 0; i < 5; i++) {
      const x = ((i * layout.width * .26 + elapsed * (2.3 + i * .3)) % (layout.width * 1.4)) - layout.width * .2
      haze(x, layout.height * (.13 + i * .045), layout.width * .22, layout.height * .06, (.015 + clouds * .10) * (1 - light.night * .4), '201,215,222', sky!)
    }
    sky!.globalCompositeOperation = 'destination-in'; sky!.drawImage(skyMask, 0, 0); sky!.globalCompositeOperation = 'source-over'
    scene!.save(); world(scene!); scene!.drawImage(skyLayer, 0, 0); scene!.restore()
    // Cloud cover affects the whole air column with a continuous gradient, not a clipped sky tile.
    const overcast = scene!.createLinearGradient(0, 0, 0, height)
    overcast.addColorStop(0, 'rgba(21,35,57,' + clouds * .78 + ')')
    overcast.addColorStop(.6, 'rgba(60,77,94,' + clouds * .44 + ')')
    overcast.addColorStop(1, 'rgba(70,85,97,' + clouds * .08 + ')')
    scene!.fillStyle = overcast; scene!.fillRect(0, 0, width, height)
    // Wet rock/grass retains darker diffuse color with low grazing reflections.
    scene!.save(); world(scene!); scene!.clip(GROUND, 'evenodd')
    scene!.fillStyle = 'rgba(10,24,35,' + wet * .15 + ')'; scene!.fillRect(0, 0, layout.width, layout.height)
    for (let i = 0; i < 27; i++) {
      const x = layout.width * (.08 + NOISE(i) * .87), y = layout.height * (.73 + NOISE(i + 90) * .27)
      scene!.strokeStyle = 'rgba(192,207,212,' + wet * (.015 + NOISE(i + 30) * .045) + ')'
      scene!.lineWidth = .5; scene!.beginPath(); scene!.moveTo(x, y); scene!.lineTo(x + 3 + NOISE(i + 2) * 7, y - 1); scene!.stroke()
    }
    scene!.restore()
    // Rain rings share the same registered channel and camera as the flowing texture.
    scene!.save(); world(scene!); scene!.clip(WATER)
    if (rain > .01) for (let i = 0; i < (width < 700 ? 22 : 40); i++) {
      const age = (elapsed * .7 + NOISE(i + 29)) % 1, r = age * (3 + NOISE(i + 44) * 8)
      scene!.strokeStyle = 'rgba(219,235,242,' + (1 - age) * rain * .32 + ')'; scene!.lineWidth = .65
      scene!.beginPath(); scene!.ellipse(layout.width * (.73 + NOISE(i + 4) * .27), layout.height * (.67 + NOISE(i + 5) * .33), r, r * .22, 0, 0, Math.PI * 2); scene!.stroke()
    }
    scene!.restore()
    scene!.save(); world(scene!)
    const fallEnd = width < 700 ? [592, 880] : [946, 464]
    haze(fallEnd[0], fallEnd[1], 12 + fall * 15, 6 + fall * 8, (.05 + fall * .14) * (1 - light.night * .5))
    scene!.restore()
    // Three depth bands of valley mist; foreground objects stay legible.
    if (fog > .02) for (let i = 0; i < 3; i++) {
      haze(ox + layout.width * (.30 + i * .18 + Math.sin(elapsed * .035 + i) * .018) * scale, oy + layout.height * (.69 + i * .029) * scale,
        layout.width * .24 * scale, layout.height * (.028 + i * .014) * scale, fog * (.16 - i * .02) * (1 - light.night * .65))
    }
    if (rain > .005) {
      for (const r of streaks) {
        if (moving) {
          r.y += dt * (190 + rain * 500) * r.speed; r.x -= dt * (8 + rain * 45) * r.speed
          if (r.y > height + 30) { r.y = -30; r.x = Math.random() * width }
          if (r.x < -20) r.x = width + 20
        }
        scene!.strokeStyle = 'rgba(192,212,228,' + rain * (.045 + r.depth * .12) + ')'
        scene!.lineWidth = r.depth > .75 ? .85 : .45; scene!.beginPath(); scene!.moveTo(r.x, r.y)
        scene!.lineTo(r.x + rain * (2 + r.depth * 5), r.y - (6 + rain * 19) * r.speed); scene!.stroke()
      }
      haze(width * .8, height * .55, width * .45, height * .35, rain * .065, '119,140,162')
    }
    ctx!.drawImage(backing, 0, 0, backing.width, backing.height, 0, 0, width, height)
    const dew = fog > .35 && rain < .05, lensTarget = rain > .03 || dew
    if (moving && lensTarget && drops.length < (width < 700 ? 15 : 30) && Math.random() < dt * (dew ? .55 : 1 + rain * 3)) {
      let x = Math.random() * width, y = Math.random() * height * .85
      if (x > width * .28 && x < width * .72 && y > height * .3 && y < height * .65) x = Math.random() < .5 ? width * .12 : width * .88
      drops.push({ x, y, r: (dew ? 1.5 : 2.5) + Math.random() * (dew ? 3.5 : 5), age: 0,
        wait: dew ? 10 + Math.random() * 18 : 2 + Math.random() * 7, speed: 0, seed: Math.random() * 6, trail: [] })
    }
    if (moving) {
      for (let a = 0; a < drops.length; a++) for (let b = drops.length - 1; b > a; b--) {
        const x = drops[a], y = drops[b]
        if (Math.hypot(x.x - y.x, x.y - y.y) < (x.r + y.r) * .5) {
          x.r = Math.min(13, Math.hypot(x.r, y.r)); x.wait = Math.min(x.wait, x.age + 1); x.speed = Math.max(x.speed, y.speed); drops.splice(b, 1)
        }
      }
      drops = drops.filter(d => {
        d.age += dt
        if (!lensTarget) d.age += dt * .6
        if (d.age > d.wait) {
          d.speed = Math.min(dew ? 15 : 65, d.speed + dt * (dew ? 1.4 : 7))
          if (d.trail.length === 0 || Math.hypot(d.x - d.trail[d.trail.length - 1].x, d.y - d.trail[d.trail.length - 1].y) > 2) {
            d.trail.push({ x: d.x, y: d.y }); if (d.trail.length > 22) d.trail.shift()
          }
          d.y += d.speed * dt; d.x += Math.sin(d.y * .04 + d.seed) * dt * 2
        }
        return d.y < height + 30 && d.age < 75
      })
    }
    if (dew) {
      glass!.clearRect(0, 0, width, height); glass!.save()
      glass!.filter = 'blur(9px)'; glass!.drawImage(backing, 0, 0, backing.width, backing.height, 0, 0, width, height); glass!.filter = 'none'
      glass!.globalCompositeOperation = 'destination-in'
      const mask = glass!.createRadialGradient(width * .5, height * .4, width * .13, width * .5, height * .5, width * .65)
      mask.addColorStop(0, 'rgba(255,255,255,0)'); mask.addColorStop(1, 'rgba(255,255,255,' + fog * .38 + ')')
      glass!.fillStyle = mask; glass!.fillRect(0, 0, width, height)
      glass!.globalCompositeOperation = 'destination-out'; glass!.lineCap = 'round'
      for (const d of drops) if (d.trail.length > 1) {
        glass!.beginPath(); glass!.moveTo(d.trail[0].x, d.trail[0].y); d.trail.forEach(p => glass!.lineTo(p.x, p.y))
        glass!.lineWidth = d.r * 1.1; glass!.strokeStyle = 'rgba(0,0,0,.8)'; glass!.stroke()
      }
      glass!.restore(); ctx!.drawImage(frost, 0, 0, frost.width, frost.height, 0, 0, width, height)
    }
    for (const d of drops) {
      const r = d.r * Math.min(1, d.age / .2), ry = r * (1 + Math.min(1, d.speed / 35) * .6)
      if (r < .2) continue
      ctx!.save(); ctx!.beginPath(); ctx!.ellipse(d.x, d.y, r * .78, ry, 0, 0, Math.PI * 2); ctx!.clip()
      const sampleX = clamp((d.x - r * .8) * dpr, 0, backing.width - 1), sampleY = clamp((d.y - r * .8) * dpr, 0, backing.height - 1)
      const sampleW = Math.max(1, Math.min(r * 1.6 * dpr, backing.width - sampleX)), sampleH = Math.max(1, Math.min(r * 1.6 * dpr, backing.height - sampleY))
      ctx!.drawImage(backing, sampleX, sampleY, sampleW, sampleH, d.x - r, d.y - ry, r * 2, ry * 2)
      ctx!.fillStyle = 'rgba(180,215,235,.045)'; ctx!.fill(); ctx!.restore()
      ctx!.beginPath(); ctx!.ellipse(d.x, d.y, r * .78, ry, 0, 0, Math.PI * 2)
      ctx!.strokeStyle = 'rgba(211,230,244,.16)'; ctx!.lineWidth = .6; ctx!.stroke()
      ctx!.beginPath(); ctx!.ellipse(d.x - r * .18, d.y - r * .45, r * .2, r * .07, -.5, 0, Math.PI * 2)
      ctx!.fillStyle = 'rgba(245,250,255,.35)'; ctx!.fill()
    }
    // Diagnostic attributes are also useful to verify pauses/reduced-motion without screenshots.
    canvas.dataset.phase = env.phase; canvas.dataset.weather = env.weather
    canvas.dataset.wetness = wet.toFixed(3); canvas.dataset.stream = runoff.toFixed(3); canvas.dataset.waterfall = fall.toFixed(3)
    canvas.dataset.renderTime = elapsed.toFixed(2)
    if (!painted && source) { canvas.dataset.ready = 'true'; painted = true }
    syncVideo()
  }
  function tick(now: number) {
    frame = 0
    if (!canAnimate()) return
    const limit = width < 700 ? 1000 / 20 : 1000 / 30
    if (now - previous >= limit) {
      const dt = Math.min(.12, (now - previous) / 1000); previous = now; elapsed += dt
      render(dt)
      // Static daytime clear skies also have moving clouds and water; cap, never run at display Hz.
    }
    frame = requestAnimationFrame(tick)
  }
  function start() {
    syncVideo()
    if (canAnimate() && !frame) { previous = performance.now(); frame = requestAnimationFrame(tick) }
    if (quiet && visible && pageVisible) render(0)
  }
  function pause() { cancelAnimationFrame(frame); frame = 0; video.pause(); videoWanted = false }
  function visibility() { pageVisible = !document.hidden; if (pageVisible) start(); else pause() }
  const images = [desktop, portrait, desktopFallback, portraitFallback, nightSky, wideNightSky]
  images.forEach(image => { image.onload = () => { if (!disposed) { render(0); start() } } })
  desktop.onerror = portrait.onerror = () => { if (!disposed) { canvas.dataset.assetFallback = 'true'; render(0); start() } }
  video.addEventListener('loadeddata', start)
  window.addEventListener('resize', resize)
  document.addEventListener('visibilitychange', visibility)
  resize(); start()
  return {
    update(next, reduce) {
      env = next; quiet = reduce; drops = quiet ? [] : drops
      if (quiet) { pause(); if (visible && pageVisible) render(0) } else start()
    },
    setVisible(value) {
      visible = value; canvas.dataset.paused = String(!value)
      if (value) start(); else pause()
    },
    destroy() {
      disposed = true; pause(); surface?.destroy(); images.forEach(image => { image.onload = image.onerror = null })
      video.removeEventListener('loadeddata', start); window.removeEventListener('resize', resize)
      document.removeEventListener('visibilitychange', visibility)
      backing.width = backing.height = frost.width = frost.height = skyLayer.width = skyLayer.height = skyMask.width = skyMask.height = 1
    },
  }
}
