import { NextRequest, NextResponse } from 'next/server'
import { MAPS_CONFIG } from '@/config/maps'

/**
 * API Route para calcular distancia entre dos puntos usando Geoapify Routing
 * Esta ruta actúa como proxy para evitar problemas de CORS
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { originLat, originLng, destLat, destLng } = body

    // Validar que tenemos API key
    if (!MAPS_CONFIG.apiKey) {
      return NextResponse.json(
        { error: 'Geoapify API key not configured' },
        { status: 500 }
      )
    }

    // Validar parámetros
    if (originLat === undefined || originLng === undefined || destLat === undefined || destLng === undefined) {
      return NextResponse.json(
        { error: 'Missing required parameters: originLat, originLng, destLat, destLng' },
        { status: 400 }
      )
    }

    // Validar que son números válidos
    if (isNaN(originLat) || isNaN(originLng) || isNaN(destLat) || isNaN(destLng)) {
      return NextResponse.json(
        { error: 'Coordinates must be valid numbers' },
        { status: 400 }
      )
    }

    // Llamar a Geoapify Routing API desde el servidor
    const url = new URL(MAPS_CONFIG.distanceMatrixUrl)
    // Geoapify Routing requiere formato lat,lon (no lon,lat como en GeoJSON)
    url.searchParams.append('waypoints', `${originLat},${originLng}|${destLat},${destLng}`)
    url.searchParams.append('mode', 'drive') // Requerido: modo de conducción
    url.searchParams.append('apiKey', MAPS_CONFIG.apiKey)

    console.log('Geoapify Distance URL:', url.toString())

    const response = await fetch(url.toString())
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('Geoapify Distance API error:', response.status, response.statusText, errorText)
      return NextResponse.json(
        { 
          error: 'Geoapify Distance API error',
          status: response.status,
          details: errorText
        },
        { status: 400 }
      )
    }

    const data = await response.json()
    console.log('Geoapify Distance response:', JSON.stringify(data, null, 2))

    // Verificar respuesta exitosa
    if (data.features && data.features.length > 0) {
      const feature = data.features[0]
      const properties = feature.properties
      
      // Extraer distancia y duración de la respuesta
      const distance = properties.distance // en metros
      const duration = properties.time // en segundos

      return NextResponse.json({
        // Se conservan 2 decimales (no se redondea a km entero): un traslado dentro de un
        // mismo edificio/condominio puede ser de pocos metros y antes se perdía esa precisión.
        kilometers: Math.round((distance / 1000) * 100) / 100,
        duration: Math.round(duration / 60), // Convertir segundos a minutos
      })
    }

    // Si falla, retornar error con detalles
    return NextResponse.json(
      { 
        error: 'Distance calculation failed',
        status: 'ERROR',
        details: data
      },
      { status: 400 }
    )
  } catch (error) {
    console.error('Error in distance API:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    )
  }
}

