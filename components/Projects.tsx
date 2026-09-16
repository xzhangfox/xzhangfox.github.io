'use client'

import { useCallback, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import FadeIn from './FadeIn'
import SolarSystemGallery, { type SolarSystemGalleryHandle, type PlanetSite } from './SolarSystemGallery'
import ProjectPreviewModal, { type PreviewProject } from './ProjectPreviewModal'
import { projects } from '@/lib/data'
import { useLanguage } from '@/lib/i18n'

// Saturn keeps the original four projects; the Moon hosts Flux Path on its
// own. This order (Saturn's items, then the Moon's) is the gallery's GLOBAL
// index order — what the arrows/dots/keyboard step through — independent of
// `lib/data.ts`'s own listing order.
const SATURN_PROJECT_IDS = ['flux-nutrition', 'flux-career', 'flux-finance', 'financial-tracker']
const MOON_PROJECT_IDS = ['flux-path']
const GALLERY_PROJECT_IDS = [...SATURN_PROJECT_IDS, ...MOON_PROJECT_IDS]

const PLANET_LABELS: Record<string, string> = { saturn: 'Saturn', moon: 'The Moon' }
const PLANET_TEXTURES: Record<string, string> = { saturn: '/textures/saturn.jpg', moon: '/textures/moon.jpg' }

// Static (language-independent) and module-level so it never changes
// identity across renders — SolarSystemGallery tears down and rebuilds its
// whole WebGL scene whenever `planets` changes identity.
// Listed in gallery/global-index order (content planets first in the order
// their items should appear — Saturn's four, then the Moon's one — with the
// decorative planets interleaved wherever they sit spatially); array order
// here drives SolarSystemGallery's global item index, independent of each
// entry's 3D `position`. Saturn is first so it's also the default focus on
// load, matching the original single-Saturn scene.
const PLANETS: PlanetSite[] = [
  {
    id: 'saturn',
    textureUrl: '/textures/saturn.jpg',
    radius: 3.2,
    position: [0, -1, -10],
    hasRing: true,
    ringTextureUrl: '/textures/saturn-ring.png',
    items: SATURN_PROJECT_IDS.map((id) => ({ image: projects.find((p) => p.id === id)!.image })),
  },
  {
    id: 'moon',
    textureUrl: '/textures/moon.jpg',
    radius: 0.55,
    position: [-27, -1, -10],
    items: MOON_PROJECT_IDS.map((id) => ({ image: projects.find((p) => p.id === id)!.image })),
  },
  { id: 'sun', textureUrl: '/textures/sun.jpg', radius: 5.5, position: [-70, -1, -10] },
  { id: 'mercury', textureUrl: '/textures/mercury.jpg', radius: 0.9, position: [-52, -1, -10] },
  { id: 'venus', textureUrl: '/textures/venus.jpg', radius: 1.5, position: [-42, -1, -10] },
  { id: 'earth', textureUrl: '/textures/earth.jpg', radius: 1.7, position: [-32, -1, -10] },
  { id: 'mars', textureUrl: '/textures/mars.jpg', radius: 1.1, position: [-21, -1, -10] },
  { id: 'jupiter', textureUrl: '/textures/jupiter.jpg', radius: 4.0, position: [-13, -1, -10] },
  { id: 'uranus', textureUrl: '/textures/uranus.jpg', radius: 2.2, position: [13, -1, -10] },
  { id: 'neptune', textureUrl: '/textures/neptune.jpg', radius: 2.1, position: [22, -1, -10] },
]

export default function Projects() {
  const { t } = useLanguage()
  const items: PreviewProject[] = projects.map((p, i) => ({ ...p, ...t.projects.items[i] }))
  const galleryItems: PreviewProject[] = GALLERY_PROJECT_IDS.map((id) => items.find((p) => p.id === id)!)
  const [openId, setOpenId] = useState<string | null>(null)
  const openProject = items.find((p) => p.id === openId) ?? null

  const [activeIndex, setActiveIndex] = useState(0)
  const [activePlanetId, setActivePlanetId] = useState('saturn')
  const galleryRef = useRef<SolarSystemGalleryHandle>(null)
  const activeProject = galleryItems[activeIndex]

  const handleItemClick = useCallback(
    (index: number) => {
      const project = galleryItems[index]
      if (project) setOpenId(project.id)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t]
  )

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

      {/* Swipe-driven only — not tied to page scroll. Left/right drag spins
          the focused planet's ring; a craft unfolds into its preview card as
          it nears focus, dead-center. Crossing planets (arrows/dots/keyboard
          only, never drag) pulls the camera back to the full solar system
          and flies it in on the target. */}
      <div className="relative h-[65vh] max-h-[760px] min-h-[420px] w-full overflow-hidden sm:h-[72vh]">
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-20 bg-gradient-to-b from-bg to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-20 bg-gradient-to-t from-bg to-transparent" />

        <SolarSystemGallery
          ref={galleryRef}
          planets={PLANETS}
          borderRadius={0.04}
          swipeEase={0.08}
          aspect={16 / 9}
          onItemClick={handleItemClick}
          onActiveIndexChange={setActiveIndex}
          onActivePlanetChange={setActivePlanetId}
        />

        {/* Which planet is currently in focus — a cropped badge of that
            planet's own texture, not an emoji, so it reads as part of the
            same 3D scene rather than a bolted-on UI icon. */}
        <div className="pointer-events-none absolute left-2 top-2 z-10 sm:left-4 sm:top-4">
          <AnimatePresence mode="wait">
            <motion.div
              key={activePlanetId}
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className="flex items-center gap-2"
            >
              <div
                className="h-8 w-8 rounded-full border border-gold/40 bg-cover bg-center shadow-[0_0_14px_rgba(201,168,76,0.3)] sm:h-9 sm:w-9"
                style={{ backgroundImage: `url(${PLANET_TEXTURES[activePlanetId] ?? PLANET_TEXTURES.saturn})` }}
                title={PLANET_LABELS[activePlanetId] ?? activePlanetId}
                aria-hidden="true"
              />
              <span className="hidden font-mono text-[10px] uppercase tracking-widest text-white/35 sm:inline">
                {PLANET_LABELS[activePlanetId] ?? activePlanetId}
              </span>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Carrier/HUD-style readout briefly introducing the focused
            project, angular clipped corners and a mono label row. */}
        {activeProject && (
          <div className="pointer-events-none absolute right-2 top-2 z-10 w-[168px] sm:right-4 sm:top-4 sm:w-[220px]">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeProject.id}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -6 }}
                transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                className="border bg-black/45 px-3 py-2 backdrop-blur-sm sm:px-3.5 sm:py-2.5"
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

        <button
          type="button"
          onClick={() => galleryRef.current?.goTo((activeIndex - 1 + galleryItems.length) % galleryItems.length)}
          aria-label="Previous project"
          className="absolute left-2 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-black/15 text-white/35 backdrop-blur-sm transition-all duration-300 hover:border-gold/40 hover:bg-black/40 hover:text-gold sm:left-6 sm:h-11 sm:w-11"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => galleryRef.current?.goTo((activeIndex + 1) % galleryItems.length)}
          aria-label="Next project"
          className="absolute right-2 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-black/15 text-white/35 backdrop-blur-sm transition-all duration-300 hover:border-gold/40 hover:bg-black/40 hover:text-gold sm:right-6 sm:h-11 sm:w-11"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        <div className="pointer-events-none absolute inset-x-0 bottom-8 z-10 flex items-center justify-center gap-2">
          {galleryItems.map((project, i) => (
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

        <p className="pointer-events-none absolute bottom-2 right-3 z-10 text-[9px] text-white/15">
          Saturn, Moon &amp; planet textures © Solar System Scope, CC BY 4.0
        </p>
      </div>

      <div className="max-w-6xl mx-auto px-6 mt-8 text-center">
        <FadeIn>
          <p className="section-label text-white/25">{t.projects.moreSoonTitle}</p>
          <p className="mt-1 text-xs text-white/20 max-w-xs mx-auto leading-relaxed">{t.projects.moreSoonDesc}</p>
        </FadeIn>
      </div>

      <AnimatePresence>
        {openProject && <ProjectPreviewModal project={openProject} onClose={() => setOpenId(null)} />}
      </AnimatePresence>
    </section>
  )
}
