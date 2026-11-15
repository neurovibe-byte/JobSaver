import { useEffect } from 'react'
import { useReveal } from '../../hooks/useReveal.js'
import { CallToAction, Faq, Footer } from './sections/Closing.jsx'
import Hero from './sections/Hero.jsx'
import { Features, HowItWorks, Sources, Stats } from './sections/Highlights.jsx'
import Navbar from './sections/Navbar.jsx'
import { DashboardPreview, TelegramShowcase } from './sections/Showcase.jsx'
import './landing.css'

export default function LandingPage() {
  useReveal()
  useEffect(() => {
    document.title = 'JobSaver: AI workplace safety monitoring'
    return () => {
      document.title = 'JobSaver'
    }
  }, [])

  return (
    <div className="landing">
      <Navbar />
      <main>
        <Hero />
        <Stats />
        <Features />
        <HowItWorks />
        <TelegramShowcase />
        <DashboardPreview />
        <Sources />
        <Faq />
        <CallToAction />
      </main>
      <Footer />
    </div>
  )
}
