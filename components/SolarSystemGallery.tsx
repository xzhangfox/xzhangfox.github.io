'use client'

import * as THREE from 'three'
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'

export interface GalleryItem {
  image: string
  /** Hex color driving this item's own hologram neon duotone (see
   *  buildItems). Undefined falls back to the default cyan/magenta pair. */
  color?: string
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
  /** Dreamcore treatment: a hex glow/tint color applied as the planet's
   *  own emissive tint plus a soft rim-glow "atmosphere" shell.
   *  Undefined = no glow (the Sun already glows on its own). */
  auraColor?: string
  /** Emissive strength for the tint above — how strongly the planet's
   *  own surface glows with `auraColor`, not just its rim. Defaults to a
   *  gentle 0.35 when `auraColor` is set. */
  auraIntensity?: number
  /** How many 4-/5-pointed star sprites orbit in this planet's
   *  decorative halo ring. 0/undefined = no ring. */
  starRingCount?: number
  /** The halo ring's band center, as a multiple of the planet's own
   *  radius — kept well outside any content ring/debris band so the two
   *  never overlap. Defaults to 3.2. */
  starRingRadius?: number
}

export interface SolarSystemGalleryHandle {
  /** Zoom from the overview into this planet. */
  enterPlanet: (planetId: string) => void
  /** Zoom back out to the full solar-system overview. */
  leavePlanet: () => void
  /** Bring the item at this LOCAL index (within the currently-entered
   *  planet) into focus — ignored while in the overview. */
  goTo: (localIndex: number) => void
  /** The focused, fully-open screen's current on-screen rect — the same
   *  origin rect a direct craft click passes to `onItemClick`, exposed so a
   *  non-craft trigger (the HUD panel) can open the same project with the
   *  same FLIP-morph origin. */
  getFocusedScreenRect: () => ScreenRect | null
  /** Deselects without an instant hide — the open item's screen shrinks
   *  away exactly like switching to a different item would, and the ring
   *  resumes its continuous idle rotation once that finishes. Call this
   *  whenever the preview modal closes, by whatever means. */
  closeSelection: () => void
  /** Idling craft currently close enough to the camera to be worth a
   *  discoverability label, in live viewport pixels — empty the instant
   *  anything's selected. Meant to be polled from a caller-owned rAF loop. */
  getFlybyLabels: () => { index: number; x: number; y: number }[]
  /** Tell the gallery whether the full-page preview modal is actually
   *  open right now — while true, the flying item's craft/laser/screen
   *  are hidden (not just covered by the modal card, which doesn't span
   *  the whole viewport) so nothing shows through the modal's translucent
   *  backdrop. Call with true right when the modal opens, false right
   *  when it closes (by any means). */
  setPreviewOpen: (open: boolean) => void
}

interface HoverInfo {
  localIndex: number
  clientX: number
  clientY: number
}

/** The clicked hologram screen's current on-screen (viewport-pixel) rect —
 *  lets the caller morph a modal open from exactly where the screen was. */
export interface ScreenRect {
  top: number
  left: number
  width: number
  height: number
}

interface SolarSystemGalleryProps {
  planets: PlanetSite[]
  aspect?: number
  borderRadius?: number
  onItemClick?: (localIndex: number, rect: ScreenRect | null) => void
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
// Closer to the camera (distance 5.2, was 7.4) than the original tuning —
// the craft itself, not just its screen, should read as a clear, sizeable
// presence once arrived, not a small accent beside the hologram.
const BASE_CRAFT_FOCUS_OFFSET = new THREE.Vector3(0, 1, 18.8)
// How far into the bottom-left quadrant the arrived craft sits, as a
// fraction of the HALF visible width/height at its own focus distance
// (see onResize's craftOffsetXY) — 1.0 would put it exactly at the frame
// edge, so these stay well under that for a comfortable margin. The
// hologram screen itself is untouched (still centered), so this alone is
// what turns "craft dead center in front of its own screen" into "craft
// off in the corner, laser firing diagonally up to the screen."
const CRAFT_OFFSET_FRACTION_X = 0.42
const CRAFT_OFFSET_FRACTION_Y = 0.4
// Saturn's own bare radius (its ring is a bonus on top, not counted) — the
// reference every other planet's `viewScale` is computed against, so every
// planet's actual sphere reads at the same apparent size once entered.
const REFERENCE_RADIUS = 3.2
const IDENTITY_QUAT = new THREE.Quaternion()
const Y_AXIS = new THREE.Vector3(0, 1, 0)
// The craft mesh's own nose (its cone body, see createCraftGeometry) points
// along local +Z, but a Camera's lookAt orients its local -Z at the
// target — this 180° correction is applied on top of that lookAt result
// so the nose (not the engine) ends up pointing at whatever it's aimed at.
const NOSE_FLIP_QUAT = new THREE.Quaternion().setFromAxisAngle(Y_AXIS, Math.PI)
const ORIGIN = new THREE.Vector3(0, 0, 0)

// Shared by the laser material and the screen's glow/scan-band tint so the
// beam and the hologram it projects read as one continuous piece of light —
// "laser white."
const LASER_WHITE = new THREE.Color(0xeaf6ff)
// The screen's own edge/static tint — a cyberpunk cyan-magenta duotone
// instead of flat white, so the hologram's border and forming-static read
// as neon rather than a plain light.
const NEON_CYAN = new THREE.Color(0x1af2ff)
const NEON_MAGENTA = new THREE.Color(0xff2ec4)

// Derives a hologram's neon duotone from a single project color, the same
// hue-shift trick used for the planet aura's two-tone gradient — keeps every
// project's screen visually distinct instead of sharing the one global pair.
function neonDuotoneFrom(hex: string): [THREE.Color, THREE.Color] {
  const a = new THREE.Color(hex)
  const hsl = { h: 0, s: 0, l: 0 }
  a.getHSL(hsl)
  const boosted = new THREE.Color().setHSL(hsl.h, Math.min(hsl.s + 0.35, 1), Math.min(Math.max(hsl.l, 0.45), 0.62))
  const b = new THREE.Color().setHSL((hsl.h + 0.32) % 1, Math.min(hsl.s + 0.35, 1), Math.min(Math.max(hsl.l, 0.45), 0.62))
  return [boosted, b]
}

const SELF_SPIN_SPEED = 0.0018

// While nothing's selected, the whole ring slowly, continuously revolves
// (a fraction of a full loop per frame) rather than sitting frozen until
// the first click — this is what makes N items actually read as N craft
// orbiting, not N craft parked. ~65s for a full revolution at 60fps: slow
// and ambient, never fighting for attention with a focused item.
const IDLE_ORBIT_SPEED = 0.00026
// How close (real 3D distance to the camera, world units at viewScale=1)
// an idling craft must swing before it's worth a discoverability label —
// verified numerically to light up any one of Saturn's 4 items ~45% of
// the time (never two at once), reading as a brief close pass rather
// than a constant fixture. Camera sits ~24 units out; an idling craft's
// own closest approach to it (not a fixed ring position — the planet
// keeps slowly self-spinning even while entered) swings between ~18 and
// ~30 depending on where it is in its orbit, so 18.5 sits just above
// that minimum.
const FLYBY_LABEL_DISTANCE = 18.5

const CRAFT_SCALE_FAR = 0.5
const CRAFT_SCALE_NEAR = 1.6

// Eased speed for `flightT` (see PlanetInstance) flying an item IN toward
// the camera — slow and deliberate so the approach is actually watchable
// rather than a blur.
const FLIGHT_OPEN_EASE = 0.011
// Flying back OUT to the ring on close reuses the same eased-convergence
// mechanism but at its own, snappier rate — nobody asked for the retreat
// to be slower too, and an exponential ease's tail-end duration barely
// depends on how far it started, so sharing one rate would have made
// every close take several seconds for no reason.
const FLIGHT_CLOSE_EASE = 0.06
// Per-frame step for the screen's own reveal timer, independent of
// FLIGHT_OPEN_EASE — reaches 1 in ~20 frames (~0.33s) once the plane has
// formed, so the "flickering to life" moment always resolves quickly.
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
  uniform vec3 uNeonA;
  uniform vec3 uNeonB;
  varying vec2 vUv;

  float roundedBoxSDF(vec2 p, vec2 b, float r) {
    vec2 d = abs(p) - b;
    return length(max(d, vec2(0.0))) + min(max(d.x, d.y), 0.0) - r;
  }
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  void main() {
    float dClean = roundedBoxSDF(vUv - 0.5, vec2(0.5 - uBorderRadius), uBorderRadius);

    // Fray the boundary itself rather than leaving it a perfectly crisp
    // vector line — a coarse, slowly-crawling perturbation for a few small
    // "torn" notches, plus fine high-frequency jitter for a grainy dissolve
    // right at the line, so the silhouette itself reads as unstable light
    // rather than a flat rounded-rect shape.
    float frayCoarse = (hash(floor(vUv * vec2(22.0, 14.0)) + floor(uTime * 1.6)) - 0.5) * 0.022;
    float frayFine = (hash(floor(vUv * vec2(90.0, 56.0)) + floor(uTime * 9.0)) - 0.5) * 0.007;
    float d = dClean + frayCoarse + frayFine;
    if (d > 0.02) discard;
    // A soft dissolve right at the torn edge instead of a hard cutoff —
    // thins out to nothing rather than snapping off.
    float dissolveAlpha = 1.0 - smoothstep(0.0, 0.02, d);

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
        // Tinted cyan-to-magenta across the frame rather than flat white,
        // a cyberpunk duotone static instead of a plain TV-snow look.
        float noise = hash(floor(vUv * vec2(160.0, 100.0)) + floor(uTime * 22.0));
        float scan = 0.6 + 0.4 * sin(vUv.y * 380.0 - uTime * 46.0);
        vec3 staticTint = mix(uNeonA, uNeonB, vUv.x);
        color = staticTint * (noise * 0.7 + 0.3) * scan * uFlicker;
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
        // Fine persistent scanlines across the whole revealed image — the
        // classic CRT/hologram cyberpunk texture, not just the sweeping
        // band below.
        base *= 0.9 + 0.1 * sin(vUv.y * 240.0);
        float imgAlpha = mix(1.0, 0.55, glitchActive);
        // The revealed image itself no longer dims/flickers with uFlicker —
        // it holds steady once shown; only the edge glow below carries the
        // flicker now, so the picture stays legible while the border still
        // reads as unstable light.
        color = mix(color, base, reveal);
        alpha = mix(alpha, imgAlpha, reveal);

        // A bright scan-band slowly sweeping down the revealed image —
        // reads as an active projection/scan rather than instability, the
        // way the static/glitch effects do.
        float scanY = fract(uTime * 0.12);
        float scanDist = abs(vUv.y - (1.0 - scanY));
        float scanBand = smoothstep(0.05, 0.0, scanDist) * 0.32;
        color += uLaserWhite * scanBand * reveal;
      }
    }

    // Narrower band than the original (was -0.045..-0.01) so the glow
    // reads as a defined edge rather than a wide halo eating into the
    // image. uFlicker lives ONLY here now — the image content above holds
    // steady regardless of it, so what actually flickers is just this
    // ring of light around the picture, not the picture itself.
    float edge = smoothstep(-0.026, -0.008, d);
    vec3 edgeNoise = vec3(hash(vUv * 300.0 + uTime * 5.0));
    // A cyan-magenta gradient slowly chasing around the border's own
    // perimeter (angle from center) rather than a flat white ring — the
    // neon-sign-edge cyberpunk cue.
    float edgeAngle = atan(vUv.y - 0.5, vUv.x - 0.5) / 6.2831853 + 0.5;
    vec3 edgeBase = mix(uNeonA, uNeonB, fract(edgeAngle + uTime * 0.05));
    vec3 edgeColor = mix(edgeBase, edgeNoise, glitchActive * 0.7);
    float edgeStrength = edge * 0.55 * (1.0 + glitchActive * 0.6) * uFlicker;
    color = mix(color, edgeColor, clamp(edgeStrength, 0.0, 1.0));
    alpha = mix(alpha, 1.0, edge * uFlicker);
    alpha *= dissolveAlpha;

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
  uniform float uTime;
  varying float vRadialU;
  void main() {
    vec4 tex = texture2D(uRingMap, vec2(vRadialU, 0.5));
    if (tex.a < 0.02) discard;
    // Dazzling rather than the flat, muted photographic tan it starts
    // as: push saturation and brightness up, then sweep a soft shimmer
    // band across the radius over time, like light catching dust.
    vec3 color = tex.rgb;
    float luma = dot(color, vec3(0.299, 0.587, 0.114));
    color = mix(vec3(luma), color, 1.6);
    color *= 1.25;
    float shimmer = smoothstep(0.1, 0.0, abs(fract(vRadialU * 3.0 - uTime * 0.15) - 0.5)) * 0.35;
    color += shimmer;
    tex = vec4(color, tex.a);
    gl_FragColor = tex;
  }
`

// A small shared craft design, loosely modeled on a chunky sci-fi
// cargo-hauler reference (rounded hull, a big glowing sensor "eye" at the
// nose, small swept fins, a couple of antenna spikes) rather than the
// original plain cone+flat-wings silhouette: a rounded capsule hull, a
// glowing nose lens (doubling as where the laser visually originates,
// since the nose is already the craft's established forward axis — see
// NOSE_FLIP_QUAT), swept fins, antenna spikes, a dimmer rear thruster
// glow, and a soft pulsing halo ring. Instanced once per project (the
// lens/engine tint varies by index).
function createCraftGeometry() {
  const body = new THREE.CapsuleGeometry(0.075, 0.2, 4, 8)
  body.rotateX(Math.PI / 2)
  const fin = new THREE.BoxGeometry(0.22, 0.012, 0.08)
  const antenna = new THREE.CylinderGeometry(0.004, 0.006, 0.13, 4)
  const lens = new THREE.CircleGeometry(0.05, 20)
  const lensRim = new THREE.RingGeometry(0.05, 0.066, 20)
  const halo = new THREE.RingGeometry(0.19, 0.225, 28)
  const greeble = new THREE.BoxGeometry(0.028, 0.014, 0.02)
  const vent = new THREE.BoxGeometry(0.05, 0.008, 0.03)
  const spine = new THREE.BoxGeometry(0.018, 0.03, 0.09)
  const windowStrip = new THREE.BoxGeometry(0.012, 0.006, 0.11)
  return { body, fin, antenna, lens, lensRim, halo, greeble, vent, spine, windowStrip }
}
const CRAFT_GEO = createCraftGeometry()

// A small procedural texture (faint grain + panel-line grid) for the
// hull material — called lazily from inside createCraft (never at module
// scope, since `document` doesn't exist wherever this module might get
// evaluated outside the browser) and cached so every craft instance
// shares the one canvas instead of each generating its own. Turns the
// hull from a single flat color into something that reads as worn,
// paneled metal.
let hullTexture: THREE.CanvasTexture | null = null
function getHullTexture(): THREE.CanvasTexture {
  if (hullTexture) return hullTexture
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#b7c0cb'
  ctx.fillRect(0, 0, size, size)
  const imgData = ctx.getImageData(0, 0, size, size)
  for (let i = 0; i < imgData.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 20
    imgData.data[i] = Math.min(255, Math.max(0, imgData.data[i] + n))
    imgData.data[i + 1] = Math.min(255, Math.max(0, imgData.data[i + 1] + n))
    imgData.data[i + 2] = Math.min(255, Math.max(0, imgData.data[i + 2] + n))
  }
  ctx.putImageData(imgData, 0, 0)
  ctx.strokeStyle = 'rgba(35,38,44,0.55)'
  ctx.lineWidth = 1
  for (let y = 14; y < size; y += 28) {
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(size, y)
    ctx.stroke()
  }
  for (let x = 20; x < size; x += 42) {
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, size)
    ctx.stroke()
  }
  hullTexture = new THREE.CanvasTexture(canvas)
  hullTexture.wrapS = THREE.RepeatWrapping
  hullTexture.wrapT = THREE.RepeatWrapping
  hullTexture.repeat.set(3, 1)
  return hullTexture
}

function createCraft(index: number): { group: THREE.Group; halo: THREE.Mesh } {
  const group = new THREE.Group()
  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0xb9c2cc,
    map: getHullTexture(),
    roughness: 0.4,
    roughnessMap: getHullTexture(),
    metalness: 0.75,
  })
  const body = new THREE.Mesh(CRAFT_GEO.body, bodyMat)
  group.add(body)

  // A raised dorsal spine and a few small greebled panels/vents break up
  // the capsule's smooth surface into something that reads as an
  // assembled hull rather than a bare primitive.
  // Positioned at roughly the hull's own radius (0.075) so each sits
  // half-embedded, half-protruding — clearly raised off the surface
  // rather than buried inside it.
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x33373f, roughness: 0.55, metalness: 0.65 })
  const spine = new THREE.Mesh(CRAFT_GEO.spine, darkMat)
  spine.position.set(0, 0.078, -0.01)
  group.add(spine)

  const greebleMat = new THREE.MeshStandardMaterial({ color: 0x4a4f58, roughness: 0.6, metalness: 0.55 })
  const greebleSpecs: [number, number, number][] = [
    [-0.046, 0.06, 0.06],
    [0.053, 0.053, -0.04],
    [-0.066, -0.036, -0.09],
  ]
  for (const [x, y, z] of greebleSpecs) {
    const g = new THREE.Mesh(CRAFT_GEO.greeble, greebleMat)
    g.position.set(x, y, z)
    group.add(g)
  }
  const vent = new THREE.Mesh(CRAFT_GEO.vent, darkMat)
  vent.position.set(0, -0.078, -0.11)
  group.add(vent)

  const finMat = new THREE.MeshStandardMaterial({ color: 0x82899a, roughness: 0.5, metalness: 0.6 })
  const finL = new THREE.Mesh(CRAFT_GEO.fin, finMat)
  finL.position.set(-0.1, -0.008, 0.03)
  finL.rotation.z = 0.22
  const finR = finL.clone()
  finR.position.x = 0.1
  finR.rotation.z = -0.22
  group.add(finL, finR)

  const antennaMat = new THREE.MeshStandardMaterial({ color: 0x5c6270, roughness: 0.6, metalness: 0.5 })
  const antennaL = new THREE.Mesh(CRAFT_GEO.antenna, antennaMat)
  antennaL.position.set(-0.07, 0.05, 0.02)
  antennaL.rotation.set(0.3, 0, 0.35)
  const antennaR = antennaL.clone()
  antennaR.position.x = 0.07
  antennaR.rotation.z = -0.35
  group.add(antennaL, antennaR)

  const engineHue = 0.5 + ((index * 0.21) % 1) * 0.12
  const engineColor = new THREE.Color().setHSL(engineHue, 0.9, 0.6)
  // The nose "eye" — a bright sensor/laser lens in this project's own
  // accent hue, right at the tip the craft is already oriented to point
  // (see NOSE_FLIP_QUAT), so the beam visually originates from it.
  const lens = new THREE.Mesh(
    CRAFT_GEO.lens,
    new THREE.MeshStandardMaterial({
      color: engineColor,
      emissive: engineColor,
      emissiveIntensity: 2.4,
      roughness: 0.3,
      side: THREE.DoubleSide,
    })
  )
  lens.position.z = 0.176
  const lensRim = new THREE.Mesh(
    CRAFT_GEO.lensRim,
    new THREE.MeshStandardMaterial({ color: 0x1a1c20, roughness: 0.5, metalness: 0.6, side: THREE.DoubleSide })
  )
  lensRim.position.z = 0.175
  group.add(lens, lensRim)

  // A thin glowing "window strip" along the flank, in the same accent
  // hue — echoes the reference ship's lit cabin windows.
  const windowStrip = new THREE.Mesh(
    CRAFT_GEO.windowStrip,
    new THREE.MeshStandardMaterial({ color: engineColor, emissive: engineColor, emissiveIntensity: 1.8, roughness: 0.3 })
  )
  windowStrip.position.set(0.077, 0.01, 0.02)
  group.add(windowStrip)

  // A dimmer rear thruster glow, echoing the nose lens's own hue.
  const engine = new THREE.Mesh(
    new THREE.SphereGeometry(0.032, 8, 8),
    new THREE.MeshStandardMaterial({ color: engineColor, emissive: engineColor, emissiveIntensity: 1.6, roughness: 0.4 })
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

const LASER_VERTEX = `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vViewPos;
  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vViewPos = -mvPosition.xyz;
    gl_Position = projectionMatrix * mvPosition;
  }
`
// A cheap volumetric-looking beam rather than a flat-shaded cone: fresnel
// (brighter where the surface is viewed edge-on, the standard trick for
// faking a light shaft with a single hollow mesh) combined with a
// coarse, slowly-drifting noise for visible motes drifting in the beam —
// the Tyndall-effect look of light scattering off dust — and a strong
// fade from bright at the craft (source, vUv.y=0) to faint at the screen
// end (vUv.y=1), so the beam clearly reads as strongest right at the
// emitter and dissipating with distance, not a uniform-intensity shaft.
const LASER_FRAGMENT = `
  precision highp float;
  uniform vec3 uColor;
  uniform float uOpacity;
  uniform float uTime;
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vViewPos;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  void main() {
    vec3 viewDir = normalize(vViewPos);
    float fresnel = pow(1.0 - clamp(abs(dot(normalize(vNormal), viewDir)), 0.0, 1.0), 2.2);
    float lengthFade = pow(1.0 - clamp(vUv.y, 0.0, 1.0), 1.6);
    float streak = hash(vec2(floor(vUv.y * 26.0 - uTime * 2.2), floor(vUv.x * 5.0)));
    float dust = 0.65 + 0.55 * streak;
    float alpha = clamp(fresnel * 0.8 + 0.12, 0.0, 1.0) * mix(0.12, 1.0, lengthFade) * dust * uOpacity;
    gl_FragColor = vec4(uColor, alpha);
  }
`

// A 4-sided pyramid, not a smooth round cone — apex at the craft, base
// the screen's own four actual corners. Its vertex positions are written
// directly in WORLD space every frame (see activeUpdate), not derived
// from the mesh's position/quaternion/scale: the craft now parks off to
// one side rather than dead-center, so the apex-to-base direction is
// diagonal, not perpendicular to the screen — an oblique pyramid, which
// a single rigid transform (rotate the whole shape, then scale its local
// x/y) can't represent while ALSO keeping the base's four corners
// axis-aligned with the screen's own fixed, always-camera-facing
// rectangle. Writing world positions directly sidesteps that entirely:
// whatever the apex's direction to the screen is, the base is simply the
// screen's real corners, exactly. The mesh's own transform stays
// identity. Initial values here are placeholders, overwritten before the
// mesh is ever shown.
function createLaserGeometry(): THREE.BufferGeometry {
  const positions = new Float32Array(36)
  const uvs = new Float32Array([
    0.5, 0, 0, 1, 1, 1,
    0.5, 0, 0, 1, 1, 1,
    0.5, 0, 0, 1, 1, 1,
    0.5, 0, 0, 1, 1, 1,
  ])
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage))
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
  geometry.computeVertexNormals()
  return geometry
}

function createLaser(): THREE.Mesh {
  const geometry = createLaserGeometry()
  const material = new THREE.ShaderMaterial({
    vertexShader: LASER_VERTEX,
    fragmentShader: LASER_FRAGMENT,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: {
      uColor: { value: new THREE.Vector3(LASER_WHITE.r, LASER_WHITE.g, LASER_WHITE.b) },
      uOpacity: { value: 0 },
      uTime: { value: 0 },
    },
  })
  const mesh = new THREE.Mesh(geometry, material)
  // Its geometry is rewritten with world-space vertex positions every
  // frame (see activeUpdate) rather than moved via position/scale, so
  // the bounding sphere Three.js would normally frustum-cull against
  // never gets recomputed from the placeholder (all-zero) vertices this
  // starts with — skip culling for this small, cheap mesh entirely
  // rather than paying for computeBoundingSphere() every frame too.
  mesh.frustumCulled = false
  return mesh
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

// A small 4- or 5-pointed star/sparkle sprite texture for the dreamcore
// halo rings — generated lazily (never at module scope, `document` isn't
// available wherever this module might get evaluated outside the
// browser) and cached per point-count so every sprite across every
// planet shares the same two textures.
const starTextures: Partial<Record<4 | 5, THREE.CanvasTexture>> = {}
function getStarTexture(points: 4 | 5): THREE.CanvasTexture {
  const cached = starTextures[points]
  if (cached) return cached
  const size = 64
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  const outerR = size * 0.46
  const innerR = points === 4 ? outerR * 0.22 : outerR * 0.42
  ctx.translate(size / 2, size / 2)
  ctx.beginPath()
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outerR : innerR
    const a = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2
    const x = Math.cos(a) * r
    const y = Math.sin(a) * r
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.closePath()
  ctx.shadowColor = 'rgba(255,255,255,0.95)'
  ctx.shadowBlur = size * 0.2
  ctx.fillStyle = '#ffffff'
  ctx.fill()
  const texture = new THREE.CanvasTexture(canvas)
  starTextures[points] = texture
  return texture
}

// A soft additive rim-glow "atmosphere" shell around a planet — the
// standard fresnel-on-backfaces trick (bright at the grazing silhouette,
// near-invisible face-on, and naturally hidden across the planet's own
// disc since its opaque mesh occludes the shell's near side): the same
// fresnel shape the laser beam's material already uses, just on a sphere
// instead of a pyramid.
const AURA_VERTEX = `
  varying vec3 vNormal;
  varying vec3 vViewPos;
  varying vec3 vLocalPos;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    vLocalPos = normalize(position);
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vViewPos = -mvPosition.xyz;
    gl_Position = projectionMatrix * mvPosition;
  }
`
// A cyberpunk duotone rather than one flat glow color: blends between two
// accent hues along a slow-drifting diagonal, so the rim itself reads as
// a living neon gradient (think cyan bleeding into magenta) instead of a
// single uniform tint.
const AURA_FRAGMENT = `
  precision highp float;
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform float uIntensity;
  uniform float uTime;
  varying vec3 vNormal;
  varying vec3 vViewPos;
  varying vec3 vLocalPos;
  void main() {
    vec3 viewDir = normalize(vViewPos);
    float fresnel = pow(1.0 - clamp(dot(normalize(vNormal), viewDir), 0.0, 1.0), 2.4);
    float g = clamp(vLocalPos.y * 0.5 + 0.5 + sin(uTime * 0.3) * 0.18, 0.0, 1.0);
    vec3 color = mix(uColorA, uColorB, g);
    gl_FragColor = vec4(color, fresnel * uIntensity);
  }
`
function createAuraShell(radius: number, colorA: THREE.Color, colorB: THREE.Color, intensity: number): THREE.Mesh {
  const material = new THREE.ShaderMaterial({
    vertexShader: AURA_VERTEX,
    fragmentShader: AURA_FRAGMENT,
    uniforms: {
      uColorA: { value: new THREE.Vector3(colorA.r, colorA.g, colorA.b) },
      uColorB: { value: new THREE.Vector3(colorB.r, colorB.g, colorB.b) },
      uIntensity: { value: intensity },
      uTime: { value: 0 },
    },
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.BackSide,
  })
  return new THREE.Mesh(new THREE.SphereGeometry(radius * 1.12, 32, 32), material)
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
  // `angle`/`radius`/`y` are the debris's own fixed orbital slot (set once
  // at construction); its rendered position is recomputed every frame as
  // `angle + ringPhase*2π`, the same shared rotation the craft ring reads
  // — so dragging or idling the ring visibly carries the debris field
  // around with it, not just the craft.
  debris: { mesh: THREE.Mesh; spin: THREE.Vector3; angle: number; radius: number; y: number }[] = []
  orbitAngle: number

  // Dreamcore ornamentation (see PlanetSite's auraColor/starRingCount):
  // an optional rim-glow shell and a ring of twinkling star sprites,
  // both purely decorative, updated every frame in advanceOrbit — unlike
  // the craft ring these run for every planet regardless of focus, since
  // they're visible in the overview too.
  aura?: THREE.Mesh
  auraBaseIntensity = 0
  starRing: {
    sprite: THREE.Sprite
    angle: number
    radius: number
    y: number
    baseOpacity: number
    twinkleSeed: number
  }[] = []

  count: number
  crafts: THREE.Group[] = []
  crewHalos: THREE.Mesh[] = []
  screens: THREE.Mesh[] = []
  lasers: THREE.Mesh[] = []
  revealTimer: number[] = []
  itemOrbitRadius = 0

  /** The ring's own rotational phase (0-1, wraps). Only ever advanced by
   *  `idleSelectionUpdate` — the instant something's selected it simply
   *  stops being touched, which is what freezes every craft on the ring
   *  in place for as long as `anySelected` is true. */
  ringPhase = 0.5
  /** True once the user has clicked a specific item on this planet —
   *  before that, every craft just idles on the ring. */
  anySelected = false
  activeIndex = -1
  /** The item that's genuinely selected/open right now — -1 once closing
   *  has begun (see `closeSelection`), even while that item's craft is
   *  still mid-flight back to the ring. Used for "is this open" checks
   *  (the HUD, click-to-open-modal) that shouldn't count a closing item
   *  as open anymore. */
  openIndex = -1
  /** Which craft is currently animating between its ring slot and the
   *  focus spot — open or closing, always at most one at a time. -1 =
   *  every craft is just idling (or none exist yet). */
  flightIndex = -1
  /** true = flying from its ring slot toward focus (`flightT` 0→1); false
   *  = flying back from focus toward its ring slot (`flightT` 1→0). */
  flightOpening = false
  /** 0 = sitting at its captured ring slot (`flightHomeLocalPos`/Quat), 1
   *  = fully at the focus spot. A straight local-space lerp between the
   *  two — never follows the ring around, so it can't swing behind the
   *  planet the way riding the ring's own rotation could. */
  flightT = 0
  flightHomeLocalPos = new THREE.Vector3()
  flightHomeQuat = new THREE.Quaternion()

  // Scratch objects reused every frame to avoid per-item GC churn.
  _ringPos = new THREE.Vector3()
  _localPos = new THREE.Vector3()
  _craftWorldPos = new THREE.Vector3()
  _craftFocusLocal = new THREE.Vector3()
  _ringQuat = new THREE.Quaternion()
  _itemQuat = new THREE.Quaternion()
  _ringEuler = new THREE.Euler()
  _focusQuat = new THREE.Quaternion()
  _focusWorldScratch = new THREE.Vector3()
  _cameraOffsetScratch = new THREE.Vector3()
  _focusOffsetScratch = new THREE.Vector3()
  _craftFocusOffsetScratch = new THREE.Vector3()
  _screenFocusLocal = new THREE.Vector3()
  // The screen's own four actual world-space corners — the laser beam's
  // base, written directly into its geometry each frame (see
  // createLaserGeometry's own comment on why a rigid transform can't do
  // this once the beam's direction is oblique).
  _laserCorners = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()]
  // A reusable (never-rendered) camera purely for its lookAt math — see
  // `computeOverviewQuat`'s own comment on why a plain Object3D's lookAt
  // silently computes the wrong rotation and a Camera's doesn't. Reused
  // every frame (not recreated) since this runs inside `activeUpdate`,
  // unlike the once-per-resize overview version.
  _aimScratchCam = new THREE.PerspectiveCamera()

  cameraOffset(): THREE.Vector3 {
    return this._cameraOffsetScratch.copy(BASE_CAMERA_OFFSET).multiplyScalar(this.viewScale)
  }
  focusOffset(): THREE.Vector3 {
    return this._focusOffsetScratch.copy(BASE_FOCUS_OFFSET).multiplyScalar(this.viewScale)
  }
  craftFocusOffset(): THREE.Vector3 {
    const off = this._craftFocusOffsetScratch.copy(BASE_CRAFT_FOCUS_OFFSET).multiplyScalar(this.viewScale)
    const xy = this._craftOffsetXYRef?.value
    if (xy) {
      off.x += xy.x * this.viewScale
      off.y += xy.y * this.viewScale
    }
    return off
  }

  // Set by the App before calling activeUpdate — a shared, resize-driven
  // scale factor (same for every planet since the camera/focus geometry is
  // identical everywhere).
  _focusScaleAdjustRef: { value: number } | null = null
  /** Same idea, for the craft's bottom-left lateral offset (see App's
   *  onResize) — shared and resize-driven since the geometry producing it
   *  is identical for every planet. */
  _craftOffsetXYRef: { value: THREE.Vector2 } | null = null

  /** Scales the camera/focus/craft-parking offsets and the hologram screen
   *  so every planet fills the same apparent size once entered and its
   *  screen reads at the same size, regardless of its real radius. 1 for
   *  Saturn itself (the reference). */
  viewScale: number
  /** Stored (not just passed through to buildItems) so activeUpdate can
   *  size the laser beam's base to match the screen's own actual
   *  width/height. */
  aspect: number

  constructor(site: PlanetSite, scene: THREE.Scene, aspect: number, borderRadius: number, seedIndex: number) {
    this.site = site
    this.scene = scene
    this.count = site.items?.length ?? 0
    this.orbitAngle = site.orbitPhase ?? seedIndex * 2.399963 // golden-angle-ish spread
    this.viewScale = site.radius / REFERENCE_RADIUS
    this.aspect = aspect

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

    if (site.auraColor && !isSun) {
      const color = new THREE.Color(site.auraColor)
      const intensity = site.auraIntensity ?? 0.35
      const mat = this.mesh.material as THREE.MeshStandardMaterial
      // Tints the DIFFUSE color, not a flat emissive wash — emissive
      // light is uniform regardless of the scene's own directional
      // light, so a strong emissive tint erased the lit/shadowed
      // gradient a sphere needs to read as 3D and left every planet
      // looking like a flat colored disc. Lerping `color` toward the hue
      // instead still gets multiplied by the real directional/ambient
      // lighting per pixel, so the sphere keeps its terminator (bright
      // side, dark side) while still reading in the dreamcore hue. A
      // much smaller emissive is kept on top, just enough for a glow
      // accent, not enough to flatten the shading again.
      mat.color = new THREE.Color(1, 1, 1).lerp(color, Math.min(intensity * 1.3, 0.75))
      mat.emissive = color
      mat.emissiveIntensity = intensity * 0.18
      this.auraBaseIntensity = intensity * 1.8
      // A second accent hue, hue-shifted off the planet's own color
      // rather than hand-authored per planet, so the rim reads as a
      // cyberpunk two-tone gradient instead of one flat glow — a
      // complementary-ish shift (~115°) plus a slight push toward more
      // saturated/brighter so the second color doesn't just read as a
      // duller version of the first.
      const hsl = { h: 0, s: 0, l: 0 }
      color.getHSL(hsl)
      const color2 = new THREE.Color().setHSL((hsl.h + 0.32) % 1, Math.min(hsl.s + 0.15, 1), Math.min(hsl.l + 0.08, 0.75))
      this.aura = createAuraShell(site.radius, color, color2, this.auraBaseIntensity)
      this.group.add(this.aura)
    }

    if (site.starRingCount && site.starRingCount > 0) {
      this.buildStarRing(
        site.auraColor ? new THREE.Color(site.auraColor) : new THREE.Color(0xffffff),
        site.starRingCount,
        site.starRingRadius ?? 3.2
      )
    }

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
          uniforms: {
            uRingMap: { value: ringTex },
            uInner: { value: ringInner },
            uOuter: { value: ringOuter },
            uTime: { value: 0 },
          },
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
      // Dazzling gem/crystal chunks, not dull rock: mostly gold to match
      // the ring, with the occasional icy-cyan glint, saturated and
      // glowing rather than the flat muted brown they started as.
      const gold = Math.random() < 0.8
      const hue = gold ? 0.1 + Math.random() * 0.06 : 0.52 + Math.random() * 0.08
      const baseColor = new THREE.Color().setHSL(hue, 0.55 + Math.random() * 0.35, 0.45 + Math.random() * 0.25)
      const material = new THREE.MeshStandardMaterial({
        color: baseColor,
        roughness: 0.2 + Math.random() * 0.25,
        metalness: 0.6 + Math.random() * 0.3,
        emissive: baseColor,
        emissiveIntensity: 0.25 + Math.random() * 0.3,
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
        angle,
        radius,
        y: yJitter,
      })
    }
  }

  // A ring of twinkling 4-/5-pointed star sprites well outside any
  // content ring/debris band (see PlanetSite.starRingRadius), a
  // dreamcore halo rather than a realistic planetary ring.
  buildStarRing(color: THREE.Color, count: number, radiusMultiplier: number) {
    for (let i = 0; i < count; i++) {
      const points: 4 | 5 = Math.random() < 0.5 ? 4 : 5
      const material = new THREE.SpriteMaterial({
        map: getStarTexture(points),
        color,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
      const sprite = new THREE.Sprite(material)
      const angle = Math.random() * Math.PI * 2
      const radius = this.site.radius * radiusMultiplier * (0.85 + Math.random() * 0.3)
      const yJitter = (Math.random() - 0.5) * this.site.radius * 0.6
      sprite.scale.setScalar(this.site.radius * (0.14 + Math.random() * 0.18))
      this.group.add(sprite)
      this.starRing.push({
        sprite,
        angle,
        radius,
        y: yJitter,
        baseOpacity: 0.55 + Math.random() * 0.45,
        twinkleSeed: Math.random() * Math.PI * 2,
      })
    }
  }

  buildItems(items: GalleryItem[], aspect: number, borderRadius: number) {
    const height = SCREEN_HEIGHT
    const width = height * aspect
    const screenGeometry = new THREE.PlaneGeometry(width, height)
    const loader = new THREE.TextureLoader()

    items.forEach((item, index) => {
      const [neonA, neonB] = item.color ? neonDuotoneFrom(item.color) : [NEON_CYAN, NEON_MAGENTA]
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
          uNeonA: { value: new THREE.Vector3(neonA.r, neonA.g, neonA.b) },
          uNeonB: { value: new THREE.Vector3(neonB.r, neonB.g, neonB.b) },
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

    this.revealTimer = new Array(this.count).fill(0)
  }

  advanceOrbit(parentPos: THREE.Vector3, time: number) {
    this.orbitAngle += this.site.orbitSpeed
    this.group.position.set(
      parentPos.x + this.site.orbitRadius * Math.cos(this.orbitAngle),
      parentPos.y,
      parentPos.z + this.site.orbitRadius * Math.sin(this.orbitAngle)
    )
    this.group.rotation.y += SELF_SPIN_SPEED
    this._updateOrnamentation(time)
  }

  // Dreamcore decoration, updated for every planet every frame regardless
  // of focus — the halo ring and rim glow are visible in the overview
  // too, not just once a planet's entered.
  _updateOrnamentation(time: number) {
    if (this.starRing.length) {
      // Tied to orbitAngle (not a separate counter) so a drag that spins
      // the orbit visibly spins the halo along with it too.
      const rot = this.orbitAngle * 0.3
      for (const s of this.starRing) {
        const a = s.angle + rot
        s.sprite.position.set(s.radius * Math.sin(a), s.y, s.radius * Math.cos(a))
        const twinkle = 0.5 + 0.5 * Math.sin(time * 2.2 + s.twinkleSeed)
        ;(s.sprite.material as THREE.SpriteMaterial).opacity = s.baseOpacity * (0.5 + 0.5 * twinkle)
      }
    }
    if (this.aura) {
      const mat = this.aura.material as THREE.ShaderMaterial
      mat.uniforms.uIntensity.value = this.auraBaseIntensity * (0.85 + 0.15 * Math.sin(time * 1.3))
      mat.uniforms.uTime.value = time
    }
    if (this.ring) {
      ;(this.ring.material as THREE.ShaderMaterial).uniforms.uTime.value = time
    }
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

  /** True while the full-page preview modal is actually open for the
   *  flying item — the modal's backdrop is translucent, so without this
   *  the craft/laser/screen behind it (now off in the corner rather than
   *  fully covered by the modal card, since the card is sized to the
   *  hologram screen's own width, not the whole viewport) would keep
   *  quietly fading in/settling and show through. `activeUpdate` hides
   *  them each frame while this is true, without touching `flightT` or
   *  any of the underlying position math, so closing the modal picks up
   *  exactly where the flight actually is. */
  previewOpen = false

  // Hides the planet itself (mesh/ring/debris, all children of `group`) and
  // its orbit line — used so entering one planet hides every other one
  // (including, once close up, its own now-enormous-looking orbit ring).
  setSceneVisible(visible: boolean) {
    this.group.visible = visible
    if (this.orbitLine) this.orbitLine.visible = visible
  }

  // The ring stays completely frozen once something's selected (nothing
  // resumes advancing `ringPhase` until it's fully deselected again — see
  // `activeUpdate`), so the craft's actual ring slot at THIS instant is
  // captured once and reused for the whole selection, including the
  // return trip on close. It then flies there via a straight local-space
  // lerp — never along the ring — so the path can't swing behind the
  // planet the way following the ring's own rotation could.
  goTo(index: number) {
    if (this.count < 1) return
    this.anySelected = true
    this.openIndex = index
    if (this.flightIndex !== index) {
      // Switching directly from a different open item: that one just
      // snaps back to its ring slot (badges/dots/clicking a different
      // craft are a secondary path here — the primary open/close flow
      // this is built for only ever has one item in flight at a time).
      this.flightIndex = index
      this.flightT = 0
      const theta = wrap01(this.ringPhase + index / this.count) * Math.PI * 2
      this.flightHomeLocalPos.set(this.itemOrbitRadius * Math.sin(theta), 0, this.itemOrbitRadius * Math.cos(theta))
      this.flightHomeQuat.setFromEuler(new THREE.Euler(-Math.PI / 2, -theta, 0))
    }
    this.flightOpening = true
  }

  // Deselects without an instant hide — `flightT` eases back from wherever
  // it is toward 0 (see `activeUpdate`), flying the craft back to the
  // exact ring slot `goTo` captured, and only hands `anySelected` back to
  // false (resuming idle rotation) once it's actually arrived there. No
  // separate "resume" call needed. `resetSelection()`'s harder, immediate
  // hide stays reserved for `enterPlanet()`, where nothing was visually
  // open yet in the newly-entered planet's own context.
  closeSelection() {
    if (!this.anySelected || this.openIndex < 0) return
    this.openIndex = -1
    this.flightOpening = false
  }

  resetSelection() {
    this.anySelected = false
    this.activeIndex = -1
    this.openIndex = -1
    this.flightIndex = -1
    this.flightT = 0
    this.previewOpen = false
    this.ringPhase = 0.5 / Math.max(this.count, 1)
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
    // Scaled by viewScale, matching the flying craft's own scale formula
    // (CRAFT_SCALE_FAR is exactly its flightT=0 value) — without this, a
    // small-viewScale planet's idle craft rendered at a flat, unscaled
    // size while its much closer idle-distance camera (viewScale also
    // shrinks the camera's distance) made it look disproportionately
    // large — on the Moon, actually bigger than the "arrived" craft,
    // backwards from the intended "closer to camera looks bigger." This
    // also removes the visible size jump right at the moment a craft is
    // clicked: idle and the first flight frame now use the identical
    // formula instead of suddenly gaining a viewScale factor.
    craft.scale.setScalar(CRAFT_SCALE_FAR * this.viewScale)
    const halo = this.crewHalos[i]
    const pulse = 0.35 + 0.25 * (0.5 + 0.5 * Math.sin(time * 3.2 + i * 1.7))
    ;(halo.material as THREE.MeshBasicMaterial).opacity = pulse
  }

  // The full craft/laser/hologram choreography for whichever ONE craft is
  // currently in flight (open or closing, `this.flightIndex`) — every
  // other item just idles, frozen, at the ring phase the flight began at
  // (`this.ringPhase` isn't touched anywhere in here, only read).
  activeUpdate(time: number): number {
    const masterT = this.ringPhase

    this.group.updateMatrixWorld()
    this._craftFocusLocal.copy(this.group.position).add(this.craftFocusOffset())
    this.group.worldToLocal(this._craftFocusLocal)
    // The screen's own local position, so the arrived craft can aim its
    // nose at it directly rather than just facing the camera — necessary
    // now that the craft parks off in the bottom-left corner instead of
    // dead center in front of its screen.
    this._screenFocusLocal.copy(this.group.position).add(this.focusOffset())
    this.group.worldToLocal(this._screenFocusLocal)
    this._aimScratchCam.position.copy(this._craftFocusLocal)
    this._aimScratchCam.up.copy(Y_AXIS)
    this._aimScratchCam.lookAt(this._screenFocusLocal)
    this._focusQuat.copy(this._aimScratchCam.quaternion).multiply(NOSE_FLIP_QUAT)

    const flying = this.flightIndex
    if (flying >= 0) {
      // Opening (flying toward the camera) uses a slow, deliberate ease so
      // the approach is actually watchable; closing uses its own quicker
      // rate — nobody asked for the retreat to be slower too, and an
      // eased convergence's tail-end duration barely depends on how far
      // it started, so sharing one rate would have dragged out the
      // retreat for no reason.
      const ease = this.flightOpening ? FLIGHT_OPEN_EASE : FLIGHT_CLOSE_EASE
      const target = this.flightOpening ? 1 : 0
      this.flightT += (target - this.flightT) * ease
      if (Math.abs(target - this.flightT) < 0.0015) this.flightT = target
    }

    for (let i = 0; i < this.count; i++) {
      if (i !== flying) {
        this._idlePosition(i, wrap01(masterT + i / this.count), time)
        this.screens[i].visible = false
        this.lasers[i].visible = false
        this.revealTimer[i] = 0
        continue
      }

      const flightT = this.flightT
      const opening = this.flightOpening

      // A straight local-space lerp from the captured ring slot to the
      // focus spot — never along the ring, so it can't swing behind the
      // planet the way following the ring's own rotation could.
      this._localPos.lerpVectors(this.flightHomeLocalPos, this._craftFocusLocal, flightT)
      this._itemQuat.slerpQuaternions(this.flightHomeQuat, this._focusQuat, flightT)

      const craft = this.crafts[i]
      craft.position.copy(this._localPos)
      craft.quaternion.copy(this._itemQuat)
      craft.scale.setScalar((CRAFT_SCALE_FAR + (CRAFT_SCALE_NEAR - CRAFT_SCALE_FAR) * flightT) * this.viewScale)
      const halo = this.crewHalos[i]
      ;(halo.material as THREE.MeshBasicMaterial).opacity = 0.5 * (1 - flightT)

      const laser = this.lasers[i]
      const screen = this.screens[i]
      const screenMat = screen.material as THREE.ShaderMaterial
      const focusWorld = this._focusWorldScratch.copy(this.group.position).add(this.focusOffset())
      const focusScaleAdjust = this._focusScaleAdjustRef!.value

      // Opening sequence: the beam connects FIRST (0.30→0.45), fully
      // visible and reaching the screen's actual corners before anything
      // unfolds; only once it's connected does the screen unfold
      // (0.45→0.60, width leading height very slightly for a subtle
      // unfurl); the beam then holds through that and fades out shortly
      // after (by ~0.80) as the image reveals. Closing keeps its old,
      // simpler shape — the screen just shrinks away, no beam.
      const laserAppear = opening ? smoothstep(0.3, 0.45, flightT) : 0
      const laserFadeOut = opening ? 1 - smoothstep(0.64, 0.8, flightT) : 1
      const laserVisibility = laserAppear * laserFadeOut

      let scaleX: number
      let scaleY: number
      let glow: number
      if (opening) {
        scaleX = smoothstep(0.45, 0.54, flightT)
        scaleY = smoothstep(0.5, 0.6, flightT)
        glow = 1 - smoothstep(0.56, 0.6, flightT)
      } else {
        scaleY = smoothstep(0, 0.62, flightT)
        scaleX = smoothstep(0, 0.3, flightT)
        glow = 0
      }

      // The image reveal/flicker-out runs on its own fixed-duration timer
      // once the plane has formed (glow drops), rather than tracking
      // `flightT` directly — `flightT`'s own convergence speed can take
      // seconds (that's the point, so the approach is watchable), which
      // would stretch the intentional brief "static flickering to life"
      // moment into something that reads as stuck flickering. A bounded
      // timer guarantees the flicker always resolves quickly regardless.
      if (glow > 0.5) {
        this.revealTimer[i] = 0
      } else {
        this.revealTimer[i] = Math.min(1, this.revealTimer[i] + REVEAL_TIMER_STEP)
      }
      const reveal = opening ? this.revealTimer[i] : smoothstep(0.62, 0.82, flightT)

      // ONE flicker value drives both the screen's edge and the beam —
      // they're the same light, so they flicker together rather than
      // independently.
      let flicker = 1
      if (glow < 0.5 && reveal < 0.999) {
        const screenFlickerNoise = Math.sin(time * 39 + i * 3) * Math.sin(time * 17 + i)
        flicker = screenFlickerNoise > -0.3 ? 1 : 0.35
      } else if (!opening && reveal > 0.5) {
        const closeFlickerNoise = Math.sin(time * 53 + i * 4) * Math.sin(time * 21 + i)
        flicker = closeFlickerNoise > 0.1 ? 1 : 0.4
      }

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
      screenMat.uniforms.uFlicker.value = flicker

      if (laserVisibility > 0.01) {
        this._craftWorldPos.copy(this._localPos).applyMatrix4(this.group.matrixWorld)

        // The screen's own actual four world-space corners — its
        // geometry is an unrotated plane always facing the camera, so
        // these are just its half-width/half-height (the same formula as
        // its own scale.x/y at scale 1, see getFocusedScreenRect) offset
        // from its center. Written straight into the beam's geometry
        // below (see createLaserGeometry) rather than reconstructed from
        // a rotate+scale transform, which can't represent an oblique
        // pyramid whose base must stay axis-aligned regardless of which
        // direction the apex sits in.
        const halfW = SCREEN_HEIGHT * this.aspect * 0.5 * focusScaleAdjust * this.viewScale
        const halfH = SCREEN_HEIGHT * 0.5 * focusScaleAdjust * this.viewScale
        const [c0, c1, c2, c3] = this._laserCorners
        c0.set(focusWorld.x - halfW, focusWorld.y - halfH, focusWorld.z)
        c1.set(focusWorld.x + halfW, focusWorld.y - halfH, focusWorld.z)
        c2.set(focusWorld.x + halfW, focusWorld.y + halfH, focusWorld.z)
        c3.set(focusWorld.x - halfW, focusWorld.y + halfH, focusWorld.z)

        const posAttr = laser.geometry.getAttribute('position') as THREE.BufferAttribute
        const apex = this._craftWorldPos
        const corners = [c0, c1, c2, c3]
        for (let tri = 0; tri < 4; tri++) {
          const a = corners[tri]
          const b = corners[(tri + 1) % 4]
          const base = tri * 3
          posAttr.setXYZ(base, apex.x, apex.y, apex.z)
          posAttr.setXYZ(base + 1, a.x, a.y, a.z)
          posAttr.setXYZ(base + 2, b.x, b.y, b.z)
        }
        posAttr.needsUpdate = true
        laser.geometry.computeVertexNormals()

        laser.visible = true
        const mat = laser.material as THREE.ShaderMaterial
        mat.uniforms.uOpacity.value = 0.9 * laserVisibility * flicker
        mat.uniforms.uTime.value = time
      } else {
        laser.visible = false
      }

      // The full-page preview modal is open for this item — its backdrop
      // is translucent, so hide the craft/laser/screen behind it rather
      // than let them keep quietly fading in/settling and show through.
      // Position/flightT math above still ran as normal, so closing the
      // modal (clearing this flag) picks back up exactly where the
      // flight actually is, just visible again.
      if (this.previewOpen) {
        craft.visible = false
        laser.visible = false
        screen.visible = false
      } else {
        craft.visible = true
      }

      if (!opening && flightT <= 0.001) {
        // Fully back at its ring slot after closing — hide and hand back
        // off to idle rotation, which picks up next frame at the same
        // `ringPhase` this flight started at (it was never touched).
        screen.visible = false
        laser.visible = false
        this.flightIndex = -1
        this.anySelected = false
      }
    }

    this._updateDebris()

    this.activeIndex = this.flightIndex >= 0 && this.flightT > 0.001 ? this.flightIndex : -1
    return this.activeIndex
  }

  // Pure idle pass — nothing selected yet, every item evenly spaced around
  // its ring/orbit. `ringPhase` keeps advancing here (instead of sitting
  // still) so the ring visibly, continuously revolves; `goTo()` reads this
  // same field to capture the flying item's exact current ring slot, so
  // the moment something IS clicked, its flight starts from right where
  // this left off — no jump. A drag (see App.onTouchMove) can also move
  // `ringPhase` directly, which this and `_updateDebris` just read like
  // any other change to it — idle rotation resumes from wherever a drag
  // left it, no special-casing needed.
  idleSelectionUpdate(time: number) {
    this.ringPhase = wrap01(this.ringPhase + IDLE_ORBIT_SPEED)
    for (let i = 0; i < this.count; i++) {
      this._idlePosition(i, wrap01(this.ringPhase + i / this.count), time)
    }
    this._updateDebris()
  }

  // Self-spin (every piece tumbling in place) plus orbital repositioning
  // around `ringPhase` — the same shared rotation the craft ring itself
  // reads, so a drag (or the ring's own idle rotation) visibly carries the
  // debris field around with it too, not just the craft.
  _updateDebris() {
    const rot = this.ringPhase * Math.PI * 2
    for (const d of this.debris) {
      d.mesh.rotation.x += d.spin.x
      d.mesh.rotation.y += d.spin.y
      d.mesh.rotation.z += d.spin.z
      const a = d.angle + rot
      d.mesh.position.set(d.radius * Math.sin(a), d.y, d.radius * Math.cos(a))
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
  onItemClick?: (localIndex: number, rect: ScreenRect | null) => void
  onActiveIndexChange?: (localIndex: number | null) => void
  onActivePlanetChange?: (planetId: string | null) => void
  onHoverChange?: (info: HoverInfo | null) => void

  renderer: THREE.WebGLRenderer
  scene = new THREE.Scene()
  camera: THREE.PerspectiveCamera
  raycaster = new THREE.Raycaster()
  pointerNdc = new THREE.Vector2()
  _screenRectCorner = new THREE.Vector3()

  planets: PlanetInstance[] = []
  planetsById = new Map<string, PlanetInstance>()
  contentPlanets: PlanetInstance[] = []
  focusedPlanet: PlanetInstance | null = null
  viewMode: ViewMode = 'overview'
  transition: CameraTransition | null = null
  overviewCameraPos = new THREE.Vector3()
  overviewQuat = new THREE.Quaternion()
  focusScaleAdjust = { value: FOCUS_SCALE }
  // Where, in world units at the craft's own focus distance, "bottom-left
  // of frame" actually is — recomputed on resize (see onResize) from the
  // live viewport/FOV the same way the screen's own size clamp already
  // is, so the craft lands in the same RELATIVE spot regardless of
  // aspect ratio, not a fixed offset that drifts off-screen on mobile.
  craftOffsetXY = { value: new THREE.Vector2(0, 0) }
  hoveredIndex = -1
  time = 0

  raf = 0
  isDown = false
  hasDragged = false
  pointerDownX = 0
  pointerDownY = 0
  pointerDownTime = 0
  /** `ringPhase` at the moment a drag started — only set while idling (see
   *  `onTouchDown`), so a drag-in-progress can compute an absolute new
   *  phase from the total pointer delta rather than accumulating relative
   *  deltas frame to frame. */
  dragStartRingPhase = 0
  /** Every planet's own `orbitAngle` at the moment an overview drag
   *  started — same reasoning as `dragStartRingPhase`, one snapshot per
   *  planet so the whole system can be dragged as one rigid disk. */
  dragStartOrbitAngles: number[] = []

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
    onItemClick?: (localIndex: number, rect: ScreenRect | null) => void,
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
      const p = new PlanetInstance(site, this.scene, aspect, borderRadius, i)
      p._focusScaleAdjustRef = this.focusScaleAdjust
      p._craftOffsetXYRef = this.craftOffsetXY
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

  closeSelection() {
    if (this.viewMode !== 'planet' || !this.focusedPlanet) return
    this.focusedPlanet.closeSelection()
  }

  setPreviewOpen(open: boolean) {
    if (this.focusedPlanet) this.focusedPlanet.previewOpen = open
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

  // The focused, fully-open screen's CURRENT on-screen rect, in viewport
  // pixels — used to morph the preview modal open from exactly where the
  // hologram was, rather than a generic fade/scale. Computed by projecting
  // the screen plane's four corners (it never rotates, so this is just its
  // scaled half-extents around its own position) through the live camera.
  getFocusedScreenRect(): ScreenRect | null {
    if (this.viewMode !== 'planet' || !this.focusedPlanet) return null
    const planet = this.focusedPlanet
    const idx = planet.activeIndex
    if (idx < 0 || !planet.screens[idx]) return null
    const screen = planet.screens[idx]
    const halfW = ((SCREEN_HEIGHT * this.aspect) / 2) * screen.scale.x
    const halfH = (SCREEN_HEIGHT / 2) * screen.scale.y
    if (halfW <= 0 || halfH <= 0) return null

    const rect = this.container.getBoundingClientRect()
    let minX = Infinity
    let maxX = -Infinity
    let minY = Infinity
    let maxY = -Infinity
    for (const [sx, sy] of [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ]) {
      this._screenRectCorner.set(screen.position.x + sx * halfW, screen.position.y + sy * halfH, screen.position.z)
      const ndc = this._screenRectCorner.project(this.camera)
      const px = rect.left + (ndc.x * 0.5 + 0.5) * rect.width
      const py = rect.top + (1 - (ndc.y * 0.5 + 0.5)) * rect.height
      minX = Math.min(minX, px)
      maxX = Math.max(maxX, px)
      minY = Math.min(minY, py)
      maxY = Math.max(maxY, py)
    }
    return { top: minY, left: minX, width: maxX - minX, height: maxY - minY }
  }

  // Idling craft (nothing selected) currently close enough to the camera
  // to be worth a discoverability label, projected to viewport pixels.
  // Empty the instant anything's selected — the flying craft's own label
  // hides too then, not just the others, matching "hide once you've
  // clicked into the preview."
  getFlybyLabels(): { index: number; x: number; y: number }[] {
    if (this.viewMode !== 'planet' || !this.focusedPlanet || this.focusedPlanet.anySelected) return []
    const planet = this.focusedPlanet
    const rect = this.container.getBoundingClientRect()
    const threshold = FLYBY_LABEL_DISTANCE * planet.viewScale
    const out: { index: number; x: number; y: number }[] = []
    for (let i = 0; i < planet.count; i++) {
      const craft = planet.crafts[i]
      if (!craft.visible) continue
      craft.getWorldPosition(this._screenRectCorner)
      const dist = this._screenRectCorner.distanceTo(this.camera.position)
      if (dist >= threshold) continue
      const ndc = this._screenRectCorner.project(this.camera)
      if (ndc.z > 1) continue
      out.push({
        index: i,
        x: rect.left + (ndc.x * 0.5 + 0.5) * rect.width,
        y: rect.top + (1 - (ndc.y * 0.5 + 0.5)) * rect.height,
      })
    }
    return out
  }

  // Switching between items is click-only (a craft, the HUD panel, a
  // badge, or a dot) — dragging left/right never selects anything. It
  // does, while idling, spin the ring (and with it, via `_updateDebris`,
  // the debris field) directly under the finger, purely a visual "nudge
  // the ornament" gesture: it only ever touches `ringPhase`, the exact
  // same field idle rotation itself advances, so releasing just lets idle
  // rotation continue from wherever the drag left it — no separate
  // "resume" handling needed. Disabled the instant anything's selected,
  // matching "every craft freezes until the preview closes."
  onTouchDown(e: MouseEvent | TouchEvent) {
    this.isDown = true
    this.hasDragged = false
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
    this.pointerDownX = clientX
    this.pointerDownY = clientY
    this.pointerDownTime = performance.now()
    if (this.viewMode === 'planet' && this.focusedPlanet && !this.focusedPlanet.anySelected) {
      this.dragStartRingPhase = this.focusedPlanet.ringPhase
    } else if (this.viewMode === 'overview') {
      this.dragStartOrbitAngles = this.planets.map((p) => p.orbitAngle)
    }
  }

  onTouchMove(e: MouseEvent | TouchEvent) {
    if (!this.isDown) return
    const x = 'touches' in e ? e.touches[0].clientX : e.clientX
    const y = 'touches' in e ? e.touches[0].clientY : e.clientY
    if (Math.abs(x - this.pointerDownX) > 6 || Math.abs(y - this.pointerDownY) > 6) this.hasDragged = true
    if (this.hasDragged && this.viewMode === 'planet' && this.focusedPlanet && !this.focusedPlanet.anySelected) {
      // A full-width drag spins just over half a revolution — enough to
      // feel like a direct, grabby manipulation of the ring rather than a
      // sluggish nudge.
      const dx = x - this.pointerDownX
      const delta = (dx / this.container.clientWidth) * 0.6
      this.focusedPlanet.ringPhase = wrap01(this.dragStartRingPhase + delta)
    } else if (this.hasDragged && this.viewMode === 'overview') {
      // The whole system dragged as one rigid disk — every planet (and,
      // since orbitAngle also drives it, its own halo ring) advances by
      // the same angular delta, so relative spacing never changes.
      const dx = x - this.pointerDownX
      const delta = (dx / this.container.clientWidth) * Math.PI * 1.2
      this.planets.forEach((p, i) => {
        p.orbitAngle = this.dragStartOrbitAngles[i] + delta
      })
    }
  }

  onTouchUp(e: MouseEvent | TouchEvent) {
    if (!this.isDown) return
    this.isDown = false
    const isQuickTap = !this.hasDragged && performance.now() - this.pointerDownTime < 500
    if (!isQuickTap) return

    if (this.viewMode === 'overview') {
      const planetId = this.hitTestPlanet(this.pointerDownX, this.pointerDownY)
      if (planetId) this.enterPlanet(planetId)
      return
    }

    if (this.viewMode === 'planet' && this.focusedPlanet) {
      const localIndex = this.hitTestItem(this.pointerDownX, this.pointerDownY)
      if (localIndex !== null) {
        if (this.focusedPlanet.anySelected && localIndex === this.focusedPlanet.activeIndex) {
          this.onItemClick?.(localIndex, this.getFocusedScreenRect())
        } else {
          this.focusedPlanet.goTo(localIndex)
        }
      } else if (this.focusedPlanet.anySelected) {
        // Missed every craft/screen while something was selected — close
        // it. (Once the preview modal itself is open, it's a full-viewport
        // overlay sitting above the canvas, so this never fires then; the
        // modal's own backdrop-click handles that case instead.)
        this.focusedPlanet.closeSelection()
      }
    }
  }

  onHoverMove(e: MouseEvent) {
    if (this.isDown) return
    if (this.viewMode === 'planet') {
      const localIndex = this.hitTestItem(e.clientX, e.clientY)
      const canDrag = !!this.focusedPlanet && !this.focusedPlanet.anySelected
      this.container.style.cursor = localIndex !== null ? 'pointer' : canDrag ? 'grab' : 'default'
      this.setHover(localIndex ?? -1)
      this.onHoverChange?.(localIndex !== null ? { localIndex, clientX: e.clientX, clientY: e.clientY } : null)
    } else if (this.viewMode === 'overview') {
      const planetId = this.hitTestPlanet(e.clientX, e.clientY)
      this.container.style.cursor = planetId ? 'pointer' : 'grab'
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

    // Same idea, for where the arrived craft sits: computed at ITS OWN
    // focus distance (closer to the camera than the screen), so "bottom-
    // left of frame" lands in the same relative spot at any aspect ratio
    // instead of a fixed world offset that would drift toward the edge
    // (or off it) on a narrower screen.
    const craftDistance = BASE_CAMERA_OFFSET.z - BASE_CRAFT_FOCUS_OFFSET.z
    const craftVisibleHeight = 2 * Math.tan(vFov / 2) * craftDistance
    const craftVisibleWidth = craftVisibleHeight * this.camera.aspect
    this.craftOffsetXY.value.set(
      -CRAFT_OFFSET_FRACTION_X * (craftVisibleWidth / 2),
      -CRAFT_OFFSET_FRACTION_Y * (craftVisibleHeight / 2)
    )

    this.updateOverviewDistance()
  }

  update() {
    this.time += 0.016

    for (const p of this.planets) {
      const parentPos = p.site.orbitParent ? this.planetsById.get(p.site.orbitParent)!.group.position : ORIGIN
      p.advanceOrbit(parentPos, this.time)
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
  { planets, aspect = 16 / 9, borderRadius = 0.04, onItemClick, onActiveIndexChange, onActivePlanetChange, onHoverChange },
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
    getFocusedScreenRect: () => appRef.current?.getFocusedScreenRect() ?? null,
    closeSelection: () => appRef.current?.closeSelection(),
    getFlybyLabels: () => appRef.current?.getFlybyLabels() ?? [],
    setPreviewOpen: (open: boolean) => appRef.current?.setPreviewOpen(open),
  }), [])

  useEffect(() => {
    if (!containerRef.current) return
    const app = new App(
      containerRef.current,
      planets,
      aspect,
      borderRadius,
      (i, rect) => onItemClickRef.current?.(i, rect),
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
  }, [planets, aspect, borderRadius])

  return (
    <div
      ref={containerRef}
      className="h-full w-full touch-pan-y outline-none active:cursor-grabbing"
      tabIndex={0}
      role="region"
      aria-label="Solar system project gallery. Click a planet to enter it, then click a craft to preview a project."
    />
  )
})

export default SolarSystemGallery
