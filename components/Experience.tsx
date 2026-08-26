'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import FadeIn from './FadeIn'
import { experience } from '@/lib/data'
import { useLanguage } from '@/lib/i18n'

export default function Experience() {
  const [expanded, setExpanded] = useState<number | null>(null)
  const { t } = useLanguage()
  const bullets = experience.bullets.map((b, i) => ({ ...b, ...t.experience.bullets[i] }))

  return (
    <section id="experience" className="relative py-32 px-6">
      {/* Subtle background line */}
      <div className="absolute left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-gold/10 to-transparent pointer-events-none" />

      <div className="max-w-6xl mx-auto">
        <FadeIn>
          <div className="section-divider">
            <span className="section-label">{t.experience.sectionLabel}</span>
          </div>
        </FadeIn>

        <div className="grid md:grid-cols-5 gap-12 items-start">
          {/* Left — heading */}
          <FadeIn direction="left" delay={0.1} className="md:col-span-2">
            <h2 className="text-3xl md:text-4xl font-bold leading-tight mb-6">
              {t.experience.headingLine1}<br />
              <span className="gold-gradient">{t.experience.headingGold}</span>
            </h2>
            <p className="text-white/40 text-sm leading-relaxed">
              {t.experience.subDesc}
            </p>

            {/* Company badge */}
            <div className="mt-8 inline-flex items-center gap-3 px-4 py-3 rounded-xl bg-surface-card border border-gold/20">
              <div className="w-9 h-9 rounded-lg bg-gold/10 border border-gold/30 flex items-center justify-center">
                <span className="text-gold font-bold text-xs tracking-wider">S</span>
              </div>
              <div>
                <p className="text-white font-semibold text-sm">{experience.company}</p>
                <p className="text-white/40 text-xs font-mono">{experience.period}</p>
              </div>
            </div>

            <div className="mt-4 flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-md bg-surface-elevated text-white/50 text-xs font-mono border border-white/5">
                {experience.location}
              </span>
              <span className="px-2.5 py-1 rounded-md bg-green-500/10 text-green-400 text-xs font-mono border border-green-500/20">
                {t.experience.currentBadge}
              </span>
            </div>
          </FadeIn>

          {/* Right — bullet cards */}
          <div className="md:col-span-3 space-y-3">
            <FadeIn delay={0.1}>
              <p className="text-white/60 text-sm mb-5 font-mono">{t.experience.role}</p>
            </FadeIn>

            {bullets.map((bullet, i) => (
              <FadeIn key={bullet.title} delay={0.1 + i * 0.07}>
                <motion.div
                  layout
                  className="rounded-xl bg-surface-card border border-white/5 overflow-hidden cursor-pointer gold-glow-hover"
                  onClick={() => setExpanded(expanded === i ? null : i)}
                  whileHover={{ borderColor: 'rgba(201,168,76,0.25)' }}
                >
                  <div className="flex items-center justify-between px-5 py-4 gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-1.5 h-1.5 rounded-full bg-gold flex-shrink-0 animate-pulse-gold" />
                      <span className="text-white text-sm font-medium truncate">{bullet.title}</span>
                    </div>
                    <motion.div
                      animate={{ rotate: expanded === i ? 45 : 0 }}
                      transition={{ duration: 0.2 }}
                      className="text-gold/60 text-lg flex-shrink-0 leading-none"
                    >
                      +
                    </motion.div>
                  </div>

                  <AnimatePresence initial={false}>
                    {expanded === i && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                      >
                        <div className="px-5 pb-4 pt-1 border-t border-white/5">
                          <p className="text-white/50 text-sm leading-relaxed">{bullet.desc}</p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              </FadeIn>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
