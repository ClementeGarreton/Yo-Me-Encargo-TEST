import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { flowService } from '@/lib/flowService'
import {
  ensureProvisionalBooking,
  createQuoteFlowOrder,
  computeQuoteAmounts,
  SlotUnavailableError,
} from '@/lib/quoteCheckout'
import { resolveBookingAttribution } from '@/lib/attributionServer'
import { postQuoteWebhook } from '@/lib/n8nClient'

// Envío REAL de la cotización por correo:
//  1) garantiza la pre-reserva (sin consumir cupo)
//  2) genera el link de pago de Flow (abono 50%)
//  3) hace POST a n8n con todo el payload (PDF + link de pago) => n8n manda el correo
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      quoteId,
      prospectId,
      pdfUrl: pdfUrlFromClient,
      client,
      schedule,
      addresses,
      propertyDetails,
      estimatedPrice,
      details,
      photoUrls,
    } = body

    if (!quoteId || !client?.email || !client?.name || !estimatedPrice) {
      return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 })
    }

    if (prospectId) {
      const { error: linkError } = await supabaseAdmin
        .from('quote_prospects')
        .update({
          quote_id: quoteId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', prospectId)

      if (linkError) {
        console.error('[send-quote] Error vinculando prospecto con quote_id:', linkError)
      }
    }

    // 1) Pre-reserva idempotente (no consume cupo hasta que se pague)
    const attribution = await resolveBookingAttribution(body, quoteId)
    const { locked } = await ensureProvisionalBooking({
      quoteId,
      client,
      schedule,
      addresses,
      propertyDetails,
      estimatedPrice,
      paymentType: 'mitad',
      photoUrls,
      attribution,
    })

    // 2) Link de pago de Flow (best-effort): el correo con el PDF NO debe depender
    //    del pago. Si Flow no está configurado o falla, igual se envía el correo,
    //    solo que sin link de pago (flow_payment_url = null). Si ya está pagada, tampoco
    //    se genera un link nuevo — evita que el cliente pague dos veces por error.
    const amounts = computeQuoteAmounts(estimatedPrice)
    let paymentUrl: string | null = null
    try {
      if (locked) {
        console.warn(`[send-quote] Reserva ${quoteId} ya está pagada: se envía el correo sin link de pago.`)
      } else if (flowService.isConfigured()) {
        const order = await createQuoteFlowOrder({
          quoteId,
          paymentType: 'mitad',
          amount: amounts.abono50,
          email: client.email,
          subject: 'Servicio de Mudanza - Abono 50%',
        })
        paymentUrl = order.url
      } else {
        console.warn('[send-quote] Flow no configurado: se envía el correo sin link de pago.')
      }
    } catch (flowError) {
      console.error('[send-quote] Flow falló; se envía el correo sin link de pago:', flowError)
    }

    // 3) Resolver la URL del PDF (la del cliente o la guardada en el prospecto)
    let pdfUrl: string | null = pdfUrlFromClient || null
    if (!pdfUrl && prospectId) {
      const { data } = await supabaseAdmin
        .from('quote_prospects')
        .select('pdf_url')
        .eq('id', prospectId)
        .maybeSingle()
      pdfUrl = data?.pdf_url || null
    }

    // Payload para n8n
    const payload = {
      event: 'quote_email_requested',
      prospect_id: prospectId || null,
      quote_id: quoteId,
      cliente: {
        nombre: client.name,
        email: client.email,
        telefono: client.phone || null,
        es_empresa: client.isCompany || false,
        razon_social: client.isCompany ? client.companyName || null : null,
        rut: client.isCompany ? client.companyRut || null : null,
      },
      cotizacion: {
        origen: addresses?.origin || null,
        destino: addresses?.destination || null,
        fecha: schedule?.date || null,
        hora: schedule?.time || null,
        distancia_km: details?.distanceKm ?? null,
        // Redondeo a 2 decimales para evitar "1.4500000000000002" en el correo
        volumen_m3:
          details?.volumeM3 != null ? Math.round(details.volumeM3 * 100) / 100 : null,
        vehiculo: details?.vehicle || null,
        precio_total: amounts.estimated,
        precio_50: amounts.abono50,
        precio_100_con_descuento: amounts.full95,
        es_flexible: details?.isFlexible || false,
      },
      pdf_url: pdfUrl,
      pago: {
        flow_payment_url: paymentUrl,
        monto: amounts.abono50,
        tipo: 'abono_50',
      },
    }

    const result = await postQuoteWebhook(payload, { label: 'cliente' })

    if (!result.ok) {
      // El motivo concreto ya quedó logueado en n8nClient (timeout/red/HTTP).
      return NextResponse.json(
        { error: 'No se pudo enviar la cotización por correo. Intenta de nuevo.' },
        { status: 502 }
      )
    }

    return NextResponse.json({ success: true, paymentUrl })
  } catch (error) {
    if (error instanceof SlotUnavailableError) {
      return NextResponse.json({ error: error.message }, { status: 409 })
    }
    console.error('[send-quote] Error:', error)
    return NextResponse.json(
      { error: 'Error al enviar la cotización' },
      { status: 500 }
    )
  }
}
