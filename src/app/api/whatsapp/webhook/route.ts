import { NextRequest, NextResponse } from 'next/server'
import {
  downloadWhatsAppMediaAsDataUrl,
  sendWhatsAppDocument,
  sendWhatsAppText,
  verifyWebhookSignature,
} from '@/lib/whatsapp/cloudApi'
import {
  getOrCreateWhatsAppSession,
  createWhatsAppSession,
  closeQuoteSession,
  getNextSection,
  saveQuoteSession,
  sectionQuestion,
  type QuoteSessionRow,
} from '@/lib/quoteSession'
import {
  findOrCreateWhatsAppConversation,
  logAction,
  logMessage,
  addUsage,
  updateConversation,
} from '@/lib/ai/conversationStore'
import {
  mergeInventory,
  parseGeneralWhatsAppTurn,
  parseWhatsAppInventory,
  pendingInventoryQuestion,
  resolvePendingInventoryChoice,
} from '@/lib/ai/whatsappQuoteAssistant'
import { generateQuoteFromSession } from '@/lib/serverQuoteEngine'
import { getAvailableSlotsForDate } from '@/lib/scheduleAvailability'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const GREETING_ONLY = /^(hola|holi|buenas|buenos d[ií]as|buenas tardes|buenas noches|hey|ola)[!.\s]*$/i
const HUMAN_REQUEST = /\b(ejecutivo|persona real|humano|asesor|hablar con alguien|atenci[oó]n humana)\b/i
const CONFIRM_QUOTE = /^(confirmar|confirmo|confirmado|s[ií][,!.\s]+generar|generar cotizaci[oó]n|generar pdf)[!.\s]*$/i
const NEW_QUOTE = /\b(nueva cotizaci[oó]n|cotizar de nuevo|otra cotizaci[oó]n|nuevo traslado|nuevo flete|nueva mudanza)\b/i

function normalizePhone(value: string) {
  const digits = value.replace(/\D/g, '')
  return `+${digits}`
}

function extractQuoteIdFromText(text: string) {
  return text.match(/cotizaci[oó]n:\s*([^\s\n]+)/i)?.[1]?.trim() || null
}

function extractMessages(payload: any) {
  const result: Array<{
    id: string
    from: string
    type: string
    text: string
    imageId?: string
    profileName?: string
  }> = []

  for (const entry of payload?.entry || []) {
    for (const change of entry?.changes || []) {
      const value = change?.value
      const nameByWaId = new Map<string, string>()
      for (const contact of value?.contacts || []) {
        if (contact?.wa_id) nameByWaId.set(String(contact.wa_id), contact?.profile?.name || '')
      }
      for (const message of value?.messages || []) {
        const from = String(message?.from || '')
        if (!from || !message?.id) continue
        const type = String(message.type || 'text')
        const text = type === 'text'
          ? String(message?.text?.body || '')
          : type === 'image'
            ? String(message?.image?.caption || '')
            : type === 'interactive'
              ? String(message?.interactive?.button_reply?.title || message?.interactive?.list_reply?.title || '')
              : ''
        result.push({
          id: String(message.id),
          from,
          type,
          text,
          imageId: type === 'image' ? String(message?.image?.id || '') : undefined,
          profileName: nameByWaId.get(from) || undefined,
        })
      }
    }
  }
  return result
}

async function sendAndLog(conversationId: string, to: string, text: string) {
  const result = await sendWhatsAppText(to, text)
  const externalId = result?.messages?.[0]?.id || null
  await logMessage({
    conversationId,
    direction: 'outbound',
    role: 'assistant',
    content: text,
    externalMessageId: externalId,
  })
}

async function handleHumanHandoff(session: QuoteSessionRow, conversationId: string, to: string) {
  await saveQuoteSession(session.id, session.state, { status: 'handoff' })
  await updateConversation(conversationId, { status: 'handoff' })
  await logAction({ conversationId, action: 'human_handoff_requested', payload: { quoteSessionId: session.id } })
  await sendAndLog(
    conversationId,
    to,
    'Perfecto. Desde aquí puedes afinar los detalles de tu mudanza con nuestro ejecutivo. Ya dejamos a mano lo que conversamos para que no tengas que empezar de cero.'
  )
}

async function finalizeQuote(session: QuoteSessionRow, conversationId: string, to: string) {
  await sendAndLog(conversationId, to, 'Perfecto. Estoy generando tu cotización y el PDF con el detalle. Dame unos segundos…')
  const quote = await generateQuoteFromSession(session)
  await logAction({
    conversationId,
    action: 'quote_generated',
    payload: {
      quoteId: quote.quoteId,
      estimatedPrice: quote.estimatedPrice,
      totalVolume: quote.totalVolume,
      totalDistance: quote.totalDistance,
      pdfUrl: quote.pdfUrl,
    },
  })
  await updateConversation(conversationId, {
    status: 'quoted',
    converted: true,
    quote_id: quote.quoteId,
    customer_name: session.state.personalInfo.name,
  })

  const site = (process.env.NEXT_PUBLIC_SITE_URL || 'https://yomeencargo.cl').replace(/\/$/, '')
  const resumeUrl = `${site}/cotizador?session=${encodeURIComponent(session.id)}&token=${encodeURIComponent(session.resume_token)}`

  const summary = [
    '✅ *Tu cotización automática está lista*',
    `Cotización: ${quote.quoteId}`,
    `Volumen estimado: ${quote.totalVolume.toFixed(2)} m³`,
    `Distancia estimada: ${quote.totalDistance.toFixed(1)} km`,
    `Valor estimado: $${quote.estimatedPrice.toLocaleString('es-CL')}`,
    '',
    `Puedes revisar los datos también en la web: ${resumeUrl}`,
    '',
    '¿Quieres afinar los detalles con nuestro ejecutivo? Escribe *EJECUTIVO* y seguimos contigo por este mismo chat.',
  ].join('\n')

  await sendAndLog(conversationId, to, summary)
  await sendWhatsAppDocument(to, quote.pdfUrl, quote.pdfFileName, 'Cotización Yo Me Encargo')
  await logMessage({
    conversationId,
    direction: 'outbound',
    role: 'assistant',
    content: quote.pdfUrl,
    messageType: 'document',
    metadata: { quoteId: quote.quoteId, filename: quote.pdfFileName },
  })
}

async function processIncoming(message: ReturnType<typeof extractMessages>[number]) {
  const to = message.from
  const phone = normalizePhone(message.from)
  let session = await getOrCreateWhatsAppSession(phone)
  if (NEW_QUOTE.test(message.text)) {
    await closeQuoteSession(session.id)
    session = await createWhatsAppSession(phone)
  }
  const conversation = await findOrCreateWhatsAppConversation(phone, session.id, message.profileName)
  const conversationId = conversation.id as string

  const inbound = await logMessage({
    conversationId,
    direction: 'inbound',
    role: 'user',
    content: message.text || (message.type === 'image' ? '[Imagen]' : `[${message.type}]`),
    messageType: message.type === 'image' ? 'image' : message.type === 'interactive' ? 'interactive' : 'text',
    externalMessageId: message.id,
    metadata: message.imageId ? { mediaId: message.imageId } : {},
  })
  if (inbound.duplicate) return

  if (NEW_QUOTE.test(message.text)) {
    await sendAndLog(
      conversationId,
      to,
      `Perfecto, empecemos una nueva cotización. Tu teléfono ya lo tenemos por WhatsApp.\n\n${sectionQuestion(1, session.state)}`
    )
    return
  }

  // Si llegó desde un CTA de la web, conserva la referencia de esa cotización en el historial.
  const embeddedQuoteId = extractQuoteIdFromText(message.text)
  if (embeddedQuoteId) {
    await updateConversation(conversationId, { quote_id: embeddedQuoteId })
    session = await saveQuoteSession(session.id, session.state, { quote_id: embeddedQuoteId })
  }

  if (session.status === 'handoff') {
    // El ejecutivo puede continuar manualmente en WhatsApp Business/Coexistence.
    return
  }

  if (session.status === 'quoted') {
    if (HUMAN_REQUEST.test(message.text)) {
      await handleHumanHandoff(session, conversationId, to)
      return
    }
    await sendAndLog(conversationId, to, 'Tu cotización ya está generada. Si quieres afinar detalles o coordinar con una persona, escribe *EJECUTIVO*.')
    return
  }

  if (HUMAN_REQUEST.test(message.text)) {
    await handleHumanHandoff(session, conversationId, to)
    return
  }

  if (GREETING_ONLY.test(message.text) && session.current_section === 1 && !session.state.personalInfo.name) {
    await sendAndLog(
      conversationId,
      to,
      `¡Hola! Soy el asistente de Yo Me Encargo. Puedo cotizar tu mudanza completa por WhatsApp y enviarte el PDF aquí mismo.\n\n${sectionQuestion(1, session.state)}`
    )
    return
  }

  let state = session.state
  let section = getNextSection(state)

  if (section === 5 && state.pendingInventory.length > 0 && message.text) {
    const resolved = resolvePendingInventoryChoice(state, message.text)
    if (resolved) {
      state = resolved
      session = await saveQuoteSession(session.id, state)
      await logAction({ conversationId, action: 'inventory_ambiguity_resolved', payload: { answer: message.text } })
      const nextPending = pendingInventoryQuestion(state)
      await sendAndLog(conversationId, to, nextPending || sectionQuestion(getNextSection(state), state))
      return
    }
  }

  if (message.type === 'image' || section === 5) {
    let imageDataUrl: string | null = null
    if (message.type === 'image' && message.imageId) {
      imageDataUrl = await downloadWhatsAppMediaAsDataUrl(message.imageId)
    }
    const inventory = await parseWhatsAppInventory(message.text, imageDataUrl)
    await addUsage(conversationId, inventory.usage)
    state = mergeInventory(state, inventory.statePatch)
    session = await saveQuoteSession(session.id, state)
    await logAction({
      conversationId,
      action: 'inventory_parsed',
      payload: { summary: inventory.summary, items: inventory.statePatch.items, pending: inventory.statePatch.pendingInventory },
    })

    const pendingQuestion = pendingInventoryQuestion(state)
    if (pendingQuestion) {
      await sendAndLog(conversationId, to, `${inventory.summary}\n\n${pendingQuestion}`)
    } else {
      await sendAndLog(conversationId, to, `${inventory.summary}\n\n${sectionQuestion(getNextSection(state), state)}`)
    }
    return
  }

  if (section === 7 && (CONFIRM_QUOTE.test(message.text) || state.confirmed)) {
    await finalizeQuote(session, conversationId, to)
    return
  }

  const parsed = await parseGeneralWhatsAppTurn(section, state, message.text)
  await addUsage(conversationId, parsed.usage)
  state = parsed.state
  await logAction({ conversationId, action: 'quote_fields_parsed', payload: { section, patch: parsed.patch } })

  // WhatsApp usa la misma disponibilidad operativa que el formulario web.
  if (section === 2 && state.schedule.date && state.schedule.time) {
    try {
      const slots = await getAvailableSlotsForDate(state.schedule.date)
      if (!slots.some((slot) => slot.time === state.schedule.time)) {
        const requested = state.schedule.time
        state.schedule.time = null
        session = await saveQuoteSession(session.id, state)
        const choices = slots.length
          ? slots.slice(0, 8).map((slot) => slot.time).join(', ')
          : 'No quedan horarios disponibles ese día.'
        await logAction({ conversationId, action: 'schedule_unavailable', payload: { date: state.schedule.date, requested, available: slots.map((slot) => slot.time) } })
        await sendAndLog(conversationId, to, `El horario ${requested} no está disponible para ${state.schedule.date}. ${slots.length ? `Horarios disponibles: ${choices}. ¿Cuál prefieres?` : 'Indícame otra fecha y reviso la disponibilidad.'}`)
        return
      }
    } catch (availabilityError) {
      console.warn('[WhatsApp webhook] No se pudo validar disponibilidad:', availabilityError)
    }
  }

  if (parsed.patch.requestHuman) {
    session = await saveQuoteSession(session.id, state)
    await handleHumanHandoff(session, conversationId, to)
    return
  }

  session = await saveQuoteSession(session.id, state)
  section = getNextSection(state)

  if (section === 7 && (parsed.patch.explicitConfirmation || CONFIRM_QUOTE.test(message.text))) {
    await finalizeQuote(session, conversationId, to)
    return
  }

  await sendAndLog(conversationId, to, sectionQuestion(section, state))
}

export async function GET(request: NextRequest) {
  const mode = request.nextUrl.searchParams.get('hub.mode')
  const token = request.nextUrl.searchParams.get('hub.verify_token')
  const challenge = request.nextUrl.searchParams.get('hub.challenge')
  if (mode === 'subscribe' && token && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new NextResponse(challenge || '', { status: 200 })
  }
  return new NextResponse('Forbidden', { status: 403 })
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text()
  if (!verifyWebhookSignature(rawBody, request.headers.get('x-hub-signature-256'))) {
    return new NextResponse('Invalid signature', { status: 401 })
  }

  let payload: any
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ ok: true })
  }

  const messages = extractMessages(payload)
  for (const message of messages) {
    try {
      await processIncoming(message)
    } catch (error) {
      console.error('[WhatsApp webhook] Error procesando mensaje:', error)
    }
  }

  return NextResponse.json({ ok: true })
}
