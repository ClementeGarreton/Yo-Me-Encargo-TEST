import { supabaseAdmin } from '@/lib/supabase'
import { createConversation } from '@/lib/ai/conversationStore'
import type { WhatsAppBotState } from '@/lib/whatsapp/botRouter'

/**
 * Estado construido EXCLUSIVAMENTE desde tablas presentes en el MVP 1.3.
 * Nunca se consulta whatsapp_bot_sessions ni whatsapp_inbound_receipts.
 * El opt-in se acredita con un evento escrito tras la palabra COTIZAR.
 */
export async function loadBotContext(phone: string): Promise<{
  state: WhatsAppBotState | null
  conversationId: string | null
}> {
  const { data: latest, error } = await supabaseAdmin
    .from('ai_conversations')
    .select('id, status, quote_session_id, created_at, updated_at')
    .eq('channel', 'whatsapp')
    .eq('external_user_id', phone)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(`No se pudo consultar ai_conversations: ${error.message}`)
  if (!latest) return { state: null, conversationId: null }

  const base: WhatsAppBotState = {
    phone,
    mode: latest.status === 'handoff' ? 'human' : 'idle',
    greeted_at: latest.created_at, // El contacto ya existía: no enviar saludos repetidos.
    quote_session_id: null,
    activated_at: null,
    last_activity_at: null,
    updated_at: latest.updated_at,
  }

  // Las cotizaciones heredadas no autorizan OpenAI. Hace falta el opt-in explícito.
  if (latest.status !== 'active' || !latest.quote_session_id) {
    return { state: base, conversationId: latest.id }
  }

  const [{ data: consent, error: consentError }, { data: quote, error: quoteError }] = await Promise.all([
    supabaseAdmin.from('ai_actions').select('id')
      .eq('conversation_id', latest.id).eq('action', 'whatsapp_quote_opt_in')
      .limit(1).maybeSingle(),
    supabaseAdmin.from('quote_sessions').select('id, status, created_at')
      .eq('id', latest.quote_session_id).eq('phone', phone).eq('channel', 'whatsapp').maybeSingle(),
  ])
  if (consentError) throw new Error(`Error verificando consentimiento WhatsApp: ${consentError.message}`)
  if (quoteError) throw new Error(`Error leyendo quote_sessions: ${quoteError.message}`)
  if (!consent || !quote || !['collecting', 'ready'].includes(quote.status)) {
    return { state: base, conversationId: latest.id }
  }

  const { data: last, error: lastError } = await supabaseAdmin
    .from('ai_messages').select('created_at')
    .eq('conversation_id', latest.id).eq('direction', 'inbound')
    .order('created_at', { ascending: false }).limit(1).maybeSingle()
  if (lastError) throw new Error(`Error consultando actividad WhatsApp: ${lastError.message}`)

  return {
    conversationId: latest.id,
    state: {
      ...base,
      mode: 'quoting',
      quote_session_id: quote.id,
      activated_at: quote.created_at,
      last_activity_at: last?.created_at || quote.created_at,
    },
  }
}

/**
 * Reserva el ID de Meta con el índice UNIQUE ya existente en ai_messages.
 * El mensaje se registra ANTES de decidir cualquier respuesta. Si Meta reintenta
 * el mismo mensaje, no se envía un segundo menú ni se llama de nuevo a OpenAI.
 */
export async function claimInboundMessage(input: {
  conversationId: string | null
  phone: string
  id: string
  type: string
  text: string
  imageId?: string
}): Promise<{ claimed: boolean; conversationId: string }> {
  let conversationId = input.conversationId
  if (!conversationId) {
    const conversation = await createConversation({ channel: 'whatsapp', externalUserId: input.phone })
    conversationId = conversation.id
  }
  const validConversationId = conversationId as string
  const { error } = await supabaseAdmin.from('ai_messages').insert({
    conversation_id: validConversationId,
    direction: 'inbound',
    role: 'user',
    content: input.text || (input.type === 'image' ? '[Imagen]' : `[${input.type}]`),
    message_type: input.type === 'image' ? 'image' : input.type === 'interactive' ? 'interactive' : 'text',
    external_message_id: input.id,
    metadata: input.imageId ? { mediaId: input.imageId } : {},
  })
  if (error?.code === '23505') return { claimed: false, conversationId: validConversationId }
  if (error) throw new Error(`Error registrando mensaje entrante: ${error.message}`)
  return { claimed: true, conversationId: validConversationId }
}

/** Cambia el estado del contacto usando ai_conversations, sin columnas ni tablas nuevas. */
export async function closeRoutingConversation(conversationId: string, human: boolean): Promise<void> {
  const { error } = await supabaseAdmin.from('ai_conversations')
    .update({ status: human ? 'handoff' : 'closed', updated_at: new Date().toISOString() })
    .eq('id', conversationId)
  if (error) throw new Error(`No se pudo cerrar la atención: ${error.message}`)
}
