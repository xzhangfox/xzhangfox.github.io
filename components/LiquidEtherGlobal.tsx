'use client'

import { useEffect, useState } from 'react'
import LiquidEther from './LiquidEther'

const FULL_OPACITY = 0.45
// Very fine/faint by the time the Projects section (with its own dense 3D
// scene) is reached — the fluid layer shouldn't compete with it.
const FINE_OPACITY = 0.08

export default function LiquidEtherGlobal() {
  const [opacity, setOpacity] = useState(FULL_OPACITY)

  useEffect(() => {
    const update = () => {
      const projectsEl = document.getElementById('projects')
      if (!projectsEl) return
      const rect = projectsEl.getBoundingClientRect()
      // Fade out over the viewport height leading up to the section, fully
      // faint by the time its top reaches the viewport top.
      const fadeDistance = window.innerHeight
      const progress = Math.min(1, Math.max(0, 1 - rect.top / fadeDistance))
      setOpacity(FULL_OPACITY - (FULL_OPACITY - FINE_OPACITY) * progress)
    }
    update()
    window.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [])

  return (
    <LiquidEther
      colors={['#C9A84C', '#D4A843', '#E8C15A', '#F0D080', '#C9A84C']}
      mouseForce={22}
      cursorSize={110}
      resolution={0.45}
      autoDemo={true}
      autoSpeed={0.38}
      autoIntensity={1.6}
      autoRampDuration={0.8}
      autoResumeDelay={1200}
      style={{
        position: 'fixed',
        zIndex: 50,
        opacity,
        mixBlendMode: 'screen',
        transition: 'opacity 0.2s linear',
      }}
    />
  )
}
