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
  /** width / height of the unfolded card, e.g. 16/9 for a normal screen. */
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

// --- Scene layout --------------------------------------------------------
// Saturn sits deep in the scene, tilted like the reference photo. Each
// project is a lumpy meteorite that rides the tilted ring plane as a child
// of the same group the ring belongs to — genuinely spinning with it, not
// faking a path — sweeping behind the planet at the far side. Near the
// front it unfolds into a flat preview card and lifts toward the camera,
// then folds back into a rock and settles onto the ring afterward. Purely
// swipe-driven: no scroll linkage at all.
const PLANET_RADIUS = 3.2
const PLANET_POS = new THREE.Vector3(0, -1, -10)
const RING_INNER = PLANET_RADIUS * 1.35
const RING_OUTER = PLANET_RADIUS * 2.4
const GROUP_TILT = THREE.MathUtils.degToRad(-20)
const GROUP_SPIN_SPEED = 0.0006
const CAMERA_Z = 14
const CAMERA_FOV = 45
const FOCUS_WORLD = new THREE.Vector3(0, 0, 5.2)

const ITEM_ORBIT_RADIUS = (RING_INNER + RING_OUTER) / 2
const LIFT_WINDOW = 0.17
const ROCK_SPIN_SPEED = 0.01
const CARD_HEIGHT = 3.4
const FOCUS_SCALE = 1.05
// Keep the unfolded card's projected width within this fraction of the
// viewport, shrinking it on narrow/portrait (mobile) screens so it's never
// cropped — recomputed on resize.
const MAX_VIEWPORT_WIDTH_FRACTION = 0.84

const CARD_VERTEX = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`
const CARD_FRAGMENT = `
  precision highp float;
  uniform sampler2D uMap;
  uniform vec2 uImageSize;
  uniform vec2 uPlaneSize;
  uniform float uBorderRadius;
  varying vec2 vUv;

  float roundedBoxSDF(vec2 p, vec2 b, float r) {
    vec2 d = abs(p) - b;
    return length(max(d, vec2(0.0))) + min(max(d.x, d.y), 0.0) - r;
  }

  void main() {
    vec2 ratio = vec2(
      min((uPlaneSize.x / uPlaneSize.y) / (uImageSize.x / uImageSize.y), 1.0),
      min((uPlaneSize.y / uPlaneSize.x) / (uImageSize.y / uImageSize.x), 1.0)
    );
    vec2 uv = vec2(
      vUv.x * ratio.x + (1.0 - ratio.x) * 0.5,
      vUv.y * ratio.y + (1.0 - ratio.y) * 0.5
    );
    float d = roundedBoxSDF(vUv - 0.5, vec2(0.5 - uBorderRadius), uBorderRadius);
    if (d > 0.0) discard;
    gl_FragColor = vec4(texture2D(uMap, uv).rgb, 1.0);
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

type IndexedMesh = THREE.Mesh

// A continuous noise field over the unit sphere (not per-vertex random) so
// shared corners on the icosahedron displace identically — no seams — while
// still giving each seed a distinct, irregular, rocky silhouette.
function createRockGeometry(seed: number, size: number): THREE.BufferGeometry {
  const geometry = new THREE.IcosahedronGeometry(size, 1)
  const position = geometry.attributes.position
  const v = new THREE.Vector3()
  const n = new THREE.Vector3()
  for (let i = 0; i < position.count; i++) {
    v.fromBufferAttribute(position, i)
    n.copy(v).normalize()
    const noise =
      Math.sin(n.x * 3.1 + seed) * Math.cos(n.y * 2.6 + seed * 1.4) * 0.5 +
      Math.sin(n.z * 4.3 + seed * 0.6) * Math.cos(n.x * 1.9 - seed) * 0.5
    const s = size * (1 + noise * 0.32)
    v.copy(n).multiplyScalar(s)
    position.setXYZ(i, v.x, v.y, v.z)
  }
  position.needsUpdate = true
  geometry.computeVertexNormals()
  return geometry
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

  renderer: THREE.WebGLRenderer
  scene = new THREE.Scene()
  camera: THREE.PerspectiveCamera
  saturnGroup = new THREE.Group()
  planetMesh!: THREE.Mesh
  rocks: IndexedMesh[] = []
  cards: IndexedMesh[] = []
  rockSpin: number[] = []
  focusFactors: number[] = []
  debris: { mesh: THREE.Mesh; spin: THREE.Vector3 }[] = []
  raycaster = new THREE.Raycaster()
  pointerNdc = new THREE.Vector2()

  // Scratch objects reused every frame to avoid per-item GC churn.
  _ringPos = new THREE.Vector3()
  _localPos = new THREE.Vector3()
  _focusLocal = new THREE.Vector3()
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
    this.saturnGroup.rotation.x = GROUP_TILT
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
    const height = CARD_HEIGHT
    const width = height * aspect
    const cardGeometry = new THREE.PlaneGeometry(width, height)
    const loader = new THREE.TextureLoader()

    items.forEach((item, index) => {
      // Meteorite: unique lumpy shape and size per project.
      const rockSize = 0.5 + ((index * 0.618033) % 1) * 0.4
      const rockGeometry = createRockGeometry(index * 7.13 + 1.7, rockSize)
      const rockMaterial = new THREE.MeshStandardMaterial({
        color: new THREE.Color().setHSL(0.08 + ((index * 0.21) % 1) * 0.05, 0.2, 0.42),
        roughness: 0.85,
        metalness: 0.08,
      })
      const rock = new THREE.Mesh(rockGeometry, rockMaterial) as IndexedMesh
      rock.userData.index = index
      this.saturnGroup.add(rock)
      this.rocks.push(rock)

      // Preview card: what the meteorite unfolds into near focus.
      const cardMaterial = new THREE.ShaderMaterial({
        vertexShader: CARD_VERTEX,
        fragmentShader: CARD_FRAGMENT,
        uniforms: {
          uMap: { value: null },
          uImageSize: { value: new THREE.Vector2(1, 1) },
          uPlaneSize: { value: new THREE.Vector2(width, height) },
          uBorderRadius: { value: borderRadius },
        },
      })
      const card = new THREE.Mesh(cardGeometry, cardMaterial) as IndexedMesh
      card.userData.index = index
      this.saturnGroup.add(card)
      this.cards.push(card)

      loader.load(item.image, (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace
        cardMaterial.uniforms.uMap.value = tex
        cardMaterial.uniforms.uImageSize.value.set(tex.image.width, tex.image.height)
      })
    })

    this.focusFactors = new Array(this.count).fill(0)
    this.rockSpin = new Array(this.count).fill(0)
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
    const candidates: THREE.Object3D[] = [...this.rocks, ...this.cards, this.planetMesh]
    const hits = this.raycaster.intersectObjects(candidates, false)
    if (hits.length === 0) return null
    const nearest = hits[0].object
    if (nearest === this.planetMesh) return null // the planet occludes whatever's behind it
    return (nearest as IndexedMesh).userData.index
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

    // Shrink the unfolded card's target scale so it never overflows a
    // narrow/portrait (mobile) viewport, while staying at full size on wide
    // desktop screens.
    const distance = CAMERA_Z - FOCUS_WORLD.z
    const vFov = THREE.MathUtils.degToRad(this.camera.fov)
    const visibleHeight = 2 * Math.tan(vFov / 2) * distance
    const visibleWidth = visibleHeight * this.camera.aspect
    const cardWorldWidth = CARD_HEIGHT * this.aspect
    const maxAllowed = visibleWidth * MAX_VIEWPORT_WIDTH_FRACTION
    this.focusScaleAdjust = Math.min(FOCUS_SCALE, (maxAllowed / cardWorldWidth) * FOCUS_SCALE)
  }

  update() {
    this.progress.current += (this.progress.target - this.progress.current) * this.progress.ease
    const masterT = this.progress.current

    this.saturnGroup.rotation.y += GROUP_SPIN_SPEED

    // The world-space focus point, expressed in the group's CURRENT local
    // space — recomputed every frame since the group keeps spinning, so a
    // lifted-off item stays pinned in front of the camera regardless of
    // where the ring has rotated to underneath it.
    this._focusLocal.copy(FOCUS_WORLD)
    this.saturnGroup.worldToLocal(this._focusLocal)
    this._focusQuat.copy(this.saturnGroup.quaternion).invert()

    let bestIndex = 0
    let bestFocus = -1

    for (let i = 0; i < this.count; i++) {
      const t = wrap01(masterT - i / this.count)
      const theta = t * Math.PI * 2
      const liftDist = Math.min(t, 1 - t)
      const lift = smoothstep(LIFT_WINDOW, 0, liftDist)
      this.focusFactors[i] = lift
      if (lift > bestFocus) {
        bestFocus = lift
        bestIndex = i
      }

      this.rockSpin[i] += ROCK_SPIN_SPEED * (1 - lift)

      // Flat on the ring plane (local XZ, matching the ring mesh's own
      // orientation) — where the meteorite spends most of its loop,
      // genuinely riding the ring rather than approximating it.
      this._ringPos.set(ITEM_ORBIT_RADIUS * Math.sin(theta), 0, ITEM_ORBIT_RADIUS * Math.cos(theta))
      this._ringEuler.set(-Math.PI / 2, -theta + this.rockSpin[i], 0)
      this._ringQuat.setFromEuler(this._ringEuler)

      this._localPos.copy(this._ringPos).lerp(this._focusLocal, lift)
      this._itemQuat.slerpQuaternions(this._ringQuat, this._focusQuat, lift)

      const rock = this.rocks[i]
      rock.position.copy(this._localPos)
      rock.quaternion.copy(this._itemQuat)
      rock.scale.setScalar(1 - lift)

      const card = this.cards[i]
      card.position.copy(this._localPos)
      card.quaternion.copy(this._itemQuat)
      card.scale.setScalar(this.focusScaleAdjust * lift)
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
