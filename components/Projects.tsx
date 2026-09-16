'use client'

import { useCallback, useRef, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import FadeIn from './FadeIn'
import SaturnGallery, { type SaturnGalleryHandle, type GalleryItem } from './SaturnGallery'
import ProjectPreviewModal, { type PreviewProject } from './ProjectPreviewModal'
import { projects } from '@/lib/data'
import { useLanguage } from '@/lib/i18n'

// Static (language-independent) and module-level so it never changes identity
// across renders — SaturnGallery tears down and rebuilds its whole WebGL
// scene whenever `items` changes identity.
const GALLERY_ITEMS: GalleryItem[] = projects.map((p) => ({ image: p.image }))

export default function Projects() {
  const { t } = useLanguage()
  const items: PreviewProject[] = projects.map((p, i) => ({ ...p, ...t.projects.items[i] }))
  const [openId, setOpenId] = useState<string | null>(null)
  const openProject = items.find((p) => p.id === openId) ?? null

  const [activeIndex, setActiveIndex] = useState(0)
  const galleryRef = useRef<SaturnGalleryHandle>(null)

  const handleItemClick = useCallback(
    (index: number) => {
      const project = items[index]
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
          the ring; a meteorite unfolds into its preview card as it nears
          focus, dead-center. */}
      <div className="relative h-[65vh] max-h-[760px] min-h-[420px] w-full overflow-hidden sm:h-[72vh]">
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-20 bg-gradient-to-b from-bg to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-20 bg-gradient-to-t from-bg to-transparent" />

        <SaturnGallery
          ref={galleryRef}
          items={GALLERY_ITEMS}
          borderRadius={0.04}
          swipeEase={0.08}
          aspect={16 / 9}
          onItemClick={handleItemClick}
          onActiveIndexChange={setActiveIndex}
        />

        <div className="pointer-events-none absolute inset-x-0 bottom-8 z-10 flex items-center justify-center gap-2">
          {GALLERY_ITEMS.map((_, i) => {
            const source = projects[i]
            return (
              <button
                key={source.id}
                type="button"
                onClick={() => galleryRef.current?.goTo(i)}
                aria-label={`Show ${source.title}`}
                className="pointer-events-auto h-1.5 rounded-full transition-all duration-300 ease-out"
                style={{
                  width: i === activeIndex ? 24 : 6,
                  background: i === activeIndex ? source.color : 'rgba(255,255,255,0.18)',
                }}
              />
            )
          })}
        </div>

        <p className="pointer-events-none absolute bottom-2 right-3 z-10 text-[9px] text-white/15">
          Saturn textures © Solar System Scope, CC BY 4.0
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
