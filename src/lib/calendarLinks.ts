// Genera enlaces de calendario para una reserva SIN API ni credenciales:
//  - buildGoogleCalendarUrl: URL "Agregar a Google Calendar" (se abre en el navegador).
//  - buildIcsContent: contenido .ics (VEVENT) válido para Apple/Outlook/Google.
// Isomórfico (no usa APIs de navegador); el Blob/descarga se maneja en el componente.

const TIME_ZONE = 'America/Santiago'

export interface CalendarBooking {
  quote_id?: string | null
  client_name?: string | null
  client_phone?: string | null
  scheduled_date?: string | null // YYYY-MM-DD
  scheduled_time?: string | null // HH:MM[:SS]
  duration_hours?: number | null
  origin_address?: string | null
  destination_address?: string | null
  visit_address?: string | null
  booking_type?: string | null // 'online' | 'domicilio'
  total_price?: number | string | null
}

const pad = (n: number) => String(n).padStart(2, '0')

const isDomicilio = (b: CalendarBooking) =>
  b.booking_type === 'domicilio' || Boolean(b.quote_id?.startsWith('DOMICILIO-'))

/** Suma horas a una fecha/hora de pared (wall-clock) y devuelve componentes YYYYMMDD / HHMMSS. */
function shiftWallClock(dateStr: string, timeStr: string, hours: number) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const [hh, mm] = (timeStr || '09:00').slice(0, 5).split(':').map(Number)
  // La TZ del entorno se cancela: metemos wall-clock y sacamos wall-clock; solo sumamos horas.
  const dt = new Date(y, (m || 1) - 1, d || 1, hh || 0, mm || 0)
  dt.setHours(dt.getHours() + hours)
  return {
    date: `${dt.getFullYear()}${pad(dt.getMonth() + 1)}${pad(dt.getDate())}`,
    time: `${pad(dt.getHours())}${pad(dt.getMinutes())}00`,
  }
}

/** 'YYYY-MM-DD' + 'HH:MM' => 'YYYYMMDDTHHMMSS' (hora local de Chile, sin sufijo Z). */
function toCalDateTime(dateStr: string, timeStr: string) {
  const date = dateStr.replace(/-/g, '')
  const time = (timeStr || '09:00').slice(0, 5).replace(':', '') + '00'
  return `${date}T${time}`
}

function durationOf(b: CalendarBooking): number {
  if (typeof b.duration_hours === 'number' && b.duration_hours > 0) return b.duration_hours
  return isDomicilio(b) ? 1 : 4
}

function locationOf(b: CalendarBooking): string {
  if (isDomicilio(b)) return b.visit_address || ''
  const parts = [b.origin_address, b.destination_address].filter(Boolean)
  return parts.join(' → ')
}

function titleOf(b: CalendarBooking): string {
  const who = b.client_name || 'Cliente'
  return isDomicilio(b) ? `Visita a domicilio — ${who}` : `Mudanza — ${who}`
}

function descriptionLines(b: CalendarBooking): string[] {
  const lines: string[] = []
  if (b.client_name) lines.push(`Cliente: ${b.client_name}`)
  if (b.client_phone) lines.push(`Teléfono: ${b.client_phone}`)
  const price = typeof b.total_price === 'string' ? Number(b.total_price) : b.total_price
  if (price && Number.isFinite(price)) lines.push(`Precio: $${Math.round(price).toLocaleString('es-CL')}`)
  if (b.quote_id) lines.push(`Reserva: ${b.quote_id}`)
  return lines
}

/** URL para "Agregar a Google Calendar". `ctz` fuerza la interpretación en hora de Chile. */
export function buildGoogleCalendarUrl(b: CalendarBooking): string {
  const date = (b.scheduled_date || '').slice(0, 10)
  if (!date) return ''
  const time = (b.scheduled_time || '09:00').slice(0, 5)
  const start = toCalDateTime(date, time)
  const endParts = shiftWallClock(date, time, durationOf(b))
  const end = `${endParts.date}T${endParts.time}`

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: titleOf(b),
    dates: `${start}/${end}`,
    details: descriptionLines(b).join('\n'),
    location: locationOf(b),
    ctz: TIME_ZONE,
  })
  return `https://calendar.google.com/calendar/render?${params.toString()}`
}

/** Escapa texto para un valor de propiedad iCalendar (RFC 5545). */
function escapeIcs(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n')
}

/** Contenido de un archivo .ics con un VEVENT para la reserva. */
export function buildIcsContent(b: CalendarBooking): string {
  const date = (b.scheduled_date || '').slice(0, 10)
  const time = (b.scheduled_time || '09:00').slice(0, 5)
  const start = toCalDateTime(date, time)
  const endParts = shiftWallClock(date, time, durationOf(b))
  const end = `${endParts.date}T${endParts.time}`

  const now = new Date()
  const stamp =
    `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}` +
    `T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`
  const uid = `${b.quote_id || start}@yomeencargo`

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Yo Me Encargo//Reservas//ES',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${stamp}`,
    `DTSTART;TZID=${TIME_ZONE}:${start}`,
    `DTEND;TZID=${TIME_ZONE}:${end}`,
    `SUMMARY:${escapeIcs(titleOf(b))}`,
    `DESCRIPTION:${escapeIcs(descriptionLines(b).join('\n'))}`,
    `LOCATION:${escapeIcs(locationOf(b))}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ]
  // RFC 5545 usa CRLF como separador de línea.
  return lines.join('\r\n')
}

/** Nombre de archivo sugerido para el .ics de una reserva. */
export function icsFileName(b: CalendarBooking): string {
  const who = (b.client_name || 'reserva').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '_')
  const date = (b.scheduled_date || '').slice(0, 10)
  return `Mudanza_${who}_${date}.ics`
}
