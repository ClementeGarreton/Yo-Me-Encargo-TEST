import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

const MAX_LIMIT = 100

/**
 * Listado del log de actividad, paginado en servidor: esta tabla crece rápido y no se
 * puede traer entera al navegador.
 *
 * Filtros: actor, action, entity (tipo), desde/hasta y búsqueda de texto.
 * Solo lectura: el log no se edita ni se borra desde la interfaz.
 */
export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams
    const limit = Math.min(Number(sp.get('limit')) || 50, MAX_LIMIT)
    const offset = Math.max(Number(sp.get('offset')) || 0, 0)

    let query = supabaseAdmin
      .from('admin_activity_log')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    const actor = sp.get('actor')
    if (actor && actor !== 'all') query = query.eq('actor_username', actor)

    const action = sp.get('action')
    if (action && action !== 'all') query = query.eq('action', action)

    const entity = sp.get('entity')
    if (entity && entity !== 'all') query = query.eq('entity_type', entity)

    const from = sp.get('from')
    if (from) query = query.gte('created_at', `${from}T00:00:00`)

    const to = sp.get('to')
    if (to) query = query.lte('created_at', `${to}T23:59:59`)

    const q = sp.get('q')
    if (q) {
      // Búsqueda sobre el resumen y la etiqueta de la entidad.
      const safe = q.replace(/[%,()]/g, ' ').trim()
      if (safe) query = query.or(`summary.ilike.%${safe}%,entity_label.ilike.%${safe}%`)
    }

    const { data, error, count } = await query

    if (error) {
      console.error('[admin/activity] Error consultando el log:', error)
      return NextResponse.json(
        { error: 'Error obteniendo la actividad' },
        { status: 500 }
      )
    }

    // Lista de usuarios que aparecen en el log, para poblar el filtro.
    const { data: actorRows } = await supabaseAdmin
      .from('admin_activity_log')
      .select('actor_username')
      .limit(1000)

    const actors = Array.from(
      new Set((actorRows || []).map((r) => r.actor_username).filter(Boolean))
    ).sort()

    return NextResponse.json({
      entries: data || [],
      total: count || 0,
      limit,
      offset,
      actors,
    })
  } catch (error) {
    console.error('Error en /api/admin/activity:', error)
    return NextResponse.json({ error: 'Error obteniendo la actividad' }, { status: 500 })
  }
}
