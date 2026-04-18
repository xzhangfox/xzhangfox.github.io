import Navigation from '@/components/Navigation'
import Hero from '@/components/Hero'
import About from '@/components/About'
import Experience from '@/components/Experience'
import Skills from '@/components/Skills'
import Projects from '@/components/Projects'
import Education from '@/components/Education'
import Contact from '@/components/Contact'
import LiquidEther from '@/components/LiquidEther'

export default function Home() {
  return (
    <>
      {/* Full-page fluid background — gold palette, transparent base */}
      <LiquidEther
        colors={['#C9A84C', '#D4A843', '#E8C15A', '#F0D080', '#C9A84C']}
        mouseForce={22}
        cursorSize={110}
        resolution={0.45}
        autoDemo={true}
        autoSpeed={0.38}
        autoIntensity={1.9}
        autoRampDuration={0.8}
        autoResumeDelay={1200}
      />

      {/* Site content — sits above the fluid layer */}
      <main className="relative z-10 bg-transparent">
        <Navigation />
        <Hero />
        <About />
        <Experience />
        <Skills />
        <Projects />
        <Education />
        <Contact />
      </main>
    </>
  )
}
