import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { resolveBookingAttribution } from '@/lib/attributionServer'

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
      payment_type,
      total_price,
      original_price,
      origin_address,
      destination_address,
      payment_status = 'pending',
      is_company = false,
      company_name,
      company_rut,
      photo_urls = [],
    } = body

    // Validar datos
    if (
      !quote_id ||
      !client_name ||
      !client_email ||
      !client_phone ||
      !scheduled_date ||
      !scheduled_time
    ) {
      return NextResponse.json(
        { error: 'Datos incompletos' },
        { status: 400 }
      )
    }

    // Verificar que el horario sigue disponible (evitar race conditions)
    const { data: configData, error: configError } = await supabaseAdmin
      .from('fleet_config')
      .select('num_vehicles')
      .single()

    if (configError || !configData) {
      return NextResponse.json(
        { error: 'Error obteniendo configuración de flota' },
        { status: 500 }
      )
    }

    const capacity = configData.num_vehicles

    // Contar mudanzas en este horario
    const { count: bookingCount } = await supabaseAdmin
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .eq('scheduled_date', scheduled_date)
      .eq('scheduled_time', scheduled_time)
      .in('status', ['confirmed', 'pending'])

    // Verificar bloque
    const { data: blockedData } = await supabaseAdmin
      .from('blocked_slots')
      .select('id')
      .eq('date', scheduled_date)
      .lte('start_time', scheduled_time)
      .gt('end_time', scheduled_time)

    const activeBookings = bookingCount || 0
    const availableSlots = capacity - activeBookings
    const isBlocked = blockedData && blockedData.length > 0

    if (availableSlots <= 0 || isBlocked) {
      return NextResponse.json(
        { error: 'Este horario ya no está disponible' },
        { status: 409 }
      )
    }

    // Atribucion de Google Ads: la del cliente o, si no trae, la heredada del prospecto
    // con el mismo quote_id.
    const attribution = await resolveBookingAttribution(body, quote_id)

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
        status: 'pending',
        payment_type,
        payment_status,
        total_price,
        original_price,
        origin_address,
        destination_address,
        is_company,
        company_name: is_company ? company_name : null,
        company_rut: is_company ? company_rut : null,
        photo_urls: Array.isArray(photo_urls) && photo_urls.length > 0 ? photo_urls : [],
        ...attribution,
      })
      .select()
      .single()

    if (createError) {
      console.error('Error creating booking:', createError)
      return NextResponse.json(
        { error: 'Error al crear la reserva' },
        { status: 500 }
      )
    }

    // TODO: Aquí irían las notificaciones
    // - Enviar email al cliente
    // - Enviar WhatsApp al cliente
    // - Enviar notificación al dueño
    // - Sincronizar con Google Calendar

    return NextResponse.json(
      {
        success: true,
        booking,
        message: 'Reserva creada exitosamente',
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Error in /api/bookings/create:', error)
    return NextResponse.json(
      { error: 'Error al crear la reserva' },
      { status: 500 }
    )
  }
}
