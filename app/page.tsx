import Navigation from '@/components/Navigation'
import Hero from '@/components/Hero'
import About from '@/components/About'
import Experience from '@/components/Experience'
import Skills from '@/components/Skills'
import Projects from '@/components/Projects'
import Education from '@/components/Education'
import Contact from '@/components/Contact'
import LiquidEtherGlobal from '@/components/LiquidEtherGlobal'

export default function Home() {
  return (
    <main className="relative bg-bg">
      {/* Layer 1 — fixed video background */}
      <video
        autoPlay
        loop
        muted
        playsInline
        className="fixed inset-0 w-full h-full object-cover pointer-events-none"
        style={{ zIndex: 1 }}
      >
        <source src="/videos/hero-bg.mp4" type="video/mp4" />
      </video>

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
