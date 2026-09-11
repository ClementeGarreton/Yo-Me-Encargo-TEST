import { supabaseAdmin } from '@/lib/supabase'

// Datos para el panel público de choferes: SIN precios. Nunca seleccionamos
// total_price / original_price aquí para que no puedan filtrarse al link público.

// "Hoy" en hora de Chile: el server (Vercel) corre en UTC, así que un new Date() naive
// puede caer en el día siguiente durante la noche chilena (mismo criterio que
// /api/admin/today-bookings).
function chileTodayString(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago' }).format(new Date())
}

/** Suma días a una fecha 'YYYY-MM-DD' sin pasar por UTC. */
function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  date.setDate(date.getDate() + days)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate()
  ).padStart(2, '0')}`
}

/**
 * Ventana visible para los choferes: hoy + 3 días = 4 días en total. Se acota a
 * propósito para que no vean toda la agenda futura en un link compartido.
 */
export const DRIVER_WINDOW_DAYS = 4

export interface DriverJobItem {
  name: string
  quantity: number
}

export interface DriverJob {
  id: string
  scheduled_date: string
  scheduled_time: string | null
  client_name: string
  client_phone: string
  booking_type: string
  visit_address: string | null
  origin_address: string
  origin_floor: number | null
  origin_has_elevator: boolean | null
  origin_parking_distance: number | null
  destination_address: string
  destination_floor: number | null
  destination_has_elevator: boolean | null
  destination_parking_distance: number | null
  notes: string | null
  items: DriverJobItem[]
}

export async function getDriverAccessToken(): Promise<string | null> {
  const { data } = await supabaseAdmin.from('fleet_config').select('*').single()
  const token = (data as { driver_access_token?: string | null } | null)?.driver_access_token
  return typeof token === 'string' && token.length > 0 ? token : null
}

export async function getUpcomingDriverJobs(): Promise<DriverJob[]> {
  const today = chileTodayString()
  // Tope de la ventana: hoy + 3 = 4 días visibles.
  const windowEnd = addDays(today, DRIVER_WINDOW_DAYS - 1)

  // Mismo criterio que el dashboard admin ("Reservas de Hoy/Mañana"): no restringir
  // por status confirmed/pending, porque una reserva de hoy puede ya estar marcada
  // 'completed' en el sistema (pago aprobado) y sigue siendo un trabajo real que el
  // chofer necesita ver. Solo excluimos canceladas / no atendidas.
  const { data: bookings } = await supabaseAdmin
    .from('bookings')
    .select(
      'id, quote_id, scheduled_date, scheduled_time, client_name, client_phone, booking_type, visit_address, origin_address, origin_floor, origin_has_elevator, origin_parking_distance, destination_address, destination_floor, destination_has_elevator, destination_parking_distance, notes, is_provisional, status'
    )
    .gte('scheduled_date', today)
    .lte('scheduled_date', windowEnd)
    .not('status', 'in', '(cancelled,no_show)')
    .order('scheduled_date', { ascending: true })
    .order('scheduled_time', { ascending: true })

  // Solo trabajos reales (las pre-reservas sin pagar no ocupan cupo ni son trabajo).
  const rows = (bookings || []).filter((b) => !b.is_provisional)

  // Items a mover viven en quote_prospects (por quote_id).
  const quoteIds = Array.from(
    new Set(rows.map((r) => r.quote_id).filter((q): q is string => Boolean(q)))
  )
  const itemsByQuote = new Map<string, DriverJobItem[]>()

  if (quoteIds.length > 0) {
    const { data: prospects } = await supabaseAdmin
      .from('quote_prospects')
      .select('quote_id, items_summary')
      .in('quote_id', quoteIds)

    for (const p of prospects || []) {
      const raw = (p as { items_summary?: unknown }).items_summary
      const items: DriverJobItem[] = Array.isArray(raw)
        ? raw
            .filter((it): it is { name: string; quantity?: number } =>
              Boolean(it && typeof it === 'object' && 'name' in it && (it as { name?: unknown }).name)
            )
            .map((it) => ({ name: String(it.name), quantity: Number(it.quantity) || 1 }))
        : []
      if (p.quote_id) itemsByQuote.set(p.quote_id, items)
    }
  }

  return rows.map((b) => ({
    id: b.id,
    scheduled_date: b.scheduled_date,
    scheduled_time: b.scheduled_time ?? null,
    client_name: b.client_name || '',
    client_phone: b.client_phone || '',
    booking_type: b.booking_type || 'online',
    visit_address: b.visit_address ?? null,
    origin_address: b.origin_address || '',
    origin_floor: b.origin_floor ?? null,
    origin_has_elevator: b.origin_has_elevator ?? null,
    origin_parking_distance: b.origin_parking_distance ?? null,
    destination_address: b.destination_address || '',
    destination_floor: b.destination_floor ?? null,
    destination_has_elevator: b.destination_has_elevator ?? null,
    destination_parking_distance: b.destination_parking_distance ?? null,
    notes: b.notes ?? null,
    items: itemsByQuote.get(b.quote_id) || [],
  }))
}
