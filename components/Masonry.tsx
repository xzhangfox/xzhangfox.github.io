'use client'

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger)
}

export type MasonryTile =
  | {
      kind: 'project'
      id: string
      title: string
      subtitle: string
      image: string
      color: string
      height: number
      comingSoon: boolean
      onOpen: () => void
    }
  | {
      kind: 'filler'
      id: string
      title: string
      desc: string
      height: number
    }

interface Placement {
  id: string
  left: number
  top: number
  width: number
  height: number
}

const GAP = 20

function useColumnCount() {
  const [cols, setCols] = useState(3)
  useEffect(() => {
    const compute = () => {
      const w = window.innerWidth
      if (w < 640) return setCols(1)
      if (w < 1024) return setCols(2)
      setCols(3)
    }
    compute()
    window.addEventListener('resize', compute)
    return () => window.removeEventListener('resize', compute)
  }, [])
  return cols
}

function useContainerWidth(ref: React.RefObject<HTMLDivElement | null>) {
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width
      if (w) setWidth(w)
    })
    ro.observe(el)
    setWidth(el.getBoundingClientRect().width)
    return () => ro.disconnect()
  }, [ref])
  return width
}

export default function Masonry({ tiles }: { tiles: MasonryTile[] }) {
  const cols = useColumnCount()
  const containerRef = useRef<HTMLDivElement>(null)
  const containerWidth = useContainerWidth(containerRef)
  const itemRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const revealed = useRef(false)

  const { placements, containerHeight } = useMemo(() => {
    const itemWidth = cols > 0 ? (containerWidth - (cols - 1) * GAP) / cols : 0
    const colHeights = new Array(cols).fill(0)
    const placements: Placement[] = tiles.map((tile) => {
      const col = colHeights.indexOf(Math.min(...colHeights))
      const left = col * (itemWidth + GAP)
      const top = colHeights[col]
      colHeights[col] += tile.height + GAP
      return { id: tile.id, left, top, width: itemWidth, height: tile.height }
    })
    return { placements, containerHeight: Math.max(0, ...colHeights) - GAP }
  }, [tiles, cols, containerWidth])

  useLayoutEffect(() => {
    if (!containerWidth) return
    placements.forEach((p) => {
      const el = itemRefs.current.get(p.id)
      if (!el) return
      const vars = { left: p.left, top: p.top, width: p.width, height: p.height }
      if (revealed.current) {
        gsap.to(el, { ...vars, duration: 0.5, ease: 'power3.out' })
      } else {
        gsap.set(el, vars)
      }
    })
  }, [placements, containerWidth])

  useEffect(() => {
    const container = containerRef.current
    if (!container || !containerWidth) return

    const items = Array.from(itemRefs.current.values())
    gsap.set(items, { opacity: 0, y: 48, scale: 0.92, filter: 'blur(10px)' })

    const playEnter = () => {
      revealed.current = true
      gsap.to(items, {
        opacity: 1,
        y: 0,
        scale: 1,
        filter: 'blur(0px)',
        duration: 0.6,
        stagger: 0.05,
        ease: 'power3.out',
        overwrite: true,
      })
    }

    const playExit = (dir: 'up' | 'down') => {
      revealed.current = false
      gsap.to(items, {
        opacity: 0,
        y: dir === 'down' ? 32 : -32,
        scale: 0.94,
        filter: 'blur(8px)',
        duration: 0.4,
        stagger: 0.03,
        ease: 'power2.in',
        overwrite: true,
      })
    }

    const st = ScrollTrigger.create({
      trigger: container,
      start: 'top 85%',
      end: 'bottom 15%',
      onEnter: playEnter,
      onEnterBack: playEnter,
      onLeave: () => playExit('down'),
      onLeaveBack: () => playExit('up'),
    })

    return () => st.kill()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tiles.length, containerWidth > 0])

  const handleHover = (id: string, hovering: boolean) => {
    const el = itemRefs.current.get(id)
    if (!el) return
    gsap.to(el, { scale: hovering ? 0.95 : 1, duration: 0.35, ease: 'power2.out' })
  }

  return (
    <div ref={containerRef} className="relative w-full" style={{ height: containerHeight || undefined }}>
      {tiles.map((tile) => (
        <div
          key={tile.id}
          ref={(el) => {
            if (el) itemRefs.current.set(tile.id, el)
            else itemRefs.current.delete(tile.id)
          }}
          className="absolute"
          onMouseEnter={() => handleHover(tile.id, true)}
          onMouseLeave={() => handleHover(tile.id, false)}
        >
          {tile.kind === 'project' ? <ProjectTile tile={tile} /> : <FillerTile tile={tile} />}
        </div>
      ))}
    </div>
  )
}

function ProjectTile({ tile }: { tile: Extract<MasonryTile, { kind: 'project' }> }) {
  const [imgError, setImgError] = useState(false)
  return (
    <button
      type="button"
      onClick={tile.onOpen}
      className="group relative block h-full w-full overflow-hidden rounded-2xl border border-white/5 bg-surface-card text-left"
      style={{ boxShadow: '0 0 0 1px rgba(255,255,255,0.04)' }}
    >
      {!imgError ? (
        <img
          src={tile.image}
          alt={tile.title}
          onError={() => setImgError(true)}
          className="h-full w-full object-cover object-top transition-transform duration-700 group-hover:scale-105"
        />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-3" style={{ background: `${tile.color}0D` }}>
          <span className="section-label text-white/25">{tile.title}</span>
        </div>
      )}

      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />

      <div
        className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{ boxShadow: `inset 0 0 50px ${tile.color}22, 0 0 30px ${tile.color}1A` }}
      />

      {tile.comingSoon && (
        <span className="absolute right-3 top-3 rounded-md border border-white/15 bg-black/50 px-2 py-0.5 text-[10px] font-mono uppercase tracking-wide text-white/60 backdrop-blur-sm">
          Soon
        </span>
      )}

      <div className="absolute inset-x-0 bottom-0 p-5">
        <h3 className="text-white font-semibold text-base leading-tight">{tile.title}</h3>
        <p className="mt-0.5 text-xs font-mono opacity-80" style={{ color: tile.color }}>
          {tile.subtitle}
        </p>
      </div>

      <div
        className="absolute bottom-0 left-0 right-0 h-px scale-x-0 transition-transform duration-400 group-hover:scale-x-100"
        style={{ backgroundImage: `linear-gradient(to right, transparent, ${tile.color}80, transparent)` }}
      />
    </button>
  )
}

function FillerTile({ tile }: { tile: Extract<MasonryTile, { kind: 'filler' }> }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-gold/20 bg-white/[0.015] p-6 text-center">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-gold/40" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-gold/60" />
      </span>
      <p className="section-label text-white/25">{tile.title}</p>
      <p className="max-w-[16rem] text-xs leading-relaxed text-white/20">{tile.desc}</p>
    </div>
  )
}
