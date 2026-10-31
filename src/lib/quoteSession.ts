import crypto from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import { nextPropertyQuestion } from '@/lib/whatsapp/propertyFlow'

export type PropertyType = 'casa' | 'departamento' | 'oficina' | 'bodega' | 'otro'

export interface QuoteSessionState {
  personalInfo: {
    name: string | null
    email: string | null
    phone: string
    isCompany: boolean
    companyName: string | null
    companyRut: string | null
  }
  schedule: {
    date: string | null
    time: string | null
    isFlexible: boolean
  }
  origin: {
    address: {
      street: string | null
      number: string | null
      commune: string | null
      region: string | null
      additionalInfo: string | null
    }
    details: {
      propertyType: PropertyType | null
      floor: number | null
      hasElevator: boolean | null
      parkingDistance: number | null
    }
  }
  destination: {
    address: {
      street: string | null
      number: string | null
      commune: string | null
      region: string | null
      additionalInfo: string | null
    }
    details: {
      propertyType: PropertyType | null
      floor: number | null
      hasElevator: boolean | null
      parkingDistance: number | null
    }
  }
  items: Array<{ catalogItemId: string; quantity: number }>
  pendingInventory: Array<{
    sourceLabel: string
    quantity: number
    question: string
    suggestions: Array<{ catalogItemId: string; label: string }>
  }>
  additionalServices: {
    disassembly: boolean
    assembly: boolean
    packing: boolean
    unpacking: boolean
    observations: string
    photos: string[]
  }
  confirmed: boolean
}

export interface QuoteSessionRow {
  id: string
  resume_token: string
  channel: 'web' | 'whatsapp'
  phone: string | null
  status: 'collecting' | 'ready' | 'quoted' | 'handoff' | 'closed'
  current_section: number
  state: QuoteSessionState
  quote_id: string | null
  prospect_id: string | null
  estimated_price: number | null
  total_volume: number | null
  total_weight: number | null
  total_distance: number | null
  recommended_vehicle: string | null
  pdf_url: string | null
  created_at: string
  updated_at: string
}

export function createEmptyQuoteState(phone: string): QuoteSessionState {
  return {
    personalInfo: {
      name: null,
      email: null,
      phone,
      isCompany: false,
      companyName: null,
      companyRut: null,
    },
    schedule: { date: null, time: null, isFlexible: false },
    origin: {
      address: { street: null, number: null, commune: null, region: null, additionalInfo: null },
      details: { propertyType: null, floor: null, hasElevator: null, parkingDistance: null },
    },
    destination: {
      address: { street: null, number: null, commune: null, region: null, additionalInfo: null },
      details: { propertyType: null, floor: null, hasElevator: null, parkingDistance: null },
    },
    items: [],
    pendingInventory: [],
    additionalServices: {
      disassembly: false,
      assembly: false,
      packing: false,
      unpacking: false,
      observations: '',
      photos: [],
    },
    confirmed: false,
  }
}

export function getNextSection(state: QuoteSessionState): number {
  if (!state.personalInfo.name || !state.personalInfo.email) return 1
  if (state.personalInfo.isCompany && (!state.personalInfo.companyName || !state.personalInfo.companyRut)) return 1
  if (!state.schedule.date || !state.schedule.time) return 2

  const oa = state.origin.address
  const da = state.destination.address
  if (!oa.street || !oa.number || !oa.commune || !oa.region || !da.street || !da.number || !da.commune || !da.region) return 3

  const od = state.origin.details
  const dd = state.destination.details
  if (!od.propertyType || od.floor === null || od.hasElevator === null || od.parkingDistance === null || !dd.propertyType || dd.floor === null || dd.hasElevator === null || dd.parkingDistance === null) return 4

  if (state.items.length === 0 || state.pendingInventory.length > 0) return 5
  if (state.additionalServices.observations === '__pending__') return 6
  return 7
}

export function sectionQuestion(section: number, state: QuoteSessionState): string {
  switch (section) {
    case 1:
      return '1/7 · Tus datos\n¿Cuál es tu nombre completo y correo electrónico? Tu teléfono ya lo tenemos por WhatsApp. Si cotizas como empresa, dime también razón social y RUT.'
    case 2:
      return '2/7 · Fecha y hora\n¿Qué día y a qué hora quieres realizar la mudanza? Si tienes flexibilidad de fecha, dímelo también.'
    case 3:
      return '3/7 · Direcciones\nIndícame la dirección completa de origen y destino: calle, número, comuna y región de cada una.'
    case 4:
      return nextPropertyQuestion(state.origin.details, state.destination.details)
    case 5:
      return '5/7 · Inventario\n¿Qué muebles y cajas necesitas trasladar? Indícame las cantidades. Usaré tamaños aproximados y podrás corregirlos después.'
    case 6:
      return '6/7 · Extras\n¿Necesitas embalaje, desarme o armado? Si no, responde *NINGUNO*.'
    case 7:
      return `7/7 · Resumen\nYa tengo los datos necesarios. Responde *CONFIRMAR* para generar tu cotización automática en PDF, o dime qué dato quieres corregir.`
    default:
      return 'Cuéntame qué necesitas ajustar de tu cotización.'
  }
}

export async function createWhatsAppSession(phone: string): Promise<QuoteSessionRow> {
  const state = createEmptyQuoteState(phone)
  state.additionalServices.observations = '__pending__'
  const resumeToken = crypto.randomBytes(24).toString('hex')
  const { data, error } = await supabaseAdmin
    .from('quote_sessions')
    .insert({
      resume_token: resumeToken,
      channel: 'whatsapp',
      phone,
      status: 'collecting',
      current_section: 1,
      state,
    })
    .select('*')
    .single()

  if (error || !data) throw new Error(error?.message || 'No se pudo crear la sesión de cotización')
  return data as QuoteSessionRow
}

export async function getOrCreateWhatsAppSession(phone: string): Promise<QuoteSessionRow> {
  const { data: existing } = await supabaseAdmin
    .from('quote_sessions')
    .select('*')
    .eq('channel', 'whatsapp')
    .eq('phone', phone)
    .in('status', ['collecting', 'ready', 'quoted', 'handoff'])
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existing) return existing as QuoteSessionRow
  return createWhatsAppSession(phone)
}

export async function closeQuoteSession(id: string) {
  const { error } = await supabaseAdmin
    .from('quote_sessions')
    .update({ status: 'closed', updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw new Error(`No se pudo cerrar la sesión: ${error.message}`)
}

export async function saveQuoteSession(
  id: string,
  state: QuoteSessionState,
  extra: Record<string, unknown> = {}
): Promise<QuoteSessionRow> {
  const currentSection = getNextSection(state)
  const status = currentSection === 7 ? 'ready' : 'collecting'
  const { data, error } = await supabaseAdmin
    .from('quote_sessions')
    .update({
      state,
      current_section: currentSection,
      status,
      updated_at: new Date().toISOString(),
      ...extra,
    })
    .eq('id', id)
    .select('*')
    .single()

  if (error || !data) throw new Error(error?.message || 'No se pudo actualizar la sesión')
  return data as QuoteSessionRow
}

export async function loadResumeSession(id: string, token: string): Promise<QuoteSessionRow | null> {
  const { data } = await supabaseAdmin
    .from('quote_sessions')
    .select('*')
    .eq('id', id)
    .eq('resume_token', token)
    .maybeSingle()
  return (data as QuoteSessionRow | null) || null
}
