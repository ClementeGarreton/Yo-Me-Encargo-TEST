// Origen de marketing de un prospecto: Web / RRSS / Recomendación / Cliente antiguo.
// Compartido por el panel de Prospectos y el de Reservas (para mostrar de dónde viene cada uno).

export type ProspectOrigin = 'web' | 'rrss' | 'recomendacion' | 'cliente_antiguo'

export const SOURCE_OPTIONS: { value: ProspectOrigin; label: string }[] = [
  { value: 'web', label: 'Web' },
  { value: 'rrss', label: 'RRSS' },
  { value: 'recomendacion', label: 'Recomendación' },
  { value: 'cliente_antiguo', label: 'Cliente antiguo' },
]

// Los orígenes técnicos antiguos (pdf_download, email_quote, checkout_initiated, domicilio)
// se muestran y filtran como "Web" (todos llegaron por el sitio).
export const normalizeOrigin = (source?: string | null): ProspectOrigin =>
  source === 'rrss' || source === 'recomendacion' || source === 'cliente_antiguo'
    ? source
    : 'web'

export const getSourceLabel = (source?: string | null): string => {
  switch (normalizeOrigin(source)) {
    case 'rrss': return 'RRSS'
    case 'recomendacion': return 'Recomendación'
    case 'cliente_antiguo': return 'Cliente antiguo'
    default: return 'Web'
  }
}

export const getSourceBadge = (source?: string | null): string => {
  switch (normalizeOrigin(source)) {
    case 'rrss': return 'bg-pink-100 text-pink-800 border-pink-200'
    case 'recomendacion': return 'bg-teal-100 text-teal-800 border-teal-200'
    case 'cliente_antiguo': return 'bg-purple-100 text-purple-800 border-purple-200'
    default: return 'bg-blue-100 text-blue-800 border-blue-200'
  }
}
