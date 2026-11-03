import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { lastStatuses } from '@/lib/admin/conversationCRM'

export const dynamic = 'force-dynamic'

/** Bandeja auditable: incluye interacciones previas a COTIZAR (filas router). */
export async function GET(request: NextRequest) {
  const channel = request.nextUrl.searchParams.get('channel')
  const status = request.nextUrl.searchParams.get('status')
  const search = (request.nextUrl.searchParams.get('q') || '').trim()
  let query = supabaseAdmin.from('ai_conversations')
    .select('id,channel,external_user_id,customer_name,quote_session_id,quote_id,status,converted,input_tokens,output_tokens,estimated_ai_cost_usd,model,started_at,last_message_at')
    .order('last_message_at', { ascending: false }).limit(250)
  if (channel === 'web') query = query.eq('channel', 'web')
  if (channel === 'instagram') query = query.like('external_user_id', 'ig:%')
  if (channel === 'whatsapp') query = query.eq('channel', 'whatsapp').not('external_user_id', 'like', 'ig:%')
  if (search) {
    const safe = search.replace(/[%_,.()]/g, '')
    if (safe) query = query.or(`external_user_id.ilike.%${safe}%,customer_name.ilike.%${safe}%,quote_id.ilike.%${safe}%`)
  }
  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const rows = data || []
  const ids = rows.map(row => row.id)
  if (!ids.length) return NextResponse.json([])
  const { data: events, error: eventsError } = await supabaseAdmin.from('ai_actions')
    .select('conversation_id,structured_payload,created_at').eq('action', 'crm_status_changed')
    .in('conversation_id', ids).order('created_at', { ascending: false }).limit(2000)
  if (eventsError) return NextResponse.json({ error: eventsError.message }, { status: 500 })
  const statuses = lastStatuses(events || [])
  const contactKeys = Array.from(new Set(rows.map(row => row.external_user_id).filter(Boolean))) as string[]
  const { data: routers, error: routerError } = await supabaseAdmin.from('ai_conversations')
    .select('id,external_user_id').in('external_user_id', contactKeys.length ? contactKeys : ['__none__'])
    .in('model', ['whatsapp-router-v1-pending', 'whatsapp-router-v1-ready'])
  if (routerError) return NextResponse.json({ error: routerError.message }, { status: 500 })
  const routerByKey = new Map((routers || []).map(row => [row.external_user_id, row.id]))
  const routerIds = (routers || []).map(row => row.id)
  const { data: policies, error: policyError } = routerIds.length
    ? await supabaseAdmin.from('ai_actions').select('conversation_id,structured_payload,created_at')
      .eq('action', 'bot_policy_changed').in('conversation_id', routerIds)
      .order('created_at', { ascending: false }).limit(1000)
    : { data: [], error: null }
  if (policyError) return NextResponse.json({ error: policyError.message }, { status: 500 })
  const locks = new Map<string, boolean>()
  for (const event of policies || []) if (!locks.has(event.conversation_id)) locks.set(event.conversation_id, event.structured_payload?.enabled === false)
  const result = rows.map(row => ({ ...row,
    commercial_status: statuses[row.id] || 'REVISAR',
    is_router: String(row.model || '').startsWith('whatsapp-router-v1-'),
    bot_enabled: !locks.get(routerByKey.get(row.external_user_id) || ''),
  }))
  return NextResponse.json(status && status !== 'all'
    ? result.filter(row => row.commercial_status === status) : result)
}
