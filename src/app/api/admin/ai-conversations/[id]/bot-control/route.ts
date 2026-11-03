import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getActorFromRequest, logAdminAction } from '@/lib/activityLog'
import { findContactRouter, isContactBotLocked } from '@/lib/admin/conversationControls'
import { setBotMode } from '@/lib/whatsapp/botStateStore'

export const dynamic = 'force-dynamic'

/** La IA solo se reactiva con autorización explícita posterior del cliente: COTIZAR. */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const actor = getActorFromRequest(request)
  if (!actor) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const body = await request.json().catch(() => null)
  if (typeof body?.enabled !== 'boolean') return NextResponse.json({ error: 'Valor de activación inválido' }, { status: 400 })
  const note = String(body?.note || '').trim()
  if (note.length > 500) return NextResponse.json({ error: 'Observación demasiado extensa' }, { status: 400 })
  const { data: target, error: readError } = await supabaseAdmin.from('ai_conversations')
    .select('id,channel,external_user_id,customer_name').eq('id', params.id).maybeSingle()
  if (readError) return NextResponse.json({ error: readError.message }, { status: 500 })
  if (!target) return NextResponse.json({ error: 'Conversación inexistente' }, { status: 404 })
  if (target.channel !== 'whatsapp' || !target.external_user_id) {
    return NextResponse.json({ error: 'Este canal no utiliza el router de WhatsApp/Instagram' }, { status: 400 })
  }
  try {
    const router = await findContactRouter(target.external_user_id)
    if (!router) return NextResponse.json({ error: 'Router del contacto no encontrado' }, { status: 404 })
    const oldEnabled = !(await isContactBotLocked(target.external_user_id))
    if (oldEnabled === body.enabled) return NextResponse.json({ ok: true, enabled: oldEnabled, unchanged: true })

    // Desactivar primero: el bloqueo queda persistido aun si falla cambiar el modo.
    if (!body.enabled) {
      const { error } = await supabaseAdmin.from('ai_actions').insert({
        conversation_id: router.id, action: 'bot_policy_changed', success: true,
        structured_payload: { enabled: false, note, actor: actor.username, actorId: actor.id },
      })
      if (error) throw new Error(error.message)
      await setBotMode(target.external_user_id, 'human')
    } else {
      // Jamás iniciar una nueva cotización desde el panel; solo dejar al cliente escribir COTIZAR.
      await setBotMode(target.external_user_id, 'idle')
      const { error } = await supabaseAdmin.from('ai_actions').insert({
        conversation_id: router.id, action: 'bot_policy_changed', success: true,
        structured_payload: { enabled: true, note, actor: actor.username, actorId: actor.id },
      })
      if (error) throw new Error(error.message)
    }
    await logAdminAction({ actor, request, action: 'conversation.bot_policy_changed',
      entityType: 'ai_conversation', entityId: router.id,
      entityLabel: target.customer_name || target.external_user_id,
      summary: body.enabled ? 'Dejó disponible la cotización bajo solicitud expresa del cliente' : 'Bloqueó la IA; atención exclusivamente humana',
      changes: { bot_enabled: { from: oldEnabled, to: body.enabled } } })
    return NextResponse.json({ ok: true, enabled: body.enabled })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Error de control de IA' }, { status: 500 })
  }
}
