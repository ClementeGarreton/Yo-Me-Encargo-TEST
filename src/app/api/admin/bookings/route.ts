import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { mergeBookingQuoteDetails } from '@/lib/adminBookingQuoteData'
import { getActiveCapacity } from '@/lib/fleetCapacity'
import { getActorFromRequest, logAdminAction } from '@/lib/activityLog'

const PROSPECT_QUOTE_FIELDS = `
  id,
  quote_id,
  email,
  source,
  status,
  is_frequent,
  scheduled_date,
  scheduled_time,
  converted_booking_id,
  is_flexible,
  recommended_vehicle,
  total_volume,
  total_weight,
  total_distance,
  origin_floor,
  origin_has_elevator,
  origin_parking_distance,
  destination_floor,
  destination_has_elevator,
  destination_parking_distance,
  items_summary,
  additional_services,
  created_at
`

async function fetchProspectQuoteDetails(bookings: any[]) {
  if (bookings.length === 0) return []

  const bookingIds = [...new Set(bookings.map((b) => b.id).filter(Boolean))]
  const quoteIds = [...new Set(bookings.map((b) => b.quote_id).filter(Boolean))]
  const emails = [
    ...new Set(
      bookings
        .map((b) => (typeof b.client_email === 'string' ? b.client_email.toLowerCase().trim() : ''))
        .filter(Boolean)
    ),
  ]

  const queries = []

  if (bookingIds.length > 0) {
    queries.push(
      supabaseAdmin
        .from('quote_prospects')
        .select(PROSPECT_QUOTE_FIELDS)
        .in('converted_booking_id', bookingIds)
        .order('created_at', { ascending: false })
    )
  }

  if (quoteIds.length > 0) {
    queries.push(
      supabaseAdmin
        .from('quote_prospects')
        .select(PROSPECT_QUOTE_FIELDS)
        .in('quote_id', quoteIds)
        .order('created_at', { ascending: false })
    )
  }

  if (emails.length > 0) {
    queries.push(
      supabaseAdmin
        .from('quote_prospects')
        .select(PROSPECT_QUOTE_FIELDS)
        .in('email', emails)
        .order('created_at', { ascending: false })
    )
  }

  const results = await Promise.all(queries)
  const byId = new Map<string, any>()

  results.forEach(({ data, error }) => {
    if (error) {
      console.error('[API] Error fetching booking quote details:', {
        error: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      })
      return
    }

    const rows = data || []
    rows.forEach((row: any) => {
      if (row.id && !byId.has(row.id)) {
        byId.set(row.id, row)
      }
    })
  })

  return [...byId.values()]
}

export async function GET() {
  try {
    console.log('[API] Fetching bookings from database...')
    
    // Obtener todas las reservas con paginación
    // EXCLUIR reservas canceladas (pagos rechazados)
    const { data: bookings, error } = await supabaseAdmin
      .from('bookings')
      .select(`
        id,
        quote_id,
        client_name,
        client_email,
        client_phone,
        scheduled_date,
        scheduled_time,
        duration_hours,
        status,
        notes,
        payment_type,
        payment_status,
        is_provisional,
        total_price,
        original_price,
        origin_address,
        destination_address,
        origin_floor,
        origin_has_elevator,
        origin_parking_distance,
        destination_floor,
        destination_has_elevator,
        destination_parking_distance,
        is_company,
        company_name,
        company_rut,
        pdf_url,
        pdf_generated_at,
        photo_urls,
        booking_type,
        visit_address,
        service_completed_at,
        created_at,
        confirmed_at,
        completed_at,
        cancelled_at
      `)
      .neq('status', 'cancelled') // NO mostrar reservas canceladas (pagos rechazados)
      .order('created_at', { ascending: false }) // Más recientes primero

    if (error) {
      console.error('[API] Error fetching bookings:', {
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

    const bookingRows = bookings || []
    const prospects = await fetchProspectQuoteDetails(bookingRows)
    const enrichedBookings = mergeBookingQuoteDetails(bookingRows, prospects)

    console.log(`[API] Successfully fetched ${enrichedBookings.length} bookings`)
    return NextResponse.json(enrichedBookings)
  } catch (error) {
    console.error('[API] Exception in /api/admin/bookings:', error)
    return NextResponse.json(
      { error: 'Error obteniendo reservas', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      quote_id,
      client_name,
      client_email,
      client_phone,
      scheduled_date,
      scheduled_time,
      duration_hours = 4,
      status = 'pending',
      payment_type,
      // Cómo se cobra: 'flow' (link de pago), 'transfer' (transferencia) o 'cash'
      // (efectivo). Para 'flow' el estado lo confirma después el webhook de Flow.
      payment_method,
      payment_status,
      total_price,
      original_price,
      origin_address,
      destination_address,
      notes,
      is_company = false,
      company_name,
      company_rut,
    } = body

    if (!client_name || !client_email || !client_phone || !scheduled_date || !scheduled_time) {
      return NextResponse.json(
        { error: 'Datos incompletos' },
        { status: 400 }
      )
    }

    // Obtener capacidad de flota (vehículos activos, no total)
    const { data: configData, error: configError } = await supabaseAdmin
      .from('fleet_config')
      .select('*')
      .single()

    if (configError || !configData) {
      return NextResponse.json(
        { error: 'Error obteniendo configuración de flota' },
        { status: 500 }
      )
    }

    const capacity = getActiveCapacity(configData)

    // Contar reservas activas para ese horario
    const { count: bookingCount } = await supabaseAdmin
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .eq('scheduled_date', scheduled_date)
      .eq('scheduled_time', scheduled_time)
      .in('status', ['confirmed', 'pending'])

    // Verificar bloqueos
    const { data: blockedData } = await supabaseAdmin
      .from('blocked_slots')
      .select('id')
      .eq('date', scheduled_date)
      .lte('start_time', scheduled_time)
      .gt('end_time', scheduled_time)

    const activeBookings = bookingCount || 0
    const availableSlots = (capacity || 0) - activeBookings
    const isBlocked = !!(blockedData && blockedData.length > 0)

    if (availableSlots <= 0 || isBlocked) {
      return NextResponse.json(
        { error: 'Este horario ya no está disponible' },
        { status: 409 }
      )
    }

    // Crear la reserva
    const { data: booking, error: createError } = await supabaseAdmin
      .from('bookings')
      .insert({
        quote_id,
        client_name,
        client_email,
        client_phone,
        scheduled_date,
        scheduled_time,
        duration_hours,
        status,
        payment_type,
        payment_method: payment_method || null,
        payment_status: payment_status || 'pending',
        total_price,
        original_price,
        origin_address,
        destination_address,
        notes,
        is_company,
        company_name: is_company ? company_name : null,
        company_rut: is_company ? company_rut : null,
      })
      .select()
      .single()

    if (createError) {
      console.error('[API] Error creating booking:', createError)
      return NextResponse.json(
        { error: 'Error al crear la reserva' },
        { status: 500 }
      )
    }

    const methodLabels: Record<string, string> = {
      flow: 'link de pago',
      transfer: 'transferencia',
      cash: 'efectivo',
    }
    await logAdminAction({
      actor: getActorFromRequest(request),
      action: 'booking.created',
      entityType: 'booking',
      entityId: booking.id,
      entityLabel: [booking.client_name, booking.scheduled_date].filter(Boolean).join(' · '),
      summary: `Creó una reserva manual para ${booking.scheduled_date} ${String(
        booking.scheduled_time || ''
      ).slice(0, 5)}${
        payment_method ? ` (cobro: ${methodLabels[payment_method] || payment_method})` : ''
      }`,
      changes: {
        created: {
          from: null,
          to: {
            quote_id: booking.quote_id,
            client_name: booking.client_name,
            scheduled_date: booking.scheduled_date,
            scheduled_time: booking.scheduled_time,
            total_price: booking.total_price,
            payment_method: booking.payment_method,
            status: booking.status,
          },
        },
      },
      request,
    })

    return NextResponse.json(
      {
        success: true,
        booking,
        message: 'Reserva creada exitosamente',
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('[API] Exception in /api/admin/bookings POST:', error)
    return NextResponse.json(
      { error: 'Error al crear la reserva' },
      { status: 500 }
    )
  }
}
