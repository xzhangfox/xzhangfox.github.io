'use client'

import * as THREE from 'three'
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'

export interface GalleryItem {
  image: string
}

export interface SaturnGalleryHandle {
  /** Spin the ring so `index` becomes the focused, unfolded item. */
  goTo: (index: number) => void
}

interface SaturnGalleryProps {
  items: GalleryItem[]
  /** width / height of the holographic screen, e.g. 16/9 for a normal screen. */
  aspect?: number
  borderRadius?: number
  swipeEase?: number
  onItemClick?: (index: number) => void
  onActiveIndexChange?: (index: number) => void
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

function findIndex(obj: THREE.Object3D | null): number | undefined {
  let cur: THREE.Object3D | null = obj
  while (cur) {
    if (cur.userData.index !== undefined) return cur.userData.index as number
    cur = cur.parent
  }
  return undefined
}

// --- Scene layout --------------------------------------------------------
// Saturn sits deep in the scene, tilted and rolled like a photo taken at an
// angle. Each project is a small craft that rides the tilted ring plane as
// a child of the same group the ring belongs to — genuinely spinning with
// it, not faking a path — sweeping behind the planet at the far side. Near
// the front it grows, fires a laser, and projects a holographic screen
// (the preview card) that opens with a static-flicker and closes with a
// CRT-style collapse; the craft then snaps back to the ring quickly and the
// next one's turn begins. Purely swipe-driven: no scroll linkage at all.
const PLANET_RADIUS = 3.2
const PLANET_POS = new THREE.Vector3(0, -1, -10)
const RING_INNER = PLANET_RADIUS * 1.35
const RING_OUTER = PLANET_RADIUS * 2.4
const GROUP_TILT = THREE.MathUtils.degToRad(-20)
const GROUP_ROLL = THREE.MathUtils.degToRad(10) // left low, right high
const GROUP_SPIN_SPEED = 0.0006
const CAMERA_Z = 14
const CAMERA_FOV = 45
// Where the holographic screen sits — fixed in world space, doesn't move.
// Noticeably closer to the camera than the craft's own parking spot.
const FOCUS_WORLD = new THREE.Vector3(0, 0, 8)
// Where the craft itself parks while its beam reaches the rest of the way
// to the screen — this gap is what the laser visually bridges.
const CRAFT_FOCUS_WORLD = new THREE.Vector3(0, 0, 6.6)
const UNIT_Z = new THREE.Vector3(0, 0, 1)
// Shared by the laser material and the screen's glow/edge/static tint so the
// beam and the hologram it projects read as one continuous piece of light —
// "laser white."
const LASER_WHITE = new THREE.Color(0xeaf6ff)

const ITEM_ORBIT_RADIUS = (RING_INNER + RING_OUTER) / 2
const CRAFT_SPIN_SPEED = 0.01

// Approach is slow and deliberate; departure ("quickly flies back behind
// Saturn") uses a much narrower window so it snaps away fast. Both are
// tuned to stay well under 1/count of the loop (five projects → 0.2
// spacing) so two crafts are never near the shared parking spot at once.
// Numerically verified against all 5 items' timing to guarantee no two
// crafts are ever both near the shared parking spot at once.
const APPROACH_WINDOW = 0.15
const DEPART_WINDOW = 0.06

const CRAFT_SCALE_FAR = 0.5
const CRAFT_SCALE_NEAR = 1.35

const SCREEN_HEIGHT = 3.4
const FOCUS_SCALE = 1.05
// Keep the screen's projected width within this fraction of the viewport,
// shrinking it on narrow/portrait (mobile) screens so it's never cropped —
// recomputed on resize.
const MAX_VIEWPORT_WIDTH_FRACTION = 0.84

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

    vec3 color;
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
        // but otherwise this holds rock-steady.
        vec3 base = texture2D(uMap, uv).rgb;
        color = mix(color, base * uFlicker, reveal);
      }
    }

    float edge = smoothstep(-0.045, -0.01, d);

    // Ambient "unstable projection" glitch — independent of open/close
    // state, lives entirely on the edge glow so the image itself never
    // flickers at rest. Rare, brief bursts, not a constant shimmer.
    float glitchSlot = hash(vec2(floor(uTime * 2.2), 7.0));
    float glitchActive = step(0.9, glitchSlot) * (0.5 + 0.5 * sin(uTime * 70.0));
    vec3 edgeNoise = vec3(hash(vUv * 300.0 + uTime * 5.0));
    vec3 edgeColor = mix(uLaserWhite, edgeNoise, glitchActive * 0.7);
    float edgeStrength = edge * 0.55 * (1.0 + glitchActive * 0.6);
    color = mix(color, edgeColor, clamp(edgeStrength, 0.0, 1.0));

    gl_FragColor = vec4(color, 1.0);
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
  // screen end — a projector beam, not a uniform pointer — so the taper
  // itself reads as real 3D perspective and visually foreshadows the plane
  // it's about to become.
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

class App {
  container: HTMLElement
  aspect: number
  onItemClick?: (index: number) => void
  onActiveIndexChange?: (index: number) => void
  progress = { current: 0, target: 0, ease: 0.08 }
  count: number
  focusScaleAdjust = FOCUS_SCALE
  activeIndex = -1
  time = 0

  renderer: THREE.WebGLRenderer
  scene = new THREE.Scene()
  camera: THREE.PerspectiveCamera
  saturnGroup = new THREE.Group()
  planetMesh!: THREE.Mesh
  crafts: THREE.Group[] = []
  screens: THREE.Mesh[] = []
  lasers: THREE.Mesh[] = []
  craftSpin: number[] = []
  focusFactors: number[] = []
  debris: { mesh: THREE.Mesh; spin: THREE.Vector3 }[] = []
  raycaster = new THREE.Raycaster()
  pointerNdc = new THREE.Vector2()

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
    items: GalleryItem[],
    aspect: number,
    borderRadius: number,
    swipeEase: number,
    onItemClick?: (index: number) => void,
    onActiveIndexChange?: (index: number) => void
  ) {
    this.container = container
    this.aspect = aspect
    this.progress.ease = swipeEase
    this.onItemClick = onItemClick
    this.onActiveIndexChange = onActiveIndexChange
    this.count = items.length

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' })
    this.renderer.setClearColor(0x000000, 0)
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    container.appendChild(this.renderer.domElement)

    this.camera = new THREE.PerspectiveCamera(CAMERA_FOV, 1, 0.1, 100)
    this.camera.position.set(0, 0, CAMERA_Z)

    this.buildSaturn()
    this.buildStarfield()
    this.buildLights()
    this.buildItems(items, aspect, borderRadius)
    this.buildDebris()
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

  buildSaturn() {
    this.saturnGroup.position.copy(PLANET_POS)
    this.saturnGroup.rotation.set(GROUP_TILT, 0, GROUP_ROLL)
    this.scene.add(this.saturnGroup)

    const loader = new THREE.TextureLoader()
    const planetTex = loader.load('/textures/saturn.jpg')
    planetTex.colorSpace = THREE.SRGBColorSpace
    this.planetMesh = new THREE.Mesh(
      new THREE.SphereGeometry(PLANET_RADIUS, 48, 48),
      new THREE.MeshStandardMaterial({ map: planetTex, roughness: 1, metalness: 0 })
    )
    this.saturnGroup.add(this.planetMesh)

    const ringTex = loader.load('/textures/saturn-ring.png')
    ringTex.colorSpace = THREE.SRGBColorSpace
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(RING_INNER, RING_OUTER, 128),
      new THREE.ShaderMaterial({
        vertexShader: RING_VERTEX,
        fragmentShader: RING_FRAGMENT,
        uniforms: { uRingMap: { value: ringTex }, uInner: { value: RING_INNER }, uOuter: { value: RING_OUTER } },
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      })
    )
    ring.rotation.x = -Math.PI / 2
    this.saturnGroup.add(ring)
  }

  buildStarfield() {
    const count = 700
    const positions = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      const r = 40 + Math.random() * 60
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

  buildItems(items: GalleryItem[], aspect: number, borderRadius: number) {
    const height = SCREEN_HEIGHT
    const width = height * aspect
    const screenGeometry = new THREE.PlaneGeometry(width, height)
    const loader = new THREE.TextureLoader()

    items.forEach((item, index) => {
      const craft = createCraft(index)
      craft.userData.index = index
      this.saturnGroup.add(craft)
      this.crafts.push(craft)

      // Laser and screen are scene-level (world-space), NOT children of the
      // spinning ring group — the screen holds still at a fixed spot in
      // front of the camera while the craft (still riding the ring) beams
      // across the gap to it each time it swings into position.
      const laser = createLaser()
      laser.userData.index = index
      laser.visible = false
      this.scene.add(laser)
      this.lasers.push(laser)

      const screenMaterial = new THREE.ShaderMaterial({
        vertexShader: SCREEN_VERTEX,
        fragmentShader: SCREEN_FRAGMENT,
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
      screen.position.copy(FOCUS_WORLD)
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

  buildDebris() {
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
      const radius = RING_INNER * 0.9 + Math.random() * (RING_OUTER * 1.3 - RING_INNER * 0.9)
      const yJitter = (Math.random() - 0.5) * 0.18
      mesh.position.set(radius * Math.sin(angle), yJitter, radius * Math.cos(angle))
      mesh.scale.setScalar(0.05 + Math.random() * 0.16)
      mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI)
      this.saturnGroup.add(mesh)
      this.debris.push({
        mesh,
        spin: new THREE.Vector3((Math.random() - 0.5) * 0.01, (Math.random() - 0.5) * 0.01, (Math.random() - 0.5) * 0.01),
      })
    }
  }

  // Brings `index` to focus via the shortest direction around the loop.
  goTo(index: number) {
    if (this.count < 1) return
    const step = 1 / this.count
    const targetFrac = wrap01(index * step)
    const currentFrac = wrap01(this.progress.target)
    let delta = targetFrac - currentFrac
    if (delta > 0.5) delta -= 1
    if (delta < -0.5) delta += 1
    this.progress.target += delta
  }

  onCheck() {
    if (this.count < 1) return
    const step = 1 / this.count
    this.progress.target = Math.round(this.progress.target / step) * step
  }

  hitTest(clientX: number, clientY: number): number | null {
    const rect = this.container.getBoundingClientRect()
    this.pointerNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1
    this.pointerNdc.y = -((clientY - rect.top) / rect.height) * 2 + 1
    this.raycaster.setFromCamera(this.pointerNdc, this.camera)
    const candidates: THREE.Object3D[] = [this.planetMesh, ...this.crafts, ...this.screens]
    const hits = this.raycaster.intersectObjects(candidates, true)
    if (hits.length === 0) return null
    const nearest = hits[0].object
    if (nearest === this.planetMesh) return null // the planet occludes whatever's behind it
    const index = findIndex(nearest)
    return index === undefined ? null : index
  }

  onTouchDown(e: MouseEvent | TouchEvent) {
    this.isDown = true
    this.hasDragged = false
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
    this.pointerDownX = clientX
    this.pointerDownY = clientY
    this.pointerDownTime = performance.now()
    this.dragStartProgress = this.progress.target
  }

  onTouchMove(e: MouseEvent | TouchEvent) {
    if (!this.isDown) return
    const x = 'touches' in e ? e.touches[0].clientX : e.clientX
    if (Math.abs(x - this.pointerDownX) > 6) this.hasDragged = true
    const dx = this.pointerDownX - x
    const delta = (dx / this.container.clientWidth) * (1 / this.count) * 1.6
    this.progress.target = this.dragStartProgress + delta
  }

  onTouchUp(e: MouseEvent | TouchEvent) {
    this.isDown = false
    const isQuickTap = !this.hasDragged && performance.now() - this.pointerDownTime < 500
    if (isQuickTap) {
      const index = this.hitTest(this.pointerDownX, this.pointerDownY)
      if (index !== null) {
        if (index === this.activeIndex) this.onItemClick?.(index)
        else this.goTo(index)
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
    const step = 1 / this.count
    if (e.key === 'ArrowRight') {
      e.preventDefault()
      this.progress.target += step
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      this.progress.target -= step
    }
  }

  onResize() {
    const width = this.container.clientWidth
    const height = this.container.clientHeight
    this.renderer.setSize(width, height)
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()

    // Shrink the screen's target scale so it never overflows a
    // narrow/portrait (mobile) viewport, while staying at full size on wide
    // desktop screens.
    const distance = CAMERA_Z - FOCUS_WORLD.z
    const vFov = THREE.MathUtils.degToRad(this.camera.fov)
    const visibleHeight = 2 * Math.tan(vFov / 2) * distance
    const visibleWidth = visibleHeight * this.camera.aspect
    const screenWorldWidth = SCREEN_HEIGHT * this.aspect
    const maxAllowed = visibleWidth * MAX_VIEWPORT_WIDTH_FRACTION
    this.focusScaleAdjust = Math.min(FOCUS_SCALE, (maxAllowed / screenWorldWidth) * FOCUS_SCALE)
  }

  update() {
    this.time += 0.016
    this.progress.current += (this.progress.target - this.progress.current) * this.progress.ease
    const masterT = this.progress.current

    this.saturnGroup.rotation.y += GROUP_SPIN_SPEED
    this.saturnGroup.updateMatrixWorld()

    // The craft's parking spot, expressed in the group's CURRENT local
    // space — recomputed every frame since the group keeps spinning, so the
    // craft stays pinned in front of the camera regardless of where the
    // ring has rotated to underneath it. The screen itself is NOT parented
    // to the group and doesn't move at all — only the craft (and the laser
    // bridging the two) animates position.
    this._craftFocusLocal.copy(CRAFT_FOCUS_WORLD)
    this.saturnGroup.worldToLocal(this._craftFocusLocal)
    this._focusQuat.copy(this.saturnGroup.quaternion).invert()

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

      // Flat on the ring plane (local XZ, matching the ring mesh's own
      // orientation) — where the craft spends most of its loop, genuinely
      // riding the ring rather than approximating it.
      this._ringPos.set(ITEM_ORBIT_RADIUS * Math.sin(theta), 0, ITEM_ORBIT_RADIUS * Math.cos(theta))
      this._ringEuler.set(-Math.PI / 2, -theta + this.craftSpin[i], 0)
      this._ringQuat.setFromEuler(this._ringEuler)

      // The craft's own arrival is quick and finishes early in the approach
      // window — it reaches its parking spot and holds completely still
      // well before the laser/screen sequence (below) begins, matching
      // "arrives at the fixed point, THEN starts firing" rather than firing
      // while still moving.
      const craftMoveK = approaching ? smoothstep(0.04, 0.22, lift) : lift
      this._localPos.copy(this._ringPos).lerp(this._craftFocusLocal, craftMoveK)
      this._itemQuat.slerpQuaternions(this._ringQuat, this._focusQuat, craftMoveK)

      const craft = this.crafts[i]
      craft.position.copy(this._localPos)
      craft.quaternion.copy(this._itemQuat)
      craft.scale.setScalar(CRAFT_SCALE_FAR + (CRAFT_SCALE_NEAR - CRAFT_SCALE_FAR) * craftMoveK)

      // Laser: a real beam from the craft's current WORLD position to the
      // screen's fixed WORLD position — recomputed every frame since the
      // craft is always moving relative to the (stationary) screen. It only
      // starts once the craft has fully parked (craftMoveK already at 1),
      // extending from a point out to full length; that same growth also
      // drives the screen's horizontal unfurl below, so the beam visibly
      // "draws" the line the screen starts as. Only fires while
      // approaching; closing is a silent collapse, no laser.
      const laserGrow = approaching ? smoothstep(0.3, 0.38, lift) : 0
      const laserVisibility = approaching ? smoothstep(0.3, 0.34, lift) * (1 - smoothstep(0.66, 0.74, lift)) : 0
      const laser = this.lasers[i]
      if (laserVisibility > 0.01) {
        this._craftWorldPos.copy(this._localPos).applyMatrix4(this.saturnGroup.matrixWorld)
        const dist = this._craftWorldPos.distanceTo(FOCUS_WORLD)
        this._laserDir.copy(FOCUS_WORLD).sub(this._craftWorldPos).normalize()
        this._laserQuat.setFromUnitVectors(UNIT_Z, this._laserDir)

        laser.visible = true
        const flickerNoise = Math.sin(this.time * 47 + i) * Math.sin(this.time * 13.3 + i * 2)
        const flicker = flickerNoise > -0.35 ? 1 : 0.2
        const mat = laser.material as THREE.MeshBasicMaterial
        mat.opacity = 0.85 * laserVisibility * flicker
        laser.position.copy(this._craftWorldPos)
        laser.quaternion.copy(this._laserQuat)
        // Grows from a point at the craft to its full length reaching the
        // screen — real perspective on the taper comes for free from the
        // camera projection, this just controls how much of the beam has
        // "arrived" yet.
        laser.scale.set(1, 1, dist * laserGrow)
      } else {
        laser.visible = false
      }

      // Screen: fixed in place, no movement of its own. A laser-white point
      // at the beam's tip expands — SAME thickness, both directions at
      // once — into a horizontal line exactly as wide as the beam's own
      // extension (X, synced to laserGrow above); once that line reaches
      // full preview width it unfurls up and down into a full plane (Y),
      // still solid laser-white throughout — no noise, no image yet. Only
      // once the plane has fully formed does it flicker into hologram
      // static, and only after that does the real image get sampled at
      // all. Closing reverses the order: a quick flicker of the image,
      // then it drops to static, and only then collapses — plane → line →
      // point — through a much narrower window so it's fast.
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
      screen.scale.set(Math.max(scaleX, 0.0001) * this.focusScaleAdjust, Math.max(scaleY, 0.0001) * this.focusScaleAdjust, 1)
      screenMat.uniforms.uGlow.value = glow
      screenMat.uniforms.uReveal.value = reveal
      screenMat.uniforms.uTime.value = this.time
      let flicker = 1
      if (glow < 0.5 && reveal < 0.999) {
        const screenFlickerNoise = Math.sin(this.time * 39 + i * 3) * Math.sin(this.time * 17 + i)
        flicker = screenFlickerNoise > -0.3 ? 1 : 0.35
      } else if (!approaching && reveal > 0.5) {
        // The brief pre-close flicker of the still-clean image.
        const closeFlickerNoise = Math.sin(this.time * 53 + i * 4) * Math.sin(this.time * 21 + i)
        flicker = closeFlickerNoise > 0.1 ? 1 : 0.4
      }
      screenMat.uniforms.uFlicker.value = flicker
    }

    if (bestIndex !== this.activeIndex) {
      this.activeIndex = bestIndex
      this.onActiveIndexChange?.(bestIndex)
    }

    for (const d of this.debris) {
      d.mesh.rotation.x += d.spin.x
      d.mesh.rotation.y += d.spin.y
      d.mesh.rotation.z += d.spin.z
    }

    this.renderer.render(this.scene, this.camera)
    this.raf = window.requestAnimationFrame(this.update.bind(this))
  }

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

    this.scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh || obj instanceof THREE.Points) {
        obj.geometry.dispose()
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material]
        mats.forEach((m) => {
          if ('map' in m && (m as THREE.MeshStandardMaterial).map) (m as THREE.MeshStandardMaterial).map!.dispose()
          m.dispose()
        })
      }
    })
    this.renderer.dispose()
    if (this.renderer.domElement.parentNode) this.renderer.domElement.parentNode.removeChild(this.renderer.domElement)
  }
}

const SaturnGallery = forwardRef<SaturnGalleryHandle, SaturnGalleryProps>(function SaturnGallery(
  { items, aspect = 16 / 9, borderRadius = 0.04, swipeEase = 0.08, onItemClick, onActiveIndexChange },
  ref
) {
  const containerRef = useRef<HTMLDivElement>(null)
  const appRef = useRef<App | null>(null)
  const onItemClickRef = useRef(onItemClick)
  onItemClickRef.current = onItemClick
  const onActiveIndexChangeRef = useRef(onActiveIndexChange)
  onActiveIndexChangeRef.current = onActiveIndexChange

  useImperativeHandle(ref, () => ({
    goTo: (index: number) => appRef.current?.goTo(index),
  }), [])

  useEffect(() => {
    if (!containerRef.current) return
    const app = new App(
      containerRef.current,
      items,
      aspect,
      borderRadius,
      swipeEase,
      (index) => onItemClickRef.current?.(index),
      (index) => onActiveIndexChangeRef.current?.(index)
    )
    appRef.current = app
    return () => {
      app.destroy()
      appRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, aspect, borderRadius, swipeEase])

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

export default SaturnGallery
