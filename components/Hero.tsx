'use client'

import { ArrowDown, ArrowUpRight } from 'lucide-react'
import { scrollToSection } from '@/lib/scrollToSection'
import { useLanguage } from '@/lib/i18n'

export default function Hero() {
  const { t, language } = useLanguage()
  return (
    <section data-home-hero className="sky-hero">
      <div className="sky-hero-content">
        <p className="sky-eyebrow">{language === 'zh' ? 'AI 工程师' : 'AI ENGINEER'} <span aria-hidden="true">/</span> {language === 'zh' ? '尔湾，加州' : 'IRVINE, CA'}</p>
        <h1 className="sky-name" aria-label="Xi Zhang">
          <span data-sky-word>XI</span><span data-sky-word>ZHANG</span>
        </h1>
        <p className="sky-intro">{language === 'zh' ? '让想法，穿过技术，成为现实。' : 'Turning ideas into things that matter.'}</p>
        <p className="sky-description">{t.hero.description}</p>
        <div className="sky-actions">
          <button className="sky-primary" onClick={() => scrollToSection('#projects')}>
            {t.hero.viewProjects}<ArrowUpRight size={16} aria-hidden="true" />
          </button>
          <button className="sky-secondary" onClick={() => scrollToSection('#contact')}>
            {t.hero.getInTouch}
          </button>
        </div>
      </div>
      <button className="sky-scroll" onClick={() => scrollToSection('#about')} aria-label={language === 'zh' ? '了解更多' : 'Explore more'}>
        <span>{t.hero.scroll}</span><ArrowDown size={14} aria-hidden="true" />
      </button>
    </section>
  )
}
