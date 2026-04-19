'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import FadeIn from './FadeIn'
import { personalInfo } from '@/lib/data'

interface DayData {
  date: string
  count: number
}

function getDateStr(daysAgo: number): string {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  return d.toISOString().slice(0, 10)
}

async function fetchDayCount(date: string): Promise<number> {
  try {
    const r = await fetch(`https://api.counterapi.dev/v1/xzhangfox-github-io/day-${date}`)
    const d = await r.json()
    return d.count ?? 0
  } catch {
    return 0
  }
}

function BarChart({ data }: { data: DayData[] }) {
  const [hovered, setHovered] = useState<number | null>(null)
  const max = Math.max(...data.map((d) => d.count), 1)
  const BAR_MAX_H = 100 // px

  return (
    <div className="w-full select-none">
      {/* Bars */}
      <div className="flex items-end gap-[3px] h-[100px]">
        {data.map((d, i) => {
          const h = Math.max((d.count / max) * BAR_MAX_H, d.count > 0 ? 5 : 1.5)
          const isToday = i === data.length - 1
          const isHov = hovered === i
          return (
            <div
              key={d.date}
              className="relative flex-1 flex flex-col items-center justify-end h-full cursor-default"
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
            >
              {/* Tooltip */}
              <AnimatePresence>
                {isHov && (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 4 }}
                    transition={{ duration: 0.12 }}
                    className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 whitespace-nowrap z-20 pointer-events-none"
                  >
                    <div className="bg-[#1A1A1A] border border-gold/30 rounded-lg px-2.5 py-1.5 text-center">
                      <div className="text-gold font-mono text-xs font-semibold">{d.count}</div>
                      <div className="text-white/35 font-mono text-[10px]">
                        {new Date(d.date + 'T12:00:00').toLocaleDateString('en', { month: 'short', day: 'numeric' })}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              {/* Bar */}
              <motion.div
                className="w-full rounded-t-[3px] transition-colors duration-150"
                style={{
                  background: isToday
                    ? 'linear-gradient(to top, #C9A84C, #F0D080)'
                    : isHov
                    ? 'rgba(201,168,76,0.65)'
                    : 'rgba(201,168,76,0.28)',
                }}
                initial={{ height: 0 }}
                animate={{ height: h }}
                transition={{ duration: 0.5, delay: i * 0.022, ease: [0.22, 1, 0.36, 1] }}
              />
            </div>
          )
        })}
      </div>

      {/* X-axis */}
      <div className="flex gap-[3px] mt-2.5 border-t border-white/6 pt-2">
        {data.map((d, i) => {
          const show = i === 0 || i === 6 || i === 13
          const isToday = i === data.length - 1
          return (
            <div key={d.date} className="flex-1 text-center">
              {(show || isToday) && (
                <span className={`text-[9px] font-mono ${isToday ? 'text-gold/60' : 'text-white/25'}`}>
                  {isToday
                    ? 'today'
                    : new Date(d.date + 'T12:00:00').toLocaleDateString('en', { month: 'numeric', day: 'numeric' })}
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function VisitModal({ onClose, totalVisits }: { onClose: () => void; totalVisits: number | null }) {
  const [data, setData] = useState<DayData[] | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const days = Array.from({ length: 14 }, (_, i) => getDateStr(13 - i))
    Promise.all(days.map(async (date) => ({ date, count: await fetchDayCount(date) }))).then((results) => {
      setData(results)
      setLoading(false)
    })
  }, [])

  const totalInRange = data ? data.reduce((s, d) => s + d.count, 0) : null
  const todayCount = data ? data[data.length - 1].count : null
  const avgCount = totalInRange != null ? Math.round(totalInRange / 14) : null

  return (
    <motion.div
      className="fixed inset-0 flex items-center justify-center z-[200] px-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Panel */}
      <motion.div
        className="relative w-full max-w-md bg-[#0E0E0E] border border-white/8 rounded-2xl p-6 overflow-hidden"
        initial={{ opacity: 0, scale: 0.94, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 12 }}
        transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Gold glow */}
        <div
          className="absolute inset-0 pointer-events-none rounded-2xl"
          style={{ background: 'radial-gradient(ellipse 80% 50% at 50% 100%, rgba(201,168,76,0.06) 0%, transparent 70%)' }}
        />

        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <span className="w-4 h-px bg-gold/50" />
              <span className="section-label text-gold/60 text-[10px]">Analytics</span>
            </div>
            <h3 className="text-white/90 font-semibold text-base tracking-tight">Visit History</h3>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg border border-white/8 text-white/30 hover:text-white/70 hover:border-white/20 transition-all duration-200 text-sm"
          >
            ✕
          </button>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          {[
            { label: 'Total', value: totalVisits?.toLocaleString() ?? '—' },
            { label: 'Today', value: todayCount != null ? String(todayCount) : '—' },
            { label: 'Daily avg', value: avgCount != null ? String(avgCount) : '—' },
          ].map(({ label, value }) => (
            <div key={label} className="bg-white/[0.03] border border-white/6 rounded-xl px-3 py-2.5 text-center">
              <div className="text-gold font-mono text-base font-semibold">{loading ? '—' : value}</div>
              <div className="text-white/30 font-mono text-[10px] mt-0.5">{label}</div>
            </div>
          ))}
        </div>

        {/* Chart */}
        <div className="mb-1">
          <div className="text-white/25 font-mono text-[10px] mb-3">Last 14 days</div>
          {loading ? (
            <div className="h-[100px] flex items-center justify-center">
              <div className="flex gap-1">
                {Array.from({ length: 3 }).map((_, i) => (
                  <motion.div
                    key={i}
                    className="w-1 h-1 rounded-full bg-gold/40"
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ duration: 1, delay: i * 0.2, repeat: Infinity }}
                  />
                ))}
              </div>
            </div>
          ) : (
            data && <BarChart data={data} />
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}

function useVisitCount() {
  const [count, setCount] = useState<number | null>(null)
  useEffect(() => {
    // Increment total counter
    fetch('https://api.counterapi.dev/v1/xzhangfox-github-io/visits/up')
      .then((r) => r.json())
      .then((d) => setCount(d.count))
      .catch(() => {})

    // Increment today's daily counter (once per session)
    if (!sessionStorage.getItem('daily-tracked')) {
      sessionStorage.setItem('daily-tracked', '1')
      const today = new Date().toISOString().slice(0, 10)
      fetch(`https://api.counterapi.dev/v1/xzhangfox-github-io/day-${today}/up`).catch(() => {})
    }
  }, [])
  return count
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
  const [showChart, setShowChart] = useState(false)
  const visits = useVisitCount()

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
        <div className="mt-24 max-w-6xl mx-auto border-t border-white/5 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="text-white/20 text-xs font-mono">
            © 2026 Xi Zhang · Built with Next.js
            {visits !== null && (
              <>
                {' · '}
                <button
                  onClick={() => setShowChart(true)}
                  className="text-white/20 hover:text-gold/50 transition-colors duration-200 underline-offset-2 hover:underline cursor-pointer"
                >
                  Visits {visits.toLocaleString()}
                </button>
              </>
            )}
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
      </FadeIn>

      {/* Visit chart modal */}
      <AnimatePresence>
        {showChart && <VisitModal onClose={() => setShowChart(false)} totalVisits={visits} />}
      </AnimatePresence>
    </section>
  )
}
