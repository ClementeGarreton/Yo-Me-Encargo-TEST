import { supabaseAdmin } from '@/lib/supabase'
import type { BotMode, WhatsAppBotState } from '@/lib/whatsapp/botRouter'

/** Estado persistente, independiente de las cotizaciones web y de la memoria de Vercel. */
export async function getBotState(phone: string): Promise<WhatsAppBotState | null> {
  const { data, error } = await supabaseAdmin
    .from('whatsapp_bot_sessions')
    .select('*')
    .eq('phone', phone)
    .maybeSingle()
  if (error) throw new Error(`No se pudo consultar whatsapp_bot_sessions: ${error.message}`)
  return (data as WhatsAppBotState | null) || null
}

export async function ensureBotState(phone: string): Promise<WhatsAppBotState> {
  const current = await getBotState(phone)
  if (current) return current
  const { data, error } = await supabaseAdmin
    .from('whatsapp_bot_sessions')
    .insert({ phone, mode: 'idle' })
    .select('*')
    .single()
  if (!error && data) return data as WhatsAppBotState
  // Dos webhooks del mismo teléfono pueden competir por el primer INSERT.
  if (error?.code === '23505') {
    const concurrent = await getBotState(phone)
    if (concurrent) return concurrent
  }
  throw new Error(`No se pudo crear whatsapp_bot_sessions: ${error?.message || 'sin datos'}`)
}

export async function claimFirstWelcome(phone: string): Promise<string | null> {
  // Reclamación atómica: aun con webhooks concurrentes solo uno envía la bienvenida.
  const now = new Date().toISOString()
  const { data, error } = await supabaseAdmin
    .from('whatsapp_bot_sessions')
    .update({ greeted_at: now, updated_at: now })
    .eq('phone', phone)
    .is('greeted_at', null)
    .select('phone')
  if (error) throw new Error(error.message)
  return data?.length ? now : null
}

export async function releaseFailedWelcome(phone: string, claimAt: string): Promise<void> {
  // Si falla Meta, el siguiente mensaje podrá recuperar la bienvenida.
  const { error } = await supabaseAdmin
    .from('whatsapp_bot_sessions')
    .update({ greeted_at: null, updated_at: new Date().toISOString() })
    .eq('phone', phone)
    .eq('greeted_at', claimAt)
  if (error) throw new Error(error.message)
}

export async function setBotMode(
  phone: string,
  mode: BotMode,
  quoteSessionId: string | null = null
): Promise<void> {
  const now = new Date().toISOString()
  const { error } = await supabaseAdmin
    .from('whatsapp_bot_sessions')
    .update({
      mode,
      quote_session_id: mode === 'quoting' ? quoteSessionId : null,
      activated_at: mode === 'quoting' ? now : null,
      last_activity_at: mode === 'quoting' ? now : null,
      greeted_at: now,
      updated_at: now,
    })
    .eq('phone', phone)
  if (error) throw new Error(error.message)
}

export async function refreshQuoteActivity(phone: string, quoteSessionId: string): Promise<boolean> {
  const now = new Date().toISOString()
  const { data, error } = await supabaseAdmin
    .from('whatsapp_bot_sessions')
    .update({ last_activity_at: now, updated_at: now })
    .eq('phone', phone)
    .eq('mode', 'quoting')
    .eq('quote_session_id', quoteSessionId)
    .select('phone')
  if (error) throw new Error(error.message)
  return Boolean(data?.length)
}
