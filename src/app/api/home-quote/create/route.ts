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
      booking_type = 'domicilio',
      visit_address,
      total_price,
      original_price,
      scheduled_date,
      scheduled_time,
      duration_hours = 1,
    } = body

    // Validar datos requeridos
    if (
      !quote_id ||
      !client_name ||
      !client_email ||
      !client_phone ||
      !visit_address ||
      !total_price
    ) {
      return NextResponse.json(
        { error: 'Datos incompletos' },
        { status: 400 }
      )
    }

    // Atribucion de Google Ads: la del cliente o, si no trae, la heredada del prospecto
    // con el mismo quote_id.
    const attribution = await resolveBookingAttribution(body, quote_id)

    // Crear la reserva de tipo domicilio
    const { data: booking, error: createError } = await supabaseAdmin
      .from('bookings')
      .insert({
        quote_id,
        client_name,
        client_email,
        client_phone,
        booking_type,
        visit_address,
        total_price,
        original_price: original_price || total_price,
        status: 'pending',
        payment_status: 'pending',
        // Campos dummy para compatibilidad con la estructura actual
        scheduled_date: scheduled_date || new Date().toISOString().split('T')[0],
        scheduled_time: scheduled_time || '09:00',
        duration_hours: duration_hours || 1,
        ...attribution,
      })
      .select()
      .single()

    if (createError) {
      console.error('Error creating home quote booking:', createError)
      return NextResponse.json(
        { error: 'Error al crear la reserva de cotización a domicilio' },
        { status: 500 }
      )
    }

    return NextResponse.json(
      {
        success: true,
        booking,
        message: 'Reserva de cotización a domicilio creada exitosamente',
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Error in /api/home-quote/create:', error)
    return NextResponse.json(
      { error: 'Error al crear la reserva de cotización a domicilio' },
      { status: 500 }
    )
  }
}
