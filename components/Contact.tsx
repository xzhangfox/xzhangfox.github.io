'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import FadeIn from './FadeIn'
import { personalInfo } from '@/lib/data'

interface GitHubStats {
  followers: number
  public_repos: number
}

function useGitHubStats(username: string) {
  const [stats, setStats] = useState<GitHubStats | null>(null)
  useEffect(() => {
    fetch(`https://api.github.com/users/${username}`)
      .then((r) => r.json())
      .then((d) => setStats({ followers: d.followers, public_repos: d.public_repos }))
      .catch(() => {})
  }, [username])
  return stats
}

const socials = [
  {
    label: 'LinkedIn',
    href: personalInfo.linkedin,
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
      </svg>
    ),
  },
  {
    label: 'GitHub',
    href: personalInfo.github,
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
        <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
      </svg>
    ),
  },
]

export default function Contact() {
  const [copied, setCopied] = useState(false)
  const ghStats = useGitHubStats('xzhangfox')

  const copyEmail = () => {
    navigator.clipboard.writeText(personalInfo.email)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <section id="contact" className="relative py-40 px-6 overflow-hidden">
      {/* Background glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 60% 50% at 50% 80%, rgba(201,168,76,0.05) 0%, transparent 70%)',
        }}
      />

      <div className="max-w-4xl mx-auto text-center relative z-10">
        <FadeIn>
          <div className="flex items-center justify-center gap-3 mb-8">
            <span className="w-8 h-px bg-gold/40" />
            <span className="section-label text-gold/70">06 · Contact</span>
            <span className="w-8 h-px bg-gold/40" />
          </div>
        </FadeIn>

        <FadeIn delay={0.1}>
          <h2 className="text-4xl md:text-6xl font-bold mb-4 leading-tight">
            Let&apos;s <span className="gold-gradient">Connect</span>
          </h2>
        </FadeIn>

        <FadeIn delay={0.2}>
          <p className="text-white/40 text-base max-w-lg mx-auto leading-relaxed mb-12">
            Open to new opportunities, collaborations, and interesting conversations about AI, data, and products.
          </p>
        </FadeIn>

        {/* Email CTA */}
        <FadeIn delay={0.3}>
          <motion.button
            onClick={copyEmail}
            className="group relative inline-flex items-center gap-3 px-8 py-4 rounded-2xl border border-gold/30 text-gold hover:bg-gold/8 hover:border-gold/60 transition-all duration-300 mb-10"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <span className="text-base font-mono">{personalInfo.email}</span>
            <span className="text-gold/50 text-xs font-mono">
              {copied ? '✓ Copied!' : 'Copy'}
            </span>
            {/* Glow effect */}
            <motion.div
              className="absolute inset-0 rounded-2xl pointer-events-none"
              animate={{ boxShadow: copied ? '0 0 30px rgba(201,168,76,0.2)' : '0 0 0px rgba(201,168,76,0)' }}
            />
          </motion.button>
        </FadeIn>

        {/* Social links */}
        <FadeIn delay={0.4}>
          <div className="flex items-center justify-center gap-3">
            {socials.map((social) => (
              <motion.a
                key={social.label}
                href={social.href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-surface-card border border-white/8 text-white/40 hover:text-gold hover:border-gold/30 transition-all duration-200 text-sm font-mono"
                whileHover={{ y: -2 }}
                transition={{ duration: 0.2 }}
              >
                {social.icon}
                {social.label}
              </motion.a>
            ))}
          </div>
        </FadeIn>
      </div>

      {/* Footer */}
      <FadeIn delay={0.5}>
        <div className="mt-24 max-w-6xl mx-auto border-t border-white/5 pt-8 space-y-5">

          {/* Stats row */}
          <div className="flex flex-wrap items-center justify-center gap-3">
            {/* Page visit counter via hits.seeyoufarm.com */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-card border border-gold/15">
              <span className="w-1.5 h-1.5 rounded-full bg-gold animate-pulse-gold" />
              <span className="text-white/30 text-xs font-mono">Visits</span>
              <img
                src="https://hits.seeyoufarm.com/api/count/incr/badge.svg?url=https%3A%2F%2Fxzhangfox.github.io&count_bg=%23C9A84C&title_bg=%23141414&icon=&icon_color=%23C9A84C&title=&edge_flat=true"
                alt="visit count"
                className="h-4 opacity-80"
                style={{ imageRendering: 'crisp-edges' }}
              />
            </div>

            {/* GitHub followers */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-card border border-white/8">
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3 text-white/30">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/>
              </svg>
              <span className="text-white/30 text-xs font-mono">
                {ghStats ? (
                  <motion.span
                    key={ghStats.followers}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-gold/70"
                  >
                    {ghStats.followers}
                  </motion.span>
                ) : '—'}
                <span className="text-white/20 ml-1">followers</span>
              </span>
            </div>

            {/* GitHub repos */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-card border border-white/8">
              <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3 text-white/30">
                <path d="M2 2.5A2.5 2.5 0 014.5 0h8.75a.75.75 0 01.75.75v12.5a.75.75 0 01-.75.75h-2.5a.75.75 0 110-1.5h1.75v-2h-8a1 1 0 00-.714 1.7.75.75 0 01-1.072 1.05A2.495 2.495 0 012 11.5v-9zm10.5-1V9h-8c-.356 0-.694.074-1 .208V2.5a1 1 0 011-1h8zM5 12.25v3.25a.25.25 0 00.4.2l1.45-1.087a.25.25 0 01.3 0L8.6 15.7a.25.25 0 00.4-.2v-3.25a.25.25 0 00-.25-.25h-3.5a.25.25 0 00-.25.25z"/>
              </svg>
              <span className="text-white/30 text-xs font-mono">
                {ghStats ? (
                  <motion.span
                    key={ghStats.public_repos}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-gold/70"
                  >
                    {ghStats.public_repos}
                  </motion.span>
                ) : '—'}
                <span className="text-white/20 ml-1">repos</span>
              </span>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="text-white/20 text-xs font-mono">
            © 2026 Xi Zhang · Built with Next.js
          </span>
          <div className="flex items-center gap-4">
            <a
              href={personalInfo.linkedin}
              target="_blank"
              rel="noopener noreferrer"
              className="text-white/20 hover:text-gold/60 text-xs font-mono transition-colors"
            >
              LinkedIn
            </a>
            <a
              href={personalInfo.github}
              target="_blank"
              rel="noopener noreferrer"
              className="text-white/20 hover:text-gold/60 text-xs font-mono transition-colors"
            >
              GitHub
            </a>
          </div>
          </div>

        </div>
      </FadeIn>
    </section>
  )
}
