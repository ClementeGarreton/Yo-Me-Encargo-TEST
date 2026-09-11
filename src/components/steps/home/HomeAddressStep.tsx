'use client'

import { useState, useEffect } from 'react'
import { useHomeQuoteStore } from '@/store/homeQuoteStore'
import Card from '@/components/ui/Card'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import Select from '@/components/ui/Select'
import { MapPin } from 'lucide-react'

interface HomeAddressStepProps {
  onNext: () => void
  onPrevious: () => void
}

const COMUNAS_RM = [
  'Santiago',
  'Cerrillos',
  'Cerro Navia',
  'Conchalí',
  'El Bosque',
  'Estación Central',
  'Huechuraba',
  'Independencia',
  'La Cisterna',
  'La Florida',
  'La Granja',
  'La Pintana',
  'La Reina',
  'Las Condes',
  'Lo Barnechea',
  'Lo Espejo',
  'Lo Prado',
  'Macul',
  'Maipú',
  'Ñuñoa',
  'Pedro Aguirre Cerda',
  'Peñalolén',
  'Providencia',
  'Pudahuel',
  'Quilicura',
  'Quinta Normal',
  'Recoleta',
  'Renca',
  'San Joaquín',
  'San Miguel',
  'San Ramón',
  'Vitacura',
  'Puente Alto',
  'Pirque',
  'San José de Maipo',
  'Colina',
  'Lampa',
  'Tiltil',
  'San Bernardo',
  'Buin',
  'Calera de Tango',
  'Paine',
  'Melipilla',
  'Alhué',
  'Curacaví',
  'María Pinto',
  'San Pedro',
  'Talagante',
  'El Monte',
  'Isla de Maipo',
  'Padre Hurtado',
  'Peñaflor',
]

export default function HomeAddressStep({ onNext, onPrevious }: HomeAddressStepProps) {
  const { visitAddress, setVisitAddress } = useHomeQuoteStore()
  const [formData, setFormData] = useState({
    street: visitAddress?.street || '',
    number: visitAddress?.number || '',
    commune: visitAddress?.commune || '',
    region: 'Región Metropolitana',
    additionalInfo: visitAddress?.additionalInfo || '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (visitAddress) {
      setFormData({
        street: visitAddress.street,
        number: visitAddress.number,
        commune: visitAddress.commune,
        region: visitAddress.region,
        additionalInfo: visitAddress.additionalInfo || '',
      })
    }
  }, [visitAddress])

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.street.trim()) {
      newErrors.street = 'La calle es requerida'
    }

    if (!formData.number.trim()) {
      newErrors.number = 'El número es requerido'
    }

    if (!formData.commune) {
      newErrors.commune = 'La comuna es requerida'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      return
    }

    setVisitAddress({
      street: formData.street.trim(),
      number: formData.number.trim(),
      commune: formData.commune,
      region: formData.region,
      additionalInfo: formData.additionalInfo.trim(),
    })

    onNext()
  }

  return (
    <div className="max-w-2xl mx-auto">
      <Card>
        <div className="mb-6">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            Dirección de Visita
          </h2>
          <p className="text-gray-600">
            ¿Dónde te visitaremos para realizar la cotización?
          </p>
          <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800 font-medium">
              📍 Servicio disponible solo en la Región Metropolitana
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Región (fija) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Región
            </label>
            <Input
              type="text"
              value={formData.region}
              disabled
              className="bg-gray-50"
            />
          </div>

          {/* Comuna */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Comuna *
            </label>
            <Select
              value={formData.commune}
              onChange={(e) => setFormData({ ...formData, commune: e.target.value })}
              options={[
                { value: '', label: 'Selecciona una comuna' },
                ...COMUNAS_RM.map((comuna) => ({
                  value: comuna,
                  label: comuna,
                })),
              ]}
            />
            {errors.commune && (
              <p className="text-sm text-red-600 mt-1">{errors.commune}</p>
            )}
          </div>

          {/* Calle */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Calle *
            </label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <Input
                type="text"
                value={formData.street}
                onChange={(e) => setFormData({ ...formData, street: e.target.value })}
                placeholder="Av. Providencia"
                className="pl-10"
                error={errors.street}
              />
            </div>
            {errors.street && (
              <p className="text-sm text-red-600 mt-1">{errors.street}</p>
            )}
          </div>

          {/* Número */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Número *
            </label>
            <Input
              type="text"
              value={formData.number}
              onChange={(e) => setFormData({ ...formData, number: e.target.value })}
              placeholder="1234"
              error={errors.number}
            />
            {errors.number && (
              <p className="text-sm text-red-600 mt-1">{errors.number}</p>
            )}
          </div>

          {/* Información adicional */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Información Adicional (Opcional)
            </label>
            <textarea
              value={formData.additionalInfo}
              onChange={(e) => setFormData({ ...formData, additionalInfo: e.target.value })}
              placeholder="Ej: Depto 501, Torre B, cerca del metro"
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          {/* Botones */}
          <div className="flex justify-between pt-4">
            <Button
              type="button"
              onClick={onPrevious}
              variant="outline"
            >
              ← Volver
            </Button>
            <Button type="submit">
              Continuar →
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
