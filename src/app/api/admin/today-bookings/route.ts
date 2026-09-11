import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// Lee datos en vivo: no debe prerenderizarse/cachearse en build.
export const dynamic = 'force-dynamic'

// "Hoy" en hora de Chile: el server (Vercel) corre en UTC, así que un new Date() naive
// puede caer en el día siguiente durante la noche chilena y desalinear todo el rango.
function chileTodayString(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago' }).format(new Date())
}

function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  date.setDate(date.getDate() + days)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

// Devuelve las reservas REALES (pagadas/confirmadas, no provisionales, no canceladas) de
// hoy hasta 6 días adelante, para los widgets "Hoy" / "Mañana" / "Esta semana" del dashboard.
export async function GET() {
  try {
    const today = chileTodayString()
    const weekEnd = addDays(today, 6)
    console.log(`[API] Fetching bookings from ${today} to ${weekEnd}`)

    const { data: bookings, error } = await supabaseAdmin
      .from('bookings')
      .select(`
        id,
        quote_id,
        client_name,
        client_phone,
        scheduled_date,
        scheduled_time,
        status,
        total_price,
        original_price
      `)
      .gte('scheduled_date', today)
      .lte('scheduled_date', weekEnd)
      .eq('is_provisional', false)
      .not('status', 'in', '(cancelled,no_show)')
      .order('scheduled_date', { ascending: true })
      .order('scheduled_time', { ascending: true })

    if (error) {
      console.error('[API] Error fetching upcoming bookings:', {
        error: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint
      })
      return NextResponse.json(
        { error: 'Error obteniendo reservas', details: error.message },
        { status: 500 }
      )
    }

    console.log(`[API] Successfully fetched ${bookings?.length || 0} upcoming bookings`)

    const result = (bookings || []).map((booking) => ({
      ...booking,
      estimated_price: booking.original_price ?? booking.total_price ?? null,
    }))

    return NextResponse.json(result)
  } catch (error) {
    console.error('[API] Exception in /api/admin/today-bookings:', error)
    return NextResponse.json(
      { error: 'Error obteniendo reservas', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
