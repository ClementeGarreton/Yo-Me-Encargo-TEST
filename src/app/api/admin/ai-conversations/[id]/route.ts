import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const { data: conversation, error } = await supabaseAdmin
    .from('ai_conversations')
    .select('*')
    .eq('id', params.id)
    .maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!conversation) return NextResponse.json({ error: 'Conversación no encontrada' }, { status: 404 })

  const [{ data: messages }, { data: actions }, sessionResult] = await Promise.all([
    supabaseAdmin.from('ai_messages').select('*').eq('conversation_id', params.id).order('created_at', { ascending: true }),
    supabaseAdmin.from('ai_actions').select('*').eq('conversation_id', params.id).order('created_at', { ascending: true }),
    conversation.quote_session_id
      ? supabaseAdmin.from('quote_sessions').select('*').eq('id', conversation.quote_session_id).maybeSingle()
      : Promise.resolve({ data: null } as any),
  ])

  return NextResponse.json({ conversation, messages: messages || [], actions: actions || [], quoteSession: sessionResult.data || null })
}
