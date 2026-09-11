import { supabaseAdmin } from '@/lib/supabase'
import type { AiUsage } from '@/lib/ai/openai'

export async function createConversation(input: {
  channel: 'web' | 'whatsapp'
  externalUserId?: string | null
  customerName?: string | null
  quoteSessionId?: string | null
}) {
  const { data, error } = await supabaseAdmin
    .from('ai_conversations')
    .insert({
      channel: input.channel,
      external_user_id: input.externalUserId || null,
      customer_name: input.customerName || null,
      quote_session_id: input.quoteSessionId || null,
      status: 'active',
    })
    .select('*')
    .single()
  if (error || !data) throw new Error(error?.message || 'No se pudo crear la conversación')
  return data
}

export async function findOrCreateWhatsAppConversation(phone: string, quoteSessionId: string, customerName?: string | null) {
  const { data: existing } = await supabaseAdmin
    .from('ai_conversations')
    .select('*')
    .eq('channel', 'whatsapp')
    .eq('external_user_id', phone)
    .eq('quote_session_id', quoteSessionId)
    .in('status', ['active', 'quoted', 'handoff'])
    .order('last_message_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existing) return existing
  return createConversation({ channel: 'whatsapp', externalUserId: phone, quoteSessionId, customerName })
}

export async function logMessage(input: {
  conversationId: string
  direction: 'inbound' | 'outbound'
  role: 'user' | 'assistant' | 'system'
  content: string
  messageType?: 'text' | 'image' | 'document' | 'interactive' | 'system'
  externalMessageId?: string | null
  metadata?: Record<string, unknown>
}) {
  if (input.externalMessageId) {
    const { data: duplicate } = await supabaseAdmin
      .from('ai_messages')
      .select('id')
      .eq('external_message_id', input.externalMessageId)
      .maybeSingle()
    if (duplicate) return { duplicate: true, id: duplicate.id }
  }

  const { data, error } = await supabaseAdmin
    .from('ai_messages')
    .insert({
      conversation_id: input.conversationId,
      direction: input.direction,
      role: input.role,
      content: input.content,
      message_type: input.messageType || 'text',
      external_message_id: input.externalMessageId || null,
      metadata: input.metadata || {},
    })
    .select('id')
    .single()
  if (error) throw new Error(error.message)

  await supabaseAdmin
    .from('ai_conversations')
    .update({ last_message_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', input.conversationId)

  return { duplicate: false, id: data?.id }
}

export async function logAction(input: {
  conversationId: string
  action: string
  payload?: Record<string, unknown>
  success?: boolean
  error?: string | null
}) {
  await supabaseAdmin.from('ai_actions').insert({
    conversation_id: input.conversationId,
    action: input.action,
    structured_payload: input.payload || {},
    success: input.success !== false,
    error: input.error || null,
  })
}

export async function addUsage(conversationId: string, usage: AiUsage) {
  const { data } = await supabaseAdmin
    .from('ai_conversations')
    .select('input_tokens,output_tokens,estimated_ai_cost_usd')
    .eq('id', conversationId)
    .maybeSingle()

  await supabaseAdmin
    .from('ai_conversations')
    .update({
      input_tokens: Number(data?.input_tokens || 0) + usage.inputTokens,
      output_tokens: Number(data?.output_tokens || 0) + usage.outputTokens,
      estimated_ai_cost_usd: Number(data?.estimated_ai_cost_usd || 0) + usage.estimatedCostUsd,
      model: usage.model,
      updated_at: new Date().toISOString(),
    })
    .eq('id', conversationId)
}

export async function updateConversation(conversationId: string, patch: Record<string, unknown>) {
  await supabaseAdmin
    .from('ai_conversations')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', conversationId)
}
