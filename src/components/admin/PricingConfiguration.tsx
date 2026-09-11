'use client'

import { useState, useEffect } from 'react'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Modal from '@/components/ui/Modal'
import {
  DollarSign,
  Save,
  AlertTriangle,
  Edit3,
  RefreshCw,
  CheckCircle,
  XCircle
} from 'lucide-react'
import toast from 'react-hot-toast'

interface PricingConfig {
  basePrice: number
  pricePerCubicMeter: number
  pricePerKilometer: number
  freeKilometers: number
  floorSurcharge: number
  homeQuotePrice: number
  additionalServices: {
    packing: number
    unpacking: number
    disassembly: number
    assembly: number
  }
  specialPackaging: {
    fragile: number
    electronics: number
    artwork: number
  }
  timeSurcharges: {
    saturday: number
    sunday: number
    holiday: number
  }
  discounts: {
    flexibility: number
    advanceBooking: number
    repeatCustomer: number
  }
}

export default function PricingConfiguration() {
  const [config, setConfig] = useState<PricingConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)

  useEffect(() => {
    fetchPricingConfig()
  }, [])

  const fetchPricingConfig = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/admin/pricing-config')
      const data = await response.json()
      setConfig(data)
    } catch (error) {
      console.error('Error fetching pricing config:', error)
      toast.error('Error al cargar configuración de precios')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!config) return

    try {
      setSaving(true)
      const response = await fetch('/api/admin/pricing-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      })

      if (!response.ok) {
        throw new Error('Error al guardar configuración')
      }

      toast.success('Configuración de precios guardada exitosamente')
      setShowConfirmModal(false)
      setHasChanges(false)
    } catch (error) {
      console.error('Error saving pricing config:', error)
      toast.error('Error al guardar configuración')
    } finally {
      setSaving(false)
    }
  }

  const handleInputChange = (path: string, value: number) => {
    if (!config) return

    const newConfig = { ...config }
    const keys = path.split('.')
    let current = newConfig as any

    for (let i = 0; i < keys.length - 1; i++) {
      if (!current[keys[i]]) {
        current[keys[i]] = {}
      }
      current = current[keys[i]]
    }

    current[keys[keys.length - 1]] = value
    setConfig(newConfig)
    setHasChanges(true)
  }

  const resetToDefaults = () => {
    if (confirm('¿Estás seguro de que quieres restaurar los valores por defecto?')) {
      fetchPricingConfig()
      setHasChanges(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando configuración de precios...</p>
        </div>
      </div>
    )
  }

  if (!config || !config.additionalServices || !config.specialPackaging || !config.timeSurcharges || !config.discounts) {
    return (
      <div className="text-center py-12">
        <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <p className="text-gray-600">Error al cargar configuración de precios</p>
        <Button onClick={fetchPricingConfig} className="mt-4">
          <RefreshCw className="w-4 h-4 mr-2" />
          Reintentar
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Configuración de Precios</h2>
          <p className="text-gray-600">Gestiona todos los precios del cotizador</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={resetToDefaults} variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Restaurar
          </Button>
          <Button
            onClick={() => setShowConfirmModal(true)}
            size="sm"
            disabled={!hasChanges}
          >
            <Save className="w-4 h-4 mr-2" />
            Guardar Cambios
          </Button>
        </div>
      </div>

      {/* Pricing Sections */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Precios Base */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <DollarSign className="w-5 h-5 text-primary-600" />
            <h3 className="text-lg font-semibold">Precios Base</h3>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Precio Base (CLP)
              </label>
              <Input
                type="number"
                value={config.basePrice}
                onChange={(e) => handleInputChange('basePrice', Number(e.target.value))}
                placeholder="50000"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Precio por m³ (CLP)
              </label>
              <Input
                type="number"
                value={config.pricePerCubicMeter}
                onChange={(e) => handleInputChange('pricePerCubicMeter', Number(e.target.value))}
                placeholder="15000"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Kilómetros Gratis Incluidos
              </label>
              <Input
                type="number"
                value={config.freeKilometers || 50}
                onChange={(e) => handleInputChange('freeKilometers', Number(e.target.value))}
                placeholder="50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Precio por km Adicional (CLP)
              </label>
              <Input
                type="number"
                value={config.pricePerKilometer}
                onChange={(e) => handleInputChange('pricePerKilometer', Number(e.target.value))}
                placeholder="800"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Recargo por escalera (CLP)
              </label>
              <Input
                type="number"
                value={config.floorSurcharge}
                onChange={(e) => handleInputChange('floorSurcharge', Number(e.target.value))}
                placeholder="5000"
              />
            </div>
            <div className="rounded-lg border-2 border-secondary-200 bg-secondary-50 p-4">
              <label className="block text-sm font-bold text-gray-800 mb-1">
                Cotización a domicilio (CLP)
              </label>
              <Input
                type="number"
                value={config.homeQuotePrice}
                onChange={(e) => handleInputChange('homeQuotePrice', Number(e.target.value))}
                placeholder="80000"
              />
              <p className="mt-2 text-xs font-semibold text-secondary-800">
                Servicio premium · ideal para mudanzas grandes. El valor se descuenta si el cliente contrata el traslado.
              </p>
            </div>
          </div>
        </Card>

        {/* Servicios Adicionales */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Edit3 className="w-5 h-5 text-primary-600" />
            <h3 className="text-lg font-semibold">Servicios Adicionales</h3>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Desarme de Muebles (CLP)
              </label>
              <Input
                type="number"
                value={config.additionalServices.disassembly}
                onChange={(e) => handleInputChange('additionalServices.disassembly', Number(e.target.value))}
                placeholder="15000"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Armado de Muebles (CLP)
              </label>
              <Input
                type="number"
                value={config.additionalServices.assembly}
                onChange={(e) => handleInputChange('additionalServices.assembly', Number(e.target.value))}
                placeholder="15000"
              />
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-4">
              <p className="text-xs text-blue-800">
                <strong>💡 Nota:</strong> Los servicios de &quot;Armado de Cajas&quot; y &quot;Desembalaje&quot; requieren contacto con un ejecutivo para cotización personalizada.
              </p>
            </div>
          </div>
        </Card>

        {/* Embalaje Especial */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-5 h-5 text-orange-600" />
            <h3 className="text-lg font-semibold">Embalaje Especial</h3>
          </div>
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
              <p className="text-xs text-blue-800">
                <strong>💡 Nota:</strong> Estos precios se multiplican por la cantidad total de m³ de la mudanza.
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Embalaje Básico (CLP por m³)
              </label>
              <Input
                type="number"
                value={config.specialPackaging.fragile}
                onChange={(e) => handleInputChange('specialPackaging.fragile', Number(e.target.value))}
                placeholder="10000"
              />
              <p className="text-xs text-gray-500 mt-1">Se multiplica por m³ totales</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Embalaje Estándar (CLP por m³)
              </label>
              <Input
                type="number"
                value={config.specialPackaging.electronics}
                onChange={(e) => handleInputChange('specialPackaging.electronics', Number(e.target.value))}
                placeholder="15000"
              />
              <p className="text-xs text-gray-500 mt-1">Se multiplica por m³ totales</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Embalaje Premium (CLP por m³)
              </label>
              <Input
                type="number"
                value={config.specialPackaging.artwork}
                onChange={(e) => handleInputChange('specialPackaging.artwork', Number(e.target.value))}
                placeholder="25000"
              />
              <p className="text-xs text-gray-500 mt-1">Se multiplica por m³ totales</p>
            </div>
          </div>
        </Card>

        {/* Recargos y Descuentos */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <h3 className="text-lg font-semibold">Recargos y Descuentos</h3>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Recargo Sábado (%)
              </label>
              <Input
                type="number"
                value={config.timeSurcharges.saturday}
                onChange={(e) => handleInputChange('timeSurcharges.saturday', Number(e.target.value))}
                placeholder="20"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Recargo Domingo (%)
              </label>
              <Input
                type="number"
                value={config.timeSurcharges.sunday}
                onChange={(e) => handleInputChange('timeSurcharges.sunday', Number(e.target.value))}
                placeholder="50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Recargo Feriado (%)
              </label>
              <Input
                type="number"
                value={config.timeSurcharges.holiday}
                onChange={(e) => handleInputChange('timeSurcharges.holiday', Number(e.target.value))}
                placeholder="100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Descuento Flexibilidad (%)
              </label>
              <Input
                type="number"
                value={config.discounts.flexibility}
                onChange={(e) => handleInputChange('discounts.flexibility', Number(e.target.value))}
                placeholder="10"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Descuento Reserva Anticipada (%)
              </label>
              <Input
                type="number"
                value={config.discounts.advanceBooking}
                onChange={(e) => handleInputChange('discounts.advanceBooking', Number(e.target.value))}
                placeholder="5"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Descuento Cliente Recurrente (%)
              </label>
              <Input
                type="number"
                value={config.discounts.repeatCustomer}
                onChange={(e) => handleInputChange('discounts.repeatCustomer', Number(e.target.value))}
                placeholder="15"
              />
            </div>
          </div>
        </Card>
      </div>

      {/* Confirmation Modal */}
      <Modal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        title="Confirmar Cambios"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-6 h-6 text-orange-500 mt-0.5" />
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">
                ¿Estás seguro de que quieres guardar estos cambios?
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                Los nuevos precios se aplicarán inmediatamente a todas las cotizaciones futuras.
                Esta acción no se puede deshacer fácilmente.
              </p>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <p className="text-sm text-yellow-800">
                  <strong>⚠️ Advertencia:</strong> Cambiar los precios puede afectar la competitividad
                  y rentabilidad del negocio. Asegúrate de que los nuevos valores sean correctos.
                </p>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button
              onClick={() => setShowConfirmModal(false)}
              variant="outline"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              isLoading={saving}
              disabled={saving}
              className="bg-orange-600 hover:bg-orange-700"
            >
              <Save className="w-4 h-4 mr-2" />
              {saving ? 'Guardando...' : 'Sí, Guardar Cambios'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
