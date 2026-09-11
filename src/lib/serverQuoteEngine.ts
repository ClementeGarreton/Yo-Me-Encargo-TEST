import crypto from 'crypto'
import jsPDF from 'jspdf'
import { supabaseAdmin } from '@/lib/supabase'
import { MAPS_CONFIG } from '@/config/maps'
import type { QuoteSessionRow, QuoteSessionState } from '@/lib/quoteSession'

interface ServerPricingConfig {
  basePrice: number
  pricePerCubicMeter: number
  pricePerKilometer: number
  freeKilometers: number
  floorSurcharge: number
  additionalServices: { disassembly: number; assembly: number; packing: number; unpacking: number }
  specialPackaging: { fragile: number; electronics: number; artwork: number }
  timeSurcharges: { saturday: number; sunday: number; holiday: number }
  discounts: { flexibility: number; advanceBooking: number; repeatCustomer: number }
}

interface CatalogRow {
  id: string | number
  name: string
  volume: number | string
  weight: number | string
  is_fragile: boolean | null
  is_glass: boolean | null
}

export interface ServerQuoteResult {
  quoteId: string
  estimatedPrice: number
  totalVolume: number
  totalWeight: number
  totalDistance: number
  recommendedVehicle: string
  items: Array<{ id: string; name: string; quantity: number; volume: number; weight: number; isFragile: boolean; isGlass: boolean }>
  prospectId: string
  pdfUrl: string
  pdfFileName: string
}

async function getServerPricing(): Promise<ServerPricingConfig> {
  const { data } = await supabaseAdmin
    .from('pricing_config')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return {
    basePrice: Number(data?.base_price ?? 50000),
    pricePerCubicMeter: Number(data?.price_per_cubic_meter ?? 15000),
    pricePerKilometer: Number(data?.price_per_kilometer ?? 800),
    freeKilometers: Number(data?.free_kilometers ?? 50),
    floorSurcharge: Number(data?.floor_surcharge ?? 5000),
    additionalServices: {
      disassembly: Number(data?.additional_services?.disassembly ?? 15000),
      assembly: Number(data?.additional_services?.assembly ?? 15000),
      packing: Number(data?.additional_services?.packing ?? 25000),
      unpacking: Number(data?.additional_services?.unpacking ?? 20000),
    },
    specialPackaging: {
      fragile: Number(data?.special_packaging?.fragile ?? 10000),
      electronics: Number(data?.special_packaging?.electronics ?? 15000),
      artwork: Number(data?.special_packaging?.artwork ?? 25000),
    },
    timeSurcharges: {
      saturday: Number(data?.time_surcharges?.saturday ?? 20),
      sunday: Number(data?.time_surcharges?.sunday ?? 50),
      holiday: Number(data?.time_surcharges?.holiday ?? 100),
    },
    discounts: {
      flexibility: Number(data?.discounts?.flexibility ?? 10),
      advanceBooking: Number(data?.discounts?.advanceBooking ?? 5),
      repeatCustomer: Number(data?.discounts?.repeatCustomer ?? 15),
    },
  }
}

function addressText(address: QuoteSessionState['origin']['address']) {
  return [address.street, address.number, address.commune, address.region, 'Chile'].filter(Boolean).join(', ')
}

async function geocode(address: QuoteSessionState['origin']['address']) {
  if (!MAPS_CONFIG.apiKey) return null
  const url = new URL(MAPS_CONFIG.geocodingUrl)
  url.searchParams.set('text', addressText(address))
  url.searchParams.set('apiKey', MAPS_CONFIG.apiKey)
  url.searchParams.set('lang', 'es')
  url.searchParams.set('filter', 'countrycode:cl')
  url.searchParams.set('limit', '1')
  const response = await fetch(url.toString())
  if (!response.ok) return null
  const data = await response.json()
  const coordinates = data?.features?.[0]?.geometry?.coordinates
  return coordinates ? { lat: coordinates[1], lng: coordinates[0] } : null
}

async function calculateDistance(state: QuoteSessionState) {
  if (!MAPS_CONFIG.apiKey) return 10
  try {
    const [origin, destination] = await Promise.all([geocode(state.origin.address), geocode(state.destination.address)])
    if (!origin || !destination) return 10
    const url = new URL(MAPS_CONFIG.distanceMatrixUrl)
    url.searchParams.set('waypoints', `${origin.lat},${origin.lng}|${destination.lat},${destination.lng}`)
    url.searchParams.set('mode', 'drive')
    url.searchParams.set('apiKey', MAPS_CONFIG.apiKey)
    const response = await fetch(url.toString())
    if (!response.ok) return 10
    const data = await response.json()
    const meters = Number(data?.features?.[0]?.properties?.distance || 0)
    return meters > 0 ? Math.round((meters / 1000) * 100) / 100 : 10
  } catch {
    return 10
  }
}

async function calculate(state: QuoteSessionState) {
  const ids = state.items.map((item) => item.catalogItemId)
  const { data: rows, error } = await supabaseAdmin
    .from('catalog_items')
    .select('id,name,volume,weight,is_fragile,is_glass,is_active')
    .in('id', ids)
    .eq('is_active', true)
  if (error) throw new Error(error.message)

  const byId = new Map<string, CatalogRow>((rows || []).map((row: any) => [String(row.id), row as CatalogRow]))
  const items = state.items
    .map((selected) => {
      const row = byId.get(selected.catalogItemId)
      if (!row) return null
      return {
        id: String(row.id),
        name: row.name,
        quantity: selected.quantity,
        volume: Number(row.volume),
        weight: Number(row.weight),
        isFragile: Boolean(row.is_fragile),
        isGlass: Boolean(row.is_glass),
      }
    })
    .filter(Boolean) as ServerQuoteResult['items']

  if (!items.length) throw new Error('El inventario no contiene items válidos del catálogo')

  const pricing = await getServerPricing()
  const totalVolume = items.reduce((sum, item) => sum + item.volume * item.quantity, 0)
  const totalWeight = items.reduce((sum, item) => sum + item.weight * item.quantity, 0)
  const totalDistance = await calculateDistance(state)

  let recommendedVehicle = 'Camioneta'
  if (totalVolume > 20) recommendedVehicle = 'Furgón Grande'
  else if (totalVolume > 10) recommendedVehicle = 'Furgón Mediano'
  else if (totalVolume > 5) recommendedVehicle = 'Camioneta Grande'

  let price = pricing.basePrice + totalVolume * pricing.pricePerCubicMeter
  price += Math.max(0, totalDistance - pricing.freeKilometers) * pricing.pricePerKilometer

  if (state.origin.details.floor && state.origin.details.hasElevator === false) {
    price += state.origin.details.floor * pricing.floorSurcharge
  }
  if (state.destination.details.floor && state.destination.details.hasElevator === false) {
    price += state.destination.details.floor * pricing.floorSurcharge
  }

  if (state.schedule.date) {
    const day = new Date(`${state.schedule.date}T12:00:00-03:00`).getDay()
    // Mantiene la misma regla vigente del cotizador web: sábado y domingo usan el recargo de sábado.
    if (day === 6 || day === 0) price += (price * pricing.timeSurcharges.saturday) / 100
  }

  if (state.additionalServices.disassembly) price += pricing.additionalServices.disassembly
  if (state.additionalServices.assembly) price += pricing.additionalServices.assembly

  const fragileCount = items.filter((item) => item.isFragile || item.isGlass).length
  price += fragileCount * pricing.specialPackaging.fragile

  if (state.schedule.isFlexible) price -= (price * pricing.discounts.flexibility) / 100
  if (state.personalInfo.isCompany) price *= 1.19

  return {
    estimatedPrice: Math.round(price),
    totalVolume: Math.round(totalVolume * 100) / 100,
    totalWeight: Math.round(totalWeight * 100) / 100,
    totalDistance,
    recommendedVehicle,
    items,
  }
}

function generateQuotePdfBuffer(state: QuoteSessionState, quote: Awaited<ReturnType<typeof calculate>>, quoteId: string) {
  const pdf = new jsPDF('p', 'mm', 'a4')
  const width = pdf.internal.pageSize.getWidth()
  let y = 18

  pdf.setFillColor(111, 168, 220)
  pdf.rect(0, 0, width, 38, 'F')
  pdf.setTextColor(255, 255, 255)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(22)
  pdf.text('COTIZACION DE MUDANZA', width / 2, 15, { align: 'center' })
  pdf.setFontSize(11)
  pdf.setFont('helvetica', 'normal')
  pdf.text(`Yo Me Encargo · ${quoteId}`, width / 2, 25, { align: 'center' })
  pdf.text(`Emitida: ${new Date().toLocaleDateString('es-CL')}`, width / 2, 32, { align: 'center' })

  y = 50
  pdf.setTextColor(20, 20, 20)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(14)
  pdf.text('Cliente', 18, y)
  y += 8
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(10)
  pdf.text(`Nombre: ${state.personalInfo.name || ''}`, 18, y); y += 6
  pdf.text(`Email: ${state.personalInfo.email || ''}`, 18, y); y += 6
  pdf.text(`Telefono: ${state.personalInfo.phone}`, 18, y); y += 9

  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(14)
  pdf.text('Mudanza', 18, y); y += 8
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(10)
  pdf.text(`Fecha: ${state.schedule.date || ''} · ${state.schedule.time || ''}`, 18, y); y += 6
  pdf.text(`Origen: ${addressText(state.origin.address)}`, 18, y, { maxWidth: 175 }); y += 8
  pdf.text(`Destino: ${addressText(state.destination.address)}`, 18, y, { maxWidth: 175 }); y += 8
  pdf.text(`Distancia estimada: ${quote.totalDistance} km`, 18, y); y += 9

  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(14)
  pdf.text('Inventario', 18, y); y += 7
  pdf.setFontSize(9)
  pdf.setFont('helvetica', 'normal')
  for (const item of quote.items) {
    if (y > 250) { pdf.addPage(); y = 20 }
    pdf.text(`${item.quantity} x ${item.name} · ${(item.volume * item.quantity).toFixed(2)} m3`, 20, y)
    y += 5.5
  }

  y += 4
  pdf.setDrawColor(220, 220, 220)
  pdf.line(18, y, width - 18, y)
  y += 9
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(12)
  pdf.text(`Volumen estimado: ${quote.totalVolume.toFixed(2)} m3`, 18, y); y += 7
  pdf.text(`Peso estimado: ${quote.totalWeight.toFixed(0)} kg`, 18, y); y += 7
  pdf.text(`Vehiculo sugerido: ${quote.recommendedVehicle}`, 18, y); y += 9
  pdf.setFontSize(20)
  pdf.setTextColor(63, 98, 18)
  pdf.text(`Precio estimado: $${quote.estimatedPrice.toLocaleString('es-CL')}`, 18, y)

  pdf.setTextColor(80, 80, 80)
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(8)
  pdf.text('Valor estimativo sujeto a validacion de volumen, accesos, disponibilidad y condiciones reales del servicio.', 18, 282, { maxWidth: 175 })
  pdf.text('Afina los detalles de tu mudanza con nuestro ejecutivo en WhatsApp: +56 9 5439 0267', 18, 288, { maxWidth: 175 })

  return Buffer.from(pdf.output('arraybuffer'))
}

async function upsertProspect(state: QuoteSessionState, quoteId: string, quote: Awaited<ReturnType<typeof calculate>>) {
  const email = state.personalInfo.email!.toLowerCase().trim()
  const rawKey = `${email}|${state.schedule.date || ''}|${addressText(state.origin.address)}|${addressText(state.destination.address)}|`
  const leadKey = crypto.createHash('md5').update(rawKey).digest('hex')
  const { data, error } = await supabaseAdmin
    .from('quote_prospects')
    .upsert({
      source: 'whatsapp',
      quote_id: quoteId,
      name: state.personalInfo.name!,
      email,
      phone: state.personalInfo.phone,
      is_company: state.personalInfo.isCompany,
      company_name: state.personalInfo.isCompany ? state.personalInfo.companyName : null,
      company_rut: state.personalInfo.isCompany ? state.personalInfo.companyRut : null,
      origin_address: addressText(state.origin.address),
      destination_address: addressText(state.destination.address),
      origin_floor: state.origin.details.floor,
      origin_has_elevator: state.origin.details.hasElevator,
      origin_parking_distance: state.origin.details.parkingDistance,
      destination_floor: state.destination.details.floor,
      destination_has_elevator: state.destination.details.hasElevator,
      destination_parking_distance: state.destination.details.parkingDistance,
      scheduled_date: state.schedule.date,
      scheduled_time: state.schedule.time,
      total_price: quote.estimatedPrice,
      original_price: quote.estimatedPrice,
      is_flexible: state.schedule.isFlexible,
      recommended_vehicle: quote.recommendedVehicle,
      total_volume: quote.totalVolume,
      total_weight: quote.totalWeight,
      total_distance: quote.totalDistance,
      items_summary: quote.items.map((item) => ({ name: item.name, quantity: item.quantity, volume: item.volume })),
      additional_services: state.additionalServices,
      lead_key: leadKey,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'lead_key', ignoreDuplicates: false })
    .select('id')
    .single()
  if (error || !data) throw new Error(error?.message || 'No se pudo guardar el prospecto')
  return data.id as string
}

async function uploadPdf(buffer: Buffer, prospectId: string, quoteId: string) {
  const fileName = `Cotizacion_WhatsApp_${quoteId}.pdf`
  const filePath = `prospect-pdfs/whatsapp_${prospectId}_${Date.now()}.pdf`
  const { error } = await supabaseAdmin.storage.from('bookings').upload(filePath, buffer, {
    contentType: 'application/pdf',
    upsert: true,
  })
  if (error) throw new Error(error.message)
  const { data } = supabaseAdmin.storage.from('bookings').getPublicUrl(filePath)
  const pdfUrl = data.publicUrl
  await supabaseAdmin.from('quote_prospects').update({ pdf_url: pdfUrl, pdf_generated_at: new Date().toISOString() }).eq('id', prospectId)
  return { pdfUrl, fileName }
}

export async function generateQuoteFromSession(session: QuoteSessionRow): Promise<ServerQuoteResult> {
  const state = session.state
  if (!state.personalInfo.name || !state.personalInfo.email || !state.schedule.date || !state.schedule.time) {
    throw new Error('La sesión todavía no tiene los datos mínimos para cotizar')
  }

  const quote = await calculate(state)
  const quoteId = session.quote_id || `YME-WA-${Date.now().toString(36).toUpperCase()}`
  const prospectId = await upsertProspect(state, quoteId, quote)
  const buffer = generateQuotePdfBuffer(state, quote, quoteId)
  const { pdfUrl, fileName } = await uploadPdf(buffer, prospectId, quoteId)

  await supabaseAdmin
    .from('quote_sessions')
    .update({
      status: 'quoted',
      quote_id: quoteId,
      prospect_id: prospectId,
      estimated_price: quote.estimatedPrice,
      total_volume: quote.totalVolume,
      total_weight: quote.totalWeight,
      total_distance: quote.totalDistance,
      recommended_vehicle: quote.recommendedVehicle,
      pdf_url: pdfUrl,
      updated_at: new Date().toISOString(),
    })
    .eq('id', session.id)

  return { quoteId, prospectId, pdfUrl, pdfFileName: fileName, ...quote }
}
