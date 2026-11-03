import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getActorFromRequest, logAdminAction } from '@/lib/activityLog'
import { eventStatus, isCommercialStatus, COMMERCIAL_LABELS } from '@/lib/admin/conversationCRM'

export const dynamic = 'force-dynamic'

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const actor = getActorFromRequest(request)
  if (!actor) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const body = await request.json().catch(() => null)
  if (!isCommercialStatus(body?.status)) return NextResponse.json({ error: 'Estado no válido' }, { status: 400 })
  const note = String(body?.note || '').trim()
  if (note.length > 500) return NextResponse.json({ error: 'Observación demasiado extensa' }, { status: 400 })

  const { data: conversation, error: findError } = await supabaseAdmin.from('ai_conversations')
    .select('id,customer_name,external_user_id').eq('id', params.id).maybeSingle()
  if (findError) return NextResponse.json({ error: findError.message }, { status: 500 })
  if (!conversation) return NextResponse.json({ error: 'Conversación inexistente' }, { status: 404 })

  const { data: previous, error: previousError } = await supabaseAdmin.from('ai_actions')
    .select('structured_payload').eq('conversation_id', params.id)
    .eq('action', 'crm_status_changed').order('created_at', { ascending: false }).limit(1).maybeSingle()
  if (previousError) return NextResponse.json({ error: previousError.message }, { status: 500 })
  const from = eventStatus(previous)
  if (from === body.status) return NextResponse.json({ ok: true, status: from, unchanged: true })
  const { data: action, error } = await supabaseAdmin.from('ai_actions')
    .insert({ conversation_id: params.id, action: 'crm_status_changed', success: true,
      structured_payload: { from, to: body.status, note, actor: actor.username, actorId: actor.id } })
    .select('id,created_at').single()
  if (error || !action) return NextResponse.json({ error: error?.message || 'No se guardó el estado' }, { status: 500 })

  await logAdminAction({ actor, request, action: 'conversation.commercial_status_changed',
    entityType: 'ai_conversation', entityId: params.id,
    entityLabel: conversation.customer_name || conversation.external_user_id || 'Conversación',
    summary: `Estado comercial: ${COMMERCIAL_LABELS[from]} → ${COMMERCIAL_LABELS[body.status]}`,
    changes: { commercial_status: { from, to: body.status } } })
  return NextResponse.json({ ok: true, status: body.status, actionId: action.id })
}
