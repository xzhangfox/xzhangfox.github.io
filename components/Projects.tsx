'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, useScroll, useSpring, useTransform, useVelocity } from 'framer-motion'
import FadeIn from './FadeIn'
import { projects } from '@/lib/data'
import { useLanguage } from '@/lib/i18n'

function ProjectCard({ project, index }: { project: typeof projects[0] & { subtitle: string; description: string; highlights: string[] }; index: number }) {
  const [imgError, setImgError] = useState(false)
  const [videoReady, setVideoReady] = useState(false)
  const [hovering, setHovering] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const showVideo = videoReady && hovering

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    if (showVideo) {
      video.currentTime = 0
      video.play().catch(() => {})
    } else {
      video.pause()
    }
  }, [showVideo])

  return (
    <FadeIn delay={0.1 + index * 0.12}>
      <motion.article
        className="group relative rounded-2xl bg-surface-card border border-white/5 overflow-hidden flex flex-col"
        whileHover={{ y: -4 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        style={{
          boxShadow: '0 0 0 1px rgba(255,255,255,0.04)',
        }}
      >
        {/* Screenshot / video preview */}
        <div
          className="relative w-full aspect-video overflow-hidden bg-surface-elevated"
          onMouseEnter={() => setHovering(true)}
          onMouseLeave={() => setHovering(false)}
        >
          {!imgError ? (
            <img
              src={project.image}
              alt={project.title}
              className={`w-full h-full object-cover object-top transition-opacity duration-300 ${showVideo ? 'opacity-0' : 'opacity-100 group-hover:scale-105'} transition-transform duration-700`}
              onError={() => setImgError(true)}
            />
          ) : (
            /* Fallback placeholder */
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
              <div className="w-12 h-12 rounded-xl border border-gold/30 bg-gold/5 flex items-center justify-center">
                <span className="text-gold font-bold text-lg">F</span>
              </div>
              <span className="section-label text-white/20">{project.title}</span>
            </div>
          )}

          {project.video && (
            <video
              ref={videoRef}
              src={project.video}
              muted
              loop
              playsInline
              preload="metadata"
              onLoadedData={() => setVideoReady(true)}
              onError={() => setVideoReady(false)}
              className={`absolute inset-0 w-full h-full object-cover object-top transition-opacity duration-300 ${showVideo ? 'opacity-100' : 'opacity-0'}`}
            />
          )}

          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-surface-card via-transparent to-transparent opacity-60" />

          {/* Hover gold border glow */}
          <motion.div
            className="absolute inset-0 rounded-t-2xl pointer-events-none"
            initial={{ opacity: 0 }}
            whileHover={{ opacity: 1 }}
            style={{ boxShadow: 'inset 0 0 40px rgba(201,168,76,0.06)' }}
          />
        </div>

        {/* Content */}
        <div className="flex flex-col flex-1 p-5">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <h3 className="text-white font-semibold text-base leading-tight">{project.title}</h3>
              <p className="text-gold text-xs font-mono mt-0.5 opacity-80">{project.subtitle}</p>
            </div>
            <motion.a
              href={project.link}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-shrink-0 w-8 h-8 rounded-lg border border-gold/25 flex items-center justify-center text-gold/60 hover:bg-gold/10 hover:border-gold/50 hover:text-gold transition-all duration-200"
              whileHover={{ rotate: -45 }}
              transition={{ duration: 0.2 }}
              aria-label={`Open ${project.title}`}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M2.5 9.5L9.5 2.5M9.5 2.5H4.5M9.5 2.5V7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </motion.a>
          </div>

          <p className="text-white/45 text-xs leading-relaxed mb-4 flex-1">{project.description}</p>

          {/* Highlights */}
          <div className="space-y-1.5 mb-4">
            {project.highlights.map((h) => (
              <div key={h} className="flex items-center gap-2">
                <span className="w-1 h-1 rounded-full bg-gold/70 flex-shrink-0" />
                <span className="text-white/40 text-xs font-mono">{h}</span>
              </div>
            ))}
          </div>

          {/* Tech tags */}
          <div className="flex flex-wrap gap-1.5 pt-4 border-t border-white/5">
            {project.tech.map((t) => (
              <span
                key={t}
                className="px-2 py-0.5 rounded-md bg-white/3 border border-white/8 text-white/40 text-xs font-mono"
              >
                {t}
              </span>
            ))}
          </div>
        </div>

        {/* Bottom gold border reveal on hover */}
        <motion.div
          className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gold/50 to-transparent"
          initial={{ scaleX: 0 }}
          whileHover={{ scaleX: 1 }}
          transition={{ duration: 0.4 }}
        />
      </motion.article>
    </FadeIn>
  )
}

export default function Projects() {
  const { t } = useLanguage()
  const items = projects.map((p, i) => ({ ...p, ...t.projects.items[i] }))

  const sectionRef = useRef<HTMLElement>(null)
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ['start end', 'end start'] })
  const rawVelocity = useVelocity(scrollYProgress)
  const smoothVelocity = useSpring(rawVelocity, { stiffness: 320, damping: 34, mass: 0.3 })
  const skewY = useTransform(smoothVelocity, [-1.2, 1.2], [9, -9], { clamp: true })
  const scaleY = useTransform(smoothVelocity, [-1.2, 0, 1.2], [0.95, 1, 0.95], { clamp: true })

  return (
    <section id="projects" ref={sectionRef} className="relative py-32 px-6">
      <div className="max-w-6xl mx-auto">
        <FadeIn>
          <div className="section-divider">
            <span className="section-label">{t.projects.sectionLabel}</span>
          </div>
        </FadeIn>

        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-12">
          <FadeIn delay={0.1}>
            <h2 className="text-3xl md:text-4xl font-bold">
              {t.projects.headingPre} <span className="gold-gradient">{t.projects.headingGold}</span>{t.projects.headingPost}
            </h2>
            <p className="text-white/40 text-sm mt-2 max-w-md leading-relaxed">
              {t.projects.subDesc}
            </p>
          </FadeIn>

          <FadeIn delay={0.2}>
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-surface-card border border-gold/15">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              <span className="text-white/40 text-xs font-mono">{t.projects.liveBadge}</span>
            </div>
          </FadeIn>
        </div>

        <motion.div className="grid sm:grid-cols-2 gap-5" style={{ skewY, scaleY }}>
          {items.map((project, i) => (
            <ProjectCard key={project.id} project={project} index={i} />
          ))}
        </motion.div>
      </div>
    </section>
  )
}
