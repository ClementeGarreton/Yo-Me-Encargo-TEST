'use client'

import { useState, useEffect, useRef } from 'react'
import HomePersonalInfoStep from '@/components/steps/home/HomePersonalInfoStep'
import HomeAddressStep from '@/components/steps/home/HomeAddressStep'
import HomeSummaryStep from '@/components/steps/home/HomeSummaryStep'
import { useHomeQuoteStore } from '@/store/homeQuoteStore'
import ProgressBar from '@/components/ui/ProgressBar'
import { getPricingConfig } from '@/lib/pricingService'
import Navbar from '@/components/landing/Navbar'
import Footer from '@/components/landing/Footer'

const steps = [
  { id: 0, name: 'Datos Personales', component: HomePersonalInfoStep },
  { id: 1, name: 'Dirección de Visita', component: HomeAddressStep },
  { id: 2, name: 'Resumen y Pago', component: HomeSummaryStep },
]

export default function DomicilioPage() {
  const [currentStep, setCurrentStep] = useState(0)
  const [homeQuotePrice, setHomeQuotePrice] = useState(80000)
  const { resetQuote, isConfirmed } = useHomeQuoteStore()
  const mainContentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    getPricingConfig()
      .then((pricing) => setHomeQuotePrice(pricing.homeQuotePrice || 80000))
      .catch(() => setHomeQuotePrice(80000))
  }, [])

  // Hacer scroll automático cuando cambia el paso
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }, 100)

    return () => clearTimeout(timeoutId)
  }, [currentStep])

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1)
    }
  }

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleReset = () => {
    resetQuote()
    setCurrentStep(0)
  }

  const CurrentStepComponent = steps[currentStep].component

  return (
    <div className="theme-cotizador">
      <Navbar />

      <main className="min-h-screen pt-20 md:pt-24">
        {/* Barra de progreso alineada bajo el Navbar, igual que el cotizador online */}
        <ProgressBar 
          currentStep={currentStep} 
          totalSteps={steps.length}
          isCompleted={isConfirmed}
          stepLabels={steps.map(s => s.name)}
          onStepClick={(step) => {
            setCurrentStep(step)
          }}
        />
        
        <div ref={mainContentRef} className="container mx-auto px-4 py-8">
          {/* Header con información del servicio */}
          <div className="max-w-3xl mx-auto mb-8">
            <div className="bg-gradient-to-r from-primary-50 to-secondary-50 rounded-lg p-6 border border-primary-200">
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                🏠 Cotización a Domicilio
              </h1>
              <p className="text-gray-700 mb-2">
                Te visitamos en tu hogar para realizar una cotización completa y personalizada
              </p>
              <p className="text-xl md:text-2xl font-black text-secondary-700 mb-5 tracking-tight">
                IDEAL PARA MUDANZAS GRANDES
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-primary-600">{`$${homeQuotePrice.toLocaleString('es-CL')}`}</p>
                  <p className="text-xs text-gray-600">Precio fijo</p>
                </div>
                <div className="bg-white rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-secondary-600">RM</p>
                  <p className="text-xs text-gray-600">Solo Región Metropolitana</p>
                </div>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-4">
                <p className="text-sm text-blue-800 text-center">
                  💡 <strong>Importante:</strong> Si contratas el servicio de mudanza o transporte después de la cotización, 
                  los {`$${homeQuotePrice.toLocaleString('es-CL')}`} pagados se descontarán del valor total del flete.
                </p>
              </div>
            </div>
          </div>

          {/* Componente del paso actual */}
          <CurrentStepComponent
            onNext={handleNext}
            onPrevious={handlePrevious}
            onReset={handleReset}
          />
        </div>
      </main>

      <Footer />
    </div>
  )
}
