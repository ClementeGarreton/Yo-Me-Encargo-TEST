/**
 * SERVICIO DE CONFIGURACIÓN DE HORARIOS
 * 
 * Este servicio obtiene la configuración de horarios desde la base de datos
 * y la convierte al formato esperado por el sistema de reservas.
 */

export interface TimeSlot {
  time: string
  label: string
  recommended: boolean
}

export interface ScheduleConfig {
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

// Cache para evitar múltiples llamadas
let scheduleCache: ScheduleConfig | null = null
let cacheTimestamp: number = 0
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutos

export async function getScheduleConfig(): Promise<ScheduleConfig> {
  // Verificar cache
  const now = Date.now()
  if (scheduleCache && (now - cacheTimestamp) < CACHE_DURATION) {
    return scheduleCache
  }

  try {
    const response = await fetch('/api/admin/schedule-config')
    if (!response.ok) {
      throw new Error('Error obteniendo configuración de horarios')
    }
    
    const config = await response.json()
    
    // Actualizar cache
    scheduleCache = config
    cacheTimestamp = now
    
    return config
  } catch (error) {
    console.error('Error fetching schedule config:', error)
    
    // Devolver configuración por defecto si falla
    return {
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
    }
  }
}

// Función para limpiar cache (útil cuando se actualiza la configuración)
export function clearScheduleCache() {
  scheduleCache = null
  cacheTimestamp = 0
}
