export interface MonthlyPoint {
  month: string   // 'YYYY-MM'
  label: string   // mes corto en español
  count: number
  revenue: number
}

export interface SourceCount {
  source: string
  label: string
  count: number
}

export interface FunnelStage {
  key: string
  label: string
  count: number
}

export interface AttendedCustomer {
  email: string
  name: string
  phone: string
  isCompany: boolean
  companyName: string
  companyRut: string
  movesCount: number
  lastMoveDate: string | null   // 'YYYY-MM-DD'
  firstMoveDate: string | null
  totalSpent: number
}

export interface BookingLike {
  scheduled_date?: string | null
  status?: string | null
  total_price?: number | null
  original_price?: number | null
  client_email?: string | null
  client_name?: string | null
  client_phone?: string | null
  is_company?: boolean | null
  company_name?: string | null
  company_rut?: string | null
  payment_status?: string | null
  payment_type?: string | null
}

// Un booking cuenta como "cliente atendido" si el servicio se marcó completado,
// o si ya pagó el 100% (aunque el admin no haya movido el estado a 'completed').
export function isAttendedBooking(b: BookingLike): boolean {
  if (b.status === 'cancelled') return false
  if (b.status === 'completed') return true
  return b.payment_status === 'approved' && b.payment_type === 'completo'
}

export interface ProspectLike {
  source?: string | null
  status?: string | null
}

const MESES_CORTOS = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']

export function groupBookingsByMonth(bookings: BookingLike[], monthsBack: number): MonthlyPoint[] {
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonthIndex = now.getMonth()

  // Generar los últimos mesesBack meses
  const months: { monthKey: string; label: string }[] = []
  for (let i = monthsBack - 1; i >= 0; i--) {
    const monthIndex = (currentMonthIndex - i + 12) % 12
    const year = currentYear - (currentMonthIndex < i ? 1 : 0)
    const monthKey = `${year}-${String(monthIndex + 1).padStart(2, '0')}`
    const label = MESES_CORTOS[monthIndex]
    
    months.push({ monthKey, label })
  }

  // Agrupar los bookings por mes
  const monthlyMap = new Map<string, { count: number; revenue: number }>()
  
  for (const month of months) {
    monthlyMap.set(month.monthKey, { count: 0, revenue: 0 })
  }

  for (const booking of bookings) {
    if (!booking.scheduled_date || booking.status === 'cancelled') continue

    const monthKey = booking.scheduled_date.slice(0, 7)
    
    if (monthlyMap.has(monthKey)) {
      const bookingMonth = monthlyMap.get(monthKey)!
      
      // Incrementar count y revenue
      bookingMonth.count += 1
      
      const price = (booking.total_price ?? booking.original_price) || 0
      bookingMonth.revenue += price
      
      monthlyMap.set(monthKey, bookingMonth)
    }
  }

  return months.map(({ monthKey, label }) => {
    const { count, revenue } = monthlyMap.get(monthKey)!
    
    return {
      month: monthKey,
      label,
      count,
      revenue
    }
  })
}

export function groupProspectsBySource(prospects: ProspectLike[]): SourceCount[] {
  const sourceMap = new Map<string, number>()
  
  for (const prospect of prospects) {
    const sourceKey = prospect.source || 'sin_origen'
    
    if (!sourceMap.has(sourceKey)) {
      sourceMap.set(sourceKey, 0)
    }
    
    const count = sourceMap.get(sourceKey)!
    sourceMap.set(sourceKey, count + 1)
  }

  const labels: Record<string, string> = {
    web: 'Web',
    pdf_download: 'Descarga PDF',
    email_quote: 'Email',
    checkout_initiated: 'Checkout',
    domicilio: 'Domicilio',
    rrss: 'RRSS',
    recomendacion: 'Recomendación',
    sin_origen: 'Sin origen'
  }

  const result = Array.from(sourceMap.entries()).map(([source, count]) => {
    return {
      source,
      label: labels[source] || source,
      count
    }
  })

  // Ordenar por cantidad descendente (DESC)
  result.sort((a, b) => {
    return b.count - a.count
  })

  return result
}

export function buildFunnel(prospects: ProspectLike[], bookings: BookingLike[]): FunnelStage[] {
  const completedBookings = bookings.filter(b => b.status !== 'cancelled')
  
  const reservationsCount = completedBookings.length
  
  const completedCount = bookings.filter(b => b.status === 'completed').length

  return [
    { key: 'leads', label: 'Leads', count: prospects.length },
    { key: 'reservas', label: 'Reservas', count: reservationsCount },
    { key: 'completadas', label: 'Completadas', count: completedCount }
  ]
}

export function aggregateAttendedCustomers(bookings: BookingLike[]): AttendedCustomer[] {
  const customersMap = new Map<string, { 
    email: string,
    name: string,
    phone: string,
    isCompany: boolean,
    companyName: string,
    companyRut: string,
    movesCount: number,
    lastMoveDate: string | null,
    firstMoveDate: string | null,
    totalSpent: number
  }>()

  for (const booking of bookings) {
    if (!isAttendedBooking(booking)) continue

    const email = (booking.client_email || '').trim().toLowerCase()
    
    if (!email) continue

    const existing = customersMap.get(email)
    
    // Si no existe, inicializar
    if (!existing) {
      customersMap.set(email, {
        email,
        name: booking.client_name || '',
        phone: booking.client_phone || '',
        isCompany: Boolean(booking.is_company),
        companyName: booking.company_name || '',
        companyRut: booking.company_rut || '',
        movesCount: 1,
        lastMoveDate: booking.scheduled_date ?? null,
        firstMoveDate: booking.scheduled_date ?? null,
        totalSpent: (booking.total_price ?? booking.original_price) || 0
      })
    } else {
      // Actualizar existente
      
      const price = (booking.total_price ?? booking.original_price) || 0
      const d = booking.scheduled_date ?? null
      existing.movesCount += 1
      existing.totalSpent += price

      // Datos de identidad: los del booking más reciente (>= para que el primero gane empates)
      if (d && (!existing.lastMoveDate || d >= existing.lastMoveDate)) {
        existing.name = booking.client_name || ''
        existing.phone = booking.client_phone || ''
        existing.isCompany = Boolean(booking.is_company)
        existing.companyName = booking.company_name || ''
        existing.companyRut = booking.company_rut || ''
      }

      // Actualizar fechas min/max (comparación de strings 'YYYY-MM-DD')
      if (d && (!existing.lastMoveDate || d > existing.lastMoveDate)) {
        existing.lastMoveDate = d
      }
      if (d && (!existing.firstMoveDate || d < existing.firstMoveDate)) {
        existing.firstMoveDate = d
      }
    }
  }

  const result = Array.from(customersMap.values())

  // Ordenar por movesCount DESC, y luego totalSpent DESC
  result.sort((a, b) => {
    if (b.movesCount !== a.movesCount) return b.movesCount - a.movesCount
    return b.totalSpent - a.totalSpent
  })

  return result
}