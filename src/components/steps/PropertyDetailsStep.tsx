'use client'

import { useState, useEffect } from 'react'
import { useQuoteStore } from '@/store/quoteStore'
import { getPricingConfig } from '@/lib/pricingService'
import Button from '../ui/Button'
import Select from '../ui/Select'
import Checkbox from '../ui/Checkbox'
import Card from '../ui/Card'
import { Home, Building, Warehouse, MapPin, Navigation } from 'lucide-react'
import toast from 'react-hot-toast'

interface PropertyDetailsStepProps {
  onNext: () => void
  onPrevious: () => void
}

const propertyTypes = [
  { value: 'casa', label: 'Casa', icon: Home },
  { value: 'departamento', label: 'Departamento', icon: Building },
  { value: 'oficina', label: 'Oficina', icon: Building },
  { value: 'bodega', label: 'Bodega', icon: Warehouse },
  { value: 'otro', label: 'Otro', icon: Home },
]

const floors = Array.from({ length: 30 }, (_, i) => ({
  value: String(i),
  label: i === 0 ? 'Planta Baja' : `Piso ${i}`,
}))

export default function PropertyDetailsStep({ onNext, onPrevious }: PropertyDetailsStepProps) {
  const { origin, destination, setOriginDetails, setDestinationDetails } = useQuoteStore()

  const [originDetails, setOriginDetailsState] = useState({
    propertyType: origin.details?.propertyType || '',
    floor: origin.details?.floor || 0,
    hasElevator: origin.details?.hasElevator ?? true,
    parkingDistance: origin.details?.parkingDistance || 0,
  })

  const [destinationDetails, setDestinationDetailsState] = useState({
    propertyType: destination.details?.propertyType || '',
    floor: destination.details?.floor || 0,
    hasElevator: destination.details?.hasElevator ?? true,
    parkingDistance: destination.details?.parkingDistance || 0,
  })

  const [floorPrice, setFloorPrice] = useState(5000)

  useEffect(() => {
    const loadPricing = async () => {
      try {
        const config = await getPricingConfig()
        setFloorPrice(config.floorSurcharge)
      } catch (error) {
        console.error('Error loading pricing:', error)
      }
    }
    loadPricing()
  }, [])

  const handleSubmit = () => {
    if (!originDetails.propertyType) {
      toast.error('Selecciona el tipo de propiedad de origen')
      return
    }
    if (!destinationDetails.propertyType) {
      toast.error('Selecciona el tipo de propiedad de destino')
      return
    }

    setOriginDetails(originDetails as any)
    setDestinationDetails(destinationDetails as any)

    // Recalcular totales con los nuevos detalles
    useQuoteStore.getState().calculateTotals()

    toast.success('Detalles guardados correctamente')
    onNext()
  }

  return (
    <div className="max-w-5xl mx-auto animate-slide-up">
      <div className="mb-6 text-center">
        <h2 className="text-3xl font-bold text-gray-900 mb-2">Detalles de las Propiedades</h2>
        <p className="text-gray-600">
          Esta información nos ayuda a calcular el esfuerzo y tiempo necesario
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* ORIGEN */}
        <Card variant="elevated">
          <div className="flex items-center gap-2 mb-6 pb-4 border-b">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
              <MapPin className="w-5 h-5 text-blue-600" />
            </div>
            <h3 className="text-xl font-bold">Origen</h3>
          </div>

          {/* Tipo de Propiedad */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Tipo de Propiedad <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              {propertyTypes.map((type) => {
                const Icon = type.icon
                const isSelected = originDetails.propertyType === type.value
                return (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() =>
                      setOriginDetailsState({ ...originDetails, propertyType: type.value as any })
                    }
                    className={`p-4 rounded-lg border-2 transition-all hover:scale-105 ${isSelected
                      ? 'border-primary-600 bg-primary-50 shadow-md'
                      : 'border-gray-200 hover:border-primary-300'
                      }`}
                  >
                    <Icon className="w-8 h-8 mx-auto mb-2 text-gray-600" />
                    <div className="text-sm font-semibold">{type.label}</div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Piso */}
          <Select
            label="Piso"
            options={floors}
            value={String(originDetails.floor)}
            onChange={(e) =>
              setOriginDetailsState({ ...originDetails, floor: parseInt(e.target.value) })
            }
            required
          />

          {/* Ascensor */}
          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <Checkbox
              label="¿Debemos subir artículos por escalera?"
              checked={!originDetails.hasElevator}
              onChange={(e) =>
                setOriginDetailsState({ ...originDetails, hasElevator: !e.target.checked })
              }
            />
          </div>

          {/* Distancia estacionamiento */}
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Distancia del estacionamiento a la puerta
            </label>
            <div className="flex gap-2">
              {[
                { value: 0, label: 'En la puerta' },
                { value: 20, label: '< 20m' },
                { value: 40, label: '20-40m' },
                { value: 60, label: '> 40m' },
              ].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() =>
                    setOriginDetailsState({ ...originDetails, parkingDistance: option.value })
                  }
                  className={`flex-1 px-3 py-2 text-sm rounded-lg border-2 transition-all ${originDetails.parkingDistance === option.value
                    ? 'border-primary-600 bg-primary-50'
                    : 'border-gray-200 hover:border-primary-300'
                    }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Costo adicional por piso */}
          {originDetails.floor > 0 && !originDetails.hasElevator && (
            <div className="mt-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
              <p className="text-sm text-orange-800">
                ⚠️ <strong>Recargo por escalera:</strong> ${originDetails.floor * floorPrice} (Total por {originDetails.floor} pisos)
              </p>
              <p className="text-xs text-orange-700 mt-1 ml-6">
                * Valor sujeto a cambio
              </p>
            </div>
          )}
        </Card>

        {/* DESTINO */}
        <Card variant="elevated">
          <div className="flex items-center gap-2 mb-6 pb-4 border-b">
            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
              <Navigation className="w-5 h-5 text-green-600" />
            </div>
            <h3 className="text-xl font-bold">Destino</h3>
          </div>

          {/* Tipo de Propiedad */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Tipo de Propiedad <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              {propertyTypes.map((type) => {
                const Icon = type.icon
                const isSelected = destinationDetails.propertyType === type.value
                return (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() =>
                      setDestinationDetailsState({
                        ...destinationDetails,
                        propertyType: type.value as any,
                      })
                    }
                    className={`p-4 rounded-lg border-2 transition-all hover:scale-105 ${isSelected
                      ? 'border-primary-600 bg-primary-50 shadow-md'
                      : 'border-gray-200 hover:border-primary-300'
                      }`}
                  >
                    <Icon className="w-8 h-8 mx-auto mb-2 text-gray-600" />
                    <div className="text-sm font-semibold">{type.label}</div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Piso */}
          <Select
            label="Piso"
            options={floors}
            value={String(destinationDetails.floor)}
            onChange={(e) =>
              setDestinationDetailsState({
                ...destinationDetails,
                floor: parseInt(e.target.value),
              })
            }
            required
          />

          {/* Ascensor */}
          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <Checkbox
              label="¿Debemos subir artículos por escalera?"
              checked={!destinationDetails.hasElevator}
              onChange={(e) =>
                setDestinationDetailsState({
                  ...destinationDetails,
                  hasElevator: !e.target.checked,
                })
              }
            />
          </div>

          {/* Distancia estacionamiento */}
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Distancia del estacionamiento a la puerta
            </label>
            <div className="flex gap-2">
              {[
                { value: 0, label: 'En la puerta' },
                { value: 20, label: '< 20m' },
                { value: 40, label: '20-40m' },
                { value: 60, label: '> 40m' },
              ].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() =>
                    setDestinationDetailsState({
                      ...destinationDetails,
                      parkingDistance: option.value,
                    })
                  }
                  className={`flex-1 px-3 py-2 text-sm rounded-lg border-2 transition-all ${destinationDetails.parkingDistance === option.value
                    ? 'border-primary-600 bg-primary-50'
                    : 'border-gray-200 hover:border-primary-300'
                    }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Costo adicional por piso */}
          {destinationDetails.floor > 0 && !destinationDetails.hasElevator && (
            <div className="mt-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
              <p className="text-sm text-orange-800">
                ⚠️ <strong>Recargo por escalera:</strong> ${destinationDetails.floor * floorPrice} (Total por {destinationDetails.floor} pisos)
              </p>
              <p className="text-xs text-orange-700 mt-1 ml-6">
                * Valor sujeto a cambio
              </p>
            </div>
          )}
        </Card>
      </div>

      {/* Botones */}
      <div className="flex gap-4 mt-6">
        <Button type="button" onClick={onPrevious} variant="outline" className="flex-1">
          ← Volver
        </Button>
        <Button onClick={handleSubmit} variant="brand" className="flex-1">
          Continuar →
        </Button>
      </div>
    </div>
  )
}

