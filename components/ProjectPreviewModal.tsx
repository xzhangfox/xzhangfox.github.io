'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { GalleryShot } from '@/lib/data'
import { useLanguage } from '@/lib/i18n'

export interface PreviewProject {
  id: string
  title: string
  subtitle: string
  description: string
  tech: string[]
  link?: string
  gallery: GalleryShot[]
  highlights: string[]
  color: string
}

export default function ProjectPreviewModal({
  project,
  onClose,
}: {
  project: PreviewProject
  onClose: () => void
}) {
  const { t } = useLanguage()
  const [index, setIndex] = useState(0)
  const shots = project.gallery
  const shot = shots[index]

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight') setIndex((i) => (i + 1) % shots.length)
      if (e.key === 'ArrowLeft') setIndex((i) => (i - 1 + shots.length) % shots.length)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [shots.length, onClose])

  return (
    <motion.div
      className="fixed inset-0 z-[200] flex items-center justify-center px-4 py-8"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      <motion.div
        className="relative flex max-h-full w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-white/8 bg-[#0E0E0E]"
        initial={{ opacity: 0, scale: 0.94, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 12 }}
        transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="pointer-events-none absolute inset-0 rounded-2xl"
          style={{ background: `radial-gradient(ellipse 80% 50% at 50% 0%, ${project.color}14 0%, transparent 70%)` }}
        />

        {/* Header */}
        <div className="flex items-start justify-between gap-4 p-5 pb-4">
          <div>
            <div className="mb-0.5 flex items-center gap-2">
              <span className="h-px w-4" style={{ background: project.color }} />
              <span className="section-label text-[10px]" style={{ color: project.color }}>
                {project.subtitle}
              </span>
            </div>
            <h3 className="text-lg font-semibold tracking-tight text-white/90">{project.title}</h3>
          </div>
          <button
            onClick={onClose}
            className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg border border-white/8 text-sm text-white/30 transition-all duration-200 hover:border-white/20 hover:text-white/70"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="overflow-y-auto px-5 pb-5">
          {/* Gallery */}
          <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-surface-elevated">
            <AnimatePresence mode="wait">
              <motion.img
                key={shot.src}
                src={shot.src}
                alt={shot.caption ?? project.title}
                className="h-full w-full object-cover object-top"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
              />
            </AnimatePresence>

            {shots.length > 1 && (
              <>
                <button
                  onClick={() => setIndex((i) => (i - 1 + shots.length) % shots.length)}
                  className="absolute left-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-black/50 text-white/70 backdrop-blur-sm transition-colors hover:bg-black/70 hover:text-white"
                  aria-label="Previous"
                >
                  ‹
                </button>
                <button
                  onClick={() => setIndex((i) => (i + 1) % shots.length)}
                  className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-black/50 text-white/70 backdrop-blur-sm transition-colors hover:bg-black/70 hover:text-white"
                  aria-label="Next"
                >
                  ›
                </button>
              </>
            )}

            {shot.caption && (
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-4 py-3">
                <p className="text-xs text-white/70">{shot.caption}</p>
              </div>
            )}
          </div>

          {shots.length > 1 && (
            <div className="mt-3 flex gap-2">
              {shots.map((s, i) => (
                <button
                  key={s.src}
                  onClick={() => setIndex(i)}
                  className="h-1.5 flex-1 rounded-full transition-colors duration-200"
                  style={{ background: i === index ? project.color : 'rgba(255,255,255,0.1)' }}
                  aria-label={`Go to image ${i + 1}`}
                />
              ))}
            </div>
          )}

          {/* Description */}
          <p className="mt-5 text-sm leading-relaxed text-white/50">{project.description}</p>

          {/* Highlights */}
          <div className="mt-4 space-y-1.5">
            {project.highlights.map((h) => (
              <div key={h} className="flex items-center gap-2">
                <span className="h-1 w-1 flex-shrink-0 rounded-full" style={{ background: project.color }} />
                <span className="font-mono text-xs text-white/40">{h}</span>
              </div>
            ))}
          </div>

          {/* Tech tags */}
          <div className="mt-4 flex flex-wrap gap-1.5 border-t border-white/5 pt-4">
            {project.tech.map((tag) => (
              <span key={tag} className="rounded-md border border-white/8 bg-white/[0.03] px-2 py-0.5 font-mono text-xs text-white/40">
                {tag}
              </span>
            ))}
          </div>

          {/* CTA */}
          <div className="mt-5">
            {project.link ? (
              <a
                href={project.link}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-all duration-200"
                style={{ borderColor: `${project.color}40`, color: project.color }}
              >
                Visit Live Site
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M2.5 9.5L9.5 2.5M9.5 2.5H4.5M9.5 2.5V7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </a>
            ) : (
              <span className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-4 py-2 font-mono text-xs uppercase tracking-wide text-white/30">
                {t.projects.comingSoon}
              </span>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}
