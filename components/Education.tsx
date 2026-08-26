'use client'

import { motion } from 'framer-motion'
import FadeIn from './FadeIn'
import { education } from '@/lib/data'
import { useLanguage } from '@/lib/i18n'

export default function Education() {
  const { t } = useLanguage()
  const items = education.map((edu, i) => ({ ...edu, ...t.education.items[i] }))
  return (
    <section id="education" className="relative py-32 px-6">
      <div className="max-w-6xl mx-auto">
        <FadeIn>
          <div className="section-divider">
            <span className="section-label">{t.education.sectionLabel}</span>
          </div>
        </FadeIn>

        <FadeIn delay={0.1}>
          <h2 className="text-3xl md:text-4xl font-bold mb-12">
            {t.education.headingPre} <span className="gold-gradient">{t.education.headingGold}</span>
          </h2>
        </FadeIn>

        <div className="grid sm:grid-cols-2 gap-5">
          {items.map((edu, i) => (
            <FadeIn key={edu.school} delay={0.1 + i * 0.1}>
              <motion.div
                className="group rounded-2xl bg-surface-card border border-white/5 p-6 gold-glow-hover relative overflow-hidden"
                whileHover={{ y: -2 }}
                transition={{ duration: 0.25 }}
              >
                {/* Corner decoration */}
                <div className="absolute top-0 right-0 w-16 h-16 overflow-hidden">
                  <div className="absolute top-0 right-0 w-px h-8 bg-gradient-to-b from-gold/30 to-transparent" />
                  <div className="absolute top-0 right-0 h-px w-8 bg-gradient-to-l from-gold/30 to-transparent" />
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-11 h-11 rounded-xl bg-gold/8 border border-gold/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-gold font-bold text-sm tracking-wider">{edu.short}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-white/40 text-xs font-mono mb-1 tracking-wider uppercase">{edu.degree}</p>
                    <h3 className="text-white font-semibold leading-tight mb-1">{edu.field}</h3>
                    <p className="text-white/40 text-xs leading-snug">{edu.school}</p>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="w-1 h-1 rounded-full bg-gold/50" />
                    <span className="text-white/30 text-xs font-mono">{edu.location}</span>
                  </div>
                  <span className="text-gold/70 text-xs font-mono">{edu.year}</span>
                </div>

                {/* Bottom glow */}
                <motion.div
                  className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gold/40 to-transparent"
                  initial={{ scaleX: 0 }}
                  whileHover={{ scaleX: 1 }}
                  transition={{ duration: 0.35 }}
                />
              </motion.div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  )
}
