import Navigation from '@/components/Navigation'
import Hero from '@/components/Hero'
import About from '@/components/About'
import Experience from '@/components/Experience'
import Skills from '@/components/Skills'
import Projects from '@/components/Projects'
import Education from '@/components/Education'
import Contact from '@/components/Contact'
import LiquidEtherGlobal from '@/components/LiquidEtherGlobal'
import HeroAtmosphere from '@/components/HeroAtmosphere'

export default function Home() {
  return (
    <main className="relative bg-bg">
      <HeroAtmosphere />
      <LiquidEtherGlobal />
      <div className="relative" style={{ zIndex: 10 }}>
        <Navigation />
        <Hero />
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
