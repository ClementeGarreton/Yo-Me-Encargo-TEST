import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import {
  getActorFromRequest,
  logAdminAction,
  statusLabel,
  type FieldChange,
} from '@/lib/activityLog'

/** Etiqueta legible del lead, duplicada en el log para poder leerlo si se borra. */
function prospectLabel(p: { name?: string | null; email?: string | null }) {
  return p?.name || p?.email || 'Lead'
}

export async function GET(request: NextRequest) {
  try {
    // Por defecto solo leads por convertir. Con ?includeConverted=1 también trae los
    // convertidos (para consultarlos desde el panel sin perderlos de vista).
    const includeConverted =
      new URL(request.url).searchParams.get('includeConverted') === '1'

    let query = supabaseAdmin
      .from('quote_prospects')
      .select('*')
      .order('created_at', { ascending: false })

    if (!includeConverted) {
      query = query.neq('status', 'converted')
    }

    const { data: prospects, error } = await query

    if (error) {
      console.error('[Admin Prospects] Error fetching:', error)
      return NextResponse.json(
        { error: 'Error obteniendo prospectos', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json(prospects || [])
  } catch (error) {
    console.error('[Admin Prospects] Exception:', error)
    return NextResponse.json(
      { error: 'Error obteniendo prospectos' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, status, notes, source, adjusted_price, adjustment_comment, scheduled_date, scheduled_time, is_frequent } = body

    if (!id) {
      return NextResponse.json(
        { error: 'ID del prospecto requerido' },
        { status: 400 }
      )
    }

    const updateData: Record<string, any> = {
      updated_at: new Date().toISOString(),
    }

    if (status !== undefined) updateData.status = status
    if (source !== undefined) updateData.source = source
    if (notes !== undefined) updateData.notes = notes
    if (adjusted_price !== undefined) {
      updateData.adjusted_price =
        adjusted_price === null || adjusted_price === '' ? null : Math.round(Number(adjusted_price))
    }
    if (adjustment_comment !== undefined) updateData.adjustment_comment = adjustment_comment || null
    if (scheduled_date !== undefined) updateData.scheduled_date = scheduled_date || null
    if (scheduled_time !== undefined) updateData.scheduled_time = scheduled_time || null
    if (is_frequent !== undefined) updateData.is_frequent = Boolean(is_frequent)

    // Estado previo para el log (antes → después).
    const { data: before } = await supabaseAdmin
      .from('quote_prospects')
      .select('name, email, status, source, adjusted_price, is_frequent')
      .eq('id', id)
      .maybeSingle()

    const { data, error } = await supabaseAdmin
      .from('quote_prospects')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('[Admin Prospects] Error updating:', error)
      return NextResponse.json(
        { error: 'Error al actualizar prospecto' },
        { status: 500 }
      )
    }

    const actor = getActorFromRequest(request)
    const label = prospectLabel(data || before || {})
    const logBase = {
      actor,
      entityType: 'prospect',
      entityId: id,
      entityLabel: label,
      request,
    }

    if (status !== undefined && before?.status !== data?.status) {
      await logAdminAction({
        ...logBase,
        action: 'prospect.status_changed',
        summary: `Cambió el estado del lead de ${statusLabel(before?.status)} a ${statusLabel(data?.status)}`,
        changes: { status: { from: before?.status, to: data?.status } },
      })
    }

    if (is_frequent !== undefined && before?.is_frequent !== data?.is_frequent) {
      await logAdminAction({
        ...logBase,
        action: 'customer.frequent_toggled',
        summary: data?.is_frequent
          ? 'Marcó al cliente como frecuente'
          : 'Quitó al cliente de frecuentes',
        changes: { is_frequent: { from: before?.is_frequent, to: data?.is_frequent } },
      })
    }

    const otherChanges: Record<string, FieldChange> = {}
    if (source !== undefined && before?.source !== data?.source) {
      otherChanges.source = { from: before?.source, to: data?.source }
    }
    if (adjusted_price !== undefined && before?.adjusted_price !== data?.adjusted_price) {
      otherChanges.adjusted_price = { from: before?.adjusted_price, to: data?.adjusted_price }
    }
    if (Object.keys(otherChanges).length) {
      await logAdminAction({
        ...logBase,
        action: 'prospect.updated',
        summary: otherChanges.adjusted_price
          ? `Ajustó el precio del lead a ${data?.adjusted_price ?? '—'}`
          : 'Actualizó datos del lead',
        changes: otherChanges,
      })
    }

    return NextResponse.json({ success: true, prospect: data })
  } catch (error) {
    console.error('[Admin Prospects] Exception updating:', error)
    return NextResponse.json(
      { error: 'Error al actualizar prospecto' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'ID del prospecto requerido' },
        { status: 400 }
      )
    }

    // Se leen los datos ANTES de borrar: es la única copia que quedará en el log.
    const { data: before } = await supabaseAdmin
      .from('quote_prospects')
      .select('name, email, phone, status, source, total_price')
      .eq('id', id)
      .maybeSingle()

    const { error } = await supabaseAdmin
      .from('quote_prospects')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('[Admin Prospects] Error deleting:', error)
      return NextResponse.json(
        { error: 'Error al eliminar prospecto' },
        { status: 500 }
      )
    }

    await logAdminAction({
      actor: getActorFromRequest(request),
      action: 'prospect.deleted',
      entityType: 'prospect',
      entityId: id,
      entityLabel: prospectLabel(before || {}),
      summary: `Eliminó el lead ${prospectLabel(before || {})}`,
      changes: before ? { deleted_prospect: { from: before, to: null } } : null,
      request,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Admin Prospects] Exception deleting:', error)
    return NextResponse.json(
      { error: 'Error al eliminar prospecto' },
      { status: 500 }
    )
  }
}
