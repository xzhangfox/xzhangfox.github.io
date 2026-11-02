import { createSceneSurface } from './sceneSurface'
import { approach, clamp, lightAt, mix, type SceneEnvironment, type RGB } from './sceneEnvironment'

type Drop = { x: number; y: number; r: number; age: number; wait: number; speed: number; seed: number; trail: { x: number; y: number }[] }
type Rain = { x: number; y: number; speed: number; depth: number }
export interface SceneController {
  update: (environment: SceneEnvironment, reduced: boolean) => void
  setVisible: (visible: boolean) => void
  destroy: () => void
}
const noise = (n: number) => { const v = Math.sin(n * 97.13 + 113.79) * 43758.54; return v - Math.floor(v) }
const blend = (a: RGB, b: RGB, t: number) => a.map((v, i) => Math.round(mix(v, b[i], t))) as [number, number, number]
const rgb = (a: RGB) => 'rgb(' + a.join(',') + ')'

export function createHeroScene(canvas: HTMLCanvasElement, video: HTMLVideoElement, initial: SceneEnvironment, reduced: boolean): SceneController | null {
  const ctx = canvas.getContext('2d', { alpha: false })
  if (!ctx) return null
  const backing = document.createElement('canvas'), frost = document.createElement('canvas'), skyLayer = document.createElement('canvas')
  const scene = backing.getContext('2d'), glass = frost.getContext('2d'), sky = skyLayer.getContext('2d')
  if (!scene || !glass || !sky) return null
  const bed = new Image(), cloud = new Image(), meadow = new Image(), nightSky = new Image()
  const litBed = document.createElement('canvas'), litCloud = document.createElement('canvas')
  let lightingKey = '', surface: ReturnType<typeof createSceneSurface> = null, surfaceTried = false
  let env = initial, quiet = reduced, disposed = false, visible = true, pageVisible = !document.hidden
  let width = 1, height = 1, dpr = 1, frame = 0, previous = 0, elapsed = 0, videoWanted = false
  let hour = env.hour, rain = env.rain, fog = env.fog, wet = env.wetness
  let drops: Drop[] = [], streaks: Rain[] = []
  let cx = 0, cy = 0, size = 1
  const stage = document.querySelector<HTMLElement>('[data-cloud-bed-stage]')
  const canAnimate = () => visible && pageVisible && !quiet && !disposed
  bed.src = '/scene/cloud-bed-v1.webp'; cloud.src = '/scene/cloud-canopy-v1.webp'
  meadow.src = '/scene/meadow-v1.webp'; nightSky.src = '/scene/night-sky.webp'

  function syncVideo() {
    const want = canAnimate() && lightAt(hour).night > .05 && rain < .85
    if (want === videoWanted) return
    videoWanted = want
    if (want) void video.play().catch(() => { canvas.dataset.videoFallback = 'true' })
    else video.pause()
  }
  function measure() {
    const box = stage?.getBoundingClientRect()
    size = box ? Math.max(160, Math.min(box.width * .82, box.height * .98, width < 700 ? 335 : 420)) : Math.min(width * .75, height * .38, 400)
    cx = box ? box.left + box.width / 2 : width / 2
    cy = box ? box.top + box.height / 2 : height * .77
  }
  function resize() {
    width = innerWidth; height = innerHeight
    dpr = Math.min(devicePixelRatio || 1, width < 700 ? 1.25 : 1.5, Math.sqrt(2_200_000 / (width * height)))
    backing.width = canvas.width = skyLayer.width = Math.round(width * dpr)
    backing.height = canvas.height = skyLayer.height = Math.round(height * dpr)
    frost.width = Math.max(1, Math.round(width * dpr * .35)); frost.height = Math.max(1, Math.round(height * dpr * .35))
    ctx!.setTransform(dpr, 0, 0, dpr, 0, 0); scene!.setTransform(dpr, 0, 0, dpr, 0, 0); sky!.setTransform(dpr, 0, 0, dpr, 0, 0)
    glass!.setTransform(dpr * .35, 0, 0, dpr * .35, 0, 0)
    measure()
    streaks = Array.from({ length: width < 700 ? 110 : 240 }, (_, i) => ({ x: noise(i) * width, y: noise(i + 500) * height, speed: .5 + noise(i + 90), depth: noise(i + 48) }))
    drops = []; render(0)
  }
  function haze(x: number, y: number, rx: number, ry: number, opacity: number, color = '201,215,222') {
    if (opacity < .001) return
    scene!.save(); scene!.translate(x, y); scene!.scale(rx, ry)
    const gradient = scene!.createRadialGradient(0, 0, 0, 0, 0, 1)
    gradient.addColorStop(0, 'rgba(' + color + ',' + opacity + ')'); gradient.addColorStop(1, 'rgba(' + color + ',0)')
    scene!.fillStyle = gradient; scene!.fillRect(-1, -1, 2, 2); scene!.restore()
  }
  function prepareLighting(night: number, sunset: number) {
    const key = [night, sunset, rain].map(v => Math.round(v * 30)).join(':')
    if (key === lightingKey && litBed.width > 1) return
    lightingKey = key
    for (const [image, target] of [[bed, litBed], [cloud, litCloud]] as const) {
      if (!image.complete || !image.naturalWidth) continue
      target.width = image.naturalWidth; target.height = image.naturalHeight
      const paint = target.getContext('2d')!
      paint.filter = 'brightness(' + (1 - night * .22 - rain * .13) + ')'
      paint.drawImage(image, 0, 0); paint.filter = 'none'
      paint.globalCompositeOperation = 'source-atop'
      const tint = blend([143, 179, 228], [255, 175, 139], sunset)
      paint.fillStyle = 'rgba(' + tint.join(',') + ',' + Math.max(night * .24, sunset * .26, rain * .08) + ')'
      paint.fillRect(0, 0, target.width, target.height)
    }
  }
  function shelter(x: number, y: number, s: number) {
    const path = new Path2D()
    path.moveTo(x - s * .39, y - s * .06)
    path.quadraticCurveTo(x - s * .47, y + s * .2, x - s * .44, y + s * .42)
    path.quadraticCurveTo(x, y + s * .53, x + s * .44, y + s * .42)
    path.quadraticCurveTo(x + s * .47, y + s * .2, x + s * .39, y - s * .06)
    path.closePath(); return path
  }
  function rainbow(x: number, y: number, s: number) {
    if (rain < .015) return
    scene!.save(); scene!.globalCompositeOperation = 'screen'; scene!.clip(shelter(x, y, s))
    const spectrum = ['255,108,132', '255,167,91', '255,226,110', '130,233,164', '107,210,245', '157,153,255', '220,153,247']
    for (let i = 0; i < 7; i++) {
      const a = (i - 3) / 3, color = spectrum[i]
      const gradient = scene!.createLinearGradient(x, y - s * .08, x, y + s * .44)
      gradient.addColorStop(0, 'rgba(' + color + ',' + (.08 + rain * .25) + ')')
      gradient.addColorStop(.65, 'rgba(' + color + ',' + (.045 + rain * .12) + ')')
      gradient.addColorStop(1, 'rgba(' + color + ',0)')
      scene!.fillStyle = gradient
      scene!.beginPath(); scene!.moveTo(x + a * s * .27 - s * .035, y - s * .07)
      scene!.lineTo(x + a * s * .43 - s * .065, y + s * .44)
      scene!.quadraticCurveTo(x + a * s * .43, y + s * .48, x + a * s * .43 + s * .065, y + s * .44)
      scene!.lineTo(x + a * s * .27 + s * .035, y - s * .07); scene!.closePath(); scene!.fill()
    }
    // A fine spectral dome makes the shelter readable while its projected light stays translucent.
    for (let i = 0; i < 7; i++) {
      scene!.strokeStyle = 'rgba(' + spectrum[i] + ',' + (.18 + rain * .44) + ')'
      scene!.lineWidth = Math.max(1.2, s * .006)
      scene!.shadowColor = 'rgba(' + spectrum[i] + ',.25)'; scene!.shadowBlur = 4
      scene!.beginPath(); scene!.ellipse(x, y + s * .35, s * (.43 - i * .009), s * (.40 - i * .008), 0, Math.PI, Math.PI * 2); scene!.stroke()
    }
    scene!.shadowBlur = 0
    const edge = scene!.createLinearGradient(x - s * .46, y, x + s * .46, y)
    spectrum.forEach((color, i) => edge.addColorStop(i / 6, 'rgba(' + color + ',' + (.15 + rain * .3) + ')'))
    scene!.strokeStyle = edge; scene!.lineWidth = 2
    scene!.beginPath(); scene!.ellipse(x, y + s * .41, s * .44, s * .065, 0, 0, Math.PI); scene!.stroke()
    scene!.restore()
  }
  function star(x: number, y: number, radius: number, alpha: number) {
    scene!.shadowColor = 'rgba(255,226,151,' + alpha + ')'; scene!.shadowBlur = radius * 4
    scene!.fillStyle = 'rgba(255,235,182,' + alpha + ')'; scene!.beginPath()
    for (let p = 0; p < 10; p++) {
      const angle = p * Math.PI / 5 - Math.PI / 2, r = radius * (p % 2 ? .43 : 1)
      const px = x + Math.cos(angle) * r, py = y + Math.sin(angle) * r
      if (p) scene!.lineTo(px, py); else scene!.moveTo(px, py)
    }
    scene!.closePath(); scene!.fill(); scene!.shadowBlur = 0
  }
  function hangingStars(x: number, y: number, s: number, night: number, time: number) {
    if (night < .02) return
    scene!.save()
    const count = width < 700 ? 13 : 19
    for (let i = 0; i < count; i++) {
      const anchorX = x + (i / (count - 1) - .5) * s * .68
      const anchorY = y - s * (.043 + Math.sin(i * 1.7) * .012)
      const length = s * (.065 + noise(i + 75) * .15)
      const swing = quiet ? 0 : Math.sin(time * .45 + i * 1.2) * s * .008
      const alpha = night * (quiet ? 1 : .73 + .27 * Math.sin(time * .65 + i * 2.1) ** 2)
      scene!.strokeStyle = 'rgba(240,220,176,' + night * .34 + ')'; scene!.lineWidth = .65
      scene!.beginPath(); scene!.moveTo(anchorX, anchorY); scene!.quadraticCurveTo(anchorX + swing * .3, anchorY + length * .55, anchorX + swing, anchorY + length); scene!.stroke()
      star(anchorX + swing, anchorY + length, Math.max(2, s * (.0055 + noise(i + 113) * .005)), alpha)
    }
    scene!.restore()
  }
  function drawMeadow(time: number, night: number, sunset: number) {
    if (meadow.complete && meadow.naturalWidth && !surfaceTried) { surfaceTried = true; surface = createSceneSurface(meadow) }
    const grass = surface?.render(backing.width, backing.height, time, night, sunset, rain, wet)
    canvas.dataset.surface = grass ? 'webgl' : 'canvas'
    if (grass) scene!.drawImage(grass, 0, 0, grass.width, grass.height, 0, 0, width, height)
    else {
      scene!.save(); scene!.beginPath(); scene!.moveTo(0, height * .545)
      for (let i = 1; i <= 30; i++) { const x = i / 30; scene!.lineTo(width * x, height * (.53 + .085 * x + .015 * Math.cos(x * Math.PI))) }
      scene!.lineTo(width, height); scene!.lineTo(0, height); scene!.closePath(); scene!.clip()
      if (meadow.complete && meadow.naturalWidth) {
        const pattern = scene!.createPattern(meadow, 'repeat')!
        pattern.setTransform(new DOMMatrix().translate(0, time * 2).scale(width / meadow.naturalWidth))
        scene!.fillStyle = pattern
      } else scene!.fillStyle = '#739553'
      scene!.fillRect(0, height * .54, width, height * .46)
      scene!.fillStyle = 'rgba(7,19,42,' + (night * .65 + rain * .13) + ')'; scene!.fillRect(0, height * .54, width, height * .46)
      scene!.restore()
    }
  }
  function render(dt: number) {
    if (disposed || !width) return
    const moving = canAnimate(), time = quiet ? 0 : elapsed
    if (moving) {
      const delta = (env.hour - hour + 36) % 24 - 12
      hour = (hour + delta * (1 - Math.exp(-dt / 2)) + 24) % 24
      rain = approach(rain, env.rain, 3, dt); fog = approach(fog, env.fog, 6, dt)
      wet = Math.max(env.wetness, clamp(wet + rain * dt / 35 - (1 - rain) * dt / 480))
    } else if (quiet) { hour = env.hour; rain = env.rain; fog = env.fog; wet = Math.max(wet, env.wetness) }
    const light = lightAt(hour), night = light.night, sunset = light.sunset
    const top = blend(blend([65, 156, 199], [11, 18, 41], night), [85, 99, 151], sunset)
    const horizon = blend(blend([186, 219, 223], [49, 55, 86], night), [244, 177, 149], sunset)
    const overcast = rain * .65
    const wash = scene!.createLinearGradient(0, 0, 0, height * .64)
    wash.addColorStop(0, rgb(blend(top, [72, 88, 107], overcast))); wash.addColorStop(1, rgb(blend(horizon, [132, 146, 155], overcast)))
    scene!.fillStyle = wash; scene!.fillRect(0, 0, width, height)
    if (night > .015 && (video.readyState >= 2 || nightSky.naturalWidth)) {
      sky!.clearRect(0, 0, width, height)
      // Use only the central upper sky; the old movie's side mountains never enter this meadow.
      const movie = video.readyState >= 2
      const source = movie ? video : nightSky
      const sw = movie ? video.videoWidth * .4375 : nightSky.naturalWidth
      const sh = movie ? video.videoHeight * .4167 : nightSky.naturalHeight
      const aspect = width / (height * .67), cropW = Math.min(sw, sh * aspect), cropH = Math.min(sh, sw / aspect)
      const sx = (movie ? video.videoWidth * .28125 : 0) + (sw - cropW) / 2
      sky!.drawImage(source, sx, 0, cropW, cropH, 0, 0, width, height * .67)
      sky!.globalCompositeOperation = 'destination-in'
      const edge = sky!.createLinearGradient(0, height * .35, 0, height * .64)
      edge.addColorStop(0, 'rgba(255,255,255,.85)'); edge.addColorStop(1, 'rgba(255,255,255,0)')
      sky!.fillStyle = edge; sky!.fillRect(0, 0, width, height); sky!.globalCompositeOperation = 'source-over'
      scene!.save(); scene!.globalAlpha = night * (1 - rain * .95) * (1 - sunset * .85)
      scene!.drawImage(skyLayer, 0, 0, skyLayer.width, skyLayer.height, 0, 0, width, height); scene!.restore()
    }
    prepareLighting(night, sunset)
    if (litCloud.width > 1 && cloud.naturalWidth) for (let i = 0; i < 6; i++) {
      const z = noise(i + 2), travel = ((noise(i + 42) + time * (.0012 + z * .0005)) % 1.5) - .25
      const cloudWidth = Math.min(width * (.11 + z * .10), height * .21), cloudHeight = cloudWidth * litCloud.height / litCloud.width
      scene!.save(); scene!.globalAlpha = (.48 + z * .24) * (1 - night * .22)
      scene!.drawImage(litCloud, travel * width, height * (.045 + noise(i + 12) * .18), cloudWidth, cloudHeight); scene!.restore()
    }
    drawMeadow(time, night, sunset)
    if (fog > .02) for (let i = 0; i < 3; i++) {
      haze(width * (.2 + i * .3 + Math.sin(time * .025 + i) * .02), height * (.58 + i * .045), width * .4, height * .045, fog * (.22 - i * .035) * (1 - night * .4))
    }
    const bob = quiet ? 0 : Math.sin(time * .42) * Math.min(3.5, size * .01)
    const tilt = quiet ? 0 : Math.sin(time * .27) * .008
    const bedX = cx, bedY = cy + bob
    haze(bedX + size * .025, cy + size * .46, size * .31, size * .035, .20 - night * .08, '14,29,26')
    scene!.save(); scene!.translate(bedX, bedY); scene!.rotate(tilt)
    rainbow(0, 0, size)
    hangingStars(0, 0, size, night, time)
    if (bed.complete && bed.naturalWidth && litBed.width > 1) scene!.drawImage(litBed, -size / 2, -size / 2, size, size)
    scene!.restore()
    if (rain > .005) {
      scene!.save()
      const outside = new Path2D(); outside.rect(0, 0, width, height); outside.addPath(shelter(bedX, bedY, size))
      scene!.clip(outside, 'evenodd')
      for (const r of streaks) {
        if (moving) {
          r.y += dt * (190 + rain * 500) * r.speed; r.x -= dt * (8 + rain * 45) * r.speed
          if (r.y > height + 30) { r.y = -30; r.x = noise(r.x + time) * width }
          if (r.x < -20) r.x = width + 20
        }
        scene!.strokeStyle = 'rgba(202,224,239,' + rain * (.07 + r.depth * .17) + ')'; scene!.lineWidth = r.depth > .75 ? .9 : .5
        scene!.beginPath(); scene!.moveTo(r.x, r.y); scene!.lineTo(r.x + rain * (2 + r.depth * 5), r.y - (6 + rain * 19) * r.speed); scene!.stroke()
      }
      scene!.restore()
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
    canvas.dataset.scene = 'cloud-bed'; canvas.dataset.phase = env.phase; canvas.dataset.weather = env.weather
    canvas.dataset.renderTime = elapsed.toFixed(2); canvas.dataset.wetness = wet.toFixed(3)
    canvas.dataset.nightGlow = night.toFixed(3); canvas.dataset.sunset = sunset.toFixed(3)
    canvas.dataset.cameraScale = '1'; canvas.dataset.cameraX = '0'; canvas.dataset.cameraY = '0'
    canvas.dataset.bedX = bedX.toFixed(2); canvas.dataset.bedY = bedY.toFixed(2); canvas.dataset.bedSize = size.toFixed(2)
    canvas.dataset.bedTilt = tilt.toFixed(4); canvas.dataset.groundTravel = (time * .008).toFixed(4)
    canvas.dataset.rainbow = rain.toFixed(3); canvas.dataset.hangingStars = night > .02 ? String(width < 700 ? 13 : 19) : '0'
    canvas.dataset.drops = String(drops.length); canvas.dataset.dew = String(dew)
    if (bed.complete && bed.naturalWidth) { canvas.dataset.ready = 'true'; document.documentElement.dataset.heroSceneReady = 'true' }
    syncVideo()
  }
  function tick(now: number) {
    frame = 0
    if (!canAnimate()) return
    if (now - previous >= (width < 700 ? 1000 / 20 : 1000 / 30)) {
      const dt = Math.min(.12, (now - previous) / 1000); previous = now; elapsed += dt; render(dt)
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
  function reposition() { measure(); if (visible && pageVisible) render(0) }
  const observer = new ResizeObserver(reposition)
  if (stage) observer.observe(stage)
  const copy = document.querySelector('[data-home-hero] .hero-copy')
  if (copy) observer.observe(copy)
  const images = [bed, cloud, meadow, nightSky]
  images.forEach(image => { image.onload = () => { if (!disposed) { lightingKey = ''; render(0); start() } } })
  bed.onerror = () => {
    if (!bed.src.endsWith('.png') && !disposed) { canvas.dataset.assetFallback = 'true'; bed.src = '/scene/cloud-bed-v1.png' }
  }
  video.addEventListener('loadeddata', start)
  window.addEventListener('resize', resize); window.addEventListener('scroll', reposition, { passive: true })
  document.addEventListener('visibilitychange', visibility)
  resize(); start()
  return {
    update(next, reduce) {
      env = next; quiet = reduce; drops = quiet ? [] : drops
      if (quiet) { pause(); if (visible && pageVisible) render(0) } else start()
    },
    setVisible(value) { visible = value; canvas.dataset.paused = String(!value); if (value) { measure(); start() } else pause() },
    destroy() {
      disposed = true; pause(); observer.disconnect(); surface?.destroy(); images.forEach(image => { image.onload = image.onerror = null })
      video.removeEventListener('loadeddata', start); window.removeEventListener('resize', resize); window.removeEventListener('scroll', reposition)
      document.removeEventListener('visibilitychange', visibility); delete document.documentElement.dataset.heroSceneReady
      backing.width = backing.height = frost.width = frost.height = skyLayer.width = skyLayer.height = litBed.width = litCloud.width = 1
    },
  }
}
