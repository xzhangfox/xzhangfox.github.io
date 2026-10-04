'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import FadeIn from './FadeIn'
import SolarSystemGallery, { type SolarSystemGalleryHandle, type PlanetSite, type ScreenRect } from './SolarSystemGallery'
import ProjectPreviewModal, { type PreviewProject } from './ProjectPreviewModal'
import { projects } from '@/lib/data'
import { useLanguage } from '@/lib/i18n'

// Saturn hosts two of the Flux apps; the Moon hosts Flux Path on its own
// orbit around Earth; Venus hosts Flux Finance, the AI Bubble Monitor, and
// Flux Glow; Earth hosts Flux Mythos — a concept-stage game, not a live
// app, which is why it has no `link` (see lib/data.ts) and falls back to
// the shared modal's "coming soon" state instead of a "Visit Live Site"
// button.
const SATURN_PROJECT_IDS = ['flux-nutrition', 'flux-career']
const MOON_PROJECT_IDS = ['flux-path']
const VENUS_PROJECT_IDS = ['flux-finance', 'financial-tracker', 'flux-glow']
const EARTH_PROJECT_IDS = ['flux-mythos']

// Reverse lookup — which planet hosts a given project, so the detail
// modal's border can match that planet's own mask color instead of the
// project's individual one.
const PLANET_PROJECT_IDS: Record<string, string[]> = { saturn: SATURN_PROJECT_IDS, moon: MOON_PROJECT_IDS, venus: VENUS_PROJECT_IDS, earth: EARTH_PROJECT_IDS }
const PROJECT_PLANET_ID: Record<string, string> = Object.fromEntries(
  Object.entries(PLANET_PROJECT_IDS).flatMap(([planetId, ids]) => ids.map((id) => [id, planetId]))
)

const PLANET_LABELS: Record<string, string> = { saturn: 'Saturn', moon: 'The Moon', venus: 'Venus', earth: 'Earth' }
const PLANET_TEXTURES: Record<string, string> = { saturn: '/textures/saturn.jpg', moon: '/textures/moon.jpg', venus: '/textures/venus.jpg', earth: '/textures/earth.jpg' }
// Moon first (the flagship, densest halo), then Saturn, then Venus, then
// Earth last — it hosts a concept teaser, not a shipped app.
const CONTENT_PLANET_IDS = ['moon', 'saturn', 'venus', 'earth']
// Per-project real app logos, where available — falls back to a cropped
// screenshot (project.image) otherwise.
const PROJECT_LOGOS: Record<string, string> = {
  'flux-path': '/logos/flux-path.svg',
  'financial-tracker': '/logos/ai-bubble-monitor.svg',
  'flux-nutrition': '/logos/flux-nutrition.svg',
  'flux-career': '/logos/flux-career.svg',
  'flux-finance': '/logos/flux-finance.svg',
  'flux-glow': '/logos/flux-glow.svg',
}

// Static (language-independent) and module-level so it never changes
// identity across renders — SolarSystemGallery tears down and rebuilds its
// whole WebGL scene whenever `planets` changes identity. Orbit radii/speeds
// are stylized, not physically accurate — spaced for a readable overview
// rather than real distance ratios. Order matters only in that the Moon
// (whose orbit is relative to Earth) must come after Earth.
const PLANETS: PlanetSite[] = [
  { id: 'sun', textureUrl: '/textures/sun.jpg', radius: 5.5, orbitRadius: 0, orbitSpeed: 0, starRingCount: 16, starRingRadius: 1.65 },
  {
    id: 'mercury',
    textureUrl: '/textures/mercury.jpg',
    radius: 0.9,
    orbitRadius: 10,
    orbitSpeed: 0.0016,
    auraColor: '#ff5fd1',
    auraIntensity: 0.4,
    starRingCount: 10,
    starRingRadius: 3.4,
  },
  {
    id: 'venus',
    textureUrl: '/textures/venus.jpg',
    radius: 1.5,
    orbitRadius: 14,
    orbitSpeed: 0.0012,
    // Swapped with Saturn's own gold (below) — Venus now carries the
    // richer, more saturated hue.
    auraColor: '#ffcf00',
    auraIntensity: 0.35,
    starRingCount: 10,
    starRingRadius: 3.2,
    // Coins, not stars — sized and engraved per sprite (see
    // buildStarRing/getCoinTexture), standing in for a currency motif.
    starRingStyle: 'coin',
    items: VENUS_PROJECT_IDS.map((id) => {
      const p = projects.find((p) => p.id === id)!
      return { image: p.image, color: p.color }
    }),
  },
  {
    id: 'earth',
    textureUrl: '/textures/earth.jpg',
    cloudTextureUrl: '/textures/earth-clouds.png',
    radius: 1.7,
    orbitRadius: 18.5,
    orbitSpeed: 0.0009,
    auraColor: '#5ffbe0',
    auraIntensity: 0.35,
    items: EARTH_PROJECT_IDS.map((id) => {
      const p = projects.find((p) => p.id === id)!
      return { image: p.image, color: p.color }
    }),
  },
  {
    id: 'mars',
    textureUrl: '/textures/mars.jpg',
    radius: 1.1,
    orbitRadius: 23,
    orbitSpeed: 0.0007,
    auraColor: '#ff6f6f',
    auraIntensity: 0.4,
    starRingCount: 10,
    starRingRadius: 3.4,
  },
  {
    id: 'jupiter',
    textureUrl: '/textures/jupiter.jpg',
    radius: 4.0,
    orbitRadius: 33,
    orbitSpeed: 0.0004,
    auraColor: '#b98bff',
    auraIntensity: 0.3,
    starRingCount: 16,
    starRingRadius: 2.6,
  },
  {
    id: 'saturn',
    textureUrl: '/textures/saturn.jpg',
    radius: 3.2,
    orbitRadius: 45,
    orbitSpeed: 0.0003,
    hasRing: true,
    ringTextureUrl: '/textures/saturn-ring.png',
    // Swapped with the Moon's own fluorescent yellow (below) — Saturn now
    // carries that punchier hue, the Moon carries Saturn's former violet.
    auraColor: '#fff44f',
    auraIntensity: 0.25,
    // No star-sparkle halo here — Saturn already has its own real ring
    // and debris field, which get their own dazzling treatment directly
    // (see buildDebris/the ring's shader) instead of an added decoration.
    items: SATURN_PROJECT_IDS.map((id) => {
      const p = projects.find((p) => p.id === id)!
      return { image: p.image, color: p.color }
    }),
  },
  {
    id: 'uranus',
    textureUrl: '/textures/uranus.jpg',
    radius: 2.2,
    orbitRadius: 57,
    orbitSpeed: 0.00022,
    auraColor: '#5fe3ff',
    auraIntensity: 0.4,
    starRingCount: 10,
    starRingRadius: 3.2,
  },
  {
    id: 'neptune',
    textureUrl: '/textures/neptune.jpg',
    radius: 2.1,
    orbitRadius: 67,
    orbitSpeed: 0.00017,
    auraColor: '#ff5fc8',
    auraIntensity: 0.4,
    starRingCount: 10,
    starRingRadius: 3.2,
  },
  {
    id: 'moon',
    textureUrl: '/textures/moon.jpg',
    radius: 0.55,
    orbitRadius: 2.3,
    orbitSpeed: 0.01,
    orbitParent: 'earth',
    // The flagship example: densest, most prominent star-motif halo of any
    // planet — a third of its stars are the ornate embroidered-medallion
    // sprite rather than the plain 4-/5-point one, for a richer, more
    // varied field. Color swapped with Saturn's own pale violet (above).
    auraColor: '#c9a6ff',
    auraIntensity: 0.55,
    starRingCount: 28,
    starRingRadius: 2.8,
    ornateStars: true,
    items: MOON_PROJECT_IDS.map((id) => {
      const p = projects.find((p) => p.id === id)!
      return { image: p.image, color: p.color }
    }),
  },
]

// Badge border/glow per planet, matched to that planet's own aura color
// (see PLANETS above) instead of a flat gold — the overview badges and the
// once-entered project badges should read as an extension of the planet's
// own cyberpunk identity, not a generic UI chrome color.
const PLANET_COLORS: Record<string, string> = Object.fromEntries(
  PLANETS.filter((p) => p.auraColor).map((p) => [p.id, p.auraColor as string])
)
// Same per-planet aura strength the 3D scene itself uses (see
// PlanetInstance's `mat.color = white.lerp(auraColor, intensity)` in
// SolarSystemGallery) — threaded into the badge below so its own tint
// overlay lands at the same strength as that planet's real diffuse wash,
// rather than one flat blend for every planet regardless of how subtly or
// strongly tinted its actual sphere is.
const PLANET_INTENSITIES: Record<string, number> = Object.fromEntries(
  PLANETS.filter((p) => p.auraColor).map((p) => [p.id, p.auraIntensity ?? 0.35])
)

function hexToRgb(hex: string) {
  const n = parseInt(hex.replace('#', ''), 16)
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`
}

function PlanetBadge({
  textureUrl,
  label,
  active,
  onClick,
  small,
  color,
  intensity,
  ring,
  sphere,
}: {
  textureUrl: string
  label: string
  active?: boolean
  onClick: () => void
  /** True for a project's own vector icon, rendered smaller with
   *  breathing room inside the badge for sharper, less-cramped-looking
   *  linework — false (default) for a planet's photographic texture,
   *  which should fill the circle edge-to-edge as before. */
  small?: boolean
  /** This badge's own planet/project accent color — falls back to gold
   *  when unset (e.g. the Sun, which has no aura). */
  color?: string
  /** This planet's own aura strength (see PLANET_INTENSITIES) — how
   *  strongly the tint overlay below is mixed in. Defaults to the same
   *  0.35 the 3D scene falls back to. */
  intensity?: number
  /** Saturn's own motif: a thin tilted ring glyph behind the circular
   *  photo, echoing its real 3D ring since the sphere texture alone
   *  (cropped to a circle here) can't show it. */
  ring?: boolean
  /** Render as a lit sphere (an overview planet button) rather than a flat
   *  bordered disc (a project badge): shading from the same upper-left
   *  key light the 3D scene uses, a thin atmosphere glow in the planet's
   *  own aura color, and no border. */
  sphere?: boolean
}) {
  const rgb = hexToRgb(color ?? '#C9A84C')
  // Same blend the 3D scene's own material uses — lerping the surface
  // color toward the aura hue by this fraction (see PlanetInstance's
  // `mat.color = white.lerp(auraColor, intensity)`) — rather than a CSS
  // `color` blend mode, which replaces hue/saturation outright and reads
  // very differently from that soft diffuse wash.
  const tintAlpha = Math.min((intensity ?? 0.35) * 1.3, 0.75)
  return (
    <span className="relative inline-flex h-6 w-6 flex-shrink-0 sm:h-7 sm:w-7">
      {/* Active planet: the same rotating cyan-magenta hologram-chase ring
          the 3D screens/preview modal use for their own neon edge (see
          globals.css), instead of a flat box-shadow only — reads as
          "currently live," not just "selected," and keeps the badge on
          the site's one shared neon-edge language rather than a one-off. */}
      {active && (
        <div
          className="pointer-events-none absolute -inset-[3px] rounded-full hologram-edge hologram-chase"
          style={{ ['--holo-rgb' as string]: rgb } as React.CSSProperties}
        />
      )}
      {ring && <RingGlyph half="back" />}
      <button
        type="button"
        onClick={onClick}
        title={label}
        aria-label={label}
        className={`pointer-events-auto relative aspect-square h-full w-full overflow-hidden rounded-full bg-black/50 bg-center bg-no-repeat transition-all duration-300 hover:scale-110 hover:brightness-125 active:scale-95 ${sphere ? '' : 'border'}`}
        style={{
          backgroundImage: `url(${textureUrl})`,
          backgroundSize: small ? '56%' : 'cover',
          ...(sphere
            ? { boxShadow: `0 0 7px rgba(${rgb}, 0.45), 0 0 2px rgba(${rgb}, 0.6)` }
            : {
                borderColor: active ? `rgba(${rgb}, 0.9)` : `rgba(${rgb}, 0.35)`,
                boxShadow: active ? `0 0 14px rgba(${rgb}, 0.55)` : `0 0 8px rgba(${rgb}, 0.18)`,
              }),
        }}
      >
        {/* A planet button's own mask color, tinted over its photo texture
            the same way SolarSystemGallery tints a planet's own diffuse
            map — a plain alpha wash (not a `color` blend mode) so it
            lerps toward the hue exactly like that material does, rather
            than replacing hue/saturation outright. Project badges (their
            own vector logo, `small`) skip this; they already read fine in
            their own flat brand color. */}
        {!small && color && (
          <span className="pointer-events-none absolute inset-0" style={{ backgroundColor: color, opacity: tintAlpha }} />
        )}
        {sphere && <span className="pointer-events-none absolute inset-0" style={{ background: SPHERE_SHADING }} />}
      </button>
      {ring && <RingGlyph half="front" />}
    </span>
  )
}

// Lit from the upper left like the scene's own key light: a soft specular
// highlight, then a terminator falling off to near-black lower right.
const SPHERE_SHADING = [
  'radial-gradient(circle at 32% 28%, rgba(255,255,255,0.32) 0%, rgba(255,255,255,0) 34%)',
  'radial-gradient(circle at 36% 34%, rgba(0,0,0,0) 38%, rgba(0,0,0,0.55) 70%, rgba(0,0,0,0.9) 100%)',
].join(', ')

/** Saturn's ring, drawn in two halves: the far half behind the sphere and
 *  the near half in front of it, so the ring reads as wrapping around the
 *  planet rather than a flat ellipse pasted behind it. Two bands (outer
 *  bright, inner faint) with the Cassini-style gap between. */
function RingGlyph({ half }: { half: 'back' | 'front' }) {
  // In the ellipse's own (pre-rotation) frame the near half is the lower
  // arc: from the left end to the right end with sweep-flag 0.
  const sweep = half === 'front' ? 0 : 1
  const arc = (rx: number, ry: number) => `M ${50 - rx} 50 A ${rx} ${ry} 0 0 ${sweep} ${50 + rx} 50`
  return (
    // A square box centered on the button: with only insets, the browser
    // sizes an <svg> from its square viewBox (height = width) and ignores
    // the bottom inset, which left the ring sitting ~8px low.
    <svg
      viewBox="0 0 100 100"
      aria-hidden
      className="pointer-events-none absolute left-1/2 top-1/2 h-[170%] w-[170%] -translate-x-1/2 -translate-y-1/2"
    >
      <g transform="rotate(-24 50 50)" fill="none" strokeLinecap="round">
        <path d={arc(48, 15)} stroke="#e4cfa0" strokeWidth="3.2" opacity={half === 'front' ? 0.9 : 0.55} />
        <path d={arc(40, 12.5)} stroke="#c9b27e" strokeWidth="2" opacity={half === 'front' ? 0.55 : 0.3} />
      </g>
    </svg>
  )
}

// The wormhole, as a single fragment shader over a full-screen quad: an
// aperture opens in space with a hot gravitational-lensing ring at its
// rim; inside, a spiralling tunnel of luminous filaments over a faint
// spacetime grid rushes past toward a white-hot exit. `u_env` (0→1→0)
// opens, holds and closes it; `u_t` drives the flight.
const WORMHOLE_FRAG = `
precision highp float;
uniform vec2 u_res;
uniform float u_t;
uniform float u_env;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; }
  return v;
}
// fbm around the tunnel's circumference (x in turns) without a seam where
// the angle wraps: the last fifth cross-fades into the start.
float ringFbm(float x, float y, float k) {
  float f = fract(x);
  return mix(fbm(vec2(f * k, y)), fbm(vec2((f - 1.0) * k, y)), smoothstep(0.8, 1.0, f));
}
void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * u_res) / u_res.y;
  float r = length(uv);
  float a = atan(uv.y, uv.x);
  float aperture = 0.08 + 1.1 * u_env;
  // Tunnel coordinates: depth grows toward the centre, the walls twist.
  float depth = 0.32 / max(r, 0.001) + u_t * 7.0;
  float ang = a / 6.2831853 + depth * 0.11 + u_t * 0.35;
  // Filaments: noise stretched along depth, sharpened into strands.
  float n = ringFbm(ang, depth * 0.3, 26.0);
  float strands = pow(smoothstep(0.5, 0.95, n), 3.0);
  float violet = pow(smoothstep(0.55, 0.95, ringFbm(ang + 0.37, depth * 0.22, 14.0)), 2.5);
  float fine = pow(smoothstep(0.62, 1.0, ringFbm(ang + 0.71, depth * 0.9, 70.0)), 3.0);
  // Faint spacetime grid on the tunnel wall.
  float rings = smoothstep(0.93, 1.0, fract(depth * 0.5)) * 0.35;
  float meridians = smoothstep(0.985, 1.0, abs(cos(ang * 6.2831853 * 8.0))) * 0.25;
  float near = smoothstep(0.0, 0.6, r); // walls closer to the eye read brighter
  // Dark walls with depth haze, so the light reads as filaments, not fill.
  vec3 deep = mix(vec3(0.01, 0.015, 0.06), vec3(0.07, 0.025, 0.17), smoothstep(0.15, 1.0, r));
  vec3 col = deep;
  col += vec3(0.25, 0.75, 1.0) * strands * (0.35 + 1.3 * near);
  col += vec3(0.55, 0.3, 1.0) * violet * (0.25 + 0.7 * near);
  col += vec3(1.0, 0.35, 0.85) * fine * 0.8 * near;
  col += vec3(0.45, 0.6, 1.0) * (rings + meridians) * near * 0.8;
  // White-hot exit at the far end.
  col += vec3(0.85, 0.95, 1.0) * exp(-r * 9.0) * 1.6 + vec3(0.4, 0.7, 1.0) * exp(-r * 3.5) * 0.5;
  // Aperture: tunnel inside, lensing ring on the rim, space outside.
  float inside = 1.0 - smoothstep(aperture - 0.05, aperture, r);
  float rim = exp(-pow((r - aperture) * 18.0, 2.0));
  float rimNoise = 0.6 + 0.8 * ringFbm(a / 6.2831853 + u_t * 0.6, u_t * 2.0, 19.0);
  vec3 rimCol = mix(vec3(0.5, 0.85, 1.0), vec3(1.0, 0.82, 0.45), 0.5 + 0.5 * sin(a * 2.0 + u_t * 3.0));
  vec3 outCol = col * inside + rimCol * rim * rimNoise * 1.4;
  float alpha = clamp(inside + rim * rimNoise, 0.0, 1.0) * u_env;
  // Dissolve into the page on every side rather than stopping at the
  // container's edge: a soft falloff from each edge plus an elliptical
  // vignette, applied to colour and alpha alike (premultiplied).
  vec2 q = gl_FragCoord.xy / u_res;
  float edgeDist = min(min(gl_FragCoord.x, u_res.x - gl_FragCoord.x), min(gl_FragCoord.y, u_res.y - gl_FragCoord.y));
  float edgeFade = smoothstep(0.0, 0.24 * min(u_res.x, u_res.y), edgeDist);
  float vignette = 1.0 - smoothstep(0.62, 1.08, length((q - 0.5) * 2.0));
  float fade = edgeFade * vignette;
  gl_FragColor = vec4(outCol * u_env * fade, alpha * fade);
}`

/** The jump between the galaxy and the card gallery (see WORMHOLE_FRAG),
 *  played over `duration` ms on a canvas laid over the 3D scene. Silently
 *  skipped if WebGL isn't available. */
function Wormhole({ duration }: { duration: number }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current
    const gl = c?.getContext('webgl', { premultipliedAlpha: true, alpha: true })
    if (!c || !gl) return
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5)
    c.width = c.clientWidth * dpr
    c.height = c.clientHeight * dpr
    gl.viewport(0, 0, c.width, c.height)
    const shader = (type: number, src: string) => {
      const sh = gl.createShader(type)!
      gl.shaderSource(sh, src)
      gl.compileShader(sh)
      return sh
    }
    const prog = gl.createProgram()!
    gl.attachShader(prog, shader(gl.VERTEX_SHADER, 'attribute vec2 p; void main() { gl_Position = vec4(p, 0.0, 1.0); }'))
    gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, WORMHOLE_FRAG))
    gl.linkProgram(prog)
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return
    gl.useProgram(prog)
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer())
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
    const loc = gl.getAttribLocation(prog, 'p')
    gl.enableVertexAttribArray(loc)
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)
    gl.uniform2f(gl.getUniformLocation(prog, 'u_res'), c.width, c.height)
    const uT = gl.getUniformLocation(prog, 'u_t')
    const uEnv = gl.getUniformLocation(prog, 'u_env')
    const start = performance.now()
    let raf = 0
    const frame = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      // Opens fast, holds, then closes — eased so the throat "swallows".
      const env = t < 0.35 ? 1 - (1 - t / 0.35) ** 3 : t > 0.8 ? 1 - ((t - 0.8) / 0.2) ** 2 : 1
      gl.uniform1f(uT, t * t * 1.6 + t * 0.4)
      gl.uniform1f(uEnv, env)
      gl.clearColor(0, 0, 0, 0)
      gl.clear(gl.COLOR_BUFFER_BIT)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
      if (t < 1) raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [duration])
  return <canvas ref={ref} aria-hidden className="pointer-events-none absolute inset-0 z-20 h-full w-full" />
}

/** Spread / galaxy toggle icons — a 2×2 card grid, and a two-armed spiral. */
function GridIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <rect x="4" y="4" width="6.5" height="6.5" rx="1.5" />
      <rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5" />
      <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5" />
      <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5" />
    </svg>
  )
}
function GalaxyIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      <circle cx="12" cy="12" r="1.7" fill="currentColor" stroke="none" />
      <path d="M12 12c2.6-2.8 7.5-1.8 7.6 1.8.1 3.4-4.4 6.4-9 5.4" />
      <path d="M12 12c-2.6 2.8-7.5 1.8-7.6-1.8C4.3 6.8 8.8 3.8 13.4 4.8" />
    </svg>
  )
}

// Wormhole-jump timings (ms) — see openGallery/closeGallery.
const WORMHOLE_MS = 1500

export default function Projects() {
  const { t } = useLanguage()
  const items: PreviewProject[] = projects.map((p, i) => ({ ...p, ...t.projects.items[i] }))
  const projectsByPlanet: Record<string, PreviewProject[]> = {
    saturn: SATURN_PROJECT_IDS.map((id) => items.find((p) => p.id === id)!),
    moon: MOON_PROJECT_IDS.map((id) => items.find((p) => p.id === id)!),
    venus: VENUS_PROJECT_IDS.map((id) => items.find((p) => p.id === id)!),
    earth: EARTH_PROJECT_IDS.map((id) => items.find((p) => p.id === id)!),
  }

  const [openId, setOpenId] = useState<string | null>(null)
  const [openOriginRect, setOpenOriginRect] = useState<ScreenRect | null>(null)
  const [openRestWidth, setOpenRestWidth] = useState<number | undefined>(undefined)
  const openProject = items.find((p) => p.id === openId) ?? null

  // null activePlanetId = the solar-system overview; activeIndex is local
  // to whichever planet is currently entered (null = nothing selected yet).
  const [activePlanetId, setActivePlanetId] = useState<string | null>(null)
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const [hoverInfo, setHoverInfo] = useState<{ localIndex: number; clientX: number; clientY: number } | null>(null)
  const galleryRef = useRef<SolarSystemGalleryHandle>(null)
  // Card-gallery mode: the camera pulls away from the galaxy, a wormhole
  // carries you through, and every project's card spreads out ('on');
  // the galaxy button reverses it. 'out'/'in' are the jumps in between.
  const [gallery, setGallery] = useState<'off' | 'out' | 'on' | 'in'>('off')
  const [showCards, setShowCards] = useState(false)
  const [spread, setSpread] = useState(false)
  const [wormholeRun, setWormholeRun] = useState(0)
  const [wormholeOn, setWormholeOn] = useState(false)
  const reduceMotion = useReducedMotion()
  const timers = useRef<number[]>([])
  useEffect(() => () => timers.current.forEach(clearTimeout), [])
  const after = (ms: number, fn: () => void) => {
    timers.current.push(window.setTimeout(fn, reduceMotion ? Math.min(ms, 200) : ms))
  }
  const runWormhole = () => {
    if (reduceMotion) return
    setWormholeRun((n) => n + 1)
    setWormholeOn(true)
    after(WORMHOLE_MS, () => setWormholeOn(false))
  }
  const openGallery = () => {
    if (gallery !== 'off') return
    setGallery('out')
    galleryRef.current?.setWarp(true)
    after(450, runWormhole)
    after(1750, () => {
      setShowCards(true)
      setGallery('on')
      // Mount stacked at the center, then let them fly out to the grid.
      requestAnimationFrame(() => requestAnimationFrame(() => setSpread(true)))
    })
  }
  const closeGallery = () => {
    if (gallery !== 'on') return
    setGallery('in')
    setSpread(false)
    after(550, () => {
      setShowCards(false)
      runWormhole()
    })
    after(1700, () => galleryRef.current?.setWarp(false))
    after(2700, () => setGallery('off'))
  }
  const wrapperRef = useRef<HTMLDivElement>(null)
  const flybyLabelRefs = useRef<Map<number, HTMLDivElement>>(new Map())
  const openIdRef = useRef(openId)
  openIdRef.current = openId

  const currentProjects = activePlanetId ? projectsByPlanet[activePlanetId] ?? [] : []
  const activeProject = activeIndex !== null ? currentProjects[activeIndex] : undefined
  const hoveredProject = hoverInfo ? currentProjects[hoverInfo.localIndex] : undefined

  const handleItemClick = useCallback(
    (index: number, rect: ScreenRect | null) => {
      const project = currentProjects[index]
      if (project) {
        setOpenOriginRect(rect)
        setOpenRestWidth(undefined)
        setOpenId(project.id)
        // The modal's own backdrop is translucent and doesn't span the
        // whole viewport-relative craft position, so tell the gallery to
        // hide the craft/laser/screen behind it directly rather than
        // relying on the backdrop alone to cover them.
        galleryRef.current?.setPreviewOpen(true)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, activePlanetId]
  )

  // The HUD panel opens the same project the same way a direct craft
  // click would — same origin rect, so the modal still morphs from a
  // real on-screen anchor.
  const openActiveProject = useCallback(() => {
    if (activeIndex === null) return
    handleItemClick(activeIndex, galleryRef.current?.getFocusedScreenRect() ?? null)
  }, [activeIndex, handleItemClick])

  // Closing by any means (✕, Escape, backdrop, or re-clicking the HUD
  // label below) also tells the gallery to let the craft go — it shrinks
  // away exactly like switching to a different item would, and every craft
  // on that planet resumes its idle orbit once that settles.
  const closeActiveProject = useCallback(() => {
    setOpenId(null)
    setOpenOriginRect(null)
    galleryRef.current?.setPreviewOpen(false)
    galleryRef.current?.closeSelection()
  }, [])

  // The HUD panel doubles as a toggle: while its project's already open,
  // clicking it again closes it instead of re-opening.
  const handleHudClick = useCallback(() => {
    if (activeProject && openIdRef.current === activeProject.id) {
      closeActiveProject()
    } else {
      openActiveProject()
    }
  }, [activeProject, closeActiveProject, openActiveProject])

  // Flyby labels — a lightweight text tag on whichever idling craft is
  // currently swinging close to the camera, so a project stays spottable
  // mid-orbit. `getFlybyLabels()` itself goes empty the instant anything's
  // selected, so these hide the moment you click into a preview, per
  // spec. Driven by its own rAF loop (not React state) so tracking a
  // moving craft at 60fps never forces a re-render.
  useEffect(() => {
    if (!activePlanetId) return
    const count = currentProjects.length
    let raf: number
    const tick = () => {
      const labels = galleryRef.current?.getFlybyLabels() ?? []
      const wrapperRect = wrapperRef.current?.getBoundingClientRect()
      for (let i = 0; i < count; i++) {
        const el = flybyLabelRefs.current.get(i)
        const m = wrapperRect ? labels.find((l) => l.index === i) : undefined
        if (el) {
          if (m && wrapperRect) {
            el.style.display = ''
            el.style.left = `${m.x - wrapperRect.left + 16}px`
            el.style.top = `${m.y - wrapperRect.top - 11}px`
          } else {
            el.style.display = 'none'
          }
        }
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePlanetId])

  // Tilts the whole gallery's camera from a top-down view toward a
  // look-up one as the section scrolls through the viewport — 0 right as
  // it enters from below, 1 once it's scrolled fully past. A plain
  // scroll listener (rAF-throttled) rather than an IntersectionObserver
  // since this needs the continuous position, not just enter/exit.
  useEffect(() => {
    let raf = 0
    let ticking = false
    const compute = () => {
      ticking = false
      const el = wrapperRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const vh = window.innerHeight
      const total = rect.height + vh
      const t = total > 0 ? Math.min(1, Math.max(0, (vh - rect.top) / total)) : 0
      galleryRef.current?.setScrollTilt(t)
    }
    const onScroll = () => {
      if (ticking) return
      ticking = true
      raf = requestAnimationFrame(compute)
    }
    compute()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      cancelAnimationFrame(raf)
    }
  }, [])

  return (
    <section id="projects" className="relative py-32">
      <div className="max-w-6xl mx-auto px-6">
        <FadeIn>
          <div className="section-divider">
            <span className="section-label">{t.projects.sectionLabel}</span>
          </div>
        </FadeIn>

        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-4">
          <FadeIn delay={0.1}>
            <h2 className="text-3xl md:text-4xl font-bold">
              {t.projects.headingPre} <span className="gold-gradient">{t.projects.headingGold}</span>{t.projects.headingPost}
            </h2>
            <p className="text-white/40 text-sm mt-2 max-w-md leading-relaxed">{t.projects.subDesc}</p>
          </FadeIn>

          <FadeIn delay={0.2}>
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-surface-card border border-gold/15">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              <span className="text-white/40 text-xs font-mono">
                {gallery !== 'off' ? t.projects.liveBadgeGallery : activePlanetId === null ? t.projects.liveBadgeOverview : t.projects.liveBadgeEntered}
              </span>
            </div>
          </FadeIn>
        </div>
      </div>

      {/* Loads on a top-down overview of the whole system, Sun-centered,
          every planet slowly revolving on its own orbit. Click a planet (or
          its badge, top-left) to zoom in — only then do its own projects'
          craft appear, continuously orbiting until one is clicked to open
          it (a craft, its flyby label, a badge, or a dot). Dragging
          left/right spins the ring (and its debris) but never selects
          anything, and is disabled once something is. Clicking empty
          space while something's selected closes it. Only the back
          button returns to the overview. */}
      <div ref={wrapperRef} id="flux-galaxy" className="relative h-[65vh] max-h-[760px] min-h-[420px] w-full overflow-hidden sm:h-[72vh]">
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-20 bg-gradient-to-b from-bg to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-20 bg-gradient-to-t from-bg to-transparent" />

        <SolarSystemGallery
          ref={galleryRef}
          planets={PLANETS}
          borderRadius={0.04}
          aspect={16 / 9}
          onItemClick={handleItemClick}
          onActiveIndexChange={setActiveIndex}
          onActivePlanetChange={setActivePlanetId}
          onHoverChange={setHoverInfo}
        />

        {/* Top-left: in the overview, a badge per content planet (an
            alternate entry point to clicking the tiny 3D mesh); once
            entered, a back button plus a badge per project on that planet. */}
        <div className="pointer-events-none absolute left-2 top-2 z-30 flex items-center gap-1.5 sm:left-4 sm:top-4 sm:gap-2">
          <AnimatePresence mode="wait">
            {activePlanetId === null ? (
              <motion.div
                key="overview-badges"
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.3 }}
                // Wider than the entered row's badge gap: Saturn's ring
                // glyph (see RingGlyph/PlanetBadge) overflows its own
                // button box, so an even gap here has to be at least that
                // wide everywhere, not just wherever Saturn happens to
                // sit — otherwise only Saturn's neighbours would look
                // farther apart than the rest.
                className="flex items-center gap-3 sm:gap-3.5"
              >
                {/* Hidden (not just faded) while in the card gallery, so
                    they can't be clicked through to a planet out there. */}
                <div
                  aria-hidden={gallery !== 'off'}
                  className="flex items-center gap-3 sm:gap-3.5"
                  style={{ opacity: gallery === 'off' ? 1 : 0, visibility: gallery === 'off' ? 'visible' : 'hidden', transition: 'opacity 0.5s, visibility 0.5s' }}
                >
                  {CONTENT_PLANET_IDS.map((id) => (
                    <PlanetBadge
                      key={id}
                      textureUrl={PLANET_TEXTURES[id]}
                      label={PLANET_LABELS[id]}
                      color={PLANET_COLORS[id]}
                      intensity={PLANET_INTENSITIES[id]}
                      ring={id === 'saturn'}
                      sphere
                      onClick={() => galleryRef.current?.enterPlanet(id)}
                    />
                  ))}
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="planet-badges"
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.3 }}
                className="flex items-center gap-1.5 sm:gap-2"
              >
                <button
                  type="button"
                  onClick={() => galleryRef.current?.leavePlanet()}
                  aria-label="Back to solar system"
                  title="Back to solar system"
                  className="pointer-events-auto flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border border-white/15 bg-black/30 text-white/50 backdrop-blur-sm transition-all duration-300 hover:scale-110 hover:border-gold/40 hover:text-gold active:scale-95 sm:h-7 sm:w-7"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                    <path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                {currentProjects.map((project, i) => (
                  <PlanetBadge
                    key={project.id}
                    textureUrl={PROJECT_LOGOS[project.id] ?? project.image}
                    small={!!PROJECT_LOGOS[project.id]}
                    label={project.title}
                    color={project.color}
                    active={activeIndex === i}
                    onClick={() => galleryRef.current?.goTo(i)}
                  />
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Top-right: spread every project out as cards (from the
            overview), or — once out there — head back to the galaxy. */}
        <AnimatePresence>
          {activePlanetId === null && (
            <motion.div
              key="gallery-toggle"
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.3 }}
              className="absolute right-2 top-2 z-30 sm:right-4 sm:top-4"
            >
          <button
            type="button"
            onClick={gallery === 'off' ? openGallery : closeGallery}
            disabled={gallery === 'out' || gallery === 'in'}
            aria-label={gallery === 'off' ? t.projects.galleryView : t.projects.backToGalaxy}
            title={gallery === 'off' ? t.projects.galleryView : t.projects.backToGalaxy}
            className="pointer-events-auto flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/[0.04] text-white/70 backdrop-blur-sm transition-all duration-300 hover:scale-110 hover:border-white/45 hover:text-white active:scale-95 disabled:cursor-default sm:h-7 sm:w-7"
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={gallery === 'off' || gallery === 'out' ? 'grid' : 'galaxy'}
                initial={{ opacity: 0, rotate: -90, scale: 0.5 }}
                animate={{ opacity: 1, rotate: 0, scale: 1 }}
                exit={{ opacity: 0, rotate: 90, scale: 0.5 }}
                transition={{ duration: 0.25 }}
                className="flex"
              >
                {gallery === 'off' || gallery === 'out' ? <GridIcon /> : <GalaxyIcon />}
              </motion.span>
            </AnimatePresence>
          </button>
            </motion.div>
          )}
        </AnimatePresence>

        {wormholeOn && <Wormhole key={wormholeRun} duration={WORMHOLE_MS} />}

        {/* The card gallery: every project's preview card, stacked at the
            center on arrival and spread out into a grid (framer's layout
            animation carries each one between the two), then gathered
            back before the jump home. */}
        <AnimatePresence>
          {showCards && (
            <motion.div
              key="card-gallery"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, transition: { duration: 0.25 } }}
              className="absolute inset-0 z-20 overflow-y-auto bg-black/35 px-4 pb-12 pt-14 sm:px-8 sm:pt-16"
            >
              <div
                className={
                  spread
                    ? 'mx-auto grid max-w-5xl grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4'
                    : 'grid h-full place-items-center'
                }
              >
                {items.map((project, i) => (
                  <motion.button
                    key={project.id}
                    type="button"
                    layout
                    initial={{ opacity: 0, scale: 0.3 }}
                    animate={{ opacity: 1, scale: spread ? 1 : 0.85, rotate: spread ? 0 : (i - (items.length - 1) / 2) * 5 }}
                    exit={{ opacity: 0, scale: 0.3 }}
                    transition={{
                      type: 'spring',
                      stiffness: 160,
                      damping: 22,
                      delay: spread ? i * 0.05 : (items.length - 1 - i) * 0.03,
                    }}
                    onClick={(e) => {
                      // Morph from the card's own picture, and rest at the
                      // size the hologram screen would — the same detail
                      // page the galaxy opens.
                      const img = e.currentTarget.querySelector('img') ?? e.currentTarget
                      const r = img.getBoundingClientRect()
                      setOpenOriginRect({ top: r.top, left: r.left, width: r.width, height: r.height })
                      setOpenRestWidth(galleryRef.current?.getFocusScreenWidth())
                      setOpenId(project.id)
                    }}
                    className={`group overflow-hidden rounded-xl border bg-black/55 text-left backdrop-blur-md ${spread ? 'w-full' : 'w-44 sm:w-56'}`}
                    style={{
                      gridArea: spread ? undefined : '1 / 1',
                      borderColor: `${project.color}55`,
                      boxShadow: `0 0 18px ${project.color}22`,
                    }}
                  >
                    <div className="aspect-video overflow-hidden bg-black/40">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={project.image} alt="" className="h-full w-full object-cover object-top transition-transform duration-500 group-hover:scale-105" />
                    </div>
                    <div className="p-2.5 sm:p-3">
                      <div className="flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full" style={{ background: project.color }} />
                        <span className="font-mono text-[8px] uppercase tracking-[0.2em] text-white/40 sm:text-[9px]">
                          {PLANET_LABELS[PROJECT_PLANET_ID[project.id]] ?? ''}
                        </span>
                      </div>
                      <p className="mt-1 text-xs font-semibold leading-tight text-white/90 sm:text-sm">{project.title}</p>
                      <p className="mt-0.5 line-clamp-2 text-[10px] leading-snug text-white/45 sm:text-[11px]">{project.subtitle}</p>
                    </div>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Carrier/HUD-style readout — only once a project's actually
            focused, not just while idling on the ring. */}
        {activeProject && (
          <div className="pointer-events-none absolute right-2 top-2 z-10 w-[168px] sm:right-4 sm:top-4 sm:w-[220px]">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeProject.id}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -6 }}
                transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                role="button"
                tabIndex={0}
                onClick={handleHudClick}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') handleHudClick()
                }}
                className="pointer-events-auto cursor-pointer border bg-black/45 px-3 py-2 backdrop-blur-sm transition-colors duration-200 hover:bg-black/60 sm:px-3.5 sm:py-2.5"
                style={{
                  borderColor: `${activeProject.color}35`,
                  clipPath: 'polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px))',
                }}
              >
                <div className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full animate-pulse" style={{ background: activeProject.color }} />
                  <span className="font-mono text-[8px] uppercase tracking-[0.2em] text-white/40 sm:text-[9px]">
                    {t.projects.hudLabel}
                  </span>
                </div>
                <p className="mt-1 text-xs font-semibold leading-tight text-white/90 sm:text-sm">{activeProject.title}</p>
                <p className="mt-0.5 line-clamp-2 text-[10px] leading-snug text-white/45">{activeProject.subtitle}</p>
              </motion.div>
            </AnimatePresence>
          </div>
        )}

        {/* Flyby labels — one slot per project on this planet, shown only
            while its craft is currently swinging close to the camera (and
            nothing's selected). Clicking one starts the same fly-to-focus
            sequence a direct craft click would. */}
        {currentProjects.map((project, i) => (
          <div
            key={project.id}
            ref={(el) => {
              if (el) flybyLabelRefs.current.set(i, el)
              else flybyLabelRefs.current.delete(i)
            }}
            onClick={() => galleryRef.current?.goTo(i)}
            className="pointer-events-auto absolute z-10 cursor-pointer whitespace-nowrap rounded-md border border-gold/30 bg-black/80 px-2 py-1 text-[10px] font-medium text-white/90 backdrop-blur-sm"
            style={{ display: 'none', left: 0, top: 0 }}
          >
            {project.title}
          </div>
        ))}

        {/* Simple hover tooltip — a craft idling on the ring, not yet
            clicked, just names itself. */}
        {hoverInfo && hoveredProject && (
          <div
            className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-full rounded-md border border-gold/30 bg-black/80 px-2.5 py-1 text-[11px] font-medium text-white/90 backdrop-blur-sm"
            style={{ left: hoverInfo.clientX, top: hoverInfo.clientY - 14 }}
          >
            {hoveredProject.title}
          </div>
        )}

        {activePlanetId !== null && currentProjects.length > 1 && (
          <div className="pointer-events-none absolute inset-x-0 bottom-8 z-10 flex items-center justify-center gap-2">
            {currentProjects.map((project, i) => (
              <button
                key={project.id}
                type="button"
                onClick={() => galleryRef.current?.goTo(i)}
                aria-label={`Show ${project.title}`}
                className="pointer-events-auto h-1.5 rounded-full transition-all duration-300 ease-out"
                style={{
                  width: i === activeIndex ? 24 : 6,
                  background: i === activeIndex ? project.color : 'rgba(255,255,255,0.18)',
                }}
              />
            ))}
          </div>
        )}

      </div>

      <div className="max-w-6xl mx-auto px-6 mt-8 text-center">
        <FadeIn>
          <p className="section-label text-white/25">{t.projects.moreSoonTitle}</p>
          <p className="mt-1 text-xs text-white/20 max-w-xs mx-auto leading-relaxed">{t.projects.moreSoonDesc}</p>
        </FadeIn>
      </div>

      <AnimatePresence>
        {openProject && (
          <ProjectPreviewModal
            project={openProject}
            planetColor={PLANET_COLORS[PROJECT_PLANET_ID[openProject.id]] ?? openProject.color}
            originRect={openOriginRect}
            restWidth={openRestWidth}
            onClose={closeActiveProject}
          />
        )}
      </AnimatePresence>
    </section>
  )
}
