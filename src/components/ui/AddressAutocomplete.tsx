'use client'

import { useState, useEffect, useRef } from 'react'
import { Search, MapPin, Loader2 } from 'lucide-react'

interface AddressAutocompleteProps {
  label?: string
  placeholder?: string
  onSelect: (addressData: {
    street: string
    number: string
    commune: string
    region: string
    formattedAddress: string
  }) => void
  initialValue?: string
  required?: boolean
}

interface Prediction {
  place_id: string
  description: string
  structured_formatting: {
    main_text: string
    secondary_text: string
  }
}

// Mapeo de regiones de Geoapify (desde Geoapify) a nuestro formato estandarizado
// Esto ayuda a normalizar los nombres de regiones que vienen de la API
const regionMapping: Record<string, string> = {
  // Región Metropolitana
  'Región Metropolitana de Santiago': 'metropolitana',
  'Región Metropolitana': 'metropolitana',
  'Santiago Metropolitan': 'metropolitana',
  'Santiago': 'metropolitana',
  'Metropolitana': 'metropolitana',
  
  // Región de Valparaíso
  'Región de Valparaíso': 'valparaiso',
  'Valparaíso': 'valparaiso',
  'Valparaiso': 'valparaiso',
  'Valparaíso Region': 'valparaiso',
  
  // Región del Biobío
  'Región del Biobío': 'biobio',
  'Biobío': 'biobio',
  'Biobio': 'biobio',
  'Biobío Region': 'biobio',
  
  // Región de La Araucanía
  'Región de La Araucanía': 'araucania',
  'La Araucanía': 'araucania',
  'Araucanía': 'araucania',
  'Araucania': 'araucania',
  'Araucanía Region': 'araucania',
  
  // Región de Los Lagos
  'Región de Los Lagos': 'loslagos',
  'Los Lagos': 'loslagos',
  'Los Lagos Region': 'loslagos',
  
  // Región de Coquimbo
  'Región de Coquimbo': 'coquimbo',
  'Coquimbo': 'coquimbo',
  'Coquimbo Region': 'coquimbo',
  
  // Región de Antofagasta
  'Región de Antofagasta': 'antofagasta',
  'Antofagasta': 'antofagasta',
  'Antofagasta Region': 'antofagasta',
  
  // Región de Atacama
  'Región de Atacama': 'atacama',
  'Atacama': 'atacama',
  'Atacama Region': 'atacama',
  
  // Región de O'Higgins
  "Región de O'Higgins": 'ohiggins',
  "O'Higgins": 'ohiggins',
  'OHiggins': 'ohiggins',
  "O'Higgins Region": 'ohiggins',
  
  // Región del Maule
  'Región del Maule': 'maule',
  'Maule': 'maule',
  'Maule Region': 'maule',
  
  // Región de Ñuble
  'Región de Ñuble': 'nuble',
  'Ñuble': 'nuble',
  'Nuble': 'nuble',
  'Ñuble Region': 'nuble',
  
  // Región de Los Ríos
  'Región de Los Ríos': 'losrios',
  'Los Ríos': 'losrios',
  'Los Rios': 'losrios',
  'Los Ríos Region': 'losrios',
  
  // Región de Aysén
  'Región de Aysén': 'aysen',
  'Aysén': 'aysen',
  'Aysen': 'aysen',
  'Aysén Region': 'aysen',
  
  // Región de Magallanes
  'Región de Magallanes y la Antártica Chilena': 'magallanes',
  'Magallanes y la Antártica Chilena': 'magallanes',
  'Magallanes': 'magallanes',
  'Magallanes Region': 'magallanes',
  
  // Región de Arica y Parinacota
  'Región de Arica y Parinacota': 'arica',
  'Arica y Parinacota': 'arica',
  'Arica': 'arica',
  'Arica Region': 'arica',
  
  // Región de Tarapacá
  'Región de Tarapacá': 'tarapaca',
  'Tarapacá': 'tarapaca',
  'Tarapaca': 'tarapaca',
  'Tarapacá Region': 'tarapaca',
}

// Mapeo de comunas a regiones (para casos donde Google no devuelve bien la región)
// Esto es útil cuando la API no identifica correctamente la región a partir de los componentes
const communeToRegion: Record<string, string> = {
  // Valparaíso
  'Viña del Mar': 'valparaiso',
  'Valparaíso': 'valparaiso',
  'Concón': 'valparaiso',
  'Quilpué': 'valparaiso',
  'Villa Alemana': 'valparaiso',
  'San Antonio': 'valparaiso',
  'Cartagena': 'valparaiso',
  'El Quisco': 'valparaiso',
  'El Tabo': 'valparaiso',
  'Algarrobo': 'valparaiso',
  'Santo Domingo': 'valparaiso',
  'San Felipe': 'valparaiso',
  'Los Andes': 'valparaiso',
  'Calle Larga': 'valparaiso',
  'Rinconada': 'valparaiso',
  'San Esteban': 'valparaiso',
  'Putaendo': 'valparaiso',
  'Santa María': 'valparaiso',
  'Panquehue': 'valparaiso',
  'Llaillay': 'valparaiso',
  'Catemu': 'valparaiso',
  'Petorca': 'valparaiso',
  'La Ligua': 'valparaiso',
  'Cabildo': 'valparaiso',
  'Papudo': 'valparaiso',
  'Zapallar': 'valparaiso',
  'Quillota': 'valparaiso',
  'La Cruz': 'valparaiso',
  'La Calera': 'valparaiso',
  'Nogales': 'valparaiso',
  'Hijuelas': 'valparaiso',
  'Limache': 'valparaiso',
  'Olmué': 'valparaiso',
  'Casablanca': 'valparaiso',
  'Quintero': 'valparaiso',
  'Puchuncaví': 'valparaiso',
  'Juan Fernández': 'valparaiso',
  'Isla de Pascua': 'valparaiso',
}

export default function AddressAutocomplete({
  label,
  placeholder = 'Empieza a escribir una dirección...',
  onSelect,
  initialValue = '',
  required = false,
}: AddressAutocompleteProps) {
  const [input, setInput] = useState(initialValue)
  const [predictions, setPredictions] = useState<Prediction[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)
  const isSelectionRef = useRef(false)

  // Función auxiliar para normalizar nombres de regiones
  const normalizeRegion = (regionName: string): string => {
    if (!regionName) return ''
    
    // PASO 1: Buscar directamente en el mapping (caso exacto)
    if (regionMapping[regionName]) {
      const mapped = regionMapping[regionName]
      return mapped
    }
    
    // PASO 2: Intentar remover "Región " del inicio
    let cleaned = regionName.replace(/^Región\s+/i, '').trim()
    if (cleaned !== regionName && regionMapping[cleaned]) {
      const mapped = regionMapping[cleaned]
      return mapped
    }
    
    // PASO 3: Intentar remover " de Santiago" del final (para Región Metropolitana de Santiago)
    cleaned = regionName.replace(/\s+de\s+Santiago$/i, '').trim()
    if (cleaned !== regionName && regionMapping[cleaned]) {
      const mapped = regionMapping[cleaned]
      return mapped
    }
    
    // PASO 4: Buscar por palabra clave
    const keywords = Object.keys(regionMapping)
    for (const keyword of keywords) {
      if (regionName.toLowerCase().includes(keyword.toLowerCase())) {
        const mapped = regionMapping[keyword]
        return mapped
      }
    }
    
    return ''
  }

  // Cerrar dropdown al hacer click fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Fetch predictions cuando cambia el input
  useEffect(() => {
    // Si fue una selección, no buscar predicciones
    if (isSelectionRef.current) {
      isSelectionRef.current = false
      return
    }

    if (input.length < 3) {
      setPredictions([])
      setShowDropdown(false)
      return
    }

    // Debounce para no hacer demasiadas peticiones
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    debounceRef.current = setTimeout(async () => {
      setIsLoading(true)
      try {
        const response = await fetch('/api/maps/autocomplete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ input }),
        })

        const data = await response.json()
        setPredictions(data.predictions || [])
        setShowDropdown(true)
      } catch (error) {
        console.error('Error fetching predictions:', error)
        setPredictions([])
      } finally {
        setIsLoading(false)
      }
    }, 300)

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [input])

  // Parsear componentes de dirección de Geoapify (formato Google Places)
  const parseAddressComponents = (addressComponents: any[]): any => {
    const parsed: any = {
      street: '',
      number: '',
      commune: '',
      region: '',
    }

    // Extraer los componentes por tipo
    addressComponents.forEach((component) => {
      const types = component.types
      const longName = component.long_name

      if (types.includes('route')) {
        parsed.street = longName
      } else if (types.includes('street_number')) {
        parsed.number = longName
      } else if (types.includes('locality')) {
        parsed.commune = longName
      } else if (types.includes('administrative_area_level_1')) {
        parsed.region = longName
      }
    })

    // PASO 1: Normalizar la región si viene con formato "Región Metropolitana de Santiago"
    if (parsed.region) {
      const normalized = normalizeRegion(parsed.region)
      if (normalized) {
        parsed.region = normalized
      } else {
        // Fallback: intenta con el mapeo de comunas
        if (parsed.commune) {
          const regionFromCommune = communeToRegion[parsed.commune]
          if (regionFromCommune) {
            parsed.region = regionFromCommune
          }
        }
      }
    }

    // PASO 2: Si aún no tenemos región, usar fallback
    if (!parsed.region) {
      parsed.region = 'metropolitana'
    }

    // PASO 3: Limpiar datos finales
    parsed.street = (parsed.street || '').trim()
    parsed.number = (parsed.number || '').replace(/\D/g, '')
    parsed.commune = (parsed.commune || '').trim()

    return parsed
  }

  // Helper to extract number from formatted address
  const extractNumberFromFormatted = (formattedAddress: string) => {
    const match = formattedAddress.match(/\d+$/); // Look for digits at the end of the string
    return match ? match[0] : '';
  };

  // Helper to get valid commune: try city first, then district, then empty
  const getValidCommune = (city: string, district: string, regionKey: string) => {
    // Lista de todas las comunas válidas por región (desde AddressStep)
    const comunasMap: Record<string, string[]> = {
      metropolitana: [
        'Alhué', 'Buin', 'Calera de Tango', 'Cerrillos', 'Cerro Navia', 'Colina',
        'Conchalí', 'Curacaví', 'El Bosque', 'El Monte', 'Estación Central',
        'Huechuraba', 'Independencia', 'Isla de Maipo', 'La Cisterna', 'La Florida',
        'La Granja', 'La Pintana', 'La Reina', 'Lampa', 'Las Condes', 'Lo Barnechea',
        'Lo Espejo', 'Lo Prado', 'Macul', 'Maipú', 'María Pinto', 'Melipilla', 'Ñuñoa',
        'Padre Hurtado', 'Paine', 'Pedro Aguirre Cerda', 'Peñaflor', 'Peñalolén',
        'Pirque', 'Providencia', 'Pudahuel', 'Puente Alto', 'Quilicura', 'Quinta Normal',
        'Recoleta', 'Renca', 'San Bernardo', 'San Joaquín', 'San José de Maipo',
        'San Miguel', 'San Pedro', 'San Ramón', 'Santiago', 'Talagante', 'Tiltil', 'Vitacura'
      ],
      valparaiso: [
        'Algarrobo', 'Cabildo', 'Calera', 'Calle Larga', 'Cartagena', 'Casablanca',
        'Catemu', 'Concón', 'El Quisco', 'El Tabo', 'Hijuelas', 'Isla de Pascua',
        'Juan Fernández', 'La Cruz', 'La Ligua', 'Limache', 'Llaillay', 'Los Andes',
        'Nogales', 'Olmué', 'Panquehue', 'Papudo', 'Petorca', 'Puchuncaví', 'Putaendo',
        'Quillota', 'Quilpué', 'Quintero', 'Rinconada', 'San Antonio', 'San Esteban',
        'San Felipe', 'Santa María', 'Santo Domingo', 'Valparaíso', 'Villa Alemana',
        'Viña del Mar', 'Zapallar'
      ],
      // Agregar otras regiones según sea necesario
    }
    
    const validComunas = comunasMap[regionKey] || []
    
    // 1. Intenta con city primero
    if (city && validComunas.includes(city)) {
      return city
    }
    
    // 2. Si city no está, intenta con district
    if (district && validComunas.includes(district)) {
      return district
    }
    
    // 3. Si ninguno está en el listado, retorna vacío
    return ''
  }

  // Manejar selección de una predicción
  const handleSelectPrediction = async (prediction: Prediction & { properties?: any }) => {
    setInput(prediction.description)
    setShowDropdown(false)
    isSelectionRef.current = true // Marcar que fue una selección

    try {
      // 🔥 NUEVO: Si el prediction ya tiene properties (vienen del autocomplete),
      // usarlas directamente sin hacer otra llamada a place-details
      if (prediction.properties) {
        // Convertir las properties de Geoapify al formato de address_components
        const addressComponents = [
          {
            long_name: prediction.properties.street || '',
            short_name: prediction.properties.street || '',
            types: ['route']
          },
          {
            // 🔥 CRÍTICO: Extraer número del formatted si housenumber está vacío
            long_name: prediction.properties.housenumber || extractNumberFromFormatted(prediction.properties.formatted) || '',
            short_name: prediction.properties.housenumber || extractNumberFromFormatted(prediction.properties.formatted) || '',
            types: ['street_number']
          },
          // 🔥 NUEVA LÓGICA: Validar commune usando city primero, luego district, si no está en el listado → vacío
          ...((() => {
            // Necesitamos la región para validar la comuna
            const regionName = prediction.properties.state || ''
            // Normalizar región al formato de clave que usamos
            const regionKey = normalizeRegion(regionName)
            
            // Obtener la comuna válida (intenta city primero, luego district)
            const validCommune = getValidCommune(prediction.properties.city, prediction.properties.district, regionKey)
            
            // Solo agregar el componente si encontramos una comuna válida
            return validCommune ? [{
              long_name: validCommune,
              short_name: validCommune,
              types: ['locality']
            }] : []
          })()),
          {
            long_name: prediction.properties.state || '',
            short_name: prediction.properties.state || '',
            types: ['administrative_area_level_1']
          }
        ]
        
        const parsed = parseAddressComponents(addressComponents)
        
        onSelect({
          street: parsed.street,
          number: parsed.number,
          commune: parsed.commune,
          region: parsed.region,
          formattedAddress: prediction.properties.formatted,
        })
        return
      }

      // ⚠️ FALLBACK: Si no hay properties, usar el antiguo método (para compatibilidad)
      setIsLoading(true)
      const response = await fetch('/api/maps/place-details', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ placeId: prediction.place_id }),
      })

      const data = await response.json()
      
      if (data.result && data.result.address_components) {
        const parsed = parseAddressComponents(data.result.address_components)
        
        onSelect({
          street: parsed.street,
          number: parsed.number,
          commune: parsed.commune,
          region: parsed.region,
          formattedAddress: data.result.formatted_address,
        })
      }
    } catch (error) {
      console.error('Error procesando predicción:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // Manejar teclas de navegación
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showDropdown || predictions.length === 0) return

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex((prev) => 
          prev < predictions.length - 1 ? prev + 1 : prev
        )
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1))
        break
      case 'Enter':
        e.preventDefault()
        if (selectedIndex >= 0 && predictions[selectedIndex]) {
          handleSelectPrediction(predictions[selectedIndex])
        }
        break
      case 'Escape':
        setShowDropdown(false)
        break
    }
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => predictions.length > 0 && setShowDropdown(true)}
          placeholder={placeholder}
          className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
        />

        {isLoading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-primary-600 animate-spin" />
        )}
      </div>

      {/* Dropdown de sugerencias */}
      {showDropdown && predictions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-64 overflow-y-auto">
          {predictions.map((prediction, index) => (
            <button
              key={prediction.place_id}
              onClick={() => handleSelectPrediction(prediction)}
              className={`w-full text-left px-4 py-3 hover:bg-primary-50 transition-colors flex items-start gap-3 ${
                index === selectedIndex ? 'bg-primary-50' : ''
              }`}
            >
              <MapPin className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-gray-900 truncate">
                  {prediction.structured_formatting.main_text}
                </div>
                <div className="text-sm text-gray-500 truncate">
                  {prediction.structured_formatting.secondary_text}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Mensaje cuando no hay resultados */}
      {showDropdown && !isLoading && predictions.length === 0 && input.length >= 3 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg p-4 text-center text-gray-500">
          No se encontraron resultados
        </div>
      )}
    </div>
  )
}

