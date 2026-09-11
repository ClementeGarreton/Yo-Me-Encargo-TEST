import { Check } from 'lucide-react'
import { useEffect, useRef } from 'react'

interface ProgressBarProps {
  currentStep: number
  totalSteps: number
  onStepClick?: (step: number) => void
  isCompleted?: boolean
  stepLabels?: string[] // Nombres personalizados de los pasos
}

// Nombres por defecto para el cotizador online
const defaultStepNames = [
  'Tus Datos',
  'Fecha y Hora',
  'Direcciones',
  'Detalles',
  'Inventario',
  'Servicios',
  'Resumen'
]

export default function ProgressBar({ currentStep, totalSteps, onStepClick, isCompleted = false, stepLabels }: ProgressBarProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const stepRefs = useRef<(HTMLDivElement | null)[]>([])

  // Usar los labels personalizados o los por defecto
  const stepNames = stepLabels || defaultStepNames.slice(0, totalSteps)

  // Hacer scroll al paso actual cuando cambie
  useEffect(() => {
    if (scrollContainerRef.current && stepRefs.current[currentStep]) {
      const stepElement = stepRefs.current[currentStep]
      if (stepElement) {
        const container = scrollContainerRef.current
        const stepLeft = stepElement.offsetLeft
        const stepWidth = stepElement.offsetWidth
        const containerWidth = container.offsetWidth
        const scrollLeft = container.scrollLeft
        
        // Calcular la posición para centrar el paso actual en la vista
        const targetScrollLeft = stepLeft - (containerWidth / 2) + (stepWidth / 2)
        
        // Smooth scroll
        container.scrollTo({
          left: targetScrollLeft,
          behavior: 'smooth'
        })
      }
    }
  }, [currentStep])

  return (
    <div className="sticky top-[68px] md:top-[76px] z-40 bg-white/95 backdrop-blur border-b border-gray-200">
      <div className="max-w-[1180px] mx-auto px-6 py-3">
        {/* Pasos centrados (el logo ya vive en el Navbar superior de la landing) */}
        <div className="flex items-center justify-center">
            <div 
              ref={scrollContainerRef}
              className="flex items-center overflow-x-auto scrollbar-hide w-full md:w-auto"
            >
              <div className="flex items-center space-x-2 md:space-x-4 min-w-max">
              {stepNames.map((stepName, index) => {
                const stepNumber = index + 1
                const isCompleted = index < currentStep
                const isCurrent = index === currentStep
                const isFuture = index > currentStep

                return (
                  <div 
                    key={index} 
                    ref={(el) => { stepRefs.current[index] = el }}
                    className="flex items-center"
                  >
                    {/* Step Circle */}
                    <div className="flex flex-col items-center">
                      <button
                        onClick={() => onStepClick && onStepClick(index)}
                        disabled={!onStepClick}
                        className={`
                          w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center
                          transition-all duration-300 ease-in-out
                          ${
                            isCompleted
                              ? 'bg-primary-600 text-[rgb(var(--primary-fg))] hover:bg-primary-700'
                              : isCurrent
                              ? 'bg-primary-600 text-[rgb(var(--primary-fg))]'
                              : 'bg-gray-200 text-gray-500 hover:bg-gray-300'
                          }
                          ${onStepClick ? 'cursor-pointer' : 'cursor-default'}
                          ${onStepClick ? 'hover:scale-105' : ''}
                        `}
                      >
                        {isCompleted ? (
                          <Check className="w-4 h-4 md:w-5 md:h-5" />
                        ) : (
                          <span className="text-sm md:text-base font-semibold">
                            {stepNumber}
                          </span>
                        )}
                      </button>
                      
                      {/* Step Label */}
                      <button
                        onClick={() => onStepClick && onStepClick(index)}
                        disabled={!onStepClick}
                        className={`
                          mt-2 text-xs md:text-sm font-medium text-center whitespace-nowrap
                          transition-colors duration-300
                          ${
                            isCompleted || isCurrent
                              ? 'text-primary-600'
                              : 'text-gray-500'
                          }
                          ${onStepClick ? 'cursor-pointer hover:text-primary-500' : 'cursor-default'}
                        `}
                      >
                        {stepName}
                      </button>
                    </div>

                    {/* Connecting Line */}
                    {index < stepNames.length - 1 && (
                      <div
                        className={`
                          h-0.5 md:h-1 mx-2 md:mx-4 transition-colors duration-300
                          ${
                            index < currentStep
                              ? 'bg-primary-600'
                              : 'bg-gray-200'
                          }
                        `}
                        style={{ width: '40px' }}
                      />
                    )}
                  </div>
                )
              })}
              </div>
            </div>
          </div>

        {/* Progress Percentage */}
        <div className="text-center mt-3">
          <span className="text-xs text-gray-500">
            {Math.round(((currentStep + 1) / totalSteps) * 100)}% completado
          </span>
        </div>
      </div>
    </div>
  )
}

