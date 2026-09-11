import Navbar from '@/components/landing/Navbar'
import Hero from '@/components/landing/Hero'
import ClientLogos from '@/components/landing/ClientLogos'
import HowItWorks from '@/components/landing/HowItWorks'
import WhyChooseUs from '@/components/landing/WhyChooseUs'
import Testimonials from '@/components/landing/Testimonials'
import Servicios from '@/components/landing/Servicios'
import FAQ from '@/components/landing/FAQ'
import CtaFinal from '@/components/landing/CtaFinal'
import Footer from '@/components/landing/Footer'
import ChatBot from '@/components/ui/ChatBot'

export default function HomePage() {
  return (
    <>
      <Navbar />
      <main className="overflow-x-hidden">
        <Hero />
        <ClientLogos />
        <HowItWorks />
        <WhyChooseUs />
        <Testimonials />
        <Servicios />
        <FAQ />
        <CtaFinal />
      </main>
      <Footer />
      <ChatBot />
    </>
  )
}
