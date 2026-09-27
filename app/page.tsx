import Navigation from '@/components/Navigation'
import Hero from '@/components/Hero'
import About from '@/components/About'
import Experience from '@/components/Experience'
import Skills from '@/components/Skills'
import Projects from '@/components/Projects'
import Education from '@/components/Education'
import Contact from '@/components/Contact'
import LiquidEtherGlobal from '@/components/LiquidEtherGlobal'
import NebulaBackground from '@/components/NebulaBackground'

export default function Home() {
  return (
    <main className="relative bg-bg">
      {/* Layer 1 — fixed procedural nebula background */}
      <NebulaBackground />

      {/* Layer 2 — fixed LiquidEther (global) */}
      <LiquidEtherGlobal />

      {/* Layer 3 — page content */}
      <div className="relative" style={{ zIndex: 10 }}>
        <Navigation />
        <Hero />
        {/* Non-hero sections cover the fixed background */}
        <div className="relative bg-bg">
          <About />
          <Experience />
          <Skills />
          <Projects />
          <Education />
          <Contact />
        </div>
      </div>
    </main>
  )
}
