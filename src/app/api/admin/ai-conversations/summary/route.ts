import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'
/** Recuento real en la BD, sin límite artificial de las últimas 150 conversaciones. */
export async function GET() {
  const query = (status: string) => supabaseAdmin.from('ai_conversations')
    .select('id', { count: 'exact', head: true }).eq('status', status)
    .or('model.is.null,model.not.in.(whatsapp-router-v1-pending,whatsapp-router-v1-ready)')
  const [active, handoff, quoted, closed, error, instagram] = await Promise.all([
    query('active'), query('handoff'), query('quoted'), query('closed'), query('error'),
    supabaseAdmin.from('ai_conversations').select('id', { count: 'exact', head: true })
      .like('external_user_id', 'ig:%').or('model.is.null,model.not.in.(whatsapp-router-v1-pending,whatsapp-router-v1-ready)'),
  ])
  const all = [active, handoff, quoted, closed, error, instagram]
  const fail = all.find((row) => row.error)
  if (fail?.error) return NextResponse.json({ error: fail.error.message }, { status: 500 })
  return NextResponse.json({ active: active.count || 0, handoff: handoff.count || 0,
    quoted: quoted.count || 0, closed: closed.count || 0, error: error.count || 0,
    instagram: instagram.count || 0 })
}
