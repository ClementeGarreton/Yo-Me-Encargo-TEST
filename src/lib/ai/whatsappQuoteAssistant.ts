import { supabaseAdmin } from '@/lib/supabase'
import { createStructuredResponseWithUsage, type AiUsage } from '@/lib/ai/openai'
import { buildInventoryAssistantPrompt } from '@/lib/ai/prompts'
import { sectionQuestion, type QuoteSessionState, type PropertyType } from '@/lib/quoteSession'
import { applyFocusedPropertyFallback, completeOneStoryHouse, pendingPropertyPlace } from '@/lib/whatsapp/propertyFlow'

const nullableString = { type: ['string', 'null'] }
const nullableBoolean = { type: ['boolean', 'null'] }
const nullableNumber = { type: ['number', 'null'] }
const nullableRegion = {
  type: ['string', 'null'],
  enum: ['arica', 'tarapaca', 'antofagasta', 'atacama', 'coquimbo', 'valparaiso', 'metropolitana', 'ohiggins', 'maule', 'nuble', 'biobio', 'araucania', 'losrios', 'loslagos', 'aysen', 'magallanes', null],
}

const patchSchema = {
  type: 'object',
  properties: {
    name: nullableString,
    email: nullableString,
    isCompany: nullableBoolean,
    companyName: nullableString,
    companyRut: nullableString,
    date: nullableString,
    time: nullableString,
    isFlexible: nullableBoolean,
    originStreet: nullableString,
    originNumber: nullableString,
    originCommune: nullableString,
    originRegion: nullableRegion,
    originAdditionalInfo: nullableString,
    destinationStreet: nullableString,
    destinationNumber: nullableString,
    destinationCommune: nullableString,
    destinationRegion: nullableRegion,
    destinationAdditionalInfo: nullableString,
    originPropertyType: { type: ['string', 'null'], enum: ['casa', 'departamento', 'oficina', 'bodega', 'otro', null] },
    originFloor: { type: ['integer', 'null'], minimum: 0, maximum: 100 },
    originHasElevator: nullableBoolean,
    originParkingDistance: nullableNumber,
    destinationPropertyType: { type: ['string', 'null'], enum: ['casa', 'departamento', 'oficina', 'bodega', 'otro', null] },
    destinationFloor: { type: ['integer', 'null'], minimum: 0, maximum: 100 },
    destinationHasElevator: nullableBoolean,
    destinationParkingDistance: nullableNumber,
    disassembly: nullableBoolean,
    assembly: nullableBoolean,
    packing: nullableBoolean,
    unpacking: nullableBoolean,
    observations: nullableString,
    servicesAnswered: { type: 'boolean' },
    explicitConfirmation: { type: 'boolean' },
    requestHuman: { type: 'boolean' },
    normalizedSummary: { type: 'string' },
  },
  required: [
    'name', 'email', 'isCompany', 'companyName', 'companyRut', 'date', 'time', 'isFlexible',
    'originStreet', 'originNumber', 'originCommune', 'originRegion', 'originAdditionalInfo',
    'destinationStreet', 'destinationNumber', 'destinationCommune', 'destinationRegion', 'destinationAdditionalInfo',
    'originPropertyType', 'originFloor', 'originHasElevator', 'originParkingDistance',
    'destinationPropertyType', 'destinationFloor', 'destinationHasElevator', 'destinationParkingDistance',
    'disassembly', 'assembly', 'packing', 'unpacking', 'observations', 'servicesAnswered',
    'explicitConfirmation', 'requestHuman', 'normalizedSummary',
  ],
  additionalProperties: false,
}

type GeneralPatch = {
  name: string | null
  email: string | null
  isCompany: boolean | null
  companyName: string | null
  companyRut: string | null
  date: string | null
  time: string | null
  isFlexible: boolean | null
  originStreet: string | null
  originNumber: string | null
  originCommune: string | null
  originRegion: string | null
  originAdditionalInfo: string | null
  destinationStreet: string | null
  destinationNumber: string | null
  destinationCommune: string | null
  destinationRegion: string | null
  destinationAdditionalInfo: string | null
  originPropertyType: PropertyType | null
  originFloor: number | null
  originHasElevator: boolean | null
  originParkingDistance: number | null
  destinationPropertyType: PropertyType | null
  destinationFloor: number | null
  destinationHasElevator: boolean | null
  destinationParkingDistance: number | null
  disassembly: boolean | null
  assembly: boolean | null
  packing: boolean | null
  unpacking: boolean | null
  observations: string | null
  servicesAnswered: boolean
  explicitConfirmation: boolean
  requestHuman: boolean
  normalizedSummary: string
}

function generalPrompt(section: number, state: QuoteSessionState) {
  return `
Eres el parser estructurado del cotizador de Yo Me Encargo en WhatsApp.
Tu tarea es EXTRAER datos del último mensaje del cliente y devolverlos en el schema. No inventes información.

Estamos en la sección ${section}/7. Fecha actual de referencia: ${new Date().toISOString()}.
${section === 4 ? `Pregunta específica que se le hizo al cliente:
${sectionQuestion(4, state)}` : ''}
El cliente está en Chile. Interpreta fechas relativas como "mañana" o "el viernes" en contexto chileno y devuelve YYYY-MM-DD. Hora en HH:mm de 24 horas.

Reglas:
- Si un dato no aparece claramente en el mensaje actual, devuelve null. No repitas datos del estado sólo por existir.
- Para direcciones separa calle, número y comuna. region debe usar uno de los códigos admitidos por el formulario (metropolitana, valparaiso, biobio, etc.). Puedes inferir la región cuando la comuna o ciudad la haga inequívoca; por ejemplo Providencia/Las Condes/Ñuñoa/Santiago => metropolitana. Si no puedes determinarla con confianza, null.
- propertyType sólo puede ser casa, departamento, oficina, bodega u otro.
- "sin ascensor", "por escalera" => hasElevator=false. "con ascensor" => true.
- EN SECCIÓN 4 LA PREGUNTA SE FORMULA DE A UN LUGAR POR VEZ: "retiro (origen)" o "entrega (destino)". Si la respuesta no nombra lugar, atribuye los datos SOLO al lugar preguntado. Nunca copies respuestas de un lugar al otro.
- Casa de un piso ("un piso", "una planta") => floor=1 y hasElevator=false. No supongas que un departamento no tiene ascensor.
- Si el cliente afirma que el camión puede estacionarse en la puerta, parkingDistance=0; "a 20 metros" = 20. No infieras la distancia de solo mencionar una entrada.
- Conserva lo que ya se sabía del estado: devuelve null para campos que el cliente no está modificando, no inventes datos faltantes.
- parkingDistance es una cantidad numérica exacta de metros. Si el cliente dice "a unos 10 metros" devuelve 10, NO redondees a las opciones del formulario web. Si no está claro, null.
- Si estás preguntando por el ascensor y el cliente responde "Sí, a 10 metros", registra hasElevator=true Y parkingDistance=10 para el lugar consultado. Si responde sólo la distancia, extrae ésta y deja pendiente únicamente el ascensor.
- Servicios: desarme=disassembly, armado=assembly, embalaje=packing, desembalaje=unpacking. Si responde "ninguno", marca los cuatro false y servicesAnswered=true.
- servicesAnswered=true sólo cuando el mensaje responde efectivamente la sección de servicios, aunque sea "ninguno".
- explicitConfirmation=true sólo si confirma inequívocamente generar/finalizar la cotización (por ejemplo "confirmar", "sí, generar").
- requestHuman=true si pide hablar con una persona/ejecutivo o solicita atención humana explícita.
- normalizedSummary: una frase breve sobre lo que entendiste del mensaje actual; no inventes.

Estado actual (sólo contexto, NO lo copies a los campos de salida):
${JSON.stringify(state)}
`
}

function assignIf<T extends object, K extends keyof T>(obj: T, key: K, value: T[K] | null) {
  if (value !== null && value !== undefined) obj[key] = value
}

export async function parseGeneralWhatsAppTurn(section: number, state: QuoteSessionState, text: string) {
  const { data, usage } = await createStructuredResponseWithUsage<GeneralPatch>({
    instructions: generalPrompt(section, state),
    input: [{ role: 'user', content: text }],
    schemaName: 'whatsapp_quote_patch',
    schema: patchSchema,
    reasoningEffort: 'none',
    maxOutputTokens: 1600,
  })

  const next: QuoteSessionState = JSON.parse(JSON.stringify(state))
  assignIf(next.personalInfo, 'name', data.name)
  assignIf(next.personalInfo, 'email', data.email)
  assignIf(next.personalInfo, 'isCompany', data.isCompany)
  assignIf(next.personalInfo, 'companyName', data.companyName)
  assignIf(next.personalInfo, 'companyRut', data.companyRut)
  assignIf(next.schedule, 'date', data.date)
  assignIf(next.schedule, 'time', data.time)
  assignIf(next.schedule, 'isFlexible', data.isFlexible)

  assignIf(next.origin.address, 'street', data.originStreet)
  assignIf(next.origin.address, 'number', data.originNumber)
  assignIf(next.origin.address, 'commune', data.originCommune)
  assignIf(next.origin.address, 'region', data.originRegion)
  assignIf(next.origin.address, 'additionalInfo', data.originAdditionalInfo)

  assignIf(next.destination.address, 'street', data.destinationStreet)
  assignIf(next.destination.address, 'number', data.destinationNumber)
  assignIf(next.destination.address, 'commune', data.destinationCommune)
  assignIf(next.destination.address, 'region', data.destinationRegion)
  assignIf(next.destination.address, 'additionalInfo', data.destinationAdditionalInfo)

  // En la etapa 4, solamente se escribe el lugar que se está preguntando.
  // Esto evita atribuir al destino una contestación sobre el retiro.
  const propertyFocus = section === 4 ? pendingPropertyPlace(state.origin.details, state.destination.details) : null
  if (section !== 4 || propertyFocus === 'origin') {
    assignIf(next.origin.details, 'propertyType', data.originPropertyType)
    assignIf(next.origin.details, 'floor', data.originFloor)
    assignIf(next.origin.details, 'hasElevator', data.originHasElevator)
    assignIf(next.origin.details, 'parkingDistance', data.originParkingDistance)
  }
  if (section !== 4 || propertyFocus === 'destination') {
    assignIf(next.destination.details, 'propertyType', data.destinationPropertyType)
    assignIf(next.destination.details, 'floor', data.destinationFloor)
    assignIf(next.destination.details, 'hasElevator', data.destinationHasElevator)
    assignIf(next.destination.details, 'parkingDistance', data.destinationParkingDistance)
  }
  // Recupera los datos explícitos omitidos o redondeados por el modelo,
  // usando el lugar que estaba pendiente ANTES de actualizar el estado.
  if (section === 4) {
    applyFocusedPropertyFallback(state.origin.details, state.destination.details, next.origin.details, next.destination.details, text)
  }
  completeOneStoryHouse(next.origin.details)
  completeOneStoryHouse(next.destination.details)

  assignIf(next.additionalServices, 'disassembly', data.disassembly)
  assignIf(next.additionalServices, 'assembly', data.assembly)
  assignIf(next.additionalServices, 'packing', data.packing)
  assignIf(next.additionalServices, 'unpacking', data.unpacking)
  if (data.servicesAnswered) {
    next.additionalServices.observations = data.observations || ''
  } else if (data.observations !== null && next.additionalServices.observations !== '__pending__') {
    next.additionalServices.observations = data.observations
  }

  if (data.explicitConfirmation) next.confirmed = true

  return { state: next, patch: data, usage }
}

const inventorySchema = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          catalogItemId: { type: 'string' },
          quantity: { type: 'integer', minimum: 1, maximum: 100 },
          confidence: { type: 'number', minimum: 0, maximum: 1 },
          evidence: { type: 'string' },
        },
        required: ['catalogItemId', 'quantity', 'confidence', 'evidence'],
        additionalProperties: false,
      },
    },
    unresolved: { type: 'array', items: { type: 'string' } },
    pendingResolutions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          sourceLabel: { type: 'string' },
          quantity: { type: 'integer', minimum: 1, maximum: 100 },
          reason: { type: 'string', enum: ['ambiguous', 'not_found'] },
          question: { type: 'string' },
          suggestions: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                catalogItemId: { type: 'string' },
                confidence: { type: 'number', minimum: 0, maximum: 1 },
                reason: { type: 'string' },
              },
              required: ['catalogItemId', 'confidence', 'reason'],
              additionalProperties: false,
            },
          },
        },
        required: ['sourceLabel', 'quantity', 'reason', 'question', 'suggestions'],
        additionalProperties: false,
      },
    },
    clarificationQuestion: { type: ['string', 'null'] },
  },
  required: ['summary', 'items', 'unresolved', 'pendingResolutions', 'clarificationQuestion'],
  additionalProperties: false,
}

type InventoryAiResult = {
  summary: string
  items: Array<{ catalogItemId: string; quantity: number; confidence: number; evidence: string }>
  unresolved: string[]
  pendingResolutions: Array<{
    sourceLabel: string
    quantity: number
    reason: 'ambiguous' | 'not_found'
    question: string
    suggestions: Array<{ catalogItemId: string; confidence: number; reason: string }>
  }>
  clarificationQuestion: string | null
}

interface WhatsAppCatalogEntry {
  id: string
  name: string
  category: string
  volume: number
  weight: number
}

export async function parseWhatsAppInventory(text: string, imageDataUrl?: string | null): Promise<{
  statePatch: Pick<QuoteSessionState, 'items' | 'pendingInventory'>
  summary: string
  usage: AiUsage
}> {
  const { data: rows, error } = await supabaseAdmin
    .from('catalog_items')
    .select('id,name,category,volume,weight,is_active')
    .eq('is_active', true)
    .order('name')
  if (error) throw new Error(error.message)

  const catalog: WhatsAppCatalogEntry[] = (rows || []).map((row: any) => ({
    id: String(row.id),
    name: row.name,
    category: row.category,
    volume: Number(row.volume),
    weight: Number(row.weight),
  }))
  const byId = new Map<string, WhatsAppCatalogEntry>(catalog.map((item: WhatsAppCatalogEntry) => [item.id, item]))

  const content: any[] = []
  if (text.trim()) content.push({ type: 'input_text', text: text.trim() })
  if (imageDataUrl) content.push({ type: 'input_image', image_url: imageDataUrl, detail: 'low' })

  const { data, usage } = await createStructuredResponseWithUsage<InventoryAiResult>({
    instructions: buildInventoryAssistantPrompt(catalog),
    input: [{ role: 'user', content }],
    schemaName: 'whatsapp_inventory_parser',
    schema: inventorySchema,
    reasoningEffort: 'none',
    maxOutputTokens: 900,
  })

  const validItems = data.items.filter((item) => byId.has(item.catalogItemId))
  const pendingInventory = data.pendingResolutions.map((pending) => ({
    sourceLabel: pending.sourceLabel,
    quantity: pending.quantity,
    question: pending.question,
    suggestions: pending.suggestions
      .filter((suggestion) => byId.has(suggestion.catalogItemId))
      .slice(0, 5)
      .map((suggestion) => ({
        catalogItemId: suggestion.catalogItemId,
        label: byId.get(suggestion.catalogItemId)!.name,
      })),
  }))

  return {
    statePatch: {
      items: validItems.map(({ catalogItemId, quantity }) => ({ catalogItemId, quantity })),
      pendingInventory,
    },
    summary: data.summary,
    usage,
  }
}

export function mergeInventory(
  state: QuoteSessionState,
  patch: Pick<QuoteSessionState, 'items' | 'pendingInventory'>
): QuoteSessionState {
  const next: QuoteSessionState = JSON.parse(JSON.stringify(state))
  for (const incoming of patch.items) {
    const existing = next.items.find((item) => item.catalogItemId === incoming.catalogItemId)
    if (existing) existing.quantity += incoming.quantity
    else next.items.push(incoming)
  }
  next.pendingInventory = patch.pendingInventory
  return next
}

export function resolvePendingInventoryChoice(state: QuoteSessionState, text: string): QuoteSessionState | null {
  const pending = state.pendingInventory[0]
  if (!pending || pending.suggestions.length === 0) return null
  const match = text.trim().match(/^(?:opci[oó]n\s*)?(\d+)\b/i)
  if (!match) return null
  const index = Number(match[1]) - 1
  const suggestion = pending.suggestions[index]
  if (!suggestion) return null

  const next: QuoteSessionState = JSON.parse(JSON.stringify(state))
  const existing = next.items.find((item) => item.catalogItemId === suggestion.catalogItemId)
  if (existing) existing.quantity += pending.quantity
  else next.items.push({ catalogItemId: suggestion.catalogItemId, quantity: pending.quantity })
  next.pendingInventory.shift()
  return next
}

export function pendingInventoryQuestion(state: QuoteSessionState): string | null {
  const pending = state.pendingInventory[0]
  if (!pending) return null
  if (pending.suggestions.length === 0) {
    return `${pending.question}\nNo encontré una equivalencia suficientemente cercana en el catálogo. Escríbeme otro nombre o medidas aproximadas.`
  }
  const options = pending.suggestions.map((item, index) => `${index + 1}. ${item.label}`).join('\n')
  return `${pending.question}\n${options}\n\nResponde con el número de la opción que corresponde.`
}
