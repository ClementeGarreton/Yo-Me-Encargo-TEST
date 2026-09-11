import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { aggregateAttendedCustomers } from '@/lib/adminAnalytics'

// Cartera de clientes atendidos = reservas completadas O pagadas al 100%,
// agrupadas por email (ver isAttendedBooking en adminAnalytics.ts).
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const { data: bookings, error } = await supabaseAdmin
      .from('bookings')
      .select(
        'client_email, client_name, client_phone, is_company, company_name, company_rut, scheduled_date, status, total_price, original_price, payment_status, payment_type'
      )
      .neq('status', 'cancelled')
      .or('status.eq.completed,and(payment_status.eq.approved,payment_type.eq.completo)')

    if (error) {
      console.error('[customers/attended] error:', error)
      return NextResponse.json(
        { error: 'Error obteniendo clientes atendidos' },
        { status: 500 }
      )
    }

    const customers = aggregateAttendedCustomers(bookings || [])

    // Enriquecer con "cliente frecuente" (vive en quote_prospects, por email).
    const { data: frequentRows } = await supabaseAdmin
      .from('quote_prospects')
      .select('email')
      .eq('is_frequent', true)

    const frequentSet = new Set(
      (frequentRows || []).map((r) => (r.email || '').trim().toLowerCase())
    )

    const enriched = customers.map((c) => ({
      ...c,
      isFrequent: frequentSet.has(c.email),
    }))

    return NextResponse.json(enriched)
  } catch (error) {
    console.error('Error in /api/admin/customers/attended:', error)
    return NextResponse.json(
      { error: 'Error obteniendo clientes atendidos' },
      { status: 500 }
    )
  }
}
