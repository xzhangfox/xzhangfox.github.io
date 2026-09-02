'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useLanguage } from '@/lib/i18n'

export default function Navigation() {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const { t, toggleLanguage } = useLanguage()

  const links = [
    { label: t.nav.about, href: '#about' },
    { label: t.nav.experience, href: '#experience' },
    { label: t.nav.projects, href: '#projects' },
    { label: t.nav.contact, href: '#contact' },
  ]

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const handleNav = (href: string) => {
    setMenuOpen(false)
    const el = document.querySelector(href)
    el?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <motion.header
      initial={{ y: -80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        scrolled
          ? 'bg-black/70 backdrop-blur-2xl border-b border-gold-border'
          : 'bg-transparent'
      }`}
    >
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="flex items-center gap-2.5 group"
        >
          <div className="w-8 h-8 rounded-lg border border-gold/40 flex items-center justify-center bg-gold/5 group-hover:bg-gold/10 transition-colors">
            <span className="text-gold font-mono text-xs font-bold tracking-wider">XZ</span>
          </div>
          <span className="text-white/80 text-sm font-medium hidden sm:block group-hover:text-white transition-colors">
            Xi Zhang
          </span>
        </button>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1">
          {links.map((link) => (
            <button
              key={link.href}
              onClick={() => handleNav(link.href)}
              className="px-4 py-2 text-sm text-white/50 hover:text-gold transition-colors duration-200 font-mono tracking-wider uppercase text-xs"
            >
              {link.label}
            </button>
          ))}
        </nav>

        {/* Resume CTA */}
        <div className="hidden md:flex items-center gap-3">
          <a
            href="/Resume.pdf"
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-1.5 text-xs font-mono tracking-widest uppercase border border-gold/40 text-gold rounded-md hover:bg-gold/10 hover:border-gold/70 transition-all duration-200"
          >
            {t.nav.resume}
          </a>
        </div>

        <div className="flex items-center gap-2">
          {/* Language toggle */}
          <button
            onClick={toggleLanguage}
            aria-label="Switch language"
            className="px-3 py-1.5 text-xs font-mono tracking-widest border border-gold/30 text-gold/80 rounded-md hover:bg-gold/10 hover:border-gold/60 hover:text-gold transition-all duration-200 active:scale-95"
          >
            {t.nav.langToggle}
          </button>

          {/* Mobile hamburger */}
          <button
            className="md:hidden flex flex-col gap-1.5 p-2"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Toggle menu"
          >
            <span className={`w-5 h-px bg-gold transition-all duration-300 ${menuOpen ? 'rotate-45 translate-y-2' : ''}`} />
            <span className={`w-5 h-px bg-gold/60 transition-all duration-300 ${menuOpen ? 'opacity-0' : ''}`} />
            <span className={`w-5 h-px bg-gold transition-all duration-300 ${menuOpen ? '-rotate-45 -translate-y-2' : ''}`} />
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="md:hidden bg-black/90 backdrop-blur-2xl border-t border-gold/10"
          >
            <div className="px-6 py-4 flex flex-col gap-2">
              {links.map((link) => (
                <button
                  key={link.href}
                  onClick={() => handleNav(link.href)}
                  className="py-2.5 text-left text-sm text-white/60 hover:text-gold font-mono tracking-widest uppercase transition-colors"
                >
                  {link.label}
                </button>
              ))}
              <a
                href="/Resume.pdf"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 py-2.5 text-center text-xs font-mono tracking-widest uppercase border border-gold/40 text-gold rounded-md"
              >
                {t.nav.resume}
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  )
}
