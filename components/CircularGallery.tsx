'use client'

import { Camera, Mesh, Plane, Program, Renderer, Texture, Transform } from 'ogl'
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'

type GL = Renderer['gl']

function lerp(p1: number, p2: number, t: number): number {
  return p1 + (p2 - p1) * t
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function autoBind(instance: any): void {
  const proto = Object.getPrototypeOf(instance)
  Object.getOwnPropertyNames(proto).forEach((key) => {
    if (key !== 'constructor' && typeof instance[key] === 'function') {
      instance[key] = instance[key].bind(instance)
    }
  })
}

function getFontSize(font: string): number {
  const match = font.match(/(\d+)px/)
  return match ? parseInt(match[1], 10) : 22
}

function createTextTexture(
  gl: GL,
  text: string,
  font: string,
  color: string
): { texture: Texture; width: number; height: number } {
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Could not get 2d context')

  context.font = font
  const metrics = context.measureText(text)
  const textWidth = Math.ceil(metrics.width)
  const fontSize = getFontSize(font)
  const textHeight = Math.ceil(fontSize * 1.3)

  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  canvas.width = (textWidth + 24) * dpr
  canvas.height = (textHeight + 16) * dpr
  context.scale(dpr, dpr)

  context.font = font
  context.fillStyle = color
  context.textBaseline = 'middle'
  context.textAlign = 'center'
  context.clearRect(0, 0, canvas.width, canvas.height)
  context.fillText(text, (textWidth + 24) / 2, (textHeight + 16) / 2)

  const texture = new Texture(gl, { generateMipmaps: false })
  texture.image = canvas
  return { texture, width: textWidth + 24, height: textHeight + 16 }
}

interface TitleProps {
  gl: GL
  plane: Mesh
  text: string
  textColor: string
  font: string
}

class Title {
  gl: GL
  plane: Mesh
  text: string
  textColor: string
  font: string
  mesh!: Mesh

  constructor({ gl, plane, text, textColor, font }: TitleProps) {
    autoBind(this)
    this.gl = gl
    this.plane = plane
    this.text = text
    this.textColor = textColor
    this.font = font
    this.createMesh()
  }

  createMesh() {
    const { texture, width, height } = createTextTexture(this.gl, this.text, this.font, this.textColor)
    const geometry = new Plane(this.gl)
    const program = new Program(this.gl, {
      vertex: `
        attribute vec3 position;
        attribute vec2 uv;
        uniform mat4 modelViewMatrix;
        uniform mat4 projectionMatrix;
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragment: `
        precision highp float;
        uniform sampler2D tMap;
        varying vec2 vUv;
        void main() {
          vec4 color = texture2D(tMap, vUv);
          if (color.a < 0.1) discard;
          gl_FragColor = color;
        }
      `,
      uniforms: { tMap: { value: texture } },
      transparent: true,
    })
    this.mesh = new Mesh(this.gl, { geometry, program })
    const aspect = width / height
    const textHeightScaled = this.plane.scale.y * 0.09
    const textWidthScaled = textHeightScaled * aspect
    this.mesh.scale.set(textWidthScaled, textHeightScaled, 1)
    this.mesh.position.y = -this.plane.scale.y * 0.5 - textHeightScaled * 0.9
    this.mesh.setParent(this.plane)
  }
}

interface ScreenSize {
  width: number
  height: number
}

interface Viewport {
  width: number
  height: number
}

export interface GalleryItem {
  image: string
  title: string
}

interface MediaProps {
  geometry: Plane
  gl: GL
  image: string
  index: number
  length: number
  scene: Transform
  screen: ScreenSize
  text: string
  viewport: Viewport
  bend: number
  textColor: string
  borderRadius: number
  font: string
  aspect: number
}

class Media {
  geometry: Plane
  gl: GL
  image: string
  index: number
  length: number
  scene: Transform
  screen: ScreenSize
  text: string
  viewport: Viewport
  bend: number
  textColor: string
  borderRadius: number
  font: string
  aspect: number
  program!: Program
  plane!: Mesh
  title!: Title
  width!: number
  padding!: number
  x!: number
  speed: number = 0
  isBefore: boolean = false
  isAfter: boolean = false

  constructor({ geometry, gl, image, index, length, scene, screen, text, viewport, bend, textColor, borderRadius, font, aspect }: MediaProps) {
    this.geometry = geometry
    this.gl = gl
    this.image = image
    this.index = index
    this.length = length
    this.scene = scene
    this.screen = screen
    this.text = text
    this.viewport = viewport
    this.bend = bend
    this.textColor = textColor
    this.borderRadius = borderRadius
    this.font = font
    this.aspect = aspect
    this.createShader()
    this.createMesh()
    this.createTitle()
    this.onResize()
  }

  createShader() {
    const texture = new Texture(this.gl, { generateMipmaps: true })
    this.program = new Program(this.gl, {
      depthTest: false,
      depthWrite: false,
      vertex: `
        precision highp float;
        attribute vec3 position;
        attribute vec2 uv;
        uniform mat4 modelViewMatrix;
        uniform mat4 projectionMatrix;
        uniform float uTime;
        uniform float uSpeed;
        varying vec2 vUv;
        void main() {
          vUv = uv;
          vec3 p = position;
          p.z = (sin(p.x * 4.0 + uTime) * 0.6 + cos(p.y * 2.0 + uTime) * 0.6) * (0.06 + uSpeed * 0.4);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }
      `,
      fragment: `
        precision highp float;
        uniform vec2 uImageSizes;
        uniform vec2 uPlaneSizes;
        uniform sampler2D tMap;
        uniform float uBorderRadius;
        uniform float uOpacity;
        varying vec2 vUv;

        float roundedBoxSDF(vec2 p, vec2 b, float r) {
          vec2 d = abs(p) - b;
          return length(max(d, vec2(0.0))) + min(max(d.x, d.y), 0.0) - r;
        }

        void main() {
          vec2 ratio = vec2(
            min((uPlaneSizes.x / uPlaneSizes.y) / (uImageSizes.x / uImageSizes.y), 1.0),
            min((uPlaneSizes.y / uPlaneSizes.x) / (uImageSizes.y / uImageSizes.x), 1.0)
          );
          vec2 uv = vec2(
            vUv.x * ratio.x + (1.0 - ratio.x) * 0.5,
            vUv.y * ratio.y + (1.0 - ratio.y) * 0.5
          );
          vec4 color = texture2D(tMap, uv);

          float d = roundedBoxSDF(vUv - 0.5, vec2(0.5 - uBorderRadius), uBorderRadius);
          float edgeSmooth = 0.002;
          float alpha = 1.0 - smoothstep(-edgeSmooth, edgeSmooth, d);

          gl_FragColor = vec4(color.rgb, alpha * uOpacity);
        }
      `,
      uniforms: {
        tMap: { value: texture },
        uPlaneSizes: { value: [0, 0] },
        uImageSizes: { value: [0, 0] },
        uSpeed: { value: 0 },
        uTime: { value: 100 * Math.random() },
        uBorderRadius: { value: this.borderRadius },
        uOpacity: { value: 1 },
      },
      transparent: true,
    })
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.src = this.image
    img.onload = () => {
      texture.image = img
      this.program.uniforms.uImageSizes.value = [img.naturalWidth, img.naturalHeight]
    }
  }

  createMesh() {
    this.plane = new Mesh(this.gl, { geometry: this.geometry, program: this.program })
    this.plane.setParent(this.scene)
  }

  createTitle() {
    this.title = new Title({ gl: this.gl, plane: this.plane, text: this.text, textColor: this.textColor, font: this.font })
  }

  update(scroll: { current: number; last: number }) {
    this.plane.position.x = this.x - scroll.current

    const x = this.plane.position.x
    const H = this.viewport.width / 2

    if (this.bend === 0) {
      this.plane.position.y = 0
      this.plane.rotation.z = 0
    } else {
      const B_abs = Math.abs(this.bend)
      const R = (H * H + B_abs * B_abs) / (2 * B_abs)
      const effectiveX = Math.min(Math.abs(x), H)
      const arc = R - Math.sqrt(R * R - effectiveX * effectiveX)
      if (this.bend > 0) {
        this.plane.position.y = -arc
        this.plane.rotation.z = -Math.sign(x) * Math.asin(effectiveX / R)
      } else {
        this.plane.position.y = arc
        this.plane.rotation.z = Math.sign(x) * Math.asin(effectiveX / R)
      }
    }

    this.speed = scroll.current - scroll.last
    this.program.uniforms.uTime.value += 0.04
    this.program.uniforms.uSpeed.value = this.speed

    const planeOffset = this.plane.scale.x / 2
    const viewportOffset = this.viewport.width / 2
    this.isBefore = this.plane.position.x + planeOffset < -viewportOffset
    this.isAfter = this.plane.position.x - planeOffset > viewportOffset

    // Fade the ends so the first/last cards don't hard-clip at the viewport edge.
    const edgeFade = 0.35
    const distanceOut = Math.max(0, Math.abs(x) - (viewportOffset - planeOffset * edgeFade))
    const fadeRange = planeOffset * edgeFade || 1
    this.program.uniforms.uOpacity.value = clamp(1 - distanceOut / fadeRange, 0, 1)
  }

  onResize({ screen, viewport }: { screen?: ScreenSize; viewport?: Viewport } = {}) {
    if (screen) this.screen = screen
    if (viewport) this.viewport = viewport

    // Card height is a fraction of the viewport height; width follows the
    // requested aspect ratio exactly, so cards always read like a screen.
    this.plane.scale.y = this.viewport.height * 0.52
    this.plane.scale.x = this.plane.scale.y * this.aspect
    this.plane.program.uniforms.uPlaneSizes.value = [this.plane.scale.x, this.plane.scale.y]
    this.padding = this.plane.scale.x * 0.12
    this.width = this.plane.scale.x + this.padding
    this.x = this.width * this.index
  }
}

interface AppConfig {
  items: GalleryItem[]
  bend: number
  textColor: string
  borderRadius: number
  font: string
  scrollSpeed: number
  scrollEase: number
  aspect: number
  onItemClick?: (index: number) => void
}

class App {
  container: HTMLElement
  scrollSpeed: number
  aspect: number
  onItemClick?: (index: number) => void
  scroll: { ease: number; current: number; target: number; last: number; position?: number }
  renderer!: Renderer
  gl!: GL
  camera!: Camera
  scene!: Transform
  planeGeometry!: Plane
  medias: Media[] = []
  items: GalleryItem[] = []
  screen!: { width: number; height: number }
  viewport!: { width: number; height: number }
  raf: number = 0

  boundOnResize!: () => void
  boundOnTouchDown!: (e: MouseEvent | TouchEvent) => void
  boundOnTouchMove!: (e: MouseEvent | TouchEvent) => void
  boundOnTouchUp!: (e: MouseEvent | TouchEvent) => void
  boundOnKeyDown!: (e: KeyboardEvent) => void
  boundOnHoverMove!: (e: MouseEvent) => void

  isDown: boolean = false
  hasDragged: boolean = false
  start: number = 0
  pointerDownX: number = 0
  pointerDownY: number = 0
  pointerDownTime: number = 0

  constructor(container: HTMLElement, { items, bend, textColor, borderRadius, font, scrollSpeed, scrollEase, aspect, onItemClick }: AppConfig) {
    this.container = container
    this.scrollSpeed = scrollSpeed
    this.aspect = aspect
    this.onItemClick = onItemClick
    this.scroll = { ease: scrollEase, current: 0, target: 0, last: 0 }
    this.createRenderer()
    this.createCamera()
    this.createScene()
    this.onResize()
    this.createGeometry()
    this.createMedias(items, bend, textColor, borderRadius, font)
    this.update()
    this.addEventListeners()
  }

  createRenderer() {
    this.renderer = new Renderer({
      alpha: true,
      antialias: true,
      dpr: Math.min(window.devicePixelRatio || 1, 2),
      // Keeps the last drawn frame on screen instead of flashing transparent
      // if a browser skips a compositor frame (e.g. right after the tab
      // regains focus, or under heavy load) between our rAF-driven redraws.
      preserveDrawingBuffer: true,
    })
    this.gl = this.renderer.gl
    this.gl.clearColor(0, 0, 0, 0)
    this.container.appendChild(this.renderer.gl.canvas as HTMLCanvasElement)
  }

  createCamera() {
    this.camera = new Camera(this.gl)
    this.camera.fov = 45
    this.camera.position.z = 20
  }

  createScene() {
    this.scene = new Transform()
  }

  createGeometry() {
    this.planeGeometry = new Plane(this.gl, { heightSegments: 50, widthSegments: 100 })
  }

  createMedias(items: GalleryItem[], bend: number, textColor: string, borderRadius: number, font: string) {
    this.items = items
    this.medias = items.map((data, index) => {
      return new Media({
        geometry: this.planeGeometry,
        gl: this.gl,
        image: data.image,
        index,
        length: items.length,
        scene: this.scene,
        screen: this.screen,
        text: data.title,
        viewport: this.viewport,
        bend,
        textColor,
        borderRadius,
        font,
        aspect: this.aspect,
      })
    })
  }

  getMaxScroll() {
    if (!this.medias[0]) return 0
    return this.medias[0].width * (this.items.length - 1)
  }

  setProgress(progress: number) {
    const maxScroll = this.getMaxScroll()
    this.scroll.target = clamp(progress, 0, 1) * maxScroll
  }

  hitTest(clientX: number, clientY: number): number | null {
    const rect = this.container.getBoundingClientRect()
    const x = clientX - rect.left
    const y = clientY - rect.top
    if (x < 0 || x > this.screen.width || y < 0 || y > this.screen.height) return null
    const worldX = (x / this.screen.width - 0.5) * this.viewport.width

    let closest: Media | null = null
    let closestDist = Infinity
    for (const media of this.medias) {
      if (media.isBefore || media.isAfter) continue
      const dist = Math.abs(media.plane.position.x - worldX)
      if (dist < closestDist) {
        closestDist = dist
        closest = media
      }
    }
    if (closest && closestDist < closest.plane.scale.x / 2) return closest.index
    return null
  }

  onTouchDown(e: MouseEvent | TouchEvent) {
    this.isDown = true
    this.hasDragged = false
    this.scroll.position = this.scroll.current
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
    this.start = clientX
    this.pointerDownX = clientX
    this.pointerDownY = clientY
    this.pointerDownTime = performance.now()
  }

  onTouchMove(e: MouseEvent | TouchEvent) {
    if (!this.isDown) return
    const x = 'touches' in e ? e.touches[0].clientX : e.clientX
    if (Math.abs(x - this.pointerDownX) > 6) this.hasDragged = true
    const distance = (this.start - x) * (this.scrollSpeed * 0.025)
    const maxScroll = this.getMaxScroll()
    this.scroll.target = clamp((this.scroll.position ?? 0) + distance, 0, maxScroll)
  }

  onTouchUp(e: MouseEvent | TouchEvent) {
    this.isDown = false
    const isQuickTap = !this.hasDragged && performance.now() - this.pointerDownTime < 500
    if (isQuickTap) {
      const index = this.hitTest(this.pointerDownX, this.pointerDownY)
      if (index !== null) this.onItemClick?.(index)
    }
    this.onCheck()
  }

  onHoverMove(e: MouseEvent) {
    if (this.isDown) return
    const index = this.hitTest(e.clientX, e.clientY)
    this.container.style.cursor = index !== null ? 'pointer' : 'grab'
  }

  onKeyDown(e: KeyboardEvent) {
    const maxScroll = this.getMaxScroll()
    if (e.key === 'ArrowRight') {
      e.preventDefault()
      this.scroll.target = clamp(this.scroll.target + this.scrollSpeed * 5, 0, maxScroll)
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      this.scroll.target = clamp(this.scroll.target - this.scrollSpeed * 5, 0, maxScroll)
    }
  }

  onCheck() {
    if (!this.medias[0]) return
    const width = this.medias[0].width
    const maxScroll = this.getMaxScroll()
    const itemIndex = Math.round(this.scroll.target / width)
    this.scroll.target = clamp(width * itemIndex, 0, maxScroll)
  }

  onResize() {
    this.screen = { width: this.container.clientWidth, height: this.container.clientHeight }
    this.renderer.setSize(this.screen.width, this.screen.height)
    this.camera.perspective({ aspect: this.screen.width / this.screen.height })
    const fov = (this.camera.fov * Math.PI) / 180
    const height = 2 * Math.tan(fov / 2) * this.camera.position.z
    const width = height * this.camera.aspect
    this.viewport = { width, height }
    if (this.medias) this.medias.forEach((media) => media.onResize({ screen: this.screen, viewport: this.viewport }))
  }

  update() {
    this.scroll.current = lerp(this.scroll.current, this.scroll.target, this.scroll.ease)
    if (this.medias) this.medias.forEach((media) => media.update(this.scroll))
    this.renderer.render({ scene: this.scene, camera: this.camera })
    this.scroll.last = this.scroll.current
    this.raf = window.requestAnimationFrame(this.update.bind(this))
  }

  addEventListeners() {
    this.boundOnResize = this.onResize.bind(this)
    this.boundOnTouchDown = this.onTouchDown.bind(this)
    this.boundOnTouchMove = this.onTouchMove.bind(this)
    this.boundOnTouchUp = this.onTouchUp.bind(this)
    this.boundOnKeyDown = this.onKeyDown.bind(this)
    this.boundOnHoverMove = this.onHoverMove.bind(this)

    window.addEventListener('resize', this.boundOnResize)
    window.addEventListener('mousedown', this.boundOnTouchDown)
    window.addEventListener('mousemove', this.boundOnTouchMove)
    window.addEventListener('mouseup', this.boundOnTouchUp)
    window.addEventListener('touchstart', this.boundOnTouchDown, { passive: true })
    window.addEventListener('touchmove', this.boundOnTouchMove, { passive: true })
    window.addEventListener('touchend', this.boundOnTouchUp)
    this.container.addEventListener('mousemove', this.boundOnHoverMove)
    this.container.addEventListener('keydown', this.boundOnKeyDown)
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
    if (this.renderer?.gl?.canvas?.parentNode) {
      this.renderer.gl.canvas.parentNode.removeChild(this.renderer.gl.canvas as HTMLCanvasElement)
    }
  }
}

export interface CircularGalleryHandle {
  setProgress: (progress: number) => void
}

interface CircularGalleryProps {
  items: GalleryItem[]
  bend?: number
  textColor?: string
  borderRadius?: number
  font?: string
  scrollSpeed?: number
  scrollEase?: number
  /** width / height, e.g. 16/9 for a normal screen. */
  aspect?: number
  onItemClick?: (index: number) => void
}

const CircularGallery = forwardRef<CircularGalleryHandle, CircularGalleryProps>(function CircularGallery(
  { items, bend = 1, textColor = 'rgba(255,255,255,0.92)', borderRadius = 0.04, font = '600 22px Inter, sans-serif', scrollSpeed = 2, scrollEase = 0.065, aspect = 16 / 9, onItemClick },
  ref
) {
  const containerRef = useRef<HTMLDivElement>(null)
  const appRef = useRef<App | null>(null)
  const onItemClickRef = useRef(onItemClick)
  onItemClickRef.current = onItemClick

  useImperativeHandle(ref, () => ({
    setProgress: (progress: number) => appRef.current?.setProgress(progress),
  }), [])

  useEffect(() => {
    if (!containerRef.current) return
    const app = new App(containerRef.current, {
      items,
      bend,
      textColor,
      borderRadius,
      font,
      scrollSpeed,
      scrollEase,
      aspect,
      onItemClick: (index) => onItemClickRef.current?.(index),
    })
    appRef.current = app
    return () => {
      app.destroy()
      appRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, bend, textColor, borderRadius, font, scrollSpeed, scrollEase, aspect])

  return (
    <div
      ref={containerRef}
      className="h-full w-full cursor-grab outline-none active:cursor-grabbing"
      tabIndex={0}
      role="region"
      aria-label="Project gallery. Scroll to move through projects, click a card to view details."
    />
  )
})

export default CircularGallery
