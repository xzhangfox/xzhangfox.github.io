'use client'

import { motion } from 'framer-motion'
import FadeIn from './FadeIn'
import { skillCategories } from '@/lib/data'
import { useLanguage } from '@/lib/i18n'

const categoryIcons: Record<string, string> = {
  'Languages': '{ }',
  'AI & Machine Learning': '⬡',
  'Full-Stack & Backend': '◈',
  'Data & Databases': '◎',
  'Cloud & Infrastructure': '△',
}

export default function Skills() {
  const { t } = useLanguage()
  return (
    <section id="skills" className="relative py-32 px-6">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 70% 40% at 50% 50%, rgba(201,168,76,0.03) 0%, transparent 70%)',
        }}
      />

      <div className="max-w-6xl mx-auto">
        <FadeIn>
          <div className="section-divider">
            <span className="section-label">{t.skills.sectionLabel}</span>
          </div>
        </FadeIn>

        <div className="grid md:grid-cols-2 gap-8 items-start mb-12">
          <FadeIn delay={0.1}>
            <h2 className="text-3xl md:text-4xl font-bold">
              {t.skills.headingPre} <span className="gold-gradient">{t.skills.headingGold}</span>
            </h2>
          </FadeIn>
          <FadeIn delay={0.2}>
            <p className="text-white/40 text-sm leading-relaxed md:text-right">
              {t.skills.subDesc}
            </p>
          </FadeIn>
        </div>

        <div className="space-y-6">
          {skillCategories.map((cat, ci) => (
            <FadeIn key={cat.label} delay={0.1 + ci * 0.08}>
              <div className="rounded-2xl bg-surface-card border border-white/5 p-6 gold-glow-hover">
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-gold font-mono text-sm w-6 text-center">{categoryIcons[cat.label] || '·'}</span>
                  <span className="section-label text-white/60">{t.skills.categoryLabels[cat.label] || cat.label}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {cat.skills.map((skill, si) => (
                    <motion.span
                      key={skill}
                      initial={{ opacity: 0, scale: 0.85 }}
                      whileInView={{ opacity: 1, scale: 1 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.3, delay: 0.05 * si }}
                      whileHover={{ borderColor: 'rgba(201,168,76,0.6)', color: '#C9A84C', backgroundColor: 'rgba(201,168,76,0.08)' }}
                      className="px-3 py-1.5 rounded-lg border border-white/10 text-white/55 text-xs font-mono cursor-default transition-all duration-200"
                    >
                      {skill}
                    </motion.span>
                  ))}
                </div>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  )
}
