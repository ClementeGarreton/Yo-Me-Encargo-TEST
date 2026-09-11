import { NextRequest, NextResponse } from 'next/server'
import { MAPS_CONFIG } from '@/config/maps'

/**
 * API Route para geocodificar direcciones usando Geoapify Geocoding
 * Esta ruta actúa como proxy para evitar problemas de CORS
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { street, number, commune, region } = body

    // Validar que tenemos API key
    if (!MAPS_CONFIG.apiKey) {
      return NextResponse.json(
        { error: 'Geoapify API key not configured' },
        { status: 500 }
      )
    }

    // Validar parámetros
    if (!street || !commune || !region) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      )
    }

    // Construir dirección completa
    const address = `${street} ${number}, ${commune}, ${region}, Chile`
    
    // Llamar a Geoapify Geocoding API desde el servidor
    const url = new URL(MAPS_CONFIG.geocodingUrl)
    url.searchParams.append('text', address)
    url.searchParams.append('apiKey', MAPS_CONFIG.apiKey)
    url.searchParams.append('lang', MAPS_CONFIG.language)
    url.searchParams.append('filter', `countrycode:${MAPS_CONFIG.country}`)
    url.searchParams.append('limit', '1') // Solo el primer resultado

    console.log('Geoapify Geocoding URL:', url.toString())

    const response = await fetch(url.toString())
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('Geoapify Geocoding API error:', response.status, response.statusText, errorText)
      return NextResponse.json(
        { 
          error: 'Geoapify Geocoding API error',
          status: response.status,
          details: errorText
        },
        { status: 400 }
      )
    }

    const data = await response.json()
    console.log('Geoapify Geocoding response:', JSON.stringify(data, null, 2))

    // Verificar respuesta exitosa
    if (data.features && data.features.length > 0) {
      const feature = data.features[0]
      const coordinates = feature.geometry.coordinates
      
      return NextResponse.json({
        lat: coordinates[1],
        lng: coordinates[0],
      })
    }

    // Si falla, retornar error con detalles
    return NextResponse.json(
      { 
        error: 'Geocoding failed',
        status: 'ERROR',
        details: data
      },
      { status: 400 }
    )
  } catch (error) {
    console.error('Error in geocoding API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}