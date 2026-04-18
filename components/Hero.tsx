'use client'

import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'

const TITLES = ['Full-Stack Data Scientist', 'AI Systems Engineer', 'LLM Platform Architect', 'Full-Stack Data Scientist']

export default function Hero() {
  const [titleIndex, setTitleIndex] = useState(0)
  const [displayText, setDisplayText] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => {
    const current = TITLES[titleIndex]

    if (!isDeleting && displayText === current) {
      timerRef.current = setTimeout(() => setIsDeleting(true), 2400)
      return
    }

    if (isDeleting && displayText === '') {
      setIsDeleting(false)
      setTitleIndex((i) => (i + 1) % (TITLES.length - 1))
      return
    }

    const speed = isDeleting ? 35 : 65
    timerRef.current = setTimeout(() => {
      setDisplayText(isDeleting ? current.slice(0, displayText.length - 1) : current.slice(0, displayText.length + 1))
    }, speed)

    return () => clearTimeout(timerRef.current)
  }, [displayText, isDeleting, titleIndex])

  const nameChars = 'XI ZHANG'.split('')

  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden">
      {/* Particle background */}
      {/* Radial gold glow at center */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 60% 50% at 50% 50%, rgba(201,168,76,0.06) 0%, transparent 70%)',
        }}
      />

      {/* Content */}
      <div className="relative z-10 text-center px-6 max-w-5xl mx-auto">
        {/* Label */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="flex items-center justify-center gap-3 mb-8"
        >
          <span className="w-8 h-px bg-gold/60" />
          <span className="section-label text-gold/80">Irvine, CA · Available for opportunities</span>
          <span className="w-8 h-px bg-gold/60" />
        </motion.div>

        {/* Name */}
        <h1 className="text-[clamp(3.5rem,11vw,8.5rem)] font-bold leading-none tracking-[0.08em] mb-6 select-none">
          {nameChars.map((char, i) => (
            <motion.span
              key={i}
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.7,
                delay: 0.4 + i * 0.045,
                ease: [0.22, 1, 0.36, 1],
              }}
              className={char === ' ' ? 'inline-block w-8' : 'inline-block gold-gradient'}
            >
              {char}
            </motion.span>
          ))}
        </h1>

        {/* Typewriter title */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 1.0 }}
          className="h-8 flex items-center justify-center mb-8"
        >
          <span className="text-lg md:text-xl text-white/70 font-mono tracking-wide">
            {displayText}
            <span className="inline-block w-0.5 h-5 bg-gold ml-0.5 animate-pulse-gold" />
          </span>
        </motion.div>

        {/* Description */}
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 1.1, ease: [0.22, 1, 0.36, 1] }}
          className="text-base md:text-lg text-white/45 max-w-xl mx-auto leading-relaxed mb-12"
        >
          Building AI systems that bridge intelligence with enterprise-grade platforms —
          from RAG pipelines to full-stack products that scale.
        </motion.p>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 1.3, ease: [0.22, 1, 0.36, 1] }}
          className="flex items-center justify-center gap-4 flex-wrap"
        >
          <button
            onClick={() => document.querySelector('#projects')?.scrollIntoView({ behavior: 'smooth' })}
            className="px-7 py-3 bg-gold text-black font-semibold text-sm rounded-xl hover:bg-gold-light transition-all duration-200 hover:scale-105 active:scale-95"
          >
            View Projects
          </button>
          <button
            onClick={() => document.querySelector('#contact')?.scrollIntoView({ behavior: 'smooth' })}
            className="px-7 py-3 border border-gold/40 text-gold font-semibold text-sm rounded-xl hover:bg-gold/10 hover:border-gold/70 transition-all duration-200"
          >
            Get In Touch
          </button>
        </motion.div>
      </div>

      {/* Scroll indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 2.0 }}
        className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
      >
        <span className="section-label text-white/25">scroll</span>
        <div className="w-px h-12 bg-gradient-to-b from-gold/50 to-transparent" />
      </motion.div>
    </section>
  )
}
