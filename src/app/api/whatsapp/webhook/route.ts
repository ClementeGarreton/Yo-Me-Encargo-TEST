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
  mutateQuoteSessionAtomically,
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
import { canCloseInventory, isInventoryAddition, upsertInventoryPhoto } from '@/lib/whatsapp/inventoryResolution'
import { answerExtras } from '@/lib/whatsapp/extrasFlow'
import { getAvailableSlotsForDate } from '@/lib/scheduleAvailability'
import { supabaseAdmin } from '@/lib/supabase'
import { WHATSAPP_WELCOME, botCommand, decideBotAction, isQuoteExpired } from '@/lib/whatsapp/botRouter'
import { claimFirstWelcome, claimIncomingMessage, ensureBotState, moveIncomingToConversation, refreshQuoteActivity, releaseFailedWelcome, setBotMode, touchIdleActivity } from '@/lib/whatsapp/botStateStore'
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

/** Muestra los artículos que realmente se utilizarán para calcular el PDF. */
async function inventoryReviewQuestion(state: QuoteSessionRow['state']): Promise<string> {
  const ids = state.items.map((item) => item.catalogItemId)
  const { data, error } = await supabaseAdmin.from('catalog_items').select('id,name').in('id', ids)
  if (error) throw new Error(error.message)
  const names = new Map((data || []).map((row) => [String(row.id), String(row.name)]))
  const list = state.items.map((item) => `• ${item.quantity} × ${names.get(item.catalogItemId) || 'Artículo no identificado'}`).join('\n')
  const photos = state.inventoryPhotos || []
  return `7/7 · *Revisa tu inventario antes de cotizar*\n\n${list}\n\n` +
    `${photos.length ? `Fotos procesadas: ${photos.filter((photo) => photo.status === 'done').length}/${photos.length}.\n` : ''}` +
    `¿Están todos tus muebles y no sobra ninguno?\n\n` +
    `*CONFIRMAR* — generar precio y PDF.\n` +
    `*QUITAR* + nombre — eliminar un objeto.\n` +
    `*AGREGAR* + descripción — incorporar uno que falta.\n` +
    `También puedes enviar una fotografía adicional.`
}

async function nextQuestion(state: QuoteSessionRow['state']): Promise<string> {
  const section = getNextSection(state)
  return section === 7 ? inventoryReviewQuestion(state) : sectionQuestion(section, state)
}

/** Permite retirar objetos falsamente detectados antes de emitir una oferta. */
async function removeCatalogItem(sessionId: string, text: string): Promise<QuoteSessionRow | null> {
  const requested = text.replace(/^quitar\s+/i, '').trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  if (!requested) return null
  const { data, error } = await supabaseAdmin.from('catalog_items').select('id,name').ilike('name', `%${requested}%`)
  if (error) throw new Error(error.message)
  const matched = (data || []).map((item) => String(item.id))
  if (!matched.length) return null
  return mutateQuoteSessionAtomically(sessionId, (state) => {
    const present = state.items.filter((item) => matched.includes(item.catalogItemId))
    if (present.length !== 1) return state
    return { ...state, items: state.items.filter((item) => item.catalogItemId !== present[0].catalogItemId) }
  })
}

async function handleHumanHandoff(session: QuoteSessionRow, conversationId: string, to: string) {
  await saveQuoteSession(session.id, session.state, { status: 'handoff' })
  await setBotMode(normalizePhone(to), 'human')
  await updateConversation(conversationId, { status: 'handoff' })
  await logAction({ conversationId, action: 'human_handoff_requested', payload: { quoteSessionId: session.id } })
  await sendAndLog(
    conversationId,
    to,
    'Perfecto. Desde aquí puedes afinar los detalles de tu mudanza con nuestro ejecutivo. Ya dejamos a mano lo que conversamos para que no tengas que empezar de cero.'
  )
}

async function finalizeQuote(session: QuoteSessionRow, conversationId: string, to: string) {
  // Cargar la versión final: las fotos pudieron haberse procesado en paralelo.
  const { data: fresh, error: freshError } = await supabaseAdmin
    .from('quote_sessions').select('*').eq('id', session.id).maybeSingle()
  if (freshError || !fresh) throw new Error(freshError?.message || 'Sesión no encontrada')
  session = fresh as QuoteSessionRow
  if (getNextSection(session.state) !== 7 || !canCloseInventory(session.state)
    || (session.state.inventoryPhotos?.length && !session.state.inventoryCollectionDone)) {
    await sendAndLog(conversationId, to, 'Todavía no tengo un inventario validado. Revisemos primero los muebles para evitar una cotización incorrecta.')
    return
  }
  await sendAndLog(conversationId, to, 'Perfecto. Estoy generando tu cotización y el PDF con el detalle. Dame unos segundos…')
  const quote = await generateQuoteFromSession(session)
  // La cotización ya existe; cerrar autorización de OpenAI ANTES de enviar el PDF.
  await setBotMode(normalizePhone(to), 'idle')
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

async function deactivateBot(phone: string, bot: WhatsAppBotState, mode: 'idle' | 'human') {
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
  await setBotMode(phone, mode)
}

async function processIncoming(message: ReturnType<typeof extractMessages>[number]) {
  // Interruptor de emergencia de Vercel. Nunca llama a OpenAI con el bot apagado.
  if (process.env.WHATSAPP_BOT_ENABLED === 'false') return
  const to = message.from
  const phone = normalizePhone(to)
  if (!(await claimIncomingMessage({
    phone,
    messageId: message.id,
    content: message.text || (message.type === 'image' ? '[Imagen]' : `[${message.type}]`),
    messageType: message.type === 'image' ? 'image' : message.type === 'interactive' ? 'interactive' : 'text',
  }))) return

  const bot = await ensureBotState(phone)
  const decision = decideBotAction(message.text, bot)

  if (decision === 'welcome') {
    // No se crea quote_session ni se usa OpenAI por un saludo o texto cualquiera.
    const claimAt = await claimFirstWelcome(phone)
    if (!claimAt) return
    try {
      await sendWhatsAppText(to, WHATSAPP_WELCOME)
    } catch (error) {
      await releaseFailedWelcome(phone, claimAt)
      throw error
    }
    return
  }

  if (decision === 'start_quote') {
    // Revocar sesiones previas incompletas. COTIZAR es la única puerta de entrada.
    if (bot.mode === 'quoting') await deactivateBot(phone, bot, 'idle')
    const { error } = await supabaseAdmin
      .from('quote_sessions')
      .update({ status: 'closed', updated_at: new Date().toISOString() })
      .eq('channel', 'whatsapp')
      .eq('phone', phone)
      .in('status', ['collecting', 'ready'])
    if (error) throw new Error(error.message)

    const session = await createWhatsAppSession(phone)
    await setBotMode(phone, 'quoting', session.id)
    const conversation = await findOrCreateWhatsAppConversation(phone, session.id, message.profileName)
    const conversationId = conversation.id as string
    await moveIncomingToConversation(message.id, conversationId)
    await sendAndLog(conversationId, to, `Comencemos tu cotización. Puedes escribir *SALIR* en cualquier momento.\n\n${sectionQuestion(1, session.state)}`)
    return
  }

  if (decision === 'human' || decision === 'exit' || decision === 'menu') {
    await deactivateBot(phone, bot, decision === 'human' ? 'human' : 'idle')
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
    // No se envían mensajes espontáneos. Al siguiente mensaje del cliente,
    // se informa una sola vez que la autorización ya caducó.
    await deactivateBot(phone, bot, 'idle')
    await sendWhatsAppText(to, `¡Hola de nuevo! 😊💚

Parece que nos tomamos un pequeño descanso. Tu cotización anterior se cerró automáticamente, pero ¡no te preocupes! Estamos encantados de ayudarte nuevamente.

¿Qué te gustaría hacer?

📝 *COTIZAR* — Comenzar una nueva cotización.

🤝 *ASESOR* — Hablar directamente con nuestro equipo.

📋 *MENU* — Consultar nuestras opciones.

👋 *SALIR* — Finalizar la atención automática.

¡Estamos aquí para ayudarte! 🚚✨`)
    return
  }

  if (decision === 'silent') {
    if (bot.mode === 'idle') await touchIdleActivity(phone)
    return // Atención humana: silencio total, no llama OpenAI.
  }

  // Solo se llega aquí con una sesión iniciada explícitamente por COTIZAR.
  if (!bot.quote_session_id) {
    await setBotMode(phone, 'idle')
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
    await setBotMode(phone, 'idle')
    await sendWhatsAppText(to, 'La cotización anterior ya no está activa. Escribe *COTIZAR* para iniciar otra o *ASESOR* para atención humana.')
    return
  }
  let session = data as QuoteSessionRow
  if (!(await refreshQuoteActivity(phone, session.id))) return

  const conversation = await findOrCreateWhatsAppConversation(phone, session.id, message.profileName)
  const conversationId = conversation.id as string
  await moveIncomingToConversation(message.id, conversationId)

  // Notas de voz y otros adjuntos no son texto parseable. Evita llamar
  // a OpenAI con un texto vacío y perder la respuesta silenciosamente.
  if (message.type !== 'text' && message.type !== 'interactive' && message.type !== 'image') {
    await sendAndLog(conversationId, to, 'Por ahora necesito que respondas por escrito. También puedes enviar fotografías en la etapa de inventario, o escribir *ASESOR* para atención humana.')
    return
  }

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

  if (section === 5 && CONFIRM_QUOTE.test(message.text)) {
    await sendAndLog(conversationId, to, 'Aún estamos reuniendo el inventario. Cuando termines de enviar tus muebles, escribe *LISTO*. Te mostraré la lista completa antes de generar el precio.')
    return
  }

  // La lista queda abierta mientras el cliente envía fotografías. Enviar LISTO
  // una sola vez evita que una foto posterior se pierda o adelante los extras.
  if (section === 5 && /^(listo|termine|termin[eé]|eso es todo|nada mas|nada m[aá]s)[.!\s]*$/i.test(message.text)) {
    session = await mutateQuoteSessionAtomically(session.id, (current) => ({
      ...current, inventoryCollectionDone: canCloseInventory(current),
    }))
    const finished = session.state.inventoryCollectionDone
    await sendAndLog(conversationId, to, finished
      ? await nextQuestion(session.state)
      : 'Todavía hay fotos sin identificar o falta un mueble. Escribe qué aparece en la foto pendiente para completar el inventario.')
    return
  }

  if (section === 5 && state.pendingInventory.length > 0 && message.text) {
    const resolved = resolvePendingInventoryChoice(state, message.text)
    if (resolved) {
      session = await mutateQuoteSessionAtomically(session.id, (current) => resolvePendingInventoryChoice(current, message.text) || current)
      state = session.state
      await logAction({ conversationId, action: 'inventory_ambiguity_resolved', payload: { answer: message.text } })
      await sendAndLog(conversationId, to, pendingInventoryQuestion(state) || await nextQuestion(state))
      return
    }
  }

  const addingLateInventory = (section === 6 || section === 7) && isInventoryAddition(message.text)
  if (message.type === 'image' || section === 5 || addingLateInventory) {
    const isPhoto = message.type === 'image'
    if (isPhoto) {
      // Registrar el mensaje ANTES de usar OpenAI para que la cotización no
      // se finalice mientras hay fotos en vuelo en otras funciones de Vercel.
      session = await mutateQuoteSessionAtomically(session.id, (current) => upsertInventoryPhoto(current, {
        messageId: message.id, status: 'processing', recognized: [],
      }))
    }
    let imageDataUrl: string | null = null
    if (isPhoto && message.imageId) {
      imageDataUrl = await downloadWhatsAppMediaAsDataUrl(message.imageId)
    }
    if (isPhoto && !imageDataUrl) {
      await mutateQuoteSessionAtomically(session.id, (current) => upsertInventoryPhoto(current, {
        messageId: message.id, status: 'needs_description', recognized: [],
      }))
      await sendAndLog(conversationId, to, 'No pude abrir esa fotografía. Dime qué mueble aparece o vuelve a enviarla, por favor.')
      return
    }
    let inventory: Awaited<ReturnType<typeof parseWhatsAppInventory>>
    try {
      inventory = await parseWhatsAppInventory(message.text, imageDataUrl)
    } catch (error) {
      if (!isPhoto) throw error
      await mutateQuoteSessionAtomically(session.id, (current) => upsertInventoryPhoto(current, {
        messageId: message.id, status: 'needs_description', recognized: [],
      }))
      console.error('[WhatsApp webhook] Error al analizar una foto:', error)
      await sendAndLog(conversationId, to, 'No pude analizar esa fotografía. ¿Qué mueble aparece? Lo registraré por texto.')
      return
    }
    await addUsage(conversationId, inventory.usage)
    session = await mutateQuoteSessionAtomically(session.id, (current) => {
      let merged = mergeInventory(current, inventory.statePatch)
      if (isPhoto) {
        merged = upsertInventoryPhoto(merged, {
          messageId: message.id, status: inventory.needsReview ? 'needs_description' : 'done',
          recognized: inventory.recognizedNames,
        })
      } else if (inventory.statePatch.items.length > 0 && merged.inventoryPhotos?.some((photo) => photo.status === 'needs_description')) {
        // El cliente describió el mueble de una foto poco clara.
        const unresolved = merged.inventoryPhotos.find((photo) => photo.status === 'needs_description')!
        merged = upsertInventoryPhoto(merged, { ...unresolved, status: 'done', recognized: inventory.recognizedNames })
        // Esta explicación resolvió la foto que había quedado pendiente.
        merged.pendingInventory = []
      }
      return merged
    })
    state = session.state
    await logAction({
      conversationId, action: 'inventory_parsed',
      payload: { messageId: message.id, summary: inventory.summary, items: inventory.statePatch.items,
        pending: inventory.statePatch.pendingInventory, photos: state.inventoryPhotos?.length },
    })
    if (isPhoto) {
      const count = state.inventoryPhotos?.length || 1
      const names = inventory.recognizedNames.join(', ')
      await sendAndLog(conversationId, to, inventory.needsReview
        ? `Foto ${count} recibida, pero no pude identificar con certeza el mueble. ¿Qué aparece en esa foto?`
        : `✓ Foto ${count}: ${names || 'registrada'}. Envíame las demás y al terminar escribe *LISTO*.`)
    } else if (state.pendingInventory.length) {
      await sendAndLog(conversationId, to, pendingInventoryQuestion(state) || '¿Qué mueble aparece en la foto pendiente?')
    } else if (state.inventoryPhotos?.length && !state.inventoryCollectionDone) {
      await sendAndLog(conversationId, to, 'Gracias, registrado. Si ya enviaste todas las fotos, escribe *LISTO* para revisar el inventario.')
    } else {
      await sendAndLog(conversationId, to, await nextQuestion(state))
    }
    return
  }

  if (section === 7 && /^quitar\s+/i.test(message.text)) {
    const updated = await removeCatalogItem(session.id, message.text)
    await sendAndLog(conversationId, to, updated
      ? await nextQuestion(updated.state)
      : 'No encontré ese artículo. Usa el nombre tal como aparece en la lista de inventario.')
    return
  }

  // Servicios adicionales: una decisión binaria por mensaje. No llamar a OpenAI
  // para interpretar un «sí/no» ni aplicar ese sí a varios servicios.
  if (section === 6) {
    const nextServices = answerExtras(state.additionalServices, message.text)
    if (!nextServices) {
      await sendAndLog(conversationId, to, `Para esta pregunta basta con responder *SÍ* o *NO*. 😊\n\n${sectionQuestion(6, state)}`)
      return
    }
    state = { ...state, additionalServices: nextServices }
    session = await saveQuoteSession(session.id, state)
    await sendAndLog(conversationId, to, await nextQuestion(state))
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

  await sendAndLog(conversationId, to, await nextQuestion(state))
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

/**
 * Cuando falla el parser, antes el webhook devolvía 200 a Meta y dejaba
 * al cliente sin respuesta. Avisar solamente durante una cotización
 * autorizada o al intentar activarla explícitamente con COTIZAR.
 * No envía mensajes a otros contactos ni abre sesiones por su cuenta.
 */
async function notifyMessageProcessingError(message: ReturnType<typeof extractMessages>[number]) {
  const explicitActivation = botCommand(message.text) === 'COTIZAR'
  let activeAuthorizedQuote = false
  try {
    const bot = await ensureBotState(normalizePhone(message.from))
    activeAuthorizedQuote = bot.mode === 'quoting' && !isQuoteExpired(bot)
  } catch (error) {
    console.error('[WhatsApp webhook] No se pudo comprobar el estado tras el error:', error)
  }
  if (!explicitActivation && !activeAuthorizedQuote) return
  try {
    await sendWhatsAppText(message.from, 'No pude procesar tu último mensaje. Por favor, vuelve a enviarlo en texto. Si vuelve a ocurrir, escribe *ASESOR* para atención humana o *SALIR* para terminar.')
  } catch (error) {
    console.error('[WhatsApp webhook] No se pudo enviar aviso de error:', error)
  }
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
      await notifyMessageProcessingError(message)
    }
  }

  return NextResponse.json({ ok: true })
}
