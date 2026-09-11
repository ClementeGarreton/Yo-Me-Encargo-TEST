import { NextRequest, NextResponse } from 'next/server'
import { MAPS_CONFIG } from '@/config/maps'

/**
 * API Route para autocompletar direcciones usando Geoapify Autocomplete
 * Esta ruta actúa como proxy para evitar problemas de CORS
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { input } = body

    // Validar que tenemos API key
    if (!MAPS_CONFIG.apiKey) {
      console.error('Geoapify API key not configured')
      return NextResponse.json(
        { error: 'Geoapify API key not configured' },
        { status: 500 }
      )
    }

    console.log('API Key configured:', MAPS_CONFIG.apiKey ? 'Yes' : 'No')

    // Validar parámetros
    if (!input || input.trim().length < 3) {
      return NextResponse.json(
        { predictions: [] }
      )
    }

    // Si no hay API key, retornar predicciones de ejemplo para testing
    if (!MAPS_CONFIG.apiKey) {
      console.log('No API key - returning mock data for testing')
      const mockPredictions = [
        {
          place_id: 'mock-1',
          description: `${input}, Santiago, Chile`,
          structured_formatting: {
            main_text: input,
            secondary_text: 'Santiago, Chile'
          }
        },
        {
          place_id: 'mock-2', 
          description: `${input}, Providencia, Santiago, Chile`,
          structured_formatting: {
            main_text: input,
            secondary_text: 'Providencia, Santiago, Chile'
          }
        }
      ]
      
      return NextResponse.json({
        predictions: mockPredictions,
      })
    }

    // Llamar a Geoapify Autocomplete API desde el servidor
    const url = new URL(MAPS_CONFIG.autocompleteUrl)
    url.searchParams.append('text', input)
    url.searchParams.append('apiKey', MAPS_CONFIG.apiKey)
    url.searchParams.append('lang', MAPS_CONFIG.language)
    url.searchParams.append('filter', `countrycode:${MAPS_CONFIG.country}`) // Solo resultados de Chile
    url.searchParams.append('limit', '10') // Máximo 10 resultados

    console.log('Geoapify Autocomplete URL:', url.toString())

    const response = await fetch(url.toString())
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('Geoapify API error:', response.status, response.statusText, errorText)
      return NextResponse.json(
        { 
          error: 'Geoapify API error',
          status: response.status,
          details: errorText,
          predictions: []
        },
        { status: 400 }
      )
    }

    const data = await response.json()
    console.log('Geoapify response:', JSON.stringify(data, null, 2))

    // Verificar respuesta exitosa
    if (data.features && Array.isArray(data.features)) {
      // Transformar respuesta de Geoapify al formato esperado por el frontend
      const predictions = data.features.map((feature: any) => {
        const props = feature.properties
        const formatted = props.formatted || ''
        
        // Remover código postal de la descripción formateada
        // Los códigos postales en Geoapify suelen tener 7 dígitos (formato chileno) o similar
        const descriptionWithoutPostcode = formatted.replace(/,?\s*\d{5,7}?\s*$/i, '').trim()
        
        // Construir el secondary_text limpio (sin código postal y sin el nombre/calle principal)
        const mainText = props.name || props.street || props.city || ''
        const secondaryText = descriptionWithoutPostcode
          .replace(new RegExp(`^${mainText}[,\\s]*`), '') // Remover main_text del inicio
          .replace(/,\s*Chile\s*$/, '') // Remover "Chile" del final
          .trim()
        
        return {
          place_id: props.place_id,
          description: descriptionWithoutPostcode,
          structured_formatting: {
            main_text: mainText,
            secondary_text: secondaryText || props.city || ''
          },
          // 🔥 NUEVO: Incluir toda la data que necesita el frontend
          // para que NO tenga que hacer otra llamada a place-details
          properties: {
            street: props.street || '',
            housenumber: props.housenumber || '',
            // 🔥 CORRECCIÓN: Usar 'city' para la comuna (no 'district' que es barrio)
            city: props.city || '',
            district: props.district || '',
            state: props.state || '',
            country: props.country || '',
            formatted: props.formatted || ''
          }
        }
      })

      return NextResponse.json({
        predictions,
      })
    }

    // Si falla, retornar error con detalles
    return NextResponse.json(
      { 
        error: 'Autocomplete failed',
        status: 'ERROR',
        predictions: [],
        details: data
      },
      { status: 400 }
    )
  } catch (error) {
    console.error('Error in autocomplete API:', error)
    return NextResponse.json(
      { error: 'Internal server error', predictions: [] },
      { status: 500 }
    )
  }
}

