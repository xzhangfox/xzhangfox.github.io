'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import FadeIn from './FadeIn'
import SolarSystemGallery, { type SolarSystemGalleryHandle, type PlanetSite, type ScreenRect } from './SolarSystemGallery'
import ProjectPreviewModal, { type PreviewProject } from './ProjectPreviewModal'
import { projects } from '@/lib/data'
import { useLanguage } from '@/lib/i18n'

// Saturn keeps the original four projects; the Moon hosts Flux Path on its
// own orbit around Earth.
const SATURN_PROJECT_IDS = ['flux-nutrition', 'flux-career', 'flux-finance', 'financial-tracker']
const MOON_PROJECT_IDS = ['flux-path']

const PLANET_LABELS: Record<string, string> = { saturn: 'Saturn', moon: 'The Moon' }
const PLANET_TEXTURES: Record<string, string> = { saturn: '/textures/saturn.jpg', moon: '/textures/moon.jpg' }
const CONTENT_PLANET_IDS = ['saturn', 'moon']
// Per-project real app logos, where available — falls back to a cropped
// screenshot (project.image) otherwise.
const PROJECT_LOGOS: Record<string, string> = {
  'flux-path': '/logos/flux-path.svg',
  'financial-tracker': '/logos/ai-bubble-monitor.svg',
  'flux-nutrition': '/logos/flux-nutrition.svg',
  'flux-career': '/logos/flux-career.svg',
  'flux-finance': '/logos/flux-finance.svg',
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
    auraColor: '#c9a6ff',
    auraIntensity: 0.35,
    starRingCount: 10,
    starRingRadius: 3.2,
  },
  {
    id: 'earth',
    textureUrl: '/textures/earth.jpg',
    radius: 1.7,
    orbitRadius: 18.5,
    orbitSpeed: 0.0009,
    auraColor: '#5ffbe0',
    auraIntensity: 0.35,
    starRingCount: 12,
    starRingRadius: 3.2,
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
    auraColor: '#ffd76a',
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
    // The flagship example: bright fluorescent yellow with the densest,
    // most prominent star-motif halo of any planet.
    auraColor: '#fff44f',
    auraIntensity: 0.55,
    starRingCount: 28,
    starRingRadius: 2.8,
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
}) {
  const rgb = hexToRgb(color ?? '#C9A84C')
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className="pointer-events-auto h-8 w-8 flex-shrink-0 rounded-full border bg-black/50 bg-center bg-no-repeat transition-all duration-300 sm:h-9 sm:w-9"
      style={{
        backgroundImage: `url(${textureUrl})`,
        backgroundSize: small ? '56%' : 'cover',
        borderColor: active ? `rgba(${rgb}, 0.9)` : `rgba(${rgb}, 0.35)`,
        boxShadow: active ? `0 0 14px rgba(${rgb}, 0.55)` : `0 0 8px rgba(${rgb}, 0.18)`,
      }}
    />
  )
}

export default function Projects() {
  const { t } = useLanguage()
  const items: PreviewProject[] = projects.map((p, i) => ({ ...p, ...t.projects.items[i] }))
  const projectsByPlanet: Record<string, PreviewProject[]> = {
    saturn: SATURN_PROJECT_IDS.map((id) => items.find((p) => p.id === id)!),
    moon: MOON_PROJECT_IDS.map((id) => items.find((p) => p.id === id)!),
  }

  const [openId, setOpenId] = useState<string | null>(null)
  const [openOriginRect, setOpenOriginRect] = useState<ScreenRect | null>(null)
  const openProject = items.find((p) => p.id === openId) ?? null

  // null activePlanetId = the solar-system overview; activeIndex is local
  // to whichever planet is currently entered (null = nothing selected yet).
  const [activePlanetId, setActivePlanetId] = useState<string | null>(null)
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const [hoverInfo, setHoverInfo] = useState<{ localIndex: number; clientX: number; clientY: number } | null>(null)
  const galleryRef = useRef<SolarSystemGalleryHandle>(null)
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
              <span className="text-white/40 text-xs font-mono">{t.projects.liveBadge}</span>
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
      <div ref={wrapperRef} className="relative h-[65vh] max-h-[760px] min-h-[420px] w-full overflow-hidden sm:h-[72vh]">
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
        <div className="pointer-events-none absolute left-2 top-2 z-10 flex items-center gap-1.5 sm:left-4 sm:top-4 sm:gap-2">
          <AnimatePresence mode="wait">
            {activePlanetId === null ? (
              <motion.div
                key="overview-badges"
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.3 }}
                className="flex items-center gap-1.5 sm:gap-2"
              >
                {CONTENT_PLANET_IDS.map((id) => (
                  <PlanetBadge
                    key={id}
                    textureUrl={PLANET_TEXTURES[id]}
                    label={PLANET_LABELS[id]}
                    color={PLANET_COLORS[id]}
                    onClick={() => galleryRef.current?.enterPlanet(id)}
                  />
                ))}
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
                  className="pointer-events-auto flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-white/15 bg-black/30 text-white/50 backdrop-blur-sm transition-all duration-300 hover:border-gold/40 hover:text-gold sm:h-9 sm:w-9"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
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

        <p className="pointer-events-none absolute bottom-2 right-3 z-10 text-[9px] text-white/15">
          Solar system textures © Solar System Scope, CC BY 4.0
        </p>
      </div>

      <div className="max-w-6xl mx-auto px-6 mt-8 text-center">
        <FadeIn>
          <p className="section-label text-white/25">{t.projects.moreSoonTitle}</p>
          <p className="mt-1 text-xs text-white/20 max-w-xs mx-auto leading-relaxed">{t.projects.moreSoonDesc}</p>
        </FadeIn>
      </div>

      <AnimatePresence>
        {openProject && (
          <ProjectPreviewModal project={openProject} originRect={openOriginRect} onClose={closeActiveProject} />
        )}
      </AnimatePresence>
    </section>
  )
}
