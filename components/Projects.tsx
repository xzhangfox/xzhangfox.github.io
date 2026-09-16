'use client'

import { useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import FadeIn from './FadeIn'
import Masonry, { type MasonryTile } from './Masonry'
import ProjectPreviewModal, { type PreviewProject } from './ProjectPreviewModal'
import { projects } from '@/lib/data'
import { useLanguage } from '@/lib/i18n'

export default function Projects() {
  const { t } = useLanguage()
  const items: PreviewProject[] = projects.map((p, i) => ({ ...p, ...t.projects.items[i] }))
  const [openId, setOpenId] = useState<string | null>(null)
  const openProject = items.find((p) => p.id === openId) ?? null

  const tiles: MasonryTile[] = [
    ...items.map((p): MasonryTile => {
      const source = projects.find((sp) => sp.id === p.id)!
      return {
        kind: 'project',
        id: p.id,
        title: p.title,
        subtitle: p.subtitle,
        image: source.image,
        color: source.color,
        height: source.gridHeight,
        comingSoon: !p.link,
        onOpen: () => setOpenId(p.id),
      }
    }),
    { kind: 'filler', id: 'filler-1', title: t.projects.moreSoonTitle, desc: t.projects.moreSoonDesc, height: 300 },
  ]

  return (
    <section id="projects" className="relative py-32 px-6">
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
            <p className="text-white/40 text-sm mt-2 max-w-md leading-relaxed">{t.projects.subDesc}</p>
          </FadeIn>

          <FadeIn delay={0.2}>
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-surface-card border border-gold/15">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              <span className="text-white/40 text-xs font-mono">{t.projects.liveBadge}</span>
            </div>
          </FadeIn>
        </div>

        <Masonry tiles={tiles} />
      </div>

      <AnimatePresence>
        {openProject && <ProjectPreviewModal project={openProject} onClose={() => setOpenId(null)} />}
      </AnimatePresence>
    </section>
  )
}
