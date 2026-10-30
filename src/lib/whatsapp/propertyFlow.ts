/**
 * Subpreguntas de la sección 4 del cotizador de WhatsApp.
 * Sin estados adicionales ni migraciones: el progreso se deduce del JSON
 * de quote_sessions.state, que ya se utiliza en producción.
 */
export type PropertyDetails = {
  propertyType: string | null
  floor: number | null
  hasElevator: boolean | null
  parkingDistance: number | null
}

export function completeOneStoryHouse(details: PropertyDetails): void {
  // Una casa de una sola planta no necesita ascensor para subir enseres.
  if (details.propertyType === 'casa' && details.floor === 1 && details.hasElevator === null) {
    details.hasElevator = false
  }
}

/**
 * Rescate determinista de datos explícitos cuando el extractor de IA devuelve
 * campos nulos o redondea distancias (p. ej. "Sí, a como 10 metros").
 * El lugar consultado se determina ANTES del parseo de IA para evitar que,
 * al completar origen, los datos salten accidentalmente a destino.
 * Se usan únicamente las propiedades pendientes: jamás se duplica un dato.
 */
export function applyFocusedPropertyFallback(
  beforeOrigin: PropertyDetails,
  beforeDestination: PropertyDetails,
  afterOrigin: PropertyDetails,
  afterDestination: PropertyDetails,
  answer: string
): void {
  const focus = pendingPropertyPlace(beforeOrigin, beforeDestination)
  if (!focus) return

  // No atribuir una contestación del destino al origen, o viceversa.
  const clean = answer.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
  if (focus === 'origin' && /\b(?:en el destino|en la entrega|en el lugar de entrega)\b/.test(clean)) return
  if (focus === 'destination' && /\b(?:en el origen|en el retiro|en el lugar de retiro)\b/.test(clean)) return

  const before = focus === 'origin' ? beforeOrigin : beforeDestination
  const after = focus === 'origin' ? afterOrigin : afterDestination

  if (!before.propertyType) {
    const property = /\b(departamento|depto\.?|casa|oficina|bodega)\b/.exec(clean)?.[1]
    const kinds: Record<string, string> = { depto: 'departamento', 'depto.': 'departamento' }
    if (property) after.propertyType = kinds[property] || property
  }
  if (before.floor === null) {
    const floor = /\b(?:piso|planta)\s*(?:numero|nro\.?|n°)?\s*(\d{1,2})\b/.exec(clean)
    const floorBefore = /\b(\d{1,2}|un|una|dos|tres)\s+(?:solo\s+)?(?:pisos?|plantas?)\b/.exec(clean)
    const numberWord: Record<string, number> = { un: 1, una: 1, dos: 2, tres: 3 }
    const value = floor ? Number(floor[1]) : floorBefore ? (numberWord[floorBefore[1]] ?? Number(floorBefore[1])) : null
    if (value !== null && Number.isInteger(value) && value >= 0 && value <= 100) after.floor = value
  }
  completeOneStoryHouse(after)

  // El "sí" del cliente se refiere al ascensor sólo si era una pregunta pendiente.
  if (before.hasElevator === null && before.propertyType && before.floor !== null) {
    if (/\b(sin ascensor|no hay ascensor|no tiene ascensor|por (?:la )?escalera)\b/.test(clean) || /^(?:no|nop|negativo)\b/.test(clean)) {
      after.hasElevator = false
    } else if (/\b(con ascensor|hay ascensor|tiene ascensor)\b/.test(clean) || /^(?:si|claro|afirmativo|correcto|efectivamente)\b/.test(clean)) {
      after.hasElevator = true
    }
  }

  if (before.propertyType && before.floor !== null) {
    // Conserva los metros que el cliente indicó: "10 metros" no es "20" ni null.
    const metres = /\b(\d{1,3})(?:[.,]\d+)?\s*(?:metros?|mts?\.?|m)\b/.exec(clean)
    const atEntrance = /\b(?:en|junto a|al lado de|justo en)\s+la\s+(?:misma\s+)?(?:puerta|entrada)\b/.test(clean)
    const exact = metres ? Number(metres[1]) : null
    if (exact !== null && exact >= 0 && exact <= 500) after.parkingDistance = exact
    else if (atEntrance) after.parkingDistance = 0
    else if (/^\s*(\d{1,3})\s*$/.test(clean)) after.parkingDistance = Number(clean)
  }
}

function propertyPrompt(details: PropertyDetails, place: 'origen' | 'destino'): string | null {
  const isOrigin = place === 'origen'
  const label = isOrigin ? 'retiro (origen)' : 'entrega (destino)'
  const title = `4/7 · Datos del lugar de ${label}`
  const needsType = !details.propertyType
  const needsFloor = details.floor === null

  if (needsType && needsFloor) {
    return `${title}\n¿Es casa, departamento, oficina o bodega? ¿En qué piso están las cosas?`
  }
  if (needsType) return `${title}\n¿Es casa, departamento, oficina o bodega?`
  if (needsFloor) return `${title}\n¿En qué piso están las cosas? Si es una casa de un piso, responde “1”.`

  const needsElevator = details.hasElevator === null
  const needsParking = details.parkingDistance === null
  if (needsElevator && needsParking) {
    // Una sola pregunta por turno. Si espontáneamente responde ambos, se guardan ambos.
    return `${title}\n¿Hay ascensor para mover los muebles?`
  }
  if (needsElevator) return `${title}\n¿Hay ascensor para mover los muebles?`
  if (needsParking) {
    return `${title}\n¿A cuántos metros de la puerta puede estacionar el camión? Por ejemplo: en la puerta (0 m), 20 m o 40 m.`
  }
  return null
}

export function pendingPropertyPlace(origin: PropertyDetails, destination: PropertyDetails): 'origin' | 'destination' | null {
  if (propertyPrompt(origin, 'origen')) return 'origin'
  if (propertyPrompt(destination, 'destino')) return 'destination'
  return null
}

export function nextPropertyQuestion(origin: PropertyDetails, destination: PropertyDetails): string {
  return propertyPrompt(origin, 'origen') || propertyPrompt(destination, 'destino') ||
    '4/7 · Detalles de los lugares\n¿Hay algún dato de acceso que quieras aclarar?'
}
