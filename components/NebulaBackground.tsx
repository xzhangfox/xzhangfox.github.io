'use client'

import { useEffect, useRef } from 'react'

// Replaces the old hero-bg.mp4 (an unrelated bicycle/valley clip) with a
// procedural blue/gold nebula — no photo asset, so no licensing/attribution
// to track. Blue/cyan echoes the 3D hologram screens' own neon accent (see
// SolarSystemGallery's NEON_CYAN); gold is the site's one brand color —
// together they read as a nebula without a third palette to maintain.
//
// Two layers: soft blurred cloud blobs done in plain CSS (a radial-gradient
// is already exactly this soft, and animating them is a cheap `transform`,
// not a per-frame redraw), and a small canvas on top for twinkling stars —
// the same breathing-opacity trick ParticleCanvas already uses elsewhere,
// just without its connecting lines/mouse-repulsion, which read as a
// network diagram rather than a starfield.
const CLOUDS: { top: string; left: string; size: number; color: string; duration: number; delay: number }[] = [
  { top: '-20%', left: '0%', size: 1100, color: 'rgba(58, 160, 255, 0.55)', duration: 46, delay: 0 },
  { top: '10%', left: '55%', size: 900, color: 'rgba(40, 210, 255, 0.42)', duration: 54, delay: -14 },
  { top: '45%', left: '10%', size: 780, color: 'rgba(201, 168, 76, 0.30)', duration: 62, delay: -30 },
  { top: '-10%', left: '30%', size: 1200, color: 'rgba(30, 90, 160, 0.55)', duration: 70, delay: -20 },
  { top: '55%', left: '60%', size: 720, color: 'rgba(232, 193, 90, 0.28)', duration: 50, delay: -8 },
  { top: '30%', left: '80%', size: 640, color: 'rgba(80, 190, 255, 0.35)', duration: 58, delay: -40 },
]

// A few hand-placed brighter "ember" stars with a soft bloom halo, echoing
// the warm focal star common in nebula photography — placed deliberately
// rather than left to the random field below, so there's always a clear
// focal point instead of an even scatter.
const EMBER_STARS: { top: string; left: string; size: number; color: string }[] = [
  { top: '35%', left: '22%', size: 5, color: '#ffb27a' },
  { top: '65%', left: '78%', size: 4, color: '#9fd8ff' },
]

const STAR_COUNT = 220

// A small tileable grain texture — the same per-pixel noise-canvas trick
// SolarSystemGallery's getHullTexture already uses for the craft hull —
// laid over the smooth gradient clouds via `mix-blend-mode: overlay` so
// they read as turbulent dust rather than flat, clean-edged blobs.
function makeGrainDataUrl(): string {
  const size = 160
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  const imgData = ctx.createImageData(size, size)
  for (let i = 0; i < imgData.data.length; i += 4) {
    const v = Math.random() * 255
    imgData.data[i] = v
    imgData.data[i + 1] = v
    imgData.data[i + 2] = v
    imgData.data[i + 3] = 255
  }
  ctx.putImageData(imgData, 0, 0)
  return canvas.toDataURL()
}

export default function NebulaBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const grainRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (grainRef.current) {
      grainRef.current.style.backgroundImage = `url(${makeGrainDataUrl()})`
    }
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let raf = 0
    let stars: { x: number; y: number; r: number; hue: number; phase: number; speed: number }[] = []

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
      stars = Array.from({ length: STAR_COUNT }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        r: Math.random() * 1.3 + 0.4,
        // Mostly cool white-blue, a handful warm gold — matches the two
        // cloud hues instead of a flat white field.
        hue: Math.random() < 0.75 ? 210 : 40,
        phase: Math.random() * Math.PI * 2,
        speed: 0.4 + Math.random() * 0.6,
      }))
    }
    resize()
    window.addEventListener('resize', resize)

    let t = 0
    const animate = () => {
      t += 0.012
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      for (const s of stars) {
        const twinkle = 0.5 + 0.5 * Math.sin(t * s.speed + s.phase)
        ctx.beginPath()
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2)
        ctx.fillStyle = `hsla(${s.hue}, 85%, 88%, ${0.2 + twinkle * 0.65})`
        ctx.fill()
      }
      raf = requestAnimationFrame(animate)
    }
    animate()

    return () => {
      window.removeEventListener('resize', resize)
      cancelAnimationFrame(raf)
    }
  }, [])

  return (
    <div className="fixed inset-0 w-full h-full overflow-hidden pointer-events-none" style={{ zIndex: 1, background: '#050608' }}>
      {CLOUDS.map((c, i) => (
        <div
          key={i}
          className="absolute rounded-full nebula-drift"
          style={{
            top: c.top,
            left: c.left,
            width: c.size,
            height: c.size,
            background: `radial-gradient(circle, ${c.color} 0%, transparent 75%)`,
            filter: 'blur(50px)',
            animationDuration: `${c.duration}s`,
            animationDelay: `${c.delay}s`,
          }}
        />
      ))}
      {EMBER_STARS.map((s, i) => (
        <div
          key={i}
          className="absolute rounded-full"
          style={{
            top: s.top,
            left: s.left,
            width: s.size * 6,
            height: s.size * 6,
            background: `radial-gradient(circle, ${s.color} 0%, transparent 70%)`,
            filter: 'blur(1.5px)',
          }}
        />
      ))}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
      <div
        ref={grainRef}
        className="absolute inset-0 w-full h-full"
        style={{ backgroundRepeat: 'repeat', backgroundSize: '160px 160px', mixBlendMode: 'overlay', opacity: 0.15 }}
      />
    </div>
  )
}
