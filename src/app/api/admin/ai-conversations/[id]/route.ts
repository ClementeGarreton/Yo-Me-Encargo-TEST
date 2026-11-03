import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { signedQuotePhoto } from '@/lib/whatsapp/photoStorage'
import { eventStatus } from '@/lib/admin/conversationCRM'
import { findContactRouter, isContactBotLocked } from '@/lib/admin/conversationControls'

export const dynamic = 'force-dynamic'

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const { data: conversation, error } = await supabaseAdmin
    .from('ai_conversations')
    .select('*')
    .eq('id', params.id)
    .maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!conversation) return NextResponse.json({ error: 'Conversación no encontrada' }, { status: 404 })

  const [messageResult, actionResult, sessionResult] = await Promise.all([
    supabaseAdmin.from('ai_messages').select('*').eq('conversation_id', params.id).order('created_at', { ascending: true }),
    supabaseAdmin.from('ai_actions').select('*').eq('conversation_id', params.id).order('created_at', { ascending: true }),
    conversation.quote_session_id
      ? supabaseAdmin.from('quote_sessions').select('*').eq('id', conversation.quote_session_id).maybeSingle()
      : Promise.resolve({ data: null } as any),
  ])

  if (messageResult.error || actionResult.error) {
    return NextResponse.json({ error: (messageResult.error || actionResult.error)?.message || 'Error leyendo auditoría' }, { status: 500 })
  }
  const messages = messageResult.data || []
  const actions = actionResult.data || []
  const router = conversation.external_user_id
    ? await findContactRouter(conversation.external_user_id) : null
  // Preservar la conversación completa: bienvenida, órdenes y mensajes de atención humana
  // quedan en la fila técnica; los mensajes de la cotización en su propia sesión.
  let relatedMessages: any[] = []
  let relatedActions: any[] = []
  if (router && router.id !== params.id) {
    const [messagesResult, actionsResult] = await Promise.all([
      supabaseAdmin.from('ai_messages').select('*')
        .eq('conversation_id', router.id).order('created_at', { ascending: true }).limit(500),
      supabaseAdmin.from('ai_actions').select('*')
        .eq('conversation_id', router.id).order('created_at', { ascending: true }).limit(500),
    ])
    if (messagesResult.error || actionsResult.error) return NextResponse.json({ error: (messagesResult.error || actionsResult.error)?.message || 'Error leyendo historial previo' }, { status: 500 })
    relatedMessages = messagesResult.data || []
    relatedActions = actionsResult.data || []
  }
  const allMessages = [...messages, ...relatedMessages]
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
  const photoEntries = sessionResult.data?.state?.inventoryPhotos || []
  const photoPaths = new Set<string>()
  const sources: Array<{ messageId: string; recognized: string[]; storagePath: string }> = []
  for (const photo of photoEntries) {
    if (!photo.storagePath || photoPaths.has(photo.storagePath)) continue
    photoPaths.add(photo.storagePath)
    sources.push({ messageId: photo.messageId, recognized: photo.recognized || [], storagePath: photo.storagePath })
  }
  for (const message of allMessages) {
    const storagePath = message.metadata?.storagePath
    if (typeof storagePath !== 'string' || photoPaths.has(storagePath)) continue
    photoPaths.add(storagePath)
    sources.push({ messageId: message.external_message_id || message.id, recognized: [], storagePath })
  }
  const photos = await Promise.all(sources.map(async photo => ({
    messageId: photo.messageId, recognized: photo.recognized,
    url: await signedQuotePhoto(photo.storagePath, 900),
  })))
  let booking: any = null
  const quoteId = conversation.quote_id || sessionResult.data?.quote_id
  if (quoteId) {
    const result = await supabaseAdmin.from('bookings')
      .select('id,quote_id,status,payment_status,payment_type,total_price,scheduled_date,scheduled_time,client_name')
      .eq('quote_id', quoteId).order('created_at', { ascending: false }).limit(1).maybeSingle()
    if (result.error) console.warn('[Inbox] No se pudo consultar estado de reserva:', result.error.message)
    else booking = result.data
  }
  const commercialAction = [...actions].reverse().find(action => action.action === 'crm_status_changed')
  const allActions = [...actions, ...relatedActions]
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
  const botLocked = conversation.external_user_id ? await isContactBotLocked(conversation.external_user_id) : false
  return NextResponse.json({ conversation, messages: allMessages, actions: allActions,
    quoteSession: sessionResult.data || null, photos, booking,
    commercialStatus: eventStatus(commercialAction), botEnabled: !botLocked })
}
