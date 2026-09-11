'use client'

import { Suspense, useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import WelcomeScreen from '@/components/steps/WelcomeScreen'
import PersonalInfoStep from '@/components/steps/PersonalInfoStep'
import DateTimeStep from '@/components/steps/DateTimeStep'
import AddressStep from '@/components/steps/AddressStep'
import PropertyDetailsStep from '@/components/steps/PropertyDetailsStep'
import ItemsSelectionStep from '@/components/steps/ItemsSelectionStep'
import AdditionalServicesStep from '@/components/steps/AdditionalServicesStep'
import SummaryStep from '@/components/steps/SummaryStep'
import { useQuoteStore } from '@/store/quoteStore'
import ProgressBar from '@/components/ui/ProgressBar'
import Navbar from '@/components/landing/Navbar'
import Footer from '@/components/landing/Footer'

const steps = [
  { id: 0, name: 'Bienvenida', component: WelcomeScreen },
  { id: 1, name: 'Datos Personales', component: PersonalInfoStep },
  { id: 2, name: 'Fecha y Hora', component: DateTimeStep },
  { id: 3, name: 'Direcciones', component: AddressStep },
  { id: 4, name: 'Detalles de Propiedad', component: PropertyDetailsStep },
  { id: 5, name: 'Selección de Items', component: ItemsSelectionStep },
  { id: 6, name: 'Servicios Adicionales', component: AdditionalServicesStep },
  { id: 7, name: 'Resumen', component: SummaryStep },
]

function CotizadorPageInner() {
  const searchParams = useSearchParams()
  // Los CTA de la home que ya dicen "online" (Hero, CtaFinal, Servicios) enlazan a
  // /cotizador?start=online para saltar directo al paso 1 y evitar el selector de
  // modalidad (Bienvenida). Solo el CTA del Navbar ("Cotizar Ahora", sin este parámetro)
  // debe mostrar el selector Online/Domicilio.
  const [currentStep, setCurrentStep] = useState(() =>
    searchParams.get('start') === 'online' ? 1 : 0
  )
  const { resetQuote, isConfirmed, hydrateQuote } = useQuoteStore()
  const mainContentRef = useRef<HTMLDivElement>(null)

  // Si la cotización comenzó por WhatsApp, recupera la misma sesión y precarga los forms.
  useEffect(() => {
    const session = searchParams.get('session')
    const token = searchParams.get('token')
    if (!session || !token) return

    let cancelled = false
    fetch(`/api/quote-sessions/resume?id=${encodeURIComponent(session)}&token=${encodeURIComponent(token)}`)
      .then(async (response) => {
        const data = await response.json()
        if (!response.ok) throw new Error(data?.error || 'No se pudo recuperar la cotización')
        if (cancelled) return
        hydrateQuote({
          ...data.quoteState,
          dateTime: data.quoteState?.dateTime ? new Date(data.quoteState.dateTime) : null,
        })
        if (data.quoteId && typeof window !== 'undefined') {
          sessionStorage.setItem('yme_quote_id', data.quoteId)
        }
        const section = Number(data.currentSection || 1)
        setCurrentStep(Math.min(7, Math.max(1, section)))
      })
      .catch((error) => console.error('[quote-session resume]', error))

    return () => { cancelled = true }
  }, [searchParams, hydrateQuote])

  // Hacer scroll automático cuando cambia el paso
  useEffect(() => {
    // Pequeño delay para asegurar que el DOM se ha actualizado
    const timeoutId = setTimeout(() => {
      // Scroll al inicio de la página
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

  const isWelcome = currentStep === 0

  // .theme-cotizador tiñe de VERDE (identidad de la landing) todos los tokens `primary`
  // dentro del cotizador, sin afectar el resto del sistema. El Navbar y el Footer de la
  // landing se muestran en TODOS los pasos para que el cotizador se sienta la misma web.
  return (
    <div className="theme-cotizador">
      <Navbar />

      <main className="min-h-screen pt-20 md:pt-24">
        {currentStep > 0 && (
          <ProgressBar
            currentStep={currentStep - 1}
            totalSteps={steps.length - 1}
            isCompleted={isConfirmed}
            onStepClick={(step) => {
              setCurrentStep(step + 1)
            }}
          />
        )}

        <div ref={mainContentRef} className="max-w-[1180px] mx-auto px-6 py-8">
          <CurrentStepComponent
            onNext={handleNext}
            onPrevious={handlePrevious}
            onReset={handleReset}
            currentStep={currentStep}
          />
        </div>
      </main>

      <Footer />
    </div>
  )
}

export default function CotizadorPage() {
  return (
    <Suspense fallback={null}>
      <CotizadorPageInner />
    </Suspense>
  )
}

