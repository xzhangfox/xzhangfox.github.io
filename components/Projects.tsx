'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import FadeIn from './FadeIn'
import SaturnGallery, { type SaturnGalleryHandle, type GalleryItem } from './SaturnGallery'
import ProjectPreviewModal, { type PreviewProject } from './ProjectPreviewModal'
import { projects } from '@/lib/data'
import { useLanguage } from '@/lib/i18n'

// One extra "screen" of scroll per transition between projects — the pinned
// gallery consumes this scroll distance to sweep horizontally before the
// page is released to continue scrolling normally.
const VH_PER_TRANSITION = 65

// Static (language-independent) and module-level so it never changes identity
// across renders — SaturnGallery tears down and rebuilds its whole WebGL
// scene whenever `items` changes identity, which would otherwise happen on
// every scroll-driven re-render.
const GALLERY_ITEMS: GalleryItem[] = projects.map((p) => ({ image: p.image }))

export default function Projects() {
  const { t } = useLanguage()
  const items: PreviewProject[] = projects.map((p, i) => ({ ...p, ...t.projects.items[i] }))
  const [openId, setOpenId] = useState<string | null>(null)
  const openProject = items.find((p) => p.id === openId) ?? null

  const [activeIndex, setActiveIndex] = useState(0)
  const pinRef = useRef<HTMLDivElement>(null)
  const galleryRef = useRef<SaturnGalleryHandle>(null)

  const handleItemClick = useCallback(
    (index: number) => {
      const project = items[index]
      if (project) setOpenId(project.id)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t]
  )

  useEffect(() => {
    const update = () => {
      const el = pinRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const scrollableHeight = rect.height - window.innerHeight
      const progress = scrollableHeight <= 0 ? (rect.top > 0 ? 0 : 1) : Math.min(1, Math.max(0, -rect.top / scrollableHeight))
      galleryRef.current?.setProgress(progress)
      const idx = Math.round(progress * (GALLERY_ITEMS.length - 1))
      setActiveIndex((prev) => (prev === idx ? prev : idx))
    }
    update()
    window.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
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
              <span className="text-white/40 text-xs font-mono">{t.projects.liveBadge}</span>
            </div>
          </FadeIn>
        </div>
      </div>

      {/* Pinned, scroll-driven horizontal gallery. Scrolling down inside this
          block sweeps the gallery right through each project; once the last
          project is reached the section un-pins and the page keeps scrolling. */}
      <div ref={pinRef} className="relative" style={{ height: `${100 + (GALLERY_ITEMS.length - 1) * VH_PER_TRANSITION}vh` }}>
        <div className="sticky top-0 h-screen w-full overflow-hidden">
          <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-20 bg-gradient-to-b from-bg to-transparent" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-20 bg-gradient-to-t from-bg to-transparent" />

          <SaturnGallery
            ref={galleryRef}
            items={GALLERY_ITEMS}
            borderRadius={0.04}
            scrollEase={0.065}
            aspect={16 / 9}
            onItemClick={handleItemClick}
          />

          <div className="pointer-events-none absolute inset-x-0 bottom-8 z-10 flex items-center justify-center gap-2">
            {GALLERY_ITEMS.map((_, i) => {
              const source = projects[i]
              return (
                <span
                  key={source.id}
                  className="h-1.5 rounded-full transition-all duration-300 ease-out"
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
