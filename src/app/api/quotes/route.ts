import { NextRequest, NextResponse } from 'next/server'

// Este endpoint maneja la creación de cotizaciones
export async function POST(request: NextRequest) {
  try {
    const data = await request.json()

    // Validaciones básicas
    if (!data.personalInfo || !data.dateTime || !data.origin || !data.destination) {
      return NextResponse.json(
        { error: 'Datos incompletos' },
        { status: 400 }
      )
    }

    // Aquí irían las operaciones con la base de datos
    // Por ahora, solo simulamos la respuesta
    
    const quote = {
      id: `Q-${Date.now()}`,
      ...data,
      createdAt: new Date().toISOString(),
      status: 'pending',
    }

    // Aquí se enviaría el email con SendGrid
    // await sendQuoteEmail(quote)

    // Aquí se enviaría el mensaje de WhatsApp
    // await sendWhatsAppMessage(quote)

    return NextResponse.json({
      success: true,
      quote,
      message: 'Cotización creada exitosamente',
    })
  } catch (error) {
    console.error('Error creating quote:', error)
    return NextResponse.json(
      { error: 'Error al crear la cotización' },
      { status: 500 }
    )
  }
}

// Obtener todas las cotizaciones (para admin)
export async function GET(request: NextRequest) {
  try {
    // Aquí se consultarían las cotizaciones de la base de datos
    const quotes: any[] = []

    return NextResponse.json({
      success: true,
      quotes,
    })
  } catch (error) {
    console.error('Error fetching quotes:', error)
    return NextResponse.json(
      { error: 'Error al obtener las cotizaciones' },
      { status: 500 }
    )
  }
}

