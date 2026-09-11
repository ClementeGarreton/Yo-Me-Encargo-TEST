import { NextRequest, NextResponse } from 'next/server'
import { generateQuotePDFFromData } from '@/lib/pdfGenerator'

export async function POST(request: NextRequest) {
  try {
    const quoteData = await request.json()

    // Validar que tenemos los datos necesarios
    if (!quoteData.personalInfo || !quoteData.dateTime) {
      return NextResponse.json(
        { error: 'Datos de cotización incompletos' },
        { status: 400 }
      )
    }

    // Aquí podrías generar el PDF en el servidor y devolverlo
    // Por ahora, devolvemos los datos para que el frontend los procese
    return NextResponse.json({
      success: true,
      message: 'Datos de cotización recibidos correctamente',
      quoteData,
    })
  } catch (error) {
    console.error('Error processing PDF request:', error)
    return NextResponse.json(
      { error: 'Error al procesar la solicitud de PDF' },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Endpoint para generar PDFs de cotizaciones',
    usage: 'POST con datos de cotización en el body',
  })
}
