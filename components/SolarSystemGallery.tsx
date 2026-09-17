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
  /** Distance from its orbit parent's center. 0 for the Sun (stays fixed). */
  orbitRadius: number
  /** Radians advanced per frame — ambient, continuous revolution. */
  orbitSpeed: number
  /** Starting angle around the orbit, radians. */
  orbitPhase?: number
  /** Defaults to the Sun (fixed at the origin). The Moon sets this to 'earth'. */
  orbitParent?: string
  hasRing?: boolean
  ringTextureUrl?: string
  /** Undefined/empty = a decorative-only planet, not a gallery stop. */
  items?: GalleryItem[]
}

export interface SolarSystemGalleryHandle {
  /** Zoom from the overview into this planet. */
  enterPlanet: (planetId: string) => void
  /** Zoom back out to the full solar-system overview. */
  leavePlanet: () => void
  /** Bring the item at this LOCAL index (within the currently-entered
   *  planet) into focus — ignored while in the overview. */
  goTo: (localIndex: number) => void
}

interface HoverInfo {
  localIndex: number
  clientX: number
  clientY: number
}

interface SolarSystemGalleryProps {
  planets: PlanetSite[]
  aspect?: number
  borderRadius?: number
  swipeEase?: number
  onItemClick?: (localIndex: number) => void
  onActiveIndexChange?: (localIndex: number | null) => void
  onActivePlanetChange?: (planetId: string | null) => void
  onHoverChange?: (info: HoverInfo | null) => void
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

function findPlanetId(obj: THREE.Object3D | null): string | undefined {
  let cur: THREE.Object3D | null = obj
  while (cur) {
    if (cur.userData.planetId !== undefined) return cur.userData.planetId as string
    cur = cur.parent
  }
  return undefined
}

// --- Scene layout --------------------------------------------------------
// The overview is a true top-down shot of the whole system, Sun at the
// center, every planet on its own continuously-revolving circular orbit
// (thin ring lines mark each path) — the Moon's own orbit is around Earth's
// current position, not the Sun's. Entering a planet (click its mesh, or
// its top-left badge) hides every other planet and eases the camera onto
// `planet.position + planet.cameraOffset()` (scaled per-planet so every
// planet fills the same apparent size once entered, regardless of its real
// radius) with a fixed, unrotated orientation, tracking it live as it keeps
// slowly orbiting. Only THEN do that planet's own craft become visible,
// idly riding its ring/orbit — clicking one flies it up to a fixed
// on-screen focus spot and projects its holographic preview; nothing is
// auto-selected on entry.
const CAMERA_FOV = 45
// Deltas from a focused planet's own group position to the camera/focus/
// craft-parking spots, AT Saturn's own scale (the original single-Saturn
// scene's exact values, so Saturn's close-up framing stays pixel-identical).
// Every other planet's actual offsets are these scaled by its own
// `viewScale` (see PlanetInstance) so every planet fills the same apparent
// size once entered, regardless of its real radius.
const BASE_CAMERA_OFFSET = new THREE.Vector3(0, 1, 24)
const BASE_FOCUS_OFFSET = new THREE.Vector3(0, 1, 18)
const BASE_CRAFT_FOCUS_OFFSET = new THREE.Vector3(0, 1, 16.6)
// Saturn's own bare radius (its ring is a bonus on top, not counted) — the
// reference every other planet's `viewScale` is computed against, so every
// planet's actual sphere reads at the same apparent size once entered.
const REFERENCE_RADIUS = 3.2
const UNIT_Z = new THREE.Vector3(0, 0, 1)
const IDENTITY_QUAT = new THREE.Quaternion()
const ORIGIN = new THREE.Vector3(0, 0, 0)

// Shared by the laser material and the screen's glow/edge/static tint so the
// beam and the hologram it projects read as one continuous piece of light —
// "laser white."
const LASER_WHITE = new THREE.Color(0xeaf6ff)

const CRAFT_SPIN_SPEED = 0.01
const SELF_SPIN_SPEED = 0.0018

// Approach is slow and deliberate; departure ("quickly flies back behind
// the planet") uses a much narrower window so it snaps away fast. Both are
// tuned to stay well under 1/count of the loop so two crafts on the same
// planet are never near the shared parking spot at once — numerically
// verified.
const APPROACH_WINDOW = 0.15
const DEPART_WINDOW = 0.06

const CRAFT_SCALE_FAR = 0.5
const CRAFT_SCALE_NEAR = 1.35

// Eased speed for a programmatic jump (arrow buttons, dots, badges) — much
// slower than drag-follow so the craft's full flight is visible rather than
// snapping straight to the next item.
const GOTO_EASE = 0.032
// Per-frame step for the screen's own reveal timer, independent of
// GOTO_EASE — reaches 1 in ~20 frames (~0.33s) once the plane has formed,
// so the "flickering to life" moment always resolves quickly.
const REVEAL_TIMER_STEP = 1 / 20

const SCREEN_HEIGHT = 3.4
const FOCUS_SCALE = 1.05
// Keep the screen's projected width within this fraction of the viewport,
// shrinking it on narrow/portrait (mobile) screens so it's never cropped —
// recomputed on resize.
const MAX_VIEWPORT_WIDTH_FRACTION = 0.84

// Enter/leave camera moves, in seconds.
const ENTER_SECONDS = 1.6
const LEAVE_SECONDS = 1.3

// Overview framing — a true top-down shot (camera directly above the Sun,
// looking straight down) so every orbit, which is geometrically a circle in
// the XZ plane, actually reads as a circle rather than being foreshortened
// into an ellipse by a tilted viewing angle.
const OVERVIEW_MARGIN = 1.35
// Looking straight down (-Y) makes the default (0,1,0) up-vector parallel
// to the view direction, which is a degenerate/undefined case for
// Object3D.lookAt(). Using world -Z as "up on screen" instead keeps the
// orientation well-defined and gives a conventional top-down map layout.
const OVERVIEW_UP = new THREE.Vector3(0, 0, -1)

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
        // Chromatic aberration — the red/blue channels sample slightly
        // outward from center, growing toward the edges, the classic
        // "unstable projection" fringe. Clean at the center, colored fringe
        // at the rim, reinforcing it as light rather than a flat image.
        vec2 caCenter = vUv - 0.5;
        float caDist = length(caCenter);
        vec2 caDir = caDist > 0.0001 ? caCenter / caDist : vec2(0.0);
        float caAmount = 0.007 * smoothstep(0.18, 0.5, caDist);
        vec3 base = vec3(
          texture2D(uMap, uv + caDir * caAmount).r,
          texture2D(uMap, uv).g,
          texture2D(uMap, uv - caDir * caAmount).b
        );
        float imgNoise = hash(floor(vUv * vec2(140.0, 90.0)) + floor(uTime * 30.0));
        base = mix(base, uLaserWhite * imgNoise, glitchActive * 0.55);
        float imgAlpha = mix(1.0, 0.55, glitchActive);
        color = mix(color, base * uFlicker, reveal);
        alpha = mix(alpha, imgAlpha, reveal);

        // A bright scan-band slowly sweeping down the revealed image —
        // reads as an active projection/scan rather than instability, the
        // way the static/glitch effects do.
        float scanY = fract(uTime * 0.12);
        float scanDist = abs(vUv.y - (1.0 - scanY));
        float scanBand = smoothstep(0.05, 0.0, scanDist) * 0.32;
        color += uLaserWhite * scanBand * reveal * uFlicker;
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
// engine + a soft pulsing halo ring, instanced once per project (engine
// tint varies slightly by index).
function createCraftGeometry() {
  const body = new THREE.ConeGeometry(0.09, 0.34, 6)
  body.rotateX(Math.PI / 2)
  const wing = new THREE.BoxGeometry(0.3, 0.015, 0.1)
  const halo = new THREE.RingGeometry(0.17, 0.205, 28)
  return { body, wing, halo }
}
const CRAFT_GEO = createCraftGeometry()

function createCraft(index: number): { group: THREE.Group; halo: THREE.Mesh } {
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

  // A gently pulsing ring around the craft — a "this is clickable" cue
  // while it idles on the ring, before anything's been selected.
  const halo = new THREE.Mesh(
    CRAFT_GEO.halo,
    new THREE.MeshBasicMaterial({
      color: LASER_WHITE,
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
  )
  group.add(halo)

  return { group, halo }
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

function createOrbitRing(radius: number): THREE.LineLoop {
  const segments = 160
  const points: THREE.Vector3[] = []
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * Math.PI * 2
    points.push(new THREE.Vector3(radius * Math.cos(a), 0, radius * Math.sin(a)))
  }
  const geometry = new THREE.BufferGeometry().setFromPoints(points)
  const material = new THREE.LineBasicMaterial({ color: 0xc9a84c, transparent: true, opacity: 0.32 })
  return new THREE.LineLoop(geometry, material)
}

// One planet in the scene: its mesh (+ optional ring/debris/orbit line),
// continuously revolving around its orbit parent, and — if it carries
// gallery items — the full craft/laser/hologram-screen mechanic. Craft stay
// hidden until the planet is entered; once entered they idle on the ring
// with nothing selected until the user clicks one.
class PlanetInstance {
  site: PlanetSite
  scene: THREE.Scene
  group = new THREE.Group()
  mesh!: THREE.Mesh
  ring?: THREE.Mesh
  orbitLine?: THREE.LineLoop
  debris: { mesh: THREE.Mesh; spin: THREE.Vector3 }[] = []
  orbitAngle: number

  count: number
  crafts: THREE.Group[] = []
  crewHalos: THREE.Mesh[] = []
  screens: THREE.Mesh[] = []
  lasers: THREE.Mesh[] = []
  craftSpin: number[] = []
  focusFactors: number[] = []
  revealTimer: number[] = []
  itemOrbitRadius = 0

  progress = { current: 0.5, target: 0.5, ease: 0.08 }
  goToEaseActive = false
  /** True once the user has clicked (or arrowed to) a specific item on this
   *  planet — before that, every craft just idles on the ring. */
  anySelected = false
  activeIndex = -1
  /** The item `goTo()` last targeted — the one that should read as "open
   *  and stable," independent of which side of the ring-position wraparound
   *  its `t` value happens to converge on (see `activeUpdate`'s use of it:
   *  the geometric approach/depart split isn't reliable as an "is this open
   *  or closing" signal, since which side a settled item lands on depends
   *  on incidental navigation direction, not actual open/close intent —
   *  most visible on a single-item planet, where it was always the same
   *  side, causing the hologram to read as permanently mid-close). -1 =
   *  nothing targeted. */
  openIndex = -1

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
  _focusWorldScratch = new THREE.Vector3()
  _cameraOffsetScratch = new THREE.Vector3()
  _focusOffsetScratch = new THREE.Vector3()
  _craftFocusOffsetScratch = new THREE.Vector3()

  cameraOffset(): THREE.Vector3 {
    return this._cameraOffsetScratch.copy(BASE_CAMERA_OFFSET).multiplyScalar(this.viewScale)
  }
  focusOffset(): THREE.Vector3 {
    return this._focusOffsetScratch.copy(BASE_FOCUS_OFFSET).multiplyScalar(this.viewScale)
  }
  craftFocusOffset(): THREE.Vector3 {
    return this._craftFocusOffsetScratch.copy(BASE_CRAFT_FOCUS_OFFSET).multiplyScalar(this.viewScale)
  }

  // Set by the App before calling activeUpdate — a shared, resize-driven
  // scale factor (same for every planet since the camera/focus geometry is
  // identical everywhere).
  _focusScaleAdjustRef: { value: number } | null = null

  /** Scales the camera/focus/craft-parking offsets and the hologram screen
   *  so every planet fills the same apparent size once entered and its
   *  screen reads at the same size, regardless of its real radius. 1 for
   *  Saturn itself (the reference). */
  viewScale: number

  constructor(site: PlanetSite, scene: THREE.Scene, aspect: number, borderRadius: number, swipeEase: number, seedIndex: number) {
    this.site = site
    this.scene = scene
    this.count = site.items?.length ?? 0
    this.progress.ease = swipeEase
    this.orbitAngle = site.orbitPhase ?? seedIndex * 2.399963 // golden-angle-ish spread
    this.viewScale = site.radius / REFERENCE_RADIUS

    scene.add(this.group)
    this.group.userData.planetId = site.id

    const loader = new THREE.TextureLoader()
    const tex = loader.load(site.textureUrl)
    tex.colorSpace = THREE.SRGBColorSpace
    // The Sun is a light source, not something lit by one — emissive so it
    // glows on its own regardless of the scene's actual lighting.
    const isSun = site.id === 'sun'
    this.mesh = new THREE.Mesh(
      new THREE.SphereGeometry(site.radius, 48, 48),
      isSun
        ? new THREE.MeshBasicMaterial({ map: tex })
        : new THREE.MeshStandardMaterial({ map: tex, roughness: 1, metalness: 0 })
    )
    this.mesh.userData.planetId = site.id
    this.group.add(this.mesh)

    if (site.orbitRadius > 0) {
      this.orbitLine = createOrbitRing(site.orbitRadius)
      if (site.orbitParent) {
        // Parented at construction time by the App once every instance
        // exists (see App constructor) so it can track a moving parent
        // (the Moon's ring follows Earth).
      } else {
        scene.add(this.orbitLine)
      }
    }

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
      const { group: craft, halo } = createCraft(index)
      craft.userData.index = index
      craft.visible = false
      this.group.add(craft)
      this.crafts.push(craft)
      this.crewHalos.push(halo)

      // Laser and screen are scene-level (world-space), NOT children of the
      // orbiting group — the screen holds still at a fixed spot in front of
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
      screen.visible = false
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
    this.revealTimer = new Array(this.count).fill(0)
  }

  advanceOrbit(parentPos: THREE.Vector3) {
    this.orbitAngle += this.site.orbitSpeed
    this.group.position.set(
      parentPos.x + this.site.orbitRadius * Math.cos(this.orbitAngle),
      parentPos.y,
      parentPos.z + this.site.orbitRadius * Math.sin(this.orbitAngle)
    )
    this.group.rotation.y += SELF_SPIN_SPEED
  }

  // Distance from this planet's own orbit parent (not necessarily the Sun —
  // the Moon's is relative to Earth). Used only for overview framing, where
  // underestimating the Moon's true Sun-distance by Earth's own orbit
  // radius is harmless: Earth's radius alone already dwarfs the Moon's
  // small extra offset next to the outer planets that actually set the
  // framing extent.
  orbitRadius0() {
    return this.site.orbitRadius
  }

  setCraftVisible(visible: boolean) {
    this.crafts.forEach((c) => (c.visible = visible))
    if (!visible) {
      this.screens.forEach((s) => (s.visible = false))
      this.lasers.forEach((l) => (l.visible = false))
    }
  }

  // Hides the planet itself (mesh/ring/debris, all children of `group`) and
  // its orbit line — used so entering one planet hides every other one
  // (including, once close up, its own now-enormous-looking orbit ring).
  setSceneVisible(visible: boolean) {
    this.group.visible = visible
    if (this.orbitLine) this.orbitLine.visible = visible
  }

  // Brings local `index` to focus via the shortest direction around the
  // loop.
  goTo(index: number) {
    if (this.count < 1) return
    this.anySelected = true
    this.openIndex = index
    const step = 1 / this.count
    const targetFrac = wrap01(index * step)
    const currentFrac = wrap01(this.progress.target)
    let delta = targetFrac - currentFrac
    if (delta > 0.5) delta -= 1
    if (delta < -0.5) delta += 1
    this.progress.target += delta
    this.goToEaseActive = true
  }

  onCheck() {
    if (this.count < 1 || !this.anySelected) return
    const step = 1 / this.count
    this.progress.target = Math.round(this.progress.target / step) * step
  }

  resetSelection() {
    this.anySelected = false
    this.activeIndex = -1
    this.openIndex = -1
    this.progress.current = 0.5 / Math.max(this.count, 1)
    this.progress.target = this.progress.current
    this.goToEaseActive = false
    this.screens.forEach((s) => {
      s.scale.set(0.0001, 0.0001, 1)
      s.visible = false
    })
    this.lasers.forEach((l) => (l.visible = false))
  }

  // Cheap idle circulation for every item on the ring/orbit — used both
  // while nothing's selected yet and (via the halo pulse) once something
  // is, for the items NOT currently near the focus point.
  _idlePosition(i: number, t: number, time: number) {
    const theta = t * Math.PI * 2
    this._ringPos.set(this.itemOrbitRadius * Math.sin(theta), 0, this.itemOrbitRadius * Math.cos(theta))
    this._ringEuler.set(-Math.PI / 2, -theta, 0)
    const craft = this.crafts[i]
    craft.position.copy(this._ringPos)
    craft.quaternion.setFromEuler(this._ringEuler)
    craft.scale.setScalar(CRAFT_SCALE_FAR)
    const halo = this.crewHalos[i]
    const pulse = 0.35 + 0.25 * (0.5 + 0.5 * Math.sin(time * 3.2 + i * 1.7))
    ;(halo.material as THREE.MeshBasicMaterial).opacity = pulse
  }

  // The full craft/laser/hologram choreography once at least one item has
  // been selected — identical math to the original single-Saturn scene,
  // scoped to this planet's own group and world-space focus offsets. Items
  // not near the focus point just ride the ring via `_idlePosition`.
  activeUpdate(time: number): number {
    const ease = this.goToEaseActive ? GOTO_EASE : this.progress.ease
    this.progress.current += (this.progress.target - this.progress.current) * ease
    if (this.goToEaseActive && Math.abs(this.progress.target - this.progress.current) < 0.0005) {
      this.goToEaseActive = false
    }
    const masterT = this.progress.current

    this.group.updateMatrixWorld()
    this._craftFocusLocal.copy(this.group.position).add(this.craftFocusOffset())
    this.group.worldToLocal(this._craftFocusLocal)
    this._focusQuat.copy(this.group.quaternion).invert()

    let bestIndex = 0
    let bestFocus = -1

    for (let i = 0; i < this.count; i++) {
      const t = wrap01(masterT - i / this.count)
      const approaching = t > 0.5
      const distFromFocus = approaching ? 1 - t : t
      const window_ = approaching ? APPROACH_WINDOW : DEPART_WINDOW
      const lift = smoothstep(window_, 0, distFromFocus)

      this.focusFactors[i] = lift
      if (lift > bestFocus) {
        bestFocus = lift
        bestIndex = i
      }

      if (lift < 0.001) {
        this._idlePosition(i, t, time)
        this.screens[i].visible = false
        this.lasers[i].visible = false
        this.revealTimer[i] = 0 // fully departed — next approach starts its reveal fresh
        continue
      }

      this.craftSpin[i] += CRAFT_SPIN_SPEED * (1 - lift)
      const theta = t * Math.PI * 2
      this._ringPos.set(this.itemOrbitRadius * Math.sin(theta), 0, this.itemOrbitRadius * Math.cos(theta))
      this._ringEuler.set(-Math.PI / 2, -theta + this.craftSpin[i], 0)
      this._ringQuat.setFromEuler(this._ringEuler)

      const craftMoveK = approaching ? smoothstep(0.04, 0.22, lift) : lift
      this._localPos.copy(this._ringPos).lerp(this._craftFocusLocal, craftMoveK)
      this._itemQuat.slerpQuaternions(this._ringQuat, this._focusQuat, craftMoveK)

      const craft = this.crafts[i]
      craft.position.copy(this._localPos)
      craft.quaternion.copy(this._itemQuat)
      craft.scale.setScalar((CRAFT_SCALE_FAR + (CRAFT_SCALE_NEAR - CRAFT_SCALE_FAR) * craftMoveK) * this.viewScale)
      const halo = this.crewHalos[i]
      ;(halo.material as THREE.MeshBasicMaterial).opacity = 0.5 * (1 - craftMoveK)

      // Whether THIS item's screen/laser should run the "opening" (laser
      // fire, point→line→plane formation, static-then-reveal) choreography
      // versus the "closing" collapse. This is deliberately NOT the same as
      // the geometric `approaching` (which side of the ring-position wrap
      // the craft physically arrives from) — which side a SETTLED item
      // lands on depends on incidental navigation direction, not actual
      // open/close intent, and using it directly here meant a planet whose
      // only-ever selection happened to converge on the "depart" side (any
      // single-item planet, always) would permanently render its hologram
      // as if mid-close: laser never fires, plane never forms, and the
      // close-flicker uniform stays live forever. `openIndex` is the actual
      // semantic signal — this item is either the one the user just
      // targeted (opening) or a previously-open one now being vacated
      // (closing).
      const opening = i === this.openIndex

      const laserGrow = opening ? smoothstep(0.3, 0.38, lift) : 0
      const laserVisibility = opening ? smoothstep(0.3, 0.34, lift) * (1 - smoothstep(0.66, 0.74, lift)) : 0
      const laser = this.lasers[i]
      const focusWorld = this._focusWorldScratch.copy(this.group.position).add(this.focusOffset())
      if (laserVisibility > 0.01) {
        this._craftWorldPos.copy(this._localPos).applyMatrix4(this.group.matrixWorld)
        const dist = this._craftWorldPos.distanceTo(focusWorld)
        this._laserDir.copy(focusWorld).sub(this._craftWorldPos).normalize()
        this._laserQuat.setFromUnitVectors(UNIT_Z, this._laserDir)

        laser.visible = true
        const flickerNoise = Math.sin(time * 47 + i) * Math.sin(time * 13.3 + i * 2)
        const flicker = flickerNoise > -0.35 ? 1 : 0.2
        const mat = laser.material as THREE.MeshBasicMaterial
        mat.opacity = 0.85 * laserVisibility * flicker
        laser.position.copy(this._craftWorldPos)
        laser.quaternion.copy(this._laserQuat)
        laser.scale.set(this.viewScale, this.viewScale, dist * laserGrow)
      } else {
        laser.visible = false
      }

      const screen = this.screens[i]
      const screenMat = screen.material as THREE.ShaderMaterial

      let scaleX: number
      let scaleY: number
      let glow: number
      if (opening) {
        scaleX = laserGrow
        scaleY = smoothstep(0.4, 0.5, lift)
        glow = 1 - smoothstep(0.5, 0.54, lift)
      } else {
        scaleY = smoothstep(0, 0.62, lift)
        scaleX = smoothstep(0, 0.3, lift)
        glow = 0
      }

      // The image reveal/flicker-out runs on its own fixed-duration timer
      // once the plane has formed (glow drops), rather than tracking the
      // raw approach/depart `lift` directly — `lift`'s own convergence
      // speed depends on GOTO_EASE, which after the slower "watch the
      // craft fly" tuning could take seconds to cross the reveal
      // thresholds, stretching the intentional brief "static flickering to
      // life" moment into something that reads as stuck flickering. A
      // bounded timer guarantees the flicker always resolves quickly.
      if (glow > 0.5) {
        this.revealTimer[i] = 0
      } else {
        this.revealTimer[i] = Math.min(1, this.revealTimer[i] + REVEAL_TIMER_STEP)
      }
      const reveal = opening ? this.revealTimer[i] : smoothstep(0.62, 0.82, lift)

      const focusScaleAdjust = this._focusScaleAdjustRef!.value
      screen.visible = true
      screen.position.copy(focusWorld)
      screen.scale.set(
        Math.max(scaleX, 0.0001) * focusScaleAdjust * this.viewScale,
        Math.max(scaleY, 0.0001) * focusScaleAdjust * this.viewScale,
        1
      )
      screenMat.uniforms.uGlow.value = glow
      screenMat.uniforms.uReveal.value = reveal
      screenMat.uniforms.uTime.value = time
      let flicker = 1
      if (glow < 0.5 && reveal < 0.999) {
        const screenFlickerNoise = Math.sin(time * 39 + i * 3) * Math.sin(time * 17 + i)
        flicker = screenFlickerNoise > -0.3 ? 1 : 0.35
      } else if (!opening && reveal > 0.5) {
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

    this.activeIndex = bestFocus > 0.001 ? bestIndex : -1
    return this.activeIndex
  }

  // Pure idle pass — nothing selected yet, every item evenly spaced around
  // its ring/orbit, none of them near the focus spot.
  idleSelectionUpdate(time: number) {
    for (let i = 0; i < this.count; i++) {
      this._idlePosition(i, wrap01(i / this.count), time)
    }
  }

  hitTestItem(raycaster: THREE.Raycaster): number | null {
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
    if (this.orbitLine) {
      this.orbitLine.geometry.dispose()
      ;(this.orbitLine.material as THREE.Material).dispose()
      this.orbitLine.parent?.remove(this.orbitLine)
    }
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

type ViewMode = 'overview' | 'entering' | 'planet' | 'leaving'

interface CameraTransition {
  t: number
  duration: number
  fromPos: THREE.Vector3
  fromQuat: THREE.Quaternion
  toPlanet: PlanetInstance | null // null when leaving (target is the static overview)
}

class App {
  container: HTMLElement
  aspect: number
  onItemClick?: (localIndex: number) => void
  onActiveIndexChange?: (localIndex: number | null) => void
  onActivePlanetChange?: (planetId: string | null) => void
  onHoverChange?: (info: HoverInfo | null) => void

  renderer: THREE.WebGLRenderer
  scene = new THREE.Scene()
  camera: THREE.PerspectiveCamera
  raycaster = new THREE.Raycaster()
  pointerNdc = new THREE.Vector2()

  planets: PlanetInstance[] = []
  planetsById = new Map<string, PlanetInstance>()
  contentPlanets: PlanetInstance[] = []
  focusedPlanet: PlanetInstance | null = null
  viewMode: ViewMode = 'overview'
  transition: CameraTransition | null = null
  overviewCameraPos = new THREE.Vector3()
  overviewQuat = new THREE.Quaternion()
  focusScaleAdjust = { value: FOCUS_SCALE }
  hoveredIndex = -1
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
  boundOnMouseLeave: () => void

  constructor(
    container: HTMLElement,
    planetSites: PlanetSite[],
    aspect: number,
    borderRadius: number,
    swipeEase: number,
    onItemClick?: (localIndex: number) => void,
    onActiveIndexChange?: (localIndex: number | null) => void,
    onActivePlanetChange?: (planetId: string | null) => void,
    onHoverChange?: (info: HoverInfo | null) => void
  ) {
    this.container = container
    this.aspect = aspect
    this.onItemClick = onItemClick
    this.onActiveIndexChange = onActiveIndexChange
    this.onActivePlanetChange = onActivePlanetChange
    this.onHoverChange = onHoverChange

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' })
    this.renderer.setClearColor(0x000000, 0)
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    container.appendChild(this.renderer.domElement)

    this.camera = new THREE.PerspectiveCamera(CAMERA_FOV, 1, 0.1, 400)

    this.buildStarfield()
    this.buildLights()

    this.planets = planetSites.map((site, i) => {
      const p = new PlanetInstance(site, this.scene, aspect, borderRadius, swipeEase, i)
      p._focusScaleAdjustRef = this.focusScaleAdjust
      this.planetsById.set(site.id, p)
      return p
    })
    this.contentPlanets = this.planets.filter((p) => p.count > 0)

    // Parent each orbit-parented ring (the Moon's) to its parent's group so
    // it visually travels with it.
    for (const p of this.planets) {
      if (p.orbitLine && p.site.orbitParent) {
        const parent = this.planetsById.get(p.site.orbitParent)
        parent?.group.add(p.orbitLine)
      }
    }

    // The camera jumps between a close-up focused position and the very
    // distant overview position (tens of units apart) rather than moving
    // gradually frame to frame — Three.js's default per-mesh frustum-sphere
    // culling doesn't cope well with that kind of large jump and can end up
    // discarding everything. The scene is small enough that culling buys
    // nothing worth trading correctness for, so it's just disabled outright.
    this.scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh || obj instanceof THREE.Line) obj.frustumCulled = false
    })

    this.computeOverviewFraming() // also sets overviewQuat/camera since viewMode starts as 'overview'

    this.onResize()

    this.boundOnResize = this.onResize.bind(this)
    this.boundOnTouchDown = this.onTouchDown.bind(this)
    this.boundOnTouchMove = this.onTouchMove.bind(this)
    this.boundOnTouchUp = this.onTouchUp.bind(this)
    this.boundOnHoverMove = this.onHoverMove.bind(this)
    this.boundOnMouseLeave = this.onMouseLeave.bind(this)
    window.addEventListener('resize', this.boundOnResize)
    window.addEventListener('mousedown', this.boundOnTouchDown)
    window.addEventListener('mousemove', this.boundOnTouchMove)
    window.addEventListener('mouseup', this.boundOnTouchUp)
    window.addEventListener('touchstart', this.boundOnTouchDown, { passive: true })
    window.addEventListener('touchmove', this.boundOnTouchMove, { passive: true })
    window.addEventListener('touchend', this.boundOnTouchUp)
    container.addEventListener('mousemove', this.boundOnHoverMove)
    container.addEventListener('mouseleave', this.boundOnMouseLeave)

    this.update()
  }

  computeOverviewFraming() {
    let maxReach = 0
    for (const p of this.planets) {
      const reach = p.orbitRadius0() + (p.site.hasRing ? p.site.radius * 2.4 : p.site.radius)
      maxReach = Math.max(maxReach, reach)
    }
    this._overviewExtent = maxReach * OVERVIEW_MARGIN
    this.updateOverviewDistance()
  }

  _overviewExtent = 60

  computeOverviewQuat(): THREE.Quaternion {
    // Object3D.lookAt() computes rotation differently for a plain Object3D
    // than for a Camera (it swaps the eye/target order internally) — using
    // a plain Object3D here silently pointed the camera the wrong way
    // (up and away from the scene rather than down at it), which is why
    // the overview rendered nothing at all. A throwaway camera instance
    // gets the camera-specific (correct) branch.
    const scratch = new THREE.PerspectiveCamera()
    scratch.up.copy(OVERVIEW_UP)
    scratch.position.copy(this.overviewCameraPos)
    scratch.lookAt(0, 0, 0)
    return scratch.quaternion
  }

  updateOverviewDistance() {
    const aspect = Math.max(this.camera.aspect || 1, 0.5)
    const vFov = THREE.MathUtils.degToRad(CAMERA_FOV)
    const distForWidth = this._overviewExtent / (Math.tan(vFov / 2) * Math.min(aspect, 1))
    const distForHeight = this._overviewExtent / Math.tan(vFov / 2)
    const distance = Math.max(distForWidth, distForHeight, 50)
    this.overviewCameraPos.set(0, distance, 0)
    if (this.viewMode === 'overview') {
      this.camera.position.copy(this.overviewCameraPos)
      this.overviewQuat.copy(this.computeOverviewQuat())
      this.camera.quaternion.copy(this.overviewQuat)
    }
  }

  buildStarfield() {
    const count = 1100
    const positions = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      const r = 90 + Math.random() * 140
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta)
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta)
      positions[i * 3 + 2] = r * Math.cos(phi)
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
    // A directional key light (distance-independent, unlike a PointLight —
    // whose photometric intensity units would need to be enormous to reach
    // planets tens of units from the Sun) so every planet reads clearly
    // whether it's a few units or seventy units from the origin.
    const key = new THREE.DirectionalLight(0xfff4e0, 1.6)
    key.position.set(-8, 6, 10)
    this.scene.add(key)
    this.scene.add(new THREE.AmbientLight(0x404050, 0.65))
    // A small decorative glow AT the Sun so it still reads as the scene's
    // light source up close, without being relied on to illuminate anything.
    const glow = new THREE.PointLight(0xffcf7a, 40, 40, 1.4)
    glow.position.set(0, 0, 0)
    this.scene.add(glow)
  }

  // --- Navigation ----------------------------------------------------------

  enterPlanet(planetId: string) {
    const planet = this.planetsById.get(planetId)
    if (!planet || planet.count < 1) return
    if (this.viewMode !== 'overview') return
    planet.resetSelection()
    planet.setCraftVisible(true)
    for (const p of this.planets) p.setSceneVisible(p === planet)
    this.transition = {
      t: 0,
      duration: ENTER_SECONDS,
      fromPos: this.camera.position.clone(),
      fromQuat: this.camera.quaternion.clone(),
      toPlanet: planet,
    }
    this.viewMode = 'entering'
  }

  leavePlanet() {
    if (this.viewMode !== 'planet' || !this.focusedPlanet) return
    this.focusedPlanet.setCraftVisible(false)
    for (const p of this.planets) p.setSceneVisible(true)
    this.transition = {
      t: 0,
      duration: LEAVE_SECONDS,
      fromPos: this.camera.position.clone(),
      fromQuat: this.camera.quaternion.clone(),
      toPlanet: null,
    }
    this.viewMode = 'leaving'
    this.onActivePlanetChange?.(null)
    this.onActiveIndexChange?.(null)
    this.setHover(-1)
  }

  goTo(localIndex: number) {
    if (this.viewMode !== 'planet' || !this.focusedPlanet) return
    this.focusedPlanet.goTo(localIndex)
  }

  onCheck() {
    this.focusedPlanet?.onCheck()
  }

  setHover(localIndex: number) {
    if (localIndex === this.hoveredIndex) return
    this.hoveredIndex = localIndex
  }

  hitTestItem(clientX: number, clientY: number): number | null {
    if (this.viewMode !== 'planet' || !this.focusedPlanet) return null
    const rect = this.container.getBoundingClientRect()
    this.pointerNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1
    this.pointerNdc.y = -((clientY - rect.top) / rect.height) * 2 + 1
    this.raycaster.setFromCamera(this.pointerNdc, this.camera)
    return this.focusedPlanet.hitTestItem(this.raycaster)
  }

  hitTestPlanet(clientX: number, clientY: number): string | null {
    if (this.viewMode !== 'overview') return null
    const rect = this.container.getBoundingClientRect()
    this.pointerNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1
    this.pointerNdc.y = -((clientY - rect.top) / rect.height) * 2 + 1
    this.raycaster.setFromCamera(this.pointerNdc, this.camera)
    const hits = this.raycaster.intersectObjects(
      this.contentPlanets.map((p) => p.mesh),
      false
    )
    if (hits.length === 0) return null
    return findPlanetId(hits[0].object) ?? null
  }

  onTouchDown(e: MouseEvent | TouchEvent) {
    this.isDown = true
    this.hasDragged = false
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
    this.pointerDownX = clientX
    this.pointerDownY = clientY
    this.pointerDownTime = performance.now()
    if (this.viewMode === 'planet' && this.focusedPlanet) {
      this.focusedPlanet.goToEaseActive = false
      this.dragStartProgress = this.focusedPlanet.progress.target
    }
  }

  onTouchMove(e: MouseEvent | TouchEvent) {
    if (!this.isDown) return
    const x = 'touches' in e ? e.touches[0].clientX : e.clientX
    if (Math.abs(x - this.pointerDownX) > 6) this.hasDragged = true
    if (this.viewMode === 'planet' && this.focusedPlanet && this.focusedPlanet.count > 0) {
      const dx = this.pointerDownX - x
      const delta = (dx / this.container.clientWidth) * (1 / this.focusedPlanet.count) * 1.6
      this.focusedPlanet.anySelected = true
      this.focusedPlanet.progress.target = this.dragStartProgress + delta
    }
  }

  onTouchUp(e: MouseEvent | TouchEvent) {
    if (!this.isDown) return
    this.isDown = false
    const isQuickTap = !this.hasDragged && performance.now() - this.pointerDownTime < 500

    if (this.viewMode === 'overview') {
      if (isQuickTap) {
        const planetId = this.hitTestPlanet(this.pointerDownX, this.pointerDownY)
        if (planetId) this.enterPlanet(planetId)
      }
      return
    }

    if (this.viewMode === 'planet' && this.focusedPlanet) {
      if (isQuickTap) {
        const localIndex = this.hitTestItem(this.pointerDownX, this.pointerDownY)
        if (localIndex !== null) {
          if (this.focusedPlanet.anySelected && localIndex === this.focusedPlanet.activeIndex) {
            this.onItemClick?.(localIndex)
          } else {
            this.focusedPlanet.goTo(localIndex)
          }
        }
      }
      this.onCheck()
    }
  }

  onHoverMove(e: MouseEvent) {
    if (this.isDown) return
    if (this.viewMode === 'planet') {
      const localIndex = this.hitTestItem(e.clientX, e.clientY)
      this.container.style.cursor = localIndex !== null ? 'pointer' : 'grab'
      this.setHover(localIndex ?? -1)
      this.onHoverChange?.(localIndex !== null ? { localIndex, clientX: e.clientX, clientY: e.clientY } : null)
    } else if (this.viewMode === 'overview') {
      const planetId = this.hitTestPlanet(e.clientX, e.clientY)
      this.container.style.cursor = planetId ? 'pointer' : 'default'
    }
  }

  onMouseLeave() {
    this.setHover(-1)
    this.onHoverChange?.(null)
  }

  onResize() {
    const width = this.container.clientWidth
    const height = this.container.clientHeight
    this.renderer.setSize(width, height)
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()

    // Computed at Saturn's own (reference, scale=1) distance — the ratio
    // this produces is scale-invariant since every other planet's screen
    // size and camera distance are scaled by the same `viewScale` factor,
    // so one shared clamp is valid for all of them.
    const distance = BASE_CAMERA_OFFSET.z - BASE_FOCUS_OFFSET.z
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

    for (const p of this.planets) {
      const parentPos = p.site.orbitParent ? this.planetsById.get(p.site.orbitParent)!.group.position : ORIGIN
      p.advanceOrbit(parentPos)
    }

    if (this.viewMode === 'entering' || this.viewMode === 'leaving') {
      const tr = this.transition!
      tr.t += 1 / 60
      const localT = clamp(tr.t / tr.duration, 0, 1)
      const e = easeInOutCubic(localT)
      if (tr.toPlanet) {
        this._toCamPosScratch.copy(tr.toPlanet.group.position).add(tr.toPlanet.cameraOffset())
        this.camera.position.lerpVectors(tr.fromPos, this._toCamPosScratch, e)
        this.camera.quaternion.slerpQuaternions(tr.fromQuat, IDENTITY_QUAT, e)
      } else {
        this.camera.position.lerpVectors(tr.fromPos, this.overviewCameraPos, e)
        this.camera.quaternion.slerpQuaternions(tr.fromQuat, this.overviewQuat, e)
      }
      if (localT >= 1) {
        if (tr.toPlanet) {
          this.camera.position.copy(this._toCamPosScratch)
          this.camera.quaternion.copy(IDENTITY_QUAT)
          this.focusedPlanet = tr.toPlanet
          this.viewMode = 'planet'
          this.onActivePlanetChange?.(this.focusedPlanet.site.id)
          this.onActiveIndexChange?.(null)
        } else {
          this.camera.position.copy(this.overviewCameraPos)
          this.camera.quaternion.copy(this.overviewQuat)
          this.focusedPlanet = null
          this.viewMode = 'overview'
        }
        this.transition = null
      }
    } else if (this.viewMode === 'planet' && this.focusedPlanet) {
      this.camera.position.copy(this.focusedPlanet.group.position).add(this.focusedPlanet.cameraOffset())
      this.camera.quaternion.copy(IDENTITY_QUAT)
    }

    // The planet whose craft need positioning this frame — the focused one
    // once arrived, but also the target while still flying in, since its
    // craft are already visible (set in enterPlanet) and would otherwise
    // sit unpositioned at the origin until the transition completes.
    // While 'leaving', the departing planet's craft/screen/laser were
    // already snapped invisible in leavePlanet() — don't keep running its
    // activeUpdate here, or the still-live `progress`/lift state would
    // immediately re-show the hologram screen it just hid.
    const craftPlanet =
      this.viewMode === 'planet'
        ? this.focusedPlanet
        : this.viewMode === 'entering'
          ? (this.transition?.toPlanet ?? null)
          : null
    for (const planet of this.planets) {
      if (planet.count < 1 || planet !== craftPlanet) continue
      if (!planet.anySelected) {
        planet.idleSelectionUpdate(this.time)
        continue
      }
      const bestLocal = planet.activeUpdate(this.time)
      if (this.viewMode === 'planet') this.onActiveIndexChange?.(bestLocal >= 0 ? bestLocal : null)
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
    this.container.removeEventListener('mouseleave', this.boundOnMouseLeave)

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
  { planets, aspect = 16 / 9, borderRadius = 0.04, swipeEase = 0.08, onItemClick, onActiveIndexChange, onActivePlanetChange, onHoverChange },
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
  const onHoverChangeRef = useRef(onHoverChange)
  onHoverChangeRef.current = onHoverChange

  useImperativeHandle(ref, () => ({
    enterPlanet: (id: string) => appRef.current?.enterPlanet(id),
    leavePlanet: () => appRef.current?.leavePlanet(),
    goTo: (localIndex: number) => appRef.current?.goTo(localIndex),
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
      (id) => onActivePlanetChangeRef.current?.(id),
      (info) => onHoverChangeRef.current?.(info)
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
      aria-label="Solar system project gallery. Click a planet to enter it, then click a craft to preview a project."
    />
  )
})

export default SolarSystemGallery
