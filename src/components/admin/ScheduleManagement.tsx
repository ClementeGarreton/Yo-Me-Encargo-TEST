'use client'

import { useState, useEffect } from 'react'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import Modal from '@/components/ui/Modal'
import { 
  Calendar, 
  Clock, 
  Plus, 
  Trash2, 
  AlertCircle, 
  Save,
  X,
  Edit
} from 'lucide-react'
import { format, addDays, startOfDay, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, isToday, isPast } from 'date-fns'
import { es } from 'date-fns/locale'
import toast from 'react-hot-toast'

// Función para formatear fechas sin problemas de zona horaria
const formatDateSafe = (dateString: string) => {
  // Parsear la fecha como local (no UTC)
  const [year, month, day] = dateString.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  return format(date, 'dd/MM/yyyy', { locale: es })
}

// Componente de calendario personalizado
const DatePickerCalendar = ({ 
  selectedDate, 
  onDateSelect, 
  onClose 
}: { 
  selectedDate: string
  onDateSelect: (date: string) => void
  onClose: () => void 
}) => {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  
  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  
  // Calcular el primer día del calendario (puede ser del mes anterior)
  const startDate = new Date(monthStart)
  const firstDayOfWeek = (monthStart.getDay() + 6) % 7 // Convertir domingo=0 a lunes=0
  startDate.setDate(startDate.getDate() - firstDayOfWeek)
  
  // Calcular el último día del calendario (puede ser del mes siguiente)
  const endDate = new Date(monthEnd)
  const lastDayOfWeek = (monthEnd.getDay() + 6) % 7 // Convertir domingo=0 a lunes=0
  endDate.setDate(endDate.getDate() + (6 - lastDayOfWeek))
  
  // Generar todos los días del calendario
  const calendarDays = []
  const currentDate = new Date(startDate)
  
  while (currentDate <= endDate) {
    calendarDays.push(new Date(currentDate))
    currentDate.setDate(currentDate.getDate() + 1)
  }
  
  const today = new Date()
  
  const handleDateClick = (date: Date) => {
    if (isPast(date) && !isToday(date)) return // No permitir fechas pasadas
    
    const dateString = format(date, 'yyyy-MM-dd')
    onDateSelect(dateString)
    onClose()
  }
  
  const goToPreviousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))
  }
  
  const goToNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))
  }
  
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-4 w-80">
      {/* Header del calendario */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={goToPreviousMonth}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          ←
        </button>
        <h3 className="text-lg font-semibold text-gray-900">
          {format(currentMonth, 'MMMM yyyy', { locale: es })}
        </h3>
        <button
          onClick={goToNextMonth}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          →
        </button>
      </div>
      
      {/* Días de la semana */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((day) => (
          <div key={day} className="text-center text-sm font-medium text-gray-500 p-2">
            {day}
          </div>
        ))}
      </div>
      
      {/* Días del calendario */}
      <div className="grid grid-cols-7 gap-1">
        {calendarDays.map((date) => {
          const isSelected = selectedDate === format(date, 'yyyy-MM-dd')
          const isPastDate = isPast(date) && !isToday(date)
          const isTodayDate = isToday(date)
          const isCurrentMonth = date.getMonth() === currentMonth.getMonth()
          
          return (
            <button
              key={date.toISOString()}
              onClick={() => handleDateClick(date)}
              disabled={isPastDate}
              className={`
                p-2 text-sm rounded-lg transition-colors
                ${isSelected 
                  ? 'bg-primary-600 text-white font-semibold' 
                  : isTodayDate
                  ? 'bg-blue-100 text-blue-700 font-semibold'
                  : isPastDate
                  ? 'text-gray-300 cursor-not-allowed'
                  : !isCurrentMonth
                  ? 'text-gray-400 hover:bg-gray-50'
                  : 'hover:bg-gray-100 text-gray-700'
                }
              `}
            >
              {format(date, 'd')}
            </button>
          )
        })}
      </div>
      
      {/* Botón cerrar */}
      <div className="mt-4 pt-4 border-t">
        <button
          onClick={onClose}
          className="w-full py-2 px-4 text-gray-600 hover:text-gray-800 transition-colors"
        >
          Cerrar
        </button>
      </div>
    </div>
  )
}

interface BlockedSlot {
  id: string
  date: string
  start_time: string
  end_time: string
  reason: string
  google_event_id?: string
  sync_from_calendar: boolean
  created_at: string
}

export default function ScheduleManagement() {
  const [blockedSlots, setBlockedSlots] = useState<BlockedSlot[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showCalendar, setShowCalendar] = useState(false)
  const [selectedSlot, setSelectedSlot] = useState<BlockedSlot | null>(null)
  const [newSlot, setNewSlot] = useState({
    date: '',
    start_time: '',
    end_time: '',
    reason: '',
    sync_from_calendar: false
  })

  const timeSlots = [
    '08:00', '09:00', '10:00', '11:00', '12:00',
    '13:00', '14:00', '15:00', '16:00', '17:00'
  ]

  useEffect(() => {
    fetchBlockedSlots()
  }, [])

  const fetchBlockedSlots = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/admin/blocked-slots')
      const data = await response.json()
      setBlockedSlots(data)
    } catch (error) {
      console.error('Error fetching blocked slots:', error)
      toast.error('Error al cargar horarios bloqueados')
    } finally {
      setLoading(false)
    }
  }

  const addBlockedSlot = async () => {
    if (!newSlot.date || !newSlot.start_time || !newSlot.end_time || !newSlot.reason) {
      toast.error('Todos los campos son requeridos')
      return
    }

    if (newSlot.start_time >= newSlot.end_time) {
      toast.error('La hora de fin debe ser mayor a la hora de inicio')
      return
    }

    try {
      const response = await fetch('/api/admin/blocked-slots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSlot)
      })

      if (!response.ok) {
        throw new Error('Error al crear el bloqueo')
      }

      toast.success('Horario bloqueado correctamente')
      setShowAddModal(false)
      setNewSlot({ date: '', start_time: '', end_time: '', reason: '', sync_from_calendar: false })
      fetchBlockedSlots()
    } catch (error) {
      console.error('Error adding blocked slot:', error)
      toast.error('Error al bloquear el horario')
    }
  }

  const editBlockedSlot = async () => {
    if (!selectedSlot) return

    if (!selectedSlot.date || !selectedSlot.start_time || !selectedSlot.end_time || !selectedSlot.reason) {
      toast.error('Todos los campos son requeridos')
      return
    }

    if (selectedSlot.start_time >= selectedSlot.end_time) {
      toast.error('La hora de fin debe ser mayor a la hora de inicio')
      return
    }

    try {
      const response = await fetch(`/api/admin/blocked-slots/${selectedSlot.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: selectedSlot.date,
          start_time: selectedSlot.start_time,
          end_time: selectedSlot.end_time,
          reason: selectedSlot.reason
        })
      })

      if (!response.ok) {
        throw new Error('Error al actualizar el bloqueo')
      }

      toast.success('Bloqueo actualizado correctamente')
      setShowEditModal(false)
      fetchBlockedSlots()
    } catch (error) {
      console.error('Error updating blocked slot:', error)
      toast.error('Error al actualizar el bloqueo')
    }
  }

  const deleteBlockedSlot = async (id: string) => {
    if (!confirm('¿Estás seguro de que quieres eliminar este bloqueo?')) {
      return
    }

    try {
      const response = await fetch(`/api/admin/blocked-slots/${id}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        throw new Error('Error al eliminar el bloqueo')
      }

      toast.success('Bloqueo eliminado correctamente')
      fetchBlockedSlots()
    } catch (error) {
      console.error('Error deleting blocked slot:', error)
      toast.error('Error al eliminar el bloqueo')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando horarios bloqueados...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Gestión de Horarios</h2>
          <p className="text-gray-600">Bloquea horarios no disponibles</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={fetchBlockedSlots} variant="outline" size="sm">
            🔄 Actualizar
          </Button>
          <Button onClick={() => setShowAddModal(true)} size="sm">
            <Plus className="w-4 h-4 mr-2" />
            Bloquear Horario
          </Button>
        </div>
      </div>

      {/* Info Card */}
      <Card className="p-4 bg-blue-50 border-blue-200">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
          <div className="text-sm text-blue-800">
            <p className="font-semibold mb-1">💡 Cómo funciona:</p>
            <p>
              Los horarios bloqueados no aparecerán como disponibles para los clientes. 
              Útil para días festivos, mantenimiento, o cuando ya tienes otros compromisos.
            </p>
          </div>
        </div>
      </Card>

      {/* Blocked Slots List */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Horarios Bloqueados ({blockedSlots.length})
        </h3>

        {blockedSlots.length === 0 ? (
          <div className="text-center py-8">
            <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 mb-4">No hay horarios bloqueados</p>
            <Button onClick={() => setShowAddModal(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Bloquear Primer Horario
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {blockedSlots.map((slot) => (
              <div
                key={slot.id}
                className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
              >
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-gray-600" />
                    <span className="font-semibold text-gray-900">
                      {formatDateSafe(slot.date)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-gray-600" />
                    <span className="text-gray-700">
                      {slot.start_time} - {slot.end_time}
                    </span>
                  </div>
                  <div className="text-sm text-gray-600">
                    {slot.reason}
                  </div>
                  {slot.sync_from_calendar && (
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                      📅 Google Calendar
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    onClick={() => {
                      setSelectedSlot(slot)
                      setShowEditModal(true)
                    }}
                    variant="outline"
                    size="sm"
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    onClick={() => deleteBlockedSlot(slot.id)}
                    variant="outline"
                    size="sm"
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Add Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Bloquear Horario"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fecha
            </label>
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowCalendar(true)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-left bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                {newSlot.date ? formatDateSafe(newSlot.date) : 'Seleccionar fecha...'}
              </button>
              <Calendar className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Hora de Inicio
              </label>
              <Select
                value={newSlot.start_time}
                onChange={(e) => setNewSlot({ ...newSlot, start_time: e.target.value })}
                options={timeSlots.map(time => ({
                  value: time,
                  label: `${time}:00`
                }))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Hora de Fin
              </label>
              <Select
                value={newSlot.end_time}
                onChange={(e) => setNewSlot({ ...newSlot, end_time: e.target.value })}
                options={timeSlots.map(time => ({
                  value: time,
                  label: `${time}:00`
                }))}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Motivo del Bloqueo
            </label>
            <Input
              type="text"
              value={newSlot.reason}
              onChange={(e) => setNewSlot({ ...newSlot, reason: e.target.value })}
              placeholder="Ej: Mantenimiento, Día festivo, Compromiso personal..."
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="sync-calendar"
              checked={newSlot.sync_from_calendar}
              onChange={(e) => setNewSlot({ ...newSlot, sync_from_calendar: e.target.checked })}
              className="rounded border-gray-300"
            />
            <label htmlFor="sync-calendar" className="text-sm text-gray-700">
              Sincronizar con Google Calendar
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              onClick={() => setShowAddModal(false)}
              variant="outline"
            >
              Cancelar
            </Button>
            <Button onClick={addBlockedSlot}>
              <Save className="w-4 h-4 mr-2" />
              Bloquear Horario
            </Button>
          </div>
        </div>
      </Modal>

      {/* Calendar Overlay */}
      {showCalendar && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="relative">
            <DatePickerCalendar
              selectedDate={newSlot.date}
              onDateSelect={(date) => {
                setNewSlot({ ...newSlot, date })
                setShowCalendar(false)
              }}
              onClose={() => setShowCalendar(false)}
            />
          </div>
        </div>
      )}

      {/* Edit Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        title="Editar Bloqueo de Horario"
      >
        {selectedSlot && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Fecha
              </label>
              <Input
                type="date"
                value={selectedSlot.date}
                onChange={(e) => setSelectedSlot({ ...selectedSlot, date: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Hora de Inicio
                </label>
                <Select
                  value={selectedSlot.start_time}
                  onChange={(e) => setSelectedSlot({ ...selectedSlot, start_time: e.target.value })}
                  options={timeSlots.map(time => ({
                    value: time,
                    label: `${time}:00`
                  }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Hora de Fin
                </label>
                <Select
                  value={selectedSlot.end_time}
                  onChange={(e) => setSelectedSlot({ ...selectedSlot, end_time: e.target.value })}
                  options={timeSlots.map(time => ({
                    value: time,
                    label: `${time}:00`
                  }))}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Motivo del Bloqueo
              </label>
              <Input
                type="text"
                value={selectedSlot.reason}
                onChange={(e) => setSelectedSlot({ ...selectedSlot, reason: e.target.value })}
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button
                onClick={() => setShowEditModal(false)}
                variant="outline"
              >
                Cancelar
              </Button>
              <Button onClick={editBlockedSlot}>
                <Save className="w-4 h-4 mr-2" />
                Guardar Cambios
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
