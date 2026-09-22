'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { GalleryShot } from '@/lib/data'
import type { ScreenRect } from './SolarSystemGallery'
import { useLanguage } from '@/lib/i18n'

export interface PreviewProject {
  id: string
  title: string
  subtitle: string
  description: string
  tech: string[]
  link?: string
  image: string
  gallery: GalleryShot[]
  highlights: string[]
  color: string
}

function hexToRgb(hex: string) {
  const n = parseInt(hex.replace('#', ''), 16)
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`
}

export default function ProjectPreviewModal({
  project,
  planetColor,
  originRect,
  onClose,
}: {
  project: PreviewProject
  /** The current planet's own mask color (PlanetSite.auraColor) — the
   *  hologram edge/chase border matches this, not the project's own
   *  `color`, so it reads as an extension of the planet it lives on. */
  planetColor: string
  /** The hologram screen's on-screen rect at the moment it was clicked —
   *  the gallery image (`gallery[0]`) is the exact same picture the screen
   *  was showing, so opening just moves/grows that same image into place
   *  rather than fading a new one in. Null skips the morph (plain fade). */
  originRect: ScreenRect | null
  onClose: () => void
}) {
  const { t } = useLanguage()
  const [index, setIndex] = useState(0)
  const shots = project.gallery
  const shot = shots[index]

  // Phase 1: TWO elements morph out of `originRect` at once — the image
  // (to its natural resting spot inside the card) and the outer card
  // itself (to its own full resting size). Both start from the exact same
  // rect and run the same transition, so what reads as "the hologram
  // screen's own neon edge" (carried by the outer card, not the image —
  // see `hologram-edge` below) is the thing that visibly deforms into the
  // detail page's outermost border, rather than a plain border appearing
  // separately once the image finishes. Phase 2 (`expanded`) reveals
  // everything else — header, description, tech, CTA — only once that
  // finishes, so the open reads as "the preview itself grows into the
  // page" rather than a card appearing with an image inside it.
  //
  // Framer Motion's declarative `animate` prop is used rather than the
  // imperative `useAnimation()` controls: driving each container from a
  // FROM-transform state to an identity state via two ordinary state
  // updates (below) is the standard, well-tested pattern for this kind of
  // FLIP animation, and `motion.div` picks up the transition between them
  // on its own once mounted with `initial={false}`.
  const imgWrapRef = useRef<HTMLDivElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const [expanded, setExpanded] = useState(!originRect)
  const identityFlip = { x: 0, y: 0, scaleX: 1, scaleY: 1 }
  const [flip, setFlip] = useState(identityFlip)
  const [cardFlip, setCardFlip] = useState(identityFlip)
  // getBoundingClientRect() reads the element's current RENDERED (post-
  // transform) box, not its pre-transform layout box — so measuring
  // "final rect" is only valid before any transform has been applied yet.
  // React 18 Strict Mode double-invokes EVERY effect (layout and passive)
  // back-to-back, synchronously, before the browser gets a chance to paint
  // in between — so splitting "set origin" and "animate to identity"
  // across two separate effects doesn't work in dev: both run twice in the
  // same tick and the browser only ever paints the final, already-settled
  // state, skipping the transition entirely. This guard makes the whole
  // sequence run exactly once, and the nested double rAF inside forces a
  // real paint of the origin state before the identity state is set, so
  // `motion.div` has something to actually animate FROM.
  const hasStartedRef = useRef(false)

  useLayoutEffect(() => {
    if (hasStartedRef.current) return
    hasStartedRef.current = true
    const imgEl = imgWrapRef.current
    const cardEl = cardRef.current
    if (!imgEl || !cardEl || !originRect) {
      setExpanded(true)
      return
    }
    const deltaFrom = (finalRect: DOMRect) => ({
      x: originRect.left + originRect.width / 2 - (finalRect.left + finalRect.width / 2),
      y: originRect.top + originRect.height / 2 - (finalRect.top + finalRect.height / 2),
      scaleX: originRect.width / finalRect.width,
      scaleY: originRect.height / finalRect.height,
    })
    // Mount already at the origin transform (paired with `initial={false}`
    // below, so this first value is applied instantly, not animated to).
    setFlip(deltaFrom(imgEl.getBoundingClientRect()))
    setCardFlip(deltaFrom(cardEl.getBoundingClientRect()))
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setFlip(identityFlip)
        setCardFlip(identityFlip)
        setTimeout(() => setExpanded(true), 570)
      })
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (!expanded) return
      if (e.key === 'ArrowRight') setIndex((i) => (i + 1) % shots.length)
      if (e.key === 'ArrowLeft') setIndex((i) => (i - 1 + shots.length) % shots.length)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [shots.length, onClose, expanded])

  return (
    <motion.div
      className="fixed inset-0 z-[200] flex items-center justify-center px-4 py-8"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      onClick={expanded ? onClose : undefined}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      <motion.div
        ref={cardRef}
        initial={false}
        animate={{ x: cardFlip.x, y: cardFlip.y, scaleX: cardFlip.scaleX, scaleY: cardFlip.scaleY }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        style={{
          transformOrigin: 'center center',
          // The detail page's own resting width IS the hologram screen's
          // real measured width at the moment it was clicked — not an
          // independent breakpoint-driven value — so it looks like the
          // same object at any viewport size, not something that happens
          // to start the same size and then grows wider once expanded.
          // `getFocusedScreenRect()` (see SolarSystemGallery) already
          // accounts for the screen's own mobile/narrow-viewport clamp, so
          // this stays correctly sized on any device without extra logic
          // here. Falls back to a fixed width only in the (practically
          // unreachable) case this opens with no origin at all.
          width: originRect ? `${originRect.width}px` : 'min(600px, 100%)',
          maxWidth: 'calc(100vw - 2rem)',
          ['--holo-rgb' as string]: hexToRgb(planetColor),
        } as React.CSSProperties}
        className="relative flex max-h-full flex-col overflow-hidden rounded-[4%]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Card chrome fill — deferred until the image has fully arrived,
            so the opening read is "the preview itself grows," not "a card
            appears with an image inside it." The actual visible border is
            `hologram-edge`/`hologram-chase` below, not a plain CSS border
            here: the same neon edge treatment the WebGL hologram screen
            had, carried by THIS outer container's own FLIP so it visibly
            deforms from the thumbnail's edge into the detail page's
            outermost border rather than swapping to a new one. Both are
            steady — no flicker, no noise/turbulence — and confined to the
            border's own ring, so the image/text behind them never moves. */}
        <motion.div
          className="pointer-events-none absolute inset-0 rounded-[4%] bg-[#0E0E0E]"
          initial={{ opacity: originRect ? 0 : 1 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        />
        <motion.div
          className="pointer-events-none absolute inset-0 rounded-[4%]"
          initial={{ opacity: originRect ? 0 : 1 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          style={{ background: `radial-gradient(ellipse 80% 50% at 50% 0%, ${project.color}14 0%, transparent 70%)` }}
        />
        <div className="pointer-events-none absolute inset-0 rounded-[4%] hologram-edge" />
        <div className="pointer-events-none absolute inset-0 rounded-[4%] hologram-chase" />

        <button
          onClick={onClose}
          className="absolute right-4 top-4 z-10 flex h-7 w-7 items-center justify-center text-base text-white/40 transition-opacity duration-300 hover:text-white/80"
          style={{ opacity: expanded ? 1 : 0, pointerEvents: expanded ? 'auto' : 'none' }}
          aria-label="Close"
        >
          ✕
        </button>

        <div className="relative overflow-y-auto p-5">
          {/* Header — always laid out (so the image below never shifts
              position once this fades in) but invisible until expanded. */}
          <div className="mb-4 pr-8 transition-opacity duration-300" style={{ opacity: expanded ? 1 : 0 }}>
            <div className="mb-0.5 flex items-center gap-2">
              <span className="h-px w-4" style={{ background: project.color }} />
              <span className="section-label text-[10px]" style={{ color: project.color }}>
                {project.subtitle}
              </span>
            </div>
            <h3 className="text-lg font-semibold tracking-tight text-white/90">{project.title}</h3>
          </div>

          {/* The morphing image — same picture the hologram screen was
              projecting, its container just moves/resizes into place. A
              thin light border/glow echoes the hologram's own edge. */}
          <motion.div
            ref={imgWrapRef}
            initial={false}
            animate={{ x: flip.x, y: flip.y, scaleX: flip.scaleX, scaleY: flip.scaleY }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
            style={{ transformOrigin: 'center center' }}
            className="relative aspect-video w-full overflow-hidden rounded-[4%] bg-surface-elevated"
          >
            {/* A separate drag layer from the outer FLIP-morph container
                above — dragging only ever nudges/snaps THIS element (the
                elastic constraint pins it back to x:0 either way), while
                the actual slide change still runs through the same
                fade transition below the arrows/dots already use. */}
            <motion.div
              className={`h-full w-full ${expanded && shots.length > 1 ? 'cursor-grab active:cursor-grabbing' : ''}`}
              drag={expanded && shots.length > 1 ? 'x' : false}
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.6}
              onDragEnd={(_, info) => {
                const swipedLeft = info.offset.x < -60 || info.velocity.x < -500
                const swipedRight = info.offset.x > 60 || info.velocity.x > 500
                if (swipedLeft) setIndex((i) => (i + 1) % shots.length)
                else if (swipedRight) setIndex((i) => (i - 1 + shots.length) % shots.length)
              }}
            >
              <AnimatePresence mode="wait">
                <motion.img
                  key={shot.src}
                  src={shot.src}
                  alt={shot.caption ?? project.title}
                  className="h-full w-full object-cover object-top"
                  initial={index === 0 ? false : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  draggable={false}
                />
              </AnimatePresence>
            </motion.div>

            {expanded && shots.length > 1 && (
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

            {expanded && shot.caption && (
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-4 py-3">
                <p className="text-xs text-white/70">{shot.caption}</p>
              </div>
            )}
          </motion.div>

          {expanded && (
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
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
            </motion.div>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}
