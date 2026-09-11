'use client'

import { useState, useEffect } from 'react'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Modal from '@/components/ui/Modal'
import { clearScheduleCache } from '@/lib/scheduleService'
import { 
  Clock, 
  Save, 
  AlertTriangle,
  Calendar,
  CheckCircle,
  XCircle,
  RefreshCw,
  Star
} from 'lucide-react'
import toast from 'react-hot-toast'

interface TimeSlot {
  time: string
  label: string
  recommended: boolean
}

interface ScheduleConfig {
  daysOfWeek: {
    monday: boolean
    tuesday: boolean
    wednesday: boolean
    thursday: boolean
    friday: boolean
    saturday: boolean
    sunday: boolean
  }
  timeSlots: TimeSlot[]
}

export default function ScheduleConfiguration() {
  const [config, setConfig] = useState<ScheduleConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)
  const [newTimeSlot, setNewTimeSlot] = useState({ time: '', label: '', recommended: false })

  useEffect(() => {
    fetchScheduleConfig()
  }, [])

  const fetchScheduleConfig = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/admin/schedule-config')
      const data = await response.json()
      
      // Validar que los datos estén completos
      if (data.error) {
        throw new Error(data.error)
      }
      
      // Validar estructura de datos
      if (!data.daysOfWeek || !data.timeSlots) {
        throw new Error('Estructura de datos inválida')
      }
      
      setConfig(data)
    } catch (error: any) {
      console.error('Error fetching schedule config:', error)
      toast.error(error.message || 'Error al cargar configuración de horarios')
      // Establecer valores por defecto
      setConfig({
        daysOfWeek: {
          monday: true,
          tuesday: true,
          wednesday: true,
          thursday: true,
          friday: true,
          saturday: true,
          sunday: false
        },
        timeSlots: [
          { time: '08:00', label: '08:00 hrs', recommended: true },
          { time: '09:00', label: '09:00 hrs', recommended: true },
          { time: '10:00', label: '10:00 hrs', recommended: true },
          { time: '11:00', label: '11:00 hrs', recommended: false },
          { time: '14:00', label: '14:00 hrs', recommended: true },
          { time: '15:00', label: '15:00 hrs', recommended: false }
        ]
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!config) return

    try {
      setSaving(true)
      const response = await fetch('/api/admin/schedule-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      })

      if (!response.ok) {
        throw new Error('Error al guardar configuración')
      }

      toast.success('Configuración de horarios guardada exitosamente')
      setShowConfirmModal(false)
      setHasChanges(false)
      
      // Limpiar cache para que los cambios se apliquen inmediatamente
      clearScheduleCache()
    } catch (error) {
      console.error('Error saving schedule config:', error)
      toast.error('Error al guardar configuración')
    } finally {
      setSaving(false)
    }
  }

  const handleDayToggle = (day: keyof ScheduleConfig['daysOfWeek']) => {
    if (!config) return

    const newConfig = {
      ...config,
      daysOfWeek: {
        ...config.daysOfWeek,
        [day]: !config.daysOfWeek[day]
      }
    }
    setConfig(newConfig)
    setHasChanges(true)
  }

  const handleTimeSlotChange = (index: number, field: keyof TimeSlot, value: string | boolean) => {
    if (!config) return

    const newConfig = {
      ...config,
      timeSlots: config.timeSlots.map((slot, i) => 
        i === index ? { ...slot, [field]: value } : slot
      )
    }
    setConfig(newConfig)
    setHasChanges(true)
  }

  const addTimeSlot = () => {
    if (!config || !newTimeSlot.time || !newTimeSlot.label) {
      toast.error('Por favor completa todos los campos')
      return
    }

    // Validar formato de hora (HH:MM)
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/
    if (!timeRegex.test(newTimeSlot.time)) {
      toast.error('Formato de hora inválido. Usa HH:MM (ej: 09:00)')
      return
    }

    // Verificar que no exista ya
    if (config.timeSlots.some(slot => slot.time === newTimeSlot.time)) {
      toast.error('Este horario ya existe')
      return
    }

    const newConfig = {
      ...config,
      timeSlots: [...config.timeSlots, { ...newTimeSlot }].sort((a, b) => a.time.localeCompare(b.time))
    }
    setConfig(newConfig)
    setNewTimeSlot({ time: '', label: '', recommended: false })
    setHasChanges(true)
  }

  const removeTimeSlot = (index: number) => {
    if (!config) return

    const newConfig = {
      ...config,
      timeSlots: config.timeSlots.filter((_, i) => i !== index)
    }
    setConfig(newConfig)
    setHasChanges(true)
  }

  const resetToDefaults = () => {
    if (confirm('¿Estás seguro de que quieres restaurar los valores por defecto?')) {
      fetchScheduleConfig()
      setHasChanges(false)
    }
  }

  const dayNames = {
    monday: 'Lunes',
    tuesday: 'Martes',
    wednesday: 'Miércoles',
    thursday: 'Jueves',
    friday: 'Viernes',
    saturday: 'Sábado',
    sunday: 'Domingo'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando configuración de horarios...</p>
        </div>
      </div>
    )
  }

  if (!config || !config.daysOfWeek || !config.timeSlots) {
    return (
      <div className="text-center py-12">
        <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <p className="text-gray-600">Error al cargar configuración de horarios</p>
        <Button onClick={fetchScheduleConfig} className="mt-4">
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
          <h2 className="text-2xl font-bold text-gray-900">Configuración de Horarios</h2>
          <p className="text-gray-600">Gestiona días disponibles y horarios de trabajo</p>
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

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Días de la Semana */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="w-5 h-5 text-primary-600" />
            <h3 className="text-lg font-semibold">Días de Trabajo</h3>
          </div>
          <div className="space-y-3">
            {Object.entries(dayNames).map(([key, name]) => (
              <div key={key} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="font-medium text-gray-700">{name}</span>
                <button
                  onClick={() => handleDayToggle(key as keyof ScheduleConfig['daysOfWeek'])}
                  className={`
                    w-12 h-6 rounded-full transition-colors relative
                    ${config.daysOfWeek[key as keyof ScheduleConfig['daysOfWeek']] 
                      ? 'bg-primary-600' 
                      : 'bg-gray-300'
                    }
                  `}
                >
                  <div
                    className={`
                      w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform
                      ${config.daysOfWeek[key as keyof ScheduleConfig['daysOfWeek']] 
                        ? 'translate-x-6' 
                        : 'translate-x-0.5'
                      }
                    `}
                  />
                </button>
              </div>
            ))}
          </div>
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>💡 Tip:</strong> Los días deshabilitados no aparecerán en el calendario de reservas.
            </p>
          </div>
        </Card>

        {/* Horarios Disponibles */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-5 h-5 text-primary-600" />
            <h3 className="text-lg font-semibold">Horarios Disponibles</h3>
          </div>
          
          {/* Lista de horarios existentes */}
          <div className="space-y-2 mb-4">
            {config.timeSlots.map((slot, index) => (
              <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-900">{slot.time}</span>
                    <span className="text-gray-600">{slot.label}</span>
                    {slot.recommended && (
                      <Star className="w-4 h-4 text-yellow-500 fill-current" />
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleTimeSlotChange(index, 'recommended', !slot.recommended)}
                    className={`
                      p-1 rounded transition-colors
                      ${slot.recommended 
                        ? 'text-yellow-500 hover:text-yellow-600' 
                        : 'text-gray-400 hover:text-yellow-500'
                      }
                    `}
                    title={slot.recommended ? 'Quitar recomendación' : 'Marcar como recomendado'}
                  >
                    <Star className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => removeTimeSlot(index)}
                    className="p-1 text-red-500 hover:text-red-600 transition-colors"
                    title="Eliminar horario"
                  >
                    <XCircle className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Agregar nuevo horario */}
          <div className="border-t pt-4">
            <h4 className="font-medium text-gray-700 mb-3">Agregar Nuevo Horario</h4>
            <div className="grid grid-cols-2 gap-3">
              <Input
                type="text"
                placeholder="09:00"
                value={newTimeSlot.time}
                onChange={(e) => setNewTimeSlot({ ...newTimeSlot, time: e.target.value })}
              />
              <Input
                type="text"
                placeholder="09:00 hrs"
                value={newTimeSlot.label}
                onChange={(e) => setNewTimeSlot({ ...newTimeSlot, label: e.target.value })}
              />
            </div>
            <div className="flex items-center gap-3 mt-3">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={newTimeSlot.recommended}
                  onChange={(e) => setNewTimeSlot({ ...newTimeSlot, recommended: e.target.checked })}
                  className="rounded border-gray-300"
                />
                <span className="text-sm text-gray-700">Recomendado</span>
              </label>
              <Button onClick={addTimeSlot} size="sm">
                <CheckCircle className="w-4 h-4 mr-1" />
                Agregar
              </Button>
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
                Los nuevos horarios se aplicarán inmediatamente al calendario de reservas.
                Los clientes solo podrán reservar en los días y horarios configurados.
              </p>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <p className="text-sm text-yellow-800">
                  <strong>⚠️ Advertencia:</strong> Cambiar los horarios puede afectar la disponibilidad 
                  para reservas existentes. Revisa que la configuración sea correcta.
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
