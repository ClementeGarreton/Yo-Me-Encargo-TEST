/**
 * Estado comercial separado del estado técnico de OpenAI.
 * Sin migraciones: cada cambio es un evento inmutable en ai_actions.
 */
export const COMMERCIAL_STATUSES = [
  'REVISAR', 'COTIZANDO', 'NEGOCIACION', 'RESERVADO', 'VENDIDO', 'RECLAMO', 'CERRADO',
] as const
export type CommercialStatus = typeof COMMERCIAL_STATUSES[number]
export type CommercialEvent = {
  conversation_id?: string
  structured_payload: Record<string, unknown> | null
  created_at?: string
}
export const COMMERCIAL_LABELS: Record<CommercialStatus, string> = {
  REVISAR: 'Revisar', COTIZANDO: 'Cotizando', NEGOCIACION: 'Afinando detalles',
  RESERVADO: 'Reservado', VENDIDO: 'Vendido', RECLAMO: 'Reclamo', CERRADO: 'Cerrado',
}
export function isCommercialStatus(value: unknown): value is CommercialStatus {
  return typeof value === 'string' && COMMERCIAL_STATUSES.some(status => status === value)
}
export function eventStatus(event: CommercialEvent | null | undefined): CommercialStatus {
  const status = event?.structured_payload?.to
  return isCommercialStatus(status) ? status : 'REVISAR'
}
export function lastStatuses(events: CommercialEvent[]): Record<string, CommercialStatus> {
  const statuses: Record<string, CommercialStatus> = {}
  // La consulta viene ordenada por fecha descendente; el primero es el más reciente.
  for (const event of events) {
    const id = event.conversation_id
    if (id && !(id in statuses)) statuses[id] = eventStatus(event)
  }
  return statuses
}
