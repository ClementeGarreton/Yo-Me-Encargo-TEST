import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getActorFromRequest, logAdminAction } from '@/lib/activityLog'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    const body = await request.json()
    const { date, start_time, end_time, reason, sync_from_calendar } = body

    // Validar datos
    if (!date || !start_time || !end_time || !reason) {
      return NextResponse.json(
        { error: 'Todos los campos son requeridos' },
        { status: 400 }
      )
    }

    if (start_time >= end_time) {
      return NextResponse.json(
        { error: 'La hora de fin debe ser mayor a la hora de inicio' },
        { status: 400 }
      )
    }

    // Actualizar el bloqueo
    const { data: blockedSlot, error } = await supabaseAdmin
      .from('blocked_slots')
      .update({
        date,
        start_time,
        end_time,
        reason,
        sync_from_calendar: sync_from_calendar || false,
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating blocked slot:', error)
      return NextResponse.json(
        { error: 'Error al actualizar el bloqueo de horario' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      blockedSlot,
      message: 'Bloqueo de horario actualizado correctamente'
    })
  } catch (error) {
    console.error('Error in /api/admin/blocked-slots/[id] PATCH:', error)
    return NextResponse.json(
      { error: 'Error al actualizar el bloqueo de horario' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params

    const { data: before } = await supabaseAdmin
      .from('blocked_slots')
      .select('date, start_time, end_time, reason')
      .eq('id', id)
      .maybeSingle()

    // Eliminar el bloqueo
    const { error } = await supabaseAdmin
      .from('blocked_slots')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting blocked slot:', error)
      return NextResponse.json(
        { error: 'Error al eliminar el bloqueo de horario' },
        { status: 500 }
      )
    }

    await logAdminAction({
      actor: getActorFromRequest(request),
      action: 'blocked_slot.deleted',
      entityType: 'schedule',
      entityId: id,
      entityLabel: before ? `${before.date} ${String(before.start_time ?? '').slice(0, 5)}` : id,
      summary: before
        ? `Liberó el bloqueo del ${before.date} de ${String(before.start_time ?? '').slice(0, 5)} a ${String(before.end_time ?? '').slice(0, 5)}`
        : 'Eliminó un bloqueo de agenda',
      changes: before ? { deleted_block: { from: before, to: null } } : null,
      request,
    })

    return NextResponse.json({
      success: true,
      message: 'Bloqueo de horario eliminado correctamente'
    })
  } catch (error) {
    console.error('Error in /api/admin/blocked-slots/[id] DELETE:', error)
    return NextResponse.json(
      { error: 'Error al eliminar el bloqueo de horario' },
      { status: 500 }
    )
  }
}