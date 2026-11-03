import { supabaseAdmin } from '@/lib/supabase'

const ROUTER_MODELS = ['whatsapp-router-v1-pending', 'whatsapp-router-v1-ready']

/** Encontrar una fila técnica del contacto: no confundirla con un lead/cotización. */
export async function findContactRouter(contactKey: string) {
  const { data, error } = await supabaseAdmin.from('ai_conversations')
    .select('id,model,status,quote_session_id,external_user_id')
    .eq('channel', 'whatsapp').eq('external_user_id', contactKey)
    .in('model', ROUTER_MODELS).order('created_at', { ascending: false })
    .limit(1).maybeSingle()
  if (error) throw new Error(error.message)
  return data
}

export async function isContactBotLocked(contactKey: string): Promise<boolean> {
  const router = await findContactRouter(contactKey)
  if (!router) return false
  const { data, error } = await supabaseAdmin.from('ai_actions')
    .select('structured_payload').eq('conversation_id', router.id)
    .eq('action', 'bot_policy_changed').order('created_at', { ascending: false })
    .limit(1).maybeSingle()
  if (error) throw new Error(error.message)
  return data?.structured_payload?.enabled === false
}
