import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getActiveCapacity } from '@/lib/fleetCapacity'

// Marcar esta ruta como dinámica porque usa searchParams
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const date = request.nextUrl.searchParams.get('date')

    if (!date) {
      return NextResponse.json(
        { error: 'Fecha requerida' },
        { status: 400 }
      )
    }

    // 1. Obtener capacidad de vehículos (vehículos activos, no total).
    // select('*') para ser resiliente si la columna `vehicles` aún no existe
    // (migración add_fleet_vehicles.sql no aplicada todavía).
    const { data: configData, error: configError } = await supabaseAdmin
      .from('fleet_config')
      .select('*')
      .single()

    if (configError) {
      console.error('Error fetching fleet config:', configError)
      return NextResponse.json(
        { error: 'Error obteniendo configuración de flota' },
        { status: 500 }
      )
    }

    if (!configData) {
      return NextResponse.json(
        { error: 'Configuración de flota no encontrada' },
        { status: 404 }
      )
    }

    const capacity = getActiveCapacity(configData)

    // 2. Obtener horarios configurados desde schedule_config
    const { data: scheduleConfig, error: scheduleError } = await supabaseAdmin
      .from('schedule_config')
      .select('time_slots')
      .single()

    // Si no existe configuración, usar horarios por defecto
    const defaultSlots = [
      { time: '08:00', label: '08:00 hrs', recommended: true },
      { time: '09:00', label: '09:00 hrs', recommended: true },
      { time: '10:00', label: '10:00 hrs', recommended: true },
      { time: '11:00', label: '11:00 hrs', recommended: false },
      { time: '14:00', label: '14:00 hrs', recommended: true },
      { time: '15:00', label: '15:00 hrs', recommended: false }
    ]
    
    let timeSlotsWithMetadata = defaultSlots
    
    if (scheduleConfig && scheduleConfig.time_slots && Array.isArray(scheduleConfig.time_slots)) {
      timeSlotsWithMetadata = scheduleConfig.time_slots
    }

    // 3. Para cada horario, contar reservas y bloques
    const availability = await Promise.all(
      timeSlotsWithMetadata.map(async (slot) => {
        const time = slot.time
        const label = slot.label
        const recommended = slot.recommended || false
        
        // Contar mudanzas confirmadas y pendientes
        const { count: bookingCount, error: bookingError } = await supabaseAdmin
          .from('bookings')
          .select('id', { count: 'exact', head: true })
          .eq('scheduled_date', date)
          .eq('scheduled_time', time)
          .in('status', ['confirmed', 'pending'])

        // Verificar si está bloqueado
        const { data: blockedData, error: blockedError } = await supabaseAdmin
          .from('blocked_slots')
          .select('id')
          .eq('date', date)
          .lte('start_time', time)
          .gt('end_time', time)

        const isBlocked = blockedData && blockedData.length > 0
        const activeBookings = bookingCount || 0
        const availableSlots = capacity - activeBookings
        const isAvailable = availableSlots > 0 && !isBlocked

        return {
          time,
          label,
          recommended,
          availableSlots: Math.max(0, availableSlots),
          capacity,
          booked: activeBookings,
          isBlocked,
          isAvailable,
          occupancy: `${activeBookings}/${capacity}`,
        }
      })
    )

    // Filtrar solo los disponibles (no mostrar llenos)
    const availableOnly = availability.filter(slot => slot.isAvailable)

    return NextResponse.json(availableOnly)
  } catch (error) {
    console.error('Error in /api/bookings/available:', error)
    return NextResponse.json(
      { error: 'Error obteniendo disponibilidad' },
      { status: 500 }
    )
  }
}
