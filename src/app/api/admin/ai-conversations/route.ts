import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const channel = request.nextUrl.searchParams.get('channel')
  const status = request.nextUrl.searchParams.get('status')
  const search = (request.nextUrl.searchParams.get('q') || '').trim()

  let query = supabaseAdmin
    .from('ai_conversations')
    .select('id,channel,external_user_id,customer_name,quote_session_id,quote_id,status,converted,input_tokens,output_tokens,estimated_ai_cost_usd,model,started_at,last_message_at')
    .order('last_message_at', { ascending: false })
    .limit(150)

  if (channel === 'web' || channel === 'whatsapp') query = query.eq('channel', channel)
  if (status && status !== 'all') query = query.eq('status', status)
  if (search) {
    const safe = search.replace(/[%_,]/g, '')
    query = query.or(`external_user_id.ilike.%${safe}%,customer_name.ilike.%${safe}%,quote_id.ilike.%${safe}%`)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data || [])
}
