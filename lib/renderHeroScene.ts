import skyline from './sceneSkyline.json'
import { approach, clamp, lightAt, type SceneEnvironment } from './sceneEnvironment'

type Drop = { x: number; y: number; r: number; age: number; wait: number; speed: number; seed: number; trail: { x: number; y: number }[] }
type Rain = { x: number; y: number; speed: number; depth: number }
export interface SceneController {
  update: (environment: SceneEnvironment, reduced: boolean) => void
  setVisible: (visible: boolean) => void
  destroy: () => void
}
// Coordinates are registered against the locked 1280 x 720 reference framing.
const NOISE = (n: number) => { const r = Math.sin(n * 97.13 + 113.79) * 43758.54; return r - Math.floor(r) }

// ponytail: One registered plate supports this locked camera. True parallax or moving shadows
// would need authored depth/3D geometry rather than additional full-frame effects.
export function createHeroScene(canvas: HTMLCanvasElement, video: HTMLVideoElement, initial: SceneEnvironment, reduced: boolean): SceneController | null {
  const ctx = canvas.getContext('2d', { alpha: false })
  if (!ctx) return null
  const SKY = new Path2D(skyline.path)
  const GROUND = new Path2D('M0 0H1280V720H0Z')
  GROUND.addPath(SKY)
  const WATER = new Path2D('M954 474C966 477 996 480 995 490C988 501 939 506 943 514C981 515 1081 540 1083 559C1072 573 1032 574 1043 583C1092 595 1177 588 1201 617C1221 642 1164 637 1178 651L1280 666V720L1203 717C1176 687 1101 673 1101 649C1102 628 1160 630 1159 619C1142 610 1054 604 1022 590C997 572 1046 564 1055 558C1041 545 973 530 945 524C911 514 947 498 979 490L950 481Z')
  const FALL = new Path2D('M982 405C978 416 975 420 973 432C970 445 961 452 953 464')
  const backing = document.createElement('canvas'), frost = document.createElement('canvas')
  const scene = backing.getContext('2d'), glass = frost.getContext('2d')
  if (!scene || !glass) return null
  const master = new Image(), fallback = new Image()
  let env = initial, quiet = reduced, disposed = false, visible = true, pageVisible = !document.hidden
  let width = 1, height = 1, dpr = 1, scale = 1, ox = 0, oy = 0, frame = 0, previous = 0, elapsed = 0
  let hour = env.hour, rain = env.rain, fog = env.fog, wet = env.wetness, runoff = env.stream, fall = env.waterfall
  let painted = false, videoWanted = false
  let drops: Drop[] = [], streaks: Rain[] = []
  master.src = '/scene/valley-day.webp'
  fallback.src = '/videos/hero-poster.jpg'
  const world = (c: CanvasRenderingContext2D) => { c.translate(ox, oy); c.scale(scale, scale) }
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
    scale = Math.max(width / 1280, height * (width < 700 ? .5 : 1) / 720)
    // A slight rightward framing on phones keeps the observer and the creek together.
    ox = (width - 1280 * scale) * (width < 700 ? .74 : .5); oy = (height - 720 * scale) * (width < 700 ? 1 : .5)
    drops = []
    streaks = Array.from({ length: width < 700 ? 100 : 220 }, () => ({ x: Math.random() * width, y: Math.random() * height, speed: .5 + Math.random(), depth: Math.random() }))
    render(0)
  }
  function haze(x: number, y: number, rx: number, ry: number, opacity: number, color = '201,215,222') {
    if (opacity < .001) return
    scene!.save(); scene!.translate(x, y); scene!.scale(rx, ry)
    const g = scene!.createRadialGradient(0, 0, 0, 0, 0, 1)
    g.addColorStop(0, 'rgba(' + color + ',' + opacity + ')'); g.addColorStop(1, 'rgba(' + color + ',0)')
    scene!.fillStyle = g; scene!.fillRect(-1, -1, 2, 2); scene!.restore()
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
      if (width < 700 && oy > 0) {
        // Extend the same sky above a wider phone framing; keep the observer, creek and waterfall in view.
        const skyWidth = source.naturalWidth * .5, skyHeight = source.naturalHeight * .3
        const fillHeight = oy + 180 * scale, zoom = Math.max(width / skyWidth, fillHeight / skyHeight)
        scene!.save(); scene!.beginPath(); scene!.rect(0, 0, width, fillHeight); scene!.clip()
        scene!.drawImage(source, source.naturalWidth * .25, 0, skyWidth, skyHeight, (width - skyWidth * zoom) * .5, 0, skyWidth * zoom, skyHeight * zoom)
        scene!.restore()
        const ratio = source.naturalWidth / 1280
        scene!.drawImage(source, 0, 160 * ratio, source.naturalWidth, source.naturalHeight - 160 * ratio, ox, oy + 160 * scale, 1280 * scale, 560 * scale)
        for (let y = 0; y < 160; y += 4) {
          scene!.globalAlpha = clamp((y + 2) / 160)
          scene!.drawImage(source, 0, y * ratio, source.naturalWidth, 4 * ratio, ox, oy + y * scale, 1280 * scale, 4 * scale)
        }
        scene!.globalAlpha = 1
      } else scene!.drawImage(source, ox, oy, 1280 * scale, 720 * scale)
      scene!.save(); scene!.globalCompositeOperation = 'multiply'
      const tint = light.tint.map(v => Math.round(v)).join(',')
      scene!.fillStyle = 'rgba(' + tint + ',' + (.08 + light.night * .28) + ')'; scene!.fillRect(0, 0, width, height)
      scene!.restore()
      scene!.fillStyle = 'rgba(4,9,20,' + clamp(1 - light.brightness + clouds * .18) + ')'; scene!.fillRect(0, 0, width, height)
    }
    // The existing night movie is used only above the registered skyline.
    scene!.save(); world(scene!); scene!.clip(SKY)
    if (light.night > .001 && (video.readyState >= 2 || fallback.naturalWidth)) {
      scene!.globalAlpha = light.night * (1 - clouds * .98)
      const nightSource = video.readyState >= 2 ? video : fallback
      if (width < 700) {
        const ratio = (video.readyState >= 2 ? video.videoWidth : fallback.naturalWidth) / 1280
        const skyHeight = oy + 520 * scale, zoom = Math.max(width / 560, skyHeight / 340)
        scene!.drawImage(nightSource, 360 * ratio, 0, 560 * ratio, 340 * ratio,
          ((width - 560 * zoom) * .5 - ox) / scale, -oy / scale, 560 * zoom / scale, 340 * zoom / scale)
      } else scene!.drawImage(nightSource, 0, 0, 1280, 720)
      scene!.globalAlpha = 1
    }
    const overcast = scene!.createLinearGradient(0, 0, 0, 510)
    overcast.addColorStop(0, 'rgba(21,35,57,' + clouds * .9 + ')')
    overcast.addColorStop(1, 'rgba(88,103,114,' + clouds * .75 + ')')
    scene!.fillStyle = overcast; scene!.fillRect(0, 0, 1280, 520)
    if (light.warmth > .01) haze(860, 450, 680, 310, light.warmth * .45, '255,184,111')
    for (let i = 0; i < 5; i++) {
      const x = ((i * 335 + elapsed * (1.3 + i * .2)) % 1800) - 250
      haze(x, 95 + i * 32, 270, 45, (.015 + clouds * .10) * (1 - light.night * .4))
    }
    scene!.restore()
    // Wet rock/grass retains darker diffuse color with low grazing reflections.
    scene!.save(); world(scene!); scene!.clip(GROUND, 'evenodd')
    scene!.fillStyle = 'rgba(10,24,35,' + wet * .15 + ')'; scene!.fillRect(0, 0, 1280, 720)
    for (let i = 0; i < 27; i++) {
      const x = 110 + NOISE(i) * 1120, y = 525 + NOISE(i + 90) * 195
      scene!.strokeStyle = 'rgba(192,207,212,' + wet * (.015 + NOISE(i + 30) * .045) + ')'
      scene!.lineWidth = .5; scene!.beginPath(); scene!.moveTo(x, y); scene!.lineTo(x + 3 + NOISE(i + 2) * 7, y - 1); scene!.stroke()
    }
    scene!.restore()
    // Animated reflections are clipped to the photographed channel, not floating line art.
    scene!.save(); world(scene!); scene!.clip(WATER)
    scene!.fillStyle = 'rgba(' + (runoff > .35 ? '98,91,70' : '49,100,128') + ',' + (.05 + runoff * .1) + ')'
    scene!.fillRect(900, 460, 380, 260)
    for (let i = 0; i < 74; i++) {
      const progress = ((i / 74 + elapsed * (.012 + runoff * .012)) % 1)
      const y = 478 + progress * 250, x = 915 + NOISE(i + 8) * 390, span = 1.2 + progress * 22
      scene!.strokeStyle = 'rgba(' + (light.night > .6 ? '182,203,226' : '231,243,242') + ',' + (.09 + NOISE(i) * .13) * (1 - light.night * .25) + ')'
      scene!.lineWidth = .45 + progress * .45; scene!.beginPath()
      scene!.moveTo(x - span, y); scene!.quadraticCurveTo(x, y + Math.sin(i + elapsed) * .8, x + span, y); scene!.stroke()
    }
    if (rain > .01) for (let i = 0; i < (width < 700 ? 14 : 32); i++) {
      const age = (elapsed * .7 + NOISE(i + 29)) % 1, r = age * (3 + NOISE(i + 44) * 8)
      scene!.strokeStyle = 'rgba(219,235,242,' + (1 - age) * rain * .25 + ')'; scene!.lineWidth = .5
      scene!.beginPath(); scene!.ellipse(945 + NOISE(i + 4) * 350, 488 + NOISE(i + 5) * 228, r, r * .22, 0, 0, Math.PI * 2); scene!.stroke()
    }
    scene!.restore()
    scene!.save(); world(scene!)
    scene!.strokeStyle = 'rgba(215,233,240,' + (.12 + fall * .21) * (1 - light.night * .5) + ')'
    scene!.lineWidth = .75 + fall * 1.7; scene!.lineCap = 'round'; scene!.setLineDash([2 + fall * 4, 6]); scene!.lineDashOffset = -elapsed * (6 + fall * 7); scene!.stroke(FALL); scene!.setLineDash([])
    haze(952, 465, 18 + fall * 18, 6 + fall * 8, (.035 + fall * .1) * (1 - light.night * .5))
    scene!.restore()
    // Three depth bands of valley mist; foreground objects stay legible.
    if (fog > .02) for (let i = 0; i < 3; i++) {
      haze(ox + (380 + i * 235 + Math.sin(elapsed * .018 + i) * 24) * scale, oy + (494 + i * 21) * scale,
        310 * scale, (20 + i * 10) * scale, fog * (.16 - i * .02) * (1 - light.night * .65))
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
  master.onload = fallback.onload = () => { if (!disposed) { render(0); start() } }
  master.onerror = () => { if (!disposed) { canvas.dataset.assetFallback = 'true'; render(0); start() } }
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
      disposed = true; pause(); master.onload = master.onerror = fallback.onload = null
      video.removeEventListener('loadeddata', start); window.removeEventListener('resize', resize)
      document.removeEventListener('visibilitychange', visibility)
      backing.width = backing.height = frost.width = frost.height = 1
    },
  }
}
