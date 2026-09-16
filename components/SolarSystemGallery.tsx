'use client'

import * as THREE from 'three'
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'

export interface GalleryItem {
  image: string
}

export interface PlanetSite {
  id: string
  textureUrl: string
  radius: number
  /** [x, y, z] in scene units. */
  position: [number, number, number]
  hasRing?: boolean
  ringTextureUrl?: string
  /** Undefined/empty = a decorative-only planet, not a gallery stop. */
  items?: GalleryItem[]
}

export interface SolarSystemGalleryHandle {
  /** Bring the item at this GLOBAL index (spanning every content planet, in
   *  `planets` prop order) into focus — same-planet items spin the ring as
   *  before; a different planet triggers the pull-back/fly-to sequence. */
  goTo: (globalIndex: number) => void
}

interface SolarSystemGalleryProps {
  planets: PlanetSite[]
  aspect?: number
  borderRadius?: number
  swipeEase?: number
  onItemClick?: (globalIndex: number) => void
  onActiveIndexChange?: (globalIndex: number) => void
  onActivePlanetChange?: (planetId: string) => void
}

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v))
}

function wrap01(v: number) {
  return v - Math.floor(v)
}

function smoothstep(edge0: number, edge1: number, x: number) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1)
  return t * t * (3 - 2 * t)
}

function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

function findIndex(obj: THREE.Object3D | null): number | undefined {
  let cur: THREE.Object3D | null = obj
  while (cur) {
    if (cur.userData.index !== undefined) return cur.userData.index as number
    cur = cur.parent
  }
  return undefined
}

// --- Scene layout --------------------------------------------------------
// Every content planet (one bearing gallery items) hosts the same craft/
// laser/hologram mechanic proven on the original single-Saturn scene: small
// craft ride the ring/orbit, grow and fire a laser as they near a fixed
// on-screen focus spot, and project a holographic preview card. The whole
// thing now happens at each planet's own position in a wider solar-system
// layout — the camera translates to `planet.position + CAMERA_OFFSET` (and
// keeps a fixed, unrotated orientation) whenever that planet is focused, so
// every planet gets an identical relative framing for free. Crossing to a
// different planet eases the camera out to a fixed overview shot of the
// whole system, then back in onto the target.
const CAMERA_FOV = 45
// Deltas from a focused planet's own group position to the camera/focus/
// craft-parking spots — derived from the original single-Saturn scene
// (planet at (0,-1,-10), camera at (0,0,14), focus at (0,0,8), craft parking
// at (0,0,6.6)) so Saturn's own framing stays pixel-identical.
const CAMERA_OFFSET = new THREE.Vector3(0, 1, 24)
const FOCUS_OFFSET = new THREE.Vector3(0, 1, 18)
const CRAFT_FOCUS_OFFSET = new THREE.Vector3(0, 1, 16.6)
const UNIT_Z = new THREE.Vector3(0, 0, 1)
const IDENTITY_QUAT = new THREE.Quaternion()

// Shared by the laser material and the screen's glow/edge/static tint so the
// beam and the hologram it projects read as one continuous piece of light —
// "laser white."
const LASER_WHITE = new THREE.Color(0xeaf6ff)

const CRAFT_SPIN_SPEED = 0.01
const IDLE_ORBIT_SPEED = 0.00045

// Approach is slow and deliberate; departure ("quickly flies back behind the
// planet") uses a much narrower window so it snaps away fast. Both are tuned
// to stay well under 1/count of the loop so two crafts on the same planet
// are never near the shared parking spot at once — numerically verified.
const APPROACH_WINDOW = 0.15
const DEPART_WINDOW = 0.06

const CRAFT_SCALE_FAR = 0.5
const CRAFT_SCALE_NEAR = 1.35

// Eased speed for a programmatic jump (arrow buttons, dots, keyboard) — much
// slower than drag-follow so the craft's full flight around the ring is
// visible rather than snapping straight to the next item.
const GOTO_EASE = 0.032

const SCREEN_HEIGHT = 3.4
const FOCUS_SCALE = 1.05
// Keep the screen's projected width within this fraction of the viewport,
// shrinking it on narrow/portrait (mobile) screens so it's never cropped —
// recomputed on resize.
const MAX_VIEWPORT_WIDTH_FRACTION = 0.84

// How long a planet's active hologram takes to fade out once a cross-planet
// jump begins, in the same fixed 0.016/frame time unit the rest of the
// scene's animation uses.
const DEPART_FADE_T = 0.3

// Cinematic camera pull-back/fly-to when crossing planets, in seconds
// (converted to the fixed-timestep frame convention at 60fps).
const TRANSITION_OUT_SECONDS = 1.1
const TRANSITION_IN_SECONDS = 1.3

const SCREEN_VERTEX = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`
const SCREEN_FRAGMENT = `
  precision highp float;
  uniform sampler2D uMap;
  uniform vec2 uImageSize;
  uniform vec2 uPlaneSize;
  uniform float uBorderRadius;
  // 1 while the point/line/plane is still forming — solid laser-white,
  // no noise, no image, so the shape it draws reads as pure light.
  uniform float uGlow;
  // 0 while showing hologram static (the real image is never sampled at
  // all during this) — 1 once fully revealed.
  uniform float uReveal;
  uniform float uFlicker;
  uniform float uTime;
  uniform vec3 uLaserWhite;
  varying vec2 vUv;

  float roundedBoxSDF(vec2 p, vec2 b, float r) {
    vec2 d = abs(p) - b;
    return length(max(d, vec2(0.0))) + min(max(d.x, d.y), 0.0) - r;
  }
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  void main() {
    float d = roundedBoxSDF(vUv - 0.5, vec2(0.5 - uBorderRadius), uBorderRadius);
    if (d > 0.02) discard;

    // Ambient "unstable projection" glitch — independent of open/close
    // state. Rare, brief bursts, not a constant shimmer. Drives BOTH the
    // edge noise below and (synced to the same instant) a dip in the main
    // image's opacity plus its own noise wash, so border and image glitch
    // together rather than independently.
    float glitchSlot = hash(vec2(floor(uTime * 2.2), 7.0));
    float glitchActive = step(0.9, glitchSlot) * (0.5 + 0.5 * sin(uTime * 70.0));

    vec3 color;
    float alpha = 1.0;
    if (uGlow > 0.5) {
      // Forming: the point/line/plane itself is made of laser light,
      // nothing else — no noise, no image.
      float pulse = 0.88 + 0.12 * sin(uTime * 34.0);
      color = uLaserWhite * pulse;
    } else {
      float reveal = clamp(uReveal, 0.0, 1.0);
      color = vec3(0.0);
      if (reveal < 0.999) {
        // Pure noise/scanline hologram static — the preview image is never
        // sampled here, so nothing of it can leak through before reveal.
        float noise = hash(floor(vUv * vec2(160.0, 100.0)) + floor(uTime * 22.0));
        float scan = 0.6 + 0.4 * sin(vUv.y * 380.0 - uTime * 46.0);
        color = uLaserWhite * (noise * 0.7 + 0.3) * scan * uFlicker;
      }
      if (reveal > 0.001) {
        vec2 ratio = vec2(
          min((uPlaneSize.x / uPlaneSize.y) / (uImageSize.x / uImageSize.y), 1.0),
          min((uPlaneSize.y / uPlaneSize.x) / (uImageSize.y / uImageSize.x), 1.0)
        );
        vec2 uv = vec2(
          vUv.x * ratio.x + (1.0 - ratio.x) * 0.5,
          vUv.y * ratio.y + (1.0 - ratio.y) * 0.5
        );
        // Clean and stable once revealed — no per-frame animated ripple
        // here. uFlicker still dims it during the brief pre-close flicker,
        // but otherwise this holds rock-steady except for the synced
        // glitch burst below.
        vec3 base = texture2D(uMap, uv).rgb;
        float imgNoise = hash(floor(vUv * vec2(140.0, 90.0)) + floor(uTime * 30.0));
        base = mix(base, uLaserWhite * imgNoise, glitchActive * 0.55);
        float imgAlpha = mix(1.0, 0.55, glitchActive);
        color = mix(color, base * uFlicker, reveal);
        alpha = mix(alpha, imgAlpha, reveal);
      }
    }

    float edge = smoothstep(-0.045, -0.01, d);
    vec3 edgeNoise = vec3(hash(vUv * 300.0 + uTime * 5.0));
    vec3 edgeColor = mix(uLaserWhite, edgeNoise, glitchActive * 0.7);
    float edgeStrength = edge * 0.55 * (1.0 + glitchActive * 0.6);
    color = mix(color, edgeColor, clamp(edgeStrength, 0.0, 1.0));
    alpha = mix(alpha, 1.0, edge);

    gl_FragColor = vec4(color, alpha);
  }
`

const RING_VERTEX = `
  uniform float uInner;
  uniform float uOuter;
  varying float vRadialU;
  void main() {
    float r = length(position.xy);
    vRadialU = clamp((r - uInner) / (uOuter - uInner), 0.0, 1.0);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`
const RING_FRAGMENT = `
  precision highp float;
  uniform sampler2D uRingMap;
  varying float vRadialU;
  void main() {
    vec4 tex = texture2D(uRingMap, vec2(vRadialU, 0.5));
    if (tex.a < 0.02) discard;
    gl_FragColor = tex;
  }
`

// A small shared craft design: elongated body + two wings + a glowing
// engine, instanced once per project (engine tint varies slightly by index).
function createCraftGeometry() {
  const body = new THREE.ConeGeometry(0.09, 0.34, 6)
  body.rotateX(Math.PI / 2)
  const wing = new THREE.BoxGeometry(0.3, 0.015, 0.1)
  return { body, wing }
}
const CRAFT_GEO = createCraftGeometry()

function createCraft(index: number): THREE.Group {
  const group = new THREE.Group()
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0xb9c2cc, roughness: 0.35, metalness: 0.75 })
  const body = new THREE.Mesh(CRAFT_GEO.body, bodyMat)
  group.add(body)

  const wingMat = new THREE.MeshStandardMaterial({ color: 0x82899a, roughness: 0.5, metalness: 0.6 })
  const wingL = new THREE.Mesh(CRAFT_GEO.wing, wingMat)
  wingL.position.set(-0.09, 0, -0.02)
  const wingR = wingL.clone()
  wingR.position.x = 0.09
  group.add(wingL, wingR)

  const engineHue = 0.5 + ((index * 0.21) % 1) * 0.12
  const engineColor = new THREE.Color().setHSL(engineHue, 0.9, 0.6)
  const engine = new THREE.Mesh(
    new THREE.SphereGeometry(0.04, 8, 8),
    new THREE.MeshStandardMaterial({ color: engineColor, emissive: engineColor, emissiveIntensity: 2.2, roughness: 0.4 })
  )
  engine.position.z = -0.19
  group.add(engine)

  return group
}

function createLaser(): THREE.Mesh {
  // Narrow at the craft (the source), flaring into a wide cone toward the
  // screen end — a projector beam, not a uniform pointer.
  const geometry = new THREE.CylinderGeometry(0.1, 0.018, 1, 10, 1, true)
  geometry.translate(0, 0.5, 0)
  geometry.rotateX(Math.PI / 2)
  const material = new THREE.MeshBasicMaterial({
    color: LASER_WHITE,
    transparent: true,
    opacity: 0.85,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  })
  return new THREE.Mesh(geometry, material)
}

// One planet in the scene: its mesh (+ optional ring/debris), and — if it
// carries gallery items — the full craft/laser/hologram-screen mechanic,
// scoped to this planet's own group. `active` gates whether the expensive
// per-item choreography runs (the focused planet) or a cheap idle orbit
// (every other content planet, glimpsed only from the wide overview shot).
class PlanetInstance {
  site: PlanetSite
  scene: THREE.Scene
  group = new THREE.Group()
  mesh!: THREE.Mesh
  ring?: THREE.Mesh
  debris: { mesh: THREE.Mesh; spin: THREE.Vector3 }[] = []

  count: number
  crafts: THREE.Group[] = []
  screens: THREE.Mesh[] = []
  lasers: THREE.Mesh[] = []
  craftSpin: number[] = []
  focusFactors: number[] = []
  itemOrbitRadius = 0

  progress = { current: 0, target: 0, ease: 0.08 }
  goToEaseActive = false
  active = false
  departing = false
  departT = 0
  idleT = 0
  activeIndex = -1

  // Scratch objects reused every frame to avoid per-item GC churn.
  _ringPos = new THREE.Vector3()
  _localPos = new THREE.Vector3()
  _craftWorldPos = new THREE.Vector3()
  _laserDir = new THREE.Vector3()
  _laserQuat = new THREE.Quaternion()
  _craftFocusLocal = new THREE.Vector3()
  _ringQuat = new THREE.Quaternion()
  _itemQuat = new THREE.Quaternion()
  _ringEuler = new THREE.Euler()
  _focusQuat = new THREE.Quaternion()

  constructor(site: PlanetSite, scene: THREE.Scene, aspect: number, borderRadius: number, swipeEase: number) {
    this.site = site
    this.scene = scene
    this.count = site.items?.length ?? 0
    this.progress.ease = swipeEase

    this.group.position.set(...site.position)
    scene.add(this.group)

    const loader = new THREE.TextureLoader()
    const tex = loader.load(site.textureUrl)
    tex.colorSpace = THREE.SRGBColorSpace
    this.mesh = new THREE.Mesh(
      new THREE.SphereGeometry(site.radius, 48, 48),
      new THREE.MeshStandardMaterial({ map: tex, roughness: 1, metalness: 0 })
    )
    this.group.add(this.mesh)

    if (site.hasRing && site.ringTextureUrl) {
      const ringInner = site.radius * 1.35
      const ringOuter = site.radius * 2.4
      const ringTex = loader.load(site.ringTextureUrl)
      ringTex.colorSpace = THREE.SRGBColorSpace
      this.ring = new THREE.Mesh(
        new THREE.RingGeometry(ringInner, ringOuter, 128),
        new THREE.ShaderMaterial({
          vertexShader: RING_VERTEX,
          fragmentShader: RING_FRAGMENT,
          uniforms: { uRingMap: { value: ringTex }, uInner: { value: ringInner }, uOuter: { value: ringOuter } },
          transparent: true,
          depthWrite: false,
          side: THREE.DoubleSide,
        })
      )
      this.ring.rotation.x = -Math.PI / 2
      this.group.add(this.ring)
      this.itemOrbitRadius = (ringInner + ringOuter) / 2

      this.buildDebris(ringInner, ringOuter)
    } else if (this.count > 0) {
      this.itemOrbitRadius = site.radius * 1.8
    }

    if (this.count > 0) this.buildItems(site.items!, aspect, borderRadius)
  }

  buildDebris(ringInner: number, ringOuter: number) {
    const geometry = new THREE.IcosahedronGeometry(1, 0)
    const count = 55
    for (let i = 0; i < count; i++) {
      const material = new THREE.MeshStandardMaterial({
        color: new THREE.Color().setHSL(0.09 + Math.random() * 0.05, 0.15 + Math.random() * 0.1, 0.3 + Math.random() * 0.3),
        roughness: 0.9,
        metalness: 0.05,
      })
      const mesh = new THREE.Mesh(geometry, material)
      const angle = Math.random() * Math.PI * 2
      const radius = ringInner * 0.9 + Math.random() * (ringOuter * 1.3 - ringInner * 0.9)
      const yJitter = (Math.random() - 0.5) * 0.18
      mesh.position.set(radius * Math.sin(angle), yJitter, radius * Math.cos(angle))
      mesh.scale.setScalar(0.05 + Math.random() * 0.16)
      mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI)
      this.group.add(mesh)
      this.debris.push({
        mesh,
        spin: new THREE.Vector3((Math.random() - 0.5) * 0.01, (Math.random() - 0.5) * 0.01, (Math.random() - 0.5) * 0.01),
      })
    }
  }

  buildItems(items: GalleryItem[], aspect: number, borderRadius: number) {
    const height = SCREEN_HEIGHT
    const width = height * aspect
    const screenGeometry = new THREE.PlaneGeometry(width, height)
    const loader = new THREE.TextureLoader()

    items.forEach((item, index) => {
      const craft = createCraft(index)
      craft.userData.index = index
      this.group.add(craft)
      this.crafts.push(craft)

      // Laser and screen are scene-level (world-space), NOT children of the
      // spinning group — the screen holds still at a fixed spot in front of
      // the camera while the craft (still riding the ring/orbit) beams
      // across the gap to it each time it swings into position.
      const laser = createLaser()
      laser.userData.index = index
      laser.visible = false
      this.scene.add(laser)
      this.lasers.push(laser)

      const screenMaterial = new THREE.ShaderMaterial({
        vertexShader: SCREEN_VERTEX,
        fragmentShader: SCREEN_FRAGMENT,
        transparent: true,
        depthWrite: false,
        uniforms: {
          uMap: { value: null },
          uImageSize: { value: new THREE.Vector2(1, 1) },
          uPlaneSize: { value: new THREE.Vector2(width, height) },
          uBorderRadius: { value: borderRadius },
          uGlow: { value: 0 },
          uReveal: { value: 0 },
          uFlicker: { value: 1 },
          uTime: { value: 0 },
          uLaserWhite: { value: new THREE.Vector3(LASER_WHITE.r, LASER_WHITE.g, LASER_WHITE.b) },
        },
      })
      const screen = new THREE.Mesh(screenGeometry, screenMaterial)
      screen.userData.index = index
      screen.position.copy(this.group.position).add(FOCUS_OFFSET)
      screen.scale.set(0.0001, 0.0001, 1)
      this.scene.add(screen)
      this.screens.push(screen)

      loader.load(item.image, (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace
        screenMaterial.uniforms.uMap.value = tex
        screenMaterial.uniforms.uImageSize.value.set(tex.image.width, tex.image.height)
      })
    })

    this.focusFactors = new Array(this.count).fill(0)
    this.craftSpin = new Array(this.count).fill(0)
  }

  // Brings local `index` to focus via the shortest direction around the
  // loop. `fromOffset` (in loop-fraction units) optionally starts the
  // traversal further back than the current position, so a planet that's
  // becoming newly focused always shows a visible flight-in rather than
  // popping straight to "arrived."
  goTo(index: number, fromOffsetSteps = 0) {
    if (this.count < 1) return
    const step = 1 / this.count
    if (fromOffsetSteps > 0) {
      this.progress.current = wrap01(this.progress.current - step * fromOffsetSteps)
      this.progress.target = this.progress.current
    }
    const targetFrac = wrap01(index * step)
    const currentFrac = wrap01(this.progress.target)
    let delta = targetFrac - currentFrac
    if (delta > 0.5) delta -= 1
    if (delta < -0.5) delta += 1
    this.progress.target += delta
    this.goToEaseActive = true
  }

  onCheck() {
    if (this.count < 1) return
    const step = 1 / this.count
    this.progress.target = Math.round(this.progress.target / step) * step
  }

  beginDepart() {
    this.departing = true
    this.departT = 0
  }

  // Cheap ambient motion for a content planet that isn't currently focused —
  // no laser/screen activity, just the craft still circulating so the
  // planet reads as "alive" if glimpsed during the wide overview shot.
  idleUpdate() {
    this.group.rotation.y += IDLE_ORBIT_SPEED
    if (this.count < 1) return
    this.idleT += IDLE_ORBIT_SPEED * 3
    for (let i = 0; i < this.count; i++) {
      const t = wrap01(this.idleT - i / this.count)
      const theta = t * Math.PI * 2
      this._ringPos.set(this.itemOrbitRadius * Math.sin(theta), 0, this.itemOrbitRadius * Math.cos(theta))
      this._ringEuler.set(-Math.PI / 2, -theta, 0)
      const craft = this.crafts[i]
      craft.position.copy(this._ringPos)
      craft.quaternion.setFromEuler(this._ringEuler)
      craft.scale.setScalar(CRAFT_SCALE_FAR)
      this.screens[i].scale.set(0.0001, 0.0001, 1)
      this.lasers[i].visible = false
    }
  }

  // The full craft/laser/hologram choreography — identical math to the
  // original single-Saturn scene, scoped to this planet's own group and
  // world-space focus offsets. Returns the local index currently in focus.
  activeUpdate(time: number): number {
    this.group.rotation.y += CRAFT_SPIN_SPEED * 0.06
    this.group.updateMatrixWorld()

    const ease = this.goToEaseActive ? GOTO_EASE : this.progress.ease
    this.progress.current += (this.progress.target - this.progress.current) * ease
    if (this.goToEaseActive && Math.abs(this.progress.target - this.progress.current) < 0.0005) {
      this.goToEaseActive = false
    }
    const masterT = this.progress.current

    this._craftFocusLocal.copy(this.group.position).add(CRAFT_FOCUS_OFFSET)
    this.group.worldToLocal(this._craftFocusLocal)
    this._focusQuat.copy(this.group.quaternion).invert()

    let departFade = 1
    if (this.departing) {
      this.departT += 0.016
      departFade = Math.max(0, 1 - this.departT / DEPART_FADE_T)
      if (this.departT >= DEPART_FADE_T) this.departing = false
    }

    let bestIndex = 0
    let bestFocus = -1

    for (let i = 0; i < this.count; i++) {
      const t = wrap01(masterT - i / this.count)
      const theta = t * Math.PI * 2
      const approaching = t > 0.5
      const distFromFocus = approaching ? 1 - t : t
      const window_ = approaching ? APPROACH_WINDOW : DEPART_WINDOW
      const lift = smoothstep(window_, 0, distFromFocus)

      this.focusFactors[i] = lift
      if (lift > bestFocus) {
        bestFocus = lift
        bestIndex = i
      }

      this.craftSpin[i] += CRAFT_SPIN_SPEED * (1 - lift)

      this._ringPos.set(this.itemOrbitRadius * Math.sin(theta), 0, this.itemOrbitRadius * Math.cos(theta))
      this._ringEuler.set(-Math.PI / 2, -theta + this.craftSpin[i], 0)
      this._ringQuat.setFromEuler(this._ringEuler)

      const craftMoveK = approaching ? smoothstep(0.04, 0.22, lift) : lift
      this._localPos.copy(this._ringPos).lerp(this._craftFocusLocal, craftMoveK)
      this._itemQuat.slerpQuaternions(this._ringQuat, this._focusQuat, craftMoveK)

      const craft = this.crafts[i]
      craft.position.copy(this._localPos)
      craft.quaternion.copy(this._itemQuat)
      craft.scale.setScalar(CRAFT_SCALE_FAR + (CRAFT_SCALE_NEAR - CRAFT_SCALE_FAR) * craftMoveK)

      const laserGrow = approaching ? smoothstep(0.3, 0.38, lift) : 0
      const laserVisibility = approaching ? smoothstep(0.3, 0.34, lift) * (1 - smoothstep(0.66, 0.74, lift)) : 0
      const laser = this.lasers[i]
      const focusWorld = this._focusWorldFor(i)
      if (laserVisibility > 0.01) {
        this._craftWorldPos.copy(this._localPos).applyMatrix4(this.group.matrixWorld)
        const dist = this._craftWorldPos.distanceTo(focusWorld)
        this._laserDir.copy(focusWorld).sub(this._craftWorldPos).normalize()
        this._laserQuat.setFromUnitVectors(UNIT_Z, this._laserDir)

        laser.visible = true
        const flickerNoise = Math.sin(time * 47 + i) * Math.sin(time * 13.3 + i * 2)
        const flicker = flickerNoise > -0.35 ? 1 : 0.2
        const mat = laser.material as THREE.MeshBasicMaterial
        mat.opacity = 0.85 * laserVisibility * flicker * departFade
        laser.position.copy(this._craftWorldPos)
        laser.quaternion.copy(this._laserQuat)
        laser.scale.set(1, 1, dist * laserGrow)
      } else {
        laser.visible = false
      }

      const screen = this.screens[i]
      const screenMat = screen.material as THREE.ShaderMaterial

      let scaleX: number
      let scaleY: number
      let glow: number
      let reveal: number
      if (approaching) {
        scaleX = laserGrow
        scaleY = smoothstep(0.4, 0.5, lift)
        glow = 1 - smoothstep(0.5, 0.54, lift)
        reveal = smoothstep(0.74, 0.88, lift)
      } else {
        scaleY = smoothstep(0, 0.62, lift)
        scaleX = smoothstep(0, 0.3, lift)
        glow = 0
        reveal = smoothstep(0.62, 0.82, lift)
      }
      const focusScaleAdjust = this._focusScaleAdjustRef!.value
      screen.scale.set(
        Math.max(scaleX, 0.0001) * focusScaleAdjust * departFade,
        Math.max(scaleY, 0.0001) * focusScaleAdjust * departFade,
        1
      )
      screenMat.uniforms.uGlow.value = glow
      screenMat.uniforms.uReveal.value = reveal
      screenMat.uniforms.uTime.value = time
      let flicker = 1
      if (glow < 0.5 && reveal < 0.999) {
        const screenFlickerNoise = Math.sin(time * 39 + i * 3) * Math.sin(time * 17 + i)
        flicker = screenFlickerNoise > -0.3 ? 1 : 0.35
      } else if (!approaching && reveal > 0.5) {
        const closeFlickerNoise = Math.sin(time * 53 + i * 4) * Math.sin(time * 21 + i)
        flicker = closeFlickerNoise > 0.1 ? 1 : 0.4
      }
      screenMat.uniforms.uFlicker.value = flicker
    }

    for (const d of this.debris) {
      d.mesh.rotation.x += d.spin.x
      d.mesh.rotation.y += d.spin.y
      d.mesh.rotation.z += d.spin.z
    }

    this.activeIndex = bestIndex
    return bestIndex
  }

  // Screens/lasers live in world space at `group.position + FOCUS_OFFSET` —
  // a getter would recompute a fresh vector every call, so callers get a
  // scratch vector instead (set once per activeUpdate via `_focusWorldFor`).
  _focusWorldScratch = new THREE.Vector3()
  _focusWorldFor(_i: number) {
    return this._focusWorldScratch.copy(this.group.position).add(FOCUS_OFFSET)
  }

  // Set by the App before calling activeUpdate — a shared, resize-driven
  // scale factor (same for every planet since the camera/focus geometry is
  // identical everywhere).
  _focusScaleAdjustRef: { value: number } | null = null

  hitTest(raycaster: THREE.Raycaster): number | null {
    const candidates: THREE.Object3D[] = [this.mesh, ...this.crafts, ...this.screens]
    const hits = raycaster.intersectObjects(candidates, true)
    if (hits.length === 0) return null
    const nearest = hits[0].object
    if (nearest === this.mesh) return null
    const index = findIndex(nearest)
    return index === undefined ? null : index
  }

  dispose() {
    this.scene.remove(this.group)
    ;[this.mesh, this.ring, ...this.debris.map((d) => d.mesh)].forEach((m) => {
      if (!m) return
      m.geometry.dispose()
      const mats = Array.isArray(m.material) ? m.material : [m.material]
      mats.forEach((mat) => {
        if ('map' in mat && (mat as THREE.MeshStandardMaterial).map) (mat as THREE.MeshStandardMaterial).map!.dispose()
        mat.dispose()
      })
    })
    this.crafts.forEach((c) => this.group.remove(c))
    this.screens.forEach((s) => {
      this.scene.remove(s)
      s.geometry.dispose()
      ;(s.material as THREE.Material).dispose()
    })
    this.lasers.forEach((l) => {
      this.scene.remove(l)
      l.geometry.dispose()
      ;(l.material as THREE.Material).dispose()
    })
  }
}

interface Transition {
  t: number
  phase: 'out' | 'in'
  fromCamPos: THREE.Vector3
  toPlanet: PlanetInstance
  pendingLocalIndex: number
}

class App {
  container: HTMLElement
  aspect: number
  onItemClick?: (globalIndex: number) => void
  onActiveIndexChange?: (globalIndex: number) => void
  onActivePlanetChange?: (planetId: string) => void
  swipeEase: number

  renderer: THREE.WebGLRenderer
  scene = new THREE.Scene()
  camera: THREE.PerspectiveCamera
  raycaster = new THREE.Raycaster()
  pointerNdc = new THREE.Vector2()

  planets: PlanetInstance[] = []
  contentPlanets: PlanetInstance[] = []
  focusedPlanet!: PlanetInstance
  cameraState: 'focused' | 'transitioning' = 'focused'
  transition: Transition | null = null
  overviewCameraPos = new THREE.Vector3()
  overviewLookAt = new THREE.Vector3()
  overviewQuat = new THREE.Quaternion()
  focusScaleAdjust = { value: FOCUS_SCALE }
  activeGlobalIndex = -1
  time = 0

  raf = 0
  isDown = false
  hasDragged = false
  pointerDownX = 0
  pointerDownY = 0
  pointerDownTime = 0
  dragStartProgress = 0

  boundOnResize: () => void
  boundOnTouchDown: (e: MouseEvent | TouchEvent) => void
  boundOnTouchMove: (e: MouseEvent | TouchEvent) => void
  boundOnTouchUp: (e: MouseEvent | TouchEvent) => void
  boundOnHoverMove: (e: MouseEvent) => void
  boundOnKeyDown: (e: KeyboardEvent) => void

  constructor(
    container: HTMLElement,
    planetSites: PlanetSite[],
    aspect: number,
    borderRadius: number,
    swipeEase: number,
    onItemClick?: (globalIndex: number) => void,
    onActiveIndexChange?: (globalIndex: number) => void,
    onActivePlanetChange?: (planetId: string) => void
  ) {
    this.container = container
    this.aspect = aspect
    this.swipeEase = swipeEase
    this.onItemClick = onItemClick
    this.onActiveIndexChange = onActiveIndexChange
    this.onActivePlanetChange = onActivePlanetChange

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' })
    this.renderer.setClearColor(0x000000, 0)
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    container.appendChild(this.renderer.domElement)

    this.camera = new THREE.PerspectiveCamera(CAMERA_FOV, 1, 0.1, 200)

    this.buildStarfield()
    this.buildLights()

    this.planets = planetSites.map((site) => {
      const p = new PlanetInstance(site, this.scene, aspect, borderRadius, swipeEase)
      p._focusScaleAdjustRef = this.focusScaleAdjust
      return p
    })
    this.contentPlanets = this.planets.filter((p) => p.count > 0)

    // Compute the overview camera framing so every planet's position fits
    // comfortably in view, with margin.
    this.computeOverviewFraming()
    const scratch = new THREE.Object3D()
    scratch.position.copy(this.overviewCameraPos)
    scratch.lookAt(this.overviewLookAt)
    this.overviewQuat.copy(scratch.quaternion)

    this.focusedPlanet = this.contentPlanets[0]
    this.focusedPlanet.active = true
    this.camera.position.copy(this.focusedPlanet.group.position).add(CAMERA_OFFSET)
    this.camera.quaternion.copy(IDENTITY_QUAT)

    this.onResize()

    this.boundOnResize = this.onResize.bind(this)
    this.boundOnTouchDown = this.onTouchDown.bind(this)
    this.boundOnTouchMove = this.onTouchMove.bind(this)
    this.boundOnTouchUp = this.onTouchUp.bind(this)
    this.boundOnHoverMove = this.onHoverMove.bind(this)
    this.boundOnKeyDown = this.onKeyDown.bind(this)
    window.addEventListener('resize', this.boundOnResize)
    window.addEventListener('mousedown', this.boundOnTouchDown)
    window.addEventListener('mousemove', this.boundOnTouchMove)
    window.addEventListener('mouseup', this.boundOnTouchUp)
    window.addEventListener('touchstart', this.boundOnTouchDown, { passive: true })
    window.addEventListener('touchmove', this.boundOnTouchMove, { passive: true })
    window.addEventListener('touchend', this.boundOnTouchUp)
    container.addEventListener('mousemove', this.boundOnHoverMove)
    container.addEventListener('keydown', this.boundOnKeyDown)

    this.update()
  }

  computeOverviewFraming() {
    let minX = Infinity
    let maxX = -Infinity
    let cx = 0
    let cz = 0
    for (const p of this.planets) {
      const reach = p.site.hasRing ? p.site.radius * 2.4 : p.site.radius
      const [px, , pz] = p.site.position
      minX = Math.min(minX, px - reach)
      maxX = Math.max(maxX, px + reach)
      cx += px
      cz += pz
    }
    cx /= this.planets.length
    cz /= this.planets.length
    const width = (maxX - minX) * 1.28
    this._overviewWidth = width
    this.overviewLookAt.set(cx, -3, cz)
    this.updateOverviewDistance()
  }

  _overviewWidth = 0

  updateOverviewDistance() {
    const aspect = Math.max(this.camera.aspect || 1, 0.5)
    const vFov = THREE.MathUtils.degToRad(CAMERA_FOV)
    // Distance needed so `_overviewWidth` fits within the horizontal FOV.
    const distForWidth = this._overviewWidth / (2 * Math.tan(vFov / 2) * aspect)
    const distance = Math.max(distForWidth, 40)
    const elevation = distance * 0.28
    this.overviewCameraPos.set(this.overviewLookAt.x, this.overviewLookAt.y + elevation, this.overviewLookAt.z + distance)
  }

  buildStarfield() {
    const count = 900
    const positions = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      const r = 60 + Math.random() * 90
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta)
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta)
      positions[i * 3 + 2] = r * Math.cos(phi) - 15
    }
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    const stars = new THREE.Points(
      geometry,
      new THREE.PointsMaterial({ color: 0xffffff, size: 0.09, sizeAttenuation: true, transparent: true, opacity: 0.7, depthWrite: false })
    )
    this.scene.add(stars)
  }

  buildLights() {
    const sun = new THREE.DirectionalLight(0xfff4e0, 1.5)
    sun.position.set(-8, 6, 10)
    this.scene.add(sun)
    this.scene.add(new THREE.AmbientLight(0x404050, 0.65))
  }

  // --- Global index <-> (planet, local index) ----------------------------

  get totalItems() {
    return this.contentPlanets.reduce((n, p) => n + p.count, 0)
  }

  resolveGlobalIndex(globalIndex: number): { planet: PlanetInstance; localIndex: number } | null {
    const total = this.totalItems
    if (total < 1) return null
    const wrapped = ((globalIndex % total) + total) % total
    let acc = 0
    for (const p of this.contentPlanets) {
      if (wrapped < acc + p.count) return { planet: p, localIndex: wrapped - acc }
      acc += p.count
    }
    return null
  }

  globalIndexOf(planet: PlanetInstance, localIndex: number): number {
    let acc = 0
    for (const p of this.contentPlanets) {
      if (p === planet) return acc + localIndex
      acc += p.count
    }
    return -1
  }

  // --- Navigation ----------------------------------------------------------

  goTo(globalIndex: number) {
    const resolved = this.resolveGlobalIndex(globalIndex)
    if (!resolved) return
    const { planet, localIndex } = resolved
    if (planet === this.focusedPlanet) {
      planet.goTo(localIndex)
    } else {
      this.beginCrossPlanetTransition(planet, localIndex)
    }
  }

  beginCrossPlanetTransition(targetPlanet: PlanetInstance, targetLocalIndex: number) {
    if (this.cameraState === 'transitioning') return
    this.cameraState = 'transitioning'
    this.focusedPlanet.beginDepart()
    this.transition = {
      t: 0,
      phase: 'out',
      fromCamPos: this.camera.position.clone(),
      toPlanet: targetPlanet,
      pendingLocalIndex: targetLocalIndex,
    }
  }

  onCheck() {
    this.focusedPlanet.onCheck()
  }

  hitTest(clientX: number, clientY: number): number | null {
    if (this.cameraState !== 'focused') return null
    const rect = this.container.getBoundingClientRect()
    this.pointerNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1
    this.pointerNdc.y = -((clientY - rect.top) / rect.height) * 2 + 1
    this.raycaster.setFromCamera(this.pointerNdc, this.camera)
    return this.focusedPlanet.hitTest(this.raycaster)
  }

  onTouchDown(e: MouseEvent | TouchEvent) {
    if (this.cameraState !== 'focused') return
    this.isDown = true
    this.hasDragged = false
    this.focusedPlanet.goToEaseActive = false
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
    this.pointerDownX = clientX
    this.pointerDownY = clientY
    this.pointerDownTime = performance.now()
    this.dragStartProgress = this.focusedPlanet.progress.target
  }

  onTouchMove(e: MouseEvent | TouchEvent) {
    if (!this.isDown) return
    const x = 'touches' in e ? e.touches[0].clientX : e.clientX
    if (Math.abs(x - this.pointerDownX) > 6) this.hasDragged = true
    const dx = this.pointerDownX - x
    const count = Math.max(this.focusedPlanet.count, 1)
    const delta = (dx / this.container.clientWidth) * (1 / count) * 1.6
    this.focusedPlanet.progress.target = this.dragStartProgress + delta
  }

  onTouchUp(e: MouseEvent | TouchEvent) {
    if (!this.isDown) return
    this.isDown = false
    const isQuickTap = !this.hasDragged && performance.now() - this.pointerDownTime < 500
    if (isQuickTap) {
      const localIndex = this.hitTest(this.pointerDownX, this.pointerDownY)
      if (localIndex !== null) {
        if (localIndex === this.focusedPlanet.activeIndex) {
          this.onItemClick?.(this.globalIndexOf(this.focusedPlanet, localIndex))
        } else {
          this.focusedPlanet.goTo(localIndex)
        }
      }
    }
    this.onCheck()
  }

  onHoverMove(e: MouseEvent) {
    if (this.isDown) return
    const index = this.hitTest(e.clientX, e.clientY)
    this.container.style.cursor = index !== null ? 'pointer' : 'grab'
  }

  onKeyDown(e: KeyboardEvent) {
    if (this.totalItems < 1) return
    const currentGlobal = this.globalIndexOf(this.focusedPlanet, this.focusedPlanet.activeIndex < 0 ? 0 : this.focusedPlanet.activeIndex)
    if (e.key === 'ArrowRight') {
      e.preventDefault()
      this.goTo(currentGlobal + 1)
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      this.goTo(currentGlobal - 1)
    }
  }

  onResize() {
    const width = this.container.clientWidth
    const height = this.container.clientHeight
    this.renderer.setSize(width, height)
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()

    const distance = CAMERA_OFFSET.z - FOCUS_OFFSET.z
    const vFov = THREE.MathUtils.degToRad(this.camera.fov)
    const visibleHeight = 2 * Math.tan(vFov / 2) * distance
    const visibleWidth = visibleHeight * this.camera.aspect
    const screenWorldWidth = SCREEN_HEIGHT * this.aspect
    const maxAllowed = visibleWidth * MAX_VIEWPORT_WIDTH_FRACTION
    this.focusScaleAdjust.value = Math.min(FOCUS_SCALE, (maxAllowed / screenWorldWidth) * FOCUS_SCALE)

    this.updateOverviewDistance()
  }

  update() {
    this.time += 0.016

    if (this.cameraState === 'transitioning' && this.transition) {
      const tr = this.transition
      tr.t += 1 / 60
      if (tr.phase === 'out') {
        const localT = clamp(tr.t / TRANSITION_OUT_SECONDS, 0, 1)
        const e = easeInOutCubic(localT)
        this.camera.position.lerpVectors(tr.fromCamPos, this.overviewCameraPos, e)
        this.camera.quaternion.slerpQuaternions(IDENTITY_QUAT, this.overviewQuat, e)
        if (localT >= 1) {
          tr.phase = 'in'
          tr.t = 0
        }
      } else {
        const localT = clamp(tr.t / TRANSITION_IN_SECONDS, 0, 1)
        const e = easeInOutCubic(localT)
        this._toCamPosScratch.copy(tr.toPlanet.group.position).add(CAMERA_OFFSET)
        this.camera.position.lerpVectors(this.overviewCameraPos, this._toCamPosScratch, e)
        this.camera.quaternion.slerpQuaternions(this.overviewQuat, IDENTITY_QUAT, e)
        if (localT >= 1) {
          this.camera.position.copy(this._toCamPosScratch)
          this.camera.quaternion.copy(IDENTITY_QUAT)
          this.focusedPlanet = tr.toPlanet
          this.focusedPlanet.active = true
          this.focusedPlanet.departing = false
          // Force a visible flight-in rather than popping straight to
          // "arrived" on first focus.
          this.focusedPlanet.goTo(tr.pendingLocalIndex, 1.4)
          this.cameraState = 'focused'
          this.transition = null
          this.onActivePlanetChange?.(this.focusedPlanet.site.id)
        }
      }
    }

    for (const planet of this.planets) {
      if (planet === this.focusedPlanet || planet.departing) {
        const bestLocal = planet.activeUpdate(this.time)
        if (planet === this.focusedPlanet) {
          const global = this.globalIndexOf(planet, bestLocal)
          if (global !== this.activeGlobalIndex) {
            this.activeGlobalIndex = global
            this.onActiveIndexChange?.(global)
          }
        }
        if (planet.departing === false && planet !== this.focusedPlanet) {
          // Finished fading out after a cross-planet jump — go fully idle.
          planet.active = false
        }
      } else {
        planet.idleUpdate()
      }
    }

    this.renderer.render(this.scene, this.camera)
    this.raf = window.requestAnimationFrame(this.update.bind(this))
  }

  _toCamPosScratch = new THREE.Vector3()

  destroy() {
    window.cancelAnimationFrame(this.raf)
    window.removeEventListener('resize', this.boundOnResize)
    window.removeEventListener('mousedown', this.boundOnTouchDown)
    window.removeEventListener('mousemove', this.boundOnTouchMove)
    window.removeEventListener('mouseup', this.boundOnTouchUp)
    window.removeEventListener('touchstart', this.boundOnTouchDown)
    window.removeEventListener('touchmove', this.boundOnTouchMove)
    window.removeEventListener('touchend', this.boundOnTouchUp)
    this.container.removeEventListener('mousemove', this.boundOnHoverMove)
    this.container.removeEventListener('keydown', this.boundOnKeyDown)

    this.planets.forEach((p) => p.dispose())
    this.scene.traverse((obj) => {
      if (obj instanceof THREE.Points) {
        obj.geometry.dispose()
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material]
        mats.forEach((m) => m.dispose())
      }
    })
    this.renderer.dispose()
    if (this.renderer.domElement.parentNode) this.renderer.domElement.parentNode.removeChild(this.renderer.domElement)
  }
}

const SolarSystemGallery = forwardRef<SolarSystemGalleryHandle, SolarSystemGalleryProps>(function SolarSystemGallery(
  { planets, aspect = 16 / 9, borderRadius = 0.04, swipeEase = 0.08, onItemClick, onActiveIndexChange, onActivePlanetChange },
  ref
) {
  const containerRef = useRef<HTMLDivElement>(null)
  const appRef = useRef<App | null>(null)
  const onItemClickRef = useRef(onItemClick)
  onItemClickRef.current = onItemClick
  const onActiveIndexChangeRef = useRef(onActiveIndexChange)
  onActiveIndexChangeRef.current = onActiveIndexChange
  const onActivePlanetChangeRef = useRef(onActivePlanetChange)
  onActivePlanetChangeRef.current = onActivePlanetChange

  useImperativeHandle(ref, () => ({
    goTo: (globalIndex: number) => appRef.current?.goTo(globalIndex),
  }), [])

  useEffect(() => {
    if (!containerRef.current) return
    const app = new App(
      containerRef.current,
      planets,
      aspect,
      borderRadius,
      swipeEase,
      (i) => onItemClickRef.current?.(i),
      (i) => onActiveIndexChangeRef.current?.(i),
      (id) => onActivePlanetChangeRef.current?.(id)
    )
    appRef.current = app
    return () => {
      app.destroy()
      appRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planets, aspect, borderRadius, swipeEase])

  return (
    <div
      ref={containerRef}
      className="h-full w-full cursor-grab touch-pan-y outline-none active:cursor-grabbing"
      tabIndex={0}
      role="region"
      aria-label="Project gallery. Swipe left or right to spin through projects, tap the focused one to view details."
    />
  )
})

export default SolarSystemGallery
