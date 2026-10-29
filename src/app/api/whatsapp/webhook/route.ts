import { NextRequest, NextResponse } from 'next/server'
import {
  downloadWhatsAppMediaAsDataUrl,
  sendWhatsAppDocument,
  sendWhatsAppText,
  verifyWebhookSignature,
} from '@/lib/whatsapp/cloudApi'
import {
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
import { supabaseAdmin } from '@/lib/supabase'
import { WHATSAPP_WELCOME, decideBotAction } from '@/lib/whatsapp/botRouter'
import { claimInboundMessage, closeRoutingConversation, loadBotContext } from '@/lib/whatsapp/botStateStore'
import type { WhatsAppBotState } from '@/lib/whatsapp/botRouter'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const GREETING_ONLY = /^(hola|holi|buenas|buenos d[ií]as|buenas tardes|buenas noches|hey|ola)[!.\s]*$/i
const HUMAN_REQUEST = /\b(ejecutivo|persona real|humano|asesor|hablar con alguien|atenci[oó]n humana)\b/i
const CONFIRM_QUOTE = /^(confirmar|confirmo|confirmado|s[ií][,!.\s]+generar|generar cotizaci[oó]n|generar pdf)[!.\s]*$/i

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
      // Un mismo webhook puede recibir eventos de otros números de la aplicación.
      if (!process.env.WHATSAPP_PHONE_NUMBER_ID || String(value?.metadata?.phone_number_id || '') !== process.env.WHATSAPP_PHONE_NUMBER_ID) continue
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
  // La cotización ya existe; cerrar autorización de OpenAI ANTES de enviar el PDF.
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
    '¿Quieres afinar los detalles con una persona? Escribe *ASESOR* y seguimos contigo por este mismo chat.',
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

async function deactivateBot(bot: WhatsAppBotState, conversationId: string, mode: 'idle' | 'human') {
  if (bot.quote_session_id && bot.mode === 'quoting') {
    if (mode === 'human') {
      const { error } = await supabaseAdmin
        .from('quote_sessions')
        .update({ status: 'handoff', updated_at: new Date().toISOString() })
        .eq('id', bot.quote_session_id)
        .in('status', ['collecting', 'ready'])
      if (error) throw new Error(error.message)
    } else {
      await closeQuoteSession(bot.quote_session_id)
    }
    const { error } = await supabaseAdmin
      .from('ai_conversations')
      .update({ status: mode === 'human' ? 'handoff' : 'closed', updated_at: new Date().toISOString() })
      .eq('quote_session_id', bot.quote_session_id)
      .eq('channel', 'whatsapp')
      .eq('status', 'active')
    if (error) throw new Error(error.message)
  }
  await closeRoutingConversation(conversationId, mode === 'human')
}

async function processIncoming(message: ReturnType<typeof extractMessages>[number]) {
  // Interruptor de emergencia de Vercel. Nunca llama a OpenAI con el bot apagado.
  if (process.env.WHATSAPP_BOT_ENABLED === 'false') return
  const to = message.from
  const phone = normalizePhone(to)
  const { state: bot, conversationId: previousConversationId } = await loadBotContext(phone)
  const claimed = await claimInboundMessage({
    conversationId: previousConversationId,
    phone,
    id: message.id,
    type: message.type,
    text: message.text,
    imageId: message.imageId,
  })
  if (!claimed.claimed) return // Mensaje duplicado de Meta: no enviar nada dos veces.
  const conversationIdForRouting = claimed.conversationId
  const decision = decideBotAction(message.text, bot)

  if (decision === 'welcome') {
    // Bienvenida una vez por contacto, persistida en las tablas originales.
    await sendAndLog(conversationIdForRouting, to, WHATSAPP_WELCOME)
    return
  }

  if (decision === 'start_quote') {
    // Revocar sesiones previas incompletas. COTIZAR es la única puerta de entrada.
    if (bot?.mode === 'quoting') await deactivateBot(bot, conversationIdForRouting, 'idle')
    const { error } = await supabaseAdmin
      .from('quote_sessions')
      .update({ status: 'closed', updated_at: new Date().toISOString() })
      .eq('channel', 'whatsapp')
      .eq('phone', phone)
      .in('status', ['collecting', 'ready'])
    if (error) throw new Error(error.message)

    const session = await createWhatsAppSession(phone)
    const conversation = await findOrCreateWhatsAppConversation(phone, session.id, message.profileName)
    const conversationId = conversation.id as string
    // Autorización de OpenAI asociada a esta sesión, usando ai_actions ya existente.
    const { error: optInError } = await supabaseAdmin.from('ai_actions').insert({
      conversation_id: conversationId, action: 'whatsapp_quote_opt_in',
      structured_payload: { command: 'COTIZAR', messageId: message.id },
    })
    if (optInError) throw new Error(`No se pudo registrar autorización: ${optInError.message}`)
    await sendAndLog(conversationId, to, `Comencemos tu cotización. Puedes escribir *SALIR* en cualquier momento.\n\n${sectionQuestion(1, session.state)}`)
    return
  }

  if (decision === 'human' || decision === 'exit' || decision === 'menu') {
    if (bot) await deactivateBot(bot, conversationIdForRouting, decision === 'human' ? 'human' : 'idle')
    else await closeRoutingConversation(conversationIdForRouting, decision === 'human')
    if (decision === 'human') {
      await sendWhatsAppText(to, 'Te atenderá una persona por este mismo chat. El asistente automático queda desactivado. Para cotizar con IA, escribe *COTIZAR*.')
    } else if (decision === 'exit') {
      await sendWhatsAppText(to, 'Atención automática finalizada. Puedes escribir *COTIZAR* para comenzar otra cotización o *ASESOR* para atención humana.')
    } else {
      await sendWhatsAppText(to, WHATSAPP_WELCOME)
    }
    return
  }

  if (decision === 'expire_silent') {
    // Caducidad evaluada incluso aunque el usuario nunca escribiera SALIR.
    if (bot) await deactivateBot(bot, conversationIdForRouting, 'idle')
    return
  }

  if (decision === 'silent') return // Atención humana: silencio total, no llama OpenAI.

  // Solo se llega aquí con una sesión iniciada explícitamente por COTIZAR.
  if (!bot?.quote_session_id) {
    await closeRoutingConversation(conversationIdForRouting, false)
    return
  }
  const { data, error } = await supabaseAdmin
    .from('quote_sessions')
    .select('*')
    .eq('id', bot.quote_session_id)
    .eq('phone', phone)
    .eq('channel', 'whatsapp')
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data || !['collecting', 'ready'].includes(data.status)) {
    await closeRoutingConversation(conversationIdForRouting, false)
    return
  }
  let session = data as QuoteSessionRow

  const conversation = await findOrCreateWhatsAppConversation(phone, session.id, message.profileName)
  const conversationId = conversation.id as string

  // Conserva la referencia a una cotización originada en la web, sin activación implícita.
  const embeddedQuoteId = extractQuoteIdFromText(message.text)
  if (embeddedQuoteId) {
    await updateConversation(conversationId, { quote_id: embeddedQuoteId })
    session = await saveQuoteSession(session.id, session.state, { quote_id: embeddedQuoteId })
  }

  if (HUMAN_REQUEST.test(message.text)) {
    await handleHumanHandoff(session, conversationId, to)
    return
  }

  if (GREETING_ONLY.test(message.text) && session.current_section === 1 && !session.state.personalInfo.name) {
    await sendAndLog(conversationId, to, sectionQuestion(1, session.state))
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
  // Registro de entrada sin datos personales, incluso cuando falle la firma.
  console.info('[WhatsApp webhook] POST recibido')
  const rawBody = await request.text()
  if (!verifyWebhookSignature(rawBody, request.headers.get('x-hub-signature-256'))) {
    console.warn('[WhatsApp webhook] Firma de Meta rechazada')
    return new NextResponse('Invalid signature', { status: 401 })
  }

  let payload: any
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ ok: true })
  }

  const messages = extractMessages(payload)
  console.info('[WhatsApp webhook] POST válido; mensajes para este número:', messages.length)
  for (const message of messages) {
    try {
      await processIncoming(message)
    } catch (error) {
      console.error('[WhatsApp webhook] Error procesando mensaje:', error)
    }
  }

  return NextResponse.json({ ok: true })
}
