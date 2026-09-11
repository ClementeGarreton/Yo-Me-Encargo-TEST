import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getActiveCapacity } from '@/lib/fleetCapacity'
import { summarizeBookings, summarizeOutstandingQuotes } from '@/lib/revenueBreakdown'

// Lee datos en vivo: no debe prerenderizarse/cachearse en build.
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    console.log('[API] Fetching admin stats...')
    
    // Obtener estadísticas del dashboard
    const today = new Date().toISOString().split('T')[0]
    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]
    const endOfMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split('T')[0]

    // 1. Reservas de hoy
    const { count: todayBookings, error: todayError } = await supabaseAdmin
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .eq('scheduled_date', today)
      .in('status', ['confirmed', 'pending'])

    if (todayError) {
      console.error('[API] Error fetching today bookings:', todayError)
    }

    // 2. Reservas pendientes
    const { count: pendingBookings, error: pendingError } = await supabaseAdmin
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending')

    if (pendingError) {
      console.error('[API] Error fetching pending bookings:', pendingError)
    }

    // 3. Configuración de flota
    const { data: fleetConfig, error: fleetError } = await supabaseAdmin
      .from('fleet_config')
      .select('*')
      .single()

    if (fleetError) {
      console.error('[API] Error fetching fleet config:', fleetError)
    }

    // 4. Ingresos del mes, separados en COBRADO y POR COBRAR.
    //    Ojo: no se suma total_price directamente porque cambió de significado en
    //    julio-2026 (ver comentario en revenueBreakdown.ts). El monto cobrado se deriva
    //    del precio del servicio según la modalidad de pago (mitad 50% / completo 95%).
    const { data: monthlyBookings, error: monthlyError } = await supabaseAdmin
      .from('bookings')
      .select(
        'id, original_price, total_price, payment_type, payment_status, status, is_provisional, flow_token, payment_method'
      )
      .gte('scheduled_date', startOfMonth)
      .lte('scheduled_date', endOfMonth)
      .neq('status', 'cancelled')

    if (monthlyError) {
      console.error('[API] Error fetching monthly bookings:', monthlyError)
    }

    const revenue = summarizeBookings(monthlyBookings || [])
    // Se mantiene `monthlyRevenue` por compatibilidad: ahora es la plata realmente
    // recibida, no el valor nominal de las reservas.
    const monthlyRevenue = revenue.paid

    // 4b. Cotizaciones vigentes sin reserva: la mudanza todavía no ocurrió y el lead
    //     sigue abierto. Es plata que aún se puede cerrar.
    const todayChile = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Santiago',
    }).format(new Date())

    const { data: openProspects } = await supabaseAdmin
      .from('quote_prospects')
      .select('status, total_price, adjusted_price, scheduled_date, converted_booking_id')
      .gte('scheduled_date', todayChile)

    const quotes = summarizeOutstandingQuotes(openProspects || [], todayChile)

    // 5. Ocupación del mes = reservas del mes / cupos reales.
    //    Cupos = vehículos ACTIVOS * franjas horarias configuradas * días del mes
    //    (antes era un 6*30 hardcodeado que ignoraba flota y horarios reales).
    const { data: scheduleConfig } = await supabaseAdmin
      .from('schedule_config')
      .select('time_slots')
      .single()

    const slotsPerDay = Array.isArray(scheduleConfig?.time_slots)
      ? scheduleConfig!.time_slots.length
      : 6
    const activeVehicles = getActiveCapacity(fleetConfig)
    const now = new Date()
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()

    const totalSlots = Math.max(1, activeVehicles * slotsPerDay * daysInMonth)
    const occupiedSlots = monthlyBookings?.length || 0
    const occupancyRate = Math.min(100, Math.round((occupiedSlots / totalSlots) * 100))

    // 6. Ticket promedio
    // Ticket promedio sobre el valor de lo reservado (no sobre lo ya cobrado).
    const averageTicket = occupiedSlots > 0 ? Math.round(revenue.booked / occupiedSlots) : 0

    const stats = {
      todayBookings: todayBookings || 0,
      monthlyRevenue,
      pendingBookings: pendingBookings || 0,
      totalVehicles: fleetConfig?.num_vehicles,
      occupancyRate,
      averageTicket,
      // Desglose de ingresos del mes
      revenue: {
        paid: revenue.paid,
        paidCount: revenue.paidCount,
        paidByChannel: revenue.paidByChannel,
        pending: revenue.pending,
        pendingCount: revenue.pendingCount,
        booked: revenue.booked,
      },
      outstandingQuotes: {
        total: quotes.total,
        count: quotes.count,
      },
    }

    console.log('[API] Stats fetched successfully:', stats)
    return NextResponse.json(stats)
  } catch (error) {
    console.error('[API] Exception in /api/admin/stats:', error)
    return NextResponse.json(
      { error: 'Error obteniendo estadísticas', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
