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
  // No inferimos distancia del camión ni pisos en casas sin información.
  if (details.propertyType === 'casa' && details.floor === 1 && details.hasElevator === null) {
    details.hasElevator = false
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
    return `${title}\n¿Hay ascensor? ¿A cuántos metros de la puerta puede estacionar el camión (aproximadamente)?`
  }
  if (needsElevator) return `${title}\n¿Hay ascensor para mover los muebles?`
  if (needsParking) {
    return `${title}\n¿A cuántos metros de la puerta puede estacionar el camión? Por ejemplo: en la puerta (0 m), 20 m o 40 m.`
  }
  return null
}

export function nextPropertyQuestion(origin: PropertyDetails, destination: PropertyDetails): string {
  return propertyPrompt(origin, 'origen') || propertyPrompt(destination, 'destino') ||
    '4/7 · Detalles de los lugares\n¿Hay algún dato de acceso que quieras aclarar?'
}
