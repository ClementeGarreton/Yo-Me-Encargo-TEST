import { NextRequest, NextResponse } from 'next/server'
import { MAPS_CONFIG } from '@/config/maps'

/**
 * API Route para obtener detalles de un lugar usando Geoapify Geocoding
 * Esta ruta actúa como proxy para evitar problemas de CORS
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { placeId } = body

    // Validar que tenemos API key
    if (!MAPS_CONFIG.apiKey) {
      return NextResponse.json(
        { error: 'Geoapify API key not configured' },
        { status: 500 }
      )
    }

    // Validar parámetros
    if (!placeId) {
      return NextResponse.json(
        { error: 'Missing placeId parameter' },
        { status: 400 }
      )
    }

    // Llamar a Geoapify Geocoding API desde el servidor
    const url = new URL(MAPS_CONFIG.geocodingUrl)
    url.searchParams.append('place_id', placeId)
    url.searchParams.append('apiKey', MAPS_CONFIG.apiKey)
    url.searchParams.append('lang', MAPS_CONFIG.language)

    console.log('Geoapify Place Details URL:', url.toString())

    const response = await fetch(url.toString())
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('Geoapify Place Details API error:', response.status, response.statusText, errorText)
      return NextResponse.json(
        { 
          error: 'Geoapify Place Details API error',
          status: response.status,
          details: errorText
        },
        { status: 400 }
      )
    }

    const data = await response.json()
    console.log('Geoapify Place Details response:', JSON.stringify(data, null, 2))

    // Verificar respuesta exitosa
    if (data.features && data.features.length > 0) {
      const feature = data.features[0]
      
      // Transformar respuesta de Geoapify al formato esperado por el frontend
      const result = {
        formatted_address: feature.properties.formatted,
        geometry: {
          location: {
            lat: feature.geometry.coordinates[1],
            lng: feature.geometry.coordinates[0]
          }
        },
        address_components: parseGeoapifyAddressComponents(feature.properties)
      }

      return NextResponse.json({
        result,
      })
    }

    // Si falla, retornar error con detalles
    return NextResponse.json(
      { 
        error: 'Place details failed',
        status: 'ERROR',
      },
      { status: 400 }
    )
  } catch (error) {
    console.error('Error in place details API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * Parsea los componentes de dirección de Geoapify al formato de Google Places
 * 
 * IMPORTANTE: Cómo Geoapify mapea direcciones chilenas:
 * - housenumber: número de casa (ej: "19")
 * - street: nombre de la calle (ej: "Los Comendadores")
 * - district: COMUNA/DISTRITO (ej: "Lampa") ← ESTO ES LA COMUNA
 * - city: ciudad más grande (ej: "Batuco") - NO es la comuna que el usuario busca
 * - state: región (ej: "Región Metropolitana de Santiago")
 * - postcode: código postal
 */
function parseGeoapifyAddressComponents(properties: any): any[] {
  const components: any[] = []

  console.log('🔍 Geoapify properties recibidas:', JSON.stringify(properties, null, 2))
  console.log('DEBUG - street:', properties.street)
  console.log('DEBUG - housenumber:', properties.housenumber)
  console.log('DEBUG - district:', properties.district)
  console.log('DEBUG - city:', properties.city)
  console.log('DEBUG - state:', properties.state)

  // 1. CALLE (route)
  if (properties.street) {
    components.push({
      long_name: properties.street,
      short_name: properties.street,
      types: ['route']
    })
    console.log('✅ Calle extraída:', properties.street)
  }

  // 2. NÚMERO (street_number)
  if (properties.housenumber) {
    const cleanNumber = properties.housenumber.toString().replace(/\D/g, '')
    if (cleanNumber && cleanNumber.length <= 6) {
      components.push({
        long_name: cleanNumber,
        short_name: cleanNumber,
        types: ['street_number']
      })
      console.log('✅ Número extraído:', cleanNumber)
    }
  }

  // 3. COMUNA (locality) - EN CHILE ES EL DISTRITO, NO LA CIUDAD
  // Prioridad:
  // 1. Si existe 'district', usarlo como comuna (es lo que el usuario buscó)
  // 2. Si no, usar 'city'
  const commune = properties.district || properties.city
  if (commune) {
    components.push({
      long_name: commune,
      short_name: commune,
      types: ['locality']
    })
    console.log('✅ Comuna/Localidad extraída:', commune, '(source:', properties.district ? 'district' : 'city', ')')
  }

  // 4. REGIÓN (administrative_area_level_1)
  if (properties.state) {
    components.push({
      long_name: properties.state,
      short_name: properties.state,
      types: ['administrative_area_level_1']
    })
    console.log('✅ Región extraída:', properties.state)
  }

  // 5. PROVINCIA (administrative_area_level_2) - para referencia, no para usar como comuna
  if (properties.county) {
    components.push({
      long_name: properties.county,
      short_name: properties.county,
      types: ['administrative_area_level_2']
    })
    console.log('✅ Provincia/Condado extraído:', properties.county)
  }

  // 6. PAÍS (country)
  if (properties.country) {
    components.push({
      long_name: properties.country,
      short_name: properties.country_code,
      types: ['country']
    })
    console.log('✅ País extraído:', properties.country)
  }

  console.log('✅ Componentes finales parseados:', JSON.stringify(components, null, 2))
  return components
}

