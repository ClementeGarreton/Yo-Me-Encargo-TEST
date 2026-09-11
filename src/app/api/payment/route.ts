import { NextRequest, NextResponse } from 'next/server'
import { flowService } from '@/lib/flowService'

// Este endpoint crea una orden de pago en Flow
export async function POST(request: NextRequest) {
  try {
    const { bookingId, amount, email, subject, paymentType } = await request.json()

    if (!bookingId || !amount || !email) {
      return NextResponse.json(
        { error: 'Datos incompletos' },
        { status: 400 }
      )
    }

    // Verificar que Flow está configurado
    if (!flowService.isConfigured()) {
      return NextResponse.json(
        { error: 'Flow no está configurado. Por favor contacta al administrador.' },
        { status: 500 }
      )
    }

    // Obtener URL base de la aplicación
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

    // Crear orden de pago en Flow
    const paymentData = {
      commerceOrder: bookingId, // ID único de la reserva
      subject: subject || 'Servicio de Mudanza - Yo Me Encargo',
      currency: 'CLP',
      amount: amount,
      email: email,
      urlConfirmation: `${appUrl}/api/payment/confirm`, // Flow enviará notificación aquí
      urlReturn: `${appUrl}/api/payment/result`, // Usuario será redirigido aquí
      optional: JSON.stringify({ bookingId, paymentType }), // Datos adicionales mínimos
    }

    const flowResponse = await flowService.createPayment(paymentData)

    return NextResponse.json({
      success: true,
      paymentUrl: flowResponse.url,
      token: flowResponse.token,
      flowOrder: flowResponse.flowOrder,
    })
  } catch (error) {
    console.error('Error processing payment:', error)
    return NextResponse.json(
      {
        error: 'Error al procesar el pago',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
