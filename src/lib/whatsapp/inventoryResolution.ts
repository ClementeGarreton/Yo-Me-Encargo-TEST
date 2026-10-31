/**
 * Correspondencias aproximadas para el inventario de WhatsApp.
 * La estimación nunca crea IDs ajenos al catálogo y evita preguntar al
 * cliente por variaciones comerciales sin relevancia operativa evidente.
 */
export interface InventoryCandidate {
  catalogItemId: string
  label: string
  confidence?: number
}

function normalize(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/\b(sillones|sillon|sofas|sofa)\b/g, 'sofa')
    .replace(/\b(televisor|television|tv)\b/g, 'tv')
    .replace(/\b(mueble para|mueble de)\b/g, 'mueble ')
}

function significantWords(value: string): string[] {
  const ignored = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'un', 'una', 'para', 'y', 'en', 'con', 'mueble', 'tipo', 'aprox', 'aproximado'])
  return normalize(value).split(/[^a-z0-9]+/).filter((token) => (token.length > 1 || /^\d+$/.test(token)) && !ignored.has(token))
}

export function chooseClosestInventoryCandidate(sourceLabel: string, candidates: InventoryCandidate[]): InventoryCandidate | null {
  if (!candidates.length) return null
  const sourceWords = significantWords(sourceLabel)
  const sourceDigits = sourceWords.filter((word) => /^\d+$/.test(word))
  const scored = candidates.map((candidate, index) => {
    const words = significantWords(candidate.label)
    let score = (candidate.confidence || 0) * 2
    for (const word of sourceWords) {
      if (words.includes(word)) score += /^\d+$/.test(word) ? 12 : 2
    }
    const candidateDigits = words.filter((word) => /^\d+$/.test(word))
    if (sourceDigits.length && candidateDigits.length && !candidateDigits.some((digit) => sourceDigits.includes(digit))) score -= 10
    // Sin tamaño especificado, se estima con el modelo mediano en vez de pedir un catálogo entero.
    if (!sourceDigits.length && /\b(mediano|mediana|medio|media)\b/i.test(normalize(candidate.label))) score += 3
    if (!sourceDigits.length && /\b(grande|gigante|extra grande)\b/i.test(normalize(candidate.label))) score -= 1
    return { candidate, index, score }
  })
  scored.sort((a, b) => b.score - a.score || a.index - b.index)
  return scored[0].candidate
}

/** Detecta adiciones tardías al inventario sin confundirlas con extras. */
export function isInventoryAddition(text: string): boolean {
  const normalized = normalize(text.trim())
  if (/\b(embalaje|embalar|desembalaje|desembalar|desarme|desarmar|armado|armar|ninguno|ninguna)\b/.test(normalized)) return false
  return /\b(agrega|agregar|anade|anadir|suma|sumar|olvide|falta|falto|tambien llevo|ademas llevo|otro mueble|otra caja|incluye)\b/.test(normalized)
}
