import { NextRequest, NextResponse } from 'next/server'
import { loadResumeSession } from '@/lib/quoteSession'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id') || ''
  const token = request.nextUrl.searchParams.get('token') || ''
  if (!id || !token) return NextResponse.json({ error: 'Sesión inválida' }, { status: 400 })

  const session = await loadResumeSession(id, token)
  if (!session) return NextResponse.json({ error: 'Sesión no encontrada' }, { status: 404 })

  const state = session.state
  const ids = state.items.map((item) => item.catalogItemId)
  let catalogRows: any[] = []
  if (ids.length) {
    const { data } = await supabaseAdmin.from('catalog_items').select('*').in('id', ids)
    catalogRows = data || []
  }
  const byId = new Map(catalogRows.map((row: any) => [String(row.id), row]))

  const items = state.items.flatMap((selected) => {
    const row = byId.get(selected.catalogItemId)
    if (!row) return []
    return [{
      id: String(row.id),
      name: row.name,
      category: row.category,
      volume: Number(row.volume),
      weight: Number(row.weight),
      quantity: selected.quantity,
      isFragile: Boolean(row.is_fragile),
      isHeavy: Boolean(row.is_heavy),
      isGlass: Boolean(row.is_glass),
      image: row.image || undefined,
    }]
  })

  const combineDateTime = state.schedule.date && state.schedule.time
    ? `${state.schedule.date}T${state.schedule.time}:00`
    : null

  return NextResponse.json({
    currentSection: session.current_section,
    sessionStatus: session.status,
    quoteId: session.quote_id,
    quoteState: {
      personalInfo: {
        name: state.personalInfo.name || '',
        email: state.personalInfo.email || '',
        phone: state.personalInfo.phone,
        isCompany: state.personalInfo.isCompany,
        companyName: state.personalInfo.companyName || undefined,
        companyRut: state.personalInfo.companyRut || undefined,
      },
      dateTime: combineDateTime,
      isFlexible: state.schedule.isFlexible,
      origin: {
        address: state.origin.address.street ? {
          street: state.origin.address.street,
          number: state.origin.address.number || '',
          commune: state.origin.address.commune || '',
          region: state.origin.address.region || 'metropolitana',
          additionalInfo: state.origin.address.additionalInfo || undefined,
        } : null,
        details: state.origin.details.propertyType ? {
          propertyType: state.origin.details.propertyType,
          floor: state.origin.details.floor || 0,
          hasElevator: state.origin.details.hasElevator ?? true,
          parkingDistance: state.origin.details.parkingDistance || 0,
        } : null,
      },
      destination: {
        address: state.destination.address.street ? {
          street: state.destination.address.street,
          number: state.destination.address.number || '',
          commune: state.destination.address.commune || '',
          region: state.destination.address.region || 'metropolitana',
          additionalInfo: state.destination.address.additionalInfo || undefined,
        } : null,
        details: state.destination.details.propertyType ? {
          propertyType: state.destination.details.propertyType,
          floor: state.destination.details.floor || 0,
          hasElevator: state.destination.details.hasElevator ?? true,
          parkingDistance: state.destination.details.parkingDistance || 0,
        } : null,
      },
      items,
      additionalServices: {
        ...state.additionalServices,
        observations: state.additionalServices.observations === '__pending__' ? '' : state.additionalServices.observations,
      },
      totalVolume: Number(session.total_volume || 0),
      totalWeight: Number(session.total_weight || 0),
      totalDistance: Number(session.total_distance || 0),
      estimatedPrice: Number(session.estimated_price || 0),
      recommendedVehicle: session.recommended_vehicle || 'Camioneta',
      isConfirmed: false,
    },
  })
}
